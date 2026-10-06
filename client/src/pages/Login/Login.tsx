// client/src/pages/Login/Login.tsx
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '@/features/auth/model/authStore';
import styles from './Login.module.css';

interface Form {
  login: string;
  password: string;
}

const LoginPage = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const loading = useAuthStore((s) => s.loading);
  const navigate = useNavigate();
  const location = useLocation();

  const onSubmit = async (v: Form) => {
    try {
      await login(v.login, v.password);
    } catch {
      return; // текст ошибки уже в сторе — остаёмся на форме
    }
    // ProtectedRoute передал адрес, с которого пользователя выбросило на авторизацию
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    void navigate(from && from !== '/login' ? from : '/', { replace: true });
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <div className={styles.logo}>
          <span>Центр</span>
          <b>2401</b>
        </div>
        <input
          className={styles.input}
          placeholder="логин"
          autoComplete="username"
          aria-label="логин"
          aria-invalid={Boolean(errors.login)}
          {...register('login', { required: true })}
        />
        <input
          className={styles.input}
          type="password"
          placeholder="пароль"
          autoComplete="current-password"
          aria-label="пароль"
          aria-invalid={Boolean(errors.password)}
          {...register('password', { required: true })}
        />
        {errors.login && (
          <div className={styles.err} role="alert">
            Введите логин
          </div>
        )}
        {errors.password && (
          <div className={styles.err} role="alert">
            Введите пароль
          </div>
        )}
        {error && (
          <div className={styles.err} role="alert">
            {error}
          </div>
        )}
        <button className={styles.btn} disabled={loading}>
          {loading ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
