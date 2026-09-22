import { NavLink, Outlet } from 'react-router';
import StaffRealtimeBanner from '../components/StaffRealtimeBanner.jsx';

export default function StaffLayout() {
  return (
    <>
      <nav
        aria-label="Nhân viên"
        className="mb-8 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2"
      >
        {[
          ['/staff', 'Tài khoản'],
          ['/staff/orders', 'Đơn hàng'],
          ['/staff/tables', 'Tình trạng bàn'],
        ].map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/staff'}
            className={({ isActive }) =>
              `rounded-lg px-4 py-3 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <StaffRealtimeBanner />
      <Outlet />
    </>
  );
}
