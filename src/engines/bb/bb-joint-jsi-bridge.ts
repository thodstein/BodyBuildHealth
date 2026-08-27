/**
 * bb-joint-jsi-bridge.ts — мост BB-плана → JSI (компактная теплокарта в Шаге 5).
 *
 * Читает BBPlan.weeks[].sessions[].exercises[] (вес/sets/reps/tempo) и считает
 * per-joint JSI через calcJointJsi (тот же движок что и в «Суставы и ортопедия»).
 * Глубокая геометрия/прехаб/видео остаются только в JointMasterCard.
 */
import { calcJointJsi, type JointJsiResult, type JointJsiInput, JSI_LEVEL_COLOR, JSI_LEVEL_BG } from '../pro/joint-jsi.engine';
import type { JointId } from '../pro/joint-load-master.engine';
import type { Lift } from '../lms/weakpoint-pl';

function parseTempoEcc(tempoSpec?: string): number {
  if (!tempoSpec) return 2.5;
  const m = String(tempoSpec).trim().match(/^(\d+(?:\.\d+)?)/);
  if (m) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && v > 0 && v < 20) return v;
  }
  return 2.5;
}

function mapExerciseToLift(name: string): Lift {
  const n = String(name || '').toLowerCase();
  if (/жим.*лёжа|жим.*лежа|bench.*press|жим штанги лёжа|жим гантелей лёжа/i.test(n)) return 'bench';
  if (/наклон.*жим|incline.*press|жим.*наклон.*30/i.test(n)) return 'incline_press';
  if (/жим.*стоя|армейск|военн.*жим|overhead.*press|ohp/i.test(n)) return 'ohp';
  if (/присед|squat|фронт.*присед|гакк.*присед|колодец|гоблет/i.test(n) && !/тяга/i.test(n)) return 'squat';
  if (/сумо|sumo/i.test(n)) return 'sumo';
  if (/станов.*тяга|deadlift|мёртв|мертв/i.test(n) && !/румын/i.test(n)) return 'deadlift';
  if (/тяга.*штанги.*наклон|тяга.*гантел|тяга.*т-?гриф|row/i.test(n)) return 'row';
  if (/тяга.*верхн.*блок|pulldown|подтягиван/i.test(n)) return 'pulldown';
  if (/бицепс|сгибан.*рук|подъём.*бицепс|biceps/i.test(n)) return 'biceps';
  if (/жим.*узк|француз|разгибан.*трицепс|трицепс/i.test(n)) return 'bench';
  if (/шраг|shrug|трапеци/i.test(n)) return 'row';
  if (/икр|calf/i.test(n)) return 'squat';
  return 'bench';
}

export interface CompactJsiSummary {
  perJointMax: Record<JointId, { jsi: number; level: JointJsiResult['overallLevel']; count: number }>;
  maxJsi: number;
  maxJoint: JointId;
  overallLevel: JointJsiResult['overallLevel'];
  deadlyCount: number;
  deadlyCombos: JointJsiResult['deadlyCombos'];
  tuningTop: JointJsiResult['tuning'];
  nutraceutical: JointJsiResult['nutraceutical'];
  totalInputs: number;
}

export function buildCompactJsiSummary(
  plan: any,
  opts: { bodyWeightKg?: number; aasStack?: string[]; painMap?: Partial<Record<JointId, number>>; oldInjuries?: string[] } = {}
): CompactJsiSummary | null {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return null;
  const inputs: JointJsiInput[] = [];
  for (const w of plan.weeks) {
    if ((w as any).phase === 'deload' || (w as any).deload) continue;
    for (const s of (w.sessions || [])) {
      for (const ex of (s.exercises || [])) {
        if ((ex as any).warmupActivator) continue;
        const name = String(ex.name || ex.exerciseName || '');
        if (!name) continue;
        const sets = Number(ex.sets) || 0;
        if (sets <= 0) continue;
        const ws = Array.isArray(ex.workSets) && ex.workSets.length ? ex.workSets[0] : null;
        const reps = Number(ws?.reps ?? ex.repsRange?.[0] ?? 8) || 8;
        const weightKg = Number(ws?.weight ?? (ex as any).weight ?? 0) || 0;
        if (weightKg <= 0 && reps <= 0) continue;
        const tempoEccSec = parseTempoEcc(ex.tempoSpec || (ex as any).tempo);
        const lift = mapExerciseToLift(name);
        inputs.push({
          lift,
          exerciseId: (ex as any).id || undefined,
          weightKg: weightKg > 0 ? weightKg : Math.round((opts.bodyWeightKg ?? 80) * 0.3),
          sets,
          reps,
          tempoEccSec,
          amplitude: 'full',
          painMap: opts.painMap || {},
          deadPoint: 'none',
          aasStack: opts.aasStack || [],
          bodyWeightKg: opts.bodyWeightKg,
          oldInjuries: opts.oldInjuries || [],
        });
      }
    }
  }
  if (inputs.length === 0) return null;
  const results = inputs.map(calcJointJsi);
  const perJointMax: Record<string, { jsi: number; level: any; count: number }> = {};
  let maxJsi = -1;
  let maxJoint: JointId = 'shoulder';
  const allDeadly: JointJsiResult['deadlyCombos'] = [];
  const tuningMap = new Map<string, any>();
  let worstNutra: JointJsiResult['nutraceutical'] | null = null;
  let worstLevelRank = 0;
  const rank: Record<string, number> = { green: 0, yellow: 1, red: 2, critical: 3 };
  for (const r of results) {
    for (const [jid, pj] of Object.entries(r.perJoint)) {
      const cur = (perJointMax as any)[jid];
      if (!cur || pj.jsi > cur.jsi) (perJointMax as any)[jid] = { jsi: pj.jsi, level: pj.level, count: (cur?.count || 0) + 1 };
      else cur.count += 1;
      if (pj.jsi > maxJsi) { maxJsi = pj.jsi; maxJoint = jid as JointId; }
    }
    if (r.deadlyCombos.length) allDeadly.push(...r.deadlyCombos);
    for (const t of r.tuning) if (!tuningMap.has(t.id)) tuningMap.set(t.id, t);
    const rl = rank[r.overallLevel] ?? 0;
    if (rl > worstLevelRank) { worstLevelRank = rl; worstNutra = r.nutraceutical; }
    if (!worstNutra) worstNutra = r.nutraceutical;
  }
  const overallLevel = (maxJsi >= 115 ? 'critical' : maxJsi >= 85 ? 'red' : maxJsi >= 50 ? 'yellow' : 'green') as any;
  return {
    perJointMax: perJointMax as any,
    maxJsi: Math.round(maxJsi),
    maxJoint,
    overallLevel,
    deadlyCount: allDeadly.length,
    deadlyCombos: allDeadly.slice(0, 3),
    tuningTop: Array.from(tuningMap.values()).slice(0, 3),
    nutraceutical: worstNutra!,
    totalInputs: inputs.length,
  };
}

export { JSI_LEVEL_COLOR, JSI_LEVEL_BG };
export const JOINT_RU: Record<JointId, string> = {
  wrist: 'Кисть', elbow: 'Локоть', shoulder: 'Плечо', spine: 'Поясница', hip: 'Таз', knee: 'Колено', ankle: 'Голеностоп',
};
