import type { DietPlan } from '../../data/schemas/diet-plans';
import type { DietSaveMode } from '../../data/repo/diet-plans';
import type { DietImport } from '../../diet/import/detect';
import { findConflict } from '../../diet/import/preview';
import type { WorkoutImportStatus } from './workout';

export interface DietImportDecision {
  status: WorkoutImportStatus;
  existing: DietPlan | null;
  actions: readonly DietSaveMode[];
  defaultAction: DietSaveMode;
}

/** Stessa logica delle schede (M3, § 8.4): maggiore → Sostituisci o copia; uguale o minore → solo copia. */
export function decideDietImport(imp: DietImport, plans: readonly DietPlan[]): DietImportDecision {
  const conflict = findConflict(imp, plans);
  if (conflict.kind === 'none') return { status: 'new', existing: null, actions: ['new'], defaultAction: 'new' };
  if (conflict.kind === 'newer') {
    return { status: 'newer', existing: conflict.existing, actions: ['replace', 'copy'], defaultAction: 'replace' };
  }
  const status = imp.file.version === conflict.existing.version ? 'same' : 'older';
  return { status, existing: conflict.existing, actions: ['copy'], defaultAction: 'copy' };
}
