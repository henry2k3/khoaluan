import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createServer } from 'node:http';
import {
  before,
  beforeEach,
  afterEach,
  after,
  describe,
  it,
  mock,
} from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io as connect } from 'socket.io-client';

let localEnv = {};
try {
  localEnv = parseEnv(
    readFileSync(new URL('../.env', import.meta.url), 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.ORDER_TOKEN_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_ORIGIN = 'http://localhost:5174';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ||
  localEnv.MONGODB_URI ||
  'mongodb://127.0.0.1:27017';
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Order } = await import('../src/models/Order.js');
const { default: Category } = await import('../src/models/Category.js');
const { default: Product } = await import('../src/models/Product.js');
const { default: Table } = await import('../src/models/Table.js');
const { createInternalUser } = await import('../src/services/userService.js');
const { createAccessToken } = await import('../src/utils/token.js');
const { initializeRealtime } = await import('../src/sockets/realtimeServer.js');
const dbName = `restaurant_qr_realtime_test_${randomBytes(8).toString('hex')}`;
let server,
  realtime,
  url,
  staff,
  admin,
  staffToken,
  adminToken,
  product,
  table,
  order;
let clients = [];
const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await pause(20);
  }
  assert.fail('Chờ điều kiện realtime quá thời hạn');
}
async function request(path, method = 'GET', body, token = staffToken) {
  const response = await fetch(`${url}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
function newBody() {
  return {
    requestId: randomBytes(32).toString('hex'),
    qrToken: table.qrToken,
    customerName: 'Khách realtime',
    items: [{ productId: product.id, quantity: 2 }],
    note: 'Ghi chú',
  };
}
async function create(body = newBody()) {
  const result = await request('/public/orders', 'POST', body, null);
  assert([200, 201].includes(result.status));
  return result.body.data;
}
function newClient(auth = {}, options = {}) {
  const client = connect(url, {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    auth,
    ...options,
  });
  client.events = [];
  client.onAny((event, payload) => client.events.push({ event, payload }));
  clients.push(client);
  return client;
}
async function connected(auth = {}, options = {}) {
  const client = newClient(auth, options);
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
    client.connect();
  });
  return client;
}
async function rejected(auth) {
  const client = newClient(auth);
  const error = await new Promise((resolve, reject) => {
    client.once('connect', () => reject(new Error('Không được kết nối')));
    client.once('connect_error', resolve);
    client.connect();
  });
  assert.equal(error.data.code, 'UNAUTHORIZED');
  return client;
}
const ack = (client, event, data = {}) =>
  client.timeout(2000).emitWithAck(event, data);
const join = (client, target = order, token = target.trackingToken) =>
  ack(client, 'order:join', { orderId: target.orderId, trackingToken: token });
const events = (client, event) =>
  client.events.filter((item) => item.event === event);
const update = (from, to, id = order.orderId) =>
  request(`/orders/${id}/status`, 'PATCH', {
    expectedStatus: from,
    status: to,
  });
async function reach(status) {
  const flow = ['pending', 'confirmed', 'preparing', 'served', 'completed'];
  for (let index = 1; index <= flow.indexOf(status); index += 1)
    assert.equal((await update(flow[index - 1], flow[index])).status, 200);
}
const forbiddenFields = [
  'trackingToken',
  'trackingTokenHash',
  'trackingTokenNonce',
  'requestId',
  'requestIdHash',
  'passwordHash',
  'jwtSecret',
  'cancelledBy',
  'customerName',
  'items',
];
function safe(payload) {
  for (const field of forbiddenFields)
    assert.equal(JSON.stringify(payload).includes(`"${field}"`), false, field);
}

describe(
  'Giai đoạn 7: Socket.IO trên HTTP server thật và MongoDB thật',
  { concurrency: false, timeout: 30000 },
  () => {
    before(async () => {
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName,
        serverSelectionTimeoutMS: 5000,
      });
      await Order.init();
      const password = randomBytes(20).toString('hex');
      staff = await createInternalUser({
        username: 'socket_staff',
        fullName: 'Nhân viên realtime',
        password,
        role: 'staff',
      });
      admin = await createInternalUser({
        username: 'socket_admin',
        fullName: 'Quản lý realtime',
        password,
        role: 'admin',
      });
      staffToken = createAccessToken(staff.id);
      adminToken = createAccessToken(admin.id);
      const category = await Category.create({ name: 'Danh mục realtime' });
      product = await Product.create({
        name: 'Cà phê',
        price: 35000,
        categoryId: category.id,
      });
      server = createServer(app);
      realtime = initializeRealtime(server, { authCheckIntervalMs: 50 });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      url = `http://127.0.0.1:${server.address().port}`;
    });
    beforeEach(async () => {
      clients = [];
      table = await Table.create({ name: 'Bàn realtime', capacity: 4 });
      order = await create();
    });
    afterEach(async () => {
      mock.restoreAll();
      for (const client of clients) client.disconnect();
      await User.updateOne({ _id: staff._id }, { isActive: true });
    });
    after(async () => {
      await realtime?.close();
      if (mongoose.connection.name === dbName)
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    for (const role of ['staff', 'admin'])
      it(`${role} JWT hợp lệ được server join staff và user room, ACK xác nhận`, async () => {
        const user = role === 'staff' ? staff : admin;
        const client = await connected({
          token: role === 'staff' ? staffToken : adminToken,
        });
        assert.deepEqual(await ack(client, 'session:ready'), {
          ok: true,
          mode: 'staff',
        });
        const rooms = realtime.io.sockets.sockets.get(client.id).rooms;
        assert(rooms.has('staff'));
        assert(rooms.has(`user:${user.id}`));
      });
    it('không JWT kết nối như khách, không tự xin staff được và không nhận broadcast nội bộ', async () => {
      const guest = await connected({ role: 'admin', room: 'staff' });
      assert.deepEqual(await ack(guest, 'session:ready'), {
        ok: true,
        mode: 'guest',
      });
      guest.emit('join', 'staff');
      guest.emit('staff:join');
      await create();
      await pause();
      assert(!realtime.io.sockets.sockets.get(guest.id).rooms.has('staff'));
      assert.equal(guest.events.length, 0);
    });
    it('JWT sai hoặc sai kiểu bị từ chối, không tự hạ thành khách', async () => {
      for (const token of ['invalid', 42, { role: 'staff' }])
        await rejected({ token });
    });
    it('JWT hết hạn bị từ chối', async () => {
      const token = jwt.sign({}, process.env.JWT_SECRET, {
        subject: staff.id,
        algorithm: 'HS256',
        issuer: 'restaurant-qr-server',
        audience: 'restaurant-qr-internal',
        expiresIn: -1,
      });
      await rejected({ token });
    });
    it('tài khoản bị khóa không kết nối nội bộ được', async () => {
      await User.updateOne({ _id: staff.id }, { isActive: false });
      await rejected({ token: staffToken });
    });
    it('JWT trong query không cấp quyền staff', async () => {
      const guest = await connected({}, { query: { token: staffToken } });
      assert.equal((await ack(guest, 'session:ready')).mode, 'guest');
      assert(!realtime.io.sockets.sockets.get(guest.id).rooms.has('staff'));
    });
    it('khách token đúng join đúng order room mà không cần JWT', async () => {
      const guest = await connected();
      assert.deepEqual(await join(guest), { ok: true, orderId: order.orderId });
      assert(
        realtime.io.sockets.sockets
          .get(guest.id)
          .rooms.has(`order:${order.orderId}`),
      );
    });
    it('token sai, thiếu, ID sai định dạng/không tồn tại đều cùng lỗi, server tiếp tục chạy', async () => {
      const guest = await connected();
      const bodies = [
        {
          orderId: order.orderId,
          trackingToken: randomBytes(32).toString('hex'),
        },
        { orderId: order.orderId },
        {},
        null,
        { orderId: 'khong-phai-id', trackingToken: order.trackingToken },
        { orderId: { $ne: null }, trackingToken: order.trackingToken },
        {
          orderId: new mongoose.Types.ObjectId().toString(),
          trackingToken: order.trackingToken,
        },
      ];
      let expected;
      for (const body of bodies) {
        const result = await ack(guest, 'order:join', body);
        assert.equal(result.ok, false);
        if (!expected) expected = result;
        assert.deepEqual(result, expected);
      }
      assert.equal((await join(guest)).ok, true);
    });
    it('token đơn A không join đơn B, chuyển đơn hợp lệ thì rời room cũ', async () => {
      const guest = await connected();
      const second = await create();
      assert.equal((await join(guest, second, order.trackingToken)).ok, false);
      await join(guest);
      await join(guest, second);
      const rooms = realtime.io.sockets.sockets.get(guest.id).rooms;
      assert(!rooms.has(`order:${order.orderId}`));
      assert(rooms.has(`order:${second.orderId}`));
    });
    it('tạo đơn phát order:created cho staff/admin và table:updated sau khi đã lưu', async () => {
      const employee = await connected({ token: staffToken });
      const manager = await connected({ token: adminToken });
      const created = await create();
      await until(
        () =>
          events(employee, 'order:created').length &&
          events(manager, 'order:created').length,
      );
      assert(await Order.exists({ _id: created.orderId }));
      for (const client of [employee, manager]) {
        assert.equal(events(client, 'order:created').length, 1);
        assert.deepEqual(events(client, 'order:created')[0].payload, {
          orderId: created.orderId,
          orderCode: created.orderCode,
          tableId: table.id,
          tableName: table.name,
        });
        assert.deepEqual(events(client, 'table:updated')[0].payload, {
          tableId: table.id,
        });
        safe(client.events);
      }
    });
    it('tạo đơn lỗi kiểm tra đầu vào không phát event', async () => {
      const employee = await connected({ token: staffToken });
      const body = newBody();
      body.items[0].quantity = 0;
      assert.equal(
        (await request('/public/orders', 'POST', body, null)).status,
        400,
      );
      await pause();
      assert.equal(employee.events.length, 0);
    });
    it('MongoDB ghi thất bại không phát event thành công', async () => {
      const employee = await connected({ token: staffToken });
      mock.method(Order, 'create', async () => {
        throw new Error('Giả lập lỗi ghi');
      });
      assert.equal(
        (await request('/public/orders', 'POST', newBody(), null)).status,
        500,
      );
      await pause();
      assert.equal(employee.events.length, 0);
    });
    it('đợi MongoDB lưu đơn xong mới phát order:created', async () => {
      const employee = await connected({ token: staffToken });
      const original = Order.create.bind(Order);
      let release,
        entered = false;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      mock.method(Order, 'create', async (...args) => {
        entered = true;
        await gate;
        return original(...args);
      });
      const pendingRequest = create();
      try {
        await until(() => entered);
        await pause();
        assert.equal(
          employee.events.length,
          0,
          'Chưa ghi DB thì chưa có thông báo',
        );
      } finally {
        release();
      }
      const created = await pendingRequest;
      await until(() => events(employee, 'order:created').length === 1);
      assert(await Order.exists({ _id: created.orderId }));
    });
    it('đợi cập nhật MongoDB xong mới phát order:updated', async () => {
      const guest = await connected();
      await join(guest);
      const original = Order.findOneAndUpdate.bind(Order);
      let release,
        entered = false;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      mock.method(Order, 'findOneAndUpdate', (...args) => {
        const query = original(...args);
        const select = query.select.bind(query);
        query.select = async (...fields) => {
          entered = true;
          await gate;
          return select(...fields);
        };
        return query;
      });
      const pendingRequest = update('pending', 'confirmed');
      try {
        await until(() => entered);
        await pause();
        assert.equal(guest.events.length, 0);
        assert.equal((await Order.findById(order.orderId)).status, 'pending');
      } finally {
        release();
      }
      assert.equal((await pendingRequest).status, 200);
      await until(() => events(guest, 'order:updated').length === 1);
      assert.equal((await Order.findById(order.orderId)).status, 'confirmed');
    });
    it('requestId trùng trả đơn cũ và không phát order:created/table:updated lần hai', async () => {
      const employee = await connected({ token: staffToken });
      const body = newBody();
      const first = await create(body);
      await until(() => employee.events.length === 2);
      const replay = await request('/public/orders', 'POST', body, null);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.replayed, true);
      assert.equal(replay.body.data.orderId, first.orderId);
      await pause();
      assert.equal(employee.events.length, 2);
    });
    it('nhiều requestId trùng đồng thời chỉ có một thông báo tạo đơn', async () => {
      const employee = await connected({ token: staffToken });
      const body = newBody();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => create(body)),
      );
      assert.equal(new Set(results.map((result) => result.orderId)).size, 1);
      await pause();
      assert.equal(events(employee, 'order:created').length, 1);
    });
    for (const [from, to] of [
      ['pending', 'confirmed'],
      ['confirmed', 'preparing'],
      ['preparing', 'served'],
      ['served', 'completed'],
    ]) {
      it(`${to} phát cập nhật cho đúng khách và mọi staff, không lộ dữ liệu ra đơn khác`, async () => {
        await reach(from);
        const employee = await connected({ token: staffToken });
        const guest = await connected();
        await join(guest);
        const otherGuest = await connected();
        const second = await create();
        await join(otherGuest, second);
        employee.events = [];
        assert.equal((await update(from, to)).status, 200);
        await until(
          () =>
            events(guest, 'order:updated').length === 1 &&
            events(employee, 'order:updated').length === 1,
        );
        const payload = events(guest, 'order:updated')[0].payload;
        assert.deepEqual(Object.keys(payload).sort(), [
          'orderId',
          'status',
          'updatedAt',
        ]);
        assert.equal(payload.status, to);
        assert.equal(payload.orderId, order.orderId);
        assert.equal(
          payload.updatedAt,
          (await Order.findById(order.orderId)).updatedAt.toISOString(),
        );
        safe(payload);
        await pause();
        assert.equal(otherGuest.events.length, 0);
        assert.equal(
          events(employee, 'table:updated').length,
          to === 'completed' ? 1 : 0,
        );
      });
    }
    it('hủy phát order:cancelled/lý do cho đúng khách và staff, table:updated chỉ cho staff', async () => {
      const employee = await connected({ token: staffToken });
      const guest = await connected();
      await join(guest);
      const response = await request(
        `/orders/${order.orderId}/cancel`,
        'PATCH',
        { expectedStatus: 'pending', cancelReason: 'Khách đổi ý' },
      );
      assert.equal(response.status, 200);
      await until(() => events(guest, 'order:cancelled').length === 1);
      assert.deepEqual(Object.keys(guest.events[0].payload).sort(), [
        'cancelReason',
        'orderId',
        'status',
        'updatedAt',
      ]);
      assert.equal(guest.events[0].payload.cancelReason, 'Khách đổi ý');
      assert.equal(events(employee, 'order:cancelled').length, 1);
      assert.equal(events(employee, 'table:updated').length, 1);
      assert.equal(events(guest, 'table:updated').length, 0);
      safe(guest.events);
    });
    it('409/400 không phát event thành công giả và không nới lỏng trạng thái', async () => {
      await reach('confirmed');
      const employee = await connected({ token: staffToken });
      assert.equal((await update('pending', 'confirmed')).status, 409);
      assert.equal((await update('confirmed', 'completed')).status, 400);
      await pause();
      assert.equal(employee.events.length, 0);
    });
    it('emit lỗi không làm API tạo/cập nhật/hủy báo lỗi hoặc mất dữ liệu', async () => {
      mock.method(realtime.io, 'to', () => {
        throw new Error('Giả lập lỗi phát');
      });
      const created = await create();
      assert(await Order.exists({ _id: created.orderId }));
      assert.equal((await update('pending', 'confirmed')).status, 200);
      assert.equal(
        (
          await request(`/orders/${order.orderId}/cancel`, 'PATCH', {
            expectedStatus: 'confirmed',
            cancelReason: 'Hủy thử',
          })
        ).status,
        200,
      );
      assert.equal((await Order.findById(order.orderId)).status, 'cancelled');
    });
    it('socket client không tạo/đổi/hủy order được', async () => {
      const employee = await connected({ token: staffToken });
      const count = await Order.countDocuments();
      employee.emit('order:create', newBody());
      employee.emit('order:updated', {
        orderId: order.orderId,
        status: 'completed',
      });
      employee.emit('order:cancelled', { orderId: order.orderId });
      await pause();
      assert.equal(await Order.countDocuments(), count);
      assert.equal((await Order.findById(order.orderId)).status, 'pending');
    });
    it('khóa tài khoản đang online ngắt mọi socket của user, không ngắt admin khác', async () => {
      const first = await connected({ token: staffToken });
      const second = await connected({ token: staffToken });
      const manager = await connected({ token: adminToken });
      await User.updateOne({ _id: staff.id }, { isActive: false });
      await until(() => !first.connected && !second.connected);
      assert(manager.connected);
      await rejected({ token: staffToken });
    });
    it('API logout ngắt tất cả socket user, khách và tài khoản khác vẫn kết nối', async () => {
      const first = await connected({ token: staffToken });
      const second = await connected({ token: staffToken });
      const guest = await connected();
      const manager = await connected({ token: adminToken });
      assert.equal((await request('/auth/logout', 'POST', {})).status, 200);
      await until(() => !first.connected && !second.connected);
      assert(guest.connected);
      assert(manager.connected);
      assert.equal(
        (await request('/auth/logout', 'POST', {}, null)).status,
        401,
      );
    });
    it('JWT hết hạn khi đang online cũng bị ngắt', async () => {
      const token = jwt.sign({}, process.env.JWT_SECRET, {
        subject: staff.id,
        algorithm: 'HS256',
        issuer: 'restaurant-qr-server',
        audience: 'restaurant-qr-internal',
        expiresIn: 2,
      });
      const client = await connected({ token });
      await until(() => !client.connected);
    });
    it('reconnect tạo socket id mới, join lại room với ACK và nhận cập nhật tiếp', async () => {
      const guest = newClient(
        {},
        { reconnection: true, reconnectionDelay: 20 },
      );
      let joins = 0;
      guest.on('connect', async () => {
        if ((await join(guest)).ok) joins += 1;
      });
      guest.connect();
      await until(() => joins === 1);
      const oldId = guest.id;
      realtime.io.sockets.sockets.get(oldId).conn.close();
      await until(() => joins === 2 && guest.id !== oldId);
      await update('pending', 'confirmed');
      await until(() => events(guest, 'order:updated').length === 1);
    });
    it('CORS đúng frontend; Origin khác không mở được kết nối', async () => {
      const response = await fetch(
        `${url}/socket.io/?EIO=4&transport=polling`,
        { headers: { Origin: process.env.CLIENT_ORIGIN } },
      );
      assert.equal(
        response.headers.get('access-control-allow-origin'),
        process.env.CLIENT_ORIGIN,
      );
      assert.equal(response.status, 200);
      const denied = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
        headers: { Origin: 'https://other.example' },
      });
      assert.equal(denied.status, 403);
    });
  },
);
