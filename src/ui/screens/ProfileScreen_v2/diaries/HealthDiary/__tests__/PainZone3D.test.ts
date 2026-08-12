/**
 * PainZone3D.test.ts — юнит-тесты чистой логики 3D-карты зон боли:
 * назначение вертексов зонам по якорям (без WebGL), 13 зон (левая/правая).
 */
import { describe, it, expect } from 'vitest';
import { assignVertexZones, ZONE_ANCHORS, SIDE_ZONES, baseZoneKey } from '../PainZone3D';

describe('ZONE_ANCHORS / SIDE_ZONES', () => {
  it('якорей ровно 13 (по 2 на сторону + поясница)', () => {
    expect(ZONE_ANCHORS.length).toBe(13);
    expect(SIDE_ZONES.length).toBe(13);
  });

  it('все 7 базовых зон покрыты якорями', () => {
    const bases = new Set(SIDE_ZONES.map((z) => z.base));
    expect(bases.size).toBe(7);
    for (const id of ['shoulders', 'elbows', 'wrists', 'lower_back', 'hips', 'knees', 'ankles']) {
      expect(bases.has(id)).toBe(true);
    }
  });

  it('парные зоны имеют левую и правую стороны', () => {
    const ids = SIDE_ZONES.map((z) => z.id);
    for (const id of ['shoulders_l', 'shoulders_r', 'elbows_l', 'elbows_r', 'wrists_l', 'wrists_r', 'hips_l', 'hips_r', 'knees_l', 'knees_r', 'ankles_l', 'ankles_r']) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain('lower_back');
  });

  it('baseZoneKey убирает суффикс стороны', () => {
    expect(baseZoneKey('shoulders_l')).toBe('shoulders');
    expect(baseZoneKey('ankles_r')).toBe('ankles');
    expect(baseZoneKey('lower_back')).toBe('lower_back');
  });
});

describe('assignVertexZones', () => {
  it('присваивает зону вертексам внутри якорной сферы', () => {
    // центр якоря "knees_r": (0.28, -0.55, 0.1)
    const positions = new Float32Array([0.28, -0.55, 0.1]);
    const out = assignVertexZones(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    const id = ZONE_ANCHORS[out[0]].id;
    expect(id).toBe('knees_r');
  });

  it('оставляет −1 для вертексов вне всех зон (голова)', () => {
    const positions = new Float32Array([0, 0.95, 0]);
    const out = assignVertexZones(positions);
    expect(out[0]).toBe(-1);
  });

  it('левая и правая стороны различаются', () => {
    const positions = new Float32Array([
      -0.48, 0.6, 0.2,  // левое плечо
      0.3, 0.6, 0.1,    // правое плечо
    ]);
    const out = assignVertexZones(positions);
    const ids = Array.from(out, (i) => (i >= 0 ? ZONE_ANCHORS[i].id : null));
    expect(ids[0]).toBe('shoulders_l');
    expect(ids[1]).toBe('shoulders_r');
  });

  it('плечи/локти/запястья распределяются по высоте рук', () => {
    const positions = new Float32Array([
      -0.48, 0.6, 0.2,   // плечо
      -0.55, 0.4, 0.3,   // локоть
      -0.5, 0.15, 0.35,  // запястье
    ]);
    const out = assignVertexZones(positions);
    const ids = Array.from(out, (i) => (i >= 0 ? ZONE_ANCHORS[i].id : null));
    expect(ids[0]).toBe('shoulders_l');
    expect(ids[1]).toBe('elbows_l');
    expect(ids[2]).toBe('wrists_l');
  });

  it('поясница и колени на центральной линии', () => {
    const positions = new Float32Array([
      0, 0.12, 0,    // поясница
      -0.28, -0.55, 0.1, // колено
    ]);
    const out = assignVertexZones(positions);
    const ids = Array.from(out, (i) => (i >= 0 ? ZONE_ANCHORS[i].id : null));
    expect(ids[0]).toBe('lower_back');
    expect(ids[1]).toBe('knees_l');
  });

  it('голеностопы внизу ног', () => {
    const positions = new Float32Array([0.28, -0.92, 0.1]);
    const out = assignVertexZones(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(ZONE_ANCHORS[out[0]].id).toBe('ankles_r');
  });

  it('кастомные якоря работают', () => {
    const anchors = [{ id: 'head', pos: [0, 1, 0] as [number, number, number], r: 0.5 }];
    const positions = new Float32Array([0, 0.99, 0]);
    const out = assignVertexZones(positions, anchors);
    expect(out[0]).toBe(0);
  });
});
