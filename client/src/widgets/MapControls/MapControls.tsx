// client/src/widgets/MapControls/MapControls.tsx
import { useEffect, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import { RADAR } from '@/features/simulation/lib/config';
import styles from './MapControls.module.css';

const DEFAULT_ZOOM = 13;
const ROTATE_STEP = 15;

/** Панель позиции (п.3.3.2.5) и панель компаса (п.3.3.2.6) режима тренировки. */
export const MapControls = ({ map }: { map: LeafletMap | null }) => {
  const home = useSettingsStore((s) => s.map.home);
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    if (!map) return;

    const sync = () => setBearing(map.getBearing());
    sync();
    map.on('rotate', sync);
    return () => {
      map.off('rotate', sync);
    };
  }, [map]);

  const goHome = () => {
    if (!map) return;
    const target = home ?? { ...RADAR.center, zoom: DEFAULT_ZOOM };
    map.setView([target.lat, target.lng], target.zoom, { animate: true });
  };

  /** Возврат карты с ориентацией на север (п.3.3.2.6 ТЗ). */
  const resetNorth = () => map?.setBearing(0);

  const rotateBy = (delta: number) => {
    if (!map) return;
    map.setBearing(map.getBearing() + delta);
  };

  return (
    <div className={styles.root}>
      <button
        className={styles.compass}
        onClick={resetNorth}
        title="Ориентация на север"
        aria-label="Компас: ориентировать карту на север"
      >
        <svg
          className={styles.needle}
          viewBox="0 0 24 24"
          width="26"
          height="26"
          style={{ transform: `rotate(${-bearing}deg)` }}
          aria-hidden="true"
        >
          <path d="M12 2 L15 12 L12 10 L9 12 Z" fill="#c62828" />
          <path d="M12 22 L9 12 L12 14 L15 12 Z" fill="#5b6b7c" />
        </svg>
        <span className={styles.bearing}>{Math.round(bearing)}°</span>
      </button>

      <div className={styles.rotateRow}>
        <button
          className={styles.small}
          onClick={() => rotateBy(-ROTATE_STEP)}
          title={`Повернуть карту против часовой стрелки на ${ROTATE_STEP}°`}
          aria-label="Повернуть карту влево"
        >
          ↺
        </button>
        <button
          className={styles.small}
          onClick={() => rotateBy(ROTATE_STEP)}
          title={`Повернуть карту по часовой стрелке на ${ROTATE_STEP}°`}
          aria-label="Повернуть карту вправо"
        >
          ↻
        </button>
      </div>

      <button
        className={styles.home}
        onClick={goHome}
        title="Домашняя позиция"
        aria-label="Панель позиции: вернуться в домашнюю позицию"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 3 L21 11 H18 V20 H14 V15 H10 V20 H6 V11 H3 Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
};
