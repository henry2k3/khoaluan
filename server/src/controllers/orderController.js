import Order from '../models/Order.js';
import { validateId } from '../utils/catalogValidation.js';
import {
  orderListQuery,
  orderChangeBody,
} from '../utils/internalOrderValidation.js';
import {
  readInternalOrder,
  changeOrderStatus,
} from '../services/orderWorkflowService.js';

export async function listOrders(req, res) {
  const { page, limit, filter } = orderListQuery(req.query);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .select(
        'orderCode customerName tableId tableName totalAmount status createdAt updatedAt',
      )
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: {
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
}

export async function getOrder(req, res) {
  validateId(req.params.id, 'Mã đơn');
  res.json({ success: true, data: await readInternalOrder(req.params.id) });
}
export async function updateOrderStatus(req, res) {
  validateId(req.params.id, 'Mã đơn');
  const change = orderChangeBody(req.body);
  res.json({
    success: true,
    data: await changeOrderStatus(req.params.id, change, req.user._id),
  });
}
export async function cancelOrder(req, res) {
  validateId(req.params.id, 'Mã đơn');
  const change = orderChangeBody(req.body, true);
  res.json({
    success: true,
    data: await changeOrderStatus(req.params.id, change, req.user._id),
  });
}
