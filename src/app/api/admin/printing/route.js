import { uploadPrint } from '@/lib/photo/print-storage';
import { db, requireAuth, command, respond, errorResponse, fail, requireUUID, jsonBody, signedPreview, BUCKET, hash, cachedPreview, releaseProcessing } from '@/lib/photo/server';
import { getPresetConfig } from '@/lib/photo/config-server';
import { validatePresets } from '@/lib/photo/film.mjs';
import { MAX_CLIENT_UPLOAD_BYTES, editPrintPhoto } from '@/lib/photo/image.mjs';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request) {
  try {
    requireAuth(request);
    const params = new URL(request.url).searchParams;
    const page = Number(params.get('page') || 1), limit = Number(params.get('limit') || 25);
    if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 50) fail('INVALID_INPUT');
    const id = params.get('id'); if (id) requireUUID(id);
    const client=db(), result=await command(client,'dashboard', {page,limit,id,status:params.get('status') || 'all',search:params.get('search') || ''});
    // Small batches bound Storage signing pressure; stable cached URLs preserve browser cache.
    const requests=[];
    for (let i=0; i<(result.requests || []).length; i+=5) {
      requests.push(...await Promise.all(result.requests.slice(i,i+5).map(async r => ({
        id:r.id,guest_name:r.guest_name,pickup_code:r.pickup_code,status:r.status,orientation:r.orientation,created_at:r.created_at,edit_revision:r.edit_revision,
        preview_url:await cachedPreview(client,r.storage_path),
        thumbnail_url:await cachedPreview(client,r.thumbnail_path || r.storage_path),attempts:r.attempts,
        preset_name:r.admin_image_edited ? 'Admin edited' : r.filter_snapshot?.preset?.name || null,filter_snapshot:r.filter_snapshot,
      }))));
    }
    const station=result.station ? { last_seen:result.station.last_seen,printer:result.station.printer,error:result.station.error } : null;
    return respond({
      session: {
        ...result.session,
      },
      requests,
      counts: result.counts,
      pagination: result.pagination,
      station,
      preset_config: await getPresetConfig(client),
    });
  } catch(error) { return errorResponse(error); }
}
export async function PATCH(request) {
  let processingClient, lease;
  try {
    requireAuth(request);
    const contentType = request.headers.get('content-type') || '';
    let body;
    let file = null;

    if (contentType.includes('multipart/form-data')) {
      if (Number(request.headers.get('content-length')) > MAX_CLIENT_UPLOAD_BYTES + 65536) fail('INVALID_IMAGE_SIZE',413);
      const formData = await request.formData();
      body = {
        action: formData.get('action') || 'edit',
        id: formData.get('id'),
        operation_key: formData.get('operation_key'),
        guest_name: formData.get('guest_name') || undefined,
        orientation: formData.get('orientation') || undefined,
        approve: formData.get('approve') === 'true',
        expected_revision: formData.has('expected_revision') ? Number(formData.get('expected_revision')) : undefined,
      };
      const adjStr = formData.get('adjustments');
      if (adjStr) {
        try { body.adjustments = JSON.parse(adjStr); } catch { fail('INVALID_INPUT'); }
      }
      const rawFile = formData.get('file');
      if (rawFile && typeof rawFile.arrayBuffer === 'function' && rawFile.size > 0) {
        file = rawFile;
      }
    } else {
      body = await jsonBody(request);
    }

    if (body.action==='save_presets') {
      requireUUID(body.operation_key);
      if(!Number.isInteger(body.expected_version)||body.expected_version<1)fail('INVALID_FILTER');
      let presets;try {presets=validatePresets(body.presets);}catch {fail('INVALID_FILTER');}
      return respond({preset_config:await command(db(),'save_presets',{expected_version:body.expected_version,operation_key:body.operation_key,presets})});
    }

    if (body.action === 'edit') {
      requireUUID(body.id);
      requireUUID(body.operation_key);
      if (body.guest_name != null) {
        if (typeof body.guest_name !== 'string' || !body.guest_name.trim() || body.guest_name.trim().length > 80) fail('INVALID_INPUT');
      }
      if (body.orientation != null && !['portrait', 'landscape'].includes(body.orientation)) {
        fail('INVALID_INPUT');
      }

      if (!Number.isInteger(body.expected_revision) || body.expected_revision < 0) fail('INVALID_INPUT');
      if (body.approve != null && typeof body.approve !== 'boolean') fail('INVALID_INPUT');
      const adjustments = body.adjustments || {};
      if (typeof adjustments !== 'object' || Array.isArray(adjustments) ||
          Object.keys(adjustments).some(key => !['brightness','warmth','contrast','monochrome'].includes(key)) ||
          ['brightness','warmth','contrast'].some(key => adjustments[key] != null &&
            (typeof adjustments[key] !== 'number' || !Number.isFinite(adjustments[key]) || Math.abs(adjustments[key]) > 100)) ||
          (adjustments.monochrome != null && typeof adjustments.monochrome !== 'boolean')) fail('INVALID_INPUT');
      if (file && file.size > MAX_CLIENT_UPLOAD_BYTES) fail('INVALID_IMAGE_SIZE', 413);
      const newBytes = file ? Buffer.from(await file.arrayBuffer()) : null;
      const edit_fingerprint = hash(JSON.stringify({
        id: body.id, expected_revision: body.expected_revision,
        guest_name: body.guest_name?.trim() ?? null, orientation: body.orientation ?? null,
        approve: body.approve === true,
        adjustments: { brightness: adjustments.brightness ?? 0, warmth: adjustments.warmth ?? 0,
          contrast: adjustments.contrast ?? 0, monochrome: adjustments.monochrome ?? false },
        file_hash: newBytes ? hash(newBytes) : null,
      }));
      const client = db();
      const retry = await command(client, 'edit_retry', { id: body.id, operation_key: body.operation_key, edit_fingerprint });
      if (retry) return respond({ request: retry, preview_url: await signedPreview(client, retry.storage_path) });
      const hardwareReady = process.env.PHOTO_PRINT_HARDWARE_VERIFIED === 'true';
      if (body.approve && !hardwareReady) fail('HARDWARE_NOT_VERIFIED', 409);

      const { data: existing, error: getErr } = await client
        .from('photo_print_requests')
        .select('*')
        .eq('id', body.id)
        .single();
      if (getErr || !existing) fail('NOT_FOUND', 404);
      if (existing.status !== 'pending' || existing.edit_revision !== body.expected_revision) fail('STATE_CONFLICT', 409);

      const targetOrientation = body.orientation || existing.orientation;
      const hasAdjustments = body.adjustments && (
        Boolean(body.adjustments.brightness) ||
        Boolean(body.adjustments.warmth) ||
        Boolean(body.adjustments.contrast) ||
        Boolean(body.adjustments.monochrome)
      );
      const orientationChanged = body.orientation && body.orientation !== existing.orientation;
      let newStoragePath = null, thumbnailPath = null;

      if (file || hasAdjustments || orientationChanged) {
        processingClient = client;
        lease = await command(client, 'processing_acquire', {job_key: body.operation_key});
        let existingPrintBytes = null;
        if (!file) {
          const { data: dlBlob, error: dlErr } = await client.storage.from(BUCKET).download(existing.storage_path);
          if (dlErr || !dlBlob) fail('DATABASE_UNAVAILABLE', 503);
          existingPrintBytes = Buffer.from(await dlBlob.arrayBuffer());
        }

        const reRendered = await editPrintPhoto({
          existingPrintBytes,
          existingOrientation: existing.orientation,
          existingFramed: Boolean(existing.filter_snapshot) || existing.admin_image_edited === true,
          newBytes,
          targetOrientation,
          adjustments: body.adjustments || null,
        });

        const stored = await uploadPrint(client,reRendered);
        newStoragePath=stored.storage_path; thumbnailPath=stored.thumbnail_path;
      }

      const payload = {
        id: body.id,
        operation_key: body.operation_key,
        expected_revision: body.expected_revision,
        edit_fingerprint,
        ...(body.guest_name ? { guest_name: body.guest_name.trim() } : {}),
        ...(body.orientation ? { orientation: body.orientation } : {}),
        ...(newStoragePath ? { storage_path: newStoragePath, thumbnail_path: thumbnailPath } : {}),
        ...(body.approve ? { approve: true } : {}),
      };

      let updatedReq;
      try { updatedReq = await command(client, 'edit', payload); }
      catch (error) {
        // A provider timeout may have committed; retain its file for an exact retry.
        if (newStoragePath && ['STATE_CONFLICT','IDEMPOTENCY_CONFLICT','NOT_FOUND'].includes(error.code))
          await client.storage.from(BUCKET).remove([newStoragePath,thumbnailPath]);
        throw error;
      }
      if (newStoragePath && updatedReq.storage_path !== newStoragePath)
        await client.storage.from(BUCKET).remove([newStoragePath,thumbnailPath]);
      const preview_url = await signedPreview(client, updatedReq.storage_path);
      return respond({ request: updatedReq, preview_url });
    }

    if (!['pause','resume','approve','reject','ready','reprint'].includes(body.action)) fail('INVALID_INPUT');
    const hardwareReady = process.env.PHOTO_PRINT_HARDWARE_VERIFIED === 'true';
    if (body.action==='resume' && !hardwareReady && process.env.PHOTO_PRINT_ACCEPT_WITHOUT_PRINTER!=='true') fail('HARDWARE_NOT_VERIFIED',409);
    if (['approve','reprint','ready'].includes(body.action) && !hardwareReady) fail('HARDWARE_NOT_VERIFIED',409);
    if (!['pause','resume'].includes(body.action)) { requireUUID(body.id);requireUUID(body.operation_key); }
    await command(db(),body.action,body); return respond({});
  } catch(error) { return errorResponse(error); } finally { await releaseProcessing(processingClient, lease); }
}
