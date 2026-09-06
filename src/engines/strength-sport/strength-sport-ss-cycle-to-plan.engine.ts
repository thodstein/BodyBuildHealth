/**
 * strength-sport-ss-cycle-to-plan.engine.ts — интернет-цикл → StrengthSportPlan.
 * Два режима (выбор пользователя, дефолт faithful):
 * - faithful (дословный): сеты/повторы/% из шаблона 1-в-1, веса = ПМ × % (×tmFactor),
 *   БЕЗ дрейфа pmForWeek и БЕЗ авто-срезок объёма (ACWR/outside/VBT не режут —
 *   это и есть «дословно»). Безопасность: травмы (gentle ×0.6-0.7, RIR+1) и
 *   фолбэк снарядов (STRONG_FALLBACK_COEFF + бейдж) применяются всегда.
 * - adapt: faithful + поверх гарды билдера (ACWR/outside/VBT объём, RIR-шифты,
 *   pmForWeek-дрейф по лифту).
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
  const outM = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;

  const rationale: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  rationale.push(`📚 Интернет-цикл: ${t.meta.title} · режим ${mode === 'faithful' ? 'дословный' : 'адаптированный'}`);
  if (tm !== 1) rationale.push(`Training max ×${tm} (проценты от 90% ПМ)`);
  if (t.meta.bulgarian) rationale.push('⚠ Daily-max протокол: максимумы дня, согласие получено, следите за ACWR/суставами');
  // Якорь к дате старта
  if (input.competitionDate) {
    const anchors: string[] = [];
    if (t.meta.mockWeeks?.length) anchors.push(`mock нед ${t.meta.mockWeeks.join(',')}`);
    if (t.meta.taperWeeks?.length) anchors.push(`тейпер нед ${t.meta.taperWeeks.join(',')}`);
    if (anchors.length) rationale.push(`⚓ Якорь к старту ${input.competitionDate}: ${anchors.join(' · ')} (порядок недель не меняем)`);
  }

  const fallbackUsed = new Set<string>();
  const weeksData: StrengthSportWeek[] = [];

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
        const workSets: StrengthSportSet[] = [];
        let totalSets = 0;
        for (const ss of espec.sets) totalSets += ss.sets;

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

        // Adapt-гарды объёма (faithful — без срезок, дословно)
        let finalSets = workSets;
        let finalRirBump = 0;
        if (mode === 'adapt') {
          let mult = 1;
          if (outM < 1) mult *= outM;
          if (acwr?.zone === 'dangerous') { mult *= 0.65; finalRirBump += 2; }
          else if (acwr?.zone === 'caution') { mult *= 0.85; finalRirBump += 1; }
          else if (acwr?.zone === 'undertrained') mult *= 1.1;
          if (typeof vLoss === 'number' && vLoss > 20) { mult *= 0.9; finalRirBump += 1; }
          if (mult < 1 && finalSets.length > 2) {
            const keep = Math.max(2, Math.round(finalSets.length * mult));
            finalSets = finalSets.slice(0, keep);
          } else if (mult > 1 && finalSets.length < 6) {
            const add = finalSets[finalSets.length - 1];
            if (add) finalSets = [...finalSets, { ...add }];
          }
          if (finalRirBump > 0) finalSets = finalSets.map(s => ({ ...s, rir: Math.min(4, s.rir + finalRirBump) }));
        }

        const comments: string[] = [];
        if (espec.sets.some(s => s.amrap)) comments.push('AMRAP последнего сета (с запасом, без гроба)');
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
          role: 'primary',
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

    const totalSets = sessions.reduce((a, s) => a + s.exercises.reduce((x, e) => x + e.sets, 0), 0);
    const totalTonnage = sessions.reduce((a, s) => a + s.exercises.reduce((x, e) => x + e.workSets.reduce((q, ws) => q + ws.weight * ws.reps, 0), 0), 0);
    weeksData.push({ week: w, phase, deload: isDeload, taper: isTaper, sessions, totalSets, totalTonnage } as StrengthSportWeek);
  }

  if (fallbackUsed.size) warnings.push(`Нет спец-снарядов — замены: ${[...fallbackUsed].join(', ')} (коэффы STRONG_FALLBACK_COEFF)`);
  if (t.meta.bulgarian) warnings.push('Daily-max: при боли ≥4/недовосстановлении — пропустить максимум дня (сайд→изометрия)');
  if (mode === 'faithful' && (acwr?.zone === 'dangerous' || acwr?.zone === 'caution')) {
    warnings.push(`Дословный режим: ACWR ${acwr?.zone} НЕ резал объём (faithful). Для авто-срезок — режим adapt.`);
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
  return plan;
}
