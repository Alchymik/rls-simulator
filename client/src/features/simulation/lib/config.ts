// client/src/features/simulation/lib/config.ts
import { movePoint, type LatLng } from '@/shared/lib/geo';

export const RADAR = {
  center: { lat: 59.55, lng: 30.8 } satisfies LatLng,
  rings: { near: 1000, medium: 3000, far: 7000 },
};

/** Масштаб карты по умолчанию: общий для карты и панели позиции */
export const DEFAULT_ZOOM = 13;

/** Полигон-кольцо вокруг центра РЛС: геометрия задаётся в метрах, а не в градусах (п.3.3.1.2 ТЗ). */
const ring = (radiusM: number, points = 16): LatLng[] =>
  Array.from({ length: points }, (_, i) => movePoint(RADAR.center, radiusM, (i * 360) / points));

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
  movePoint(movePoint(RADAR.center, 1400, 0), 600, (i * 360) / 12),
);

/** Дистанции появления целей, м (п.3.3.1.4 ТЗ: БВС — средняя/максимальная, птицы — любая) */
export const SPAWN_RANGE = {
  uav: [2_800, 3_400],
  bird: [1_000, 7_000],
} as const;

/** Скорости, м/с, и время присутствия, с — по таблице п.3.3.1.4 ТЗ */
export const BEHAVIOR = {
  uav: { speed: [25, 35], lifespanSec: [35, 60] },
  bird: { speed: [2, 10], lifespanSec: [4, 9.5] },
} as const;

/** Птица: скорость поворота меняется плавно, траектория — дуги, а не дрожание на месте */
export const BIRD_TURN = {
  /** Предел скорости поворота, °/с */
  maxRate: 45,
  /** Интенсивность случайного изменения скорости поворота, °/с на √с */
  noise: 60,
} as const;
