/**
 * TZRisk3DModel.test.ts — юнит-тесты чистой логики 3D-модели рисков:
 * назначение вертексов системам по якорям на модели Халка (без WebGL).
 */
import { describe, it, expect } from 'vitest';
import { assignVertexSystems, SYSTEM_ANCHORS } from '../TZRisk3DModel';

describe('SYSTEM_ANCHORS', () => {
  it('все 6 систем ТЗ покрыты якорями', () => {
    const ids = new Set(SYSTEM_ANCHORS.map((a) => a.id));
    expect(ids.size).toBe(6);
    for (const id of ['cardio', 'hepatic', 'renal', 'cns', 'reproductive', 'hematologic']) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

describe('assignVertexSystems', () => {
  it('присваивает cns вертексам головы', () => {
    const positions = new Float32Array([0, 0.9, 0.02]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('cns');
  });

  it('присваивает cardio вертексам груди', () => {
    const positions = new Float32Array([-0.1, 0.45, 0.2]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('cardio');
  });

  it('присваивает hepatic вертексам правой верхней части живота', () => {
    const positions = new Float32Array([0.3, 0.25, -0.1]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('hepatic');
  });

  it('присваивает hematologic вертексам левой стороны', () => {
    const positions = new Float32Array([-0.3, 0.2, 0.15]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('hematologic');
  });

  it('присваивает renal вертексам поясницы (сзади)', () => {
    const positions = new Float32Array([0, 0.06, -0.28]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('renal');
  });

  it('присваивает reproductive вертексам паха', () => {
    const positions = new Float32Array([0, -0.75, 0.15]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('reproductive');
  });

  it('оставляет −1 для вертексов вне всех зон (внешняя точка у стоп)', () => {
    const positions = new Float32Array([0.5, -1.0, 0.5]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBe(-1);
  });

  it('кастомные якоря работают', () => {
    const anchors = [{ id: 'test', label: 't', pos: [0, 0, 0] as [number, number, number], r: 0.5 }];
    const positions = new Float32Array([0, 0.1, 0]);
    const out = assignVertexSystems(positions, anchors);
    expect(out[0]).toBe(0);
  });
});
