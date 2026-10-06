import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/entities/user/types';
import {
  apiErrorMessage,
  captureAuthContext,
  invalidateAuthRequests,
  isAuthContextCurrent,
  isRequestCancelled,
  setAuthHandlers,
} from '@/shared/api/client';
import { changePasswordRequest, loginRequest, meRequest } from '../api/authApi';

interface State {
  user: User | null;
  token: string | null;
  verified: boolean;
  loading: boolean;
  error: string | null;
  login: (login: string, password: string) => Promise<void>;
  verifySession: () => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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
        if (get().loading) return;
        set({ loading: true, error: null });
        const context = captureAuthContext();
        try {
          const session = await loginRequest(login, password);
          if (!isAuthContextCurrent(context)) return;
          set({ ...session, verified: true, loading: false });
        } catch (error) {
          if (isAuthContextCurrent(context) && !isRequestCancelled(error)) {
            set({ error: apiErrorMessage(error, 'Ошибка входа'), loading: false });
            throw error;
          }
        }
      },
      verifySession: async () => {
        if (!get().token) return;
        const context = captureAuthContext();
        try {
          const user = await meRequest(context);
          if (isAuthContextCurrent(context)) set({ user, verified: true, error: null });
        } catch (error) {
          if (isAuthContextCurrent(context) && !isRequestCancelled(error)) {
            set({ error: apiErrorMessage(error, 'Сервер недоступен, повторяем попытку…') });
          }
        }
      },
      logout: () => set({ user: null, token: null, verified: false, loading: false, error: null }),
      changePassword: async (currentPassword, newPassword) => {
        const context = captureAuthContext();
        const session = await changePasswordRequest(currentPassword, newPassword);
        if (isAuthContextCurrent(context)) set({ ...session, verified: true, error: null });
      },
    }),
    {
      name: 'rls-auth',
      version: 1,
      partialize: (state) => ({ user: state.user, token: state.token }),
      migrate: (persisted) => persisted as Pick<State, 'user' | 'token'>,
    },
  ),
);

setAuthHandlers({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => useAuthStore.getState().logout(),
});
useAuthStore.subscribe((state, prev) => {
  if (state.token !== prev.token || state.user?.id !== prev.user?.id) invalidateAuthRequests();
});
