import { describe, expect, it } from 'vitest';
import { emptyForm, formFromMeasurement, previousMeasurement, readMeasurementForm, suggestion } from '../../../src/lib/profile/form';
import { numberToField, parseDecimalInput } from '../../../src/lib/profile/number';
import { profileFormFrom, readProfileForm } from '../../../src/lib/profile/profile-form';
import { measurement, PROFILE } from './helpers';

describe('numeri all\'italiana', () => {
  it('virgola e punto valgono uguale; vuoto = nessun valore', () => {
    expect(parseDecimalInput('76,4')).toEqual({ ok: true, value: 76.4 });
    expect(parseDecimalInput('76.4')).toEqual({ ok: true, value: 76.4 });
    expect(parseDecimalInput(' 76 ')).toEqual({ ok: true, value: 76 });
    expect(parseDecimalInput('0,25')).toEqual({ ok: true, value: 0.25 });
    expect(parseDecimalInput('')).toEqual({ ok: true, value: null });
    expect(parseDecimalInput('   ')).toEqual({ ok: true, value: null });
  });

  it('rifiuta testo, separatori doppi, negativi, troppi decimali', () => {
    for (const bad of ['abc', '76,4,2', '76..4', ',5', '7 6,4x', '1e3', 'Infinity']) {
      expect(parseDecimalInput(bad).ok, bad).toBe(false);
    }
    expect(parseDecimalInput('-3')).toEqual({ ok: false, error: 'Inserisci un numero positivo.' });
    expect(parseDecimalInput('76,456')).toEqual({ ok: false, error: 'Al massimo 2 decimali.' });
    expect(parseDecimalInput('178,55', { maxDecimals: 1 })).toEqual({ ok: false, error: 'Al massimo un decimale.' });
  });

  it('interi: punto delle migliaia ammesso ("1.720" = 1720), decimali no', () => {
    expect(parseDecimalInput('1720', { integer: true })).toEqual({ ok: true, value: 1720 });
    expect(parseDecimalInput('1.720', { integer: true })).toEqual({ ok: true, value: 1720 });
    expect(parseDecimalInput('1720,5', { integer: true }).ok).toBe(false);
    expect(parseDecimalInput('17.20', { integer: true }).ok).toBe(false);
  });

  it('nei campi il numero torna con la virgola', () => {
    expect(numberToField(76.4)).toBe('76,4');
    expect(numberToField(1720)).toBe('1720');
    expect(numberToField(null)).toBe('');
  });
});

