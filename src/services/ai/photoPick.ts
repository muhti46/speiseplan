import { Part, Schema, Type } from '@google/genai';
import { createGeminiClient, GEMINI_MODEL } from './client';
import { isRelevantTitle, RankPhotos } from '../dishImages';

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    matches: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: 'Nummern der passenden Fotos, bestes zuerst. Leer, wenn keines passt.',
    },
  },
  required: ['matches'],
};

async function toInlinePart(url: string): Promise<Part | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const buffer = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
    return { inlineData: { mimeType: blob.type || 'image/jpeg', data: btoa(binary) } };
  } catch {
    return null;
  }
}

export function buildPhotoPickPrompt(dishName: string, count: number): string {
  return `Du siehst ${count} nummerierte Fotos. Gesucht ist ein Foto für den Speiseplan eines Kinderheims zum Gericht "${dishName}".

Gib in "matches" die Nummern der Fotos zurück, die genau dieses Gericht fertig zubereitet zeigen (auf Teller, in Schüssel, Topf oder Auflaufform), das am besten passende und appetitlichste zuerst.
NICHT passend sind: rohe Zutaten, lebende Tiere, Pflanzen/Felder, Personen, Restaurants/Gebäude, Landkarten, Verpackungen, Zeichnungen, sowie ein deutlich anderes Gericht (z.B. Suppe statt Salat). Eine andere Beilage ist in Ordnung, wenn das Hauptgericht stimmt.
Passt keines, gib eine leere Liste zurück.`;
}

/**
 * Lässt Gemini die Kandidatenfotos ansehen und die passenden auswählen.
 * Lassen sich die Fotos nicht laden (z.B. Netzwerkfehler), wird nur nach Titel sortiert.
 */
export function createPhotoRanker(apiKey: string): RankPhotos {
  return async (dishName, found) => {
    const parts: Part[] = [];
    const indexOfImage: number[] = [];
    for (let i = 0; i < found.length; i++) {
      const image = await toInlinePart(found[i].candidate.thumbUrl);
      if (!image) continue;
      parts.push({ text: `Foto ${indexOfImage.length}:` }, image);
      indexOfImage.push(i);
    }
    if (indexOfImage.length === 0) {
      return found.map((f, i) => (isRelevantTitle(dishName, f.title) ? i : -1)).filter((i) => i >= 0);
    }

    const client = createGeminiClient(apiKey);
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: buildPhotoPickPrompt(dishName, indexOfImage.length) }, ...parts] }],
      config: { responseMimeType: 'application/json', responseSchema },
    });
    const parsed = JSON.parse(response.text ?? '{}') as { matches?: unknown[] };
    const seen = new Set<number>();
    return (parsed.matches ?? [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n < indexOfImage.length && !seen.has(n) && seen.add(n))
      .map((n) => indexOfImage[n]);
  };
}

