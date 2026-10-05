// AppLayout.tsx
import { Outlet } from 'react-router';
import { SideMenu } from '@/widgets/SideMenu/SideMenu';
import { TopBar } from '@/widgets/TopBar/TopBar';
import { NotificationsPanel } from '@/widgets/NotificationsPanel/NotificationsPanel';
import { useAlarmEvents } from '@/widgets/NotificationsPanel/useAlarmEvents';
import { useUiStore } from '@/features/simulation/model/uiStore';
import styles from './AppLayout.module.css';

export const AppLayout = () => {
  const notificationsOpen = useUiStore((s) => s.notificationsOpen);
  useAlarmEvents();

  return (
    <div className={styles.root}>
      <TopBar />
      <div className={styles.body}>
        <SideMenu />
        <main className={styles.content}>
          <Outlet />
        </main>
        {notificationsOpen && <NotificationsPanel />}
      </div>
    </div>
  );
};