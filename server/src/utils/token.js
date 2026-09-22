import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const issuer = 'restaurant-qr-server';
const audience = 'restaurant-qr-internal';

export function createAccessToken(userId) {
  // Token chỉ xác định tài khoản; quyền thực tế được đọc lại từ database.
  return jwt.sign({}, env.jwtSecret, {
    subject: userId.toString(),
    algorithm: 'HS256',
    expiresIn: '2h',
    issuer,
    audience,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: ['HS256'],
    issuer,
    audience,
  });
}
