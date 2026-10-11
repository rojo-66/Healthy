import { tick } from 'svelte';

const EASE = 'cubic-bezier(.2,.9,.3,1.1)';

/**
 * Animazione FLIP delle righe (Su/Giù, duplica, elimina): misura, aggiorna, poi ogni riga parte
 * dalla posizione vecchia e scivola nella nuova. Solo `transform`. Righe = figli diretti con `data-row` e `data-key`.
 */
export async function flipRows(list: HTMLElement | undefined, update: () => void, reduceMotion: boolean): Promise<void> {
  const rows = () => (list ? [...list.querySelectorAll<HTMLElement>(':scope > [data-row]')] : []);
  const before = new Map(rows().map((r) => [r.dataset['key'] ?? '', r.getBoundingClientRect().top]));
  update();
  await tick();
  if (reduceMotion || !list) return;
  const moved: HTMLElement[] = [];
  for (const r of rows()) {
    const old = before.get(r.dataset['key'] ?? '');
    if (old === undefined) continue;
    const dy = old - r.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    r.style.transition = 'none';
    r.style.transform = `translateY(${dy}px)`;
    moved.push(r);
  }
  if (moved.length === 0) return;
  void list.offsetHeight; // applica la posizione di partenza
  for (const r of moved) {
    r.style.transition = `transform .28s ${EASE}`;
    r.style.transform = '';
  }
  window.setTimeout(() => {
    for (const r of moved) r.style.transition = '';
  }, 320);
}
