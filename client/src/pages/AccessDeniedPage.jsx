import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AccessDeniedPage() {
  const { user } = useAuth();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8">
      <p className="font-semibold text-teal-700">403</p>
      <h1 className="mt-3 text-2xl font-bold">Bạn không có quyền truy cập</h1>
      <p className="mt-4 text-slate-600">Tài khoản hiện tại không được phép mở trang này.</p>
      <Link to={user?.role === 'admin' ? '/admin' : '/staff'} className="mt-6 inline-block font-medium text-teal-700 underline">
        Về trang của tôi
      </Link>
    </section>
  );
}
