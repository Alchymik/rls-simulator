import { Fragment, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSimulationStore } from '@/features/simulation/model/simulationStore';
import { useSettingsStore } from '@/features/settings/model/settingsStore';
import { DETECTION_ZONE, IGNORE_ZONE, RADAR } from '@/features/simulation/lib/config';
import { headingChevron, movePoint } from '@/shared/lib/geo';
import { clearActiveMap, setActiveMap } from '@/shared/lib/mapRegistry';
import { formatCoordinates } from '@/shared/lib/format';
import { msToKmh } from '@/shared/lib/units';
import type { LatLng, Target } from '@/entities/target/types';
import styles from './RadarMap.module.css';

const COLOR_IDLE = '#0048c0';
const COLOR_CORRECT = '#2e7d32';
const COLOR_WRONG = '#c62828';

// Leaflet пересоздаёт DOM-узел маркера, когда меняется объект иконки, поэтому иконки
// кэшируются по цвету: иначе маркеры пересобираются каждый кадр и тултип не открывается.
const iconCache = new Map<string, L.DivIcon>();
const dotIcon = (color: string): L.DivIcon => {
  let icon = iconCache.get(color);
  if (!icon) {
    icon = L.divIcon({
      className: styles.dot,
      html: `<span style="background:${color}"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    iconCache.set(color, icon);
  }
  return icon;
};

const colorOf = (t: Target): string =>
  t.identified === 'correct' ? COLOR_CORRECT : t.identified === 'wrong' ? COLOR_WRONG : COLOR_IDLE;

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
const DEFAULT_ZOOM = 13;

// Поворот карты включён, встроенный контрол выключен — используется своя панель компаса
const MAP_OPTIONS = { rotate: true, rotateControl: false } as const;

// Подписи радарных колец: дают быструю оценку отдалённости цели (п.3.3.1.2 ТЗ)
const RING_LABELS = [
  { text: 'Близкая · 1 км', radius: RADAR.rings.near },
  { text: 'Средняя · 3 км', radius: RADAR.rings.medium },
  { text: 'Дальняя · 7 км', radius: RADAR.rings.far },
];

const labelIconCache = new Map<string, L.DivIcon>();
const ringLabelIcon = (text: string): L.DivIcon => {
  let icon = labelIconCache.get(text);
  if (!icon) {
    icon = L.divIcon({
      className: styles.ringLabel,
      html: `<span>${text}</span>`,
      iconSize: [0, 0],
    });
    labelIconCache.set(text, icon);
  }
  return icon;
};

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
    // Панели (центр уведомлений) меняют ширину контейнера карты, а Leaflet отслеживает
    // только изменение окна: без invalidateSize на месте карты остаётся непрорисованная полоса.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
};

interface Props {
  onReady?: (map: L.Map) => void;
}

export const RadarMap = ({ onReady }: Props) => {
  const targets = useSimulationStore((s) => s.targets);
  const identify = useSimulationStore((s) => s.identify);
  const prefs = useSettingsStore((s) => s.map);

  return (
    <MapContainer
      {...MAP_OPTIONS}
      center={prefs.home ?? RADAR.center}
      zoom={prefs.home?.zoom ?? DEFAULT_ZOOM}
      className={styles.map}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />

      <Circle center={RADAR.center} radius={RADAR.rings.near}   pathOptions={RING_STYLE} />
      <Circle center={RADAR.center} radius={RADAR.rings.medium} pathOptions={RING_STYLE} />
      <Circle center={RADAR.center} radius={RADAR.rings.far}    pathOptions={OUTER_RING_STYLE} />

      {RING_LABELS.map((ring) => (
        <Marker
          key={ring.text}
          position={movePoint(RADAR.center as LatLng, ring.radius, 0)}
          icon={ringLabelIcon(ring.text)}
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
          <Fragment key={t.id}>
            <Marker
              position={t.position}
              icon={dotIcon(colorOf(t))}
              eventHandlers={{ dblclick: () => identify(t.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <b>Цель {t.id}</b><br />
                {t.speed.toFixed(1)} м/с · {msToKmh(t.speed).toFixed(1)} км/ч<br />
                {formatCoordinates(t.position.lat, t.position.lng)}
              </Tooltip>
            </Marker>
            {prefs.showDirection && (
              <Polyline
                positions={headingChevron(t.position, t.heading, DIRECTION_SIZE_M)}
                pathOptions={DIRECTION_STYLE}
              />
            )}
            {prefs.showTrajectory && (
              <Polyline positions={t.trajectory} pathOptions={TRAJECTORY_STYLE} />
            )}
          </Fragment>
        ))}
    </MapContainer>
  );
};