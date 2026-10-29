import { ShoppingItem } from '../types/menu';
import { canonicalItemKey } from './shopping';

// Einkaufsmengen so, wie es sie im deutschen Supermarkt zu kaufen gibt: statt "880 g Karotten"
// steht "1 kg" auf dem Zettel, statt "1,2 kg Rote Bete" "3 × 500 g", Salat als "2 Stück".
// Gerechnet wird immer aufgerundet (lieber etwas mehr als zu wenig). Die Tabelle unten ist
// bewusst einfach gehalten und kann jederzeit um weitere Waren ergänzt werden.

type PackRule =
  /** Lose Ware nach Gewicht (Netz/Beutel): bis 500 g -> 500 g, darüber volle kg. */
  | { kind: 'loose' }
  /** Frische Theke/Schalen (Fleisch, Fisch): auf volle `step` aufgerundet, als Gesamtmenge. */
  | { kind: 'steps'; step: number }
  /** Feste Packungsgröße (Becher, Dose, Glas, Beutel): Anzahl × Größe. */
  | { kind: 'pack'; size: number }
  /** Wird je Stück/Bund gekauft; `grams` = Gewicht eines Stücks, um g in Stück umzurechnen. */
  | { kind: 'piece'; grams: number; label: 'Stück' | 'Bund' | 'Päckchen' | 'Würfel' };

const loose: PackRule = { kind: 'loose' };
const pack = (size: number): PackRule => ({ kind: 'pack', size });
const piece = (grams: number, label: 'Stück' | 'Bund' | 'Päckchen' | 'Würfel' = 'Stück'): PackRule => ({ kind: 'piece', grams, label });

const RULES: [string[], PackRule][] = [
  // Gemüse & Obst
  [['Karotten', 'Möhren', 'Zwiebeln', 'Rote Zwiebeln', 'Kartoffeln', 'Süßkartoffeln', 'Äpfel', 'Birnen', 'Bananen', 'Tomaten', 'Grüne Bohnen', 'Rosenkohl', 'Pastinaken'], loose],
  [['Kopfsalat', 'Römersalat', 'Lollo Rosso'], piece(300)],
  [['Eisbergsalat'], piece(500)],
  [['Gurke', 'Salatgurken'], piece(400)],
  [['Paprika'], piece(150)],
  [['Zucchini'], piece(250)],
  [['Aubergine'], piece(300)],
  [['Brokkoli'], piece(500)],
  [['Blumenkohl'], piece(1000)],
  [['Kohlrabi'], piece(300)],
  [['Lauch', 'Porree'], piece(200)],
  [['Sellerie', 'Knollensellerie'], piece(600)],
  [['Fenchel'], piece(250)],
  [['Hokkaido-Kürbis', 'Kürbis'], piece(1200)],
  [['Rotkohl', 'Weißkohl'], piece(1200)],
  [['Wirsing', 'Chinakohl'], piece(800)],
  [['Knoblauch'], piece(50)],
  [['Mango', 'Ananas', 'Melone', 'Honigmelone'], piece(800)],
  [['Frühlingszwiebeln'], piece(150, 'Bund')],
  [['Radieschen'], piece(200, 'Bund')],
  [['Petersilie', 'Dill', 'Schnittlauch', 'Basilikum', 'Minze', 'Koriander', 'Bohnenkraut', 'Kräuter (gemischt)', 'Kräuter'], piece(30, 'Bund')],
  [['Rote Bete', 'Rote Bete (gekocht)'], pack(500)],
  [['Champignons'], pack(400)],
  [['Erdbeeren', 'Weintrauben', 'Spargel'], pack(500)],
  [['Feldsalat', 'Gemischter Blattsalat', 'Rucola', 'Babyspinat'], pack(150)],
  [['Blaubeeren', 'Himbeeren'], pack(125)],
  [['Zitrone', 'Limette', 'Orange'], piece(100)],
  // Kühlregal / Molkereiprodukte
  [['Sahne', 'Schlagsahne'], pack(200)],
  [['Schmand', 'Saure Sahne', 'Crème fraîche', 'Frischkäse', 'Feta'], pack(200)],
  [['Quark', 'Naturjoghurt', 'Joghurt'], pack(500)],
  [['Mascarpone'], pack(250)],
  [['Mozzarella'], pack(125)],
  [['Gouda', 'Geriebener Käse', 'Bergkäse gerieben', 'Emmentaler'], pack(200)],
  [['Parmesan'], pack(100)],
  [['Eier'], pack(10)],
  [['Wiener Würstchen'], pack(400)],
  [['Maultaschen'], pack(360)],
  [['Spätzle'], pack(500)],
  [['Strudelteig', 'Blätterteig'], pack(275)],
  [['Frischhefe'], piece(42, 'Würfel')],
  // Trockensortiment
  [['Reis', 'Basmatireis', 'Rundkornreis', 'Milchreis'], pack(1000)],
  [['Nudeln', 'Spaghetti', 'Penne', 'Fusilli', 'Bandnudeln', 'Suppennudeln', 'Lasagneplatten', 'Couscous', 'Grieß', 'Weichweizengrieß', 'Rote Linsen', 'Tellerlinsen', 'Müsli', 'Haferflocken', 'Kaffee', 'Toastbrot'], pack(500)],
  [['Cannelloni', 'Kakao', 'Rosinen', 'Mohn', 'Remoulade', 'Sojasoße', 'Teriyakisoße'], pack(250)],
  [['Paniermehl', 'Semmelbrösel', 'Speisestärke'], pack(400)],
  [['Butterkekse', 'Löffelbiskuits', 'Kürbiskerne'], pack(200)],
  [['Zartbitterschokolade', 'Schokoraspel', 'Schokostreusel', 'Kapern'], pack(100)],
  [['Puddingpulver Vanille', 'Puddingpulver Schokolade', 'Gelatine', 'Backpulver'], piece(40, 'Päckchen')],
  [['Passierte Tomaten', 'Ketchup', 'Mayonnaise', 'Fruchtsoße'], pack(500)],
  [['Stückige Tomaten', 'Kidneybohnen (Dose)', 'Kichererbsen (Dose)', 'Weiße Bohnen (Dose)', 'Kokosmilch'], pack(400)],
  [['Mais (Dose)', 'Mandarinen (Dose)'], pack(300)],
  [['Pfirsiche (Dose)'], pack(820)],
  [['Kirschen (Glas)', 'Apfelmus'], pack(700)],
  [['Gewürzgurken', 'Oliven'], pack(360)],
  [['Tomatenmark'], pack(200)],
  [['Marmelade', 'Pflaumenmus', 'Preiselbeeren (Glas)', 'Erdnussbutter'], pack(450)],
  [['Orangensaft', 'Fruchtsaft'], pack(1000)],
  [['Bauernbrot'], pack(1000)],
  [['Brot'], pack(750)],
  [['Baguette'], piece(250)],
  [['Brötchen'], piece(60)],
  [['Milchbrötchen'], pack(400)],
  [['Burgerbrötchen', 'Wraps'], pack(6)],
  [['Senf'], pack(250)],
  // Tiefkühl
  [['Spinat (TK)', 'Blattspinat (TK)'], pack(750)],
  [['Fischstäbchen (TK)'], pack(450)],
  [['Beeren (TK)', 'Himbeeren (TK)', 'Blaubeeren (TK)'], pack(500)],
];

