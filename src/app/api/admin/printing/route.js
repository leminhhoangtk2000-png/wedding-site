import { db, requireAuth, command, respond, errorResponse, fail, requireUUID, jsonBody, signedPreview } from '@/lib/photo/server';
import { getPresetConfig } from '@/lib/photo/config-server';
import { validatePresets } from '@/lib/photo/film.mjs';
export const runtime = 'nodejs';
export async function GET(request) {
  try {
    requireAuth(request);
    const client=db(), result=await command(client,'admin_list');
    const requests=await Promise.all((result.requests || []).map(async r => ({
      id:r.id,guest_name:r.guest_name,pickup_code:r.pickup_code,status:r.status,orientation:r.orientation,created_at:r.created_at,
      preview_url:await signedPreview(client,r.storage_path),attempts:r.attempts,
      preset_name:r.filter_snapshot?.preset?.name || null,filter_snapshot:r.filter_snapshot,
    })));
    const station=result.station ? { last_seen:result.station.last_seen,printer:result.station.printer,error:result.station.error } : null;
    return respond({
      session: {
        ...result.session,
        capacity: null,
        remaining: null,
      },
      requests,
      station,
      preset_config: await getPresetConfig(client),
    });
  } catch(error) { return errorResponse(error); }
}
export async function PATCH(request) {
  try {
    requireAuth(request); const body=await jsonBody(request);
    if (body.action==='save_presets') {
      requireUUID(body.operation_key);
      if(!Number.isInteger(body.expected_version)||body.expected_version<1)fail('INVALID_FILTER');
      let presets;try {presets=validatePresets(body.presets);}catch {fail('INVALID_FILTER');}
      return respond({preset_config:await command(db(),'save_presets',{expected_version:body.expected_version,operation_key:body.operation_key,presets})});
    }
    if (!['pause','resume','approve','reject','ready','reprint'].includes(body.action)) fail('INVALID_INPUT');
    const hardwareReady = process.env.PHOTO_PRINT_HARDWARE_VERIFIED === 'true';
    if (body.action==='resume' && !hardwareReady && process.env.PHOTO_PRINT_ACCEPT_WITHOUT_PRINTER!=='true') fail('HARDWARE_NOT_VERIFIED',409);
    if (['approve','reprint','ready'].includes(body.action) && !hardwareReady) fail('HARDWARE_NOT_VERIFIED',409);
    if (!['pause','resume'].includes(body.action)) { requireUUID(body.id);requireUUID(body.operation_key); }
    await command(db(),body.action,body); return respond({});
  } catch(error) { return errorResponse(error); }
}
