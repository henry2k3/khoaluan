import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext.jsx';
import SessionStatus from '../components/SessionStatus.jsx';
import AccessDeniedPage from '../pages/AccessDeniedPage.jsx';

export default function ProtectedRoute({ roles }) {
  const { user, loading, sessionError } = useAuth();
  if (loading || sessionError) return <SessionStatus />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <AccessDeniedPage />;
  return <Outlet />;
}
