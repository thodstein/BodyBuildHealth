/**
 * lms-comp-gap.engine.ts — ПЛ-циклы МЕЖДУ соревнованиями (задача 2 плана).
 *
 * Если выбранный цикл больше чистого тренировочного окна между стартами
 * (например 8-нед цикл при 12 нед между соревнованиями, из которых 3 нед тапер +
 * старт + пост), цикл УЖИМАЕТСЯ через fitCycleToWeeks БЕЗ потери логики
 * (фазы/темп сохранены), под каждый старт применяется taper/пик через
 * buildPLSeasonPeaks, и ни одна неделя между стартами не простаивает.
 *
 * Цикл на каждый пролёт можно АВТО-подобрать (лучший из candidateCyclesForSlot)
 * или ВЫБРАТЬ ВРУЧНУЮ из подходящих в базе (mode:'manual' + selections).
 *
 * Аддитивный: buildPLSeasonPeaks / appendPLTaperWeeks НЕ меняются — используются как есть.
 */
import { buildLMSPlan, originalCycleWeeks, type LMSBuildInput, type LMSPlanWeek } from './lms-builder.engine';
import { buildPLSeasonPeaks, type MacroTaperOpts, type PLSeasonMeet } from './lms-macro-taper.engine';
import { candidateCyclesForSlot, fitCycleToWeeks, type PLSeasonPeriod, type PLSeasonSlot } from './lms-season.engine';
import type { LMSRankedCycle, LMSSelectorInput } from './lms-selector.engine';
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import type { PED } from '../bb/bb-ped-adaptation.engine';
import type { AthleteContext, AthleteMode } from '../athlete-context.engine';

export interface GapSegment {
  meetId: string;          // старт, К КОТОРОМУ ведёт сегмент
  meetName: string;
  meetWeek: number;
  startWeek: number;       // 1-индекс первой недели сегмента
  endWeek: number;         // 1-индекс последней недели сегмента (вкл. meet+post)
  availableWeeks: number;  // чистое тренировочное окно (без тапера/старта/поста)
  cycleId: string;
  cycleTitle: string;
  cycleWeeks: number;      // исходная длина выбранного цикла
  fitWeeks: number | null; // ужатая/растянутая длина (null = окно слишком мало)
  fitMode: 'exact' | 'extend' | 'shrink' | 'skip';
  fittedCycle: SRCycleTemplate | null; // производный шаблон (сжатый/растянутый)
  taperWeeks: number;
  candidates: LMSRankedCycle[];
  notes: string[];
}

export interface GapSlotInput {
  period?: PLSeasonPeriod;          // фаза между стартами (по умолчанию strength)
  weeks?: number;                   // пользовательское число недель слота (по умолчанию = окно)
  weeksMin?: number;
  weeksMax?: number;
}

export interface CompGapOptions {
  selector: LMSSelectorInput;
  mode?: 'auto' | 'manual';
  selections?: Record<number, string>;   // manual: id цикла на индекс пролёта
  cycleForGap?: (gapIndex: number) => SRCycleTemplate | undefined; // прямой выбор (без кандидатов)
  slotForGap?: (gapIndex: number) => GapSlotInput;                 // переопределение фазы окна
  taper?: MacroTaperOpts;
  minCycleFloor?: number;
}

export interface CompGapBuildResult {
  segments: GapSegment[];
  totalPlanWeeks: number;
  weeks: LMSPlanWeek[];   // финальные недели сезона (с пик-блоками buildPLSeasonPeaks)
  notes: string[];
}

export interface CompGapBuildOptions extends CompGapOptions {
  // Параметры сборки недель (как в assembleSeasonPlan):
  pmMap: Record<string, number>;
  fallbackPm?: number;
  progressionMode?: LMSBuildInput['mode'];
  courseIntensity?: LMSBuildInput['courseIntensity'];
  peds?: PED[];
  pedDoses?: Record<string, number>;
  nutrition?: LMSBuildInput['nutrition'];
  acwr?: LMSBuildInput['acwr'];
  autoReg?: LMSBuildInput['autoReg'];
  pmAutoReg?: LMSBuildInput['pmAutoReg'];
  volumeGoal?: LMSBuildInput['volumeGoal'];
  focusLift?: LMSBuildInput['focusLift'];
  currentReadiness?: number;
  equipment?: string[];
  weakPoints?: string[];
  plWeakPoints?: LMSBuildInput['plWeakPoints'];
  weakGroupDayMap?: LMSBuildInput['weakGroupDayMap'];
  plWeakPointDayMap?: LMSBuildInput['plWeakPointDayMap'];
  weakGroupExerciseMap?: LMSBuildInput['weakGroupExerciseMap'];
  plWeakPointExerciseMap?: LMSBuildInput['plWeakPointExerciseMap'];
  orthopedicBlockedPatterns?: string[];
  diagnosticExerciseMap?: LMSBuildInput['diagnosticExerciseMap'];
  diagnosticDayMap?: LMSBuildInput['diagnosticDayMap'];
  limiterExerciseMap?: LMSBuildInput['limiterExerciseMap'];
  limiterProtocolMap?: LMSBuildInput['limiterProtocolMap'];
  limiterDayMap?: LMSBuildInput['limiterDayMap'];
  athleteMode?: AthleteMode;
  athleteContext?: AthleteContext;
  recovery?: Pick<LMSBuildInput, 'bodyFat' | 'leanMass' | 'hrvMs' | 'sleepHours' | 'stressLevel'>;
}

