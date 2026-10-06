// client/src/features/simulation/lib/sector.test.ts
import { describe, expect, it } from 'vitest';
import { movePoint } from '@/shared/lib/geo';
import { RADAR } from './config';
import { sectorOf } from './sector';

describe('sectorOf', () => {
  it.each([
    [0, 'Север'],
    [40, 'Север'],
    [50, 'Восток'],
    [90, 'Восток'],
    [180, 'Юг'],
    [270, 'Запад'],
    [320, 'Север'],
  ] as const)('азимут %i° → %s', (bearing, sector) => {
    expect(sectorOf(movePoint(RADAR.center, 2000, bearing))).toBe(sector);
  });

  it('делит круг на четыре сектора по 90°', () => {
    const widths: Record<string, number> = {};
    for (let bearing = 0; bearing < 360; bearing += 1) {
      const sector = sectorOf(movePoint(RADAR.center, 2000, bearing + 0.5));
      widths[sector] = (widths[sector] ?? 0) + 1;
    }
    expect(widths).toEqual({ Север: 90, Восток: 90, Юг: 90, Запад: 90 });
  });
});
