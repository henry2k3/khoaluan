function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Thiếu ${name}. Hãy kiểm tra server/.env theo file .env.example.`,
    );
  }
  return value;
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
}

function origin(value, name) {
  try {
    const cleaned = value.trim().replace(/\/+$/, '');
    const url = new URL(cleaned);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname.includes('*') || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new Error(`${name} phải chứa địa chỉ gốc http/https, không chứa đường dẫn hoặc wildcard.`);
  }
}

// Parse một lần. API và Socket.IO dùng cùng danh sách, so khớp chính xác.
const clientOrigins = (process.env.CLIENT_ORIGIN || '').split(',')
  .map((value) => value.trim()).filter(Boolean)
  .map((value) => origin(value, 'CLIENT_ORIGIN'));
const publicAppUrl = origin(
  process.env.PUBLIC_APP_URL?.trim() || clientOrigins[0] || required('PUBLIC_APP_URL'),
  'PUBLIC_APP_URL',
);
const proxySetting = process.env.TRUST_PROXY?.trim() || '0';
if (!/^(?:[0-9]|10)$/.test(proxySetting)) {
  throw new Error('TRUST_PROXY phải là số hop proxy từ 0 đến 10; không dùng true hoặc wildcard.');
}

export const env = {
  port,
  allowedOrigins: Object.freeze([...new Set([...clientOrigins, publicAppUrl])]),
  production: process.env.NODE_ENV === 'production',
  trustProxy: Number(proxySetting) || false,
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  orderTokenSecret: required('ORDER_TOKEN_SECRET'),
  publicAppUrl,
};

if (env.jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET phải có ít nhất 32 ký tự ngẫu nhiên. Không dùng mật khẩu tài khoản làm JWT_SECRET.',
  );
}

if (env.orderTokenSecret.length < 32) {
  throw new Error(
    'ORDER_TOKEN_SECRET phải có ít nhất 32 ký tự ngẫu nhiên, chỉ lưu ở backend.',
  );
}
