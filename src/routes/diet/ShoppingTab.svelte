<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import CheckButton from '../../lib/components/CheckButton.svelte';
  import ProgressBar from '../../lib/components/ProgressBar.svelte';
  import { resetShopping, setShoppingChecked } from '../../lib/data/repo/shopping';
  import type { DietPayload } from '../../lib/data/schemas/diet-payload';
  import { weekRangeLabel } from '../../lib/diet/calc/calendar';
  import {
    buildShoppingList,
    NO_CATEGORY_LABEL,
    shoppingProgress,
    shoppingShareText,
  } from '../../lib/diet/calc/shopping';

  interface Props {
    payload: DietPayload;
    /** Lunedì della settimana corrente. */
    weekStart: string;
    /** Tipo di giornata di ogni giorno (lunedì = 0), dopo spostamenti e salti (2c). */
    types?: readonly (string | undefined)[];
    checked: Readonly<Record<string, boolean>>;
  }

  let { payload, weekStart, types = [], checked }: Props = $props();

  const list = $derived(buildShoppingList(payload, types.map((type) => ({ type }))));
  const done = $derived(shoppingProgress(list, checked));
  const weekLabel = $derived(weekRangeLabel(weekStart));
  const isChecked = (key: string) => Object.hasOwn(checked, key) && checked[key] === true;

  const excludedText = $derived.by(() => {
    const names = list.excluded.map((p) => (p.cat ? `${p.name} (${p.cat.toLowerCase()})` : p.name));
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
  });

  let status = $state('');
  let error = $state('');
  let resetOpen = $state(false);
  let shareText = $state<string | null>(null);

  async function toggle(key: string, value: boolean) {
    error = '';
    try {
      await setShoppingChecked(weekStart, key, value);
    } catch {
      error = 'Spunta non salvata: riprova.';
    }
  }

  async function confirmReset() {
    resetOpen = false;
    try {
      await resetShopping(weekStart);
      status = 'Spunte tolte: la lista è pronta per la prossima spesa.';
    } catch {
      error = 'Non sono riuscito a togliere le spunte: riprova.';
    }
  }

  function errorName(e: unknown): string {
    return typeof e === 'object' && e !== null && 'name' in e ? String(e.name) : '';
  }

  /** Condividi come testo; senza Web Share copia negli appunti; altrimenti mostra il testo da copiare. */
  async function share() {
    status = '';
    const text = shoppingShareText(list, checked, weekLabel);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Spesa ${weekLabel}`, text });
        return;
      } catch (e) {
        if (errorName(e) === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      status = 'Lista copiata negli appunti.';
    } catch {
      shareText = text;
    }
  }
</script>

<div class="shop tone-food">
  <div class="title-row">
    <h2 class="graffiti">Settimana {weekLabel}</h2>
    <span class="count mono" aria-label="{done} su {list.total} prodotti spuntati">{done}/{list.total}</span>
  </div>
  <ProgressBar value={done} max={list.total} label="Spesa fatta" valueText="{done} su {list.total}" tone="food" />

  {#each list.groups as group (group.cat)}
    <section class="group" aria-label={group.cat || NO_CATEGORY_LABEL}>
      <h3 class="mono-label">{group.cat || NO_CATEGORY_LABEL}</h3>
      <ul>
        {#each group.items as item (item.key)}
          <li class:on={isChecked(item.key)}>
            <CheckButton
              checked={isChecked(item.key)}
              tone="food"
              label="{item.name}, {item.text}"
              onchange={(v) => toggle(item.key, v)}
            />
            <span class="name">{item.name}</span>
            <span class="qty mono">{item.text}</span>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="hint">La lista è vuota: nel piano non ci sono alimenti da comprare.</p>
  {/each}

  {#if list.excluded.length > 0}
    <p class="hint">Esclusi dalla lista: {excludedText}.</p>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="actions">
    <Button tone="food" size="lg" disabled={done === 0} onclick={() => (resetOpen = true)}>Spesa finita ✓</Button>
    <Button variant="secondary" onclick={share}>Condividi</Button>
  </div>
  <p class="hint center">"Spesa finita" toglie tutte le spunte e prepara la lista per la prossima settimana.</p>
  <p class="status" role="status" aria-live="polite">{status}</p>
</div>

<BottomSheet bind:open={resetOpen} title="Spesa finita?" tone="food">
  <p class="sheet-text">Tolgo tutte le spunte della settimana ({done} su {list.total}).</p>
  <div class="grid2">
    <Button variant="ghost" onclick={() => (resetOpen = false)}>Annulla</Button>
    <Button tone="food" onclick={confirmReset}>Sì, togli le spunte</Button>
  </div>
</BottomSheet>

<BottomSheet open={shareText !== null} title="Lista della spesa" tone="food" onclose={() => (shareText = null)}>
  <p class="sheet-text">Questo telefono non permette di condividere o copiare da qui: seleziona il testo e copialo.</p>
  <textarea class="share-text" readonly rows="12" aria-label="Testo della lista" value={shareText ?? ''}></textarea>
</BottomSheet>

<style>
  .shop {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
  }

  h2 {
    font-size: 26px;
    min-width: 0;
  }

  .count {
    flex: none;
    font-size: 13px;
    color: var(--tone);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .group h3 {
    margin: var(--space-1) 0 2px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 52px;
    padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
    background: var(--surface);
    transition: opacity var(--dur-fade) ease;
  }

  li.on {
    opacity: 0.55;
  }

  .name {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  li.on .name {
    text-decoration: line-through;
  }

  .qty {
    flex: none;
    font-weight: 700;
    font-size: 13px;
    color: var(--tone);
  }

  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }

  .center {
    text-align: center;
  }

  .error {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }

  .status {
    min-height: 1.4em;
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
    text-align: center;
  }

  .actions {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--space-2);
  }

  .sheet-text {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .share-text {
    width: 100%;
    padding: var(--space-3);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-family: var(--font-mono);
    /* 16 px anche in sola lettura: al tocco (per selezionare) Safari ingrandirebbe la pagina. */
    font-size: 16px;
    -webkit-user-select: text;
    user-select: text;
  }
</style>
