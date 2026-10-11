/** Id nuovo per schede, sessioni, misure… (UUID v4; `crypto.randomUUID` c'è da Safari 15.4). */
export function newId(): string {
  return crypto.randomUUID();
}

/** Istante in formato ISO 8601 UTC (`2026-10-11T08:30:00.000Z`): leggibile e ordinabile come stringa. */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

/** Giorno locale in formato `AAAA-MM-GG` (non UTC: alle 00:30 in Italia è già il giorno dopo). */
export function toIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
