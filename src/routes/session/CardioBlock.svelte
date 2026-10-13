<script lang="ts">
  import CheckButton from '../../lib/components/CheckButton.svelte';
  import { formatClock } from '../../lib/components/time';
  import type { SessionCardio } from '../../lib/data/schemas/sessions';
  import type { CardioItem } from '../../lib/data/schemas/workouts';
  import { burst } from '../../lib/design/transitions';
  import type { LastCardio } from '../../lib/sessions/cardio';
  import { cardioDoneLabel, cardioPlanLabel } from '../../lib/sessions/format';
  import { optionalInputValue, parseOptional } from '../../lib/sessions/input';
  import { elapsedMs, isRunning, reachedTarget, STOPPED } from '../../lib/sessions/stopwatch';

  /**
   * Esercizio cardio nella sessione live (2a), al posto della tabella delle serie: tempo previsto,
   * cronometro (avvia/pausa, a istanti come il recupero), minuti e km effettivi, spunta "Fatto".
   * La spunta non avvia il recupero.
   */
  interface Props {
    item: CardioItem;
    entry: SessionCardio | null;
    last: LastCardio | null;
    now: number;
    /** Tempo previsto appena raggiunto (impulso). */
    alerting: boolean;
    onstart: () => void;
    onpause: () => void;
    ontoggle: () => void;
    onminutes: (value: number | null) => void;
    onkm: (value: number | null) => void;
  }

  let { item, entry, last, now, alerting, onstart, onpause, ontoggle, onminutes, onkm }: Props = $props();

  const clock = $derived(entry?.clock ?? STOPPED);
  const running = $derived(isRunning(clock));
  const elapsed = $derived(elapsedMs(clock, now));
  const reached = $derived(reachedTarget(clock, item.minutes, now));
  const done = $derived(entry?.done ?? false);

  // Mentre si scrive il campo mostra il testo digitato ("2," resta "2,").
  let minutesText = $state<string | null>(null);
  let kmText = $state<string | null>(null);

  function inputMinutes(e: Event & { currentTarget: HTMLInputElement }) {
    minutesText = e.currentTarget.value;
    const v = parseOptional(minutesText, 600);
    if (v !== undefined && v !== (entry?.minutes ?? null)) onminutes(v);
  }

  function inputKm(e: Event & { currentTarget: HTMLInputElement }) {
    kmText = e.currentTarget.value;
    const v = parseOptional(kmText, 500);
    if (v !== undefined && v !== (entry?.distanceKm ?? null)) onkm(v);
  }

  const selectAll = (e: FocusEvent & { currentTarget: HTMLInputElement }) => e.currentTarget.select();
</script>

<div class="cardio" class:done data-testid="cardio-block">
  <div class="plan">
    <span class="mono-label">Previsto</span>
    <span class="mono plan-val">{cardioPlanLabel(item)}</span>
    {#if last?.done}
      <span class="mono last">Ultima volta {cardioDoneLabel(item.minutes, last.minutes, last.distanceKm)}</span>
    {/if}
  </div>

  <div class="clock" class:reached>
    {#if alerting}<span class="pulse" aria-hidden="true" in:burst></span>{/if}
    <span class="mono time" role="timer" aria-label="Cronometro {formatClock(elapsed / 1000)}">{formatClock(elapsed / 1000)}</span>
    <span class="mono caption">
      {#if reached}TEMPO PREVISTO RAGGIUNTO{:else if running}IN CORSO{:else if elapsed > 0}IN PAUSA{:else}CRONOMETRO{/if}
    </span>
    {#if running}
      <button type="button" class="clock-btn tap" onclick={onpause} data-testid="cardio-pause">Pausa</button>
    {:else}
      <button type="button" class="clock-btn primary tap" onclick={onstart} disabled={done} data-testid="cardio-start"
        >{elapsed > 0 ? 'Riprendi' : 'Avvia'}</button
      >
    {/if}
  </div>

  <div class="actual">
    <label class="field">
      <span class="mono-label">Minuti fatti</span>
      <input
        class="num mono"
        type="text"
        inputmode="decimal"
        enterkeyhint="done"
        autocomplete="off"
        placeholder={String(item.minutes)}
        value={minutesText ?? optionalInputValue(entry?.minutes ?? null)}
        oninput={inputMinutes}
        onfocus={selectAll}
        onblur={() => (minutesText = null)}
      />
    </label>
    <label class="field">
      <span class="mono-label">Km</span>
      <input
        class="num mono"
        type="text"
        inputmode="decimal"
        enterkeyhint="done"
        autocomplete="off"
        placeholder={item.distanceKm === null ? '—' : optionalInputValue(item.distanceKm)}
        value={kmText ?? optionalInputValue(entry?.distanceKm ?? null)}
        oninput={inputKm}
        onfocus={selectAll}
        onblur={() => (kmText = null)}
      />
    </label>
    <div class="field check">
      <span class="mono-label">Fatto</span>
      <CheckButton
        checked={done}
        tone="training"
        label={done ? `${item.name} fatto, tocca per annullare` : `Segna ${item.name} come fatto`}
        onchange={ontoggle}
      />
    </div>
  </div>
</div>

<style>
  .cardio {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .plan {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }

  .plan-val {
    color: var(--tone);
    font-size: 15px;
    font-weight: 700;
  }

  .last {
    flex-basis: 100%;
    font-size: 13px;
    color: var(--muted);
  }

  .clock {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: var(--space-4) var(--space-3);
    background: var(--bg);
    border: 1px solid var(--line);
  }

  .clock.reached {
    border-color: var(--tone);
  }

  .pulse {
    position: absolute;
    inset: 0;
    border: 3px solid var(--training);
    box-shadow: 0 0 22px var(--training-glow);
    opacity: 0;
    pointer-events: none;
  }

  .time {
    font-size: 44px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .caption {
    font-size: 11px;
    letter-spacing: 1.5px;
    color: var(--muted);
  }

  .reached .caption {
    color: var(--tone);
  }

  .clock-btn {
    min-width: 140px;
    min-height: var(--touch);
    padding: 0 18px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-size: 15px;
    font-weight: 700;
  }

  .clock-btn.primary {
    background: var(--tone);
    border-color: var(--tone);
    color: var(--on-tone);
  }

  .clock-btn:disabled {
    opacity: 0.4;
  }

  .actual {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 56px;
    gap: var(--space-2);
    align-items: end;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .check {
    align-items: center;
  }

  .num {
    box-sizing: border-box;
    width: 100%;
    height: var(--touch);
    padding: 0 6px;
    border: 1px solid var(--line);
    border-radius: 0;
    background: var(--bg);
    color: var(--text);
    /* 16 px: sotto, Safari ingrandisce la pagina al tocco. */
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    appearance: none;
  }

  .num:focus {
    outline: 2px solid var(--training);
    outline-offset: -1px;
  }

  .done .clock {
    opacity: 0.7;
  }
</style>
