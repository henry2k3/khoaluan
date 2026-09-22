import mongoose from 'mongoose';
import HttpError from './HttpError.js';

export function validateId(value, label = 'Mã dữ liệu') {
  if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) {
    throw new HttpError(400, `${label} không hợp lệ.`);
  }
  return value;
}

// Chỉ nhận các trường được cho phép, không đưa nguyên req.body vào MongoDB.
export function validateFields(body, allowed, required = []) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length === 0
  ) {
    throw new HttpError(400, 'Vui lòng gửi dữ liệu cần lưu.');
  }
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new HttpError(400, 'Dữ liệu chứa trường không được phép thay đổi.');
  }
  const data = { ...body };
  for (const key of required) {
    if (!(key in data)) throw new HttpError(400, `Thiếu trường ${key}.`);
  }
  for (const [key, value] of Object.entries(data)) {
    if (['name', 'description', 'imageUrl'].includes(key)) {
      const max = key === 'name' ? 100 : key === 'description' ? 1000 : 2000;
      if (
        typeof value !== 'string' ||
        value.trim().length > max ||
        (key === 'name' && !value.trim())
      ) {
        throw new HttpError(
          400,
          `${key === 'name' ? 'Tên' : key === 'description' ? 'Mô tả' : 'Đường dẫn ảnh'} không hợp lệ (tối đa ${max} ký tự).`,
        );
      }
      data[key] = value.trim();
    }
    if (
      ['isActive', 'isAvailable'].includes(key) &&
      typeof value !== 'boolean'
    ) {
      throw new HttpError(400, 'Trạng thái phải là true hoặc false.');
    }
    if (['price', 'sortOrder', 'capacity'].includes(key)) {
      const minimum = key === 'capacity' ? 1 : 0;
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < minimum ||
        (key === 'capacity' && value > 100)
      ) {
        throw new HttpError(
          400,
          key === 'price'
            ? 'Giá phải là số nguyên không âm, đơn vị đồng; không gửi chuỗi tiền đã định dạng.'
            : key === 'capacity'
              ? 'Số chỗ ngồi phải là số nguyên từ 1 đến 100.'
              : 'Thứ tự phải là số nguyên không âm.',
        );
      }
    }
  }
  if ('categoryId' in data) validateId(data.categoryId, 'Mã danh mục');
  if (data.imageUrl) {
    // Chấp nhận ảnh HTTP(S) hoặc file trong public/images; không nhận javascript/data URL.
    const localImage =
      /^\/images\/[a-zA-Z0-9_./-]+$/.test(data.imageUrl) &&
      !data.imageUrl.includes('..');
    let webImage = false;
    try {
      const url = new URL(data.imageUrl);
      webImage =
        ['https:', 'http:'].includes(url.protocol) &&
        !url.username &&
        !url.password;
    } catch {
      /* Có thể là đường dẫn ảnh cục bộ. */
    }
    if (!localImage && !webImage)
      throw new HttpError(
        400,
        'Ảnh phải là URL http/https hoặc đường dẫn /images/ten-anh.',
      );
  }
  return data;
}
