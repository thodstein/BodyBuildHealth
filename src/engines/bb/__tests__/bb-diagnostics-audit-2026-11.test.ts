/**
 * bb-diagnostics-audit-2026-11.test.ts — регрессии аудита «ББ-диагностики» (2026-11).
 *
 * Каждый тест падал ДО фикса: честность пустых данных, гранулярные зоны плана,
 * ACWR/VBT в балле, ручные слабые зоны без выдуманного дефицита.
 */
import { describe, it, expect } from 'vitest';
import { assessBbReadiness } from '../bb-readiness.engine';
import { scoreBBSymmetry } from '../bb-symmetry.engine';
import { analyzeBBStimulus } from '../bb-stimulus.engine';
import { scoreBB } from '../bb-scoring.engine';
import { buildBBDiagnosticsReport } from '../bb-diagnostics-hub.engine';
import { auditPlanExercises } from '../bb-plan-exercise-audit.engine';
import { buildSpecBlock } from '../bb-spec-block.engine';
import { getVolumeLandmarks } from '../../volume-landmarks.engine';
import { granularZoneOf, isGranularZone, canonicalOfZone, normalizeZoneAlias } from '../bb-granular-zone.engine';
import { assembleWeakCauseInput } from '../bb-weak-cause.engine';

describe('W0-1 readiness: null ≠ 0', () => {
  it('пустой стор не «зелёный»: нет данных → tested=false, не green', () => {
    const r = assessBbReadiness({ sleepHours: null, pain010: null, vbtLossPct: null, dangerMuscles: null });
    expect(r.tested).toBe(false);
    expect(r.noData).toBe(true);
    expect(r.level).not.toBe('green');
  });

  it('пустые строки из input-полей тоже «нет данных», а не измеренный ноль', () => {
    const r = assessBbReadiness({ sleepHours: '' as any, pain010: '' as any, vbtLossPct: '' as any });
    expect(r.tested).toBe(false);
    expect(r.level).not.toBe('green');
  });

  it('измеренная боль 0 остаётся данными', () => {
    const r = assessBbReadiness({ pain010: 0 });
    expect(r.tested).toBe(true);
  });
});

describe('W0-2 симметрия без замеров', () => {
  it('нет замеров → tested=false (раньше score=100 «пропорции в норме»)', () => {
    const r = scoreBBSymmetry({} as any, null, null);
    expect(r.tested).toBe(false);
    expect(r.measureCount).toBe(0);
    expect(r.issues).toEqual([]); // не штрафуем за неизмеренное
  });

  it('замеры есть → tested=true', () => {
    const r = scoreBBSymmetry({ chest: 100, waist: 80 } as any, null, null);
    expect(r.tested).toBe(true);
    expect(r.measureCount).toBeGreaterThan(0);
  });
});

describe('W0-3 стимул без плана', () => {
  it('нет плана → noPlan=true (раньше issues=[] читалось как «сбалансирован»)', () => {
    const r = analyzeBBStimulus(null);
    expect(r.noPlan).toBe(true);
    expect(r.scorePenalty).toBe(0);
  });
});

describe('W0-4 ручные слабые зоны не выдумывают дефицит', () => {
  it('manualWeak → source=manual, deltaPct=null', () => {
    const rep = buildBBDiagnosticsReport({ level: 'intermediate', manualWeak: ['chest_upper'] });
    const c = rep.weakCandidates[0];
    expect(c.source).toBe('manual');
    expect(c.deltaPct).toBeNull();
    expect(c.granular).toBe('chest_upper');
    expect(rep.findings.join(' ')).not.toMatch(/-15%/);
    expect(rep.findings.join(' ')).toMatch(/вручную/);
  });
});

