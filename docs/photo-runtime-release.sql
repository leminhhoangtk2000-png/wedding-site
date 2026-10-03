begin;
create table if not exists public.photo_print_release_steps(name text primary key,applied_at timestamptz not null default now());
alter table public.photo_print_release_steps enable row level security;
revoke all on public.photo_print_release_steps from public,anon,authenticated;
grant all on public.photo_print_release_steps to service_role;

-- 20261002_photo_printing.sql
do $release$ begin
 if to_regclass('public.photo_print_session') is null then
 execute $photo_migration_0$-- Private photo print queue. Apply once with the Supabase SQL editor/migrations.
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
  elsif p_action = 'edit' then
    rid := (p_payload->>'id')::uuid;
    key := (p_payload->>'operation_key')::uuid;
    if key is not null then
      select * into op from public.photo_print_operations where operation_key=key;
      if found then
        if op.action not in ('edit','approve') or op.request_id <> rid then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
        return (select to_jsonb(r_exist) from public.photo_print_requests r_exist where id = rid);
      end if;
    end if;
    select * into r from public.photo_print_requests where id = rid for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if r.status not in ('pending','review') then raise exception 'STATE_CONFLICT'; end if;
    if p_payload ? 'guest_name' and p_payload->>'guest_name' is not null and length(trim(p_payload->>'guest_name')) between 1 and 80 then
      update public.photo_print_requests set guest_name = trim(p_payload->>'guest_name') where id = rid;
    end if;
    if p_payload ? 'orientation' and p_payload->>'orientation' in ('portrait','landscape') then
      update public.photo_print_requests set orientation = p_payload->>'orientation' where id = rid;
    end if;
    if p_payload ? 'storage_path' and length(p_payload->>'storage_path') > 0 then
      update public.photo_print_requests set storage_path = p_payload->>'storage_path' where id = rid;
    end if;
    if p_payload ? 'filter_snapshot' and p_payload->'filter_snapshot' is not null then
      update public.photo_print_requests set filter_snapshot = p_payload->'filter_snapshot' where id = rid;
    end if;
    if (p_payload->>'approve')::boolean is true then
      insert into public.photo_print_attempts(request_id,operation_key) values(rid,key);
      update public.photo_print_requests set status='approved' where id=rid;
      insert into public.photo_print_operations values(key,'approve',rid);
    elsif key is not null then
      insert into public.photo_print_operations values(key,'edit',rid);
    end if;
    return (select to_jsonb(r_updated) from public.photo_print_requests r_updated where id = rid);
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
$photo_migration_0$;
 end if;
 end $release$;

-- 20261002_remove_photo_quota_limit.sql
do $release$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='photo_print_session' and column_name='capacity' and is_nullable='NO') then
 execute $photo_migration_1$-- Migration: Remove 100 photo limit for photo printing
-- Run this script in the Supabase SQL Editor for your project.

-- 1. Drop the check constraint enforcing capacity = 100
alter table public.photo_print_session drop constraint if exists photo_print_session_capacity_check;

-- 2. Drop the check constraint enforcing reserved between 0 and capacity
alter table public.photo_print_session drop constraint if exists photo_print_session_check;

-- 3. Make capacity column optional (nullable, null means unlimited)
alter table public.photo_print_session alter column capacity drop not null;
alter table public.photo_print_session alter column capacity set default null;

-- 4. Ensure reserved count is always non-negative without an arbitrary upper ceiling
alter table public.photo_print_session add constraint photo_print_session_reserved_check check (reserved >= 0);

-- 5. Clear capacity limit on the current active session row
update public.photo_print_session set capacity = null where id = true;

