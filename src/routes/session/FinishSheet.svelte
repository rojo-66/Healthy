<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import type { Cardio } from '../../lib/data/schemas/workouts';
  import RpePicker from './RpePicker.svelte';

  /**
   * "Termina allenamento": avviso sulle serie mancanti (si conclude lo stesso),
   * poi cardio fatto sì/no (se la scheda lo prevede), poi RPE 1–10 e "Concludi".
   */
  interface Props {
    open: boolean;
    missing: number;
    cardio: Cardio | null;
    cardioDone: boolean | null;
    rpe: number | null;
    busy: boolean;
    oncardio: (done: boolean) => void;
    onrpe: (rpe: number) => void;
    onfinish: () => void;
  }

  let { open = $bindable(false), missing, cardio, cardioDone, rpe, busy, oncardio, onrpe, onfinish }: Props = $props();

  let step = $state<'cardio' | 'rpe'>('cardio');
  const hasCardio = $derived(cardio !== null && cardio.minutes > 0);

  // Ogni apertura riparte dal primo passo.
  $effect(() => {
    if (open) step = hasCardio ? 'cardio' : 'rpe';
  });
</script>

<BottomSheet bind:open title="Termina allenamento" tone="training">
  {#if missing > 0}
    <NoteBox title={missing === 1 ? 'Manca 1 serie' : `Mancano ${missing} serie`} mark="!">
      <p class="note">Puoi concludere lo stesso: nel riepilogo risulteranno saltate.</p>
    </NoteBox>
  {/if}

  {#if step === 'cardio' && cardio}
    <div class="step" data-testid="finish-cardio">
      <p class="q">Cardio · {cardio.type} {cardio.minutes}’</p>
      <div class="grid2" role="group" aria-label="Cardio fatto?">
        <Button variant="secondary" tone="training" pressed={cardioDone === true} onclick={() => oncardio(true)}>Fatto</Button>
        <Button variant="secondary" tone="neutral" pressed={cardioDone === false} onclick={() => oncardio(false)}>Non fatto</Button>
      </div>
      <Button tone="training" size="lg" block disabled={cardioDone === null} onclick={() => (step = 'rpe')}>Avanti</Button>
    </div>
  {:else}
    <div class="step" data-testid="finish-rpe">
      <RpePicker value={rpe} onpick={onrpe} />
      <div class="grid-end" class:single={!hasCardio}>
        {#if hasCardio}
          <Button variant="secondary" tone="neutral" onclick={() => (step = 'cardio')}>Indietro</Button>
        {/if}
        <Button tone="training" size="lg" disabled={rpe === null || busy} onclick={onfinish}>Concludi</Button>
      </div>
    </div>
  {/if}
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

  .q {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
  }

  .grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .grid-end {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--space-2);
  }

  .grid-end.single {
    grid-template-columns: 1fr;
  }
</style>
