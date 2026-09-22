import axiosClient from './axiosClient.js';

export async function loadDashboard(params, signal) {
  const paths = ['summary', 'revenue', 'products', 'recent-orders'];
  const [summary, revenue, products, recent] = await Promise.all(
    paths.map(
      async (path) =>
        (await axiosClient.get(`/dashboard/${path}`, { params, signal })).data
          .data,
    ),
  );
  return {
    summary,
    revenue,
    products: products.products,
    orders: recent.orders,
  };
}
