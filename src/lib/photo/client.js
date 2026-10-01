/** Shared UI contract. Secrets belong in headers/fragment, never URL query strings. */
export const PHOTO_STATUS_LABELS = {
  pending: 'Chờ duyệt', approved: 'Chờ in', claimed: 'Đang chuyển tới máy in',
  submitting: 'Đang chuyển tới máy in', submitted: 'Đã gửi tới máy in',
  review: 'Cần người trực kiểm tra', ready: 'Ảnh sẵn sàng', rejected: 'Yêu cầu đã bị từ chối',
};
export async function photoFetch(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  let data;
  try { data = await response.json(); } catch { throw new Error('Máy chủ chưa trả về dữ liệu hợp lệ. Vui lòng thử lại.'); }
  if (!response.ok || !data.success) {
    const error = new Error(data.error || 'Không thể xử lý yêu cầu.');
    error.code = data.code; error.status = response.status; throw error;
  }
  return data;
}
export const getPhotoSession = () => photoFetch('/api/photo/status');
export async function uploadPhoto(file) {
  const body = new FormData(); body.append('file', file);
  return photoFetch('/api/photo/uploads', { method: 'POST', body });
}
export const createPhotoRequest = (body) => photoFetch('/api/photo/requests', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
export const getPhotoRequest = (id, token) => photoFetch(`/api/photo/requests?id=${encodeURIComponent(id)}`, { headers: { 'x-photo-token': token } });
export const getPrintingAdmin = (password) => photoFetch('/api/admin/printing', { headers: { 'x-admin-password': password } });
export const mutatePrintingAdmin = (password, body) => photoFetch('/api/admin/printing', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify(body),
});
