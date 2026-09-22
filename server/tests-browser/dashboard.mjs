// Test Chrome thật với MongoDB riêng và đồng hồ thống kê cố định. Không sửa dữ liệu quán.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import {
  dashboardNow,
  seedDashboardExample,
  fixtureOrder,
  snapshotItem,
} from '../tests/dashboardFixture.js';

const local = parseEnv(
  await readFile(new URL('../.env', import.meta.url), 'utf8'),
);
const frontend = 'http://localhost:5175';
process.env.CLIENT_ORIGIN = frontend;
process.env.PUBLIC_APP_URL = frontend;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.ORDER_TOKEN_SECRET = randomBytes(48).toString('hex');
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || local.MONGODB_URI;
const { createApp } = await import('../src/app.js');
const { initializeRealtime } = await import('../src/sockets/realtimeServer.js');
const { notifyOrderCreated, notifyOrderUpdated } =
  await import('../src/sockets/notifications.js');
const { createInternalUser } = await import('../src/services/userService.js');
const { default: Order } = await import('../src/models/Order.js');
const dbName = `restaurant_qr_dashboard_browser_${randomBytes(8).toString('hex')}`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const password = randomBytes(20).toString('hex');
let server, realtime, vite, browser, backend;
const pages = [];

class Chrome {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.requests = [];
    this.exceptions = [];
    this.intercept = null;
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && this.pending.has(message.id)) {
        const task = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(task.timer);
        if (message.error) task.reject(new Error(message.error.message));
        else task.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown')
        this.exceptions.push(message.params.exceptionDetails.text);
      // Đếm lần đọc dữ liệu GET; OPTIONS kiểm tra CORS có thể xuất hiện lại khi cache hết hạn.
      if (
        message.method === 'Network.requestWillBeSent' &&
        message.params.request.method === 'GET' &&
        message.params.request.url.includes('/api/dashboard/')
      )
        this.requests.push(message.params.request.url); // Chỉ query thống kê, không lưu header/token.
      if (message.method === 'Fetch.requestPaused') {
        const work = this.intercept
          ? this.intercept(message.params)
          : this.send('Fetch.continueRequest', {
              requestId: message.params.requestId,
            });
        void work.catch((error) => this.exceptions.push(error.message));
      }
    });
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    return this;
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome timeout ${method}`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    return result.result.value;
  }
  async wait(expression) {
    for (let i = 0; i < 200; i += 1) {
      if (await this.evaluate(expression)) return;
      await pause(100);
    }
    throw new Error(
      `Không đạt: ${expression}\n${await this.evaluate('document.body.innerText')}`,
    );
  }
  async navigate(path) {
    await this.evaluate('window.__navigation = true');
    await this.send('Page.navigate', { url: `${frontend}${path}` });
    await this.wait(
      `!window.__navigation && location.pathname === ${JSON.stringify(path)} && !!document.querySelector('h1')`,
    );
  }
  async fill(values) {
    await this
      .evaluate(`(() => { for (const [id,value] of Object.entries(${JSON.stringify(values)})) {
      const element = document.getElementById(id);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);
      element.dispatchEvent(new Event('input',{bubbles:true})); element.dispatchEvent(new Event('change',{bubbles:true}));
    } })()`);
  }
  click(label) {
    return this.evaluate(
      `[...document.querySelectorAll('button')].find(b=>b.textContent === ${JSON.stringify(label)}).click()`,
    );
  }
  text(value) {
    return this.wait(
      `document.body.innerText.includes(${JSON.stringify(value)})`,
    );
  }
  async metric(name, number) {
    await this.wait(
      `document.querySelector('[data-metric="${name}"]')?.textContent.replace(/[^0-9]/g,'') === '${number}'`,
    );
  }
  async connected() {
    await this.wait(
      "document.querySelector('[data-realtime-state]')?.dataset.realtimeState === 'connected'",
    );
  }
  async settled() {
    await this.wait(
      "!!document.querySelector('[data-metric=" +
        '"revenue"' +
        "]') && !document.body.innerText.includes('Đang cập nhật số liệu')",
    );
    await pause(1800); // Cho lượt refetch sau ACK kết thúc trước khi đo số request realtime.
  }
  socketCode(code) {
    return this.evaluate(
      `(() => { const loaded = performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname === '/src/realtime/socket.js').at(-1); return import(loaded.name).then(({socket})=>{ ${code} }); })()`,
    );
  }
  async hidden(value) {
    // Mô phỏng Page Visibility API độc lập với cách Chrome headless chọn tab foreground.
    await this.evaluate(
      `Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> '${value ? 'hidden' : 'visible'}'}); document.dispatchEvent(new Event('visibilitychange'));`,
    );
  }
}

async function newPage() {
  const context = await browser.send('Target.createBrowserContext');
  const target = await browser.send('Target.createTarget', {
    url: 'about:blank',
    browserContextId: context.browserContextId,
  });
  const targets = await (
    await fetch(
      `${process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9224'}/json/list`,
    )
  ).json();
  const page = await new Chrome(
    targets.find((t) => t.id === target.targetId).webSocketDebuggerUrl,
  ).open();
  page.contextId = context.browserContextId;
  pages.push(page);
  for (const method of ['Runtime.enable', 'Page.enable', 'Network.enable'])
    await page.send(method);
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: true,
  });
  return page;
}
async function login(page, user) {
  await page.navigate('/login');
  await page.wait("!!document.querySelector('#username')");
  await page.fill({ username: user.username, password });
  await page.evaluate("document.querySelector('form').requestSubmit()");
  await page.wait(`location.pathname === '/${user.role}'`);
  await page.connected();
}
function burst() {
  for (let i = 0; i < 20; i += 1) {
    realtime.io
      .to('staff')
      .emit('order:updated', {
        orderId: '000000000000000000000001',
        status: 'completed',
        updatedAt: dashboardNow,
      });
    realtime.io
      .to('staff')
      .emit('table:updated', { tableId: '000000000000000000000002' });
  }
}

