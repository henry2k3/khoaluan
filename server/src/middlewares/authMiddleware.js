import mongoose from 'mongoose';
import User from '../models/User.js';
import { verifyAccessToken } from '../utils/token.js';

export async function requireAuth(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const match = /^Bearer (\S+)$/i.exec(authorization);
  let payload;

  try {
    if (!match) throw new Error('Missing token');
    payload = verifyAccessToken(match[1]);
    if (!mongoose.isObjectIdOrHexString(payload.sub)) throw new Error('Invalid user id');
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    });
  }

  // Tài khoản bị khóa/xóa hoặc đổi quyền phải có hiệu lực ở yêu cầu tiếp theo.
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || !['admin', 'staff'].includes(user.role)) {
    return res.status(401).json({ success: false, message: 'Tài khoản không còn quyền truy cập. Vui lòng đăng nhập lại.' });
  }

  req.user = user;
  next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập chức năng này.' });
    }
    next();
  };
}
