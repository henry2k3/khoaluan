import { formatMoney } from '../utils/display.js';
import { formatDateTime, orderStatusLabels } from '../utils/orderDisplay.js';
import OrderStatusBadge from './OrderStatusBadge.jsx';

export default function OrderSummary({ order, showActors = false }) {
  return (
    <>
      <section className="panel mt-5">
        <p className="break-all text-lg font-bold" data-order-code>
          {order.orderCode}
        </p>
        <div className="mt-3">
          <OrderStatusBadge status={order.status} />
        </div>
        <dl className="mt-5 grid gap-4 break-words text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Khách</dt>
            <dd className="mt-1 font-medium">{order.customerName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Bàn</dt>
            <dd className="mt-1 font-medium">{order.tableName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Thời gian đặt</dt>
            <dd className="mt-1">{formatDateTime(order.createdAt)}</dd>
          </div>
          {order.paidAt && (
            <div>
              <dt className="text-slate-500">Đã xác nhận thanh toán lúc</dt>
              <dd className="mt-1" data-paid-at>
                {formatDateTime(order.paidAt)}
              </dd>
            </div>
          )}
        </dl>
        {order.status === 'cancelled' && (
          <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-900">
            <p className="whitespace-pre-wrap break-words">
              <strong>Lý do hủy:</strong> {order.cancelReason}
            </p>
            <p className="mt-2">Hủy lúc: {formatDateTime(order.cancelledAt)}</p>
            {showActors && (
              <p className="mt-2">
                Người hủy:{' '}
                {order.cancelledBy?.fullName || 'Tài khoản không còn tồn tại'}
              </p>
            )}
          </div>
        )}
      </section>
      <section className="panel mt-4">
        <h2 className="font-bold">Món đã đặt</h2>
        <ul className="mt-4 divide-y divide-slate-200">
          {order.items.map((item) => (
            <li
              key={item.productId}
              data-order-product-id={item.productId}
              className="py-4 first:pt-0"
            >
              <h3 className="break-words font-semibold">{item.productName}</h3>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {item.quantity} × {formatMoney(item.unitPrice)}
                </span>
                <strong>{formatMoney(item.lineTotal)}</strong>
              </div>
              {item.note && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
                  Ghi chú: {item.note}
                </p>
              )}
            </li>
          ))}
        </ul>
        {order.note && (
          <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-600">
            <strong>Ghi chú toàn đơn:</strong> {order.note}
          </p>
        )}
        <p className="mt-5 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4 text-lg font-bold">
          <span>Tổng tiền</span>
          <span data-order-total>{formatMoney(order.totalAmount)}</span>
        </p>
      </section>
      <section className="panel mt-4">
        <h2 className="font-bold">Lịch sử trạng thái</h2>
        <ol className="mt-4 space-y-4" data-status-history>
          {order.statusHistory.map((entry, index) => (
            <li key={index} className="border-l-2 border-teal-200 pl-4 text-sm">
              <p className="font-semibold">{orderStatusLabels[entry.status]}</p>
              <p className="mt-1 text-slate-500">
                {formatDateTime(entry.changedAt)}
              </p>
              {showActors && (
                <p className="mt-1 break-words text-slate-600">
                  {entry.changedBy?.fullName ||
                    (entry.status === 'pending'
                      ? 'Khách tạo đơn'
                      : 'Tài khoản không còn tồn tại')}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
