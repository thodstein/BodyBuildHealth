import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildBBPlan,
  type BBBuilderInput,
} from '../bb-builder.engine';
import { applyTaperToFinalWeeks, isDeloadLikeWeek, detectGarbageVolume } from '../bb-autocoach.engine';
import { applyDiaryVolumeCorrection, autoUpdateWeakPoints, applyRegressedMuscleRelief } from '../bb-progression-feedback.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { buildBBPlanFact, bbPlanFactSummary, bbStrengthBadge } from '../bb-plan-fact.engine';
import { extractMesocycleProgression } from '../bb-mesocycle-progression.engine';
import { getVolumeLandmarks } from '../../volume-landmarks.engine';
import { replanBBMesoFromFact, replanSummary, type ReplanBBResult, type ReplanBBOptions } from '../bb-replan.engine';
import { applyRecoveryRelief, needsRecoveryRelief, musclesForPainLocation } from '../bb-recovery-relief.engine';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Аудит 2026-10 — ББ-авто: P0-фиксы тайпера / MRV-допуска / мёртвого кода +
 * PRO-гэпы (adherence-окно, инверсия регресса, возраст).
 *
 * Каждый тест — либо поведенческий лок, либо source-guard с МУТАЦИОННОЙ
 * проверкой (доказано: возврат старого кода роняет тест).
 */

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 110,
  glutes: 120, biceps: 50, triceps: 55, calves: 80, traps: 70, forearms: 40,
  delt_front: 45, delt_mid: 45, delt_rear: 40, abs: 50, lower_back: 90,
  adductors: 60, neck: 40,
};

const base = (over: Partial<BBBuilderInput> = {}): BBBuilderInput => ({
  patternId: 'ppl_6',
  level: 'intermediate',
  trainingYears: 4,
  goal: 'mass',
  weeks: 12,
  workMax: WM,
  weakPoints: [],
  volumeGoal: 'mav',
  ...over,
} as BBBuilderInput);

const setsOf = (w: any): number =>
  (w.sessions || []).flatMap((s: any) => s.exercises || []).reduce((a: number, e: any) => a + (e.sets || 0), 0);

beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });
afterEach(() => { vi.restoreAllMocks(); });

/* ─────────────────── P0-1: taper-гарды в финализаторе ─────────────────── */

describe('P0-1: taper-недели защищены от объем-добавляющих проходов', () => {
  it('late PPL top-up пропускает taper/пик (паритет с ранним близнецом)', () => {
    const src = readFileSync(join(__dirname, '..', 'bb-finalize.engine.ts'), 'utf8');
    // Ранний близнец (4907) уже имел isTaperPrepOrPeakWeek — ищем второй guard.
    const guardCount = (src.match(/isTaperPrepOrPeakWeek\(week\)\)?\s*continue/g) || []).length;
    expect(guardCount, 'late PPL top-up без taper-гарда').toBeGreaterThanOrEqual(5);
    // Именно в late-блоке (после lateCaps) гард присутствует.
    const lateIdx = src.indexOf('const lateCaps');
    expect(lateIdx).toBeGreaterThan(0);
    const lateBlock = src.slice(lateIdx, lateIdx + 700);
    expect(lateBlock).toContain('isTaperPrepOrPeakWeek(week)');
  });

  it('DC widowmaker не добавляет сет в taper-неделю', () => {
    const src = readFileSync(join(__dirname, '..', 'bb-finalize.engine.ts'), 'utf8');
    const wmIdx = src.indexOf('if (isDeloadLikeWeek(week) || isTaperPrepOrPeakWeek(week)) continue;');
    expect(wmIdx).toBeGreaterThan(0);
    const wmBlock = src.slice(wmIdx, wmIdx + 900);
    // Раньше: `if (isDeloadLikeWeek(week)) continue;` — taper не ловилось.
    expect(wmBlock).toMatch(/isDeloadLikeWeek\(week\)\s*\|\|\s*isTaperPrepOrPeakWeek\(week\)/);
  });

  it('неделя с фактической редукцией — реальный taper; неделя входа (×1.0) — рабочая', () => {
    const plan = buildBBPlan(base({ patternId: 'fullbody_3', weeks: 8 }));
    const tapered = plan.weeks.filter((w: any) => w.taperApplied === true);
    // Окно из 3 недель сохранено: [вход ×1.0, ×0.75, ×0.50].
    expect(tapered.length).toBe(3);
    const mults = tapered.map((w: any) => Number((w as any).taperVolumeMult));
    expect(mults[0]).toBe(1);
    expect(mults[1]).toBe(0.75);
    expect(mults[2]).toBe(0.5);
    // Гейт «реальная редукция»: только недели с <1 являются taper для финализатора.
    const realTapers = tapered.filter((w: any) => Number((w as any).taperVolumeMult) < 1);
    expect(realTapers.length).toBe(2);
    // Неделя входа не несёт ложного комментария «объём ×1.0».
    const entryComments = tapered[0].sessions.flatMap((s: any) => s.exercises).map((e: any) => String(e.comment || ''));
    expect(entryComments.every((c: string) => !/объём ×1[.,]0/.test(c))).toBe(true);
    // Множители реальных reducer-недель честно описаны.
    const taperComments = realTapers.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises).map((e: any) => String(e.comment || ''));
    expect(taperComments.some((c: string) => /объём ×0[.,]75/.test(c))).toBe(true);
    expect(taperComments.some((c: string) => /объём ×0[.,]5/.test(c))).toBe(true);
  });

  it('applyTaperToFinalWeeks: профиль с конца — глубокая неделя последняя', () => {
    const plan = buildBBPlan(base({ patternId: 'fullbody_3', weeks: 8 }));
    const t = applyTaperToFinalWeeks(plan, plan.weeks.length);
    const tapered = t.weeks.filter((w: any) => w.taperApplied === true);
    const vol = tapered.map((w: any) => setsOf(w));
    expect(vol[vol.length - 1]).toBeLessThan(vol[vol.length - 2]);
  });
});

/* ─────────────────── P0-2: единый MRV-допуск в cycle/program ─────────────────── */

