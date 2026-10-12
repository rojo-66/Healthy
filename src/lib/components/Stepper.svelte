<script lang="ts">
  import { rise } from '../design/transitions';
  import { pressRepeat } from './press-repeat';
  import { canStep, clamp, formatNumber, readTyped, stepValue, typedMessage } from './stepper';

  interface Props {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    /** Unità mostrata accanto al numero e letta nei pulsanti (es. "kg"). */
    unit?: string;
    disabled?: boolean;
    decLabel?: string;
    incLabel?: string;
    /** Passo personalizzato; il risultato resta tra min e max. */
    next?: (value: number, dir: 1 | -1) => number;
    /** Solo numeri interi scritti a mano (di base: se il passo è intero). */
    integer?: boolean;
    /** Oltre questo valore scritto a mano si chiede conferma (es. 250 kg). */
    confirmAbove?: number;
    /** `stacked`: etichetta, numero, pulsanti sotto. `inline`: − numero + in riga (tabella delle serie). */
    layout?: 'stacked' | 'inline';
    /** Valore da correggere (solo `inline`): numero in giallo. */
    invalid?: boolean;
    onchange?: (value: number) => void;
  }

  let {
    label,
    value = $bindable(),
    min = 0,
    max = 999,
    step = 1,
    unit,
    disabled = false,
    decLabel,
    incLabel,
    next,
    integer,
    confirmAbove,
    layout = 'stacked',
    invalid = false,
    onchange,
  }: Props = $props();

  const id = $props.id();
  const inline = $derived(layout === 'inline');
  const opts = $derived({ min, max, step });
  const stepText = $derived(formatNumber(step) + (unit ? ` ${unit}` : ''));
  const wholeOnly = $derived(integer ?? Number.isInteger(step));

  let input: HTMLInputElement;
  /** Il numero è un campo: mentre lo si modifica mostra il testo scritto. */
  let editing = $state(false);
  let text = $state('');
  let cancelled = false;
  /** Avviso sotto il numero (fuori limite, non è un numero). */
  let message = $state('');
  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  /** Valore sospetto in attesa di conferma. */
  let pending = $state<number | null>(null);

  const shown = $derived(editing ? text : formatNumber(value));

  function set(v: number) {
    if (v === value) return;
    value = v;
    onchange?.(v);
  }

  function stepped(dir: 1 | -1): number {
    return next ? clamp(next(value, dir), min, max) : stepValue(value, dir, opts);
  }

  function change(dir: 1 | -1) {
    set(stepped(dir));
    if (editing) text = formatNumber(value);
  }

  /** Passo della pressione lunga: dice se se ne può fare un altro. */
  const repeat = (dir: 1 | -1) => () => {
    if (disabled || !canStep(value, dir, opts)) return false;
    change(dir);
    return canStep(value, dir, opts);
  };

  function warn(text: string) {
    clearTimeout(messageTimer);
    message = text;
    if (text) messageTimer = setTimeout(() => (message = ''), 4000);
  }

  function onfocus() {
    editing = true;
    cancelled = false;
    pending = null;
    warn('');
    text = formatNumber(value);
    // Testo selezionato: si sovrascrive subito. Su iPhone la selezione va rifatta dopo il focus.
    input.select();
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(0, input.value.length);
    });
  }

  function onblur() {
    const typed = text;
    editing = false;
    if (cancelled || typed.trim() === formatNumber(value)) return;
    const result = readTyped(typed, { min, max, integer: wholeOnly, confirmAbove });
    if (result.kind === 'ok') set(result.value);
    else if (result.kind === 'confirm') pending = result.value;
    else warn(typedMessage(result, { min, max, unit }));
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelled = true;
      input.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      change(e.key === 'ArrowUp' ? 1 : -1);
    }
  }

  function confirm(ok: boolean) {
    if (ok && pending !== null) set(pending);
    pending = null;
  }
</script>

