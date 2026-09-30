import { DayMenu } from '../types/menu';
import { Lang, translations } from '../i18n/translations';
import { getWeekRange } from './generator';

/** Hauptspeisen-Name inkl. Beilage, ohne die Beilage doppelt zu nennen, falls sie schon im Namen steht. */
export function formatHauptspeiseWithBeilage(day: DayMenu, lang: Lang): string {
  const { hauptspeise, beilage } = day;
  const nameHasAccompaniment = / mit /i.test(hauptspeise.name);
  if (beilage === '—' || nameHasAccompaniment) {
    return hauptspeise.name;
  }
  return `${hauptspeise.name} ${translations[lang].withConnector} ${beilage}`;
}

const PIECE_UNIT = /^(stück|stueck|stk\.?|st\.?|adet)$/i;

/** Zahl mit höchstens `digits` Nachkommastellen und Komma, ohne überflüssige Nullen (1,5 / 2). */
function trimNumber(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, '').replace('.', ',');
}

/** Auf ein Vielfaches von `step` runden, mindestens `step` (kleine Mengen nie auf 0). */
function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

/** g/ml einkaufsgerecht runden: <100 auf 5, <1000 auf 10, ab 1000 auf 0,1 kg/l. */
function formatMetric(amount: number, small: 'g' | 'ml', big: 'kg' | 'l'): string {
  const rounded = amount < 100 ? roundTo(amount, 5) : amount < 1000 ? roundTo(amount, 10) : roundTo(amount, 100);
  return rounded >= 1000 ? `${trimNumber(rounded / 1000, 1)} ${big}` : `${rounded} ${small}`;
}

/**
 * Menge einkaufs-/kochgerecht anzeigen: Stück immer aufgerundet auf ganze Stücke (4,4 Eier -> 5),
 * g/ml gerundet (1,98 kg -> 2 kg, 1,21 kg -> 1,2 kg), ab 1000 als kg/l.
 */
export function formatAmount(amount: number, unit: string): string {
  const u = unit.trim();
  if (PIECE_UNIT.test(u)) return `${Math.ceil(amount - 1e-6)} Stück`;
  if (u === 'g') return formatMetric(amount, 'g', 'kg');
  if (u === 'ml') return formatMetric(amount, 'ml', 'l');
  return `${trimNumber(Math.round(amount * 10) / 10, 1)} ${u}`;
}

/** Menge (für 10 Personen hinterlegt) auf `portions` umgerechnet und formatiert. */
export function formatIngredientAmount(amountPer10Pax: number, unit: string, portions: number): string {
  return formatAmount((amountPer10Pax * portions) / 10, unit);
}

/** Zeitraum einer Kalenderwoche, z.B. "28.09. – 04.10.2026" (über den Jahreswechsel mit beiden Jahren). */
export function formatWeekRange(calendarWeek: number, year: number): string {
  const { start, end } = getWeekRange(calendarWeek, year);
  const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  const full = (d: Date) => `${dm(d)}${d.getFullYear()}`;
  return start.getFullYear() === end.getFullYear() ? `${dm(start)} – ${full(end)}` : `${full(start)} – ${full(end)}`;
}
