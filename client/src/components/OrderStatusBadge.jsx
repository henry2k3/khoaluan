import { orderStatusLabels } from '../utils/orderDisplay.js';

const colors = {
  pending: 'bg-amber-50 text-amber-900',
  confirmed: 'bg-blue-50 text-blue-800',
  preparing: 'bg-violet-50 text-violet-800',
  served: 'bg-teal-50 text-teal-800',
  completed: 'bg-emerald-50 text-emerald-800',
  cancelled: 'bg-red-50 text-red-800',
};
export default function OrderStatusBadge({ status }) {
  return (
    <span
      data-order-status={status}
      className={`inline-block rounded-full px-3 py-2 text-sm font-semibold ${colors[status] || 'bg-slate-100'}`}
    >
      {orderStatusLabels[status] || status}
    </span>
  );
}
