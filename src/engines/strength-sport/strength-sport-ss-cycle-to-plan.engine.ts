/**
 * strength-sport-ss-cycle-to-plan.engine.ts — интернет-цикл → StrengthSportPlan.
 * Два режима (выбор пользователя, дефолт faithful):
 * - faithful (дословный): сеты/повторы/% из шаблона 1-в-1, веса = ПМ × % (×tmFactor),
 *   БЕЗ дрейфа pmForWeek и БЕЗ авто-срезок объёма (ACWR/outside/VBT не режут —
 *   это и есть «дословно»). Безопасность: травмы (gentle ×0.6-0.7, RIR+1) и
 *   фолбэк снарядов (STRONG_FALLBACK_COEFF + бейдж) применяются всегда.
 * - adapt: faithful + поверх гарды билдера (ACWR/outside/VBT объём, RIR-шифты,
 *   pmForWeek-дрейф по лифту, per-lift VBT-history, diaryTrend-e1RM, HRV-вес,
 *   весогонка-объём).
 * Привязка к дате старта: mock/taper-недели из meta якорятся к competitionDate
 * в rationale (строка «якорь: mock нед N → дата»), порядок недель не меняем.
 */
import { getSSCycleById } from '../../data/ss-cycles/ss-cycle-index';
import type { SSCycleTemplate, SSDaySpec, SSExerciseSpec } from '../../data/ss-cycles/ss-types';
import { basePmFor, isOly, isStrong, gentleFactor } from './strength-sport-pool.engine';
import { rirForWeek, phaseForWeek, pmForWeek } from './strength-sport-progression';
import { tempoForSS, restForSS } from './strength-sport-loading';
import { warmupRampFor } from './strength-sport-warmup';
import { EVENT_META, STRONG_FALLBACK_COEFF, isCarry as isCarryEvent } from './strength-sport-event-types';
import { TAPER_CESSATION_DAYS, WINWOOD_TAPER, WL_TAPER } from './strength-sport-taper.engine';
import { applyDUP } from './strength-sport-dup';
import { applyIntensity } from './strength-sport-intensity';
import { computeRecoveryMultiplier, computeNutritionMultiplier } from '../recovery-budget.engine';
import { adaptForPEDsSS } from './strength-sport-ped-adaptation';
import { buildWeightCutProtocolSS, weightCutVolumeMultiplierSS, validateWeightCutProtocolSS } from './strength-sport-weight-cut.engine';
import { hrvReport } from './strength-sport-hrv.engine';
import { velocityWeightAdjustFactor, diagnoseVelocityLossEwma } from './strength-sport-vbt.engine';
import { getExerciseById } from '../../core/exercise-catalog';
import { outsideVolumeMultiplier, type OutsideLoad } from '../outside-load.engine';
import type {
  StrengthSportInput, StrengthSportPlan, StrengthSportWeek,
  StrengthSportSession, StrengthSportExercise, StrengthSportSet,
} from './strength-sport.types';

export type SSCycleMode = 'faithful' | 'adapt';

export interface BuildSSCycleOpts {
  cycleMode?: SSCycleMode; // дефолт faithful (дословный)
  bodyweight?: number;
  sex?: 'male' | 'female';
}

function round25(v: number): number { return Math.round(v / 2.5) * 2.5; }

function phaseForCycleWeek(t: SSCycleTemplate, w: number, fallback: string): string {
  const ph = t.meta.phases?.find(p => w >= p.weekStart && w <= p.weekEnd)?.phase;
  if (!ph) return fallback;
  if (ph === 'base') return 'accumulation';
  if (ph === 'build') return 'intensification';
  if (ph === 'peak' || ph === 'test') return 'peaking';
  if (ph === 'deload') return 'deload';
  if (ph === 'taper') return 'peaking';
  return fallback;
}

