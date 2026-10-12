/**
 * Testo JSON arrivato da fuori (file, testo incollato), spesso scritto in una chat (modello per Claude).
 * Modulo leggero, senza dipendenze: lo usa anche il riconoscimento del testo incollato.
 */

const FENCE = /```[A-Za-z]*[ \t]*\r?\n?([\s\S]*?)```/g;

/**
 * Toglie **solo** ciò che sta attorno al JSON: i blocchi ```` ```json … ``` ```` e il testo prima della prima `{`
 * e dopo l'ultima `}` ("Ecco il file: { … } Fammi sapere…"). Il contenuto non viene mai corretto.
 * Senza `{` il testo resta com'è (lo segnalerà `JSON.parse`).
 */
export function unwrapJson(input: string): { text: string; unwrapped: boolean } {
  const original = input.trim();
  let text = original;
  for (const match of original.matchAll(FENCE)) {
    const inner = (match[1] ?? '').trim();
    if (inner.includes('{')) {
      text = inner;
      break;
    }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) text = text.slice(start, end + 1);
  return { text, unwrapped: text !== original };
}

/** Massimo di segnalazioni: oltre, l'errore è lo stesso ripetuto. */
const MAX_HINTS = 5;

/**
 * Errori di sintassi tipici dei JSON scritti a mano o in chat, con la riga: virgole finali,
 * numeri con la virgola decimale (`"q": 1,5`), commenti. Da chiamare solo se `JSON.parse` ha già fallito:
 * spiega l'errore, non lo corregge. Le stringhe sono saltate (una virgola in un testo non conta).
 */
export function diagnoseJsonSyntax(text: string): string[] {
  const hints: string[] = [];
  const add = (hint: string) => {
    if (hints.length < MAX_HINTS && !hints.includes(hint)) hints.push(hint);
  };
  const stack: ('{' | '[')[] = [];
  let line = 1;
  /** Ultimo carattere significativo fuori dalle stringhe e la sua riga. */
  let last = '';
  let lastLine = 1;
  /** Il numero appena letto, se l'ultimo valore era un numero. */
  let lastNumber: string | null = null;
  /** Il numero prima dell'ultima virgola (per riconoscere `1,5` in un oggetto). */
  let numberBeforeComma: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '\n') {
      line++;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') continue;

    if (ch === '"') {
      // Salta la stringa (con gli escape); una stringa non chiusa si ferma a fine riga.
      let j = i + 1;
      while (j < text.length && text[j] !== '"' && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      i = j;
      last = '"';
      lastLine = line;
      lastNumber = null;
      continue;
    }

    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      add(`Riga ${line}: i commenti (${text[i + 1] === '/' ? '//' : '/* */'}) non sono ammessi in un file JSON`);
      // Salta il commento, contando le righe.
      const close = text[i + 1] === '/' ? '\n' : '*/';
      const endAt = text.indexOf(close, i + 2);
      const stop = endAt === -1 ? text.length : endAt;
      for (let k = i; k < stop; k++) if (text[k] === '\n') line++;
      i = close === '\n' ? stop - 1 : stop + 1;
      continue;
    }

    if (/[-0-9]/.test(ch)) {
      const number = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i))?.[0] ?? ch;
      // Dopo una virgola, dentro un oggetto, ci vuole un nome tra virgolette: `"q": 1,5` è un decimale con la virgola.
      if (last === ',' && stack.at(-1) === '{' && numberBeforeComma !== null) {
        add(`Riga ${line}: il numero «${numberBeforeComma},${number}» è scritto con la virgola: usa il punto (${numberBeforeComma}.${number})`);
      }
      i += number.length - 1;
      last = '0';
      lastLine = line;
      lastNumber = number;
      continue;
    }

    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') {
      if (last === ',') add(`Riga ${lastLine}: c'è una virgola di troppo prima di «${ch}»`);
      stack.pop();
    }
    numberBeforeComma = ch === ',' ? lastNumber : null;
    last = ch;
    lastLine = line;
    lastNumber = null;
  }
  return hints;
}
