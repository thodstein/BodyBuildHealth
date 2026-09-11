import { describe, expect, it } from 'vitest';
import {
  QUALITY_WEIGHTS,
  QUALITY_WEIGHT_SUM,
  applyIndirectBonus,
  checkSessionCap,
  composeQualityScoreV2,
  deloadQualityCheck,
  frequencyForVolume,
  gradeQualityScore,
  isSpecMaintenance,
  lengthBiasCheck,
  loadLayerCheck,
  maintenanceFloor,
  mvStatus,
  rirProfileCheck,
  shoulderBalanceCheck,
} from '../quality-score-v2.engine';

const LAND = {
  mev: { chest: 8, back: 10 },
  mav: { chest: 14, back: 16 },
  mrv: { chest: 20, back: 24 },
};

describe('quality-score-v2: веса и грейд', () => {
  it('сумма весов = 100', () => {
    expect(QUALITY_WEIGHT_SUM).toBe(100);
    expect(Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('грейд по границам 85/65/45', () => {
    expect(gradeQualityScore(100)).toBe('🟢 Профессионально');
    expect(gradeQualityScore(85)).toBe('🟢 Профессионально');
    expect(gradeQualityScore(84)).toBe('🟡 Хорошо');
    expect(gradeQualityScore(65)).toBe('🟡 Хорошо');
    expect(gradeQualityScore(64)).toBe('🟠 Удовлетворительно');
    expect(gradeQualityScore(45)).toBe('🟠 Удовлетворительно');
    expect(gradeQualityScore(44)).toBe('🔴 Требует доработки');
  });
});

describe('quality-score-v2: MV-статус', () => {
  it('mev=0 (delt_front) — всегда at_or_above', () => {
    expect(mvStatus(0, 0)).toBe('at_or_above_mev');
    expect(maintenanceFloor(0)).toBe(0);
  });
  it('половина MEV — maintenance, ниже — below', () => {
    expect(mvStatus(4, 8)).toBe('maintenance');
    expect(mvStatus(3, 8)).toBe('below_mev');
    expect(mvStatus(8, 8)).toBe('at_or_above_mev');
  });
  it('spec-нецель на maintenance — не штраф', () => {
    expect(isSpecMaintenance('arms', 4, 8, ['chest'], undefined)).toBe(true);
    expect(isSpecMaintenance('chest', 4, 8, ['chest'], undefined)).toBe(false);
    expect(isSpecMaintenance('arms', 4, 8, undefined, ['arms'])).toBe(true);
    expect(isSpecMaintenance('arms', 1, 8, ['chest'], undefined)).toBe(false);
  });
  it('session-кап ловит >10 в сессии', () => {
    expect(checkSessionCap('chest', 10)).toBeNull();
    expect(checkSessionCap('chest', 11)?.severity).toBe('warning');
    expect(checkSessionCap('chest', null)).toBeNull();
  });
});

describe('quality-score-v2: effective-объём', () => {
  it('без имён — direct без изменений', () => {
    expect(applyIndirectBonus({ chest: 12 })).toEqual({ chest: 12 });
  });
  it('жим лёжа даёт indirect трицепсу и передней дельте', () => {
    const eff = applyIndirectBonus({ chest: 10 }, { chest: ['Жим штанги лёжа'] });
    expect(eff.chest).toBe(10);
    expect(eff.triceps).toBeCloseTo(4.5, 1);
    expect(eff.delt_front).toBeCloseTo(3, 1);
  });
  it('тяга даёт indirect бицепсу', () => {
    const eff = applyIndirectBonus({ back: 10 }, { back: ['Тяга штанги в наклоне'] });
    expect(eff.biceps).toBeCloseTo(4, 1);
  });
});

describe('quality-score-v2: частота-от-объёма', () => {
  it('0× — critical', () => {
    expect(frequencyForVolume('chest', 10, 14, 20, 0)?.severity).toBe('critical');
  });
  it('≥2× — тишина', () => {
    expect(frequencyForVolume('chest', 20, 14, 20, 2)).toBeNull();
    expect(frequencyForVolume('chest', 20, 14, 20, 3)).toBeNull();
  });
  it('1× при объёме ≤ MAV — info (bro-сплит допустим)', () => {
    const f = frequencyForVolume('chest', 12, 14, 20, 1)!;
    expect(f.severity).toBe('info');
    expect(f.id).toBe('freq_once_ok_chest');
  });
  it('1× при объёме > MAV — warning разбить', () => {
    const f = frequencyForVolume('chest', 18, 14, 20, 1)!;
    expect(f.severity).toBe('warning');
    expect(f.id).toBe('freq_split_chest');
  });
  it('1× при объёме > MRV — critical', () => {
    expect(frequencyForVolume('chest', 25, 14, 20, 1)?.severity).toBe('critical');
  });
});

describe('quality-score-v2: RIR-гейты', () => {
  it('мало данных — тишина', () => {
    expect(rirProfileCheck(null, 'intermediate')).toEqual([]);
    expect(rirProfileCheck({ avgRir: 5, fracRirLE2: 0, fracRir0: 0, totalSets: 3 }, 'intermediate')).toEqual([]);
  });
  it('новичок с отказом — critical', () => {
    const r = rirProfileCheck({ avgRir: 1, fracRirLE2: 0.8, fracRir0: 0.2, totalSets: 20 }, 'beginner');
    expect(r.some(i => i.id === 'rir_beginner_failure' && i.severity === 'critical')).toBe(true);
  });
  it('перебор отказа >15% — warning', () => {
    const r = rirProfileCheck({ avgRir: 1.5, fracRirLE2: 0.8, fracRir0: 0.3, totalSets: 20 }, 'advanced');
    expect(r.some(i => i.id === 'rir_too_much_failure')).toBe(true);
  });
  it('все RIR 4+ — мусорный объём', () => {
    const r = rirProfileCheck({ avgRir: 4, fracRirLE2: 0.05, fracRir0: 0, totalSets: 20 }, 'intermediate');
    expect(r.some(i => i.id === 'rir_junk_volume')).toBe(true);
  });
  it('норма RIR 1–3 — тишина', () => {
    expect(rirProfileCheck({ avgRir: 2, fracRirLE2: 0.5, fracRir0: 0.05, totalSets: 20 }, 'intermediate')).toEqual([]);
  });
});

describe('quality-score-v2: делод', () => {
  it('нет делода при 12 нед — critical', () => {
    const r = deloadQualityCheck({ hasDeload: false, totalWeeks: 12, deloadWeeks: [] });
    expect(r.some(i => i.id === 'no_deload' && i.severity === 'critical')).toBe(true);
  });
  it('короткий мезо без делода — тишина', () => {
    expect(deloadQualityCheck({ hasDeload: false, totalWeeks: 4, deloadWeeks: [] })).toEqual([]);
  });
  it('де lod-призрак ловится', () => {
    const r = deloadQualityCheck({ hasDeload: true, totalWeeks: 8, deloadWeeks: [4], depthVolume: 0.05, rirShift: 0, phaseTag: 'deload' });
    expect(r.some(i => i.id === 'deload_ghost')).toBe(true);
    expect(r.some(i => i.id === 'deload_no_rir_shift')).toBe(true);
  });
  it('настоящий делод — тишина', () => {
    expect(deloadQualityCheck({ hasDeload: true, totalWeeks: 8, deloadWeeks: [4, 7], depthVolume: 0.4, rirShift: 2, loadDrop: 0.2, phaseTag: 'deload' })).toEqual([]);
  });
  it('taper держит интенсивность — норма', () => {
    expect(deloadQualityCheck({ hasDeload: true, totalWeeks: 8, deloadWeeks: [], depthVolume: 0.4, loadDrop: 0.05, phaseTag: 'taper' })).toEqual([]);
  });
});

describe('quality-score-v2: плечо и длина', () => {
  it('ноги не ломают плечо: pull без hams/glutes', () => {
    const r = shoulderBalanceCheck({ pressSets: 12, pullSets: 12, hasVerticalPull: true, hasHorizontalPull: true, hasFacePullOrER: true });
    expect(r).toEqual([]);
  });
  it('жим-доминация — warning', () => {
    const r = shoulderBalanceCheck({ pressSets: 24, pullSets: 10, hasVerticalPull: true, hasHorizontalPull: true, hasFacePullOrER: true });
    expect(r.some(i => i.id === 'shoulder_press_dominant')).toBe(true);
  });
  it('нет горизонтали — warning плоскостей', () => {
    const r = shoulderBalanceCheck({ pressSets: 12, pullSets: 12, hasVerticalPull: true, hasHorizontalPull: false, hasFacePullOrER: true });
    expect(r.some(i => i.id === 'shoulder_plane_gap')).toBe(true);
  });
  it('нет face-pull при жимах — info', () => {
    const r = shoulderBalanceCheck({ pressSets: 14, pullSets: 14, hasVerticalPull: true, hasHorizontalPull: true, hasFacePullOrER: false });
    expect(r.some(i => i.id === 'shoulder_no_facepull' && i.severity === 'info')).toBe(true);
  });
  it('длина 0% у груди — warning, у пресса — тишина', () => {
    const r = lengthBiasCheck({ chest: { lengthSets: 0, totalSets: 12 }, abs: { lengthSets: 0, totalSets: 12 } });
    expect(r.some(i => i.id === 'length_low_chest')).toBe(true);
    expect(r.some(i => i.muscle === 'abs')).toBe(false);
  });
  it('малый объём (<6) — тишина', () => {
    expect(lengthBiasCheck({ chest: { lengthSets: 0, totalSets: 4 } })).toEqual([]);
  });
});

describe('quality-score-v2: нагрузка без дневника — 0 штрафа', () => {
  it('no_data без issues', () => {
    expect(loadLayerCheck({ hasDiary: false }).status).toBe('no_data');
    expect(loadLayerCheck({ hasDiary: false }).issues).toEqual([]);
  });
  it('ACWR danger — warning', () => {
    const r = loadLayerCheck({ hasDiary: true, acwr: 1.8, monotony: 1.2 });
    expect(r.status).toBe('warn');
    expect(r.issues.some(i => i.id === 'load_acwr_danger')).toBe(true);
  });
});

describe('quality-score-v2: композитор', () => {
  const base = {
    level: 'intermediate',
    weeklySets: { chest: 12, back: 14 },
    frequency: { chest: 2, back: 2 },
    ...LAND,
  };
  it('хороший план — высокий скор и грейд', () => {
    const r = composeQualityScoreV2({ ...base, deload: { hasDeload: true, totalWeeks: 8, deloadWeeks: [4] } });
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.grade).toBe('🟢 Профессионально');
    expect(r.breakdown.volume).toBe(40);
  });
  it('перегруз режет volume-вес', () => {
    const r = composeQualityScoreV2({ ...base, weeklySets: { chest: 30, back: 14 } });
    expect(r.breakdown.volume).toBeLessThan(40);
    expect(r.issues.some(i => i.id === 'vol_over_chest' && i.severity === 'critical')).toBe(true);
  });
  it('MV-режим спец-блока не штрафует', () => {
    const r = composeQualityScoreV2({
      ...base,
      weeklySets: { chest: 14, back: 5 },
      frequency: { chest: 2, back: 1 },
      specTargets: ['chest'],
    });
    expect(r.perMuscle.find(m => m.muscle === 'back')?.status).toBe('maintenance');
    expect(r.issues.some(i => i.id === 'vol_low_back')).toBe(false);
  });
});
