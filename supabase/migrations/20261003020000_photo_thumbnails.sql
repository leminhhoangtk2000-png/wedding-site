begin;
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
commit;
