# Kinderheim Menü & Einkauf Planer (Weilburg) - PRD

## 1. Überblick & Ziel
Eine spezialisierte Web- und Mobile-App (PWA / Android-optimiert) für den Hauswirtschafts-Bereich im Kinderheim (10-12 Personen, Kinder im Alter von 5-17 Jahren). 
Ziel ist es, den wöchentlichen Speiseplan automatisiert nach festen ernährungsphysiologischen und organisatorischen Regeln zu erstellen, Rezepte mit Zubereitungszeiten bereitzustellen, eine strukturierte Einkaufsliste für Montag und Freitag zu generieren und Pläne zu archivieren.

---

## 2. Kernregeln & Geschäftslogik (Business Rules)

### 2.1 Zielgruppe & Portionen
- Feste Portionsgröße: Standardmäßig berechnet für **10 bis 12 Personen** (kinder- und jugendgerechte Mengen).
- Essenszeit: Täglich um 18:00 Uhr warm servierfertig.

### 2.2 Struktur des Abendmenüs (Montag bis Freitag)
Jedes Tagesmenü besteht verbindlich aus:
1. **Vorspeise:** Salat ODER Suppe
2. **Hauptspeise:** Hauptgericht + Beilage (z. B. Kartoffeln, Reis, Nudeln, Gemüsebeilage)
3. **Nachspeise:** Dessert (z. B. Joghurt mit Früchten, Pudding, Obst)

### 2.3 Wöchentliche Protein- & Speiseverteilung (5 Tage)
Die 5 Wochentage müssen ohne Dopplungen folgende Kategorien abdecken:
- **1x Geflügel (Tavuk)**
- **1x Rindfleisch (Dana eti)**
- **1x Fisch (Balık)**
- **1x Süße Hauptspeise (Süße Hauptgericht)** (z. B. Milchreis mit Kirschen, Kaiserschmarrn, Germknödel, Pfannkuchen)
- **1x Vegetarisch / Gemüsegericht (Sebze)**

### 2.4 Einkaufslogik (Montag & Freitag)
- **Einkauf 1 (Montag):** Zutaten für Montag, Dienstag, Mittwoch (frische Zutaten).
- **Einkauf 2 (Freitag):** Zutaten für Freitag (und ggf. Vorräte für die Folgewoche).
- Zutaten werden nach Supermarkt-Kategorien gruppiert:
  - Obst & Gemüse
  - Fleisch & Fisch (Kühlung)
  - Molkereiprodukte (Mopro)
  - Trockensortiment / Vorrat (Reis, Nudeln, Konserven, Gewürze)
  - Tiefkühlware (TK)

### 2.5 Zeitplanung & Automatisierung
- **Sonntags-Automatik:** Jeden Sonntag generiert die App automatisch einen Entwurf für die Folgewoche (Montag–Freitag).
- Benutzer kann Gerichte vor Bestätigung mit 1 Klick austauschen (Shuffle / Re-roll einzelner Tage).
- **Historie & Archiv:** Jeder freigegebene Wochenplan wird mit Datum und KW (Kalenderwoche) in der Datenbank gespeichert, um Wiederholungen innerhalb von 4 Wochen zu minimieren.

---

## 3. Datenmodell (Schema)

### 3.1 Recipe (Rezept)
```typescript
interface Recipe {
  id: string;
  name: string; // z.B. "Rindergulasch mit Spätzle"
  course: 'vorspeise' | 'hauptspeise' | 'nachspeise';
  subCategory?: 'suppe' | 'salat' | 'beilage' | 'dessert';
  proteinCategory?: 'gefluegel' | 'rind' | 'fisch' | 'suess' | 'vegetarisch';
  prepTimeMinutes: number; // Vorbereitungszeit
  cookTimeMinutes: number; // Kochzeit
  totalTimeMinutes: number;
  instructions: string[]; // Zubereitungsschritte
  ingredients: {
    item: string;
    amountPer10Pax: number;
    unit: string; // g, kg, Stück, ml, EL
    storeCategory: 'gemuese' | 'kuehlung' | 'mopro' | 'trocken' | 'tk';
  }[];
}
```

### 3.2 WeeklyPlan (Wochenplan)
```typescript
interface DayMenu {
  dayOfWeek: 'Montag' | 'Dienstag' | 'Mittwoch' | 'Donnerstag' | 'Freitag';
  vorspeise: Recipe;
  hauptspeise: Recipe;
  beilage: string;
  nachspeise: Recipe;
  targetServeTime: "18:00";
  prepStartTime: string; // Berechnet aus 18:00 minus totalTime
}

interface WeeklyPlan {
  id: string;
  calendarWeek: number; // z.B. KW 40
  year: number;
  days: DayMenu[];
  shoppingListMon: ShoppingItem[];
  shoppingListFri: ShoppingItem[];
  isFinalized: boolean;
  createdAt: string;
}
```

---

## 4. Technische Architektur
- **Frontend / Mobile:** React + Vite + TailwindCSS, verpackt als progressive Web App (PWA) für einfache Installation auf jedem Android-Smartphone (Homescreen-App) oder Capacitor / React Native.
- **Backend & Speicherung:** SQLite / Dexie.js (Offline-first im Browser) oder leichtgewichtiges Node.js/FastAPI Backend.
- **Export & Teilen:** 
  - PDF-Export des Wochenplans als A4-Aushang für den Speisesaal / die Küche.
  - Interaktive Einkaufsliste mit Checkboxen für das Smartphone beim Einkaufen.
