// Client-side API functions for RSVP guest flow and Admin management

const EDIT_TOKEN_KEY = 'wedding_rsvp_edit_token';
const RSVP_CACHE_KEY = 'wedding_rsvp_last_payload';

export function getStoredEditToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(EDIT_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function saveEditToken(token) {
  if (typeof window === 'undefined' || !token) return;
  try {
    localStorage.setItem(EDIT_TOKEN_KEY, token);
  } catch (err) {
    console.error('Failed to save edit token:', err);
  }
}

export function clearStoredEditToken() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(EDIT_TOKEN_KEY);
    localStorage.removeItem(RSVP_CACHE_KEY);
  } catch (err) {
    console.error('Failed to clear edit token:', err);
  }
}

export function saveLastRsvpData(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RSVP_CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not cache RSVP form draft:', err);
  }
}

export function getLastRsvpData() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RSVP_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isOffline() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine;
}

export async function submitRsvp(payload) {
  if (isOffline()) {
    const err = new Error('Thiết bị đang ngoại tuyến (offline). Vui lòng kiểm tra kết nối mạng và thử lại.');
    err.code = 'OFFLINE';
    throw err;
  }

  // Preserve draft locally before sending
  saveLastRsvpData(payload);

  const res = await fetch('/api/rsvp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    const error = new Error(data.error || 'Có lỗi xảy ra khi gửi xác nhận. Vui lòng thử lại.');
    error.status = res.status;
    error.code = data.code;
    throw error;
  }

  if (data.edit_token) {
    saveEditToken(data.edit_token);
  }
  return data;
}

export async function getRsvpByToken(token) {
  if (!token) return null;
  if (isOffline()) {
    const err = new Error('Thiết bị đang ngoại tuyến (offline). Vui lòng kết nối mạng để tải lại thông tin.');
    err.code = 'OFFLINE';
    throw err;
  }

  const res = await fetch(`/api/rsvp?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache' },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    if (res.status === 404) {
      clearStoredEditToken();
      return null;
    }
    const error = new Error(data.error || 'Không thể tải thông tin phản hồi.');
    error.status = res.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export async function updateRsvp(token, payload) {
  if (!token) {
    throw new Error('Mã chỉnh sửa không hợp lệ hoặc đã hết hạn.');
  }
  if (isOffline()) {
    const err = new Error('Thiết bị đang ngoại tuyến (offline). Vui lòng kiểm tra kết nối mạng.');
    err.code = 'OFFLINE';
    throw err;
  }

  saveLastRsvpData(payload);

  const res = await fetch(`/api/rsvp?token=${encodeURIComponent(token)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    const error = new Error(data.error || 'Không thể cập nhật thông tin. Vui lòng thử lại.');
    error.status = res.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export async function getAdminRsvps(adminPassword, params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.attendance) query.set('attendance', params.attendance);
  if (params.sort) query.set('sort', params.sort);

  const res = await fetch(`/api/admin/rsvp?${query.toString()}`, {
    method: 'GET',
    headers: {
      'x-admin-password': adminPassword,
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    const error = new Error(data.error || 'Không thể tải danh sách RSVP.');
    error.status = res.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export async function updateAdminRsvp(adminPassword, id, updates) {
  const res = await fetch('/api/admin/rsvp', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword,
    },
    body: JSON.stringify({ id, ...updates }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Không thể cập nhật RSVP.');
  }
  return data;
}

export async function deleteAdminRsvp(adminPassword, id) {
  const res = await fetch(`/api/admin/rsvp?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-admin-password': adminPassword,
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Không thể xoá phản hồi RSVP.');
  }
  return data;
}
