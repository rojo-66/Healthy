import { routeHref } from '../routes';

export const readinessHref = (workoutId: string) => routeHref('/sessione/readiness', { scheda: workoutId });
export const introHref = (workoutId: string) => routeHref('/sessione/intro', { scheda: workoutId });
export const liveHref = (sessionId: string) => routeHref('/sessione/live', { id: sessionId });

/**
 * Passo del flusso senza nuova voce nella cronologia: dalla sessione in corso il "indietro" del browser
 * (o lo swipe di Safari) non riporta mai al Readiness o all'Intro di una sessione già iniziata.
 */
export function replaceTo(hash: string): void {
  location.replace(hash);
}
export const summaryHref = (sessionId: string, fromHistory = false) =>
  routeHref('/sessione/riepilogo', { id: sessionId, da: fromHistory ? 'storico' : undefined });
/** Allena, tab Storico. */
export const historyHref = () => routeHref('/allena', { tab: 'storico' });
