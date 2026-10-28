import { useState } from 'react';
import { FileText } from 'lucide-react';
import { ChatAttachment } from '../types/ai';
import { attachmentDataUrl } from '../services/ai/attachments';
import ImageLightbox from './ImageLightbox';

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
  /** Abstand nach unten, wenn unter den Anhängen noch Text folgt. */
  hasText: boolean;
}

/** Fotos als Vorschaubild (antippen = groß), PDFs als Datei-Chip innerhalb einer Chat-Bubble. */
export default function MessageAttachments({ attachments, hasText }: MessageAttachmentsProps) {
  const [enlarged, setEnlarged] = useState<{ src: string; alt: string } | null>(null);

  return (
    <div className={`flex flex-wrap gap-2 ${hasText ? 'mb-2' : ''}`}>
      {enlarged && <ImageLightbox src={enlarged.src} alt={enlarged.alt} onClose={() => setEnlarged(null)} />}
      {attachments.map((attachment, i) =>
        attachment.kind === 'image' && attachment.data ? (
          <button
            key={i}
            type="button"
            onClick={() => setEnlarged({ src: attachmentDataUrl(attachment), alt: attachment.name })}
            className="cursor-zoom-in"
          >
            <img src={attachmentDataUrl(attachment)} alt={attachment.name} className="max-h-48 rounded-xl object-contain" />
          </button>
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
