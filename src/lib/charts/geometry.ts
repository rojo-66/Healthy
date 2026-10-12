import type { Tone } from '../components/types';

/**
 * Geometria dei grafici di Progressi (SVG fatto a mano, SPEC § 5.7): funzioni pure, testate.
 * Le coordinate sono in pixel CSS: l'SVG usa la larghezza vera del contenitore, così i testi non si deformano.
 */

/** Colore di una serie: quello di una sezione, oppure il viola della massa grassa. */
export type SeriesTone = Tone | 'fat';

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Margini del mockup per i grafici a linea e a barre (tacche a sinistra, date sotto). */
export const LINE_INSETS: Insets = { left: 40, right: 10, top: 14, bottom: 26 };

export interface Plot {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function plotArea(width: number, height: number, insets: Insets): Plot {
  return {
    left: insets.left,
    top: insets.top,
    width: Math.max(1, width - insets.left - insets.right),
    height: Math.max(1, height - insets.top - insets.bottom),
  };
}

const fixed = (n: number) => (Math.round(n * 10) / 10).toString();

/** Percorso di una linea spezzata: "M x y L x y …"; vuoto con meno di 2 punti. */
export function linePath(xs: readonly number[], ys: readonly number[]): string {
  if (xs.length < 2) return '';
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${fixed(x)} ${fixed(ys[i] ?? 0)}`).join(' ');
}

/** Area sotto la linea, chiusa sulla base del grafico. */
export function areaPath(xs: readonly number[], ys: readonly number[], baseY: number): string {
  const line = linePath(xs, ys);
  if (!line) return '';
  return `${line} L ${fixed(xs[xs.length - 1] ?? 0)} ${fixed(baseY)} L ${fixed(xs[0] ?? 0)} ${fixed(baseY)} Z`;
}

/** Rombo pieno (record personale) centrato in (x, y), con mezza diagonale `r`. */
export function diamondPath(x: number, y: number, r: number): string {
  return `M ${fixed(x)} ${fixed(y - r)} L ${fixed(x + r)} ${fixed(y)} L ${fixed(x)} ${fixed(y + r)} L ${fixed(x - r)} ${fixed(y)} Z`;
}

/** Indice del punto più vicino in orizzontale (tocco e trascinamento). */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = -1;
  let dist = Infinity;
  xs.forEach((px, i) => {
    const d = Math.abs(px - x);
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

/**
 * Etichette delle date senza sovrapporsi: sempre la prima e l'ultima, poi le altre se distano
 * almeno `minGap` px dalle vicine già scelte.
 */
export function pickLabels(xs: readonly number[], minGap: number): number[] {
  const n = xs.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  const lastX = xs[n - 1] ?? 0;
  const out = [0];
  for (let i = 1; i < n - 1; i++) {
    const x = xs[i] ?? 0;
    if (x - (xs[out[out.length - 1] ?? 0] ?? 0) >= minGap && lastX - x >= minGap) out.push(i);
  }
  if (lastX - (xs[0] ?? 0) >= minGap) out.push(n - 1);
  else out[0] = n - 1; // due date troppo vicine: resta solo l'ultima
  return out;
}

/**
 * Riquadro del tooltip dentro il grafico: sopra il punto se c'è spazio, altrimenti sotto;
 * in orizzontale centrato sul punto ma mai oltre i bordi.
 */
export function tooltipPosition(
  point: { x: number; y: number },
  box: { width: number; height: number },
  area: { width: number; height: number },
  gap = 12,
): { left: number; top: number } {
  const left = Math.min(Math.max(2, point.x - box.width / 2), Math.max(2, area.width - box.width - 2));
  let top = point.y - gap - box.height;
  if (top < 0) top = point.y + gap;
  top = Math.min(Math.max(0, top), Math.max(0, area.height - box.height));
  return { left, top };
}

/** Barre: larghezza di ogni fascia e della barra (al massimo `maxBar` px, circa il 55 % della fascia). */
export function barLayout(count: number, plot: Plot, maxBar = 30): { band: number; bar: number; x: (i: number) => number } {
  const band = plot.width / Math.max(1, count);
  const bar = Math.max(4, Math.min(maxBar, Math.round(band * 0.55)));
  return { band, bar, x: (i) => plot.left + i * band + (band - bar) / 2 };
}

/** Decimali delle tacche secondo il passo: 0,25 → 2, 0,5 → 1, 2 → 0. */
export function stepDigits(step: number): number {
  for (let d = 0; d <= 3; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-9) return d;
  return 3;
}
