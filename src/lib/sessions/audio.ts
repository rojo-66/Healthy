/**
 * Suono di fine recupero, generato con Web Audio (nessun file audio).
 *
 * iPhone: l'audio va "sbloccato" da un tocco (lo fa "Inizia allenamento", oppure il primo tocco
 * dopo "Riprendi"). Web Audio usa la sessione audio "ambient": si mescola alla musica senza fermarla,
 * ma il tasto silenzioso lo azzittisce. È voluto: l'animazione del cerchio e l'annuncio `aria-live`
 * bastano da soli, e forzare la sessione "playback" fermerebbe la musica dell'utente.
 */

type AudioContextCtor = new () => AudioContext;

export interface AudioEnv {
  AudioContext?: AudioContextCtor;
  webkitAudioContext?: AudioContextCtor;
}

export interface Beeper {
  /** Da chiamare dentro un tocco: crea/riattiva il contesto audio. */
  unlock(): void;
  /** Due note brevi; `false` se l'audio non è disponibile o non è sbloccato. */
  beep(): boolean;
  readonly unlocked: boolean;
}

export function createBeeper(env: AudioEnv = globalThis as unknown as AudioEnv): Beeper {
  let ctx: AudioContext | null = null;

  function tone(c: AudioContext, start: number, freq: number) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }

  return {
    unlock() {
      const Ctor = env.AudioContext ?? env.webkitAudioContext;
      if (!Ctor) return;
      try {
        ctx ??= new Ctor();
        if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
        // Un campione muto dentro il gesto: su iOS è ciò che sblocca davvero l'uscita.
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        ctx = null;
      }
    },
    beep() {
      if (!ctx || ctx.state !== 'running') return false;
      try {
        const t = ctx.currentTime + 0.01;
        tone(ctx, t, 880);
        tone(ctx, t + 0.24, 1175);
        return true;
      } catch {
        return false;
      }
    },
    get unlocked() {
      return ctx?.state === 'running';
    },
  };
}

/** Unico per l'app: sbloccato nell'Intro, usato nel Live. */
export const beeper = createBeeper();