-- 6. Update photo_print_command function so it does not block submissions when capacity is null
create or replace function public.photo_print_command(p_action text, p_payload jsonb default '{}'::jsonb)
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
    if s.capacity is not null and s.reserved >= s.capacity then raise exception 'FULL'; end if;
    if coalesce((select count from public.photo_print_upload_budget where hour=date_trunc('hour',now())),0) >= 400 then raise exception 'UPLOAD_LIMIT'; end if;
    insert into public.photo_print_upload_budget values(date_trunc('hour',now()),1)
      on conflict(hour) do update set count=photo_print_upload_budget.count+1;
    return '{}'::jsonb;
  elsif p_action = 'session' then
    return jsonb_build_object(
      'accepting', s.accepting,
      'capacity', s.capacity,
      'reserved', s.reserved,
      'remaining', case when s.capacity is null then null else s.capacity - s.reserved end
    );
  elsif p_action = 'create' then
    select * into r from public.photo_print_requests where request_key = (p_payload->>'request_key')::uuid;
    if found then
      if r.tracking_hash <> p_payload->>'tracking_hash' or r.fingerprint <> p_payload->>'fingerprint' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      return to_jsonb(r);
    end if;
    if not s.accepting then raise exception 'PAUSED'; end if;
    if s.capacity is not null and s.reserved >= s.capacity then raise exception 'FULL'; end if;
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
    return jsonb_build_object(
      'session', jsonb_build_object(
        'accepting', s.accepting,
        'capacity', s.capacity,
        'reserved', s.reserved,
        'remaining', case when s.capacity is null then null else s.capacity - s.reserved end
      ),
      'requests', result,
      'station', (select to_jsonb(st) from public.photo_print_station st where id)
    );
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
      if s.capacity is not null and s.reserved >= s.capacity then raise exception 'FULL'; end if;
      update public.photo_print_attempts set status='superseded',updated_at=now() where request_id=rid and status='review';
      insert into public.photo_print_attempts(request_id,operation_key) values(rid,key);
      update public.photo_print_requests set status='approved' where id=rid;
      update public.photo_print_session set reserved=reserved+1 where id;
    end if;
    insert into public.photo_print_operations values(key,p_action,rid);
    return '{}'::jsonb;
  elsif p_action = 'edit' then
    rid := (p_payload->>'id')::uuid;
    key := (p_payload->>'operation_key')::uuid;
    if key is not null then
      select * into op from public.photo_print_operations where operation_key=key;
      if found then
        if op.action not in ('edit','approve') or op.request_id <> rid then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
        return (select to_jsonb(r_exist) from public.photo_print_requests r_exist where id = rid);
      end if;
    end if;
    select * into r from public.photo_print_requests where id = rid for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if r.status not in ('pending','review') then raise exception 'STATE_CONFLICT'; end if;
    if p_payload ? 'guest_name' and p_payload->>'guest_name' is not null and length(trim(p_payload->>'guest_name')) between 1 and 80 then
      update public.photo_print_requests set guest_name = trim(p_payload->>'guest_name') where id = rid;
    end if;
    if p_payload ? 'orientation' and p_payload->>'orientation' in ('portrait','landscape') then
      update public.photo_print_requests set orientation = p_payload->>'orientation' where id = rid;
    end if;
    if p_payload ? 'storage_path' and length(p_payload->>'storage_path') > 0 then
      update public.photo_print_requests set storage_path = p_payload->>'storage_path' where id = rid;
    end if;
    if p_payload ? 'filter_snapshot' and p_payload->'filter_snapshot' is not null then
      update public.photo_print_requests set filter_snapshot = p_payload->'filter_snapshot' where id = rid;
    end if;
    if (p_payload->>'approve')::boolean is true then
      insert into public.photo_print_attempts(request_id,operation_key) values(rid,key);
      update public.photo_print_requests set status='approved' where id=rid;
      insert into public.photo_print_operations values(key,'approve',rid);
    elsif key is not null then
      insert into public.photo_print_operations values(key,'edit',rid);
    end if;
    return (select to_jsonb(r_updated) from public.photo_print_requests r_updated where id = rid);
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
$photo_migration_1$;
 end if;
 end $release$;

-- 20261002_photo_film_presets.sql
do $release$ begin
 if to_regclass('public.photo_print_preset_versions') is null then
 execute $photo_migration_2$-- Immutable film settings and per-request render snapshots. Apply after photo_printing.

