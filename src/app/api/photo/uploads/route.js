import { randomUUID } from 'node:crypto';
import { db, command, respond, errorResponse, fail, hash, signedPreview, BUCKET } from '@/lib/photo/server';
import { normalizePhoto, MAX_UPLOAD_BYTES } from '@/lib/photo/image.mjs';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request) {
  let client, path;
  try {
    client = db();
    const session = await command(client, 'session');
    if (!session.accepting) fail('PAUSED', 409);
    if (!session.remaining) fail('FULL', 409);
    if (Number(request.headers.get('content-length')) > MAX_UPLOAD_BYTES + 65536) fail('INVALID_IMAGE_SIZE', 413);
    const form = await request.formData(), file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') fail('INVALID_INPUT');
    if (file.size > MAX_UPLOAD_BYTES) fail('INVALID_IMAGE_SIZE', 413);
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
  }
}
