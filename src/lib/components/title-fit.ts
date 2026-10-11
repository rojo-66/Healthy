export const TITLE_MIN_PX = 16;
export const TITLE_MAX_PX = 32;
/** Larghezza media di un carattere di Permanent Marker, in rapporto alla dimensione del font. */
const MARKER_CHAR_RATIO = 0.56;

/**
 * Dimensione del titolo su una riga (TopBanner): più è lungo, più si rimpicciolisce, tra 16 e 32 px.
 * `width` è lo spazio disponibile in px (270 su iPhone 390, tolti freccia e tempo).
 * Sotto i 16 px il titolo non scende: lo taglia l'ellissi CSS.
 */
export function titleFontSize(text: string, width = 270): number {
  const len = Math.max(1, text.trim().length);
  const size = Math.floor(width / (len * MARKER_CHAR_RATIO));
  return Math.max(TITLE_MIN_PX, Math.min(TITLE_MAX_PX, size));
}
