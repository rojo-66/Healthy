import { OBSERVATION_DISCLAIMER, type Observation } from '../diet/calc/observations';
import { fnv1a } from '../hash';

/**
 * Tip del giorno (Home): scelto in modo deterministico (stessa data = stesso tip) tra le osservazioni
 * dell'app su quel giorno del piano (M3) e un piccolo elenco di consigli generici.
 * Niente consigli medici, niente promesse. Con un piano del nutrizionista i consigli non parlano mai di
 * quantità o di cibi da aggiungere: il piano non si contraddice.
 */

export interface Tip {
  text: string;
  source: 'observation' | 'generic';
  /** "L'app non modifica il piano: segnala soltanto." per le osservazioni. */
  disclaimer: string;
}

export interface TipContext {
  /** Tipo di giornata (`gym`, `run`, `rest` o altro). */
  dayTypeKey: string;
  /** C'è un piano alimentare attivo (in M3–M6 sono tutti del nutrizionista). */
  hasPlan: boolean;
}

type TipTag = 'any' | 'gym' | 'run' | 'rest';

interface GenericTip {
  text: string;
  tags: readonly TipTag[];
  /** Solo senza piano: suggerisce cosa mangiare, quindi potrebbe contraddire un piano. */
  noPlanOnly?: boolean;
}

export const GENERIC_TIPS: readonly GenericTip[] = [
  {
    text: 'Tieni una borraccia a portata di mano: qualche sorso ogni tanto è più facile che recuperare tutto la sera.',
    tags: ['any'],
  },
  { text: 'Un bicchiere d’acqua appena sveglio è un modo semplice per iniziare la giornata.', tags: ['any'] },
  { text: 'Porta l’acqua in palestra e bevi qualche sorso tra una serie e l’altra.', tags: ['gym'] },
  {
    text: 'Prova ad andare a dormire più o meno alla stessa ora, anche nel weekend: il ritmo regolare aiuta il recupero.',
    tags: ['any'],
  },
  { text: 'La sera metti da parte il telefono qualche minuto prima di dormire: lo schermo tiene svegli.', tags: ['any'] },
  {
    text: 'Prima dei carichi pesanti dedica cinque minuti alla mobilità di spalle e anche: entri meglio nei movimenti.',
    tags: ['gym'],
  },
  { text: 'Se passi tante ore seduto, alzati ogni tanto e fai due passi: anche le pause brevi contano.', tags: ['any'] },
  {
    text: 'Giorno di riposo: una camminata tranquilla o un po’ di stretching leggero tengono il corpo sciolto.',
    tags: ['rest'],
  },
  { text: 'Il riposo fa parte del programma: è nei giorni di pausa che il corpo si adatta al lavoro fatto.', tags: ['rest'] },
  {
    text: 'Dopo l’allenamento scrivi nelle note per il PT come ti sei sentito: lo aiuta a regolare la scheda.',
    tags: ['gym'],
  },
  {
    text: 'Se oggi ti senti davvero scarico, una sessione più leggera è meglio di nessuna: ascolta come stai.',
    tags: ['gym'],
  },
  { text: 'Giorno di corsa: parti piano nei primi minuti e accelera solo quando il respiro è regolare.', tags: ['run'] },
  {
    text: 'Prepara la sera prima ciò che ti serve per i pasti di domani: seguire il piano diventa più semplice.',
    tags: ['any'],
  },
  {
    text: 'Le proteine si sfruttano meglio distribuite nella giornata: segui le porzioni del piano a ogni pasto, senza saltarne.',
    tags: ['any'],
  },
  {
    text: 'Prova a inserire una fonte di proteine in ogni pasto principale: uova, legumi, pesce, carne o latticini.',
    tags: ['any'],
    noPlanOnly: true,
  },
];

/** Osservazioni che hanno senso come tip: scarto dal target e verdura (non "in linea" né "non posso confrontare"). */
const TIP_OBSERVATIONS = new Set<Observation['kind']>(['deviation', 'no-vegetables']);

/** Consigli generici adatti a quel giorno. */
export function genericTipsFor(context: TipContext): GenericTip[] {
  const tag: TipTag | null = context.dayTypeKey === 'gym' || context.dayTypeKey === 'run' || context.dayTypeKey === 'rest' ? context.dayTypeKey : null;
  return GENERIC_TIPS.filter(
    (tip) => (tip.tags.includes('any') || (tag !== null && tip.tags.includes(tag))) && !(tip.noPlanOnly && context.hasPlan),
  );
}

export function dailyTip(dateIso: string, observations: readonly Observation[], context: TipContext): Tip {
  const pool: Tip[] = [
    ...observations
      .filter((o) => TIP_OBSERVATIONS.has(o.kind))
      .map((o): Tip => ({ text: o.text, source: 'observation', disclaimer: OBSERVATION_DISCLAIMER })),
    ...genericTipsFor(context).map((t): Tip => ({ text: t.text, source: 'generic', disclaimer: '' })),
  ];
  return pool[fnv1a(dateIso) % pool.length]!;
}
