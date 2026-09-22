import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';

export class ResetError extends Error {}

export async function resetDemo(connection, { nodeEnv, demoDBName, confirm, log = console.log }) {
  if (nodeEnv === 'production') throw new ResetError('Không cho reset demo trong production.');
  if (!confirm) throw new ResetError('Thiếu --confirm. Chưa xóa dữ liệu.');
  if (connection.readyState !== 1 || !demoDBName || connection.name !== demoDBName || ['admin', 'config', 'local'].includes(demoDBName)) {
    throw new ResetError('Tên database kết nối thật phải đúng DEMO_DB_NAME, không phải database hệ thống. Chưa xóa dữ liệu.');
  }
  // Không parse URI; không in username/password/chuỗi kết nối.
  log(JSON.stringify({ host: connection.host, database: connection.name }));
  await connection.dropDatabase();
  log('Đã reset đúng database demo. Có thể chạy seed:demo.');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    if (process.env.NODE_ENV === 'production') throw new ResetError('Không cho reset demo trong production.');
    if (!process.argv.includes('--confirm')) throw new ResetError('Thiếu --confirm. Chưa xóa dữ liệu.');
    if (!process.env.MONGODB_URI || !process.env.DEMO_DB_NAME?.trim()) throw new ResetError('Cần MONGODB_URI và DEMO_DB_NAME.');
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
    await resetDemo(mongoose.connection, { nodeEnv: process.env.NODE_ENV,
      demoDBName: process.env.DEMO_DB_NAME.trim(), confirm: process.argv.includes('--confirm') });
  } catch (error) {
    console.error(error instanceof ResetError ? error.message : 'Không reset được database. Kiểm tra kết nối và cấu hình; không in URI.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
