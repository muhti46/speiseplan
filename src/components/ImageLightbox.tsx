import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** Zeigt ein Foto bildschirmfüllend; Tippen irgendwo, X oder Escape schließt. */
export default function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const { t } = useLanguage();

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // Nicht zusätzlich das darunterliegende Rezept-Fenster schließen.
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  // Per Portal an <body>, damit das Bild auch aus dem Rezept-Fenster heraus über allem liegt.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2"
    >
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label={t.close}
        className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white"
      >
        <X size={22} />
      </button>
    </div>,
    document.body,
  );
}
