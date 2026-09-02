/**
 * lms-season.engine.ts — ПЛ-сезон по микроциклам (авто-сбор + ручной подбор).
 *
 * Задача 1 плана PL-AUTO-MICROCYCLES-PLAN.md:
 *   - 4 периода-слота: Выносливость 6–20 / Сила 6–12 / Скорость+координация 6–10 / Пик 8–10 нед;
 *   - АВТО: лучший подходящий цикл на каждый слот (rankCycles / speed-индекс);
 *   - РУЧНОЙ: пользователь выбирает цикл из подходящих в базе (candidateCyclesForSlot);
 *   - fitCycleToWeeks: растяжение (weeksOverride) ИЛИ сжатие цикла с сохранением логики
 *     (явные недели — фазовая выборка; week1+correctionPct — пересчёт темпа прогрессии);
 *     ЛЮБОЕ ИЗМЕНЕНИЕ РАСКЛАДКИ — ТОЛЬКО ПО СОГЛАСИЮ (needsConsent + applyFitConsent);
 *   - assembleSeasonPlan: склейка недель сегментов + опционально buildPLSeasonPeaks (задача 2).
 *
 * Аддитивный: не меняет сигнатуры существующих экспортов движка; только новые чистые функции.
 * Источник LMS_CYCLES — immutable канон, fit всегда возвращает производную копию.
 */
import { LMS_CYCLES, normalizeCycleDirection } from '../../data/lms-cycles/lms-cycle-index';
import { rankCycles, type LMSRankedCycle, type LMSSelectorInput } from './lms-selector.engine';
import type { SRCycleTemplate, SRDaySpec } from '../../data/lms-cycles/lms-types';
import { originalCycleWeeks, buildLMSPlan, type LMSBuildInput, type LMSBuildOutput, type LMSPlanWeek } from './lms-builder.engine';
import { buildPLSeasonPeaks, type MacroTaperOpts, type PLSeasonMeet } from './lms-macro-taper.engine';
import { speedOrientationOf } from '../../data/lms-cycles/lms-speed-index';
import type { PED } from '../bb/bb-ped-adaptation.engine';

// ─── Периоды-слоты ───────────────────────────────────────────────────────────────

export type PLSeasonPeriod = 'endurance' | 'strength' | 'speed' | 'peak';

export interface PLSeasonSlot {
  period: PLSeasonPeriod;
  label: string;       // «Выносливость», «Сила», «Скорость/координация», «Выход на пик»
  weeks: number;       // фактическая длина слота (редактируется пользователем)
  weeksMin: number;
  weeksMax: number;
  defaultWeeks: number;
  enabled: boolean;
}

export const PL_SEASON_PERIOD_LABEL: Record<PLSeasonPeriod, string> = {
  endurance: 'Выносливость',
  strength: 'Сила',
  speed: 'Скорость/координация',
  peak: 'Выход на пик',
};

/** Канонические 4 слота периода (диапазоны пользователя). */
export function buildDefaultSeasonSlots(): PLSeasonSlot[] {
  return [
    { period: 'endurance', label: 'Выносливость', weeks: 12, weeksMin: 6, weeksMax: 20, defaultWeeks: 12, enabled: true },
    { period: 'strength', label: 'Сила', weeks: 8, weeksMin: 6, weeksMax: 12, defaultWeeks: 8, enabled: true },
    { period: 'speed', label: 'Скорость/координация', weeks: 6, weeksMin: 6, weeksMax: 10, defaultWeeks: 6, enabled: true },
    { period: 'peak', label: 'Выход на пик', weeks: 8, weeksMin: 8, weeksMax: 10, defaultWeeks: 8, enabled: true },
  ];
}

/** Фабрика слота по периоду (для «+ Добавить период» — дубль). */
export function createSeasonSlot(period: PLSeasonPeriod): PLSeasonSlot {
  const base = buildDefaultSeasonSlots().find(s => s.period === period);
  if (base) return { ...base };
  // fallback
  return { period, label: PL_SEASON_PERIOD_LABEL[period] ?? period, weeks: 8, weeksMin: 6, weeksMax: 12, defaultWeeks: 8, enabled: true };
}

