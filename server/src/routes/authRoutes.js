import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  login,
  logout,
  getMe,
  checkAdminAccess,
} from '../controllers/authController.js';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Chặn thử mật khẩu liên tiếp; chưa cần hệ thống lưu giới hạn riêng.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  },
});

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.post('/login', loginLimiter, login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
// API nhỏ để kiểm tra phân quyền; chưa phải API dashboard hoặc quản lý.
router.get(
  '/admin-check',
  requireAuth,
  requireRoles('admin'),
  checkAdminAccess,
);

export default router;
