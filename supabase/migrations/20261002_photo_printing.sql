-- Private photo print queue. Apply once with the Supabase SQL editor/migrations.
create table public.photo_print_session (
  id boolean primary key default true check (id),
  accepting boolean not null default false,
  capacity integer not null default 100 check (capacity = 100),
  reserved integer not null default 0 check (reserved between 0 and capacity)
);
insert into public.photo_print_session(id) values (true);
create table public.photo_print_uploads (
  id uuid primary key,
  token_hash text not null,
  storage_path text not null unique,
  width integer not null check(width > 0),
  height integer not null check(height > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);
create table public.photo_print_requests (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  tracking_hash text not null,
  fingerprint text not null,
  guest_name text not null check(length(guest_name) between 1 and 80),
  pickup_code text not null unique,
  storage_path text not null,
  orientation text not null check(orientation in ('portrait','landscape')),
  status text not null default 'pending' check(status in ('pending','approved','claimed','submitting','submitted','review','ready','rejected')),
  created_at timestamptz not null default now()
);
create table public.photo_print_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.photo_print_requests(id),
  operation_key uuid not null unique,
  status text not null default 'queued' check(status in ('queued','claimed','submitting','submitted','review','ready','canceled','superseded')),
  station_id uuid,
  claim_token uuid,
  lease_until timestamptz,
  cups_job_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.photo_print_station (
  id boolean primary key default true check(id),
  station_id uuid not null,
  last_seen timestamptz not null,
  printer text not null,
  error text
);
create table public.photo_print_operations (
  operation_key uuid primary key,
  action text not null,
  request_id uuid not null references public.photo_print_requests(id)
);
create table public.photo_print_upload_budget (
  hour timestamptz primary key,
  count integer not null
);
alter table public.photo_print_upload_budget enable row level security;
revoke all on public.photo_print_upload_budget from anon, authenticated;
grant all on public.photo_print_upload_budget to service_role;
create index photo_print_attempt_status_idx on public.photo_print_attempts(status,created_at);
create index photo_print_request_created_idx on public.photo_print_requests(created_at);
alter table public.photo_print_session enable row level security;
alter table public.photo_print_uploads enable row level security;
alter table public.photo_print_requests enable row level security;
alter table public.photo_print_attempts enable row level security;
alter table public.photo_print_station enable row level security;
alter table public.photo_print_operations enable row level security;
revoke all on public.photo_print_session, public.photo_print_uploads, public.photo_print_requests, public.photo_print_attempts, public.photo_print_station, public.photo_print_operations from anon, authenticated;
grant all on public.photo_print_session, public.photo_print_uploads, public.photo_print_requests, public.photo_print_attempts, public.photo_print_station, public.photo_print_operations to service_role;

-- Every quota/state mutation takes this same row lock. No external I/O in transaction.
create function public.photo_print_command(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  s public.photo_print_session%rowtype;
  r public.photo_print_requests%rowtype;
  a public.photo_print_attempts%rowtype;
  u public.photo_print_uploads%rowtype;
  op public.photo_print_operations%rowtype;
  result jsonb;
  rid uuid;
  sid uuid;
  key uuid;
begin
  select * into strict s from public.photo_print_session where id = true for update;
  -- Never requeue an expired claim: native spool acceptance might have occurred.
  update public.photo_print_requests set status = 'review'
    where id in (select request_id from public.photo_print_attempts where status in ('claimed','submitting') and lease_until < now());
  update public.photo_print_attempts set status = 'review', error = 'Trạm in mất kết nối; cần kiểm tra trước khi in lại.', updated_at = now()
    where status in ('claimed','submitting') and lease_until < now();

  if p_action = 'upload_limit' then
    if not s.accepting then raise exception 'PAUSED'; end if;
    if s.reserved >= s.capacity then raise exception 'FULL'; end if;
    if coalesce((select count from public.photo_print_upload_budget where hour=date_trunc('hour',now())),0) >= 400 then raise exception 'UPLOAD_LIMIT'; end if;
    insert into public.photo_print_upload_budget values(date_trunc('hour',now()),1)
      on conflict(hour) do update set count=photo_print_upload_budget.count+1;
    return '{}'::jsonb;
  elsif p_action = 'session' then
    return jsonb_build_object('accepting',s.accepting,'capacity',s.capacity,'reserved',s.reserved,'remaining',s.capacity-s.reserved);
  elsif p_action = 'create' then
    select * into r from public.photo_print_requests where request_key = (p_payload->>'request_key')::uuid;
    if found then
      if r.tracking_hash <> p_payload->>'tracking_hash' or r.fingerprint <> p_payload->>'fingerprint' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      return to_jsonb(r);
    end if;
    if not s.accepting then raise exception 'PAUSED'; end if;
    if s.reserved >= s.capacity then raise exception 'FULL'; end if;
    select * into u from public.photo_print_uploads where id = (p_payload->>'upload_id')::uuid and token_hash = p_payload->>'upload_hash' and expires_at > now();
    if not found then raise exception 'UPLOAD_NOT_FOUND'; end if;
    insert into public.photo_print_requests(request_key,tracking_hash,fingerprint,guest_name,pickup_code,storage_path,orientation)
      values ((p_payload->>'request_key')::uuid,p_payload->>'tracking_hash',p_payload->>'fingerprint',p_payload->>'guest_name',upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),p_payload->>'storage_path',p_payload->>'orientation') returning * into r;
    update public.photo_print_session set reserved = reserved+1 where id;
    return to_jsonb(r);
  elsif p_action in ('pause','resume') then
    update public.photo_print_session set accepting = (p_action='resume') where id;
    return '{}'::jsonb;
  elsif p_action = 'admin_list' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at, q.id), '[]'::jsonb) into result from (
      select pr.*, coalesce((select jsonb_agg(jsonb_build_object('id',pa.id,'status',pa.status,'cups_job_id',pa.cups_job_id,'error',pa.error,'created_at',pa.created_at) order by pa.created_at) from public.photo_print_attempts pa where pa.request_id=pr.id),'[]'::jsonb) attempts
      from public.photo_print_requests pr
    ) q;
    return jsonb_build_object('session',jsonb_build_object('accepting',s.accepting,'capacity',s.capacity,'reserved',s.reserved,'remaining',s.capacity-s.reserved), 'requests',result,'station',(select to_jsonb(st) from public.photo_print_station st where id));
  elsif p_action in ('approve','reject','ready','reprint') then
    rid := (p_payload->>'id')::uuid;
    key := (p_payload->>'operation_key')::uuid;
    select * into op from public.photo_print_operations where operation_key=key;
    if found then
      if op.action <> p_action or op.request_id <> rid then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      return '{}'::jsonb;
    end if;
    select * into r from public.photo_print_requests where id = rid for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if p_action = 'approve' then
      if r.status <> 'pending' then raise exception 'STATE_CONFLICT'; end if;
      insert into public.photo_print_attempts(request_id,operation_key) values(rid,key);
      update public.photo_print_requests set status='approved' where id=rid;
    elsif p_action = 'reject' then
      if r.status not in ('pending','approved') then raise exception 'STATE_CONFLICT'; end if;
      update public.photo_print_attempts set status='canceled',updated_at=now() where request_id=rid and status='queued';
      update public.photo_print_requests set status='rejected' where id=rid;
      update public.photo_print_session set reserved=reserved-1 where id;
    elsif p_action = 'ready' then
      if r.status not in ('submitted','review') then raise exception 'STATE_CONFLICT'; end if;
      update public.photo_print_attempts set status='ready',updated_at=now() where request_id=rid and status in ('submitted','review');
      update public.photo_print_requests set status='ready' where id=rid;
    else
      if r.status not in ('ready','review') then raise exception 'STATE_CONFLICT'; end if;
      if s.reserved >= s.capacity then raise exception 'FULL'; end if;
      update public.photo_print_attempts set status='superseded',updated_at=now() where request_id=rid and status='review';
      insert into public.photo_print_attempts(request_id,operation_key) values(rid,key);
      update public.photo_print_requests set status='approved' where id=rid;
      update public.photo_print_session set reserved=reserved+1 where id;
    end if;
    insert into public.photo_print_operations values(key,p_action,rid);
    return '{}'::jsonb;
  elsif p_action = 'heartbeat' then
    sid := (p_payload->>'station_id')::uuid;
    -- One physical station: do not silently replace a recently active Mac.
    if exists(select 1 from public.photo_print_station where station_id<>sid and last_seen > now()-interval '30 seconds') then raise exception 'STATION_BUSY'; end if;
    insert into public.photo_print_station(id,station_id,last_seen,printer,error)
      values(true,sid,now(),left(p_payload->>'printer',160),left(p_payload->>'error',500))
      on conflict(id) do update set station_id=excluded.station_id,last_seen=excluded.last_seen,printer=excluded.printer,error=excluded.error;
    return '{}'::jsonb;
  elsif p_action = 'claim' then
    sid := (p_payload->>'station_id')::uuid;
    if not exists(select 1 from public.photo_print_station where station_id=sid and last_seen > now()-interval '15 seconds' and error is null) then raise exception 'STATION_OFFLINE'; end if;
    if exists(select 1 from public.photo_print_attempts where status in ('claimed','submitting','submitted','review')) then return 'null'::jsonb; end if;
    select * into a from public.photo_print_attempts where status='queued' order by created_at,id limit 1 for update;
    if not found then return 'null'::jsonb; end if;
    update public.photo_print_attempts set status='claimed',station_id=sid,claim_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',updated_at=now() where id=a.id returning * into a;
    update public.photo_print_requests set status='claimed' where id=a.request_id returning * into r;
    return jsonb_build_object('attempt_id',a.id,'request_id',r.id,'claim_token',a.claim_token,'storage_path',r.storage_path,'orientation',r.orientation,'pickup_code',r.pickup_code);
  elsif p_action in ('begin','submitted','review') then
    select * into a from public.photo_print_attempts where id=(p_payload->>'attempt_id')::uuid and station_id=(p_payload->>'station_id')::uuid and claim_token=(p_payload->>'claim_token')::uuid for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if p_action = 'begin' then
      if a.status <> 'claimed' then raise exception 'STATE_CONFLICT'; end if;
      update public.photo_print_attempts set status='submitting',updated_at=now() where id=a.id;
      update public.photo_print_requests set status='submitting' where id=a.request_id;
    elsif p_action = 'submitted' then
      if a.status = 'submitted' and a.cups_job_id=p_payload->>'cups_job_id' then return '{}'::jsonb; end if;
      if a.status not in ('submitting','review') then raise exception 'STATE_CONFLICT'; end if;
      if coalesce(p_payload->>'cups_job_id','') !~ '^[A-Za-z0-9_.-]+-[0-9]+$' then raise exception 'INVALID_JOB'; end if;
      update public.photo_print_attempts set status='submitted',cups_job_id=p_payload->>'cups_job_id',error=null,updated_at=now() where id=a.id;
      update public.photo_print_requests set status='submitted' where id=a.request_id;
    else
      if a.status='review' then return '{}'::jsonb; end if;
      if a.status not in ('claimed','submitting','submitted') then raise exception 'STATE_CONFLICT'; end if;
      update public.photo_print_attempts set status='review',error=left(coalesce(p_payload->>'error','Cần kiểm tra trạm in.'),500),updated_at=now() where id=a.id;
      update public.photo_print_requests set status='review' where id=a.request_id;
    end if;
    return '{}'::jsonb;
  end if;
  raise exception 'INVALID_ACTION';
end;
$$;
revoke all on function public.photo_print_command(text,jsonb) from public, anon, authenticated;
grant execute on function public.photo_print_command(text,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('photo_print_private','photo_print_private',false,12582912,array['image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Intentionally no anonymous/authenticated storage policies; only server service role.
