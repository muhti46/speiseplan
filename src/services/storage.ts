import Dexie, { Table } from 'dexie';
import { WeeklyPlan } from '../types/menu';

class SpeiseplanDB extends Dexie {
  plans!: Table<WeeklyPlan, string>;

  constructor() {
    super('speiseplan-db');
    this.version(1).stores({
      plans: 'id, year, calendarWeek, isFinalized, createdAt',
    });
  }
}

export const db = new SpeiseplanDB();

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
