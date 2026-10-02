/** Shared UI contract. Secrets belong in headers/fragment, never URL query strings. */
export const PHOTO_STATUS_LABELS = {
  pending: 'Pending Review',
  approved: 'Queued for Print',
  claimed: 'Spooling to Printer',
  submitting: 'Spooling to Printer',
  submitted: 'Printing in Progress',
  review: 'Operator Review Needed',
  ready: 'Ready for Pickup',
  rejected: 'Request Declined',
};
export async function photoFetch(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  let data;
  try { data = await response.json(); } catch { throw new Error('Server returned an invalid response. Please try again.'); }
  if (!response.ok || !data.success) {
    const error = new Error(data.error || 'Unable to process request.');
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