export function clampSlotWeeks(slot: PLSeasonSlot, weeks: number): number {
  const v = Number(weeks);
  if (!Number.isFinite(v)) return slot.defaultWeeks;
  return Math.max(slot.weeksMin, Math.min(slot.weeksMax, Math.round(v)));
}

// ─── Подгонка цикла под окно недель ─────────────────────────────────────────────

export interface FitResult {
  cycle: SRCycleTemplate;          // производный шаблон (сжатый/растянутый) или исходник при exact/skip
  weeks: number;                   // фактическая длина после подгонки (0 = невозможно/без согласия)
  mode: 'exact' | 'proposed_extend' | 'proposed_shrink' | 'strict_skip';
  correctionPctEff?: number;
  needsConsent: boolean;           // true → требуется согласие пользователя
  notes: string[];
}

export interface FitOptions {
  minCycleFloor?: number;           // default 4
}

/** Выборка индексов недель при сжатии: первая + равномерный шаг + последняя. */
function sampleIndices(n: number, target: number): number[] {
  if (target <= 0 || n <= 0) return [];
  if (target >= n) return Array.from({ length: n }, (_, i) => i);
  if (target === 1) return [n - 1]; // одна неделя — последняя (поддержка/прикиды)
  const step = (n - 1) / (target - 1);
  const idx = new Set<number>();
  for (let i = 0; i < target; i++) idx.add(Math.round(i * step));
  let arr = [...idx].sort((a, b) => a - b);
  if (arr.length !== target) {
    const out: number[] = [];
    for (let i = 0; i < target; i++) out.push(Math.floor((i * n) / target));
    if (out.length > 0 && out[out.length - 1] !== n - 1) out[out.length - 1] = n - 1;
    const seen = new Set<number>();
    const uniq: number[] = [];
    for (const x of out) if (!seen.has(x)) { seen.add(x); uniq.push(x); }
    while (uniq.length < target) uniq.push(n - 1);
    arr = uniq.slice(0, target);
  }
  return arr;
}

export function fitCycleToWeeks(
  cycle: SRCycleTemplate,
  targetWeeks: number,
  opts?: FitOptions,
): FitResult {
  const t = Number(targetWeeks);
  if (!cycle || !cycle.meta) {
    return { cycle: cycle as SRCycleTemplate, weeks: 0, mode: 'strict_skip', needsConsent: false, notes: ['цикл не передан'] };
  }
  if (!Number.isFinite(t) || t < 1) {
    return { cycle, weeks: 0, mode: 'strict_skip', needsConsent: false, notes: ['некорректное число недель'] };
  }
  const floor = Math.max(1, Math.round(opts?.minCycleFloor ?? 4));
  const orig = originalCycleWeeks(cycle);
  if (t < floor) {
    return { cycle, weeks: 0, mode: 'strict_skip', needsConsent: false, notes: [`окно слишком мало (${t} нед < минимальных ${floor} нед)`] };
  }
  if (t === orig) {
    return { cycle, weeks: t, mode: 'exact', needsConsent: false, notes: ['точное соответствие длине цикла'] };
  }
  if (t > orig) {
    // Растяжение: убираем явные недели (если были) — buildLMSPlan с weeksOverride
    // использует week1-шаблон + прогрессию correctionPct (логика цикла сохранена).
    const derived = { ...cycle, weeks: undefined, meta: { ...cycle.meta, weeks: t } };
    return {
      cycle: derived,
      weeks: t,
      mode: 'proposed_extend',
      needsConsent: true,
      notes: [`цикл растянут с ${orig} до ${t} нед — та же раскладка, темп прогрессии ${(cycle.meta.correctionPct * 100).toFixed(2)}%/нед (требует согласия)`],
    };
  }
  // Сжатие (t < orig) — логика цикла сохраняется, но только как предложение.
  const notes: string[] = [`цикл сжат с ${orig} до ${t} нед (предложение, требует согласия)`];
  const derivedMeta = { ...cycle.meta, weeks: t };
  let derived: SRCycleTemplate = { ...cycle, meta: derivedMeta };
  if (Array.isArray(cycle.weeks) && cycle.weeks.length > 0) {
    const idx = sampleIndices(cycle.weeks.length, t);
    const weeks = idx.map((i) => cycle.weeks![i]);
    derived = { ...derived, weeks };
    notes.push('явные недели источника: фазовая структура сохранена (первая и последняя недели на месте) — требует согласия');
  } else {
    const base = cycle.meta.correctionPct > 0 ? cycle.meta.correctionPct : 0.005;
    const eff = Math.min(base * (orig / t), base * 2);
    derived = { ...derived, meta: { ...derivedMeta, correctionPct: eff } };
    notes.push(`темп прогрессии скорректирован ${(base * 100).toFixed(2)}% → ${(eff * 100).toFixed(2)}%/нед — суммарный прирост ПМ за ${t} нед сохранён (требует согласия)`);
  }
  return { cycle: derived, weeks: t, mode: 'proposed_shrink', needsConsent: true, correctionPctEff: derived.meta.correctionPct, notes };
}

