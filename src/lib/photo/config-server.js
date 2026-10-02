import { command, fail } from './server';
import { canonicalFilter, computeEffectiveFilter, LEGACY_PRESETS, DEFAULT_PRESETS, ENGINE_VERSION, FRAME_VERSION, seedFor } from './film.mjs';
// Fail closed: substituting defaults could change an already previewed version.
export const getPresetConfig = (client,version) => command(client,'preset_config',version==null?{}:{version});
export async function resolveFilter(client,input,uploadId) {
  if(input==null)return null;
  let canonical;try {canonical=canonicalFilter(input);}catch {fail('INVALID_FILTER');}
  const config=canonical.config_version===0?{version:0,presets:[DEFAULT_PRESETS[0],...LEGACY_PRESETS]}:await getPresetConfig(client,canonical.config_version);
  const p=config.presets.find(p=>p.id===canonical.preset_id&&p.enabled);
  if(!p)fail('INVALID_FILTER');
  return { ...canonical,preset:p,computed:computeEffectiveFilter(p,canonical.adjustments),engine_version:ENGINE_VERSION,frame_version:FRAME_VERSION,seed:seedFor(uploadId) };
}
