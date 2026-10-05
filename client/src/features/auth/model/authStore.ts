// client/src/features/auth/model/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/entities/user/types';
import { apiErrorMessage, setAuthHandlers } from '@/shared/api/client';
import { loginRequest, meRequest } from '../api/authApi';

interface State {
  user: User | null;
  token: string | null;
  /** Сессия подтверждена сервером в текущем запуске приложения */
  verified: boolean;
  loading: boolean;
  error: string | null;
  login: (login: string, password: string) => Promise<void>;
  verifySession: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      verified: false,
      loading: false,
      error: null,

      login: async (login, password) => {
        set({ loading: true, error: null });
        try {
          const { user, token } = await loginRequest(login, password);
          set({ user, token, verified: true, loading: false });
        } catch (e: unknown) {
          set({ error: apiErrorMessage(e, 'Ошибка входа'), loading: false });
          throw e;
        }
      },

      /**
       * Проверка сохранённого токена при запуске приложения: сервер держит данные
       * в памяти, поэтому токен прошлого запуска может быть уже недействителен.
       */
      verifySession: async () => {
        const { token, logout } = get();
        if (!token) return;
        try {
          set({ user: await meRequest(), verified: true });
        } catch {
          // 401 уже обработан интерцептором — завершаем сессию локально
          logout();
        }
      },

      logout: () => set({ user: null, token: null, verified: false }),
    }),
    {
      name: 'rls-auth',
      version: 1,
      // Хранится только сессия: признак проверки должен сбрасываться при каждом запуске
      partialize: (state) => ({ user: state.user, token: state.token }),
      migrate: (persisted) => persisted as Pick<State, 'user' | 'token'>,
    },
  ),
);

// Связываем HTTP-клиент с авторизацией здесь, а не внутри shared/api (иначе цикл модулей)
setAuthHandlers({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => useAuthStore.getState().logout(),
});
