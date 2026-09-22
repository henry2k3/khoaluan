import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';

let localEnv = {};
try {
  localEnv = parseEnv(
    readFileSync(new URL('../.env', import.meta.url), 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const testDatabase = `restaurant_qr_orders_test_${randomBytes(8).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.ORDER_TOKEN_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_ORIGIN = 'http://localhost:5174';
process.env.PUBLIC_APP_URL = 'http://localhost:5174';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ||
  localEnv.MONGODB_URI ||
  'mongodb://127.0.0.1:27017';

const { default: app } = await import('../src/app.js');
const { default: Order } = await import('../src/models/Order.js');
const { default: Category } = await import('../src/models/Category.js');
const { default: Product } = await import('../src/models/Product.js');
const { default: Table } = await import('../src/models/Table.js');
const { hashValue } = await import('../src/utils/orderToken.js');
let server, baseURL, table, category, coffee, cake;

function payload(overrides = {}) {
  return {
    requestId: randomBytes(32).toString('hex'),
    qrToken: table.qrToken,
    customerName: ' Nguyễn Văn A ',
    items: [
      { productId: coffee.id, quantity: 2, note: ' Ít đá ' },
      { productId: cake.id, quantity: 3, note: '' },
    ],
    note: ' Mang nước trước ',
    ...overrides,
  };
}
async function request(path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method: options.body ? 'POST' : 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { 'X-Order-Token': options.token } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
const post = (body) => request('/public/orders', { body });
const get = (id, token) => request(`/public/orders/${id}`, { token });
async function create(body = payload()) {
  const result = await post(body);
  assert.equal(result.status, 201, result.body.message);
  return result.body.data;
}
async function rejects(body, status = 400) {
  const count = await Order.countDocuments();
  const result = await post(body);
  assert.equal(result.status, status, result.body.message);
  assert.equal(
    await Order.countDocuments(),
    count,
    'Yêu cầu sai không lưu đơn',
  );
  assert.equal(result.body.data, undefined);
}

describe(
  'Khách tạo và xem order qua API, MongoDB thật',
  { concurrency: false },
  () => {
    before(async () => {
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName: testDatabase,
        serverSelectionTimeoutMS: 5000,
      });
      await Order.init();
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
      });
      baseURL = `http://127.0.0.1:${server.address().port}/api`;
    });
    beforeEach(async () => {
      category = await Category.create({ name: 'Đồ ăn và uống' });
      coffee = await Product.create({
        name: 'Cà phê sữa',
        price: 35000,
        categoryId: category.id,
      });
      cake = await Product.create({
        name: 'Bánh ngọt',
        price: 25000,
        categoryId: category.id,
      });
      table = await Table.create({ name: 'Bàn 05', capacity: 4 });
    });
    after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (mongoose.connection.name === testDatabase)
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    it('tạo đơn hợp lệ không cần JWT, trả id/code/token và ghi vào MongoDB', async () => {
      const created = await create();
      assert.match(created.orderId, /^[a-f0-9]{24}$/);
      assert.match(created.orderCode, /^ORD-\d{8}-[A-F0-9]{10}$/);
      assert.match(created.trackingToken, /^[a-f0-9]{64}$/);
      assert(await Order.findById(created.orderId));
    });
    it('lưu tên khách, tên bàn, ghi chú đã trim và thời gian', async () => {
      const created = await create();
      const saved = await Order.findById(created.orderId).lean();
      assert.equal(saved.customerName, 'Nguyễn Văn A');
      assert.equal(saved.tableName, 'Bàn 05');
      assert.equal(saved.tableId.toString(), table.id);
      assert.equal(saved.items[0].note, 'Ít đá');
      assert.equal(saved.note, 'Mang nước trước');
      assert(
        saved.createdAt instanceof Date && saved.updatedAt instanceof Date,
      );
      assert.equal('customerId' in saved, false);
    });
    it('bàn không tồn tại bị từ chối', async () =>
      rejects(payload({ qrToken: randomBytes(24).toString('hex') }), 404));
    it('bàn bị tắt bị từ chối', async () => {
      await Table.updateOne({ _id: table.id }, { isActive: false });
      await rejects(payload(), 403);
    });
    it('món không tồn tại bị từ chối', async () =>
      rejects(
        payload({
          items: [
            {
              productId: new mongoose.Types.ObjectId().toString(),
              quantity: 1,
            },
          ],
        }),
      ));
    it('món bị ẩn bị từ chối', async () => {
      await Product.updateOne({ _id: coffee.id }, { isActive: false });
      await rejects(payload());
    });
    it('món hết hàng bị từ chối', async () => {
      await Product.updateOne({ _id: coffee.id }, { isAvailable: false });
      await rejects(payload());
    });
    it('danh mục bị ẩn thì món không đặt được', async () => {
      await Category.updateOne({ _id: category.id }, { isActive: false });
      await rejects(payload());
    });
    it('danh mục đã xóa thì món không đặt được', async () => {
      await Category.deleteOne({ _id: category.id });
      await rejects(payload());
    });
    for (const quantity of [0, -1, 1.5, 100, '2', 'abc', null, true]) {
      it(`từ chối quantity = ${JSON.stringify(quantity)} (${typeof quantity})`, async () =>
        rejects(payload({ items: [{ productId: coffee.id, quantity }] })));
    }
    it('chấp nhận hai biên số lượng 1 và 99', async () => {
      const created = await create(
        payload({
          items: [
            { productId: coffee.id, quantity: 99 },
            { productId: cake.id, quantity: 1 },
          ],
        }),
      );
      assert.equal(
        (await Order.findById(created.orderId)).totalAmount,
        3490000,
      );
    });
    it('backend tự lấy giá thật dù frontend sửa giá/tổng/tên/status', async () => {
      const created = await create(
        payload({
          totalAmount: 1,
          status: 'completed',
          tableName: 'Bàn giả',
          items: [
            {
              productId: coffee.id,
              quantity: 2,
              unitPrice: 1,
              price: 1,
              lineTotal: 2,
              productName: 'Món giả',
            },
          ],
        }),
      );
      const saved = await Order.findById(created.orderId);
      assert.equal(saved.items[0].unitPrice, 35000);
      assert.equal(saved.items[0].productName, 'Cà phê sữa');
      assert.equal(saved.items[0].lineTotal, 70000);
      assert.equal(saved.totalAmount, 70000);
      assert.equal(saved.status, 'pending');
      assert.equal(saved.tableName, 'Bàn 05');
    });
    it('lineTotal từng dòng và totalAmount của nhiều món tính đúng', async () => {
      const created = await create();
      const saved = await Order.findById(created.orderId);
      assert.deepEqual(
        saved.items.map((item) => item.lineTotal),
        [70000, 75000],
      );
      assert.equal(saved.totalAmount, 145000);
    });
    it('snapshot tên/giá không đổi khi sửa hoặc xóa món, sửa tên bàn', async () => {
      const created = await create();
      await Product.updateOne(
        { _id: coffee.id },
        { name: 'Tên mới', price: 99000 },
      );
      await Product.deleteOne({ _id: cake.id });
      await Table.updateOne({ _id: table.id }, { name: 'Tên bàn mới' });
      const response = await get(created.orderId, created.trackingToken);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.items[0].unitPrice, 35000);
      assert.equal(response.body.data.items[0].productName, 'Cà phê sữa');
      assert.equal(response.body.data.items[1].productName, 'Bánh ngọt');
      assert.equal(response.body.data.tableName, 'Bàn 05');
      assert.equal(response.body.data.totalAmount, 145000);
    });
    it('đơn mới pending và có lịch sử tạo không gắn tài khoản khách', async () => {
      const created = await create();
      const saved = await Order.findById(created.orderId);
      assert.equal(saved.status, 'pending');
      assert.equal(saved.statusHistory.length, 1);
      assert.equal(saved.statusHistory[0].status, 'pending');
      assert.equal(saved.statusHistory[0].changedBy, null);
      assert(saved.statusHistory[0].changedAt instanceof Date);
    });
    it('trackingToken đúng xem được, không lộ hash/nonce/requestId, no-store', async () => {
      const created = await create();
      const response = await get(created.orderId, created.trackingToken);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.orderId, created.orderId);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      for (const field of [
        'trackingToken',
        'trackingTokenHash',
        'trackingTokenNonce',
        'requestId',
        'requestIdHash',
        'requestPayloadHash',
      ]) {
        assert.equal(field in response.body.data, false);
      }
    });
    it('trackingToken sai không xem được đơn', async () => {
      const created = await create();
      const response = await get(
        created.orderId,
        randomBytes(32).toString('hex'),
      );
      assert.equal(response.status, 404);
      assert.equal(response.body.data, undefined);
    });
    it('thiếu trackingToken không xem được dù biết orderId', async () => {
      const created = await create();
      assert.equal((await get(created.orderId)).status, 404);
    });
    it('không nhận token trong query URL; token sai định dạng bị từ chối', async () => {
      const created = await create();
      assert.equal(
        (
          await request(
            `/public/orders/${created.orderId}?trackingToken=${created.trackingToken}`,
          )
        ).status,
        404,
      );
      for (const token of ['abc', 'null', 'a'.repeat(65)])
        assert.equal((await get(created.orderId, token)).status, 404);
      assert.equal((await get('invalid', created.trackingToken)).status, 404);
      assert.equal(
        (
          await get(
            new mongoose.Types.ObjectId().toString(),
            created.trackingToken,
          )
        ).status,
        404,
      );
    });
    it('token của đơn khác không mở được đơn này', async () => {
      const first = await create();
      const second = await create();
      assert.notEqual(first.trackingToken, second.trackingToken);
      assert.equal(
        (await get(first.orderId, second.trackingToken)).status,
        404,
      );
    });
    it('MongoDB chỉ lưu hash/nonce, không lưu token thật hoặc requestId thật', async () => {
      const body = payload();
      const created = await create(body);
      const raw = await Order.collection.findOne({
        _id: new mongoose.Types.ObjectId(created.orderId),
      });
      assert.equal(raw.trackingTokenHash, hashValue(created.trackingToken));
      assert.equal(raw.requestIdHash, hashValue(body.requestId));
      assert.equal(JSON.stringify(raw).includes(created.trackingToken), false);
      assert.equal(JSON.stringify(raw).includes(body.requestId), false);
      const normal = await Order.findById(created.orderId).lean();
      assert.equal(normal.trackingTokenHash, undefined);
      assert.equal(normal.trackingTokenNonce, undefined);
    });
    it('gửi lặp cùng requestId trả đúng đơn và cùng token, chỉ lưu một đơn', async () => {
      const body = payload();
      const first = await create(body);
      const retry = await post(body);
      assert.equal(retry.status, 200);
      assert.equal(retry.body.replayed, true);
      assert.deepEqual(retry.body.data, first);
      assert.equal(await Order.countDocuments({ tableId: table.id }), 1);
    });
    it('8 request đồng thời chỉ tạo một đơn, tất cả nhận cùng token hợp lệ', async () => {
      const body = payload();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => post(body)),
      );
      assert.equal(results.filter((result) => result.status === 201).length, 1);
      assert.equal(results.filter((result) => result.status === 200).length, 7);
      assert(
        results.every(
          (result) => result.body.data.orderId === results[0].body.data.orderId,
        ),
      );
      assert(
        results.every(
          (result) =>
            result.body.data.trackingToken ===
            results[0].body.data.trackingToken,
        ),
      );
      assert.equal(await Order.countDocuments({ tableId: table.id }), 1);
    });
    it('retry sau khi menu/bàn tắt vẫn lấy được đơn đã lưu và snapshot cũ', async () => {
      const body = payload();
      const created = await create(body);
      await Product.updateOne(
        { _id: coffee.id },
        { price: 1, isAvailable: false },
      );
      await Table.updateOne({ _id: table.id }, { isActive: false });
      const retry = await post(body);
      assert.equal(retry.status, 200);
      assert.deepEqual(retry.body.data, created);
      assert.equal(
        (await get(created.orderId, retry.body.data.trackingToken)).body.data
          .totalAmount,
        145000,
      );
    });
    it('cùng requestId nhưng đổi nội dung hoặc đổi bàn trả 409', async () => {
      const body = payload();
      await create(body);
      await rejects({ ...body, note: 'Nội dung khác' }, 409);
      await rejects({ ...body, qrToken: randomBytes(24).toString('hex') }, 409);
    });
    it('hai lần đặt thật cùng bàn có hai đơn/code/token riêng', async () => {
      const first = await create();
      const second = await create(
        payload({ items: [{ productId: cake.id, quantity: 1 }] }),
      );
      assert.notEqual(first.orderId, second.orderId);
      assert.notEqual(first.orderCode, second.orderCode);
      assert.notEqual(first.trackingToken, second.trackingToken);
      assert.equal(await Order.countDocuments({ tableId: table.id }), 2);
    });
    it('giỏ mới cùng nội dung nhưng requestId mới vẫn là lần đặt mới', async () => {
      const body = payload();
      const first = await create(body);
      const second = await create({
        ...body,
        requestId: randomBytes(32).toString('hex'),
      });
      assert.notEqual(first.orderId, second.orderId);
    });
    it('chặn tên/ghi chú/giỏ sai, object injection và thiếu requestId', async () => {
      for (const override of [
        { customerName: ' ' },
        { customerName: 'a'.repeat(101) },
        { customerName: { $ne: null } },
        { note: 'a'.repeat(1001) },
        { note: 123 },
        { items: [] },
        { items: {} },
        { items: [null] },
        {
          items: [{ productId: coffee.id, quantity: 1, note: 'a'.repeat(501) }],
        },
        { items: [{ productId: { $ne: null }, quantity: 1 }] },
        {
          items: [
            { productId: coffee.id, quantity: 1 },
            { productId: coffee.id, quantity: 1 },
          ],
        },
        { requestId: undefined },
        { requestId: 'guessable-key' },
      ])
        await rejects(payload(override));
      await rejects(payload({ qrToken: { $ne: null } }), 404);
    });
    it('chặn giỏ quá 50 dòng và tổng tiền vượt số nguyên an toàn', async () => {
      await rejects(
        payload({
          items: Array.from({ length: 51 }, () => ({
            productId: new mongoose.Types.ObjectId().toString(),
            quantity: 1,
          })),
        }),
      );
      await Product.updateOne(
        { _id: coffee.id },
        { price: Number.MAX_SAFE_INTEGER },
      );
      await rejects(payload());
    });
  },
);
