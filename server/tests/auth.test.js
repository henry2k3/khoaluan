import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Database riêng cho mỗi lần chạy. Không dùng database nghiệp vụ để tạo/xóa fixture.
let localEnv = {};
try {
  localEnv = parseEnv(
    readFileSync(new URL('../.env', import.meta.url), 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const testDatabase = `restaurant_qr_auth_test_${randomBytes(8).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.ORDER_TOKEN_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_ORIGIN = 'http://localhost:5174';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ||
  localEnv.MONGODB_URI ||
  'mongodb://127.0.0.1:27017';

const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { createInternalUser } = await import('../src/services/userService.js');
const { createAccessToken } = await import('../src/utils/token.js');
const password = randomBytes(18).toString('base64url');
let server;
let baseURL;
let admin;
let staff;

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}

describe('Đăng nhập và phân quyền nội bộ', { concurrency: false }, () => {
  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: testDatabase,
      serverSelectionTimeoutMS: 5000,
    });
    admin = await createInternalUser({
      fullName: 'Quản lý kiểm thử',
      username: 'test_admin',
      password,
      role: 'admin',
    });
    staff = await createInternalUser({
      fullName: 'Nhân viên kiểm thử',
      username: 'test_staff',
      password,
      role: 'staff',
    });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseURL = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.name === testDatabase)
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('băm mật khẩu và không chọn passwordHash mặc định', async () => {
    const normal = await User.findById(admin._id);
    assert.equal(normal.passwordHash, undefined);
    const internal = await User.findById(admin._id).select('+passwordHash');
    assert.notEqual(internal.passwordHash, password);
    assert.equal(await bcrypt.compare(password, internal.passwordHash), true);
    assert.equal(internal.toJSON().passwordHash, undefined);
  });

  it('chỉ chấp nhận admin/staff, không tạo tài khoản customer', async () => {
    const invalid = new User({
      fullName: 'Khách',
      username: 'customer',
      passwordHash: 'unused',
      role: 'customer',
    });
    await assert.rejects(invalid.validate(), /role/);
    await assert.rejects(
      createInternalUser({
        fullName: 'Khách',
        username: 'customer',
        password,
        role: 'customer',
      }),
      /admin hoặc staff/,
    );
    const register = await request('/auth/register', {
      method: 'POST',
      body: { customerName: 'Khách' },
    });
    assert.equal(register.status, 404);
  });

  it('không ghi đè tài khoản trùng và không cắt mật khẩu quá dài', async () => {
    await assert.rejects(
      createInternalUser({
        fullName: 'Khác',
        username: 'TEST_ADMIN',
        password,
        role: 'staff',
      }),
      /đã tồn tại/,
    );
    await assert.rejects(
      createInternalUser({
        fullName: 'Khác',
        username: 'too_long',
        password: 'ấ'.repeat(30),
        role: 'staff',
      }),
      /72 byte/,
    );
  });

  it('admin đăng nhập, nhận JWT có thời hạn và đọc được thông tin cá nhân', async () => {
    const result = await request('/auth/login', {
      method: 'POST',
      body: { username: ' TEST_ADMIN ', password },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.user.role, 'admin');
    assert.equal(result.body.data.user.passwordHash, undefined);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const claims = jwt.verify(
      result.body.data.accessToken,
      process.env.JWT_SECRET,
    );
    assert.equal(claims.exp - claims.iat, 7200);
    const me = await request('/auth/me', {
      token: result.body.data.accessToken,
    });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.username, 'test_admin');
    assert.equal(me.body.data.user.passwordHash, undefined);
    const access = await request('/auth/admin-check', {
      token: result.body.data.accessToken,
    });
    assert.equal(access.status, 200);
  });

  it('staff đăng nhập nhưng không tự khai role admin để vượt quyền', async () => {
    const result = await request('/auth/login', {
      method: 'POST',
      body: { username: 'test_staff', password, role: 'admin' },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.user.role, 'staff');
    assert.equal(
      (await request('/auth/me', { token: result.body.data.accessToken }))
        .status,
      200,
    );
    assert.equal(
      (
        await request('/auth/admin-check', {
          token: result.body.data.accessToken,
        })
      ).status,
      403,
    );
  });

  it('từ chối mật khẩu sai và tài khoản không tồn tại bằng cùng thông báo', async () => {
    const wrong = await request('/auth/login', {
      method: 'POST',
      body: { username: 'test_admin', password: 'wrong-password' },
    });
    const unknown = await request('/auth/login', {
      method: 'POST',
      body: { username: 'missing_user', password },
    });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });

  it('tên khách hoặc truy vấn dạng object không thể dùng làm thông tin đăng nhập', async () => {
    const guest = await request('/auth/login', {
      method: 'POST',
      body: { customerName: 'Nguyễn An' },
    });
    assert.equal(guest.status, 400);
    const injection = await request('/auth/login', {
      method: 'POST',
      body: { username: { $ne: null }, password },
    });
    assert.equal(injection.status, 400);
  });

  it('từ chối token thiếu, bị sửa, hết hạn hoặc trỏ đến tài khoản không tồn tại', async () => {
    assert.equal((await request('/auth/me')).status, 401);
    const tampered = createAccessToken(admin._id) + 'invalid';
    assert.equal((await request('/auth/me', { token: tampered })).status, 401);
    const expired = jwt.sign({}, process.env.JWT_SECRET, {
      subject: admin._id.toString(),
      expiresIn: -1,
      issuer: 'restaurant-qr-server',
      audience: 'restaurant-qr-internal',
    });
    assert.equal((await request('/auth/me', { token: expired })).status, 401);
    assert.equal(
      (
        await request('/auth/me', {
          token: createAccessToken(new mongoose.Types.ObjectId()),
        })
      ).status,
      401,
    );
  });

  it('khóa tài khoản làm token hiện có mất quyền ngay ở yêu cầu tiếp theo', async () => {
    const token = createAccessToken(staff._id);
    await User.updateOne({ _id: staff._id }, { isActive: false });
    try {
      assert.equal((await request('/auth/me', { token })).status, 401);
      const login = await request('/auth/login', {
        method: 'POST',
        body: { username: 'test_staff', password },
      });
      assert.equal(login.status, 401);
    } finally {
      await User.updateOne({ _id: staff._id }, { isActive: true });
    }
  });

  it('quyền lấy từ database, token cũ không giữ quyền admin khi đã đổi thành staff', async () => {
    const token = createAccessToken(admin._id);
    await User.updateOne({ _id: admin._id }, { role: 'staff' });
    try {
      assert.equal((await request('/auth/admin-check', { token })).status, 403);
    } finally {
      await User.updateOne({ _id: admin._id }, { role: 'admin' });
    }
  });

  it('health vẫn công khai, không bắt khách đăng nhập', async () => {
    const health = await request('/health');
    assert.equal(health.status, 200);
  });

  it('giới hạn các lần đăng nhập thất bại liên tiếp', async () => {
    let result;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      result = await request('/auth/login', {
        method: 'POST',
        body: { username: 'missing_user', password },
      });
      if (result.status === 429) break;
    }
    assert.equal(result.status, 429);
    assert.equal(result.body.success, false);
    assert(result.headers.get('retry-after'));
  });
});
