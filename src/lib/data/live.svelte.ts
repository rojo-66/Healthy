import { liveQuery } from 'dexie';

export interface LiveState<T> {
  /** Ultimo risultato della query (o il valore iniziale, finché non arriva). */
  readonly current: T;
  /** Errore dell'ultima esecuzione, se c'è stato. */
  readonly error: unknown;
  /** `true` dopo il primo risultato. */
  readonly loaded: boolean;
}

/**
 * Risultato di una query Dexie che si aggiorna da solo quando cambiano i dati che legge
 * (anche da un'altra scheda o dopo un ripristino). Va chiamata durante l'inizializzazione
 * di un componente: si iscrive con `$effect` e si disiscrive quando il componente sparisce.
 * È l'unico punto della logica dati che conosce Svelte.
 */
export function liveState<T>(query: () => T | Promise<T>, initial: T): LiveState<T> {
  let current = $state.raw<T>(initial);
  let error = $state.raw<unknown>(null);
  let loaded = $state(false);

  $effect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => {
        current = value;
        error = null;
        loaded = true;
      },
      error: (reason: unknown) => {
        error = reason;
      },
    });
    return () => subscription.unsubscribe();
  });

  return {
    get current() {
      return current;
    },
    get error() {
      return error;
    },
    get loaded() {
      return loaded;
    },
  };
}
