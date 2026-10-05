// client/src/features/users/api/usersApi.ts
import { api } from '@/shared/api/client';
import type { Role, User } from '@/entities/user/types';
export interface CreateUserPayload {
  login: string;
  password: string;
  displayName: string;
  role: Role;
}

export interface UpdateUserPayload {
  displayName?: string;
  role?: Role;
  password?: string;
}

export const fetchUsers = () => api.get<User[]>('/users').then((r) => r.data);

export const createUser = (payload: CreateUserPayload) =>
  api.post<User>('/users', payload).then((r) => r.data);

export const updateUser = (id: string, payload: UpdateUserPayload) =>
  api.patch<User>(`/users/${id}`, payload).then((r) => r.data);

export const deleteUser = (id: string) => api.delete(`/users/${id}`).then(() => undefined);
