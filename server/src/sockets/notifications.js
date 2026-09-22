// Một instance Node dùng một io. Test API không khởi tạo io vẫn chạy bình thường.
let io;
let checkStaff = async () => {};

export function setRealtimeServer(server, validateStaff = async () => {}) {
  io = server;
  checkStaff = validateStaff;
}

export function disconnectUserRealtime(userId) {
  try {
    io?.in(`user:${userId}`).disconnectSockets(true);
  } catch {
    console.warn('Không ngắt được kết nối realtime.');
  }
}

async function safelyNotify(send) {
  if (!io) return; // No-op: không có Socket.IO thì không làm gì.
  try {
    // Tài khoản vừa bị khóa không được nhận thông báo nội bộ tiếp theo.
    await checkStaff();
    if (io) send(io);
  } catch {
    // Không in error/payload/token. Lỗi thông báo không biến lần ghi thành lỗi API.
    console.warn('Chưa gửi được thông báo realtime; dữ liệu API vẫn được lưu.');
  }
}

export function notifyOrderCreated(order) {
  return safelyNotify((server) => {
    server.to('staff').emit('order:created', {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      tableId: order.tableId.toString(),
      tableName: order.tableName,
    });
    server
      .to('staff')
      .emit('table:updated', { tableId: order.tableId.toString() });
  });
}

export function notifyOrderUpdated(order) {
  return safelyNotify((server) => {
    const event =
      order.status === 'cancelled' ? 'order:cancelled' : 'order:updated';
    // Cùng payload tối thiểu cho khách và nội bộ; không có thông tin tài khoản/tiền/token.
    const payload = {
      orderId: order._id.toString(),
      status: order.status,
      updatedAt: order.updatedAt,
      ...(order.status === 'cancelled'
        ? { cancelReason: order.cancelReason }
        : {}),
    };
    server.to('staff').to(`order:${payload.orderId}`).emit(event, payload);
    if (['completed', 'cancelled'].includes(order.status)) {
      server
        .to('staff')
        .emit('table:updated', { tableId: order.tableId.toString() });
    }
  });
}
