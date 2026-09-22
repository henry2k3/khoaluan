import mongoose from 'mongoose';

export async function getHealth(req, res) {
  let databaseConnected = false;

  if (mongoose.connection.readyState === 1) {
    try {
      // Ping thực tế để không báo thành công chỉ dựa vào trạng thái kết nối cũ.
      await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 3000 });
      databaseConnected = true;
    } catch {
      databaseConnected = false;
    }
  }

  res.set('Cache-Control', 'no-store');
  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: databaseConnected
      ? 'Frontend → Backend → MongoDB đã kết nối thành công.'
      : 'Backend đang chạy nhưng chưa kết nối được MongoDB.',
    data: {
      backend: 'running',
      database: databaseConnected ? 'connected' : 'disconnected',
    },
  });
}
