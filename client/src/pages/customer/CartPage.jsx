import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCart } from '../../contexts/CartContext.jsx';
import { publicMenuApi } from '../../api/publicMenuApi.js';
import { errorMessage, formatMoney } from '../../utils/display.js';
import ProductImage from '../../components/ProductImage.jsx';
import DataStatus from '../../components/DataStatus.jsx';
import GuestOrders from '../../components/GuestOrders.jsx';

export default function CartPage() {
  const {
    cart,
    qrToken,
    updateItem,
    removeItem,
    setNote,
    prepareSubmission,
    finishSubmission,
    rejectSubmission,
  } = useCart();
  const navigate = useNavigate();
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const locked = sending || !!cart.pending;
  const total = cart.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setTableError('');
    publicMenuApi
      .table(qrToken, controller.signal)
      .then((table) => {
        if (!controller.signal.aborted) setTable(table);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setTableError(errorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [qrToken, attempt]);

  async function submit(event) {
    event.preventDefault();
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    let payload;
    try {
      payload = prepareSubmission();
      const result = await publicMenuApi.createOrder(payload);
      finishSubmission(payload.requestId, result);
      navigate(`/orders/${result.orderId}`);
    } catch (failure) {
      // Lỗi kiểm tra đầu vào rõ ràng: cho sửa giỏ. Mất mạng/5xx/409: giữ mã cũ để retry.
      if (
        payload &&
        [400, 403, 404, 413, 422].includes(failure.response?.status)
      ) {
        try {
          rejectSubmission(payload.requestId);
        } catch {
          /* Giữ lần gửi nếu storage lỗi. */
        }
      }
      setError(
        failure.response
          ? errorMessage(failure)
          : failure.message === 'Network Error' ||
              failure.code === 'ECONNABORTED'
            ? 'Chưa nhận được kết quả. Giỏ vẫn được giữ; hãy nhấn Kiểm tra lại lần gửi.'
            : failure.message,
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        className="text-sm font-medium text-teal-700 underline"
        to={`/menu/${qrToken}`}
      >
        ← Tiếp tục xem menu
      </Link>
      <h1 className="mt-5 text-3xl font-bold">Giỏ hàng</h1>
      <DataStatus
        loading={loading}
        error={tableError}
        onRetry={() => setAttempt((value) => value + 1)}
      />
      {!loading && !tableError && table && (
        <p className="mt-3 break-words text-slate-600">
          <strong>{table.name}</strong> · {cart.customerName || 'Chưa nhập tên'}
        </p>
      )}
      {!cart.customerName && (
        <p className="panel mt-5">
          Vui lòng{' '}
          <Link className="text-teal-700 underline" to={`/menu/${qrToken}`}>
            nhập tên ở menu
          </Link>{' '}
          trước khi gửi đơn.
        </p>
      )}
      {cart.pending && !sending && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"
        >
          Lần gửi trước chưa rõ kết quả. Hãy kiểm tra lại lần gửi để nhận đúng
          đơn đã lưu, rồi mới thay đổi giỏ hoặc đặt thêm.
        </p>
      )}
      {!cart.items.length ? (
        <section className="panel mt-5">
          <h2 className="font-bold">Giỏ hàng đang rỗng</h2>
          <p className="mt-2 text-slate-600">
            Chọn món trong menu để bắt đầu gọi món.
          </p>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <fieldset disabled={locked} className="min-w-0 space-y-4">
            <legend className="sr-only">Món trong giỏ</legend>
            {cart.items.map((item) => (
              <article
                data-cart-product-id={item.productId}
                key={item.productId}
                className="panel min-w-0"
              >
                <div className="flex items-start gap-3">
                  <ProductImage
                    src={item.imageUrl}
                    name={item.productName}
                    className="h-16 w-16 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-bold">
                      {item.productName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatMoney(item.unitPrice)} / món
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={`Giảm ${item.productName}`}
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        updateItem(item.productId, {
                          quantity: item.quantity - 1,
                        })
                      }
                    >
                      −
                    </button>
                    <span
                      aria-label="Số lượng"
                      className="min-w-5 text-center font-bold"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={`Tăng ${item.productName}`}
                      disabled={item.quantity >= 99}
                      onClick={() =>
                        updateItem(item.productId, {
                          quantity: item.quantity + 1,
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-700 underline"
                    onClick={() => removeItem(item.productId)}
                  >
                    Xóa món
                  </button>
                </div>
                <label
                  className="mt-4 block text-sm font-medium"
                  htmlFor={`note-${item.productId}`}
                >
                  Ghi chú món
                </label>
                <textarea
                  id={`note-${item.productId}`}
                  className="form-input mt-2"
                  maxLength={500}
                  rows={2}
                  value={item.note}
                  onChange={(event) =>
                    updateItem(item.productId, { note: event.target.value })
                  }
                />
                <p className="mt-3 break-words text-right font-bold text-teal-700">
                  {formatMoney(item.unitPrice * item.quantity)}
                </p>
              </article>
            ))}
            <div className="panel">
              <label className="block font-medium" htmlFor="order-note">
                Ghi chú toàn đơn
              </label>
              <textarea
                id="order-note"
                className="form-input mt-3"
                maxLength={1000}
                rows={3}
                placeholder="Ví dụ: mang đồ uống ra trước"
                value={cart.note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </fieldset>
          <section className="panel">
            <div className="flex flex-wrap justify-between gap-3 text-lg font-bold">
              <span>Tổng tạm tính</span>
              <span data-cart-total>{formatMoney(total)}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Giá và tình trạng món được kiểm tra lại khi gửi. Tổng chính thức
              hiển thị trong đơn vừa đặt.
            </p>
            {error && (
              <p role="alert" className="mt-4 break-words text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              className="button-primary mt-5 w-full"
              disabled={
                sending ||
                (!cart.pending &&
                  (loading || !!tableError || !cart.customerName))
              }
            >
              {sending
                ? 'Đang gửi…'
                : cart.pending
                  ? 'Kiểm tra lại lần gửi'
                  : 'Gửi order'}
            </button>
          </section>
        </form>
      )}
      <GuestOrders />
    </main>
  );
}
