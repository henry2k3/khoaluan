import mongoose from 'mongoose';
import Order from '../models/Order.js';
import HttpError from '../utils/HttpError.js';
import { matchesTrackingToken } from '../utils/orderToken.js';
import { createGuestOrder } from '../services/orderService.js';

export async function createPublicOrder(req, res) {
  const result = await createGuestOrder(req.body);
  res
    .status(result.replayed ? 200 : 201)
    .json({ success: true, data: result.data, replayed: result.replayed });
}

export async function getPublicOrder(req, res) {
  const denied = () =>
    new HttpError(404, 'Không tìm thấy đơn hoặc mã xem đơn không hợp lệ.');
  const token = req.get('X-Order-Token');
  if (
    !mongoose.isObjectIdOrHexString(req.params.id) ||
    !token ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    throw denied();
  const order = await Order.findById(req.params.id).select(
    '+trackingTokenHash',
  );
  if (!order || !matchesTrackingToken(token, order.trackingTokenHash))
    throw denied();
  // Trả rõ từng trường, tránh lộ hash/nonce/requestId khi thêm trường model sau này.
  res.json({
    success: true,
    data: {
      orderId: order.id,
      orderCode: order.orderCode,
      customerName: order.customerName,
      tableId: order.tableId,
      tableName: order.tableName,
      items: order.items,
      note: order.note,
      totalAmount: order.totalAmount,
      status: order.status,
      // Khách chỉ cần biết trạng thái/thời gian; giữ thông tin người xử lý cho API nội bộ.
      statusHistory: order.statusHistory.map((entry) => ({
        status: entry.status,
        changedAt: entry.changedAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt || null,
      cancelReason: order.cancelReason || '',
      cancelledAt: order.cancelledAt || null,
    },
  });
}
