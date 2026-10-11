/**
 * Indicatore della Home "SYNC OFFLINE ✓" (SPEC § 3). L'app non ha un server: "sincronizzato" vuol dire che
 * quello che inserisci resta sul telefono e che l'app funziona senza rete. Il ✓ compare solo se sono vere
 * tutte e quattro le condizioni; altrimenti un'etichetta dice cosa manca (mai un ✓ non vero).
 */

export interface SyncInputs {
  /** Il database si apre e si legge; `null` = verifica in corso. */
  dbOk: boolean | null;
  /** App aperta dall'icona in Home (non in una scheda del browser). */
  standalone: boolean;
  /** Il service worker controlla la pagina (l'app si apre anche offline). */
  swControlled: boolean;
  /** Storage persistente (il browser non cancella i dati quando lo spazio scarseggia); `null` = non si sa. */
  persisted: boolean | null;
}

export type SyncKind = 'ok' | 'checking' | 'not-saved' | 'browser-only' | 'offline-not-ready' | 'not-protected';

export interface SyncStatus {
  kind: SyncKind;
  /** Testo corto, in maiuscolo, sulla riga della data. */
  label: string;
  tone: 'progress' | 'tip' | 'muted';
  /** Spiegazione per chi usa lo screen reader (e per chi tiene premuto). */
  description: string;
}

const STATUS: Readonly<Record<SyncKind, Omit<SyncStatus, 'kind'>>> = {
  ok: {
    label: 'SYNC OFFLINE ✓',
    tone: 'progress',
    description: 'Dati salvati sul telefono in modo persistente, app installata e pronta anche senza rete.',
  },
  checking: { label: 'VERIFICO…', tone: 'muted', description: 'Sto verificando dove sono salvati i dati.' },
  'not-saved': {
    label: 'NON SALVATO',
    tone: 'tip',
    description: 'Il telefono non permette di salvare i dati (per esempio in navigazione privata): quello che inserisci andrà perso.',
  },
  'browser-only': {
    label: 'SOLO BROWSER',
    tone: 'tip',
    description: 'Stai usando Healthy nel browser: aggiungila alla schermata Home. I dati del browser e dell’app installata sono separati.',
  },
  'offline-not-ready': {
    label: 'OFFLINE NON PRONTO',
    tone: 'muted',
    description: 'L’app non è ancora pronta a funzionare senza rete: riaprila una volta con la connessione.',
  },
  'not-protected': {
    label: 'NON PROTETTO',
    tone: 'tip',
    description: 'Il telefono potrebbe cancellare i dati se lo spazio scarseggia: fai un backup ogni tanto.',
  },
};

/** Stato dell'indicatore, in ordine di gravità: database › installazione › offline › persistenza. */
export function syncStatus(input: SyncInputs): SyncStatus {
  let kind: SyncKind;
  if (input.dbOk === false) kind = 'not-saved';
  else if (input.dbOk === null) kind = 'checking';
  else if (!input.standalone) kind = 'browser-only';
  else if (!input.swControlled) kind = 'offline-not-ready';
  else if (input.persisted !== true) kind = 'not-protected';
  else kind = 'ok';
  return { kind, ...STATUS[kind] };
}

/** Il ✓ è vero: database ok, app installata, service worker attivo, storage persistente. */
export function isSyncOk(input: SyncInputs): boolean {
  return syncStatus(input).kind === 'ok';
}
