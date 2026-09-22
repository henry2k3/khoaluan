import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { getHealth } from '../src/controllers/healthController.js';
import { validateFields } from '../src/utils/catalogValidation.js';
import { validateOrder } from '../src/utils/orderValidation.js';
import { orderListQuery } from '../src/utils/internalOrderValidation.js';

// Chuỗi giả để phát hiện lộ dữ liệu. Không dùng secret hoặc đường dẫn thật.
const privateMarker = 'PRIVATE_TEST_ONLY mongodb://fake:password@invalid/db /private/example JWT_TEST';
const cases = [
  ['MongooseServerSelectionError', 503],
  ['MongoServerSelectionError', 503],
  ['MongoNetworkError', 503],
  ['MongoNetworkTimeoutError', 503],
  ['MongoNotConnectedError', 503],
  ['MongoTopologyClosedError', 503],
  ['MongoServerClosedError', 503],
  ['MongoPoolClearedError', 503],
  ['buffer', 503],
  ['ValidationError', 400],
  ['CastError', 400],
  ['duplicate', 409],
  ['Error', 500],
  ['MongooseError', 500],
];
let server;
let baseURL;

describe('9A — lỗi production, health và đầu vào', { concurrency: false }, () => {
  before(async () => {
    process.env.NODE_ENV = 'production';
    const app = express();
    assert.equal(app.get('env'), 'production');
    app.use(express.json({ limit: '100kb' }));
    app.get('/health', getHealth);
    app.all('/error/:kind', (req, res, next) => {
      const error = new Error(privateMarker);
      error.stack = `${privateMarker}\n at simulatedInternalFunction`;
      error.name = req.params.kind;
      if (error.name === 'buffer') {
        error.name = 'MongooseError';
        error.message = `Operation orders.find() buffering timed out after 10000ms ${privateMarker}`;
      }
      if (error.name === 'duplicate') error.code = 11000;
      next(error);
    });
    app.use(errorHandler);
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    baseURL = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  for (const [kind, status] of cases) {
    it(`${kind}: HTTP ${status}, không lộ lỗi thô/stack/secret trong response hoặc log`, async (t) => {
      const logged = [];
      t.mock.method(console, 'error', (...args) => logged.push(args.join(' ')));
      const response = await fetch(`${baseURL}/error/${kind}`);
      assert.equal(response.status, status);
      const body = await response.json();
      assert.deepEqual(Object.keys(body).sort(), ['message', 'success']);
      assert.equal(body.success, false);
      assert.equal(typeof body.message, 'string');
      for (const text of [JSON.stringify(body), ...logged]) {
        for (const marker of ['PRIVATE_TEST_ONLY', 'mongodb://', '/private/example', 'JWT_TEST', 'simulatedInternalFunction']) {
          assert(!text.includes(marker));
        }
      }
      if (status >= 500) assert.equal(logged.length, 1);
    });
  }

  it('JSON hỏng trả 400 an toàn khi production', async (t) => {
    t.mock.method(console, 'error', () => {});
    const response = await fetch(`${baseURL}/error/Error`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: `{"password":"${privateMarker}",`,
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { success: false, message: 'Dữ liệu JSON không hợp lệ.' });
  });

  it('JSON quá lớn trả 413 an toàn khi production', async (t) => {
    t.mock.method(console, 'error', () => {});
    const response = await fetch(`${baseURL}/error/Error`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: privateMarker, note: 'x'.repeat(110000) }),
    });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { success: false, message: 'Dữ liệu gửi lên vượt quá giới hạn cho phép.' });
  });

  it('health khi chưa kết nối DB trả 503, server vẫn trả lời và không lộ cấu hình', async () => {
    assert.equal(mongoose.connection.readyState, 0);
    const response = await fetch(`${baseURL}/health`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Backend đang chạy nhưng chưa kết nối được MongoDB.',
      data: { backend: 'running', database: 'disconnected' },
    });
  });

  it('health có readyState connected nhưng ping lỗi vẫn báo disconnected', async () => {
    const connection = mongoose.connection;
    const previousDB = connection.db;
    try {
      connection.readyState = 1;
      connection.db = { command: async () => { throw new Error(privateMarker); } };
      const response = await fetch(`${baseURL}/health`);
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.deepEqual(body.data, { backend: 'running', database: 'disconnected' });
      assert(!JSON.stringify(body).includes(privateMarker));
    } finally {
      connection.readyState = 0;
      connection.db = previousDB;
    }
  });

  it('không nhận toán tử MongoDB qua field món hoặc bộ lọc order', () => {
    assert.throws(() => validateFields({ name: { $ne: null } }, ['name'], ['name']), /không hợp lệ/);
    assert.throws(() => validateFields({ $set: { price: 0 } }, ['price']), /không được phép/);
    assert.throws(() => orderListQuery({ status: { $ne: 'cancelled' } }), /không hợp lệ/);
    assert.throws(() => orderListQuery({ orderCode: '.*' }), /Mã đơn/);
    assert.throws(() => orderListQuery({ tableId: { $ne: null } }), /không hợp lệ/);
    assert.throws(() => validateOrder({ requestId: 'a'.repeat(64), qrToken: 'b'.repeat(48), customerName: 'Test', items: [{ productId: { $ne: null }, quantity: 1 }] }), /không hợp lệ/);
  });
});
