// entities/user/types.ts
export type Role = 'admin' | 'operator';
export interface User {
  id: string;
  login: string;
  role: Role;
  displayName: string;
  /** Пароль по умолчанию или выданный администратором: до смены доступен только профиль */
  mustChangePassword: boolean;
}
