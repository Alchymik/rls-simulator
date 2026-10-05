// client/src/shared/lib/geo.ts
import type { LatLng } from '@/entities/target/types';

const R = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export const distanceMeters = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const movePoint = (p: LatLng, distance: number, bearingDeg: number): LatLng => {
  const ang = distance / R;
  const brg = toRad(bearingDeg);
  const lat1 = toRad(p.lat);
  const lng1 = toRad(p.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(brg),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
};

export const bearingTo = (a: LatLng, b: LatLng): number => {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

export const pointInPolygon = (pt: LatLng, poly: LatLng[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (!a || !b) continue;
    const intersect =
      b.lat > pt.lat !== a.lat > pt.lat &&
      pt.lng < ((a.lng - b.lng) * (pt.lat - b.lat)) / (a.lat - b.lat + 1e-12) + b.lng;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Точки «галочки», показывающей курс цели (стрелка вперёд по направлению движения).
 * Рисуется полилинией, чтобы не использовать inline-стили для поворота иконки.
 */
export const headingChevron = (p: LatLng, headingDeg: number, sizeMeters: number): LatLng[] => {
  const tip = movePoint(p, sizeMeters, headingDeg);
  return [
    movePoint(tip, sizeMeters * 0.6, headingDeg + 205),
    tip,
    movePoint(tip, sizeMeters * 0.6, headingDeg - 205),
  ];
};