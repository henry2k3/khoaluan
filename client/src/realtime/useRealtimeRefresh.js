import { useEffect, useRef } from 'react';
import { socket } from './socket.js';

// Debounce: gom các thông báo sát nhau thành một lần tải lại sau 300ms.
export default function useRealtimeRefresh({
  connection,
  events,
  refresh,
  orderId,
  visible = false,
}) {
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  const eventKey = events.join(',');
  const ready = connection?.state === 'connected';
  const version = connection?.readyVersion || 0;
  useEffect(() => {
    let timer;
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => latestRefresh.current(), 300);
    }
    function changed(payload) {
      if (ready && (!orderId || payload?.orderId === orderId)) schedule();
    }
    function onVisible() {
      // API vẫn dùng được khi socket offline. Đây là thao tác quay lại tab, không phải reconnect.
      if (document.visibilityState === 'visible') schedule();
    }
    const names = eventKey.split(',').filter(Boolean);
    for (const name of names) socket.on(name, changed);
    if (visible) document.addEventListener('visibilitychange', onVisible);
    if (ready && version) schedule(); // Room đã ACK -> mới đọc lại dữ liệu.
    return () => {
      clearTimeout(timer);
      for (const name of names) socket.off(name, changed);
      if (visible) document.removeEventListener('visibilitychange', onVisible);
    };
  }, [eventKey, orderId, ready, version, visible]);
}
