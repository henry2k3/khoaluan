export function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export function errorMessage(error) {
  return (
    error.response?.data?.message ||
    'Không kết nối được máy chủ. Vui lòng thử lại.'
  );
}
