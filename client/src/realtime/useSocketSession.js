import { useEffect, useState } from 'react';
import { socket } from './socket.js';

// Chỉ provider nội bộ HOẶC trang đơn khách sở hữu kết nối tại một thời điểm.
export default function useSocketSession({
  enabled,
  token,
  orderId,
  trackingToken,
}) {
  const [connection, setConnection] = useState({
    state: 'idle',
    readyVersion: 0,
  });
  useEffect(() => {
    if (!enabled) {
      setConnection({ state: 'idle', readyVersion: 0 });
      return;
    }
    let disposed = false;
    let generation = 0;
    let retryTimer;
    const state = (value) =>
      setConnection((current) => ({ ...current, state: value }));
    async function joinRooms() {
      const current = ++generation;
      clearTimeout(retryTimer);
      state('connecting');
      try {
        // Staff đã được middleware join; event này chỉ xin ACK xác nhận, không xin cấp quyền.
        const result = token
          ? await socket.timeout(5000).emitWithAck('session:ready', {})
          : await socket
              .timeout(5000)
              .emitWithAck('order:join', { orderId, trackingToken });
        if (disposed || current !== generation || !socket.connected) return;
        if (
          !result.ok ||
          (token ? result.mode !== 'staff' : result.orderId !== orderId)
        ) {
          state('denied');
          return;
        }
        // Chỉ tăng sau ACK. Các trang dùng readyVersion để refetch, kể cả lần connect đầu tiên.
        setConnection((previous) => ({
          state: 'connected',
          readyVersion: previous.readyVersion + 1,
        }));
      } catch {
        if (disposed || current !== generation) return;
        state('offline');
        // Mất ACK: thử join lại, không tự đọc API với giả định đã vào room.
        retryTimer = setTimeout(() => {
          if (socket.connected) void joinRooms();
        }, 3000);
      }
    }
    function onDisconnect(reason) {
      generation += 1;
      clearTimeout(retryTimer);
      state('offline');
      if (reason === 'io server disconnect') {
        if (token) window.dispatchEvent(new Event('auth:expired'));
        else retryTimer = setTimeout(() => socket.connect(), 2000);
      }
    }
    function onError(error) {
      state(error.data?.code === 'UNAUTHORIZED' ? 'denied' : 'offline');
      if (token && error.data?.code === 'UNAUTHORIZED')
        window.dispatchEvent(new Event('auth:expired'));
    }
    socket.disconnect();
    // Không đọc JWT ở trang khách, kể cả cùng tab từng đăng nhập admin.
    socket.auth = token ? { token } : {};
    socket.on('connect', joinRooms);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    state('connecting');
    socket.connect();
    return () => {
      disposed = true;
      generation += 1;
      clearTimeout(retryTimer);
      socket.off('connect', joinRooms);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.disconnect();
      socket.auth = {};
    };
  }, [enabled, token, orderId, trackingToken]);
  return connection;
}
