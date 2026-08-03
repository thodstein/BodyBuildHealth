/**
 * planner-bridge-handlers.ts — P0-3: dispatch table for applyBridgePayload.
 *
 * Each handler is a standalone function that processes one PlannerApplyKind.
 * Extracted from ProgramEditorView.tsx to eliminate the 14-branch if/else chain.
 */
import type { PlannerApply } from './planner-bridge';
import type { UserProgram, UserWeek, UserBlock } from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import type { TrainingProfile } from './training-profile';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';
import { cloneFromCycle, cloneFromLibrary, createBlank } from '../../../engines/user-program/program-store';
import { expandProgramWeeks } from '../../../engines/program-progression.engine';
import { cycleTemplateToFullProgram } from '../../../engines/bb/cycle-to-plan';
import { designerToUserWeeks, applyDesignPhasesToWeeks } from '../../../engines/periodization/designer-to-program';
import { macrocycleToBBProgram } from '../../../engines/lms/macrocycle-to-bb';
import type { MacrocycleDesign } from '../../../engines/periodization-designer.engine';
import type { Macrocycle } from '../../../engines/lms/macrocycle.engine';

export interface BridgeCtx {
  program: UserProgram;
  dir: string;
  update: (patch: Partial<UserProgram>) => void;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
  tprofile: TrainingProfile;
}

const clampRir = (r: number) => Math.max(0, Math.min(5, Math.round(r)));

type Handler = (payload: PlannerApply, ctx: BridgeCtx) => void;

const splitHandler: Handler = (payload, { program: p, dir, update, showToast }) => {
  if (dir !== 'bb' || !p.bb) return false as any;
  const cycle: string[][] = payload.data.cycle ?? [];
  const weeks: UserWeek[] = Array.from({ length: Math.max(1, p.meta.weeks || 4) }, (_, wi) => ({
    week: wi + 1, phase: 'accumulation' as const, deload: false,
    sessions: cycle.map((groups, si) => ({
      id: newId('ses'), name: (payload.data.name ?? 'День') + ' ' + (si + 1), focus: groups.join('/'),
      blocks: groups.map((g) => ({ id: newId('blk'), type: 'compound' as const, exerciseName: '', muscle: g, role: 'primary' as const, sets: [{ reps: 8, rir: 2, weight: 0, restSec: 120 }] })),
    })),
  }));
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 Сплит применён: ' + payload.label);
  return undefined;
};

const priHandler: Handler = (payload, { program: p, update, showToast }) => {
  const mult: number = payload.data.volumeMult ?? 1;
  const rirShift: number = payload.data.rirShift ?? 0;
  if (p.bb) {
    const weeks = p.bb.weeks.map((w) => ({ ...w, sessions: w.sessions.map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b, sets: (b.sets ?? []).map((st) => ({ ...st, weight: st.weight ? Math.round(st.weight * mult) : st.weight, rir: clampRir((st.rir ?? 2) + rirShift) })) })) })) }));
    update({ bb: { ...p.bb, weeks } });
  }
  showToast('🔗 Готовность применена: ' + payload.label);
};

const weakpointsHandler: Handler = (payload, { program: p, onChange, showToast, tprofile }) => {
  const groups: string[] = payload.data.groups ?? [];
  let next = { ...p };
  if (p.bb) next = { ...next, bb: { ...p.bb, constraints: { ...(p.bb.constraints ?? { equipment: [] }) } } };
  if (p.pl) next = { ...next, pl: { ...p.pl, weakPoints: groups } };
  onChange(next);
  saveTrainingProfile({ ...tprofile, weakPoints: groups });
  showToast('🔗 Слабые группы: ' + (groups.join(', ') || 'нет'));
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

const mrvHandler: Handler = (payload, { showToast }) => {
  showToast('🔗 MRV рекомендация: ' + payload.label + ' (примените вручную в PlanDiagnostics)');
};

const deloadHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  const deloadWeeks: number[] = payload.data.weeks ?? [];
  const weeks = p.bb.weeks.map((w) => deloadWeeks.includes(w.week) ? { ...w, phase: 'deload' as const, deload: true, sessions: w.sessions.map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b, sets: (b.sets ?? []).map((st) => ({ ...st, rir: 4, weight: st.weight ? Math.round(st.weight * 0.6) : st.weight })) })) })) } : w);
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 Делод-недели: ' + payload.label);
};

const volumeHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  const setsByMuscle: Record<string, number> = payload.data.sets ?? {};
  const weeks = p.bb.weeks.map((w, wi) => {
    if (wi > 0) return w;
    const sessions = w.sessions.map((s) => {
      const blocks: UserBlock[] = [];
      for (const [mu, cnt] of Object.entries(setsByMuscle)) {
        for (let i = 0; i < Math.min(cnt, 5); i++) {
          blocks.push({ id: newId('blk'), type: 'accessory' as const, exerciseName: '', muscle: mu, role: 'accessory' as const, sets: [{ reps: 10, rir: 2, weight: 0, restSec: 90 }] });
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
  const mult: number = payload.data.volumeMult ?? 0.5;
  const rirTarget: number = payload.data.rirTarget ?? 0;
  const weeks = p.bb.weeks.map((w, wi) => wi === p.bb!.weeks.length - 1 ? { ...w, phase: 'peaking' as const, sessions: w.sessions.map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b, sets: (b.sets ?? []).map((st) => ({ ...st, weight: st.weight ? Math.round(st.weight * mult) : st.weight, rir: rirTarget })) })) })) } : w);
  update({ bb: { ...p.bb, weeks } });
  showToast('🔗 Пиковая неделя: ' + payload.label);
};

const methodologyHandler: Handler = (payload, { program: p, update, showToast }) => {
  if (!p.bb) return;
  const prog = { ...(p.bb.progression ?? { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: ['none'] }), loadStrategy: payload.data.methodName as any };
  update({ bb: { ...p.bb, progression: prog } });
  showToast('🔗 Методика: ' + payload.label);
};

const programHandler: Handler = (payload, { onChange, showToast }) => {
  try {
    const cycleId = payload.data.id ?? payload.data.meta?.id;
    let cloned: UserProgram | null = null;
    if (cycleId && typeof cycleId === 'string') {
      cloned = cloneFromCycle(cycleId);
    }
    if (!cloned && payload.data.meta) {
      const fullProg = cycleTemplateToFullProgram(payload.data);
      if (fullProg) cloned = cloneFromLibrary(expandProgramWeeks(fullProg));
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
      update({ bb: { ...p.bb, weeks: remapped } });
      showToast('🔗 Фазы дизайнера применены к текущей программе: ' + payload.label);
    } else {
      const weeks = designerToUserWeeks(design, {
        fillExercises,
        level: p.meta.level,
        goal: p.meta.goal,
        daysPerWeek,
        equipment: p.bb?.constraints?.equipment ?? [],
        weakPoints: (tprofile.weakPoints ?? []) as string[],
      });
      const blank = createBlank('bb');
      const newProg: UserProgram = {
        ...blank,
        meta: { ...blank.meta, title: design.name + ' (дизайн)', weeks: design.totalWeeks, goal: design.sport === 'powerlifting' ? 'powerlifting' : 'hypertrophy' },
        bb: { ...blank.bb!, weeks },
      };
      onChange(newProg);
      showToast('🔗 Дизайн применён как новая программа: ' + payload.label);
    }
  } catch (e) { showToast('⚠ Не удалось применить дизайн: ' + (e as Error)?.message); }
};

const macrocycleHandler: Handler = (payload, { program: p, onChange, showToast, tprofile }) => {
  if (!payload.data?.macro) return;
  try {
    const macro = payload.data.macro as Macrocycle;
    const newProg = macrocycleToBBProgram(macro, {
      level: payload.data.level ?? p.meta.level,
      goal: payload.data.goal ?? p.meta.goal,
      daysPerWeek: payload.data.daysPerWeek ?? p.meta.daysPerWeek,
      weakPoints: (tprofile.weakPoints ?? []) as string[],
      equipment: p.bb?.constraints?.equipment ?? [],
    });
    onChange(newProg);
    showToast('🔗 Макроцикл применён как ББ-программа: ' + payload.label);
  } catch (e) { showToast('⚠ Не удалось применить макроцикл: ' + (e as Error)?.message); }
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
};

/** Apply a bridge payload using the dispatch table. Returns true if a handler matched. */
export function applyBridgePayloadDispatch(payload: PlannerApply, ctx: BridgeCtx): boolean {
  const handler = BRIDGE_HANDLERS[payload.kind];
  if (handler) {
    handler(payload, ctx);
    return true;
  }
  ctx.showToast('🔗 Рекомендация: ' + payload.label + ' (не применима к ' + ctx.dir.toUpperCase() + ')');
  return false;
}