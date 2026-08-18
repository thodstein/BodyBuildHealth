/**
 * planner-bridge-handlers.ts — P0-3: dispatch table for applyBridgePayload.
 *
 * Each handler is a standalone function that processes one PlannerApplyKind.
 * Extracted from ProgramEditorView.tsx to eliminate the 14-branch if/else chain.
 */
import type { PlannerApply } from './planner-bridge';
import type { UserProgram, UserWeek, UserBlock, PLProgramBody, PLExercise, PLSet } from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import type { TrainingProfile } from './training-profile';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';
import { cloneFromCycle, cloneFromLibrary, createBlank } from '../../../engines/user-program/program-store';
import { cycleTemplateToFullProgram } from '../../../engines/bb/cycle-to-plan';
import { designerToUserWeeks, applyDesignPhasesToWeeks, linkDesignToProgram } from '../../../engines/periodization/designer-to-program';
import { macrocycleToBBProgram } from '../../../engines/lms/macrocycle-to-bb';
import type { MacrocycleDesign } from '../../../engines/periodization-designer.engine';
import type { Macrocycle } from '../../../engines/lms/macrocycle.engine';
import { DESIGNER_PHASE_VISUAL } from './phase-visual-tokens';
import { clampRir } from '../../../engines/bb/bb-utils';
import { diagnoseWeakPoint, type Lift, type WeakPoint } from '../../../engines/lms/weakpoint-pl';
import {
  importProgramIntoAnnualBlock,
} from '../../../engines/annual-training/block-builders.engine';
import type { AnnualTrainingPlan } from '../../../engines/annual-training/annual-training.types';
import {
  loadAnnualTrainingPlan, saveAnnualTrainingPlan,
} from '../../../engines/annual-training/annual-training-storage';
import {
  loadCardioCycles, loadActiveCardioCycle, cardioToNutritionPayload,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog } from '../../../engines/lms/cardio-diary.engine';

export interface BridgeCtx {
  program: UserProgram;
  dir: string;
  update: (patch: Partial<UserProgram>) => void;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
  tprofile: TrainingProfile;
  recovery?: {
    bodyFat?: number;
    leanMass?: number;
    hrvMs?: number;
    sleepHours?: number;
    stressLevel?: number;
    labMrvMultiplier?: number;
  };
}

type Handler = (payload: PlannerApply, ctx: BridgeCtx) => void;

const splitHandler: Handler = (payload, { program: p, dir, update, showToast }) => {
  if (dir !== 'bb' || !p.bb) return;
  const cycle: string[][] = payload.data.cycle ?? [];
  const weeks: UserWeek[] = Array.from({ length: Math.max(1, p.meta.weeks || 4) }, (_, wi) => ({
    week: wi + 1, phase: 'accumulation' as const, deload: false,
    sessions: cycle.map((groups, si) => ({
      id: newId('ses'), name: (payload.data.name ?? 'День') + ' ' + (si + 1), focus: groups.join('/'),
      blocks: groups.map((g) => ({ id: newId('blk'), type: 'compound' as const, exerciseName: '', muscle: g, role: 'primary' as const, sets: [{ reps: 8, rir: 2, weight: 0, restSec: 120 }] })),
    })),
  }));
  update({ bb: { ...p.bb, microcycleTemplate: { daySlots: [] }, weeks } });
  showToast('🔗 Сплит применён: ' + payload.label);
  return undefined;
};

const priHandler: Handler = (payload, { program: p, update, showToast }) => {
  const mult = Math.max(0.25, Math.min(2, Number(payload.data.volumeMult ?? 1) || 1));
  const rirShift: number = payload.data.rirShift ?? 0;
  if (p.bb) {
    const weeks = p.bb.weeks.map(w => ({
      ...w,
      sessions: w.sessions.map(s => ({
        ...s,
        blocks: s.blocks.map(b => {
          const sourceSets = b.sets ?? [];
          const targetCount = Math.max(1, Math.round(sourceSets.length * mult));
          const sets = Array.from({ length: targetCount }, (_, index) => {
            const source = sourceSets[index % Math.max(1, sourceSets.length)] ?? { reps: 8, rir: 2, weight: 0, restSec: 90 };
            return { ...source, rir: clampRir((source.rir ?? 2) + rirShift) };
          });
          return { ...b, sets };
        }),
      })),
    }));
    update({ bb: { ...p.bb, weeks } });
  }
  showToast('🔗 Готовность применена: ' + payload.label);
};

