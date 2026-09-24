import { FunctionDeclaration, Schema, Type } from '@google/genai';
import { Course, Recipe } from '../../types/recipe';
import { DayOfWeek, DAYS_OF_WEEK } from '../../types/menu';
import { ChatContext } from '../../types/ai';
import { applyMealSwap, generateWeeklyPlan, rerollDay } from '../generator';
import { buildShoppingLists } from '../shopping';
import { coerceRecipe, isCoercionError } from './recipeCoercion';

// Klassisches Schema/Type-Format statt parametersJsonSchema: die Gemini API
// validiert Function-Declaration-Schemas strikt und lehnt unbekannte
// JSON-Schema-Keywords mit einem 400 ab - dieses Format ist stabil dokumentiert.
const recipeFieldsSchema: Record<string, Schema> = {
  name: { type: Type.STRING, description: 'Name des Gerichts' },
  course: { type: Type.STRING, enum: ['vorspeise', 'hauptspeise', 'nachspeise'] },
  subCategory: { type: Type.STRING, enum: ['suppe', 'salat', 'beilage', 'dessert'] },
  proteinCategory: {
    type: Type.STRING,
    enum: ['gefluegel', 'rind', 'fisch', 'suess', 'vegetarisch'],
    description: 'Nur bei course "hauptspeise" erforderlich.',
  },
  beilage: { type: Type.STRING, description: 'Nur bei course "hauptspeise": Name der Beilage, oder "—".' },
  prepTimeMinutes: { type: Type.NUMBER },
  cookTimeMinutes: { type: Type.NUMBER },
  instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
  ingredients: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        item: { type: Type.STRING },
        amountPer10Pax: { type: Type.NUMBER, description: 'Menge für 10 Portionen' },
        unit: { type: Type.STRING },
        storeCategory: { type: Type.STRING, enum: ['gemuese', 'kuehlung', 'mopro', 'trocken', 'tk'] },
      },
      required: ['item', 'amountPer10Pax', 'unit', 'storeCategory'],
    },
  },
};

export const chatToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'generate_recipe',
    description:
      'Erzeugt ein vollständiges Rezept (Zutaten, Zubereitungsschritte, Zeiten, Kategorie) für ein neues Gericht. Muss vor add_recipe_to_library aufgerufen werden.',
    parameters: {
      type: Type.OBJECT,
      properties: recipeFieldsSchema,
      required: ['name', 'course', 'prepTimeMinutes', 'cookTimeMinutes', 'instructions', 'ingredients'],
    },
  },
  {
    name: 'add_recipe_to_library',
    description: 'Speichert ein zuvor mit generate_recipe erzeugtes Rezept dauerhaft in der Rezeptdatenbank.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        recipeId: { type: Type.STRING, description: 'Die recipeId aus der generate_recipe-Antwort.' },
      },
      required: ['recipeId'],
    },
  },
  {
    name: 'swap_meal',
    description:
      'Ersetzt einen einzelnen Gang (Vorspeise/Hauptspeise/Nachspeise) an einem bestimmten Tag durch ein konkretes, bereits existierendes Rezept.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dayOfWeek: { type: Type.STRING, enum: DAYS_OF_WEEK },
        course: { type: Type.STRING, enum: ['vorspeise', 'hauptspeise', 'nachspeise'] },
        recipeId: { type: Type.STRING },
        recipeName: { type: Type.STRING, description: 'Alternativ zu recipeId: Name des gewünschten Rezepts.' },
      },
      required: ['dayOfWeek', 'course'],
    },
  },
  {
    name: 'reroll_day',
    description: 'Würfelt Vorspeise, Hauptspeise und Nachspeise eines Tages neu, Protein-Kategorie bleibt erhalten.',
    parameters: {
      type: Type.OBJECT,
      properties: { dayOfWeek: { type: Type.STRING, enum: DAYS_OF_WEEK } },
      required: ['dayOfWeek'],
    },
  },
  {
    name: 'regenerate_week',
    description: 'Erzeugt einen komplett neuen Wochenplan nach der 5-Tage-Protein-Regel.',
  },
  {
    name: 'get_plan_summary',
    description: 'Liefert eine kompakte Zusammenfassung des aktuellen Wochenplans (Gerichte je Tag).',
  },
  {
    name: 'get_shopping_list',
    description: 'Liefert die Einkaufsliste für Montag (Mo-Mi) oder Freitag (Do-Fr).',
    parameters: {
      type: Type.OBJECT,
      properties: { list: { type: Type.STRING, enum: ['mon', 'fri'] } },
      required: ['list'],
    },
  },
];

