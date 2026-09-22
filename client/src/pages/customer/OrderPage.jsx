import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { publicMenuApi } from '../../api/publicMenuApi.js';
import { findSavedOrder } from '../../utils/guestStorage.js';
import { errorMessage } from '../../utils/display.js';
import DataStatus from '../../components/DataStatus.jsx';

import OrderSummary from '../../components/OrderSummary.jsx';
import useSocketSession from '../../realtime/useSocketSession.js';
import useRealtimeRefresh from '../../realtime/useRealtimeRefresh.js';
import RealtimeStatus from '../../components/RealtimeStatus.jsx';

export default function OrderPage() {
  const { orderId } = useParams();
  return <OrderDetails key={orderId} orderId={orderId} />;
}

function OrderDetails({ orderId }) {
  const [order, setOrder] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [verified, setVerified] = useState(null);
  const connection = useSocketSession({
    enabled: !!verified,
    orderId,
    trackingToken: verified?.trackingToken,
  });
  useRealtimeRefresh({
    connection,
    orderId,
    events: ['order:updated', 'order:cancelled'],
    visible: true,
    refresh: () => setAttempt((value) => value + 1),
  });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      setOrder(null);
      try {
        const remembered = findSavedOrder(orderId);
        if (!remembered)
          throw new Error(
            'Trình duyệt này không có mã xem đơn. Hãy mở trên trình duyệt đã đặt món. Nếu lần gửi trước bị ngắt, quay lại giỏ ở đúng bàn và kiểm tra lại lần gửi.',
          );
        setSaved(remembered);
        const data = await publicMenuApi.order(
          orderId,
          remembered.trackingToken,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setOrder(data);
          setVerified(remembered); // Chỉ tham gia room sau khi API đã đọc đơn thành công.
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure.response || failure.code
              ? errorMessage(failure)
              : failure.message,
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [orderId, attempt]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-bold">Đơn của bạn</h1>
      {verified && <RealtimeStatus connection={connection} />}
      <DataStatus
        loading={loading}
        error={error}
        onRetry={() => setAttempt((value) => value + 1)}
      />
      {!loading && !error && order && (
        <>
          <OrderSummary order={order} />
          <button
            type="button"
            className="button-secondary mt-5 w-full"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Làm mới trạng thái
          </button>
          <p className="mt-3 text-sm text-slate-500">
            Trạng thái tự cập nhật khi có kết nối. Bạn vẫn có thể nhấn làm mới.
          </p>
        </>
      )}
      {saved && (
        <Link
          className="button-primary mt-5 w-full"
          to={`/menu/${saved.qrToken}`}
        >
          Về menu / Đặt thêm món
        </Link>
      )}
    </main>
  );
}
