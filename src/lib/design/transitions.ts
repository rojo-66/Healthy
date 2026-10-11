import type { TransitionConfig } from 'svelte/transition';

/**
 * Funzione di easing equivalente a CSS `cubic-bezier(x1, y1, x2, y2)`.
 * Serve alle transizioni Svelte, che vogliono una funzione JS e non una stringa CSS.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  // x → t: qualche passo di Newton, poi bisezione se la pendenza è piatta.
  function solveT(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-6) {
      if (sampleX(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }

  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveT(x)));
}

/** Stesse curve dei token CSS (--spring, --ease-out). */
export const spring = cubicBezier(0.2, 0.9, 0.3, 1.4);
export const easeOut = cubicBezier(0.2, 0.9, 0.3, 1.05);

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function duration(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

/** Pannello dal basso: entra da sotto lo schermo. */
export function sheet(_node: Element, { duration: ms = 340 } = {}): TransitionConfig {
  return {
    duration: duration(ms),
    easing: easeOut,
    css: (t) => `transform: translateY(${(1 - t) * 100}%)`,
  };
}

export function fade(_node: Element, { duration: ms = 250 } = {}): TransitionConfig {
  return { duration: duration(ms), css: (t) => `opacity: ${t}` };
}

/** Comparsa dal basso (contenuti, banner). */
export function rise(_node: Element, { duration: ms = 300, y = 10 } = {}): TransitionConfig {
  return {
    duration: duration(ms),
    easing: easeOut,
    css: (t) => `opacity: ${t}; transform: translateY(${(1 - t) * y}px)`,
  };
}

/** Apertura verso il basso (fisarmoniche, dettagli). */
export function drop(_node: Element, { duration: ms = 260, y = 6 } = {}): TransitionConfig {
  return {
    duration: duration(ms),
    easing: easeOut,
    css: (t) => `opacity: ${t}; transform: translateY(${(t - 1) * y}px)`,
  };
}

/** "Pop" a molla (spunte, adesivi). */
export function pop(_node: Element, { duration: ms = 350 } = {}): TransitionConfig {
  return {
    duration: duration(ms),
    easing: spring,
    css: (t) => `opacity: ${Math.min(1, t * 1.5)}; transform: scale(${0.6 + 0.4 * t})`,
  };
}
