<script lang="ts">
  import { nowClock } from '../lib/clock.svelte';
  import { toIsoDate } from '../lib/diet/calc/calendar';
  import DietScreen from './diet/DietScreen.svelte';

  // L'orologio decide "oggi" e il pasto del momento (ogni 30 s, a mezzanotte e al ritorno in primo piano).
  const clock = nowClock();
  const today = $derived(toIsoDate(clock.current));
</script>

<!-- A mezzanotte la schermata si ricrea: diario e spesa del nuovo giorno/settimana. -->
{#key today}
  <DietScreen now={clock.current} />
{/key}