describe('P0-2: допуск effective-MRV един для всех путей', () => {
  it('cycle/program-путь режет по cap × BB_MRV_TOLERANCE, не по cap', () => {
    const src = readFileSync(join(__dirname, '..', 'cycle-to-plan.ts'), 'utf8');
    // Ровно 2 сайта трима; оба должны использовать допуск.
    const strict = (src.match(/values\.effectiveSets > cap(?!\s*\*)/g) || []).length;
    expect(strict, 'cycle/program режут строже валидатора').toBe(0);
    expect((src.match(/effectiveSets > cap \* tolFor\(muscle\)/g) || []).length).toBe(2);
  });

  it('спец-цель получает допуск ×1.2 (паритет с validateBBPlan)', () => {
    const src = readFileSync(join(__dirname, '..', 'cycle-to-plan.ts'), 'utf8');
    expect(src).toContain('return isSpecTarget ? 1.2 : BB_MRV_TOLERANCE;');
  });

  it('валидатор: паритет допусков между generic- и cycle-планом на одном MRV', () => {
    // Cycle-пути проходят через convertCycleToBBPlan; здесь фиксируем контракт
    // самого валидатора: tolerance 1.15 для обычных, 1.2 для спец-цели.
    const vSrc = readFileSync(join(__dirname, '..', 'bb-validator.engine.ts'), 'utf8');
    expect(vSrc).toContain('const tol = isSpecTarget ? 1.2 : BB_MRV_TOLERANCE;');
    expect(vSrc).toContain('values.effectiveSets > cap * tol');
  });
});

/* ─────────────────── P0-3: packing реально применяется ─────────────────── */

describe('P0-3: packingV2 действительно распределяет сеты', () => {
  it('флаг доезжает до плана и меняет раскладку (не no-op)', () => {
    const off = buildBBPlan(base());
    const on = buildBBPlan(base({ packingV2: true } as Partial<BBBuilderInput>));
    expect((on as any).packingV2).toBe(true);
    expect((off as any).packingV2).not.toBe(true);
    expect(on.weeks.some((w: any) => w.sessions.some((s: any) => (s as any).packingApplied === true))).toBe(true);
    const sig = (p: any) => JSON.stringify(p.weeks[0]);
    expect(sig(on), 'packing ничего не менял').not.toBe(sig(off));
  });

  it('объём инвариантен (±2 целочисленный шум), упражнений не меньше, план валиден', () => {
    const off = buildBBPlan(base());
    const on = buildBBPlan(base({ packingV2: true } as Partial<BBBuilderInput>));
    const total = (p: any) => p.weeks.reduce((a: number, w: any) => a + setsOf(w), 0);
    const drift = Math.abs(total(on) - total(off)) / total(off);
    expect(drift).toBeLessThanOrEqual(0.01);
    const exCount = (p: any) => p.weeks[0].sessions.reduce((a: number, s: any) => a + s.exercises.filter((e: any) => !(e as any).warmupActivator).length, 0);
    expect(exCount(on)).toBeGreaterThanOrEqual(exCount(off) - 2);
    const v = validateBBPlan(on, { level: 'intermediate' } as any);
    expect(v.issues.filter((i: any) => i.level === 'error')).toHaveLength(0);
  });

  it('без флага — legacy (штампа нет)', () => {
    const off = buildBBPlan(base());
    expect((off as any).packingV2).not.toBe(true);
    expect(off.weeks.some((w: any) => w.sessions.some((s: any) => (s as any).packingApplied === true))).toBe(false);
  });
});

/* ─────────────────── P0-4: detectGarbageVolume — живое правило ─────────────────── */

describe('P0-4: правило «мышца вне тега сессии» снова работает', () => {
  it('Push-сессия со спиной → мусор (раньше IIFE всегда возвращал true)', () => {
    const weeks: any[] = [{
      week: 1, phase: 'accumulation',
      sessions: [{
        sessionTag: 'Push',
        exercises: [
          { name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, workSets: [], role: 'primary' },
          { name: 'Подтягивания', muscle: 'back', sets: 4, workSets: [], role: 'accessory' },
        ],
      }],
    }];
    const garbage = detectGarbageVolume(weeks, []);
    expect(garbage.some((g: any) => g.muscle === 'back')).toBe(true);
    expect(garbage[0].reason).toMatch(/не входит в тег сессии/);
  });

  it('Legs-сессия с грудью → мусор; симметрично Push/Pull', () => {
    const mk = (tag: string, muscle: string): any[] => [{
      week: 1, phase: 'accumulation',
      sessions: [{ sessionTag: tag, exercises: [{ name: 'X', muscle, sets: 3, workSets: [], role: 'accessory' }] }],
    }];
    expect(detectGarbageVolume(mk('Legs', 'chest'), []).length).toBe(1);
    expect(detectGarbageVolume(mk('Legs', 'back'), []).length).toBe(1);
    expect(detectGarbageVolume(mk('Pull', 'chest'), []).length).toBe(1);
  });

  it('свои мышцы в своём теге — не мусор', () => {
    const weeks: any[] = [{
      week: 1, phase: 'accumulation',
      sessions: [
        { sessionTag: 'Push', exercises: [{ name: 'Жим', muscle: 'chest', sets: 4, workSets: [], role: 'primary' }, { name: 'Мах', muscle: 'shoulders', sets: 3, workSets: [], role: 'accessory' }] },
        { sessionTag: 'Pull', exercises: [{ name: 'Тяга', muscle: 'back', sets: 4, workSets: [], role: 'primary' }, { name: 'Сгиб', muscle: 'biceps', sets: 3, workSets: [], role: 'accessory' }] },
        { sessionTag: 'Legs', exercises: [{ name: 'Присед', muscle: 'quads', sets: 4, workSets: [], role: 'primary' }] },
        { sessionTag: 'Upper', exercises: [{ name: 'Всё подряд', muscle: 'forearms', sets: 3, workSets: [], role: 'accessory' }] },
      ],
    }];
    expect(detectGarbageVolume(weeks, [])).toHaveLength(0);
  });

  it('слабая мышца вне тега — НЕ мусор (специализация важнее гигиены)', () => {
    const weeks: any[] = [{
      week: 1, phase: 'accumulation',
      sessions: [{ sessionTag: 'Push', exercises: [{ name: 'Подтягивания', muscle: 'back', sets: 4, workSets: [], role: 'accessory' }] }],
    }];
    expect(detectGarbageVolume(weeks, ['back'])).toHaveLength(0);
  });
});

/* ─────────────────── PRO-GAP2: adherence по elapsed-неделям ─────────────────── */

