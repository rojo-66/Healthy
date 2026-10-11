<script lang="ts" module>
  import type { IconName } from './Icon.svelte';
  import type { Tone } from './types';

  export type NavId = 'oggi' | 'allena' | 'dieta' | 'progressi' | 'profilo';

  // Colori dai mockup: la voce attiva prende il colore della sua sezione (Oggi = verde come in Main).
  export const NAV_ITEMS: readonly { id: NavId; label: string; href: string; icon: IconName; tone: Tone }[] = [
    { id: 'oggi', label: 'Oggi', href: '#/', icon: 'home', tone: 'food' },
    { id: 'allena', label: 'Allena', href: '#/allena', icon: 'training', tone: 'training' },
    { id: 'dieta', label: 'Dieta', href: '#/dieta', icon: 'food', tone: 'food' },
    { id: 'progressi', label: 'Progressi', href: '#/progressi', icon: 'progress', tone: 'progress' },
    { id: 'profilo', label: 'Profilo', href: '#/profilo', icon: 'profile', tone: 'progress' },
  ];
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    active: NavId | null;
    /** Se presente intercetta il tocco al posto della navigazione (usato nella pagina di prova). */
    onnavigate?: (id: NavId) => void;
  }

  let { active, onnavigate }: Props = $props();

  function onclick(e: MouseEvent, id: NavId) {
    if (!onnavigate) return;
    e.preventDefault();
    onnavigate(id);
  }
</script>

<nav class="nav" aria-label="Navigazione principale">
  {#each NAV_ITEMS as item (item.id)}
    <a
      class="item tap tone-{item.tone}"
      class:active={item.id === active}
      href={item.href}
      aria-current={item.id === active ? 'page' : undefined}
      onclick={(e) => onclick(e, item.id)}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </a>
  {/each}
</nav>

<style>
  .nav {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-1);
    padding: 10px calc(var(--space-3) + var(--safe-right)) max(10px, calc(var(--safe-bottom) + 4px))
      calc(var(--space-3) + var(--safe-left));
    background: rgba(18, 20, 26, 0.94);
    border-top: 1px solid var(--line);
  }

  .item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-width: 0;
    min-height: var(--touch);
    text-decoration: none;
    color: var(--muted);
    font-size: 11px;
  }

  .item span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .active {
    color: var(--tone);
    font-weight: 700;
  }
</style>
