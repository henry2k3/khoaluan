const labels = {
  idle: 'Chưa kết nối realtime',
  connecting: 'Đang kết nối realtime…',
  connected: 'Đã kết nối realtime',
  offline:
    'Mất kết nối realtime, đang thử lại. Bạn vẫn có thể dùng nút làm mới.',
  denied:
    'Chưa được phép nghe cập nhật realtime. Bạn vẫn có thể thử tải lại bằng API.',
};
export default function RealtimeStatus({ connection }) {
  const state = connection?.state || 'idle';
  return (
    <p
      role="status"
      data-realtime-state={state}
      className="my-4 break-words text-sm text-slate-600"
    >
      <span
        aria-hidden="true"
        className={
          state === 'connected' ? 'text-emerald-600' : 'text-amber-700'
        }
      >
        {state === 'connected' ? '●' : '○'}
      </span>{' '}
      {labels[state]}
    </p>
  );
}
