import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Не даёт одному исключению превратить интерфейс в «белый экран». */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] необработанная ошибка', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className={styles.root}>
        <h1 className={styles.title}>Сбой интерфейса</h1>
        <p className={styles.message}>{error.message}</p>
        <button className={styles.reload} onClick={() => window.location.reload()}>
          Перезагрузить приложение
        </button>
      </div>
    );
  }
}