function exMeta(id: string, fallbackName: string, fallbackGroup: string): { name: string; group: string; pattern: string } {
  try {
    const main: any = (getExerciseById as any)(id);
    if (main) {
      return {
        name: main.name || fallbackName || id,
        group: main.group || fallbackGroup || 'legs',
        pattern: main.movementPattern || (main as any).pattern || 'unknown',
      };
    }
  } catch { /* каталог недоступен — фолбэк ниже */ }
  return { name: fallbackName || id, group: fallbackGroup || 'legs', pattern: 'unknown' };
}

function baseForExercise(ex: SSExerciseSpec, workMax: StrengthSportInput['workMax']): number {
  if (ex.bodyweight) return 0;
  let base: number;
  if (ex.base && typeof (workMax as any)[ex.base] === 'number' && (workMax as any)[ex.base] > 0) {
    base = (workMax as any)[ex.base];
  } else {
    base = basePmFor(ex.id, workMax);
  }
  if (ex.baseMult) base = base * ex.baseMult;
  return base;
}

// Пороги потерь скорости по типу лифта — паритет с билдером (PLOS 2026)
function vbtThresholds(id: string): { low: number; high: number; isTA: boolean } {
  const isCarryVBT = ['yoke_walk', 'farmers_walk_heavy', 'frame_carry', 'husafell_carry', 'conan_wheel', 'shield_carry', 'truck_pull', 'arm_over_arm', 'sandbag_carry', 'sled_push', 'sled_drag', 'duck_walk'].some(k => id.includes(k.replace('_walk', '')) || id === k);
  const isTAPull = id.includes('pull') || id.includes('squat');
  const isTA = id.includes('snatch') || id.includes('clean') || id.includes('jerk');
  if (isTAPull) return { low: 15, high: 25, isTA };
  if (isTA) return { low: 10, high: 20, isTA };
  if (isCarryVBT) return { low: 15, high: 25, isTA };
  return { low: 20, high: 30, isTA };
}

function histLossFor(id: string, vHist: Record<string, number[]> | undefined): number {
  if (!vHist) return 0;
  const hist = vHist[id] || vHist[id.toLowerCase()] || (vHist as any)['all'];
  if (!Array.isArray(hist) || hist.length < 2) return 0;
  const best = Math.max(...hist);
  const last = hist[hist.length - 1];
  if (!(best > 0)) return 0;
  return ((best - last) / best) * 100;
}

// Матчинг тренда дневника — паритет с билдером (snatch/clean/squat/deadlift + exact)
function trendFor(id: string, trends: Array<{ lift: string; changePct: number }> | null | undefined): { lift: string; changePct: number } | null {
  if (!Array.isArray(trends) || !trends.length) return null;
  return trends.find(tr =>
    tr.lift === id ||
    (id.includes('snatch') && tr.lift === 'snatch') ||
    (id.includes('clean') && tr.lift === 'clean') ||
    (id.includes('squat') && tr.lift === 'squat') ||
    (id.includes('deadlift') && tr.lift === 'deadlift'),
  ) || null;
}

// Недельный бюджет сетов — формула билдера (level × PED × lab × nutrition × recovery)
function ssWeeklyBudget(input: StrengthSportInput, wcProto: any): number {
  const levelBase: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  const baseSets = levelBase[(input.level as string) || 'intermediate'] ?? 85;
  let mrvMult = 1;
  try { mrvMult = adaptForPEDsSS(input.peds, (input as any).pedDoses, (input as any).courseIntensity, !!wcProto)?.mrvMult ?? 1; } catch { /* PED недоступны */ }
  const lab = (input as any).labMrvMultiplier ?? 1;
  let nut = 1;
  try { nut = computeNutritionMultiplier({ calorieSurplus: (input as any).calorieSurplus, proteinPerKg: (input as any).proteinPerKg } as any); } catch { /* noop */ }
  let rec = 1;
  try {
    rec = computeRecoveryMultiplier({ bodyFat: (input as any).bodyFat, leanMass: (input as any).leanMass, hrvMs: (input as any).hrvMs, sleepHours: (input as any).sleepHours, stressLevel: (input as any).stressLevel });
  } catch { /* noop */ }
  return Math.round(baseSets * mrvMult * lab * nut * rec);
}