describe('W0-5 балл: каналы проверки и ACWR', () => {
  const base = {
    weakCount: 0, volumeIssues: 0, volumeExceeding: 0, symmetryAsymPct: null, symmetryIssues: 0,
    stimulusPenalty: 0, acwrDanger: 0, acwrCaution: 0, mobilityFails: 0, vbtLossPct: null,
  };

  it('все три канала → verification=1 и пустой список недостающего', () => {
    const r = scoreBB({ ...base, hasDiary: true, hasCircumf: true, hasVbt: true });
    expect(r.verification).toBe(1);
    expect(r.verificationMissing).toEqual([]);
  });

  it('нет VBT → 0.70 и явный список «чего не хватает»', () => {
    const r = scoreBB({ ...base, hasDiary: true, hasCircumf: true, hasVbt: false });
    expect(r.verification).toBe(0.7);
    expect(r.verificationMissing).toEqual(['vbt']);
  });

  it('ничего не введено → 0 и три канала в списке', () => {
    const r = scoreBB({ ...base, hasDiary: false, hasCircumf: false, hasVbt: false });
    expect(r.verification).toBe(0);
    expect(r.verificationMissing).toEqual(['diary', 'circumf', 'vbt']);
  });
});

describe('W0-6 гранулярные зоны упражнений', () => {
  const zone = (id: string, group: string) => granularZoneOf({ id }, group);

  it('жим на наклонной → chest_upper, жим лёжа без наклона → null', () => {
    expect(zone('incline_bar', 'chest')).toBe('chest_upper');
    expect(zone('incline_fly_db', 'chest')).toBe('chest_upper');
    expect(zone('bench_bar', 'chest')).toBeNull();
    expect(zone('decline_bar', 'chest')).toBe('chest_lower');
  });

  it('спина: подтягивания/тяга сверху → ширина, тяга к поясу → толщина', () => {
    expect(zone('pulldown', 'back')).toBe('back_width');
    expect(zone('row_bar', 'back')).toBe('back_thickness');
  });

  it('плечи: махи → средняя, разведения в наклоне → задняя, жим стоя → передняя', () => {
    expect(zone('lateral_raise', 'shoulders')).toBe('delt_mid');
    expect(zone('rear_delt_fly', 'shoulders')).toBe('delt_rear');
    expect(zone('ohp', 'shoulders')).toBe('delt_front');
  });

  it('чужая группа не переписывается подгруппой', () => {
    // inc_push у упражнения ног не должен дать chest_upper
    expect(granularZoneOf({ id: 'squat_bar', substitutionGroup: 'inc_push' }, 'quads')).toBeNull();
  });

  it('id-зоны и алиасы нормализуются, канон восстанавливается', () => {
    expect(isGranularZone('chest_upper')).toBe(true);
    expect(isGranularZone('quads')).toBe(false);
    expect(normalizeZoneAlias('shoulders_side')).toBe('delt_mid');
    expect(canonicalOfZone('back_width')).toBe('back');
  });
});

describe('W2 спец-блок: длина 4–6 нед и кап MRV', () => {
  it('длина блока ограничена 4–12 нед (движок), хаб просит 4–6', () => {
    expect(buildSpecBlock({ weakZones: ['chest_upper'], weeks: 12 }).lengthWeeks).toBe(12);
    expect(buildSpecBlock({ weakZones: ['chest_upper'], weeks: 2 }).lengthWeeks).toBe(4);
    expect(buildSpecBlock({ weakZones: ['chest_upper'], weeks: 5 }).lengthWeeks).toBe(5);
    expect(buildSpecBlock({ weakZones: ['chest_upper'] }).lengthWeeks).toBe(8);
  });

  it('факт выше MRV → старт не выше MRV (раньше Math.max(start, …) ломал кап)', () => {
    const lm = getVolumeLandmarks('intermediate', 'chest')!;
    const b = buildSpecBlock({
      weakZones: ['chest_upper'],
      factSets: { chest_upper: lm.mrv + 10 },
      level: 'intermediate',
      weeks: 6,
    });
    const w1 = b.weeks[0].targetSets.chest_upper;
    expect(w1).toBeLessThanOrEqual(lm.mrv);
    expect(w1).toBeLessThan(lm.mrv + 10);
    expect(b.rationale.join(' ')).toMatch(/выше MRV/);
  });

  it('ни одна неделя не превышает MRV', () => {
    const lm = getVolumeLandmarks('advanced', 'chest')!;
    const b = buildSpecBlock({ weakZones: ['chest_upper'], factSets: { chest_upper: 20 }, level: 'advanced', weeks: 6 });
    for (const w of b.weeks) expect(w.targetSets.chest_upper).toBeLessThanOrEqual(lm.mrv);
  });
});

