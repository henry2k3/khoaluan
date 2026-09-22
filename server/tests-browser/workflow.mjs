// Kiểm thử Chrome thật, API đang chạy và MongoDB cục bộ. Xem GIAI_DOAN_6.md.
// Chỉ tạo/xóa các bản ghi mang ID của lần thử này; không sửa dữ liệu demo có sẵn.
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
  // Đánh dấu để không vô tình kiểm tra DOM cũ trước khi điều hướng xong.
  await evaluate('window.__workflowNavigation = true');
  await send('Page.navigate', { url: `${frontend}${path}` });
  await waitFor(
    `!window.__workflowNavigation && location.pathname === ${JSON.stringify(path.split('?')[0])} && !!document.querySelector('h1')`,
  );
}
async function fill(values) {
  await evaluate(`(() => {
    for (const [id, value] of Object.entries(${JSON.stringify(values)})) {
      const input = document.getElementById(id);
      const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
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
const submit = (selector = 'form') =>
  evaluate(
    `document.querySelector(${JSON.stringify(selector)}).requestSubmit()`,
  );
const statusIs = (status) =>
  waitFor(
    `document.querySelector('[data-order-status]')?.dataset.orderStatus === '${status}'`,
  );
const noOverflow = async () =>
  assert.equal(
    await evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true,
    'Không tràn ngang ở 375px',
  );
const noAction = async (label) =>
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll('[data-order-actions] button')].some(button => button.textContent === ${JSON.stringify(label)})`,
    ),
    false,
  );
