<script lang="ts">
  import type { ReadinessItem } from '../../lib/sessions/readiness';

  interface Props {
    item: ReadinessItem;
    value: number | undefined;
    onpick: (value: number) => void;
  }

  let { item, value, onpick }: Props = $props();
  const id = $props.id();
</script>

<fieldset class="q" aria-labelledby="{id}-label">
  <div class="head">
    <span class="label" id="{id}-label">{item.label}</span>
    <span class="value mono" aria-hidden="true">{value ? `${value}/5` : '—'}</span>
  </div>
  <div class="opts">
    {#each [1, 2, 3, 4, 5] as n (n)}
      <button
        type="button"
        class="opt tap mono"
        class:on={value === n}
        class:below={value !== undefined && n < value}
        aria-pressed={value === n}
        aria-label="{item.label}: {n} su 5"
        onclick={() => onpick(n)}
      >
        <!-- Riempimento a molla (scale), mai un colore animato. -->
        <span class="fill" aria-hidden="true"></span>
        <span class="n">{n}</span>
      </button>
    {/each}
  </div>
  <div class="ends" aria-hidden="true">
    <span>1 · {item.low}</span><span>{item.high} · 5</span>
  </div>
</fieldset>

<style>
  .q {
    margin: 0;
    padding: 14px;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--surface);
    clip-path: polygon(
      var(--cut-m) 0,
      100% 0,
      100% calc(100% - var(--cut-m)),
      calc(100% - var(--cut-m)) 100%,
      0 100%,
      0 var(--cut-m)
    );
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .label {
    font-size: 16px;
    font-weight: 700;
  }

  .value {
    font-size: 13px;
    color: var(--training);
  }

  .opts {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }

  .opt {
    position: relative;
    height: 48px;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--text);
    font-weight: 700;
    font-size: 17px;
  }

  .opt.below {
    border-color: var(--training-edge);
    background: var(--training-tint);
  }

  .opt.on {
    border-color: var(--training);
    color: var(--on-tone);
    box-shadow: 0 0 14px var(--training-glow);
  }

  .fill {
    position: absolute;
    inset: 0;
    background: var(--training);
    transform: scale(0);
    opacity: 0;
    transition:
      transform var(--dur-ind) var(--spring),
      opacity var(--dur-press) ease;
  }

  .on .fill {
    transform: scale(1);
    opacity: 1;
  }

  .n {
    position: relative;
  }

  .ends {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: 11px;
    color: var(--muted);
  }
</style>
