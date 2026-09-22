import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { orderApi } from '../../api/orderApi.js';
import { tableApi } from '../../api/catalogApi.js';
import useAdminData from '../../hooks/useAdminData.js';
import DataStatus from '../../components/DataStatus.jsx';
import OrderStatusBadge from '../../components/OrderStatusBadge.jsx';
import FormField from '../../components/FormField.jsx';
import { formatMoney } from '../../utils/display.js';
import { formatDateTime, orderStatusLabels } from '../../utils/orderDisplay.js';
import { useStaffRealtime } from '../../contexts/StaffRealtimeContext.jsx';
import useRealtimeRefresh from '../../realtime/useRealtimeRefresh.js';

export default function OrdersPage({ basePath = '/staff/orders' }) {
  const [params, setParams] = useSearchParams();
  // URL giữ bộ lọc/trang; khi quay lại trang trước, form cũng khớp với dữ liệu.
  return (
    <OrderList
      key={params.toString()}
      query={params.toString()}
      setParams={setParams}
      basePath={basePath}
    />
  );
}

function OrderList({ query, setParams, basePath }) {
  const initial = Object.fromEntries(new URLSearchParams(query));
  const [form, setForm] = useState({
    status: initial.status || 'active',
    tableId: initial.tableId || '',
    date: initial.date || '',
    orderCode: initial.orderCode || '',
    limit: initial.limit || '20',
  });
  const loader = useCallback(
    (signal) =>
      orderApi.list(
        { status: 'active', ...Object.fromEntries(new URLSearchParams(query)) },
        signal,
      ),
    [query],
  );
  const { data, loading, error, reload } = useAdminData(loader);
  const tables = useAdminData(tableApi.list);
  const { connection } = useStaffRealtime();
  useRealtimeRefresh({
    connection,
    events: ['order:created', 'order:updated', 'order:cancelled'],
    refresh: reload,
  });
  const page = data?.pagination;
  function change(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }
  function filter(event) {
    event.preventDefault();
    setParams(
      Object.fromEntries(
        Object.entries({
          ...form,
          orderCode: form.orderCode.trim(),
          page: '1',
        }).filter(([, value]) => value !== ''),
      ),
    );
  }
  function goToPage(value) {
    const next = new URLSearchParams(query);
    next.set('page', String(value));
    setParams(next);
  }
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Đơn hàng</h1>
        <button
          className="button-secondary"
          disabled={loading}
          onClick={reload}
        >
          Làm mới danh sách
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Mặc định hiển thị đơn đang xử lý, mới nhất trước. Tự cập nhật theo bộ
        lọc hiện tại; có thể nhấn làm mới khi cần.
      </p>
      <form
        onSubmit={filter}
        className="panel mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FormField id="order-status-filter" label="Trạng thái">
          <select
            id="order-status-filter"
            name="status"
            className="form-input"
            value={form.status}
            onChange={change}
          >
            <option value="active">Đang xử lý</option>
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(orderStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="order-table-filter" label="Bàn">
          <select
            id="order-table-filter"
            name="tableId"
            className="form-input min-w-0"
            value={form.tableId}
            onChange={change}
          >
            <option value="">Tất cả bàn</option>
            {tables.data?.map((table) => (
              <option key={table._id} value={table._id}>
                {table.name}
                {table.isActive ? '' : ' (tắt phục vụ)'}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="order-date-filter" label="Ngày đặt (giờ Việt Nam)">
          <input
            id="order-date-filter"
            name="date"
            type="date"
            className="form-input min-w-0"
            value={form.date}
            onChange={change}
          />
        </FormField>
        <FormField id="order-code-filter" label="Mã đơn (hoặc phần đầu mã)">
          <input
            id="order-code-filter"
            name="orderCode"
            className="form-input"
            maxLength={40}
            value={form.orderCode}
            onChange={change}
            placeholder="ORD-20260917-"
          />
        </FormField>
        <FormField id="order-limit-filter" label="Số đơn mỗi trang">
          <select
            id="order-limit-filter"
            name="limit"
            className="form-input"
            value={form.limit}
            onChange={change}
          >
            {[5, 10, 20, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FormField>
        <div className="flex flex-wrap items-end gap-2">
          <button className="button-primary">Lọc đơn</button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setParams({ status: 'active' })}
          >
            Xóa bộ lọc
          </button>
        </div>
      </form>
      {tables.error && (
        <div className="mt-4">
          <DataStatus
            error={`Chưa tải được bộ lọc bàn. ${tables.error}`}
            onRetry={tables.reload}
          />
        </div>
      )}
      <div className="mt-5">
        <DataStatus
          loading={loading}
          error={error}
          empty={data && !data.orders.length}
          emptyText="Không có đơn phù hợp."
          onRetry={reload}
        />
      </div>
      {!loading && !error && data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {data.orders.map((order) => (
              <article
                key={order._id}
                data-internal-order-id={order._id}
                className="panel min-w-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link
                    to={`${basePath}/${order._id}`}
                    state={{ listQuery: query }}
                    className="break-all font-bold text-teal-700 underline"
                  >
                    {order.orderCode}
                  </Link>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-3 break-words font-medium">
                  {order.customerName} · {order.tableName}
                </p>
                <p className="mt-2 font-semibold">
                  {formatMoney(order.totalAmount)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {formatDateTime(order.createdAt)}
                </p>
                <Link
                  className="button-secondary mt-4"
                  to={`${basePath}/${order._id}`}
                  state={{ listQuery: query }}
                >
                  Xem chi tiết
                </Link>
              </article>
            ))}
          </div>
          <nav
            aria-label="Phân trang đơn"
            className="mt-5 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-slate-600">
              Trang {page.page} / {Math.max(1, page.totalPages)} · {page.total}{' '}
              đơn
            </p>
            <div className="flex gap-2">
              <button
                className="button-secondary"
                disabled={page.page <= 1}
                onClick={() => goToPage(page.page - 1)}
              >
                Trang trước
              </button>
              <button
                className="button-secondary"
                disabled={page.page >= page.totalPages}
                onClick={() => goToPage(page.page + 1)}
              >
                Trang sau
              </button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}
