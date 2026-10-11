/** Posizione dell'evidenziatore: `translateX(index * 100%)` della sua stessa larghezza (1/count). */
export function indicatorTransform(index: number, count: number): string {
  const i = count > 0 ? Math.min(count - 1, Math.max(0, index)) : 0;
  return `translateX(${i * 100}%)`;
}

/** Tab da attivare con la tastiera (pattern ARIA "tabs"); `null` se il tasto non c'entra. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