<div class="stepper" class:inline class:invalid role="group" aria-labelledby={inline ? undefined : `${id}-label`} aria-label={inline ? label : undefined}>
  {#if !inline}<span class="mono-label" id="{id}-label">{label}</span>{/if}

  {#snippet dec()}
    <button
      type="button"
      class="tap"
      aria-label={decLabel ?? (inline ? `${label}: meno` : `Meno ${stepText}`)}
      disabled={disabled || !canStep(value, -1, opts)}
      use:pressRepeat={repeat(-1)}
      onclick={() => change(-1)}>−</button
    >
  {/snippet}
  {#snippet inc()}
    <button
      type="button"
      class="tap"
      aria-label={incLabel ?? (inline ? `${label}: più` : `Più ${stepText}`)}
      disabled={disabled || !canStep(value, 1, opts)}
      use:pressRepeat={repeat(1)}
      onclick={() => change(1)}>+</button
    >
  {/snippet}

  {#if inline}{@render dec()}{/if}
  <div class="value mono">
    <span class="num-wrap" class:editing>
      <input
        bind:this={input}
        class="num"
        type="text"
        inputmode={wholeOnly ? 'numeric' : 'decimal'}
        enterkeyhint="done"
        autocomplete="off"
        spellcheck="false"
        role="spinbutton"
        aria-labelledby={inline ? undefined : `${id}-label`}
        aria-label={inline ? label : undefined}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={formatNumber(value) + (unit ? ` ${unit}` : '')}
        aria-describedby={message ? `${id}-msg` : undefined}
        {disabled}
        value={shown}
        style:width={inline ? undefined : `${Math.max(2, shown.length) + 0.6}ch`}
        oninput={(e) => (text = e.currentTarget.value)}
        {onfocus}
        {onblur}
        {onkeydown}
      />
      <!-- Numero mostrato sopra il campo quando non lo si modifica: {#key} ricrea solo il numero (niente duplicati). -->
      {#if !editing}
        {#key value}
          <span class="shown" aria-hidden="true" in:rise={{ duration: 200, y: 6 }}>{formatNumber(value)}</span>
        {/key}
      {/if}
    </span>
    {#if unit && !inline}<span class="unit">{unit}</span>{/if}
  </div>
  {#if inline}{@render inc()}{/if}

  {#if !inline}
    <div class="buttons">
      {@render dec()}
      {@render inc()}
    </div>
  {/if}

  {#if message}
    <p class="msg" id="{id}-msg" role="alert">{message}</p>
  {/if}
  {#if pending !== null}
    <div class="confirm" role="alert">
      <span class="confirm-text">{formatNumber(pending)}{unit ? ` ${unit}` : ''}?</span>
      <button type="button" class="tap yes" onclick={() => confirm(true)}>Conferma</button>
      <button type="button" class="tap" onclick={() => confirm(false)}>Annulla</button>
    </div>
  {/if}
</div>

<style>
  .stepper {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    min-width: 0;
  }

  .stepper.inline {
    display: grid;
    grid-template-columns: var(--touch) minmax(36px, 1fr) var(--touch);
    align-items: center;
    gap: 0;
  }

  .mono-label {
    font-size: 10px;
    letter-spacing: 1px;
    text-align: center;
  }

  .value {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 4px;
    min-width: 0;
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .inline .value {
    font-size: 16px;
  }

  /* Campo e numero mostrato nella stessa cella: si sovrappongono esattamente. */
  .num-wrap {
    display: inline-grid;
    align-items: center;
    min-width: 0;
  }

  .inline .num-wrap {
    width: 100%;
  }

  .num,
  .shown {
    grid-area: 1 / 1;
    text-align: center;
  }

  .num {
    min-width: 0;
    max-width: 100%;
    height: var(--touch);
    padding: 0;
    border: 0;
    border-bottom: 1px dashed transparent;
    border-radius: 0;
    background: transparent;
    /* 16 px o più: sotto, Safari ingrandisce la pagina al tocco. */
    font-family: var(--font-mono);
    font-size: max(16px, 1em);
    font-weight: 700;
    color: transparent;
    caret-color: var(--text);
    appearance: none;
    cursor: text;
  }

  .inline .num {
    width: 100%;
  }

  /* Si capisce che il numero si può toccare: tratteggio leggero sotto. */
  .num:not(:disabled) {
    border-bottom-color: var(--line-strong);
  }

  .editing .num {
    color: var(--text);
    background: var(--bg);
  }

  .num:focus {
    outline: 2px solid var(--tone, var(--progress));
    outline-offset: 0;
  }

  .num:disabled {
    opacity: 0.38;
  }

  .shown {
    display: inline-block;
    pointer-events: none;
  }

  .invalid .shown,
  .invalid .editing .num {
    color: var(--tip);
  }

  .unit {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }

  .buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(var(--touch), 1fr));
    gap: var(--space-1);
  }

  button {
    height: var(--touch);
    padding: 0;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 20px;
    line-height: 1;
    -webkit-touch-callout: none;
  }

  .inline button {
    font-size: 18px;
  }

  button:disabled {
    opacity: 0.38;
    cursor: default;
  }

  .msg {
    grid-column: 1 / -1;
    margin: 0;
    font-size: 12px;
    color: var(--tip);
    text-align: center;
  }

  /* Colonna stretta (tre Stepper in riga): testo e pulsanti uno sotto l'altro. */
  .confirm {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px dashed var(--tip-edge);
    background: var(--tip-tint);
  }

  .confirm-text {
    font-size: 13px;
    color: var(--tip);
    text-align: center;
    overflow-wrap: anywhere;
  }

  .confirm button {
    min-width: 0;
    padding: 0 var(--space-1);
    font-size: 14px;
  }

  .confirm .yes {
    border-color: var(--tip);
    color: var(--tip);
  }
</style>
