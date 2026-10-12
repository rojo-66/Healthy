<script lang="ts">
  import Icon from '../../../lib/components/Icon.svelte';
  import Stepper from '../../../lib/components/Stepper.svelte';
  import type { FieldErrors } from '../../../lib/workouts/calc/editor-schema';
  import { enablePyramid, setSetsCount, setUniform, updateSetDetail } from '../../../lib/workouts/calc/sets-detail';
  import {
    KG_CONFIRM_ABOVE,
    KG_MAX,
    kgStep,
    REPS_CONFIRM_ABOVE,
    REPS_MAX,
    REPS_MIN,
    restOptions,
    SETS_MAX,
    SETS_MIN,
  } from '../../../lib/workouts/calc/values';
  import type { DraftItem } from '../../../lib/data/schemas/workout-draft';
  import { drop } from '../../../lib/design/transitions';
  import { itemSummary } from '../../../lib/workouts/format';

  interface Props {
    item: DraftItem;
    index: number;
    count: number;
    open: boolean;
    /** Errori di questo esercizio (chiavi senza `items.N.`). */
    errors: FieldErrors;
    ontoggle: () => void;
    onchange: (next: DraftItem) => void;
    /** Disattivare le serie diverse: decide il genitore (conferma se erano davvero diverse). */
    onpyramidoff: () => void;
    onmove: (dir: -1 | 1) => void;
    onduplicate: () => void;
    onremove: () => void;
    ongrip: (event: PointerEvent) => void;
  }

  let { item, index, count, open, errors, ontoggle, onchange, onpyramidoff, onmove, onduplicate, onremove, ongrip }: Props =
    $props();

  const uid = $props.id();
  const hasErrors = $derived(Object.keys(errors).length > 0);
  const urlOk = $derived(/^https:\/\/[^\s]+$/.test(item.videoUrl.trim()));

  function togglePyramid() {
    if (item.setsDetail) onpyramidoff();
    else onchange(enablePyramid(item));
  }
</script>

