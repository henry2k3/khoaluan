import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.jsx';
import SessionStatus from '../../components/SessionStatus.jsx';

export default function LoginPage() {
  const { user, loading, sessionError, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading || sessionError) return <SessionStatus />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/staff'} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const currentUser = await login(username, password);
      setPassword('');
      navigate(currentUser.role === 'admin' ? '/admin' : '/staff', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Chưa kết nối được máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Khu vực nội bộ</p>
      <h1 className="mt-3 text-3xl font-bold">Đăng nhập</h1>
      <p className="mt-3 leading-7 text-slate-600">Dành cho nhân viên và quản lý nhà hàng.</p>
      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        <div>
          <label htmlFor="username" className="block text-sm font-medium">Tên đăng nhập</label>
          <input
            id="username" name="username" type="text" autoComplete="username"
            autoCapitalize="none" spellCheck={false} required maxLength={50}
            value={username} onChange={(event) => setUsername(event.target.value)} disabled={submitting}
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Mật khẩu</label>
          <input
            id="password" name="password" type="password" autoComplete="current-password" required
            value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting}
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
        <button
          type="submit" disabled={submitting}
          className="w-full rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600 disabled:cursor-wait disabled:opacity-50"
        >
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      <p className="mt-6 text-sm leading-6 text-slate-500">
        Khách hàng gọi món bằng mã QR tại bàn, không cần tài khoản.
      </p>
    </section>
  );
}
