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
