import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import { dashboardControllers } from '../controllers/dashboardController.js';

export function createDashboardRouter(clock) {
  const { getSummary, getRevenue, getProducts, getRecentOrders } =
    dashboardControllers(clock);
  const router = Router();
  router.use(requireAuth, requireRoles('admin'));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/summary', getSummary);
  router.get('/revenue', getRevenue);
  router.get('/products', getProducts);
  router.get('/recent-orders', getRecentOrders);
  return router;
}
export default createDashboardRouter();
