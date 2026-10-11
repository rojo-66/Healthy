<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import Button from '../components/Button.svelte';

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Su iPhone l'app installata resta aperta a lungo: ricontrolla quando torna in primo piano.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void registration.update();
      });
    },
  });
</script>

{#if $needRefresh}
  <div class="update rise" role="status">
    <span>Nuova versione disponibile</span>
    <Button tone="tip" size="sm" onclick={() => updateServiceWorker(true)}>Aggiorna</Button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    left: calc(16px + var(--safe-left));
    right: calc(16px + var(--safe-right));
    bottom: calc(16px + var(--safe-bottom));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 8px 8px 16px;
    background: var(--surface);
    border: 1px solid var(--tip);
    color: var(--text);
    z-index: var(--z-toast);
  }
</style>