/** ПЛ-упражнение каталога СРЦ → lift ручной программы (custom PL). */
function plLiftOf(exerciseName: string, fallback: 'accessory'): PLExercise['lift'] {
  const n = exerciseName.toLowerCase();
  if (/присед|squat/.test(n)) return 'squat';
  if (/жим/.test(n) && !/стоя|наклон/.test(n)) return 'bench';
  if (/станов|тяга|deadlift/.test(n)) return 'dead';
  return fallback;
}

/**
 * Добавление диагностических ассистентов в custom-ПЛ программу (D1):
 *  - диагностические упражнения карточки (diagnosticExerciseMap) — в указанные
 *    дни (diagnosticDayMap) или в первый день недели 1, по 1 упражнению на день;
 *  - слабые точки СРЦ (plWeakPoints) — тяжёлый 3×8 (pct из diagnoseWeakPoint)
 *    + памп 3×12 @60% по тому же принципу, что SRCBBScreen.
 * Программы из каталога циклов (sourceCycleId без customWeeks) не конвертируются —
 * возвращается null, ассерсты копируются только в custom-программы.
 */
function appendDiagnosticsToPL(
  pl: PLProgramBody,
  plWeakPoints: { lift: string; weakPoint: string; days?: number[] }[],
  diagnosticExerciseMap: Record<string, string[]>,
  diagnosticDayMap: Record<string, number[]>,
): PLProgramBody | null {
  const diagNames = Object.values(diagnosticExerciseMap ?? {}).flatMap(list =>
    Array.isArray(list) ? list.filter((n): n is string => typeof n === 'string') : []);
  const wpPairs = (plWeakPoints ?? []).filter(x => x && typeof x.lift === 'string' && typeof x.weakPoint === 'string');
  if (diagNames.length === 0 && wpPairs.length === 0) return null;
  if (!pl.customWeeks || pl.customWeeks.length === 0) return null;

  const weeks = pl.customWeeks.map(w => ({ ...w, days: w.days.map(d => ({ ...d, exercises: [...d.exercises] })) }));
  const firstWeek = weeks[0];
  const dayCount = firstWeek.days.length;
  if (dayCount === 0) return null;
  const dayOf = (idx: number | undefined): number => {
    const i = typeof idx === 'number' && Number.isFinite(idx) ? idx - 1 : 0;
    if (i < 0 || i >= dayCount) return 0;
    return i;
  };
  const pushExercise = (dayIdx: number, name: string, sets: PLSet[], muscle: string) => {
    const target = weeks[0].days[dayIdx];
    if (!target) return;
    if (target.exercises.some(e => e.name.toLowerCase() === name.toLowerCase())) return;
    target.exercises.push({ name, lift: plLiftOf(name, 'accessory'), muscle, sets });
  };

  // Диагностические упражнения: per-key списки, дни из diagnosticDayMap (1-based), циклом.
  for (const [key, list] of Object.entries(diagnosticExerciseMap ?? {})) {
    const names = Array.isArray(list) ? list.filter((n): n is string => typeof n === 'string') : [];
    const configuredDays = (diagnosticDayMap?.[key] ?? []).filter((d): d is number => typeof d === 'number');
    names.forEach((name, index) => {
      const dayIdx = configuredDays.length > 0 ? dayOf(configuredDays[index % configuredDays.length]) : dayOf(undefined);
      pushExercise(dayIdx, name, [{ pct: 0.6, reps: 10, sets: 3, rir: 2 }], 'accessory');
    });
  }

  // Слабые точки СРЦ: тяжёлый + памп-вариант (как в SRCBSScreen).
  for (const wp of wpPairs) {
    const diag = diagnoseWeakPoint(wp.lift as Lift, wp.weakPoint as WeakPoint);
    const muscle = LIFT_GROUP_RU[wp.lift as Lift] ?? 'accessory';
    const names = diag.assistance.slice(0, 2);
    if (names.length === 0) continue;
    const days = (wp.days ?? []).filter((d): d is number => typeof d === 'number');
    pushExercise(days.length > 0 ? dayOf(days[0]) : dayOf(undefined), names[0], [{ pct: diag.intensityPct, reps: 8, sets: 3, rir: 2 }], muscle);
    if (names[1]) {
      pushExercise(days.length > 1 ? dayOf(days[1]) : dayOf(undefined), names[1], [{ pct: 0.6, reps: 12, sets: 3, rir: 3 }], muscle);
    }
  }

  return { ...pl, customWeeks: weeks };
}

