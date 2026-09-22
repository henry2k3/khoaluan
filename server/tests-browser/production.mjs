// Chạy riêng: npm run test:browser:production. Cần Chrome mở cổng debug.
// Dùng CDP qua fetch/WebSocket có sẵn trong Node, không Playwright/Puppeteer.
// Build thật + Express/Socket.IO thật + MongoDB thử riêng; không sửa DB quán.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createServer } from 'node:http';
import mongoose from 'mongoose';

let local = {};
try { local = parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const debugURL = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9224';
const hostname = process.env.BROWSER_HOST || '127.0.0.1';
const dbName = `restaurant_qr_9b_browser_${randomBytes(8).toString('hex')}`;
assert.notEqual(dbName, local.DEMO_DB_NAME);
const password = randomBytes(20).toString('hex');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pages = [];
let browser, realtime, server, baseURL;

class Chrome {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.requestOrigins = new Set();
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && this.pending.has(message.id)) {
        const task = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(task.timer);
        if (message.error) task.reject(new Error(message.error.message));
        else task.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') this.exceptions.push(message.params.exceptionDetails.text);
      if (message.method === 'Network.requestWillBeSent') {
        const url = new URL(message.params.request.url);
        if (url.pathname.startsWith('/api/')) this.requestOrigins.add(url.origin);
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
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Chrome timeout ${method}`)); }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async wait(expression) {
    for (let i = 0; i < 200; i += 1) {
      if (await this.evaluate(expression)) return;
      await pause(100);
    }
    throw new Error(`Chưa đạt điều kiện Chrome: ${expression}`);
  }
  async navigate(path) {
    await this.evaluate('window.__oldPage = true');
    await this.send('Page.navigate', { url: `${baseURL}${path}` });
    await this.wait(`!window.__oldPage && !!document.querySelector('h1')`);
  }
  async fill(id, value) {
    await this.evaluate(`(() => {
      const element = document.getElementById(${JSON.stringify(id)});
      const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event('input', {bubbles:true}));
      element.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
  }
  async click(label) {
    const selector = `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled)`;
    await this.wait(`!!(${selector})`);
    await this.evaluate(`${selector}.click()`);
  }
  connected() { return this.wait("document.querySelector('[data-realtime-state]')?.dataset.realtimeState === 'connected'"); }
  status(value) { return this.wait(`!!document.querySelector('[data-order-status="${value}"]')`); }
  metric(name, value) { return this.wait(`document.querySelector('[data-metric="${name}"]')?.textContent.replace(/[^0-9]/g,'') === '${value}'`); }
  async width() { assert.equal(await this.evaluate('document.documentElement.scrollWidth <= innerWidth'), true); }
}

async function page(contextId) {
  const context = contextId || (await browser.send('Target.createBrowserContext')).browserContextId;
  const target = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: context });
  const targets = await (await fetch(`${debugURL}/json/list`)).json();
  const result = await new Chrome(targets.find((item) => item.id === target.targetId).webSocketDebuggerUrl).open();
  result.contextId = context;
  pages.push(result);
  for (const method of ['Runtime.enable', 'Page.enable', 'Network.enable']) await result.send(method);
  await result.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  return result;
}
async function login(target, username) {
  await target.navigate('/login');
  await target.wait("!!document.getElementById('username')");
  await target.fill('username', username);
  await target.fill('password', password);
  await target.evaluate("document.querySelector('form').requestSubmit()");
  await target.wait("location.pathname === '/admin' || location.pathname === '/staff'");
  await target.connected();
}

