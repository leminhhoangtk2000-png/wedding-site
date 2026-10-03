import { randomUUID } from 'node:crypto';
import { db, command, respond, errorResponse, fail, hash, signedPreview, BUCKET, releaseProcessing, requireUUID } from '@/lib/photo/server';
import { normalizePhoto, MAX_CLIENT_UPLOAD_BYTES } from '@/lib/photo/image.mjs';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request) {
  let client, path, lease;
  try {
    client = db();
    const session = await command(client, 'read_session');
    if (!session.accepting) fail('PAUSED', 409);
    if (session.capacity != null && session.remaining <= 0) fail('FULL', 409);
    if (Number(request.headers.get('content-length')) > MAX_CLIENT_UPLOAD_BYTES + 65536) fail('INVALID_IMAGE_SIZE', 413);
    lease = await command(client, 'processing_acquire', {job_key: randomUUID()});
    const form = await request.formData(), file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') fail('INVALID_INPUT');
    if (file.size > MAX_CLIENT_UPLOAD_BYTES) fail('INVALID_IMAGE_SIZE', 413);
    await command(client, 'upload_limit');
    const normalized = await normalizePhoto(Buffer.from(await file.arrayBuffer()));
    const id = randomUUID(), token = randomUUID(); path = `uploads/${id}.jpg`;
    const { error } = await client.storage.from(BUCKET).upload(path, normalized.bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) fail('DATABASE_UNAVAILABLE', 503);
    const { data: upload, error: insertError } = await client.from('photo_print_uploads').insert({
      id, token_hash: hash(token), storage_path: path, width: normalized.width, height: normalized.height,
    }).select('expires_at').single();
    if (insertError) fail('DATABASE_UNAVAILABLE', 503);
    return respond({ upload: { id, token, preview_url: await signedPreview(client, path), width: normalized.width, height: normalized.height, expires_at: upload.expires_at } });
  } catch (error) {
    if (path && client) await client.storage.from(BUCKET).remove([path]);
    return errorResponse(error);
  } finally { await releaseProcessing(client, lease); }
}

// Renew a preview only while the original upload capability is valid.
export async function GET(request) {
  try {
    const id = requireUUID(new URL(request.url).searchParams.get('id'));
    const token = request.headers.get('x-photo-token');
    if (!token) fail('UPLOAD_NOT_FOUND', 404);
    const client = db();
    const {data: upload, error} = await client.from('photo_print_uploads').select('*')
      .eq('id', id).eq('token_hash', hash(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error) fail('DATABASE_UNAVAILABLE', 503);
    if (!upload) fail('UPLOAD_NOT_FOUND', 404);
    const preview_url = await signedPreview(client, upload.storage_path);
    if (!preview_url) fail('DATABASE_UNAVAILABLE', 503);
    return respond({upload: {id, token, width: upload.width, height: upload.height, expires_at: upload.expires_at, preview_url}});
  } catch (error) { return errorResponse(error); }
}
