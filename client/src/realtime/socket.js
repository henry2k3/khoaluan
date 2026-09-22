import { io } from 'socket.io-client';
import { apiBaseUrl } from '../api/baseUrl.js';

const apiURL = new URL(
  apiBaseUrl,
  window.location.origin,
);
// Singleton: mỗi tab chỉ tạo một đối tượng socket. Component không gọi io() lần nữa.
export const socket = io(apiURL.origin, { autoConnect: false });

// Khi Vite thay module trong lúc phát triển, đóng kết nối cũ.
if (import.meta.hot) import.meta.hot.dispose(() => socket.disconnect());
