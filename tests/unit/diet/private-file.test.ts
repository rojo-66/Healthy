// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDietImport } from '../../../src/lib/diet/import/detect';
import { previewDietImport } from '../../../src/lib/diet/import/preview';

/**
 * Prova sul file vero del nutrizionista: gira solo sul computer dove esiste `private/` (in .gitignore),
 * in CI viene saltata. Non stampa e non copia nessun dato: controlla solo che l'import riesca.
 */
const PRIVATE_FILE = 'private/dieta-ottobre-2026.json';

describe.skipIf(!existsSync(PRIVATE_FILE))('file MyDiet reale (solo in locale)', () => {
  it('si converte e si valida senza errori', () => {
    const result = parseDietImport(JSON.parse(readFileSync(PRIVATE_FILE, 'utf8')));
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (!result.ok) return;
    expect(result.value.origin).toBe('mydiet');
    expect(result.value.file.days).toHaveLength(7);
    const preview = previewDietImport(result.value, []);
    expect(preview.meals).toBeGreaterThan(0);
    expect(preview.products).toBeGreaterThan(0);
  });
});
