// Genera src/lib/workouts/library/data.ts dalla libreria open source free-exercise-db (Unlicense, pubblico dominio).
// Script di sviluppo: non entra nella build dell'app. Uso: `npm run library` (oppure `node scripts/library/build.mjs <file.json>`).
// Della fonte si tengono solo nome, muscoli e attrezzo: niente istruzioni, niente immagini.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../../src/lib/workouts/library/data.ts');

/** Commit fissato: aggiornarlo è una scelta esplicita (poi `npm run library` e i test). */
const SOURCE_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const SOURCE_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${SOURCE_COMMIT}/dist/exercises.json`;

const CATEGORIES = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'plyometrics']);

// Stesse liste di src/lib/workouts/library/muscles.ts.
const MUSCLE_MAP = {
  chest: 'Petto',
  lats: 'Dorsali',
  'middle back': 'Dorsali',
  traps: 'Trapezi',
  shoulders: 'Spalle',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Avambracci',
  abdominals: 'Addominali',
  'lower back': 'Lombari',
  glutes: 'Glutei',
  abductors: 'Glutei',
  quadriceps: 'Quadricipiti',
  hamstrings: 'Femorali',
  adductors: 'Adduttori',
  calves: 'Polpacci',
  neck: null,
};
const MUSCLES = new Set(Object.values(MUSCLE_MAP).filter(Boolean));

const EQUIPMENT_MAP = {
  barbell: 'Bilanciere',
  'e-z curl bar': 'Bilanciere EZ',
  dumbbell: 'Manubri',
  machine: 'Macchina',
  cable: 'Cavi',
  'body only': 'Corpo libero',
  kettlebells: 'Kettlebell',
  bands: 'Elastico',
  'medicine ball': 'Palla medica',
  'exercise ball': 'Fitball',
  other: 'Altro',
};
const EQUIPMENT = new Set([...Object.values(EQUIPMENT_MAP), 'Multipower', 'Altro']);

const MAX_MUSCLES = 4;
const MAX_ID = 64;
const MAX_NAME = 120;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function slug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapMuscles(primary, secondary) {
  const out = [];
  for (const m of [...primary, ...secondary]) {
    if (!(m in MUSCLE_MAP)) fail(`muscolo sconosciuto nella fonte: ${m}`);
    const it = MUSCLE_MAP[m];
    if (it && !out.includes(it)) out.push(it);
  }
  return out.slice(0, MAX_MUSCLES);
}

function mapEquipment(source) {
  if (source.equipment === null || source.equipment === undefined) return 'Altro';
  if (/smith/i.test(source.name) && source.equipment === 'machine') return 'Multipower';
  const it = EQUIPMENT_MAP[source.equipment];
  if (!it) fail(`attrezzo sconosciuto nella fonte: ${source.equipment}`);
  return it;
}

async function loadSource() {
  const path = process.argv[2];
  if (path) return JSON.parse(readFileSync(path, 'utf8'));
  const response = await fetch(SOURCE_URL);
  if (!response.ok) fail(`download non riuscito (${response.status}): ${SOURCE_URL}`);
  return response.json();
}

const source = await loadSource();
const namesIt = JSON.parse(readFileSync(join(HERE, 'names-it.json'), 'utf8'));
const extra = JSON.parse(readFileSync(join(HERE, 'extra.json'), 'utf8'));

const sourceIds = new Set(source.map((e) => e.id));
for (const id of Object.keys(namesIt)) if (!sourceIds.has(id)) fail(`names-it.json: «${id}» non esiste nella fonte`);

/** @type {[string, string, string[], string][]} */
const rows = [];
for (const e of source) {
  if (!CATEGORIES.has(e.category)) continue;
  const muscles = mapMuscles(e.primaryMuscles ?? [], e.secondaryMuscles ?? []);
  if (muscles.length === 0) continue; // solo collo: fuori dalla lista dei muscoli
  rows.push([`fx-${slug(e.id)}`, (namesIt[e.id] ?? e.name).trim(), muscles, mapEquipment(e)]);
}
for (const x of extra) {
  for (const m of x.muscles) if (!MUSCLES.has(m)) fail(`extra.json: muscolo non in lista: ${m}`);
  if (!EQUIPMENT.has(x.equipment)) fail(`extra.json: attrezzo non in lista: ${x.equipment}`);
  rows.push([`it-${x.slug}`, x.name.trim(), x.muscles, x.equipment]);
}

// Controlli: id e nomi unici, lunghezze dei limiti di src/lib/data/limits.ts.
const ids = new Set();
const names = new Map();
for (const [id, name] of rows) {
  if (!/^[a-z0-9-]+$/.test(id) || id.length > MAX_ID) fail(`id non valido: ${id}`);
  if (ids.has(id)) fail(`id ripetuto: ${id}`);
  ids.add(id);
  if (!name || name.length > MAX_NAME) fail(`nome non valido per ${id}`);
  const key = name.toLowerCase();
  if (names.has(key)) fail(`nome ripetuto: «${name}» (${names.get(key)} e ${id})`);
  names.set(key, id);
}

// Un id pubblicato non sparisce mai: schede e sessioni possono usarlo.
if (existsSync(OUT)) {
  const previous = [...readFileSync(OUT, 'utf8').matchAll(/^\s*\["([a-z0-9-]+)"/gm)].map((m) => m[1]);
  const missing = previous.filter((id) => !ids.has(id));
  if (missing.length > 0) fail(`id spariti rispetto al file attuale: ${missing.join(', ')}`);
}

rows.sort((a, b) => a[1].localeCompare(b[1], 'it'));
// Esercizi comuni (nome italiano o aggiunti a mano): in cima all'elenco della libreria.
const common = rows.filter(([id]) => id.startsWith('it-') || Object.keys(namesIt).some((k) => `fx-${slug(k)}` === id)).map(([id]) => id);
const italian = common.length;
const commonBody = common.map((id) => `  ${JSON.stringify(id)},`).join('\n');

const body = rows.map((row) => `  ${JSON.stringify(row)},`).join('\n');
writeFileSync(
  OUT,
  `// File generato da scripts/library/build.mjs: non modificare a mano.
// Fonte: free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense), commit ${SOURCE_COMMIT},
// più gli esercizi di scripts/library/extra.json. Nomi italiani da scripts/library/names-it.json.
import type { LibraryEntry } from './muscles';

export const LIBRARY: readonly LibraryEntry[] = [
${body}
];

/** Esercizi comuni, con nome italiano: vengono prima nell'elenco della libreria. */
export const COMMON_IDS: ReadonlySet<string> = new Set([
${commonBody}
]);
`,
);
console.log(`✓ ${rows.length} esercizi (${italian} con nome italiano) → ${OUT}`);
