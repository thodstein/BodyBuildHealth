/**
 * arm-grip-protocol.engine.ts — TOP wave-13: отдельные peak-протоколы хвата.
 *
 * Источник: GripStrength (peak: heavy singles + overcrush holds 8–12с как главное
 * событие; intensification: negatives 5с). Протокол ЗАМЕНЯЕТ первое grip-упражнение
 * подходящей недели (не добавляется сверху — иначе рвёт tendon hard-cap 26 на
 * 4–5-дневках; объём недели не растёт, меняется стимул).
 * Недели: overcrush → первая peaking (иначе intensification), negatives → первая
 * intensification (иначе первая рабочая). Deload/sim-недели пропускаются.
 * Гарды: tendon-наличие (нечего заменять — пропуск), humerus не трогаем.
 * Инвариант sets===workSets.length. Возвращает новый план.
 */
import { getArmExercises } from '../../core/exercise-catalog-arm';

export type GripProtocolKind = 'over' | 'neg';

export interface GripProtocolOpts {
  muscle?: string; // grip_support | grip_pinch | grip_crush
  workMax?: Record<string, number>;
  mrv?: number;
  level?: string;
  equipment?: string[];
}

export interface GripProtocolResult {
  plan: any;
  injected: boolean;
  note: string;
}

const SG_OF: Record<string, string> = {
  grip_support: 'grip_support',
  grip_pinch: 'grip_pinch',
  grip_crush: 'grip_crush',
};

export function injectGripProtocol(plan: any, kind: GripProtocolKind, opts: GripProtocolOpts = {}): GripProtocolResult {
  if (!plan || !Array.isArray(plan.weeks)) return { plan, injected: false, note: 'Нет недель.' };
  const muscle = opts.muscle || 'grip_support';
  const sg = SG_OF[muscle] || 'grip_support';
  const copy = JSON.parse(JSON.stringify(plan));
  const weeks: any[] = copy.weeks || [];
  const wantPhase = kind === 'over' ? 'peaking' : 'intensification';
  // Wave-9 fix: пик-протокол живёт в пиковой неделе (там низко — гарды проходят);
  // sim-неделя исключена явно (у неё своя процедура, не ломать).
  const isSim = (w: any) => String(w.note || '').includes('Contest-sim');
  const week =
    weeks.find((w: any) => w.phase === wantPhase && !w.deload && !isSim(w)) ||
    weeks.find((w: any) => w.phase === 'intensification' && !w.deload && !isSim(w)) ||
    weeks.find((w: any) => !w.deload && !isSim(w));
  if (!week) return { plan: copy, injected: false, note: 'Нет рабочей недели под протокол.' };
  // Находим первое grip-упражнение недели и ПРЕВРАЩАЕМ его в протокол (замена, не добавление)
  let host: any = null;
  let hostSess: any = null;
  for (const s of week.sessions || []) {
    host = (s.exercises || []).find((e: any) => e.muscle === muscle && !/Overcrush-протокол|Negatives-протокол/.test(String(e.comment || '')));
    if (host) { hostSess = s; break; }
  }
  if (!host) return { plan: copy, injected: false, note: `Нет ${muscle}-упражнения для протокола.` };
  const pool = getArmExercises().filter((e: any) => (e.substitutionGroup || '') === sg);
  const equipped = Array.isArray(opts.equipment) && opts.equipment.length
    ? pool.filter((e: any) => (opts.equipment as string[]).some((q) => String(e.equipment || '').toLowerCase().includes(String(q).toLowerCase())) || String(e.equipment || '').toLowerCase() === 'dumbbell')
    : pool;
  const catalogEx = (equipped.length ? equipped : pool)[0] as any;
  if (!catalogEx) return { plan: copy, injected: false, note: `Нет упражнения ${sg} в каталоге.` };
  const wm = opts.workMax || {};
  const base = Number((wm as any)[muscle] ?? 50) || 50;
  const addSets = kind === 'over' ? 3 : 4;
  const newSets = Math.min(host.sets, addSets);
  const weight = kind === 'over' ? Math.round(base * 0.9 * 2) / 2 : Math.round(base * 0.75 * 2) / 2;
  const mk = (extra: object) => ({ reps: 3, rir: 1, weight, restSeconds: 180, ...extra });
  const idx = hostSess.exercises.indexOf(host);
  const proto: any = {
    muscle,
    name: (catalogEx as any).name,
    role: host.role || 'accessory',
    character: 'техника',
    sets: newSets,
    repsRange: [3, 3],
    rir: 1,
    workSets: Array.from({ length: newSets }, () => kind === 'over'
      ? mk({ holdSeconds: 10, tempo: '2-1-1-0' })
      : mk({ tempo: '5-1-1-0' })),
    isTable: false,
    isStatic: kind === 'over',
    holdSeconds: kind === 'over' ? 10 : undefined,
    movementPattern: (catalogEx as any).movementPattern,
    substitutionGroup: (catalogEx as any).substitutionGroup,
    exerciseId: (catalogEx as any).id,
    equipment: (catalogEx as any).equipment,
    comment: kind === 'over'
      ? 'Overcrush-протокол пика: 3×3 hold 8–12с, 1 max-попытка главным событием.'
      : 'Negatives-протокол: 4×3, эксцентрик 5с.',
  };
  hostSess.exercises.splice(idx, 1, proto);
  const note = kind === 'over'
    ? `Grip-протокол: overcrush вместо «${host.name}» (${hostSess.sessionTag}, нед ${week.week}).`
    : `Grip-протокол: negatives вместо «${host.name}» (${hostSess.sessionTag}, нед ${week.week}).`;
  if (!Array.isArray(copy.rationale)) copy.rationale = [];
  copy.rationale.push(note);
  return { plan: copy, injected: true, note };
}