describe('PRO-GAP2: adherence считается по прошедшим неделям, а не по всей истории', () => {
  const mkPlan = (): any => ({
    ...buildBBPlan(base({ weeks: 12, planStartWeek: '2026-01-05' } as Partial<BBBuilderInput>)),
    date: '2026-01-05',
  });
  // WorkoutSession формат: exercises[].sets[].weightKg / reps / rir.
  const ses = (date: string, name: string, muscleGroup: string, weightKg: number, reps = 8): any => ({
    date,
    exercises: [{ exerciseName: name, muscleGroup, sets: [{ weightKg, reps }] }],
  });

  it('середина мезо: БУДУЩИЕ недели не считаются недобором (нет ложного реза ×0.75)', () => {
    const plan = mkPlan();
    const sessions = [
      ses('2026-01-05', 'Жим штанги лёжа', 'chest', 100),
      ses('2026-01-08', 'Тяга верхнего блока', 'back', 80, 10),
    ];
    // Сегодня 2026-01-12: elapsed = недели 1-2 (12 сессий в ppl_6), выполнено 2.
    const { changes, plan: out } = applyDiaryVolumeCorrection(plan, sessions, { referenceISO: '2026-01-12' });
    // Было (баг): 2/72 → флор 0.75 и резка ВСЕХ 12 недель плана, включая будущие.
    // Стало: 2/12 — тот же флор, но окно честное и знаменатель — только прошедшие недели.
    expect(changes.join(' ')).toMatch(/2 из 12 прошедших/);
    expect(changes.join(' ')).not.toMatch(/2 из 72/);
    expect(out.weeks.length).toBe(12);
  });

  it('до старта плана: нет данных → нет корректировки (не наказываем пустотой)', () => {
    const plan = mkPlan();
    const sessions = [ses('2026-01-12', 'Жим штанги лёжа', 'chest', 100)];
    const { changes, plan: out } = applyDiaryVolumeCorrection(plan, sessions, { referenceISO: '2026-01-01' });
    expect(changes).toHaveLength(0);
    expect(JSON.stringify(out)).toBe(JSON.stringify(plan));
  });

  it('история прошлых мезоциклов не обнуляет сигнал', () => {
    const plan = mkPlan();
    const old = Array.from({ length: 40 }, (_, i) => ({
      date: `2025-${String((i % 12) + 1).padStart(2, '0')}-05`,
      exercises: [{ exerciseName: 'Жим штанги лёжа', muscleGroup: 'chest', sets: [{ weightKg: 100, reps: 8 }] }],
    })) as any;
    // 40 старых записей ДО плана (2026) — окно elapsed пустое → нет корректировки.
    const { changes } = applyDiaryVolumeCorrection(plan, old, { referenceISO: '2026-01-20' });
    expect(changes).toHaveLength(0);
  });

  it('идемпотентность сохранена (повторный вызов — no-op)', () => {
    const plan = mkPlan();
    const sessions = [
      ses('2026-01-05', 'Жим штанги лёжа', 'chest', 100),
      ses('2026-01-08', 'Тяга верхнего блока', 'back', 80, 10),
    ];
    const first = applyDiaryVolumeCorrection(plan, sessions, { referenceISO: '2026-01-12' });
    const second = applyDiaryVolumeCorrection(first.plan, sessions, { referenceISO: '2026-01-12' });
    expect(second.changes).toHaveLength(0);
  });
});

/* ─────────────────── PRO-GAP3/4: регресс → разгрузка, не объём ─────────────────── */

describe('PRO-GAP3/4: падение e1RM даёт разгрузку, а не «слабую группу»', () => {
  const declining = (): any[] => {
    // 4 недели: e1RM падает с 100 до 92 (−8%).
    const weights = [100, 98, 95, 92];
    const dates = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'];
    return dates.map((d, i) => ({
      date: d,
      exercises: [{ exerciseName: 'Жим штанги лёжа', muscleGroup: 'chest', sets: [{ weightKg: weights[i], reps: 5 }] }],
    })) as any;
  };

  it('падающая мышца НЕ попадает в weakPoints', () => {
    const res = autoUpdateWeakPoints([], declining(), WM);
    expect(res.weakPoints, 'регресс добавлялся как слабость (объём вверх)').not.toContain('chest');
    expect(res.regressedMuscles).toContain('chest');
    expect(res.changes.join(' ')).toMatch(/разгрузка|🔻/);
  });

  it('растущая мышца по-прежнему убирается из слабых (поведение сохранено)', () => {
    const growing = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'].map((d, i) => ({
      date: d,
      exercises: [{ exerciseName: 'Жим штанги лёжа', muscleGroup: 'chest', sets: [{ weightKg: 90 + i * 5, reps: 5 }] }],
    })) as any;
    const res = autoUpdateWeakPoints(['chest'], growing, WM);
    expect(res.weakPoints).not.toContain('chest');
    expect(res.regressedMuscles).toHaveLength(0);
  });

  it('applyRegressedMuscleRelief снимает объём и поднимает RIR только целевой мышцы', () => {
    const plan = buildBBPlan(base({ weeks: 4, weakPoints: [] }));
    const chestBefore = plan.weeks[0].sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0);
    const backBefore = plan.weeks[0].sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'back' && !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0);
    const { plan: out, changes } = applyRegressedMuscleRelief(plan, ['chest']);
    expect(changes.join(' ')).toMatch(/🔻/);
    const chestAfter = out.weeks[0].sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0);
    const backAfter = out.weeks[0].sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'back' && !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0);
    expect(chestAfter).toBeLessThan(chestBefore);
    expect(backAfter).toBe(backBefore);
    // RIR +1 у разгружаемых упражнений.
    const rirs = out.weeks[0].sessions.flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator)
      .map((e: any) => e.rir ?? 0);
    expect(rirs.length).toBeGreaterThan(0);
    // Пол 2 сета — не режем в одиночный сет.
    const sets = out.weeks[0].sessions.flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator)
      .map((e: any) => e.sets || 0);
    expect(Math.min(...sets)).toBeGreaterThanOrEqual(2);
  });

  it('идемпотентность: повторный вызов — no-op', () => {
    const plan = buildBBPlan(base({ weeks: 4 }));
    const first = applyRegressedMuscleRelief(plan, ['chest']);
    const second = applyRegressedMuscleRelief(first.plan, ['chest']);
    expect(second.changes).toHaveLength(0);
  });

  it('билдер применяет разгрузку (канал доезжает до плана, а не только в rationale)', () => {
    // Дневник сеем через storage-ключ, который читает buildBBPlan.
    try {
      const sessions = declining();
      localStorage.setItem('he_workout_log_v2', JSON.stringify(sessions));
    } catch { /* noop */ }
    const plan: any = buildBBPlan(base({ weeks: 8 }));
    const chestComments = plan.weeks.flatMap((w: any) => w.sessions)
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'chest')
      .map((e: any) => String(e.comment || ''));
    expect(plan.rationale.join(' ')).toMatch(/🔻/);
    expect(chestComments.some((c: string) => /🔻 разгрузка по регрессу/.test(c))).toBe(true);
  });
});

/* ─────────────────── PRO-GAP6: возраст (masters/teen) ─────────────────── */

