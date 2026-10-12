import { dayMonthYear, fromIsoDate, shortDate } from '../diet/calc/calendar';
import { formatDecimal, formatInt } from '../diet/format';
import { METRICS, type MetricKey } from './metrics';

/** Testi del Profilo: virgola decimale, punto delle migliaia, segno meno tipografico. */

/** Valore di un parametro senza unità: "76,2", "1.720", "—" se manca. */
export function metricText(key: MetricKey, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const { digits } = METRICS[key];
  return digits === 0 ? formatInt(value) : formatDecimal(value, digits);
}

/** Valore con unità: "76,2 kg", "42,1 %", "6,2°". */
export function metricWithUnit(key: MetricKey, value: number | null | undefined): string {
  const text = metricText(key, value);
  if (text === '—') return text;
  const { unit } = METRICS[key];
  if (unit === '°') return `${text}°`;
  return unit ? `${text} ${unit}` : text;
}

/** Unità della variazione: per le percentuali sono punti. */
export function deltaUnit(key: MetricKey): string {
  const { unit, percent } = METRICS[key];
  return percent ? 'pt' : unit;
}

/** "▲ +1,1 kg", "▼ −0,3°", "= 0 kg"; `withUnit = false` toglie l'unità (es. circonferenze). */
export function deltaText(key: MetricKey, delta: number, withUnit = true): string {
  const unit = withUnit ? deltaUnit(key) : '';
  const size = metricText(key, Math.abs(delta));
  const arrow = delta > 0 ? '▲ +' : delta < 0 ? '▼ −' : '= ';
  const tail = !unit ? '' : unit === '°' ? '°' : ` ${unit}`;
  return `${arrow}${size}${tail}`;
}

/** Variazione in percentuale: "+1,4 %", "−7,0 %". */
export function deltaPctText(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${formatDecimal(Math.abs(rounded), 1)} %`;
}

/** Testo per lo screen reader: "aumento di 1,1 kg", "calo di 0,3", "invariato". */
export function deltaSpoken(key: MetricKey, delta: number): string {
  if (delta === 0) return 'invariato';
  const unit = deltaUnit(key);
  const spokenUnit = unit === 'pt' ? 'punti' : unit === '°' ? 'gradi' : unit;
  return `${delta > 0 ? 'aumento' : 'calo'} di ${metricText(key, Math.abs(delta))}${spokenUnit ? ` ${spokenUnit}` : ''}`;
}

/** "25 SET 2026". */
export function longDate(iso: string): string {
  return dayMonthYear(fromIsoDate(iso));
}

/** "25/09/2026". */
export function numericDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "25/09". */
export function dayMonth(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** "6 NOV" (titolo della prossima bioimpedenza). */
export function dayMonthUpper(iso: string): string {
  return shortDate(fromIsoDate(iso)).toUpperCase();
}

/** Giorni interi tra due date `AAAA-MM-GG` (indipendente dall'ora legale). */
export function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Distanza tra due misure: "10 giorni" (sotto le 2 settimane), "6 settimane" (fino a 16), poi "5 mesi". */
export function spanText(from: string, to: string): string {
  const days = Math.abs(daysBetween(from, to));
  if (days < 14) return days === 1 ? '1 giorno' : `${days} giorni`;
  if (days <= 16 * 7) {
    const weeks = Math.round(days / 7);
    return `${weeks} settimane`;
  }
  const months = Math.round(days / 30.44);
  return `${months} mesi`;
}
