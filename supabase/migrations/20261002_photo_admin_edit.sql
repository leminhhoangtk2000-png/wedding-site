-- Migration: Add Admin Edit Request capability before approve
-- Execute this migration in the Supabase SQL editor if deploying to remote Supabase.

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
      'session', jsonb_build_object('accepting',s.accepting,'capacity',s.capacity,'reserved',s.reserved,'remaining',case when s.capacity is null then null else s.capacity - s.reserved end),
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