try {
  // Kiểm tra build trước khi tạo fixture DB. Không tự build đè file trong test này.
  await readFile(new URL('../../client/dist/index.html', import.meta.url));
  const debug = await (await fetch(`${debugURL}/json/version`)).json();
  browser = await new Chrome(debug.webSocketDebuggerUrl).open();
  server = createServer();
  server.listen(0, '0.0.0.0');
  await new Promise((resolve) => server.once('listening', resolve));
  baseURL = `http://${hostname}:${server.address().port}`;
  Object.assign(process.env, { NODE_ENV: 'production', CLIENT_ORIGIN: '', PUBLIC_APP_URL: baseURL,
    JWT_SECRET: randomBytes(48).toString('hex'), ORDER_TOKEN_SECRET: randomBytes(48).toString('hex'), TRUST_PROXY: '0',
    MONGODB_URI: process.env.TEST_MONGODB_URI || local.MONGODB_URI || 'mongodb://127.0.0.1:27017' });
  const { createApp } = await import('../src/app.js');
  const { initializeRealtime } = await import('../src/sockets/realtimeServer.js');
  const { seedDemoData } = await import('../scripts/demoData.js');
  const { default: Table } = await import('../src/models/Table.js');
  const { default: Product } = await import('../src/models/Product.js');
  const { default: Order } = await import('../src/models/Order.js');
  await mongoose.connect(process.env.MONGODB_URI, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
  const counts = await seedDemoData({ demoDBName: dbName, adminPassword: password, staffPassword: password });
  assert.equal(counts.orders, 12);
  server.on('request', createApp());
  realtime = initializeRealtime(server);
  for (const path of ['/', '/login', '/admin/dashboard']) {
    const response = await fetch(`${baseURL}${path}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
  }
  assert.equal((await fetch(`${baseURL}/api/health`)).status, 200);
  assert.equal((await fetch(`${baseURL}/api/duong-dan-khong-ton-tai`)).status, 404);
  const table = await Table.findOne({ name: 'Bàn 05' });
  const products = await Product.find().sort({ createdAt: 1, _id: 1 }).limit(2);
  const expectedTotal = products.reduce((sum, product) => sum + product.price, 0);
  const baselineRevenue = (await Order.find({ status: 'completed', paidAt: { $gte: new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+07:00') } }).lean()).reduce((sum, order) => sum + order.totalAmount, 0);
  const admin = await page();
  const staff = await page();
  const guest = await page();
  const tablePage = await page();
  await login(admin, 'demo_admin');
  const qrURL = await admin.evaluate(`fetch('/api/tables/${table.id}/qr', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('restaurant_qr_access_token') } }).then(r=>r.json()).then(r=>r.data.menuUrl)`);
  assert.equal(qrURL, `${baseURL}/menu/${table.qrToken}`);
  await admin.navigate('/admin/dashboard');
  await admin.metric('revenue', baselineRevenue);
  await admin.width();
  await login(staff, 'demo_staff1');
  await staff.navigate('/staff/orders');
  await staff.connected();
  await login(tablePage, 'demo_staff2');
  await tablePage.navigate('/staff/tables');
  await tablePage.wait(`!!document.querySelector('[data-table-id="${table.id}"] [data-table-occupancy="empty"]')`);
  const newTab = await page(staff.contextId);
  await newTab.navigate('/staff/orders');
  await newTab.wait("location.pathname === '/login'");
  assert.equal(await newTab.evaluate("sessionStorage.getItem('restaurant_qr_access_token')"), null);
  console.log('PASS production: refresh SPA, health, API 404, login seed; tab mới độc lập cần đăng nhập');

  await guest.navigate(`/menu/${table.qrToken}`);
  await guest.wait("!!document.getElementById('customer-name')");
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') assert.equal(await guest.evaluate('isSecureContext'), false);
  await guest.fill('customer-name', 'Khách kiểm thử production');
  await guest.click('Bắt đầu gọi món');
  for (const [index, product] of products.entries()) {
    await guest.wait(`!!document.querySelector('[data-product-id="${product.id}"] button')`);
    await guest.evaluate(`document.querySelector('[data-product-id="${product.id}"] button').click()`);
    await guest.wait("!!document.getElementById('add-note')");
    if (index === 0) await guest.fill('add-note', 'ít đá');
    await guest.evaluate("document.getElementById('add-note').closest('form').requestSubmit()");
    await guest.wait("!document.getElementById('add-note')");
  }
  await guest.navigate(`/menu/${table.qrToken}/cart`);
  await guest.wait("document.querySelectorAll('[data-cart-product-id]').length === 2");
  await guest.fill('order-note', 'Mang đồ uống ra trước');
  await guest.width();
  await guest.click('Gửi order');
  await guest.wait("location.pathname.startsWith('/orders/') && !!document.querySelector('[data-order-code]')");
  await guest.connected();
  const orderId = await guest.evaluate("location.pathname.split('/').at(-1)");
  const order = await Order.findById(orderId);
  assert.equal(order.totalAmount, expectedTotal);
  assert.equal(order.items[0].note, 'ít đá');
  assert.equal(order.note, 'Mang đồ uống ra trước');
  await staff.wait(`!!document.querySelector('[data-internal-order-id="${orderId}"]')`);
  await tablePage.wait(`!!document.querySelector('[data-table-id="${table.id}"] [data-table-occupancy="occupied"]')`);
  await guest.navigate(`/orders/${orderId}`);
  await guest.connected();
  await guest.status('pending');
  await guest.width();
  console.log('PASS production: menu -> giỏ -> order hai món/ghi chú -> staff tự nhận; reload giữ tracking');

  await staff.navigate(`/staff/orders/${orderId}`);
  await staff.connected();
  await staff.click('Xác nhận đơn');
  await guest.status('confirmed');
  // Tắt mạng guest và đóng transport đang mở để thật sự bỏ lỡ một event.
  await guest.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  for (const socket of realtime.io.sockets.sockets.values()) {
    if (socket.rooms.has(`order:${orderId}`)) socket.conn.close();
  }
  await guest.wait("document.querySelector('[data-realtime-state]')?.dataset.realtimeState === 'offline'");
  await staff.click('Bắt đầu chuẩn bị');
  await staff.status('preparing');
  await pause(600);
  await guest.status('confirmed');
  await guest.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await guest.connected();
  await guest.status('preparing');
  await staff.click('Đã phục vụ');
  await guest.status('served');
  await staff.click('Xác nhận thanh toán & hoàn thành');
  await staff.wait("!!document.querySelector('input[type=checkbox]')");
  await staff.evaluate("document.querySelector('input[type=checkbox]').click()");
  await staff.click('Đã nhận tiền & hoàn thành');
  await guest.status('completed');
  await admin.metric('revenue', baselineRevenue + expectedTotal);
  await tablePage.wait(`!!document.querySelector('[data-table-id="${table.id}"] [data-table-occupancy="empty"]')`);
  assert.equal(await Order.countDocuments({ tableId: table._id, status: { $in: ['pending', 'confirmed', 'preparing', 'served'] } }), 0);
  await staff.navigate('/staff/tables');
  await staff.wait("document.body.innerText.includes('Bàn 05')");
  await staff.width();
  console.log('PASS production: đủ trạng thái, mất mạng/rejoin/refetch, dashboard cập nhật, Bàn 05 hết đơn đang xử lý');

  for (const target of [admin, staff, guest, tablePage]) {
    await target.width();
    assert.deepEqual(target.exceptions, []);
    assert.deepEqual([...target.requestOrigins], [baseURL]);
  }
  console.log('PASS API cùng origin, Socket.IO cùng HTTP server, CLIENT_ORIGIN trống, 375px không tràn ngang');
  console.log(hostname === '127.0.0.1' ? 'Môi trường: Chrome desktop localhost; không phải điện thoại thật.' : 'Môi trường: Chrome desktop qua IP LAN/HTTP không secure context; không phải điện thoại thật.');
} finally {
  for (const contextId of new Set(pages.map((target) => target.contextId))) {
    if (browser) await browser.send('Target.disposeBrowserContext', { browserContextId: contextId }).catch(() => {});
  }
  for (const target of pages) target.socket.close();
  browser?.socket.close();
  if (realtime) await realtime.close();
  else if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
