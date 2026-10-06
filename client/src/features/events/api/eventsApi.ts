// client/src/features/events/api/eventsApi.ts
import { api, authRequestConfig, captureAuthContext, type AuthContext } from '@/shared/api/client';
import type { AlarmEvent, AlarmEventSummary, Sector } from '@/entities/event/types';

export interface CreateEventPayload {
  at: number;
  targetId: string;
  sector: Sector;
  speedKmh: number;
  lat: number;
  lng: number;
  screenshot: string;
  thumbnail: string;
}

/** Список архива — только миниатюры */
export const fetchEvents = (context = captureAuthContext()) =>
  api.get<AlarmEventSummary[]>('/events', authRequestConfig(context)).then((r) => r.data);

/** Полный снимок загружается при открытии события */
export const fetchEvent = (id: string, context = captureAuthContext()) =>
  api.get<AlarmEvent>(`/events/${id}`, authRequestConfig(context)).then((r) => r.data);

export const createEvent = (payload: CreateEventPayload, context: AuthContext = captureAuthContext()) =>
  api.post<AlarmEventSummary>('/events', payload, authRequestConfig(context)).then((r) => r.data);

export const clearEvents = (context = captureAuthContext()) =>
  api.delete('/events', authRequestConfig(context)).then(() => undefined);