async function api(path, method = 'GET', body, token) {
  const response = await fetch(`${backend}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert(
    response.ok,
    `${method} ${path}: ${response.status} ${result.message}`,
  );
  return result.data;
}
let category, product, table;
const users = [];
const password = randomBytes(20).toString('hex');
async function login(user) {
  await navigate('/');
  await evaluate("sessionStorage.removeItem('restaurant_qr_access_token')");
  await navigate('/login');
  await waitFor("!!document.querySelector('#username')");
  await fill({ username: user.username, password });
  await submit();
  await waitFor(`location.pathname === '/${user.role}'`);
}
async function createOrder() {
  return api('/public/orders', 'POST', {
    qrToken: table.qrToken,
    customerName: 'Khách thử giai đoạn 6',
    items: [{ productId: product.id, quantity: 2, note: 'Ít đường' }],
    note: 'Mang nước trước',
    requestId: randomBytes(32).toString('hex'),
  });
}
async function detail(order, prefix = '/staff/orders') {
  await navigate(`${prefix}/${order.orderId}`);
  await hasText(order.orderCode);
  await waitFor("!!document.querySelector('[data-order-actions]')");
}
async function completeInUI() {
  await clickText('Xác nhận thanh toán & hoàn thành');
  await waitFor("!!document.querySelector('dialog')");
  await noOverflow();
  await submit('dialog form');
  assert.equal(
    await evaluate(
      "document.querySelector('dialog input[type=checkbox]').validity.valueMissing",
    ),
    true,
  );
  await evaluate(
    "document.querySelector('dialog input[type=checkbox]').click()",
  );
  await submit('dialog form');
  await statusIs('completed');
  await waitFor("!document.querySelector('dialog')");
}
async function cancelInUI(reason) {
  await clickText('Hủy đơn');
  await waitFor("!!document.querySelector('#cancel-reason')");
  await submit('dialog form');
  assert.equal(
    await evaluate(
      "document.querySelector('#cancel-reason').validity.valueMissing",
    ),
    true,
  );
  await fill({ 'cancel-reason': reason });
  await noOverflow();
  await submit('dialog form');
  await statusIs('cancelled');
  await hasText(reason);
}
const tableRow = () =>
  `document.querySelector('[data-table-id="${table.id}"]')`;
async function tableCount(count) {
  await navigate('/staff/tables');
  await waitFor(`!!${tableRow()}`);
  await waitFor(`${tableRow()}.innerText.includes('${count} đơn đang xử lý')`);
  assert.equal(
    await evaluate(
      `${tableRow()}.querySelector('[data-table-occupancy]').dataset.tableOccupancy`,
    ),
    count ? 'occupied' : 'empty',
  );
  await noOverflow();
}
await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  const suffix = randomBytes(5).toString('hex');
  for (const [index, role] of ['staff', 'staff', 'admin'].entries()) {
    users.push(
      await createInternalUser({
        fullName: `Nhân sự thử ${index} ${suffix}`,
        username: `workflow_${index}_${suffix}`,
        password,
        role,
      }),
    );
  }
  const otherToken = (
    await api('/auth/login', 'POST', { username: users[1].username, password })
  ).accessToken;
  category = await Category.create({ name: `Danh mục xử lý thử ${suffix}` });
  product = await Product.create({
    name: `Cà phê xử lý thử ${suffix}`,
    categoryId: category.id,
    price: 35000,
  });
  table = await Table.create({ name: `Bàn xử lý thử ${suffix}`, capacity: 4 });
  const first = await createOrder();
  const second = await createOrder();
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await login(users[0]);
  await navigate(`/staff/orders?tableId=${table.id}`);
  await waitFor(
    `!!document.querySelector('[data-internal-order-id="${first.orderId}"]')`,
  );
  await noOverflow();
  await evaluate(
    `document.querySelector('[data-internal-order-id="${first.orderId}"] a').click()`,
  );
  await statusIs('pending');
  await hasText('Ít đường');
  await hasText('Mang nước trước');
  await clickText('Xác nhận đơn');
  await statusIs('confirmed');
  await clickText('Bắt đầu chuẩn bị');
  await statusIs('preparing');
  await noAction('Hủy đơn');
  await clickText('Đã phục vụ');
  await statusIs('served');
  await noAction('Hủy đơn');
  await completeInUI();
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-order-actions] button').length",
    ),
    0,
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-status-history] li').length",
    ),
    5,
  );
  await hasText(users[0].fullName);
  await waitFor("!!document.querySelector('[data-paid-at]')");
  await noOverflow();
  assert.equal((await Order.findById(first.orderId)).status, 'completed');
  console.log(
    'PASS staff login, danh sách/chi tiết, đủ 4 bước, xác nhận đã nhận tiền, lịch sử và paidAt; mobile 375px',
  );

  await tableCount(1);
  await evaluate(`${tableRow()}.querySelector('a').click()`);
  await waitFor(
    `!!document.querySelector('[data-internal-order-id="${second.orderId}"]')`,
  );
  assert.equal(
    await evaluate(
      `!!document.querySelector('[data-internal-order-id="${first.orderId}"]')`,
    ),
    false,
  );
  await detail(second);
  await cancelInUI('Khách đổi ý, chưa chế biến');
  await hasText(users[0].fullName);
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-order-actions] button').length",
    ),
    0,
  );
  await tableCount(0);
  console.log(
    'PASS bàn nhiều đơn: hoàn thành một đơn vẫn bận; hủy đơn còn lại thì trống; lọc đơn theo bàn',
  );

  const third = await createOrder();
  await detail(third);
  await clickText('Xác nhận đơn');
  await statusIs('confirmed');
  await cancelInUI('Hủy sau xác nhận');
  const cancelled = await Order.findById(third.orderId);
  assert.equal(String(cancelled.cancelledBy), users[0].id);
  assert(cancelled.cancelledAt);
  console.log(
    'PASS hủy pending/confirmed bắt buộc lý do, lưu người/thời gian, không còn hành động khi đã hủy',
  );

  const conflict = await createOrder();
  await detail(conflict);
  await statusIs('pending');
  await api(
    `/orders/${conflict.orderId}/status`,
    'PATCH',
    { expectedStatus: 'pending', status: 'confirmed' },
    otherToken,
  );
  // Trình duyệt vẫn thấy pending. API thật phải trả 409 cho thao tác cũ.
  await clickText('Xác nhận đơn');
  await hasText('Đơn đã được người khác cập nhật');
  await statusIs('confirmed');
  await hasText('Bắt đầu chuẩn bị');
  assert.equal(
    (await Order.findById(conflict.orderId)).statusHistory.length,
    2,
  );
  await noOverflow();
  console.log(
    'PASS nhân viên khác cập nhật trước: 409, hiển thị lỗi và tự tải lại đúng trạng thái, không tự chuyển bước tiếp',
  );

  await send('Network.setBlockedURLs', {
    urls: [`${backend}/orders/${conflict.orderId}*`],
  });
  await clickText('Bắt đầu chuẩn bị');
  await waitFor("!!document.querySelector('[role=alert]')");
  await hasText('Thử lại');
  assert.equal((await Order.findById(conflict.orderId)).status, 'confirmed');
  await send('Network.setBlockedURLs', { urls: [] });
  await clickText('Thử lại');
  await statusIs('confirmed');
  await clickText('Bắt đầu chuẩn bị');
  await statusIs('preparing');
  await noAction('Hủy đơn');
  console.log(
    'PASS lỗi mạng khi xử lý/tải chi tiết được hiển thị, thử lại tải dữ liệu và tiếp tục đúng bước',
  );

  const saved = {
    version: 1,
    customerName: 'Khách thử giai đoạn 6',
    items: [],
    note: '',
    pending: null,
    orders: [first, second, conflict],
  };
  await evaluate(
    `localStorage.setItem(${JSON.stringify(`restaurant_qr_cart:v1:${table.qrToken}`)}, ${JSON.stringify(JSON.stringify(saved))})`,
  );
  await navigate(`/orders/${conflict.orderId}`);
  await statusIs('preparing');
  await api(
    `/orders/${conflict.orderId}/status`,
    'PATCH',
    { expectedStatus: 'preparing', status: 'served' },
    otherToken,
  );
  // Không realtime: chỉ đổi trên màn hình sau khi khách bấm làm mới.
  assert.equal(
    await evaluate(
      "document.querySelector('[data-order-status]').dataset.orderStatus",
    ),
    'preparing',
  );
  await clickText('Làm mới trạng thái');
  await statusIs('served');
  await noOverflow();
  // OPTIONS chỉ hỏi quyền CORS, không mang token. Kiểm tra token ở GET đọc đơn thực tế.
  const guestRequests = requests.filter(
    (request) =>
      request.method === 'GET' &&
      request.url.includes(`/public/orders/${conflict.orderId}`),
  );
  assert(guestRequests.length >= 2);
  assert(
    guestRequests.every((request) =>
      Object.keys(request.headers).some(
        (key) => key.toLowerCase() === 'x-order-token',
      ),
    ),
  );
  assert(
    guestRequests.every(
      (request) =>
        !Object.keys(request.headers).some(
          (key) => key.toLowerCase() === 'authorization',
        ),
    ),
  );
  assert(
    guestRequests.every(
      (request) => !request.url.includes(conflict.trackingToken),
    ),
  );
  await navigate(`/orders/${second.orderId}`);
  await statusIs('cancelled');
  await hasText('Khách đổi ý, chưa chế biến');
  await navigate(`/orders/${first.orderId}`);
  await statusIs('completed');
  await waitFor("!!document.querySelector('[data-paid-at]')");
  console.log(
    'PASS khách làm mới thấy trạng thái mới, thông tin hủy/thanh toán; giữ X-Order-Token, không JWT hay token trong URL',
  );

  const extra = [];
  for (let index = 0; index < 6; index += 1) extra.push(await createOrder());
  await navigate(`/staff/orders?tableId=${table.id}&status=pending&limit=5`);
  await hasText('Trang 1 / 2 · 6 đơn');
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-internal-order-id]').length",
    ),
    5,
  );
  await noOverflow();
  await clickText('Trang sau');
  await hasText('Trang 2 / 2 · 6 đơn');
  assert.equal(
    await evaluate(
      "document.querySelectorAll('[data-internal-order-id]').length",
    ),
    1,
  );
  await fill({
    'order-code-filter': first.orderCode,
    'order-status-filter': 'completed',
  });
  await submit();
  await hasText('Trang 1 / 1 · 1 đơn');
  await waitFor(
    `!!document.querySelector('[data-internal-order-id="${first.orderId}"]')`,
  );
  await fill({ 'order-code-filter': 'ORD-NOT-FOUND' });
  await submit();
  await hasText('Không có đơn phù hợp.');
  await send('Network.setBlockedURLs', { urls: [`${backend}/orders*`] });
  await clickText('Làm mới danh sách');
  await hasText('Thử lại');
  await send('Network.setBlockedURLs', { urls: [] });
  await clickText('Thử lại');
  await hasText('Không có đơn phù hợp.');
  console.log(
    'PASS bộ lọc trạng thái/bàn/mã, phân trang 5+1, dữ liệu rỗng, lỗi danh sách và thử lại',
  );

  await login(users[2]);
  await navigate(`/admin/orders?tableId=${table.id}`);
  await waitFor(
    `!!document.querySelector('[data-internal-order-id="${extra[0].orderId}"]')`,
  );
  await detail(extra[0], '/admin/orders');
  await clickText('Xác nhận đơn');
  await statusIs('confirmed');
  await hasText(users[2].fullName);
  await noOverflow();
  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    '/private/tmp/restaurant-qr-stage6-detail-mobile.png',
    Buffer.from(screenshot.data, 'base64'),
  );
  await navigate('/admin/tables');
  await hasText(table.name);
  await hasText('Thêm bàn');
  await hasText('Đang sử dụng');
  await noOverflow();
  assert.equal(exceptions.length, 0, 'Không có lỗi JavaScript chưa xử lý');
  console.log(
    'PASS admin dùng chung giao diện để xử lý đơn, giữ quản lý bàn; không lỗi JavaScript; toàn bộ Chrome giai đoạn 6',
  );
} finally {
  await send('Network.setBlockedURLs', { urls: [] });
  await evaluate(
    "sessionStorage.removeItem('restaurant_qr_access_token')",
  ).catch(() => {});
  if (table) {
    await evaluate(
      `localStorage.removeItem(${JSON.stringify(`restaurant_qr_cart:v1:${table.qrToken}`)})`,
    ).catch(() => {});
    await Order.deleteMany({ tableId: table._id });
    await Table.deleteOne({ _id: table._id });
  }
  if (category) {
    await Product.deleteMany({ categoryId: category._id });
    await Category.deleteOne({ _id: category._id });
  }
  await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });
  await mongoose.disconnect();
  socket.close();
  await fetch(`${debugURL}/json/close/${page.id}`);
}
