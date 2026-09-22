import Order from '../models/Order.js';
import HttpError from '../utils/HttpError.js';
import { orderTransitions } from '../utils/orderStatus.js';
import { notifyOrderUpdated } from '../sockets/notifications.js';

export const internalOrderFields =
  'orderCode customerName tableId tableName items note totalAmount status statusHistory createdAt updatedAt paidAt cancelReason cancelledAt cancelledBy';

export async function readInternalOrder(id) {
  const order = await Order.findById(id)
    .select(internalOrderFields)
    .populate('statusHistory.changedBy', 'fullName username')
    .populate('cancelledBy', 'fullName username')
    .lean();
  if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
  return { ...order, allowedTransitions: orderTransitions[order.status] };
}

export async function changeOrderStatus(id, change, userId) {
  const current = await Order.findById(id).select('status');
  if (!current) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
  const conflict = () =>
    new HttpError(
      409,
      'Đơn đã được người khác cập nhật hoặc lần xử lý trước đã thành công. Vui lòng xem trạng thái mới nhất.',
    );
  if (current.status !== change.expectedStatus) throw conflict();
  if (!orderTransitions[current.status].includes(change.status)) {
    throw new HttpError(
      400,
      'Không được chuyển trạng thái này. Đơn phải xử lý đúng thứ tự; chỉ hủy khi chờ hoặc đã xác nhận.',
    );
  }
  const now = new Date();
  const changes = { status: change.status };
  if (change.status === 'completed') changes.paidAt = now;
  if (change.status === 'cancelled') {
    changes.cancelReason = change.cancelReason;
    changes.cancelledAt = now;
    changes.cancelledBy = userId;
  }
  // Kiểm tra trạng thái ngay TRONG lệnh ghi. Đọc ở trên không đủ chống hai người bấm cùng lúc.
  // Trạng thái, thanh toán/hủy và lịch sử cùng nằm trong một document, được ghi cùng nhau.
  const updated = await Order.findOneAndUpdate(
    { _id: id, status: change.expectedStatus },
    {
      $set: changes,
      $push: {
        statusHistory: {
          status: change.status,
          changedAt: now,
          changedBy: userId,
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).select('_id tableId status updatedAt cancelReason');
  if (!updated) throw conflict();
  // Dùng kết quả của lần ghi vừa thành công, không dùng trạng thái từ một lần đọc muộn hơn.
  await notifyOrderUpdated(updated);
  return readInternalOrder(id);
}
