/**
 * TZRisk3DModel.test.ts — юнит-тесты чистой логики 3D-модели рисков:
 * назначение вертексов системам по якорям на модели Халка (без WebGL).
 */
import { describe, it, expect } from 'vitest';
import { assignVertexSystems, ORGAN_MODELS, SYSTEM_ANCHORS } from '../TZRisk3DModel';

describe('SYSTEM_ANCHORS', () => {
  it('все 6 систем ТЗ покрыты якорями', () => {
    const ids = new Set(SYSTEM_ANCHORS.map((a) => a.id));
    expect(ids.size).toBe(6);
    for (const id of ['cardio', 'hepatic', 'renal', 'cns', 'reproductive', 'hematologic']) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

describe('ORGAN_MODELS', () => {
  it('использует GLB для всех шести систем', () => {
    const systems = new Set(ORGAN_MODELS.map(def => def.system));
    expect(systems).toEqual(new Set(['cns', 'cardio', 'hepatic', 'hematologic', 'renal', 'reproductive']));
    expect(ORGAN_MODELS.every(def => def.kind === 'glb' && def.url.endsWith('.glb'))).toBe(true);
  });

  it('подбирает мужскую и женскую репродуктивную модель', () => {
    const male = ORGAN_MODELS.filter(def => def.system === 'reproductive' && (!def.sex || def.sex === 'male'));
    const female = ORGAN_MODELS.filter(def => def.system === 'reproductive' && (!def.sex || def.sex === 'female'));
    expect(male.some(def => def.url.endsWith('prostate.glb'))).toBe(true);
    expect(female).toHaveLength(3);
    expect(female.some(def => def.url.endsWith('uterus.glb'))).toBe(true);
    expect(female.filter(def => def.url.includes('ovary-'))).toHaveLength(2);
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
    const positions = new Float32Array([-0.1, 0.3, 0.47]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('cardio');
  });

  it('присваивает hepatic вертексам правой верхней части живота', () => {
    const positions = new Float32Array([0.22, 0.18, 0.4]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('hepatic');
  });

  it('присваивает hematologic вертексам левой стороны', () => {
    const positions = new Float32Array([-0.25, 0.16, 0.15]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('hematologic');
  });

  it('присваивает renal вертексам поясницы (сзади)', () => {
    const positions = new Float32Array([0, 0.05, -0.45]);
    const out = assignVertexSystems(positions);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(SYSTEM_ANCHORS[out[0]].id).toBe('renal');
  });

  it('присваивает reproductive вертексам паха', () => {
    const positions = new Float32Array([0, -0.42, 0.25]);
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