/**
 * Применить согласие пользователя к результату fitCycleToWeeks.
 * - consent=true  → возвращает исходный FitResult с needsConsent=false (применено по согласию)
 * - consent=false → возвращает strict_skip без изменения раскладки
 */
export function applyFitConsent(result: FitResult, consent: boolean): FitResult {
  if (!result.needsConsent) return result;
  if (consent) {
    return {
      ...result,
      needsConsent: false,
      notes: [...result.notes, '✓ применено по согласию пользователя'],
    };
  }
  return {
    cycle: result.cycle,
    weeks: 0,
    mode: 'strict_skip',
    needsConsent: false,
    notes: ['⛔ Без согласия — раскладка не изменена'],
  };
}

// ─── Кандидаты под слот ─────────────────────────────────────────────────────────

const LEVEL_ORDER = ['novice', 'II-KMS', 'II-MS', 'KMS-MS', 'intermediate', 'KMS-MSMK', 'MS-MSMK'];

function levelRankOf(level: string): number {
  const i = LEVEL_ORDER.indexOf(level);
  return i < 0 ? 3 : i;
}

/** Уровень близости направления: совпадение / совместимо / различие. */
function directionScore(input: LMSSelectorInput, cycle: SRCycleTemplate): { score: number; note: string; warn: boolean } {
  const req = input.direction;
  if (!req) return { score: 5, note: 'направление не задано', warn: false };
  if (cycle.meta.direction === req) return { score: 25, note: `направление «${cycle.meta.direction}» совпадает`, warn: false };
  const norm = normalizeCycleDirection(req) === normalizeCycleDirection(cycle.meta.direction);
  if (norm) return { score: 12, note: `направление «${cycle.meta.direction}» совместимо с «${req}»`, warn: false };
  return { score: -15, note: `направление «${cycle.meta.direction}» отличается от «${req}»`, warn: true };
}

