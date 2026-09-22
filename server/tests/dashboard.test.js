import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { before, beforeEach, after, describe, it } from 'node:test';
import mongoose from 'mongoose';
import {
  dashboardNow as now,
  seedDashboardExample,
  fixtureOrder,
  snapshotItem,
  vnTime,
} from './dashboardFixture.js';

let local = {};
try {
  local = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.ORDER_TOKEN_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_ORIGIN = 'http://localhost:5174';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ||
  local.MONGODB_URI ||
  'mongodb://127.0.0.1:27017';
const dbName = `restaurant_qr_dashboard_test_${randomBytes(8).toString('hex')}`;
const { createApp } = await import('../src/app.js');
const { createAccessToken } = await import('../src/utils/token.js');
const { createInternalUser } = await import('../src/services/userService.js');
const {
  dashboardSummary,
  dashboardRevenue,
  dashboardProducts,
  dashboardRecentOrders,
  paidOrderFilter,
} = await import('../src/services/dashboardService.js');
const { dashboardRange } = await import('../src/utils/dashboardRange.js');
const { default: Order } = await import('../src/models/Order.js');
const { default: Table } = await import('../src/models/Table.js');
const { default: Product } = await import('../src/models/Product.js');
const { default: Category } = await import('../src/models/Category.js');
let server, url, adminToken, staffToken, fixture;
const today = { period: 'today' };
const yesterday = { from: '2026-09-16', to: '2026-09-16' };
const summary = (query = today) => dashboardSummary(query, now);
const products = (query = today) => dashboardProducts(query, now);
async function request(path, token = adminToken) {
  const response = await fetch(`${url}/api/dashboard/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

describe(
  'Giai đoạn 8: dashboard, giờ Việt Nam và snapshot',
  { concurrency: false },
  () => {
    before(async () => {
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName,
        serverSelectionTimeoutMS: 5000,
      });
      await Order.init();
      for (const role of ['admin', 'staff']) {
        const user = await createInternalUser({
          fullName: role,
          username: `dashboard_${role}`,
          password: randomBytes(18).toString('hex'),
          role,
        });
        if (role === 'admin') adminToken = createAccessToken(user._id);
        else staffToken = createAccessToken(user._id);
      }
      server = createApp({ dashboardClock: () => new Date(now) }).listen(
        0,
        '127.0.0.1',
      );
      await new Promise((resolve) => server.once('listening', resolve));
      url = `http://127.0.0.1:${server.address().port}`;
    });
    beforeEach(async () => {
      await Promise.all([
        Order.deleteMany({}),
        Table.deleteMany({}),
        Product.deleteMany({}),
        Category.deleteMany({}),
      ]);
      fixture = await seedDashboardExample();
    });
    after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (mongoose.connection.name === dbName)
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    for (const endpoint of [
      'summary',
      'revenue',
      'products',
      'recent-orders',
    ]) {
      it(`${endpoint}: admin được đọc, staff 403, khách 401, không cache hoặc lộ secret`, async () => {
        const result = await request(endpoint);
        assert.equal(result.status, 200);
        assert.equal(result.headers.get('cache-control'), 'no-store');
        assert.equal((await request(endpoint, staffToken)).status, 403);
        assert.equal((await request(endpoint, null)).status, 401);
        assert.equal(
          (await request(endpoint, randomBytes(32).toString('hex'))).status,
          401,
        );
        assert.doesNotMatch(
          JSON.stringify(result.body),
          /trackingToken|requestIdHash|requestPayloadHash|passwordHash/,
        );
      });
    }
    for (const status of [
      'pending',
      'confirmed',
      'preparing',
      'served',
      'cancelled',
    ]) {
      it(`${status} không tính tiền/món dù có paidAt`, async () => {
        await Order.updateMany(
          {},
          { $set: { status, paidAt: vnTime('2026-09-17T12:00:00') } },
        );
        assert.equal((await summary()).revenue, 0);
        assert.equal((await summary()).completedOrders, 0);
        assert.deepEqual((await products()).products, []);
      });
    }
    it('bộ A–E ra đúng toàn bộ số liệu tính tay ngày 17', async () => {
      const result = await summary();
      for (const [key, value] of Object.entries({
        revenue: 300000,
        totalOrders: 4,
        completedOrders: 2,
        cancelledOrders: 1,
        averageOrderValue: 150000,
        activeOrders: 2,
        activeTables: 1,
        emptyTables: 4,
        totalTables: 5,
      })) {
        assert.equal(result[key], value, key);
      }
      assert.deepEqual(
        (await products()).products.map(
          ({ productName, quantitySold, revenue }) => ({
            productName,
            quantitySold,
            revenue,
          }),
        ),
        [
          { productName: 'Cà phê sữa', quantitySold: 6, revenue: 150000 },
          { productName: 'Trà đào', quantitySold: 2, revenue: 100000 },
          { productName: 'Bạc xỉu', quantitySold: 1, revenue: 50000 },
        ],
      );
    });
    it('ngày 16: có 1 đơn tạo, không doanh thu hoặc completed; hiện tại vẫn bận', async () => {
      const result = await summary(yesterday);
      assert.equal(result.revenue, 0);
      assert.equal(result.totalOrders, 1);
      assert.equal(result.completedOrders, 0);
      assert.equal(result.averageOrderValue, 0);
      assert.equal(result.activeOrders, 2);
      assert.equal(result.activeTables, 1);
    });
    it('API today dùng now do backend truyền: đúng 17/09', async () => {
      const result = (await request('summary?period=today')).body.data;
      assert.equal(result.revenue, 300000);
      assert.equal(result.range.from, '2026-09-17');
      assert.equal(result.range.start, '2026-09-16T17:00:00.000Z');
    });
    it('00:10 VN thuộc giờ 00 ngày 17, không thuộc ngày UTC 16', async () => {
      const result = await dashboardRevenue(today, now);
      assert.equal(result.points.length, 24);
      assert.deepEqual(result.points[0], {
        date: '2026-09-17T00:00',
        revenue: 200000,
      });
      assert.equal(result.points[11].revenue, 100000);
      assert.equal(result.points[23].revenue, 0);
    });
    it('nửa mở nhận 00:00 VN, loại 00:00 hôm sau', async () => {
      await Order.updateOne(
        { _id: fixture.orders[0]._id },
        { $set: { paidAt: vnTime('2026-09-17T00:00:00') } },
      );
      await Order.updateOne(
        { _id: fixture.orders[1]._id },
        { $set: { paidAt: vnTime('2026-09-18T00:00:00') } },
      );
      assert.equal((await summary()).revenue, 100000);
      assert.equal((await summary()).completedOrders, 1);
    });
    it('completedOrders và trung bình theo paidAt, không theo createdAt', async () => {
      await Order.updateOne(
        { _id: fixture.orders[0]._id },
        { $set: { paidAt: vnTime('2026-09-18T00:01:00') } },
      );
      const result = await summary();
      assert.equal(result.revenue, 200000);
      assert.equal(result.completedOrders, 1);
      assert.equal(result.averageOrderValue, 200000);
      assert.equal(result.totalOrders, 4);
    });
    it('doanh thu đọc totalAmount, doanh thu món đọc lineTotal snapshot', async () => {
      // Dữ liệu cố ý sai chỉ ở database thử: chứng minh hai nguồn, không tính lại từ Product.
      await Order.collection.updateOne(
        { _id: fixture.orders[0]._id },
        { $set: { totalAmount: 123456 } },
      );
      assert.equal((await summary()).revenue, 323456);
      assert.equal(
        (await products()).products.reduce(
          (sum, product) => sum + product.revenue,
          0,
        ),
        300000,
      );
    });
    it('giá Product đã đổi lên 30.000 không làm cà phê snapshot thành 180.000', async () => {
      assert.equal(
        (await Product.findById(fixture.products[0]._id)).price,
        30000,
      );
      assert.equal((await products()).products[0].revenue, 150000);
    });
    it('đổi tên/ẩn/ngừng bán/xóa Product không đổi thống kê snapshot', async () => {
      await Product.updateMany(
        {},
        { $set: { name: 'Tên mới hiện tại', price: 999999, isActive: false } },
      );
      const before = await products();
      await Product.deleteMany({});
      assert.deepEqual(await products(), before);
      assert.equal(before.products[0].productName, 'Cà phê sữa');
    });
    it('cùng productId đổi tên chỉ một dòng, tên snapshot paidAt mới nhất', async () => {
      await Order.collection.updateOne(
        { _id: fixture.orders[0]._id },
        { $set: { 'items.0.productName': 'Cà phê sữa mới' } },
      );
      const result = (await products()).products;
      assert.equal(result.length, 3);
      assert.equal(result[0].productName, 'Cà phê sữa mới');
      assert.equal(result[0].quantitySold, 6);
    });
    it('khoảng cũ giữ tên snapshot cũ; ưu tiên paidAt hơn createdAt', async () => {
      await Order.collection.updateOne(
        { _id: fixture.orders[1]._id },
        { $set: { paidAt: vnTime('2026-09-16T23:59:00') } },
      );
      await Order.collection.updateOne(
        { _id: fixture.orders[0]._id },
        {
          $set: {
            'items.0.productName': 'Tên mới',
            createdAt: vnTime('2026-09-15T10:00:00'),
          },
        },
      );
      assert.equal(
        (await products(yesterday)).products[0].productName,
        'Cà phê sữa',
      );
      assert.equal(
        (await products({ period: '7d' })).products[0].productName,
        'Tên mới',
      );
    });
    it('tie-break snapshot theo createdAt rồi _id ổn định', async () => {
      await Order.deleteMany({});
      const item = snapshotItem(fixture.products[0], 1);
      await Order.collection.insertMany([
        fixtureOrder({
          _id: new mongoose.Types.ObjectId('000000000000000000000001'),
          items: [{ ...item, productName: 'A' }],
          totalAmount: 25000,
        }),
        fixtureOrder({
          _id: new mongoose.Types.ObjectId('000000000000000000000002'),
          items: [{ ...item, productName: 'B' }],
          totalAmount: 25000,
        }),
      ]);
      assert.equal((await products()).products[0].productName, 'B');
      await Order.collection.updateOne(
        { _id: new mongoose.Types.ObjectId('000000000000000000000001') },
        { $set: { createdAt: vnTime('2026-09-17T10:30:00') } },
      );
      assert.equal((await products()).products[0].productName, 'A');
    });
    it('hai dòng cùng productId khác ghi chú cộng thành một dòng', async () => {
      const a = fixture.orders[0];
      await Order.collection.updateOne(
        { _id: a._id },
        {
          $set: {
            items: [
              snapshotItem(fixture.products[0], 1, { note: 'Ít đá' }),
              snapshotItem(fixture.products[0], 1, { note: 'Nóng' }),
              a.items[1],
            ],
          },
        },
      );
      assert.equal((await products()).products[0].quantitySold, 6);
      assert.equal((await products()).products[0].revenue, 150000);
    });
    it('tổng doanh thu món và biểu đồ khớp tổng doanh thu khi dữ liệu hợp lệ', async () => {
      const total = (await summary()).revenue;
      assert.equal(
        (await products()).products.reduce((sum, row) => sum + row.revenue, 0),
        total,
      );
      assert.equal(
        (await dashboardRevenue(today, now)).points.reduce(
          (sum, row) => sum + row.revenue,
          0,
        ),
        total,
      );
    });
    it('thứ tự top: quantity desc, revenue desc, name asc, limit', async () => {
      await Order.deleteMany({});
      await Order.collection.insertMany(
        ['B', 'A', 'C'].map((name, index) =>
          fixtureOrder({
            items: [
              {
                productId: new mongoose.Types.ObjectId(),
                productName: name,
                unitPrice: index === 2 ? 30000 : 25000,
                quantity: 2,
                lineTotal: index === 2 ? 60000 : 50000,
              },
            ],
            totalAmount: index === 2 ? 60000 : 50000,
          }),
        ),
      );
      assert.deepEqual(
        (await products()).products.map((row) => row.productName),
        ['C', 'A', 'B'],
      );
      assert.equal(
        (await products({ period: 'today', limit: '2' })).products.length,
        2,
      );
    });
    it('activeOrders/activeTables không thay khi đổi bộ lọc, không đếm bàn hai lần', async () => {
      for (const query of [
        today,
        yesterday,
        { period: 'month', month: '2020-01' },
      ]) {
        const result = await summary(query);
        assert.equal(result.activeOrders, 2);
        assert.equal(result.activeTables, 1);
      }
    });
    for (const status of ['pending', 'confirmed', 'preparing', 'served']) {
      it(`đơn ${status} làm bàn đang sử dụng kể cả bàn tắt`, async () => {
        await Order.deleteMany({});
        await Table.updateOne(
          { _id: fixture.tables[0]._id },
          { $set: { isActive: false } },
        );
        await Order.collection.insertOne(
          fixtureOrder({
            status,
            tableId: fixture.tables[0]._id,
            paidAt: null,
          }),
        );
        const result = await summary(yesterday);
        assert.equal(result.activeTables, 1);
        assert.equal(result.activeOrders, 1);
      });
    }
    it('completed/cancelled không làm bàn bận; không ghi status Table', async () => {
      await Order.deleteMany({ status: { $in: ['preparing', 'pending'] } });
      const result = await summary();
      assert.equal(result.activeTables, 0);
      assert.equal(result.emptyTables, 5);
      assert.equal(
        await Table.countDocuments({ status: { $exists: true } }),
        0,
      );
    });
    it('cancelledOrders nghĩa là đơn tạo trong kỳ hiện đã hủy, không theo cancelledAt', async () => {
      await Order.collection.updateOne(
        { _id: fixture.orders[1]._id },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: vnTime('2026-09-17T15:00:00'),
          },
        },
      );
      assert.equal((await summary()).cancelledOrders, 1);
      const old = await summary(yesterday);
      assert.equal(old.cancelledOrders, 1);
      assert.ok(old.cancelledOrders <= old.totalOrders);
    });
    it('recent theo createdAt desc, _id desc, giới hạn và lọc kỳ', async () => {
      const result = await dashboardRecentOrders({ ...today, limit: '3' }, now);
      assert.deepEqual(
        result.orders.map((order) => order.orderCode),
        ['DEMO-E', 'DEMO-D', 'DEMO-C'],
      );
      await Order.collection.updateMany(
        {},
        { $set: { createdAt: vnTime('2026-09-17T10:00:00') } },
      );
      const ids = (await dashboardRecentOrders(today, now)).orders.map((row) =>
        String(row._id),
      );
      assert.deepEqual(ids, [...ids].sort().reverse());
    });
    it('khoảng không dữ liệu trả 0, danh sách rỗng và mốc biểu đồ đủ', async () => {
      const query = { period: 'month', month: '2020-02' };
      const result = await summary(query);
      assert.equal(result.revenue, 0);
      assert.equal(result.totalOrders, 0);
      assert.equal(result.averageOrderValue, 0);
      const chart = await dashboardRevenue(query, now);
      assert.equal(chart.points.length, 29);
      assert.ok(chart.points.every((p) => p.revenue === 0));
      assert.deepEqual((await products(query)).products, []);
      assert.deepEqual((await dashboardRecentOrders(query, now)).orders, []);
    });
    it('7d gồm hôm nay + 6 ngày trước; 30d và tháng đầy đủ ngày', async () => {
      assert.equal(dashboardRange({ period: '7d' }, now).from, '2026-09-11');
      assert.equal(
        (await dashboardRevenue({ period: '7d' }, now)).points.length,
        7,
      );
      assert.equal(dashboardRange({ period: '30d' }, now).from, '2026-08-19');
      assert.equal(
        (await dashboardRevenue({ period: '30d' }, now)).points.length,
        30,
      );
      assert.equal(dashboardRange({ period: 'month' }, now).to, '2026-09-30');
    });
    it('now 16/09 17:05 UTC thì today là 17/09 VN', () => {
      const range = dashboardRange(today, new Date('2026-09-16T17:05:00Z'));
      assert.equal(range.from, '2026-09-17');
      assert.equal(range.today, '2026-09-17');
      assert.equal(range.includesToday, true);
      assert.equal(dashboardRange(yesterday, now).includesToday, false);
    });
    it('from=to hợp lệ; đúng 366 ngày hợp lệ', async () => {
      assert.equal(
        (await request('summary?from=2026-09-17&to=2026-09-17')).status,
        200,
      );
      assert.equal(
        (await request('revenue?from=2024-01-01&to=2024-12-31')).body.data
          .points.length,
        366,
      );
    });
    for (const query of [
      'from=2026-09-18&to=2026-09-17',
      'from=2024-01-01&to=2025-01-01',
      'from=2026-02-30&to=2026-03-01',
      'from=17-09-2026&to=2026-09-17',
      'from=2026-09-17',
      'period=week',
      'period=today&period=7d',
      'period=month&month=2026-13',
      'period=today&month=2026-09',
      'period=today&from=2026-09-17&to=2026-09-17',
      'period[$ne]=today',
      'from=1900-01-01&to=1900-01-02',
    ]) {
      it(`validation trả 400: ${query}`, async () => {
        for (const path of ['summary', 'revenue', 'products', 'recent-orders'])
          assert.equal((await request(`${path}?${query}`)).status, 400, path);
      });
    }
    it('limit không hợp lệ trả 400', async () => {
      for (const value of ['0', '-1', '1.5', '51', 'abc']) {
        assert.equal((await request(`products?limit=${value}`)).status, 400);
        assert.equal(
          (await request(`recent-orders?limit=${value}`)).status,
          400,
        );
      }
    });
    for (const [label, value] of [
      ['null', null],
      ['string', '2026-09-17T04:00:00Z'],
      ['missing', undefined],
    ]) {
      it(`paidAt ${label} cảnh báo toàn DB, không cộng doanh thu hoặc món`, async () => {
        const update =
          value === undefined
            ? { $unset: { paidAt: '' } }
            : { $set: { paidAt: value } };
        await Order.collection.updateOne(
          { _id: fixture.orders[0]._id },
          update,
        );
        const result = await summary();
        assert.equal(result.revenue, 200000);
        assert.equal(result.completedOrders, 1);
        assert.equal(result.dataWarnings.completedWithoutPaidAt, 1);
        assert.equal(
          (await summary(yesterday)).dataWarnings.completedWithoutPaidAt,
          1,
        );
        assert.equal((await products()).products.length, 2);
      });
    }
    it('explain doanh thu dùng status+paidAt, số đơn dùng createdAt', async () => {
      const range = dashboardRange(today, now);
      const paid = await Order.collection
        .find(paidOrderFilter(range))
        .explain('executionStats');
      const created = await Order.collection
        .find({ createdAt: { $gte: range.start, $lt: range.end } })
        .explain('executionStats');
      assert.match(JSON.stringify(paid.queryPlanner.winningPlan), /IXSCAN/);
      assert.match(
        JSON.stringify(paid.queryPlanner.winningPlan),
        /status_1_paidAt_1/,
      );
      assert.match(
        JSON.stringify(created.queryPlanner.winningPlan),
        /createdAt_-1__id_-1/,
      );
    });
    it('check:data chỉ đọc phát hiện cả 4 lỗi và exit 2, không sửa bản ghi', async () => {
      await Order.collection.updateOne(
        { _id: fixture.orders[0]._id },
        {
          $set: { paidAt: '2026-09-17', 'items.0.lineTotal': 1 },
          $unset: { 'items.0.productId': '' },
        },
      );
      const before = await Order.collection.find({}).sort({ _id: 1 }).toArray();
      const uri = new URL(process.env.MONGODB_URI);
      uri.pathname = `/${dbName}`;
      let output;
      try {
        await promisify(execFile)(process.execPath, ['scripts/checkData.js'], {
          env: { ...process.env, MONGODB_URI: uri.href },
        });
      } catch (error) {
        assert.equal(error.code, 2);
        output = JSON.parse(error.stdout);
      }
      assert.ok(output);
      assert.equal(output.passed, false);
      assert.deepEqual(output.counters, {
        completedWithoutPaidAt: 1,
        itemsWithWrongLineTotal: 1,
        ordersWithWrongTotal: 1,
        itemsWithoutProductId: 1,
      });
      assert.deepEqual(
        await Order.collection.find({}).sort({ _id: 1 }).toArray(),
        before,
      );
    });
  },
);
