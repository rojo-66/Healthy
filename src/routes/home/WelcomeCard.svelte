<script lang="ts">
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import { routeHref } from '../../lib/routes';
</script>

<!-- Primo avvio assoluto: niente piano, niente schede. L'avviso di installazione (M0) resta in cima alla Home. -->
<Card tone="food" label="Benvenuto">
  <h2 class="title graffiti">Benvenuto!</h2>
  <p class="text">Healthy unisce dieta e allenamento in una sola giornata. Bastano due passi, e funziona anche senza rete.</p>
  <ol class="steps">
    <li>
      <span class="n mono" aria-hidden="true">1</span>
      <span class="step">
        <b>Importa il piano del nutrizionista</b>
        <span class="hint">Il file JSON di MyDiet o un piano di Healthy.</span>
        <Button tone="food" href="#/dieta">Importa il piano</Button>
      </span>
    </li>
    <li>
      <span class="n mono" aria-hidden="true">2</span>
      <span class="step">
        <b>Crea la tua scheda</b>
        <span class="hint">Esercizi, serie, carichi e giorni della settimana.</span>
        <Button tone="training" href={routeHref('/allena/editor')}>Crea la scheda</Button>
      </span>
    </li>
  </ol>
</Card>

<style>
  .title {
    font-size: 32px;
    color: var(--tone);
  }

  .text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-2);
  }

  .steps {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .steps li {
    display: flex;
    gap: var(--space-3);
  }

  .n {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--line-strong);
    font-weight: 700;
  }

  .step {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    font-size: 15px;
  }

  .hint {
    font-size: 13px;
    color: var(--muted);
  }
</style>