export function candidateCyclesForSlot(
  slot: Pick<PLSeasonSlot, 'period' | 'weeks' | 'weeksMin' | 'weeksMax'>,
  input: LMSSelectorInput,
): LMSRankedCycle[] {
  const base = LMS_CYCLES.filter((c) => normalizeCycleDirection(c.meta.direction) !== 'bodybuilding');
  if (slot.period === 'speed') {
    const scored = base
      .filter((c) => speedOrientationOf(c).length > 0)
      .filter((c) => !input.direction || normalizeCycleDirection(c.meta.direction) === normalizeCycleDirection(input.direction))
      .map((cycle) => {
        let score = 0;
        const rationale: string[] = [];
        const warnings: string[] = [];
        const d = directionScore(input, cycle);
        score += d.score;
        if (d.warn) warnings.push(d.note); else rationale.push(d.note);
        const lvlDelta = Math.abs(levelRankOf(cycle.meta.level) - levelRankOf(input.level));
        if (lvlDelta === 0) { score += 30; rationale.push('уровень «' + cycle.meta.level + '» — точное совпадение'); }
        else if (lvlDelta === 1) { score += 15; rationale.push('уровень «' + cycle.meta.level + '» близок'); }
        else { score -= 10; warnings.push('уровень «' + cycle.meta.level + '» заметно отличается'); }
        if (input.bodyWeight != null && cycle.meta.minBodyWeight != null) {
          if (input.bodyWeight >= cycle.meta.minBodyWeight) { score += 10; rationale.push('вес ≥ минимума цикла'); }
          else { score -= 15; warnings.push('вес ниже минимума цикла'); }
        }
        if (input.daysPerWeek != null && cycle.meta.sessionsPerWeek > 0) {
          if (cycle.meta.sessionsPerWeek <= input.daysPerWeek) { score += 12; rationale.push(`нужно ${cycle.meta.sessionsPerWeek} дн/нед — доступно ${input.daysPerWeek}`); }
          else { score -= 18; warnings.push(`нужно ${cycle.meta.sessionsPerWeek} дн/нед — доступно только ${input.daysPerWeek}`); }
        }
        const fitNote = speedFitNote(cycle, slot);
        if (fitNote) rationale.push(fitNote);
        return { cycle, score, rationale, warnings };
      }).sort((a, b) => b.score - a.score);
    if (scored.length > 0) return scored;
    // Fallback: нет скоростных циклов под фильтр → используем strength с пометкой (план 2.2)
    const fallback = rankCycles({ ...input, goal: 'strength' as const }).filter(
      (r) => normalizeCycleDirection(r.cycle.meta.direction) !== 'bodybuilding',
    ).map(r => ({
      ...r,
      rationale: [...r.rationale, '⚠ нет скоростных циклов под фильтр — показан strength с акцентом на скорость (метка плана)'],
      warnings: [...r.warnings, 'слот «Скорость» пуст в индексе — используйте strength-цикл с акцентом на скорость'],
    }));
    return fallback.sort((a, b) => b.score - a.score);
  }
  const goalMap: Record<'endurance' | 'strength' | 'peak', LMSSelectorInput['goal']> = {
    endurance: 'endurance',
    strength: 'strength',
    peak: 'peak',
  };
  const ranked = rankCycles({ ...input, goal: goalMap[slot.period] }).filter(
    (r) => normalizeCycleDirection(r.cycle.meta.direction) !== 'bodybuilding',
  );
  // Подмешиваем пометку «предлагается сжать» для циклов, длиннее максимума слота.
  return ranked.map((r) => {
    const ow = originalCycleWeeks(r.cycle);
    if (ow > slot.weeksMax) {
      const warnings = [...r.warnings, `длина ${ow} нед — предлагается сжать до ${slot.weeksMax} (впишется в окно слота, требует согласия)`];
      return { ...r, warnings };
    }
    return r;
  }).sort((a, b) => b.score - a.score);
}

function speedFitNote(cycle: SRCycleTemplate, slot: Pick<PLSeasonSlot, 'period' | 'weeks' | 'weeksMin' | 'weeksMax'>): string | null {
  const ow = originalCycleWeeks(cycle);
  const orient = speedOrientationOf(cycle).join(', ');
  if (ow <= slot.weeksMax) return `длина ${ow} нед вписывается в окно слота (${slot.weeksMin}-${slot.weeksMax}) · скорость: ${orient}`;
  return `длина ${ow} нед — предлагается сжать до ${slot.weeksMax} · скорость: ${orient} (требует согласия)`;
}

// ─── Авто-сбор сезона ───────────────────────────────────────────────────────────

export interface PLSeasonInput {
  slots: PLSeasonSlot[];
  selector: LMSSelectorInput;
  mode: 'auto' | 'manual';
  selections?: Record<number, string>; // manual: id цикла на слот по индексу
  consents?: Record<number, boolean>;  // согласие на изменение каждого слота (slotIdx → true/false)
  taper?: MacroTaperOpts;
  meets?: PLSeasonMeet[];
}

export interface PLSeasonSegment {
  slot: PLSeasonSlot;
  cycleId: string;
  cycleTitle: string;
  weeks: number;
  fit: FitResult;
  candidates?: LMSRankedCycle[];
  rationale: string[];
}

export interface PLSeasonPlan {
  segments: PLSeasonSegment[];
  totalWeeks: number;
  notes: string[];
  cycleIds: string[];
}