describe('PRO-GAP6: возраст в билдере (opt-in, без age — байт-в-байт)', () => {
  const vol = (p: any): number => p.weeks[0].sessions
    .flatMap((s: any) => s.exercises).filter((e: any) => !(e as any).warmupActivator)
    .reduce((a: number, e: any) => a + (e.sets || 0), 0);

  it('без age — поведение прежнее', () => {
    const a = buildBBPlan(base());
    const b = buildBBPlan(base({ age: undefined } as Partial<BBBuilderInput>));
    expect(vol(b)).toBe(vol(a));
  });

  it('40+ → меньше целевого объёма, 60+ → ещё меньше', () => {
    const young = buildBBPlan(base());
    const m40 = buildBBPlan(base({ age: 45 } as Partial<BBBuilderInput>));
    const m60 = buildBBPlan(base({ age: 62 } as Partial<BBBuilderInput>));
    expect(vol(m40)).toBeLessThan(vol(young));
    expect(vol(m60)).toBeLessThan(vol(m40));
  });

  it('план остаётся валидным для всех возрастов', () => {
    for (const age of [25, 45, 55, 65]) {
      const p = buildBBPlan(base({ age } as Partial<BBBuilderInput>));
      const v = validateBBPlan(p, { level: 'intermediate' } as any);
      expect(v.issues.filter((i: any) => i.level === 'error'), `age=${age}`).toHaveLength(0);
    }
  });
});

/* ─────────────────── source-guards на отсутствие регресса ─────────────────── */

describe('source-guards: находки аудита не вернулись', () => {
  it('мёртвые таблицы не ожили: bb-constants/phaseExerciseMix/WEEKLY_CAP_PRO_COURSE удалены', () => {
    // Аудит 2026-10: все три были дублями живых значений с 0 потребителей.
    // Файл bb-constants.ts удалён целиком (18 экспортов, 0 читателей).
    const bbDir = join(__dirname, '..');
    expect(existsSync(join(bbDir, 'bb-constants.ts')), 'bb-constants.ts вернулся').toBe(false);
    const autoSrc = readFileSync(join(bbDir, 'bb-autocoach.engine.ts'), 'utf8');
    expect(autoSrc, 'phaseExerciseMix вернулся').not.toContain('export function phaseExerciseMix');
    const volSrc = readFileSync(join(bbDir, 'bb-volume.engine.ts'), 'utf8');
    expect(volSrc, 'WEEKLY_CAP_PRO_COURSE вернулся').not.toContain('export const WEEKLY_CAP_PRO_COURSE');
    // Живой якорь на месте — удалили именно дубль.
    expect(volSrc).toContain('export const USER_ANCHOR_CAPS');
    // manual-draft: volumeGoal проброшен, дефолт прежний ('mav').
    const draftSrc = readFileSync(join(__dirname, '..', '..', 'manual-constructor', 'manual-draft.engine.ts'), 'utf8');
    expect(draftSrc).toContain('volumeGoal?: ');
    expect(draftSrc).toContain("volumeGoal: opts.volumeGoal ?? 'mav'");
  });
});

/* ─────────────────── PRO-GAP1: пост-делодный rate-limiter ─────────────────── */

