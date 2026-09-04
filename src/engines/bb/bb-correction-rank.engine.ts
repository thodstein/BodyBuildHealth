/**
 * bb-correction-rank.engine.ts — ранжир коррекций для слабой зоны (MAX PRO).
 * Формула: sfr×2 + lengthened×4 + angleGap×3 + unilateral×5 (при asym≥7) + strict + lowFatigue + слабая головка×6.
 * Жёсткие фильтры: оборудование + мобильность + уровень. Без мутаций плана.
 */
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { sfrOf, resistanceProfileOf, isUnilateralExercise } from './bb-sfr-db';
import { ANGLE_CLASSES, STRICT_EXERCISE_GROUPS, strictGroupForExercise } from './bb-exercise-selection.engine';
import { isMobilityRestricted } from './bb-mobility.engine';
import { headsHitOf } from './bb-stimulus-target.engine';
import type { WeakCause } from './bb-weak-cause.engine';

export interface RankCtx {
  cause?: WeakCause;
  weakHead?: string | null; // слабая головка пилота — кандидат, грузящий её, получает +6
  asymPct?: number | null;
  equipment?: string[];
  level?: string;
  missingAngles?: string[];
  missingStrict?: string[];
  inPlanIds?: string[];
  sex?: string;
}

export interface RankedCorrection {
  id: string;
  name: string;
  muscle: string;
  score: number;
  sfr: number | null;
  lengthened: boolean;
  closesAngle: string | null;
  closesStrict: string | null;
  unilateral: boolean;
  jointStress: string | null;
  headsHit: string[]; // головки, получающие стимул (пилот руки+дельты)
  reason: string;
}

function norm(s: string): string {
  return String(s || '').toLowerCase().trim();
}

function levelAllows(level: string | undefined, exName: string): boolean {
  if ((level || 'intermediate') !== 'beginner') return true;
  return !/олимп|рывок|толчок|snatch|clean|сумо.*тяга|гудморнинг.*тяж/i.test(exName);
}