export function planSeason(input: PLSeasonInput): PLSeasonPlan {
  const slots = (input.slots ?? []).filter((s) => s && s.period && s.enabled !== false);
  const segments: PLSeasonSegment[] = [];
  const notes: string[] = [];
  const cycleIds: string[] = [];
  slots.forEach((slot, i) => {
    const candidates = candidateCyclesForSlot(slot, input.selector);
    let chosen: LMSRankedCycle | undefined;
    if (input.mode === 'manual') {
      const sel = input.selections?.[i];
      if (sel) {
        const found = candidates.find((r) => r.cycle.meta.id === sel);
        if (found) chosen = found;
        else notes.push(`⚠ слот ${i + 1} («${slot.label}»): цикл «${sel}» не подходит — выбран лучший из подходящих`);
      } else {
        notes.push(`⚠ слот ${i + 1} («${slot.label}»): цикл не выбран — выбран лучший из подходящих`);
      }
    }
    if (!chosen) chosen = candidates[0];
    if (!chosen) {
      notes.push(`⚠ слот ${i + 1} («${slot.label}»): нет подходящих циклов в базе — слот пропущен`);
      return;
    }
    let fit = fitCycleToWeeks(chosen.cycle, slot.weeks, { minCycleFloor: 4 });
    // Любое изменение требует согласия
    if (fit.needsConsent) {
      const consent = input.consents?.[i] === true;
      fit = applyFitConsent(fit, consent);
      if (fit.mode === 'strict_skip') {
        notes.push(`⛔ слот ${i + 1} («${slot.label}»): требует согласия на изменение ${originalCycleWeeks(chosen.cycle)}→${slot.weeks} нед — сегмент пропущен`);
      }
    }
    const weeks = fit.weeks > 0 ? fit.weeks : 0;
    const rationale = [...chosen.rationale, ...chosen.warnings, ...fit.notes];
    // strict_skip сегменты всё равно пушим для UI (чтобы показать бейдж), но weeks=0 не считаем в total
    segments.push({
      slot,
      cycleId: chosen.cycle.meta.id,
      cycleTitle: chosen.cycle.meta.title,
      weeks,
      fit,
      candidates: input.mode === 'manual' ? candidates : undefined,
      rationale,
    });
    if (weeks > 0) cycleIds.push(chosen.cycle.meta.id);
  });
  const totalWeeks = segments.reduce((sum, seg) => sum + seg.weeks, 0);
  const seasonNotes = notes.concat(
    segments.filter(s => s.weeks > 0).map((seg, idx) => {
      // Пересчитываем индексы только для ненулевых сегментов для отображения, но используем общий weekRange
      return `нед ${weekRangeOf(segments, segments.indexOf(seg))}: ${seg.cycleTitle} (${seg.weeks} нед${seg.fit.needsConsent ? '' : seg.fit.mode === 'proposed_shrink' || seg.fit.mode === 'proposed_extend' ? ' по согласию' : ''})`;
    }),
  );
  // Если есть strict_skip сегменты — добавляем итоговое предупреждение
  const blocked = segments.filter(s => s.fit.mode === 'strict_skip');
  if (blocked.length > 0) {
    seasonNotes.push(`⛔ ${blocked.length} слот(ов) требуют согласия на изменение раскладки — сборка заблокирована до решения`);
  }
  return { segments, totalWeeks, notes: seasonNotes, cycleIds };
}

function weekRangeOf(segments: PLSeasonSegment[], idx: number): string {
  let start = 1;
  for (let i = 0; i < idx; i++) start += segments[i].weeks;
  const end = start + segments[idx].weeks - 1;
  if (segments[idx].weeks === 0) return '—';
  return start === end ? `${start}` : `${start}–${end}`;
}

// ─── Сборка недель сезона ───────────────────────────────────────────────────────

export interface AssembleSeasonOptions {
  pmMap: Record<string, number>;
  fallbackPm?: number;
  mode?: LMSBuildInput['mode'];
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
  recovery?: Pick<LMSBuildInput, 'bodyFat' | 'leanMass' | 'hrvMs' | 'sleepHours' | 'stressLevel'>;
  taper?: MacroTaperOpts;
  meets?: PLSeasonMeet[];
}

