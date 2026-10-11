<script lang="ts">
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';
  import { route } from './lib/router.svelte';
  import Home from './routes/Home.svelte';

  // Le pagine sono chunk separati: non pesano sull'avvio, ma sono nel precache (funzionano offline).
  const loadShowcase = () => import('./routes/Showcase.svelte');
  const loadDevData = () => import('./routes/DevData.svelte');
  const loadDiet = () => import('./routes/Diet.svelte');
  const loadDietComplete = () => import('./routes/DietComplete.svelte');
  const loadTrain = () => import('./routes/Train.svelte');
  const loadEditor = () => import('./routes/WorkoutEditor.svelte');
  const loadView = () => import('./routes/WorkoutView.svelte');
</script>

{#if route.path === '/showcase'}
  {#await loadShowcase() then { default: Showcase }}
    <Showcase />
  {/await}
{:else if route.path === '/dev-data'}
  {#await loadDevData() then { default: DevData }}
    <DevData />
  {/await}
{:else if route.path === '/dieta'}
  {#await loadDiet() then { default: Diet }}
    <Diet />
  {/await}
{:else if route.path === '/dieta/completa'}
  {#await loadDietComplete() then { default: DietComplete }}
    <DietComplete />
  {/await}
{:else if route.path === '/allena'}
  {#await loadTrain() then { default: Train }}
    <Train />
  {/await}
{:else if route.path === '/allena/editor'}
  {#await loadEditor() then { default: WorkoutEditor }}
    <!-- Ogni navigazione (anche verso un'altra scheda) = un editor nuovo; replaceRoute non lo ricrea. -->
    {#key route.nav}
      <WorkoutEditor query={route.query} />
    {/key}
  {/await}
{:else if route.path === '/allena/vedi'}
  {#await loadView() then { default: WorkoutView }}
    {#key route.nav}
      <WorkoutView id={route.query['id'] ?? ''} />
    {/key}
  {/await}
{:else}
  <Home />
{/if}

<UpdatePrompt />
