import Dexie, { Table } from 'dexie';
import { WeeklyPlan } from '../types/menu';
import { Recipe, RecipeDetail, RecipeTranslation } from '../types/recipe';
import { ChatConversation, ChatMessage } from '../types/ai';
import recipesData from '../data/recipes.json';
import type { DishWebImage } from './dishImages';

function seedRecipes(): Recipe[] {
  return (recipesData as Recipe[]).map((recipe) => ({ ...recipe, source: 'builtin' as const }));
}

/** Fragen/Antworten zu einem einzelnen Rezept (ein Verlauf je Rezept). */
export interface RecipeChat {
  recipeId: string;
  messages: ChatMessage[];
  updatedAt: string;
}

class SpeiseplanDB extends Dexie {
  plans!: Table<WeeklyPlan, string>;
  recipes!: Table<Recipe, string>;
  chatConversations!: Table<ChatConversation, string>;
  currentPlan!: Table<{ key: string; plan: WeeklyPlan }, string>;
  recipeDetails!: Table<RecipeDetail, string>;
  recipeTranslations!: Table<RecipeTranslation, string>;
  recipeChats!: Table<RecipeChat, string>;
  recipeImages!: Table<{ recipeId: string; dataUrl: string }, string>;
  recipeWebImages!: Table<DishWebImage, string>;

  constructor() {
    super('speiseplan-db');
    this.version(1).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
    });
    this.version(2)
      .stores({
        plans: 'id, year, calendarWeek, isFinalized, createdAt',
        recipes: 'id, course, proteinCategory, subCategory',
      })
      // Läuft nur beim Upgrade einer bestehenden (v1-)Datenbank, nicht bei einer
      // komplett neuen Installation - siehe on('populate') unten für den Fresh-Install-Fall.
      .upgrade(async (tx) => {
        await tx.table('recipes').bulkPut(seedRecipes());
      });
    this.version(3).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
      recipes: 'id, course, proteinCategory, subCategory',
      chatConversations: 'id, updatedAt',
    });
    // Der gerade bearbeitete Wochenplan (auch unfreigegeben) - bewusst getrennt von `plans`,
    // damit Entwürfe nicht im Archiv auftauchen.
    this.version(4).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
      recipes: 'id, course, proteinCategory, subCategory',
      chatConversations: 'id, updatedAt',
      currentPlan: 'key',
    });
    // Ausführliche, KI-erzeugte Anleitungen je Rezept und Sprache.
    this.version(5).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
      recipes: 'id, course, proteinCategory, subCategory',
      chatConversations: 'id, updatedAt',
      currentPlan: 'key',
      recipeDetails: 'key, recipeId',
    });
    // Fotos zu Rezepten (verkleinert als Data-URL), getrennt von den Rezepten, damit sie nicht in Pläne kopiert werden.
    this.version(6).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
      recipes: 'id, course, proteinCategory, subCategory',
      chatConversations: 'id, updatedAt',
      currentPlan: 'key',
      recipeDetails: 'key, recipeId',
      recipeImages: 'recipeId',
    });
    // Rezept-Chat: ein Gesprächsverlauf je Rezept.
    this.version(7).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
      recipes: 'id, course, proteinCategory, subCategory',
      chatConversations: 'id, updatedAt',
      currentPlan: 'key',
      recipeDetails: 'key, recipeId',
      recipeImages: 'recipeId',
      recipeChats: 'recipeId',
    });
    // Übersetzte Kurz-Schritte je Rezept und Sprache.
    this.version(8).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
      recipes: 'id, course, proteinCategory, subCategory',
      chatConversations: 'id, updatedAt',
      currentPlan: 'key',
      recipeDetails: 'key, recipeId',
      recipeImages: 'recipeId',
      recipeChats: 'recipeId',
      recipeTranslations: 'key, recipeId',
    });
    // Erweiterter Standard-Rezeptpool: fehlende Built-in-Rezepte nachladen, vorhandene (ggf. bearbeitete) bleiben unberührt.
    this.version(9)
      .stores({
        plans: 'id, year, calendarWeek, isFinalized, createdAt',
        recipes: 'id, course, proteinCategory, subCategory',
        chatConversations: 'id, updatedAt',
        currentPlan: 'key',
        recipeDetails: 'key, recipeId',
        recipeImages: 'recipeId',
        recipeChats: 'recipeId',
        recipeTranslations: 'key, recipeId',
      })
      .upgrade(async (tx) => {
        const table = tx.table('recipes');
        const existing = new Set(await table.toCollection().primaryKeys());
        await table.bulkPut(seedRecipes().filter((r) => !existing.has(r.id)));
      });

    // Automatisch gefundene Gerichtfotos (Wikipedia) bzw. Merker "nichts gefunden"/"ausgeblendet".
    this.version(10).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
      recipes: 'id, course, proteinCategory, subCategory',
      chatConversations: 'id, updatedAt',
      currentPlan: 'key',
      recipeDetails: 'key, recipeId',
      recipeImages: 'recipeId',
      recipeChats: 'recipeId',
      recipeTranslations: 'key, recipeId',
      recipeWebImages: 'recipeId',
    });

    // Läuft nur einmal, wenn die Datenbank komplett neu (ohne Vorgängerversion) angelegt wird.
    this.on('populate', async (tx) => {
      await tx.table('recipes').bulkPut(seedRecipes());
    });
  }
}

