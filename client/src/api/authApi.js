import axiosClient from './axiosClient.js';

export async function loginRequest(username, password) {
  const response = await axiosClient.post(
    '/auth/login',
    { username, password },
    { skipAuth: true },
  );
  return response.data.data;
}

export async function getCurrentUser(signal) {
  const response = await axiosClient.get('/auth/me', { signal });
  return response.data.data.user;
}

export async function checkAdminAccess() {
  const response = await axiosClient.get('/auth/admin-check');
  return response.data.message;
}

export function logoutRequest(token) {
  // Token được chụp trước khi xóa sessionStorage; không đưa vào URL.
  return axiosClient.post(
    '/auth/logout',
    {},
    { skipAuth: true, headers: { Authorization: `Bearer ${token}` } },
  );
}
