import { Recipe, ProteinCategory } from '../types/recipe';
import { DayMenu, DayOfWeek, DAYS_OF_WEEK, WeeklyPlan } from '../types/menu';

const PROTEIN_ORDER: ProteinCategory[] = ['gefluegel', 'rind', 'fisch', 'suess', 'vegetarisch'];

const TARGET_SERVE_TIME = '18:00';

// Übliche Beilage je Rezept, da das Rezept selbst nur den Namen des Hauptgerichts trägt.
const BEILAGE_BY_RECIPE_ID: Record<string, string> = {
  'hs-gefluegel-01': 'Reis',
  'hs-gefluegel-02': 'Kartoffelpüree',
  'hs-gefluegel-03': 'Basmatireis',
  'hs-gefluegel-04': 'Kartoffelspalten',
  'hs-rind-01': 'Spätzle',
  'hs-rind-02': 'Kartoffelbrei',
  'hs-rind-03': 'Bandnudeln',
  'hs-rind-04': 'Spaghetti',
  'hs-fisch-01': 'Kartoffelsalat',
  'hs-fisch-02': 'Reis',
  'hs-fisch-03': 'Kartoffeln',
  'hs-fisch-04': 'Reis',
  'hs-suess-01': '—',
  'hs-suess-02': 'Apfelmus',
  'hs-suess-03': 'Marmelade',
  'hs-suess-04': 'Vanillesoße',
  'hs-vegetarisch-01': 'Blattsalat',
  'hs-vegetarisch-02': 'Reis',
  'hs-vegetarisch-03': 'Röstzwiebeln',
  'hs-vegetarisch-04': 'Reis',
};

function beilageFor(recipe: Recipe): string {
  return BEILAGE_BY_RECIPE_ID[recipe.id] ?? '—';
}

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(normalized / 60)
    .toString()
    .padStart(2, '0');
  const mm = (normalized % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + mm;
}

/** Startzeit der Zubereitung: 18:00 minus die längste Zubereitungszeit des Tages. */
function calculatePrepStartTime(vorspeise: Recipe, hauptspeise: Recipe, nachspeise: Recipe): string {
  const longest = Math.max(vorspeise.totalTimeMinutes, hauptspeise.totalTimeMinutes, nachspeise.totalTimeMinutes);
  return minutesToTime(timeToMinutes(TARGET_SERVE_TIME) - longest);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRecipe(
  candidates: Recipe[],
  excludeIds: Set<string>,
): Recipe {
  const fresh = candidates.filter((r) => !excludeIds.has(r.id));
  const pool = fresh.length > 0 ? fresh : candidates;
  return shuffle(pool)[0];
}

export interface GenerateOptions {
  calendarWeek: number;
  year: number;
  /** Rezept-IDs, die innerhalb der letzten 4 Wochen bereits verwendet wurden. */
  recentRecipeIds?: string[];
}

function buildDayMenu(
  dayOfWeek: DayOfWeek,
  proteinCategory: ProteinCategory,
  allRecipes: Recipe[],
  usedInWeek: Set<string>,
  recentRecipeIds: Set<string>,
): DayMenu {
  const hauptspeiseCandidates = allRecipes.filter(
    (r) => r.course === 'hauptspeise' && r.proteinCategory === proteinCategory,
  );
  const vorspeiseCandidates = allRecipes.filter((r) => r.course === 'vorspeise');
  const nachspeiseCandidates = allRecipes.filter((r) => r.course === 'nachspeise');

  const excludeForWeek = new Set([...usedInWeek, ...recentRecipeIds]);

  const hauptspeise = pickRecipe(hauptspeiseCandidates, excludeForWeek);
  usedInWeek.add(hauptspeise.id);

  const vorspeise = pickRecipe(vorspeiseCandidates, excludeForWeek);
  usedInWeek.add(vorspeise.id);

  const nachspeise = pickRecipe(nachspeiseCandidates, excludeForWeek);
  usedInWeek.add(nachspeise.id);

  return {
    dayOfWeek,
    vorspeise,
    hauptspeise,
    beilage: beilageFor(hauptspeise),
    nachspeise,
    targetServeTime: TARGET_SERVE_TIME,
    prepStartTime: calculatePrepStartTime(vorspeise, hauptspeise, nachspeise),
  };
}

/** Erzeugt mit einem Klick einen kompletten Wochenplan nach der 5-Tage-Protein-Regel. */
export function generateWeeklyPlan(recipes: Recipe[], options: GenerateOptions): WeeklyPlan {
  const proteinAssignment = shuffle(PROTEIN_ORDER);
  const usedInWeek = new Set<string>();
  const recentRecipeIds = new Set(options.recentRecipeIds ?? []);

  const days: DayMenu[] = DAYS_OF_WEEK.map((dayOfWeek, index) =>
    buildDayMenu(dayOfWeek, proteinAssignment[index], recipes, usedInWeek, recentRecipeIds),
  );

  return {
    id: `plan-${options.year}-kw${options.calendarWeek}`,
    calendarWeek: options.calendarWeek,
    year: options.year,
    days,
    shoppingListMon: [],
    shoppingListFri: [],
    isFinalized: false,
    createdAt: new Date().toISOString(),
  };
}

/** Tauscht das Menü eines einzelnen Tages aus (Shuffle/Re-roll), Protein-Kategorie bleibt erhalten. */
export function rerollDay(
  recipes: Recipe[],
  plan: WeeklyPlan,
  dayOfWeek: DayOfWeek,
  recentRecipeIds: string[] = [],
): WeeklyPlan {
  const targetDay = plan.days.find((d) => d.dayOfWeek === dayOfWeek);
  if (!targetDay) return plan;

  const proteinCategory = targetDay.hauptspeise.proteinCategory as ProteinCategory;
  const usedInWeek = new Set(
    plan.days
      .filter((d) => d.dayOfWeek !== dayOfWeek)
      .flatMap((d) => [d.vorspeise.id, d.hauptspeise.id, d.nachspeise.id]),
  );
  const recent = new Set(recentRecipeIds);

  const newDay = buildDayMenu(dayOfWeek, proteinCategory, recipes, usedInWeek, recent);

  return {
    ...plan,
    days: plan.days.map((d) => (d.dayOfWeek === dayOfWeek ? newDay : d)),
  };
}

export function calculateCalendarWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}
