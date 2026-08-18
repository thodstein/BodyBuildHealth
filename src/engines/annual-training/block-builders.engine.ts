/**
 * block-builders.engine.ts — сборка блоков годового плана соответствующими
 * конструкторами + композиция годовой программы.
 *
 * Принцип: годовой план отвечает за КАЛЕНДАРЬ и КОМПОЗИЦИЮ, генерацию тренировок
 * выполняет конструктор, выбранный для блока:
 *   - PL     → СРЦ-цикл (cycleTemplateToFullProgram) + фазовый оверлей + taper;
 *   - BB     → autodraftBBPlan (BB-авто) + фазы + пик-неделя (bb-contest-prep);
 *   - MANUAL → скелет фаз (пользователь наполняет в ручном редакторе).
 *
 * Идемпотентность: собранный результат кэшируется в AnnualBlockState; повторный
 * вызов с теми же настройками пересобирает только статусы unbuilt/stale/error
 * (opts.rebuild='all' — принудительно все). Изменение макро-разметки не
 * перезаписывает результат, а помечает блок 'stale'.
 */
import {
  type UserWeek, type UserSession, type UserBlock, type UserSet, type Phase,
  type UserProgram, newId,
} from '../user-program/user-program.types';
import { createBlank, createFromBuild } from '../user-program/program-store';
import type {
  AnnualBlockState, AnnualBlockRef, AnnualTrainingPlan, AnnualBlockKind,
  AnnualBuildOptions, AnnualBuildOutcome, AnnualBlockConfig, AnnualBlockBuildResult,
  MacroBlockBuildStatus,
} from './annual-training.types';
import {
  type Macrocycle, type MacroBlock, type BBMacrocycle, type BBMacroBlock,
  serializeMacro, serializeBbMacro,
} from '../lms/macrocycle.engine';
import {
  macroPhaseToUserPhase,
  bbMacroPhaseToUserPhase,
} from '../periodization/phase-bridge';
import { makeEmptySessionsForWeek } from '../periodization/designer-to-program';
import { autodraftBBPlan } from '../manual-constructor/manual-draft.engine';
import type { BBPlan } from '../bb/bb-builder.engine';
import { applyPeakWeekOverlayToBBPlan, type BBContestPrepConfig } from '../bb/bb-contest-prep.engine';
import { buildPLTaperCurve, type TaperMode, type TaperWeightGoal } from '../lms/lms-taper.engine';
import { getCycleById, LMS_CYCLES, normalizeCycleDirection } from '../../data/lms-cycles/lms-cycle-index';
import { cycleTemplateToFullProgram } from '../bb/cycle-to-plan';
import type { FullProgram, ProgramWeek } from '../complete-program-library.engine';

/* ─────────────────────────── Хэш и ключи ────────────────────────────────── */

