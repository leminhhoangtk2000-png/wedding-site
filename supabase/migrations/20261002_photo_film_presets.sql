-- Immutable film settings and per-request render snapshots. Apply after photo_printing.
begin;
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
commit;
