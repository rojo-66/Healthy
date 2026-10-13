<script lang="ts">
  import { flip } from 'svelte/animate';
  import { prefersReducedMotion } from '../../lib/design/transitions';
  import type { TimelineItem, TimelineState } from '../../lib/today/timeline';

  interface Props {
    items: readonly TimelineItem[];
  }

  let { items }: Props = $props();

  const STATE_TEXT: Readonly<Record<TimelineState, string>> = {
    done: 'fatto',
    now: 'adesso',
    next: 'dopo',
    missed: 'non segnato',
    skipped: 'non serve oggi',
  };

  const flipMs = () => (prefersReducedMotion() ? 0 : 300);
</script>

<section class="timeline" aria-labelledby="timeline-title" data-testid="timeline">
  <h3 id="timeline-title" class="mono-label">La tua giornata</h3>
  <ol>
    <!-- Chiavi stabili: aggiornando gli stati le righe si spostano (FLIP, solo transform), mai doppioni. -->
    {#each items as t (t.id)}
      <li class="row {t.state} {t.kind}" animate:flip={{ duration: flipMs() }} data-state={t.state}>
        <span class="rail" aria-hidden="true">
          <span class="dot"></span>
          <span class="line"></span>
        </span>
        <span class="body">
          <span class="label">{t.label}<span class="visually-hidden">, {STATE_TEXT[t.state]}</span></span>
          {#if t.time}<span class="time mono">{t.time}</span>{/if}
        </span>
      </li>
    {/each}
  </ol>
</section>

<style>
  .timeline h3 {
    margin: 0 0 10px;
    font-size: 12px;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    gap: 12px;
    align-items: stretch;
  }

  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    flex: none;
  }

  .dot {
    width: 12px;
    height: 12px;
    margin-top: 3px;
    flex: none;
    background: var(--progress);
    transform: rotate(45deg) scale(1);
    transition:
      transform var(--dur-ind) var(--spring),
      opacity var(--dur-fade) ease;
  }

  .line {
    width: 2px;
    flex: 1;
    background: var(--line);
  }

  .row:last-child .line {
    opacity: 0;
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: 14px;
    font-size: 14px;
  }

  .label {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--text-2);
  }

  .time {
    flex: none;
    font-size: 13px;
    color: var(--muted);
  }

  /* Stati: il colore cambia subito, il rombo cambia scala con transform (molla). */
  .workout .dot {
    background: var(--training);
  }
  .now .dot {
    background: var(--food);
    box-shadow: 0 0 10px var(--food);
    transform: rotate(45deg) scale(1.2);
  }
  .now.workout .dot {
    background: var(--training);
    box-shadow: 0 0 10px var(--training);
  }
  /* Corsa (2a): ciano. */
  .run .dot {
    background: var(--progress);
  }
  .now.run .dot {
    background: var(--progress);
    box-shadow: 0 0 10px var(--progress);
  }
  .now .label {
    color: var(--text);
    font-weight: 700;
  }
  .done .dot,
  .skipped .dot {
    background: var(--line-strong);
    box-shadow: none;
    transform: rotate(45deg) scale(0.85);
  }
  .done .label,
  .skipped .label {
    color: var(--muted);
    text-decoration: line-through;
  }
  .missed .dot {
    background: transparent;
    box-shadow: inset 0 0 0 2px var(--line-strong);
  }
  .missed .label {
    color: var(--muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      transition: none;
    }
  }
</style>
