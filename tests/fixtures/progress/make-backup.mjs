// Genera `backup-progress.json`: 3 mesi di dati FINTI (nessun dato personale) fino a lunedì 12/10/2026,
// per i test di Progressi (M9). Uso: `node tests/fixtures/progress/make-backup.mjs`.
// Deterministico: rigenerarlo dà sempre lo stesso file.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const diet = JSON.parse(readFileSync(join(here, '..', 'diet-extended.json'), 'utf8'));

const pad = (n) => String(n).padStart(2, '0');
function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
const uuid = (prefix, n) => `${prefix}${String(n).padStart(6, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const round1 = (n) => Math.round(n * 10) / 10;

// --- Profilo e misure -------------------------------------------------------------------------
const profile = { id: 'me', name: 'Persona Finta', birthYear: 1990, sex: 'M', heightCm: 178, goal: 'recomp', activityLevel: 'sedentary' };

const EMPTY = {
  weightKg: null, fmKg: null, fmPct: null, ffmKg: null, bcmKg: null, tbwL: null, ecwL: null, phaDeg: null, bmrKcal: null,
  chestCm: null, waistCm: null, abdomenCm: null, hipsCm: null, thighCm: null, armCm: null, calfCm: null, notes: '',
};
const BIA = {
  '2026-07-17': { weightKg: 87.5, fmKg: 19.9, ffmKg: 67.6, bcmKg: 39.7, tbwL: 49.5, ecwL: 20.4, phaDeg: 7.1, bmrKcal: 1850,
    chestCm: 105.5, waistCm: 90.4, abdomenCm: 97.2, hipsCm: 102.8, thighCm: 62, armCm: 37.5, calfCm: 42 },
  '2026-08-21': { weightKg: 88.1, fmKg: 19.2, ffmKg: 68.9, bcmKg: 39.9, tbwL: 50.6, ecwL: 21.2, phaDeg: 6.9, bmrKcal: 1872,
    chestCm: 106.4, waistCm: 90.8, abdomenCm: 96.9, hipsCm: 102.1, thighCm: 62.3, armCm: 37.6, calfCm: 42.1 },
  '2026-10-02': { weightKg: 88.9, fmKg: 18.5, ffmKg: 70.4, bcmKg: 40.2, tbwL: 51.8, ecwL: 22.1, phaDeg: 6.7, bmrKcal: 1890,
    chestCm: 107.5, waistCm: 90.4, abdomenCm: 96.2, hipsCm: 101.5, thighCm: 62.8, armCm: 37.9, calfCm: 42.4 },
};
const measurements = [];
for (let w = 0; w <= 12; w++) {
  const date = addDays('2026-07-17', w * 7);
  if (date === '2026-08-14') continue; // settimana di vacanza: nessuna misura
  let values;
  if (BIA[date]) values = BIA[date];
  else if (date === '2026-09-04') values = { abdomenCm: 96.5 }; // misura senza peso
  else if (date === '2026-09-11') values = { weightKg: 88.4, waistCm: 90.6 };
  else values = { weightKg: round1(87.5 + 0.11 * w + (w % 2 ? 0.3 : 0)) };
  measurements.push({ id: uuid('pm', measurements.length + 1), date, ...EMPTY, ...values });
}

// --- Schede e sessioni ------------------------------------------------------------------------
const item = (exerciseId, name, muscles, sets, reps, kg, restSec) => ({
  exerciseId, name, muscles, sets, reps, kg, restSec, note: '', videoUrl: null, setsDetail: null,
});
const PUSH = {
  id: 'c7000001-0000-4000-8000-000000000001', version: 3, author: 'PT di prova', source: 'pt', name: 'Spinta finta',
  weekdays: [1, 4], time: '18:00', intro: '', warmup: [],
  items: [
    item('fx-barbell-bench-press-medium-grip', 'Panca piana con bilanciere', ['Petto', 'Tricipiti'], 3, 8, 60, 120),
    item('fx-wide-grip-lat-pulldown', 'Lat machine presa larga', ['Dorsali', 'Bicipiti'], 3, 10, 50, 90),
    item(null, 'Croci ai cavi', ['Petto'], 2, 12, 15, 60),
  ],
  cardio: null, updatedAt: '2026-07-01T08:00:00.000Z', received: null, previousVersions: [],
};
const LEGS = {
  id: 'c7000002-0000-4000-8000-000000000002', version: 1, author: '', source: 'own', name: 'Gambe finte',
  weekdays: [3], time: null, intro: '', warmup: [],
  items: [
    item(null, 'Leg press', ['Quadricipiti', 'Glutei'], 3, 12, 140, 120),
    item('fx-plank', 'Plank', ['Addominali'], 2, 1, 0, 60),
  ],
  cardio: { type: 'cyclette', minutes: 10 }, updatedAt: '2026-07-01T08:00:00.000Z', received: null, previousVersions: [],
};

const sessions = [];
function addSession(workout, date, items, { startHour = 16, extraItems = [] } = {}) {
  const snapshotItems = [...workout.items, ...extraItems];
  const sets = [];
  items.forEach((list, itemIndex) =>
    list.forEach(([kg, reps, done], setIndex) =>
      sets.push({ exerciseId: snapshotItems[itemIndex].exerciseId, itemIndex, setIndex, kg, reps, done }),
    ),
  );
  const n = sessions.length + 1;
  sessions.push({
    id: uuid('ps', n), workoutId: workout.id, workoutVersion: workout.version, workoutName: workout.name,
    startedAt: `${date}T${pad(startHour)}:00:00.000Z`, endedAt: `${date}T${pad(startHour + 1)}:00:00.000Z`,
    readiness: { sleep: 4, mood: 4, energy: 3, stress: 4, soreness: 4 }, sets, userNotes: [], rpe: 7,
    cardioDone: null, snapshot: { items: snapshotItems, cardio: workout.cardio }, live: null,
  });
}

for (let w = 0; w <= 13; w++) {
  const monday = addDays('2026-07-13', w * 7);
  if (monday === '2026-08-10') continue; // vacanza: settimana a zero
  const bench = 60 + 2.5 * Math.floor(w / 2);
  const lat = 50 + 2.5 * Math.floor(w / 3);
  const legs = 140 + 10 * Math.floor(w / 2);
  const push = (date, opts) => {
    const benchSets = monday === '2026-10-12' ? [[bench - 5, 10, true], [bench, 8, true], [bench + 2.5, 6, true]] : [[bench - 5, 10, true], [bench, 8, true], [bench, 8, true]];
    const latDone = date !== '2026-09-03'; // sessione parziale: lat machine non fatta
    addSession(PUSH, date, [benchSets, [[lat, 10, latDone], [lat, 10, latDone], [lat, 10, latDone]], [[15, 12, true], [15, 12, true]]], opts);
  };
  if (monday === '2026-10-12') {
    push(monday, { startHour: 6 }); // oggi, prima delle 10:00
    continue;
  }
  push(monday);
  const extraItems = w === 0 ? [item(null, 'Curl manubri finto', ['Bicipiti'], 2, 10, 12, 60)] : [];
  const legsSets = [[[legs, 12, true], [legs, 12, true], [legs, 12, true]], [[0, 1, true], [0, 1, true]]];
  if (w === 0) legsSets.push([[12, 10, true], [12, 10, true]]);
  addSession(LEGS, addDays(monday, 2), legsSets, { extraItems });
  if (monday !== '2026-09-14') push(addDays(monday, 3));
}

// --- Piani alimentari e diario ----------------------------------------------------------------
// Target vicini al piano (i giorni completi stanno nella fascia ±5 %, quelli con pasti saltati no).
const near = (kcal, protein, carbs, fat) => ({ kcal, protein, carbs, fat, fiber: 22 });
const dayTypes = {
  gym: { ...diet.dayTypes.gym, targets: near(1620, 130, 200, 36) },
  run: { ...diet.dayTypes.run, targets: near(1650, 105, 200, 44) },
  rest: { ...diet.dayTypes.rest, targets: near(1310, 92, 148, 37) },
};
const payload = { dayTypes, categories: diet.categories, products: diet.products, days: diet.days, recipes: diet.recipes };
const ACTIVE = {
  id: 'd7000001-0000-4000-8000-000000000001', version: 1, title: 'Ottobre finto', author: 'Nutrizionista di prova',
  validFrom: '2026-10-01', active: true, archived: false, importedAt: '2026-09-30T18:00:00.000Z', origin: 'file', payload,
};
const OLD = {
  id: 'd7000002-0000-4000-8000-000000000002', version: 1, title: 'Settembre finto', author: 'Nutrizionista di prova',
  validFrom: '2026-09-01', active: false, archived: true, importedAt: '2026-08-31T18:00:00.000Z', origin: 'file',
  payload: { ...payload, dayTypes: { ...payload.dayTypes, gym: { ...payload.dayTypes.gym, targets: { ...payload.dayTypes.gym.targets, kcal: 2000 } } } },
};

const weekday = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
};
const mealsOf = (plan, wd) =>
  plan.payload.days.find((d) => d.weekday === wd).meals.filter((m) => !(m.name === '' && m.items.length === 0)).map((m) => m.key);

const dietLog = [];
function log(date, plan, { skip = [], only = null, swap = null } = {}) {
  const keys = mealsOf(plan, swap ?? weekday(date));
  const eaten = {};
  for (const key of keys) eaten[key] = only ? only.includes(key) : !skip.includes(key);
  dietLog.push({ date, planId: plan.id, swappedFromWeekday: swap, eaten });
}
for (let d = 0; d < 30; d++) {
  const date = addDays('2026-09-01', d);
  log(date, OLD, { skip: weekday(date) === 3 ? ['spuntino1'] : [] });
}
log('2026-10-01', ACTIVE);
log('2026-10-02', ACTIVE);
log('2026-10-03', ACTIVE, { skip: ['pranzo'] });
// 2026-10-04: nessuna riga (nessun pasto segnato)
log('2026-10-05', ACTIVE, { skip: ['spuntino2'] });
log('2026-10-06', OLD); // quel giorno era attivo il piano di settembre (poi ripristinato)
log('2026-10-07', ACTIVE, { swap: 1, skip: ['cena'] });
log('2026-10-08', ACTIVE);
log('2026-10-09', ACTIVE, { skip: ['spuntino2'] });
log('2026-10-10', ACTIVE);
log('2026-10-11', ACTIVE);
log('2026-10-12', ACTIVE, { only: ['colazione'] }); // oggi, in corso

const settings = [{ key: 'nextMeasurement', value: { text: 'Mattina, a digiuno.', date: '2026-11-13' } }];

const tables = {
  profile: [profile], measurements, exercises: [], workouts: [PUSH, LEGS], sessions, dietPlans: [ACTIVE, OLD], dietLog,
  shopping: [], settings,
};
const backup = {
  app: 'healthy-app', kind: 'backup', schemaVersion: 1, createdAt: '2026-10-12T08:00:00.000Z', dbVersion: 5,
  counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), tables,
};
writeFileSync(join(here, 'backup-progress.json'), `${JSON.stringify(backup, null, 2)}\n`);
console.log(backup.counts);
