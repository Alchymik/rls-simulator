// client/src/features/events/api/eventsApi.ts
import { api } from '@/shared/api/client';
import type { AlarmEvent, Sector } from '@/entities/event/types';

export interface CreateEventPayload {
  at: number;
  targetId: string;
  sector: Sector;
  speedKmh: number;
  lat: number;
  lng: number;
  screenshot: string;
}

export const fetchEvents = () => api.get<AlarmEvent[]>('/events').then((r) => r.data);

export const createEvent = (payload: CreateEventPayload) =>
  api.post<AlarmEvent>('/events', payload).then((r) => r.data);

export const clearEvents = () => api.delete('/events').then(() => undefined);
