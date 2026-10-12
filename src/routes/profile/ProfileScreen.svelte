<script lang="ts">
  import { onMount } from 'svelte';
  import { versionLabel } from '../../lib/app-info';
  import Button from '../../lib/components/Button.svelte';
  import Card from '../../lib/components/Card.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { ValidationError } from '../../lib/data/errors';
  import { liveState } from '../../lib/data/live.svelte';
  import { listMeasurementsByDate, saveMeasurement } from '../../lib/data/repo/measurements';
  import { getProfile } from '../../lib/data/repo/profile';
  import {
    DEFAULT_WORKOUT_AUTHOR,
    getNextMeasurement,
    getWorkoutAuthor,
    setNextMeasurement,
  } from '../../lib/data/repo/settings';
  import type { Measurement } from '../../lib/data/schemas/measurements';
  import type { Profile } from '../../lib/data/schemas/profile';
  import { getStorageStatus, type StorageStatus } from '../../lib/data/storage';
  import { ageFromBirthYear } from '../../lib/profile/age';
  import { compareMetrics } from '../../lib/profile/compare';
  import { dayMonthUpper, metricWithUnit, numericDate } from '../../lib/profile/format';
  import { deriveMetrics } from '../../lib/profile/metrics';
  import { pickDate, resolvePair, type Pair } from '../../lib/profile/selection';
  import { circumferenceRows, compositionRows, heroCards, splitBar, waterRows } from '../../lib/profile/view';
  import InstallBanner from '../../lib/pwa/InstallBanner.svelte';
  import { isStandalone } from '../../lib/pwa/standalone';
  import { routeHref } from '../../lib/routes';
  import Screen from '../Screen.svelte';
  import AppSettings from './AppSettings.svelte';
  import BackupPanel from './BackupPanel.svelte';
  import Circumferences from './Circumferences.svelte';
  import CompareDates from './CompareDates.svelte';
  import HeroCards from './HeroCards.svelte';
  import MetricRows from './MetricRows.svelte';
  import ProfileHeader from './ProfileHeader.svelte';
  import ProfileSheet from './ProfileSheet.svelte';
  import SplitBar from './SplitBar.svelte';
  import StorageFacts from './StorageFacts.svelte';
  import TextSheet from './TextSheet.svelte';

  interface Props {
    now: Date;
  }

  let { now }: Props = $props();

  const profile = liveState<Profile | undefined>(getProfile, undefined);
  const measurements = liveState<Measurement[]>(listMeasurementsByDate, []);
  const next = liveState(getNextMeasurement, { text: '', date: null });
  const author = liveState(getWorkoutAuthor, DEFAULT_WORKOUT_AUTHOR);

  const list = $derived(measurements.current);
  /** Dalla più recente: elenco delle date e storico. */
  const newestFirst = $derived([...list].reverse());

  // --- Date a confronto (predefinito: ultima e precedente) ---
  let chosen = $state<Pair | null>(null);
  const pair = $derived(resolvePair(list, chosen));
  const after = $derived(pair.after);
  const before = $derived(pair.before);

  function onpick(side: 'before' | 'after', id: string) {
    if (!before || !after) return;
    chosen = pickDate(list, { beforeId: before.id, afterId: after.id }, side, id);
  }

  // --- Valori e confronto (le card restano montate: cambiano solo i testi) ---
  const goal = $derived(profile.current?.goal ?? null);
  const nowMetrics = $derived(after ? deriveMetrics(after, profile.current) : null);
  const beforeMetrics = $derived(before ? deriveMetrics(before, profile.current) : null);
  const cmp = $derived(nowMetrics ? compareMetrics(nowMetrics, beforeMetrics, goal) : null);
  const beforeDate = $derived(before?.date ?? null);
  const bar = $derived(cmp ? splitBar(cmp) : null);

  const age = $derived(ageFromBirthYear(profile.current?.birthYear, now));
  const lastDate = $derived(list.at(-1)?.date ?? null);

  // --- Pannelli ---
  let profileOpen = $state(false);
  let readingOpen = $state(false);
  let nextOpen = $state(false);

  async function saveReading(text: string): Promise<readonly string[]> {
    if (!after) return [];
    try {
      await saveMeasurement({ ...after, notes: text.trim() });
      return [];
    } catch (error) {
      return error instanceof ValidationError ? error.errors : ['Salvataggio non riuscito: riprova.'];
    }
  }

  async function saveNext(text: string, date: string | null): Promise<readonly string[]> {
    try {
      await setNextMeasurement({ text, date });
      return [];
    } catch (error) {
      return error instanceof ValidationError ? error.errors : ['Salvataggio non riuscito: riprova.'];
    }
  }

  // --- Memoria del telefono ---
  let storage = $state<StorageStatus | null>(null);
  async function refreshStorage() {
    storage = await getStorageStatus();
  }
  onMount(() => {
    void refreshStorage();
  });

  const standalone = isStandalone(window);
