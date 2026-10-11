<script lang="ts">
  import { tick } from 'svelte';
  import BottomSheet from '../../../lib/components/BottomSheet.svelte';
  import type { DraftWarmup } from '../../../lib/data/schemas/workout-draft';
  import type { FieldErrors } from '../../../lib/workouts/calc/editor-schema';
  import { move } from '../../../lib/workouts/calc/reorder';
  import { emptyWarmup } from '../../../lib/workouts/draft';

  interface Props {
    open: boolean;
    warmup: readonly DraftWarmup[];
    /** Errori della scheda (chiavi `warmup.N.campo`). */
    errors: FieldErrors;
    onchange: (next: DraftWarmup[]) => void;
  }

  let { open = $bindable(false), warmup, errors, onchange }: Props = $props();
  let list: HTMLOListElement | undefined = $state();

  function patch(i: number, p: Partial<DraftWarmup>) {
    onchange(warmup.map((w, j) => (j === i ? { ...w, ...p } : w)));
  }

  async function add() {
    const item = emptyWarmup();
    onchange([...warmup, item]);
    await tick();
    list?.querySelector<HTMLInputElement>(`[data-key="${item.key}"] input`)?.focus();
  }
</script>

<BottomSheet bind:open title="Riscaldamento e mobilità" tone="training">
  <p class="hint">Si legge e si spunta prima di iniziare. Nome, suggerimento e dose (es. 2 × 15).</p>
  <ol class="list" bind:this={list}>
    {#each warmup as w, i (w.key)}
      <li class="w" data-key={w.key}>
        <div class="w-head">
          <span class="mono n">{i + 1}</span>
          <div class="w-actions">
            <button type="button" class="act tap" disabled={i === 0} onclick={() => onchange(move(warmup, i, i - 1))}
              >↑<span class="visually-hidden"> Sposta su {w.name}</span></button
            >
            <button type="button" class="act tap" disabled={i === warmup.length - 1} onclick={() => onchange(move(warmup, i, i + 1))}
              >↓<span class="visually-hidden"> Sposta giù {w.name}</span></button
            >
            <button type="button" class="act danger tap" onclick={() => onchange(warmup.filter((_, j) => j !== i))}
              >Elimina<span class="visually-hidden"> {w.name || `voce ${i + 1}`}</span></button
            >
          </div>
        </div>
        <label class="visually-hidden" for="wu-name-{w.key}">Nome della voce {i + 1}</label>
        <input
          id="wu-name-{w.key}"
          type="text"
          placeholder="Nome (es. Rotazioni spalle)"
          value={w.name}
          aria-invalid={errors[`warmup.${i}.name`] ? 'true' : undefined}
          oninput={(e) => patch(i, { name: e.currentTarget.value })}
        />
        {#if errors[`warmup.${i}.name`]}<p class="err">Nome: {errors[`warmup.${i}.name`]}</p>{/if}
        <div class="row2">
          <label class="visually-hidden" for="wu-hint-{w.key}">Suggerimento della voce {i + 1}</label>
          <input
            id="wu-hint-{w.key}"
            type="text"
            placeholder="Suggerimento"
            value={w.hint}
            oninput={(e) => patch(i, { hint: e.currentTarget.value })}
          />
          <label class="visually-hidden" for="wu-dose-{w.key}">Dose della voce {i + 1}</label>
          <input
            id="wu-dose-{w.key}"
            class="dose"
            type="text"
            placeholder="Dose"
            maxlength="40"
            value={w.dose}
            oninput={(e) => patch(i, { dose: e.currentTarget.value })}
          />
        </div>
      </li>
    {/each}
  </ol>
  <button type="button" class="add tap" onclick={() => void add()}>+ Aggiungi voce</button>
</BottomSheet>

<style>
  .hint {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .w {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: var(--bg);
  }

  .w-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .n {
    color: var(--training);
    font-weight: 700;
  }

  .w-actions {
    display: flex;
    gap: 6px;
  }

  .act {
    min-width: var(--touch);
    height: var(--touch);
    padding: 0 10px;
    background: transparent;
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 13px;
  }

  .act:disabled {
    opacity: 0.38;
  }

  .act.danger {
    border-color: var(--tip-edge);
    color: var(--tip);
  }

  input {
    height: var(--touch);
    min-width: 0;
    padding: 0 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 16px;
  }

  input[aria-invalid='true'] {
    border-color: var(--tip);
  }

  input:focus {
    outline: 1px solid var(--training);
    outline-offset: 0;
  }

  .row2 {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 6px;
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }

  .add {
    min-height: 48px;
    background: transparent;
    border: 1px dashed var(--training);
    color: var(--training);
    font-weight: 700;
    font-size: 15px;
  }
</style>
