import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDashboard } from '../api/dashboardApi.js';
import { errorMessage } from '../utils/display.js';
import { useStaffRealtime } from '../contexts/StaffRealtimeContext.jsx';
import { socket } from '../realtime/socket.js';

const events = [
  'order:created',
  'order:updated',
  'order:cancelled',
  'table:updated',
];

export default function useDashboard(params) {
  const key = new URLSearchParams(params).toString();
  const [result, setResult] = useState({
    key: '',
    data: null,
    loading: true,
    error: '',
  });
  const request = useRef(null);
  const latest = useRef(result);
  latest.current = result;
  const { connection } = useStaffRealtime();
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResult((old) => ({
      key,
      data: old.key === key ? old.data : null,
      loading: true,
      error: '',
    }));
    try {
      const data = await loadDashboard(
        Object.fromEntries(new URLSearchParams(key)),
        controller.signal,
      );
      if (!controller.signal.aborted)
        setResult({ key, data, loading: false, error: '' });
    } catch (error) {
      if (controller.signal.aborted) return;
      controller.abort(); // Một API lỗi thì hủy các API còn đang chờ trong cùng lần tải.
      setResult((old) => ({
        ...old,
        loading: false,
        error: errorMessage(error),
      }));
    }
  }, [key]);

  useEffect(() => {
    void reload();
    return () => request.current?.abort();
  }, [reload]);

  useEffect(() => {
    let timer;
    function schedule() {
      clearTimeout(timer);
      if (document.visibilityState !== 'visible') return;
      timer = setTimeout(() => {
        if (document.visibilityState !== 'visible') return;
        void reload();
      }, 1500);
    }
    function changed() {
      // Chỉ dùng khoảng do BACKEND trả; không tính preset bằng đồng hồ máy khách.
      if (
        latest.current.key === key &&
        latest.current.data?.summary.range.includesToday
      )
        schedule();
    }
    function visible() {
      if (document.visibilityState === 'visible') schedule();
      else clearTimeout(timer); // Quay lại tab luôn đọc API, kể cả đã lỡ event.
    }
    for (const event of events) socket.on(event, changed);
    document.addEventListener('visibilitychange', visible);
    // readyVersion chỉ tăng khi join đã nhận ACK, kể cả reconnect. Kỳ cũ cũng đọc lại.
    if (connection?.state === 'connected' && connection.readyVersion)
      schedule();
    return () => {
      clearTimeout(timer);
      for (const event of events) socket.off(event, changed);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [key, reload, connection?.state, connection?.readyVersion]);

  return {
    ...(result.key === key ? result : { data: null, loading: true, error: '' }),
    reload,
  };
}
