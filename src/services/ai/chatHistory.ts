import { ChatMessage } from '../../types/ai';

const STORAGE_KEY = 'speiseplan-chat-history';

interface StoredChatHistory {
  messages: ChatMessage[];
  apiHistory: ChatMessage[];
}

export function getChatHistory(): StoredChatHistory {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], apiHistory: [] };
    const parsed = JSON.parse(raw) as Partial<StoredChatHistory>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      apiHistory: Array.isArray(parsed.apiHistory) ? parsed.apiHistory : [],
    };
  } catch {
    return { messages: [], apiHistory: [] };
  }
}

export function saveChatHistory(messages: ChatMessage[], apiHistory: ChatMessage[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, apiHistory }));
}

export function clearChatHistory(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
