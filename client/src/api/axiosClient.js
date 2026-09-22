import axios from 'axios';
import { getAccessToken } from '../utils/authStorage.js';

// Các hàm gọi API dùng chung địa chỉ backend và thời gian chờ.
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
});

axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = getAccessToken();
    // Không để phản hồi cũ xóa một phiên mới, hoặc lỗi mật khẩu xóa phiên khác.
    if (
      error.response?.status === 401 &&
      token &&
      error.config?.headers?.Authorization === `Bearer ${token}`
    ) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
