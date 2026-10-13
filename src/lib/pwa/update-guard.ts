/**
 * Avviso "Nuova versione disponibile" (SPEC § 2): l'app non si ricarica mai da sola, e il banner aspetta
 * che non ci sia lavoro in corso. Aggiornare ricarica la pagina: in una sessione live o con un modulo aperto
 * si perderebbe il filo (o il testo appena scritto).
 */

/** Schermate con lavoro in corso: sessione (readiness, live, riepilogo) e moduli. */
const BUSY_ROUTES = ['/sessione/', '/allena/editor', '/allena/corsa', '/profilo/misura', '/dieta/completa', '/importa'];

export interface UpdateContext {
  path: string;
  /** Un pannello dal basso o un dialogo è aperto. */
  dialogOpen: boolean;
  keyboardOpen: boolean;
}

/** Il banner va rimandato? */
export function updateDeferred(ctx: UpdateContext): boolean {
  if (ctx.dialogOpen || ctx.keyboardOpen) return true;
  return BUSY_ROUTES.some((r) => (r.endsWith('/') ? ctx.path.startsWith(r) : ctx.path === r));
}
