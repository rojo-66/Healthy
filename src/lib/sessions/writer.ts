import type { Session } from '../data/schemas/sessions';

/** Ritardo delle scritture mentre si digita (kg, ripetizioni, note). */
export const TYPING_DELAY_MS = 300;

export interface SessionWriter {
  /** Salva subito (spunte, PREC/SUCC, recupero…), dopo le scritture già in coda. */
  save(session: Session): Promise<void>;
  /** Salva dopo `TYPING_DELAY_MS` dall'ultima chiamata (testo che si sta scrivendo). */
  saveLater(session: Session): void;
  /** Scrive subito l'eventuale modifica in attesa (app in background, uscita dalla schermata). */
  flush(): Promise<void>;
  /** Ultimo errore di scrittura, se c'è stato. */
  readonly error: unknown;
}

interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

const browserTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as number),
};

/**
 * Coda delle scritture della sessione in corso: iOS può chiudere l'app in qualsiasi momento,
 * quindi si salva a ogni modifica; le scritture vanno in fila e l'ultima vince sempre.
 */
export function createSessionWriter(
  write: (session: Session) => Promise<unknown>,
  timers: Timers = browserTimers,
): SessionWriter {
  let chain: Promise<void> = Promise.resolve();
  let pending: Session | null = null;
  let timer: unknown = null;
  let error: unknown = null;

  function enqueue(session: Session): Promise<void> {
    chain = chain.then(async () => {
      try {
        await write(session);
        error = null;
      } catch (e) {
        error = e;
      }
    });
    return chain;
  }

  function cancelTimer() {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  }

  const writer: SessionWriter = {
    save(session) {
      cancelTimer();
      pending = null;
      return enqueue(session);
    },
    saveLater(session) {
      pending = session;
      cancelTimer();
      timer = timers.setTimeout(() => {
        timer = null;
        void writer.flush();
      }, TYPING_DELAY_MS);
    },
    flush() {
      cancelTimer();
      if (!pending) return chain;
      const session = pending;
      pending = null;
      return enqueue(session);
    },
    get error() {
      return error;
    },
  };
  return writer;
}
