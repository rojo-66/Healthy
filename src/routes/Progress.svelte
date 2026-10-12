<script lang="ts">
  import { nowClock } from '../lib/clock.svelte';
  import ProgressScreen from './progress/ProgressScreen.svelte';

  interface Props {
    /** Tab chiesta dall'indirizzo (`?tab=corpo` dal pulsante Grafici del Profilo). */
    tab: string | null;
  }

  let { tab }: Props = $props();

  // "Oggi" decide la settimana in corso e il giorno escluso dalle medie: si aggiorna anche a mezzanotte.
  const clock = nowClock();
</script>

<ProgressScreen now={clock.current} {tab} />
