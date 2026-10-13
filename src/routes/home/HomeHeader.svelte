<script lang="ts">
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
  import { swipe } from '../../lib/design/swipe-action';
  import { routeHref } from '../../lib/routes';
  import type { DayTypeTone } from '../../lib/diet/view';
  import type { HomeStripDay } from '../../lib/today/home';
  import type { SyncStatus } from '../../lib/today/sync';

  interface Props {
    /** "12 OTT 2026" del giorno mostrato. */
    dateLabel: string;
    sync: SyncStatus;
    weekday: number;
    typeLabel: string;
    typeTone: DayTypeTone;
    /** I 7 giorni della settimana mostrata nella striscia. */
    days: readonly HomeStripDay[];
    /** "Questa settimana", "Settimana scorsa", "Settimana prossima". */
    weekLabel: string;
    /** Settimana precedente o successiva nella finestra di 3 settimane (2c). */
    canWeek: (dir: -1 | 1) => boolean;
    onweek: (dir: -1 | 1) => void;
    selected: string;
    /** Oggi (`AAAA-MM-GG`): "Torna a oggi" funziona anche da un'altra settimana. */
    todayIso: string;
    /** "Ieri", "Domani"… (vuoto se è oggi). */
    relative: string;
    onselect: (date: string) => void;
  }

  let { dateLabel, sync, weekday, typeLabel, typeTone, days, weekLabel, canWeek, onweek, selected, todayIso, relative, onselect }: Props = $props();
  let stripInner = $state<HTMLDivElement>();

  const toneClass = (tone: DayTypeTone) => (tone === 'muted' ? 'tone-neutral' : `tone-${tone}`);

  function aria(d: HomeStripDay): string {
    return `${weekdayName(d.weekday)} ${d.dayNumber}${d.isToday ? ', oggi' : ''}: ${d.typeLabel.toLowerCase()}`;
  }
</script>

<header class="top">
  <!-- Data e stato su una sola riga, mai a capo. -->
  <div class="status-row mono" data-testid="status-row">
    <span class="date">{dateLabel}</span>
    <span class="sync {sync.tone}" data-testid="sync-status" data-kind={sync.kind} title={sync.description}>
      {sync.label}<span class="visually-hidden">: {sync.description}</span>
    </span>
  </div>

  <div class="title-row">
    <h1 class="graffiti day-title {toneClass(typeTone)}">{weekdayName(weekday)}</h1>
    <span class="badge" data-testid="day-type">
      <span class="diamond {typeTone}" aria-hidden="true"></span>{typeLabel}
    </span>
  </div>

  <div class="week-row">
    <button type="button" class="week-arrow tap" aria-label="Settimana precedente" disabled={!canWeek(-1)} onclick={() => onweek(-1)}>‹</button>
    <span class="week-label mono" data-testid="home-week">{weekLabel}</span>
    <button type="button" class="week-arrow tap" aria-label="Settimana successiva" disabled={!canWeek(1)} onclick={() => onweek(1)}>›</button>
    <a class="cal-link tap" href={routeHref('/calendario', { giorno: selected })}>Calendario</a>
  </div>

  <!-- La striscia scorre tra le 3 settimane (scorsa, questa, prossima): la settimana segue il dito. -->
  <div
    class="strip-zone"
    role="group"
    aria-label="Settimana: scorri a destra o a sinistra per cambiarla"
    data-testid="home-strip-swipe"
    use:swipe={{ canGo: canWeek, onswipe: onweek, target: stripInner }}
  >
  <div class="strip" role="group" aria-label="Giorni della settimana" data-testid="home-strip" bind:this={stripInner}>
    {#each days as d (d.date)}
      <button
        type="button"
        class="day tap {toneClass(d.tone)}"
        class:on={d.date === selected}
        class:today={d.isToday}
        aria-pressed={d.date === selected}
        aria-label={aria(d)}
        onclick={() => onselect(d.date)}
      >
        <span class="initial">{d.initial}</span>
        <span class="num mono">{d.dayNumber}</span>
        <span class="diamond small {d.tone}" aria-hidden="true"></span>
      </button>
    {/each}
  </div>
  </div>

  {#if relative}
    <div class="hint-row">
      <span class="hint">{relative} · sola lettura</span>
      <button type="button" class="back tap" onclick={() => onselect(todayIso)}>
        Torna a oggi
      </button>
    </div>
  {:else}
    <span class="hint center">← scorri per ieri e domani →</span>
  {/if}
</header>

<style>
  .top {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    font-size: 12px;
    letter-spacing: 2px;
    white-space: nowrap;
  }

  .date {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--muted);
  }

  .sync {
    flex: none;
    color: var(--muted);
  }
  .sync.progress {
    color: var(--progress);
  }
  .sync.tip {
    color: var(--tip);
  }

  /* Sugli schermi stretti le lettere si avvicinano: la riga non va mai a capo. */
  @media (max-width: 360px) {
    .status-row {
      letter-spacing: 1px;
      font-size: 11px;
    }
  }

  /* Il titolo non va mai a capo: si rimpicciolisce, e se serve il badge scende sotto. */
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .day-title {
    min-width: 0;
    font-size: clamp(36px, 11.5vw, 54px);
    line-height: 1;
    white-space: nowrap;
    color: var(--tone);
    text-shadow: 0 0 18px var(--tone-glow);
    transform: rotate(-3deg);
    transform-origin: left bottom;
  }

  .badge {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 6px;
    padding: 6px 10px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .diamond {
    width: 8px;
    height: 8px;
    flex: none;
    transform: rotate(45deg);
    background: var(--muted);
  }
  .diamond.small {
    width: 6px;
    height: 6px;
  }
  .diamond.training {
    background: var(--training);
  }
  .diamond.progress {
    background: var(--progress);
  }

  .week-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .week-arrow {
    width: var(--touch);
    height: var(--touch);
    flex: none;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--progress);
    font-size: 24px;
    line-height: 1;
  }

  .week-arrow:disabled {
    opacity: 0.25;
  }

  .week-label {
    flex: 1;
    min-width: 0;
    text-align: center;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cal-link {
    flex: none;
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 var(--space-2);
    color: var(--progress);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
  }

  /* La settimana che esce non allarga la pagina; il margine lascia spazio al bagliore del giorno scelto. */
  .strip-zone {
    overflow: hidden;
    padding: 12px 0;
    margin: -12px 0;
    touch-action: pan-y;
  }

  /* Spazio stretto tra i giorni: anche su iPhone SE (375 px) ogni giorno è largo almeno 44 px. */
  .strip {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }

  .day {
    min-width: 0;
    min-height: 56px;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: 0;
    background: var(--surface);
    color: var(--text);
  }

  /* Oggi: contorno ciano (navigazione), dentro così non sfora la griglia. */
  .day.today {
    box-shadow: inset 0 0 0 1px var(--progress);
  }

  /* Selezionato: pieno nel colore del suo tipo di giornata, angoli tagliati come nel mockup. */
  .day.on {
    background: var(--tone);
    color: var(--on-tone);
    box-shadow: 0 0 14px var(--tone-glow);
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  }
  .day.on.tone-neutral {
    background: var(--text-2);
  }
  .on .diamond {
    outline: 1px solid var(--bg);
  }

  .initial {
    font-size: 11px;
    opacity: 0.85;
  }

  .num {
    font-weight: 700;
    font-size: 15px;
  }

  .hint {
    font-size: 12px;
    color: var(--muted);
  }
  .hint.center {
    text-align: center;
  }

  .hint-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .back {
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--progress);
    background: transparent;
    color: var(--progress);
    font-size: 13px;
    font-weight: 700;
  }
</style>
