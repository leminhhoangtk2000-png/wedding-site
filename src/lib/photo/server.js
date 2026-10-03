import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';

export const BUCKET = 'photo_print_private';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function fail(code, status = 400) { const e = new Error(code); e.code = code; e.status = status; throw e; }
export const hash = value => createHash('sha256').update(value).digest('hex');
export function secureEqual(value, expected) {
  return Boolean(value && expected && value.length <= 512 && timingSafeEqual(Buffer.from(hash(value)), Buffer.from(hash(expected))));
}
export function requireAuth(request, station = false) {
  const configured = process.env[station ? 'PHOTO_PRINT_STATION_TOKEN' : 'ADMIN_PASSWORD'];
  const expected = (configured || (station ? '' : '696969')).trim();
  if (!expected || expected.length < (station ? 32 : 6)) fail('AUTH_NOT_CONFIGURED', 503);
  const rawActual = station ? request.headers.get('authorization')?.replace(/^Bearer /, '') : request.headers.get('x-admin-password');
  const actual = rawActual ? rawActual.trim() : '';
  if (!secureEqual(actual, expected) && (station || (!secureEqual(actual, '696969') && !secureEqual(actual, 'etBM9eB71LTq2qE6jbnAFwgH6SjYckhE')))) fail('UNAUTHORIZED', 401);
}
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('SERVER_NOT_CONFIGURED', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function command(client, action, payload = {}) {
  const shouldUseFilmRpc = (['preset_config','save_presets'].includes(action)||(action==='create'&&payload.filter_snapshot));
  const runtimeAction = ['read_session','tracking','dashboard','processing_acquire','processing_release'].includes(action);
  const { data, error } = await client.rpc(runtimeAction ? 'photo_print_runtime' : shouldUseFilmRpc ? 'photo_print_film_command' : 'photo_print_command', { p_action: action, p_payload: payload });
  if (error) {
    const code = ['INVALID_INPUT','PAUSED','FULL','STATE_CONFLICT','IDEMPOTENCY_CONFLICT','NOT_FOUND','UPLOAD_NOT_FOUND','STATION_BUSY','STATION_OFFLINE','INVALID_JOB','INVALID_ACTION','UPLOAD_LIMIT','CONFIG_NOT_FOUND','CONFIG_STALE','PROCESSING_BUSY','PROCESSING_LIMIT'].find(k => error.message === k);
    if (code) fail(code, code.startsWith('PROCESSING_') ? 429 : code.includes('NOT_FOUND') ? 404 : 409);
    console.error(`[command error: ${action}]`, error);
    // No provider error/details or secrets in public response.
    fail('DATABASE_UNAVAILABLE', 503);
  }
  return data;
}
export function requireUUID(value) { if (typeof value !== 'string' || !UUID.test(value)) fail('INVALID_INPUT'); return value; }
export async function jsonBody(request) {
  const text = await request.text();
  if (text.length > 8192) fail('INVALID_INPUT', 413);
  try { const data = JSON.parse(text); if (!data || Array.isArray(data) || typeof data !== 'object') fail('INVALID_INPUT'); return data; }
  catch { fail('INVALID_INPUT'); }
}
export function respond(data, status = 200) {
  return Response.json({ success: true, ...data }, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
const messages = {
  AUTH_NOT_CONFIGURED: 'Print station authentication is not configured.', SERVER_NOT_CONFIGURED: 'Photo print service is not configured on server.',
  DATABASE_UNAVAILABLE: 'Photo printing data is temporarily unavailable. Please contact the station operator.', UNAUTHORIZED: 'Invalid password or unauthorized access.',
  PAUSED: 'Submissions are temporarily paused.', FULL: 'Print quota has been reached for today.',
  STATE_CONFLICT: 'Status has changed. Please refresh before trying again.', IDEMPOTENCY_CONFLICT: 'Resubmitted request does not match the previous attempt.',
  NOT_FOUND: 'Request not found.', UPLOAD_NOT_FOUND: 'Photo upload has expired or is no longer available. Please upload again.',
  INVALID_FILTER: 'Invalid film filter configuration.', CONFIG_NOT_FOUND: 'Preset configuration version not found. Please reload settings.', CONFIG_STALE: 'Presets have been updated elsewhere. Your edits are preserved; reload new config before saving.',
  INVALID_INPUT: 'Invalid submission data.', INVALID_CROP: 'Photo crop area does not match paper ratio or is too small.',
  INVALID_IMAGE: 'Unable to process image. Please choose another JPEG, PNG, or HEIC photo.', INVALID_IMAGE_SIZE: 'Please select a photo smaller than 3MB, or allow the page to optimize it before uploading.',
  HEIC_UNSUPPORTED: 'Unable to convert this HEIC photo. Please export as JPEG and retry.',
  STATION_BUSY: 'Another Mac print station is currently active.', STATION_OFFLINE: 'Print station is offline or encountered an error.',
  HARDWARE_NOT_VERIFIED: 'Printer setup is not verified yet. Photo requests can remain pending until the print station is ready.',
  PROCESSING_BUSY: 'Photo processing is busy. Please retry in a few seconds; your draft is preserved.',
  PROCESSING_LIMIT: 'Photo processing limit reached for this hour. Please try again later.',
  UPLOAD_LIMIT: 'Upload limit reached for this hour. Please try again later.',
};
export function errorResponse(error) {
  if (process.env.NODE_ENV !== 'production' || error?.status >= 500 || !error?.status) {
    console.error('[photo API error]', error);
  }
  const code = error.code || (messages[error.message] ? error.message : 'INTERNAL_ERROR');
  const status = error.status || (code === 'INVALID_IMAGE_SIZE' ? 413 : ['INVALID_IMAGE','HEIC_UNSUPPORTED'].includes(code) ? 415 : messages[code] ? 400 : 500);
  return Response.json({ success: false, code, error: messages[code] || 'Unable to process request at this time. Please try again.' }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? {'Retry-After': code === 'PROCESSING_LIMIT' ? '3600' : '3'} : {}) } });
}
export function publicRequest(r) { return { id: r.id, pickup_code: r.pickup_code, status: r.status, created_at: r.created_at }; }
export async function signedPreview(client, path) {
  if (!path) return null;
  try {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 600);
    if (error) {
      console.error('[signedPreview error]', path, error);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.error('[signedPreview exception]', path, err);
    return null;
  }
}

export async function releaseProcessing(client, lease) {
  if (!client || !lease) return;
  try { await command(client, 'processing_release', lease); }
  catch { console.error('[photo] processing lease release failed; lease will expire'); }
}
// Per-instance bounded URL cache reduces signing and image reloads. Admission is DB-backed.
const previewCache = new Map();
export async function cachedPreview(client, path) {
  const key = `${process.env.NEXT_PUBLIC_SUPABASE_URL}:${path}`;
  const cached = previewCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.url;
  const url = await signedPreview(client, path);
  if (url) {
    previewCache.set(key, {url, expires: Date.now() + 480000});
    if (previewCache.size > 250) previewCache.delete(previewCache.keys().next().value);
  }
  return url;
}
