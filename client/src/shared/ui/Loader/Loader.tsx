import clsx from 'clsx';
import styles from './Loader.module.css';

interface Props {
  fullscreen?: boolean;
  label?: string;
}

export const Loader = ({ fullscreen, label = 'Загрузка…' }: Props) => (
  <div className={clsx(styles.root, fullscreen && styles.fullscreen)} role="status" aria-live="polite">
    <span className={styles.spinner} aria-hidden />
    <span className={styles.label}>{label}</span>
  </div>
);
