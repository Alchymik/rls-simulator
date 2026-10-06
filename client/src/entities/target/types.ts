import type { LatLng } from '@/shared/lib/geo';

export type { LatLng };

export type TargetType = 'uav' | 'bird';

export interface Target {
  id: string;
  type: TargetType;
  position: LatLng;
  spawnPoint: LatLng;
  trajectory: LatLng[];
  speed: number; // m/s
  heading: number; // degrees, 0 = north
  /** Скорость поворота, °/с: птицы летят дугами, БВС — прямо (0) */
  turnRate: number;
  /** Время симуляции появления цели, с */
  bornAtSec: number;
  lifespanSec: number;
  /** Время симуляции, когда цель впервые стала видна оператору (вне зоны игнорирования), с */
  firstSeenSec: number | null;
  notified: boolean; // уже показан в панели уведомлений
  identified: 'correct' | 'wrong' | null;
  insideIgnoreZone: boolean;
  ignored: boolean; // цель хотя бы раз побывала в зоне игнорирования → уведомления по ней не создаются
  /** Время с последней точки следа, с: след прореживается по времени, а не по кадрам */
  sinceSampleSec: number;
}