describe('W0-6b аудит плана: byZone для головок', () => {
  const plan: any = {
    weeks: [{
      sessions: [{
        exercises: [
          { exerciseName: 'incline_bar', name: 'Жим на наклонной', muscle: 'chest', sets: 4, rir: 2 },
          { exerciseName: 'bench_bar', name: 'Жим лёжа', muscle: 'chest', sets: 4, rir: 2 },
          { exerciseName: 'pulldown', name: 'Тяга сверху', muscle: 'back', sets: 4, rir: 2 },
        ],
      }],
    }],
  };

  it('byZone содержит головки с сетами, byMuscle остаётся каноническим', () => {
    const a = auditPlanExercises(plan)!;
    expect(a.byMuscle.chest.totalSets).toBe(8);
    expect(a.byZone.chest_upper?.totalSets).toBe(4);
    // у жима лёжа головка не определена однозначно → в головки не попал
    expect(a.byZone.chest_lower).toBeUndefined();
    expect(a.byZone.back_width?.totalSets).toBe(4);
    expect(a.byZone.back_width?.lengthened).toBeGreaterThanOrEqual(0);
  });
});

describe('W3-7 причина «темп» считается из аудита плана (BB-D-28)', () => {
  const planWith = (tempo?: string): any => ({
    weeks: [{ sessions: [{ exercises: [
      { exerciseName: 'incline_db', name: 'Жим гантелей на наклонной', muscle: 'chest', sets: 8, rir: 2, ...(tempo ? { tempo } : {}) },
      { exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, rir: 2, ...(tempo ? { tempo } : {}) },
    ] }] }],
  });

  it('темп не задан нигде → tempoSets = 0 и флаг noTempo', () => {
    const a = auditPlanExercises(planWith())!;
    expect(a.byZone.chest_upper?.tempoSets ?? 0).toBe(0);
    expect(a.flags).toContain('noTempo:chest');
  });

  it('темп задан → tempoSets = все сеты зоны, флага нет', () => {
    const a = auditPlanExercises(planWith('3-1-1-0'))!;
    expect(a.byZone.chest_upper?.tempoSets).toBe(8);
    expect(a.flags).not.toContain('noTempo:chest');
  });

  it('tempoMismatch в причине берётся из аудита (а не захардкожен false)', () => {
    const a = auditPlanExercises(planWith())!;
    const b = a.byZone.chest_upper!;
    const out = assembleWeakCauseInput('chest_upper', {
      level: 'intermediate',
      factVolume: { chest: 12 },
      auditFor: (z) => (z !== 'chest_upper' ? null : {
        lengthened: b.lengthened > 0,
        singleAngle: false,
        missingStrict: false,
        avgSfr: b.avgSfr ?? null,
        tempoMissing: b.totalSets >= 6 && b.tempoSets === 0,
      }),
      canonicalOf: () => 'chest',
    });
    expect(out.tempoMismatch).toBe(true);
    // и наоборот: есть темп — причины нет
    const a2 = auditPlanExercises(planWith('3-1-1-0'))!;
    const b2 = a2.byZone.chest_upper!;
    const out2 = assembleWeakCauseInput('chest_upper', {
      level: 'intermediate',
      factVolume: { chest: 12 },
      auditFor: () => ({
        lengthened: b2.lengthened > 0,
        singleAngle: false,
        missingStrict: false,
        avgSfr: b2.avgSfr ?? null,
        tempoMissing: b2.totalSets >= 6 && b2.tempoSets === 0,
      }),
      canonicalOf: () => 'chest',
    });
    expect(out2.tempoMismatch).toBe(false);
  });
});
