import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { before, beforeEach, after, describe, it } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

let localEnv = {};
try {
  localEnv = parseEnv(
    readFileSync(new URL('../.env', import.meta.url), 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const dbName = `restaurant_qr_workflow_test_${randomBytes(8).toString('hex')}`;
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
const { default: Table } = await import('../src/models/Table.js');
const { default: Category } = await import('../src/models/Category.js');
const { default: Product } = await import('../src/models/Product.js');
const { createInternalUser } = await import('../src/services/userService.js');
const { createAccessToken } = await import('../src/utils/token.js');
let server,
  url,
  staff,
  otherStaff,
  admin,
  staffToken,
  otherToken,
  adminToken,
  table,
  product,
  order;
const states = [
  'pending',
  'confirmed',
  'preparing',
  'served',
  'completed',
  'cancelled',
];
const mainFlow = ['pending', 'confirmed', 'preparing', 'served', 'completed'];

async function request(
  path,
  { method = 'GET', body, token = staffToken, trackingToken } = {},
) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(trackingToken ? { 'X-Order-Token': trackingToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
async function create(targetTable = table) {
  const response = await request('/public/orders', {
    method: 'POST',
    token: null,
    body: {
      requestId: randomBytes(32).toString('hex'),
      qrToken: targetTable.qrToken,
      customerName: 'Khách xử lý đơn',
      items: [{ productId: product.id, quantity: 2, note: 'Ít đá' }],
      note: 'Mang nước trước',
    },
  });
  assert.equal(response.status, 201, response.body.message);
  return response.body.data;
}
const update = (id, expectedStatus, status, token = staffToken) =>
  request(`/orders/${id}/status`, {
    method: 'PATCH',
    token,
    body: { expectedStatus, status },
  });
const cancel = (
  id,
  expectedStatus,
  cancelReason = 'Khách đổi ý',
  token = staffToken,
) =>
  request(`/orders/${id}/cancel`, {
    method: 'PATCH',
    token,
    body: { expectedStatus, cancelReason },
  });
async function reach(id, state) {
  if (state === 'cancelled') {
    assert.equal((await cancel(id, 'pending')).status, 200);
    return;
  }
  for (let i = 1; i <= mainFlow.indexOf(state); i += 1) {
    const result = await update(id, mainFlow[i - 1], mainFlow[i]);
    assert.equal(result.status, 200, result.body.message);
  }
}
async function tableResult(id = table.id) {
  const response = await request('/tables');
  assert.equal(response.status, 200);
  return response.body.data.find((item) => item._id === id);
}
function noSecrets(data) {
  const text = JSON.stringify(data);
  for (const key of [
    'trackingToken',
    'trackingTokenHash',
    'trackingTokenNonce',
    'requestIdHash',
    'requestPayloadHash',
    'passwordHash',
  ])
    assert.equal(text.includes(`"${key}"`), false, key);
}

function noInternalActors(data) {
  const text = JSON.stringify(data);
  for (const key of ['changedBy', 'cancelledBy', 'username', 'fullName']) {
    assert.equal(text.includes(`"${key}"`), false, key);
  }
  for (const user of [staff, otherStaff, admin]) {
    assert.equal(text.includes(user.id), false, 'Không trả ID tài khoản nội bộ');
  }
  for (const entry of data.statusHistory) {
    assert.deepEqual(Object.keys(entry).sort(), ['changedAt', 'status']);
  }
}

describe(
  'Giai đoạn 6: nhân viên xử lý đơn và suy ra tình trạng bàn',
  { concurrency: false },
  () => {
    before(async () => {
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName,
        serverSelectionTimeoutMS: 5000,
      });
      await Order.init();
      const password = randomBytes(18).toString('base64url');
      staff = await createInternalUser({
        fullName: 'Nhân viên A',
        username: 'workflow_a',
        password,
        role: 'staff',
      });
      otherStaff = await createInternalUser({
        fullName: 'Nhân viên B',
        username: 'workflow_b',
        password,
        role: 'staff',
      });
      admin = await createInternalUser({
        fullName: 'Quản lý',
        username: 'workflow_admin',
        password,
        role: 'admin',
      });
      staffToken = createAccessToken(staff.id);
      otherToken = createAccessToken(otherStaff.id);
      adminToken = createAccessToken(admin.id);
      const category = await Category.create({ name: 'Cà phê' });
      product = await Product.create({
        name: 'Cà phê sữa',
        price: 35000,
        categoryId: category.id,
      });
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
      });
      url = `http://127.0.0.1:${server.address().port}/api`;
    });
    beforeEach(async () => {
      table = await Table.create({ name: 'Bàn kiểm thử', capacity: 4 });
      order = await create();
    });
    after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (mongoose.connection.name === dbName)
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    it('staff và admin đọc danh sách/chi tiết/bàn bằng JWT, không lộ dữ liệu bí mật', async () => {
      for (const token of [staffToken, adminToken]) {
        const list = await request(`/orders?tableId=${table.id}`, { token });
        assert.equal(list.status, 200);
        assert.equal(list.body.data.orders.length, 1);
        const detail = await request(`/orders/${order.orderId}`, { token });
        assert.equal(detail.status, 200);
        noSecrets(detail.body.data);
        noSecrets(list.body.data);
        assert.deepEqual(detail.body.data.allowedTransitions, [
          'confirmed',
          'cancelled',
        ]);
        assert.equal(detail.body.data.items[0].note, 'Ít đá');
        assert.equal(detail.body.data.totalAmount, 70000);
        assert.equal(detail.headers.get('cache-control'), 'no-store');
        assert.equal((await request('/tables', { token })).status, 200);
      }
    });
    it('mọi API nội bộ từ chối người chưa đăng nhập hoặc chỉ có token khách', async () => {
      const customerJWT = jwt.sign(
        { role: 'customer' },
        process.env.JWT_SECRET,
        {
          subject: new mongoose.Types.ObjectId().toString(),
          issuer: 'restaurant-qr-server',
          audience: 'restaurant-qr-internal',
          expiresIn: '2h',
        },
      );
      for (const token of [null, order.trackingToken, customerJWT]) {
        for (const [path, method, body] of [
          ['/orders', 'GET'],
          [`/orders/${order.orderId}`, 'GET'],
          ['/tables', 'GET'],
          [
            `/orders/${order.orderId}/status`,
            'PATCH',
            { expectedStatus: 'pending', status: 'confirmed' },
          ],
          [
            `/orders/${order.orderId}/cancel`,
            'PATCH',
            { expectedStatus: 'pending', cancelReason: 'Thử' },
          ],
        ])
          assert.equal(
            (
              await request(path, {
                method,
                body,
                token,
                trackingToken: order.trackingToken,
              })
            ).status,
            401,
          );
      }
      assert.equal((await Order.findById(order.orderId)).status, 'pending');
    });

    // Đối chiếu tất cả cặp trạng thái với 4 bước duy nhất của luồng chính.
    for (const from of states) {
      for (const to of states.filter((state) => state !== 'cancelled')) {
        const valid =
          mainFlow.indexOf(from) >= 0 &&
          mainFlow.indexOf(from) < 4 &&
          mainFlow[mainFlow.indexOf(from) + 1] === to;
        it(`${from} → ${to}: ${valid ? 'thành công' : 'từ chối và giữ nguyên dữ liệu'}`, async () => {
          await reach(order.orderId, from);
          const before = await Order.findById(order.orderId).lean();
          const response = await update(order.orderId, from, to);
          assert.equal(response.status, valid ? 200 : 400);
          const after = await Order.findById(order.orderId).lean();
          if (!valid) assert.deepEqual(after, before);
          else {
            assert.equal(after.status, to);
            assert.equal(
              after.statusHistory.length,
              before.statusHistory.length + 1,
            );
            assert.equal(
              after.statusHistory.at(-1).changedBy.toString(),
              staff.id,
            );
            assert.equal(after.statusHistory.at(-1).status, to);
            assert.equal(after.totalAmount, 70000);
            if (to === 'completed') {
              assert(after.paidAt instanceof Date);
              assert.equal(
                after.paidAt.getTime(),
                after.statusHistory.at(-1).changedAt.getTime(),
              );
            } else assert.equal(after.paidAt, null);
          }
        });
      }
    }
    for (const from of states) {
      it(`hủy từ ${from}: ${['pending', 'confirmed'].includes(from) ? 'được phép' : 'bị từ chối'}`, async () => {
        await reach(order.orderId, from);
        const before = await Order.findById(order.orderId).lean();
        const response = await cancel(
          order.orderId,
          from,
          '  Khách không dùng nữa  ',
          adminToken,
        );
        const after = await Order.findById(order.orderId).lean();
        if (['pending', 'confirmed'].includes(from)) {
          assert.equal(response.status, 200);
          assert.equal(after.status, 'cancelled');
          assert.equal(after.cancelReason, 'Khách không dùng nữa');
          assert.equal(after.cancelledBy.toString(), admin.id);
          assert(after.cancelledAt instanceof Date);
          assert.equal(
            after.cancelledAt.getTime(),
            after.statusHistory.at(-1).changedAt.getTime(),
          );
          assert.equal(
            after.statusHistory.at(-1).changedBy.toString(),
            admin.id,
          );
          assert.equal(after.paidAt, null);
          assert.deepEqual(after.items, before.items);
          assert.equal(response.body.data.cancelledBy.fullName, admin.fullName);
          assert.equal(
            (await request(`/orders?status=cancelled&tableId=${table.id}`)).body
              .data.orders.length,
            1,
          );
        } else {
          assert.equal(response.status, 400);
          assert.deepEqual(after, before);
        }
      });
    }
    it('hủy lưu staff thực hiện; status API không được dùng để bỏ qua lý do', async () => {
      assert.equal(
        (await update(order.orderId, 'pending', 'cancelled')).status,
        400,
      );
      assert.equal((await cancel(order.orderId, 'pending')).status, 200);
      assert.equal(
        (await Order.findById(order.orderId)).cancelledBy.toString(),
        staff.id,
      );
    });
    it('lý do hủy bắt buộc, đúng kiểu, không quá 1000; trạng thái nguồn bắt buộc', async () => {
      for (const cancelReason of [
        '',
        ' ',
        undefined,
        null,
        {},
        1,
        'a'.repeat(1001),
      ]) {
        assert.equal(
          (
            await cancel(
              order.orderId,
              'pending',
              cancelReason === undefined ? '' : cancelReason,
            )
          ).status,
          400,
        );
      }
      assert.equal(
        (
          await request(`/orders/${order.orderId}/cancel`, {
            method: 'PATCH',
            body: { expectedStatus: 'pending' },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(`/orders/${order.orderId}/status`, {
            method: 'PATCH',
            body: { status: 'confirmed' },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(`/orders/${order.orderId}/cancel`, {
            method: 'PATCH',
            body: { cancelReason: 'Thử' },
          })
        ).status,
        400,
      );
      assert.equal(
        (await Order.findById(order.orderId)).statusHistory.length,
        1,
      );
    });
    it('không nhận người thực hiện, paidAt, tiền, lịch sử tự khai từ frontend', async () => {
      for (const extra of [
        { changedBy: admin.id },
        { paidAt: '2020-01-01' },
        { totalAmount: 1 },
        { statusHistory: [] },
      ]) {
        assert.equal(
          (
            await request(`/orders/${order.orderId}/status`, {
              method: 'PATCH',
              body: {
                expectedStatus: 'pending',
                status: 'confirmed',
                ...extra,
              },
            })
          ).status,
          400,
        );
      }
      assert.equal(
        (
          await request(`/orders/${order.orderId}/cancel`, {
            method: 'PATCH',
            body: {
              expectedStatus: 'pending',
              cancelReason: 'Thử',
              cancelledBy: admin.id,
            },
          })
        ).status,
        400,
      );
      assert.equal((await Order.findById(order.orderId)).status, 'pending');
    });
    it('statusHistory ghi đúng thứ tự, thời gian và người xử lý qua toàn bộ luồng', async () => {
      for (let i = 1; i < mainFlow.length; i += 1)
        assert.equal(
          (
            await update(
              order.orderId,
              mainFlow[i - 1],
              mainFlow[i],
              i % 2 ? staffToken : otherToken,
            )
          ).status,
          200,
        );
      const saved = await Order.findById(order.orderId);
      assert.deepEqual(
        saved.statusHistory.map((entry) => entry.status),
        mainFlow,
      );
      assert.deepEqual(
        saved.statusHistory.map((entry) => entry.changedBy?.toString() || null),
        [null, staff.id, otherStaff.id, staff.id, otherStaff.id],
      );
      assert(
        saved.statusHistory.every(
          (entry, index, all) =>
            index === 0 || entry.changedAt >= all[index - 1].changedAt,
        ),
      );
      const detail = await request(`/orders/${order.orderId}`);
      assert.equal(
        detail.body.data.statusHistory[1].changedBy.fullName,
        staff.fullName,
      );
    });

    for (const state of states) {
      it(`bàn suy ra đúng từ đơn ${state}, không lưu occupancy/status vào Table`, async () => {
        await reach(order.orderId, state);
        const result = await tableResult();
        const active = !['completed', 'cancelled'].includes(state);
        assert.equal(result.occupancy, active ? 'occupied' : 'empty');
        assert.equal(result.activeOrderCount, active ? 1 : 0);
        const raw = await Table.collection.findOne({ _id: table._id });
        assert.equal('status' in raw, false);
        assert.equal('occupancy' in raw, false);
        assert.equal('activeOrderCount' in raw, false);
      });
    }
    it('bàn chưa có đơn là trống; staff không được cấp qrToken', async () => {
      const empty = await Table.create({ name: 'Bàn trống', capacity: 2 });
      assert.equal((await tableResult(empty.id)).occupancy, 'empty');
      assert.equal((await tableResult()).qrToken, undefined);
      const adminTables = await request('/tables', { token: adminToken });
      assert.equal(
        adminTables.body.data.find((item) => item._id === table.id).qrToken,
        table.qrToken,
      );
    });
    it('nhiều đơn: hoàn thành một đơn không làm bàn trống hoặc thanh toán đơn khác', async () => {
      const second = await create();
      const third = await create();
      assert.equal((await tableResult()).activeOrderCount, 3);
      await reach(order.orderId, 'completed');
      await reach(second.orderId, 'preparing');
      assert.equal((await tableResult()).activeOrderCount, 2);
      assert.equal((await Order.findById(second.orderId)).paidAt, null);
      await cancel(third.orderId, 'pending');
      assert.equal((await tableResult()).occupancy, 'occupied');
      assert.equal((await tableResult()).activeOrderCount, 1);
      await update(second.orderId, 'preparing', 'served');
      await update(second.orderId, 'served', 'completed');
      assert.equal((await tableResult()).occupancy, 'empty');
      assert.equal((await tableResult()).activeOrderCount, 0);
    });
    it('bàn tắt vẫn phản ánh đơn tồn đọng và vẫn xử lý đơn cũ được', async () => {
      await Table.updateOne({ _id: table.id }, { isActive: false });
      assert.equal((await tableResult()).occupancy, 'occupied');
      await cancel(order.orderId, 'pending');
      assert.equal((await tableResult()).occupancy, 'empty');
    });
    it('staff không quản lý danh mục/món, không tạo/sửa bàn hoặc lấy QR', async () => {
      for (const [path, method, body] of [
        ['/categories', 'GET'],
        ['/categories', 'POST', { name: 'Sai quyền' }],
        [`/categories/${product.categoryId}`, 'PATCH', { isActive: false }],
        ['/products', 'GET'],
        ['/products', 'POST', { name: 'Sai quyền' }],
        [`/products/${product.id}`, 'PATCH', { price: 1 }],
        ['/tables', 'POST', { name: 'Sai quyền', capacity: 1 }],
        [`/tables/${table.id}`, 'PATCH', { isActive: false }],
        [`/tables/${table.id}/qr`, 'GET'],
      ])
        assert.equal((await request(path, { method, body })).status, 403);
      assert.equal((await Table.findById(table.id)).isActive, true);
      assert.equal((await Product.findById(product.id)).price, 35000);
    });
    it('admin vẫn tạo/sửa bàn và xử lý đơn', async () => {
      assert.equal(
        (
          await request('/tables', {
            method: 'POST',
            token: adminToken,
            body: { name: 'Bàn admin', capacity: 2 },
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await request(`/tables/${table.id}`, {
            method: 'PATCH',
            token: adminToken,
            body: { name: 'Tên mới' },
          })
        ).status,
        200,
      );
      assert.equal(
        (await update(order.orderId, 'pending', 'confirmed', adminToken))
          .status,
        200,
      );
    });
    it('hai nhân viên xác nhận đồng thời: đúng một 200, một 409, lịch sử chỉ thêm một', async () => {
      const responses = await Promise.all([
        update(order.orderId, 'pending', 'confirmed'),
        update(order.orderId, 'pending', 'confirmed', otherToken),
      ]);
      assert.deepEqual(
        responses.map((response) => response.status).sort(),
        [200, 409],
      );
      const saved = await Order.findById(order.orderId);
      assert.equal(saved.status, 'confirmed');
      assert.equal(saved.statusHistory.length, 2);
      assert.equal(
        saved.statusHistory[1].changedBy.toString(),
        responses[0].status === 200 ? staff.id : otherStaff.id,
      );
    });
    it('request cũ bị từ chối kể cả đích mới hợp lệ với trạng thái hiện tại', async () => {
      await update(order.orderId, 'pending', 'confirmed');
      const result = await update(
        order.orderId,
        'pending',
        'preparing',
        otherToken,
      );
      assert.equal(result.status, 409);
      assert.equal((await Order.findById(order.orderId)).status, 'confirmed');
      assert.equal(
        (await cancel(order.orderId, 'pending', 'Đọc màn hình cũ', otherToken))
          .status,
        409,
      );
    });
    it('bắt đầu chuẩn bị và hủy đồng thời không ghi nửa trạng thái/nửa thông tin hủy', async () => {
      await reach(order.orderId, 'confirmed');
      const responses = await Promise.all([
        update(order.orderId, 'confirmed', 'preparing'),
        cancel(order.orderId, 'confirmed', 'Hủy đồng thời', otherToken),
      ]);
      assert.deepEqual(
        responses.map((response) => response.status).sort(),
        [200, 409],
      );
      const saved = await Order.findById(order.orderId);
      assert.equal(saved.statusHistory.length, 3);
      assert.equal(saved.statusHistory.at(-1).status, saved.status);
      if (saved.status === 'preparing') {
        assert.equal(saved.cancelledAt, null);
        assert.equal(saved.cancelledBy, null);
        assert.equal(saved.cancelReason, '');
      } else {
        assert.equal(saved.status, 'cancelled');
        assert.equal(saved.cancelledBy.toString(), otherStaff.id);
        assert(saved.cancelledAt);
      }
    });
    it('hai lần xác nhận thanh toán không ghi đè paidAt/lịch sử', async () => {
      await reach(order.orderId, 'served');
      const responses = await Promise.all([
        update(order.orderId, 'served', 'completed'),
        update(order.orderId, 'served', 'completed', otherToken),
      ]);
      assert.deepEqual(
        responses.map((response) => response.status).sort(),
        [200, 409],
      );
      const saved = await Order.findById(order.orderId).lean();
      assert.equal(saved.statusHistory.length, 5);
      assert.equal(
        (await update(order.orderId, 'served', 'completed')).status,
        409,
      );
      assert.deepEqual(await Order.findById(order.orderId).lean(), saved);
    });
    it('phân trang, giới hạn mặc định, thứ tự mới nhất và trang ngoài dữ liệu', async () => {
      for (let i = 0; i < 5; i += 1) await create();
      const first = await request(`/orders?tableId=${table.id}&limit=2&page=1`);
      const second = await request(
        `/orders?tableId=${table.id}&limit=2&page=2`,
      );
      assert.deepEqual(first.body.data.pagination, {
        page: 1,
        limit: 2,
        total: 6,
        totalPages: 3,
      });
      assert.equal(second.body.data.orders.length, 2);
      assert(
        !first.body.data.orders.some((item) =>
          second.body.data.orders.some((other) => item._id === other._id),
        ),
      );
      assert(
        first.body.data.orders[0].createdAt >=
          first.body.data.orders[1].createdAt,
      );
      assert.equal(
        (await request(`/orders?tableId=${table.id}&page=9`)).body.data.orders
          .length,
        0,
      );
      const defaults = await request('/orders');
      assert.equal(defaults.body.data.pagination.limit, 20);
      assert(defaults.body.data.orders.length <= 20);
    });
    it('lọc từng trạng thái và nhóm active kết hợp bàn', async () => {
      await reach(order.orderId, 'completed');
      const second = await create();
      await reach(second.orderId, 'confirmed');
      const third = await create();
      await cancel(third.orderId, 'pending');
      const confirmed = await request(
        `/orders?tableId=${table.id}&status=confirmed`,
      );
      assert.deepEqual(
        confirmed.body.data.orders.map((item) => item._id),
        [second.orderId],
      );
      const active = await request(`/orders?tableId=${table.id}&status=active`);
      assert.deepEqual(
        active.body.data.orders.map((item) => item._id),
        [second.orderId],
      );
      const completed = await request(
        `/orders?tableId=${table.id}&status=completed`,
      );
      assert.deepEqual(
        completed.body.data.orders.map((item) => item._id),
        [order.orderId],
      );
    });
    it('lọc ngày theo múi giờ Việt Nam và tìm phần đầu orderCode', async () => {
      const second = await create();
      const third = await create();
      await Order.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(order.orderId) },
        { $set: { createdAt: new Date('2026-09-16T17:00:00Z') } },
      );
      await Order.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(second.orderId) },
        { $set: { createdAt: new Date('2026-09-17T16:59:59.999Z') } },
      );
      await Order.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(third.orderId) },
        { $set: { createdAt: new Date('2026-09-17T17:00:00Z') } },
      );
      const result = await request(
        `/orders?tableId=${table.id}&date=2026-09-17`,
      );
      assert.equal(result.body.data.pagination.total, 2);
      assert.deepEqual(
        result.body.data.orders.map((item) => item._id),
        [second.orderId, order.orderId],
      );
      assert.equal(
        (await request(`/orders?orderCode=${order.orderCode.toLowerCase()}`))
          .body.data.orders[0]._id,
        order.orderId,
      );
    });
    it('lọc/phân trang sai, ID sai và ID không có trả lỗi rõ ràng', async () => {
      for (const query of [
        'page=0',
        'page=-1',
        'page=1.5',
        'page=abc',
        'limit=51',
        'limit=0',
        'status=unknown',
        'tableId=bad',
        'date=2026-02-30',
        'date=abc',
        'orderCode=.*',
        'status=pending&status=served',
        'sort=hack',
      ]) {
        assert.equal((await request(`/orders?${query}`)).status, 400, query);
      }
      for (const suffix of ['', '/status', '/cancel']) {
        const options = suffix
          ? {
              method: 'PATCH',
              body:
                suffix === '/status'
                  ? { expectedStatus: 'pending', status: 'confirmed' }
                  : { expectedStatus: 'pending', cancelReason: 'Thử' },
            }
          : {};
        assert.equal(
          (await request(`/orders/bad${suffix}`, options)).status,
          400,
        );
        assert.equal(
          (
            await request(
              `/orders/${new mongoose.Types.ObjectId()}${suffix}`,
              options,
            )
          ).status,
          404,
        );
      }
    });
    it('public history chỉ trả trạng thái và thời gian, không trả changedBy của nhân viên', async () => {
      await reach(order.orderId, 'confirmed');
      const saved = await Order.findById(order.orderId);
      assert.equal(saved.statusHistory[1].changedBy.toString(), staff.id);
      const response = await request(`/public/orders/${order.orderId}`, {
        token: null,
        trackingToken: order.trackingToken,
      });
      assert.equal(response.status, 200);
      noInternalActors(response.body.data);
      assert.deepEqual(response.body.data.statusHistory, [
        { status: 'pending', changedAt: saved.statusHistory[0].changedAt.toISOString() },
        { status: 'confirmed', changedAt: saved.statusHistory[1].changedAt.toISOString() },
      ]);
    });

    it('public đơn hủy giữ lý do/thời gian, không lộ người hủy và không sửa dữ liệu MongoDB', async () => {
      await reach(order.orderId, 'confirmed');
      assert.equal(
        (await cancel(order.orderId, 'confirmed', 'Khách đổi ý', adminToken)).status,
        200,
      );
      const id = new mongoose.Types.ObjectId(order.orderId);
      const beforeRead = await Order.collection.findOne({ _id: id });
      assert.equal(beforeRead.cancelledBy.toString(), admin.id);
      const response = await request(`/public/orders/${order.orderId}`, {
        token: null,
        trackingToken: order.trackingToken,
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.data.status, 'cancelled');
      assert.equal(response.body.data.cancelReason, 'Khách đổi ý');
      assert.equal(response.body.data.cancelledAt, beforeRead.cancelledAt.toISOString());
      noInternalActors(response.body.data);
      noSecrets(response.body.data);
      assert.deepEqual(await Order.collection.findOne({ _id: id }), beforeRead);
    });

    it('staff và admin vẫn đọc được người xác nhận và người hủy trong API nội bộ', async () => {
      await reach(order.orderId, 'confirmed');
      assert.equal(
        (await cancel(order.orderId, 'confirmed', 'Khách đổi ý', adminToken)).status,
        200,
      );
      for (const token of [staffToken, adminToken]) {
        const response = await request(`/orders/${order.orderId}`, { token });
        assert.equal(response.status, 200);
        const data = response.body.data;
        assert.deepEqual(data.statusHistory[1].changedBy, {
          _id: staff.id, fullName: staff.fullName, username: staff.username,
        });
        assert.deepEqual(data.statusHistory[2].changedBy, {
          _id: admin.id, fullName: admin.fullName, username: admin.username,
        });
        assert.deepEqual(data.cancelledBy, data.statusHistory[2].changedBy);
        noSecrets(data);
      }
    });

    it('thu hẹp public history vẫn yêu cầu trackingToken đúng sau khi staff xử lý', async () => {
      await reach(order.orderId, 'preparing');
      const otherOrder = await create();
      const valid = await request(`/public/orders/${order.orderId}`, {
        token: null,
        trackingToken: order.trackingToken,
      });
      assert.equal(valid.status, 200);
      assert.equal(valid.body.data.status, 'preparing');
      for (const trackingToken of [undefined, 'invalid', randomBytes(32).toString('hex'), otherOrder.trackingToken]) {
        const denied = await request(`/public/orders/${order.orderId}`, {
          token: null, trackingToken,
        });
        assert.equal(denied.status, 404);
        assert.equal(denied.body.data, undefined);
      }
    });

    it('khách làm mới bằng trackingToken vẫn thấy trạng thái, thanh toán và thông tin hủy', async () => {
      await reach(order.orderId, 'completed');
      const response = await request(`/public/orders/${order.orderId}`, {
        token: null,
        trackingToken: order.trackingToken,
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.data.status, 'completed');
      assert(response.body.data.paidAt);
      noSecrets(response.body.data);
      const second = await create();
      await cancel(second.orderId, 'pending', 'Lý do cho khách');
      const cancelled = await request(`/public/orders/${second.orderId}`, {
        token: null,
        trackingToken: second.trackingToken,
      });
      assert.equal(cancelled.body.data.cancelReason, 'Lý do cho khách');
      assert(cancelled.body.data.cancelledAt);
      assert.equal('cancelledBy' in cancelled.body.data, false);
      assert.equal(
        (
          await request(`/public/orders/${order.orderId}`, {
            token: adminToken,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await request(`/public/orders/${order.orderId}`, {
            token: null,
            trackingToken: second.trackingToken,
          })
        ).status,
        404,
      );
    });
  },
);
