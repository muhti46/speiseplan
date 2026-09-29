import { ChatConversation, ChatMessage } from '../../types/ai';
import { getAllConversations, saveConversation } from '../storage';

const LEGACY_STORAGE_KEY = 'speiseplan-chat-history';

function newId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `chat-${Date.now()}`;
}

export function createConversation(title: string): ChatConversation {
  const now = new Date().toISOString();
  return { id: newId(), title, createdAt: now, updatedAt: now, messages: [], apiHistory: [] };
}

/** Leitet einen kurzen Titel aus der ersten Nutzer-Nachricht ab. */
export function titleFromFirstMessage(text: string, fallback: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return fallback;
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean;
}

// Dedupliziert gleichzeitige Aufrufe (z.B. durch React StrictMode's doppelten
// Effekt-Mount in der Entwicklung) auf ein und dieselbe laufende Migration -
// ohne das würde ein zweiter, "leerer" Aufruf möglicherweise vor Abschluss der
// ersten Migration prüfen, ob schon Konversationen existieren, und fälschlich
// eine neue Standard-Konversation statt der migrierten anlegen.
let migrationPromise: Promise<void> | null = null;

/**
 * Übernimmt einmalig den alten (localStorage-basierten, einzelnen) Chatverlauf
 * aus einer früheren Version als erste Konversation in die neue Mehrfach-
 * Konversations-Ablage (Dexie). Das Vorhandensein des Legacy-Keys selbst dient
 * als Marker - nach erfolgreicher (oder nicht nötiger) Migration wird er entfernt.
 */
export function migrateLegacyChatHistory(fallbackTitle: string): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration(fallbackTitle);
  }
  return migrationPromise;
}

async function runMigration(fallbackTitle: string): Promise<void> {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as { messages?: ChatMessage[]; apiHistory?: ChatMessage[] };
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    if (messages.length === 0) return;

    const existing = await getAllConversations();
    if (existing.length > 0) return; // Es gibt bereits neue Konversationen, nichts überschreiben.

    const now = new Date().toISOString();
    const firstUserText = messages.find((m) => m.role === 'user')?.text ?? '';
    const conversation: ChatConversation = {
      id: newId(),
      title: titleFromFirstMessage(firstUserText, fallbackTitle),
      createdAt: now,
      updatedAt: now,
      messages,
      apiHistory: Array.isArray(parsed.apiHistory) ? parsed.apiHistory : [],
    };
    await saveConversation(conversation);
  } catch {
    // Beschädigte Altdaten einfach ignorieren.
  } finally {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
