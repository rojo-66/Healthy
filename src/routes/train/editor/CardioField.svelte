<script lang="ts">
  import Stepper from '../../../lib/components/Stepper.svelte';
  import type { DraftCardio } from '../../../lib/data/schemas/workout-draft';
  import { drop } from '../../../lib/design/transitions';
  import type { FieldErrors } from '../../../lib/workouts/calc/editor-schema';
  import { CARDIO_MAX_MIN } from '../../../lib/workouts/calc/values';

  interface Props {
    cardio: DraftCardio | null;
    errors: FieldErrors;
    onchange: (next: DraftCardio | null) => void;
  }

  let { cardio, errors, onchange }: Props = $props();
  const uid = $props.id();
  let open = $state(false);

  const TYPES = ['tapis roulant', 'cyclette', 'ellittica', 'vogatore', 'corsa'] as const;
  const hasError = $derived(!!errors['cardio.type'] || !!errors['cardio.minutes']);

  function toggle() {
    if (!cardio) onchange({ type: 'tapis roulant', minutes: 10 });
    open = !open || !cardio;
  }
</script>

<section class="cardio tone-training" class:has-error={hasError} aria-label="Cardio finale" data-error={hasError || undefined}>
  <button type="button" class="head tap" aria-expanded={open && !!cardio} aria-controls="{uid}-body" onclick={toggle}>
    <span>Cardio finale</span>
    <span class="mono val">{cardio ? `${cardio.type || '—'} · ${cardio.minutes}’` : 'facoltativo · aggiungi'}</span>
  </button>
  {#if open && cardio}
    <div class="body" id="{uid}-body" in:drop>
      <div class="field">
        <label class="mono-label" for="{uid}-type">Tipo</label>
        <input
          id="{uid}-type"
          type="text"
          maxlength="40"
          value={cardio.type}
          aria-invalid={errors['cardio.type'] ? 'true' : undefined}
          oninput={(e) => onchange({ ...cardio, type: e.currentTarget.value })}
        />
        <div class="types" role="group" aria-label="Tipi di cardio">
          {#each TYPES as t (t)}
            <button type="button" class="chip tap" aria-pressed={cardio.type === t} onclick={() => onchange({ ...cardio, type: t })}>{t}</button>
          {/each}
        </div>
        {#if errors['cardio.type']}<p class="err">Tipo: {errors['cardio.type']}</p>{/if}
      </div>
      <div class="minutes">
        <Stepper
          label="Minuti"
          value={cardio.minutes}
          min={1}
          max={CARDIO_MAX_MIN}
          decLabel="Un minuto in meno"
          incLabel="Un minuto in più"
          onchange={(v) => onchange({ ...cardio, minutes: v })}
        />
      </div>
      <button
        type="button"
        class="remove tap"
        onclick={() => {
          open = false;
          onchange(null);
        }}>Rimuovi il cardio</button
      >
    </div>
  {/if}
</section>

<style>
  .cardio {
    display: flex;
    flex-direction: column;
    background: var(--surface);
  }

  .cardio.has-error {
    box-shadow: inset 0 0 0 1px var(--tip-edge);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    min-height: 52px;
    padding: 12px 14px;
    border: 0;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    text-align: left;
  }

  .val {
    font-size: 13px;
    color: var(--tone);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 14px 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  input {
    height: var(--touch);
    padding: 0 12px;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 16px;
  }

  input:focus {
    outline: 1px solid var(--tone);
    outline-offset: 0;
  }

  .types {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    min-height: var(--touch);
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text-2);
    font-size: 13px;
  }

  .chip[aria-pressed='true'] {
    border-color: var(--tone);
    color: var(--tone);
    background: var(--tone-tint);
  }

  .minutes {
    max-width: 50%;
  }

  .remove {
    align-self: flex-start;
    min-height: var(--touch);
    padding: 0 12px;
    background: transparent;
    border: 1px solid var(--tip-edge);
    color: var(--tip);
    font-size: 13px;
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }
</style>
