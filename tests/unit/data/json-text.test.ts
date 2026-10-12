import { describe, expect, it } from 'vitest';
import { diagnoseJsonSyntax, unwrapJson } from '../../../src/lib/data/json-text';
import { parseJsonText } from '../../../src/lib/data/read-file';
import { extractImport } from '../../../src/lib/share/import/entry';

describe('unwrapJson: solo il contorno del JSON', () => {
  it('blocco ```json con testo prima e dopo', () => {
    const text = 'Ecco il file:\n```json\n{ "a": 1 }\n```\nCi sono dati mancanti.';
    expect(unwrapJson(text)).toEqual({ text: '{ "a": 1 }', unwrapped: true });
  });

  it('blocco ``` senza linguaggio, o con il blocco di un altro testo prima', () => {
    expect(unwrapJson('```\n{"a":1}\n```').text).toBe('{"a":1}');
    expect(unwrapJson('```text\nnota\n```\n```json\n{"a":1}\n```').text).toBe('{"a":1}');
  });

  it('frasi prima e dopo, senza blocco', () => {
    expect(unwrapJson('Ecco: {"a":{"b":2}} fammi sapere').text).toBe('{"a":{"b":2}}');
  });

  it('JSON già pulito: invariato', () => {
    expect(unwrapJson('  {"a":1}\n')).toEqual({ text: '{"a":1}', unwrapped: false });
  });

  it('il contenuto non viene mai corretto', () => {
    expect(unwrapJson('```json\n{"q": 1,5,}\n```').text).toBe('{"q": 1,5,}');
  });

  it('senza graffe resta com’è', () => {
    expect(unwrapJson('niente qui').text).toBe('niente qui');
  });
});

describe('diagnoseJsonSyntax: errori tipici con la riga', () => {
  it('virgole finali in oggetti ed elenchi', () => {
    expect(diagnoseJsonSyntax('{\n  "a": [1, 2,],\n  "b": 3,\n}')).toEqual([
      "Riga 2: c'è una virgola di troppo prima di «]»",
      "Riga 3: c'è una virgola di troppo prima di «}»",
    ]);
  });

  it('numero con la virgola decimale in un oggetto; negli elenchi la virgola separa', () => {
    expect(diagnoseJsonSyntax('{\n "q": 12,5\n}')).toEqual(['Riga 2: il numero «12,5» è scritto con la virgola: usa il punto (12.5)']);
    expect(diagnoseJsonSyntax('{"w": [12,5]}')).toEqual([]);
  });

  it('virgole e graffe dentro i testi non contano', () => {
    expect(diagnoseJsonSyntax('{"note": "1,5 litri, poi }", "x": 1}')).toEqual([]);
    expect(diagnoseJsonSyntax('{"note": "virgolette \\" e ,}"}')).toEqual([]);
  });

  it('commenti', () => {
    expect(diagnoseJsonSyntax('{\n // nota\n "a": 1 /* altro */\n}')).toEqual([
      'Riga 2: i commenti (//) non sono ammessi in un file JSON',
      'Riga 3: i commenti (/* */) non sono ammessi in un file JSON',
    ]);
  });

  it('parseJsonText aggiunge le spiegazioni al messaggio generico', () => {
    const result = parseJsonText('{"a": 1,}', 'Non valido.');
    expect(result).toEqual({ ok: false, errors: ['Non valido.', "Riga 1: c'è una virgola di troppo prima di «}»"] });
  });
});

describe('testo incollato da una chat', () => {
  it('blocco ```json riconosciuto come JSON e ripulito', () => {
    expect(extractImport('Ecco:\n```json\n{"app":"healthy-app"}\n```')).toEqual({
      ok: true,
      value: { type: 'json', text: '{"app":"healthy-app"}' },
    });
  });

  it('link e codici restano riconosciuti come prima', () => {
    expect(extractImport('https://x.test/#import=ABC')).toEqual({ ok: true, value: { type: 'payload', payload: 'ABC' } });
    expect(extractImport('Ciao, come stai?')).toMatchObject({ ok: false });
  });
});