export const db = new SpeiseplanDB();

// ---------------------------------------------------------------- Öffnen der Datenbank überwachen
//
// Bei einem Update mit neuer Datenbank-Version (z.B. 9 -> 10) muss JEDE noch offene Kopie der App
// (zweites App-Fenster, Chrome-Tab mit derselben Adresse, eingefrorene Hintergrund-Instanz) die
// alte Verbindung freigeben. Bis dahin wartet das Öffnen - alle Lese-/Schreibzugriffe hängen, die
// App wirkt leer ("Daten weg"), Plan-Erzeugen und Chat tun nichts. Die Daten sind aber noch da.

export type DbStatus = 'opening' | 'ready' | 'blocked' | 'error';

let dbStatus: DbStatus = 'opening';
let dbError: string | null = null;
const dbStatusListeners = new Set<() => void>();
// Ohne Blockade-Ereignis trotzdem warnen, wenn das Öffnen auffällig lange dauert.
const OPEN_TIMEOUT_MS = 5000;

function setDbStatus(status: DbStatus, error: string | null = null): void {
  dbStatus = status;
  dbError = error;
  dbStatusListeners.forEach((listener) => listener());
}

export function subscribeDbStatus(listener: () => void): () => void {
  dbStatusListeners.add(listener);
  return () => dbStatusListeners.delete(listener);
}

export function getDbStatus(): DbStatus {
  return dbStatus;
}

export function getDbError(): string | null {
  return dbError;
}

if (typeof indexedDB !== 'undefined') {
  // Diese Kopie der App blockiert ein Update in einer anderen Kopie: Verbindung sofort freigeben
  // und neu laden, damit auch diese Kopie die neue Version (und Datenbank) benutzt.
  db.on('versionchange', () => {
    db.close();
    window.location.reload();
    return false;
  });
  db.on('blocked', () => {
    if (dbStatus !== 'ready') setDbStatus('blocked');
  });
  const timer = window.setTimeout(() => {
    if (dbStatus === 'opening') setDbStatus('blocked');
  }, OPEN_TIMEOUT_MS);
  db.open()
    .then(() => setDbStatus('ready'))
    .catch((err: unknown) => setDbStatus('error', err instanceof Error ? `${err.name}: ${err.message}` : String(err)))
    .finally(() => window.clearTimeout(timer));
}

export async function saveRecipeTranslation(translation: RecipeTranslation): Promise<void> {
  await db.recipeTranslations.put(translation);
}

export async function getAllRecipeTranslations(): Promise<RecipeTranslation[]> {
  return db.recipeTranslations.toArray();
}