try {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName,
    serverSelectionTimeoutMS: 5000,
  });
  await Order.init();
  const fixture = await seedDashboardExample();
  const admin = await createInternalUser({
    username: 'dashboard_admin',
    fullName: 'Quản lý thử',
    role: 'admin',
    password,
  });
  const staff = await createInternalUser({
    username: 'dashboard_staff',
    fullName: 'Nhân viên thử',
    role: 'staff',
    password,
  });
  server = createServer(
    createApp({ dashboardClock: () => new Date(dashboardNow) }),
  );
  realtime = initializeRealtime(server);
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  backend = `http://127.0.0.1:${server.address().port}/api`;
  vite = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../client/node_modules/vite/bin/vite.js', import.meta.url),
      ),
      '--host',
      '127.0.0.1',
      '--port',
      '5175',
    ],
    {
      cwd: new URL('../../client', import.meta.url),
      env: { ...process.env, VITE_API_BASE_URL: backend },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let viteOutput = '';
  vite.stdout.on('data', (data) => {
    viteOutput += data;
  });
  vite.stderr.on('data', (data) => {
    viteOutput += data;
  });
  let started = false;
  for (let i = 0; i < 50; i += 1) {
    if (vite.exitCode !== null)
      throw new Error(`Vite test không chạy: ${viteOutput}`);
    try {
      if ((await fetch(frontend)).ok) {
        started = true;
        break;
      }
    } catch {
      /* Đợi server mở cổng. */
    }
    await pause(100);
  }
  assert.ok(started, 'Vite test cần chạy tại cổng riêng 5175');
  const debug = await (
    await fetch(
      `${process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9224'}/json/version`,
    )
  ).json();
  browser = await new Chrome(debug.webSocketDebuggerUrl).open();
  const page = await newPage();
  await login(page, admin);
  await page.navigate('/admin/dashboard');
  await page.connected();
  await page.settled();
  await page.metric('revenue', 300000);
  await page.metric('totalOrders', 4);
  await page.metric('completedOrders', 2);
  await page.metric('activeOrders', 2);
  await page.metric('cancelledOrders', 1);
  await page.metric('averageOrderValue', 150000);
  assert.equal(
    await page.evaluate(
      "document.querySelectorAll('[data-dashboard-product]').length",
    ),
    3,
  );
  assert.equal(
    await page.evaluate(
      "document.querySelectorAll('[data-dashboard-order]').length",
    ),
    4,
  );
  assert.equal(
    await page.evaluate(
      "document.querySelector('[data-revenue-chart]').width > 0",
    ),
    true,
  );
  assert.equal(
    await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true,
  );
  const screenshot = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    '/private/tmp/restaurant-qr-stage8-dashboard-mobile.png',
    Buffer.from(screenshot.data, 'base64'),
  );
  console.log(
    'PASS admin dashboard: toàn bộ số liệu A–E, chart, top món, recent orders; 375px không tràn ngang',
  );

  const employee = await newPage();
  await login(employee, staff);
  await employee.navigate('/admin/dashboard');
  await employee.text('Bạn không có quyền truy cập');
  assert.equal(employee.requests.length, 0);
  console.log('PASS staff bị chặn khỏi dashboard, không gọi API thống kê');

  await page.click('7 ngày');
  await page.metric('totalOrders', 5);
  await page.metric('revenue', 300000);
  await page.click('30 ngày');
  await page.metric('totalOrders', 5);
  await page.click('Tháng này');
  await page.metric('totalOrders', 5);
  await page.fill({ 'dashboard-month': '2020-02' });
  await page.click('Xem tháng');
  await page.metric('revenue', 0);
  await page.text('Chưa có món bán trong khoảng này.');
  await page.text('Chưa có đơn được tạo trong khoảng này.');
  await page.metric('activeOrders', 2);
  await page.settled();
  let start = page.requests.length;
  burst();
  await pause(2200);
  assert.equal(page.requests.length, start, 'Kỳ cũ phải bỏ qua event');
  console.log(
    'PASS đổi 7d/30d/month, tháng rỗng vẫn có tình trạng hiện tại; kỳ cũ bỏ qua event',
  );

  await page.click('Hôm nay');
  await page.metric('revenue', 300000);
  await page.settled();
  start = page.requests.length;
  burst();
  await pause(2300);
  assert.equal(
    page.requests.length - start,
    4,
    '40 event chỉ gọi một bộ 4 API',
  );
  await page.hidden(true);
  start = page.requests.length;
  burst();
  await pause(2200);
  assert.equal(page.requests.length, start, 'Tab ẩn không refetch');
  await page.hidden(false);
  await pause(2200);
  assert.equal(
    page.requests.length - start,
    4,
    'Tab hiện lại refetch đúng một lần',
  );
  console.log(
    'PASS debounce 1,5 giây: 40 event chỉ 4 request; tab ẩn chờ hiện lại mới refetch',
  );

  // Dữ liệu thử cố định, event dùng đúng module phát thông báo của ứng dụng.
  const extra = fixtureOrder({
    status: 'pending',
    paidAt: null,
    tableId: fixture.tables[4]._id,
    tableName: fixture.tables[4].name,
    items: [snapshotItem(fixture.products[0], 1)],
    totalAmount: 25000,
  });
  await Order.collection.insertOne(extra);
  await notifyOrderCreated(extra);
  await page.metric('totalOrders', 5);
  await page.metric('activeOrders', 3);
  await Order.collection.updateOne(
    { _id: extra._id },
    { $set: { status: 'completed', paidAt: dashboardNow } },
  );
  await notifyOrderUpdated({
    ...extra,
    status: 'completed',
    updatedAt: dashboardNow,
  });
  await page.metric('revenue', 325000);
  await page.metric('activeOrders', 2);
  console.log(
    'PASS thay đổi MongoDB -> event thông báo -> dashboard tự đọc lại đúng doanh thu/đơn',
  );

  await page.socketCode('socket.disconnect();');
  await page.text('Mất kết nối realtime');
  await page.click('7 ngày');
  await page.metric('revenue', 325000);
  await page.metric('totalOrders', 6);
  await Order.collection.updateOne(
    { _id: extra._id },
    {
      $set: {
        totalAmount: 50000,
        'items.0.quantity': 2,
        'items.0.lineTotal': 50000,
      },
    },
  );
  await page.click('Làm mới số liệu');
  await page.metric('revenue', 350000);
  await Order.collection.updateOne(
    { _id: extra._id },
    {
      $set: {
        totalAmount: 75000,
        'items.0.quantity': 3,
        'items.0.lineTotal': 75000,
      },
    },
  );
  await page.socketCode('socket.connect();');
  await page.connected();
  await page.metric('revenue', 375000);
  console.log(
    'PASS socket tắt vẫn đổi bộ lọc/làm mới API; reconnect tự refetch dữ liệu đã bỏ lỡ',
  );

  await Order.collection.updateOne(
    { _id: extra._id },
    { $set: { paidAt: '2026-09-17T13:00:00Z' } },
  );
  await page.click('Làm mới số liệu');
  await page.wait("!!document.querySelector('[data-data-warning]')");
  await page.metric('revenue', 300000);
  await Order.collection.updateOne(
    { _id: extra._id },
    { $set: { paidAt: dashboardNow } },
  );
  console.log(
    'PASS paidAt sai kiểu: hiện cảnh báo dataWarnings và không cộng doanh thu',
  );

  await page.send('Network.setBlockedURLs', { urls: ['*/api/dashboard/*'] });
  await page.click('Làm mới số liệu');
  await page.text('Không kết nối được máy chủ');
  await page.send('Network.setBlockedURLs', { urls: [] });
  await page.click('Thử lại');
  await page.metric('revenue', 375000);
  console.log('PASS API lỗi có thông báo, Thử lại khôi phục đúng dữ liệu');

  // Giữ phản hồi 7d ở tầng mạng, đổi sang tháng rỗng rồi mới thả phản hồi cũ.
  // Nếu thiếu AbortController, kết quả cũ sẽ ghi đè dashboard tháng rỗng.
  const held = [];
  page.intercept = async (request) => {
    if (request.request.url.includes('period=7d')) held.push(request.requestId);
    else
      await page.send('Fetch.continueRequest', {
        requestId: request.requestId,
      });
  };
  await page.send('Fetch.enable', {
    patterns: [{ urlPattern: '*api/dashboard/*', requestStage: 'Response' }],
  });
  await page.click('Hôm nay');
  await page.metric('totalOrders', 5);
  await page.settled();
  await page.click('7 ngày');
  for (let i = 0; i < 100 && held.length < 4; i += 1) await pause(50);
  assert.equal(held.length, 4, 'Đã giữ đủ phản hồi cũ');
  await page.fill({ 'dashboard-month': '2020-02' });
  await page.click('Xem tháng');
  await page.metric('revenue', 0);
  for (const requestId of held) {
    try {
      await page.send('Fetch.continueRequest', { requestId });
    } catch {
      /* Chrome có thể đã hủy request. */
    }
  }
  await page.send('Fetch.disable');
  page.intercept = null;
  await pause(1000);
  await page.metric('revenue', 0);
  await page.metric('totalOrders', 0);
  console.log(
    'PASS đổi bộ lọc nhanh: phản hồi chậm của kỳ cũ không ghi đè kỳ mới',
  );

  for (let i = 0; i < 3; i += 1) {
    await page.click('Hôm nay');
    await page.metric('revenue', 375000);
    await page.evaluate(
      "[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='/admin/tables').click()",
    );
    await page.text('Bàn & mã QR');
    await page.evaluate(
      "[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='/admin/dashboard').click()",
    );
    await page.metric('revenue', 375000);
  }
  await page.settled();
  start = page.requests.length;
  burst();
  await pause(2300);
  assert.equal(page.requests.length - start, 4);
  assert.equal(
    await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true,
  );
  assert.deepEqual(page.exceptions, []);
  assert.deepEqual(employee.exceptions, []);
  console.log(
    'PASS chuyển trang không nhân listener; dashboard 375px không tràn ngang; không lỗi JavaScript',
  );
} finally {
  for (const page of pages) {
    if (browser)
      await browser
        .send('Target.disposeBrowserContext', {
          browserContextId: page.contextId,
        })
        .catch(() => {});
    page.socket.close();
  }
  browser?.socket.close();
  if (vite && vite.exitCode === null) {
    vite.kill('SIGTERM');
    await new Promise((resolve) => vite.once('exit', resolve));
  }
  if (realtime) await realtime.close();
  else if (server?.listening)
    await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.name === dbName)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
