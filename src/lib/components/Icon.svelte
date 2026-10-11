<script lang="ts" module>
  // Icone a tratto dei mockup (viewBox 24×24). Sempre decorative: il nome va su aria-label del controllo.
  const PATHS = {
    back: 'M15 4l-8 8 8 8',
    forward: 'M9 4l8 8-8 8',
    chevronDown: 'M6 9l6 6 6-6',
    close: 'M6 6l12 12M18 6L6 18',
    file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6',
    check: 'M4 12l5 5L20 6',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    share: 'M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
    play: 'M7 4v16l13-8z',
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    training: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
    food: 'M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 6 0 8v10',
    progress: 'M3 20h18M6 16l4-5 3 3 5-7',
    profile: 'M4 21c1-4 4-6 8-6s7 2 8 6M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  } as const;

  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  interface Props {
    name: IconName;
    size?: number;
    stroke?: number;
  }

  let { name, size = 22, stroke = 2 }: Props = $props();
  const filled = $derived(name === 'play');
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke={filled ? 'none' : 'currentColor'}
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d={PATHS[name]} />
</svg>

<style>
  svg {
    flex-shrink: 0;
    display: block;
  }
</style>
