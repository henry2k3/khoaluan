import axiosClient from './axiosClient.js';

export async function getHealth(signal) {
  const response = await axiosClient.get('/health', { signal });
  return response.data;
}