const RULE_BY_KEY = new Map<string, PackRule>();
for (const [names, rule] of RULES) {
  for (const name of names) RULE_BY_KEY.set(canonicalItemKey(name), rule);
}

/** Standard, wenn eine Ware nicht in der Tabelle steht - je nach Regal. */
function defaultRule(item: ShoppingItem): PackRule | null {
  if (item.unit !== 'g' && item.unit !== 'ml') return null;
  switch (item.storeCategory) {
    case 'gemuese':
      return loose;
    case 'kuehlung':
      // Fleisch & Fisch: an der Theke bzw. in Schalen, auf 500 g aufgerundet ("1,5 kg").
      return { kind: 'steps', step: 500 };
    case 'mopro':
      return pack(item.unit === 'ml' ? 500 : 250);
    case 'tk':
      // Tiefkühlware gibt es in vielen Beutelgrößen - als Gesamtmenge auf 500 g aufgerundet.
      return { kind: 'steps', step: 500 };
    case 'trocken':
    default:
      return pack(500);
  }
}

function formatSize(amount: number, unit: string): string {
  const number = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
  if (unit === 'g' && amount >= 1000) return `${number(amount / 1000)} kg`;
  if (unit === 'ml' && amount >= 1000) return `${number(amount / 1000)} l`;
  return `${number(amount)} ${unit}`;
}

/** Wie viele Packungen/Stück nötig sind - aufgerundet, kleine Rechenungenauigkeiten ignoriert. */
function countOf(amount: number, size: number): number {
  return Math.max(1, Math.ceil(amount / size - 1e-6));
}

/**
 * Menge so, wie man sie im Supermarkt kauft (z.B. "1 kg", "3 × 500 g", "2 Stück", "20 Stück (2 × 10er)").
 * `null`, wenn es keine sinnvolle Packung gibt - dann gilt die normale Mengenanzeige.
 */
export function purchaseAmount(item: ShoppingItem): string | null {
  const rule = RULE_BY_KEY.get(canonicalItemKey(item.item)) ?? defaultRule(item);
  if (!rule) return null;

  if (rule.kind === 'loose') {
    if (item.unit !== 'g' && item.unit !== 'ml') return null;
    return item.amount <= 500 ? formatSize(500, item.unit) : formatSize(countOf(item.amount, 1000) * 1000, item.unit);
  }

  if (rule.kind === 'steps') {
    if (item.unit !== 'g' && item.unit !== 'ml') return null;
    return formatSize(countOf(item.amount, rule.step) * rule.step, item.unit);
  }

  if (rule.kind === 'piece') {
    const count = item.unit === 'Stück' ? countOf(item.amount, 1) : item.unit === 'g' ? countOf(item.amount, rule.grams) : null;
    return count === null ? null : `${count} ${rule.label}`;
  }

  // Packungen in Stück (Eier im 10er-Karton): Gesamtzahl + Kartons.
  if (item.unit === 'Stück') {
    const count = countOf(item.amount, rule.size);
    return count === 1 ? `${rule.size} Stück (${rule.size}er-Packung)` : `${count * rule.size} Stück (${count} × ${rule.size}er)`;
  }
  if (item.unit !== 'g' && item.unit !== 'ml') return null;
  const count = countOf(item.amount, rule.size);
  return count === 1 ? formatSize(rule.size, item.unit) : `${count} × ${formatSize(rule.size, item.unit)}`;
}
