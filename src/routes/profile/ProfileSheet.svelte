<script lang="ts">
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { ValidationError } from '../../lib/data/errors';
  import { saveProfile } from '../../lib/data/repo/profile';
  import type { Profile } from '../../lib/data/schemas/profile';
  import { ACTIVITY_LEVELS, GOALS } from '../../lib/profile/goals';
  import { profileFormFrom, readProfileForm, type ProfileForm } from '../../lib/profile/profile-form';

  interface Props {
    open: boolean;
    profile: Profile | undefined;
    today: Date;
  }

  let { open = $bindable(false), profile, today }: Props = $props();

  let form = $state<ProfileForm>(profileFormFrom(undefined));
  let tried = $state(false);
  let saveErrors = $state<readonly string[]>([]);
  let busy = $state(false);

  // A ogni apertura il modulo riparte dai dati salvati.
  let wasOpen = false;
  $effect(() => {
    if (open && !wasOpen) {
      form = profileFormFrom(profile);
      tried = false;
      saveErrors = [];
    }
    wasOpen = open;
  });

  const result = $derived(readProfileForm(form, today));
  const errors = $derived(tried ? result.errors : {});

  const SEXES = [
    { key: 'M', label: 'Uomo' },
    { key: 'F', label: 'Donna' },
    { key: null, label: 'Non indicato' },
  ] as const;

  async function save() {
    tried = true;
    if (!result.value || busy) return;
    busy = true;
    try {
      await saveProfile(result.value);
      open = false;
    } catch (error) {
      saveErrors = error instanceof ValidationError ? error.errors : ['Salvataggio non riuscito: riprova.'];
    } finally {
      busy = false;
    }
  }
</script>

<BottomSheet bind:open title="Il tuo profilo" tone="progress">
  <form
    class="form"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}
  >
    <div class="field">
      <label for="pf-name">Nome</label>
      <input id="pf-name" type="text" autocomplete="given-name" maxlength="120" bind:value={form.name} />
      {#if errors.name}<p class="err">{errors.name}</p>{/if}
    </div>

    <div class="pair">
      <div class="field">
        <label for="pf-year">Anno di nascita</label>
        <input
          id="pf-year"
          type="text"
          inputmode="numeric"
          autocomplete="bday-year"
          placeholder="es. 1990"
          maxlength="4"
          aria-invalid={errors.birthYear ? 'true' : undefined}
          aria-describedby={errors.birthYear ? 'pf-year-err' : undefined}
          bind:value={form.birthYear}
        />
        {#if errors.birthYear}<p class="err" id="pf-year-err">{errors.birthYear}</p>{/if}
      </div>
      <div class="field">
        <label for="pf-height">Altezza (cm)</label>
        <input
          id="pf-height"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="es. 178"
          aria-invalid={errors.height ? 'true' : undefined}
          aria-describedby={errors.height ? 'pf-height-err' : undefined}
          bind:value={form.height}
        />
        {#if errors.height}<p class="err" id="pf-height-err">{errors.height}</p>{/if}
      </div>
    </div>

    <fieldset>
      <legend>Sesso (per la stima del metabolismo)</legend>
      <div class="options three">
        {#each SEXES as s (s.label)}
          <button type="button" class="opt tap" aria-pressed={form.sex === s.key} onclick={() => (form.sex = s.key)}>
            {s.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Obiettivo</legend>
      <div class="options two">
        {#each GOALS as g (g.key)}
          <button
            type="button"
            class="opt tap"
            aria-pressed={form.goal === g.key}
            onclick={() => (form.goal = form.goal === g.key ? null : g.key)}>{g.label}</button
          >
        {/each}
      </div>
      <p class="hint">Serve solo a colorare le variazioni delle misure. Tocca di nuovo per toglierlo.</p>
    </fieldset>

    <fieldset>
      <legend>Vita di tutti i giorni</legend>
      <div class="options two">
        {#each ACTIVITY_LEVELS as a (a.key)}
          <button type="button" class="opt tap" aria-pressed={form.activityLevel === a.key} onclick={() => (form.activityLevel = a.key)}>
            {a.label}
          </button>
        {/each}
      </div>
      <p class="hint">
        {ACTIVITY_LEVELS.find((a) => a.key === form.activityLevel)?.hint}. Serve solo alla stima delle calorie nella Dieta.
      </p>
    </fieldset>

    {#if result.warnings.length > 0}
      <NoteBox title="Controlla" mark="!">
        {#each result.warnings as w, i (i)}<p class="warn">{w}</p>{/each}
      </NoteBox>
    {/if}
    {#if saveErrors.length > 0}
      <NoteBox title="Profilo non salvato" mark="!">
        {#each saveErrors as e, i (i)}<p class="warn">{e}</p>{/each}
      </NoteBox>
    {/if}

    <p class="hint">L'età si calcola dall'anno di nascita. I dati restano solo su questo telefono.</p>

    <div class="actions">
      <Button variant="ghost" onclick={() => (open = false)}>Annulla</Button>
      <Button tone="progress" type="submit" disabled={busy}>Salva</Button>
    </div>
  </form>
</BottomSheet>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  label,
  legend {
    padding: 0;
    font-size: 13px;
    color: var(--text-2);
  }

  input {
    width: 100%;
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-size: 16px;
  }

  input:focus {
    outline: 2px solid var(--progress);
    outline-offset: 0;
  }

  input[aria-invalid='true'] {
    border-color: var(--tip);
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .options {
    display: grid;
    gap: 6px;
  }
  .options.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .options.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .opt {
    min-height: var(--touch);
    padding: 0 var(--space-2);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-size: 14px;
    color: var(--text-2);
  }

  .opt[aria-pressed='true'] {
    border-color: var(--progress);
    background: var(--progress-tint);
    color: var(--progress);
    font-weight: 700;
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }

  .warn {
    margin: 0;
    font-size: 14px;
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--space-2);
  }
</style>
