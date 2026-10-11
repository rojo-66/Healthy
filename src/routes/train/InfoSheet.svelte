<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';

  // Funzioni annunciate ma non ancora disponibili (importa, condividi, avvia): si spiega, niente finte azioni.
  interface Props {
    open: boolean;
    title: string;
    text: string;
    /** Riquadro giallo "In arrivo" sotto il testo. */
    soon?: string;
  }

  let { open = $bindable(false), title, text, soon }: Props = $props();
</script>

<BottomSheet bind:open {title} tone="training">
  <p class="text">{text}</p>
  {#if soon}
    <NoteBox title="In arrivo" mark="✦" text={soon} />
  {/if}
  <Button tone="training" variant="secondary" block onclick={() => (open = false)}>Ho capito</Button>
</BottomSheet>

<style>
  .text {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-2);
  }
</style>
