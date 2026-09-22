import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import {
  listOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
} from '../controllers/orderController.js';

const router = Router();
router.use(requireAuth, requireRoles('staff', 'admin'));
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/', listOrders);
router.get('/:id', getOrder);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/cancel', cancelOrder);
export default router;
