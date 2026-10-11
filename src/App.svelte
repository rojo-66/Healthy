<script lang="ts">
  import InstallBanner from './lib/pwa/InstallBanner.svelte';
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';
</script>

<main>
  <InstallBanner />

  <h1>Healthy</h1>
  <p class="lead">
    <span class="dot training" aria-hidden="true"></span>Allenamento
    <span class="dot food" aria-hidden="true"></span>Alimentazione
  </p>
  <p class="wip">Lavori in corso</p>
</main>

<UpdatePrompt />

<style>
  main {
    min-height: 100dvh;
    padding: calc(24px + var(--safe-top)) calc(16px + var(--safe-right)) calc(96px + var(--safe-bottom))
      calc(16px + var(--safe-left));
  }

  h1 {
    margin: 0 0 8px;
    font-size: 2.6rem;
    line-height: 1;
    transform: rotate(-2deg);
    transform-origin: left;
  }

  .lead {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 24px;
    color: var(--text-2);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot.food {
    margin-left: 10px;
  }

  .training {
    background: var(--training);
  }

  .food {
    background: var(--food);
  }

  .wip {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
</style>
