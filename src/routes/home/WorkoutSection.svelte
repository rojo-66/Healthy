<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { routeHref } from '../../lib/routes';
  import { summaryHref } from '../../lib/sessions/nav';
  import type { DayRelation } from '../../lib/today/meal-focus';
  import { workoutWhen, type WorkoutEntry } from '../../lib/today/workout-day';
  import ResumeCard from '../session/ResumeCard.svelte';

  interface Props {
    entries: readonly WorkoutEntry[];
    relation: DayRelation;
    nowMinutes: number;
    /** Riga gialla del conflitto con il piano alimentare (vuota se non c'è). */
    conflict: string;
    /** Esiste almeno una scheda sul telefono. */
    hasWorkouts: boolean;
    onstart: (workout: Workout) => void;
  }

  let { entries, relation, nowMinutes, conflict, hasWorkouts, onstart }: Props = $props();
</script>

{#if conflict}
  <p class="conflict" data-testid="day-conflict">{conflict}</p>
{/if}

{#each entries as e (e.id)}
  {#if e.status === 'in-progress' && e.session}
    <!-- Sessione in corso: la stessa card di Allena, con "Riprendi allenamento". -->
    <ResumeCard session={e.session} />
  {:else}
    <Card tone="training" label="Allenamento: {e.name}">
      <div class="top">
        <span class="kicker mono-label">▲ Palestra{e.timeLabel ? ` · ${e.timeLabel}` : ''}</span>
        <span class="when">{workoutWhen(e, relation, nowMinutes)}</span>
      </div>
      <h2 class="name">{e.name}</h2>
      {#if e.meta}<span class="meta mono">{e.meta}</span>{/if}
      {#if !e.scheduled}<span class="extra">Fuori programma</span>{/if}
      {#if e.status === 'done' && e.session}
        <div class="done-row">
          <span class="sticker">Fatto ✓</span>
          <Button tone="training" variant="secondary" href={summaryHref(e.session.id)}>Vedi riepilogo</Button>
        </div>
      {:else if relation === 'today' && e.workout}
        {@const w = e.workout}
        <Button tone="training" size="lg" block onclick={() => onstart(w)}>Avvia allenamento</Button>
        <a class="link view" href={routeHref('/allena/vedi', { id: w.id })}>Vedi scheda</a>
      {/if}
    </Card>
  {/if}
{:else}
  {#if !hasWorkouts}
    <Card tone="training" label="Nessuna scheda">
      <span class="kicker mono-label">▲ Allenamento</span>
      <h2 class="name">Nessuna scheda</h2>
      <p class="text">Crea la tua scheda in Allena: esercizi, serie, carichi e giorni. Poi la ritrovi qui il giorno giusto.</p>
      <Button tone="training" href={routeHref('/allena/editor')}>Crea la tua scheda</Button>
    </Card>
  {:else}
    <section class="rest" aria-label="Riposo">
      <span class="kicker rest-kicker mono-label">◆ Riposo</span>
      <p class="text">
        Nessuna scheda {relation === 'today' ? 'oggi' : 'in questo giorno'}. Anche il recupero fa parte del programma.
      </p>
      <a class="link" href="#/allena">Vai ad Allena</a>
    </section>
  {/if}
{/each}

<style>
  .conflict {
    margin: 0;
    padding: 10px 12px;
    border: 1px dashed var(--tip-edge);
    background: var(--tip-tint);
    color: var(--tip);
    font-size: 13px;
    line-height: 1.4;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .kicker {
    min-width: 0;
    font-size: 12px;
    color: var(--tone);
  }

  .when {
    flex: none;
    font-size: 12px;
    color: var(--muted);
  }

  .name {
    margin: 0;
    font-family: var(--font-graffiti);
    font-weight: 400;
    font-size: 30px;
    line-height: 1.05;
    color: var(--tone);
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: 13px;
    color: var(--text-2);
  }

  .extra {
    font-size: 12px;
    color: var(--muted);
  }

  .text {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text-2);
  }

  .done-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .sticker {
    display: inline-block;
    padding: 6px 12px;
    background: var(--tone);
    color: var(--on-tone);
    font-family: var(--font-graffiti);
    font-size: 18px;
    transform: rotate(-4deg);
  }

  .rest {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5);
    background: var(--surface);
    border: 1px dashed var(--line-strong);
  }

  .rest-kicker {
    color: var(--muted);
  }

  .link.view {
    align-self: center;
    margin-top: calc(-1 * var(--space-2));
  }

  .link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    color: var(--progress);
    font-size: 14px;
  }
</style>
