// client/src/features/simulation/lib/config.ts
import type { LatLng } from '@/entities/target/types';
import { movePoint } from '@/shared/lib/geo';

export const RADAR = {
  center: { lat: 59.55, lng: 30.80 } as const,
  rings: { near: 1000, medium: 3000, far: 7000 },
};

/** Полигон-кольцо вокруг центра РЛС: геометрия задаётся в метрах, а не в градусах (п.3.3.1.2 ТЗ). */
const ring = (radiusM: number, points = 16): LatLng[] =>
  Array.from({ length: points }, (_, i) =>
    movePoint(RADAR.center as LatLng, radiusM, (i * 360) / points),
  );

/**
 * Зона обнаружения — охраняемая зона: вход цели в полигон даёт уведомление (п.3.3.1.3 ТЗ).
 * Охватывает ближнюю и среднюю дистанции, поэтому БВС со средней дистанции обнаружения
 * попадают в неё сразу после появления.
 */
export const DETECTION_ZONE: LatLng[] = ring(3200);

/**
 * Зона игнорирования — участок внутри зоны обнаружения, цели в котором не отображаются
 * и не порождают уведомлений (п.3.3.1.3 ТЗ). Смещена на север: часть БВС, идущих прямым
 * курсом на РЛС, проходит через неё.
 */
export const IGNORE_ZONE: LatLng[] = Array.from({ length: 12 }, (_, i) =>
  movePoint(movePoint(RADAR.center as LatLng, 1400, 0), 600, (i * 360) / 12),
);

/** Дистанции появления целей, м (п.3.3.1.4 ТЗ: БВС — средняя/максимальная, птицы — любая) */
export const SPAWN_RANGE = {
  uav: [2_800, 3_400] as const,
  bird: [1_000, 7_000] as const,
};

/** Скорости и время присутствия — по таблице п.3.3.1.4 ТЗ */
export const BEHAVIOR = {
  uav: { speed: [25, 35], lifespanMs: [35_000, 60_000] },
  bird: { speed: [2, 10], lifespanMs: [4_000, 9_500] },
} as const;