import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
import HttpError from './utils/HttpError.js';
import { env } from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import publicMenuRoutes from './routes/publicMenuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { createDashboardRouter } from './routes/dashboardRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

// Cho test truyền đồng hồ thống kê cố định; ứng dụng thật luôn dùng giờ server.
export function createApp({ dashboardClock, staticDirectory = fileURLToPath(new URL('../../client/dist/', import.meta.url)) } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);
  app.use(cors({ origin(origin, done) {
    if (!origin || env.allowedOrigins.includes(origin)) return done(null, true);
    return done(new HttpError(403, 'Origin không được phép.'));
  } }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicMenuRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/dashboard', createDashboardRouter(dashboardClock));
  app.use('/api', catalogRoutes);
  // Không để API hoặc đường dẫn Socket.IO rơi xuống trang React.
  app.use('/api', notFound);
  app.use('/socket.io', notFound);
  if (env.production) {
    app.use(express.static(staticDirectory));
    app.use('/assets', notFound);
    // Express 5 yêu cầu wildcard có tên; dấu ngoặc bao gồm cả đường dẫn /.
    app.get('/{*path}', (req, res, next) => {
      if (extname(req.path)) return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(join(staticDirectory, 'index.html'));
    });
  }
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
export default createApp();
