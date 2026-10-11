const pad = (n: number) => String(n).padStart(2, '0');

/** Secondi → `mm:ss`, oppure `h:mm:ss` oltre l'ora. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