function slotFromGap(
  availableWeeks: number,
  gapIndex: number,
  opts: CompGapOptions,
): Pick<PLSeasonSlot, 'period' | 'weeks' | 'weeksMin' | 'weeksMax'> {
  const custom = opts.slotForGap ? opts.slotForGap(gapIndex) : undefined;
  const period: PLSeasonPeriod = custom?.period ?? (availableWeeks >= 12 ? 'endurance' : 'strength');
  const weeks = custom?.weeks ?? availableWeeks;
  const min = custom?.weeksMin ?? Math.min(6, Math.max(1, availableWeeks));
  const max = custom?.weeksMax ?? Math.max(min, availableWeeks);
  return { period, weeks, weeksMin: min, weeksMax: max };
}

export function planBetweenCompetitions(
  meets: PLSeasonMeet[],
  opts: CompGapBuildOptions,
): CompGapBuildResult {
  const sorted = (meets ?? [])
    .filter((m) => m && Number.isFinite(m.weeksToStart) && m.weeksToStart >= 1)
    .slice()
    .sort((a, b) => a.weeksToStart - b.weeksToStart);
  const taper = opts.taper ?? {};
  const taperW = Math.max(1, Math.round(taper.windowWeeks ?? taper.taperWeeksPerBlock ?? 2));
  const postW = taper.postMeet ? 1 : 0;
  const floor = Math.max(1, Math.round(opts.minCycleFloor ?? 4));
  const notes: string[] = [];
  const segments: GapSegment[] = [];

  if (sorted.length === 0) {
    return { segments: [], totalPlanWeeks: 0, weeks: [], notes: ['⚠ Нет соревнований — сезон не построен.'] };
  }

  const horizon = sorted[sorted.length - 1].weeksToStart + postW;

  // 1) Считаем окна пролётов и выбираем/подгоняем циклы.
  sorted.forEach((meet, j) => {
    const prev = j > 0 ? sorted[j - 1] : undefined;
    const available = prev
      ? meet.weeksToStart - prev.weeksToStart - 1 - taperW - postW
      : meet.weeksToStart - 1 - taperW;
    const startWeek = prev ? prev.weeksToStart + 1 + postW : 1;
    const endWeek = meet.weeksToStart + postW;

    // Выбор цикла на пролёт.
    const slot = slotFromGap(available, j, opts);
    const candidates = candidateCyclesForSlot(slot, opts.selector);
    let chosen: LMSRankedCycle | undefined;
    if (opts.cycleForGap) {
      const direct = opts.cycleForGap(j);
      if (direct) {
        chosen = { cycle: direct, score: 0, rationale: ['цикл выбран напрямую'], warnings: [] };
      }
    }
    if (!chosen && opts.mode === 'manual') {
      const sel = opts.selections?.[j];
      if (sel) {
        const found = candidates.find((r) => r.cycle.meta.id === sel);
        if (found) chosen = found;
        else notes.push(`⚠ Пролёт к «${meet.name}»: цикл «${sel}» не подходит — выбран лучший из подходящих`);
      } else {
        notes.push(`⚠ Пролёт к «${meet.name}»: цикл не выбран — выбран лучший из подходящих`);
      }
    }
    if (!chosen) chosen = candidates[0];

    if (!chosen) {
      notes.push(`⚠ Пролёт к «${meet.name}» (нед ${meet.weeksToStart}): нет подходящих циклов в базе — только поддерживающий объём`);
      segments.push({
        meetId: meet.id, meetName: meet.name, meetWeek: meet.weeksToStart,
        startWeek, endWeek, availableWeeks: available,
        cycleId: '', cycleTitle: 'Нет подходящего цикла', cycleWeeks: 0,
        fitWeeks: null, fitMode: 'skip', fittedCycle: null, taperWeeks: taperW, candidates, notes,
      });
      return;
    }

    const fit = fitCycleToWeeks(chosen.cycle, Math.max(1, available), { minCycleFloor: 1 });
    // Окна нет вовсе (до старта 0 недель) — только стартовая неделя с прикидами.
    const noWindow = available < 1;
    const fitWeeks = fit.weeks > 0 ? fit.weeks : (noWindow ? 1 : null);
    const fitMode = noWindow ? ('skip' as const) : fit.weeks === 0 ? ('skip' as const) : (fit.mode as GapSegment['fitMode']);
    const segNotes = [
      `Пролёт к «${meet.name}» (нед ${meet.weeksToStart}): окно ${available} нед, тапер ${taperW} нед${postW ? ' + пост' : ''}, цикл «${chosen.cycle.meta.title}» (${originalCycleWeeks(chosen.cycle)} нед)`,
      ...fit.notes,
    ];
    if (noWindow) segNotes.push('окно между стартами слишком мало — только стартовая неделя с прикидами (время не простаивает)');
    else if (available < floor) segNotes.push(`окно меньше комфортного минимума (${floor} нед) — цикл ужат до ${fitWeeks} нед`);
    segments.push({
      meetId: meet.id, meetName: meet.name, meetWeek: meet.weeksToStart,
      startWeek, endWeek, availableWeeks: available,
      cycleId: chosen.cycle.meta.id, cycleTitle: chosen.cycle.meta.title,
      cycleWeeks: originalCycleWeeks(chosen.cycle), fitWeeks, fitMode,
      fittedCycle: fit.cycle, taperWeeks: taperW, candidates, notes: segNotes,
    });
  });

  // 2) Собираем базовые недели сезона: каждый пролёт заполняется своим циклом
  //    (циклически), meet/post/тапер-недели будут перекрыты пик-блоком.
  const placeholder = (week: number): LMSPlanWeek => ({ week, pmRow: {}, days: [], macroPhase: 'endurance' });

  // Предварительная сборка плана каждого пролёта ОДИН раз (детерминизм, без повторов).
  const segOutputs = new Map<number, LMSPlanWeek[]>();
  segments.forEach((seg, j) => {
    if (!seg.fittedCycle || seg.fitWeeks == null || seg.fitWeeks < 1) return;
    const out = buildLMSPlan({
      template: seg.fittedCycle,
      pmMap: opts.pmMap,
      fallbackPm: opts.fallbackPm,
      mode: opts.progressionMode,
      courseIntensity: opts.courseIntensity,
      weeksOverride: seg.fitWeeks,
      progressionEnabled: true,
      faithful: true,
      volumeGoal: opts.volumeGoal,
      focusLift: opts.focusLift,
      currentReadiness: opts.currentReadiness,
      equipment: opts.equipment,
      weakPoints: opts.weakPoints,
      plWeakPoints: opts.plWeakPoints,
      weakGroupDayMap: opts.weakGroupDayMap,
      plWeakPointDayMap: opts.plWeakPointDayMap,
      weakGroupExerciseMap: opts.weakGroupExerciseMap,
      plWeakPointExerciseMap: opts.plWeakPointExerciseMap,
      orthopedicBlockedPatterns: opts.orthopedicBlockedPatterns,
      diagnosticExerciseMap: opts.diagnosticExerciseMap,
      diagnosticDayMap: opts.diagnosticDayMap,
      limiterExerciseMap: opts.limiterExerciseMap,
      limiterProtocolMap: opts.limiterProtocolMap,
      limiterDayMap: opts.limiterDayMap,
      peds: opts.peds,
      pedDoses: opts.pedDoses,
      nutrition: opts.nutrition,
      acwr: opts.acwr,
      autoReg: opts.autoReg,
      pmAutoReg: opts.pmAutoReg,
      athleteMode: opts.athleteMode,
      athleteContext: opts.athleteContext,
      ...(opts.recovery ?? {}),
    });
    segOutputs.set(j, out.weeks.length > 0 ? out.weeks : [placeholder(1)]);
  });

  const baseWeeks: LMSPlanWeek[] = [];
  for (let w = 1; w <= horizon; w++) {
    const segIdx = segments.findIndex((s) => w >= s.startWeek && w <= s.endWeek);
    const seg = segIdx >= 0 ? segments[segIdx] : segments[segments.length - 1];
    if (!seg || seg.fitWeeks == null || seg.fitWeeks < 1) {
      baseWeeks.push(placeholder(w));
      continue;
    }
    const fitCycleWeeks = segOutputs.get(segIdx >= 0 ? segIdx : segments.length - 1) ?? [placeholder(1)];
    const rel = (w - seg.startWeek) % fitCycleWeeks.length;
    const src = fitCycleWeeks[rel] ?? fitCycleWeeks[fitCycleWeeks.length - 1];
    baseWeeks.push({ ...src, week: w, macroPhase: 'endurance' });
  }

  // 3) Пик-блоки под каждый старт (вход в пик + mock + тапер + старт + пост).
  let weeks = baseWeeks;
  if (sorted.length > 0 && baseWeeks.length > 0) {
    const res = buildPLSeasonPeaks(baseWeeks, sorted, opts.taper ?? {});
    weeks = res.weeks;
    notes.push(...res.notes);
  }

  return { segments, totalPlanWeeks: weeks.length, weeks, notes };
}

/** Обёртка для UI: сгенерировать сезон между стартами с авто/ручным выбором циклов. */
export function buildSeasonWithCompWindow(meets: PLSeasonMeet[], opts: CompGapBuildOptions): CompGapBuildResult {
  return planBetweenCompetitions(meets, opts);
}