export function assembleSeasonPlan(plan: PLSeasonPlan, opts: AssembleSeasonOptions): LMSBuildOutput {
  const activeSegments = plan.segments.filter(s => s.weeks > 0 && s.fit.mode !== 'strict_skip');
  const allWeeks: LMSPlanWeek[] = [];
  const outputs: LMSBuildOutput[] = [];
  let weekCursor = 1;
  for (const seg of activeSegments) {
    const out = buildLMSPlan({
      template: seg.fit.cycle,
      pmMap: opts.pmMap,
      fallbackPm: opts.fallbackPm,
      mode: opts.mode,
      courseIntensity: opts.courseIntensity,
      weeksOverride: seg.weeks,
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
      ...(opts.recovery ?? {}),
    });
    outputs.push(out);
    const renumbered = out.weeks.map((w, i) => ({ ...w, week: weekCursor + i, macroPhase: seg.slot.period }));
    allWeeks.push(...renumbered);
    weekCursor += seg.weeks;
  }
  let weeks = allWeeks;
  const notes: string[] = [...plan.notes];
  if (opts.meets && opts.meets.length > 0 && weeks.length > 0) {
    const res = buildPLSeasonPeaks(weeks, opts.meets, opts.taper ?? {});
    weeks = res.weeks;
    notes.push(...res.notes);
  }
  // Если все сегменты заблокированы согласием — возвращаем пустой план с предупреждением
  if (activeSegments.length === 0) {
    const template = plan.segments[0]?.fit.cycle as SRCycleTemplate | undefined ?? (LMS_CYCLES[0] as unknown as SRCycleTemplate);
    return {
      template,
      progressionRationale: notes.join('\n') || '⛔ Сборка заблокирована — требуется согласие на изменение раскладки',
      weeks: [],
      cycleMetrics: {} as LMSBuildOutput['cycleMetrics'],
    };
  }
  const first = outputs[0];
  const template = first?.template ?? (activeSegments[0]?.fit.cycle as SRCycleTemplate | undefined) ?? (LMS_CYCLES[0] as unknown as SRCycleTemplate);
  return {
    template,
    progressionRationale: notes.join('\n'),
    weeks,
    cycleMetrics: first?.cycleMetrics ?? ({} as LMSBuildOutput['cycleMetrics']),
  };
}

// ─── Сегменты недель для UI (компактная сводка «нед X–Y: цикл (N нед)») ─────────

export function seasonSegmentSummary(segments: PLSeasonSegment[]): string {
  if (segments.length === 0) return '— нет активных слотов —';
  const hasBlocked = segments.some(s => s.fit.mode === 'strict_skip');
  const active = segments.filter(s => s.weeks > 0);
  const parts: string[] = [];
  // Активные
  for (const seg of active) {
    const idx = segments.indexOf(seg);
    const range = weekRangeOf(segments, idx);
    const consentTag = seg.fit.needsConsent ? '' : (seg.fit.mode === 'proposed_shrink' || seg.fit.mode === 'proposed_extend' ? ' по согласию' : '');
    const modeTag = seg.fit.mode === 'proposed_shrink' ? ', предлагается сжать' : seg.fit.mode === 'proposed_extend' ? ', предлагается растянуть' : '';
    parts.push(`${range}: ${seg.cycleTitle} (${seg.weeks} нед${consentTag}${modeTag})`);
  }
  // Заблокированные — отдельной строкой, чтобы не терялись
  for (const seg of segments.filter(s => s.fit.mode === 'strict_skip')) {
    const idx = segments.indexOf(seg);
    const range = weekRangeOf(segments, idx);
    parts.push(`${range}: ${seg.cycleTitle} (⛔ без согласия — пропущен)`);
  }
  return parts.join(' → ') || '— нет активных слотов —';
}

/** Тип-гард для SRCycleTemplate с явной многонедельной раскладкой. */
export function hasExplicitWeeks(cycle: SRCycleTemplate): cycle is SRCycleTemplate & { weeks: SRDaySpec[][] } {
  return Array.isArray(cycle.weeks) && cycle.weeks.length > 0;
}
