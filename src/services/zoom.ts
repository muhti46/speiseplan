// Mathe für das Zoomen/Verschieben eines Fotos im Vollbild (Pinch, Doppeltippen, Mausrad).
// Koordinaten sind relativ zur Bildschirmmitte; das Bild ist dort zentriert und wird mit
// `translate(x, y) scale(scale)` (transform-origin: Mitte) dargestellt.

export interface Point {
  x: number;
  y: number;
}

export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const DOUBLE_TAP_SCALE = 2.5;
export const IDENTITY: ZoomState = { scale: 1, x: 0, y: 0 };

/**
 * Neuer Zustand, wenn der Punkt `from` (z.B. Mitte zwischen zwei Fingern) zu `to` wandert
 * und dabei auf `scale` gezoomt wird: der Bildpunkt unter den Fingern bleibt unter den Fingern.
 */
export function zoomAround(start: ZoomState, from: Point, to: Point, scale: number): ZoomState {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  const ratio = s / start.scale;
  return { scale: s, x: to.x - (from.x - start.x) * ratio, y: to.y - (from.y - start.y) * ratio };
}

/** Verhindert, dass das gezoomte Bild über seine Ränder hinaus aus dem Bild geschoben wird. */
export function clampZoom(state: ZoomState, imageSize: { width: number; height: number }, viewport: { width: number; height: number }): ZoomState {
  if (state.scale <= MIN_SCALE) return IDENTITY;
  const maxX = Math.max(0, (imageSize.width * state.scale - viewport.width) / 2);
  const maxY = Math.max(0, (imageSize.height * state.scale - viewport.height) / 2);
  return {
    scale: state.scale,
    x: Math.min(maxX, Math.max(-maxX, state.x)),
    y: Math.min(maxY, Math.max(-maxY, state.y)),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
