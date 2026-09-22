import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext.jsx';
import { checkAdminAccess } from '../api/authApi.js';

export default function InternalWelcome({ adminOnly = false }) {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function checkAccess() {
    setChecking(true);
    setResult('');
    setError('');
    try {
      await refreshUser();
      const message = adminOnly ? await checkAdminAccess() : 'Phiên đăng nhập của bạn đang hoạt động.';
      setResult(message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Chưa kết nối được máy chủ. Vui lòng thử lại.');
    } finally {
      setChecking(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Đăng nhập thành công</p>
      <h1 className="mt-3 text-3xl font-bold">{adminOnly ? 'Khu vực quản lý' : 'Khu vực nhân viên'}</h1>
      <p className="mt-4 text-lg">Xin chào, <strong>{user.fullName}</strong>.</p>
      <dl className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
        <div><dt className="text-sm text-slate-500">Tên đăng nhập</dt><dd className="mt-1 font-medium">{user.username}</dd></div>
        <div><dt className="text-sm text-slate-500">Vai trò</dt><dd className="mt-1 font-medium">{user.role === 'admin' ? 'Quản lý' : 'Nhân viên'}</dd></div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button" disabled={checking} onClick={checkAccess}
          className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {checking ? 'Đang kiểm tra…' : 'Kiểm tra quyền truy cập'}
        </button>
        <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-300 px-5 py-3 font-medium hover:bg-slate-50">
          Đăng xuất
        </button>
      </div>
      <div className="mt-5" role="status" aria-live="polite">
        {result && <p className="text-emerald-700">{result}</p>}
        {error && <p className="text-red-700">{error}</p>}
      </div>
    </section>
  );
}
