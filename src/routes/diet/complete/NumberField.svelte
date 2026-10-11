<script lang="ts">
  interface Props {
    label: string;
    value: string;
    /** Unità mostrata accanto, es. "kcal", "g". */
    unit?: string;
    readonly?: boolean;
  }

  let { label, value = $bindable(), unit = '', readonly = false }: Props = $props();
  const id = $props.id();
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="box">
    <input {id} type="text" inputmode="decimal" autocomplete="off" bind:value {readonly} />
    {#if unit}<span class="unit mono" aria-hidden="true">{unit}</span>{/if}
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  label {
    font-size: 12px;
    color: var(--muted);
  }

  .box {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    background: var(--bg);
    border: 1px solid var(--line-strong);
  }

  .box:focus-within {
    outline: 2px solid var(--tone, var(--progress));
  }

  input {
    flex: 1;
    min-width: 0;
    height: var(--touch);
    padding: 0 var(--space-2);
    border: 0;
    background: transparent;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 16px;
    outline: none;
  }

  input[readonly] {
    color: var(--text-2);
  }

  .unit {
    flex: none;
    padding-right: var(--space-2);
    font-size: 12px;
    color: var(--muted);
  }
</style>