const LIFT_GROUP_RU: Partial<Record<Lift, string>> = {
  bench: 'chest', squat: 'legs', deadlift: 'back', ohp: 'shoulders', row: 'back', pulldown: 'back', incline_press: 'chest',
};

const weakpointsHandler: Handler = (payload, { program: p, onChange, showToast, tprofile }) => {
  const groups: string[] = payload.data.groups ?? [];
  const plWeakPoints: { lift: string; weakPoint: string; days?: number[] }[] = Array.isArray(payload.data.plWeakPoints) ? payload.data.plWeakPoints : [];
  const diagnosticExerciseMap: Record<string, string[]> = payload.data.diagnosticExerciseMap ?? {};
  const diagnosticDayMap: Record<string, number[]> = payload.data.diagnosticDayMap ?? {};
  const hasDiagnostics = plWeakPoints.length > 0 || Object.keys(diagnosticExerciseMap).length > 0;
  let next = { ...p };
  if (p.bb) next = { ...next, bb: { ...p.bb, constraints: { ...(p.bb.constraints ?? { equipment: [] }) } } };
  let skippedDiagnostics = false;
  if (p.pl) {
    const plBody: PLProgramBody = { ...p.pl, weakPoints: groups };
    next = { ...next, pl: plBody };
    if (hasDiagnostics) {
      const extended = appendDiagnosticsToPL(plBody, plWeakPoints, diagnosticExerciseMap, diagnosticDayMap);
      if (extended) next = { ...next, pl: extended };
      else skippedDiagnostics = true;
    }
  }
  onChange(next);
  saveTrainingProfile({ ...tprofile, weakPoints: groups });
  showToast('🔗 Слабые группы: ' + (groups.join(', ') || 'нет') + (skippedDiagnostics ? ' · диагностические упражнения пропущены (программа из каталога циклов, не custom)' : ''));
};

const pmHandler: Handler = (payload, { program: p, onChange, showToast }) => {
  const d = payload.data ?? {};
  const prof = loadTrainingProfile();
  const pmPatch: Partial<TrainingProfile> = {};
  if (typeof d.squat === 'number') pmPatch.pmSquat = d.squat;
  if (typeof d.bench === 'number') pmPatch.pmBench = d.bench;
  if (typeof d.dead === 'number') pmPatch.pmDead = d.dead;
  if (typeof d.value === 'number' && typeof d.lift === 'string') {
    if (d.lift === 'squat') pmPatch.pmSquat = d.value;
    else if (d.lift === 'bench') pmPatch.pmBench = d.value;
    else if (d.lift === 'dead') pmPatch.pmDead = d.value;
  }
  saveTrainingProfile({ ...prof, ...pmPatch });
  if (p.pl) onChange({ ...p, pl: { ...p.pl, workMax: { squat: pmPatch.pmSquat ?? p.pl.workMax.squat, bench: pmPatch.pmBench ?? p.pl.workMax.bench, dead: pmPatch.pmDead ?? p.pl.workMax.dead } } });
  showToast('🔗 ПМ применён: ' + payload.label);
};

const tempoHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  const notation = payload.data.label ?? [payload.data.eccentric, payload.data.bottomPause, payload.data.concentric, payload.data.topPause].join('-');
  const weeks = p.bb.weeks.map((w) => ({ ...w, sessions: w.sessions.map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b, sets: (b.sets ?? []).map((st) => ({ ...st, tempo: notation })) })) })) }));
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 Темп применён: ' + payload.label);
};

const rirHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  const rirShift: number = payload.data.rirShift ?? 0;
  const weeks = p.bb.weeks.map((w) => ({ ...w, sessions: w.sessions.map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b, sets: (b.sets ?? []).map((st) => ({ ...st, rir: clampRir((st.rir ?? 2) + rirShift) })) })) })) }));
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 RIR-сдвиг: ' + payload.label);
};

const mrvHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) {
    showToast('🔗 MRV рекомендация: ' + payload.label + ' (доступно только для ББ)');
    return;
  }
  const rawTarget = Math.round(Number(payload.data.mrv) || 0);
  if (rawTarget <= 0) {
    showToast('⚠ MRV должен быть положительным числом');
    return;
  }
  const target = Math.min(60, rawTarget);
  const weeks = p.bb.weeks.map(week => {
    if (week.deload) return week;
    const byMuscle: Record<string, number> = {};
    for (const session of week.sessions) for (const block of session.blocks) {
      byMuscle[block.muscle] = (byMuscle[block.muscle] ?? 0) + block.sets.length;
    }
    const factorByMuscle: Record<string, number> = {};
    for (const [muscle, current] of Object.entries(byMuscle)) factorByMuscle[muscle] = current > 0 ? Math.min(1, target / current) : 1;
    return { ...week, sessions: week.sessions.map(session => ({ ...session, blocks: session.blocks.map(block => {
      const factor = factorByMuscle[block.muscle] ?? 1;
      const count = Math.max(1, Math.min(block.sets.length, Math.round(block.sets.length * factor)));
      // P0: защита от factor < 1/block.sets.length → count = 0
      const safeCount = Math.max(1, count);
      return { ...block, sets: block.sets.slice(0, safeCount) };
    }) })) };
  });
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 MRV применён: ' + target + ' сет/мышцу/нед');
};

const deloadHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  const deloadWeeks: number[] = payload.data.weeks ?? [];
  const weeks = p.bb.weeks.map(w => {
    if (!deloadWeeks.includes(w.week)) return w;
    return {
      ...w,
      phase: 'deload' as const,
      deload: true,
      sessions: w.sessions.map(s => ({
        ...s,
        blocks: s.blocks.map(b => {
          const sourceSets = b.sets ?? [];
          const count = Math.max(1, Math.ceil(sourceSets.length * 0.6));
          return {
            ...b,
            sets: Array.from({ length: count }, (_, index) => {
              const st = sourceSets[index] ?? sourceSets[sourceSets.length - 1] ?? { reps: 8, rir: 2, weight: 0, restSec: 90 };
              return { ...st, rir: 4, weight: st.weight ? Math.round(st.weight * 0.6) : st.weight };
            }),
          };
        }),
      })),
    };
  });
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 Делод-недели: ' + payload.label);
};

const volumeHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  const setsByMuscle: Record<string, number> = payload.data.sets ?? {};
  // P0: распределяем объём по всем сессиям дня, а не только по sessionIndex === 0
  const weeks = p.bb.weeks.map((w) => {
    if (w.deload) return w;
    const sessionCount = w.sessions.length;
    const sessions = w.sessions.map((s, sessionIndex) => {
      const blocks: UserBlock[] = [];
      for (const [mu, rawCount] of Object.entries(setsByMuscle)) {
        const count = Math.max(0, Math.min(10, Math.round(Number(rawCount) || 0)));
        if (count === 0) continue;
        // Распределяем ровно count сетов между сессиями.
        const perSession = Math.floor(count / sessionCount);
        const remainder = count % sessionCount;
        const sessionSets = perSession + (sessionIndex < remainder ? 1 : 0);
        if (sessionSets > 0) {
          blocks.push({ id: newId('blk'), type: 'accessory' as const, exerciseName: '', muscle: mu, role: 'accessory' as const,
            sets: Array.from({ length: sessionSets }, () => ({ reps: 10, rir: 2, weight: 0, restSec: 90 })) });
        }
      }
      return { ...s, blocks: [...s.blocks, ...blocks] };
    });
    return { ...w, sessions };
  });
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 Объём применён: ' + payload.label);
};

const peakHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  // volumeMult — множитель объёма (сокращение сетов), rirTarget — целевой RIR для пиковой недели
  const volumeMult: number = Math.max(0.25, Math.min(1, Number(payload.data.volumeMult ?? 0.5)));
  const rirTarget: number = Math.max(0, Math.min(5, Number(payload.data.rirTarget ?? 2)));
  const weeks = p.bb.weeks.map((w, wi) => wi === p.bb!.weeks.length - 1
    ? {
        ...w,
        phase: 'peaking' as const,
        sessions: w.sessions.map((s) => ({
          ...s,
          blocks: s.blocks.map((b) => {
            const count = Math.max(1, Math.round((b.sets ?? []).length * volumeMult));
            return {
              ...b,
              sets: Array.from({ length: count }, (_, i) => {
                const src = (b.sets ?? [])[i] ?? { reps: 5, rir: 2, weight: 0, restSec: 90 };
                return { ...src, rir: rirTarget };
              }),
            };
          }),
        })),
      }
    : w);
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 Пиковая неделя: ' + payload.label);
};

const methodologyHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  const prog = { ...(p.bb.progression ?? { loadStrategy: 'double_progression' as const, deloadProtocol: 'pump', intensityTechniques: ['none'] }), loadStrategy: String(payload.data.methodName ?? 'double_progression') as import('../../../engines/user-program/user-program.types').LoadStrategy };
  update({ bb: { ...p.bb, progression: prog } });
  showToast('🔗 Методика: ' + payload.label);
};

const programHandler: Handler = (payload, { onChange, showToast }) => {
  try {
    // Готовая UserProgram из «Сборки цикла» Годового планировщика.
    const direct = payload.data.program as UserProgram | undefined;
    if (direct && direct.meta && (direct.bb || direct.pl)) {
      onChange(direct);
      showToast('🔗 Собранный цикл загружен: ' + payload.label);
      return;
    }
    const cycleId = payload.data.id ?? payload.data.meta?.id;
    let cloned: UserProgram | null = null;
    if (cycleId && typeof cycleId === 'string') {
      cloned = cloneFromCycle(cycleId);
    }
    if (!cloned && payload.data.meta) {
      const fullProg = cycleTemplateToFullProgram(payload.data);
      if (fullProg) cloned = cloneFromLibrary(fullProg);
    }
    if (cloned) { onChange(cloned); showToast('🔗 Программа загружена: ' + payload.label); }
    else { showToast('⚠ Программа не найдена: ' + payload.label); }
  } catch { showToast('⚠ Не удалось загрузить программу: ' + payload.label); }
};

