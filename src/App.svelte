<script lang="ts">
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';
  import { route } from './lib/router.svelte';

  // Le pagine sono chunk separati: non pesano sull'avvio, ma sono nel precache (funzionano offline).
  // Anche la Home: così Dexie e zod restano fuori dal primo bundle (M2).
  const loadHome = () => import('./routes/Home.svelte');
  const loadShowcase = () => import('./routes/Showcase.svelte');
  const loadDevData = () => import('./routes/DevData.svelte');
  const loadDiet = () => import('./routes/Diet.svelte');
  const loadDietComplete = () => import('./routes/DietComplete.svelte');
  const loadTrain = () => import('./routes/Train.svelte');
  const loadEditor = () => import('./routes/WorkoutEditor.svelte');
  const loadView = () => import('./routes/WorkoutView.svelte');
  const loadReadiness = () => import('./routes/session/Readiness.svelte');
  const loadIntro = () => import('./routes/session/Intro.svelte');
  const loadLive = () => import('./routes/session/Live.svelte');
  const loadSummary = () => import('./routes/session/Summary.svelte');
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
{:else if route.path === '/sessione/readiness'}
  {#await loadReadiness() then { default: Readiness }}
    {#key route.nav}
      <Readiness workoutId={route.query['scheda'] ?? ''} />
    {/key}
  {/await}
{:else if route.path === '/sessione/intro'}
  {#await loadIntro() then { default: Intro }}
    {#key route.nav}
      <Intro workoutId={route.query['scheda'] ?? ''} />
    {/key}
  {/await}
{:else if route.path === '/sessione/live'}
  {#await loadLive() then { default: Live }}
    {#key route.nav}
      <Live id={route.query['id'] ?? ''} />
    {/key}
  {/await}
{:else if route.path === '/sessione/riepilogo'}
  {#await loadSummary() then { default: Summary }}
    {#key route.nav}
      <Summary id={route.query['id'] ?? ''} fromHistory={route.query['da'] === 'storico'} />
    {/key}
  {/await}
{:else}
  {#await loadHome() then { default: Home }}
    <Home />
  {/await}
{/if}

<UpdatePrompt />
