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
  const {timeoutMs = options.method && options.method !== 'GET' ? 75000 : 15000,
    busyRetries = options.method && options.method !== 'GET' ? 12 : 0, ...fetchOptions} = options;
  for (let attempt=0; ; attempt++) {
    const response = await fetch(url, {cache:'no-store', ...fetchOptions,
      signal: fetchOptions.signal || AbortSignal.timeout(timeoutMs)});
    let data;
    try { data=await response.json(); } catch { throw new Error('Server returned an invalid response. Please try again.'); }
    if (response.ok && data.success) return data;
    if (response.status===429 && data.code==='PROCESSING_BUSY' && attempt<busyRetries) {
      // Admission rejection happens before rendering/writing. Retry the exact same payload.
      const delay=Math.min(10,Number(response.headers.get('Retry-After')) || 3)*1000+Math.random()*1000;
      await new Promise(resolve=>setTimeout(resolve,delay));
      continue;
    }
    const error=new Error(data.error || 'Unable to process request.');
    error.code=data.code;error.status=response.status;
    error.retryAfter=Number(response.headers.get('Retry-After')) || null;throw error;
  }
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
export const getPrintingAdmin = (password, query = {}) => photoFetch(`/api/admin/printing?${new URLSearchParams(Object.entries(query).filter(([,v])=>v!=null))}`, { headers: { 'x-admin-password': password } });
export const renewPhotoUpload = (id, token) => photoFetch(`/api/photo/uploads?id=${encodeURIComponent(id)}`, {headers: {'x-photo-token': token}});
export const mutatePrintingAdmin = (password, body) => photoFetch('/api/admin/printing', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-password': password }, body: JSON.stringify(body),
});
