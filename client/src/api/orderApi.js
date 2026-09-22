import axiosClient from './axiosClient.js';

export const orderApi = {
  list: async (params, signal) => {
    const query = { ...params };
    if (query.status === 'all') delete query.status;
    return (await axiosClient.get('/orders', { params: query, signal })).data
      .data;
  },
  detail: async (id, signal) =>
    (await axiosClient.get(`/orders/${encodeURIComponent(id)}`, { signal }))
      .data.data,
  updateStatus: async (id, expectedStatus, status) =>
    (
      await axiosClient.patch(`/orders/${id}/status`, {
        expectedStatus,
        status,
      })
    ).data.data,
  cancel: async (id, expectedStatus, cancelReason) =>
    (
      await axiosClient.patch(`/orders/${id}/cancel`, {
        expectedStatus,
        cancelReason,
      })
    ).data.data,
};
