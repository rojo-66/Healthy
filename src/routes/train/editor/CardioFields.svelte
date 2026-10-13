<script lang="ts">
  import Stepper from '../../../lib/components/Stepper.svelte';
  import { CARDIO_FIELDS, type CardioField } from '../../../lib/data/schemas/exercises';
  import type { DraftCardio } from '../../../lib/data/schemas/workout-draft';
  import type { FieldErrors } from '../../../lib/workouts/calc/editor-schema';
  import {
    CARDIO_CONFIRM_ABOVE,
    CARDIO_FIELD_SPECS,
    CARDIO_MAX_MIN,
    CARDIO_MIN_MIN,
  } from '../../../lib/workouts/calc/values';

  /**
   * Campi di un esercizio cardio nell'editor (2a): minuti sempre, poi i campi della voce della libreria
   * (distanza, velocità, pendenza, livello); gli altri dietro "Altri campi". 0 = non indicato.
   */
  interface Props {
    item: DraftCardio;
    errors: FieldErrors;
    onchange: (next: DraftCardio) => void;
  }

  let { item, errors, onchange }: Props = $props();

  let showAll = $state(false);

  const valueOf = (field: CardioField): number | null => item[CARDIO_FIELD_SPECS[field].key];
  const shown = $derived(CARDIO_FIELDS.filter((f) => showAll || item.fields.includes(f) || valueOf(f) !== null));
  const hidden = $derived(CARDIO_FIELDS.length - shown.length);

  function setField(field: CardioField, v: number) {
    onchange({ ...item, [CARDIO_FIELD_SPECS[field].key]: v > 0 ? v : null });
  }
</script>

<div class="cardio-fields">
  <div class="grid">
    <Stepper
      label="Minuti"
      value={item.minutes}
      min={CARDIO_MIN_MIN}
      max={CARDIO_MAX_MIN}
      unit="min"
      confirmAbove={CARDIO_CONFIRM_ABOVE}
      decLabel="Un minuto in meno"
      incLabel="Un minuto in più"
      onchange={(v) => onchange({ ...item, minutes: v })}
    />
    {#each shown as field (field)}
      {@const spec = CARDIO_FIELD_SPECS[field]}
      <Stepper
        label={spec.unit ? `${spec.label} (${spec.unit})` : spec.label}
        value={valueOf(field) ?? 0}
        min={0}
        max={spec.max}
        step={spec.step}
        integer={spec.integer}
        unit={spec.unit || undefined}
        decLabel="{spec.label}: meno {spec.step}"
        incLabel="{spec.label}: più {spec.step}"
        onchange={(v) => setField(field, v)}
      />
    {/each}
  </div>
  {#if errors['minutes']}<p class="err" data-error>Minuti: {errors['minutes']}</p>{/if}
  <p class="hint">Facoltativi: 0 = non indicato.</p>
  {#if hidden > 0}
    <button type="button" class="more tap" onclick={() => (showAll = true)}>+ Altri campi ({hidden})</button>
  {/if}
</div>

<style>
  .cardio-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .more {
    align-self: flex-start;
    min-height: var(--touch);
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text-2);
    font-size: 13px;
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }
</style>
