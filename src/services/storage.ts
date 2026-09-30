import Dexie, { Table } from 'dexie';
import { WeeklyPlan } from '../types/menu';
import { Recipe, RecipeDetail } from '../types/recipe';
import { ChatConversation } from '../types/ai';
import recipesData from '../data/recipes.json';

function seedRecipes(): Recipe[] {
  return (recipesData as Recipe[]).map((recipe) => ({ ...recipe, source: 'builtin' as const }));
}

class SpeiseplanDB extends Dexie {
  plans!: Table<WeeklyPlan, string>;
  recipes!: Table<Recipe, string>;
  chatConversations!: Table<ChatConversation, string>;
  currentPlan!: Table<{ key: string; plan: WeeklyPlan }, string>;
  recipeDetails!: Table<RecipeDetail, string>;

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

    // Läuft nur einmal, wenn die Datenbank komplett neu (ohne Vorgängerversion) angelegt wird.
    this.on('populate', async (tx) => {
      await tx.table('recipes').bulkPut(seedRecipes());
    });
  }
}

export const db = new SpeiseplanDB();

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
