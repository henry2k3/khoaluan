import mongoose from 'mongoose';
import { env } from './env.js';

// Gắn một lần khi module được nạp; không log error/URI vì có thể chứa mật khẩu.
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB mất kết nối.');
});
mongoose.connection.on('reconnected', () => {
  console.log('MongoDB đã kết nối lại.');
});
mongoose.connection.on('error', () => {
  console.error('Kết nối MongoDB gặp lỗi.');
});

export async function connectDatabase() {
  // Báo lỗi sớm nếu MongoDB chưa chạy hoặc địa chỉ kết nối không đúng.
  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });
  console.log('Kết nối MongoDB thành công.');
}
