import { Recipe } from '../types/recipe';
import { DayMenu, ShoppingItem, WeeklyPlan } from '../types/menu';
import { Lang, translations } from '../i18n/translations';

export const DEFAULT_PORTIONS = 11; // Mittelwert der Zielgruppe von 10-12 Personen

const AISLE_ORDER: ShoppingItem['storeCategory'][] = ['gemuese', 'kuehlung', 'mopro', 'trocken', 'tk'];

function recipesOfDay(day: DayMenu): Recipe[] {
  return [day.vorspeise, day.hauptspeise, day.nachspeise];
}

// ---------------------------------------------------------------- Vorräte

// Was in der Großküche immer im Vorrat ist und nicht auf den Einkaufszettel gehört:
// Salz, Zucker, Mehl, Gewürze, Essig, Öl, Brühe, Honig, Ingwer, Zitronensaft, Butter, Milch. Geprüft wird je Wort des Zutatennamens, damit
// z.B. "Zuckerschoten", "Salzkartoffeln", "Gewürzgurken" oder "Paniermehl" drauf bleiben.
// Auch Öle (Rapsöl, Olivenöl …), Brühen (Gemüse-, Rinder-, Hühnerbrühe …), Honig, Ingwer und
// Zitronensaft sind in der Küche immer vorrätig.
const PANTRY_WORD_ENDINGS = /(salz|zucker|essig|gewurz|gewurze|oel|bruhe|fond)$/;
const PANTRY_WORDS = new Set([
  'mehl', 'weizenmehl', 'dinkelmehl', 'roggenmehl', 'vollkornmehl',
  'pfeffer', 'paprikapulver', 'currypulver', 'curry', 'zimt', 'muskat', 'muskatnuss', 'kummel', 'kreuzkummel',
  'lorbeer', 'lorbeerblatt', 'lorbeerblatter', 'nelken', 'gewurznelken', 'piment', 'kurkuma', 'chilipulver',
  'chiliflocken', 'cayennepfeffer', 'knoblauchpulver', 'zwiebelpulver', 'ingwerpulver', 'masala', 'balsamico',
  'ingwer', 'honig', 'zitronensaft', 'bruhwurfel', 'gemusebruhwurfel',
  'butter', 'milch', 'vollmilch', 'frischmilch',
]);
// Kräuter zählen nur getrocknet (Trockensortiment) als Gewürz - frische Petersilie usw. wird gekauft.
const DRIED_ONLY = new Set(['oregano', 'thymian', 'rosmarin', 'majoran', 'basilikum', 'petersilie', 'dill', 'koriander', 'krauter']);
// Wörter, die nach dem Vorratswort nur die Sorte beschreiben ("Mehl Type 405", "Paprikapulver edelsüß").
const QUALIFIER = /^(fettarme|fettarm|h|type|\d+|gemahlen|getrocknet|edelsuss|rosenscharf|scharf|suss|mild|schwarz|weiss|grun|bunt|fein|grob|hell|dunkel|der|provence|braun|brauner|weisser)$/;
// Sieht aus wie Vorrat, ist aber eigene Ware.
const NOT_PANTRY = new Set(['paniermehl']);

