export const orderStatusLabels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  served: 'Đã phục vụ',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};
// Chỉ là nhãn giao diện; các bước được phép do backend trả về và kiểm tra khi ghi.
export const orderActionLabels = {
  confirmed: 'Xác nhận đơn',
  preparing: 'Bắt đầu chuẩn bị',
  served: 'Đã phục vụ',
  completed: 'Xác nhận thanh toán & hoàn thành',
  cancelled: 'Hủy đơn',
};
export function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : '—';
}
