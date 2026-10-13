<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import RpePicker from './RpePicker.svelte';

  /**
   * "Termina allenamento": avviso sulle serie e sui cardio mancanti (si conclude lo stesso), poi RPE 1–10 e "Concludi".
   * Dal 2a il cardio si segna nel suo esercizio, non più qui.
   */
  interface Props {
    open: boolean;
    missing: number;
    /** Esercizi cardio non segnati come fatti. */
    cardioMissing: number;
    rpe: number | null;
    busy: boolean;
    onrpe: (rpe: number) => void;
    onfinish: () => void;
  }

  let { open = $bindable(false), missing, cardioMissing, rpe, busy, onrpe, onfinish }: Props = $props();

  const warning = $derived(
    [
      missing === 1 ? 'Manca 1 serie' : missing > 1 ? `Mancano ${missing} serie` : '',
      cardioMissing === 1 ? '1 cardio non segnato' : cardioMissing > 1 ? `${cardioMissing} cardio non segnati` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  );
</script>

<BottomSheet bind:open title="Termina allenamento" tone="training">
  {#if warning}
    <NoteBox title={warning} mark="!">
      <p class="note">Puoi concludere lo stesso: nel riepilogo risulteranno non fatti.</p>
    </NoteBox>
  {/if}

  <div class="step" data-testid="finish-rpe">
    <RpePicker value={rpe} onpick={onrpe} />
    <Button tone="training" size="lg" block disabled={rpe === null || busy} onclick={onfinish}>Concludi</Button>
  </div>
</BottomSheet>

<style>
  .note {
    margin: 0;
    font-size: 14px;
  }

  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
</style>
