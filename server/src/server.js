import mongoose from 'mongoose';
import { createServer } from 'node:http';
import { initializeRealtime } from './sockets/realtimeServer.js';
import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

let server;
let realtime;
let stopping = false;

async function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  console.log('Đang dừng backend…');

  // Tránh treo tiến trình nếu còn kết nối không đóng được.
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();

  if (realtime) await realtime.close();
  else if (server?.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  clearTimeout(timer);
  process.exit(exitCode);
}

async function startServer() {
  try {
    // Chỉ mở cổng HTTP sau khi kết nối cơ sở dữ liệu thành công.
    await connectDatabase();
    server = createServer(app);
    realtime = initializeRealtime(server);
    server.listen(env.port, () => {
      console.log(`Backend đang chạy tại http://localhost:${env.port}`);
    });
    server.on('error', (error) => {
      console.error(
        error.code === 'EADDRINUSE'
          ? `Cổng ${env.port} đang được sử dụng. Hãy dừng tiến trình cũ hoặc đổi PORT.`
          : 'Không thể mở cổng backend.',
      );
      void shutdown(1);
    });
  } catch {
    console.error(
      'Không kết nối được MongoDB. Kiểm tra dịch vụ MongoDB và MONGODB_URI trong server/.env.',
    );
    await shutdown(1);
  }
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

startServer();
