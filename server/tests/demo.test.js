import assert from 'node:assert/strict';
import { before, after, describe, it } from 'node:test';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

let local = {};
try { local = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const suffix = randomBytes(8).toString('hex');
const dbName = `restaurant_qr_9b_test_${suffix}`;
const cliDBName = `${dbName}_cli`;
const witnessDBName = `${dbName}_witness`;
assert.notEqual(dbName, local.DEMO_DB_NAME);
assert.notEqual(cliDBName, local.DEMO_DB_NAME);
Object.assign(process.env, { NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5174',
  PUBLIC_APP_URL: 'http://localhost:5174', JWT_SECRET: randomBytes(48).toString('hex'),
  ORDER_TOKEN_SECRET: randomBytes(48).toString('hex'),
  MONGODB_URI: process.env.TEST_MONGODB_URI || local.MONGODB_URI || 'mongodb://127.0.0.1:27017' });
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);
const { seedDemoData } = await import('../scripts/demoData.js');
const { resetDemo } = await import('../scripts/resetDemo.js');
const { createApp } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Category } = await import('../src/models/Category.js');
const { default: Product } = await import('../src/models/Product.js');
const { default: Table } = await import('../src/models/Table.js');
const { default: Order } = await import('../src/models/Order.js');
const now = new Date('2026-09-22T13:00:00Z');
const adminPassword = randomBytes(20).toString('hex');
const staffPassword = randomBytes(20).toString('hex');
const options = { demoDBName: dbName, adminPassword, staffPassword, now };
// Chỉ dựng URI cho database test; reset luôn kiểm tra connection.name thực tế.
const uriFor = (name) => process.env.MONGODB_URI.replace(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/[^?]*)?/, `$1/${name}`);
const exec = promisify(execFile);
async function cli(script, { database = dbName, args = [], ...overrides } = {}) {
  const env = { ...process.env, MONGODB_URI: uriFor(database), DEMO_DB_NAME: database,
    DEMO_ADMIN_PASSWORD: adminPassword, DEMO_STAFF_PASSWORD: staffPassword, ...overrides };
  try {
    const result = await exec(process.execPath, [fileURLToPath(new URL(`../scripts/${script}`, import.meta.url)), ...args], { env });
    return { code: 0, ...result };
  } catch (error) { return { code: error.code, stdout: error.stdout, stderr: error.stderr }; }
}
let server, baseURL, counts, witness;