/** Стабильный FNV-1a хэш JSON-представления (для stale-детекции). */
export function stableHash(input: unknown): string {
  const text = typeof input === 'string' ? input : JSON.stringify(input ?? null);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Стабильный ключ макро-блока: layout-поля + цикл. Изменение любого поля → новый ключ → stale. */
export function macroBlockKey(block: MacroBlock | BBMacroBlock, idx: number): string {
  const cycleId = (block as MacroBlock).cycleId;
  return `blk${idx}-${block.phase}-${block.weekOffset}-${block.weeks}${cycleId ? '-' + cycleId : ''}`;
}

/** Тип конструктора из макро-блока. */
export function blockKindFromMacro(block: MacroBlock | BBMacroBlock): AnnualBlockKind {
  const kind = (block as MacroBlock).kind;
  if (kind === 'BB') return 'BB';
  if (kind === 'SRC') return 'PL';
  return 'PL'; // BBMacroBlock (без kind) → BB-макроцикл, но kind отсутствует
}

/** Определить, BB-ли это макроцикл (по признаку trainingFocus). */
export function isBBMacroShape(macro: Macrocycle | BBMacrocycle): macro is BBMacrocycle {
  return 'trainingFocus' in macro;
}

/* ─────────────────────────── Создание плана ─────────────────────────────── */

function nowIso(): string {
  return new Date().toISOString();
}

/** Конфиг по умолчанию для нового блока. */
export function defaultConfigForRef(ref: AnnualBlockRef): AnnualBlockConfig {
  const config: AnnualBlockConfig = {};
  if (ref.kind === 'PL' && ref.cycleId) config.cycleId = ref.cycleId;
  return config;
}

/** Ref из макро-блока. */
function refFromBlock(block: MacroBlock | BBMacroBlock, idx: number, isBbMacro: boolean): AnnualBlockRef {
  const rawKind = (block as MacroBlock).kind;
  const kind: AnnualBlockKind = isBbMacro ? 'BB' : rawKind === 'BB' ? 'BB' : 'PL';
  return {
    blockKey: macroBlockKey(block, idx),
    blockIndex: idx,
    kind,
    phase: block.phase,
    startWeek: block.weekOffset,
    weeks: block.weeks,
    competitionId: block.competitionId,
    cycleId: rawKind !== 'BB' ? (block as MacroBlock).cycleId : undefined,
    description: block.description,
  };
}

/** Направление плана из набора типов блоков. */
export function directionFromKinds(kinds: AnnualBlockKind[]): AnnualTrainingPlan['direction'] {
  const hasPL = kinds.some(k => k === 'PL');
  const hasOther = kinds.some(k => k !== 'PL');
  if (hasPL && hasOther) return 'mixed';
  if (hasPL) return 'pl';
  return 'bb';
}

/** Пересчитать статус плана по статусам блоков. */
export function planStatusFromBlocks(blocks: AnnualBlockState[]): AnnualTrainingPlan['status'] {
  if (blocks.length === 0) return 'draft';
  if (blocks.some(b => b.status === 'stale')) return 'stale';
  if (blocks.some(b => b.status === 'error')) return 'partial';
  if (blocks.every(b => b.status === 'built')) return 'built';
  if (blocks.some(b => b.status === 'built')) return 'partial';
  return 'draft';
}

/** Создать годовой план из макро-разметки (все блоки unbuilt). */
export function annualPlanFromMacro(macro: Macrocycle | BBMacrocycle, opts: AnnualBuildOptions = {}): AnnualTrainingPlan {
  const isBbMacro = isBBMacroShape(macro);
  const blocks: AnnualBlockState[] = macro.blocks.map((block, idx) => {
    const ref = refFromBlock(block, idx, isBbMacro);
    const config = defaultConfigForRef(ref);
    if (!config.daysPerWeek && opts.daysPerWeek) config.daysPerWeek = opts.daysPerWeek;
    return { ref, config, status: 'unbuilt' as const };
  });
  const kinds = blocks.map(b => b.ref.kind);
  return {
    id: 'annual_' + Date.now().toString(36),
    version: 1,
    totalWeeks: macro.totalWeeks,
    direction: directionFromKinds(kinds),
    macroRef: { source: isBbMacro ? 'bb' : 'pl', serialized: isBbMacro ? serializeBbMacro(macro) : serializeMacro(macro) },
    blocks,
    status: 'draft',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

/**
 * Синхронизировать план с текущей макро-разметкой:
 *  - блоки с тем же blockKey сохраняют конфиг и результат;
 *  - блоки с изменённым layout (новый ключ) → статус 'stale', результат сохранён;
 *  - новые блоки → 'unbuilt'; удалённые из макро — выбрасываются.
 */
export function syncAnnualPlan(plan: AnnualTrainingPlan, macro: Macrocycle | BBMacrocycle): AnnualTrainingPlan {
  const isBbMacro = isBBMacroShape(macro);
  const byKey = new Map(plan.blocks.map(b => [b.ref.blockKey, b]));
  const byIndex = new Map(plan.blocks.map(b => [b.ref.blockIndex, b]));
  const blocks: AnnualBlockState[] = macro.blocks.map((block, idx) => {
    const ref = refFromBlock(block, idx, isBbMacro);
    const exact = byKey.get(ref.blockKey);
    if (exact) {
      // Layout не изменился. Если пользователь менял конфиг после сборки — stale.
      const configChanged = exact.result && exact.result.configHash !== configHashOf(exact.config, exact.ref);
      const status = exact.status === 'built' && configChanged ? 'stale' : exact.status;
      // Свежая разметка побеждает для competitionId/description (иначе после
      // замены соревнования на той же неделе пик-конфиг строился бы с устаревшей датой).
      return { ...exact, ref: { ...exact.ref, ...ref }, status };
    }
    // Тот же индекс блока, но layout изменился (недели/фаза/цикл) → результат
    // сохраняем, но помечаем stale (НЕ перезаписываем без подтверждения).
    const sameIndex = byIndex.get(idx);
    if (sameIndex) {
      return { ...sameIndex, ref, status: sameIndex.status === 'unbuilt' ? 'unbuilt' : 'stale' };
    }
    return { ref, config: defaultConfigForRef(ref), status: 'unbuilt' };
  });
  return {
    ...plan,
    totalWeeks: macro.totalWeeks,
    direction: directionFromKinds(blocks.map(b => b.ref.kind)),
    macroRef: { source: isBbMacro ? 'bb' : 'pl', serialized: isBbMacro ? serializeBbMacro(macro) : serializeMacro(macro) },
    blocks,
    status: planStatusFromBlocks(blocks),
    updatedAt: nowIso(),
  };
}

/* ─────────────────────────── Фазовый оверлей недель ─────────────────────── */

/** Объём/RIR фаз BB-макроцикла (Helms 2022, Bompa 2009) — parity с macrocycle-to-bb. */
const BB_PHASE_MOD: Record<string, { compound: number; accessory: number; rirC: [number, number]; rirA: [number, number] }> = {
  hypertrophy:  { compound: 1.0,  accessory: 1.0,  rirC: [2, 3], rirA: [3, 4] },
  strength:     { compound: 0.85, accessory: 0.8,  rirC: [1, 2], rirA: [2, 3] },
  contest_prep: { compound: 0.5,  accessory: 0.3,  rirC: [0, 1], rirA: [1, 2] },
  transition:   { compound: 0.5,  accessory: 0.3,  rirC: [3, 4], rirA: [4, 5] },
};

/** Объём/RIR фаз ПЛ-макроцикла (parity с applyMacrocycleToBBPlan). */
const PL_PHASE_MOD: Record<string, { compound: number; accessory: number; rir: [number, number] }> = {
  endurance:   { compound: 1.0, accessory: 1.0, rir: [2, 4] },
  strength:    { compound: 0.9, accessory: 0.85, rir: [1, 3] },
  peak:        { compound: 0.75, accessory: 0.7, rir: [0, 2] },
  competition: { compound: 0.6, accessory: 0.5, rir: [0, 1] },
  transition:  { compound: 0.5, accessory: 0.45, rir: [3, 5] },
};

const clampRir = (r: number): number => Math.max(0, Math.min(5, Math.round(r)));

/**
 * Применить фазу макро-блока к неделям: объём сетов ×mult, RIR в целевой
 * диапазон, deload-флаг для transition. Не мутирует вход.
 */
export function applyBlockPhaseToWeeks(
  weeks: UserWeek[],
  phase: string,
  kind: AnnualBlockKind,
  skipLastWeek = false,
): UserWeek[] {
  const bbMod = BB_PHASE_MOD[phase];
  const plMod = PL_PHASE_MOD[phase];
  const useBB = (kind === 'BB' || kind === 'MANUAL') && !!bbMod;
  const mod = useBB ? bbMod : plMod;
  const deload = phase === 'transition';
  const userPhase = useBB ? bbMacroPhaseToUserPhase(phase as any) : macroPhaseToUserPhase(phase as any);
  if (!mod) return weeks.map(w => ({ ...w, phase: userPhase }));
  return weeks.map((w, wi) => {
    // Пик-неделя применяется поверх (после) фазовой модуляции — финал блока не урезается дважды.
    if (skipLastWeek && wi === weeks.length - 1) return { ...w, phase: userPhase };
    return {
    ...w,
    phase: userPhase,
    deload: deload || w.deload,
    sessions: w.sessions.map(s => ({
      ...s,
      blocks: s.blocks.map(block => {
        const isCompound = block.type === 'compound' || block.role === 'primary';
        const vol = isCompound ? mod.compound : mod.accessory;
        const targetCount = Math.max(1, Math.round(block.sets.length * vol));
        const rirRange = 'rirC' in mod ? (isCompound ? mod.rirC : mod.rirA) : mod.rir;
        const sets: UserSet[] = Array.from({ length: targetCount }, (_, i) => {
          const src = block.sets[i] ?? block.sets[0];
          if (!src) return { reps: 8, rir: clampRir((rirRange[0] + rirRange[1]) / 2) };
          const cur = Number.isFinite(src.rir) ? src.rir : 2;
          const target = cur < rirRange[0] ? rirRange[0] : cur > rirRange[1] ? rirRange[1] : cur;
          return { ...src, rir: clampRir(target) };
        });
        return { ...block, sets };
      }),
    })),
  };
  });
}

/**
 * Применить taper внутри блока (финальные N недель, Bosquet 2005):
 * предпоследняя ×0.65/RIR+1, финальная ×0.45/RIR+2. Не выходит за границы блока.
 * Идемпотентен по метке `note` на блоке недели.
 */
export function applyBlockTaperToWeeks(
  weeks: UserWeek[],
  taperWeeks: number = 2,
): UserWeek[] {
  const n = Math.max(1, Math.min(weeks.length - 1, taperWeeks));
  if (weeks.length <= 1 || n < 1) return weeks;
  const last = weeks.length;
  const specFor = (weekInBlock: number): { volumeMult: number; rirShift: number } | null => {
    if (weekInBlock === last) return { volumeMult: 0.45, rirShift: 2 };
    if (weekInBlock >= last - n + 1) return { volumeMult: 0.65, rirShift: 1 };
    return null;
  };
  return weeks.map(w => {
    const spec = specFor(w.week);
    if (!spec) return w;
    const mark = `[annual-taper:${spec.volumeMult}]`;
    const already = w.sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-taper:')));
    if (already) return w;
    return {
      ...w,
      sessions: w.sessions.map(s => ({
        ...s,
        blocks: s.blocks.map(block => {
          const targetCount = Math.max(1, Math.round(block.sets.length * spec.volumeMult));
          const sets: UserSet[] = Array.from({ length: targetCount }, (_, i) => {
            const src = block.sets[i] ?? block.sets[0];
            if (!src) return { reps: 8, rir: 3 };
            return { ...src, rir: clampRir((Number.isFinite(src.rir) ? src.rir : 2) + spec.rirShift) };
          });
          return { ...block, sets, note: [block.note, mark].filter(Boolean).join(' · ') };
        }),
      })),
    };
  });
}

/**
 * Реальный taper блока по канону lms-taper.engine (buildPLTaperCurve):
 * объём/RIR последних N недель из кривой выбранной раскладки (classic/pl/pro/wf),
 * весовая цель как множитель объёма, mock meet (прикиды) и пост-старт — метками.
 * Идемпотентен по метке `[annual-pl-taper:`.
 */
export function applyPLBlockTaperToWeeks(
  weeks: UserWeek[],
  cfg: { weeks?: number; mode?: string; weightGoal?: string; mockMeet?: boolean; postMeet?: boolean },
): { weeks: UserWeek[]; applied: boolean } {
  const n = Math.max(1, Math.min(weeks.length - 1, Math.round(cfg.weeks ?? 2)));
  if (weeks.length <= 1) return { weeks, applied: false };
  if (weeks.some(w => w.sessions.some(s => s.blocks.some(b => b.note?.includes('[annual-pl-taper:'))))) {
    return { weeks, applied: false };
  }
  const curve = buildPLTaperCurve({
    taperWeeks: n,
    mode: (cfg.mode as TaperMode) ?? 'classic',
    weightGoal: (cfg.weightGoal as TaperWeightGoal) ?? 'auto',
  });
  const last = weeks.length;
  const next = weeks.map(w => {
    const fromEnd = last - w.week;
    const pt = curve[curve.length - 1 - fromEnd];
    if (!pt || fromEnd >= curve.length) return w;
    const mark = `[annual-pl-taper:${pt.volumePct}]`;
    return {
      ...w,
      note: [w.note, mark].filter(Boolean).join(' · '),
      sessions: w.sessions.map(s => ({
        ...s,
        note: [s.note, `📉 ${pt.label}`].filter(Boolean).join(' · '),
        blocks: s.blocks.map(block => {
          const targetCount = Math.max(1, Math.round(block.sets.length * pt.volumePct));
          const sets: UserSet[] = Array.from({ length: targetCount }, (_, i) => {
            const src = block.sets[i] ?? block.sets[0];
            if (!src) return { reps: 8, rir: 3 };
            const rir = pt.rirTarget != null
              ? pt.rirTarget
              : clampRir((Number.isFinite(src.rir) ? src.rir : 2) + pt.rirShift);
            return { ...src, rir };
          });
          return { ...block, sets, note: [block.note, mark].filter(Boolean).join(' · ') };
        }),
      })),
    };
  });
  const finalWeeks = next.map((w, i) => {
    if (i !== last - 1) return w;
    const labels: string[] = [];
    if (cfg.mockMeet) labels.push('🎯 Mock meet: прикиды-синглы');
    if (cfg.postMeet) labels.push('🔄 Пост-старт восстановление (объём ×0.5, RIR +3)');
    if (labels.length === 0) return w;
    return { ...w, note: [w.note, ...labels].filter(Boolean).join(' · ') };
  });
  return { weeks: finalWeeks, applied: true };
}

/* ─────────────────────────── Сборка блока ───────────────────────────────── */

function cloneWeeksWithFreshIds(weeks: UserWeek[]): UserWeek[] {
  return weeks.map(w => ({
    ...w,
    sessions: (w.sessions ?? []).map(s => ({
      ...s,
      id: newId('ses'),
      blocks: (s.blocks ?? []).map(b => ({ ...b, id: newId('blk') })),
    })),
  }));
}

function fullProgramWeeksToUserWeeks(full: FullProgram): UserWeek[] {
  return (full.weeks ?? []).map((pw: ProgramWeek, wi) => ({
    week: pw.week ?? wi + 1,
    phase: (pw.phase as Phase) ?? 'accumulation',
    deload: !!pw.deload,
    sessions: (pw.days ?? []).map((day, di) => ({
      id: newId('ses'),
      name: day.name ?? `День ${day.day ?? di + 1}`,
      dayOfWeek: (day.day ?? di + 1) - 1,
      focus: day.focus ?? '',
      warmup: day.warmup,
      cooldown: day.cooldown,
      blocks: (day.exercises ?? []).map((ex, ei) => {
        const repsNum = parseInt(String(ex.reps), 10);
        const reps: number | string = Number.isNaN(repsNum) ? ex.reps : repsNum;
        const sets: UserSet[] = Array.from({ length: ex.sets ?? 0 }, () => ({
          reps, rir: ex.rir ?? 2, restSec: ex.restSec, note: ex.notes,
        }));
        return {
          id: newId('blk'),
          type: ei === 0 ? 'compound' : 'accessory',
          exerciseName: ex.name,
          muscle: '',
          role: ei === 0 ? 'primary' : 'accessory',
          sets,
          note: ex.progression,
        };
      }),
    })),
  }));
}

/** Зациклить недели до нужной длины с перенумерацией и свежими id. */
function loopWeeksToLength(weeks: UserWeek[], total: number): UserWeek[] {
  const out: UserWeek[] = [];
  const src = weeks.length > 0 ? weeks : [];
  for (let w = 1; w <= total; w++) {
    const srcWeek = src[(w - 1) % Math.max(1, src.length)];
    if (!srcWeek) {
      out.push({ week: w, phase: 'accumulation', deload: false, sessions: [] });
      continue;
    }
    out.push({
      ...cloneWeeksWithFreshIds([srcWeek])[0],
      week: w,
    });
  }
  return out;
}

/** Сборка PL-блока: СРЦ-цикл → недели + фазы + taper. */
function buildPLBlock(
  state: AnnualBlockState,
  _macro: Macrocycle | BBMacrocycle,
  opts: AnnualBuildOptions,
): AnnualBlockBuildResult {
  const warnings: string[] = [];
  const requestedCycleId = state.config.cycleId ?? state.ref.cycleId;
  const cycleSelection = selectPLCycleForBlock(requestedCycleId, state.ref.phase as MacroBlock['phase'], state.ref.weeks, opts.level, true);
  const cycleId = cycleSelection.cycleId;
  if (cycleSelection.warning) warnings.push(cycleSelection.warning);
  const selectedCycle = cycleId ? getCycleById(cycleId) : undefined;
  let weeks: UserWeek[];
  let program: UserProgram | null = null;
  if (cycleId) {
    if (!selectedCycle) {
      warnings.push(`Цикл «${cycleId}» не найден — блок собран как скелет фаз.`);
      weeks = skeletonWeeks(state.ref.weeks, opts.daysPerWeek ?? 3);
    } else {
      const full = cycleTemplateToFullProgram(selectedCycle);
      weeks = fullProgramWeeksToUserWeeks(full);
      const base = createBlank('pl');
      base.meta.title = `Блок: ${state.ref.description ?? state.ref.phase} (${state.ref.weeks} нед)`;
      base.meta.goal = 'powerlifting';
      base.meta.level = opts.level ?? 'intermediate';
      base.meta.weeks = state.ref.weeks;
      base.meta.daysPerWeek = selectedCycle.meta.sessionsPerWeek;
      if (base.pl) {
        base.pl.sourceCycleId = cycleId;
        base.pl.schedule = Array.from({ length: selectedCycle.meta.sessionsPerWeek }, (_, i) => ({ sessionIdx: i, dayOfWeek: i }));
        base.pl.notes = `Годовой блок нед ${state.ref.startWeek}-${state.ref.startWeek + state.ref.weeks - 1} · «${selectedCycle.meta.title}».`;
      }
      program = base;
    }
  } else {
    warnings.push('PL-блок без СРЦ-цикла — выберите цикл (config.cycleId) или создайте блок вручную.');
    weeks = skeletonWeeks(state.ref.weeks, opts.daysPerWeek ?? 3);
  }
  if (selectedCycle && selectedCycle.meta.weeks < state.ref.weeks) {
    warnings.push(`Цикл «${selectedCycle.meta.title}» короче блока (${selectedCycle.meta.weeks} нед < ${state.ref.weeks}) — шаблон цикла повторён для заполнения фазы.`);
  }
  weeks = loopWeeksToLength(weeks, state.ref.weeks);
  weeks = applyBlockPhaseToWeeks(weeks, state.ref.phase, 'PL');
  let taperApplied = false;
  if (state.config.taper?.enabled) {
    const t = state.config.taper;
    const advanced = t.mode != null || t.weightGoal != null || t.mockMeet === true || t.postMeet === true;
    if (advanced) {
      const res = applyPLBlockTaperToWeeks(weeks, t);
      weeks = res.weeks;
      taperApplied = res.applied;
    } else {
      weeks = applyBlockTaperToWeeks(weeks, t.weeks ?? 2);
      taperApplied = true;
    }
  }
  return {
    blockKey: state.ref.blockKey,
    kind: 'PL',
    weeks,
    program,
    bbPlan: null,
    warnings,
    taperApplied,
    peakApplied: false,
    configHash: configHashOf(state.config, state.ref),
  };
}

type PLBlockPhase = MacroBlock['phase'];

/** Подобрать СРЦ-цикл под длину блока, не ломая явно выбранный пользователем цикл. */
export function selectPLCycleForBlock(
  requestedCycleId: string | undefined,
  phase: PLBlockPhase,
  weeks: number,
  level?: string,
  allowAutoReplace = true,
): { cycleId?: string; warning?: string } {
  const requested = requestedCycleId ? getCycleById(requestedCycleId) : undefined;
  if (requested && (!allowAutoReplace || requested.meta.weeks >= weeks)) return { cycleId: requested.meta.id };
  const phasePeriod: Record<PLBlockPhase, string[]> = {
    endurance: ['endurance', 'mixed'],
    strength: ['strength', 'mixed'],
    peak: ['peak', 'strength'],
    competition: ['peak', 'strength'],
    transition: ['mixed', 'endurance'],
  };
  const candidates = LMS_CYCLES.filter(cycle => normalizeCycleDirection(cycle.meta.direction) === 'strength');
  const ranked = candidates
    .map(cycle => {
      const levelPenalty = level && cycle.meta.level === level ? 0 : 1;
      const periodPenalty = phasePeriod[phase].includes(cycle.meta.period) ? 0 : 1;
      const lengthPenalty = cycle.meta.weeks >= weeks ? cycle.meta.weeks - weeks : 1000 + weeks - cycle.meta.weeks;
      return { cycle, score: levelPenalty * 10000 + periodPenalty * 1000 + lengthPenalty };
    })
    .sort((a, b) => a.score - b.score);
  const selected = ranked[0]?.cycle;
  if (!selected) {
    return { cycleId: requested?.meta.id, warning: `Не найден подходящий СРЦ-цикл для фазы «${phase}» — используется скелет блока.` };
  }
  const changed = requested && requested.meta.id !== selected.meta.id;
  return {
    cycleId: selected.meta.id,
    warning: changed
      ? `Автоподстройка: цикл «${requested.meta.title}» заменён на «${selected.meta.title}» под блок ${weeks} нед.`
      : requested
        ? undefined
        : `Автоподбор: для фазы «${phase}» выбран цикл «${selected.meta.title}» (${selected.meta.weeks} нед).`,
  };
}

/** Скелет фаз блока (без упражнений). */
function skeletonWeeks(total: number, daysPerWeek: number): UserWeek[] {
  return Array.from({ length: total }, (_, i) => ({
    week: i + 1,
    phase: 'accumulation' as Phase,
    deload: false,
    sessions: makeEmptySessionsForWeek(daysPerWeek),
  }));
}

/** Сборка BB-блока: autodraftBBPlan → пик-неделя (опц.) → фаза блока → taper. */
function buildBBBlock(
  state: AnnualBlockState,
  _macro: Macrocycle | BBMacrocycle,
  opts: AnnualBuildOptions,
): AnnualBlockBuildResult {
  const warnings: string[] = [];
  const days = state.config.daysPerWeek ?? opts.daysPerWeek ?? 4;
  const buildWeeks = Math.max(1, Math.min(state.ref.weeks, 16));
  const level = state.config.level ?? opts.level ?? 'intermediate';
  const goal = state.config.goal ?? opts.goal ?? 'hypertrophy';
  const trainingFocus = state.config.trainingFocus ?? opts.trainingFocus;
  const draft = autodraftBBPlan({
    level,
    goal,
    daysPerWeek: days,
    weeks: buildWeeks,
    splitPattern: state.config.splitPattern,
    equipment: state.config.equipment ?? opts.equipment ?? [],
    weakPoints: state.config.weakPoints ?? opts.weakPoints ?? [],
    focusGroup: state.config.focusGroup,
    specialization: state.config.specialization,
    trainingFocus: (trainingFocus as any) ?? 'hypertrophy',
    workMax: opts.workMax,
    bodyFat: opts.bodyFat,
    leanMass: opts.leanMass,
    hrvMs: opts.hrvMs,
    sleepHours: opts.sleepHours,
    stressLevel: opts.stressLevel,
    sex: opts.sex,
  });
  // Зациклить BB-недели до длины блока (bb-builder ограничен 16 неделями).
  let plan: BBPlan = draft.weeks.length >= state.ref.weeks
    ? draft
    : { ...draft, weeks: loopBBSessions(draft.weeks, state.ref.weeks) };
  // 🎭 Пик-неделя к последней неделе блока (единая система bb-contest-prep).
  let peakApplied = false;
  if (state.config.peakWeek && state.config.peakConfig) {
    try {
      const cfg = state.config.peakConfig as unknown as BBContestPrepConfig;
      plan = applyPeakWeekOverlayToBBPlan(plan, cfg, { weekNumber: state.ref.weeks });
      peakApplied = true;
    } catch (e) {
      warnings.push(`Пик-неделя не применена: ${(e as Error).message}`);
    }
  }
  const prog = createFromBuild(plan, { title: `Блок: ${state.ref.description ?? state.ref.phase} (${state.ref.weeks} нед)`, goal, level });
  let weeks = loopWeeksToLength(prog.bb?.weeks ?? [], state.ref.weeks);
  // Фаза блока применяется один раз — на уровне недель (объём/RIR/deload).
  // Пик-неделя уже наложена на финал плана — финальную неделю не модулируем повторно.
  weeks = applyBlockPhaseToWeeks(weeks, state.ref.phase, 'BB', peakApplied);
  let taperApplied = false;
  if (state.config.taper?.enabled) {
    weeks = applyBlockTaperToWeeks(weeks, state.config.taper.weeks ?? 2);
    taperApplied = true;
  }
  return {
    blockKey: state.ref.blockKey,
    kind: 'BB',
    weeks,
    program: prog,
    bbPlan: plan,
    warnings,
    taperApplied,
    peakApplied,
    configHash: configHashOf(state.config, state.ref),
  };
}

/** Зациклить BB-сессии (тип BBWeek — any, чтобы не тянуть всю типизацию BB). */
function loopBBSessions(weeks: any[], total: number): any[] {
  const out: any[] = [];
  for (let w = 1; w <= total; w++) {
    const src = weeks[(w - 1) % Math.max(1, weeks.length)];
    if (!src) { out.push({ week: w, sessions: [], phase: 'accumulation' }); continue; }
    out.push({
      ...src,
      week: w,
      sessions: (src.sessions ?? []).map((s: any) => ({
        ...s,
        exercises: (s.exercises ?? []).map((e: any) => ({ ...e })),
      })),
    });
  }
  return out;
}

/** Сборка MANUAL-блока: скелет фаз (+ опц. копия структуры другого блока). */
function buildManualBlock(
  state: AnnualBlockState,
  plan: AnnualTrainingPlan,
  opts: AnnualBuildOptions,
): AnnualBlockBuildResult {
  const warnings: string[] = [];
  let weeks: UserWeek[];
  const template = state.config.templateFromBlockKey
    ? plan.blocks.find(b => b.ref.blockKey === state.config.templateFromBlockKey)?.result?.weeks
    : undefined;
  if (template && template.length > 0) {
    weeks = loopWeeksToLength(template, state.ref.weeks);
    warnings.push('Структура скопирована из блока-шаблона — отредактируйте в ручном конструкторе.');
    if (state.config.taper?.enabled && weeks.some(w => w.sessions.some(s => s.blocks.some(b =>
      b.note?.includes('[annual-taper:') || b.note?.includes('[annual-pl-taper:'))))) {
      warnings.push('⚠ Шаблон уже содержит taper-недели — их объём не пересчитается; используйте шаблон без taper.');
    }
  } else {
    weeks = skeletonWeeks(state.ref.weeks, state.config.daysPerWeek ?? opts.daysPerWeek ?? 3);
  }
  weeks = applyBlockPhaseToWeeks(weeks, state.ref.phase, 'MANUAL');
  let taperApplied = false;
  if (state.config.taper?.enabled) {
    weeks = applyBlockTaperToWeeks(weeks, state.config.taper.weeks ?? 2);
    taperApplied = true;
  }
  const program = createBlank('bb');
  program.meta.title = `Блок (ручной): ${state.ref.description ?? state.ref.phase} (${state.ref.weeks} нед)`;
  program.meta.weeks = state.ref.weeks;
  program.meta.daysPerWeek = opts.daysPerWeek ?? 3;
  if (program.bb) program.bb.weeks = weeks;
  return {
    blockKey: state.ref.blockKey,
    kind: 'MANUAL',
    weeks,
    program,
    bbPlan: null,
    warnings,
    taperApplied,
    peakApplied: false,
    configHash: configHashOf(state.config, state.ref),
  };
}

function configHashOf(config: AnnualBlockConfig, ref: AnnualBlockRef): string {
  return stableHash({ config, kind: ref.kind, phase: ref.phase, weeks: ref.weeks, cycleId: ref.cycleId });
}

/**
 * Собрать один блок соответствующим конструктором. Возвращает НОВОЕ состояние.
 * Собранные блоки (status='built') без force НЕ пересобираются (идемпотентность).
 */
export function buildAnnualBlock(
  state: AnnualBlockState,
  plan: AnnualTrainingPlan,
  macro: Macrocycle | BBMacrocycle,
  opts: AnnualBuildOptions = {},
): AnnualBlockState {
  try {
    let result: AnnualBlockBuildResult;
    switch (state.ref.kind) {
      case 'PL': result = buildPLBlock(state, macro, opts); break;
      case 'BB': result = buildBBBlock(state, macro, opts); break;
      case 'MANUAL': result = buildManualBlock(state, plan, opts); break;
      default:
        throw new Error(`Неизвестный тип конструктора блока: ${(state.ref as any).kind}`);
    }
    return { ...state, status: 'built', result, builtAt: nowIso(), error: undefined };
  } catch (e) {
    return { ...state, status: 'error', error: (e as Error).message, builtAt: nowIso() };
  }
}

/**
 * Собрать годовой план по блокам. По умолчанию собираются только блоки со
 * статусом unbuilt/stale/error (opts.rebuild='all' — все блоки заново).
 * Ошибки одного блока не ломают остальные (частичная сборка).
 */
export function buildAnnualPlan(
  plan: AnnualTrainingPlan,
  macro: Macrocycle | BBMacrocycle,
  opts: AnnualBuildOptions = {},
): AnnualBuildOutcome {
  // opts.sync=false — собрать блоки «как есть» без синхронизации с макро
  // (для тестов и случаев, когда оркестратор сам уже синхронизировал план).
  const synced = opts.sync === false ? plan : syncAnnualPlan(plan, macro);
  const rebuildAll = opts.rebuild === 'all';
  let built = 0, skipped = 0, failed = 0;
  const errors: AnnualBuildOutcome['errors'] = [];
  const blocks = synced.blocks.map(state => {
    if (!rebuildAll && state.status === 'built') { skipped += 1; return state; }
    const next = buildAnnualBlock(state, synced, macro, opts);
    if (next.status === 'built') built += 1;
    if (next.status === 'error') { failed += 1; errors.push({ blockKey: next.ref.blockKey, message: next.error ?? 'ошибка сборки' }); }
    return next;
  });
  return {
    plan: { ...synced, blocks, status: planStatusFromBlocks(blocks), updatedAt: nowIso() },
    built, skipped, failed, errors,
  };
}

/* ─────────────────────── Правки блоков (конфиг/ручной roundtrip) ─────────── */

function findBlockIndex(plan: AnnualTrainingPlan, blockKey: string): number {
  return plan.blocks.findIndex(b => b.ref.blockKey === blockKey);
}

/** Результат проверки разметки годового плана (календарная целостность). */
export interface AnnualPlanValidation {
  /** Пропуски недель между блоками (неделя 1-индекс). */
  gaps: { from: number; to: number }[];
  /** Перекрытия блоков (соседние блоки пересекаются по неделям). */
  overlaps: { from: number; to: number; blockKeys: string[] }[];
  /** Сумма недель блоков ≠ totalWeeks. */
  totalMismatch: boolean;
  /** Недели за пределами 1..totalWeeks. */
  outOfRange: string[];
  warnings: string[];
}

/** Активный блок годового плана на неделе N (1-индекс) или null. */
export function activeBlockForWeek(plan: AnnualTrainingPlan, week: number): AnnualBlockState | null {
  if (!Number.isFinite(week) || week < 1) return null;
  return plan.blocks.find(b => week >= b.ref.startWeek && week < b.ref.startWeek + b.ref.weeks) ?? null;
}

/** Неделя года (1-индекс) для ISO-даты: неделя 1 = reference (по умолчанию сегодня).
 *  Будущее: нед 1 = сегодня; прошлое: нед 2 = 7-13 дней назад и т.д. */
export function annualWeekForDate(isoDate: string, reference?: Date | string): number | null {
  const d = new Date(isoDate).getTime();
  const ref = reference == null ? Date.now() : (reference instanceof Date ? reference.getTime() : new Date(reference).getTime());
  if (!Number.isFinite(d) || !Number.isFinite(ref)) return null;
  const diffDays = (d - ref) / 86400000;
  const week = diffDays >= 0 ? Math.floor(diffDays / 7) + 1 : 1 + Math.floor(-diffDays / 7);
  return Math.max(1, week);
}

/** Фаза/блок годового плана на дату (для питания, дневника и других экранов). */
export function annualPlanPhaseForDate(
  plan: AnnualTrainingPlan,
  isoDate: string,
  reference?: Date | string,
): { week: number; block: AnnualBlockState } | null {
  const week = annualWeekForDate(isoDate, reference);
  if (week == null) return null;
  const block = activeBlockForWeek(plan, week);
  if (!block) return null;
  return { week, block };
}

/** Рекомендуемый конструктор блока по фазе макро (подсказка, не авто-выбор). */
export function recommendKindForPhase(phase: string, source: 'pl' | 'bb'): AnnualBlockKind {
  if (source === 'bb') return 'BB';
  // BB-фазы встречаются в ПЛ-макроцикле у BB-kind блоков (bodybuilding goal).
  return phase === 'hypertrophy' || phase === 'contest_prep' ? 'BB' : 'PL';
}

/**
 * Скопировать настройки блока-источника в блок-цель (конструктор + конфиг:
 * цикл/сплит/цель/taper/пик/шаблон). Целевой блок помечается 'stale',
 * результат сохраняется. Возвращает НОВЫЙ план.
 */
export function cloneBlockConfigFrom(
  plan: AnnualTrainingPlan,
  targetKey: string,
  sourceKey: string,
): AnnualTrainingPlan {
  const targetIdx = findBlockIndex(plan, targetKey);
  const sourceIdx = findBlockIndex(plan, sourceKey);
  if (targetIdx < 0 || sourceIdx < 0 || targetKey === sourceKey) return plan;
  const blocks = [...plan.blocks];
  const source = blocks[sourceIdx];
  const target = blocks[targetIdx];
  const config: AnnualBlockConfig = JSON.parse(JSON.stringify(source.config ?? {}));
  const ref = { ...target.ref, kind: source.ref.kind };
  const status: MacroBlockBuildStatus = target.status === 'unbuilt' ? 'unbuilt' : 'stale';
  blocks[targetIdx] = { ...target, ref, config, status };
  return {
    ...plan,
    blocks,
    direction: directionFromKinds(blocks.map(b => b.ref.kind)),
    status: planStatusFromBlocks(blocks),
    updatedAt: nowIso(),
  };
}

/**
 * Проверить календарную целостность годового плана: блоки должны покрывать
 * недели 1..totalWeeks без пропусков и перекрытий.
 */
export function validateAnnualPlan(plan: AnnualTrainingPlan): AnnualPlanValidation {
  const warnings: string[] = [];
  const gaps: AnnualPlanValidation['gaps'] = [];
  const overlaps: AnnualPlanValidation['overlaps'] = [];
  const outOfRange: string[] = [];
  const sorted = [...plan.blocks].sort((a, b) => a.ref.startWeek - b.ref.startWeek);
  let cursor = 1;
  for (const b of sorted) {
    if (b.ref.startWeek < 1 || b.ref.startWeek + b.ref.weeks - 1 > plan.totalWeeks) {
      outOfRange.push(b.ref.blockKey);
    }
    if (b.ref.startWeek > cursor) {
      gaps.push({ from: cursor, to: b.ref.startWeek - 1 });
      warnings.push(`пропуск нед ${cursor}–${b.ref.startWeek - 1}`);
    }
    if (b.ref.startWeek < cursor) {
      overlaps.push({ from: b.ref.startWeek, to: cursor - 1, blockKeys: [b.ref.blockKey] });
      warnings.push(`перекрытие нед ${b.ref.startWeek}–${cursor - 1}`);
    }
    cursor = Math.max(cursor, b.ref.startWeek + b.ref.weeks);
  }
  const totalMismatch = cursor - 1 !== plan.totalWeeks;
  if (totalMismatch) warnings.push(`сумма недель блоков ${cursor - 1} ≠ ${plan.totalWeeks}`);
  return { gaps, overlaps, totalMismatch, outOfRange, warnings };
}

/**
 * Изменить конфиг блока (цикл/сплит/taper/peak и т.д.).
 * Собранный блок помечается 'stale' — результат сохраняется, пользователь
 * решает, пересобирать ли. Возвращает НОВЫЙ план.
 */
export function setAnnualBlockConfig(
  plan: AnnualTrainingPlan,
  blockKey: string,
  patch: Partial<AnnualBlockConfig>,
): AnnualTrainingPlan {
  const idx = findBlockIndex(plan, blockKey);
  if (idx < 0) return plan;
  const blocks = [...plan.blocks];
  const block = blocks[idx];
  const config = { ...block.config, ...patch };
  const status: MacroBlockBuildStatus = block.status === 'unbuilt' ? 'unbuilt' : 'stale';
  blocks[idx] = { ...block, config, status };
  return { ...plan, blocks, status: planStatusFromBlocks(blocks), updatedAt: nowIso() };
}

/**
 * Сменить тип конструктора блока (ПЛ/ББ/ручной). Собранный результат
 * сохраняется, блок помечается 'stale' (пересборка новым конструктором).
 */
export function setAnnualBlockKind(
  plan: AnnualTrainingPlan,
  blockKey: string,
  kind: AnnualBlockKind,
): AnnualTrainingPlan {
  const idx = findBlockIndex(plan, blockKey);
  if (idx < 0) return plan;
  const blocks = [...plan.blocks];
  const block = blocks[idx];
  const ref = { ...block.ref, kind };
  const status: MacroBlockBuildStatus = block.status === 'unbuilt' ? 'unbuilt' : 'stale';
  blocks[idx] = { ...block, ref, status };
  return {
    ...plan,
    blocks,
    direction: directionFromKinds(blocks.map(b => b.ref.kind)),
    status: planStatusFromBlocks(blocks),
    updatedAt: nowIso(),
  };
}

/**
 * Ручной roundtrip: принять ОТРЕДАКТИРОВАННЫЕ недели блока (из ручного
 * конструктора). Статус → 'built', configHash синхронизируется с текущим
 * конфигом — блок не считается устаревшим и не пересобирается автоматически.
 */
export function updateAnnualBlockWeeks(
  plan: AnnualTrainingPlan,
  blockKey: string,
  weeks: UserWeek[],
  program?: UserProgram | null,
  warnings?: string[],
): AnnualTrainingPlan {
  const idx = findBlockIndex(plan, blockKey);
  if (idx < 0) return plan;
  const blocks = [...plan.blocks];
  const block = blocks[idx];
  const result: AnnualBlockBuildResult = {
    blockKey,
    kind: block.ref.kind,
    weeks: loopWeeksToLength(weeks, block.ref.weeks),
    program: program ?? block.result?.program ?? null,
    bbPlan: block.result?.bbPlan ?? null,
    warnings: warnings ?? block.result?.warnings ?? [],
    taperApplied: block.result?.taperApplied ?? false,
    peakApplied: block.result?.peakApplied ?? false,
    configHash: configHashOf(block.config, block.ref),
  };
  blocks[idx] = { ...block, status: 'built', result, builtAt: nowIso(), error: undefined };
  return { ...plan, blocks, status: planStatusFromBlocks(blocks), updatedAt: nowIso() };
}

/**
 * Импортировать UserProgram в блок годового плана (ручной roundtrip).
 * Берёт недели из bb.weeks / hybrid.bbWeeks; для PL-программ — скелет не
 * заменяется, обновляется только program (веса/цикл остаются ссылочными).
 */
export function importProgramIntoAnnualBlock(
  plan: AnnualTrainingPlan,
  blockKey: string,
  program: UserProgram,
): AnnualTrainingPlan {
  const idx = findBlockIndex(plan, blockKey);
  if (idx < 0) return plan;
  const block = plan.blocks[idx];
  const weeks = program.bb?.weeks ?? program.hybrid?.bbWeeks ?? block.result?.weeks ?? [];
  return updateAnnualBlockWeeks(plan, blockKey, weeks, program, ['Импортировано из ручного конструктора.']);
}

/* ─────────────────────────── Композиция года ────────────────────────────── */

/**
 * Собрать единую UserProgram из собранных блоков:
 *  - только BB/MANUAL → direction 'bb';
 *  - есть PL и не-PL → 'hybrid' (plRef из первого PL-блока + bbWeeks);
 *  - только PL → программа первого PL-блока со сводкой блоков в notes.
 * Несобранные блоки пропускаются с предупреждением в notes.
 */
export function composeAnnualProgram(plan: AnnualTrainingPlan, title?: string): UserProgram | null {
  const builtBlocks = plan.blocks.filter(b => b.status === 'built' && b.result);
  if (builtBlocks.length === 0) return null;
  const kinds = builtBlocks.map(b => b.ref.kind);
  const hasPL = kinds.includes('PL');
  const hasNonPL = kinds.some(k => k !== 'PL');
  const warnings = plan.blocks
    .filter(b => b.status !== 'built')
    .map(b => `блок «${b.ref.description ?? b.ref.phase}» не собран`);
  const blockSummary = builtBlocks.map(b =>
    `нед ${b.ref.startWeek}-${b.ref.startWeek + b.ref.weeks - 1}: ${b.ref.phase} (${b.ref.kind})`).join('; ');

  if (!hasPL) {
    const prog = createBlank('bb');
    prog.meta.title = title ?? `Годовой план (${plan.totalWeeks} нед)`;
    prog.meta.weeks = plan.totalWeeks;
    prog.meta.daysPerWeek = Math.max(1, ...builtBlocks.map(b => b.result?.weeks?.[0]?.sessions?.length ?? 3));
    const merged = mergeBlockWeeks(plan);
    if (prog.bb) prog.bb.weeks = merged;
    prog.meta.notes = [blockSummary, ...(warnings.length ? ['⚠ ' + warnings.join('; ')] : [])].join('\n');
    return prog;
  }

  const plBlock = builtBlocks.find(b => b.ref.kind === 'PL')!;
  const notesLine = [blockSummary, ...(warnings.length ? ['⚠ ' + warnings.join('; ')] : [])].join('\n');
  if (!hasNonPL) {
    const prog = plBlock.result!.program ?? createBlank('pl');
    prog.meta.title = title ?? `Годовой план ПЛ (${plan.totalWeeks} нед)`;
    prog.meta.weeks = plan.totalWeeks;
    prog.meta.notes = notesLine;
    if (prog.pl) {
      prog.pl.notes = [prog.pl.notes, notesLine].filter(Boolean).join('\n');
    }
    return prog;
  }

  const prog = createBlank('hybrid');
  prog.meta.title = title ?? `Годовой план (гибрид, ${plan.totalWeeks} нед)`;
  prog.meta.weeks = plan.totalWeeks;
  prog.meta.daysPerWeek = Math.max(1, ...builtBlocks.map(b => b.result?.weeks?.[0]?.sessions?.length ?? 3));
  prog.meta.notes = notesLine;
  if (prog.hybrid) {
    const plProg = plBlock.result?.program;
    prog.hybrid.plRef = {
      sourceCycleId: plProg?.pl?.sourceCycleId ?? '',
      sessionIndices: (plProg?.pl?.schedule ?? []).map(s => s.sessionIdx),
    };
    prog.hybrid.bbWeeks = mergeBlockWeeks(plan);
    prog.hybrid.workMax = plProg?.pl?.workMax;
    prog.hybrid.notes = notesLine;
  }
  return prog;
}

/** Склеить недели собранных блоков с перенумерацией (1..totalWeeks). */
export function mergeBlockWeeks(plan: AnnualTrainingPlan): UserWeek[] {
  const out: UserWeek[] = [];
  let weekNo = 1;
  for (const block of plan.blocks) {
    const weeks = block.result?.weeks ?? [];
    for (const w of weeks) {
      out.push({ ...w, week: weekNo });
      weekNo += 1;
    }
  }
  return out;
}
