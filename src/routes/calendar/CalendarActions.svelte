<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import UndoToast from '../../lib/components/UndoToast.svelte';
  import { dietImpact, type DietContext } from '../../lib/calendar/days';
  import {
    chooseDay,
    conflictOptions,
    current,
    destinations,
    isComplete,
    isEmptyChange,
    moveChange,
    MoveError,
    resolveConflict,
    restoreChange,
    restoreWeekChange,
    shortDay,
    skipChange,
    startMove,
    summaryLines,
    type CalendarChange,
    type ConflictOption,
    type MoveState,
  } from '../../lib/calendar/move';
  import { buildCalendar, calendarWindow, weekdayOfIso, type CalendarInput, type Occurrence } from '../../lib/calendar/occurrences';
  import { applyCalendarChange, undoCalendarChange } from '../../lib/data/repo/calendar';
  import { ValidationError } from '../../lib/data/errors';
  import type { DayChoice } from '../../lib/data/schemas/calendar';
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { formatInt } from '../../lib/diet/format';
  import { TYPE_WORD, type ResolvedDayType } from '../../lib/today/day-type';

  /**
   * Azioni sul calendario (2c), le stesse da Home, Allena e calendario: Sposta (scelta del giorno, conflitti, catena),
   * Salta, Ripristina, Ripristina la settimana. Prima di scrivere mostra il riepilogo con cosa cambia nella dieta;
   * dopo, un avviso con "Annulla" per qualche secondo. Si usa con `bind:this`.
   */
  interface Props {
    input: CalendarInput;
    diet: DietContext;
  }

  let { input, diet }: Props = $props();

  const win = $derived(calendarWindow(input.todayIso));
  const occurrences = $derived(buildCalendar(win.from, win.to, input).occurrences);

  let toast: UndoToast;
  let error = $state<readonly string[]>([]);

  // --- Menu di un'attività ("Non posso oggi", tocco nel calendario o in Allena) ---
  let menuOpen = $state(false);
  let menuFor = $state.raw<Occurrence | null>(null);

  /** Menu con Sposta, Salta e Ripristina (quelle possibili). */
  export function openMenu(o: Occurrence): void {
    menuFor = o;
    menuOpen = true;
  }

  // --- Sposta: giorno → conflitto → (catena) → riepilogo ---
  type Step = 'day' | 'conflict' | 'summary';
  let moveOpen = $state(false);
  let step = $state<Step>('day');
  let flow = $state.raw<MoveState | null>(null);
  let pending = $state.raw<{ title: string; lines: string[]; change: CalendarChange; done: string } | null>(null);

  export function move(o: Occurrence): void {
    menuOpen = false;
    error = [];
    try {
      flow = startMove(occurrences, o.key, input.todayIso);
      step = 'day';
      pending = null;
      moveOpen = true;
    } catch (e) {
      toast.show(e instanceof MoveError ? e.message : 'Non si può spostare.');
    }
  }

  /** Desinenza: la corsa è femminile ("saltata"), l'allenamento maschile ("saltato"). */
  const end = (o: Occurrence) => (o.kind === 'run' ? 'a' : 'o');

  export function skip(o: Occurrence): void {
    menuOpen = false;
    const word = `saltat${end(o)}`;
    confirm(`Salta ${o.name}`, [`${o.name} ${word} (${shortDay(o.date)})`], skipChange(o), `${o.name} ${word}`);
  }

  export function restore(o: Occurrence): void {
    menuOpen = false;
    confirm(
      `Ripristina ${o.name}`,
      [`${o.name} torna a ${shortDay(o.originalDate)}, come nel piano`],
      restoreChange(o),
      `${o.name} ripristinat${end(o)}`,
    );
  }

  /** "Ripristina la settimana" del lunedì indicato. */
  export function restoreWeek(monday: string, edits: CalendarInput['edits'], choices: readonly DayChoice[]): void {
    const change = restoreWeekChange(monday, edits, occurrences, choices);
    if (isEmptyChange(change)) {
      toast.show('Questa settimana è già come nel piano.');
      return;
    }
    const n = change.remove.length;
    const lines = [
      n > 0 ? `${n} ${n === 1 ? 'attività torna' : 'attività tornano'} come nel piano` : '',
      change.choicesRemove.length > 0 ? 'Le diete scelte tornano a palestra' : '',
    ].filter(Boolean);
    confirm(`Ripristina la settimana del ${shortDay(monday)}`, lines, change, 'Settimana ripristinata');
  }

  function confirm(title: string, lines: string[], change: CalendarChange, done: string) {
    error = [];
    flow = null;
    pending = { title, lines, change, done };
    step = 'summary';
    moveOpen = true;
  }

  function pickDay(date: string) {
    if (!flow) return;
    flow = chooseDay(flow, date);
    if (flow.conflict) step = 'conflict';
    else if (isComplete(flow)) toSummary();
  }

  function pickOption(option: ConflictOption) {
    if (!flow) return;
    flow = resolveConflict(flow, option);
    if (isComplete(flow)) toSummary();
    else step = 'day';
  }

  function toSummary() {
    if (!flow) return;
    const first = flow.occurrences.find((o) => o.key === flow!.placements[0]?.key);
    pending = { title: `Sposta ${first?.name ?? ''}`.trim(), lines: summaryLines(flow), change: moveChange(flow), done: 'Spostamenti salvati' };
    step = 'summary';
  }

  const word = (t: ResolvedDayType) => (Object.hasOwn(TYPE_WORD, t.key) ? TYPE_WORD[t.key] : t.label.toLowerCase());
  const impact = $derived(pending && diet.plan ? dietImpact(pending.change, input, diet) : []);

  function impactLine(i: (typeof impact)[number]): string {
    const kcal = i.kcalFrom !== null && i.kcalTo !== null && i.kcalFrom !== i.kcalTo ? ` (${formatInt(i.kcalFrom)} → ${formatInt(i.kcalTo)} kcal)` : '';
    return `${i.day}: ${word(i.from)} → ${word(i.to)}${kcal}`;
  }

  async function save() {
    if (!pending) return;
    const { change, done } = pending;
    error = [];
    try {
      const undo = await applyCalendarChange(change);
      moveOpen = false;
      toast.show(done, () => undoCalendarChange(undo));
    } catch (e) {
      error = e instanceof ValidationError ? e.errors : ['Non sono riuscito a salvare: riprova.'];
    }
  }

  function closed() {
    flow = null;
    pending = null;
    step = 'day';
  }

  const now = $derived(flow ? current(flow) : null);
  const days = $derived(flow ? destinations(flow) : []);
  const options = $derived(flow ? conflictOptions(flow) : []);
  const others = $derived(flow?.conflict ? flow.conflict.others.map((k) => occurrences.find((o) => o.key === k)?.name ?? '') : []);

  function dayAria(d: (typeof days)[number]): string {
    const what = d.busy.length > 0 ? `c'è ${d.busy.join(' e ')}` : 'libero';
    return `${weekdayName(weekdayOfIso(d.date))} ${shortDay(d.date).split(' ')[1]}: ${d.reason || what}`;
  }

  const sheetTitle = $derived(
    step === 'summary'
      ? (pending?.title ?? '')
      : step === 'conflict' && flow?.conflict
        ? `${shortDay(flow.conflict.date)} è già occupato`
        : now
          ? `Sposta ${now.name}`
          : '',
  );

  const canMove = (o: Occurrence) => (o.status === 'todo' || o.status === 'missed') && o.date >= win.from;
