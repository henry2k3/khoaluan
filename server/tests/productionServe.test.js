import assert from 'node:assert/strict';
import { before, after, describe, it } from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { io } from 'socket.io-client';

Object.assign(process.env, { NODE_ENV: 'production', CLIENT_ORIGIN: ' http://localhost:5174/, http://192.0.2.10:5174/ , http://localhost:5174 ',
  PUBLIC_APP_URL: 'https://restaurant.example/', JWT_SECRET: randomBytes(48).toString('hex'),
  ORDER_TOKEN_SECRET: randomBytes(48).toString('hex'), MONGODB_URI: 'mongodb://127.0.0.1:27017/unused', TRUST_PROXY: '1' });
const { env } = await import('../src/config/env.js');
const { createApp } = await import('../src/app.js');
const { initializeRealtime } = await import('../src/sockets/realtimeServer.js');
const exec = promisify(execFile);
let directory, server, realtime, url, app;
const html = '<!doctype html><html><body><div id="root">React production fixture</div></body></html>';
async function socketResult(origin, transport, expected) {
  const client = io(url, { transports: [transport], reconnection: false, forceNew: true, timeout: 1500,
    ...(origin ? { extraHeaders: { Origin: origin } } : {}) });
  try {
    const result = await new Promise((resolve) => {
      client.once('connect', () => resolve(true));
      client.once('connect_error', () => resolve(false));
    });
    assert.equal(result, expected);
    if (result) {
      const ack = await client.timeout(1500).emitWithAck('session:ready', {});
      assert.deepEqual(ack, { ok: true, mode: 'guest' });
    }
  } finally { client.disconnect(); }
}

