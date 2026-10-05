// client/src/shared/lib/sound.ts
let audioCtx: AudioContext | null = null;

/**
 * Короткий сигнал тревоги через Web Audio — без аудиофайла и лишних зависимостей.
 * Контекст создаётся лениво: до первого действия пользователя браузер держит его suspended.
 */
export const playAlert = (volume: number): void => {
  if (volume <= 0) return;
  if (!audioCtx) audioCtx = new AudioContext();
  void audioCtx.resume();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(660, now + 0.09);

  gain.gain.value = Math.min(Math.max(volume, 0), 1) * 0.15;

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
};
