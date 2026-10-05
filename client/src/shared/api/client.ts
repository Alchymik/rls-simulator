// client/src/shared/api/client.ts
import axios, { type AxiosError } from 'axios';

export const api = axios.create({ baseURL: '/api' });

interface AuthHandlers {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

let authHandlers: AuthHandlers = { getToken: () => null, onUnauthorized: () => undefined };

/** Регистрируется из features/auth: shared не должен зависеть от features (FSD). */
export const setAuthHandlers = (handlers: AuthHandlers) => {
  authHandlers = handlers;
};

/** Тело ошибки API: сервер отдаёт описание проблемы в поле message. */
interface ApiErrorBody {
  message?: string;
}

/** Текст ошибки от API (сеть, 400/403/409) для показа пользователю. */
export const apiErrorMessage = (e: unknown, fallback: string): string => {
  const message = (e as AxiosError<ApiErrorBody>).response?.data?.message;
  return typeof message === 'string' ? message : fallback;
};

api.interceptors.request.use((cfg) => {
  const token = authHandlers.getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (error: unknown) => {
    if ((error as AxiosError).response?.status === 401) authHandlers.onUnauthorized();
    // Отклоняем исходную ошибку axios: обработчики читают из неё response.data.message
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);
