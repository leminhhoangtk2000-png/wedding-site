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
  const expected = process.env[station ? 'PHOTO_PRINT_STATION_TOKEN' : 'ADMIN_PASSWORD'];
  if (!expected || expected.length < (station ? 32 : 8)) fail('AUTH_NOT_CONFIGURED', 503);
  const actual = station ? request.headers.get('authorization')?.replace(/^Bearer /, '') : request.headers.get('x-admin-password');
  if (!secureEqual(actual, expected)) fail('UNAUTHORIZED', 401);
}
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('SERVER_NOT_CONFIGURED', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function command(client, action, payload = {}) {
  const { data, error } = await client.rpc('photo_print_command', { p_action: action, p_payload: payload });
  if (error) {
    const code = ['PAUSED','FULL','STATE_CONFLICT','IDEMPOTENCY_CONFLICT','NOT_FOUND','UPLOAD_NOT_FOUND','STATION_BUSY','STATION_OFFLINE','INVALID_JOB','INVALID_ACTION','UPLOAD_LIMIT'].find(k => error.message === k);
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
  AUTH_NOT_CONFIGURED: 'Chưa cấu hình xác thực trạm in.', SERVER_NOT_CONFIGURED: 'Chức năng in ảnh chưa được cấu hình trên server.',
  DATABASE_UNAVAILABLE: 'Dữ liệu in ảnh chưa sẵn sàng. Vui lòng liên hệ người trực.', UNAUTHORIZED: 'Mật khẩu hoặc quyền truy cập không hợp lệ.',
  PAUSED: 'Đang tạm dừng nhận yêu cầu in.', FULL: 'Đã đủ số lượng ảnh in.',
  STATE_CONFLICT: 'Trạng thái đã thay đổi. Vui lòng tải lại trước khi thao tác.', IDEMPOTENCY_CONFLICT: 'Yêu cầu gửi lại không khớp với lần trước.',
  NOT_FOUND: 'Không tìm thấy yêu cầu.', UPLOAD_NOT_FOUND: 'Ảnh đã hết hạn hoặc không còn khả dụng. Vui lòng tải lại ảnh.',
  INVALID_INPUT: 'Thông tin gửi lên không hợp lệ.', INVALID_CROP: 'Vùng ảnh chưa đúng tỷ lệ giấy hoặc quá nhỏ.',
  INVALID_IMAGE: 'Không đọc được ảnh. Vui lòng chọn ảnh JPEG, PNG hoặc HEIC khác.', INVALID_IMAGE_SIZE: 'Vui lòng chọn ảnh nhỏ hơn 12MB.',
  HEIC_UNSUPPORTED: 'Không chuyển được ảnh HEIC này. Vui lòng xuất ảnh JPEG và thử lại.',
  STATION_BUSY: 'Một trạm Mac khác đang hoạt động.', STATION_OFFLINE: 'Trạm in chưa kết nối hoặc đang có lỗi.',
  HARDWARE_NOT_VERIFIED: 'Cần hoàn thành thử máy in và bật PHOTO_PRINT_HARDWARE_VERIFIED trên server trước khi mở nhận ảnh.',
  UPLOAD_LIMIT: 'Đã nhận nhiều ảnh trong giờ này. Vui lòng thử lại sau.',
};
export function errorResponse(error) {
  const code = error.code || (messages[error.message] ? error.message : 'INTERNAL_ERROR');
  const status = error.status || (code === 'INVALID_IMAGE_SIZE' ? 413 : ['INVALID_IMAGE','HEIC_UNSUPPORTED'].includes(code) ? 415 : messages[code] ? 400 : 500);
  return Response.json({ success: false, code, error: messages[code] || 'Không thể xử lý lúc này. Vui lòng thử lại.' }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function publicRequest(r) { return { id: r.id, pickup_code: r.pickup_code, status: r.status, created_at: r.created_at }; }
export async function signedPreview(client, path) {
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error) fail('DATABASE_UNAVAILABLE', 503);
  return data.signedUrl;
}
