import { Link, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function FoundationLayout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Nhà hàng / Cafe QR
          </Link>
          <Link
            to={user ? (user.role === 'admin' ? '/admin' : '/staff') : '/login'}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {user ? 'Khu vực nội bộ' : 'Đăng nhập nội bộ'}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
