import { randomUUID } from 'node:crypto';
import { db, command, respond, errorResponse, fail, hash, requireUUID, jsonBody, publicRequest, BUCKET } from '@/lib/photo/server';
import { renderPrintPhoto, validateCrop } from '@/lib/photo/image.mjs';
import { resolveFilter } from '@/lib/photo/config-server';
import { canonicalFilter } from '@/lib/photo/film.mjs';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request) {
  try {
    const id = requireUUID(new URL(request.url).searchParams.get('id'));
    const token = request.headers.get('x-photo-token');
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) fail('NOT_FOUND', 404);
    const client = db();
    await command(client, 'session'); // reconcile stale station claims
    const { data, error } = await client.from('photo_print_requests').select('id,pickup_code,status,created_at').eq('id',id).eq('tracking_hash',hash(token)).maybeSingle();
    if (error) fail('DATABASE_UNAVAILABLE', 503);
    if (!data) fail('NOT_FOUND', 404);
    return respond({ request: publicRequest(data) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  let client, outputPath, retained = false, rpcStarted = false;
  try {
    const body = await jsonBody(request);
    for (const k of ['upload_id','upload_token','request_key','tracking_token']) requireUUID(body[k]);
    if (typeof body.guest_name !== 'string' || !body.guest_name.trim() || body.guest_name.trim().length > 80) fail('INVALID_INPUT');
    if (!['portrait','landscape'].includes(body.orientation)) fail('INVALID_INPUT');
    const crop = body.crop;
    if (!crop || !['x','y','width','height'].every(k => typeof crop[k] === 'number' && Number.isFinite(crop[k]))) fail('INVALID_CROP');
    const canonical = { upload_id:body.upload_id, guest_name:body.guest_name.trim(), orientation:body.orientation, crop:{ x:crop.x,y:crop.y,width:crop.width,height:crop.height } };
    if (body.filter != null) {
      try { canonical.filter = canonicalFilter({...body.filter,config_version:body.filter.config_version??0}); } catch { fail('INVALID_FILTER'); }
    }
    const fingerprint = hash(JSON.stringify(canonical)), trackingHash = hash(body.tracking_token);
    client = db();
    // Wait for any concurrent reservation transaction before looking up a
    // retry. A lost response must remain recoverable even at the last slot.
    const session = await command(client, 'session');
    const { data: existing, error: existingError } = await client.from('photo_print_requests').select('*').eq('request_key',body.request_key).maybeSingle();
    if (existingError) fail('DATABASE_UNAVAILABLE', 503);
    if (existing) {
      if (existing.tracking_hash !== trackingHash || (existing.fingerprint !== fingerprint && !(existing.filter_snapshot == null && existing.fingerprint === hash(JSON.stringify({upload_id:canonical.upload_id,guest_name:canonical.guest_name,orientation:canonical.orientation,crop:canonical.crop}))))) fail('IDEMPOTENCY_CONFLICT',409);
      return respond({ request:publicRequest(existing), tracking_url:`/photo/status#id=${existing.id}&token=${body.tracking_token}` });
    }
    if (!session.accepting) fail('PAUSED',409);
    if (session.capacity != null && session.remaining <= 0) fail('FULL', 409);
    const { data: upload, error: uploadError } = await client.from('photo_print_uploads').select('*').eq('id',body.upload_id).eq('token_hash',hash(body.upload_token)).gt('expires_at',new Date().toISOString()).maybeSingle();
    if (uploadError) fail('DATABASE_UNAVAILABLE',503);
    if (!upload) fail('UPLOAD_NOT_FOUND',404);
    validateCrop(crop,body.orientation,upload.width,upload.height);
    const { data: original, error: downloadError } = await client.storage.from(BUCKET).download(upload.storage_path);
    if (downloadError) fail('DATABASE_UNAVAILABLE',503);
    const snapshot = await resolveFilter(client,canonical.filter,body.upload_id);
    const rendered = await renderPrintPhoto(Buffer.from(await original.arrayBuffer()),crop,body.orientation,upload.width,upload.height,snapshot);
    outputPath = `prints/${randomUUID()}.jpg`;
    const { error: storageError } = await client.storage.from(BUCKET).upload(outputPath,rendered,{ contentType:'image/jpeg',upsert:false });
    if (storageError) fail('DATABASE_UNAVAILABLE',503);
    rpcStarted = true;
    const saved = await command(client,'create',{
      ...canonical, request_key:body.request_key,tracking_hash:trackingHash,fingerprint,
      upload_hash:hash(body.upload_token),storage_path:outputPath,
      ...(snapshot ? {filter_snapshot:snapshot} : {}),
    });
    retained = saved.storage_path === outputPath;
    if (!retained) await client.storage.from(BUCKET).remove([outputPath]);
    return respond({ request:publicRequest(saved),tracking_url:`/photo/status#id=${saved.id}&token=${body.tracking_token}` });
  } catch (error) {
    // An uncertain RPC transport failure can still commit later. Retain its
    // asset for reconciliation; only a known rollback is safe to clean up.
    if (client && outputPath && !retained && (!rpcStarted || error.status === 409 || error.status === 404)) {
      await client.storage.from(BUCKET).remove([outputPath]);
    }
    return errorResponse(error);
  }
}
