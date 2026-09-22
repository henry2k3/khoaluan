import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { createAccessToken } from '../utils/token.js';
import { userResponse } from '../utils/userResponse.js';
import { disconnectUserRealtime } from '../sockets/notifications.js';

export function logout(req, res) {
  disconnectUserRealtime(req.user._id);
  res.json({
    success: true,
    message: 'Đã ngắt các kết nối realtime của tài khoản.',
  });
}

export async function login(req, res) {
  const { username, password } = req.body || {};

  if (
    typeof username !== 'string' ||
    !/^[a-z0-9._-]{3,50}$/i.test(username.trim()) ||
    typeof password !== 'string' ||
    password.length === 0 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.',
      });
  }

  const user = await User.findOne({
    username: username.trim().toLowerCase(),
  }).select('+passwordHash');
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (
    !user ||
    !passwordMatches ||
    !user.isActive ||
    !['admin', 'staff'].includes(user.role)
  ) {
    // Không tiết lộ tài khoản tồn tại, bị khóa hay nhập sai mật khẩu.
    return res
      .status(401)
      .json({
        success: false,
        message:
          'Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản không khả dụng.',
      });
  }

  res.json({
    success: true,
    message: 'Đăng nhập thành công.',
    data: {
      accessToken: createAccessToken(user._id),
      user: userResponse(user),
    },
  });
}

export function getMe(req, res) {
  res.json({ success: true, data: { user: userResponse(req.user) } });
}

export function checkAdminAccess(req, res) {
  res.json({ success: true, message: 'Backend đã xác nhận quyền quản lý.' });
}
