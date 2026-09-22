import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import { createInternalUser } from '../src/services/userService.js';

try {
  await connectDatabase();
  const user = await createInternalUser({
    role: process.env.CREATE_USER_ROLE,
    fullName: process.env.CREATE_USER_FULL_NAME,
    username: process.env.CREATE_USER_USERNAME,
    password: process.env.CREATE_USER_PASSWORD,
  });
  console.log(`Đã tạo tài khoản ${user.username} với vai trò ${user.role}.`);
  console.log('Mật khẩu không được in ra log. Có thể xóa CREATE_USER_PASSWORD khỏi .env sau khi đã lưu mật khẩu an toàn.');
} catch (error) {
  // Chỉ in thông báo kiểm tra đầu vào do ứng dụng tạo, không in lỗi kết nối chứa URI.
  console.error(
    error.code === 11000
      ? 'Tên đăng nhập đã tồn tại; không thay đổi tài khoản hiện có.'
      : error.constructor === Error
        ? error.message
        : 'Không tạo được tài khoản. Kiểm tra cấu hình và kết nối MongoDB.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
