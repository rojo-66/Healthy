<script lang="ts">
  import { nowClock } from '../lib/clock.svelte';
  import { toIsoDate } from '../lib/diet/calc/calendar';
  import HomeScreen from './home/HomeScreen.svelte';

  // L'orologio decide "oggi", il pasto del momento e gli stati della timeline
  // (ogni 30 s, a mezzanotte e quando l'app torna in primo piano).
  const clock = nowClock();
  const today = $derived(toIsoDate(clock.current));
</script>

<!-- A mezzanotte la Home si ricrea sul nuovo giorno: non resta mai ferma su ieri. -->
{#key today}
  <HomeScreen now={clock.current} />
{/key}
