// client/src/features/events/model/eventsStore.ts
import { create } from 'zustand';
import type { AlarmEvent } from '@/entities/event/types';
import { apiErrorMessage } from '@/shared/api/client';
import { clearEvents, createEvent, fetchEvents, type CreateEventPayload } from '../api/eventsApi';
import { captureScreenshot, type CaptureMark } from '../lib/captureScreenshot';

interface EventsState {
  events: AlarmEvent[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  archiveDetection: (
    payload: Omit<CreateEventPayload, 'screenshot'>,
    marks: CaptureMark[],
  ) => Promise<void>;
  clear: () => Promise<void>;
}

/** Архив тревожных событий: снимок экрана в момент обнаружения цели (п.3.1 ТЗ). */
export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      set({ events: await fetchEvents(), loading: false });
    } catch (e: unknown) {
      set({ error: apiErrorMessage(e, 'Не удалось загрузить архив событий'), loading: false });
    }
  },

  archiveDetection: async (payload, marks) => {
    try {
      // На снимке отмечаются цели, включая ту, из-за которой сработала тревога (п.3.1 ТЗ)
      const screenshot = await captureScreenshot(marks);
      const event = await createEvent({ ...payload, screenshot });
      set({ events: [event, ...get().events] });
    } catch (e: unknown) {
      set({ error: apiErrorMessage(e, 'Не удалось сохранить событие в архив') });
    }
  },

  clear: async () => {
    try {
      await clearEvents();
      set({ events: [] });
    } catch (e: unknown) {
      set({ error: apiErrorMessage(e, 'Не удалось очистить архив событий') });
    }
  },
}));
