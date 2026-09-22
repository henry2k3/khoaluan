import { Outlet, useParams } from 'react-router';
import { CartProvider, useCart } from '../contexts/CartContext.jsx';

function Content() {
  const { error } = useCart();
  return (
    <>
      {error && (
        <p
          role="alert"
          className="mx-auto max-w-5xl break-words bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}
      <Outlet />
    </>
  );
}

export default function CustomerTableLayout() {
  const { qrToken } = useParams();
  return (
    <CartProvider key={qrToken} qrToken={qrToken}>
      <Content />
    </CartProvider>
  );
}
