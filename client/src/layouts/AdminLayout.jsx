import { NavLink, Outlet } from 'react-router';
import StaffRealtimeBanner from '../components/StaffRealtimeBanner.jsx';

const links = [
  ['/admin/dashboard', 'Dashboard'],
  ['/admin', 'Tài khoản'],
  ['/admin/orders', 'Đơn hàng'],
  ['/admin/categories', 'Danh mục'],
  ['/admin/products', 'Món ăn / Đồ uống'],
  ['/admin/tables', 'Bàn & QR'],
];

export default function AdminLayout() {
  return (
    <>
      <nav
        aria-label="Quản lý"
        className="mb-8 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2"
      >
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              `rounded-lg px-4 py-3 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <StaffRealtimeBanner basePath="/admin/orders" />
      <Outlet />
    </>
  );
}
