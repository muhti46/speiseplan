import { GoogleGenAI } from '@google/genai';

/** Günstiges Flash-Modell; auf 'gemini-2.0-flash' umstellbar falls nötig. */
export const GEMINI_MODEL = 'gemini-2.5-flash';

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}