const designHandler: Handler = (payload, { program: p, dir, update, onChange, showToast, tprofile }) => {
  if (!payload.data?.design) return;
  try {
    const design = payload.data.design as MacrocycleDesign;
    const fillExercises: boolean = !!payload.data.fillExercises;
    const daysPerWeek: number = payload.data.daysPerWeek ?? 4;
    if (dir === 'bb' && p.bb) {
      const existingWeeks = p.bb.weeks;
      const remapped = applyDesignPhasesToWeeks(existingWeeks, design);
      const linked = linkDesignToProgram(p, design);
      update({ bb: { ...p.bb, weeks: remapped }, meta: linked.meta });
      // MC-10 FIX: detailed toast with stats
      const phaseCounts = design.blocks.reduce((acc, b) => { acc[b.phaseKey] = (acc[b.phaseKey] || 0) + 1; return acc; }, {} as Record<string, number>);
      const phaseSummary = Object.entries(phaseCounts).map(([phase, count]) => `${DESIGNER_PHASE_VISUAL[phase as keyof typeof DESIGNER_PHASE_VISUAL]?.label || phase}: ${count}`).join(', ');
      showToast(`🔗 Фазы дизайнера применены: ${design.totalWeeks} нед, ${design.blocks.length} блоков (${phaseSummary}) · 🎨 привязан`);
    } else {
      const weeks = designerToUserWeeks(design, {
        fillExercises,
        level: p.meta.level,
        goal: p.meta.goal,
        daysPerWeek,
        equipment: p.bb?.constraints?.equipment ?? [],
        weakPoints: (tprofile.weakPoints ?? []) as string[],
      });
      // MC-7 FIX: Handle empty weeks or null fallback
      if (!weeks || weeks.length === 0) {
        showToast('⚠ Ошибка: не удалось создать недели из дизайна. Проверьте параметры дизайна.');
        return;
      }
      const blank = createBlank('bb');
      const newProg: UserProgram = {
        ...blank,
        meta: { ...blank.meta, title: design.name + ' (дизайн)', weeks: design.totalWeeks, goal: design.sport === 'powerlifting' ? 'powerlifting' : 'hypertrophy' },
        bb: { ...blank.bb!, weeks },
      };
      onChange(linkDesignToProgram(newProg, design));
      // MC-10 FIX: detailed toast with stats
      const phaseCounts = design.blocks.reduce((acc, b) => { acc[b.phaseKey] = (acc[b.phaseKey] || 0) + 1; return acc; }, {} as Record<string, number>);
      const phaseSummary = Object.entries(phaseCounts).map(([phase, count]) => `${DESIGNER_PHASE_VISUAL[phase as keyof typeof DESIGNER_PHASE_VISUAL]?.label || phase}: ${count}`).join(', ');
      showToast(`🔗 Дизайн применён как новая программа: ${design.totalWeeks} нед, ${design.blocks.length} блоков (${phaseSummary})${fillExercises ? ' + упражнения' : ''}`);
    }
  } catch (e) { showToast('⚠ Не удалось применить дизайн: ' + (e as Error)?.message); }
};

const macrocycleHandler: Handler = (payload, { program: p, onChange, showToast, tprofile, recovery }) => {
  if (!payload.data?.macro) return;
  try {
    const macro = payload.data.macro as Macrocycle;
    const newProg = macrocycleToBBProgram(macro, {
      level: payload.data.level ?? p.meta.level,
      goal: payload.data.goal ?? p.meta.goal,
      daysPerWeek: payload.data.daysPerWeek ?? p.meta.daysPerWeek,
      weakPoints: (tprofile.weakPoints ?? []) as string[],
      equipment: p.bb?.constraints?.equipment ?? [],
      trainingFocus: p.meta.trainingFocus,
      bodyFat: recovery?.bodyFat,
      leanMass: recovery?.leanMass,
      hrvMs: recovery?.hrvMs,
      sleepHours: recovery?.sleepHours,
      stressLevel: recovery?.stressLevel,
      labMrvMultiplier: recovery?.labMrvMultiplier,
    });
    onChange(newProg);
    showToast('🔗 Макроцикл применён как ББ-программа: ' + payload.label);
  } catch (e) { showToast('⚠ Не удалось применить макроцикл: ' + (e as Error)?.message); }
};

/* ─── Годовой план: блок → ручной редактор (и обратно при сохранении) ─────── */

export const ANNUAL_BLOCK_PENDING_KEY = 'he_annual_block_pending';

/** Открытая ссылка «блок годового плана ↔ редактируемая программа». */
export function getPendingAnnualBlock(): { blockKey: string; ts: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(ANNUAL_BLOCK_PENDING_KEY) || 'null');
    return v && typeof v.blockKey === 'string' ? v : null;
  } catch { return null; }
}

export function clearPendingAnnualBlock(): void {
  try { localStorage.removeItem(ANNUAL_BLOCK_PENDING_KEY); } catch { /* ignore */ }
}

/**
 * Завершить импорт: отредактированная программа возвращается в блок годового
 * плана (updateAnnualBlockWeeks — блок 'built', не stale). Вызывается при
 * сохранении программы в ручном конструкторе.
 */
export function completeAnnualBlockImport(program: UserProgram): boolean {
  const pending = getPendingAnnualBlock();
  if (!pending) return false;
  try {
    const plan: AnnualTrainingPlan | null = loadAnnualTrainingPlan();
    if (plan) {
      const next = importProgramIntoAnnualBlock(plan, pending.blockKey, program);
      saveAnnualTrainingPlan(next);
      window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated', {
        detail: { planId: next.id, blockKey: pending.blockKey, status: next.status },
      }));
    }
  } finally {
    clearPendingAnnualBlock();
  }
  return true;
}

