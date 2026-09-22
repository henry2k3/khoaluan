import { useState } from 'react';
import { Link } from 'react-router';
import useDashboard from '../../hooks/useDashboard.js';
import RevenueChart from '../../components/RevenueChart.jsx';
import DataStatus from '../../components/DataStatus.jsx';
import OrderStatusBadge from '../../components/OrderStatusBadge.jsx';
import { formatMoney } from '../../utils/display.js';
import { formatDateTime } from '../../utils/orderDisplay.js';

const presets = [
  ['today', 'Hôm nay'],
  ['7d', '7 ngày'],
  ['30d', '30 ngày'],
  ['month', 'Tháng này'],
];
const dateLabel = (date) => date.split('-').reverse().join('/');

export default function DashboardPage() {
  const [params, setParams] = useState({ period: 'today' });
  const [month, setMonth] = useState('');
  const { data, loading, error, reload } = useDashboard(params);
  const summary = data?.summary;
  const range = summary?.range;
  return (
    <section className="min-w-0 space-y-6" aria-label="Dashboard quản lý">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            Tổng quan quán
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Doanh thu đã thanh toán và hoạt động phục vụ.
          </p>
        </div>
        <button
          className="button-secondary"
          disabled={loading}
          onClick={reload}
        >
          Làm mới số liệu
        </button>
      </div>
      <div className="panel space-y-4">
        <div className="flex flex-wrap gap-2" aria-label="Khoảng thống kê">
          {presets.map(([period, label]) => (
            <button
              key={period}
              type="button"
              aria-pressed={params.period === period && !params.month}
              className={
                params.period === period && !params.month
                  ? 'button-primary'
                  : 'button-secondary'
              }
              onClick={() => setParams({ period })}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setParams({ period: 'month', month });
          }}
        >
          <div className="min-w-0 flex-1 sm:max-w-56">
            <label
              className="mb-2 block text-sm text-slate-600"
              htmlFor="dashboard-month"
            >
              Hoặc chọn tháng
            </label>
            <input
              type="month"
              id="dashboard-month"
              min="2000-01"
              max="2100-12"
              required
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="form-input min-w-0"
            />
          </div>
          <button className="button-secondary">Xem tháng</button>
        </form>
        {range && (
          <p className="text-sm text-slate-500" data-dashboard-range>
            {dateLabel(range.from)} – {dateLabel(range.to)} · Giờ Việt Nam
            (UTC+7)
          </p>
        )}
      </div>
      {(!data || error) && (
        <DataStatus loading={loading} error={error} onRetry={reload} />
      )}
      {data && !error && (
        <>
          {loading && (
            <p role="status" className="text-sm text-slate-500">
              Đang cập nhật số liệu…
            </p>
          )}
          {summary.dataWarnings.completedWithoutPaidAt > 0 && (
            <div
              role="alert"
              data-data-warning
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            >
              Có <strong>{summary.dataWarnings.completedWithoutPaidAt}</strong>{' '}
              đơn hoàn thành thiếu thời gian thanh toán hợp lệ trong hệ thống.
              Các đơn này chưa được tính vào doanh thu. Cần kiểm tra dữ liệu gốc
              trước khi sử dụng báo cáo.
            </div>
          )}
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                'revenue',
                'Doanh thu',
                formatMoney(summary.revenue),
                'Theo thời gian thanh toán',
                true,
              ],
              [
                'totalOrders',
                'Tổng số đơn',
                summary.totalOrders,
                'Theo thời gian tạo đơn',
              ],
              [
                'activeOrders',
                'Đơn đang xử lý',
                summary.activeOrders,
                'Hiện tại · mọi ngày',
              ],
              [
                'activeTables',
                'Bàn đang sử dụng',
                `${summary.activeTables} / ${summary.totalTables}`,
                `${summary.emptyTables} bàn trống · hiện tại`,
              ],
            ].map(([key, label, value, hint, highlight]) => (
              <article
                key={key}
                className={`min-w-0 rounded-xl border p-5 ${highlight ? 'border-teal-800 bg-teal-800 text-white' : 'border-slate-200 bg-white'}`}
              >
                <h2
                  className={`text-sm font-medium ${highlight ? 'text-teal-100' : 'text-slate-500'}`}
                >
                  {label}
                </h2>
                <p
                  className="mt-3 break-words text-2xl font-bold tabular-nums"
                  data-metric={key}
                >
                  {value}
                </p>
                <p
                  className={`mt-3 text-xs leading-5 ${highlight ? 'text-teal-100' : 'text-slate-500'}`}
                >
                  {hint}
                </p>
              </article>
            ))}
          </div>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <p className="panel">
              Đơn đã thanh toán:{' '}
              <strong data-metric="completedOrders">
                {summary.completedOrders}
              </strong>
            </p>
            <p className="panel">
              Đơn tạo trong kỳ, hiện đã hủy:{' '}
              <strong data-metric="cancelledOrders">
                {summary.cancelledOrders}
              </strong>
            </p>
            <p className="panel">
              Giá trị đơn trung bình:{' '}
              <strong data-metric="averageOrderValue">
                {formatMoney(summary.averageOrderValue)}
              </strong>
            </p>
          </div>
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section className="panel min-w-0">
              <h2 className="text-lg font-bold">
                Doanh thu theo {range.granularity === 'hour' ? 'giờ' : 'ngày'}
              </h2>
              <p className="mt-1 mb-5 text-sm text-slate-500">
                Chỉ đơn hoàn thành có thời gian thanh toán hợp lệ · đồng
              </p>
              <RevenueChart
                points={data.revenue.points}
                granularity={range.granularity}
              />
              {summary.completedOrders === 0 && (
                <p className="mt-4 text-sm text-slate-500">
                  Chưa có doanh thu trong khoảng này.
                </p>
              )}
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-teal-700">
                  Xem số liệu biểu đồ
                </summary>
                <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                  {data.revenue.points.map((point) => (
                    <li
                      key={point.date}
                      className="flex flex-wrap justify-between gap-2"
                    >
                      <span>
                        {range.granularity === 'hour'
                          ? point.date.slice(11)
                          : dateLabel(point.date)}
                      </span>
                      <span>{formatMoney(point.revenue)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
            <section className="panel min-w-0">
              <h2 className="text-lg font-bold">Top 10 món bán chạy</h2>
              <p className="mt-1 text-sm text-slate-500">
                Số lượng và doanh thu theo món đã thanh toán
              </p>
              {!data.products.length && (
                <p className="mt-5 text-sm text-slate-500">
                  Chưa có món bán trong khoảng này.
                </p>
              )}
              <ol className="mt-4 divide-y divide-slate-100">
                {data.products.map((product, index) => (
                  <li
                    key={product.productId}
                    data-dashboard-product={product.productId}
                    className="flex gap-3 py-4"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">
                        {product.productName}
                      </p>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
                        <span className="text-slate-500">
                          {product.quantitySold} phần
                        </span>
                        <strong>{formatMoney(product.revenue)}</strong>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <section className="panel min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Đơn gần đây trong kỳ</h2>
              <Link
                to="/admin/orders"
                className="text-sm font-medium text-teal-700 underline"
              >
                Xem danh sách đơn
              </Link>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              10 đơn mới nhất theo thời gian tạo. Bao gồm cả đơn chưa thanh toán
              và đơn hủy.
            </p>
            {!data.orders.length && (
              <p className="mt-5 text-sm text-slate-500">
                Chưa có đơn được tạo trong khoảng này.
              </p>
            )}
            <div className="mt-4 divide-y divide-slate-100">
              {data.orders.map((order) => (
                <article
                  key={order._id}
                  data-dashboard-order={order._id}
                  className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/admin/orders/${order._id}`}
                      className="break-all font-semibold text-teal-700 underline"
                    >
                      {order.orderCode}
                    </Link>
                    <p className="mt-2 break-words text-sm">
                      {order.customerName} · {order.tableName}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Đặt: {formatDateTime(order.createdAt)}
                    </p>
                    {order.paidAt && (
                      <p className="mt-1 text-xs text-slate-500">
                        Thanh toán: {formatDateTime(order.paidAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                    <OrderStatusBadge status={order.status} />
                    <strong className="text-sm">
                      {formatMoney(order.totalAmount)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <p className="text-xs leading-6 text-slate-500">
            Doanh thu/đơn đã thanh toán tính theo ngày thanh toán; tổng đơn/đơn
            hủy tính theo ngày tạo. Bàn và đơn đang xử lý luôn là tình trạng
            hiện tại, gồm cả bàn tắt nhận đơn mới.
            {!range.includesToday &&
              ' Kỳ này không chứa hôm nay nên không tự tải theo thông báo đơn mới; hãy dùng Làm mới số liệu khi cần.'}
          </p>
        </>
      )}
    </section>
  );
}