</script>

<BottomSheet bind:open={menuOpen} title={menuFor?.name ?? ''} tone={menuFor?.kind === 'run' ? 'progress' : 'training'}>
  {#if menuFor}
    {@const o = menuFor}
    <p class="text">
      {o.kind === 'run' ? 'Corsa' : 'Allenamento'} di {weekdayName(weekdayOfIso(o.date)).toLowerCase()} {shortDay(o.date).split(' ')[1]}{o.moved
        ? `, spostat${end(o)} da ${shortDay(o.originalDate)}`
        : ''}{o.skipped ? ` · saltat${end(o)}` : ''}. Lo spostamento vale solo per questa data: la {o.kind === 'run' ? 'corsa' : 'scheda'} non cambia.
    </p>
    <div class="actions">
      {#if canMove(o) && !o.skipped}
        <Button block tone={o.kind === 'run' ? 'progress' : 'training'} onclick={() => move(o)}>Sposta</Button>
        <Button block variant="secondary" onclick={() => skip(o)}>Salta</Button>
      {/if}
      {#if o.moved || o.skipped}
        <Button block variant="secondary" onclick={() => restore(o)}>Ripristina</Button>
      {/if}
      {#if !(canMove(o) && !o.skipped) && !(o.moved || o.skipped)}
        <p class="text">{o.status === 'done' ? 'Già fatta: resta nel giorno in cui l’hai fatta.' : 'Non si può più spostare.'}</p>
      {/if}
    </div>
  {/if}
</BottomSheet>

<BottomSheet bind:open={moveOpen} title={sheetTitle} tone="progress" onclose={closed}>
  {#if step === 'day' && now}
    <p class="text">
      Scegli il giorno per <b>{now.name}</b>{now.date < input.todayIso ? ` (recupero di ${shortDay(now.date)})` : ''}: da oggi a domenica
      prossima.
    </p>
    <div class="days" role="group" aria-label="Giorni possibili" data-testid="move-days">
      {#each days as d (d.date)}
        <button
          type="button"
          class="day tap"
          class:busy={d.busy.length > 0}
          disabled={d.disabled}
          aria-label={dayAria(d)}
          onclick={() => pickDay(d.date)}
        >
          <span class="dw">{shortDay(d.date).split(' ')[0]}</span>
          <span class="dn mono">{shortDay(d.date).split(' ')[1]}</span>
          <span class="dot" aria-hidden="true">{d.disabled ? (d.reason === 'giorno di partenza' ? '●' : '×') : d.busy.length > 0 ? '◆' : ''}</span>
        </button>
      {/each}
    </div>
    <p class="legend mono">● partenza · ◆ già occupato · × già usato</p>
  {:else if step === 'conflict' && flow?.conflict && now}
    <p class="text">
      {shortDay(flow.conflict.date)} c'è già <b>{others.join(' e ')}</b>. Cosa fai con {others.length > 1 ? 'le altre' : "l'altra"}?
    </p>
    <div class="actions" data-testid="conflict-options">
      {#each options as o (o.option)}
        <div class="opt">
          <Button
            block
            variant={o.option === 'cancel' ? 'ghost' : 'secondary'}
            tone={o.option === 'cancel' ? 'neutral' : 'progress'}
            disabled={o.disabled}
            onclick={() => pickOption(o.option)}>{o.label}</Button
          >
          {#if o.disabled && o.reason}<span class="why">{o.reason}</span>{/if}
        </div>
      {/each}
    </div>
  {:else if step === 'summary' && pending}
    <ul class="lines" data-testid="move-summary">
      {#each pending.lines as line (line)}
        <li>{line}</li>
      {/each}
    </ul>
    {#if impact.length > 0}
      <NoteBox title="Cambia la dieta" mark="!">
        <ul class="lines diet" data-testid="diet-impact">
          {#each impact as i (i.date)}
            <li>{impactLine(i)}{i.keepsTicked ? ' · i pasti già segnati restano' : ''}</li>
          {/each}
        </ul>
      </NoteBox>
    {/if}
    {#if error.length > 0}
      <NoteBox title="Non salvato" mark="!" text={error.join('\n')} />
    {/if}
    <div class="grid2">
      <Button variant="ghost" onclick={() => (moveOpen = false)}>Annulla</Button>
      <Button tone="progress" onclick={() => void save()}>Conferma</Button>
    </div>
  {/if}
</BottomSheet>

<UndoToast bind:this={toast} />

<style>
  .text {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-2);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .opt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .why {
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }

  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }

  .day {
    min-width: 0;
    min-height: 56px;
    padding: 4px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--line);
  }

  .day.busy {
    border-color: var(--training);
  }

  .day:disabled {
    opacity: 0.4;
    border-style: dashed;
  }

  .dw {
    font-size: 11px;
    color: var(--muted);
  }

  .dn {
    font-weight: 700;
    font-size: 15px;
  }

  .dot {
    font-size: 10px;
    min-height: 12px;
    color: var(--training);
  }

  .legend {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }

  .lines {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 15px;
  }

  .lines.diet {
    font-size: 14px;
  }

  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
</style>
