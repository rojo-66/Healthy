<script lang="ts">
  import { nowClock } from '../lib/clock.svelte';
  import { toIsoDate } from '../lib/diet/calc/calendar';
  import TrainScreen from './train/TrainScreen.svelte';

  // "Oggi" decide la settimana e il prossimo allenamento (ogni minuto, a mezzanotte e al ritorno in primo piano).
  const clock = nowClock(60_000);
  const today = $derived(toIsoDate(clock.current));
</script>

<!-- A mezzanotte la schermata si ricrea con la nuova data. -->
{#key today}
  <TrainScreen now={clock.current} />
{/key}
