import { useAuth } from '../contexts/AuthContext.jsx';

export default function SessionStatus() {
  const { loading, sessionError, retrySession, logout } = useAuth();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6" role="status">
      <p>{loading ? 'Đang kiểm tra phiên đăng nhập…' : sessionError}</p>
      {!loading && sessionError && (
        <div className="mt-4 flex flex-wrap gap-4">
          <button type="button" onClick={retrySession} className="font-medium text-teal-700 underline">
            Thử lại
          </button>
          <button type="button" onClick={logout} className="font-medium text-slate-700 underline">
            Đăng nhập lại
          </button>
        </div>
      )}
    </div>
  );
}
