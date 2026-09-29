import { DayMenu } from '../types/menu';
import { Lang, translations } from '../i18n/translations';

/** Hauptspeisen-Name inkl. Beilage, ohne die Beilage doppelt zu nennen, falls sie schon im Namen steht. */
export function formatHauptspeiseWithBeilage(day: DayMenu, lang: Lang): string {
  const { hauptspeise, beilage } = day;
  const nameHasAccompaniment = / mit /i.test(hauptspeise.name);
  if (beilage === '—' || nameHasAccompaniment) {
    return hauptspeise.name;
  }
  return `${hauptspeise.name} ${translations[lang].withConnector} ${beilage}`;
}

/** Menge (für 10 Personen hinterlegt) auf `portions` umgerechnet, mit kg/l-Umrechnung ab 1000. */
export function formatIngredientAmount(amountPer10Pax: number, unit: string, portions: number): string {
  const amount = (amountPer10Pax * portions) / 10;

  if (unit === 'g' && amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)} kg`;
  }
  if (unit === 'ml' && amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)} l`;
  }
  const rounded = Math.round(amount * 10) / 10;
  return `${rounded} ${unit}`;
}
