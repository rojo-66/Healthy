<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import ProgressBar from '../../lib/components/ProgressBar.svelte';
  import type { DietPlan } from '../../lib/data/schemas/diet-plans';
  import { planCompleteness } from '../../lib/diet/calc/completeness';
  import { atPercent } from '../../lib/diet/format';
  import { planMeta } from './plan-meta';

  interface Props {
    open: boolean;
    plan: DietPlan;
    archived: readonly DietPlan[];
    busy: boolean;
    /** Messaggio sotto le azioni (es. esito dell'esportazione). */
    status: string;
    /** Schermata di import (link, QR o file), M8. */
    importHref: string;
    onexport: () => void;
    onedit: () => void;
    onshare: () => void;
    onrestore: (plan: DietPlan) => void;
  }

  let { open = $bindable(), plan, archived, busy, status, importHref, onexport, onedit, onshare, onrestore }: Props = $props();

  const completeness = $derived(planCompleteness(plan.payload));
</script>

<BottomSheet bind:open title={plan.title} tone="food">
  <div class="intro">
    <span class="mono-label active">Piano attivo</span>
    <span class="meta">{planMeta(plan)}</span>
  </div>

  <section class="state" aria-label="Stato del piano">
    <div class="state-row">
      <span>Completo <b>{atPercent(completeness.percent)}</b></span>
    </div>
    <ProgressBar value={completeness.percent} max={100} label="Completezza del piano" valueText="{completeness.percent}%" tone="food" />
    <ul class="chips">
      {#each completeness.items as item (item.id)}
        <li class:done={item.done} title={item.detail}>
          <span aria-hidden="true">{item.done ? '✓' : '!'}</span>
          {item.label}<span class="visually-hidden">{item.done ? ': completo' : `: ${item.detail}`}</span>
        </li>
      {/each}
    </ul>
  </section>

  <div class="actions">
    <a class="action tap" href={importHref}>
      <span class="t">Importa</span><span class="s">nuovo piano (link, QR o file)</span>
    </a>
    <button type="button" class="action tap" disabled={busy} onclick={onexport}>
      <span class="t">Esporta</span><span class="s">salva il file JSON</span>
    </button>
    <button type="button" class="action tap" disabled={busy} onclick={onedit}>
      <span class="t">Modifica</span><span class="s">completa valori e target</span>
    </button>
    <button type="button" class="action tap" disabled={busy} onclick={onshare}>
      <span class="t">Condividi</span><span class="s">link, QR o file</span>
    </button>
  </div>
  <p class="status" role="status" aria-live="polite">{status}</p>

  {#if archived.length > 0}
    <section class="archive" aria-label="Archivio">
      <h3 class="mono-label">Archivio</h3>
      <ul>
        {#each archived as old (old.id)}
          <li>
            <span class="old">
              <span class="old-title">{old.title}</span>
              <span class="meta">{planMeta(old)}</span>
            </span>
            <Button variant="secondary" size="sm" disabled={busy} label="Ripristina {old.title}" onclick={() => onrestore(old)}
              >Ripristina</Button
            >
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</BottomSheet>

<style>
  .intro {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .active {
    color: var(--tone);
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }

  .state {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .state-row {
    font-size: 14px;
  }

  .chips {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 12px;
  }

  .chips li {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--tip-edge);
    color: var(--tip);
  }

  .chips li.done {
    border-color: var(--tone-edge);
    color: var(--tone);
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .action {
    min-height: 72px;
    padding: 10px var(--space-3);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 3px;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    text-align: left;
    text-decoration: none;
  }

  .action:disabled {
    opacity: 0.38;
  }


  .t {
    font-size: 15px;
    font-weight: 700;
  }

  .s {
    font-size: 12px;
    color: var(--muted);
  }

  .status {
    min-height: 1.4em;
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
  }

  .archive {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }

  .archive h3 {
    margin: 0;
  }

  .archive ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .archive li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .old {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .old-title {
    font-size: 14px;
    overflow-wrap: anywhere;
  }
</style>