const annualBlockHandler: Handler = (payload, { onChange, showToast }) => {
  if (!payload.data?.blockKey) return;
  try {
    const prog = payload.data.program as UserProgram | undefined;
    if (prog && (prog.bb || prog.pl || prog.hybrid)) {
      onChange(prog);
      try {
        localStorage.setItem(ANNUAL_BLOCK_PENDING_KEY, JSON.stringify({ blockKey: payload.data.blockKey, ts: Date.now() }));
      } catch { /* ignore */ }
      showToast('🔗 Блок годового плана открыт в редакторе — после правок сохраните программу, изменения вернутся в блок');
      return;
    }
    showToast('⚠ Блок не собран — сначала соберите его в годовой панели («⚙️ Собрать блок»)');
  } catch (e) { showToast('⚠ Не удалось открыть блок: ' + (e as Error)?.message); }
};

/** Ключ заметки «кардио → питание» (читается планировщиком питания/другими UI). */
export const CARDIO_KCAL_NOTE_KEY = 'he_cardio_kcal_note';

/**
 * handler kind='cardio': передаёт расход кардио в питание —
 * считает среднее ккал/нед цикла + факт за сегодня, пишет заметку
 * в localStorage (he_cardio_kcal_note) и копирует текст в буфер.
 */
const cardioHandler: Handler = (payload, { showToast }) => {
  const cycleId = typeof payload.data?.cycleId === 'string' ? payload.data.cycleId : undefined;
  try {
    const cycle = cycleId
      ? loadCardioCycles().find(c => c.id === cycleId)
      : loadActiveCardioCycle();
    if (!cycle) { showToast('⚠ Кардио-цикл не найден — соберите его в кардио-конструкторе'); return; }
    const p = cardioToNutritionPayload(cycle, loadCardioLog());
    try {
      localStorage.setItem(CARDIO_KCAL_NOTE_KEY, JSON.stringify({ cycleId: cycle.id, avgKcalPerWeek: p.avgKcalPerWeek, avgMinutesPerWeek: p.avgMinutesPerWeek, updatedAt: new Date().toISOString() }));
    } catch { /* ignore */ }
    try { navigator.clipboard?.writeText(p.text) } catch { /* ignore */ }
    showToast(`🍽 Расход кардио передан в питание: ~${p.avgKcalPerWeek} ккал/нед · сегодня ${p.todayMinutes} мин${p.todayKcal > 0 ? ' · ' + p.todayKcal + ' ккал' : ''} (в буфер)`);
  } catch (e) {
    showToast('⚠ Ошибка передачи в питание: ' + (e as Error)?.message);
  }
};

/** P0-3: Dispatch table — maps PlannerApplyKind to handler function. */
export const BRIDGE_HANDLERS: Record<string, Handler> = {
  split: splitHandler,
  pri: priHandler,
  weakpoints: weakpointsHandler,
  pm: pmHandler,
  tempo: tempoHandler,
  rir: rirHandler,
  mrv: mrvHandler,
  deload: deloadHandler,
  volume: volumeHandler,
  peak: peakHandler,
  methodology: methodologyHandler,
  program: programHandler,
  design: designHandler,
  macrocycle: macrocycleHandler,
  annual_block: annualBlockHandler,
  cardio: cardioHandler,
};

/** Apply a bridge payload using the dispatch table. Returns true if a handler matched.
 *  F6: universal try/catch wrapper — prevents crashes from malformed payload.data. */
export function applyBridgePayloadDispatch(payload: PlannerApply, ctx: BridgeCtx): boolean {
  const handler = BRIDGE_HANDLERS[payload.kind];
  if (handler) {
    try {
      handler(payload, ctx);
    } catch (e) {
      ctx.showToast('⚠ Ошибка применения: ' + payload.label + ' (' + (e as Error)?.message + ')');
    }
    return true;
  }
  ctx.showToast('🔗 Рекомендация: ' + payload.label + ' (не применима к ' + ctx.dir.toUpperCase() + ')');
  return false;
}
