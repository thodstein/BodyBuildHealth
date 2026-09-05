import { describe, it, expect } from 'vitest';
import { buildArmBridgeData } from '../arm-bridge-payload.engine';

function baseInput(over: Record<string, any> = {}): any {
  return {
    groups: ['wrist_flexors'],
    technique: 'toproll',
    weakPoints: ['pron_open', 'cup_start'],
    biomechCards: [{ weakPoint: 'pron_open' }],
    corrections: [],
    scoring: { score: 70 },
    diag: {},
    angles: {},
    force: {},
    vbt: {},
    dynamic: {},
    bench: {},
    tendon: 10,
    findings: [],
    humerus: [],
    balance: [],
    asymmetry: 5,
    info: [],
    weakCauses: { pron_open: { cause: 'volume', confidence: 0.6, fix: 'Добрать' } },
    topByPoint: {
      pron_open: [{ id: 'pronation_cable', score: 100 }, { id: 'pronation_sledge', score: 96 }],
      cup_start: [{ id: 'pronation_cable', score: 90 }, { id: 'wrist_curl_belt', score: 88 }],
    },
    spec: { weeks: [{ week: 1, targetSets: { pron_open: 3 } }, { week: 2, targetSets: { pron_open: 4 } }], dayMap: { pron_open: 'TablePronation' } },
    mobilityFails: ['wrist'],
    acwrDanger: ['pronators'],
    bilateral: { weakArm: 'left', weakSets: 12, strongSets: 9 },
    attempts: [{ weightKg: 68, success: true, wrPct: 52.1 }],
    ...over,
  };
}

describe('arm R1: bridge-payload', () => {
  it('базовые ключи сохранены (совместимость)', () => {
    const p = buildArmBridgeData(baseInput()) as any;
    expect(p.groups).toEqual(['wrist_flexors']);
    expect(p.armTechnique).toBe('toproll');
    expect(p.armWeakPoints).toEqual(['pron_open', 'cup_start']);
    expect(p.armTendon).toBe(10);
    expect(p.armAsymmetry).toBe(5);
  });
  it('preferredExerciseIds: топ-1 по точкам, дедуп', () => {
    const p = buildArmBridgeData(baseInput()) as any;
    expect(p.preferredExerciseIds).toEqual(['pronation_cable', 'pronation_sledge', 'wrist_curl_belt']);
  });
  it('spec развёрнут в targetSets по неделям + dayMap', () => {
    const p = buildArmBridgeData(baseInput()) as any;
    expect(p.armSpecTargetSets).toEqual({ pron_open: { 1: 3, 2: 4 } });
    expect(p.armSpecDayMap).toEqual({ pron_open: 'TablePronation' });
  });
  it('мобильность/ACWR/bilateral/попытки/причины', () => {
    const p = buildArmBridgeData(baseInput()) as any;
    expect(p.armMobilityFails).toEqual(['wrist']);
    expect(p.armAcwrDanger).toEqual(['pronators']);
    expect(p.armBilateral).toEqual({ weakArm: 'left', weakSets: 12, strongSets: 9 });
    expect(p.armAttempts).toEqual([{ weightKg: 68, success: true, wrPct: 52.1 }]);
    expect((p.armWeakCauses as any).pron_open.cause).toBe('volume');
  });
  it('пусто-устойчив', () => {
    const p = buildArmBridgeData(baseInput({ weakPoints: [], topByPoint: {}, spec: null, attempts: [] })) as any;
    expect(p.preferredExerciseIds).toEqual([]);
    expect(p.armSpecTargetSets).toEqual({});
    expect(p.armSpecDayMap).toEqual({});
  });
});
