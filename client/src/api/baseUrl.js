// Biến VITE_* là công khai và được nhúng khi build, không chứa secret.
// Để trống: dev theo hostname của trang (kể cả IP LAN), production cùng origin.
export function resolveApiBaseUrl(configured, development, pageOrigin) {
  if (configured?.trim()) return configured.trim();
  if (!development) return '/api';
  const url = new URL(pageOrigin);
  url.port = '3000';
  url.pathname = '/api';
  return url.href;
}

export const apiBaseUrl = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.DEV,
  window.location.origin,
);
