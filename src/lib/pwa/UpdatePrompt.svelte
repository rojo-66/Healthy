<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import Button from '../components/Button.svelte';
  import { viewport } from '../design/viewport.svelte';
  import { route } from '../router.svelte';
  import { updateDeferred } from './update-guard';

  // Aggiornamento a richiesta: ricarica solo toccando "Aggiorna", mai da solo (SPEC § 2).
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Su iPhone l'app installata resta aperta a lungo: ricontrolla quando torna in primo piano.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void registration.update();
      });
    },
  });

  // I pannelli (dialog nativi) non hanno uno stato globale: con un aggiornamento in attesa si controlla spesso.
  let dialogOpen = $state(false);
  $effect(() => {
    if (!$needRefresh) return;
    const check = () => (dialogOpen = document.querySelector('dialog[open]') !== null);
    check();
    const timer = setInterval(check, 500);
    return () => clearInterval(timer);
  });

  // Durante una sessione live o con un modulo aperto il banner aspetta: ricompare su una schermata normale.
  const deferred = $derived(updateDeferred({ path: route.path, dialogOpen, keyboardOpen: viewport.keyboardOpen }));
</script>

{#if $needRefresh && !deferred}
  <div class="update rise" role="status">
    <span>Nuova versione disponibile</span>
    <Button tone="tip" size="sm" onclick={() => updateServiceWorker(true)}>Aggiorna</Button>
  </div>
{/if}

<style>
  /* Sopra la barra di navigazione, senza coprirla. */
  .update {
    position: fixed;
    left: calc(16px + var(--safe-left));
    right: calc(16px + var(--safe-right));
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 8px);
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
