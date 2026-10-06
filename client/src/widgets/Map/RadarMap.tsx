import { memo, useEffect, useMemo } from 'react';
import { MapContainer, Circle, Polygon, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import { DEFAULT_ZOOM, DETECTION_ZONE, IGNORE_ZONE, RADAR } from '@/features/simulation/lib/config';
import { headingChevron, movePoint } from '@/shared/lib/geo';
import { clearActiveMap, setActiveMap } from '@/shared/lib/mapRegistry';
import { formatCoordinates } from '@/shared/lib/format';
import { msToKmh } from '@/shared/lib/units';
import type { Target } from '@/entities/target/types';
import styles from './RadarMap.module.css';
import { Basemap } from './Basemap';

type DotState = 'idle' | 'correct' | 'wrong';

// Leaflet пересоздаёт DOM-узел маркера, когда меняется объект иконки, поэтому иконок всего три
// и они создаются один раз. Цвет задают CSS-классы, а не инлайн-стиль.
const DOT_ICONS: Record<DotState, L.DivIcon> = {
  idle: L.divIcon({ className: styles.dot, html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 7] }),
  correct: L.divIcon({
    className: `${styles.dot} ${styles.correct}`,
    html: '<span></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }),
  wrong: L.divIcon({
    className: `${styles.dot} ${styles.wrong}`,
    html: '<span></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }),
};

// Статические стили вынесены из рендера: при обновлении целей каждые 16 мс
// новые объекты заставляли Leaflet заново применять setStyle к слоям.
const RING_STYLE = { color: '#ffffff', weight: 1, fillOpacity: 0 };
const OUTER_RING_STYLE = { color: '#ffffff', weight: 2, fillOpacity: 0.05, fillColor: '#ffffff' };
const DETECTION_STYLE = { color: '#c62828', weight: 2, fillColor: '#c62828', fillOpacity: 0.15 };
const IGNORE_STYLE = { color: '#ffffff', weight: 2, dashArray: '4 4', fillOpacity: 0.1 };
// След пройденного пути — основной индикатор направления (как в референсе):
// линия от точки появления до текущего положения цели
const TRAJECTORY_STYLE = { color: '#ffffff', weight: 2, opacity: 0.85 };
const DIRECTION_STYLE = { color: '#0048c0', weight: 2, opacity: 0.9 };

/** Длина стрелки курса цели, м */
const DIRECTION_SIZE_M = 320;

// Поворот карты включён, встроенный контрол выключен — используется своя панель компаса
const MAP_OPTIONS = { rotate: true, rotateControl: false } as const;

// Подписи радарных колец: дают быструю оценку отдалённости цели (п.3.3.1.2 ТЗ)
const RING_LABELS = [
  { text: 'Близкая · 1 км', radius: RADAR.rings.near },
  { text: 'Средняя · 3 км', radius: RADAR.rings.medium },
  { text: 'Дальняя · 7 км', radius: RADAR.rings.far },
].map((ring) => ({
  ...ring,
  position: movePoint(RADAR.center, ring.radius, 0),
  icon: L.divIcon({ className: styles.ringLabel, html: `<span>${ring.text}</span>`, iconSize: [0, 0] }),
}));

/** Отдаёт наружу инстанс карты для панелей компаса и позиции (п.3.3.2.5, п.3.3.2.6 ТЗ). */
const MapBridge = ({ onReady }: { onReady?: (map: L.Map) => void }) => {
  const map = useMap();

  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);

  useEffect(() => {
    // Карта доступна подсистеме архива событий: на снимке экрана отмечается обнаруженная цель
    setActiveMap(map);
    return () => clearActiveMap(map);
  }, [map]);

  useEffect(() => {
    // Leaflet по умолчанию добавляет к атрибуции свою ссылку — оставляем только источник подложки
    map.attributionControl.setPrefix(false);
  }, [map]);

  useEffect(() => {
    // Панели (центр уведомлений) меняют ширину контейнера карты, а Leaflet отслеживает
    // только изменение окна: без invalidateSize на месте карты остаётся непрорисованная полоса.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
};

interface TargetMarkerProps {
  target: Target;
  showDirection: boolean;
  showTrajectory: boolean;
  onIdentify?: (targetId: string) => void;
}

const TargetMarker = memo(({ target, showDirection, showTrajectory, onIdentify }: TargetMarkerProps) => {
  // Объект обработчиков стабилен: иначе react-leaflet переподписывает маркер на каждом кадре
  const eventHandlers = useMemo(
    () => (onIdentify ? { dblclick: () => onIdentify(target.id) } : {}),
    [onIdentify, target.id],
  );

  return (
    <>
      <Marker
        title={`Цель ${target.id}`}
        position={target.position}
        icon={DOT_ICONS[target.identified ?? 'idle']}
        eventHandlers={eventHandlers}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
          <b>Цель {target.id}</b>
          <br />
          {target.speed.toFixed(1)} м/с · {msToKmh(target.speed).toFixed(1)} км/ч
          <br />
          {formatCoordinates(target.position.lat, target.position.lng)}
        </Tooltip>
      </Marker>
      {showDirection && (
        <Polyline
          positions={headingChevron(target.position, target.heading, DIRECTION_SIZE_M)}
          pathOptions={DIRECTION_STYLE}
        />
      )}
      {showTrajectory && <Polyline positions={target.trajectory} pathOptions={TRAJECTORY_STYLE} />}
    </>
  );
});
TargetMarker.displayName = 'TargetMarker';

interface Props {
  /** Цели передаёт страница: карта главного меню их не получает и не показывает остатки сеанса */
  targets?: Target[];
  onIdentify?: (targetId: string) => void;
  onReady?: (map: L.Map) => void;
}

export const RadarMap = ({ targets = [], onIdentify, onReady }: Props) => {
  const prefs = useSettingsStore((s) => s.map);

  return (
    <MapContainer
      {...MAP_OPTIONS}
      center={prefs.home ?? RADAR.center}
      zoom={prefs.home?.zoom ?? DEFAULT_ZOOM}
      className={styles.map}
      zoomControl={false}
    >
      <Basemap />

      <Circle center={RADAR.center} radius={RADAR.rings.near} pathOptions={RING_STYLE} />
      <Circle center={RADAR.center} radius={RADAR.rings.medium} pathOptions={RING_STYLE} />
      <Circle center={RADAR.center} radius={RADAR.rings.far} pathOptions={OUTER_RING_STYLE} />

      {RING_LABELS.map((ring) => (
        <Marker
          key={ring.text}
          position={ring.position}
          icon={ring.icon}
          interactive={false}
          keyboard={false}
        />
      ))}

      {prefs.showDetectionZone && <Polygon positions={DETECTION_ZONE} pathOptions={DETECTION_STYLE} />}
      {prefs.showIgnoreZone && <Polygon positions={IGNORE_ZONE} pathOptions={IGNORE_STYLE} />}

      <MapBridge onReady={onReady} />

      {targets
        // п.3.3.1.3 ТЗ: цель внутри зоны игнорирования не отображается
        .filter((t) => !t.insideIgnoreZone)
        .map((t) => (
          <TargetMarker
            key={t.id}
            target={t}
            showDirection={prefs.showDirection}
            showTrajectory={prefs.showTrajectory}
            onIdentify={onIdentify}
          />
        ))}
    </MapContainer>
  );
};
