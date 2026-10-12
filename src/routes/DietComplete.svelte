<script lang="ts">
  import { edgeSwipe } from '../lib/sessions/edge-swipe';
  import Button from '../lib/components/Button.svelte';
  import NoteBox from '../lib/components/NoteBox.svelte';
  import ProgressBar from '../lib/components/ProgressBar.svelte';
  import TopBanner from '../lib/components/TopBanner.svelte';
  import { lookup, ValidationError } from '../lib/data/errors';
  import { liveState } from '../lib/data/live.svelte';
  import { listDietPlans, updatePlanPayload } from '../lib/data/repo/diet-plans';
  import { listMeasurementsByDate } from '../lib/data/repo/measurements';
  import { getProfile } from '../lib/data/repo/profile';
  import { weekdayName, type DietPayload } from '../lib/data/schemas/diet-payload';
  import type { DietPlan } from '../lib/data/schemas/diet-plans';
  import type { Measurement } from '../lib/data/schemas/measurements';
  import type { Profile } from '../lib/data/schemas/profile';
  import { planCompleteness, usedProductKeys } from '../lib/diet/calc/completeness';
  import { estimateInputFrom, estimateKcal } from '../lib/diet/calc/estimate';
  import { activityLabel } from '../lib/profile/goals';
  import { latestWeight } from '../lib/profile/metrics';
  import { routeHref } from '../lib/routes';
  import { hasCompleteValues } from '../lib/diet/calc/nutrients';
  import { atPercent } from '../lib/diet/format';
  import { DAY_TYPE_PRESETS, setDayType, setProductValues, setSupplements, setTargets } from '../lib/diet/edit';
  import ProductForm from './diet/complete/ProductForm.svelte';
  import SupplementsEditor from './diet/complete/SupplementsEditor.svelte';
  import TargetsForm from './diet/complete/TargetsForm.svelte';

  // Completamento guidato (§ 6.1): solo i dati che mancano al piano. L'editor completo non è in M3.

  const plans = liveState<DietPlan[]>(listDietPlans, []);
  const profile = liveState<Profile | undefined>(getProfile, undefined);
  const measurements = liveState<Measurement[]>(listMeasurementsByDate, []);

  const plan = $derived(plans.current.find((p) => p.active));
  const completeness = $derived(plan ? planCompleteness(plan.payload) : null);

  let busy = $state(false);
  let status = $state('');

  /** Salva un nuovo contenuto del piano; restituisce gli errori (vuoto = salvato). */
  async function save(next: DietPayload, done: string): Promise<readonly string[]> {
    if (!plan || busy) return [];
    busy = true;
    status = '';
    try {
      await updatePlanPayload(plan.id, next);
      status = done;
      return [];
    } catch (error) {
      return error instanceof ValidationError ? error.errors : ['Salvataggio non riuscito: riprova.'];
    } finally {
      busy = false;
    }
  }

  // --- Tipi di giornata ---
  const typeOptions = $derived.by(() => {
    if (!plan) return [];
    const presets: { key: string; label: string }[] = DAY_TYPE_PRESETS.map((p) => ({ key: p.key, label: p.label }));
    const others = Object.entries(plan.payload.dayTypes)
      .filter(([key]) => !presets.some((p) => p.key === key))
      .map(([key, t]) => ({ key, label: t.label }));
    return [...presets, ...others];
  });

  let dayTypeErrors = $state<readonly string[]>([]);
  async function chooseType(weekday: number, key: string | null) {
    if (!plan) return;
    dayTypeErrors = await save(setDayType(plan.payload, weekday, key), `${weekdayName(weekday)}: tipo di giornata salvato.`);
  }

  // --- Target ---
  const usedTypes = $derived(
    plan ? [...new Set(plan.payload.days.flatMap((d) => (d.type === null ? [] : [d.type])))] : [],
  );
  // Ultimo peso inserito: una misura senza peso (solo circonferenze) non lo cancella.
  const lastWeight = $derived(latestWeight(measurements.current));
  const estimateInput = $derived(estimateInputFrom(profile.current, lastWeight, new Date()));

  function estimateFor(key: string) {
    if (!estimateInput.ok) {
      return {
        ok: false as const,
        reason: `Stima non disponibile: ${estimateInput.missing.length > 1 ? 'mancano' : 'manca'} ${listItalian(estimateInput.missing)}.`,
        link: { href: routeHref('/profilo'), label: 'Completa il Profilo' },
      };
    }
    const value = estimateKcal(estimateInput.value, key);
    if (!value) return { ok: false as const, reason: 'Stima non disponibile per questo tipo di giornata.' };
    const day = (plan && lookup(plan.payload.dayTypes, key)?.label) || key;
    const level = activityLabel(estimateInput.value.activityLevel ?? 'sedentary');
    return { ok: true as const, value, factorNote: `${day.toLowerCase()}, ${level.toLowerCase()}` };
  }

  /** "altezza", "altezza e peso", "età, altezza e peso". */
  function listItalian(items: readonly string[]): string {
    if (items.length <= 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
  }

  // --- Alimenti ---
  const products = $derived.by(() => {
    if (!plan) return { missing: [] as string[], complete: [] as string[] };
    const keys = usedProductKeys(plan.payload);
    const complete = (k: string) => {
      const p = lookup(plan.payload.products, k);
      return p !== undefined && hasCompleteValues(p);
    };
    return { missing: keys.filter((k) => !complete(k)), complete: keys.filter(complete) };
  });
</script>

<div class="screen tone-food" use:edgeSwipe={() => (location.hash = '#/dieta')}>
  <TopBanner title="Completa il piano" tone="food" backHref="#/dieta" backLabel="Torna alla dieta" />

  <div class="body scroll">
    {#if !plans.loaded}
      <p class="hint">Carico il piano…</p>
    {:else if !plan || !completeness}
      <NoteBox title="Nessun piano attivo" mark="!" text="Importa prima un piano dalla schermata Dieta." />
      <Button tone="food" href="#/dieta">Vai alla dieta</Button>
    {:else}
      <section class="block" aria-labelledby="c-state">
        <h2 id="c-state" class="mono-label">{plan.title}</h2>
        <p class="lead">Completo <b data-testid="completeness">{atPercent(completeness.percent)}</b></p>
        <ProgressBar value={completeness.percent} max={100} label="Completezza" valueText="{completeness.percent}%" tone="food" />
        <ul class="check">
          {#each completeness.items as item (item.id)}
            <li class:done={item.done}>
              <span aria-hidden="true">{item.done ? '✓' : '!'}</span>
              <span>{item.label}{item.detail ? ` · ${item.detail}` : ''}{item.counted ? '' : ' (non conta nella %)'}</span>
            </li>
          {/each}
        </ul>
        <p class="status" role="status" aria-live="polite">{status}</p>
      </section>

      <section class="block" aria-labelledby="c-types">
        <h2 id="c-types" class="mono-label">Tipi di giornata</h2>
        <p class="hint">Servono per i target: di solito palestra, corsa o riposo.</p>
        {#each plan.payload.days as day (day.weekday)}
          <div class="type-row" role="group" aria-label="Tipo di giornata di {weekdayName(day.weekday).toLowerCase()}">
            <span class="type-day">{weekdayName(day.weekday)}</span>
            <div class="type-options">
              {#each typeOptions as opt (opt.key)}
                <Button
                  variant="secondary"
                  tone="food"
                  size="sm"
                  pressed={day.type === opt.key}
                  disabled={busy}
                  onclick={() => chooseType(day.weekday, day.type === opt.key ? null : opt.key)}>{opt.label}</Button
                >
              {/each}
            </div>
          </div>
        {/each}
        {#if dayTypeErrors.length > 0}
          <NoteBox title="Non salvato" mark="!" text={dayTypeErrors.join('\n')} />
        {/if}
      </section>

      <section class="block" aria-labelledby="c-targets">
        <h2 id="c-targets" class="mono-label">Target</h2>
        {#each usedTypes as key (key)}
          {@const dayType = lookup(plan.payload.dayTypes, key)}
          {#if dayType}
            {#key `${plan.id}-${key}-${dayType.targetsSource}-${dayType.targets?.kcal ?? ''}`}
              <TargetsForm
                {dayType}
                estimate={estimateFor(key)}
                {busy}
                onsave={(targets, source) =>
                  save(setTargets(plan.payload, key, targets, source), `Target di ${dayType.label.toLowerCase()} salvati.`)}
              />
            {/key}
          {/if}
        {:else}
          <p class="hint">Assegna prima un tipo di giornata ai giorni.</p>
        {/each}
      </section>

      <section class="block" aria-labelledby="c-products">
        <h2 id="c-products" class="mono-label">Alimenti senza valori ({products.missing.length})</h2>
        <p class="hint">Valori per 100 g, come sull'etichetta. Per gli alimenti a pezzi serve anche il peso di un pezzo.</p>
        {#each products.missing as key (key)}
          {@const product = lookup(plan.payload.products, key)}
          {#if product}
            <ProductForm
              {product}
              {busy}
              onsave={(per100, pieceGrams) =>
                save(setProductValues(plan.payload, key, per100, pieceGrams), `Valori di ${product.name} salvati.`)}
            />
          {/if}
        {:else}
          <p class="hint">Tutti gli alimenti hanno i valori nutrizionali. ✓</p>
        {/each}
        {#if plan.origin === 'mydiet' && products.complete.length > 0}
          <details class="more">
            <summary>Correggi gli alimenti già compilati ({products.complete.length})</summary>
            <div class="more-list">
              {#each products.complete as key (key)}
                {@const product = lookup(plan.payload.products, key)}
                {#if product}
                  <ProductForm
                    {product}
                    {busy}
                    onsave={(per100, pieceGrams) =>
                      save(setProductValues(plan.payload, key, per100, pieceGrams), `Valori di ${product.name} salvati.`)}
                  />
                {/if}
              {/each}
            </div>
          </details>
        {/if}
      </section>

      <section class="block" aria-labelledby="c-supps">
        <h2 id="c-supps" class="mono-label">Integratori</h2>
        {#each plan.payload.days as day (day.weekday)}
          <SupplementsEditor
            weekday={day.weekday}
            supplements={day.supplements}
            {busy}
            onsave={(list) => save(setSupplements(plan.payload, day.weekday, list), `Integratori di ${weekdayName(day.weekday).toLowerCase()} salvati.`)}
          />
        {/each}
      </section>

      <section class="block" aria-labelledby="c-recipes">
        <h2 id="c-recipes" class="mono-label">Ricette</h2>
        <p class="hint">
          {plan.payload.recipes.length === 0
            ? 'Nessuna ricetta nel piano: si potranno aggiungere con l’editor del piano (non ancora disponibile).'
            : `${plan.payload.recipes.length} ricette nel piano.`}
        </p>
      </section>

      <Button tone="food" block href="#/dieta">Fatto</Button>
    {/if}
  </div>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    height: var(--app-h);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: var(--space-5) calc(var(--space-5) + var(--safe-right)) calc(var(--space-8) + var(--safe-bottom))
      calc(var(--space-5) + var(--safe-left));
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

  .lead {
    margin: 0;
    font-size: 16px;
  }

  .check {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: 14px;
    color: var(--tip);
  }

  .check li {
    display: flex;
    gap: var(--space-2);
  }

  .check li.done {
    color: var(--tone);
  }

  .status {
    min-height: 1.4em;
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .type-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .type-day {
    font-size: 14px;
    font-weight: 700;
  }

  .type-options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .more summary {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    color: var(--progress);
    cursor: pointer;
  }

  .more-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
