import { describe, it, expect } from 'vitest';
import {
  mapBlazePoseToPoints,
  anglesFromBlazePose,
  POSE_MODEL_URL,
  POSE_WASM_URL,
} from '../strength-sport-pose-autotrack.engine';

/** Синтетические 33 точки: левая сторона уверенная, правая шумная. */
function fake33(): Array<{ x: number; y: number; visibility: number }> {
  const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  // Левая сторона — вертикальная фигура (таз/колено/голеностоп/стопа/плечо/локоть)
  pts[11] = { x: 0.5, y: 0.2, visibility: 0.99 }; // плечо L
  pts[13] = { x: 0.7, y: 0.2, visibility: 0.99 }; // локоть L
  pts[23] = { x: 0.5, y: 0.5, visibility: 0.99 }; // таз L
  pts[25] = { x: 0.5, y: 0.7, visibility: 0.99 }; // колено L
  pts[27] = { x: 0.5, y: 0.9, visibility: 0.99 }; // голеностоп L
  pts[31] = { x: 0.6, y: 0.9, visibility: 0.99 }; // носок L
  return pts;
}

describe('pose-autotrack: маппинг BlazePose', () => {
  it('выбирает уверенную левую сторону', () => {
    const m = mapBlazePoseToPoints(fake33());
    expect(m).not.toBeNull();
    expect(m!.side).toBe('left');
    expect(m!.meanVisibility).toBeGreaterThan(0.9);
    expect(m!.points.knee.x).toBe(0.5);
  });
  it('углы считаются: колено прямое ≈180', () => {
    const a = anglesFromBlazePose(fake33(), 1.0);
    expect(a).not.toBeNull();
    expect(a!.knee).toBeGreaterThan(150);
    expect(a!.side).toBe('left');
  });
  it('короткий массив / мусор — null', () => {
    expect(mapBlazePoseToPoints(null)).toBeNull();
    expect(mapBlazePoseToPoints([{ x: 1, y: 2 }])).toBeNull();
    expect(anglesFromBlazePose([], 0)).toBeNull();
  });
  it('дырка в ключевой точке — null (не врём углы)', () => {
    const pts = fake33();
    (pts[25] as any) = null;
    expect(mapBlazePoseToPoints(pts)).toBeNull();
  });
  it('URL модели и wasm — https CDN', () => {
    expect(POSE_MODEL_URL.startsWith('https://')).toBe(true);
    expect(POSE_WASM_URL.startsWith('https://')).toBe(true);
  });
});
