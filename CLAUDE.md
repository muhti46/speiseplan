# Project Overview: Kinderheim Menü- & Einkaufs-Planer
Speiseplan- und Einkaufslisten-App für die Hauswirtschaft (Kinderheim Weilburg, 10-12 Personen).

## Tech Stack
- Frontend/Mobile: React, Vite, TypeScript, Tailwind CSS, Lucide-Icons (PWA-enabled for Android).
- State/Storage: LocalStorage / IndexedDB (Dexie) mit optionalem JSON-Export/Import.
- Export: PDF Generation (jspdf / html2canvas) für Aushang-Druck (A4).

## Project Structure
- `src/components/`: Reusable UI elements (Tabs, Cards, CheckboxLists, Chat UI).
- `src/data/`: Default recipe database (`recipes.json`) covering 10-12 pax portions; seeds the `recipes` IndexedDB table on first load.
- `src/services/`: Planner engine (`generator.ts`), Shopping list builder (`shopping.ts`), Storage (`storage.ts`, Dexie tables `plans` + `recipes`), AI agent (`services/ai/`).
- `src/types/`: TypeScript definitions (`menu.ts`, `recipe.ts`, `ai.ts`).

## AI Chat Agent (`src/services/ai/`)
- Provider: Google Gemini (`@google/genai`), model `gemini-2.5-flash` (see `client.ts`).
- User-supplied Gemini API key only, stored in `localStorage` (`speiseplan-gemini-key`, see `apiKey.ts`) — there is no backend, so the key is visible to anyone with device access. Never bundle a real key into the app.
- Tool/function-calling: the agent can generate a full recipe from just a dish name, add it to the recipe library, swap a single meal, re-roll a day, regenerate the week, and answer questions about the current plan/shopping list (`tools.ts`, orchestrated in `chat.ts`). All plan/recipe mutations go through the existing `generator.ts`/`shopping.ts`/`storage.ts` functions, never duplicated logic.
- Model output for new recipes is validated against the app's exact enums (`Course`, `ProteinCategory`, `SubCategory`, `StoreCategory`) via `recipeCoercion.ts` before being accepted — an invalid/missing `proteinCategory` on a Hauptspeise is rejected rather than defaulted, to protect the 5-day protein rule below.

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
