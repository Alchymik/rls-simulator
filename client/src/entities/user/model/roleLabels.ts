// client/src/entities/user/model/roleLabels.ts
import type { Role } from '../types';

/** Единый источник подписей ролей: профиль, боковое меню, панель пользователей. */
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
};