</script>

<Screen nav="profilo">
  <div class="page">
    <ProfileHeader
      name={profile.current?.name ?? ''}
      {lastDate}
      {age}
      heightCm={profile.current?.heightCm ?? null}
      {goal}
      onedit={() => (profileOpen = true)}
    />

    {#if measurements.error}
      <NoteBox title="Dati non disponibili" mark="!" text="Non riesco a leggere le misure su questo telefono." />
    {:else if !measurements.loaded}
      <p class="hint">Carico le misure…</p>
    {:else if !after || !cmp}
      <Card tone="progress" label="Nessuna misura">
        <h2 class="graffiti card-title">Prima misura</h2>
        <p class="text" data-testid="empty-measurements">
          Non hai ancora inserito misure. Bastano la data e un valore, per esempio il peso; il resto (bioimpedenza,
          circonferenze) quando ce l'hai.
        </p>
      </Card>
    {:else}
      {#if before}
        <CompareDates options={newestFirst} {before} {after} {onpick} />
      {:else}
        <p class="single mono" data-testid="single-date">MISURA DEL {numericDate(after.date)} · NESSUN CONFRONTO</p>
      {/if}

      <HeroCards cards={heroCards(cmp, !!profile.current?.heightCm)} />

      <Card tone="progress" label="Composizione corporea">
        <h2 class="graffiti card-title">Composizione</h2>
        {#if bar}<SplitBar ffm={bar.ffm} fm={bar.fm} />{/if}
        <MetricRows rows={compositionRows(cmp, beforeDate)} />
        {#if !profile.current?.heightCm && cmp.bcmKg.now}
          <p class="hint">BCMI = BCM ÷ altezza²: serve l'altezza nel profilo.</p>
        {/if}
      </Card>

      <Card tone="neutral" corners="b" label="Acqua corporea">
        <h2 class="graffiti card-title">Acqua</h2>
        <MetricRows rows={waterRows(cmp, beforeDate)} />
      </Card>

      <Card tone="neutral" label="Circonferenze">
        <div class="card-head">
          <h2 class="graffiti card-title">Circonferenze</h2>
          <span class="mono unit">cm</span>
        </div>
        <Circumferences rows={circumferenceRows(cmp)} />
      </Card>

      {#if before}
        <div class="legend" data-testid="legend">
          <span><b class="good" aria-hidden="true">▲▼</b> nella direzione giusta</span>
          <span><b class="warn" aria-hidden="true">▲▼</b> da tenere d'occhio</span>
          <span><b class="neutral" aria-hidden="true">▲▼</b> neutra</span>
        </div>
      {/if}

      <section class="note-block" aria-label="Lettura del nutrizionista" data-testid="reading">
        <NoteBox title="Lettura del nutrizionista · {numericDate(after.date)}" mark="✦" text={after.notes || undefined}>
          {#if !after.notes}
            <p class="invite">Scrivi qui cosa ti ha detto il nutrizionista di questa misura.</p>
          {/if}
        </NoteBox>
        <Button tone="tip" variant="secondary" size="sm" onclick={() => (readingOpen = true)}>
          {after.notes ? 'Modifica la lettura' : 'Scrivi la lettura'}
        </Button>
      </section>
    {/if}

    <section class="next" aria-label="Prossima bioimpedenza" data-testid="next-measurement">
      <span class="mono next-title">
        {next.current.date ? `PROSSIMA BIOIMPEDENZA · ~${dayMonthUpper(next.current.date)}` : 'PROSSIMA BIOIMPEDENZA'}
      </span>
      {#if next.current.text}
        <p class="next-text">{next.current.text}</p>
      {:else}
        <p class="next-text muted">Scrivi le condizioni da rispettare (es. orario, digiuno, allenamento il giorno prima).</p>
      {/if}
      <Button tone="progress" variant="ghost" size="sm" onclick={() => (nextOpen = true)}>
        {next.current.text || next.current.date ? 'Modifica' : 'Scrivi le condizioni'}
      </Button>
    </section>

    <div class="actions">
      <Button tone="progress" size="lg" href={routeHref('/profilo/misura')}>+ Nuova misura</Button>
      <Button variant="secondary" href={routeHref('/progressi', { tab: 'corpo' })}>Grafici</Button>
    </div>

    {#if newestFirst.length > 0}
      <section class="block" aria-labelledby="p-history">
        <h2 id="p-history" class="mono-label">Storico misure</h2>
        <ul class="history" data-testid="history">
          {#each newestFirst as m (m.id)}
            <li>
              <a class="history-row tap" href={routeHref('/profilo/misura', { id: m.id })}>
                <span class="mono">{numericDate(m.date)}</span>
                <span class="history-weight">{m.weightKg !== null ? metricWithUnit('weight', m.weightKg) : 'senza peso'}</span>
                <span class="history-edit">Modifica</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="block" aria-labelledby="p-backup">
      <h2 id="p-backup" class="mono-label">Backup e dati</h2>
      <BackupPanel {now} onchange={refreshStorage} />
      <StorageFacts {storage} />
    </section>

    <section class="block" aria-labelledby="p-settings">
      <h2 id="p-settings" class="mono-label">Impostazioni · schede</h2>
      {#if author.loaded}
        <AppSettings author={author.current} profileName={profile.current?.name ?? ''} />
      {/if}
    </section>

    <section class="block" aria-labelledby="p-install">
      <h2 id="p-install" class="mono-label">Installazione</h2>
      {#if standalone}
        <p class="text" data-testid="installed">App installata ✓ I dati di Healthy restano in questa app.</p>
      {:else}
        <InstallBanner />
      {/if}
    </section>

    <section class="block" aria-labelledby="p-info">
      <h2 id="p-info" class="mono-label">Informazioni</h2>
      <p class="text mono small" data-testid="app-version">{versionLabel()}</p>
      <p class="hint">
        Nessun account, nessun tracciamento, nessuna connessione: i dati restano su questo telefono e nei backup che
        crei tu. L'app mostra i tuoi dati e le note che scrivi: non dà interpretazioni mediche.
      </p>
    </section>
  </div>
</Screen>

<ProfileSheet bind:open={profileOpen} profile={profile.current} today={now} />

<TextSheet
  bind:open={readingOpen}
  title="Lettura del nutrizionista"
  label={after ? `Misura del ${numericDate(after.date)}` : ''}
  placeholder="Cosa ti ha detto il nutrizionista di questa misura"
  initial={after?.notes ?? ''}
  onsave={saveReading}
/>

<TextSheet
  bind:open={nextOpen}
  title="Prossima bioimpedenza"
  label="Condizioni da rispettare"
  placeholder="es. stesso orario, a digiuno, niente allenamento il giorno prima"
  initial={next.current.text}
  initialDate={next.current.date}
  dateLabel="Data indicativa (facoltativa)"
  onsave={saveNext}
/>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: calc(54px + var(--safe-top)) calc(var(--space-5) + var(--safe-right)) var(--space-8)
      calc(var(--space-5) + var(--safe-left));
    background-image: radial-gradient(circle at 90% 4%, var(--progress-tint), transparent 38%);
    background-repeat: no-repeat;
    background-size: 100% 600px;
  }

  .card-title {
    font-size: 24px;
    color: var(--progress);
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .unit {
    font-size: 12px;
    color: var(--muted);
  }

  .single {
    margin: 0;
    font-size: 12px;
    letter-spacing: 1px;
    color: var(--muted);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) 14px;
    font-size: 12px;
    color: var(--muted);
  }

  .legend .good {
    color: var(--progress);
  }
  .legend .warn {
    color: var(--tip);
  }
  .legend .neutral {
    color: var(--muted);
  }

  .note-block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .note-block > :global(aside) {
    align-self: stretch;
  }

  .invite {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .next {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    padding: 14px 16px 6px;
    border: 1px solid var(--line);
  }

  .next-title {
    font-size: 12px;
    letter-spacing: 2px;
    color: var(--progress);
  }

  .next-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-line;
    overflow-wrap: anywhere;
    color: var(--text-2);
  }

  .next-text.muted {
    color: var(--muted);
  }

  .actions {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .block > h2 {
    margin: 0;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--line);
    font-size: 12px;
    color: var(--text-2);
  }

  .history {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .history-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch);
    padding: 0 var(--space-3);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-size: 14px;
  }

  .history-weight {
    color: var(--text-2);
  }

  .history-edit {
    font-size: 13px;
    color: var(--progress);
  }

  .text {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }

  .small {
    font-size: 13px;
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