describe('9B — Express 5 serve React và origin dùng chung', { concurrency: false }, () => {
  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'restaurant-9b-static-'));
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'index.html'), html);
    await writeFile(join(directory, 'assets', 'example.js'), 'window.productionFixture = true;');
    app = createApp({ staticDirectory: directory });
    server = createServer(app);
    realtime = initializeRealtime(server);
    server.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (realtime) await realtime.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  for (const path of ['/', '/login', '/admin/dashboard', '/menu/abc', '/orders/123']) {
    it(`GET ${path} refresh trực tiếp trả index.html`, async () => {
      const response = await fetch(`${url}${path}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.equal(await response.text(), html);
    });
  }
  it('API không tồn tại trả JSON 404, không trả React', async () => {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(`${url}/api/duong-dan-khong-ton-tai`, { method });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).success, false);
    }
  });
  it('asset hiện có đúng nội dung, asset thiếu không trả HTML', async () => {
    assert.equal(await (await fetch(`${url}/assets/example.js`)).text(), 'window.productionFixture = true;');
    assert.equal((await fetch(`${url}/assets/missing.js`)).status, 404);
    assert.equal((await fetch(`${url}/missing.svg`)).status, 404);
  });
  it('Socket.IO handshake không rơi vào SPA', async () => {
    const response = await fetch(`${url}/socket.io/?EIO=4&transport=polling`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /^0\{"sid":/);
  });
  it('health vẫn là API và không lộ cấu hình khi DB disconnected', async () => {
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).data.database, 'disconnected');
  });
  it('origin parse một lần, trim, bỏ slash, loại trùng, cộng PUBLIC_APP_URL', () => {
    assert.deepEqual(env.allowedOrigins, ['http://localhost:5174', 'http://192.0.2.10:5174', 'https://restaurant.example']);
    assert(Object.isFrozen(env.allowedOrigins));
    assert.equal(app.get('trust proxy'), 1);
  });
  for (const origin of ['http://localhost:5174', 'http://192.0.2.10:5174', 'https://restaurant.example']) {
    it(`API cho phép chính xác origin ${origin}`, async () => {
      const response = await fetch(`${url}/api/auth/me`, { headers: { Origin: origin } });
      assert.equal(response.status, 401); // Qua CORS nhưng vẫn phải xác thực.
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      const preflight = await fetch(`${url}/api/public/orders`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    });
    for (const transport of ['polling', 'websocket']) {
      it(`${transport} cho phép origin ${origin}`, () => socketResult(origin, transport, true));
    }
  }
  for (const origin of ['https://outside.example', 'https://restaurant.example.evil.test']) {
    it(`API từ chối origin ngoài danh sách ${origin}`, async () => {
      const response = await fetch(`${url}/api/auth/me`, { headers: { Origin: origin } });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.deepEqual(await response.json(), { success: false, message: 'Origin không được phép.' });
    });
    for (const transport of ['polling', 'websocket']) {
      it(`${transport} từ chối origin ngoài danh sách ${origin}`, () => socketResult(origin, transport, false));
    }
  }
  it('API không có Origin vẫn qua, không bỏ xác thực JWT', async () => {
    assert.equal((await fetch(`${url}/api/auth/me`)).status, 401);
  });
  for (const transport of ['polling', 'websocket']) {
    it(`${transport} không có Origin vẫn kết nối khách`, () => socketResult(null, transport, true));
  }
  for (const [name, settings] of [
    ['production không CLIENT_ORIGIN, chỉ PUBLIC_APP_URL', { CLIENT_ORIGIN: '', PUBLIC_APP_URL: 'https://restaurant.example' }],
    ['một CLIENT_ORIGIN như cấu hình dev cũ', { CLIENT_ORIGIN: 'http://localhost:5174', PUBLIC_APP_URL: '', NODE_ENV: 'development' }],
  ]) {
    it(`${name}: API/polling/websocket cùng hoạt động`, async () => {
      const code = `
        import assert from 'node:assert/strict';
        import { createServer } from 'node:http';
        import { io } from 'socket.io-client';
        import { env } from './src/config/env.js';
        import { createApp } from './src/app.js';
        import { initializeRealtime } from './src/sockets/realtimeServer.js';
        const server = createServer(createApp());
        const realtime = initializeRealtime(server);
        server.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const base = 'http://127.0.0.1:' + server.address().port;
        try {
          assert.equal(env.allowedOrigins.length, 1);
          const origin = env.publicAppUrl;
          const response = await fetch(base + '/api/auth/me', { headers: { Origin: origin } });
          assert.equal(response.status, 401);
          assert.equal(response.headers.get('access-control-allow-origin'), origin);
          for (const transport of ['polling', 'websocket']) {
            const client = io(base, { transports: [transport], extraHeaders: { Origin: origin }, reconnection: false, timeout: 1500 });
            try {
              await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
              assert.equal((await client.timeout(1500).emitWithAck('session:ready', {})).ok, true);
            } finally { client.disconnect(); }
          }
        } finally { await realtime.close(); }
      `;
      await exec(process.execPath, ['--input-type=module', '-e', code], { cwd: new URL('../', import.meta.url), env: { ...process.env, ...settings } });
    });
  }
  it('env từ chối wildcard, đường dẫn và TRUST_PROXY không hợp lệ', async () => {
    for (const overrides of [{ CLIENT_ORIGIN: '*' }, { CLIENT_ORIGIN: 'http://*.example' }, { CLIENT_ORIGIN: 'https://restaurant.example/path' }, { TRUST_PROXY: 'true' }]) {
      await assert.rejects(exec(process.execPath, ['--input-type=module', '-e', "import './src/config/env.js'"], { cwd: new URL('../', import.meta.url), env: { ...process.env, ...overrides } }));
    }
  });
  it('fallback client: dev localhost/LAN, production /api, env riêng được ưu tiên', async () => {
    // Chạy đúng hàm source trong VM; chỉ bỏ phần khởi tạo cần import.meta.env của Vite.
    const source = await readFile(new URL('../../client/src/api/baseUrl.js', import.meta.url), 'utf8');
    const module = await import(`data:text/javascript,${encodeURIComponent(source.split('export const apiBaseUrl')[0])}`);
    const resolve = module.resolveApiBaseUrl;
    assert.equal(resolve('', true, 'http://localhost:5174'), 'http://localhost:3000/api');
    assert.equal(resolve('', true, 'http://192.0.2.10:5174'), 'http://192.0.2.10:3000/api');
    assert.equal(resolve('', true, 'http://[::1]:5174'), 'http://[::1]:3000/api');
    assert.equal(resolve('', false, 'https://restaurant.example'), '/api');
    assert.equal(resolve(' /api ', false, 'https://restaurant.example'), '/api');
    assert.equal(resolve('http://localhost:3001/api', true, 'http://localhost:5174'), 'http://localhost:3001/api');
  });
});