export function rankCorrectionsForWeak(weakZone: string, plan: unknown, ctx: RankCtx = {}): RankedCorrection[] {
  const muscle = norm(weakZone);
  const inPlan = new Set((ctx.inPlanIds || []).map(norm));
  const missingAngles = new Set((ctx.missingAngles || []).map(norm));
  const missingStrict = new Set((ctx.missingStrict || []).map(norm));
  void plan;

  const pool = (EXERCISE_CATALOG as any[]).filter((c) => {
    const g = norm(c.group);
    const LEGS = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs']);
    const same = g === muscle || (LEGS.has(muscle) && g === 'legs') || (muscle === 'legs' && LEGS.has(g));
    // каталог держит руки в группе arms, трапеции в back, пресс в core — маппим с keyword-фильтром
    const ALIAS: Record<string, { group: string; re: RegExp }> = {
      triceps: { group: 'arms', re: /трицепс|tricep|француз|french|skull|кикбэк|kickback|pushdown/i },
      biceps: { group: 'arms', re: /бицепс|bicep|curl|сгибание|молот|hammer|скотт|preacher|пауч|spider|концентр|байес|bayesian|драг|drag/i },
      forearms: { group: 'arms', re: /запяст|кист|wrist|предплеч|forearm|валик|roller/i },
      traps: { group: 'back', re: /шраг|shrug|трапеци|trap|келсо|kelso/i },
      abs: { group: 'core', re: /пресс|скручиван|crunch|подъём ног|подъём колен|hanging|knee.?raise|велосипед|брюшн|abs/i },
    };
    const alias = (ALIAS as Record<string, { group: string; re: RegExp }>)[muscle];
    // бицепс: отсекаем запястья (у них своя зона forearms)
    const notForearm = muscle !== 'biceps' || !/запяст|кист|wrist|предплеч|forearm|валик|roller/i.test(`${c.id} ${c.name}`);
    const aliasOk = alias && g === alias.group && alias.re.test(`${c.id} ${c.name}`) && notForearm;
    if (muscle && !same && !aliasOk) return false;
    if (inPlan.has(norm(c.id)) || inPlan.has(norm(c.name))) return false;
    if (!levelAllows(ctx.level, String(c.name))) return false;
    if (ctx.equipment && ctx.equipment.length > 0) {
      const eq = String(c.equipment || '');
      if (eq && eq !== 'bodyweight' && eq !== 'machine' && !ctx.equipment.includes(eq)) return false;
    }
    try {
      if (isMobilityRestricted(muscle) && String(c.jointStress || '').toLowerCase() === 'high' && /присед|squat|жим.*стоя|overhead/i.test(String(c.name))) return false;
    } catch { /* noop */ }
    return true;
  });

  const scored: RankedCorrection[] = pool.map((c) => {
    const id = String(c.id);
    const name = String(c.name);
    const sfr = sfrOf({ id, name });
    const profile = resistanceProfileOf({ id, name });
    const lengthened = profile === 'lengthened';
    const unilateral = isUnilateralExercise({ id, name }) || /kick.?back|single|bulgarian|split.?squat|lunge|step.?up|одной/i.test(`${id} ${name}`);
    let angleClass: string | null = null;
    try {
      const classes = (ANGLE_CLASSES as any)[muscle] as Array<{ name: string; match: (e: unknown) => boolean }> | undefined;
      if (classes) for (const ac of classes) { try { if (ac.match(c as never)) { angleClass = ac.name; break; } } catch { /* noop */ } }
    } catch { /* noop */ }
    let strictKey: string | null = null;
    try {
      const sg = strictGroupForExercise({ id, name } as never, muscle);
      strictKey = sg ? String((sg as { key: string }).key) : null;
    } catch { /* noop */ }

    let score = 0;
    if (sfr != null) score += sfr * 2;
    if (lengthened) score += ctx.cause === 'activation' || ctx.cause === 'volume' ? 4 : 2;
    let closesAngle: string | null = null;
    if (angleClass && missingAngles.has(norm(angleClass))) {
      score += 3;
      closesAngle = angleClass;
    }
    let closesStrict: string | null = null;
    if (strictKey && missingStrict.has(norm(strictKey))) {
      score += 2;
      closesStrict = strictKey;
    }
    if (unilateral && (ctx.asymPct ?? 0) >= 7) score += 5;
    else if (unilateral) score += 1;
    // слабая головка: кандидат, грузящий её напрямую, — первым
    let hitsHead = false;
    let heads: string[] = [];
    try {
      heads = headsHitOf({ id, name });
      if (ctx.weakHead && heads.includes(ctx.weakHead)) {
        score += 6;
        hitsHead = true;
      }
    } catch { /* noop */ }
    const js = String(c.jointStress || '').toLowerCase() || null;
    if (js === 'low') score += 2;
    else if (js === 'high') score -= 3;
    if (c.stretchPhase) score += 1;
    // female glute: хип-траст/ягодичный мост приоритет
    if (ctx.sex === 'female' && muscle === 'glutes' && /хип|траст|мост|hip.?thrust/i.test(name)) score += 2;

    const why: string[] = [];
    if (hitsHead && ctx.weakHead) why.push(`бьёт в слабую головку ${ctx.weakHead}`);
    if (sfr != null) why.push(`SFR ${sfr}`);
    if (lengthened) why.push('lengthened');
    if (closesAngle) why.push(`закрывает угол ${closesAngle}`);
    if (closesStrict) why.push(`строгая ${closesStrict}`);
    if (unilateral && (ctx.asymPct ?? 0) >= 7) why.push('unilateral чинит асимметрию');
    if (js === 'low') why.push('сустав low');

    return {
      id, name, muscle, score: Math.round(score * 10) / 10, sfr, lengthened,
      closesAngle, closesStrict, unilateral, jointStress: js, headsHit: heads,
      reason: why.length ? why.join(' · ') : 'альтернатива в пуле',
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

/** Топ-3 с человеческим объяснением эффекта (для UI карточек). */
export function top3CorrectionsForWeak(weakZone: string, plan: unknown, ctx: RankCtx = {}): RankedCorrection[] {
  return rankCorrectionsForWeak(weakZone, plan, ctx).slice(0, 3);
}
