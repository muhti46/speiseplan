# Project Overview: Kinderheim Menü- & Einkaufs-Planer
Speiseplan- und Einkaufslisten-App für die Hauswirtschaft (Kinderheim Weilburg, 10-12 Personen).

## Tech Stack
- Frontend/Mobile: React, Vite, TypeScript, Tailwind CSS, Lucide-Icons (PWA-enabled for Android).
- State/Storage: LocalStorage / IndexedDB (Dexie) mit optionalem JSON-Export/Import.
- Export: PDF Generation (jspdf / html2canvas) für Aushang-Druck (A4).

## Project Structure
- `src/components/`: Reusable UI elements (Tabs, Cards, CheckboxLists).
- `src/data/`: Default recipe database (`recipes.json`) covering 10-12 pax portions.
- `src/services/`: Planner engine (`generator.ts`), Shopping list builder (`shopping.ts`), Storage.
- `src/types/`: TypeScript definitions (`menu.ts`, `recipe.ts`).

## Core Rules & Constraints
1. **Portionen:** Always scale for 10-12 persons (children/teens aged 5-17).
2. **Menü-Struktur:** Exactly 5 days (Mo-Fr), each with:
   - Vorspeise (Salat or Suppe)
   - Hauptspeise (with defined Beilage)
   - Nachspeise (Dessert)
3. **5-Tage Protein-Regel (Keine Dopplung in einer Woche):**
   - 1x Geflügel (Hähnchen/Pute)
   - 1x Rindfleisch (Kein Schweinefleisch)
   - 1x Fisch
   - 1x Süße Hauptspeise (z.B. Milchreis, Kaiserschmarrn, Pfannkuchen)
   - 1x Vegetarisch / Gemüsegericht
4. **Zubereitungszeiten:** Must calculate starting time based on 18:00 serving deadline.
5. **Einkaufstage:** Split shopping list into Monday (Mo-Mi meals) and Friday (Fr + staples). Group by supermarket aisle.

## Commands
- Dev Server: `npm run dev`
- Build: `npm run build`
- Run Tests: `npm run test`
