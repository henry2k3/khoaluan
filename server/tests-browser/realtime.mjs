// Nhiều browser context độc lập trên Chrome thật; không dùng dữ liệu/tài khoản demo có sẵn.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import mongoose from 'mongoose';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import Table from '../src/models/Table.js';
import Order from '../src/models/Order.js';
import User from '../src/models/User.js';
import { createInternalUser } from '../src/services/userService.js';

const config = parseEnv(
  await readFile(new URL('../.env', import.meta.url), 'utf8'),
);
const frontend = (process.env.BROWSER_FRONTEND_URL || config.CLIENT_ORIGIN?.split(',')[0] || config.PUBLIC_APP_URL).trim().replace(/\/+$/, '');
const backend = `http://localhost:${config.PORT || 3000}/api`;
const debugURL = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9224';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Chrome {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.pending = new Map();
    this.sequence = 0;
    this.log = [];
    this.exceptions = [];
    this.joinAcks = new Set();
    this.polling = new Set();
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && this.pending.has(message.id)) {
        const task = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(task.timer);
        if (message.error) task.reject(new Error(message.error.message));
        else task.resolve(message.result);
      }
      const { method, params } = message;
      if (method === 'Runtime.exceptionThrown')
        this.exceptions.push(params.exceptionDetails.text);
      if (
        method === 'Network.requestWillBeSent' &&
        params.request.url.startsWith(backend)
      ) {
        this.log.push({
          type: 'api',
          method: params.request.method,
          url: params.request.url,
          headers: Object.keys(params.request.headers),
        });
      }
      // Chỉ lưu tên event/ID ACK; không lưu frame chứa JWT/trackingToken.
      if (method === 'Network.webSocketFrameSent') {
        const matched = /^42(\d+)\["(order:join|session:ready)"/.exec(
          params.response.payloadData,
        );
        if (matched) {
          this.joinAcks.add(matched[1]);
          this.log.push({ type: 'join', event: matched[2] });
        }
      }
      if (method === 'Network.webSocketFrameReceived') {
        const matched = /^43(\d+)\[/.exec(params.response.payloadData);
        if (matched && this.joinAcks.has(matched[1])) {
          this.joinAcks.delete(matched[1]);
          if (
            JSON.parse(
              params.response.payloadData.slice(
                params.response.payloadData.indexOf('['),
              ),
            )[0]?.ok
          )
            this.log.push({ type: 'ack' });
        }
      }
      // Socket.IO có thể ACK qua HTTP polling trước khi nâng cấp WebSocket.
      if (
        method === 'Network.requestWillBeSent' &&
        params.request.url.includes('/socket.io/')
      ) {
        if (params.request.method === 'GET') this.polling.add(params.requestId);
        const matched = /^42(\d+)\["(order:join|session:ready)"/.exec(
          params.request.postData || '',
        );
        if (matched) {
          this.joinAcks.add(matched[1]);
          this.log.push({ type: 'join', event: matched[2] });
        }
      }
      if (
        method === 'Network.loadingFinished' &&
        this.polling.delete(params.requestId)
      ) {
        void this.send('Network.getResponseBody', {
          requestId: params.requestId,
        })
          .then(({ body }) => {
            for (const packet of body.split('\x1e')) {
              const matched = /^43(\d+)\[/.exec(packet);
              if (matched && this.joinAcks.has(matched[1])) {
                this.joinAcks.delete(matched[1]);
                if (JSON.parse(packet.slice(packet.indexOf('[')))[0]?.ok)
                  this.log.push({ type: 'ack' });
              }
            }
          })
          .catch(() => {});
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
        reject(new Error(`Chrome timeout: ${method}`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails)
      throw new Error(`Chrome: ${response.exceptionDetails.text}`);
    return response.result.value;
  }
  async wait(expression) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (await this.evaluate(expression)) return;
      await pause(80);
    }
    throw new Error(
      `Không đạt: ${expression}\n${await this.evaluate('document.body.innerText')}`,
    );
  }
  text(value) {
    return this.wait(
      `document.body.innerText.includes(${JSON.stringify(value)})`,
    );
  }
  async navigate(path) {
    await this.evaluate('window.__navigationMarker = true');
    await this.send('Page.navigate', { url: `${frontend}${path}` });
    await this.wait(
      `!window.__navigationMarker && location.pathname === ${JSON.stringify(path.split('?')[0])} && !!document.querySelector('h1')`,
    );
  }
  async fill(values) {
    await this
      .evaluate(`(() => { for (const [id,value] of Object.entries(${JSON.stringify(values)})) {
      const input = document.getElementById(id);
      const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
    } })()`);
  }
  click(text, selector = 'document') {
    return this.evaluate(
      `[...${selector}.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(text)}).click()`,
    );
  }
  submit(selector = 'form') {
    return this.evaluate(
      `document.querySelector(${JSON.stringify(selector)}).requestSubmit()`,
    );
  }
  connected() {
    return this.wait(
      "document.querySelector('[data-realtime-state]')?.dataset.realtimeState === 'connected'",
    );
  }
  status(value) {
    return this.wait(
      `document.querySelector('[data-order-status]')?.dataset.orderStatus === '${value}'`,
    );
  }
  noOverflow() {
    return this.evaluate(
      'document.documentElement.scrollWidth <= innerWidth',
    ).then((value) => assert.equal(value, true));
  }
  socketCode(code) {
    return this.evaluate(
      // Dùng đúng URL module React đã tải (có thể có ?t=... do Vite HMR), không tạo instance thứ hai.
      `(() => {
        const loaded = performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname === '/src/realtime/socket.js').at(-1);
        if (!loaded) throw new Error('Chưa tìm thấy module socket của ứng dụng');
        return import(loaded.name).then(({socket}) => { ${code} });
      })()`,
    );
  }
}

const version = await (await fetch(`${debugURL}/json/version`)).json();
const browser = await new Chrome(version.webSocketDebuggerUrl).open();
const pages = [];
async function newPage() {
  const context = await browser.send('Target.createBrowserContext');
  const target = await browser.send('Target.createTarget', {
    url: 'about:blank',
    browserContextId: context.browserContextId,
  });
  const targets = await (await fetch(`${debugURL}/json/list`)).json();
  const page = await new Chrome(
    targets.find((item) => item.id === target.targetId).webSocketDebuggerUrl,
  ).open();
  page.contextId = context.browserContextId;
  pages.push(page);
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Network.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: true,
  });
  return page;
}
const users = [];
let category, product, table;
const password = randomBytes(20).toString('hex');
async function login(page, user) {
  await page.navigate('/login');
  await page.wait("!!document.querySelector('#username')");
  await page.fill({ username: user.username, password });
  await page.submit();
  await page.wait(`location.pathname === '/${user.role}'`);
  await page.connected();
}
async function api(path, method = 'GET', body, token) {
  const result = await fetch(`${backend}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const response = await result.json();
  assert(result.ok, `${method} ${path}: ${response.message}`);
  return response.data;
}
async function guestOrder(page) {
  await page.navigate(`/menu/${table.qrToken}`);
  if (await page.evaluate("!!document.querySelector('#customer-name')")) {
    await page.fill({ 'customer-name': 'Khách realtime Chrome' });
    await page.submit();
  }
  await page.wait(
    `!!document.querySelector('[data-product-id="${product.id}"]')`,
  );
  await page.click(
    'Thêm vào giỏ',
    `document.querySelector('[data-product-id="${product.id}"]')`,
  );
  await page.wait("!!document.querySelector('#add-quantity')");
  await page.submit('dialog form');
  await page.wait("!document.querySelector('dialog')");
  await page.navigate(`/menu/${table.qrToken}/cart`);
  await page.text('Gửi order');
  await page.click('Gửi order');
  await page.wait("location.pathname.startsWith('/orders/')");
  await page.status('pending');
  await page.connected();
  return page.evaluate('location.pathname.split("/").pop()');
}
async function openDetail(page, id, prefix = '/staff/orders') {
  await page.navigate(`${prefix}/${id}`);
  await page.connected();
  await page.wait("!!document.querySelector('[data-order-actions]')");
  // Đợi refetch sau ACK kết thúc trước khi thao tác biểu mẫu.
  await pause(500);
  await page.wait("!!document.querySelector('[data-order-actions]')");
}
async function tableCount(page, count) {
  await page.wait(
    `document.querySelector('[data-table-id="${table.id}"]')?.innerText.includes('${count} đơn đang xử lý')`,
  );
}
async function change(page, label, status, guest, observer) {
  await page.click(label);
  await page.status(status);
  if (guest) await guest.status(status);
  if (observer) await observer.status(status);
  await pause(350);
  await page.status(status);
}
function assertAckBeforeRead(page, start, orderId) {
  const log = page.log.slice(start);
  const ackIndex = log.findIndex((item) => item.type === 'ack');
  const readIndex = log.findIndex(
    (item) =>
      item.type === 'api' &&
      item.method === 'GET' &&
      item.url.includes(orderId),
  );
  assert(
    ackIndex >= 0 && readIndex > ackIndex,
    `Reconnect: phải ACK room trước GET đọc lại đơn (${log.map((item) => item.type).join(', ')})`,
  );
}

await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  const suffix = randomBytes(5).toString('hex');
  for (const [index, role] of ['staff', 'staff', 'admin'].entries())
    users.push(
      await createInternalUser({
        username: `rt_${index}_${suffix}`,
        fullName: `Realtime ${index} ${suffix}`,
        password,
        role,
      }),
    );
  const staffToken = (
    await api('/auth/login', 'POST', { username: users[0].username, password })
  ).accessToken;
  category = await Category.create({ name: `Danh mục realtime ${suffix}` });
  product = await Product.create({
    name: `Cà phê realtime ${suffix}`,
    price: 35000,
    categoryId: category.id,
  });
  table = await Table.create({ name: `Bàn realtime ${suffix}`, capacity: 4 });
  const guest = await newPage();
  const staffA = await newPage();
  const staffB = await newPage();
  const tables = await newPage();
  await login(staffA, users[0]);
  await login(staffB, users[1]);
  await login(tables, users[2]);
  await staffA.navigate(`/staff/orders?tableId=${table.id}`);
  await staffA.connected();
  await tables.navigate('/admin/tables');
  await tables.connected();
  await tableCount(tables, 0);
  const first = await guestOrder(guest);
  await staffA.wait(
    `!!document.querySelector('[data-internal-order-id="${first}"]')`,
  );
  await staffA.wait(
    `document.querySelectorAll('[data-notification-order-id="${first}"]').length === 1`,
  );
  await tableCount(tables, 1);
  console.log(
    'PASS cửa sổ khách gửi giỏ qua API -> staff thấy đơn/thông báo -> bàn tự bận, không F5',
  );

  await openDetail(staffA, first);
  await openDetail(staffB, first);
  await change(staffA, 'Xác nhận đơn', 'confirmed', guest, staffB);
  await change(staffA, 'Bắt đầu chuẩn bị', 'preparing', guest, staffB);
  await change(staffA, 'Đã phục vụ', 'served', guest, staffB);
  await staffA.click('Xác nhận thanh toán & hoàn thành');
  await staffA.wait("!!document.querySelector('dialog')");
  await staffA.evaluate(
    "document.querySelector('dialog input[type=checkbox]').click()",
  );
  await staffA.submit('dialog form');
  await staffA.status('completed');
  await guest.status('completed');
  await staffB.status('completed');
  await tableCount(tables, 0);
  console.log(
    'PASS đủ confirmed/preparing/served/completed -> khách và nhân viên B tự cập nhật; bàn tự trống',
  );

  // Kiểm tra cả màn hình bàn staff, không chỉ màn hình bàn admin đã thử ở trên.
  await tables.navigate('/staff/tables');
  await tables.connected();
  await tableCount(tables, 0);
  const second = await guestOrder(guest);
  await tableCount(tables, 1);
  await openDetail(staffA, second);
  await staffA.click('Hủy đơn');
  await staffA.wait("!!document.querySelector('#cancel-reason')");
  await staffA.fill({ 'cancel-reason': 'Khách đổi ý realtime' });
  await staffA.submit('dialog form');
  await guest.status('cancelled');
  await guest.text('Khách đổi ý realtime');
  await tableCount(tables, 0);
  console.log('PASS khách tự thấy Đã hủy và lý do hủy; bàn tự cập nhật');

  const third = await guestOrder(guest);
  await openDetail(staffA, third);
  await openDetail(staffB, third);
  // Mô phỏng mất mạng thật ở cửa sổ khách và đóng transport để không phải chờ heartbeat 45 giây.
  // Lấy socket trước khi offline: khi Vite có phiên module mới, import sau offline sẽ không tải được.
  await guest.socketCode('window.__socketUnderTest = socket;');
  await guest.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await guest.evaluate('void window.__socketUnderTest.io.engine.close();');
  await guest.wait(
    "document.querySelector('[data-realtime-state]')?.dataset.realtimeState === 'offline'",
  );
  await change(staffA, 'Xác nhận đơn', 'confirmed', null, staffB);
  await change(staffA, 'Bắt đầu chuẩn bị', 'preparing', null, staffB);
  assert.equal(
    await guest.evaluate(
      "document.querySelector('[data-order-status]').dataset.orderStatus",
    ),
    'pending',
  );
  const guestStart = guest.log.length;
  await guest.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await guest.connected();
  await guest.status('preparing');
  assertAckBeforeRead(guest, guestStart, third);
  console.log(
    'PASS khách mất mạng bỏ lỡ hai bước, reconnect -> join ACK -> GET API -> đúng preparing',
  );

  // Tắt riêng socket của staff B: API vẫn dùng được, đồng thời giữ test conflict 409.
  await staffB.socketCode('socket.disconnect();');
  await change(staffA, 'Đã phục vụ', 'served', guest);
  assert.equal(
    await staffB.evaluate(
      "document.querySelector('[data-order-status]').dataset.orderStatus",
    ),
    'preparing',
  );
  await staffB.click('Đã phục vụ');
  await staffB.text('Đơn đã được người khác cập nhật');
  await staffB.status('served');
  await staffB.click('Xác nhận thanh toán & hoàn thành');
  await staffB.wait("!!document.querySelector('dialog')");
  await staffB.evaluate(
    "document.querySelector('dialog input[type=checkbox]').click()",
  );
  await staffB.submit('dialog form');
  await staffB.status('completed');
  await guest.status('completed');
  await staffA.status('completed');
  const staffStart = staffB.log.length;
  await staffB.socketCode('socket.connect();');
  await staffB.connected();
  await pause(700);
  assertAckBeforeRead(staffB, staffStart, third);
  console.log(
    'PASS socket staff tắt vẫn xử lý bằng API; dữ liệu cũ bị 409; reconnect staff ACK trước refetch',
  );

  // Thay đổi khi socket khách tắt: nút làm mới và quay lại tab đều là phương án dự phòng.
  const fourth = await guestOrder(guest);
  await guest.socketCode('socket.disconnect();');
  await api(
    `/orders/${fourth}/status`,
    'PATCH',
    { expectedStatus: 'pending', status: 'confirmed' },
    staffToken,
  );
  await guest.click('Làm mới trạng thái');
  await guest.status('confirmed');
  await api(
    `/orders/${fourth}/status`,
    'PATCH',
    { expectedStatus: 'confirmed', status: 'preparing' },
    staffToken,
  );
  await guest.evaluate(
    "Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}); document.dispatchEvent(new Event('visibilitychange'));",
  );
  await guest.status('preparing');
  console.log(
    'PASS socket khách tắt: làm mới và visibilitychange vẫn gọi API lấy đúng dữ liệu',
  );

  await staffA.navigate(
    `/staff/orders?tableId=${table.id}&status=completed&limit=5`,
  );
  await staffA.connected();
  await staffA.text('Trang 1 / 1 · 2 đơn');
  for (let i = 0; i < 3; i += 1) {
    await staffA.evaluate(
      'document.querySelector(\'nav[aria-label="Nhân viên"] a[href="/staff/tables"]\').click()',
    );
    await staffA.wait("location.pathname === '/staff/tables'");
    await staffA.evaluate(
      'document.querySelector(\'nav[aria-label="Nhân viên"] a[href="/staff/orders"]\').click()',
    );
    await staffA.wait(
      "location.pathname === '/staff/orders' && !!document.querySelector('#order-status-filter')",
    );
  }
  await staffA.fill({
    'order-status-filter': 'completed',
    'order-table-filter': table.id,
    'order-limit-filter': '5',
  });
  await staffA.submit();
  await staffA.text('Trang 1 / 1 · 2 đơn');
  const listeners = await staffA.socketCode(
    "return socket.listeners('order:created').length;",
  );
  assert.equal(
    listeners,
    2,
    'Một listener thông báo và một listener tải danh sách',
  );
  const fifth = await guestOrder(guest);
  await staffA.wait(
    `document.querySelectorAll('[data-notification-order-id="${fifth}"]').length === 1`,
  );
  await pause(600);
  await staffA.text('Trang 1 / 1 · 2 đơn');
  assert.equal(
    await staffA.evaluate(
      `!!document.querySelector('[data-internal-order-id="${fifth}"]')`,
    ),
    false,
  );
  assert.equal(
    await staffA.socketCode("return socket.listeners('order:created').length;"),
    listeners,
  );
  await staffA.navigate(
    `/staff/orders?tableId=${table.id}&status=pending&limit=5`,
  );
  await staffA.connected();
  await staffA.wait(
    `!!document.querySelector('[data-internal-order-id="${fifth}"]')`,
  );
  console.log(
    'PASS chuyển trang/reload không nhân listener/thông báo; danh sách giữ đúng filter và pagination',
  );

  // Khóa ngay trong MongoDB như công cụ quản trị: server định kỳ ngắt user room, không đụng tài khoản khác.
  await User.updateOne({ _id: users[1].id }, { isActive: false });
  await staffB.wait("location.pathname === '/login'");
  await staffA.connected();
  await guest.connected();
  await staffA.navigate('/staff');
  await staffA.connected();
  await staffA.click('Đăng xuất');
  await staffA.wait("location.pathname === '/login'");
  assert.equal(await staffA.socketCode('return socket.connected;'), false);
  console.log(
    'PASS khóa tài khoản online ngắt realtime và xóa phiên giao diện; logout đóng socket',
  );

  for (const page of pages) {
    await page.noOverflow();
    assert.equal(page.exceptions.length, 0);
  }
  const shot = await guest.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    '/private/tmp/restaurant-qr-stage7-guest-mobile.png',
    Buffer.from(shot.data, 'base64'),
  );
  const guestGETs = guest.log.filter(
    (item) =>
      item.type === 'api' &&
      item.method === 'GET' &&
      item.url.includes('/public/orders/'),
  );
  assert(
    guestGETs.every((item) =>
      item.headers.some((name) => name.toLowerCase() === 'x-order-token'),
    ),
  );
  assert(
    guestGETs.every(
      (item) =>
        !item.headers.some((name) => name.toLowerCase() === 'authorization'),
    ),
  );
  console.log(
    'PASS Chrome realtime với 4 context độc lập, không lỗi JavaScript, mobile 375px không tràn ngang',
  );
} finally {
  for (const page of pages) {
    page.socket.close();
    await browser.send('Target.disposeBrowserContext', {
      browserContextId: page.contextId,
    });
  }
  browser.socket.close();
  if (table) {
    await Order.deleteMany({ tableId: table.id });
    await Table.deleteOne({ _id: table.id });
  }
  if (category) {
    await Product.deleteMany({ categoryId: category.id });
    await Category.deleteOne({ _id: category.id });
  }
  await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });
  await mongoose.disconnect();
}
