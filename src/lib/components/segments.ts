export type SegmentKind = 'empty' | 'partial' | 'full';

export interface Segment {
  done: number;
  total: number;
}

/** Riempimento di un segmento (un esercizio): serie fatte / serie previste. */
export function segmentState({ done, total }: Segment): { fraction: number; kind: SegmentKind } {
  const fraction = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const kind: SegmentKind = fraction === 0 ? 'empty' : fraction === 1 ? 'full' : 'partial';
  return { fraction, kind };
}
