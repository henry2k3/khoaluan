import { io } from 'socket.io-client';

const apiURL = new URL(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  window.location.origin,
);
// Singleton: mỗi tab chỉ tạo một đối tượng socket. Component không gọi io() lần nữa.
export const socket = io(apiURL.origin, { autoConnect: false });

// Khi Vite thay module trong lúc phát triển, đóng kết nối cũ.
if (import.meta.hot) import.meta.hot.dispose(() => socket.disconnect());
