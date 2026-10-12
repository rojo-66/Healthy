<script lang="ts">
  import Icon from '../../lib/components/Icon.svelte';
  import type { Goal } from '../../lib/data/schemas/profile';
  import { formatDecimal } from '../../lib/diet/format';
  import { longDate } from '../../lib/profile/format';
  import { goalLabel } from '../../lib/profile/goals';

  interface Props {
    name: string;
    /** Data dell'ultima misura (`null` = nessuna misura). */
    lastDate: string | null;
    age: number | null;
    heightCm: number | null;
    goal: Goal | null;
    onedit: () => void;
  }

  let { name, lastDate, age, heightCm, goal, onedit }: Props = $props();

  const title = $derived(name.trim() || 'Profilo');
  // Il nome resta su una riga: più è lungo, più si rimpicciolisce (tra 28 e 54 px).
  const titleSize = $derived(Math.max(28, Math.min(54, Math.floor(250 / (Math.max(1, title.length) * 0.56)))));
  const goalText = $derived(goalLabel(goal));
  const facts = $derived(
    [age !== null ? `${age} anni` : null, heightCm !== null ? `${formatDecimal(heightCm, 1, true)} cm` : null].filter(
      (s): s is string => s !== null,
    ),
  );
</script>

<header class="top">
  <div class="status mono">{lastDate ? `ULTIMA MISURA ${longDate(lastDate)}` : 'NESSUNA MISURA'}</div>

  <div class="title-row">
    <h1 class="graffiti name" style:font-size="{titleSize}px" data-testid="profile-name">{title}</h1>
    <button
      type="button"
      class="badge tap"
      class:missing={!goalText}
      data-testid="goal-badge"
      aria-label={goalText ? `Obiettivo: ${goalText}. Modifica il profilo` : 'Scegli l’obiettivo'}
      onclick={onedit}
    >
      {goalText ?? 'Scegli obiettivo'}
    </button>
  </div>

  <button type="button" class="facts tap" onclick={onedit} data-testid="profile-facts">
    <span>
      {#if facts.length > 0}
        {facts.join(' · ')}{#if facts.length < 2}<span class="ask"> · completa il profilo</span>{/if}
      {:else}
        <span class="ask">Età e altezza mancanti · completa il profilo</span>
      {/if}
    </span>
    <Icon name="edit" size={18} />
    <span class="visually-hidden">Modifica il profilo</span>
  </button>
</header>

<style>
  .top {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .status {
    font-size: 12px;
    letter-spacing: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--muted);
  }

  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .name {
    min-width: 0;
    max-width: 100%;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--progress);
    text-shadow: 0 0 18px var(--progress-glow);
    transform: rotate(-3deg);
    transform-origin: left bottom;
  }

  /* Badge come nel mockup: pieno ciano con angoli tagliati; giallo a contorno se manca l'obiettivo. */
  .badge {
    flex: none;
    min-height: var(--touch);
    margin-bottom: 0;
    padding: 0 12px;
    border: 0;
    background: var(--progress);
    color: var(--on-tone);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
    clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  }

  .badge.missing {
    background: transparent;
    color: var(--tip);
    box-shadow: inset 0 0 0 1px var(--tip-edge);
  }

  .facts {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch);
    padding: 0;
    border: 0;
    background: none;
    font-size: 14px;
    text-align: left;
    color: var(--text-2);
  }

  .facts :global(svg) {
    flex: none;
    color: var(--progress);
  }

  .ask {
    color: var(--tip);
  }
</style>
