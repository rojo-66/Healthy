<script lang="ts">
  import type { QrDrawing } from '../../lib/share/qr/encode';

  // QR del link: scuro su bianco con margine, grande. Un solo <svg>: cambiando link cambia solo il disegno.
  interface Props {
    text: string;
    label: string;
  }

  let { text, label }: Props = $props();

  let drawing = $state.raw<QrDrawing | null>(null);
  let failed = $state(false);

  $effect(() => {
    const value = text;
    let alive = true;
    failed = false;
    // Chunk a richiesta (nel precache): generazione locale, nessun servizio esterno.
    import('../../lib/share/qr/encode')
      .then(({ qrDrawing }) => {
        if (alive) drawing = qrDrawing(value);
      })
      .catch(() => {
        if (alive) failed = true;
      });
    return () => {
      alive = false;
    };
  });
</script>

<div class="qr" data-testid="share-qr">
  {#if failed}
    <p class="msg">Non riesco a creare il QR: usa il link o il file.</p>
  {:else}
    <svg
      viewBox="0 0 {drawing?.size ?? 1} {drawing?.size ?? 1}"
      role="img"
      aria-label={label}
      shape-rendering="crispEdges"
      data-version={drawing?.version}
    >
      <rect width="100%" height="100%" fill="var(--qr-light)" />
      {#if drawing}<path d={drawing.path} fill="var(--qr-dark)" />{/if}
    </svg>
  {/if}
</div>

<style>
  .qr {
    display: grid;
    place-items: center;
  }

  svg {
    display: block;
    width: min(100%, 340px);
    height: auto;
    aspect-ratio: 1;
    background: var(--qr-light);
  }

  .msg {
    margin: 0;
    font-size: 14px;
    color: var(--tip);
  }
</style>
