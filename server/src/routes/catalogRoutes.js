import { Router } from 'express';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware.js';
import {
  listCategories,
  createCategory,
  updateCategory,
} from '../controllers/categoryController.js';
import {
  listProducts,
  createProduct,
  updateProduct,
} from '../controllers/productController.js';
import {
  listTables,
  createTable,
  updateTable,
  getTableQr,
} from '../controllers/tableController.js';

const router = Router();

// Đặt middleware trên từng nhóm để không bắt API public/health đăng nhập.
router.use(['/categories', '/products'], requireAuth, requireRoles('admin'));
router.get('/categories', listCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.get('/products', listProducts);
router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);
router.use('/tables', requireAuth, requireRoles('staff', 'admin'));
router.get('/tables', listTables);
router.post('/tables', requireRoles('admin'), createTable);
router.patch('/tables/:id', requireRoles('admin'), updateTable);
router.get('/tables/:id/qr', requireRoles('admin'), getTableQr);

export default router;
