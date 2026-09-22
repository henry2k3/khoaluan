import HttpError from './HttpError.js';
import { validateId } from './catalogValidation.js';
import { activeOrderStatuses, orderStatuses } from './orderStatus.js';

function pageNumber(value, fallback, max, label) {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > max
  ) {
    throw new HttpError(400, `${label} phải là số nguyên từ 1 đến ${max}.`);
  }
  return Number(value);
}

export function orderListQuery(query) {
  const allowed = ['page', 'limit', 'status', 'tableId', 'date', 'orderCode'];
  if (Object.keys(query).some((key) => !allowed.includes(key)))
    throw new HttpError(400, 'Bộ lọc đơn không hợp lệ.');
  const page = pageNumber(query.page, 1, 100000, 'Trang');
  const limit = pageNumber(query.limit, 20, 50, 'Số đơn mỗi trang');
  const filter = {};
  if (query.status !== undefined) {
    if (!['active', ...orderStatuses].includes(query.status))
      throw new HttpError(400, 'Trạng thái lọc không hợp lệ.');
    filter.status =
      query.status === 'active' ? { $in: activeOrderStatuses } : query.status;
  }
  if (query.tableId !== undefined)
    filter.tableId = validateId(query.tableId, 'Mã bàn');
  if (query.date !== undefined) {
    const date = query.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new HttpError(400, 'Ngày phải có dạng YYYY-MM-DD.');
    const check = new Date(`${date}T00:00:00Z`);
    if (
      Number.isNaN(check.getTime()) ||
      check.toISOString().slice(0, 10) !== date
    )
      throw new HttpError(400, 'Ngày không tồn tại.');
    // Lọc theo ngày ĐẶT ở Việt Nam: từ 00:00 đến trước 00:00 hôm sau (+07:00).
    const start = new Date(`${date}T00:00:00+07:00`);
    filter.createdAt = {
      $gte: start,
      $lt: new Date(start.getTime() + 86400000),
    };
  }
  if (query.orderCode !== undefined) {
    if (
      typeof query.orderCode !== 'string' ||
      !/^[a-z0-9-]{1,40}$/i.test(query.orderCode.trim())
    )
      throw new HttpError(
        400,
        'Mã đơn chỉ gồm chữ, số và dấu gạch ngang, tối đa 40 ký tự.',
      );
    // Chỉ nhận ký tự an toàn, tìm theo phần đầu mã (không nhận biểu thức regex tùy ý).
    filter.orderCode = { $regex: `^${query.orderCode.trim().toUpperCase()}` };
  }
  return { page, limit, filter };
}

export function orderChangeBody(body, cancel = false) {
  const allowed = cancel
    ? ['expectedStatus', 'cancelReason']
    : ['expectedStatus', 'status'];
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !allowed.includes(key))
  ) {
    throw new HttpError(400, 'Dữ liệu cập nhật đơn không hợp lệ.');
  }
  if (!orderStatuses.includes(body.expectedStatus))
    throw new HttpError(
      400,
      'Cần gửi expectedStatus là trạng thái đang hiển thị. Hãy tải lại đơn.',
    );
  if (cancel) {
    if (
      typeof body.cancelReason !== 'string' ||
      !body.cancelReason.trim() ||
      body.cancelReason.trim().length > 1000
    ) {
      throw new HttpError(400, 'Lý do hủy bắt buộc, từ 1 đến 1000 ký tự.');
    }
    return {
      expectedStatus: body.expectedStatus,
      status: 'cancelled',
      cancelReason: body.cancelReason.trim(),
    };
  }
  if (!orderStatuses.includes(body.status) || body.status === 'cancelled') {
    throw new HttpError(
      400,
      'Trạng thái đích không hợp lệ. Muốn hủy đơn phải dùng chức năng hủy có lý do.',
    );
  }
  return { expectedStatus: body.expectedStatus, status: body.status };
}
