<script lang="ts">
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';
  import { route } from './lib/router.svelte';
  import Home from './routes/Home.svelte';

  // Le pagine di prova sono chunk separati: non pesano sull'avvio, ma sono nel precache (funzionano offline).
  const loadShowcase = () => import('./routes/Showcase.svelte');
  const loadDevData = () => import('./routes/DevData.svelte');
</script>

{#if route.path === '/showcase'}
  {#await loadShowcase() then { default: Showcase }}
    <Showcase />
  {/await}
{:else if route.path === '/dev-data'}
  {#await loadDevData() then { default: DevData }}
    <DevData />
  {/await}
{:else}
  <Home />
{/if}

<UpdatePrompt />
