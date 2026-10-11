<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ToneOrNeutral } from './types';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost';
    tone?: ToneOrNeutral;
    /** sm/md = 44/48 px; lg = 54 px, maiuscolo (azioni principali come "Termina allenamento"). */
    size?: 'sm' | 'md' | 'lg';
    /** Se presente il pulsante diventa un link `<a>`. */
    href?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
    block?: boolean;
    /** Obbligatorio quando il pulsante ha solo l'icona. */
    label?: string;
    pressed?: boolean;
    /** Solo per la pagina di prova: blocca l'aspetto "premuto". */
    showPressed?: boolean;
    onclick?: (event: MouseEvent) => void;
    icon?: Snippet;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    tone = 'neutral',
    size = 'md',
    href,
    type = 'button',
    disabled = false,
    block = false,
    label,
    pressed,
    showPressed = false,
    onclick,
    icon,
    children,
  }: Props = $props();

  const iconOnly = $derived(!children);
  const cls = $derived(
    ['btn', 'tap', variant, size, `tone-${tone}`, block && 'block', iconOnly && 'icon-only'].filter(Boolean).join(' '),
  );
</script>

{#if href && !disabled}
  <a class={cls} {href} aria-label={label} data-pressed={showPressed || undefined} {onclick}>
    {@render icon?.()}
    {@render children?.()}
  </a>
{:else}
  <button
    class={cls}
    {type}
    {disabled}
    aria-label={label}
    aria-pressed={pressed}
    data-pressed={showPressed || undefined}
    {onclick}
  >
    {@render icon?.()}
    {@render children?.()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-width: var(--touch);
    min-height: var(--touch);
    padding: 0 var(--space-5);
    border: 0;
    border-radius: 0;
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.1;
    text-decoration: none;
    text-align: center;
  }

  .md {
    min-height: 48px;
  }

  .lg {
    min-height: 54px;
    font-size: 16px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .block {
    display: flex;
    width: 100%;
  }

  .icon-only {
    padding: 0;
  }

  /* Primario: pieno nel colore di sezione, angolo tagliato. */
  .primary {
    background: var(--tone);
    color: var(--on-tone);
    clip-path: polygon(
      var(--cut-m) 0,
      100% 0,
      100% calc(100% - var(--cut-m)),
      calc(100% - var(--cut-m)) 100%,
      0 100%,
      0 var(--cut-m)
    );
  }
  .primary.tone-neutral {
    background: var(--text);
  }
  /* clip-path taglierebbe l'outline esterno: lo disegno dentro. */
  .primary:focus-visible {
    outline: 2px solid var(--bg);
    outline-offset: -5px;
  }

  /* Secondario: contorno nel colore di sezione; neutro = grafite come i pulsanti ±15 s. */
  .secondary {
    background: transparent;
    color: var(--tone);
    border: 1px solid var(--tone);
  }
  .secondary.tone-neutral {
    background: var(--bg);
    color: var(--text);
    border-color: var(--line);
  }

  .ghost {
    background: transparent;
    color: var(--tone);
  }
  .ghost.tone-neutral {
    color: var(--text-2);
  }

  .btn[aria-pressed='true'].secondary {
    background: var(--tone-tint);
  }
  .btn[aria-pressed='true'].secondary.tone-neutral {
    background: var(--surface);
    border-color: var(--text-2);
  }

  .btn:disabled {
    opacity: 0.38;
    cursor: default;
  }
</style>
