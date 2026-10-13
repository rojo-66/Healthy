<script lang="ts">
  import { nowClock } from '../lib/clock.svelte';
  import { toIsoDate } from '../lib/diet/calc/calendar';
  import CalendarScreen from './calendar/CalendarScreen.svelte';

  interface Props {
    /** Giorno da aprire (`AAAA-MM-GG`, dall'indirizzo: si valida nella schermata). */
    day: string;
    /** Da dove si arriva (`allena`): il pulsante indietro torna lì. */
    from: string;
  }

  let { day, from }: Props = $props();

  // "Oggi" decide la finestra di 3 settimane: a mezzanotte la schermata si ricrea.
  const clock = nowClock(60_000);
  const today = $derived(toIsoDate(clock.current));
</script>

{#key today}
  <CalendarScreen now={clock.current} {day} {from} />
{/key}
