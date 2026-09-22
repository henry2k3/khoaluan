import { Link } from 'react-router';
import { useStaffRealtime } from '../contexts/StaffRealtimeContext.jsx';
import RealtimeStatus from './RealtimeStatus.jsx';

export default function StaffRealtimeBanner({ basePath = '/staff/orders' }) {
  const { connection, notices, dismiss } = useStaffRealtime();
  return (
    <div className="mb-5">
      <RealtimeStatus connection={connection} />
      {!!notices.length && (
        <section
          aria-label="Thông báo đơn mới"
          className="rounded-xl border border-teal-200 bg-teal-50 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-teal-900">
              Đơn mới ({notices.length})
            </h2>
            <button
              type="button"
              onClick={dismiss}
              className="text-sm text-teal-800 underline"
            >
              Ẩn thông báo
            </button>
          </div>
          <ul aria-live="polite" className="mt-3 space-y-2">
            {notices.map((notice) => (
              <li
                key={notice.orderId}
                data-notification-order-id={notice.orderId}
                className="break-words text-sm text-teal-900"
              >
                🔔 {notice.tableName} có đơn mới —{' '}
                <Link
                  className="break-all font-medium underline"
                  to={`${basePath}/${notice.orderId}`}
                >
                  {notice.orderCode}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