describe('modulo misura', () => {
  const ctx = { today: '2026-10-12', existing: [{ id: 'old', date: '2026-08-14' }], id: null };

  function form(values: Record<string, string>, date = '2026-09-25', notes = '') {
    const f = emptyForm(date);
    return { ...f, notes, values: { ...f.values, ...values } };
  }

  it('virgola decimale → misura pronta, campi vuoti = null', () => {
    const result = readMeasurementForm(form({ weightKg: '76,2', fmKg: '14,9', bmrKcal: '1.720' }, '2026-09-25', ' ok '), ctx);
    expect(result.errors).toEqual({});
    const { id: _id, ...expected } = measurement({ weightKg: 76.2, fmKg: 14.9, bmrKcal: 1720, notes: 'ok' });
    expect(result.value).toStrictEqual(expected);
  });

  it('solo la data è obbligatoria, ma serve almeno un valore', () => {
    expect(readMeasurementForm(form({}), ctx).errors).toEqual({ values: 'Inserisci almeno un valore.' });
    expect(readMeasurementForm(form({ weightKg: '80' }, ''), ctx).errors).toEqual({ date: 'Inserisci la data della misura.' });
  });

  it('data nel futuro o già usata: errore sulla data', () => {
    expect(readMeasurementForm(form({ weightKg: '80' }, '2026-10-13'), ctx).errors.date).toBe('La data è nel futuro.');
    expect(readMeasurementForm(form({ weightKg: '80' }, '2026-08-14'), ctx).errors.date).toBe(
      'Esiste già una misura del 14/08/2026: modificala dallo storico.',
    );
    // In modifica la propria data va bene.
    expect(readMeasurementForm(form({ weightKg: '80' }, '2026-08-14'), { ...ctx, id: 'old' }).errors).toEqual({});
  });

  it('testo non numerico ed eccesso: errore sul campo, mai "almeno un valore"', () => {
    const result = readMeasurementForm(form({ weightKg: 'ottanta', waistCm: '400' }), ctx);
    expect(result.value).toBeNull();
    expect(result.errors).toEqual({ weightKg: 'Inserisci un numero, es. 76,4.', waistCm: 'Valore troppo alto: al massimo 300 cm.' });
  });

  it('impossibilità sul campo, incoerenze come avvisi che non bloccano', () => {
    const impossible = readMeasurementForm(form({ tbwL: '40', ecwL: '45' }), ctx);
    expect(impossible.errors).toEqual({ ecwL: "L'acqua extracellulare (45,0 L) supera l'acqua totale (40,0 L)." });
    const odd = readMeasurementForm(form({ weightKg: '80', fmKg: '16', ffmKg: '62' }), ctx);
    expect(odd.errors).toEqual({});
    expect(odd.value).not.toBeNull();
    expect(odd.warnings).toEqual(['FM + FFM = 78,0 kg, ma il peso è 80,0 kg: controlla i valori.']);
  });

  it('modifica: i valori salvati tornano nei campi con la virgola', () => {
    const f = formFromMeasurement(measurement({ weightKg: 76.2, bmrKcal: 1720, notes: 'nota' }));
    expect(f.values.weightKg).toBe('76,2');
    expect(f.values.bmrKcal).toBe('1720');
    expect(f.values.fmKg).toBe('');
    expect(f.notes).toBe('nota');
  });

  it('suggerimenti dalla misura precedente (solo segnaposto)', () => {
    const list = [
      measurement({ id: 'a', date: '2026-08-14', weightKg: 80.2 }),
      measurement({ id: 'b', date: '2026-09-25', weightKg: 78.9 }),
    ];
    expect(previousMeasurement(list, '2026-10-12', null)?.id).toBe('b');
    expect(previousMeasurement(list, '2026-09-25', 'b')?.id).toBe('a');
    expect(previousMeasurement(list, '2026-08-14', 'a')).toBeUndefined();
    expect(suggestion(list[1], 'weightKg')).toBe('ultima: 78,9');
    expect(suggestion(list[1], 'fmKg')).toBe('');
    expect(suggestion(undefined, 'weightKg')).toBe('');
  });
});

describe('modulo profilo', () => {
  const today = new Date(2026, 9, 12);

  it('dal profilo salvato e ritorno', () => {
    const f = profileFormFrom(PROFILE);
    expect(f).toEqual({ name: 'Persona di prova', birthYear: '1990', sex: 'M', height: '180', goal: 'recomp', activityLevel: 'sedentary' });
    const { id: _id, ...rest } = PROFILE;
    expect(readProfileForm({ ...f, height: '180,0' }, today)).toEqual({ value: rest, errors: {}, warnings: [] });
    expect(profileFormFrom(undefined).activityLevel).toBe('sedentary');
  });

  it('errori: anno nel futuro o non a 4 cifre, altezza in metri o fuori limiti', () => {
    const f = profileFormFrom(PROFILE);
    expect(readProfileForm({ ...f, birthYear: '2030' }, today).errors).toEqual({ birthYear: "L'anno di nascita è nel futuro." });
    expect(readProfileForm({ ...f, birthYear: '90' }, today).errors).toEqual({ birthYear: "Scrivi l'anno a 4 cifre, es. 1990." });
    expect(readProfileForm({ ...f, height: '1,78' }, today).errors).toEqual({ height: "Scrivi l'altezza in centimetri, es. 178." });
    expect(readProfileForm({ ...f, height: '300' }, today).errors).toEqual({ height: 'Altezza in centimetri, tra 50 e 250.' });
    expect(readProfileForm({ ...f, height: 'alto' }, today).value).toBeNull();
  });

  it('valori poco plausibili: avviso, ma si salva', () => {
    const f = profileFormFrom(PROFILE);
    const young = readProfileForm({ ...f, birthYear: '2016' }, today);
    expect(young.value?.birthYear).toBe(2016);
    expect(young.warnings).toEqual(["Età di 10 anni: controlla l'anno di nascita."]);
    const tall = readProfileForm({ ...f, height: '230' }, today);
    expect(tall.value?.heightCm).toBe(230);
    expect(tall.warnings).toEqual(['Altezza di 230 cm: controlla il valore.']);
  });

  it('tutto facoltativo: un profilo vuoto è valido', () => {
    const empty = readProfileForm(profileFormFrom(undefined), today);
    expect(empty.value).toEqual({ name: '', birthYear: null, sex: null, heightCm: null, goal: null, activityLevel: 'sedentary' });
  });
});