create table public.photo_print_preset_versions (
 version integer primary key check(version > 0), presets jsonb not null check(jsonb_typeof(presets)='array'),
 operation_key uuid unique, created_at timestamptz not null default now()
);
alter table public.photo_print_preset_versions enable row level security;
revoke all on public.photo_print_preset_versions from anon, authenticated;
grant select, insert on public.photo_print_preset_versions to service_role;
insert into public.photo_print_preset_versions(version,presets) values(1,'[{"id":"natural","name":"Original","subtitle":"Keep original camera colors","tags":[],"profile":"original","defaultIntensity":100,"settings":{"brightness":0,"warmth":0,"contrast":0,"saturation":0,"fade":0,"grain":0},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"soft_wedding","name":"Soft Wedding","subtitle":"Natural skin tones with gentle transitions","tags":["Afternoon","Portrait"],"profile":"astia","defaultIntensity":70,"settings":{"brightness":2,"warmth":0,"contrast":-3,"saturation":1,"fade":1,"grain":2},"enabled":true,"isDefault":true,"monochrome":false,"icon":"✦"},{"id":"golden_memory","name":"Golden Memory","subtitle":"Amber sunset glow with nostalgic warmth","tags":["Afternoon"],"profile":"nostalgic","defaultIntensity":60,"settings":{"brightness":1,"warmth":0,"contrast":-2,"saturation":-3,"fade":2,"grain":3},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"clean_portrait","name":"Clean Portrait","subtitle":"Smooth skin tones for indoor lighting & flash","tags":["Portrait"],"profile":"pro_neg","defaultIntensity":60,"settings":{"brightness":1,"warmth":0,"contrast":-4,"saturation":-4,"fade":0,"grain":1},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"evening_cinema","name":"Evening Cinema","subtitle":"Subtle cinema palette with soft shadows","tags":["Evening"],"profile":"eterna","defaultIntensity":60,"settings":{"brightness":0,"warmth":0,"contrast":-6,"saturation":-8,"fade":2,"grain":1},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"classic_story","name":"Classic Story","subtitle":"Documentary tones with cool crisp contrast","tags":["Afternoon","Evening"],"profile":"chrome","defaultIntensity":60,"settings":{"brightness":0,"warmth":0,"contrast":2,"saturation":-6,"fade":1,"grain":3},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"timeless_bw","name":"Timeless B&W","subtitle":"Monochrome elegance with fine film grain","tags":["Evening","Portrait"],"profile":"acros","defaultIntensity":100,"settings":{"brightness":1,"warmth":0,"contrast":3,"saturation":0,"fade":0,"grain":4},"enabled":true,"isDefault":false,"monochrome":true,"icon":"◐"}]'::jsonb);
alter table public.photo_print_requests add column filter_snapshot jsonb;
-- Separate RPC so changes to the queue state machine do not replace film settings.
create function public.photo_print_film_command(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare config public.photo_print_preset_versions%rowtype; result jsonb;
begin
 if p_action='preset_config' then
   if p_payload ? 'version' then
     select * into config from photo_print_preset_versions where version=(p_payload->>'version')::integer;
   else select * into config from photo_print_preset_versions order by version desc limit 1; end if;
   if not found then raise exception 'CONFIG_NOT_FOUND'; end if;
   return jsonb_build_object('version',config.version,'presets',config.presets);
 elsif p_action='save_presets' then
   perform 1 from photo_print_session where id=true for update;
   select * into config from photo_print_preset_versions where operation_key=(p_payload->>'operation_key')::uuid;
   if found then
     if config.presets<>p_payload->'presets' or config.version<>(p_payload->>'expected_version')::integer+1 then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
     return jsonb_build_object('version',config.version,'presets',config.presets);
   end if;
   select * into config from photo_print_preset_versions order by version desc limit 1;
   if config.version<>(p_payload->>'expected_version')::integer then raise exception 'CONFIG_STALE'; end if;
   insert into photo_print_preset_versions(version,presets,operation_key)
     values(config.version+1,p_payload->'presets',(p_payload->>'operation_key')::uuid) returning * into config;
   return jsonb_build_object('version',config.version,'presets',config.presets);
 end if;
 if p_action<>'create' then raise exception 'INVALID_ACTION'; end if;
 result:=photo_print_command(p_action,p_payload);
 if p_action='create' and p_payload ? 'filter_snapshot' then
   -- Existing unframed prints are immutable too; never attach a new snapshot on retry.
   update photo_print_requests set filter_snapshot=p_payload->'filter_snapshot'
     where id=(result->>'id')::uuid and filter_snapshot is null and storage_path=p_payload->>'storage_path';
   select to_jsonb(r) into result from photo_print_requests r where id=(result->>'id')::uuid;
 end if;
 return result;
end $$;
revoke all on function public.photo_print_film_command(text,jsonb) from public, anon, authenticated;
grant execute on function public.photo_print_film_command(text,jsonb) to service_role;
$photo_migration_2$;
 end if;
 end $release$;

alter table public.photo_print_requests add column if not exists filter_snapshot jsonb;
create or replace function public.photo_print_film_command(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare config public.photo_print_preset_versions%rowtype; result jsonb;
begin
 if p_action='preset_config' then
   if p_payload ? 'version' then
     select * into config from photo_print_preset_versions where version=(p_payload->>'version')::integer;
   else select * into config from photo_print_preset_versions order by version desc limit 1; end if;
   if not found then raise exception 'CONFIG_NOT_FOUND'; end if;
   return jsonb_build_object('version',config.version,'presets',config.presets);
 elsif p_action='save_presets' then
   perform 1 from photo_print_session where id=true for update;
   select * into config from photo_print_preset_versions where operation_key=(p_payload->>'operation_key')::uuid;
   if found then
     if config.presets<>p_payload->'presets' or config.version<>(p_payload->>'expected_version')::integer+1 then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
     return jsonb_build_object('version',config.version,'presets',config.presets);
   end if;
   select * into config from photo_print_preset_versions order by version desc limit 1;
   if config.version<>(p_payload->>'expected_version')::integer then raise exception 'CONFIG_STALE'; end if;
   insert into photo_print_preset_versions(version,presets,operation_key)
     values(config.version+1,p_payload->'presets',(p_payload->>'operation_key')::uuid) returning * into config;
   return jsonb_build_object('version',config.version,'presets',config.presets);
 end if;
 if p_action<>'create' then raise exception 'INVALID_ACTION'; end if;
 result:=photo_print_command(p_action,p_payload);
 if p_action='create' and p_payload ? 'filter_snapshot' then
   -- Existing unframed prints are immutable too; never attach a new snapshot on retry.
   update photo_print_requests set filter_snapshot=p_payload->'filter_snapshot'
     where id=(result->>'id')::uuid and filter_snapshot is null and storage_path=p_payload->>'storage_path';
   select to_jsonb(r) into result from photo_print_requests r where id=(result->>'id')::uuid;
 end if;
 return result;
end $$;
revoke all on function public.photo_print_film_command(text,jsonb) from public, anon, authenticated;
grant execute on function public.photo_print_film_command(text,jsonb) to service_role;

-- 20261002_photo_film_looks_v2.sql
do $release$ begin
 if not exists(select 1 from public.photo_print_preset_versions v, jsonb_array_elements(v.presets) p where p->>'profile'='astia_v2') then
 execute $photo_migration_3$-- Publish stronger looks without changing historical catalogs or operator settings.

lock table public.photo_print_preset_versions in exclusive mode;
insert into public.photo_print_preset_versions(version,presets)
select current.version+1, (
 select jsonb_agg(case when revision.value is null then entry.value else
   entry.value || jsonb_build_object('profile',revision.value->'profile','subtitle',revision.value->'subtitle')
 end order by entry.ordinality)
 from jsonb_array_elements(current.presets) with ordinality as entry(value,ordinality)
 left join jsonb_array_elements('[{"id":"soft_wedding","name":"Soft Wedding","subtitle":"Airy pastel colors with luminous skin tones","tags":["Afternoon","Portrait"],"profile":"astia_v2","defaultIntensity":70,"settings":{"brightness":2,"warmth":0,"contrast":-3,"saturation":1,"fade":1,"grain":2},"enabled":true,"isDefault":true,"monochrome":false,"icon":"✦"},{"id":"golden_memory","name":"Golden Memory","subtitle":"Warm amber highlights and nostalgic olive greens","tags":["Afternoon"],"profile":"nostalgic_v2","defaultIntensity":60,"settings":{"brightness":1,"warmth":0,"contrast":-2,"saturation":-3,"fade":2,"grain":3},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"clean_portrait","name":"Clean Portrait","subtitle":"Neutral skin tones with clean, balanced contrast","tags":["Portrait"],"profile":"pro_neg_v2","defaultIntensity":60,"settings":{"brightness":1,"warmth":0,"contrast":-4,"saturation":-4,"fade":0,"grain":1},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"evening_cinema","name":"Evening Cinema","subtitle":"Muted cinema colors with cool, matte shadows","tags":["Evening"],"profile":"eterna_v2","defaultIntensity":60,"settings":{"brightness":0,"warmth":0,"contrast":-6,"saturation":-8,"fade":2,"grain":1},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"classic_story","name":"Classic Story","subtitle":"Deep documentary contrast with muted blues and greens","tags":["Afternoon","Evening"],"profile":"chrome_v2","defaultIntensity":60,"settings":{"brightness":0,"warmth":0,"contrast":2,"saturation":-6,"fade":1,"grain":3},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"timeless_bw","name":"Timeless B&W","subtitle":"Rich monochrome contrast with fine film grain","tags":["Evening","Portrait"],"profile":"acros_v2","defaultIntensity":100,"settings":{"brightness":1,"warmth":0,"contrast":3,"saturation":0,"fade":0,"grain":4},"enabled":true,"isDefault":false,"monochrome":true,"icon":"◐"}]'::jsonb) as revision(value)
   on revision.value->>'id'=entry.value->>'id'
)
from (select * from public.photo_print_preset_versions order by version desc limit 1) as current;
$photo_migration_3$;
 end if;
 end $release$;

-- 20261002_photo_film_stocks_v3.sql
do $release$ begin
 if not exists(select 1 from public.photo_print_preset_versions v, jsonb_array_elements(v.presets) p where p->>'profile'='velvia_v3') then
 execute $photo_migration_4$-- Add expressive stock interpretations; never rewrite pinned catalog versions.

lock table public.photo_print_preset_versions in exclusive mode;
insert into public.photo_print_preset_versions(version,presets)
select latest.version+1, (
 select jsonb_agg(value order by priority, ordinality) from (
   select entry.value, entry.ordinality,
     case when entry.value->>'id' in ('natural','soft_wedding') then 0 else 2 end as priority
   from jsonb_array_elements(latest.presets) with ordinality as entry(value,ordinality)
   union all
   select stock.value, stock.ordinality, 1 as priority
   from jsonb_array_elements('[{"id":"velvia_vivid","name":"Velvia Vivid","subtitle":"Rich jewel colors, deep greens and vivid slide-film contrast","tags":["Afternoon","Vivid"],"profile":"velvia_v3","defaultIntensity":100,"settings":{"brightness":0,"warmth":0,"contrast":0,"saturation":0,"fade":0,"grain":3},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"classic_negative","name":"Classic Neg. Retro","subtitle":"Cyan greens, warm reds and punchy color-negative shadows","tags":["Afternoon","Retro"],"profile":"classic_neg_v3","defaultIntensity":100,"settings":{"brightness":0,"warmth":0,"contrast":0,"saturation":0,"fade":0,"grain":5},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"nostalgic_amber","name":"Nostalgic Neg. Amber","subtitle":"Honey highlights, warm browns and a luminous vintage finish","tags":["Afternoon","Warm"],"profile":"nostalgic_v3","defaultIntensity":100,"settings":{"brightness":0,"warmth":0,"contrast":0,"saturation":0,"fade":0,"grain":4},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"bleach_bypass","name":"ETERNA Bleach Bypass","subtitle":"Silver shadows, very muted colors and bold cinema contrast","tags":["Evening","Cinema"],"profile":"bleach_v3","defaultIntensity":100,"settings":{"brightness":0,"warmth":0,"contrast":0,"saturation":0,"fade":0,"grain":4},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"},{"id":"sepia_archive","name":"Sepia Archive","subtitle":"Warm brown monochrome for an antique keepsake feel","tags":["Evening","Vintage"],"profile":"sepia_v3","defaultIntensity":100,"settings":{"brightness":0,"warmth":0,"contrast":0,"saturation":0,"fade":0,"grain":4},"enabled":true,"isDefault":false,"monochrome":false,"icon":"✦"}]'::jsonb) with ordinality as stock(value,ordinality)
   where not exists(select 1 from jsonb_array_elements(latest.presets) as existing(value)
     where existing.value->>'id'=stock.value->>'id')
 ) as catalog
)
from (select * from public.photo_print_preset_versions order by version desc limit 1) as latest;
$photo_migration_4$;
 end if;
 end $release$;

-- 20261002180000_photo_admin_edit_safe.sql
do $release$ begin
 if not exists(select 1 from public.photo_print_release_steps where name='safe_edit') then
 execute $photo_migration_5$-- Apply after the existing photo printing / quota / film migrations.
-- Keep operator review on its explicit ready/reprint flow; only pending requests can be edited.

alter table public.photo_print_requests add column if not exists edit_revision integer not null default 0;
alter table public.photo_print_requests add column if not exists admin_image_edited boolean not null default false;
alter table public.photo_print_operations add column if not exists edit_fingerprint text;
alter table public.photo_print_operations add column if not exists edit_result jsonb;
-- Preserve all existing queue behavior instead of copying another complete function.
do $$ begin
  if to_regprocedure('public.photo_print_command_before_safe_edit(text,jsonb)') is null then
    alter function public.photo_print_command(text,jsonb) rename to photo_print_command_before_safe_edit;
  end if;
end $$;
create or replace function public.photo_print_command(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  r public.photo_print_requests%rowtype;
  op public.photo_print_operations%rowtype;
  rid uuid := (p_payload->>'id')::uuid;
  key uuid := (p_payload->>'operation_key')::uuid;
  result jsonb;
begin
  if p_action not in ('edit','edit_retry') then
    return public.photo_print_command_before_safe_edit(p_action,p_payload);
  end if;
  if key is null or rid is null or coalesce(p_payload->>'edit_fingerprint','') = '' then
    raise exception 'INVALID_INPUT';
  end if;
  -- Use the same lock order as approve/claim to serialize state and operation retries.
  perform 1 from public.photo_print_session where id=true for update;
  select * into op from public.photo_print_operations where operation_key=key;
  if found then
    if op.action <> 'edit' or op.request_id <> rid or op.edit_fingerprint is distinct from p_payload->>'edit_fingerprint' then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return op.edit_result;
  end if;
  if p_action='edit_retry' then return 'null'::jsonb; end if;
  select * into r from public.photo_print_requests where id=rid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'STATE_CONFLICT'; end if;
  if r.edit_revision is distinct from (p_payload->>'expected_revision')::integer then raise exception 'STATE_CONFLICT'; end if;
  if p_payload ? 'guest_name' and (p_payload->>'guest_name' is null or length(trim(p_payload->>'guest_name')) not between 1 and 80) then raise exception 'INVALID_INPUT'; end if;
  if p_payload ? 'orientation' and (p_payload->>'orientation' is null or p_payload->>'orientation' not in ('portrait','landscape')) then raise exception 'INVALID_INPUT'; end if;
  update public.photo_print_requests set
    guest_name=case when p_payload ? 'guest_name' then trim(p_payload->>'guest_name') else guest_name end,
    orientation=case when p_payload ? 'orientation' then p_payload->>'orientation' else orientation end,
    storage_path=coalesce(p_payload->>'storage_path',storage_path),
    admin_image_edited=admin_image_edited or (p_payload ? 'storage_path'),
    edit_revision=edit_revision+1
    where id=rid;
  if coalesce((p_payload->>'approve')::boolean,false) then
    insert into public.photo_print_attempts(request_id,operation_key) values(rid,key);
    update public.photo_print_requests set status='approved' where id=rid;
  end if;
  select to_jsonb(q) into result from public.photo_print_requests q where id=rid;
  insert into public.photo_print_operations(operation_key,action,request_id,edit_fingerprint,edit_result)
    values(key,'edit',rid,p_payload->>'edit_fingerprint',result);
  return result;
end $$;
revoke all on function public.photo_print_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.photo_print_command(text,jsonb) to service_role;
$photo_migration_5$;
 end if;
 end $release$;

insert into public.photo_print_release_steps(name) values('safe_edit') on conflict do nothing;

-- 20261003010000_photo_runtime.sql
do $release$ begin
 if true then
 execute $photo_migration_6$-- Apply after film v3 and safe admin edit. Reads do not lock the print queue.

create index if not exists photo_print_attempt_request_idx on public.photo_print_attempts(request_id);
create index if not exists photo_print_request_status_idx on public.photo_print_requests(status,created_at,id);
create or replace function public.photo_print_effective_status(request_id uuid,current_status text)
returns text language sql stable set search_path=public,pg_temp as $$
  select case when current_status in ('claimed','submitting') and exists (
    select 1 from photo_print_attempts where photo_print_attempts.request_id=$1
      and status in ('claimed','submitting') and lease_until < now()
  ) then 'review' else current_status end;
$$;
revoke all on function public.photo_print_effective_status(uuid,text) from public,anon,authenticated;
grant execute on function public.photo_print_effective_status(uuid,text) to service_role;
create table if not exists public.photo_print_processing (
  job_key uuid primary key, lease_token uuid not null, expires_at timestamptz not null
);
create table if not exists public.photo_print_processing_budget (
  hour timestamptz primary key, count integer not null check(count >= 0)
);
alter table public.photo_print_processing enable row level security;
alter table public.photo_print_processing_budget enable row level security;
revoke all on public.photo_print_processing, public.photo_print_processing_budget from anon,authenticated;
grant all on public.photo_print_processing, public.photo_print_processing_budget to service_role;

create or replace function public.photo_print_runtime(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare
  result jsonb; rows_json jsonb; summary jsonb; matched integer; total integer;
  page_number integer := greatest(1,coalesce((p_payload->>'page')::integer,1));
  page_size integer := least(50,greatest(1,coalesce((p_payload->>'limit')::integer,25)));
  filter_status text := coalesce(p_payload->>'status','all');
  query_text text := left(coalesce(p_payload->>'search',''),80);
  request_id uuid := (p_payload->>'id')::uuid;
  token uuid;
begin
  if p_action='read_session' then
    select jsonb_build_object('accepting',accepting,'capacity',capacity,'reserved',reserved,
      'remaining',case when capacity is null then null else capacity-reserved end)
      into strict result from photo_print_session where id;
    return result;
  elsif p_action='tracking' then
    select jsonb_build_object('id',r.id,'pickup_code',r.pickup_code,'created_at',r.created_at,
      'status',photo_print_effective_status(r.id,r.status)) into result
      from photo_print_requests r where r.id=(p_payload->>'id')::uuid and r.tracking_hash=p_payload->>'tracking_hash';
    if result is null then raise exception 'NOT_FOUND'; end if;
    return result;
  elsif p_action='dashboard' then
    if filter_status not in ('all','processing','pending','review','ready','rejected') then raise exception 'INVALID_INPUT'; end if;
    select count(*)::integer into total from photo_print_requests;
    select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) into summary
      from (select photo_print_effective_status(id,status) status,count(*)::integer n from photo_print_requests group by photo_print_effective_status(id,status)) counts;
    select count(*)::integer into matched from photo_print_requests r where
      (request_id is null or r.id=request_id) and
      (filter_status='all' or photo_print_effective_status(r.id,r.status)=filter_status or (filter_status='processing' and photo_print_effective_status(r.id,r.status) in ('approved','claimed','submitting','submitted'))) and
      (query_text='' or strpos(lower(r.guest_name),lower(query_text))>0 or strpos(lower(r.pickup_code),lower(query_text))>0);
    select coalesce(jsonb_agg(to_jsonb(q) || jsonb_build_object('status',photo_print_effective_status(q.id,q.status)) order by q.created_at,q.id),'[]'::jsonb) into rows_json from (
      select r.*,coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'cups_job_id',a.cups_job_id,'error',a.error,'created_at',a.created_at) order by a.created_at desc)
        from photo_print_attempts a where a.request_id=r.id),'[]'::jsonb) attempts
      from photo_print_requests r where
        (request_id is null or r.id=request_id) and
        (filter_status='all' or photo_print_effective_status(r.id,r.status)=filter_status or (filter_status='processing' and photo_print_effective_status(r.id,r.status) in ('approved','claimed','submitting','submitted'))) and
        (query_text='' or strpos(lower(r.guest_name),lower(query_text))>0 or strpos(lower(r.pickup_code),lower(query_text))>0)
      order by r.created_at,r.id limit page_size offset (page_number-1)*page_size
    ) q;
    return jsonb_build_object('session',photo_print_runtime('read_session'),'requests',rows_json,
      'station',(select to_jsonb(s) from photo_print_station s where id),'counts',summary,
      'pagination',jsonb_build_object('page',page_number,'limit',page_size,'total',total,'matched',matched));
  elsif p_action in ('processing_acquire','processing_release') then
    -- Independent admission lock: never blocks status reads or print state writes.
    perform pg_advisory_xact_lock(69031003);
    if p_action='processing_release' then
      delete from photo_print_processing where job_key=(p_payload->>'job_key')::uuid
        and lease_token=(p_payload->>'lease_token')::uuid;
      return '{}'::jsonb;
    end if;
    if p_payload->>'job_key' is null then raise exception 'INVALID_INPUT'; end if;
    delete from photo_print_processing where expires_at < now();
    if exists(select 1 from photo_print_processing where job_key=(p_payload->>'job_key')::uuid)
      or (select count(*) from photo_print_processing)>=4 then raise exception 'PROCESSING_BUSY'; end if;
    if coalesce((select count from photo_print_processing_budget where hour=date_trunc('hour',now())),0)>=1200 then raise exception 'PROCESSING_LIMIT'; end if;
    insert into photo_print_processing_budget values(date_trunc('hour',now()),1)
      on conflict(hour) do update set count=photo_print_processing_budget.count+1;
    delete from photo_print_processing_budget where hour < now()-interval '2 days';
    token:=gen_random_uuid();
    insert into photo_print_processing values((p_payload->>'job_key')::uuid,token,now()+interval '120 seconds');
    return jsonb_build_object('job_key',p_payload->>'job_key','lease_token',token);
  end if;
  raise exception 'INVALID_ACTION';
