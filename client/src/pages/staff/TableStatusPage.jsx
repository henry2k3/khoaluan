import { Link } from 'react-router';
import { tableApi } from '../../api/catalogApi.js';
import useAdminData from '../../hooks/useAdminData.js';
import DataStatus from '../../components/DataStatus.jsx';
import TableOccupancy from '../../components/TableOccupancy.jsx';
import { useStaffRealtime } from '../../contexts/StaffRealtimeContext.jsx';
import useRealtimeRefresh from '../../realtime/useRealtimeRefresh.js';

export default function TableStatusPage() {
  const { data, loading, error, reload } = useAdminData(tableApi.list);
  const { connection } = useStaffRealtime();
  useRealtimeRefresh({
    connection,
    events: ['table:updated'],
    refresh: reload,
  });
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Tình trạng bàn</h1>
        <button
          className="button-secondary"
          disabled={loading}
          onClick={reload}
        >
          Làm mới bàn
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Bàn đang sử dụng khi còn đơn chờ xác nhận, đã xác nhận, đang chuẩn bị
        hoặc đã phục vụ.
      </p>
      <div className="mt-5">
        <DataStatus
          loading={loading}
          error={error}
          empty={!data?.length}
          emptyText="Chưa có bàn trong hệ thống."
          onRetry={reload}
        />
      </div>
      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((table) => (
            <article
              key={table._id}
              data-table-id={table._id}
              className="panel min-w-0"
            >
              <h2 className="break-words text-lg font-bold">{table.name}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {table.capacity} chỗ ·{' '}
                {table.isActive ? 'Đang phục vụ' : 'Tắt nhận đơn mới'}
              </p>
              <TableOccupancy table={table} />
              <Link
                className="button-secondary mt-4"
                to={`/staff/orders?status=active&tableId=${table._id}`}
              >
                Xem đơn đang xử lý
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
