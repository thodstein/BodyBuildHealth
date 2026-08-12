/**
 * PainZone3D.test.ts — юнит-тесты чистой логики 3D-карты зон боли:
 * назначение вертексов зонам по якорям (без WebGL).
 */
import { describe, it, expect } from 'vitest';
import { assignVertexZones, ZONE_ANCHORS } from '../PainZone3D';

const zonesSet = () => new Set(ZONE_ANCHORS.map((a) => a.id));

describe('assignVertexZones', () => {
  it('присваивает зону вертексам внутри якорной сферы', () => {
    // центр якоря "knees" правого: (0.28, -0.55, 0.1)
    const positions = new Float32Array([0.28, -0.55, 0.1]);
    const out = assignVertexZones(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    const id = ZONE_ANCHORS[out[0]].id;
    expect(id).toBe('knees');
  });

  it('оставляет −1 для вертексов вне всех зон (голова)', () => {
    const positions = new Float32Array([0, 0.95, 0]);
    const out = assignVertexZones(positions);
    expect(out[0]).toBe(-1);
  });

  it('все 7 зон покрыты якорями', () => {
    const ids = zonesSet();
    expect(ids.size).toBe(7);
    for (const id of ['shoulders', 'elbows', 'wrists', 'lower_back', 'hips', 'knees', 'ankles']) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('плечи/локти/запястья распределяются по высоте рук', () => {
    const positions = new Float32Array([
      -0.48, 0.6, 0.2,   // плечо
      -0.55, 0.4, 0.3,   // локоть
      -0.5, 0.15, 0.35,  // запястье
    ]);
    const out = assignVertexZones(positions);
    const ids = Array.from(out, (i) => (i >= 0 ? ZONE_ANCHORS[i].id : null));
    expect(ids[0]).toBe('shoulders');
    expect(ids[1]).toBe('elbows');
    expect(ids[2]).toBe('wrists');
  });

  it('поясница и колени на центральной линии', () => {
    const positions = new Float32Array([
      0, 0.12, 0,    // поясница
      -0.28, -0.55, 0.1, // колено
    ]);
    const out = assignVertexZones(positions);
    const ids = Array.from(out, (i) => (i >= 0 ? ZONE_ANCHORS[i].id : null));
    expect(ids[0]).toBe('lower_back');
    expect(ids[1]).toBe('knees');
  });

  it('голеностопы внизу ног', () => {
    const positions = new Float32Array([0.28, -0.92, 0.1]);
    const out = assignVertexZones(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(ZONE_ANCHORS[out[0]].id).toBe('ankles');
  });

  it('кастомные якоря работают', () => {
    const anchors = [{ id: 'head', pos: [0, 1, 0] as [number, number, number], r: 0.5 }];
    const positions = new Float32Array([0, 0.99, 0]);
    const out = assignVertexZones(positions, anchors);
    expect(out[0]).toBe(0);
  });
});
