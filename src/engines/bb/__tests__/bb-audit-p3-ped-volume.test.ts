/**
 * bb-audit-p3-ped-volume.test.ts — аудит 2026-11, P3-2 (ядро, остаток).
 *
 * «На курсе» — одно дозо-зависимое правило (`bb-ped-profile`), а не непустой список
 * `peds`: креатин в списке давал недельный бюджет ×2, MRV ×1.9–2.15 и кап сессии
 * «про на курсе» — план строился на объёме, которого у атлета нет.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeBBWeeklyBudget,
  computeMrvMult,
  computeRegimeMrvMult,
  sessionLimitsFor,
} from '../bb-volume.engine';
import { highVolumeDemandOf, onCourseOf, pedClassesOf, pedProfileOf, volumeRegimeOf } from '../bb-ped-profile';
import { peptideMrvMultOf } from '../bb-ped-adaptation.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { scoreVolumeWeek } from '../bb-quality-weekly.engine';

describe('pedProfileOf — дозо-зависимый профиль', () => {
  it('AAS по имени и по порогу дозы 500 мг', () => {
    expect(pedProfileOf({ peds: ['AAS'] }).hasAAS).toBe(true);
    expect(pedProfileOf({ peds: ['тестостерон'] }).hasAAS).toBe(true);
    expect(pedProfileOf({ peds: [], pedDoses: { AAS: 499 } }).hasAAS).toBe(false);
    expect(pedProfileOf({ peds: [], pedDoses: { AAS: 500 } }).hasAAS).toBe(true);
  });

  it('GH и инсулин — по имени или ненулевой дозе', () => {
    expect(pedProfileOf({ peds: ['GH'] }).hasGH).toBe(true);
    expect(pedProfileOf({ peds: [], pedDoses: { GH: 4 } }).hasGH).toBe(true);
    expect(pedProfileOf({ peds: ['insulin'] }).hasIns).toBe(true);
    expect(pedProfileOf({ peds: [], pedDoses: { insulin: 10 } }).hasIns).toBe(true);
  });

  it('креатин и пустой список — не профиль', () => {
    expect(pedProfileOf({ peds: ['creatine'] })).toEqual({ hasAAS: false, hasGH: false, hasIns: false });
    expect(pedProfileOf({ peds: [] })).toEqual({ hasAAS: false, hasGH: false, hasIns: false });
    expect(highVolumeDemandOf({ level: 'advanced', peds: ['creatine'] })).toBe(false);
    expect(highVolumeDemandOf({ level: 'advanced', peds: ['AAS'] })).toBe(true);
    // enhanced — по уровню, даже без препаратов.
    expect(highVolumeDemandOf({ level: 'enhanced', peds: [] })).toBe(true);
  });

  it('onCourseOf: явный флаг сильнее профиля, профиль — только когда флаг не задан', () => {
    expect(onCourseOf({})).toBe(false);
    expect(onCourseOf({ onCourse: true })).toBe(true);
    // Креатин в списке — не профиль.
    expect(onCourseOf({ peds: ['creatine'] })).toBe(false);
    // Флаг не задан → решает профиль (прежнее `peds.length > 0`).
    expect(onCourseOf({ peds: ['AAS'] })).toBe(true);
    expect(onCourseOf({ peds: [], pedDoses: { AAS: 750 } })).toBe(true);
    // Явный флаг сильнее: атлет с профилем может быть ВНЕ курса (фаза off).
    expect(onCourseOf({ peds: ['AAS'], onCourse: false })).toBe(false);
    expect(onCourseOf({ peds: ['creatine'], onCourse: true })).toBe(true);
  });
});

describe('Объём читает то же правило: креатин больше не «курс»', () => {
  it('множитель режима: натурал/креатин ×1.0, реальный PED ×2.0', () => {
    expect(computeRegimeMrvMult({})).toBe(1.0);
    expect(computeRegimeMrvMult({ peds: [] })).toBe(1.0);
    expect(computeRegimeMrvMult({ peds: ['creatine'] })).toBe(1.0);
    expect(computeRegimeMrvMult({ peds: ['AAS'] })).toBe(2.0);
    expect(computeRegimeMrvMult({ peds: [], pedDoses: { AAS: 500 } })).toBe(2.0);
    expect(computeRegimeMrvMult({ peds: ['GH'] })).toBe(2.0);
    // Явный режим по-прежнему включает (интенсивность курса учитывается).
    expect(computeRegimeMrvMult({ onCourse: true })).toBe(2.0);
    expect(computeRegimeMrvMult({ peds: ['creatine'], onCourse: true })).toBe(2.0);
  });

  it('дозо-зависимый MRV: кривая работает только у реального профиля', () => {
    expect(computeMrvMult({ peds: ['creatine'] })).toBe(1.0);
    expect(computeMrvMult({ peds: ['AAS'], doseAwareMrv: 1.3 })).toBe(1.3);
    // Явное «не на курсе» игнорирует кривую (прежний сторож).
    expect(computeMrvMult({ onCourse: false, doseAwareMrv: 2.0 })).toBe(1.0);
  });

  it('недельный бюджет: натурал 112, курс 224, креатин — 112', () => {
    expect(computeBBWeeklyBudget({})).toBe(112);
    expect(computeBBWeeklyBudget({ peds: ['creatine'] })).toBe(112);
    expect(computeBBWeeklyBudget({ peds: ['AAS'] })).toBe(224);
    expect(computeBBWeeklyBudget({ peds: ['creatine'], onCourse: true })).toBe(224);
  });

  it('капы сессии: креатин даёт тир уровня, а не «про на курсе»', () => {
    const creatine = sessionLimitsFor({ level: 'advanced', trainingYears: 8, peds: ['creatine'] });
    const aas = sessionLimitsFor({ level: 'advanced', trainingYears: 8, peds: ['AAS'] });
    expect(creatine.maxWorkingSets).toBe(40);
    expect(creatine.maxExercises).toBe(15);
    expect(aas.maxWorkingSets).toBe(60);
    expect(aas.maxExercises).toBe(16);
    // Недельный бюджет тоже не удваивается креатином.
    expect(creatine.weeklyWorkingSets).toBe(112);
    expect(aas.weeklyWorkingSets).toBe(224);
  });
});

describe('Нет цикла импортов: правило живёт в отдельном модуле', () => {
  it('bb-volume не импортирует bb-selector (иначе цикл selector → volume)', () => {
    const src = readFileSync(resolve(__dirname, '..', 'bb-volume.engine.ts'), 'utf8');
    expect(src).not.toContain("from './bb-selector.engine'");
    expect(src).toContain("from './bb-ped-profile'");
  });

  it('селектор реэкспортирует то же правило (прежние импортёры не ломаются)', () => {
    const src = readFileSync(resolve(__dirname, '..', 'bb-selector.engine.ts'), 'utf8');
    expect(src).toContain("export { pedProfileOf, highVolumeDemandOf };");
    expect(src).toContain("from './bb-ped-profile'");
  });
});

describe('Проход 17: режим объёма — три состояния (пептиды MGF/IGF-1 ≠ курс)', () => {
  it('volumeRegimeOf: курс = AAS/GH/инсулин, пептиды = только MGF/IGF-1', () => {
    expect(volumeRegimeOf({})).toBe('natural');
    expect(volumeRegimeOf({ peds: ['creatine'] })).toBe('natural');
    expect(volumeRegimeOf({ peds: ['IGF1'] })).toBe('peptides');
    expect(volumeRegimeOf({ peds: ['MGF'] })).toBe('peptides');
    expect(volumeRegimeOf({ peds: ['MGF', 'IGF1'] })).toBe('peptides');
    // Доза-ключ без имени класса — тоже препарат (UI/цикловой путь).
    expect(volumeRegimeOf({ pedDoses: { IGF: 80 } })).toBe('peptides');
    expect(volumeRegimeOf({ pedDoses: { MGF: 200 } })).toBe('peptides');
    expect(volumeRegimeOf({ peds: ['AAS'] })).toBe('course');
    expect(volumeRegimeOf({ peds: ['test_enan'] })).toBe('course');
    expect(volumeRegimeOf({ pedDoses: { AAS: 125 } })).toBe('course');
    expect(volumeRegimeOf({ peds: ['GH'] })).toBe('course');
    expect(volumeRegimeOf({ peds: ['insulin'] })).toBe('course');
    // Пептид + AAS — это курс (высший тир побеждает).
    expect(volumeRegimeOf({ peds: ['IGF1', 'GH'] })).toBe('course');
    // Явный флаг сильнее профиля: фаза off гасит любой стек.
    expect(volumeRegimeOf({ peds: ['AAS', 'GH'], onCourse: false })).toBe('natural');
    expect(volumeRegimeOf({ peds: ['IGF1'], onCourse: false })).toBe('natural');
    expect(volumeRegimeOf({ onCourse: true })).toBe('course');
    // Список выбранных препаратов сильнее доз: форма UI держит дозы всех
    // препаратов (AAS 500 по умолчанию), и IGF1-соло не должен стать курсом.
    expect(volumeRegimeOf({ peds: ['IGF1'], pedDoses: { IGF1: 80, AAS: 500 } })).toBe('peptides');
    expect(volumeRegimeOf({ peds: ['creatine'], pedDoses: { AAS: 500, GH: 4 } })).toBe('natural');
    expect(volumeRegimeOf({ peds: ['AAS'], pedDoses: { AAS: 500, IGF1: 80 } })).toBe('course');
  });

  it('pedClassesOf: классы по имени и по дозе', () => {
    expect(pedClassesOf({ peds: ['IGF1'] })).toMatchObject({ hasIGF1: true, hasMGF: false, hasAAS: false });
    expect(pedClassesOf({ pedDoses: { MGF: 100 } })).toMatchObject({ hasMGF: true, hasIGF1: false });
    expect(pedClassesOf({ peds: ['deca'] })).toMatchObject({ hasAAS: true });
    expect(pedClassesOf({ peds: ['creatine'] })).toMatchObject({ hasAAS: false, hasGH: false, hasIns: false, hasMGF: false, hasIGF1: false });
  });

  it('пептидная кривая — та же убывающая отдача, а не курс ×2', () => {
    // IGF1 80 мкг/день: кривая 1.22→1.25, ×0.85 убывающей отдачи, ×1.04 интенсивность.
    expect(peptideMrvMultOf(['IGF1'], { IGF1: 80 })).toBeCloseTo(1.2398, 3);
    // MGF 200 мкг/нед: 1.10 → ×0.85 → ×1.04.
    expect(peptideMrvMultOf(['MGF'], { MGF: 200 })).toBeCloseTo(1.1284, 3);
    // Пусто/AAS — пептидная функция не выдаёт курс.
    expect(peptideMrvMultOf([], {})).toBe(1);
    expect(peptideMrvMultOf(['AAS'], { AAS: 500 })).toBe(1);
    expect(computeRegimeMrvMult({ peds: ['IGF1'], pedDoses: { IGF1: 80 } })).toBeLessThan(1.4);
    expect(computeRegimeMrvMult({ peds: ['AAS'] })).toBe(2.0);
  });

  it('MRV/бюджет/капы: IGF1-соло — свой тир, AAS и TRT — курс', () => {
    // MRV: дозо-кривая пептида (потолок 1.4), а не 2.0.
    expect(computeMrvMult({ peds: ['IGF1'], pedDoses: { IGF1: 80 }, doseAwareMrv: 1.2398 })).toBeCloseTo(1.2398, 3);
    // Явная фаза off гасит и пептидную кривую.
    expect(computeMrvMult({ peds: ['IGF1'], pedDoses: { IGF1: 80 }, doseAwareMrv: 1.24, onCourse: false })).toBe(1.0);
    // Бюджет: 112 / пептиды ×кривая / курс 224 (без дозы — канон владельца).
    expect(computeBBWeeklyBudget({ peds: ['IGF1'], pedDoses: { IGF1: 80 } })).toBe(139);
    expect(computeBBWeeklyBudget({ peds: ['MGF'], pedDoses: { MGF: 200 } })).toBe(126);
    expect(computeBBWeeklyBudget({ peds: ['AAS'], pedDoses: { AAS: 125 } })).toBe(224);
    expect(computeBBWeeklyBudget({ peds: ['AAS'], pedDoses: { AAS: 1250 } })).toBe(224);
    // Капы сессии: пептиды — по уровню (advanced 40/15), курс — «про» (52/15).
    const igf = sessionLimitsFor({ level: 'advanced', trainingYears: 5, peds: ['IGF1'], pedDoses: { IGF1: 80 } });
    const aas = sessionLimitsFor({ level: 'advanced', trainingYears: 5, peds: ['AAS'], pedDoses: { AAS: 500 } });
    expect(igf).toEqual({ weeklyWorkingSets: 139, maxWorkingSets: 40, maxExercises: 15 });
    expect(aas).toEqual({ weeklyWorkingSets: 224, maxWorkingSets: 52, maxExercises: 15 });
  });
});

describe('Проход 17: сборка плана слушает режим, а не факт дозы', () => {
  const WM = {
    chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 110,
    glutes: 120, biceps: 50, triceps: 55, calves: 80, traps: 70, forearms: 40,
    delt_front: 45, delt_mid: 45, delt_rear: 40, abs: 50, lower_back: 90,
  };
  const build = (extra: Record<string, unknown> = {}) => buildBBPlan({
    patternId: 'ppl_6', level: 'advanced', trainingYears: 5, goal: 'mass',
    weeks: 2, workMax: WM, weakPoints: [], volumeGoal: 'mav',
    ...extra,
  } as any) as any;
  const week1Sets = (plan: any): number => (plan.weeks?.[0]?.sessions || [])
    .flatMap((s: any) => s.exercises || [])
    .filter((e: any) => !e.warmupActivator)
    .reduce((a: number, e: any) => a + (Number(e.sets) || 0), 0);

  it('IGF1-план: пептидный бюджет и капы уровня, а не курс', () => {
    const igf = build({ peds: ['IGF1'], pedDoses: { IGF1: 80 } });
    const aas = build({ peds: ['AAS'], pedDoses: { AAS: 500 } });
    // Реальный UI-пейлоад: дозы ВСЕХ препаратов (AAS 500 по умолчанию) при
    // выбранном IGF1 — список препаратов решает, доза невыбранного AAS молчит.
    const igfUi = build({ peds: ['IGF1'], pedDoses: { IGF1: 80, AAS: 500, GH: 4 } });
    expect(igf.buildContext?.volumeRegime).toBe('peptides');
    expect(igf.onCourse).toBe(false);
    expect(igf.maxWorkingSets).toBe(40);
    expect(igf.maxExercises).toBe(15);
    expect(aas.buildContext?.volumeRegime).toBe('course');
    expect(aas.onCourse).toBe(true);
    expect(aas.maxWorkingSets).toBe(52);
    // UI-пейлоад с дефолтными дозами всех препаратов — тот же пептидный тир.
    expect(igfUi.buildContext?.volumeRegime).toBe('peptides');
    expect(igfUi.maxWorkingSets).toBe(40);
    // Неделя пептида не раздувается до курсовой (раньше 225 против 210 у натурала).
    const natural = build();
    expect(week1Sets(igf)).toBeLessThan(week1Sets(aas));
    expect(week1Sets(igf)).toBeLessThanOrEqual(Math.round(week1Sets(natural) * 1.1));
    expect(week1Sets(igfUi)).toBeLessThanOrEqual(Math.round(week1Sets(natural) * 1.15));
  });

  it('явный onCourse:false с полным стеком — натуральный план (фаза off)', () => {
    const off = build({ peds: ['AAS'], pedDoses: { AAS: 500 }, onCourse: false });
    expect(off.buildContext?.volumeRegime).toBe('natural');
    expect(off.onCourse).toBe(false);
    expect(off.maxWorkingSets).toBe(40);
    const natural = build();
    expect(week1Sets(off)).toBe(week1Sets(natural));
  });

  it('на снапшот плана попадают peds/onCourse (replan не меняет тир)', () => {
    const plan = build({ peds: ['IGF1'], pedDoses: { IGF1: 80 } });
    expect(plan.inputSnapshot?.peds).toEqual(['IGF1']);
    expect(plan.inputSnapshot?.onCourse).toBeUndefined();
    const off = build({ peds: ['AAS'], onCourse: false });
    expect(off.inputSnapshot?.onCourse).toBe(false);
  });
});

describe('Проход 17: оценка качества недели читает режим, а не факт pedAdaptation', () => {
  /** План с одной сессией на 42 сета/14 упражнений: под курс-капом 52/15,
   *  но выше капа уровня 40/15 (пептиды/натурал). */
  const fakePlan = (extra: Record<string, unknown>) => ({
    level: 'advanced',
    pattern: { id: 'upper_lower_4' },
    inputSnapshot: { level: 'advanced', trainingYears: 5 },
    pedAdaptation: { activePEDs: ['IGF1'], pedDoses: { IGF1: 80 }, combinedMrvMultiplier: 1.24 },
    weeks: [{
      week: 1,
      phase: 'accumulation',
      sessions: [{
        sessionTag: 'Upper',
        exercises: Array.from({ length: 14 }, (_, i) => ({
          name: `Упражнение ${i + 1}`,
          exerciseName: `Упражнение ${i + 1}`,
          muscle: i % 2 === 0 ? 'chest' : 'back',
          sets: 3,
          reps: 10,
        })),
      }],
    }],
    ...extra,
  }) as any;
  const capWarnings = (plan: any) => scoreVolumeWeek(plan, 1).issues.filter(i => i.code === 'session_cap');

  it('IGF1-план без контекста: pedAdaptation не делает его курсовым', () => {
    // Раньше `onCourseOf(...) || !!pedAdaptation` → курс-кап 52 и предупреждения нет.
    expect(capWarnings(fakePlan({})).length).toBe(1);
  });

  it('buildContext.volumeRegime приоритетнее: course проходит, peptides — нет', () => {
    expect(capWarnings(fakePlan({ buildContext: { level: 'advanced', trainingYears: 5, onCourse: true, volumeRegime: 'course' } })).length).toBe(0);
    expect(capWarnings(fakePlan({ buildContext: { level: 'advanced', trainingYears: 5, onCourse: false, volumeRegime: 'peptides' } })).length).toBe(1);
  });
});
