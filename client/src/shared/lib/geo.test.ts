// client/src/shared/lib/geo.test.ts
import { describe, expect, it } from 'vitest';
import { bearingTo, distanceMeters, headingChevron, movePoint, pointInPolygon } from './geo';

const SQUARE = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 2 },
  { lat: 2, lng: 2 },
  { lat: 2, lng: 0 },
];

describe('distanceMeters', () => {
  it('даёт ноль для одной и той же точки', () => {
    expect(distanceMeters({ lat: 59.55, lng: 30.8 }, { lat: 59.55, lng: 30.8 })).toBe(0);
  });

  it('считает градус меридиана', () => {
    // 1° широты ≈ 111.2 км
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });

  it('учитывает сжатие параллели', () => {
    const atEquator = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const atSixty = distanceMeters({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(atSixty).toBeLessThan(atEquator);
  });
});

describe('movePoint', () => {
  it('сдвигает на север при курсе 0°', () => {
    const moved = movePoint({ lat: 59.55, lng: 30.8 }, 1000, 0);
    expect(moved.lat).toBeGreaterThan(59.55);
    expect(moved.lng).toBeCloseTo(30.8, 5);
    expect(distanceMeters({ lat: 59.55, lng: 30.8 }, moved)).toBeCloseTo(1000, -1);
  });

  it('сдвигает на восток при курсе 90°', () => {
    const moved = movePoint({ lat: 0, lng: 0 }, 1000, 90);
    expect(moved.lng).toBeGreaterThan(0);
    expect(moved.lat).toBeCloseTo(0, 6);
  });
});

describe('bearingTo', () => {
  it('север — 0°', () => {
    expect(bearingTo({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 4);
  });

  it('восток — 90°', () => {
    expect(bearingTo({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 3);
  });

  it('юг — 180°', () => {
    expect(bearingTo({ lat: 1, lng: 0 }, { lat: 0, lng: 0 })).toBeCloseTo(180, 4);
  });
});

describe('pointInPolygon', () => {
  it('точка внутри квадрата', () => {
    expect(pointInPolygon({ lat: 1, lng: 1 }, SQUARE)).toBe(true);
  });

  it('точка снаружи квадрата', () => {
    expect(pointInPolygon({ lat: 3, lng: 1 }, SQUARE)).toBe(false);
  });

  it('точка вне полигона сдвинута по долготе', () => {
    expect(pointInPolygon({ lat: 1, lng: 5 }, SQUARE)).toBe(false);
  });
});

describe('headingChevron', () => {
  it('возвращает три точки и острие впереди цели', () => {
    const target = { lat: 59.55, lng: 30.8 };
    const chevron = headingChevron(target, 0, 300);
    expect(chevron).toHaveLength(3);

    const [left, tip, right] = chevron;
    expect(left && tip && right).toBeTruthy();
    if (!left || !tip || !right) return;

    expect(tip.lat).toBeGreaterThan(target.lat);
    expect(left.lat).toBeLessThan(tip.lat);
    expect(right.lat).toBeLessThan(tip.lat);
    expect(left.lng).toBeLessThan(tip.lng);
    expect(right.lng).toBeGreaterThan(tip.lng);
  });
});
