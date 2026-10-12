<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import type { Tone } from '../../lib/components/types';

  // Funzioni annunciate ma non ancora disponibili (importa, condividi, avvia): si spiega, niente finte azioni.
  interface Props {
    open: boolean;
    title: string;
    text: string;
    /** Riquadro giallo "In arrivo" sotto il testo. */
    soon?: string;
    tone?: Tone;
  }

  let { open = $bindable(false), title, text, soon, tone = 'training' }: Props = $props();
</script>

<BottomSheet bind:open {title} {tone}>
  <p class="text">{text}</p>
  {#if soon}
    <NoteBox title="In arrivo" mark="✦" text={soon} />
  {/if}
  <Button {tone} variant="secondary" block onclick={() => (open = false)}>Ho capito</Button>
</BottomSheet>

<style>
  .text {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-2);
  }
</style>
