import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { orderApi } from '../../api/orderApi.js';
import { errorMessage, formatMoney } from '../../utils/display.js';
import { orderActionLabels } from '../../utils/orderDisplay.js';
import DataStatus from '../../components/DataStatus.jsx';
import OrderSummary from '../../components/OrderSummary.jsx';
import Modal from '../../components/Modal.jsx';
import { useStaffRealtime } from '../../contexts/StaffRealtimeContext.jsx';
import useRealtimeRefresh from '../../realtime/useRealtimeRefresh.js';

export default function OrderDetailPage({ basePath = '/staff/orders' }) {
  const { id } = useParams();
  const location = useLocation();
  return (
    <Detail
      key={id}
      id={id}
      basePath={basePath}
      listQuery={location.state?.listQuery || ''}
    />
  );
}

function Detail({ id, basePath, listQuery }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState('');
  const [reason, setReason] = useState('');
  const busyRef = useRef(false);
  const refreshAfterSave = useRef(false);
  const { connection } = useStaffRealtime();
  useRealtimeRefresh({
    connection,
    orderId: id,
    events: ['order:updated', 'order:cancelled'],
    refresh: () => {
      if (busyRef.current) {
        refreshAfterSave.current = true;
        return;
      }
      // Không giữ hộp xác nhận dựa trên dữ liệu cũ, không tự thực hiện bước tiếp theo.
      setDialog('');
      setReason('');
      setAttempt((value) => value + 1);
    },
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    setOrder(null);
    orderApi
      .detail(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setOrder(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);

  async function apply(status) {
    if (busyRef.current || !order) return;
    if (status === 'cancelled' && !reason.trim()) {
      setActionError('Vui lòng nhập lý do hủy.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setActionError('');
    setMessage('');
    try {
      const result =
        status === 'cancelled'
          ? await orderApi.cancel(id, order.status, reason.trim())
          : await orderApi.updateStatus(id, order.status, status);
      setOrder(result);
      setDialog('');
      setReason('');
      setMessage('Đã cập nhật đơn hàng.');
    } catch (failure) {
      const conflict = failure.response?.status === 409;
      setActionError(errorMessage(failure));
      if (conflict || !failure.response || failure.response.status >= 500) {
        // Kể cả mất phản hồi: tải lại trước khi cho làm tiếp, không tự gửi bước kế tiếp.
        setDialog('');
        setOrder(null);
        setLoading(true);
        setAttempt((value) => value + 1);
        if (conflict)
          setMessage(
            'Đang tải lại đơn mới nhất. Hãy kiểm tra trước khi thao tác tiếp.',
          );
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (refreshAfterSave.current) {
        refreshAfterSave.current = false;
        setDialog('');
        setAttempt((value) => value + 1);
      }
    }
  }
  function action(status) {
    setActionError('');
    if (status === 'cancelled' || status === 'completed') setDialog(status);
    else void apply(status);
  }
  return (
    <section className="mx-auto max-w-3xl">
      <Link
        className="font-medium text-teal-700 underline"
        to={`${basePath}${listQuery ? `?${listQuery}` : ''}`}
      >
        ← Danh sách đơn
      </Link>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Chi tiết đơn hàng</h1>
        <button
          className="button-secondary"
          disabled={busy || loading}
          onClick={() => {
            setMessage('');
            setActionError('');
            setAttempt((value) => value + 1);
          }}
        >
          Làm mới đơn
        </button>
      </div>
      {message && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-800"
        >
          {message}
        </p>
      )}
      {actionError && !dialog && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {actionError}
        </p>
      )}
      <div className="mt-5">
        <DataStatus
          loading={loading}
          error={loadError}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      </div>
      {!loading && !loadError && order && (
        <>
          <div className="flex flex-wrap gap-3" data-order-actions>
            {order.allowedTransitions.map((status) => (
              <button
                key={status}
                disabled={busy}
                className={
                  status === 'cancelled'
                    ? 'button-secondary text-red-700'
                    : 'button-primary'
                }
                onClick={() => action(status)}
              >
                {busy ? 'Đang xử lý…' : orderActionLabels[status]}
              </button>
            ))}
          </div>
          <OrderSummary order={order} showActors />
        </>
      )}
      {dialog && order && (
        <Modal
          title={
            dialog === 'cancelled' ? 'Hủy đơn hàng' : 'Xác nhận thanh toán'
          }
          onClose={() => {
            if (!busy) setDialog('');
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void apply(dialog);
            }}
            className="space-y-4"
          >
            <p className="break-all font-semibold">{order.orderCode}</p>
            {dialog === 'cancelled' ? (
              <>
                <label
                  htmlFor="cancel-reason"
                  className="block text-sm font-medium"
                >
                  Lý do hủy
                </label>
                <textarea
                  id="cancel-reason"
                  required
                  maxLength={1000}
                  rows={4}
                  className="form-input"
                  disabled={busy}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </>
            ) : (
              <>
                <p>
                  Chỉ hoàn thành đơn này sau khi khách đã thanh toán{' '}
                  <strong>{formatMoney(order.totalAmount)}</strong>.
                </p>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    required
                    disabled={busy}
                    className="mt-1"
                  />
                  Tôi xác nhận đã nhận đủ tiền cho đơn này.
                </label>
              </>
            )}
            {actionError && (
              <p role="alert" className="text-sm text-red-700">
                {actionError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} className="button-primary">
                {busy
                  ? 'Đang xử lý…'
                  : dialog === 'cancelled'
                    ? 'Xác nhận hủy đơn'
                    : 'Đã nhận tiền & hoàn thành'}
              </button>
              <button
                type="button"
                disabled={busy}
                className="button-secondary"
                onClick={() => setDialog('')}
              >
                Quay lại
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
