// client/src/features/auth/api/authApi.ts
import { api, authRequestConfig, captureAuthContext } from '@/shared/api/client';
import type { User } from '@/entities/user/types';

export interface LoginResponse {
  token: string;
  user: User;
}

export const loginRequest = (login: string, password: string) =>
  api.post<LoginResponse>('/auth/login', { login, password }).then((r) => r.data);

export const meRequest = (context = captureAuthContext()) =>
  api.get<User>('/auth/me', authRequestConfig(context)).then((r) => r.data);

export const changePasswordRequest = (currentPassword: string, newPassword: string) =>
  api.post<LoginResponse>('/auth/password', { currentPassword, newPassword }).then((r) => r.data);