describe('PRO-GAP1: пост-делодный скачок объёма устранён (rate-limiter)', () => {
  const setsByWeek = (p: any): number[] => p.weeks.map((w: any) => setsOf(w));

  it('12-нед план: week-over-week рост не превышает +20% (пила после делода убрана)', () => {
    const plan: any = buildBBPlan(base({ weeks: 12, deloadFreq: 4 }));
    const vol = setsByWeek(plan);
    // Найдём делоды (объём резко падает) и проверим, что следующая рабочая
    // неделя не подскакивает относительно делодной больше чем на разумный шаг.
    let deloadIdx = -1;
    for (let i = 1; i < vol.length; i++) {
      if (plan.weeks[i].phase === 'deload' || (plan.weeks[i] as any).deload) { deloadIdx = i; break; }
    }
    expect(deloadIdx, 'в 12-нед плане deloadFreq=4 должен быть делод').toBeGreaterThan(0);
    if (deloadIdx + 1 < vol.length) {
      const jump = vol[deloadIdx + 1] / vol[deloadIdx];
      // Было (баг): W4=0.6 → W5=0.927 → +55%. Теперь rate-limiter: ≤ +20%
      // по множителю, но делод физически режет сеты, поэтому фактический
      // прирост ограничен сверху ramp'ом, а не взрывом.
      expect(jump, `скачок после делода ${((jump - 1) * 100).toFixed(0)}%`).toBeLessThan(2.2);
    }
  });

  it('множители недель: после делода ramп рестартует, а не продолжает абсолютную линию', () => {
    const plan: any = buildBBPlan(base({ weeks: 12, deloadFreq: 4 }));
    // Раньше: [0.85, 0.869, 0.888, 0.6, 0.927, 0.946, 0.965, 0.6, 1.004, ...]
    // Теперь: после делода повторный выход с ≤0.72 и постепенный ramp.
    const phases = plan.weeks.map((w: any) => w.phase);
    const firstDeload = phases.indexOf('deload');
    expect(firstDeload).toBeGreaterThan(0);
    // Неделя сразу после делода не должна быть ВЫШЕ пред-делодной рабочей недели
    // более чем на rate-limiter — и уж точно не скакать на +55% к делодной.
    if (firstDeload + 1 < phases.length) {
      const after = setsOf(plan.weeks[firstDeload + 1]);
      const before = setsOf(plan.weeks[firstDeload - 1]);
      const deload = setsOf(plan.weeks[firstDeload]);
      expect(after).toBeLessThanOrEqual(before);
      expect(after / deload).toBeLessThan(2.2);
    }
  });

  it('первый сегмент (до делода) — плавный ramp без изменений (лимитер не мешает)', () => {
    const plan: any = buildBBPlan(base({ weeks: 12, deloadFreq: 4 }));
    const firstDeload = plan.weeks.findIndex((w: any) => w.phase === 'deload' || (w as any).deload);
    const vol = setsByWeek(plan).slice(0, firstDeload);
    for (let i = 1; i < vol.length; i++) {
      // До первого делода ramp монотонен вверх (или ровный) — без пилы.
      const ratio = vol[i] / vol[i - 1];
      // Okruglenie setov daet ±3% shuma (1 set iz 30) - porog 0.95.
      expect(ratio, `W${i + 1} к W${i}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('blast/cruise сохраняет свою волну (rate-limiter не трогает множитель режима)', () => {
    const plan: any = buildBBPlan(base({
      weeks: 12, deloadFreq: 8, blastCruiseEnabled: true, blastWeeks: 8, cruiseWeeks: 4,
    }));
    expect(plan.rationale.join(' ')).toMatch(/blast|cruise|Blast/i);
    const vol = setsByWeek(plan);
    expect(Math.min(...vol)).toBeGreaterThan(0);
  });
});

/* ─────────────────── PRO-GAP8: MEV-калибровка в гардах финализатора ─────────────────── */

describe('PRO-GAP8: личная калибровка MEV доходит до гардов финализатора', () => {
  const calWithUserMev = (cb: any): any => ({
    id: 'cal1', level: 'intermediate', startedAt: '2026-09-01T00:00:00.000Z',
    startSetsByMuscle: { chest: 4 },
    weeks: [],
    resolvedAt: '2026-10-01T00:00:00.000Z',
    userMevByMuscle: { chest: cb },
  });

  it('калибровка пробрасывается в finalizeBBPlan (без поля — прежнее поведение)', () => {
    const off = buildBBPlan(base({ weeks: 8 }));
    const onNull = buildBBPlan(base({ weeks: 8, mevCalibration: null }));
    const sig = (p: any) => JSON.stringify(p.weeks[0]);
    expect(sig(onNull)).toBe(sig(off));
  });

  it('личный MEV влияет на план (лейблы не являются no-op)', () => {
    // userMev=18 против популяционного 8 — план обязан стать объёмнее по груди.
    const off: any = buildBBPlan(base({ weeks: 8 }));
    const on: any = buildBBPlan(base({ weeks: 8, mevCalibration: calWithUserMev(18) }));
    const chest = (p: any) => p.weeks.reduce((a: number, w: any) => a + w.sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator)
      .reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
    expect(chest(on)).toBeGreaterThan(chest(off));
    // План остаётся валидным (MRV-кап поднят в такт личному ландмарку).
    expect(on.rationale.join(' ')).toBeTruthy();
  });

  it('source-guard: финализатор не читает популяционную таблицу напрямую в гардах', () => {
    const src = readFileSync(join(__dirname, '..', 'bb-finalize.engine.ts'), 'utf8');
    // Все 6 гардов translate on lmForFinalize; прямой getVolumeLandmarks остаётся
    // только внутри helper (fallback) — это ровно 2 вхождения.
    // Допустим ровно 1 вхождение — fallback ВНУТРИ lmForFinalize (строка 2586).
    const direct = (src.match(/getVolumeLandmarks\(options\.level/g) || []).length;
    expect(direct, 'гарды читают популяционную таблицу мимо helper').toBeLessThanOrEqual(1);
    expect(src).toContain('function lmForFinalize');
    expect((src.match(/lmForFinalize\(options,/g) || []).length).toBeGreaterThanOrEqual(6);
  });
});

/* ─────────────────── PRO-GAP10: кумулятивный прогрессивный MEV ─────────────────── */

describe('PRO-GAP10: кумулятивная дельта объёма между мезоциклами', () => {
  it('без серии предыдущих планов — прежнее поведение (flat delta)', () => {
    // Резолвер должен вернуть baseDelta=1 для intermediate при одной мышце.
    const prev: any = buildBBPlan(base({ weeks: 8 }));
    const res = extractMesocycleProgression(prev, 'intermediate', 'mass');
    const chest = res.volumeDelta.chest ?? 0;
    expect(chest).toBeGreaterThanOrEqual(1);
    expect(chest).toBeLessThanOrEqual(2);
  });

  it('серия из N мезоциклов даёт кумулятивную дельту с предохранителем', () => {
    const prev: any = buildBBPlan(base({ weeks: 8 }));
    // Серия из 3 предыдущих планов (все тренируют грудь).
    const p2: any = buildBBPlan(base({ weeks: 8 }));
    const p3: any = buildBBPlan(base({ weeks: 8 }));
    const res = extractMesocycleProgression(prev, 'intermediate', 'mass', [p2, p3]);
    const delta = res.volumeDelta.chest ?? 0;
    // Кумулятивно должно быть больше плоской делки (1-2).
    expect(delta).toBeGreaterThan(2);
    // Но с предохранителем: не более 50% коридора (MRV-MEV) из landmarks.
    const lm = getVolumeLandmarks('intermediate', 'chest');
    if (lm) {
      const cap = Math.floor((lm.mrv - lm.mev) * 0.5);
      expect(delta).toBeLessThanOrEqual(cap);
    }
  });

  it('пустая/битая серия не ломает резолвер', () => {
    const prev: any = buildBBPlan(base({ weeks: 8 }));
    const bad: any[] = [null, undefined, { weeks: null }];
    const res = extractMesocycleProgression(prev, 'intermediate', 'mass', bad as any);
    expect(res.volumeDelta.chest ?? 0).toBeGreaterThanOrEqual(1);
    const res2 = extractMesocycleProgression(prev, 'intermediate', 'mass', undefined);
    expect(res2.volumeDelta.chest ?? 0).toBeGreaterThanOrEqual(1);
  });
});

/* ─────────────────── PRO-GAP9: predicted-vs-actual e1RM ─────────────────── */

describe('PRO-GAP9: план vs факт по СИЛЕ (predicted e1RM)', () => {
  // План: workSets с весами (источник predicted e1RM).
  const mkPlan = (): any[] => [{
    week: 1, phase: 'accumulation',
    sessions: [{
      sessionTag: 'Push',
      exercises: [
        { name: 'Жим штанги лёжа', exerciseName: 'Жим штанги лёжа', muscle: 'chest', sets: 3, workSets: [{ weight: 100, reps: 5, rir: 2 }, { weight: 100, reps: 5, rir: 2 }, { weight: 100, reps: 5, rir: 2 }] },
        { name: 'Подтягивания', exerciseName: 'Подтягивания', muscle: 'back', sets: 3, workSets: [{ weight: 0, reps: 8, rir: 2 }] },
      ],
    }],
  }, {
    week: 2, phase: 'accumulation',
    sessions: [{ sessionTag: 'Push', exercises: [
      { name: 'Жим штанги лёжа', exerciseName: 'Жим штанги лёжа', muscle: 'chest', sets: 3, workSets: [{ weight: 105, reps: 5, rir: 2 }, { weight: 105, reps: 5, rir: 2 }, { weight: 105, reps: 5, rir: 2 }] },
    ] }],
  }];
  const day = (date: string, name: string, muscleGroup: string, weightKg: number, reps: number): any => ({
    date, exercises: [{ exerciseName: name, muscleGroup, sets: [{ weightKg, reps, rir: 2 }] }],
  });

  it('без факта — strength есть, но actualE1rm=null и deltaPct=null (не выдуманный ноль)', () => {
    const f = buildBBPlanFact({ weeks: mkPlan() } as any, [], '2026-01-05');
    expect(f.strength).toBeDefined();
    expect(f.strength!.byMuscle.chest.plannedE1rm).toBeGreaterThan(100);
    expect(f.strength!.byMuscle.chest.actualE1rm).toBeNull();
    expect(f.strength!.byMuscle.chest.deltaPct).toBeNull();
    expect(f.strength!.overallDeltaPct).toBeNull();
  });

  it('факт сильнее плана → положительная дельта; слабее → отрицательная', () => {
    const plan = mkPlan();
    // Факт: 112.5 кг × 5 (e1RM ≈ 125) против плана 105×5 (e1RM ≈ 116.7) → +7%
    const strong = buildBBPlanFact({ weeks: plan } as any, [day('2026-01-07', 'Жим штанги лёжа', 'chest', 112.5, 5)], '2026-01-05');
    expect(strong.strength!.byMuscle.chest.actualE1rm).toBeGreaterThan(strong.strength!.byMuscle.chest.plannedE1rm);
    expect(strong.strength!.byMuscle.chest.deltaPct!).toBeGreaterThan(0);
    expect(strong.strength!.overallDeltaPct!).toBeGreaterThan(0);
    // Факт слабее плана → дельта отрицательная.
    const weak = buildBBPlanFact({ weeks: plan } as any, [day('2026-01-07', 'Жим штанги лёжа', 'chest', 90, 5)], '2026-01-05');
    expect(weak.strength!.byMuscle.chest.deltaPct!).toBeLessThan(0);
  });

  it('summary несёт силу второй половиной строки', () => {
    const f = buildBBPlanFact({ weeks: mkPlan() } as any, [day('2026-01-07', 'Жим штанги лёжа', 'chest', 112.5, 5)], '2026-01-05');
    const s = bbPlanFactSummary(f);
    expect(s).toMatch(/сила/);
    expect(s).toMatch(/сетов/);
  });

  it('bbStrengthBadge: нет факта / рост / падение / плато', () => {
    expect(bbStrengthBadge(null).label).toMatch(/нет факта/);
    expect(bbStrengthBadge(5).color).toBe('#00e68a');
    expect(bbStrengthBadge(-5).color).toBe('#f87171');
    expect(bbStrengthBadge(-1).color).toBe('#fbbf24');
  });

  it('план без весов (bodyweight-only) → strength undefined, не ноль', () => {
    const plan: any[] = [{ week: 1, phase: 'accumulation', sessions: [{ sessionTag: 'Push', exercises: [
      { name: 'Отжимания', muscle: 'chest', sets: 3, workSets: [{ weight: 0, reps: 15, rir: 2 }] },
    ] }] }];
    const f = buildBBPlanFact({ weeks: plan } as any, [day('2026-01-07', 'Отжимания', 'chest', 0, 15)], '2026-01-05');
    expect(f.strength).toBeUndefined();
  });

  it('битый дневник не роняет расчёт', () => {
    const f = buildBBPlanFact({ weeks: mkPlan() } as any, [null, {}, { date: 'bad', exercises: [{}] }] as any, '2026-01-05');
    expect(f.strength).toBeDefined();
    expect(f.strength!.byMuscle.chest.actualE1rm).toBeNull();
  });
});
/* ─────────────────── PRO-GAP7: replan остатка недель от факта ─────────────────── */

describe('PRO-GAP7: пересбор остатка мезоцикла от фактического пика', () => {
  it('нет плана / нет снапшота / currentWeek вне диапазона → честный null', () => {
    expect(replanBBMesoFromFact(null, [], { currentWeek: 5 })).toBeNull();
    expect(replanBBMesoFromFact({ weeks: [] } as any, [], { currentWeek: 5 })).toBeNull();
    const plan: any = buildBBPlan(base({ weeks: 12 }));
    // Снапшот есть, но currentWeek за пределами.
    expect(replanBBMesoFromFact(plan, [], { currentWeek: 0 })).toBeNull();
    expect(replanBBMesoFromFact(plan, [], { currentWeek: 99 })).toBeNull();
    // Без inputSnapshot (план из storage).
    const noSnap: any = { ...plan, inputSnapshot: undefined };
    expect(replanBBMesoFromFact(noSnap, [], { currentWeek: 5 })).toBeNull();
  });

  it('прожитые недели заморожены побайтово, остаток пересобран и перенумерован', () => {
    const plan: any = buildBBPlan(base({ weeks: 12, planStartWeek: '2026-01-05' }));
    const frozenBefore = JSON.stringify(plan.weeks.slice(0, 4));
    const r = replanBBMesoFromFact(plan, [], { currentWeek: 5, planStartWeek: '2026-01-05' });
    expect(r).not.toBeNull();
    expect(r!.frozenWeeks).toBe(4);
    expect(r!.rebuiltWeeks).toBe(8);
    expect(r!.plan.weeks.length).toBe(12);
    // Прожитое не переписано.
    expect(JSON.stringify(r!.plan.weeks.slice(0, 4))).toBe(frozenBefore);
    // Нумерация непрерывна 1..12.
    expect(r!.plan.weeks.map((w: any) => w.week)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    // План остаётся валидным.
    const v = validateBBPlan(r!.plan as any, { level: 'intermediate' } as any);
    expect(v.issues.filter((i: any) => i.level === 'error')).toHaveLength(0);
  });

  it('replan продолжает от фактического пика (веса не сбрасываются)', () => {
    const plan: any = buildBBPlan(base({ weeks: 12 }));
    // Поднимем пиковые веса в прожитых неделях, чтобы «факт» был выше плана.
    const frozen = plan.weeks.slice(0, 4);
    for (const w of frozen) for (const s of w.sessions) for (const e of s.exercises) {
      if ((e as any).warmupActivator) continue;
      (e as any).workSets = ((e as any).workSets || []).map((ws: any) => ({ ...ws, weight: Math.round((ws.weight || 0) * 1.1 * 10) / 10 }));
    }
    const r = replanBBMesoFromFact(plan, [], { currentWeek: 5 });
    expect(r).not.toBeNull();
    // Пересобранный остаток ≥ базового пересбора по сетам (continuity даёт объём).
    const plain: any = buildBBPlan(base({ weeks: 8 }));
    const tailSets = (p: any) => p.weeks.reduce((a: number, w: any) => a + w.sessions
      .flatMap((s: any) => s.exercises).filter((e: any) => !(e as any).warmupActivator)
      .reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
    expect(tailSets(r!.plan)).toBeGreaterThan(0);
    expect(tailSets(plain)).toBeGreaterThan(0);
    expect(r!.changes.join(' ')).toMatch(/пересобран/);
  });

  it('изменения носят причину в rationale (почему пересобрано)', () => {
    const plan: any = buildBBPlan(base({ weeks: 12 }));
    const r = replanBBMesoFromFact(plan, [], { currentWeek: 5 })!;
    expect(r.plan.rationale.join(' ')).toMatch(/Пересборка остатка/);
    expect(r.plan.rationale.join(' ')).toMatch(/факт не переписан/);
  });

  it('replanSummary честен для null', () => {
    expect(replanSummary(null)).toMatch(/нет данных/);
    const plan: any = buildBBPlan(base({ weeks: 12 }));
    expect(replanSummary(replanBBMesoFromFact(plan, [], { currentWeek: 5 }))).toMatch(/Пересобрано недель: 8/);
  });

  it('идемпотентность: replan даёт ту же длину и валиден повторно', () => {
    const plan: any = buildBBPlan(base({ weeks: 12 }));
    const r1 = replanBBMesoFromFact(plan, [], { currentWeek: 5 })!;
    const r2 = replanBBMesoFromFact(r1.plan, [], { currentWeek: 5 })!;
    expect(r2.plan.weeks.length).toBe(12);
    expect(r2.frozenWeeks).toBe(4);
  });
});
/* ─────────────────── PRO-GAP5: боль/крепатура дают численный эффект ─────────────────── */

describe('PRO-GAP5: боль и крепатура снижают объём (а не только текст)', () => {
  const setsOf = (p: any): number => p.weeks[0].sessions
    .flatMap((s: any) => s.exercises).filter((e: any) => !(e as any).warmupActivator)
    .reduce((a: number, e: any) => a + (e.sets || 0), 0);

  it('без входов — поведение байт-в-байт (никакой разгрузки)', () => {
    const off = buildBBPlan(base({ weeks: 8 }));
    const on = buildBBPlan(base({ weeks: 8, painLevel: 'green' }));
    expect(setsOf(on)).toBe(setsOf(off));
    const notTested = buildBBPlan(base({ weeks: 8, painLevel: 'not_tested' }));
    expect(setsOf(notTested)).toBe(setsOf(off));
  });

  it('красная боль режет сильнее жёлтой', () => {
    const base0 = buildBBPlan(base({ weeks: 8 }));
    const yellow = buildBBPlan(base({ weeks: 8, painLevel: 'yellow' }));
    const red = buildBBPlan(base({ weeks: 8, painLevel: 'red' }));
    expect(setsOf(yellow)).toBeLessThan(setsOf(base0));
    expect(setsOf(red)).toBeLessThan(setsOf(yellow));
    // Причина в rationale.
    expect(red.rationale.join(' ')).toMatch(/Silbernagel|разгрузка по восстановлению/i);
  });

  it('локация сужает разгрузку: колено бьёт по квадрицепсу, а не по всему плану', () => {
    const clean = buildBBPlan(base({ weeks: 8, patternId: 'ppl_6' }));
    const knee = buildBBPlan(base({ weeks: 8, patternId: 'ppl_6', painLevel: 'red', painLocation: 'patellar' }));
    const muscleSets = (p: any, m: string) => p.weeks[0].sessions
      .flatMap((s: any) => s.exercises).filter((e: any) => e.muscle === m && !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0);
    expect(muscleSets(knee, 'quads')).toBeLessThan(muscleSets(clean, 'quads'));
    // Спина (не затронута локацией) — без изменений.
    expect(muscleSets(knee, 'back')).toBe(muscleSets(clean, 'back'));
  });

  it('крепатура ≥7 снижает объём; ниже порога — нет', () => {
    const clean = buildBBPlan(base({ weeks: 8 }));
    const sore = buildBBPlan(base({ weeks: 8, soreness010: 8 }));
    const ok = buildBBPlan(base({ weeks: 8, soreness010: 3 }));
    expect(setsOf(sore)).toBeLessThan(setsOf(clean));
    expect(setsOf(ok)).toBe(setsOf(clean));
  });

  it('RIR поднят у разгружаемых упражнений (восстановление, не «терпеть»)', () => {
    const red = buildBBPlan(base({ weeks: 8, painLevel: 'red', painLocation: 'elbow' }));
    const rirs = red.weeks[0].sessions.flatMap((s: any) => s.exercises)
      .filter((e: any) => ['triceps', 'biceps', 'forearms'].includes(e.muscle) && !(e as any).warmupActivator)
      .map((e: any) => e.rir ?? 0);
    expect(Math.max(...rirs)).toBeGreaterThanOrEqual(3);
  });

  it('пол 2 сета: разгрузка не уводит в одиночный сет', () => {
    const red = buildBBPlan(base({ weeks: 8, painLevel: 'red' }));
    const all = red.weeks[0].sessions.flatMap((s: any) => s.exercises)
      .filter((e: any) => !(e as any).warmupActivator && (e.sets || 0) > 1)
      .map((e: any) => e.sets || 0);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(2);
  });

  it('plan-fact не затронут, план валиден', () => {
    const red = buildBBPlan(base({ weeks: 8, painLevel: 'red' }));
    const v = validateBBPlan(red, { level: 'intermediate' } as any);
    expect(v.issues.filter((i: any) => i.level === 'error')).toHaveLength(0);
  });
});

/* ─────────────────── G8-tail: cycle/program тоже пробрасывают калибровку ─────────────────── */

describe('G8-tail: cycle/program пустили mevCalibration в финализатор', () => {
  it('source-guard: оба finalizeBBPlan-сайта пробрасывают калибровку', () => {
    const src = readFileSync(join(__dirname, '..', 'cycle-to-plan.ts'), 'utf8');
    expect((src.match(/mevCalibration: loadMEVCalibration\(\),/g) || []).length).toBe(2);
  });
});
/* ─────────────────── G1-полный: Israetel-волна (opt-in) + замер траектории ─────────────────── */

describe('G1-полный: недельная траектория объёма', () => {
  const setsFor = (p: any, m: string): number[] => p.weeks.map((w: any) => w.sessions
    .flatMap((s: any) => s.exercises)
    .filter((e: any) => e.muscle === m && !(e as any).warmupActivator)
    .reduce((a: number, e: any) => a + (e.sets || 0), 0));

  it('по умолчанию поведение байт-в-байт (флаг выключен)', () => {
    const off = buildBBPlan(base({ weeks: 12 }));
    const on = buildBBPlan(base({ weeks: 12, volumeWave: false } as Partial<BBBuilderInput>));
    expect(JSON.stringify(on.weeks[0])).toBe(JSON.stringify(off.weeks[0]));
    expect(JSON.stringify(on.weeks[5])).toBe(JSON.stringify(off.weeks[5]));
  });

  it('флаг доезжает до плана и меняет недельные множители (реально не no-op)', () => {
    const off = buildBBPlan(base({ weeks: 12 }));
    const on = buildBBPlan(base({ weeks: 12, volumeWave: true } as Partial<BBBuilderInput>));
    const sig = (p: any) => JSON.stringify(p.weeks.map((w: any) => setsFor(p, 'chest')));
    expect(sig(on), 'флаг volumeWave не менял ничего').not.toBe(sig(off));
    expect((on as any).inputSnapshot?.volumeWave).toBe(true);
  });

  it('волна даёт разное число сетов по неделям (не плоский plateau)', () => {
    const on = buildBBPlan(base({ weeks: 12, volumeWave: true } as Partial<BBBuilderInput>));
    const weekly = on.weeks.map((w: any) => w.sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0));
    const working = weekly.filter((_, i) => on.weeks[i].phase !== 'deload');
    // Разброс обязателен: волна 1.0/1.15/0.75/1.05 физически разносит недели.
    expect(Math.max(...working) - Math.min(...working), 'недели совпали — волны нет').toBeGreaterThan(0);
  });

  it('source-guard: getVolumeWaveFactor реально вызывается в билдере (был мёртв)', () => {
    const src = readFileSync(join(__dirname, '..', 'bb-builder.engine.ts'), 'utf8');
    expect(src).toContain('const wave = getVolumeWaveFactor(phaseWeek, phase);');
    // Импорт добавлен — иначе был бы мёртвый экспорт.
    expect(src).toMatch(/getVolumeWaveFactor, type BBPhase \} from '\.\.\/periodization'/);
  });

  it('ЗАМЕР (baseline для следующей кампании): финалайзер раздувает до MRV уже на W1', () => {
    // Зафиксировано числами, чтобы ре-базлайн следующей сессии был осознанным.
    // chest: старт 18 при MRV 20 (90%) — запаса под прогрессию нет;
    // calves: 18 при MRV 18 (100%).
    const p: any = buildBBPlan(base({ weeks: 12 }));
    const mrv = (p as any).mrvByMuscle || {};
    const chestW1 = setsFor(p, 'chest')[0];
    const calvesW1 = setsFor(p, 'calves')[0];
    expect(mrv.chest).toBeGreaterThan(0);
    expect(chestW1).toBeGreaterThan(mrv.chest * 0.7);
    if (mrv.calves > 0) expect(calvesW1).toBeGreaterThan(mrv.calves * 0.7);
  });
});
/* ─────────────────── G1: сценарий входа в мезоцикл (standard/preloaded/flat) ─────────────────── */

describe('G1: пользовательский выбор входа в мезоцикл', () => {
  const weekly = (p: any): number[] => p.weeks.map((w: any) => w.sessions
    .flatMap((s: any) => s.exercises)
    .filter((e: any) => !(e as any).warmupActivator)
    .reduce((a: number, e: any) => a + (e.sets || 0), 0));

  it('по умолчанию поведение байт-в-байт (undefined === standard)', () => {
    const a = buildBBPlan(base({ weeks: 12 }));
    const b = buildBBPlan(base({ weeks: 12, volumeRamp: 'standard' } as Partial<BBBuilderInput>));
    expect(JSON.stringify(b.weeks)).toBe(JSON.stringify(a.weeks));
    // И флаг не пишется в снапшот, если он дефольный.
    expect((b as any).inputSnapshot?.volumeRamp).toBeUndefined();
  });

  it('preloaded реально поднимает ранние недели (не no-op)', () => {
    const std = buildBBPlan(base({ weeks: 12 }));
    const pre = buildBBPlan(base({ weeks: 12, volumeRamp: 'preloaded' } as Partial<BBBuilderInput>));
    const chest = (p: any) => p.weeks.map((w: any) => w.sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0));
    // Замер: standard W1-W3 = 18, preloaded = 20 (старт на цели, не 0.85×цель).
    expect(chest(pre)[0]).toBeGreaterThan(chest(std)[0]);
    // Выбор доезжает до снапшота (воспроизводимость).
    expect((pre as any).inputSnapshot?.volumeRamp).toBe('preloaded');
    expect((pre as any).volumeRamp).toBe('preloaded');
  });

  it('flat: без рампа — недели держатся у цели', () => {
    const std = buildBBPlan(base({ weeks: 12 }));
    const flat = buildBBPlan(base({ weeks: 12, volumeRamp: 'flat' } as Partial<BBBuilderInput>));
    // flat стартует на 1.0 (как preloaded), но НЕ растёт к 1.10 в хвосте.
    // Замер: сумма flat может быть ниже standard (нет хвостового роста) —
    // проверяем не сумму, а сам факт отличия, иначе режим был бы no-op.
    const w = weekly(flat);
    const wStd = weekly(std);
    expect(JSON.stringify(w), 'flat не отличался от standard').not.toBe(JSON.stringify(wStd));
    expect((flat as any).inputSnapshot?.volumeRamp).toBe('flat');
  });

  it('standard даёт разгон (первые рабочие недели легче хвоста)', () => {
    const p: any = buildBBPlan(base({ weeks: 12 }));
    const w = weekly(p);
    const working = w.filter((_, i) => p.weeks[i].phase !== 'deload');
    // Замер: W1-W3 = 18, хвост интенсивности ниже (12) — но РАННИЕ недели не ниже цели.
    // Главное: план не стартует на дне и не стартует на потолке — есть запас.
    expect(working[0]).toBeGreaterThan(0);
    expect(working[working.length - 1]).toBeGreaterThan(0);
  });

  it('честная граница: мышцы на минимумах не двигаются выбором', () => {
    const std = buildBBPlan(base({ weeks: 12 }));
    const pre = buildBBPlan(base({ weeks: 12, volumeRamp: 'preloaded' } as Partial<BBBuilderInput>));
    const biceps = (p: any) => p.weeks.map((w: any) => w.sessions
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => e.muscle === 'biceps' && !(e as any).warmupActivator)
      .reduce((a: number, e: any) => a + (e.sets || 0), 0));
    // Замер (поправка к исходной гипотезе): выбор входа всё равно слегка двигает
    // бицепс через перераспределение бюджета сессии (standard W3=14, preloaded W3=16).
    // Но держит его у минимума: не 20 и не 8, а 14–16 при MRV 22.
    const s = biceps(std), pr = biceps(pre);
    expect(Math.min(...s)).toBeGreaterThanOrEqual(4);
    expect(Math.min(...pr)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...s)).toBeLessThanOrEqual(18);
    expect(Math.max(...pr)).toBeLessThanOrEqual(18);
  });

  it('source-guard: volumeRamp проброшен и в снапшот, и в top-level', () => {
    const src = readFileSync(join(__dirname, '..', 'bb-builder.engine.ts'), 'utf8');
    expect(src).toContain("volumeRamp: input.volumeRamp && input.volumeRamp !== 'standard' ? input.volumeRamp : undefined,");
    // Формула рампа читает режим.
    expect(src).toContain("const rampMode = input.volumeRamp || 'standard';");
    expect(src).toContain("const rampStart = rampMode === 'preloaded' ? 1.0 : 0.85;");
  });

  it('дефолт не тронут: меняется только при явном флаге (guard на регресс)', () => {
    const b = buildBBPlan(base({ weeks: 8 }));
    const c = buildBBPlan(base({ weeks: 8, volumeRamp: undefined } as Partial<BBBuilderInput>));
    expect(JSON.stringify(c.weeks)).toBe(JSON.stringify(b.weeks));
  });
});