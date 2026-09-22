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

export const env = {
  port,
  clientOrigin: required('CLIENT_ORIGIN'),
  mongodbUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  orderTokenSecret: required('ORDER_TOKEN_SECRET'),
  publicAppUrl: process.env.PUBLIC_APP_URL?.trim() || required('CLIENT_ORIGIN'),
};

try {
  const url = new URL(env.publicAppUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error();
} catch {
  throw new Error(
    'PUBLIC_APP_URL phải là địa chỉ gốc http/https của frontend, ví dụ http://localhost:5174.',
  );
}

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
