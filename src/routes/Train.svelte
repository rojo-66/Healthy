<script lang="ts">
  import { onMount } from 'svelte';
  import { toIsoDate } from '../lib/diet/calc/calendar';
  import TrainScreen from './train/TrainScreen.svelte';

  // "Oggi" decide la settimana e il prossimo allenamento: l'orologio si aggiorna ogni minuto.
  let now = $state(new Date());
  onMount(() => {
    const timer = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(timer);
  });
  const today = $derived(toIsoDate(now));
</script>

<!-- A mezzanotte la schermata si ricrea con la nuova data. -->
{#key today}
  <TrainScreen {now} />
{/key}
