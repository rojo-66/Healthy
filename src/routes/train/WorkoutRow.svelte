<script lang="ts">
  import Icon from '../../lib/components/Icon.svelte';
  import type { Workout } from '../../lib/data/schemas/workouts';
  import { revealDecision, revealOffset } from '../../lib/design/swipe';
  import { trackSwipe } from '../../lib/design/swipe-action';
  import { prefersReducedMotion } from '../../lib/design/transitions';
  import { lastRunLabel, originLabel, weekdaysLabel, workoutMeta } from '../../lib/workouts/format';

  interface Props {
    workout: Workout;
    /** Inizio dell'ultima sessione conclusa (M5), `null` se mai eseguita. */
    lastRun: string | null;
    /** Azioni rivelate dallo swipe a sinistra (una riga aperta per volta: decide il genitore). */
    open?: boolean;
    onopenchange?: (open: boolean) => void;
    onopen: () => void;
    onshare: () => void;
    onduplicate?: () => void;
    ondelete?: () => void;
  }

  let { workout, lastRun, open = false, onopenchange, onopen, onshare, onduplicate, ondelete }: Props = $props();

  let wrap: HTMLDivElement;
  let slide: HTMLDivElement;
  let actions: HTMLDivElement;
  const width = () => actions?.offsetWidth || 160;

  /** Torna alla posizione dello stato (aperta/chiusa) a molla: la decide la classe `.open`. */
  function settle() {
    slide.style.transition = prefersReducedMotion() ? 'none' : 'transform var(--dur-ind) var(--spring)';
    slide.style.transform = '';
  }

  // ← rivela Duplica/Elimina; → la richiude. Lo swipe verso destra a riga chiusa resta alle tab.
  function rowSwipe(node: HTMLElement) {
    return trackSwipe(node, () => ({
      claims: (dir) => !!onopenchange && (dir === 1 || open),
      begin() {
        slide.style.transition = 'none';
      },
      move(dx) {
        if (!prefersReducedMotion()) slide.style.transform = `translateX(${revealOffset(dx, open, width())}px)`;
      },
      end(dx, velocity) {
        const next = revealDecision(revealOffset(dx, open, width()), velocity, width());
        settle();
        if (next !== open) onopenchange?.(next);
      },
      cancel: settle,
    }));
  }

  // Aperta: un tocco fuori dalla riga la richiude.
  $effect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrap.contains(e.target)) onopenchange?.(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  });

  function act(run: (() => void) | undefined) {
    onopenchange?.(false);
    run?.();
  }
</script>

<div class="wrap tone-training" class:open bind:this={wrap} use:rowSwipe data-testid="workout-row">
  <div class="actions" bind:this={actions} inert={!open} aria-hidden={!open || undefined}>
    <button type="button" class="act tap" onclick={() => act(onduplicate)}>Duplica<span class="visually-hidden"> {workout.name}</span></button>
    <button type="button" class="act danger tap" onclick={() => act(ondelete)}>Elimina<span class="visually-hidden"> {workout.name}</span></button>
  </div>
  <div class="row" bind:this={slide}>
    <button
      type="button"
      class="main tap"
      aria-haspopup="dialog"
      aria-label="{workout.name}: {originLabel(workout)}, {workoutMeta(workout)}. Apri le azioni"
      onclick={() => (open ? onopenchange?.(false) : onopen())}
    >
      <span class="title-line">
        <span class="name">{workout.name}</span>
        <span class="src mono" class:pt={workout.source === 'pt'}>{originLabel(workout)}</span>
      </span>
      <span class="meta mono">{workoutMeta(workout)}</span>
      <span class="when">
        <span class="days mono">{weekdaysLabel(workout.weekdays)}</span>
        <span class="last">{lastRunLabel(lastRun)}</span>
      </span>
    </button>
    <button type="button" class="share tap" aria-label="Condividi {workout.name}" onclick={onshare}>
      <Icon name="share" size={18} />
    </button>
  </div>
</div>

<style>
  /* Le azioni stanno dietro la riga, a destra: si vedono quando la riga scorre a sinistra. */
  .wrap {
    --actions-w: 160px;
    position: relative;
    overflow: hidden;
  }

  .actions {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: var(--actions-w);
  }

  .act {
    min-width: var(--touch);
    padding: 0;
    border: 0;
    background: var(--line-strong);
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
  }

  .act.danger {
    background: var(--tip);
    color: var(--on-tone);
  }

  .row {
    position: relative;
    display: flex;
    align-items: stretch;
    background: var(--surface);
  }

  .open .row {
    transform: translateX(calc(-1 * var(--actions-w)));
  }

  .main {
    flex: 1;
    min-width: 0;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
  }

  .title-line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-width: 0;
  }

  .name {
    min-width: 0;
    font-family: var(--font-graffiti);
    font-size: 21px;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .src {
    flex-shrink: 0;
    padding: 1px 6px;
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--muted);
    border: 1px solid var(--line-strong);
  }

  .src.pt {
    color: var(--tip);
    border-color: var(--tip-edge);
  }

  .meta {
    font-size: 12px;
    color: var(--muted);
  }

  .when {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    min-width: 0;
  }

  .days {
    padding: 2px 8px;
    background: var(--bg);
    font-weight: 700;
    color: var(--tone);
    white-space: nowrap;
  }

  .last {
    color: var(--muted);
    white-space: nowrap;
  }

  .share {
    width: 52px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-left: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
  }
</style>
