-- Publish stronger looks without changing historical catalogs or operator settings.
begin;
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
commit;
