<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

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
  <div class="update" role="status">
    <span>Nuova versione disponibile</span>
    <button type="button" class="tap" onclick={() => updateServiceWorker(true)}>Aggiorna</button>
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
    animation: rise 0.35s var(--spring) both;
  }

  button {
    min-height: 44px;
    padding: 0 18px;
    border: 0;
    background: var(--tip);
    color: var(--bg);
    font-weight: 700;
    cursor: pointer;
  }

  .tap {
    transition: transform 0.25s var(--spring);
  }

  .tap:active {
    transform: scale(0.94);
    transition-duration: 0.08s;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .update {
      animation: none;
    }
    .tap,
    .tap:active {
      transition: none;
    }
  }
</style>
