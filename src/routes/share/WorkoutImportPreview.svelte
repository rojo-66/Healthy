<script lang="ts">
  import type { WorkoutFile } from '../../lib/data/schemas/workout-file';
  import { weekdaysLabel, workoutMeta } from '../../lib/workouts/format';
  import WorkoutPreview, { type PreviewWorkout } from '../train/WorkoutPreview.svelte';

  // Anteprima di una scheda ricevuta: autore, versione, giorni, numeri e la scheda in sola lettura (solo testo).
  interface Props {
    file: WorkoutFile;
  }

  let { file }: Props = $props();

  const preview = $derived<PreviewWorkout>({
    name: file.name,
    source: file.source,
    author: file.author,
    intro: file.intro,
    warmup: file.warmup,
    version: file.version,
    // Solo per l'etichetta "AUTORE · vN": la scheda non è ancora salvata.
    received: { version: file.version, hash: '00000000', at: '' },
    items: file.items,
  });
</script>

<div class="wrap">
  <dl class="facts" data-testid="import-preview">
    <div><dt>Da</dt><dd>{file.author || 'autore non indicato'} · v{file.version}</dd></div>
    <div>
      <dt>Giorni</dt>
      <dd class="mono">{weekdaysLabel(file.weekdays)}{file.time ? ` · ore ${file.time}` : ''}</dd>
    </div>
    <div>
      <dt>Durata</dt>
      <dd class="mono">{workoutMeta(file).replace(/’$/, ' min')}</dd>
    </div>
  </dl>
  <WorkoutPreview workout={preview} />
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .facts {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: var(--space-3);
    background: var(--surface);
    font-size: 14px;
  }

  .facts div {
    display: flex;
    gap: var(--space-2);
    min-width: 0;
  }

  .facts dt {
    flex: none;
    width: 64px;
    color: var(--muted);
  }

  .facts dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
