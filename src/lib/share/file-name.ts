/**
 * Parte "sicura" di un nome di file: minuscole senza accenti, solo lettere e cifre separate da `-`,
 * al massimo `max` caratteri ("Pànca & Dorso 💪" → "panca-dorso"). Vuota → `fallback`.
 */
export function safeSlug(text: string, fallback: string, max = 40): string {
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
  return slug || fallback;
}

/** "healthy-scheda-petto-schiena-v4.json". */
export function workoutShareFileName(name: string, version: number): string {
  return `healthy-scheda-${safeSlug(name, 'scheda')}-v${version}.json`;
}
