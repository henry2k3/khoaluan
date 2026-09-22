import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import Table from '../src/models/Table.js';
import Order from '../src/models/Order.js';
import { createInternalUser } from '../src/services/userService.js';
import { hashValue, makeTrackingToken } from '../src/utils/orderToken.js';

export class DemoError extends Error {}

export function validateDemoPasswords(adminPassword, staffPassword) {
  for (const [name, password] of Object.entries({ DEMO_ADMIN_PASSWORD: adminPassword, DEMO_STAFF_PASSWORD: staffPassword })) {
    if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new DemoError(`${name} bắt buộc: ít nhất 10 ký tự, tối đa 72 byte UTF-8.`);
    }
  }
}

const menu = [
  ['Cà phê', [['Cà phê đen', 20000], ['Cà phê sữa', 25000], ['Bạc xỉu', 30000], ['Cà phê muối', 35000]]],
  ['Trà', [['Trà đào', 35000], ['Trà vải', 35000], ['Trà chanh', 25000], ['Trà sen', 40000]]],
  ['Nước ép', [['Nước cam', 35000], ['Nước ép dưa hấu', 30000], ['Nước ép táo', 40000], ['Nước chanh', 25000]]],
  ['Bánh', [['Bánh tiramisu', 45000], ['Bánh phô mai', 40000], ['Bánh sừng bò', 30000], ['Bánh chocolate', 45000]]],
  ['Ăn nhẹ', [['Khoai tây chiên', 35000], ['Sandwich trứng', 40000], ['Bánh mì gà', 45000], ['Xúc xích', 35000]]],
];

// Tính ngày Việt Nam từ now. Ngày hôm nay chỉ dùng thời gian đã trôi qua,
// kể cả khi seed ngay sau 00:00; không tạo paidAt trong tương lai.
function dayWindow(now, daysAgo) {
  const vnDay = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const start = new Date(`${vnDay}T00:00:00+07:00`).getTime() - daysAgo * 86400000;
  const duration = daysAgo === 0 ? now.getTime() - start : 12 * 3600000;
  return { start, duration };
}

export async function seedDemoData({ demoDBName, adminPassword, staffPassword, now = new Date() }) {
  validateDemoPasswords(adminPassword, staffPassword);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new DemoError('Thời gian seed không hợp lệ.');
  const connection = mongoose.connection;
  if (!demoDBName || connection.name !== demoDBName || ['admin', 'config', 'local'].includes(demoDBName)) {
    throw new DemoError('Seed chỉ chạy khi tên database kết nối thật đúng DEMO_DB_NAME, không phải database hệ thống.');
  }
  // Kiểm tra cả collection ngoài năm model: không tự xóa hoặc ghi đè dữ liệu.
  for (const collection of await connection.db.listCollections({}, { nameOnly: true }).toArray()) {
    if (await connection.db.collection(collection.name).findOne({}, { projection: { _id: 1 } })) {
      throw new DemoError('Database đã có dữ liệu. Seed bị từ chối; chỉ chạy reset:demo nếu chắc chắn đây là dữ liệu demo có thể xóa.');
    }
  }
  // autoIndex/autoCreate tắt lúc kết nối để không sửa DB trước bước kiểm tra.
  for (const model of [User, Category, Product, Table, Order]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const users = [];
  for (const [username, fullName, role] of [
    ['demo_admin', 'Quản lý demo', 'admin'],
    ['demo_staff1', 'Nhân viên demo 1', 'staff'],
    ['demo_staff2', 'Nhân viên demo 2', 'staff'],
  ]) {
    users.push(await createInternalUser({ username, fullName, role, password: role === 'admin' ? adminPassword : staffPassword }));
  }
  const products = [];
  for (const [index, [name, dishes]] of menu.entries()) {
    const category = await Category.create({ name, description: `Danh mục ${name.toLowerCase()}`, sortOrder: index });
    for (const [productName, price] of dishes) {
      products.push(await Product.create({ categoryId: category._id, name: productName, price,
        description: `${productName} — thực đơn demo`, imageUrl: index === 0 ? '/images/coffee.svg' : '' }));
    }
  }
  const tables = [];
  for (let index = 1; index <= 10; index += 1) {
    tables.push(await Table.create({ name: `Bàn ${String(index).padStart(2, '0')}`, capacity: index <= 6 ? 4 : 6 }));
  }
  const samples = [
    [0, 'completed', 0], [0, 'completed', 1], [0, 'completed', 4],
    [1, 'completed', 2], [1, 'completed', 3], [3, 'completed', 5],
    [3, 'completed', 6], [6, 'completed', 7], [0, 'cancelled', 8],
    [0, 'pending', 0], [0, 'confirmed', 1], [0, 'preparing', 2],
  ];
  for (const [index, [daysAgo, status, tableIndex]] of samples.entries()) {
    const { start, duration } = dayWindow(now, daysAgo);
    const createdAt = new Date(start + Math.floor(duration * (0.1 + index * 0.01)));
    const lastChange = new Date(start + Math.floor(duration * (0.6 + index * 0.02)));
    const steps = status === 'cancelled' ? ['pending', 'confirmed', 'cancelled']
      : ['pending', 'confirmed', 'preparing', 'served', 'completed'].slice(0,
          ['pending', 'confirmed', 'preparing', 'served', 'completed'].indexOf(status) + 1);
    const statusHistory = steps.map((step, position) => ({ status: step,
      changedAt: new Date(createdAt.getTime() + Math.floor((lastChange - createdAt) * position / Math.max(1, steps.length - 1))),
      changedBy: position ? users[1]._id : null }));
    const items = [products[index % products.length], products[(index + 5) % products.length]].map((product, itemIndex) => {
      const quantity = itemIndex === 0 ? 2 : 1;
      return { productId: product._id, productName: product.name, unitPrice: product.price,
        quantity, note: itemIndex === 0 ? 'Ít đá (dữ liệu demo)' : '', lineTotal: product.price * quantity };
    });
    const nonce = randomBytes(32).toString('hex');
    const table = tables[tableIndex];
    const updatedAt = statusHistory.at(-1).changedAt;
    // Dữ liệu lịch sử có timestamps tương đối đã tính; không để save ghi đè chúng.
    await new Order({
      orderCode: `ORD-${new Date(createdAt.getTime() + 7 * 3600000).toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(5).toString('hex').toUpperCase()}`,
      customerName: `Khách demo ${index + 1}`, tableId: table._id, tableName: table.name,
      items, note: 'Đơn mẫu để trình bày dashboard', totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
      status, statusHistory, createdAt, updatedAt,
      paidAt: status === 'completed' ? updatedAt : null,
      cancelReason: status === 'cancelled' ? 'Khách đổi ý (đơn mẫu)' : '',
      cancelledAt: status === 'cancelled' ? updatedAt : null,
      cancelledBy: status === 'cancelled' ? users[1]._id : null,
      trackingTokenNonce: nonce, trackingTokenHash: hashValue(makeTrackingToken(nonce)),
      requestIdHash: hashValue(randomBytes(32).toString('hex')), requestPayloadHash: hashValue(JSON.stringify({ tableId: table.id, items })),
    }).save({ timestamps: false });
  }
  return { users: users.length, categories: menu.length, products: products.length,
    tables: tables.length, orders: samples.length, orderItems: samples.length * 2 };
}
