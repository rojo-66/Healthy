<script lang="ts">
  import { isIos, isStandalone } from './standalone';

  // Stato solo in memoria: l'avviso ricompare a ogni nuova apertura in Safari.
  let dismissed = $state(false);
  const visible = !isStandalone(window);
  const ios = isIos(navigator);
</script>

{#if visible && !dismissed}
  <aside class="banner" role="note" aria-labelledby="install-title">
    <h2 id="install-title">Aggiungi alla schermata Home prima di inserire dati</h2>
    {#if ios}
      <p>
        Su iPhone Safari e l'app installata hanno <strong>memorie separate</strong>: quello che salvi qui
        non si ritrova nell'app.
      </p>
      <ol>
        <li>
          Tocca <span class="share">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5v10h14V11h-1"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <strong>Condividi</strong> nella barra di Safari.
        </li>
        <li>Scegli <strong>Aggiungi alla schermata Home</strong>.</li>
        <li>Apri Healthy dall'icona: funziona anche offline.</li>
      </ol>
    {:else}
      <p>
        Installa l'app dal menu del browser (<strong>Installa app</strong> o
        <strong>Aggiungi alla schermata Home</strong>): i dati salvati nel browser e quelli dell'app
        installata possono essere separati.
      </p>
    {/if}
    <button type="button" class="tap" onclick={() => (dismissed = true)}>Ho capito</button>
  </aside>
{/if}

<style>
  .banner {
    margin: 0 0 24px;
    padding: 16px 16px 14px;
    border: 2px dashed var(--tip);
    background: color-mix(in srgb, var(--tip) 8%, var(--bg));
    color: var(--text);
    animation: rise 0.35s var(--spring) both;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 1.05rem;
    line-height: 1.3;
    color: var(--tip);
  }

  p {
    margin: 0 0 10px;
    color: var(--text-2);
    font-size: 0.95rem;
  }

  ol {
    margin: 0 0 14px;
    padding-left: 1.3em;
    font-size: 0.95rem;
  }

  li + li {
    margin-top: 4px;
  }

  .share {
    display: inline-flex;
    vertical-align: -3px;
    color: var(--progress);
  }

  button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 20px;
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
      transform: translateY(12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .banner {
      animation: none;
    }
    .tap,
    .tap:active {
      transition: none;
    }
  }
</style>
