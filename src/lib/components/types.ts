/** Colore di sezione (SPEC § 3): magenta allenamento, verde alimentazione, ciano progressi, giallo consigli. */
export type Tone = 'training' | 'food' | 'progress' | 'tip';

/** Come `Tone`, più il neutro (grafite) per i controlli che non appartengono a una sezione. */
export type ToneOrNeutral = Tone | 'neutral';
