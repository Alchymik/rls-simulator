// ProtectedRoute.tsx
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '@/features/auth/model/authStore';
import { Loader } from '@/shared/ui/Loader';

export const ProtectedRoute = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const verified = useAuthStore((s) => s.verified);
  const verifySession = useAuthStore((s) => s.verifySession);
  const location = useLocation();

  // Проверяем сохранённую сессию до показа разделов (п.3.3.3 ТЗ)
  useEffect(() => {
    if (token && !verified) void verifySession();
  }, [token, verified, verifySession]);

  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!verified || !user) return <Loader fullscreen />;
  return <Outlet />;
};