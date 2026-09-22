import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import Table from '../src/models/Table.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';

export const dashboardNow = new Date('2026-09-17T13:00:00Z');
export const vnTime = (value) => new Date(`${value}+07:00`);
export function fixtureOrder(overrides = {}) {
  const createdAt = vnTime('2026-09-17T10:00:00');
  return {
    _id: new mongoose.Types.ObjectId(),
    orderCode: `TEST-${randomBytes(8).toString('hex')}`,
    customerName: 'Khách thử dashboard',
    tableId: new mongoose.Types.ObjectId(),
    tableName: 'Bàn thử',
    items: [],
    note: '',
    totalAmount: 0,
    status: 'completed',
    paidAt: vnTime('2026-09-17T11:00:00'),
    cancelReason: '',
    cancelledAt: null,
    cancelledBy: null,
    trackingTokenHash: randomBytes(32).toString('hex'),
    trackingTokenNonce: randomBytes(32).toString('hex'),
    requestIdHash: randomBytes(32).toString('hex'),
    requestPayloadHash: randomBytes(32).toString('hex'),
    statusHistory: [
      { status: 'pending', changedAt: createdAt, changedBy: null },
    ],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}
export const snapshotItem = (product, quantity, extra = {}) => ({
  productId: product._id,
  productName: product.name,
  unitPrice: product.price,
  quantity,
  note: '',
  lineTotal: product.price * quantity,
  ...extra,
});

// Chỉ gọi trong database thử riêng. Không seed/backfill database người dùng.
export async function seedDashboardExample() {
  const category = await Category.create({ name: 'Danh mục thử dashboard' });
  const products = await Product.create([
    { categoryId: category._id, name: 'Cà phê sữa', price: 25000 },
    { categoryId: category._id, name: 'Bạc xỉu', price: 50000 },
    { categoryId: category._id, name: 'Trà đào', price: 50000 },
  ]);
  const tables = await Table.create(
    [1, 2, 3, 4, 5].map((n) => ({ name: `Bàn 0${n}`, capacity: 4 })),
  );
  const [coffee, milk, tea] = products;
  const atTable = (index) => ({
    tableId: tables[index]._id,
    tableName: tables[index].name,
  });
  const orders = [
    fixtureOrder({
      orderCode: 'DEMO-A',
      ...atTable(0),
      items: [snapshotItem(coffee, 2), snapshotItem(milk, 1)],
      totalAmount: 100000,
    }),
    fixtureOrder({
      orderCode: 'DEMO-B',
      ...atTable(1),
      createdAt: vnTime('2026-09-16T23:50:00'),
      paidAt: vnTime('2026-09-17T00:10:00'),
      items: [snapshotItem(coffee, 4), snapshotItem(tea, 2)],
      totalAmount: 200000,
    }),
    fixtureOrder({
      orderCode: 'DEMO-C',
      ...atTable(2),
      createdAt: vnTime('2026-09-17T12:00:00'),
      status: 'cancelled',
      paidAt: null,
      cancelReason: 'Khách đổi ý',
      cancelledAt: vnTime('2026-09-17T12:05:00'),
      items: [snapshotItem(tea, 10)],
      totalAmount: 500000,
    }),
    fixtureOrder({
      orderCode: 'DEMO-D',
      ...atTable(4),
      createdAt: vnTime('2026-09-17T13:00:00'),
      status: 'preparing',
      paidAt: null,
      items: [snapshotItem(coffee, 3)],
      totalAmount: 75000,
    }),
    fixtureOrder({
      orderCode: 'DEMO-E',
      ...atTable(4),
      createdAt: vnTime('2026-09-17T13:05:00'),
      status: 'pending',
      paidAt: null,
      items: [snapshotItem(coffee, 1)],
      totalAmount: 25000,
    }),
  ];
  await Order.collection.insertMany(orders);
  await Product.updateOne({ _id: coffee._id }, { $set: { price: 30000 } });
  return { category, products, tables, orders };
}
