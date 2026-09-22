import { useEffect, useState } from 'react';
import { getHealth } from '../api/healthApi.js';
import ConnectionCard from '../components/ConnectionCard.jsx';

export default function HomePage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    // Hủy yêu cầu cũ khi rời trang hoặc khi bắt đầu kiểm tra lại.
    const controller = new AbortController();

    async function checkConnection() {
      setLoading(true);
      setError('');
      setHealth(null);

      try {
        const data = await getHealth(controller.signal);
        if (!controller.signal.aborted) setHealth(data);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setHealth(requestError.response?.data || null);
        setError(
          requestError.response?.data?.message ||
            'Không gọi được backend. Hãy kiểm tra backend đang chạy và địa chỉ API trong client/.env.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    checkConnection();
    return () => controller.abort();
  }, [checkCount]);

  const backendConnected = health?.data?.backend === 'running';
  const databaseConnected = health?.data?.database === 'connected';

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
        Khóa luận · Kiểm tra nền tảng
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Kết nối hệ thống
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">
        Trang kiểm tra React gọi API Express bằng Axios và backend kết nối MongoDB
        bằng Mongoose. Nhấn kiểm tra lại để lấy trạng thái mới nhất.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <ConnectionCard
            title="Backend · Express"
            connected={backendConnected}
            value={loading ? 'Đang kiểm tra…' : backendConnected ? 'Đã nhận phản hồi API' : 'Chưa kết nối'}
          />
          <ConnectionCard
            title="Database · MongoDB"
            connected={databaseConnected}
            value={loading ? 'Đang kiểm tra…' : databaseConnected ? 'Kết nối thành công' : 'Chưa kết nối'}
          />
        </div>

        <div className="mt-5 min-h-7" role="status" aria-live="polite">
          {loading && <p className="text-slate-600">Đang gửi yêu cầu kiểm tra…</p>}
          {!loading && !error && <p className="text-emerald-700">{health?.message}</p>}
          {error && <p className="text-red-700">{error}</p>}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => setCheckCount((count) => count + 1)}
          className="mt-5 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600 disabled:cursor-wait disabled:opacity-50"
        >
          {loading ? 'Đang kiểm tra…' : 'Kiểm tra lại kết nối'}
        </button>
      </div>
    </section>
  );
}
