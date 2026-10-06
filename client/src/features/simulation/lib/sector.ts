// client/src/features/simulation/lib/sector.ts
import type { Sector } from '@/entities/event/types';
import { bearingTo, type LatLng } from '@/shared/lib/geo';
import { RADAR } from './config';

const SECTORS: readonly Sector[] = ['Север', 'Восток', 'Юг', 'Запад'];

/**
 * Сектор по азимуту от РЛС: четыре сектора по 90°.
 * Сравнивать разности широты и долготы в градусах нельзя: на широте 59,5° градус долготы
 * вдвое короче градуса широты, и сектора «Восток»/«Запад» получались по 126°.
 */
export const sectorOf = (p: LatLng): Sector =>
  SECTORS[Math.round(bearingTo(RADAR.center, p) / 90) % SECTORS.length] ?? 'Север';
