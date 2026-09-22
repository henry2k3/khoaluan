import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getCurrentUser, loginRequest, logoutRequest } from '../api/authApi.js';
import { StaffRealtimeProvider } from './StaffRealtimeContext.jsx';
import {
  getAccessToken,
  removeAccessToken,
  saveAccessToken,
} from '../utils/authStorage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const clearSession = useCallback(() => {
    removeAccessToken();
    setUser(null);
    setSessionError('');
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    const token = getAccessToken();
    clearSession();
    if (token)
      void logoutRequest(token).catch(() => {
        /* Offline vẫn xóa phiên và đóng socket ở tab này. */
      });
  }, [clearSession]);

  useEffect(() => {
    window.addEventListener('auth:expired', clearSession);
    return () => window.removeEventListener('auth:expired', clearSession);
  }, [clearSession]);

  useEffect(() => {
    const token = getAccessToken();
    const controller = new AbortController();

    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setSessionError('');
      try {
        const currentUser = await getCurrentUser(controller.signal);
        if (!controller.signal.aborted && getAccessToken() === token)
          setUser(currentUser);
      } catch (error) {
        if (controller.signal.aborted || getAccessToken() !== token) return;
        if (error.response?.status === 401) clearSession();
        else
          setSessionError(
            'Chưa kiểm tra được phiên đăng nhập. Hãy kiểm tra kết nối và thử lại.',
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    restoreSession();
    return () => controller.abort();
  }, [attempt, clearSession]);

  async function login(username, password) {
    const data = await loginRequest(username, password);
    saveAccessToken(data.accessToken);
    setUser(data.user);
    setSessionError('');
    return data.user;
  }

  async function refreshUser() {
    const token = getAccessToken();
    const currentUser = await getCurrentUser();
    if (getAccessToken() === token) setUser(currentUser);
    return currentUser;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionError,
        login,
        logout,
        refreshUser,
        retrySession: () => setAttempt((value) => value + 1),
      }}
    >
      <StaffRealtimeProvider token={user ? getAccessToken() : null}>
        {children}
      </StaffRealtimeProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải nằm trong AuthProvider.');
  return context;
}
