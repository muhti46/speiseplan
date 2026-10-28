import { ChangeEvent, KeyboardEvent, useRef, useState } from 'react';
import { Camera, FileText, Loader2, Paperclip, Send, X } from 'lucide-react';
import { ChatAttachment } from '../types/ai';
import { useLanguage } from '../i18n/LanguageContext';
import ImageLightbox from './ImageLightbox';
import {
  AttachmentError,
  attachmentDataUrl,
  fileToAttachment,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '../services/ai/attachments';

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  placeholder?: string;
  /** Kamera-/Datei-Buttons für Fotos und PDFs einblenden. */
  allowAttachments?: boolean;
}

export default function ChatInput({ disabled, onSend, placeholder, allowAttachments = false }: ChatInputProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState<ChatAttachment | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = !disabled && !isReading && (value.trim().length > 0 || attachments.length > 0);

  function submit() {
    if (!canSend) return;
    onSend(value.trim(), attachments);
    setValue('');
    setAttachments([]);
    setAttachError(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
    event.target.value = '';
    if (files.length === 0) return;

    setAttachError(null);
    const free = MAX_ATTACHMENTS_PER_MESSAGE - attachments.length;
    if (files.length > free) setAttachError(t.chatAttachmentLimit);

    setIsReading(true);
    const added: ChatAttachment[] = [];
    for (const file of files.slice(0, Math.max(0, free))) {
      try {
        added.push(await fileToAttachment(file));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Anhang konnte nicht gelesen werden', err);
        setAttachError(
          err instanceof AttachmentError && err.kind === 'tooLarge'
            ? t.chatAttachmentTooLarge
            : t.chatAttachmentUnsupported,
        );
      }
    }
    setAttachments((prev) => [...prev, ...added]);
    setIsReading(false);
  }

  const attachDisabled = disabled || isReading || attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE;

  return (
    <div className="border-t border-slate-100 pt-3">
      {enlarged && (
        <ImageLightbox src={attachmentDataUrl(enlarged)} alt={enlarged.name} onClose={() => setEnlarged(null)} />
      )}
      {(attachments.length > 0 || isReading) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div key={index} className="relative">
              {attachment.kind === 'image' ? (
                <button type="button" onClick={() => setEnlarged(attachment)} className="block cursor-zoom-in">
                  <img
                    src={attachmentDataUrl(attachment)}
                    alt={attachment.name}
                    className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-16 max-w-[10rem] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600">
                  <FileText size={18} className="shrink-0 text-red-500" />
                  <span className="line-clamp-2 break-all">{attachment.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                aria-label={t.chatAttachmentRemove}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 p-0.5 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {isReading && (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400">
              <Loader2 size={18} className="animate-spin" aria-hidden />
            </div>
          )}
        </div>
      )}
      {attachError && <p className="mb-2 text-xs text-red-600">{attachError}</p>}

      <div className="flex items-end gap-2">
        {allowAttachments && (
          <>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFiles}
              className="hidden"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFiles}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={attachDisabled}
              aria-label={t.chatAttachPhoto}
              title={t.chatAttachPhoto}
              className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-slate-100 active:scale-95 disabled:opacity-50"
            >
              <Camera size={20} />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={attachDisabled}
              aria-label={t.chatAttachFile}
              title={t.chatAttachFile}
              className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-slate-100 active:scale-95 disabled:opacity-50"
            >
              <Paperclip size={20} />
            </button>
          </>
        )}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t.chatPlaceholder}
          rows={1}
          disabled={disabled}
          className="min-w-0 flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={t.chatSend}
          className="shrink-0 rounded-full bg-brand-700 p-2.5 text-white active:scale-95 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