function normalizeWords(name: string): string[] {
  return name
    .toLowerCase()
    // "öl" am Wortende als "oel", damit Öle erkannt werden, ohne Wörter wie "Karfiol" zu treffen.
    .replace(/öl(?![a-zäöüß])/g, 'oel')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isPantryWord(word: string, storeCategory: ShoppingItem['storeCategory']): boolean {
  if (NOT_PANTRY.has(word)) return false;
  if (DRIED_ONLY.has(word)) return storeCategory === 'trocken';
  return PANTRY_WORDS.has(word) || PANTRY_WORD_ENDINGS.test(word);
}

/**
 * Gehört die Zutat zum Grundvorrat (Salz, Zucker, Mehl, Gewürze, Essig, Öl, Brühe, Honig, Ingwer,
 * Zitronensaft, Butter, Milch) und damit nicht auf die Liste?
 * Entscheidend ist das Wort, das die Ware benennt: "Zuckerschoten", "Gewürzgurken", "Essig-Gurken"
 * oder "Salzkartoffeln" bleiben drauf, "Mehl Type 405" oder "Salz und Pfeffer" nicht.
 */
export function isPantryStaple(item: string, storeCategory: ShoppingItem['storeCategory']): boolean {
  const words = normalizeWords(item).filter((w) => w !== 'und');
  for (let i = words.length - 1; i >= 0; i--) {
    if (QUALIFIER.test(words[i])) continue;
    return isPantryWord(words[i], storeCategory);
  }
  return false;
}

// ---------------------------------------------------------------- Zusammenfassen

// Gleiche Ware, unterschiedlich geschrieben (Rezepte aus verschiedenen Quellen / von der KI).
const ALIASES: Record<string, string> = {
  vanillepuddingpulver: 'puddingpulver vanille',
  schokoladenpuddingpulver: 'puddingpulver schokolade',
  rinderhackfleisch: 'rinderhack',
  speisequark: 'quark',
  magerquark: 'quark',
  salatgurke: 'gurke',
  salatgurken: 'gurke',
  'geriebener gouda': 'gouda',
  'geriebener kase': 'kase',
  ei: 'eier',
  mohre: 'karotte',
  mohren: 'karotte',
  mohrrube: 'karotte',
  mohrruben: 'karotte',
};
// Klammerzusätze, die nur die Zubereitung beschreiben - gekauft wird dieselbe Ware.
const PREP_NOTE = /\((?:gekocht|gerieben|scheiben|in scheiben|gewurfelt|gehackt|frisch|geschalt|schmorbraten|apfel, banane, orange, trauben)\)/g;

/** Schlüssel, unter dem gleiche Ware zusammengefasst wird (Schreibweise, Einzahl/Mehrzahl, Zubereitung egal). */
export function canonicalItemKey(item: string): string {
  let name = item
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(PREP_NOTE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  name = ALIASES[name] ?? name;
  // Einzahl/Mehrzahl: "Zwiebel"/"Zwiebeln", "Tomate"/"Tomaten", "Karotte"/"Karotten" ...
  return name
    .split(' ')
    .map((w) => (w.length > 4 ? w.replace(/(en|n|e|s)$/, '') : w))
    .join(' ');
}

/** Einheit vereinheitlichen; kg/l werden in g/ml umgerechnet, damit sie zusammenpassen. */
export function normalizeUnit(unit: string, amount: number): { unit: string; amount: number } {
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  if (['stk', 'stück', 'stuck', 'st', 'stücke'].includes(u)) return { unit: 'Stück', amount };
  if (u === 'kg') return { unit: 'g', amount: amount * 1000 };
  if (u === 'l') return { unit: 'ml', amount: amount * 1000 };
  if (u === 'g' || u === 'ml') return { unit: u, amount };
  return { unit: unit.trim(), amount };
}

// Ungefähres Gewicht eines Stücks für Gemüse/Obst, das in den Rezepten mal in Stück, mal in g
// steht (die Standardrezepte nutzen g, KI-Rezepte teils Stück). Auf der Liste wird dann alles in g
// zusammengezählt - sonst stünden z.B. Zwiebeln zweimal drauf.
const PIECE_WEIGHT_G: Record<string, number> = {
  zwiebel: 100,
  fruhlingszwiebel: 20,
  knoblauchzeh: 5,
  paprika: 150,
  karott: 80,
  zucchini: 250,
  tomat: 80,
  gurk: 400,
  apfel: 150,
  banan: 120,
  birn: 150,
  kohlrabi: 300,
  lauch: 200,
  kartoffel: 100,
  aubergin: 300,
};

/**
 * Einheit, in der eine Ware auf der Liste geführt wird: wie `normalizeUnit`, zusätzlich werden
 * Stück bei nach Gewicht gekauftem Gemüse/Obst in g umgerechnet.
 */
export function toShoppingUnit(item: string, unit: string, amount: number): { unit: string; amount: number } {
  const normalized = normalizeUnit(unit, amount);
  if (normalized.unit !== 'Stück') return normalized;
  const key = canonicalItemKey(item);
  const weight = PIECE_WEIGHT_G[key] ?? PIECE_WEIGHT_G[key.split(' ').pop() ?? ''];
  return weight ? { unit: 'g', amount: normalized.amount * weight } : normalized;
}

function aggregateIngredients(days: DayMenu[], portions: number): ShoppingItem[] {
  const scale = portions / 10;
  const byKey = new Map<string, ShoppingItem>();

  for (const day of days) {
    for (const recipe of recipesOfDay(day)) {
      for (const ingredient of recipe.ingredients) {
        if (isPantryStaple(ingredient.item, ingredient.storeCategory)) continue;
        const { unit, amount } = toShoppingUnit(ingredient.item, ingredient.unit, ingredient.amountPer10Pax * scale);
        // Gleiche Ware landet in EINER Zeile - auch wenn sie in Rezepten unterschiedlichen
        // Regalen zugeordnet ist (dann gilt das erste). Nur unvereinbare Einheiten ohne bekanntes
        // Stückgewicht (z.B. Zitronen in Stück und g) bleiben getrennt.
        const key = `${canonicalItemKey(ingredient.item)}__${unit}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.amount += amount;
          if (!existing.recipeNames.includes(recipe.name)) {
            existing.recipeNames.push(recipe.name);
          }
        } else {
          byKey.set(key, {
            item: ingredient.item.trim(),
            amount,
            unit,
            storeCategory: ingredient.storeCategory,
            recipeNames: [recipe.name],
            checked: false,
          });
        }
      }
    }
  }

  return Array.from(byKey.values())
    .map((item) => ({ ...item, amount: Math.round(item.amount * 100) / 100 }))
    .sort((a, b) => {
      const aisleDiff = AISLE_ORDER.indexOf(a.storeCategory) - AISLE_ORDER.indexOf(b.storeCategory);
      return aisleDiff !== 0 ? aisleDiff : a.item.localeCompare(b.item, 'de');
    });
}

/** Einkauf 1 (Montag): Zutaten für Montag, Dienstag, Mittwoch. */
export function buildMondayShoppingList(plan: WeeklyPlan, portions: number = DEFAULT_PORTIONS): ShoppingItem[] {
  const relevantDays = plan.days.filter((d) =>
    ['Montag', 'Dienstag', 'Mittwoch'].includes(d.dayOfWeek),
  );
  return aggregateIngredients(relevantDays, portions);
}

/** Einkauf 2 (Freitag): Zutaten für Freitag. */
export function buildFridayShoppingList(plan: WeeklyPlan, portions: number = DEFAULT_PORTIONS): ShoppingItem[] {
  const relevantDays = plan.days.filter((d) => ['Donnerstag', 'Freitag'].includes(d.dayOfWeek));
  return aggregateIngredients(relevantDays, portions);
}

export function buildShoppingLists(
  plan: WeeklyPlan,
  portions: number = DEFAULT_PORTIONS,
): { shoppingListMon: ShoppingItem[]; shoppingListFri: ShoppingItem[] } {
  return {
    shoppingListMon: buildMondayShoppingList(plan, portions),
    shoppingListFri: buildFridayShoppingList(plan, portions),
  };
}

export function groupByAisle(
  items: ShoppingItem[],
  lang: Lang,
): Array<{ category: ShoppingItem['storeCategory']; label: string; items: ShoppingItem[] }> {
  const aisleLabels = translations[lang].aisleLabels;
  return AISLE_ORDER.filter((category) => items.some((i) => i.storeCategory === category)).map((category) => ({
    category,
    label: aisleLabels[category],
    items: items.filter((i) => i.storeCategory === category),
  }));
}

/**
 * Einkaufslisten eines gespeicherten Plans neu berechnen (z.B. nach Änderungen an den Regeln für
 * Vorräte/Zusammenfassen), abgehakte Artikel bleiben abgehakt.
 */
export function refreshShoppingLists(plan: WeeklyPlan, portions: number = DEFAULT_PORTIONS): WeeklyPlan {
  const lists = buildShoppingLists(plan, portions);
  return {
    ...plan,
    shoppingListMon: preserveChecked(plan.shoppingListMon ?? [], lists.shoppingListMon),
    shoppingListFri: preserveChecked(plan.shoppingListFri ?? [], lists.shoppingListFri),
  };
}

/** Übernimmt den Abhak-Status aus einer alten Liste in eine neu berechnete (gleicher Artikel + Einheit). */
export function preserveChecked(oldItems: ShoppingItem[], newItems: ShoppingItem[]): ShoppingItem[] {
  // Über den zusammengefassten Schlüssel, damit z.B. abgehakte "Zwiebel" auch "Zwiebeln" abhakt.
  const keyOf = (i: ShoppingItem) => `${canonicalItemKey(i.item)}__${toShoppingUnit(i.item, i.unit, 0).unit}`;
  const checked = new Set(oldItems.filter((i) => i.checked).map(keyOf));
  return newItems.map((i) => (checked.has(keyOf(i)) ? { ...i, checked: true } : i));
}
