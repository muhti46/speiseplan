import { PointerEvent, useEffect, useRef, useState, WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { clampZoom, distance, DOUBLE_TAP_SCALE, IDENTITY, midpoint, Point, zoomAround, ZoomState } from '../services/zoom';

/** Quellenangabe (z.B. Urheber/Lizenz eines Wikipedia-Fotos), unten im Vollbild angezeigt. */
export interface PhotoCredit {
  text: string;
  url?: string;
}

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
  credit?: PhotoCredit;
}

const TAP_MAX_MOVE = 10;
const TAP_MAX_MS = 300;
const DOUBLE_TAP_MS = 300;

type Gesture =
  | { kind: 'pinch'; start: ZoomState; mid: Point; dist: number }
  | { kind: 'pan'; start: ZoomState; point: Point }
  | null;

/**
 * Zeigt ein Foto bildschirmfüllend. Zwei Finger zoomen, ein Finger verschiebt das gezoomte Bild,
 * Doppeltippen zoomt hinein/heraus, einfaches Tippen (ungezoomt), X oder Escape schließt.
 * Eigene Gesten nötig, weil der Viewport der App (maximum-scale=1) das Browser-Zoomen sperrt.
 */
export default function ImageLightbox({ src, alt, onClose, credit }: ImageLightboxProps) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState<ZoomState>(IDENTITY);
  const [animate, setAnimate] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture>(null);
  const tap = useRef<{ point: Point; time: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ point: Point; time: number } | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // Nicht zusätzlich das darunterliegende Rezept-Fenster schließen.
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      window.clearTimeout(closeTimer.current);
    };
  }, [onClose]);

  /** Bildschirmkoordinaten -> relativ zur Mitte des Vollbilds. */
  function toLocal(event: { clientX: number; clientY: number }): Point {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  }

  function clamped(state: ZoomState): ZoomState {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return state;
    return clampZoom(
      state,
      { width: img.offsetWidth, height: img.offsetHeight },
      { width: container.clientWidth, height: container.clientHeight },
    );
  }

  function startGesture() {
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      gesture.current = { kind: 'pinch', start: zoomRef.current, mid: midpoint(points[0], points[1]), dist: distance(points[0], points[1]) };
    } else if (points.length === 1) {
      gesture.current = { kind: 'pan', start: zoomRef.current, point: points[0] };
    } else {
      gesture.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button, a')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toLocal(event);
    pointers.current.set(event.pointerId, point);
    tap.current = pointers.current.size === 1 ? { point, time: Date.now(), moved: false } : null;
    setAnimate(false);
    startGesture();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = toLocal(event);
    pointers.current.set(event.pointerId, point);
    if (tap.current && distance(tap.current.point, point) > TAP_MAX_MOVE) tap.current.moved = true;

    const g = gesture.current;
    const points = [...pointers.current.values()];
    if (g?.kind === 'pinch' && points.length >= 2) {
      const mid = midpoint(points[0], points[1]);
      const scale = g.start.scale * (distance(points[0], points[1]) / g.dist);
      setZoom(zoomAround(g.start, g.mid, mid, scale));
    } else if (g?.kind === 'pan' && g.start.scale > 1) {
      setZoom(clamped(zoomAround(g.start, g.point, point, g.start.scale)));
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = toLocal(event);
    pointers.current.delete(event.pointerId);
    // Restliche Finger setzen die Geste vom aktuellen Stand aus fort (Pinch -> Verschieben).
    startGesture();
    if (pointers.current.size > 0) return;

    setAnimate(true);
    setZoom((current) => clamped(current));

    const t0 = tap.current;
    tap.current = null;
    if (!t0 || t0.moved || Date.now() - t0.time > TAP_MAX_MS) return;

    const now = Date.now();
    const previous = lastTap.current;
    if (previous && now - previous.time < DOUBLE_TAP_MS && distance(previous.point, point) < TAP_MAX_MOVE * 3) {
      // Doppeltippen: an der Tippstelle hineinzoomen bzw. wieder ganz herauszoomen.
      window.clearTimeout(closeTimer.current);
      lastTap.current = null;
      const current = zoomRef.current;
      setZoom(current.scale > 1 ? IDENTITY : clamped(zoomAround(current, point, point, DOUBLE_TAP_SCALE)));
      return;
    }
    lastTap.current = { point, time: now };
    // Einfaches Tippen schließt nur ungezoomt - kurz warten, ob ein zweites Tippen folgt.
    if (zoomRef.current.scale <= 1) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(onClose, DOUBLE_TAP_MS);
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const point = toLocal(event);
    const current = zoomRef.current;
    setAnimate(false);
    setZoom(clamped(zoomAround(current, point, point, current.scale * Math.exp(-event.deltaY * 0.002))));
  }

  // Per Portal an <body>, damit das Bild auch aus dem Rezept-Fenster heraus über allem liegt.
  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      // Portal-Klicks blubbern im React-Baum weiter - nicht z.B. das Rezept-Fenster dahinter schließen.
      onClick={(event) => event.stopPropagation()}
      className="fixed inset-0 z-[100] flex touch-none select-none items-center justify-center overflow-hidden bg-black/90"
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        style={{
          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
          transition: animate ? 'transform 0.2s ease-out' : 'none',
        }}
        className="max-h-full max-w-full object-contain will-change-transform"
      />
      {credit && (
        <p className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-center text-xs text-white/80">
          {credit.url ? (
            <a href={credit.url} target="_blank" rel="noopener noreferrer" className="underline">
              {credit.text}
            </a>
          ) : (
            credit.text
          )}
        </p>
      )}
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
