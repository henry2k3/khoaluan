import { Server } from 'socket.io';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { verifyAccessToken } from '../utils/token.js';
import { matchesTrackingToken } from '../utils/orderToken.js';
import { env } from '../config/env.js';
import { setRealtimeServer, disconnectUserRealtime } from './notifications.js';

const orderDenied = {
  ok: false,
  message: 'Không tìm thấy đơn hoặc mã xem đơn không hợp lệ.',
};
const activeUser = (user) =>
  user?.isActive && ['staff', 'admin'].includes(user.role);

export function initializeRealtime(
  httpServer,
  { authCheckIntervalMs = 5000 } = {},
) {
  const io = new Server(httpServer, {
    cors: { origin: env.allowedOrigins, methods: ['GET', 'POST'] },
    // CORS không bảo vệ WebSocket; kiểm tra Origin cả ở bước mở kết nối.
    allowRequest: (req, done) =>
      done(
        null,
        !req.headers.origin || env.allowedOrigins.includes(req.headers.origin),
      ),
    maxHttpBufferSize: 16 * 1024,
    // Không dùng connectionStateRecovery: client luôn join + ack + đọc lại API.
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token === undefined || token === null || token === '') return next();
    try {
      if (typeof token !== 'string') throw new Error();
      const payload = verifyAccessToken(token);
      if (!mongoose.isObjectIdOrHexString(payload.sub)) throw new Error();
      const user = await User.findById(payload.sub)
        .select('role isActive')
        .lean();
      if (!activeUser(user)) throw new Error();
      socket.data.userId = user._id.toString();
      socket.data.expiresAt = payload.exp * 1000;
      // Server tự chọn room sau khi xác thực, không có event xin join staff.
      await socket.join(['staff', `user:${socket.data.userId}`]);
      next();
    } catch {
      const error = new Error('Phiên realtime không hợp lệ hoặc đã hết hạn.');
      error.data = { code: 'UNAUTHORIZED' };
      next(error);
    }
  });

  let checking;
  async function checkStaffSockets() {
    // Gộp các lần kiểm tra đồng thời, mỗi tài khoản chỉ đọc một lần.
    if (checking) return checking;
    checking = (async () => {
      const sockets = [...io.sockets.sockets.values()].filter(
        (socket) => socket.data.userId,
      );
      if (!sockets.length) return;
      const ids = [...new Set(sockets.map((socket) => socket.data.userId))];
      const users = await User.find({ _id: { $in: ids } })
        .select('role isActive')
        .lean();
      const permitted = new Set(
        users.filter(activeUser).map((user) => user._id.toString()),
      );
      for (const id of ids) if (!permitted.has(id)) disconnectUserRealtime(id);
      for (const socket of sockets) {
        if (socket.data.expiresAt <= Date.now()) socket.disconnect(true);
      }
    })();
    try {
      await checking;
    } finally {
      checking = null;
    }
  }
  setRealtimeServer(io, checkStaffSockets);
  const timer = setInterval(() => {
    checkStaffSockets().catch(() => {
      // Không xác minh được quyền thì tạm ngắt nội bộ; API có cơ chế lỗi riêng.
      io.in('staff').disconnectSockets(true);
    });
  }, authCheckIntervalMs);
  timer.unref();

  io.on('connection', (socket) => {
    // ACK chỉ xác nhận room server đã gán; tuyệt đối không nhận tên room từ client.
    socket.on('session:ready', (_data, ack) => {
      if (typeof ack === 'function')
        ack({ ok: true, mode: socket.data.userId ? 'staff' : 'guest' });
    });
    let joinVersion = 0;
    socket.on('order:join', async (data, ack) => {
      if (typeof ack !== 'function') return;
      const version = ++joinVersion;
      try {
        const { orderId, trackingToken } = data || {};
        if (
          typeof orderId !== 'string' ||
          !mongoose.isObjectIdOrHexString(orderId) ||
          typeof trackingToken !== 'string' ||
          !/^[a-f0-9]{64}$/.test(trackingToken)
        ) {
          return ack(orderDenied);
        }
        const order =
          await Order.findById(orderId).select('+trackingTokenHash');
        if (
          !order ||
          !matchesTrackingToken(trackingToken, order.trackingTokenHash)
        )
          return ack(orderDenied);
        if (!socket.connected || version !== joinVersion)
          return ack(orderDenied);
        // Màn hình khách chỉ theo dõi một đơn; đổi đơn thì rời room cũ.
        for (const room of socket.rooms)
          if (room.startsWith('order:')) await socket.leave(room);
        await socket.join(`order:${order.id}`);
        ack({ ok: true, orderId: order.id });
      } catch {
        ack(orderDenied); // ID sai, không tồn tại, token sai đều cùng thông báo; không log dữ liệu.
      }
    });
  });

  async function close() {
    clearInterval(timer);
    setRealtimeServer(null);
    await new Promise((resolve) => io.close(resolve));
  }
  return { io, close };
}
