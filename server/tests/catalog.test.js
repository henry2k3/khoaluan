import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';

let localEnv = {};
try {
  localEnv = parseEnv(
    readFileSync(new URL('../.env', import.meta.url), 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const testDatabase = `restaurant_qr_catalog_test_${randomBytes(8).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.ORDER_TOKEN_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_ORIGIN = 'http://localhost:5174';
process.env.PUBLIC_APP_URL = 'http://localhost:5174';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ||
  localEnv.MONGODB_URI ||
  'mongodb://127.0.0.1:27017';

const { default: app } = await import('../src/app.js');
const { default: Category } = await import('../src/models/Category.js');
const { default: Product } = await import('../src/models/Product.js');
const { default: Table } = await import('../src/models/Table.js');
const { createInternalUser } = await import('../src/services/userService.js');
const { createAccessToken } = await import('../src/utils/token.js');
let server, baseURL, adminToken, staffToken, category, product, table;

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
const adminRequest = (path, options = {}) =>
  request(path, { ...options, token: adminToken });

describe(
  'Danh mục, món, bàn, QR và menu công khai',
  { concurrency: false },
  () => {
    before(async () => {
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName: testDatabase,
        serverSelectionTimeoutMS: 5000,
      });
      const password = randomBytes(18).toString('base64url');
      const admin = await createInternalUser({
        fullName: 'Admin test',
        username: 'catalog_admin',
        password,
        role: 'admin',
      });
      const staff = await createInternalUser({
        fullName: 'Staff test',
        username: 'catalog_staff',
        password,
        role: 'staff',
      });
      adminToken = createAccessToken(admin._id);
      staffToken = createAccessToken(staff._id);
      category = await Category.create({ name: 'Cà phê', sortOrder: 2 });
      product = await Product.create({
        name: 'Cà phê sữa',
        categoryId: category._id,
        price: 35000,
      });
      await Table.init();
      table = await Table.create({ name: 'Bàn 01', capacity: 2 });
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

    it('API catalog chặn người chưa đăng nhập; staff chỉ được đọc danh sách bàn', async () => {
      const cases = [
        ['GET', '/categories'],
        ['POST', '/categories', { name: 'Không được tạo' }],
        ['PATCH', `/categories/${category.id}`, { name: 'Không được sửa' }],
        ['GET', '/products'],
        [
          'POST',
          '/products',
          { name: 'Món', categoryId: category.id, price: 1000 },
        ],
        ['PATCH', `/products/${product.id}`, { price: 1 }],
        ['GET', '/tables'],
        ['POST', '/tables', { name: 'Bàn', capacity: 1 }],
        ['PATCH', `/tables/${table.id}`, { isActive: false }],
        ['GET', `/tables/${table.id}/qr`],
      ];
      for (const [method, path, body] of cases) {
        assert.equal(
          (await request(path, { method, body })).status,
          401,
          `${method} ${path} anonymous`,
        );
        assert.equal(
          (await request(path, { method, body, token: staffToken })).status,
          method === 'GET' && path === '/tables' ? 200 : 403,
          `${method} ${path} staff`,
        );
      }
      assert.equal((await Category.findById(category.id)).name, 'Cà phê');
      assert.equal((await Product.findById(product.id)).price, 35000);
      assert.equal((await Table.findById(table.id)).isActive, true);
    });

    it('admin tạo, đọc, sửa danh mục với timestamps và thứ tự', async () => {
      const created = await adminRequest('/categories', {
        method: 'POST',
        body: { name: ' Trà ', description: 'Trà trái cây', sortOrder: 1 },
      });
      assert.equal(created.status, 201);
      assert.equal(created.body.data.name, 'Trà');
      assert.equal(created.body.data.isActive, true);
      assert(created.body.data.createdAt && created.body.data.updatedAt);
      const updated = await adminRequest(
        `/categories/${created.body.data._id}`,
        {
          method: 'PATCH',
          body: { name: 'Trà ngon', sortOrder: 0, description: 'Mới' },
        },
      );
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.description, 'Mới');
      const list = await adminRequest('/categories');
      assert.equal(list.status, 200);
      assert.equal(list.body.data[0].name, 'Trà ngon');
    });

    it('ẩn danh mục ẩn cả món ở danh sách và API chi tiết; bật lại khôi phục', async () => {
      await adminRequest(`/categories/${category.id}`, {
        method: 'PATCH',
        body: { isActive: false },
      });
      try {
        assert.equal(
          (await request('/public/categories')).body.data.some(
            (item) => item._id === category.id,
          ),
          false,
        );
        assert.equal(
          (await request('/public/products')).body.data.some(
            (item) => item._id === product.id,
          ),
          false,
        );
        assert.equal(
          (await request(`/public/products/${product.id}`)).status,
          404,
        );
        assert.equal(
          (await request(`/public/products?categoryId=${category.id}`)).body
            .data.length,
          0,
        );
        assert.equal(
          (await adminRequest('/categories')).body.data.find(
            (item) => item._id === category.id,
          ).isActive,
          false,
        );
      } finally {
        await adminRequest(`/categories/${category.id}`, {
          method: 'PATCH',
          body: { isActive: true },
        });
      }
      assert.equal(
        (await request(`/public/products/${product.id}`)).status,
        200,
      );
    });

    it('validation danh mục chặn tên rỗng, boolean giả, thứ tự âm và trường lạ', async () => {
      for (const body of [
        { name: ' ' },
        { name: 'A', sortOrder: -1 },
        { name: 'A', isActive: 'false' },
        { name: 'A', role: 'admin' },
        { name: 'A', sortOrder: 1.2 },
      ]) {
        assert.equal(
          (await adminRequest('/categories', { method: 'POST', body })).status,
          400,
        );
      }
    });

    it('admin tạo món, lưu giá số nguyên đồng và sửa giá', async () => {
      const created = await adminRequest('/products', {
        method: 'POST',
        body: {
          categoryId: category.id,
          name: 'Cà phê đen',
          price: 35000,
          description: 'Đậm vị',
          imageUrl: 'https://example.com/coffee.jpg',
        },
      });
      assert.equal(created.status, 201);
      const saved = await Product.findById(created.body.data._id);
      assert.equal(saved.price, 35000);
      assert.equal(typeof saved.price, 'number');
      const updated = await adminRequest(`/products/${saved.id}`, {
        method: 'PATCH',
        body: { price: 40000, name: 'Cà phê đen đá' },
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.price, 40000);
      assert.equal((await adminRequest('/products')).status, 200);
    });

    it('từ chối giá âm, số lẻ, chuỗi định dạng, null và số vượt giới hạn', async () => {
      for (const price of [
        -1,
        35000.5,
        '35000',
        '35.000đ',
        null,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        assert.equal(
          (
            await adminRequest('/products', {
              method: 'POST',
              body: { categoryId: category.id, name: 'Sai giá', price },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await adminRequest(`/products/${product.id}`, {
              method: 'PATCH',
              body: { price },
            })
          ).status,
          400,
        );
      }
      assert.equal((await Product.findById(product.id)).price, 35000);
    });

    it('món bắt buộc thuộc danh mục có thật, không nhận URL ảnh nguy hiểm', async () => {
      for (const categoryId of [
        'wrong',
        new mongoose.Types.ObjectId().toString(),
      ]) {
        assert.equal(
          (
            await adminRequest('/products', {
              method: 'POST',
              body: { categoryId, name: 'Món', price: 1000 },
            })
          ).status,
          400,
        );
      }
      for (const imageUrl of [
        'javascript:alert(1)',
        'data:text/html,test',
        '//example.com/a.jpg',
        '/images/../secret',
      ]) {
        assert.equal(
          (
            await adminRequest(`/products/${product.id}`, {
              method: 'PATCH',
              body: { imageUrl },
            })
          ).status,
          400,
        );
      }
    });

    it('món hết vẫn có trong public menu và có isAvailable=false', async () => {
      const updated = await adminRequest(`/products/${product.id}`, {
        method: 'PATCH',
        body: { isAvailable: false },
      });
      assert.equal(updated.status, 200);
      assert.equal(
        (await request(`/public/products/${product.id}`)).body.data.isAvailable,
        false,
      );
      assert.equal(
        (await request('/public/products')).body.data.find(
          (item) => item._id === product.id,
        ).isAvailable,
        false,
      );
      await adminRequest(`/products/${product.id}`, {
        method: 'PATCH',
        body: { isAvailable: true },
      });
    });

    it('món ẩn không xuất hiện ở public list/detail nhưng admin vẫn xem được', async () => {
      await adminRequest(`/products/${product.id}`, {
        method: 'PATCH',
        body: { isActive: false },
      });
      try {
        assert.equal(
          (await request('/public/products')).body.data.some(
            (item) => item._id === product.id,
          ),
          false,
        );
        assert.equal(
          (await request(`/public/products/${product.id}`)).status,
          404,
        );
        assert.equal(
          (await adminRequest('/products')).body.data.some(
            (item) => item._id === product.id,
          ),
          true,
        );
      } finally {
        await adminRequest(`/products/${product.id}`, {
          method: 'PATCH',
          body: { isActive: true },
        });
      }
    });

    it('public lọc theo danh mục, không cho query tự bật món ẩn', async () => {
      const result = await request(
        `/public/products?categoryId=${category.id}&isActive=false`,
      );
      assert.equal(result.status, 200);
      assert(result.body.data.length > 0);
      assert(result.body.data.every((item) => item.categoryId === category.id));
      assert.equal(
        (await request('/public/products?categoryId=invalid')).status,
        400,
      );
    });

    it('admin tạo bàn với qrToken ngẫu nhiên riêng và không lưu tình trạng sử dụng', async () => {
      const first = await adminRequest('/tables', {
        method: 'POST',
        body: { name: 'Bàn 02', capacity: 4 },
      });
      const second = await adminRequest('/tables', {
        method: 'POST',
        body: { name: 'Bàn 03', capacity: 6 },
      });
      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      assert.match(first.body.data.qrToken, /^[a-f0-9]{48}$/);
      assert.notEqual(first.body.data.qrToken, second.body.data.qrToken);
      assert.notEqual(first.body.data.qrToken, table.qrToken);
      assert.equal('status' in first.body.data, false);
      assert.equal((await adminRequest('/tables')).status, 200);
    });

    it('unique index thực sự từ chối qrToken trùng trong database', async () => {
      await assert.rejects(
        Table.create({ name: 'Trùng QR', capacity: 2, qrToken: table.qrToken }),
        (error) => error.code === 11000,
      );
    });

    it('sửa bàn giữ nguyên QR; API không cho tự đặt/đổi qrToken', async () => {
      const updated = await adminRequest(`/tables/${table.id}`, {
        method: 'PATCH',
        body: { name: 'Bàn cửa sổ', capacity: 4 },
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.qrToken, table.qrToken);
      assert.equal(
        (
          await adminRequest(`/tables/${table.id}`, {
            method: 'PATCH',
            body: { qrToken: 'hacked' },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await adminRequest('/tables', {
            method: 'POST',
            body: { name: 'Bàn', capacity: 2, qrToken: 'hacked' },
          })
        ).status,
        400,
      );
      for (const capacity of [0, -1, 1.5, '2', 101]) {
        assert.equal(
          (
            await adminRequest(`/tables/${table.id}`, {
              method: 'PATCH',
              body: { capacity },
            })
          ).status,
          400,
        );
      }
    });

    it('QR chứa đúng URL bàn, trả PNG theo yêu cầu và không ghi ảnh vào MongoDB', async () => {
      const response = await adminRequest(`/tables/${table.id}/qr`);
      assert.equal(response.status, 200);
      const qr = response.body.data;
      assert.equal(qr.menuUrl, `http://localhost:5174/menu/${table.qrToken}`);
      assert.match(qr.imageDataUrl, /^data:image\/png;base64,/);
      const png = Buffer.from(qr.imageDataUrl.split(',')[1], 'base64');
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      const saved = await Table.findById(table.id).lean();
      assert.equal('imageDataUrl' in saved, false);
      const opened = await request(`/public/tables/${table.qrToken}`);
      assert.equal(opened.status, 200);
      assert.equal(opened.body.data._id, table.id);
      assert.equal(opened.body.data.name, 'Bàn cửa sổ');
    });

    it('bàn tắt báo không phục vụ, QR không tồn tại báo lỗi rõ ràng', async () => {
      await adminRequest(`/tables/${table.id}`, {
        method: 'PATCH',
        body: { isActive: false },
      });
      const off = await request(`/public/tables/${table.qrToken}`);
      assert.equal(off.status, 403);
      assert.match(off.body.message, /không phục vụ/);
      assert.equal((await request('/public/tables/invalid-token')).status, 404);
      assert.equal(
        (await request(`/public/tables/${randomBytes(24).toString('hex')}`))
          .status,
        404,
      );
      await adminRequest(`/tables/${table.id}`, {
        method: 'PATCH',
        body: { isActive: true },
      });
      assert.equal(
        (await request(`/public/tables/${table.qrToken}`)).status,
        200,
      );
    });

    it('id sai trả 400, id không tồn tại trả 404; PATCH rỗng không được lưu', async () => {
      for (const resource of ['categories', 'products', 'tables']) {
        assert.equal(
          (
            await adminRequest(`/${resource}/wrong`, {
              method: 'PATCH',
              body: { name: 'Test' },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await adminRequest(
              `/${resource}/${new mongoose.Types.ObjectId()}`,
              { method: 'PATCH', body: { name: 'Test' } },
            )
          ).status,
          404,
        );
      }
      assert.equal(
        (
          await adminRequest(`/categories/${category.id}`, {
            method: 'PATCH',
            body: {},
          })
        ).status,
        400,
      );
      assert.equal((await request('/public/products/wrong')).status, 400);
    });

    it('public menu không cần JWT; tạo order công khai vẫn kiểm tra dữ liệu', async () => {
      assert.equal((await request('/public/categories')).status, 200);
      assert.equal((await request('/public/products')).status, 200);
      assert.equal(
        (
          await request('/public/orders', {
            method: 'POST',
            body: { customerName: 'Khách' },
          })
        ).status,
        400,
      );
    });
  },
);
