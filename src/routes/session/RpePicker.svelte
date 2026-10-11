<script lang="ts">
  // Sforzo percepito RPE 1–10 (passo finale della sessione e Riepilogo).
  interface Props {
    value: number | null;
    onpick: (rpe: number) => void;
  }

  let { value, onpick }: Props = $props();
  const id = $props.id();
</script>

<div class="rpe">
  <div class="head">
    <span class="q" id="{id}-q">Quanto è stata dura?</span>
    <span class="mono hint">RPE 1–10</span>
  </div>
  <div class="opts" role="group" aria-labelledby="{id}-q">
    {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as n (n)}
      <button
        type="button"
        class="opt tap mono"
        class:on={value === n}
        aria-pressed={value === n}
        aria-label="Sforzo {n} su 10"
        onclick={() => onpick(n)}
      >
        <span class="fill" aria-hidden="true"></span>
        <span class="n">{n}</span>
      </button>
    {/each}
  </div>
  <div class="ends" aria-hidden="true"><span>passeggiata</span><span>al limite</span></div>
</div>

<style>
  .rpe {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
  }

  .q {
    font-size: 15px;
    font-weight: 700;
  }

  .hint {
    font-size: 12px;
    color: var(--muted);
  }

  .opts {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-1);
  }

  /* Dieci in fila solo se c'è spazio per 44 px ciascuno. */
  @media (min-width: 520px) {
    .opts {
      grid-template-columns: repeat(10, minmax(0, 1fr));
    }
  }

  .opt {
    position: relative;
    height: var(--touch);
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--text);
    font-weight: 700;
    font-size: 14px;
  }

  .opt.on {
    border-color: var(--training);
    color: var(--on-tone);
    box-shadow: 0 0 12px var(--training-glow);
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
    font-size: 11px;
    color: var(--muted);
  }
</style>