function findRecipe(recipes: Recipe[], course: Course, recipeId?: string, recipeName?: string): Recipe | undefined {
  if (recipeId) return recipes.find((r) => r.id === recipeId && r.course === course);
  if (recipeName) {
    const needle = recipeName.trim().toLowerCase();
    return recipes.find((r) => r.course === course && r.name.toLowerCase().includes(needle));
  }
  return undefined;
}

/**
 * Erstellt einen Tool-Dispatcher für eine einzelne Chat-Anfrage. `pendingRecipes`
 * hält von generate_recipe erzeugte, aber noch nicht gespeicherte Rezepte
 * über mehrere Tool-Runden derselben Anfrage hinweg vor.
 */
export function createToolDispatcher(ctx: ChatContext) {
  const pendingRecipes = new Map<string, Recipe>();

  async function dispatch(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (name) {
      case 'generate_recipe': {
        const result = coerceRecipe(args);
        if (isCoercionError(result)) return { error: result.error };
        pendingRecipes.set(result.id, result);
        return { recipeId: result.id, recipe: result };
      }

      case 'add_recipe_to_library': {
        const recipeId = args.recipeId as string | undefined;
        const recipe = recipeId ? pendingRecipes.get(recipeId) : undefined;
        if (!recipe) {
          return { error: 'Unbekannte recipeId. Zuerst generate_recipe aufrufen.' };
        }
        ctx.onRecipeAdd(recipe);
        pendingRecipes.delete(recipeId!);
        return { status: 'saved', recipeId };
      }

      case 'swap_meal': {
        if (!ctx.plan) return { error: 'Es existiert noch kein Wochenplan.' };
        const dayOfWeek = args.dayOfWeek as DayOfWeek;
        const course = args.course as Course;
        const recipe = findRecipe(ctx.recipes, course, args.recipeId as string, args.recipeName as string);
        if (!recipe) {
          return {
            error:
              'Kein passendes Rezept gefunden. Gib recipeId oder recipeName eines existierenden Rezepts an, oder rufe reroll_day für den ganzen Tag auf.',
          };
        }
        const updated = applyMealSwap(ctx.plan, dayOfWeek, course, recipe);
        const { shoppingListMon, shoppingListFri } = buildShoppingLists(updated);
        const finalPlan = { ...updated, shoppingListMon, shoppingListFri };
        ctx.onPlanUpdate(finalPlan);
        return { status: 'updated', dayOfWeek, course, recipeName: recipe.name };
      }

      case 'reroll_day': {
        if (!ctx.plan) return { error: 'Es existiert noch kein Wochenplan.' };
        const dayOfWeek = args.dayOfWeek as DayOfWeek;
        const updated = rerollDay(ctx.recipes, ctx.plan, dayOfWeek, ctx.recentRecipeIds);
        const { shoppingListMon, shoppingListFri } = buildShoppingLists(updated);
        const finalPlan = { ...updated, shoppingListMon, shoppingListFri };
        ctx.onPlanUpdate(finalPlan);
        return { status: 'updated', dayOfWeek };
      }

      case 'regenerate_week': {
        const newPlan = generateWeeklyPlan(ctx.recipes, {
          calendarWeek: ctx.calendarWeek,
          year: ctx.year,
          recentRecipeIds: ctx.recentRecipeIds,
        });
        const { shoppingListMon, shoppingListFri } = buildShoppingLists(newPlan);
        const finalPlan = { ...newPlan, shoppingListMon, shoppingListFri };
        ctx.onPlanUpdate(finalPlan);
        return { status: 'updated' };
      }

      case 'get_plan_summary': {
        if (!ctx.plan) return { error: 'Es existiert noch kein Wochenplan.' };
        return {
          calendarWeek: ctx.plan.calendarWeek,
          year: ctx.plan.year,
          days: ctx.plan.days.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            vorspeise: d.vorspeise.name,
            hauptspeise: d.hauptspeise.name,
            proteinCategory: d.hauptspeise.proteinCategory,
            beilage: d.beilage,
            nachspeise: d.nachspeise.name,
          })),
        };
      }

      case 'get_shopping_list': {
        if (!ctx.plan) return { error: 'Es existiert noch kein Wochenplan.' };
        const list = args.list === 'fri' ? ctx.plan.shoppingListFri : ctx.plan.shoppingListMon;
        return { items: list.map((i) => ({ item: i.item, amount: i.amount, unit: i.unit })) };
      }

      default:
        return { error: `Unbekanntes Tool: ${name}` };
    }
  }

  return dispatch;
}
