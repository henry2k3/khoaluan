import mongoose from 'mongoose';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DemoError, seedDemoData, validateDemoPasswords } from './demoData.js';

try {
  validateDemoPasswords(process.env.DEMO_ADMIN_PASSWORD, process.env.DEMO_STAFF_PASSWORD);
  if (!process.env.MONGODB_URI || !process.env.DEMO_DB_NAME?.trim()) throw new DemoError('Cần MONGODB_URI và DEMO_DB_NAME.');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
  console.log(JSON.stringify({ host: mongoose.connection.host, database: mongoose.connection.name }));
  const counts = await seedDemoData({ demoDBName: process.env.DEMO_DB_NAME.trim(),
    adminPassword: process.env.DEMO_ADMIN_PASSWORD, staffPassword: process.env.DEMO_STAFF_PASSWORD });
  console.log(JSON.stringify(counts, null, 2));
  await mongoose.disconnect();
  // Dùng lại script chỉ đọc hiện có; không tự sửa dữ liệu nếu kiểm tra thất bại.
  const check = spawnSync(process.execPath, [fileURLToPath(new URL('./checkData.js', import.meta.url))], { env: process.env, stdio: 'inherit' });
  if (check.error || check.status !== 0) {
    console.error('Seed đã ghi dữ liệu nhưng check:data không đạt. DỪNG và kiểm tra; không tự backfill.');
    process.exitCode = check.status || 1;
  }
} catch (error) {
  console.error(error instanceof DemoError ? error.message : 'Không seed được dữ liệu. Kiểm tra kết nối/cấu hình; nếu đã ghi một phần, không tự xóa hoặc chạy lại.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
