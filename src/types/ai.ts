import { Lang } from '../i18n/translations';
import { Recipe } from './recipe';
import { WeeklyPlan } from './menu';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  text: string;
  /** Eindeutige Id nur für frisch eingetroffene Assistant-Nachrichten (steuert den Tipp-Effekt). */
  id?: string;
}

/** Eine einzelne, unabhängige Chat-Konversation (mehrere können parallel existieren). */
export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  /** Nur erfolgreich abgeschlossene user/assistant-Paare, wird an Gemini geschickt. */
  apiHistory: ChatMessage[];
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