// Порядок методики — как orderByMethod билдера (по role; faithful порядок не трогаем)
function orderByMethodSS(exs: StrengthSportExercise[], method?: string): StrengthSportExercise[] {
  if (method === 'pre_exhaust') return [...exs].sort((a, b) => (a.role === 'accessory' ? -1 : 1) - (b.role === 'accessory' ? -1 : 1));
  if (method === 'post_exhaust') return [...exs].sort((a, b) => (a.role === 'primary' ? -1 : 1) - (b.role === 'primary' ? -1 : 1));
  return exs;
}

// Дата-тейпер по дням до старта — паритет с билдером (cessation + Winwood/WL)
function dateTaperForWeek(id: string, w: number, weeks: number, phase: string, ssMode: string, compDate: string | undefined, startDate: string | undefined): { setsMult: number; weightMult: number; rir: number; kind: 'cessation' | 'winwood'; daysOut: number } | null {
  if (!compDate || !startDate) return null;
  try {
    const wkStart = new Date(startDate);
    wkStart.setDate(wkStart.getDate() + (w - 1) * 7);
    const daysOut = Math.round((new Date(compDate).getTime() - wkStart.getTime()) / 86400000);
    if (daysOut < 0 || daysOut > 14 || phase === 'deload') return null;
    if (ssMode === 'weightlifting') {
      if (daysOut < 4) return { setsMult: 0.60, weightMult: 0.90, rir: 2, kind: 'cessation', daysOut };
      const tw: any = daysOut <= 7 ? (WL_TAPER as any)[1] : (WL_TAPER as any)[2];
      if (!tw) return null;
      return { setsMult: tw.volumeMult, weightMult: tw.intensityPctMult, rir: tw.assistance === 'none' ? 3 : tw.assistance === 'reduced' ? 2 : -1, kind: 'winwood', daysOut };
    }
    const need = (TAPER_CESSATION_DAYS as any)[id] ?? 5;
    if (daysOut < need) return { setsMult: 0.45, weightMult: 0.50, rir: 3, kind: 'cessation', daysOut };
    const tw: any = daysOut <= 3 ? (WINWOOD_TAPER as any)[1] : (WINWOOD_TAPER as any)[2];
    if (!tw) return null;
    return { setsMult: tw.volumeMult, weightMult: tw.intensityPctMult, rir: tw.assistance === 'none' ? 3 : tw.assistance === 'reduced' ? 2 : -1, kind: 'winwood', daysOut };
  } catch { return null; }
}

// HRV-вес — паритет с билдером (dangerous ×0.85, caution ×0.94), чтение guarded
function hrvWeightFactor(): { factor: number; zone: string | null } {
  try {
    if (typeof localStorage === 'undefined') return { factor: 1, zone: null };
    const raw = localStorage.getItem('he_hrv_log');
    if (!raw) return { factor: 1, zone: null };
    const arr = JSON.parse(raw);
    const vals = Array.isArray(arr)
      ? arr.map((s: any) => s.hrvMs ?? s.hrv ?? s.value).filter((v: any) => Number.isFinite(v) && v > 0)
      : [];
    if (vals.length < 7) return { factor: 1, zone: null };
    const rep = hrvReport(vals);
    if (!rep) return { factor: 1, zone: null };
    if ((rep as any).zone === 'dangerous') return { factor: 0.85, zone: 'dangerous' };
    if ((rep as any).zone === 'caution') return { factor: 0.94, zone: 'caution' };
    return { factor: 1, zone: (rep as any).zone || null };
  } catch { return { factor: 1, zone: null }; }
}

