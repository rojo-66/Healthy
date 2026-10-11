<script lang="ts">
  import { weekdayName } from '../../lib/data/schemas/diet-payload';
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
    /** "Oggi segui il piano di mercoledì" (vuoto senza scambio). */
    swapText: string;
    days: readonly HomeStripDay[];
    selected: string;
    /** "Ieri", "Domani"… (vuoto se è oggi). */
    relative: string;
    onselect: (date: string) => void;
  }

  let { dateLabel, sync, weekday, typeLabel, typeTone, swapText, days, selected, relative, onselect }: Props = $props();

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

  {#if swapText}
    <a class="swap tap" href="#/dieta">⇄ {swapText} · <span class="link">cambia in Dieta</span></a>
  {/if}

  <div class="strip" role="group" aria-label="Giorni della settimana" data-testid="home-strip">
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

  {#if relative}
    <div class="hint-row">
      <span class="hint">{relative} · sola lettura</span>
      <button type="button" class="back tap" onclick={() => onselect(days.find((d) => d.isToday)?.date ?? selected)}>
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

  .swap {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    font-size: 13px;
    color: var(--text-2);
    text-decoration: none;
  }

  .swap .link {
    margin-left: 0.3em;
    color: var(--progress);
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