export async function deleteRecipeTranslationsFor(recipeId: string): Promise<void> {
  await db.recipeTranslations.where('recipeId').equals(recipeId).delete();
}

export async function saveRecipeChat(chat: RecipeChat): Promise<void> {
  await db.recipeChats.put(chat);
}

export async function getRecipeChat(recipeId: string): Promise<RecipeChat | undefined> {
  return db.recipeChats.get(recipeId);
}

export async function deleteRecipeChat(recipeId: string): Promise<void> {
  await db.recipeChats.delete(recipeId);
}

export async function saveDishWebImage(image: DishWebImage): Promise<void> {
  await db.recipeWebImages.put(image);
}

export async function getAllDishWebImages(): Promise<Record<string, DishWebImage>> {
  const list = await db.recipeWebImages.toArray();
  return Object.fromEntries(list.map((i) => [i.recipeId, i]));
}

export async function saveRecipeImage(recipeId: string, dataUrl: string): Promise<void> {
  await db.recipeImages.put({ recipeId, dataUrl });
}

export async function deleteRecipeImage(recipeId: string): Promise<void> {
  await db.recipeImages.delete(recipeId);
}

export async function getAllRecipeImages(): Promise<Record<string, string>> {
  const list = await db.recipeImages.toArray();
  return Object.fromEntries(list.map((i) => [i.recipeId, i.dataUrl]));
}

export async function saveRecipeDetail(detail: RecipeDetail): Promise<void> {
  await db.recipeDetails.put(detail);
}

export async function deleteRecipeDetailsFor(recipeId: string): Promise<void> {
  await db.recipeDetails.where('recipeId').equals(recipeId).delete();
}

export async function getAllRecipeDetails(): Promise<RecipeDetail[]> {
  return db.recipeDetails.toArray();
}

const CURRENT_PLAN_KEY = 'current';

export async function saveCurrentPlan(plan: WeeklyPlan): Promise<void> {
  await db.currentPlan.put({ key: CURRENT_PLAN_KEY, plan });
}

export async function getCurrentPlan(): Promise<WeeklyPlan | undefined> {
  return (await db.currentPlan.get(CURRENT_PLAN_KEY))?.plan;
}

export async function savePlan(plan: WeeklyPlan): Promise<void> {
  await db.plans.put(plan);
}

export async function deletePlan(id: string): Promise<void> {
  await db.plans.delete(id);
}

export async function getPlan(id: string): Promise<WeeklyPlan | undefined> {
  return db.plans.get(id);
}

export async function getAllPlans(): Promise<WeeklyPlan[]> {
  const plans = await db.plans.toArray();
  return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Rezept-IDs aus finalisierten Plänen der letzten `weeksBack` Wochen,
 * um Dopplungen im Speiseplan zu minimieren (PRD 2.5).
 */
export async function getRecentRecipeIds(weeksBack = 4): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);

  const plans = await db.plans
    .filter((p) => p.isFinalized && new Date(p.createdAt) >= cutoff)
    .toArray();

  const ids = new Set<string>();
  for (const plan of plans) {
    for (const day of plan.days) {
      ids.add(day.vorspeise.id);
      ids.add(day.hauptspeise.id);
      ids.add(day.nachspeise.id);
    }
  }
  return Array.from(ids);
}

export async function exportAllPlansAsJson(): Promise<string> {
  const plans = await getAllPlans();
  return JSON.stringify(plans, null, 2);
}

export async function importPlansFromJson(json: string): Promise<number> {
  const plans = JSON.parse(json) as WeeklyPlan[];
  await db.plans.bulkPut(plans);
  return plans.length;
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  await db.recipes.put(recipe);
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.delete(id);
}

export async function getAllRecipes(): Promise<Recipe[]> {
  return db.recipes.toArray();
}

export async function saveConversation(conversation: ChatConversation): Promise<void> {
  await db.chatConversations.put(conversation);
}

export async function deleteConversation(id: string): Promise<void> {
  await db.chatConversations.delete(id);
}

export async function getAllConversations(): Promise<ChatConversation[]> {
  const list = await db.chatConversations.toArray();
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
