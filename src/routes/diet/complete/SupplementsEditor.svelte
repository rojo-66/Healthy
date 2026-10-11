<script lang="ts">
  import Button from '../../../lib/components/Button.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import { MAX_TEXT } from '../../../lib/data/limits';
  import { weekdayName, type DietSupplement } from '../../../lib/data/schemas/diet-payload';

  interface Props {
    weekday: number;
    supplements: readonly DietSupplement[];
    busy: boolean;
    onsave: (list: DietSupplement[]) => Promise<readonly string[]>;
  }

  let { weekday, supplements, busy, onsave }: Props = $props();

  let name = $state('');
  let when = $state('');
  let dose = $state('');
  let errors = $state<readonly string[]>([]);
  const dayName = $derived(weekdayName(weekday));
  const uid = $props.id();

  async function save(list: DietSupplement[]) {
    errors = await onsave(list);
    return errors.length === 0;
  }

  async function add() {
    if (name.trim() === '') {
      errors = ['nome: campo obbligatorio'];
      return;
    }
    const ok = await save([...supplements, { name: name.trim(), when: when.trim(), dose: dose.trim(), skip: false }]);
    if (ok) {
      name = '';
      when = '';
      dose = '';
    }
  }
</script>

<div class="supps">
  <h3 class="day">{dayName}</h3>
  {#if supplements.length > 0}
    <ul>
      {#each supplements as s, i (i)}
        <li class:skip={s.skip}>
          <span class="text">{[s.name, s.dose, s.when].filter(Boolean).join(' · ')}</span>
          <Button
            variant="ghost"
            tone="tip"
            size="sm"
            pressed={s.skip}
            disabled={busy}
            label="{s.name}: {s.skip ? 'serve oggi' : 'non serve oggi'}"
            onclick={() => save(supplements.map((x, j) => (j === i ? { ...x, skip: !x.skip } : x)))}
          >
            {s.skip ? 'Non serve' : 'Serve'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            label="Togli {s.name} da {dayName.toLowerCase()}"
            onclick={() => save(supplements.filter((_, j) => j !== i))}
          >
            {#snippet icon()}<Icon name="close" size={18} />{/snippet}
          </Button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="hint">Nessun integratore.</p>
  {/if}
  <div class="add">
    <label class="visually-hidden" for="{uid}-n">Nome dell'integratore per {dayName.toLowerCase()}</label>
    <input id="{uid}-n" placeholder="Nome (es. Vitamina D3)" maxlength={MAX_TEXT.name} bind:value={name} />
    <label class="visually-hidden" for="{uid}-w">Quando</label>
    <input id="{uid}-w" placeholder="Quando (es. cena)" maxlength={MAX_TEXT.short} bind:value={when} />
    <label class="visually-hidden" for="{uid}-d">Dose</label>
    <input id="{uid}-d" placeholder="Dose (es. 2.000 UI)" maxlength={MAX_TEXT.short} bind:value={dose} />
    <Button variant="secondary" tone="tip" disabled={busy} label="Aggiungi integratore a {dayName.toLowerCase()}" onclick={add}>
      {#snippet icon()}<Icon name="plus" size={18} />{/snippet}
      Aggiungi
    </Button>
  </div>
  {#if errors.length > 0}
    <ul class="errors" role="alert">
      {#each errors as e, i (i)}<li>{e}</li>{/each}
    </ul>
  {/if}
</div>

<style>
  .supps {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--surface);
  }

  .day {
    margin: 0;
    font-size: 15px;
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
    gap: var(--space-1);
  }

  .text {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: var(--tip);
    overflow-wrap: anywhere;
  }

  .skip .text {
    color: var(--muted);
    text-decoration: line-through;
  }

  .add {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .add input {
    min-width: 0;
    min-height: var(--touch);
    padding: 0 var(--space-2);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 0;
    color: var(--text);
    font-size: 16px;
  }

  .add input:first-of-type {
    grid-column: 1 / -1;
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .errors {
    padding-left: 1.2em;
    font-size: 13px;
    color: var(--tip);
  }
</style>
