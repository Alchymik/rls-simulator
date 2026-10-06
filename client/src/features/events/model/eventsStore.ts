import { create } from 'zustand';
import type { AlarmEventSummary } from '@/entities/event/types';
import {
  apiErrorMessage,
  captureAuthContext,
  isAuthContextCurrent,
  isRequestCancelled,
} from '@/shared/api/client';
import { clearEvents, createEvent, fetchEvents, type CreateEventPayload } from '../api/eventsApi';
import { captureScreenshot, type CaptureMark } from '../lib/captureScreenshot';

const MAX_EVENTS = 30;
type Detection = Omit<CreateEventPayload, 'screenshot' | 'thumbnail'>;
interface EventsState {
  events: AlarmEventSummary[];
  loading: boolean;
  clearing: boolean;
  error: string | null;
  load: () => Promise<void>;
  archiveDetection: (payload: Detection, marks: CaptureMark[]) => Promise<void>;
  archiveDetections: (payloads: Detection[], marks: CaptureMark[]) => Promise<void>;
  clear: () => Promise<void>;
  reset: () => void;
}
let generation = 0;
let loadRequest = 0;
let mutation = 0;
const writes = new Set<Promise<void>>();
let clearInFlight: Promise<void> | null = null;
const mergeEvents = (first: AlarmEventSummary[], second: AlarmEventSummary[]) =>
  [...new Map([...second, ...first].map((event) => [event.id, event])).values()]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_EVENTS);

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  loading: false,
  clearing: false,
  error: null,
  load: async () => {
    const context = captureAuthContext();
    const ownGeneration = generation;
    const request = ++loadRequest;
    const beforeMutation = mutation;
    set({ loading: true, error: null });
    try {
      const events = await fetchEvents(context);
      if (ownGeneration !== generation || request !== loadRequest || !isAuthContextCurrent(context)) return;
      set({
        events: beforeMutation === mutation ? events.slice(0, MAX_EVENTS) : mergeEvents(get().events, events),
        loading: false,
      });
    } catch (error) {
      if (
        ownGeneration === generation &&
        request === loadRequest &&
        isAuthContextCurrent(context) &&
        !isRequestCancelled(error)
      ) {
        set({ error: apiErrorMessage(error, 'Не удалось загрузить архив событий'), loading: false });
      }
    }
  },
  archiveDetection: (payload, marks) => get().archiveDetections([payload], marks),
  archiveDetections: (payloads, marks) => {
    const context = captureAuthContext();
    const ownGeneration = generation;
    const pendingClear = clearInFlight;
    // Capture starts at detection, before any network queue can delay the frame.
    const capture = captureScreenshot(marks);
    const saving = (async () => {
      try {
        const image = await capture;
        if (pendingClear) await pendingClear;
        for (const payload of payloads) {
          if (ownGeneration !== generation || !isAuthContextCurrent(context)) return;
          const event = await createEvent({ ...payload, ...image }, context);
          if (ownGeneration !== generation || !isAuthContextCurrent(context)) return;
          mutation += 1;
          set({ events: mergeEvents([event], get().events) });
        }
      } catch (error) {
        if (ownGeneration === generation && isAuthContextCurrent(context) && !isRequestCancelled(error)) {
          set({ error: apiErrorMessage(error, 'Не удалось сохранить событие в архив') });
        }
      }
    })();
    writes.add(saving);
    void saving.finally(() => writes.delete(saving));
    return saving;
  },
  clear: () => {
    if (clearInFlight) return clearInFlight;
    const context = captureAuthContext();
    const ownGeneration = ++generation;
    const pendingWrites = [...writes];
    set({ clearing: true, loading: false, error: null });
    const clearing = (async () => {
      try {
        await Promise.allSettled(pendingWrites);
        if (!isAuthContextCurrent(context) || ownGeneration !== generation) return;
        await clearEvents(context);
        if (!isAuthContextCurrent(context) || ownGeneration !== generation) return;
        mutation += 1;
        set({ events: [] });
      } catch (error) {
        if (ownGeneration === generation && isAuthContextCurrent(context) && !isRequestCancelled(error)) {
          set({ error: apiErrorMessage(error, 'Не удалось очистить архив событий') });
        }
      } finally {
        if (ownGeneration === generation) clearInFlight = null;
        if (ownGeneration === generation) set({ clearing: false });
      }
    })();
    clearInFlight = clearing;
    return clearing;
  },
  reset: () => {
    generation += 1;
    loadRequest += 1;
    clearInFlight = null;
    set({ events: [], loading: false, clearing: false, error: null });
  },
}));
