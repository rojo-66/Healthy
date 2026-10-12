<script lang="ts">
  import { onMount } from 'svelte';
  import BottomBanner from '../lib/components/BottomBanner.svelte';
  import BottomNav, { type NavId } from '../lib/components/BottomNav.svelte';
  import BottomSheet from '../lib/components/BottomSheet.svelte';
  import Button from '../lib/components/Button.svelte';
  import Card from '../lib/components/Card.svelte';
  import CheckButton from '../lib/components/CheckButton.svelte';
  import Icon from '../lib/components/Icon.svelte';
  import NoteBox from '../lib/components/NoteBox.svelte';
  import ProgressBar from '../lib/components/ProgressBar.svelte';
  import ProgressRing from '../lib/components/ProgressRing.svelte';
  import Stepper from '../lib/components/Stepper.svelte';
  import Tabs from '../lib/components/Tabs.svelte';
  import TopBanner from '../lib/components/TopBanner.svelte';
  import { formatClock } from '../lib/components/time';
  import type { Tone } from '../lib/components/types';
  import { drop, fade, pop, rise } from '../lib/design/transitions';
  import BarChart from '../lib/charts/BarChart.svelte';
  import DivergingBars from '../lib/charts/DivergingBars.svelte';
  import Legend from '../lib/charts/Legend.svelte';
  import LineChart from '../lib/charts/LineChart.svelte';
  import MiniLine from '../lib/charts/MiniLine.svelte';
  import { formatDecimal } from '../lib/diet/format';

  // Pagina di prova del design system (M1): dati finti, nessun salvataggio.
  const TONES: readonly { tone: Tone; name: string }[] = [
    { tone: 'training', name: 'Allenamento' },
    { tone: 'food', name: 'Alimentazione' },
    { tone: 'progress', name: 'Progressi' },
    { tone: 'tip', name: 'Consigli' },
  ];

  const COLORS = [
    ['--bg', '#12141a', 'sfondo'],
    ['--surface', '#1b1e27', 'card'],
    ['--line', '#2c3040', 'bordi, tracce'],
    ['--line-strong', '#3a3f52', 'bordi secondari'],
    ['--text', '#ece8df', 'testo'],
    ['--text-2', '#c9c5d3', 'testo secondario'],
    ['--muted', '#a9a6b5', 'etichette'],
    ['--training', '#f0559f', 'allenamento'],
    ['--food', '#a9e34b', 'alimentazione'],
    ['--progress', '#4cc9e6', 'progressi, navigazione'],
    ['--tip', '#f2c94c', 'consigli, note'],
    ['--partial', '#5a2a45', 'parte non fatta'],
    ['--data-alt', '#8a7fa8', 'seconda serie di un dato (FM)'],
    ['--fat', '#9d7bf0', 'massa grassa nei grafici'],
    ['--heat-low', '#2c3a20', 'pasti segnati: meno di 60 %'],
    ['--heat-60', '#6b9a33', 'pasti segnati: 60 %'],
    ['--heat-80', '#86b83c', 'pasti segnati: 80 %'],
  ] as const;

  // Tabs
  const TABS_TRAINING = [
    { id: 'schede', label: 'Schede' },
    { id: 'storico', label: 'Storico' },
  ] as const;
  const TABS_FOOD = [
    { id: 'piano', label: 'Piano' },
    { id: 'spesa', label: 'Spesa' },
    { id: 'ricette', label: 'Ricette' },
  ] as const;
  let tabTraining = $state<'schede' | 'storico'>('schede');
  let tabFood = $state<'piano' | 'spesa' | 'ricette'>('piano');

  // Grafici (M9): dati finti
  const LINE_DATES = ['2026-08-21', '2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25', '2026-10-02'];
  const LINE = [87.5, 87.9, 87.6, 88.3, 88, 88.6, 88.9].map((value, i) => ({ date: LINE_DATES[i] ?? '', value }));
  const kgText = (v: number) => formatDecimal(v, 1);
  const kgDelta = (d: number) => `${d > 0 ? '▲ +' : d < 0 ? '▼ −' : '■ '}${formatDecimal(Math.abs(d), 1)} kg`;
  const BARS = [2, 3, 3, 0, 3, 2].map((value, i) => ({ key: String(i), label: String(i + 1), value, partial: i === 5 }));
  const barTip = (i: number) => ({ title: `settimana ${i + 1}`, value: `${BARS[i]?.value ?? 0} su 3` });
  const DIV = [-2, 3, -8, 1, 9, -3].map((pct, i) => ({
    key: String(i),
    label: String(i + 1),
    pct,
    out: Math.abs(pct) >= 5,
    tip: { title: `giorno ${i + 1}`, value: `${pct} %` },
  }));

  // Stepper
  let sets = $state(4);
  let reps = $state(10);
  let kg = $state(72.5);
  let maxed = $state(10);

  // Spunte
  let checkA = $state(false);
  let checkB = $state(true);
  let checkC = $state(false);
  let checkD = $state(true);

  // Anelli e barre
  let eaten = $state(577);
  let shop = $state(7);

  // Pannelli dal basso
  let sheetRest = $state(false);
  let sheetPlan = $state(false);

  // Sessione finta nella cornice
  let title = $state('Petto + Schiena');
  let elapsed = $state(1934);
  let rest = $state(74);
  let restTotal = $state(90);
  let paused = $state(false);
  let exercise = $state(1);
  const segments = [
    { done: 4, total: 4 },
    { done: 2, total: 4 },
    { done: 0, total: 3 },
    { done: 0, total: 3 },
    { done: 0, total: 3 },
    { done: 0, total: 3 },
  ];

  onMount(() => {
    const timer = setInterval(() => {
      elapsed += 1;
      if (!paused && rest > 0) rest -= 1;
    }, 1000);
    return () => clearInterval(timer);
  });

  function startRest(sec: number) {
    rest = sec;
    restTotal = sec;
    paused = false;
  }

  // Navigazione
  let navActive = $state<NavId>('allena');

  // Animazioni
  let replay = $state(0);
