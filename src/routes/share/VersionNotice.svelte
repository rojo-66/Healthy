<script lang="ts">
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import type { WorkoutImportStatus } from '../../lib/share/import/workout';

  // Cosa succede con la versione in arrivo (SPEC § 8.4): già presente, più vecchia, più nuova, modifiche locali.
  interface Props {
    status: WorkoutImportStatus;
    /** "scheda" o "piano". */
    noun: 'scheda' | 'piano';
    existingName: string;
    existingVersion: number;
    incomingVersion: number;
    /** Versione ricevuta da cui partivano le mie modifiche (solo schede modificate qui). */
    receivedVersion?: number | null;
    localEdits?: boolean;
  }

  let { status, noun, existingName, existingVersion, incomingVersion, receivedVersion = null, localEdits = false }: Props = $props();

  const art = $derived(noun === 'scheda' ? 'la' : 'il');
  const text = $derived.by(() => {
    switch (status) {
      case 'newer':
        return `Hai già «${existingName}» (v${existingVersion}): questa è la v${incomingVersion}, più nuova. Puoi sostituire ${art} tua o salvare questa come copia.`;
      case 'same':
        return `Hai già «${existingName}» nella stessa versione (v${incomingVersion}). Se vuoi, puoi salvarla come copia.`;
      case 'older':
        return `Questa è la v${incomingVersion}, più vecchia di quella che hai (v${existingVersion}). Se vuoi, puoi salvarla come copia.`;
      default:
        return '';
    }
  });
</script>

{#if status !== 'new'}
  <div class="notice" data-testid="version-notice" data-status={status}>
    <NoteBox title={status === 'newer' ? 'Nuova versione' : status === 'same' ? 'Già presente' : 'Versione più vecchia'} mark="!" {text} />
    {#if localEdits}
      <NoteBox
        title="Hai modificato la tua"
        mark="!"
        text={`Dopo averla ricevuta (v${receivedVersion ?? '?'}) hai cambiato «${existingName}» su questo telefono: «Sostituisci» toglie le tue modifiche (ne resta solo una copia nella cronologia, «Ripristina versione precedente»). Per tenerle, salva come copia.`}
      />
    {/if}
  </div>
{/if}

<style>
  .notice {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
