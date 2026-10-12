<script lang="ts" module>
  import type { Workout } from '../../lib/data/schemas/workouts';

  /** Dati mostrati: una scheda salvata o la bozza dell'editor (stessa vista, in sola lettura). */
  export type PreviewWorkout = Pick<Workout, 'name' | 'source' | 'author' | 'intro' | 'warmup' | 'cardio' | 'received'> & {
    /** Versione mostrata (per la bozza: quella dopo il salvataggio). */
    version: number;
    items: readonly (Omit<Workout['items'][number], 'videoUrl' | 'exerciseId'> & { videoUrl: string | null })[];
  };
</script>

<script lang="ts">
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { workoutTotals } from '../../lib/workouts/calc/duration';
  import { itemSummary, kgLabel, originLabel } from '../../lib/workouts/format';

  interface Props {
    workout: PreviewWorkout;
    /** Dentro un pannello (anteprima dell'editor): card più scure per staccarsi dal fondo. */
    inset?: boolean;
  }

  let { workout, inset = false }: Props = $props();

  const totals = $derived(workoutTotals(workout));
  /** Solo link https completi: niente link a metà scrittura nell'anteprima della bozza. */
  const safeUrl = (url: string | null) => (url && /^https:\/\/[^\s]+$/.test(url) ? url : null);
</script>

<article class="preview tone-training" class:inset aria-label="Anteprima della scheda {workout.name}">
  <header class="head">
    <span class="mono-label origin" class:pt={workout.source === 'pt'}>
      {originLabel(workout)}{workout.source === 'pt' && workout.author && !workout.received ? ` · ${workout.author}` : ''}
    </span>
    <h2 class="graffiti name">{workout.name || 'Senza nome'}</h2>
    <p class="mono totals">
      {totals.exercises} esercizi · {totals.sets} serie · ~{totals.strengthMin}’{workout.cardio && workout.cardio.minutes > 0
        ? ` + ${workout.cardio.minutes}’ ${workout.cardio.type}`
        : ''}
    </p>
  </header>

  {#if workout.intro}
    <NoteBox title={workout.source === 'pt' ? 'Messaggio del PT' : 'Introduzione'} text={workout.intro} />
  {/if}

  {#if workout.warmup.length > 0}
    <section class="block" aria-labelledby="pv-warmup">
      <h3 id="pv-warmup" class="mono-label">Riscaldamento e mobilità</h3>
      <ul class="warmup">
        {#each workout.warmup as w, i (i)}
          <li>
            <span class="w-name">{w.name}</span>
            {#if w.dose}<span class="mono w-dose">{w.dose}</span>{/if}
            {#if w.hint}<span class="w-hint">{w.hint}</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="block" aria-labelledby="pv-items">
    <h3 id="pv-items" class="mono-label">Esercizi</h3>
    <ol class="items">
      {#each workout.items as item, i (i)}
        {@const url = safeUrl(item.videoUrl)}
        <li class="item">
          <div class="item-head">
            <span class="num mono" aria-hidden="true">{i + 1}</span>
            <div class="item-text">
              <span class="item-name">{item.name}</span>
              <span class="mono item-scheme">{itemSummary(item)}</span>
              {#if item.muscles.length > 0}<span class="item-muscles">{item.muscles.join(' · ')}</span>{/if}
            </div>
          </div>
          {#if item.setsDetail}
            <table class="sets mono">
              <caption class="visually-hidden">Serie di {item.name}</caption>
              <thead><tr><th scope="col">Serie</th><th scope="col">Rip</th><th scope="col">Kg</th></tr></thead>
              <tbody>
                {#each item.setsDetail as s, j (j)}
                  <tr><td>{j + 1}</td><td>{s.reps}</td><td>{kgLabel(s.kg)}</td></tr>
                {/each}
              </tbody>
            </table>
          {/if}
          {#if item.note}
            <NoteBox title="Nota del PT" text={item.note} />
          {/if}
          {#if url}
            <a class="video tap" href={url} target="_blank" rel="noopener noreferrer">
              ▶ Video <span class="video-url">{url}</span>
            </a>
          {/if}
        </li>
      {/each}
    </ol>
  </section>

  {#if workout.cardio}
    <section class="block cardio" aria-label="Cardio finale">
      <span>Cardio finale</span>
      <span class="mono cardio-val">{workout.cardio.type} · {workout.cardio.minutes}’</span>
    </section>
  {/if}
</article>

<style>
  .preview {
    --card: var(--surface);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-width: 0;
  }

  .preview.inset {
    --card: var(--bg);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .origin {
    align-self: flex-start;
    padding: 1px 6px;
    border: 1px solid var(--line-strong);
    font-size: 10px;
    letter-spacing: 1px;
  }

  .origin.pt {
    color: var(--tip);
    border-color: var(--tip-edge);
  }

  .name {
    font-size: 34px;
    color: var(--tone);
    text-shadow: 0 0 14px var(--tone-glow);
    overflow-wrap: anywhere;
  }

  .totals {
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .block > h3 {
    margin: 0;
  }

  .warmup,
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .warmup li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px var(--space-2);
    padding: 10px 12px;
    background: var(--card);
    font-size: 14px;
  }

  .w-name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .w-dose {
    color: var(--tone);
    font-size: 12px;
  }

  .w-hint {
    grid-column: 1 / -1;
    color: var(--muted);
    font-size: 13px;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    background: var(--card);
  }

  .item-head {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .num {
    display: grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    background: var(--bg);
    color: var(--tone);
    font-weight: 700;
    font-size: 13px;
  }

  .item-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .item-name {
    font-size: 15px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .item-scheme {
    font-size: 12px;
    color: var(--text-2);
  }

  .item-muscles {
    font-size: 12px;
    color: var(--muted);
  }

  .sets {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: center;
  }

  .sets th {
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
    padding: 4px;
  }

  .sets td {
    padding: 4px;
    border-top: 1px solid var(--line);
  }

  .video {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch);
    min-width: 0;
    color: var(--progress);
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
  }

  .video-url {
    min-width: 0;
    font-weight: 400;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cardio {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: var(--card);
    font-size: 14px;
  }

  .cardio-val {
    color: var(--tone);
    font-size: 13px;
  }
</style>
