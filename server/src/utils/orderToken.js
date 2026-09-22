import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export const hashValue = (value) =>
  createHash('sha256').update(value).digest('hex');

// HMAC là phép tạo mã có dùng khóa bí mật. Nonce được sinh ngẫu nhiên ở backend.
// Nhờ tái tạo được mã, retry vẫn nhận token cũ mà DB không cần lưu token thật.
export const makeTrackingToken = (nonce) =>
  createHmac('sha256', env.orderTokenSecret)
    .update(`guest-order:v1:${nonce}`)
    .digest('hex');

export function matchesTrackingToken(token, hash) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(
    Buffer.from(hashValue(token), 'hex'),
    Buffer.from(hash, 'hex'),
  );
}
