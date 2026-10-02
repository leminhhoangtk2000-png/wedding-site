-- Apply after the existing photo printing / quota / film migrations.
-- Keep operator review on its explicit ready/reprint flow; only pending requests can be edited.
begin;
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
commit;
