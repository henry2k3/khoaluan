import { Link } from 'react-router';
import { useCart } from '../contexts/CartContext.jsx';

export default function GuestOrders() {
  const { cart } = useCart();
  if (!cart.orders.length) return null;
  return (
    <section className="panel mt-6">
      <h2 className="font-bold">Đơn đã đặt trên trình duyệt này</h2>
      <ul className="mt-3 space-y-3">
        {cart.orders.map((order) => (
          <li key={order.orderId}>
            <Link
              className="break-all font-medium text-teal-700 underline"
              to={`/orders/${order.orderId}`}
            >
              {order.orderCode}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
