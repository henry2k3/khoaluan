import { Router } from 'express';
import {
  createPublicOrder,
  getPublicOrder,
} from '../controllers/publicOrderController.js';
import {
  getPublicTable,
  listPublicCategories,
  listPublicProducts,
  getPublicProduct,
} from '../controllers/publicMenuController.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/tables/:qrToken', getPublicTable);
router.get('/categories', listPublicCategories);
router.get('/products', listPublicProducts);
router.get('/products/:id', getPublicProduct);
router.post('/orders', createPublicOrder);
router.get('/orders/:id', getPublicOrder);

export default router;
