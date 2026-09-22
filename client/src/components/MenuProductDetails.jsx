import { useEffect, useState } from 'react';
import { useCart } from '../contexts/CartContext.jsx';
import { publicMenuApi } from '../api/publicMenuApi.js';
import { errorMessage, formatMoney } from '../utils/display.js';
import Modal from './Modal.jsx';
import DataStatus from './DataStatus.jsx';
import ProductImage from './ProductImage.jsx';

export default function MenuProductDetails({ productId, onClose }) {
  const { cart, addItem, error: cartError } = useCart();
  const existing = cart.items.find((item) => item.productId === productId);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState(existing?.note || '');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    publicMenuApi
      .product(productId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setProduct(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [productId, attempt]);
  return (
    <Modal title={product?.name || 'Chi tiết món'} onClose={onClose}>
      <DataStatus
        loading={loading}
        error={error}
        onRetry={() => setAttempt((value) => value + 1)}
      />
      {!loading && !error && product && (
        <>
          <ProductImage
            src={product.imageUrl}
            name={product.name}
            className="aspect-[4/3] w-full rounded-xl"
          />
          <p className="mt-4 text-xl font-bold text-teal-700">
            {formatMoney(product.price)}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {product.isAvailable ? 'Còn món' : 'Tạm hết món'}
          </p>
          <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-600">
            {product.description || 'Món hiện chưa có mô tả.'}
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (addItem(product, Number(quantity), note)) onClose();
            }}
          >
            {existing && (
              <p className="text-sm text-slate-600">
                Đã có {existing.quantity} trong giỏ. Ghi chú bên dưới áp dụng
                cho cả món này.
              </p>
            )}
            <label className="block text-sm font-medium" htmlFor="add-quantity">
              Số lượng thêm
            </label>
            <input
              id="add-quantity"
              className="form-input"
              type="number"
              inputMode="numeric"
              min="1"
              max={99 - (existing?.quantity || 0)}
              step="1"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <label className="block text-sm font-medium" htmlFor="add-note">
              Ghi chú món
            </label>
            <textarea
              id="add-note"
              className="form-input"
              maxLength={500}
              rows={2}
              placeholder="Ví dụ: ít đá, không đường"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            {cartError && (
              <p role="alert" className="text-sm text-red-700">
                {cartError}
              </p>
            )}
            <button
              className="button-primary w-full"
              disabled={
                !product.isAvailable ||
                !!cart.pending ||
                existing?.quantity === 99
              }
            >
              Thêm vào giỏ
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
