import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import publicMenuRoutes from './routes/publicMenuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { createDashboardRouter } from './routes/dashboardRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

// Cho test truyền đồng hồ thống kê cố định; ứng dụng thật luôn dùng giờ server.
export function createApp({ dashboardClock } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicMenuRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/dashboard', createDashboardRouter(dashboardClock));
  app.use('/api', catalogRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
export default createApp();
