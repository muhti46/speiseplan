# Project Overview: Kinderheim Menü- & Einkaufs-Planer
Speiseplan- und Einkaufslisten-App für die Hauswirtschaft (Kinderheim Weilburg, 10-12 Personen).

## Tech Stack
- Frontend/Mobile: React, Vite, TypeScript, Tailwind CSS, Lucide-Icons (PWA-enabled for Android).
- State/Storage: LocalStorage / IndexedDB (Dexie). App updates keep the data (Dexie schema upgrades only add tables), but uninstalling the PWA wipes it — `services/backup.ts` + `BackupPanel` (Archiv tab) export/restore all tables as one JSON file (merge on restore, Gemini key excluded), request `navigator.storage.persist()`, and remind after 7 days without a backup. Updates must never require reinstalling: `services/pwaUpdate.ts` registers the SW itself (`injectRegister: false`) and checks for updates on start, every 30 min and on returning to the foreground; `AppVersion` (Archiv tab) shows the build time (`__APP_BUILD__`) and a manual update check. Automatic Google Drive backup (`services/driveBackup.ts`, UI `DriveBackupSection`): Dexie hooks mark changes and upload one file per day (keeps 30) to the app-created folder, scope `drive.file`; OAuth runs server-side in Vercel functions `api/google/{start,callback,token,logout}.ts` (refresh token only in an HttpOnly cookie scoped to `/api/google`, env `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, setup in `docs/google-drive-backup.md`). Guards: never auto-upload an empty app, never auto-overwrite existing Drive backups from a device that hasn't backed up/restored yet. The SW must not serve `index.html` for `/api/` (`navigateFallbackDenylist`).
- Export: PDF Generation (jspdf / html2canvas) für Aushang-Druck (A4).

## Project Structure
- `src/components/`: Reusable UI elements (Tabs, Cards, CheckboxLists, Chat UI).
- `src/data/`: Default recipe database (`recipes.json`) covering 10-12 pax portions; seeds the `recipes` IndexedDB table on first load.
- `src/services/`: Planner engine (`generator.ts`), Shopping list builder (`shopping.ts`), Storage (`storage.ts`, Dexie tables `plans` + `recipes`), AI agent (`services/ai/`).
- `src/types/`: TypeScript definitions (`menu.ts`, `recipe.ts`, `ai.ts`).

## AI Chat Agent (`src/services/ai/`)
- Provider: Google Gemini (`@google/genai`), model `gemini-3.8-flash` (see `client.ts`; `gemini-2.5-flash` was retired for new API keys as of late 2026).
- User-supplied Gemini API key only, stored in `localStorage` (`speiseplan-gemini-key`, see `apiKey.ts`) — there is no backend, so the key is visible to anyone with device access. Never bundle a real key into the app.
- Tool/function-calling: the agent can generate a full recipe from just a dish name, add it to the recipe library, swap a single meal, re-roll a day, regenerate the week, and answer questions about the current plan/shopping list (`tools.ts`, orchestrated in `chat.ts`). Whole weeks (e.g. a photographed plan) go through `set_week_plan` in ONE tool call: names are fuzzy-matched to the library (`findRecipeByName`), missing dishes are created in batches of 5 per Gemini call (`generateRecipeDrafts`), duplicate protein categories are reported back, not blocked. All plan/recipe mutations go through the existing `generator.ts`/`shopping.ts`/`storage.ts` functions, never duplicated logic.
- Chat attachments (`attachments.ts`): photos (camera or upload, downscaled to JPEG) and PDFs are sent to Gemini as `inlineData` (main chat and the per-recipe chat in `RecipeChat.tsx`), so a photographed/PDF recipe can be read and saved via `generate_recipe` + `add_recipe_to_library`. Only the newest attachment-bearing turns are re-sent from history to stay under the inline size limit.
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
