// Chạy sau khi backend/frontend và Chrome debug 9224 đã mở (xem GIAI_DOAN_5.md).
// Tạo dữ liệu mang hậu tố ngẫu nhiên, chỉ dọn đúng dữ liệu của lần kiểm thử này.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import mongoose from 'mongoose';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import Table from '../src/models/Table.js';
import Order from '../src/models/Order.js';

const config = parseEnv(
  await readFile(new URL('../.env', import.meta.url), 'utf8'),
);
const frontend = config.CLIENT_ORIGIN;
const backend = `http://localhost:${config.PORT || 3000}/api`;
const debugURL = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9224';
const page = await (
  await fetch(`${debugURL}/json/new?about:blank`, { method: 'PUT' })
).json();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let counter = 0;
const pending = new Map();
const exceptions = [];
const requests = [];
let pausedOrderResponse;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(task.timer);
    if (message.error) task.reject(new Error(JSON.stringify(message.error)));
    else task.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown')
    exceptions.push(message.params);
  if (
    message.method === 'Network.requestWillBeSent' &&
    message.params.request.url.startsWith(backend)
  )
    requests.push(message.params.request);
  if (message.method === 'Fetch.requestPaused') {
    if (message.params.request.method === 'POST')
      pausedOrderResponse = message.params;
    else
      void send('Fetch.continueRequest', {
        requestId: message.params.requestId,
      });
  }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++counter;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      `Browser expression failed: ${result.exceptionDetails.text}`,
    );
  return result.result.value;
}
async function waitFor(expression) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Condition failed: ${expression}\n${await evaluate('document.body.innerText')}`,
  );
}
const hasText = (value) =>
  waitFor(`document.body.innerText.includes(${JSON.stringify(value)})`);
async function navigate(path) {
  await send('Page.navigate', { url: `${frontend}${path}` });
  await waitFor(
    `location.pathname === ${JSON.stringify(path)} && !!document.querySelector('h1')`,
  );
}
async function reload() {
  await evaluate('window.__stage5ReloadMarker = true');
  await send('Page.reload');
  await waitFor(
    '!window.__stage5ReloadMarker && document.readyState === "complete" && !!document.querySelector("h1")',
  );
}
async function fill(values) {
  await evaluate(`(() => {
    for (const [id, value] of Object.entries(${JSON.stringify(values)})) {
      const input = document.getElementById(id);
      const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
}
async function clickText(value, container = 'document') {
  await evaluate(
    `[...${container}.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(value)}).click()`,
  );
}
const productRow = (id) =>
  `document.querySelector('[data-product-id="${id}"]')`;
const cartRow = (id) =>
  `document.querySelector('[data-cart-product-id="${id}"]')`;
const submit = () => evaluate("document.querySelector('form').requestSubmit()");
const noOverflow = async () =>
  assert.equal(
    await evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true,
    'Không tràn ngang ở 375px',
  );
const readStored = (table) =>
  evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(`restaurant_qr_cart:v1:${table.qrToken}`)}))`,
  );
async function add(product, quantity = 1, note = '') {
  await waitFor(`!!${productRow(product.id)}`);
  await clickText('Thêm vào giỏ', productRow(product.id));
  await waitFor("!!document.querySelector('#add-quantity')");
  await fill({ 'add-quantity': String(quantity), 'add-note': note });
  await evaluate("document.querySelector('dialog form').requestSubmit()");
  await waitFor("!document.querySelector('dialog')");
}
let category, coffee, cake, soldOut, table, otherTable;
await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  const suffix = randomBytes(5).toString('hex');
  category = await Category.create({ name: `Danh mục thử giỏ ${suffix}` });
  coffee = await Product.create({
    name: `Cà phê thử ${suffix}`,
    price: 35000,
    imageUrl: '/images/coffee.svg',
    categoryId: category.id,
  });
  cake = await Product.create({
    name: `Bánh thử ${suffix}`,
    price: 25000,
    categoryId: category.id,
  });
  soldOut = await Product.create({
    name: `Món hết thử ${suffix}`,
    price: 12000,
    categoryId: category.id,
    isAvailable: false,
  });
  table = await Table.create({ name: `Bàn giỏ A ${suffix}`, capacity: 4 });
  otherTable = await Table.create({ name: `Bàn giỏ B ${suffix}`, capacity: 2 });
  const menu = `/menu/${table.qrToken}`;
  const cart = `${menu}/cart`;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await navigate(menu);
  await waitFor("!!document.querySelector('#customer-name')");
  await fill({ 'customer-name': 'Nguyễn Văn A' });
  await submit();
  await hasText('Thực đơn hôm nay');
  await waitFor(`!!${productRow(soldOut.id)}`);
  assert.equal(
    await evaluate(
      `${productRow(soldOut.id)}.querySelector('button').disabled`,
    ),
    true,
  );
  await add(coffee, 2, 'Ít đá');
  await hasText('Giỏ hàng (2)');
  await add(cake);
  await hasText('Giỏ hàng (3)');
  await noOverflow();
  console.log(
    'PASS nhập tên, thêm món/số lượng/ghi chú; món hết bị khóa; menu 375px',
  );

  await navigate(cart);
  await hasText(table.name);
  await hasText('Nguyễn Văn A');
  await evaluate(
    `${cartRow(coffee.id)}.querySelector('button[aria-label^="Tăng"]').click()`,
  );
  await waitFor(
    `${cartRow(coffee.id)}.querySelector('[aria-label="Số lượng"]').textContent === '3'`,
  );
  await evaluate(
    `${cartRow(coffee.id)}.querySelector('button[aria-label^="Giảm"]').click()`,
  );
  await waitFor(
    `${cartRow(coffee.id)}.querySelector('[aria-label="Số lượng"]').textContent === '2'`,
  );
  await clickText('Xóa món', cartRow(cake.id));
  await waitFor(`!${cartRow(cake.id)}`);
  await fill({
    [`note-${coffee.id}`]: 'Ít đá, không đường',
    'order-note': 'Mang nước trước',
  });
  assert.equal((await readStored(table)).items[0].note, 'Ít đá, không đường');
  await noOverflow();
  await reload();
  await hasText(table.name);
  await waitFor(
    `document.getElementById('note-${coffee.id}')?.value === 'Ít đá, không đường'`,
  );
  assert.equal(
    await evaluate("document.getElementById('order-note').value"),
    'Mang nước trước',
  );
  assert.equal((await readStored(table)).items[0].quantity, 2);
  console.log('PASS tăng/giảm, xóa món, ghi chú món/đơn, refresh giữ giỏ');

  await navigate(`/menu/${otherTable.qrToken}/cart`);
  await hasText('Giỏ hàng đang rỗng');
  await hasText('Chưa nhập tên');
  assert.equal(await evaluate(`!!${cartRow(coffee.id)}`), false);
  await navigate(`/menu/${otherTable.qrToken}`);
  await waitFor("!!document.querySelector('#customer-name')");
  await fill({ 'customer-name': 'Khách B' });
  await submit();
  await hasText('Thực đơn hôm nay');
  await add(cake);
  await navigate(cart);
  await hasText(table.name);
  await waitFor(`!!${cartRow(coffee.id)}`);
  assert.equal(await evaluate(`!!${cartRow(cake.id)}`), false);
  assert.equal((await readStored(otherTable)).items[0].productId, cake.id);
  console.log('PASS hai QR có giỏ và tên riêng, chuyển qua lại không lẫn món');

  // Món đã hết sau khi thêm giỏ: API từ chối, không xóa giỏ và cho sửa.
  await Product.updateOne({ _id: coffee.id }, { isAvailable: false });
  await clickText('Gửi order');
  await hasText('đã tạm hết. Hãy xóa món khỏi giỏ.');
  assert.equal((await readStored(table)).items.length, 1);
  assert.equal((await readStored(table)).pending, null);
  assert.equal(await Order.countDocuments({ tableId: table.id }), 0);
  await Product.updateOne({ _id: coffee.id }, { isAvailable: true });
  console.log('PASS lỗi nghiệp vụ giữ nguyên giỏ, không tạo đơn');

  // Ngắt mạng trước khi request đến server; reload vẫn giữ requestId để thử lại.
  await send('Network.setBlockedURLs', { urls: [`${backend}/public/orders`] });
  await clickText('Gửi order');
  await hasText('Chưa nhận được kết quả.');
  const failed = await readStored(table);
  assert(failed.pending?.requestId);
  assert.equal(failed.items.length, 1);
  assert.equal(await Order.countDocuments({ tableId: table.id }), 0);
  await send('Network.setBlockedURLs', { urls: [] });
  await reload();
  await hasText('Kiểm tra lại lần gửi');
  assert.equal(
    (await readStored(table)).pending.requestId,
    failed.pending.requestId,
  );
  assert.equal(
    await evaluate("document.querySelector('fieldset').disabled"),
    true,
  );
  await clickText('Kiểm tra lại lần gửi');
  await hasText('Đơn của bạn');
  await hasText('Chờ xác nhận');
  await waitFor("!!document.querySelector('[data-order-code]')");
  const first = await Order.findOne({ tableId: table.id });
  assert(first);
  assert.equal(first.totalAmount, 70000);
  assert.equal(first.items[0].note, 'Ít đá, không đường');
  assert.equal(first.note, 'Mang nước trước');
  assert.equal(await evaluate('location.pathname'), `/orders/${first.id}`);
  const success = await readStored(table);
  assert.equal(success.items.length, 0);
  assert.equal(success.note, '');
  assert.equal(success.pending, null);
  assert.equal(success.orders[0].orderId, first.id);
  assert.match(success.orders[0].trackingToken, /^[a-f0-9]{64}$/);
  await hasText('Nguyễn Văn A');
  await hasText(table.name);
  await hasText('Ít đá, không đường');
  await hasText('Mang nước trước');
  await noOverflow();
  await clickText('Làm mới trạng thái');
  await hasText('Chờ xác nhận');
  await reload();
  await hasText('Chờ xác nhận');
  console.log(
    'PASS lỗi mạng giữ giỏ/requestId qua reload; retry tạo đúng đơn, lưu token, xóa giỏ sau thành công và xem/làm mới đơn',
  );

  // Lần đặt thực sự thứ hai; giá đổi sau khi thêm giỏ, backend vẫn tính giá mới.
  await navigate(menu);
  await hasText('Thực đơn hôm nay');
  await hasText(first.orderCode);
  await add(cake, 2, 'Cắt nhỏ');
  await navigate(cart);
  await hasText(table.name);
  await Product.updateOne({ _id: cake.id }, { price: 30000 });
  await send('Fetch.enable', {
    patterns: [
      { urlPattern: `${backend}/public/orders`, requestStage: 'Response' },
    ],
  });
  // Bấm hai lần ngay lập tức: frontend khóa; backend vẫn có unique index bảo vệ.
  await evaluate(
    "(() => { const form = document.querySelector('form'); form.requestSubmit(); form.requestSubmit(); })()",
  );
  const deadline = Date.now() + 10000;
  while (!pausedOrderResponse && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert(pausedOrderResponse, 'Phải bắt được response sau khi MongoDB đã lưu');
  assert.equal(pausedOrderResponse.responseStatusCode, 201);
  assert.equal(await Order.countDocuments({ tableId: table.id }), 2);
  const beforeResponse = await readStored(table);
  assert.equal(
    beforeResponse.items.length,
    1,
    'Chưa nhận xác nhận thì chưa xóa giỏ',
  );
  assert(beforeResponse.pending);
  await send('Fetch.failRequest', {
    requestId: pausedOrderResponse.requestId,
    errorReason: 'ConnectionReset',
  });
  await send('Fetch.disable');
  pausedOrderResponse = null;
  await hasText('Chưa nhận được kết quả.');
  assert.equal((await readStored(table)).items.length, 1);
  await reload();
  await hasText('Kiểm tra lại lần gửi');
  await clickText('Kiểm tra lại lần gửi');
  await hasText('Chờ xác nhận');
  const second = await Order.findOne({
    tableId: table.id,
    _id: { $ne: first._id },
  });
  assert(second);
  assert.equal(second.totalAmount, 60000);
  assert.equal(await evaluate('location.pathname'), `/orders/${second.id}`);
  assert.equal(
    await Order.countDocuments({ tableId: table.id }),
    2,
    'Retry không được tạo đơn thứ ba',
  );
  assert.equal((await readStored(table)).orders.length, 2);
  await hasText('Cắt nhỏ');
  await noOverflow();
  console.log(
    'PASS mất phản hồi SAU khi lưu MongoDB; bấm đôi/reload/retry không tạo trùng; hai lần đặt có hai đơn; giá chính thức lấy từ DB',
  );

  await navigate(menu);
  await hasText(first.orderCode);
  await hasText(second.orderCode);
  await evaluate(
    `document.querySelector('a[href="/orders/${first.id}"]').click()`,
  );
  await hasText(first.orderCode);
  await hasText('Mang nước trước');
  // Xóa token riêng của đơn trong dữ liệu thử, kiểm tra chỉ URL không đủ đọc đơn.
  const remembered = await readStored(table);
  await evaluate(
    `(() => { const key = ${JSON.stringify(`restaurant_qr_cart:v1:${table.qrToken}`)}; const value = JSON.parse(localStorage.getItem(key)); value.orders = value.orders.filter(order => order.orderId !== ${JSON.stringify(first.id)}); localStorage.setItem(key, JSON.stringify(value)); })()`,
  );
  await reload();
  await hasText('Trình duyệt này không có mã xem đơn.');
  assert.equal(
    await evaluate("!!document.querySelector('[data-order-total]')"),
    false,
  );
  await evaluate(
    `localStorage.setItem(${JSON.stringify(`restaurant_qr_cart:v1:${table.qrToken}`)}, ${JSON.stringify(JSON.stringify(remembered))})`,
  );
  await reload();
  await hasText('Chờ xác nhận');
  await send('Network.setBlockedURLs', {
    urls: [`${backend}/public/orders/*`],
  });
  await clickText('Làm mới trạng thái');
  await hasText('Không kết nối được máy chủ.');
  await send('Network.setBlockedURLs', { urls: [] });
  await clickText('Thử lại');
  await hasText('Chờ xác nhận');
  // Hết dung lượng đúng lúc lưu token: không được xóa giỏ hay mất khả năng retry.
  await navigate(menu);
  await hasText('Thực đơn hôm nay');
  await add(coffee);
  await navigate(cart);
  await hasText(table.name);
  await evaluate(`(() => {
    window.__originalStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === ${JSON.stringify(`restaurant_qr_cart:v1:${table.qrToken}`)}) {
        const next = JSON.parse(value); const current = JSON.parse(this.getItem(key));
        if (next.orders.length > current.orders.length) throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return window.__originalStorageSetItem.call(this, key, value);
    };
  })()`);
  await clickText('Gửi order');
  await hasText('Không lưu được giỏ hàng.');
  const storageFailed = await readStored(table);
  assert(storageFailed.pending);
  assert.equal(storageFailed.items.length, 1);
  assert.equal(storageFailed.orders.length, 2);
  assert.equal(await Order.countDocuments({ tableId: table.id }), 3);
  await evaluate('Storage.prototype.setItem = window.__originalStorageSetItem');
  await clickText('Kiểm tra lại lần gửi');
  await hasText('Chờ xác nhận');
  assert.equal(await Order.countDocuments({ tableId: table.id }), 3);
  assert.equal((await readStored(table)).items.length, 0);
  assert.equal((await readStored(table)).orders.length, 3);
  console.log(
    'PASS lỗi lưu token giữ giỏ/lần gửi; khôi phục storage rồi retry mở đúng đơn, không nhân đôi',
  );
  assert.equal(exceptions.length, 0, 'Không có lỗi JavaScript chưa được xử lý');
  assert(
    requests.every(
      (request) =>
        !Object.keys(request.headers).some(
          (key) => key.toLowerCase() === 'authorization',
        ),
    ),
  );
  assert(
    requests.every(
      (request) =>
        !request.url.includes('trackingToken') &&
        !request.url.includes('/auth/'),
    ),
  );
  assert(
    requests.some((request) =>
      Object.keys(request.headers).some(
        (key) => key.toLowerCase() === 'x-order-token',
      ),
    ),
  );
  console.log(
    'PASS mở lại từng đơn, thiếu token không lộ dữ liệu, lỗi/làm mới trang đơn, khách không gửi JWT/token trong URL',
  );
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    '/private/tmp/restaurant-qr-stage5-order-mobile.png',
    Buffer.from(screenshot.data, 'base64'),
  );
  console.log('PASS toàn bộ kiểm thử Chrome giai đoạn 5');
} finally {
  await send('Network.setBlockedURLs', { urls: [] });
  await send('Fetch.disable');
  for (const testTable of [table, otherTable].filter(Boolean)) {
    await evaluate(
      `localStorage.removeItem(${JSON.stringify(`restaurant_qr_cart:v1:${testTable.qrToken}`)})`,
    ).catch(() => {});
    await Order.deleteMany({ tableId: testTable._id });
    await Table.deleteOne({ _id: testTable._id });
  }
  if (category) {
    await Product.deleteMany({ categoryId: category._id });
    await Category.deleteOne({ _id: category._id });
  }
  await mongoose.disconnect();
  socket.close();
  await fetch(`${debugURL}/json/close/${page.id}`);
}
