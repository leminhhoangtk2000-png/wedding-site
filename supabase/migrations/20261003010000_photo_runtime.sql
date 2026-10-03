-- Apply after film v3 and safe admin edit. Reads do not lock the print queue.
begin;
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
commit;