end $$;
revoke all on function public.photo_print_runtime(text,jsonb) from public,anon,authenticated;
grant execute on function public.photo_print_runtime(text,jsonb) to service_role;
$photo_migration_6$;
 end if;
 end $release$;

-- 20261003020000_photo_thumbnails.sql
do $release$ begin
 if true then
 execute $photo_migration_7$
alter table public.photo_print_requests add column if not exists thumbnail_path text;
do $$ begin
  if to_regprocedure('public.photo_print_command_before_thumbnails(text,jsonb)') is null then
    alter function public.photo_print_command(text,jsonb) rename to photo_print_command_before_thumbnails;
  end if;
end $$;
create or replace function public.photo_print_command(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare result jsonb;
begin
  result:=photo_print_command_before_thumbnails(p_action,p_payload);
  if p_action in ('create','edit') and p_payload ? 'thumbnail_path' and
     result->>'storage_path'=p_payload->>'storage_path' then
    update photo_print_requests set thumbnail_path=p_payload->>'thumbnail_path'
      where id=(result->>'id')::uuid;
    result:=result || jsonb_build_object('thumbnail_path',p_payload->>'thumbnail_path');
    if p_action='edit' then
      update photo_print_operations set edit_result=result where operation_key=(p_payload->>'operation_key')::uuid;
    end if;
  end if;
  return result;
end $$;
revoke all on function public.photo_print_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.photo_print_command(text,jsonb) to service_role;
$photo_migration_7$;
 end if;
 end $release$;

notify pgrst, 'reload schema';
commit;