describe('9B — seed/reset an toàn trên database thử riêng', { concurrency: false }, () => {
  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000, autoIndex: false, autoCreate: false });
    witness = mongoose.connection.useDb(witnessDBName);
    await witness.collection('keep').insertOne({ marker: 'Giữ nguyên database khác' });
    counts = await seedDemoData(options);
    server = createApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseURL = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.name === dbName) {
      for (const name of [dbName, cliDBName, witnessDBName]) {
        await mongoose.connection.useDb(name).dropDatabase();
      }
    }
    await mongoose.disconnect();
  });
  it('tạo một admin', async () => assert.equal(await User.countDocuments({ role: 'admin' }), 1));
  it('tạo hai staff', async () => assert.equal(await User.countDocuments({ role: 'staff' }), 2));
  it('tạo năm danh mục', async () => assert.equal(await Category.countDocuments(), 5));
  it('tạo hai mươi món', async () => assert.equal(await Product.countDocuments(), 20));
  it('tạo mười bàn', async () => assert.equal(await Table.countDocuments(), 10));
  it('tạo mười hai đơn và hai mươi bốn dòng món', async () => {
    assert.equal(await Order.countDocuments(), 12);
    assert.deepEqual(counts, { users: 3, categories: 5, products: 20, tables: 10, orders: 12, orderItems: 24 });
  });
  it('completed có paidAt Date; đơn chưa completed không có paidAt giả', async () => {
    for (const order of await Order.find().lean()) {
      if (order.status === 'completed') {
        assert(order.paidAt instanceof Date);
        assert(order.paidAt <= now);
        assert(order.paidAt >= order.createdAt);
      } else assert.equal(order.paidAt, null);
    }
  });
  it('snapshot và tổng tiền đúng, không lệ thuộc Product sau seed', async () => {
    for (const order of await Order.find().lean()) {
      let sum = 0;
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        assert.equal(item.productName, product.name);
        assert.equal(item.unitPrice, product.price);
        assert.equal(item.lineTotal, item.unitPrice * item.quantity);
        sum += item.lineTotal;
      }
      assert.equal(order.totalAmount, sum);
    }
  });
  it('Bàn 05 không có đơn đang xử lý', async () => {
    const table = await Table.findOne({ name: 'Bàn 05' });
    assert.equal(await Order.countDocuments({ tableId: table._id, status: { $in: ['pending', 'confirmed', 'preparing', 'served'] } }), 0);
  });
  it('Bàn 05 hoạt động và QR hợp lệ, tất cả QR không trùng', async () => {
    const tables = await Table.find().lean();
    assert(tables.find((table) => table.name === 'Bàn 05').isActive);
    for (const table of tables) assert.match(table.qrToken, /^[a-f0-9]{48}$/);
    assert.equal(new Set(tables.map((table) => table.qrToken)).size, 10);
  });
  it('check:data thật sau seed đọc 12 đơn/24 dòng, cả bốn nhóm lỗi = 0', async () => {
    const result = await cli('checkData.js');
    assert.equal(result.code, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ordersChecked, 12);
    assert.equal(report.itemsChecked, 24);
    assert(report.passed);
    assert(Object.values(report.counters).every((value) => value === 0));
  });
  it('tạo đúng index unique ngay trên database rỗng', async () => {
    for (const [model, key] of [[User, 'username'], [Table, 'qrToken'], [Order, 'orderCode'], [Order, 'requestIdHash']]) {
      assert((await model.collection.indexes()).some((index) => index.key[key] === 1 && index.unique));
    }
    assert((await Order.collection.indexes()).some((index) => index.key.status === 1 && index.key.paidAt === 1));
  });
  for (const [username, role, password] of [['demo_admin', 'admin', adminPassword], ['demo_staff1', 'staff', staffPassword], ['demo_staff2', 'staff', staffPassword]]) {
    it(`${username} đăng nhập bằng mật khẩu seed và có đúng role`, async () => {
      const response = await fetch(`${baseURL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      assert.equal(response.status, 200);
      const { data } = await response.json();
      assert.equal(data.user.role, role);
      assert(data.accessToken);
      const user = await User.findOne({ username }).select('+passwordHash');
      assert.match(user.passwordHash, /^\$2[aby]\$/);
      assert.notEqual(user.passwordHash, password);
    });
  }
  it('seed lần hai bị từ chối, không thay đổi bản ghi', async () => {
    const before = JSON.stringify(await Order.find().lean());
    await assert.rejects(seedDemoData(options), /Database đã có dữ liệu/);
    assert.equal(JSON.stringify(await Order.find().lean()), before);
  });
  it('thiếu mật khẩu demo trong production bị từ chối trước khi ghi', async () => {
    for (const name of ['DEMO_ADMIN_PASSWORD', 'DEMO_STAFF_PASSWORD']) {
      const result = await cli('seedDemo.js', { NODE_ENV: 'production', [name]: '' });
      assert.equal(result.code, 1);
      assert(result.stderr.includes(name));
    }
    assert.equal(await User.countDocuments(), 3);
  });
  it('thời gian mẫu là hôm nay/hôm qua/3/6 ngày trước theo giờ VN', async () => {
    const dates = new Set((await Order.find().lean()).map((order) => new Date(order.createdAt.getTime() + 7 * 3600000).toISOString().slice(0, 10)));
    assert.deepEqual([...dates].sort(), ['2026-09-16', '2026-09-19', '2026-09-21', '2026-09-22']);
  });
  it('lịch sử hợp lệ, có người xử lý; cancelled có đầy đủ lý do/thời gian/người', async () => {
    for (const order of await Order.find().lean()) {
      assert.equal(order.statusHistory[0].status, 'pending');
      assert.equal(order.statusHistory[0].changedBy, null);
      assert.equal(order.statusHistory.at(-1).status, order.status);
      assert.equal(order.statusHistory[0].changedAt.getTime(), order.createdAt.getTime());
      for (const change of order.statusHistory.slice(1)) assert(change.changedBy);
      assert.equal(order.updatedAt.getTime(), order.statusHistory.at(-1).changedAt.getTime());
    }
    const cancelled = await Order.findOne({ status: 'cancelled' });
    assert(cancelled.cancelReason && cancelled.cancelledBy && cancelled.cancelledAt instanceof Date);
  });
  it('reset thiếu --confirm bị từ chối', async () => {
    const result = await cli('resetDemo.js');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Thiếu --confirm/);
    assert.equal(await Order.countDocuments(), 12);
  });
  it('reset production bị từ chối dù có confirm và đúng database', async () => {
    const result = await cli('resetDemo.js', { NODE_ENV: 'production', args: ['--confirm'] });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Không cho reset demo trong production/);
    assert.equal(await Order.countDocuments(), 12);
  });
  it('reset sai DEMO_DB_NAME bị từ chối, dùng connection.name thực tế', async () => {
    const result = await cli('resetDemo.js', { DEMO_DB_NAME: witnessDBName, args: ['--confirm'] });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /database kết nối thật/);
    assert.equal(await Order.countDocuments(), 12);
    await assert.rejects(resetDemo(mongoose.connection, { nodeEnv: 'development', demoDBName: witnessDBName, confirm: true }), /kết nối thật/);
  });
  it('seed CLI trên DB rỗng chạy check:data tự động và lần hai bị từ chối', async () => {
    const result = await cli('seedDemo.js', { database: cliDBName });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /"ordersChecked": 12/);
    assert.match(result.stdout, /"itemsChecked": 24/);
    assert.match(result.stdout, /"passed": true/);
    assert.equal((await cli('seedDemo.js', { database: cliDBName })).code, 1);
  });
  it('seed cũng từ chối collection lạ có dữ liệu và không xóa nó', async () => {
    await resetDemo(mongoose.connection, { nodeEnv: 'test', demoDBName: dbName, confirm: true, log: () => {} });
    await mongoose.connection.collection('unknown').insertOne({ keep: true });
    await assert.rejects(seedDemoData(options), /Database đã có dữ liệu/);
    assert.equal(await mongoose.connection.collection('unknown').countDocuments(), 1);
  });
  it('reset đủ ba điều kiện xóa đúng DB, log an toàn và không ảnh hưởng DB khác', async () => {
    const result = await cli('resetDemo.js', { database: cliDBName, args: ['--confirm'] });
    assert.equal(result.code, 0, result.stderr);
    const target = JSON.parse(result.stdout.split('\n')[0]);
    assert.deepEqual(Object.keys(target).sort(), ['database', 'host']);
    assert.equal(target.database, cliDBName);
    assert.equal(await mongoose.connection.useDb(cliDBName).collection('orders').countDocuments(), 0);
    assert.equal(await witness.collection('keep').countDocuments(), 1);
    assert.equal(await mongoose.connection.collection('unknown').countDocuments(), 1);
  });
  it('seed ngay sau nửa đêm không sinh paidAt ở tương lai; seed lại sau reset được', async () => {
    await resetDemo(mongoose.connection, { nodeEnv: 'test', demoDBName: dbName, confirm: true, log: () => {} });
    const midnight = new Date('2026-09-22T17:00:01Z');
    await seedDemoData({ ...options, now: midnight });
    const orders = await Order.find({ status: 'completed' }).lean();
    assert(orders.every((order) => order.paidAt <= midnight));
    assert(orders.some((order) => order.paidAt >= new Date('2026-09-22T17:00:00Z')));
  });
});
