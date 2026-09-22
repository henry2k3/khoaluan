import axiosClient from './axiosClient.js';

export const categoryApi = {
  list: async (signal) =>
    (await axiosClient.get('/categories', { signal })).data.data,
  create: async (data) =>
    (await axiosClient.post('/categories', data)).data.data,
  update: async (id, data) =>
    (await axiosClient.patch(`/categories/${id}`, data)).data.data,
};

export const productApi = {
  list: async (signal) =>
    (await axiosClient.get('/products', { signal })).data.data,
  create: async (data) => (await axiosClient.post('/products', data)).data.data,
  update: async (id, data) =>
    (await axiosClient.patch(`/products/${id}`, data)).data.data,
};

export const tableApi = {
  list: async (signal) =>
    (await axiosClient.get('/tables', { signal })).data.data,
  create: async (data) => (await axiosClient.post('/tables', data)).data.data,
  update: async (id, data) =>
    (await axiosClient.patch(`/tables/${id}`, data)).data.data,
  qr: async (id, signal) =>
    (await axiosClient.get(`/tables/${id}/qr`, { signal })).data.data,
};

export async function loadProductData(signal) {
  const [products, categories] = await Promise.all([
    productApi.list(signal),
    categoryApi.list(signal),
  ]);
  return { products, categories };
}
