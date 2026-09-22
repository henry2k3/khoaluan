import bcrypt from 'bcrypt';
import User from '../models/User.js';

// Dùng cho lệnh khởi tạo nội bộ, chưa cung cấp API đăng ký hoặc quản lý tài khoản.
export async function createInternalUser({ fullName, username, password, role }) {
  if (!['admin', 'staff'].includes(role)) {
    throw new Error('Vai trò chỉ được là admin hoặc staff.');
  }
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100) {
    throw new Error('Họ tên phải có từ 1 đến 100 ký tự.');
  }
  if (typeof username !== 'string' || !/^[a-z0-9._-]{3,50}$/i.test(username.trim())) {
    throw new Error('Tên đăng nhập dài 3–50 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
  }
  // bcrypt chỉ xử lý tối đa 72 byte; không để mật khẩu bị cắt âm thầm.
  if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Mật khẩu phải có ít nhất 10 ký tự và không vượt quá 72 byte UTF-8.');
  }

  const normalizedUsername = username.trim().toLowerCase();
  await User.init();
  if (await User.exists({ username: normalizedUsername })) {
    throw new Error('Tên đăng nhập đã tồn tại. Lệnh này không ghi đè hoặc đặt lại mật khẩu.');
  }

  return User.create({
    fullName: fullName.trim(),
    username: normalizedUsername,
    passwordHash: await bcrypt.hash(password, 12),
    role,
  });
}
