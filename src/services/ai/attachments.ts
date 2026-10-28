import { Content, Part } from '@google/genai';
import { ChatAttachment, ChatMessage } from '../../types/ai';
import { resizeImageFile } from '../image';

/** Gemini akzeptiert Inline-Daten bis ca. 20 MB pro Anfrage - PDFs deshalb begrenzen. */
export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;
/** Nur die Anhänge der letzten N Nutzer-Nachrichten werden erneut an Gemini geschickt. */
export const MAX_HISTORY_MESSAGES_WITH_ATTACHMENTS = 2;

// Rezeptfotos müssen lesbar bleiben, daher größer als die Rezept-Vorschaubilder.
const IMAGE_MAX_SIZE = 1600;
const IMAGE_QUALITY = 0.85;

export type AttachmentErrorKind = 'unsupported' | 'tooLarge';

export class AttachmentError extends Error {
  constructor(public kind: AttachmentErrorKind) {
    super(kind);
  }
}

export function classifyAttachmentFile(file: { type: string; name: string }): ChatAttachment['kind'] | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return null;
}

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('Ungültige Data-URL');
  return { mimeType: match[1], data: match[2] };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Liest ein Foto (verkleinert als JPEG) oder PDF als Base64-Anhang für Gemini ein. */
export async function fileToAttachment(file: File): Promise<ChatAttachment> {
  const kind = classifyAttachmentFile(file);
  if (!kind) throw new AttachmentError('unsupported');

  if (kind === 'pdf') {
    if (file.size > MAX_PDF_BYTES) throw new AttachmentError('tooLarge');
    const { data } = splitDataUrl(await readAsDataUrl(file));
    return { kind, name: file.name, mimeType: 'application/pdf', data };
  }

  let dataUrl: string;
  try {
    dataUrl = await resizeImageFile(file, IMAGE_MAX_SIZE, IMAGE_QUALITY);
  } catch {
    // Formate, die der Browser nicht dekodieren kann (z.B. HEIC), unverändert schicken -
    // Gemini kann sie trotzdem lesen.
    if (file.size > MAX_PDF_BYTES) throw new AttachmentError('tooLarge');
    dataUrl = await readAsDataUrl(file);
  }
  const { mimeType, data } = splitDataUrl(dataUrl);
  return { kind, name: file.name, mimeType, data };
}

/** Für die angezeigte Nachricht reicht bei PDFs der Name - die Daten nicht doppelt speichern. */
export function toDisplayAttachment(attachment: ChatAttachment): ChatAttachment {
  return attachment.kind === 'pdf' ? { ...attachment, data: '' } : attachment;
}

export function attachmentDataUrl(attachment: ChatAttachment): string {
  return `data:${attachment.mimeType};base64,${attachment.data}`;
}

function attachmentParts(attachments: ChatAttachment[], includeData: boolean): Part[] {
  return attachments.map((a) =>
    includeData && a.data
      ? { inlineData: { mimeType: a.mimeType, data: a.data } }
      : { text: `[Anhang "${a.name}" wurde früher in diesem Chat gesendet und liegt nicht mehr vor.]` },
  );
}

/**
 * Wandelt den Verlauf in Gemini-Contents um. Anhänge werden nur für die jüngsten
 * Nachrichten erneut mitgeschickt, damit lange Chats mit vielen Fotos nicht
 * über das Größenlimit der API wachsen.
 */
export function toContents(history: ChatMessage[]): Content[] {
  const messages = history.filter((m) => m.role !== 'system');
  const withAttachments = messages.filter((m) => m.attachments?.length);
  const keep = new Set(withAttachments.slice(-MAX_HISTORY_MESSAGES_WITH_ATTACHMENTS));
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [...attachmentParts(m.attachments ?? [], keep.has(m)), { text: m.text }],
  }));
}
