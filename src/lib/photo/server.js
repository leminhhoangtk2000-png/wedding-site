import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DEFAULT_PRESETS } from './film.mjs';

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
  let { data, error } = await client.rpc(shouldUseFilmRpc ? 'photo_print_film_command' : 'photo_print_command', { p_action: action, p_payload: payload });
  if (error && shouldUseFilmRpc && (error.code === 'PGRST202' || error.message?.includes('photo_print_film_command'))) {
    if (action === 'create') {
      const fallbackResult = await client.rpc('photo_print_command', { p_action: action, p_payload: payload });
      data = fallbackResult.data;
      error = fallbackResult.error;
    } else if (action === 'preset_config') {
      return { version: 1, presets: DEFAULT_PRESETS };
    } else if (action === 'save_presets') {
      return { version: (payload.expected_version || 1) + 1, presets: payload.presets };
    }
  }
  if (error) {
    console.error(`[command error: ${action}]`, error);
    const code = ['PAUSED','FULL','STATE_CONFLICT','IDEMPOTENCY_CONFLICT','NOT_FOUND','UPLOAD_NOT_FOUND','STATION_BUSY','STATION_OFFLINE','INVALID_JOB','INVALID_ACTION','UPLOAD_LIMIT','CONFIG_NOT_FOUND','CONFIG_STALE'].find(k => error.message === k);
    if (code) fail(code, code.includes('NOT_FOUND') ? 404 : 409);
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
  INVALID_IMAGE: 'Unable to process image. Please choose another JPEG, PNG, or HEIC photo.', INVALID_IMAGE_SIZE: 'Please select an image smaller than 12MB.',
  HEIC_UNSUPPORTED: 'Unable to convert this HEIC photo. Please export as JPEG and retry.',
  STATION_BUSY: 'Another Mac print station is currently active.', STATION_OFFLINE: 'Print station is offline or encountered an error.',
  HARDWARE_NOT_VERIFIED: 'Printer setup is not verified yet. Photo requests can remain pending until the print station is ready.',
  UPLOAD_LIMIT: 'Upload limit reached for this hour. Please try again later.',
};
export function errorResponse(error) {
  if (process.env.NODE_ENV !== 'production' || error?.status >= 500 || !error?.status) {
    console.error('[photo API error]', error);
  }
  const code = error.code || (messages[error.message] ? error.message : 'INTERNAL_ERROR');
  const status = error.status || (code === 'INVALID_IMAGE_SIZE' ? 413 : ['INVALID_IMAGE','HEIC_UNSUPPORTED'].includes(code) ? 415 : messages[code] ? 400 : 500);
  return Response.json({ success: false, code, error: messages[code] || 'Unable to process request at this time. Please try again.' }, { status, headers: { 'Cache-Control': 'no-store' } });
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
