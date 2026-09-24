import { Lang } from '../i18n/translations';
import { Recipe } from './recipe';
import { WeeklyPlan } from './menu';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

/** Kontext, den der Chat-Orchestrator an die Tool-Ausführung durchreicht. */
export interface ChatContext {
  plan: WeeklyPlan | null;
  recipes: Recipe[];
  lang: Lang;
  recentRecipeIds: string[];
  calendarWeek: number;
  year: number;
  onPlanUpdate: (plan: WeeklyPlan) => void;
  onRecipeAdd: (recipe: Recipe) => void;
}
