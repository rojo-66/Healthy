<script lang="ts">
  import { nowClock } from '../lib/clock.svelte';
  import ProfileScreen from './profile/ProfileScreen.svelte';

  // L'ora serve per l'età e per il promemoria del backup (aggiornata ogni minuto e al ritorno in primo piano).
  const clock = nowClock(60_000);
</script>

<ProfileScreen now={clock.current} />
