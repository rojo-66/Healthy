<script lang="ts">
  import { tick, untrack } from 'svelte';
  import BottomSheet from '../../lib/components/BottomSheet.svelte';
  import Button from '../../lib/components/Button.svelte';
  import NoteBox from '../../lib/components/NoteBox.svelte';
  import { extractImport } from '../../lib/share/import/entry';
  import {
    CAMERA_CONSTRAINTS,
    CAMERA_UNSUPPORTED,
    cameraErrorMessage,
    scanSize,
    stopStream,
  } from '../../lib/share/qr/camera';
  import type { Frame } from '../../lib/share/qr/decode';

  /**
   * "Scansiona QR" con la fotocamera dell'app (SPEC § 8.4). La fotocamera resta accesa solo mentre il
   * pannello è aperto: si spegne alla lettura, alla chiusura, in background e all'uscita dalla pagina.
   */
  interface Props {
    open: boolean;
    /** Testo letto (un link o un codice di Healthy). */
    onresult: (text: string) => void;
  }

  let { open = $bindable(false), onresult }: Props = $props();

  let video = $state<HTMLVideoElement>();
  let status = $state('');
  let error = $state('');

  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Cresce a ogni avvio/arresto: una richiesta vecchia che arriva tardi non riaccende nulla. */
  let session = 0;
  let decode: ((frame: Frame) => string | null) | null = null;
  let canvas: HTMLCanvasElement | null = null;

  function stop() {
    session++;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    stopStream(stream);
    stream = null;
    if (video) video.srcObject = null;
  }

  async function start() {
    const id = ++session;
    error = '';
    status = 'Avvio la fotocamera…';
    if (!navigator.mediaDevices?.getUserMedia) {
      error = CAMERA_UNSUPPORTED;
      status = '';
      return;
    }
    let media: MediaStream;
    try {
      const [mod, s] = await Promise.all([
        import('../../lib/share/qr/decode'),
        navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS),
      ]);
      decode = mod.decodeQr;
      media = s;
    } catch (e) {
      if (id === session) {
        error = cameraErrorMessage(e);
        status = '';
      }
      return;
    }
    // Il pannello monta il contenuto dopo l'apertura: al primo avvio il <video> può arrivare un attimo dopo.
    if (!video) await tick();
    if (id !== session || !video) {
      stopStream(media);
      return;
    }
    stream = media;
    video.srcObject = media;
    await video.play().catch(() => null);
    status = 'Inquadra il QR mostrato sull’altro telefono.';
    schedule(id);
  }

  function schedule(id: number) {
    timer = setTimeout(() => scan(id), 150);
  }

  function scan(id: number) {
    if (id !== session || !video || !decode) return;
    if (video.readyState < 2 || video.videoWidth === 0) return schedule(id);
    const size = scanSize(video.videoWidth, video.videoHeight);
    canvas ??= document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      error = CAMERA_UNSUPPORTED;
      return stop();
    }
    ctx.drawImage(video, 0, 0, size.width, size.height);
    const text = decode(ctx.getImageData(0, 0, size.width, size.height));
    if (text !== null) {
      if (extractImport(text).ok) {
        stop();
        open = false;
        onresult(text);
        return;
      }
      status = 'Questo QR non è un link di Healthy: inquadra quello mostrato dall’app.';
    }
    schedule(id);
  }

  $effect(() => {
    if (!open) return;
    untrack(() => void start());
    // In background la fotocamera si spegne (e il pannello si chiude).
    const onHidden = () => {
      if (document.visibilityState === 'hidden') open = false;
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  });
</script>

<BottomSheet bind:open title="Scansiona QR" tone="progress" onclose={stop}>
  {#if error}
    <NoteBox title="Fotocamera non disponibile" mark="!" text={error} />
    <Button variant="secondary" tone="progress" block onclick={() => (open = false)}>Incolla o scegli il file</Button>
  {:else}
    <div class="viewfinder">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} playsinline muted autoplay aria-label="Anteprima della fotocamera"></video>
      <span class="frame" aria-hidden="true"></span>
    </div>
    <p class="status" role="status" aria-live="polite">{status}</p>
  {/if}
</BottomSheet>

<style>
  .viewfinder {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    max-height: 60dvh;
    overflow: hidden;
    background: var(--bg);
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .frame {
    position: absolute;
    inset: 12%;
    border: 2px solid var(--tone);
    box-shadow: 0 0 0 100vmax var(--overlay);
    pointer-events: none;
  }

  .status {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }
</style>