</script>

<div class="page">
  <header class="top">
    <a class="home tap" href="#/" aria-label="Torna alla Home"><Icon name="back" stroke={1.6} /></a>
    <div>
      <h1 class="graffiti">Componenti</h1>
      <p class="sub">Pagina di prova del design system · dati finti</p>
    </div>
  </header>

  <!-- Pagina tecnica di M2: database, backup e ripristino -->
  <Button variant="secondary" tone="progress" block href="#/dev-data">Dati (prova)</Button>

  <!-- Colori -->
  <section class="demo" aria-labelledby="s-colors">
    <h2 id="s-colors" class="mono-label">Colori</h2>
    <ul class="swatches">
      {#each COLORS as [name, hex, use] (name)}
        <li>
          <span class="chip" style:background={hex} aria-hidden="true"></span>
          <span class="mono">{name}</span>
          <span class="use">{use}</span>
        </li>
      {/each}
    </ul>
  </section>

  <!-- Tipografia -->
  <section class="demo" aria-labelledby="s-type">
    <h2 id="s-type" class="mono-label">Tipografia</h2>
    <p class="graffiti sample-graffiti">Petto + Schiena</p>
    <p class="sample-body">Space Grotesk per il testo: tira con i gomiti, non con le mani.</p>
    <p class="mono sample-mono">72,5 kg · 4 × 10 · 01:30</p>
    <p class="mono-label">Etichetta in maiuscolo</p>
  </section>

  <!-- Card -->
  <section class="demo" aria-labelledby="s-card">
    <h2 id="s-card" class="mono-label">Card</h2>
    {#each TONES as { tone, name }, i (tone)}
      <Card {tone} corners={i % 2 ? 'b' : 'a'} cut={i === 3 ? 'm' : 'l'} glow={i === 0} label="Card {name}">
        <span class="mono-label" style:color="var(--{tone})">{name}</span>
        <p class="card-text">
          Angoli tagliati {i % 2 ? '(diagonale b)' : '(diagonale a)'}, bordo 1 px{i === 0 ? ', bagliore' : ''}.
        </p>
      </Card>
    {/each}
  </section>

  <!-- NoteBox -->
  <section class="demo" aria-labelledby="s-note">
    <h2 id="s-note" class="mono-label">Note e consigli</h2>
    <NoteBox
      title="Nota del PT"
      text={'Petto in fuori, busto inclinato indietro di circa 15°.\nTira con i gomiti, non con le mani.'}
    />
    <NoteBox title="Tip della sera" mark="✦" text="Cuoci 140 g di riso: 80 g per stasera, 60 g per domani." />
    <NoteBox
      title="Osservazione dell'app"
      mark="✦"
      text="Il piano di martedì è il 6% sotto il target di proteine. L'app non modifica il piano: segnala soltanto."
    />
  </section>

  <!-- Pulsanti -->
  <section class="demo" aria-labelledby="s-button">
    <h2 id="s-button" class="mono-label">Pulsanti</h2>
    <h3 class="state">Primario · normale / premuto / disabilitato</h3>
    {#each TONES as { tone, name } (tone)}
      <div class="row">
        <Button {tone}>{name}</Button>
        <Button {tone} showPressed>Premuto</Button>
        <Button {tone} disabled>Off</Button>
      </div>
    {/each}
    <h3 class="state">Secondario e ghost</h3>
    <div class="row">
      <Button variant="secondary" tone="progress">
        {#snippet icon()}<Icon name="play" size={14} />{/snippet}
        Video
      </Button>
      <Button variant="secondary" tone="training">Pausa</Button>
      <Button variant="secondary" tone="training" disabled>Off</Button>
    </div>
    <div class="row">
      <Button variant="secondary">−15 s</Button>
      <Button variant="secondary" showPressed>Premuto</Button>
      <Button variant="secondary" pressed>Attivo</Button>
    </div>
    <div class="row">
      <Button variant="ghost" tone="progress">Vedi scheda</Button>
      <Button variant="ghost">Annulla</Button>
      <Button variant="ghost" label="Condividi" tone="progress">
        {#snippet icon()}<Icon name="share" />{/snippet}
      </Button>
      <Button variant="ghost" label="Chiudi" disabled>
        {#snippet icon()}<Icon name="close" />{/snippet}
      </Button>
    </div>
    <h3 class="state">Grande, a tutta larghezza, come link</h3>
    <Button tone="training" size="lg" block>Termina allenamento</Button>
    <Button tone="food" size="lg" block href="#/showcase">Segna come fatto</Button>
  </section>

  <!-- Stepper -->
  <section class="demo" aria-labelledby="s-stepper">
    <h2 id="s-stepper" class="mono-label">Stepper</h2>
    <div class="grid3">
      <Stepper label="Serie" bind:value={sets} min={1} max={10} decLabel="Una serie in meno" incLabel="Una serie in più" />
      <Stepper label="Ripetizioni" bind:value={reps} min={1} max={50} />
      <Stepper label="Kg" bind:value={kg} min={0} max={300} step={2.5} unit="kg" confirmAbove={250} />
    </div>
    <div class="grid3">
      <Stepper label="Al massimo" bind:value={maxed} min={1} max={10} />
      <Stepper label="Disabilitato" value={3} disabled />
    </div>
  </section>

  <!-- Spunte -->
  <section class="demo" aria-labelledby="s-check">
    <h2 id="s-check" class="mono-label">Spunte</h2>
    <div class="row">
      <CheckButton bind:checked={checkA} label="Segna serie 1 come fatta" />
      <CheckButton bind:checked={checkB} label="Segna serie 2 come fatta" />
      <CheckButton bind:checked={checkC} tone="food" label="Segna pranzo come mangiato" />
      <CheckButton bind:checked={checkD} tone="progress" label="Segna riscaldamento come fatto" />
      <CheckButton checked={false} label="Spunta disabilitata" disabled />
      <CheckButton checked={true} label="Spunta disabilitata e fatta" disabled />
    </div>
  </section>

  <!-- Tabs -->
  <section class="demo" aria-labelledby="s-tabs">
    <h2 id="s-tabs" class="mono-label">Selettori a schede</h2>
    <Tabs tabs={TABS_TRAINING} bind:selected={tabTraining} label="Sezioni allenamento" tone="training">
      {#snippet panel(id)}
        <p class="panel-text">{id === 'schede' ? 'Elenco delle schede.' : 'Calendario e sessioni passate.'}</p>
      {/snippet}
    </Tabs>
    <Tabs tabs={TABS_FOOD} bind:selected={tabFood} label="Sezioni dieta" tone="food">
      {#snippet panel(id)}
        <p class="panel-text">
          {id === 'piano' ? 'Pasti del giorno.' : id === 'spesa' ? 'Lista della spesa.' : 'Ricette del piano.'}
        </p>
      {/snippet}
    </Tabs>
  </section>

  <!-- Anelli e barre -->
  <section class="demo" aria-labelledby="s-ring">
    <h2 id="s-ring" class="mono-label">Anelli e barre</h2>
    <Card tone="food" label="Calorie di oggi">
      <div class="ring-row">
        <ProgressRing
          value={eaten}
          max={1819}
          tone="food"
          text={String(eaten)}
          caption="di 1819 kcal"
          label="{eaten} di 1819 kcal"
        />
        <div class="macros">
          <div class="macro">
            <div class="macro-head"><span>Proteine</span><span class="mono">35 / 141 g</span></div>
            <ProgressBar value={35} max={141} tone="training" label="Proteine" valueText="35 di 141 g" rounded />
          </div>
          <div class="macro">
            <div class="macro-head"><span>Carboidrati</span><span class="mono">85 / 227 g</span></div>
            <ProgressBar value={85} max={227} tone="food" label="Carboidrati" valueText="85 di 227 g" rounded />
          </div>
          <div class="macro">
            <div class="macro-head"><span>Grassi</span><span class="mono">10 / 39 g</span></div>
            <ProgressBar value={10} max={39} tone="progress" label="Grassi" valueText="10 di 39 g" rounded />
          </div>
        </div>
      </div>
      <div class="row">
        <Button variant="secondary" onclick={() => (eaten = Math.max(0, eaten - 300))}>−300 kcal</Button>
        <Button variant="secondary" onclick={() => (eaten += 300)}>+300 kcal</Button>
      </div>
    </Card>
    <div class="row rings">
      <ProgressRing value={0} max={100} tone="progress" text="0" caption="vuoto" label="0 su 100" size={96} stroke={8} />
      <ProgressRing value={100} max={100} tone="training" text="100%" caption="pieno" label="Completo" size={96} stroke={8} />
      <ProgressRing
        value={12345}
        max={20000}
        tone="tip"
        text="12.345"
        caption="testo lungo"
        label="12345 su 20000"
        size={96}
        stroke={8}
      />
    </div>
    <div class="macro">
      <div class="macro-head"><span>Spesa</span><span class="mono">{shop} / 12</span></div>
      <ProgressBar value={shop} max={12} tone="food" label="Spesa" valueText="{shop} di 12 prodotti" />
    </div>
    <div class="row">
      <Button variant="secondary" disabled={shop === 0} onclick={() => (shop -= 1)}>−1</Button>
      <Button variant="secondary" disabled={shop === 12} onclick={() => (shop += 1)}>+1</Button>
    </div>
  </section>

  <!-- Pannelli dal basso -->
  <section class="demo" aria-labelledby="s-sheet">
    <h2 id="s-sheet" class="mono-label">Pannelli dal basso</h2>
    <p class="hint">Si chiudono toccando fuori, trascinando giù la maniglia, con Esc o con ✕.</p>
    <div class="row">
      <Button tone="training" onclick={() => (sheetRest = true)}>Apri recupero</Button>
      <Button tone="food" onclick={() => (sheetPlan = true)}>Apri piano (lungo)</Button>
    </div>
  </section>

  <!-- Banner della sessione -->
  <section class="demo" aria-labelledby="s-banner">
    <h2 id="s-banner" class="mono-label">Banner della sessione</h2>
    <label class="field">
      <span class="mono-label">Nome scheda (prova un titolo lungo)</span>
      <input type="text" bind:value={title} maxlength="80" />
    </label>
    <div class="phone">
      <TopBanner
        {title}
        level="h2"
        elapsed={elapsed}
        backLabel="Torna alla scheda"
        onback={() => {}}
        {segments}
        current={exercise}
        progressLabel="Esercizio {exercise + 1} di {segments.length}"
      />
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (una zona che scorre deve essere raggiungibile da tastiera) -->
      <div class="phone-body scroll" role="region" aria-label="Contenuto che scorre" tabindex="0">
        <Card tone="training" label="Esercizio in corso">
          <span class="mono-label" style:color="var(--training)">Esercizio {exercise + 1} / 6</span>
          <p class="card-text">Il corpo scorre all'interno, con la scrollbar nascosta; i banner restano fermi.</p>
        </Card>
        {#each Array.from({ length: 8 }, (_, i) => i + 1) as n (n)}
          <p class="filler">Riga di contenuto {n}</p>
        {/each}
      </div>
      <div class="phone-footer">
        <BottomBanner
          prevLabel="Esercizio precedente"
          nextLabel="Esercizio successivo"
          prevDisabled={exercise === 0}
          nextDisabled={exercise === segments.length - 1}
          onprev={() => (exercise = Math.max(0, exercise - 1))}
          onnext={() => (exercise = Math.min(segments.length - 1, exercise + 1))}
        >
          {#snippet center()}
            <button
              type="button"
              class="rest tap"
              aria-label="Recupero {rest} secondi, tocca per gestire"
              onclick={() => (sheetRest = true)}
            >
              <ProgressRing
                value={rest}
                max={restTotal}
                tone="training"
                size={96}
                stroke={7}
                textSize={20}
                text={formatClock(rest)}
                caption={rest > 0 ? (paused ? 'IN PAUSA' : 'RECUPERO') : 'PRONTO'}
                label="Recupero {rest} secondi"
              />
            </button>
          {/snippet}
        </BottomBanner>
      </div>
    </div>
  </section>

  <!-- Navigazione -->
  <section class="demo" aria-labelledby="s-nav">
    <h2 id="s-nav" class="mono-label">Barra di navigazione</h2>
    <p class="hint">Tocca una voce: quella attiva prende il colore della sua sezione.</p>
    <div class="nav-frame">
      <BottomNav active={navActive} onnavigate={(id) => (navActive = id)} />
    </div>
  </section>

  <!-- Grafici (M9) -->
  <section class="demo" aria-labelledby="s-charts">
    <h2 id="s-charts" class="mono-label">Grafici</h2>
    <p class="hint">SVG fatto a mano: tocca o trascina sul grafico, frecce da tastiera.</p>
    <LineChart points={LINE} tone="progress" name="Peso di prova" unit="kg" value={kgText} delta={kgDelta} firstText="prima misura" singleText="Con un'altra misura vedrai l'andamento." pr={[false, false, false, true, false, false, true]} />
    <LineChart points={LINE.slice(0, 1)} tone="training" name="Un punto" unit="kg" value={kgText} delta={kgDelta} firstText="prima sessione" singleText="Con un'altra sessione vedrai l'andamento." />
    <div class="grid2">
      <MiniLine points={LINE.slice(0, 3)} tone="progress" label="Mini di prova" next="2026-11-13" />
      <MiniLine points={LINE.slice(2, 5)} tone="fat" label="Mini viola" />
    </div>
    <BarChart bars={BARS} target={3} targetLabel="obiettivo 3" tone="training" summary="Barre di prova" tip={barTip} />
    <DivergingBars items={DIV} band={5} summary="Scarto di prova" />
    <Legend items={[{ mark: '■', tone: 'food', text: 'entro ±5 %' }, { mark: '▨', tone: 'tip', text: 'oltre ±5 % (▲ sopra, ▼ sotto)' }]} />
  </section>

  <!-- Animazioni -->
  <section class="demo" aria-labelledby="s-motion">
    <h2 id="s-motion" class="mono-label">Animazioni</h2>
    <p class="hint">Solo transform e opacity; spente con "Riduci movimento".</p>
    <Button variant="secondary" tone="progress" onclick={() => replay++}>Riproduci</Button>
    {#key replay}
      <div class="motion-grid">
        <span class="motion" in:rise>rise</span>
        <span class="motion" in:drop>drop</span>
        <span class="motion" in:fade>fade</span>
        <span class="motion" in:pop><span class="sticker">Fatto!</span></span>
      </div>
    {/key}
  </section>
</div>

<BottomSheet bind:open={sheetRest} title="Recupero" tone="training">
  <span class="big-time mono">{formatClock(rest)}</span>
  <div class="grid4" role="group" aria-label="Durata">
    {#each [60, 90, 120, 180] as sec (sec)}
      <Button variant="secondary" tone="training" pressed={restTotal === sec} onclick={() => startRest(sec)}>
        {sec} s
      </Button>
    {/each}
  </div>
  <div class="grid2">
    <Button variant="secondary" onclick={() => (rest = Math.max(0, rest - 15))}>−15 s</Button>
    <Button
      variant="secondary"
      onclick={() => {
        rest += 15;
        restTotal = Math.max(restTotal, rest);
      }}>+15 s</Button
    >
  </div>
  <div class="grid2">
    <Button variant="secondary" tone="training" onclick={() => (paused = !paused)}>
      {paused ? 'Riprendi' : 'Pausa'}
    </Button>
    <Button
      tone="training"
      onclick={() => {
        rest = 0;
        sheetRest = false;
      }}>Salta</Button
    >
  </div>
  <p class="hint center">Predefinito del PT per questo esercizio: 90 s</p>
</BottomSheet>

<BottomSheet bind:open={sheetPlan} title="Ottobre 2026" tone="food">
  <NoteBox title="Completezza" mark="✦" text="Target, macro per alimento, ricette e integratori presenti." />
  {#each Array.from({ length: 14 }, (_, i) => i + 1) as n (n)}
    <p class="filler">Piano precedente {n}</p>
  {/each}
  <Button tone="food" block onclick={() => (sheetPlan = false)}>Fatto</Button>
</BottomSheet>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: calc(var(--space-4) + var(--safe-top)) calc(var(--space-4) + var(--safe-right))
      calc(var(--space-8) + var(--safe-bottom)) calc(var(--space-4) + var(--safe-left));
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .home {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--touch);
    height: var(--touch);
    color: var(--text);
  }

  .top h1 {
    font-size: 34px;
    color: var(--progress);
  }

  .sub {
    margin: var(--space-1) 0 0;
    font-size: 13px;
    color: var(--muted);
  }

  .demo {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .demo > h2 {
    margin: 0;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--line);
    font-size: 12px;
    color: var(--text-2);
  }

  .state {
    margin: var(--space-2) 0 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .grid2,
  .grid3,
  .grid4 {
    display: grid;
    gap: var(--space-2);
  }
  .grid2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .grid4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .swatches {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .swatches li {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    column-gap: var(--space-2);
    align-items: center;
    font-size: 12px;
  }

  .chip {
    grid-row: span 2;
    width: 28px;
    height: 28px;
    border: 1px solid var(--line-strong);
  }

  .use {
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sample-graffiti {
    font-size: 30px;
    color: var(--training);
  }

  .sample-body,
  .sample-mono {
    margin: 0;
  }

  .sample-mono {
    font-size: 15px;
    font-weight: 700;
  }

  .card-text,
  .panel-text {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .center {
    text-align: center;
  }

  .ring-row {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .macros {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .macro {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .macro-head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: 12px;
  }

  .rings {
    justify-content: space-around;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field input {
    min-height: var(--touch);
    padding: 0 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-size: 16px; /* sotto i 16 px Safari iOS zooma al focus */
  }

  /* Cornice "schermo" 390 px: banner fissi, corpo che scorre. Niente safe area qui dentro. */
  .phone {
    --safe-top: 0px;
    --safe-bottom: 0px;
    --safe-left: 0px;
    --safe-right: 0px;
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 390px;
    height: 560px;
    margin: 0 auto;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--bg);
  }

  .phone-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5) 140px;
  }

  .phone-footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .filler {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
    color: var(--text-2);
    font-size: 14px;
  }

  .rest {
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--bg);
    color: var(--text);
  }

  .nav-frame {
    --safe-bottom: 0px;
    --safe-left: 0px;
    --safe-right: 0px;
    margin: 0 calc(-1 * var(--space-4));
  }

  .motion-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .motion {
    display: grid;
    place-items: center;
    min-height: 56px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .sticker {
    padding: 2px var(--space-2);
    border: 2px solid var(--food);
    color: var(--food);
    font-family: var(--font-graffiti);
    font-size: 16px;
    transform: rotate(-6deg);
  }

  .big-time {
    align-self: center;
    font-size: 60px;
    font-weight: 700;
    line-height: 1;
    text-shadow: 0 0 18px var(--training-glow);
  }
</style>
