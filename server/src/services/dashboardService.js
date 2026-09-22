import Order from '../models/Order.js';
import Table from '../models/Table.js';
import { activeOrderStatuses } from '../utils/orderStatus.js';
import {
  dashboardRange,
  dashboardListQuery,
  dashboardTimezone,
  revenueBuckets,
} from '../utils/dashboardRange.js';

export const paidOrderFilter = (range) => ({
  status: 'completed',
  paidAt: { $type: 'date', $gte: range.start, $lt: range.end },
  // Loại cả dữ liệu sai dạng mảng; tuyệt đối không ép string thành ngày thanh toán.
  $expr: { $eq: [{ $type: '$paidAt' }, 'date'] },
});
export const createdOrderFilter = (range) => ({
  createdAt: { $gte: range.start, $lt: range.end },
});
const aggregate = (pipeline) =>
  Order.aggregate(pipeline).option({ maxTimeMS: 10000 });

export async function dashboardSummary(query, now) {
  const range = dashboardRange(query, now);
  const [paid, created, active, totalTables, warnings] = await Promise.all([
    aggregate([
      { $match: paidOrderFilter(range) },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          completedOrders: { $sum: 1 },
        },
      },
    ]),
    // Tổng đơn và đơn hiện đã hủy thuộc ngày TẠO, không phải ngày thanh toán/hủy.
    aggregate([
      { $match: createdOrderFilter(range) },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },
    ]),
    // Số liệu hiện tại, không dùng range. Tắt nhận đơn mới không xóa đơn đang xử lý.
    aggregate([
      { $match: { status: { $in: activeOrderStatuses } } },
      { $group: { _id: '$tableId', orders: { $sum: 1 } } },
      {
        $lookup: {
          from: 'tables',
          localField: '_id',
          foreignField: '_id',
          as: 'table',
        },
      },
      {
        $group: {
          _id: null,
          activeOrders: { $sum: '$orders' },
          activeTables: {
            $sum: { $cond: [{ $gt: [{ $size: '$table' }, 0] }, 1, 0] },
          },
        },
      },
    ]),
    Table.countDocuments({}),
    // Cảnh báo toàn database vì bản ghi không có ngày không thể gán vào một kỳ.
    aggregate([
      {
        $match: {
          status: 'completed',
          $expr: { $ne: [{ $type: '$paidAt' }, 'date'] },
        },
      },
      { $count: 'count' },
    ]),
  ]);
  const revenue = paid[0]?.revenue || 0;
  const completedOrders = paid[0]?.completedOrders || 0;
  const activeTables = active[0]?.activeTables || 0;
  return {
    range,
    revenue,
    completedOrders,
    averageOrderValue: completedOrders ? revenue / completedOrders : 0,
    totalOrders: created[0]?.totalOrders || 0,
    cancelledOrders: created[0]?.cancelledOrders || 0,
    activeOrders: active[0]?.activeOrders || 0,
    activeTables,
    emptyTables: totalTables - activeTables,
    totalTables,
    dataWarnings: { completedWithoutPaidAt: warnings[0]?.count || 0 },
  };
}

export async function dashboardRevenue(query, now) {
  const range = dashboardRange(query, now);
  const rows = await aggregate([
    { $match: paidOrderFilter(range) },
    {
      $group: {
        _id: {
          $dateToString: {
            date: '$paidAt',
            timezone: dashboardTimezone,
            format:
              range.granularity === 'hour' ? '%Y-%m-%dT%H:00' : '%Y-%m-%d',
          },
        },
        revenue: { $sum: '$totalAmount' },
      },
    },
  ]);
  const values = new Map(rows.map((row) => [row._id, row.revenue]));
  return {
    range,
    points: revenueBuckets(range).map((date) => ({
      date,
      revenue: values.get(date) || 0,
    })),
  };
}

export async function dashboardProducts(query, now) {
  const { range, limit } = dashboardListQuery(query, now);
  const products = await aggregate([
    { $match: paidOrderFilter(range) },
    // $first lấy snapshot mới nhất TRONG kỳ. Không đọc Product hiện tại.
    { $sort: { paidAt: -1, createdAt: -1, _id: -1 } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        quantitySold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.lineTotal' },
      },
    },
    { $sort: { quantitySold: -1, revenue: -1, productName: 1, _id: 1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: 1,
        quantitySold: 1,
        revenue: 1,
      },
    },
  ]);
  return { range, products };
}

export async function dashboardRecentOrders(query, now) {
  const { range, limit } = dashboardListQuery(query, now);
  const orders = await Order.find(createdOrderFilter(range))
    .select(
      'orderCode customerName tableName totalAmount status createdAt paidAt',
    )
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .maxTimeMS(10000)
    .lean();
  return { range, orders };
}