export function buildSSCyclePlan(
  templateOrId: SSCycleTemplate | string,
  input: StrengthSportInput,
  opts?: BuildSSCycleOpts,
): StrengthSportPlan {
  const t = typeof templateOrId === 'string' ? getSSCycleById(templateOrId) : templateOrId;
  if (!t) throw new Error(`SS-цикл не найден: ${String(templateOrId)}`);
  const mode = opts?.cycleMode || 'faithful';
  const weeks = t.meta.weeks;
  const goal = input.goal || 'strength';
  const ssMode = t.meta.mode === 'hybrid' ? (input.mode || 'hybrid') : t.meta.mode;
  const tm = t.meta.tmFactor ?? 1;
  const eq = (input.equipment || []).map(s => String(s).toLowerCase());
  const hasSpecialty = eq.includes('other') || eq.includes('specialty') || eq.length === 0;
  const sex = (opts?.sex || (input as any).sex) as 'male' | 'female' | undefined;
  const acwr = (input as any).acwr as { ratio: number; zone: string } | null | undefined;
  const vLoss = (input as any).velocityLossPct as number | undefined;
  const vHist = (input as any).velocityHistory as Record<string, number[]> | undefined;
  const trends = (input as any).diaryTrend as Array<{ lift: string; changePct: number }> | null | undefined;
  const outM = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  const bwForWc = (opts?.bodyweight || (input as any).bodyweight || 80) as number;
  const sexForWc = ((opts?.sex || (input as any).sex || 'male') === 'female' ? 'female' : 'male') as 'male' | 'female';
  // Весогонка — протокол как в билдере (объём режем только в adapt, валидация — всегда)
  const wcProtoInput: any = (input as any).weightCutProtocolSS || (input as any).weightCutProtocol || null;
  const wcLossKg: number | null = typeof (input as any).weightCutKg === 'number' ? (input as any).weightCutKg : null;
  let wcProto: any = null;
  try { wcProto = wcProtoInput || (wcLossKg ? buildWeightCutProtocolSS(wcLossKg, { startWeightKg: bwForWc } as any) : null); } catch { wcProto = wcProtoInput || null; }

  const rationale: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  rationale.push(`📚 Интернет-цикл: ${t.meta.title} · режим ${mode === 'faithful' ? 'дословный' : 'адаптированный'}`);
  if (tm !== 1) rationale.push(`Training max ×${tm} (проценты от 90% ПМ)`);
  if (t.meta.bulgarian) rationale.push('⚠ Daily-max протокол: максимумы дня, согласие получено, следите за ACWR/суставами');
  if (wcProto) {
    try {
      for (const e of validateWeightCutProtocolSS(wcProto, { bodyweightKg: bwForWc, sex: sexForWc })) warnings.push(e);
    } catch { /* валидация весогонки недоступна */ }
    const loss = (wcProto as any).targetLossKg ?? wcLossKg ?? '?';
    rationale.push(`Весогонка: −${loss}кг (вода/Na/угли по протоколу, объём режется в adapt)`);
  }
  // Якорь к дате старта
  if (input.competitionDate) {
    const anchors: string[] = [];
    if (t.meta.mockWeeks?.length) anchors.push(`mock нед ${t.meta.mockWeeks.join(',')}`);
    if (t.meta.taperWeeks?.length) anchors.push(`тейпер нед ${t.meta.taperWeeks.join(',')}`);
    if (anchors.length) rationale.push(`⚓ Якорь к старту ${input.competitionDate}: ${anchors.join(' · ')} (порядок недель не меняем)`);
  }

  const fallbackUsed = new Set<string>();
  const weeksData: StrengthSportWeek[] = [];
  const contestEvents: any[] = Array.isArray((input as any).contest?.events) ? (input as any).contest.events : [];
  const budget = ssWeeklyBudget(input, wcProto);
  let methodologyNoted = false;
  let dateTaperApplied = false;

  for (let w = 1; w <= weeks; w++) {
    const days: SSDaySpec[] = t.weeks[w - 1] || [];
    const fallbackPhase = phaseForWeek(w, weeks, goal, ssMode as any);
    const phase = phaseForCycleWeek(t, w, fallbackPhase) as any;
    const isDeload = phase === 'deload' || t.meta.deloadWeeks?.includes(w);
    const isTaper = !!t.meta.taperWeeks?.includes(w);
    const sessions: StrengthSportSession[] = [];
    let dayNo = 0;

    for (const d of days) {
      dayNo++;
      const exercises: StrengthSportExercise[] = [];
      for (const espec of d.exercises) {
        const meta = exMeta(espec.id, espec.name, espec.group);
        const base = baseForExercise(espec, input.workMax || {});
        const gentle = gentleFactor(espec.id, input.injuries as any);
        let workSets: StrengthSportSet[] = [];
        let totalSets = 0;
        for (const ss of espec.sets) totalSets += ss.sets;
        // Контест-цель и дата-тейпер недели — как в билдере (оба режима)
        const ce = contestEvents.find((e: any) => e && e.id === espec.id);
        const dateTaper = dateTaperForWeek(espec.id, w, weeks, phase, ssMode, input.competitionDate, (input as any).startDate);
        let contestHit = false;

        for (const ss of espec.sets) {
          // Вес: faithful — ПМ × % дословно; adapt — через pmForWeek-дрейф
          let wBase = base * tm;
          if (mode === 'adapt' && base > 0) {
            try { wBase = pmForWeek(base * tm, w, { ...input, weeks } as any, espec.id); } catch { /* дрейф недоступен */ }
          }
          let weight = espec.bodyweight ? 0 : round25(wBase * ss.pct);
          // Фолбэк снарядов — всегда (иначе вес от несуществующего ПМ)
          if (!hasSpecialty && isStrong(espec.id) && weight > 0) {
            const coeff = (STRONG_FALLBACK_COEFF as any)[espec.id] ?? 0.85;
            weight = round25(weight * coeff);
            fallbackUsed.add(espec.id);
          }
          // Female-коэффы (паритет с билдером)
          if (sex === 'female' && weight > 0) {
            const id = espec.id;
            if (id.includes('press') || id.includes('ohp') || id.includes('log') || id === 'bench_bar') weight = round25(weight * 0.88);
            else if (isCarryEvent(id)) weight = round25(weight * 0.90);
          }
          // Травмы — всегда (безопасность выше дословности)
          if (gentle < 1 && weight > 0) weight = round25(weight * gentle);
          // Контест-прогрессия к заявке — паритет с билдером (оба режима)
          if (ce && ce.weight > 0 && weight > 0 && !isDeload && dateTaper?.kind !== 'winwood') {
            const progress = weeks > 1 ? (w - 1) / (weeks - 1) : 1;
            const targetW = ce.weight;
            const startW = Math.round(targetW * 0.85 / 2.5) * 2.5;
            const contestW = Math.round((startW + (targetW - startW) * progress) / 2.5) * 2.5;
            weight = Math.min(contestW, Math.max(weight, contestW * 0.85));
            contestHit = true;
          }
          let rir = ss.rir ?? rirForWeek(w, weeks, goal, isOly(espec.id));
          if (isDeload || isTaper) rir = 4;
          else if (gentle < 1) rir = Math.min(4, rir + 1);

          for (let i = 0; i < ss.sets; i++) {
            const ws: StrengthSportSet = {
              reps: isCarryEvent(espec.id) ? 1 : ss.reps,
              rir,
              weight,
              pct: Math.round(ss.pct * 100),
              tempo: tempoForSS(espec.id, d.character, isDeload ? 'deload' : phase),
              restSeconds: restForSS(d.character, true, espec.id, ss.pct),
            } as StrengthSportSet;
            if (ss.distanceM) (ws as any).distanceM = ss.distanceM;
            else if ((EVENT_META as any)[espec.id]?.defaultDistanceM) (ws as any).distanceM = (EVENT_META as any)[espec.id].defaultDistanceM;
            if (ss.timeCapS) (ws as any).timeCapS = ss.timeCapS;
            else if ((EVENT_META as any)[espec.id]?.defaultTimeCapS) (ws as any).timeCapS = (EVENT_META as any)[espec.id].defaultTimeCapS;
            workSets.push(ws);
          }
        }

        // Контест-дистанция + дата-тейпер — как в билдере (оба режима)
        let dateTaperNote: string | null = null;
        if (ce?.distanceM && isCarryEvent(espec.id)) {
          workSets.forEach((ws: any) => { ws.distanceM = ce.distanceM; if (ce.timeCapS) ws.timeCapS = ce.timeCapS; });
        }
        if (dateTaper) {
          const minS = espec.id === 'tire_flip' ? 1 : 2;
          if (workSets.length > minS) workSets = workSets.slice(0, Math.max(minS, Math.round(workSets.length * dateTaper.setsMult)));
          if (dateTaper.weightMult < 1) workSets = workSets.map(s => (s.weight > 0 ? { ...s, weight: round25(s.weight * dateTaper.weightMult) } : s));
          if (dateTaper.rir >= 0) workSets = workSets.map(s => ({ ...s, rir: dateTaper.rir }));
          dateTaperNote = `Дата-тейпер ${dateTaper.daysOut}д до старта`;
          dateTaperApplied = true;
        }

        // Adapt-гарды — паритет с билдером (faithful — без срезок, дословно)
        let finalSets = workSets;
        let finalRirBump = 0;
        if (mode === 'adapt') {
          const th = vbtThresholds(espec.id);
          const minSets = espec.id === 'tire_flip' ? 1 : 2;
          let mult = 1;
          if (outM < 1) mult *= outM;
          if (acwr?.zone === 'dangerous') { mult *= 0.65; finalRirBump += 2; }
          else if (acwr?.zone === 'caution') { mult *= 0.85; finalRirBump += 1; }
          else if (acwr?.zone === 'undertrained') mult *= 1.1;
          if (typeof vLoss === 'number' && vLoss > th.low) { mult *= 0.9; finalRirBump += 1; }
          // Per-lift VBT-history (3 точки) — как в билдере
          const hist = histLossFor(espec.id, vHist);
          if (hist > th.low && finalSets.length > 2) { mult *= hist > th.high ? 0.80 : 0.90; finalRirBump += hist > th.high ? 2 : 1; }
          // Дневник e1RM-тренд 28д: просадка −5% → −15% объёма, плато → +1 сет
          const tr = trendFor(espec.id, trends);
          let plateau = false;
          if (tr) {
            if (tr.changePct < -5) { mult *= 0.85; finalRirBump += 1; }
            else if (tr.changePct < 2) plateau = true;
          }
          // Весогонка — объём недели по протоколу
          if (wcProto) {
            try {
              const wcm = weightCutVolumeMultiplierSS(w, weeks, wcProto);
              if (wcm < 1) mult *= wcm;
            } catch { /* протокол недоступен */ }
          }
          if (mult < 1 && finalSets.length > 2) {
            finalSets = finalSets.slice(0, Math.max(minSets, Math.round(finalSets.length * mult)));
          } else if ((mult > 1 || plateau) && finalSets.length < 6) {
            const add = finalSets[finalSets.length - 1];
            if (add) finalSets = [...finalSets, { ...add }];
          }
          if (finalRirBump > 0) finalSets = finalSets.map(s => ({ ...s, rir: Math.min(4, s.rir + finalRirBump) }));
          // Вес: EWMA-VBT + HRV — паритет с билдером
          try {
            const hArr = vHist ? (vHist[espec.id] || vHist[espec.id.toLowerCase()]) : null;
            let ewmaLoss: number | null = null;
            if (Array.isArray(hArr) && hArr.length >= 2) {
              const diag = diagnoseVelocityLossEwma(hArr, th.low as any);
              if (diag && diag.lossPct > 0) ewmaLoss = diag.lossPct;
            }
            const effLoss = Math.max(hist || 0, ewmaLoss || 0, typeof vLoss === 'number' ? vLoss : 0);
            const wFactor = velocityWeightAdjustFactor(effLoss, espec.id);
            const hrvF = hrvWeightFactor().factor;
            const wMult = (wFactor < 1 ? wFactor : 1) * (hrvF < 1 ? hrvF : 1);
            if (wMult < 1) finalSets = finalSets.map(s => (s.weight > 0 ? { ...s, weight: round25(s.weight * wMult) } : s));
          } catch { /* VBT/HRV недоступны */ }
        }

        const comments: string[] = [];
        if (espec.sets.some(s => s.amrap)) comments.push('AMRAP последнего сета (с запасом, без гроба)');
        if (contestHit && ce) comments.push(`Контест-прогрессия → ${ce.weight}кг`);
        if (ce?.distanceM && isCarryEvent(espec.id)) comments.push(`Дистанция контеста ${ce.distanceM}м`);
        if (dateTaperNote) comments.push(dateTaperNote);
        if (!hasSpecialty && isStrong(espec.id)) {
          const coeff = (STRONG_FALLBACK_COEFF as any)[espec.id] ?? 0.85;
          comments.push(`Замена без снаряда ×${coeff}`);
        }
        if (gentle < 1) comments.push(`Щадящий режим ×${gentle}`);
        if (t.meta.bulgarian) comments.push('Daily-max: максимум дня');

        const topWeight = finalSets.reduce((a, s) => Math.max(a, s.weight), 0);
        exercises.push({
          id: espec.id,
          name: meta.name,
          group: meta.group,
          pattern: meta.pattern,
          role: ((espec as any).role || 'primary') as any,
          character: d.character,
          sets: finalSets.length,
          reps: finalSets.length ? String(finalSets[0].reps) : '—',
          rir: finalSets.length ? finalSets[0].rir : 2,
          weight: topWeight,
          workSets: finalSets,
          warmupSets: topWeight >= 15 ? warmupRampFor(topWeight, espec.id).map(s => ({ reps: s.reps, rir: s.rir, weight: s.weight } as StrengthSportSet)) : [],
          tempo: tempoForSS(espec.id, d.character, isDeload ? 'deload' : phase),
          restSeconds: restForSS(d.character, true, espec.id, 0.8),
          comment: comments.length ? comments.join(' · ') : undefined,
          isCompetitionLift: isOly(espec.id) || isStrong(espec.id),
        } as StrengthSportExercise);
      }
      sessions.push({
        day: dayNo,
        week: w,
        sessionTag: d.tag,
        character: d.character,
        exercises,
      } as StrengthSportSession);
    }

    // Методика порядка — как в билдере (только adapt; faithful держит раскладку источника)
    const methodology = (input as any).methodology as string | undefined;
    if (mode === 'adapt' && methodology && methodology !== 'compound_first') {
      for (const s of sessions) s.exercises = orderByMethodSS(s.exercises, methodology);
      if (!methodologyNoted) { rationale.push(`Методика ${methodology}: порядок в сессиях переупорядочен (adapt)`); methodologyNoted = true; }
    } else if (mode === 'faithful' && methodology && methodology !== 'compound_first' && !methodologyNoted) {
      warnings.push(`Дословный режим: порядок методики ${methodology} не применялся (faithful держит раскладку источника)`);
      methodologyNoted = true;
    }

    // Кап недельного бюджета — формула билдера (adapt режет accessory-first, faithful предупреждает)
    let totalSets = sessions.reduce((a, s) => a + s.exercises.reduce((x, e) => x + e.sets, 0), 0);
    if (mode === 'adapt' && totalSets > budget) {
      const over0 = totalSets - budget;
      let over = over0;
      const all = sessions.flatMap(s => s.exercises).sort((a, b) => (a.role === 'accessory' ? 0 : 1) - (b.role === 'accessory' ? 0 : 1));
      for (const e of all) {
        const minS = e.id === 'tire_flip' ? 1 : 2;
        while (over > 0 && e.sets > minS) { e.sets--; e.workSets.pop(); over--; }
        if (over <= 0) break;
      }
      totalSets = sessions.reduce((a, s) => a + s.exercises.reduce((x, e) => x + e.sets, 0), 0);
      warnings.push(`Нед ${w}: объём ${over0 + budget} > бюджет ${budget} — срезан accessory-first (adapt)`);
    } else if (mode === 'faithful' && totalSets > budget) {
      warnings.push(`Нед ${w}: объём ${totalSets} > бюджет ${budget} — оставлен дословно (faithful)`);
    }
    const totalTonnage = sessions.reduce((a, s) => a + s.exercises.reduce((x, e) => x + e.workSets.reduce((q, ws) => q + ws.weight * ws.reps, 0), 0), 0);
    weeksData.push({ week: w, phase, deload: isDeload, taper: isTaper, sessions, totalSets, totalTonnage } as StrengthSportWeek);
  }

  if (fallbackUsed.size) warnings.push(`Нет спец-снарядов — замены: ${[...fallbackUsed].join(', ')} (коэффы STRONG_FALLBACK_COEFF)`);
  if (t.meta.bulgarian) warnings.push('Daily-max: при боли ≥4/недовосстановлении — пропустить максимум дня (сайд→изометрия)');
  if ((input as any).mode === 'hybrid' && t.meta.mode !== 'hybrid') {
    warnings.push(`Гибрид: взят профильный цикл «${t.meta.mode}» — план собран в режиме ${ssMode}. Для микса ТА+стронг выбирайте гибридный цикл.`);
  }
  if (mode === 'faithful' && (acwr?.zone === 'dangerous' || acwr?.zone === 'caution')) {
    warnings.push(`Дословный режим: ACWR ${acwr?.zone} НЕ резал объём (faithful). Для авто-срезок — режим adapt.`);
  }
  if (dateTaperApplied && input.competitionDate) {
    rationale.push(`Дата-тейпер к старту ${input.competitionDate}: ближние недели ужаты по Winwood/cessation (как в билдере)`);
  }

  const snap: any = {
    ...input,
    cycleId: t.meta.id,
    cycleMode: mode,
    weeks: t.meta.weeks,
    daysPerWeek: t.meta.sessionsPerWeek,
  };
  const plan: StrengthSportPlan = {
    id: `ssc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    mode: ssMode as any,
    goal: goal as any,
    level: (input.level as any) || 'intermediate',
    weeks,
    patternId: `cycle:${t.meta.id}`,
    weeksData,
    workMax: input.workMax || {},
    validation: { ok: errors.length === 0, warnings, errors },
    rationale,
    inputSnapshot: snap,
  };
  // DUP / интенсив-техника поверх цикла — как в билдере (только adapt)
  const dupMode = (input as any).dupMode as string | undefined;
  const intensityTech = (input as any).intensityTech as string | undefined;
  if (mode === 'adapt') {
    if (dupMode && dupMode !== 'off') {
      try { applyDUP({ weeksData, level: plan.level, rationale: [] } as any, dupMode as any); rationale.push(`DUP ${dupMode} применён поверх цикла`); } catch { /* DUP недоступен */ }
    }
    if (intensityTech && intensityTech !== 'none') {
      try { applyIntensity({ weeksData, level: plan.level, rationale: [] } as any, intensityTech as any); rationale.push(`Интенсив-техника ${intensityTech} применена поверх цикла`); } catch { /* техника недоступна */ }
    }
  } else if ((dupMode && dupMode !== 'off') || (intensityTech && intensityTech !== 'none')) {
    warnings.push('Дословный режим: DUP/интенсив-техника проигнорированы (faithful)');
    plan.validation = { ok: errors.length === 0, warnings, errors };
  }
  return plan;
}
