import { ApiError, Content, Part } from '@google/genai';
import { ChatContext, ChatMessage } from '../../types/ai';
import { createGeminiClient, GEMINI_MODEL } from './client';
import { buildSystemPrompt } from './systemPrompt';
import { chatToolDeclarations, createToolDispatcher } from './tools';

/** Extrahiert eine möglichst konkrete, aber sichere Fehlermeldung aus einem fehlgeschlagenen Gemini-Aufruf. */
export function describeChatError(err: unknown): { status?: number; message: string } {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message };
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: String(err) };
}

const MAX_TOOL_ROUNDS = 4;

function toContents(history: ChatMessage[]): Content[] {
  return history
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
}

/**
 * Sendet eine Chat-Nachricht an Gemini, führt vom Modell angeforderte Tool-Calls
 * lokal aus (bis zu MAX_TOOL_ROUNDS Runden) und gibt die finale Text-Antwort zurück.
 */
export async function sendChatMessage(
  apiKey: string,
  history: ChatMessage[],
  userText: string,
  ctx: ChatContext,
): Promise<string> {
  const client = createGeminiClient(apiKey);
  const dispatch = createToolDispatcher(ctx);

  const contents: Content[] = [...toContents(history), { role: 'user', parts: [{ text: userText }] }];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(ctx.lang),
        tools: [{ functionDeclarations: chatToolDeclarations }],
      },
    });

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      return response.text ?? '';
    }

    if (round === MAX_TOOL_ROUNDS) {
      return response.text ?? 'Ich konnte die Anfrage nicht abschließen (zu viele Zwischenschritte).';
    }

    const modelParts: Part[] = functionCalls.map((call) => ({ functionCall: call }));
    contents.push({ role: 'model', parts: modelParts });

    const responseParts: Part[] = [];
    for (const call of functionCalls) {
      const toolName = call.name ?? 'unknown_function';
      const result = await dispatch(toolName, call.args ?? {});
      responseParts.push({
        functionResponse: { name: toolName, response: result },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return '';
}
