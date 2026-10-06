import axios, { CanceledError, isCancel, type AxiosError, type AxiosRequestConfig } from 'axios';

export interface AuthContext {
  readonly token: string | null;
  readonly generation: number;
  readonly signal: AbortSignal;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    authContext?: AuthContext;
  }
}

export const api = axios.create({ baseURL: '/api', timeout: 15_000 });
interface AuthHandlers {
  getToken: () => string | null;
  onUnauthorized: () => void;
}
let authHandlers: AuthHandlers = { getToken: () => null, onUnauthorized: () => undefined };
let generation = 0;
let controller = new AbortController();

export const setAuthHandlers = (handlers: AuthHandlers) => {
  authHandlers = handlers;
};

/** Every request belongs to the login that started it, including delayed uploads. */
export const captureAuthContext = (): AuthContext => ({
  token: authHandlers.getToken(),
  generation,
  signal: controller.signal,
});
export const isAuthContextCurrent = (context: AuthContext) =>
  context.generation === generation && context.token === authHandlers.getToken() && !context.signal.aborted;
export const invalidateAuthRequests = () => {
  generation += 1;
  controller.abort();
  controller = new AbortController();
};
export const authRequestConfig = (authContext: AuthContext): AxiosRequestConfig => ({
  authContext,
  signal: authContext.signal,
});
export const isRequestCancelled = isCancel;

export const apiErrorMessage = (e: unknown, fallback: string): string => {
  const message = (e as AxiosError<{ message?: unknown }>).response?.data?.message;
  return typeof message === 'string' ? message : fallback;
};

api.interceptors.request.use(
  (config) => {
    const context = config.authContext ?? captureAuthContext();
    if (!isAuthContextCurrent(context)) throw new CanceledError('Сессия изменилась');
    config.authContext = context;
    config.signal = config.signal
      ? AbortSignal.any([config.signal as AbortSignal, context.signal])
      : context.signal;
    if (context.token) config.headers.set('Authorization', `Bearer ${context.token}`);
    else config.headers.delete('Authorization');
    return config;
  },
  (error: unknown) => {
    throw error;
  },
  { synchronous: true },
);

api.interceptors.response.use(
  (response) => {
    const context = response.config.authContext;
    if (context && !isAuthContextCurrent(context)) throw new CanceledError('Сессия изменилась');
    return response;
  },
  (error: unknown) => {
    const err = error as AxiosError;
    const context = err.config?.authContext;
    if (context && !isAuthContextCurrent(context))
      return Promise.reject(new CanceledError('Сессия изменилась'));
    if (err.response?.status === 401 && context?.token) authHandlers.onUnauthorized();
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);
