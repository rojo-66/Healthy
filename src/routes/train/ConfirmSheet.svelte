<script lang="ts" module>
  export interface ConfirmAction {
    label: string;
    /** `primary` = azione principale (magenta); `danger` = distruttiva (gialla, colore degli avvisi). */
    kind?: 'primary' | 'secondary' | 'danger';
    run: () => void;
  }
</script>

<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';

  interface Props {
    open: boolean;
    title: string;
    text: string;
    actions: readonly ConfirmAction[];
    /** Chiuso senza scegliere (tocco fuori, ✕, Esc). */
    oncancel?: () => void;
  }

  let { open = $bindable(false), title, text, actions, oncancel }: Props = $props();
  let chosen = false;

  function pick(action: ConfirmAction) {
    chosen = true;
    open = false;
    action.run();
  }

  function closed() {
    if (!chosen) oncancel?.();
    chosen = false;
  }
</script>

<BottomSheet bind:open {title} tone="training" onclose={closed}>
  <p class="text">{text}</p>
  <div class="actions">
    {#each actions as action (action.label)}
      <Button
        block
        variant={action.kind === 'primary' ? 'primary' : 'secondary'}
        tone={action.kind === 'danger' ? 'tip' : action.kind === 'primary' ? 'training' : 'neutral'}
        onclick={() => pick(action)}>{action.label}</Button
      >
    {/each}
  </div>
</BottomSheet>

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
</style>
