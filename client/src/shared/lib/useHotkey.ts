import { useEffect, useRef } from 'react';

/**
 * Горячая клавиша уровня окна (п.2.3 ТЗ). Сравнение по `event.code`,
 * чтобы не зависеть от раскладки; ввод в полях игнорируется.
 */
export const useHotkey = (code: string, handler: () => void, enabled = true) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'TEXTAREA';
      if (
        document.querySelector('body > dialog[open]') ||
        target?.closest('button, a') ||
        isEditing ||
        event.code !== code ||
        event.repeat
      )
        return;

      event.preventDefault();
      handlerRef.current();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [code, enabled]);
};
