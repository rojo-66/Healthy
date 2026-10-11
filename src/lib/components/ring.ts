export interface RingGeometry {
  /** Raggio della traccia (centro del tratto). */
  r: number;
  circumference: number;
  /** Frazione riempita, tra 0 e 1. */
  fraction: number;
  /** `stroke-dasharray`: un solo trattino lungo quanto la circonferenza. */
  dasharray: string;
  /** `stroke-dashoffset`: quanto del trattino resta nascosto (animabile). */
  dashoffset: number;
  /** Lato del quadrato inscritto nel foro: il testo deve stare qui dentro. */
  innerBox: number;
}

export function ringGeometry(size: number, stroke: number, value: number, max: number): RingGeometry {
  const r = Math.max(0, (size - stroke) / 2);
  const circumference = 2 * Math.PI * r;
  const raw = max > 0 && Number.isFinite(value) ? value / max : 0;
  const fraction = Math.min(1, Math.max(0, raw));
  const hole = Math.max(0, r - stroke / 2);
  return {
    r,
    circumference,
    fraction,
    dasharray: `${round(circumference)} ${round(circumference)}`,
    dashoffset: round(circumference * (1 - fraction)),
    innerBox: Math.floor(hole * Math.SQRT2),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Larghezza media di un carattere di JetBrains Mono rispetto alla dimensione del font. */
const MONO_CHAR_RATIO = 0.62;

/** Dimensione del testo perché `text` stia su una riga larga `box` px senza superare `base`. */
export function fitLabelSize(text: string, box: number, base: number, minPx = 8): number {
  const len = Math.max(1, text.length);
  return Math.max(minPx, Math.min(base, Math.floor(box / (len * MONO_CHAR_RATIO))));
}
