<script lang="ts">
  import { onMount } from 'svelte';
  import { toIsoDate } from '../lib/diet/calc/calendar';
  import DietScreen from './diet/DietScreen.svelte';

  // L'orologio decide "oggi" e il pasto del momento: si aggiorna ogni 30 s.
  let now = $state(new Date());
  onMount(() => {
    const timer = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(timer);
  });
  const today = $derived(toIsoDate(now));
</script>

<!-- A mezzanotte la schermata si ricrea: diario e spesa del nuovo giorno/settimana. -->
{#key today}
  <DietScreen {now} />
{/key}
