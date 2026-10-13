<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import { shortDay } from '../../lib/calendar/move';
  import type { Occurrence } from '../../lib/calendar/occurrences';
  import type { RunLog } from '../../lib/data/schemas/runs';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { routeHref } from '../../lib/routes';
  import { summaryHref } from '../../lib/sessions/nav';
  import type { DayRelation } from '../../lib/today/meal-focus';
  import { inTimeLabel, workoutWhen, type RunEntry, type WorkoutEntry } from '../../lib/today/workout-day';
  import ResumeCard from '../session/ResumeCard.svelte';

  interface Props {
    entries: readonly WorkoutEntry[];
    relation: DayRelation;
    nowMinutes: number;
    /** Riga gialla sul tipo di giornata (il piano non lo conosce), vuota se non serve. */
    note: string;
    /** Corse del giorno (2a). */
    runs?: readonly RunEntry[];
    /** Esiste almeno una scheda (o una corsa) sul telefono. */
    hasWorkouts: boolean;
    onstart: (workout: Workout) => void;
    /** "Segna come fatta" una corsa pianificata. */
    onlogrun?: (entry: RunEntry) => void;
    /** Dettaglio di una corsa già fatta. */
    onshowrun?: (log: RunLog) => void;
    /** "Non posso oggi" / "Recupera": Sposta o Salta (2c). */
    onmanage?: (o: Occurrence) => void;
    /** Ripristina un'attività saltata (2c). */
    onrestore?: (o: Occurrence) => void;
  }

  let { entries, runs = [], relation, nowMinutes, note, hasWorkouts, onstart, onlogrun, onshowrun, onmanage, onrestore }: Props = $props();

  /** Si può spostare o saltare da qui: oggi da fare, oppure un giorno passato non fatto (recupero). */
  const manageable = (o: Occurrence | null, status: string): o is Occurrence =>
    o !== null && status === 'todo' && relation !== 'future' && onmanage !== undefined;

  /** Come `workoutWhen`, al femminile per la corsa. */
  function runWhen(e: RunEntry): string {
    if (e.status === 'skipped') return 'saltata';
    if (e.status === 'done') return 'fatta';
    if (relation === 'past') return 'non fatta';
    if (relation === 'future') return 'in programma';
    if (e.startMinutes === null) return 'oggi';
    const until = e.startMinutes - nowMinutes;
    if (until > 0) return inTimeLabel(until);
    return until > -(e.durationMin ?? 0) ? 'adesso' : 'orario passato';
  }
</script>

{#if note}
  <p class="conflict" data-testid="day-conflict">{note}</p>
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
      <h2 class="name" class:skipped={e.status === 'skipped'}>{e.name}</h2>
      {#if e.meta && e.status !== 'skipped'}<span class="meta mono">{e.meta}</span>{/if}
      {#if !e.scheduled}<span class="extra">Fuori programma</span>{/if}
      {#if e.movedFrom}<span class="extra" data-testid="moved-from">Spostato da {shortDay(e.movedFrom)}</span>{/if}
      {#if e.status === 'skipped' && e.occurrence}
        {@const o = e.occurrence}
        <div class="done-row">
          <span class="extra">Saltato: conta come non fatto.</span>
          {#if onrestore}<Button variant="secondary" onclick={() => onrestore(o)}>Ripristina</Button>{/if}
        </div>
      {:else if e.status === 'done' && e.session}
        <div class="done-row">
          <span class="sticker">Fatto ✓</span>
          <Button tone="training" variant="secondary" href={summaryHref(e.session.id)}>Vedi riepilogo</Button>
        </div>
      {:else if relation === 'today' && e.workout}
        {@const w = e.workout}
        <Button tone="training" size="lg" block onclick={() => onstart(w)}>Avvia allenamento</Button>
        <div class="links">
          <a class="link" href={routeHref('/allena/vedi', { id: w.id })}>Vedi scheda</a>
          {#if manageable(e.occurrence, e.status)}
            {@const o = e.occurrence}
            <button type="button" class="link manage tap" onclick={() => onmanage?.(o)}>Non posso oggi</button>
          {/if}
        </div>
      {:else if relation === 'past' && manageable(e.occurrence, e.status)}
        {@const o = e.occurrence}
        <button type="button" class="link manage tap" onclick={() => onmanage?.(o)}>Recupera in un altro giorno</button>
      {/if}
    </Card>
  {/if}
{/each}

{#each runs as r (r.id)}
  <Card tone="progress" label="Corsa: {r.name}">
    <div class="top">
      <span class="kicker mono-label">● Corsa{r.timeLabel ? ` · ${r.timeLabel}` : ''}</span>
      <span class="when">{runWhen(r)}</span>
    </div>
    <h2 class="name" class:skipped={r.status === 'skipped'}>{r.name}</h2>
    {#if r.meta && r.status !== 'skipped'}<span class="meta mono" data-testid="run-meta">{r.meta}</span>{/if}
    {#if !r.scheduled}<span class="extra">Fuori programma</span>{/if}
    {#if r.movedFrom}<span class="extra" data-testid="moved-from">Spostata da {shortDay(r.movedFrom)}</span>{/if}
    {#if r.status === 'skipped' && r.occurrence}
      {@const o = r.occurrence}
      <div class="done-row">
        <span class="extra">Saltata: conta come non fatta.</span>
        {#if onrestore}<Button variant="secondary" onclick={() => onrestore(o)}>Ripristina</Button>{/if}
      </div>
    {:else if r.status === 'done' && r.log}
      {@const log = r.log}
      <div class="done-row">
        <span class="sticker">Fatta ✓</span>
        <Button tone="progress" variant="secondary" onclick={() => onshowrun?.(log)}>Dettagli</Button>
      </div>
    {:else if relation !== 'future'}
      <Button tone="progress" size="lg" block onclick={() => onlogrun?.(r)}>Segna come fatta</Button>
      {#if manageable(r.occurrence, r.status)}
        {@const o = r.occurrence}
        <button type="button" class="link manage tap" onclick={() => onmanage?.(o)}
          >{relation === 'today' ? 'Non posso oggi' : 'Recupera in un altro giorno'}</button
        >
      {/if}
    {/if}
  </Card>
{/each}

{#if entries.length === 0 && runs.length === 0}
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
{/if}

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

  .links {
    display: flex;
    justify-content: center;
    gap: var(--space-5);
    margin-top: calc(-1 * var(--space-2));
  }

  .manage {
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 14px;
    color: var(--tip);
  }

  .name.skipped {
    text-decoration: line-through;
    opacity: 0.6;
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
