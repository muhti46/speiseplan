import { DayMenu } from '../types/menu';

/** Hauptspeisen-Name inkl. Beilage, ohne die Beilage doppelt zu nennen, falls sie schon im Namen steht. */
export function formatHauptspeiseWithBeilage(day: DayMenu): string {
  const { hauptspeise, beilage } = day;
  const nameHasAccompaniment = / mit /i.test(hauptspeise.name);
  if (beilage === '—' || nameHasAccompaniment) {
    return hauptspeise.name;
  }
  return `${hauptspeise.name} mit ${beilage}`;
}
