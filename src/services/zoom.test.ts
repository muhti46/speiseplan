import { describe, expect, it } from 'vitest';
import { clampZoom, IDENTITY, MAX_SCALE, zoomAround } from './zoom';

describe('zoomAround', () => {
  it('keeps the image point under the fingers in place', () => {
    const next = zoomAround(IDENTITY, { x: 100, y: 50 }, { x: 100, y: 50 }, 2);
    // Bildpunkt (100, 50) liegt nach dem Zoom wieder bei (100, 50): x + scale * 100 = 100
    expect(next).toEqual({ scale: 2, x: -100, y: -50 });
  });

  it('pans with the fingers and limits the zoom', () => {
    expect(zoomAround(IDENTITY, { x: 0, y: 0 }, { x: 30, y: -10 }, 1)).toEqual({ scale: 1, x: 30, y: -10 });
    expect(zoomAround(IDENTITY, { x: 0, y: 0 }, { x: 0, y: 0 }, 50).scale).toBe(MAX_SCALE);
    expect(zoomAround(IDENTITY, { x: 0, y: 0 }, { x: 0, y: 0 }, 0.2).scale).toBe(1);
  });
});

describe('clampZoom', () => {
  const image = { width: 400, height: 300 };
  const viewport = { width: 400, height: 800 };

  it('snaps back to the original view at scale 1', () => {
    expect(clampZoom({ scale: 1, x: 80, y: 20 }, image, viewport)).toEqual(IDENTITY);
  });

  it('does not let the zoomed image leave the screen', () => {
    // 2x: 800 breit -> max. 200 nach links/rechts; 600 hoch < 800 -> nicht vertikal verschiebbar.
    expect(clampZoom({ scale: 2, x: 500, y: 100 }, image, viewport)).toEqual({ scale: 2, x: 200, y: 0 });
  });
});
