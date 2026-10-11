<script lang="ts">
  import { activeSession, deleteSession } from '../../lib/data/repo/sessions';
  import type { Session } from '../../lib/data/schemas/sessions';
  import { timeOfDay } from '../../lib/sessions/format';
  import { liveHref, readinessHref } from '../../lib/sessions/nav';
  import ConfirmSheet, { type ConfirmAction } from '../train/ConfirmSheet.svelte';

  /**
   * Avvio di una scheda (Allena, Vedi scheda, in M6 la Home): una sola sessione in corso per volta.
   * Se ce n'è già una chiede "Riprendi" o "Abbandona e inizia".
   */
  interface Props {
    /** Cosa fare dopo "Abbandona e inizia" (di base: apre il Readiness della scheda scelta). */
    onrestart?: (workoutId: string) => void;
  }

  let { onrestart }: Props = $props();

  let open = $state(false);
  let text = $state('');
  let actions = $state<ConfirmAction[]>([]);

  function go(hash: string): void {
    location.hash = hash;
  }

  /** Avvia la scheda, oppure chiede cosa fare della sessione in corso. */
  export async function request(workout: { id: string; name: string }, known?: Session | null): Promise<void> {
    const active = known === undefined ? await activeSession() : known;
    if (!active) return go(readinessHref(workout.id));
    conflict(active, workout);
  }

  export function conflict(active: Session, workout: { id: string; name: string }): void {
    text = `«${active.workoutName}» è in corso dalle ${timeOfDay(active.startedAt)}. Riprendilo, oppure abbandonalo per iniziare «${workout.name}»: le serie segnate andranno perse.`;
    actions = [
      { label: 'Riprendi allenamento', kind: 'primary', run: () => go(liveHref(active.id)) },
      {
        label: 'Abbandona e inizia',
        kind: 'danger',
        run: () =>
          void deleteSession(active.id).then(() => (onrestart ? onrestart(workout.id) : go(readinessHref(workout.id)))),
      },
      { label: 'Annulla', kind: 'secondary', run: () => {} },
    ];
    open = true;
  }
</script>

<ConfirmSheet bind:open title="Allenamento in corso" {text} {actions} />
