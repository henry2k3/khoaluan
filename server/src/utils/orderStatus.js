// Quy tắc nghiệp vụ tập trung ở backend; không lấy quyền chuyển bước từ frontend.
export const orderTransitions = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['served'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};
export const orderStatuses = Object.keys(orderTransitions);
export const activeOrderStatuses = [
  'pending',
  'confirmed',
  'preparing',
  'served',
];
