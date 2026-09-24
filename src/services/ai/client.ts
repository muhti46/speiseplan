import { GoogleGenAI } from '@google/genai';

// gemini-2.5-flash ist für neue API-Keys nicht mehr verfügbar (Gemini API
// liefert dafür einen 404 und verweist auf gemini-3.8-flash als Nachfolger).
/** Günstiges Flash-Modell. */
export const GEMINI_MODEL = 'gemini-3.8-flash';

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}
