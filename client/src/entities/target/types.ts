export type TargetType = 'uav' | 'bird';

export interface LatLng { lat: number; lng: number; }

export interface Target {
  id: string;
  type: TargetType;
  position: LatLng;
  spawnPoint: LatLng;
  trajectory: LatLng[];
  speed: number;          // m/s
  heading: number;        // degrees, 0 = north
  bornAt: number;         // ms
  lifespanMs: number;
  notified: boolean;      // уже показан в панели уведомлений
  identified: 'correct' | 'wrong' | null;
  insideIgnoreZone: boolean;
  ignored: boolean;       // цель хотя бы раз побывала в зоне игнорирования → уведомления по ней не создаются
  sampleTick: number;     // счётчик кадров для прореживания следа траектории
}