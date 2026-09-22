import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';

// Chỉ tạo một bản ghi kiểm tra riêng, không đụng tới dữ liệu nghiệp vụ.
const checkId = new mongoose.Types.ObjectId();
let collection;

try {
  await connectDatabase();
  await mongoose.connection.db.command({ ping: 1 });
  collection = mongoose.connection.db.collection('foundation_checks');
  await collection.insertOne({ _id: checkId, purpose: 'foundation-check' });
  const saved = await collection.findOne({ _id: checkId });
  assert.equal(saved?.purpose, 'foundation-check');
  console.log('Kiểm tra MongoDB: ping, ghi và đọc dữ liệu thành công.');
} catch {
  console.error('Kiểm tra MongoDB thất bại. Kiểm tra kết nối và quyền đọc/ghi của tài khoản database.');
  process.exitCode = 1;
} finally {
  try {
    if (collection) await collection.deleteOne({ _id: checkId });
  } catch {
    console.error('Không dọn được bản ghi kiểm tra trong foundation_checks.');
    process.exitCode = 1;
  }
  await mongoose.disconnect();
}
