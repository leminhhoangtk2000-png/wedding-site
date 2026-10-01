import { db, requireAuth, command, respond, errorResponse, fail, requireUUID, jsonBody, signedPreview } from '@/lib/photo/server';
export const runtime = 'nodejs';
export async function GET(request) {
  try {
    requireAuth(request);
    const client=db(), result=await command(client,'admin_list');
    const requests=await Promise.all(result.requests.map(async r => ({
      id:r.id,guest_name:r.guest_name,pickup_code:r.pickup_code,status:r.status,orientation:r.orientation,created_at:r.created_at,
      preview_url:await signedPreview(client,r.storage_path),attempts:r.attempts,
    })));
    const station=result.station ? { last_seen:result.station.last_seen,printer:result.station.printer,error:result.station.error } : null;
    return respond({session:result.session,requests,station});
  } catch(error) { return errorResponse(error); }
}
export async function PATCH(request) {
  try {
    requireAuth(request); const body=await jsonBody(request);
    if (!['pause','resume','approve','reject','ready','reprint'].includes(body.action)) fail('INVALID_INPUT');
    if (body.action==='resume' && process.env.PHOTO_PRINT_HARDWARE_VERIFIED!=='true') fail('HARDWARE_NOT_VERIFIED',409);
    if (!['pause','resume'].includes(body.action)) { requireUUID(body.id);requireUUID(body.operation_key); }
    await command(db(),body.action,body); return respond({});
  } catch(error) { return errorResponse(error); }
}
