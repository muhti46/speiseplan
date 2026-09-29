import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  text: string;
  onDone?: () => void;
}

/** Blendet Text zeichenweise ein; Gesamtdauer ist längenabhängig, aber gedeckelt. */
export default function TypewriterText({ text, onDone }: TypewriterTextProps) {
  const [shownLength, setShownLength] = useState(0);

  useEffect(() => {
    setShownLength(0);
    if (!text) {
      onDone?.();
      return;
    }
    const totalMs = Math.min(2200, Math.max(400, text.length * 12));
    const stepMs = Math.max(8, totalMs / text.length);
    let cancelled = false;
    let i = 0;
    const id = window.setInterval(() => {
      if (cancelled) return;
      i += 1;
      setShownLength(i);
      if (i >= text.length) {
        window.clearInterval(id);
        onDone?.();
      }
    }, stepMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return <>{text.slice(0, shownLength)}</>;
}
