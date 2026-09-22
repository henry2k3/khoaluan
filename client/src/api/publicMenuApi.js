import axios from 'axios';

// Client riêng cho khách: không đọc token đăng nhập, không gắn Authorization/JWT.
const publicClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
});

export const publicMenuApi = {
  createOrder: async (body) =>
    (await publicClient.post('/public/orders', body)).data.data,
  order: async (id, trackingToken, signal) =>
    (
      await publicClient.get(`/public/orders/${encodeURIComponent(id)}`, {
        signal,
        headers: { 'X-Order-Token': trackingToken },
      })
    ).data.data,
  table: async (qrToken, signal) =>
    (
      await publicClient.get(`/public/tables/${encodeURIComponent(qrToken)}`, {
        signal,
      })
    ).data.data,
  categories: async (signal) =>
    (await publicClient.get('/public/categories', { signal })).data.data,
  products: async (signal) =>
    (await publicClient.get('/public/products', { signal })).data.data,
  product: async (id, signal) =>
    (await publicClient.get(`/public/products/${id}`, { signal })).data.data,
};
