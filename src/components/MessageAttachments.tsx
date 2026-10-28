import { FileText } from 'lucide-react';
import { ChatAttachment } from '../types/ai';
import { attachmentDataUrl } from '../services/ai/attachments';

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
  /** Abstand nach unten, wenn unter den Anhängen noch Text folgt. */
  hasText: boolean;
}

/** Fotos als Vorschaubild, PDFs als Datei-Chip innerhalb einer Chat-Bubble. */
export default function MessageAttachments({ attachments, hasText }: MessageAttachmentsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${hasText ? 'mb-2' : ''}`}>
      {attachments.map((attachment, i) =>
        attachment.kind === 'image' && attachment.data ? (
          <img
            key={i}
            src={attachmentDataUrl(attachment)}
            alt={attachment.name}
            className="max-h-48 rounded-xl object-contain"
          />
        ) : (
          <span key={i} className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-sm">
            <FileText size={16} className="shrink-0" />
            <span className="break-all">{attachment.name}</span>
          </span>
        ),
      )}
    </div>
  );
}