<div class="ex tone-training" class:open class:has-errors={hasErrors} data-row data-key={item.key} data-testid="exercise-row">
  <div class="head">
    <span
      class="grip"
      aria-hidden="true"
      title="Tieni premuto e trascina per spostare"
      data-testid="grip"
      onpointerdown={ongrip}
      oncontextmenu={(e) => e.preventDefault()}>⠿</span
    >
    <button type="button" class="toggle tap" aria-expanded={open} aria-controls="{uid}-body" onclick={ontoggle}>
      <span class="num mono" aria-hidden="true">{index + 1}</span>
      <span class="text">
        <span class="name">{item.name || 'Esercizio senza nome'}</span>
        <span class="sum mono">{itemSummary(item)}</span>
      </span>
      {#if hasErrors}<span class="err-dot" aria-label="Da correggere">!</span>{/if}
      <span class="chev" aria-hidden="true"><Icon name="chevronDown" size={16} /></span>
    </button>
  </div>

  {#if open}
    <div class="body" id="{uid}-body" in:drop>
      {#if errors['name']}<p class="err" data-error>Nome: {errors['name']}</p>{/if}
      <div class="steppers" class:single={!!item.setsDetail}>
        <Stepper
          label="Serie"
          value={item.sets}
          min={SETS_MIN}
          max={SETS_MAX}
          decLabel="Una serie in meno"
          incLabel="Una serie in più"
          onchange={(v) => onchange(setSetsCount(item, v))}
        />
        {#if !item.setsDetail}
          <Stepper
            label="Ripetizioni"
            value={item.reps}
            min={REPS_MIN}
            max={REPS_MAX}
            confirmAbove={REPS_CONFIRM_ABOVE}
            decLabel="Una ripetizione in meno"
            incLabel="Una ripetizione in più"
            onchange={(v) => onchange(setUniform(item, { reps: v }))}
          />
          <Stepper
            label="Kg"
            value={item.kg}
            min={0}
            max={KG_MAX}
            step={2.5}
            confirmAbove={KG_CONFIRM_ABOVE}
            next={kgStep}
            decLabel="Meno 2,5 kg"
            incLabel="Più 2,5 kg"
            onchange={(v) => onchange(setUniform(item, { kg: v }))}
          />
        {/if}
      </div>
      {#if errors['sets']}<p class="err" data-error>Serie: {errors['sets']}</p>{/if}
      {#if errors['reps']}<p class="err" data-error>Ripetizioni: {errors['reps']}</p>{/if}

      <button
        type="button"
        class="switch tap"
        role="switch"
        aria-checked={!!item.setsDetail}
        onclick={togglePyramid}
      >
        <span class="knob" aria-hidden="true"><span></span></span>
        Serie diverse tra loro (es. piramidale)
      </button>

      {#if item.setsDetail}
        <div class="pyramid" role="group" aria-label="Serie di {item.name}">
          <div class="p-head mono" aria-hidden="true"><span>Serie</span><span>Rip</span><span>Kg</span></div>
          {#each item.setsDetail as set, j (j)}
            <div class="p-row">
              <span class="p-n mono">{j + 1}</span>
              <Stepper
                layout="inline"
                label="Serie {j + 1}, ripetizioni"
                value={set.reps}
                min={REPS_MIN}
                max={REPS_MAX}
                confirmAbove={REPS_CONFIRM_ABOVE}
                invalid={!!errors[`setsDetail.${j}.reps`]}
                onchange={(v) => onchange(updateSetDetail(item, j, { reps: v }))}
              />
              <Stepper
                layout="inline"
                label="Serie {j + 1}, kg"
                value={set.kg}
                min={0}
                max={KG_MAX}
                step={2.5}
                confirmAbove={KG_CONFIRM_ABOVE}
                next={kgStep}
                onchange={(v) => onchange(updateSetDetail(item, j, { kg: v }))}
              />
            </div>
          {/each}
        </div>
      {/if}

      <div class="field">
        <span class="mono-label sub">Recupero</span>
        <div class="rests" role="group" aria-label="Recupero tra le serie">
          {#each restOptions(item.restSec) as sec (sec)}
            <button
              type="button"
              class="rest tap mono"
              aria-pressed={item.restSec === sec}
              aria-label="Recupero {sec} secondi"
              onclick={() => onchange({ ...item, restSec: sec })}>{sec} s</button
            >
          {/each}
        </div>
      </div>

      <div class="field">
        <label class="mono-label sub note-label" for="{uid}-note">✎ Nota per il cliente</label>
        <textarea
          id="{uid}-note"
          rows="3"
          placeholder="Esecuzione, errori da evitare, quando scalare il carico…"
          value={item.note}
          oninput={(e) => onchange({ ...item, note: e.currentTarget.value })}
        ></textarea>
        {#if errors['note']}<p class="err" data-error>{errors['note']}</p>{/if}
      </div>

      <div class="field">
        <label class="mono-label sub video-label" for="{uid}-video">▶ Link video</label>
        <input
          id="{uid}-video"
          type="url"
          inputmode="url"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="https://… (si apre con la rete)"
          value={item.videoUrl}
          aria-invalid={errors['videoUrl'] ? 'true' : undefined}
          oninput={(e) => onchange({ ...item, videoUrl: e.currentTarget.value })}
        />
        {#if errors['videoUrl']}
          <p class="err" data-error>{errors['videoUrl']}</p>
        {:else if urlOk}
          <a class="video-link" href={item.videoUrl.trim()} target="_blank" rel="noopener noreferrer">Apri il video ↗</a>
        {/if}
      </div>

      <div class="actions">
        <button type="button" class="act tap" disabled={index === 0} onclick={() => onmove(-1)}
          >↑ Su<span class="visually-hidden">: sposta {item.name} più in alto</span></button
        >
        <button type="button" class="act tap" disabled={index === count - 1} onclick={() => onmove(1)}
          >↓ Giù<span class="visually-hidden">: sposta {item.name} più in basso</span></button
        >
        <button type="button" class="act tap" onclick={onduplicate}
          >Duplica<span class="visually-hidden"> {item.name}</span></button
        >
        <button type="button" class="act danger tap" onclick={onremove}
          >Elimina<span class="visually-hidden"> {item.name}</span></button
        >
      </div>
    </div>
  {:else if hasErrors}
    <p class="err closed" data-error>Da correggere: tocca per aprire.</p>
  {/if}
</div>

<style>
  .ex {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    box-shadow: inset 0 0 0 1px transparent;
    transition: box-shadow 0.25s ease;
  }

  .ex.open {
    box-shadow: inset 0 0 0 1px var(--tone-edge);
  }

  .ex.has-errors {
    box-shadow: inset 0 0 0 1px var(--tip-edge);
  }

  /* Riga sollevata durante il trascinamento: ombra che compare solo con l'opacità. */
  .ex::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow:
      0 12px 28px rgba(0, 0, 0, 0.55),
      inset 0 0 0 1px var(--tone);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .ex:global([data-dragging]) {
    z-index: 2;
  }

  .ex:global([data-dragging])::after {
    opacity: 1;
  }

  .head {
    display: flex;
    align-items: stretch;
  }

  .grip {
    width: var(--touch);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    color: var(--muted);
    font-size: 18px;
    cursor: grab;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    transition: transform var(--dur-ind) var(--spring);
  }

  /* Feedback della pressione lunga in corso. */
  .grip:global([data-pressing]) {
    transform: scale(1.25);
    color: var(--tone);
  }

  .toggle {
    flex: 1;
    min-width: 0;
    min-height: 60px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px 12px 0;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
  }

  .num {
    display: grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    background: var(--bg);
    color: var(--tone);
    font-weight: 700;
    font-size: 13px;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .name {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sum {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .err-dot {
    display: grid;
    place-items: center;
    flex: none;
    width: 20px;
    height: 20px;
    background: var(--tip);
    color: var(--on-tone);
    font-weight: 700;
    font-size: 12px;
  }

  .chev {
    display: flex;
    flex-shrink: 0;
    color: var(--muted);
    transition: transform 0.25s ease;
  }

  .open .chev {
    transform: rotate(180deg);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 14px 16px;
  }

  .steppers {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .steppers.single {
    grid-template-columns: minmax(0, 1fr);
    max-width: 50%;
  }

  .switch {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--touch);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-2);
    font-size: 14px;
    text-align: left;
  }

  .knob {
    position: relative;
    flex: none;
    width: 40px;
    height: 24px;
    background: var(--bg);
    border: 1px solid var(--line-strong);
  }

  .knob span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    background: var(--muted);
    transition: transform 0.2s var(--spring);
  }

  .switch[aria-checked='true'] .knob {
    border-color: var(--tone);
  }

  .switch[aria-checked='true'] .knob span {
    transform: translateX(16px);
    background: var(--tone);
  }

  .pyramid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .p-head,
  .p-row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px;
    align-items: center;
  }

  .p-head {
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--muted);
    text-align: center;
  }

  .p-n {
    text-align: center;
    color: var(--tone);
    font-weight: 700;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sub {
    font-size: 10px;
    letter-spacing: 1px;
  }

  .note-label {
    letter-spacing: 2px;
    color: var(--tip);
  }

  .video-label {
    letter-spacing: 2px;
    color: var(--progress);
  }

  .rests {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(52px, 1fr));
    gap: 6px;
  }

  .rest {
    height: var(--touch);
    padding: 0;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    font-weight: 700;
    font-size: 13px;
  }

  .rest[aria-pressed='true'] {
    background: var(--tone-tint);
    color: var(--tone);
    border-color: var(--tone);
  }

  textarea {
    padding: 10px 12px;
    background: var(--tip-tint);
    border: 1px dashed var(--tip-edge);
    color: var(--text);
    font-size: 16px;
    line-height: 1.45;
    resize: none;
  }

  input {
    height: var(--touch);
    padding: 0 12px;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 16px;
  }

  input[aria-invalid='true'] {
    border-color: var(--tip);
  }

  textarea:focus,
  input:focus {
    outline: 1px solid var(--tone);
    outline-offset: 0;
  }

  .video-link {
    align-self: flex-start;
    display: flex;
    align-items: center;
    min-height: var(--touch);
    font-size: 14px;
    font-weight: 700;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .act {
    height: var(--touch);
    padding: 0;
    background: transparent;
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 12px;
  }

  .act:disabled {
    opacity: 0.38;
  }

  .act.danger {
    border-color: var(--tip-edge);
    color: var(--tip);
  }

  .err {
    margin: 0;
    font-size: 13px;
    color: var(--tip);
  }

  .err.closed {
    padding: 0 14px 12px var(--touch);
  }
</style>
