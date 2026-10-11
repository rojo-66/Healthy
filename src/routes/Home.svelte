<script lang="ts">
  import InstallBanner from '../lib/pwa/InstallBanner.svelte';
  import Screen from './Screen.svelte';
</script>

<!-- Home provvisoria: la Home "Oggi" vera arriva in M6 (e con lei sparisce il link alla pagina di prova). -->
<Screen nav="oggi">
  <main>
    <InstallBanner />

    <h1 class="graffiti">Healthy</h1>
    <p class="lead">
      <span class="dot training" aria-hidden="true"></span>Allenamento
      <span class="dot food" aria-hidden="true"></span>Alimentazione
    </p>
    <p class="wip mono-label">Lavori in corso</p>
    <a class="showcase tap" href="#/showcase">Componenti (prova)</a>
  </main>
</Screen>

<style>
  main {
    padding: calc(24px + var(--safe-top)) calc(16px + var(--safe-right)) var(--space-8) calc(16px + var(--safe-left));
  }

  h1 {
    margin-bottom: var(--space-2);
    font-size: 2.6rem;
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
    margin: 0 0 var(--space-4);
    font-size: 0.85rem;
  }

  .showcase {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 var(--space-4);
    border: 1px solid var(--progress);
    color: var(--progress);
    font-weight: 700;
    text-decoration: none;
  }
</style>
