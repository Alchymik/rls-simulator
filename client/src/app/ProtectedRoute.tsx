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
  const error = useAuthStore((s) => s.error);
  const location = useLocation();

  // Проверяем сохранённую сессию до показа разделов (п.3.3.3 ТЗ)
  useEffect(() => {
    if (token && !verified) void verifySession();
  }, [token, verified, verifySession]);

  // Сервер не ответил: повторяем проверку, а не выбрасываем пользователя на форму входа
  useEffect(() => {
    if (!token || verified || !error) return;
    const id = setTimeout(() => void verifySession(), 3000);
    return () => clearTimeout(id);
  }, [token, verified, error, verifySession]);

  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!verified || !user) return <Loader fullscreen label={error ?? undefined} />;
  // Пароль по умолчанию (admin/admin) нужно сменить до начала работы
  if (user.mustChangePassword && location.pathname !== '/profile') return <Navigate to="/profile" replace />;
  return <Outlet />;
};
