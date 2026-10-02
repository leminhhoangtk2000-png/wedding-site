-- Add expressive stock interpretations; never rewrite pinned catalog versions.
begin;
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
commit;
