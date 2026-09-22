import HttpError from './HttpError.js';
import { validateId } from './catalogValidation.js';

function text(value, label, max, required = false) {
  if (value === undefined && !required) return '';
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (required && !value.trim())
  ) {
    throw new HttpError(
      400,
      `${label} ${required ? 'phải có nội dung và ' : ''}tối đa ${max} ký tự.`,
    );
  }
  return value.trim();
}

export function validateOrder(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new HttpError(400, 'Dữ liệu đơn không hợp lệ.');
  if (
    typeof body.requestId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(body.requestId)
  ) {
    throw new HttpError(
      400,
      'Mã lần gửi không hợp lệ. Vui lòng mở lại giỏ hàng.',
    );
  }
  if (
    typeof body.qrToken !== 'string' ||
    !/^[a-f0-9]{48}$/.test(body.qrToken)
  ) {
    throw new HttpError(404, 'Mã QR không hợp lệ hoặc bàn không tồn tại.');
  }
  if (
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 50
  ) {
    throw new HttpError(400, 'Đơn cần có từ 1 đến 50 món khác nhau.');
  }
  const seen = new Set();
  const items = body.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new HttpError(400, 'Món trong đơn không hợp lệ.');
    validateId(item.productId, 'Mã món');
    const productId = item.productId.toLowerCase();
    if (seen.has(productId))
      throw new HttpError(
        400,
        'Mỗi món chỉ có một dòng. Hãy gộp số lượng của món.',
      );
    seen.add(productId);
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw new HttpError(
        400,
        'Số lượng mỗi món phải là số nguyên từ 1 đến 99.',
      );
    }
    return {
      productId,
      quantity: item.quantity,
      note: text(item.note, 'Ghi chú món', 500),
    };
  });
  // Chỉ lấy trường cho phép. Giá, tổng tiền, tên món, status từ client bị bỏ qua.
  return {
    qrToken: body.qrToken,
    customerName: text(body.customerName, 'Tên khách', 100, true),
    items,
    note: text(body.note, 'Ghi chú đơn', 1000),
  };
}
