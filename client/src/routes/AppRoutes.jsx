import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import FoundationLayout from '../layouts/FoundationLayout.jsx';
import HomePage from '../pages/HomePage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import AdminHomePage from '../pages/admin/AdminHomePage.jsx';
// Chỉ tải Chart.js khi mở dashboard; trang menu/giỏ không phải tải thư viện biểu đồ.
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage.jsx'));
import StaffHomePage from '../pages/staff/StaffHomePage.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import CategoriesPage from '../pages/admin/CategoriesPage.jsx';
import ProductsPage from '../pages/admin/ProductsPage.jsx';
import TablesPage from '../pages/admin/TablesPage.jsx';
import CustomerMenuPage from '../pages/customer/CustomerMenuPage.jsx';
import CustomerTableLayout from '../layouts/CustomerTableLayout.jsx';
import CartPage from '../pages/customer/CartPage.jsx';
import OrderPage from '../pages/customer/OrderPage.jsx';
import StaffLayout from '../layouts/StaffLayout.jsx';
import OrdersPage from '../pages/staff/OrdersPage.jsx';
import OrderDetailPage from '../pages/staff/OrderDetailPage.jsx';
import TableStatusPage from '../pages/staff/TableStatusPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/menu/:qrToken" element={<CustomerTableLayout />}>
        <Route index element={<CustomerMenuPage />} />
        <Route path="cart" element={<CartPage />} />
      </Route>
      <Route path="/orders/:orderId" element={<OrderPage />} />
      <Route
        element={
          <AuthProvider>
            <FoundationLayout />
          </AuthProvider>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminHomePage />} />
            <Route
              path="dashboard"
              element={
                <Suspense fallback={<p role="status">Đang tải dashboard…</p>}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="tables" element={<TablesPage />} />
            <Route
              path="orders"
              element={<OrdersPage basePath="/admin/orders" />}
            />
            <Route
              path="orders/:id"
              element={<OrderDetailPage basePath="/admin/orders" />}
            />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['admin', 'staff']} />}>
          <Route path="staff" element={<StaffLayout />}>
            <Route index element={<StaffHomePage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="tables" element={<TableStatusPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
