// client/src/widgets/SideMenu/SideMenu.tsx
import clsx from 'clsx';
import { NavLink } from 'react-router';
import { useAuthStore } from '@/features/auth/model/authStore';
import { ROLE_LABEL } from '@/entities/user/model/roleLabels';
import styles from './SideMenu.module.css';

const linkClass = ({ isActive }: { isActive: boolean }) => clsx(styles.link, isActive && styles.active);

export const SideMenu = () => {
  const user = useAuthStore((s) => s.user);

  return (
    <nav className={styles.menu}>
      <h2 className={styles.title}>Меню</h2>

      {/* Разделы основного меню по п.3.2 ТЗ, п.2 */}
      <NavLink to="/" end className={linkClass}>
        ▶ Режим «Тренировка»
      </NavLink>
      <NavLink to="/profile" className={linkClass}>
        👤 Профиль
      </NavLink>
      <NavLink to="/settings" className={linkClass}>
        ⚙ Настройки
      </NavLink>

      <div className={styles.footer}>
        <NavLink to="/profile" className={styles.user}>
          <div className={styles.avatar}>👤</div>
          <div>
            <div className={styles.name}>{user?.displayName ?? 'гость'}</div>
            <div className={styles.role}>{user ? ROLE_LABEL[user.role] : 'нет сессии'}</div>
          </div>
        </NavLink>
      </div>
    </nav>
  );
};
