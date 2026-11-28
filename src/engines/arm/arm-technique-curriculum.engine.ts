/**
 * arm-technique-curriculum.engine.ts — технический курикулум (аудит 2026-11, §5 п.8).
 *
 * Зачем: у планировщика была диагностика техники, но не было самой техники —
 * новичок получал объём без дриллов старта/постановки/входа в приём.
 *
 * Как: 8 дриллов (старт, постановка хвата, posting, вход в hook, toproll, press,
 * king's move, защита) с подсказками и чек-листом ошибок. В неделю — ОДИН дрилл,
 * и он ВСТРАИВАЕТСЯ в разминку основного упражнения недели, а не добавляется
 * отдельным упражнением: сессии в этом планировщике уже заполнены до канона, и
 * лишний слот либо выбивал frequency-split, либо резался enforceSessionLimits.
 *
 * Прогрессия «изометрия → 70% → 90% → 100%» — практика тренеров (эвристика), не
 * измеренная величина. Стадия 0 добавляет изометрический подход 8 с в разминку;
 * стадии 1–3 задают целевой % от workMax мышцы для рабочих подходов (вес уже
 * посчитан билдером по workMax, поэтому мы не переписываем кг, а фиксируем цель).
 *
 * Модуль чистый: правит копию плана, не читает localStorage.
 */
import type { ArmPlan } from './arm-types';
import { sessionLimitsForArm } from './arm-volume.engine';

export type ArmTechniqueDrillId =
  'start' | 'grip_set' | 'posting' | 'hook_entry' | 'toproll' | 'press' | 'kings_move' | 'defense';

export interface ArmTechniqueDrill {
  id: ArmTechniqueDrillId;
  name: string;
  /** Мышца, на которую ложится дрилл (для объёма и workMax). */
  muscle: string;
  focus: string;
  cues: string[];
  /** Чек-лист ошибок — то, что чаще всего ломает движение. */
  errors: string[];
  /** Стоп-условие: при этих ограничениях дрилл не ставим. */
  avoid?: string[];
}

/**
 * 8 дриллов. Тексты — практика (тренерские cue), не медицинские предписания.
 * Конкретные проценты прогрессии ниже — эвристика; источник только у того,
 * что техника снижает риск (см. docs/ARM-PLANNER-AUDIT-2026-11.md §5 п.8).
 */
export const ARM_TECHNIQUE_DRILLS: readonly ArmTechniqueDrill[] = [
  {
    id: 'start',
    name: 'Старт: хват и положение корпуса',
    muscle: 'back_pressure',
    focus: 'До команды: корпус за рукой, локоть под столом, кисть не провалена.',
    cues: ['Плечо над кистью', 'Локоть под столом', 'Вдох до команды', 'Тяни корпусом, не кистью'],
    errors: ['Кисть разогнута на старте', 'Локоть уходит назад', 'Старт рывком без зацепа'],
    avoid: ['wrist_flexors', 'wrist_extensors'],
  },
  {
    id: 'grip_set',
    name: 'Постановка хвата (ладонь/пальцы)',
    muscle: 'grip_support',
    focus: 'Набрать глубину хвата до нагрузки; большой палец закрыт.',
    cues: ['Глубокий зацеп', 'Большой закрыт', 'Запястье нейтрально', 'Давление ладонью в ладонь'],
    errors: ['Хват за кончики', 'Большой открыт', 'Кисть сложена в сторону'],
  },
  {
    id: 'posting',
    name: 'Posting (упор в стол)',
    muscle: 'risers',
    focus: 'Держать posting-линию: кисть выше плеча, давление в стол, не в соперника.',
    cues: ['Кисть выше', 'Дави в стол', 'Локоть внутрь', 'Дыши ровно'],
    errors: ['Терять posting под нагрузкой', 'Локоть наружу', 'Задержка дыхания'],
    avoid: ['risers', 'wrist_flexors'],
  },
  {
    id: 'hook_entry',
    name: 'Вход в hook',
    muscle: 'supinators',
    focus: 'Вход супинацией + сгибание кисти, локоть остаётся близко.',
    cues: ['Супинируй первым', 'Кисть к себе', 'Локоть близко', 'Корпус за рукой'],
    errors: ['Вход пронацией', 'Локоть уходит', 'Тянут рукой без корпуса'],
    avoid: ['supinators', 'brachialis'],
  },
  {
    id: 'toproll',
    name: 'Toproll: подъём и разворот',
    muscle: 'pronators',
    focus: 'Поднимать risers и разворачивать кисть, не теряя зацеп.',
    cues: ['Поднимай risers', 'Разворот кисти', 'Локоть на месте', 'Тяни к себе-вниз'],
    errors: ['Разворот без подъёма', 'Зацеп уходит', 'Локоть отрывается'],
  },
  {
    id: 'press',
    name: 'Press: боковое давление',
    muscle: 'side_pressure',
    focus: 'Давить перпендикулярно, локоть на подушке, без рывка (humerus-risk).',
    cues: ['Дави вбок', 'Локоть на подушке', 'Плавный налив', 'RIR ≥ 2'],
    errors: ['Рывок в начале', 'Локоть в воздухе', 'Вес выше готовности'],
    avoid: ['side_pressure', 'shoulder_stab'],
  },
  {
    id: 'kings_move',
    name: "King's move: защита плечом",
    muscle: 'shoulder_stab',
    focus: 'Уходить в закрытую позицию, не разгибая плечо под нагрузкой.',
    cues: ['Плечо вперёд', 'Локоть под корпусом', 'Не разгибай руку', 'Терпи позицию'],
    errors: ['Разгиб плеча', 'Потеря локтя', 'Переход в боль'],
    avoid: ['shoulder_stab', 'core_anchor'],
  },
  {
    id: 'defense',
    name: 'Защита: возврат кисти',
    muscle: 'back_pressure',
    focus: 'Тянуть обратно корпусом и спиной, а не сгибателями кисти.',
    cues: ['Корпус назад', 'Кисть в нейтраль', 'Локоть близко', 'Не отпускай зацеп'],
    errors: ['Тянут только кистью', 'Кисть разгибается', 'Потеря корпуса'],
  },
];

/** Стадии прогрессии: 0 — изометрия, 1 — 70%, 2 — 90%, 3 — 100% (эвристика). */
export type ArmTechniqueStage = 0 | 1 | 2 | 3;

export function armTechniqueStageForWeek(week: number, weeks: number): ArmTechniqueStage {
  const total = Math.max(1, Math.round(Number(weeks) || 1));
  const w = Math.max(1, Math.round(Number(week) || 1));
  const perStage = Math.max(1, Math.ceil(total / 4));
  const stage = Math.min(3, Math.floor((w - 1) / perStage));
  return stage as ArmTechniqueStage;
}

/** Проценты стадии; 0 = изометрия без внешнего веса. */
export const ARM_TECHNIQUE_STAGE_PCT: Record<ArmTechniqueStage, number> = { 0: 0, 1: 0.7, 2: 0.9, 3: 1 };

export interface ArmTechniqueWeekPlan {
  week: number;
  drillId: ArmTechniqueDrillId;
  name: string;
  stage: ArmTechniqueStage;
  label: string;
  focus: string;
  cues: string[];
  errors: string[];
  /** В какое упражнение недели встроена разминка/фокус. */
  embeddedIn?: string;
}

export interface ArmTechniqueApplyOptions {
  level?: string;
  goal?: string;
  /** Ограничения (mobilityRestrictions/injuries) — стоп-условия дриллов. */
  restrictions?: string[];
}

export interface ArmTechniqueApplyResult {
  plan: ArmPlan;
  applied: number;
  notes: string[];
}

function restrictionSet(values: string[] | undefined): Set<string> {
  return new Set((values || []).map((v) => String(v || '').toLowerCase()));
}

function drillBlocked(drill: ArmTechniqueDrill, restrictions: Set<string>): boolean {
  if (!drill.avoid?.length) return false;
  return drill.avoid.some((a) => restrictions.has(a));
}

const RU_STAGE: Record<ArmTechniqueStage, string> = {
  0: 'изометрия (без веса)',
  1: '70% рабочего максимума',
  2: '90% рабочего максимума',
  3: '100% рабочего максимума',
};

/** Блок «долгой схватки» — fresh object каждый раз (иначе общие ссылки между неделями). */
function enduranceBlock(): any {
  return {
    muscle: 'side_pressure',
    name: '🫱 Долгая схватка: изометрия 3×20 с',
    role: 'accessory',
    character: 'техника',
    sets: 3,
    repsRange: [1, 1],
    rir: 2,
    workSets: Array.from({ length: 3 }, () => ({ reps: 1, rir: 2, weight: 0, holdSeconds: 20, restSeconds: 60 })),
    isStatic: true,
    holdSeconds: 20,
    movementPattern: 'endurance_hold' as any,
    substitutionGroup: 'endurance_iso',
    loadMode: 'tool',
    provenance: 'finalizer',
    provenanceSource: 'arm-technique',
    comment: 'Выносливость схватки: 3×20 с изометрия в рабочей позиции (практика, не тест).',
  };
}

/**
 * Куда встроить дрилл: первое не-тестовое упражнение недели (предпочтительно
 * той же мышцы, иначе первое компаундное). Возвращает exercise или null.
 */
function embedTarget(wk: any, drill: ArmTechniqueDrill): any | null {
  const sessions = (wk.sessions || []).filter((s: any) => s.sessionTag !== 'LegsCore' && s.sessionTag !== 'Test');
  const all = sessions.flatMap((s: any) => s.exercises || []);
  return (
    all.find((e: any) => e.muscle === drill.muscle && e.role !== 'accessory') ||
    all.find((e: any) => e.muscle === drill.muscle) ||
    all.find((e: any) => e.role !== 'accessory') ||
    null
  );
}

/**
 * Встраивает 1 дрилл в неделю (разминка/фокус основного упражнения) и, для
 * endurance-цели, добавляет недельный блок «долгой схватки» 3×20 с.
 */
export function applyArmTechniqueCurriculum(
  plan: ArmPlan,
  opts: ArmTechniqueApplyOptions = {},
): ArmTechniqueApplyResult {
  const result: ArmTechniqueApplyResult = { plan, applied: 0, notes: [] };
  const copy: ArmPlan = {
    ...plan,
    weeks: plan.weeks.map((w) => ({
      ...w,
      sessions: w.sessions.map((s) => ({ ...s, exercises: [...s.exercises] })),
    })),
  };
  result.plan = copy;
  if ((copy as any)._techniqueApplied) return result;
  (copy as any)._techniqueApplied = true;

  const level = String(opts.level || copy.level || 'intermediate');
  const goal = String(opts.goal || (copy as any).goal || 'strength');
  const injuries = (
    ((copy.inputSnapshot as any)?.injuries || []) as Array<{
      muscle?: string;
      exclude?: boolean;
      volumePct?: number;
    }>
  ).filter(Boolean);
  const injuredMuscles = new Set(
    injuries
      .filter((i) => i.exclude === true || (i.volumePct != null && Number(i.volumePct) < 60))
      .map((i) => String(i.muscle || '').toLowerCase())
      .filter(Boolean),
  );
  const restrictions = restrictionSet([
    ...injuredMuscles,
    ...((copy.inputSnapshot as any)?.mobilityRestrictions || []),
    ...(opts.restrictions || []),
  ]);
  const weeksTotal = copy.weeks.length;
  const endurance = goal === 'endurance';
  const curriculum: ArmTechniqueWeekPlan[] = [];

  for (let i = 0; i < weeksTotal; i++) {
    const wk = copy.weeks[i];
    if (wk.deload || wk.taper || wk.phase === 'deload' || wk.phase === 'peaking') continue;
    let drill: ArmTechniqueDrill | null = null;
    for (let k = 0; k < ARM_TECHNIQUE_DRILLS.length; k++) {
      const cand = ARM_TECHNIQUE_DRILLS[(i + k) % ARM_TECHNIQUE_DRILLS.length];
      if (!drillBlocked(cand, restrictions) && !injuredMuscles.has(cand.muscle)) {
        drill = cand;
        break;
      }
    }
    if (!drill) {
      result.notes.push('🧭 Техника: все дриллы запрещены ограничениями — блок не добавлен.');
      continue;
    }
    const stage = armTechniqueStageForWeek(wk.week, weeksTotal);
    const target = embedTarget(wk, drill);
    if (!target) {
      result.notes.push(`🧭 Техника Н${wk.week}: нет упражнения для встраивания — дрилл не добавлен.`);
      continue;
    }
    const marker = `🧭 Техника (${RU_STAGE[stage]}): ${drill.name}. ${drill.focus} Подсказки: ${drill.cues.join('; ')}. Ошибки: ${drill.errors.join('; ')}.`;
    target.comment = target.comment ? `${target.comment} · ${marker}` : marker;
    // Стадия 0 не добавляет «0×1» в разминку: изометрия 8 с выполняется в
    // разминке по тексту дрилла (иначе печать показывала бессмысленный 0×1).
    curriculum.push({
      week: wk.week,
      drillId: drill.id,
      name: drill.name,
      stage,
      label: RU_STAGE[stage],
      focus: drill.focus,
      cues: [...drill.cues],
      errors: [...drill.errors],
      embeddedIn: target.name,
    });
    result.applied++;
    result.notes.push(`🧭 Техника Н${wk.week}: ${drill.name} — ${RU_STAGE[stage]} (в разминке «${target.name}»).`);
  }

  if (endurance) {
    // Блок «долгой схватки»: 3×20 с изометрия. Если сессии заполнены до канона,
    // заменяем последний вспомогательный подход той же сессии (endurance-цель
    // сама по себе ставит выносливость приоритетом).
    for (const wk of copy.weeks) {
      if (wk.deload || wk.taper || wk.phase === 'deload' || wk.phase === 'peaking') continue;
      const free = wk.sessions.find((s) => {
        if (s.sessionTag === 'LegsCore' || s.sessionTag === 'Test') return false;
        const lim = sessionLimitsForArm({ level, discipline: copy.discipline, sessionTag: s.sessionTag });
        if (s.exercises.length >= lim.maxExercises) return false;
        const sets = s.exercises.reduce((a, e) => a + (Number(e.sets) || 0), 0);
        return sets + 3 <= lim.maxSets;
      });
      if (free) {
        free.exercises.push(enduranceBlock());
        result.notes.push(`🫱 Н${wk.week}: блок «долгая схватка» 3×20 с (endurance).`);
        continue;
      }
      // Замена — только безопасная: accessory ≥3 сетов, у мышцы есть «пара»
      // (в неделе или в этой же сессии), и сессия не выйдет за maxSets.
      const sessionsWith = (m: string) =>
        wk.sessions.filter(
          (s) => s.sessionTag !== 'LegsCore' && s.sessionTag !== 'Test' && s.exercises.some((e) => e.muscle === m),
        ).length;
      const victims: Array<{ sess: any; idx: number }> = [];
      for (const sess of wk.sessions) {
        if (sess.sessionTag === 'LegsCore' || sess.sessionTag === 'Test') continue;
        const lim = sessionLimitsForArm({ level, discipline: copy.discipline, sessionTag: sess.sessionTag });
        const total = sess.exercises.reduce((a, e) => a + (Number(e.sets) || 0), 0);
        sess.exercises.forEach((ex, idx) => {
          if (victims.length || ex.role !== 'accessory' || Number(ex.sets) < 3) return;
          const src = String(ex.provenanceSource || '');
          if (src === 'arm-test-week' || src.startsWith('arm-technique')) return;
          const paired =
            sessionsWith(ex.muscle) >= 2 || sess.exercises.some((e, k) => k !== idx && e.muscle === ex.muscle);
          if (!paired) return;
          if (total - Number(ex.sets) + 3 > lim.maxSets) return;
          victims.push({ sess, idx });
        });
        if (victims.length) break;
      }
      const victim = victims[0];
      if (victim) {
        victim.sess.exercises[victim.idx] = enduranceBlock();
        result.notes.push(`🫱 Н${wk.week}: блок «долгая схватка» 3×20 с (заменяет вспомогательное упражнение).`);
      } else {
        result.notes.push(`🫱 Н${wk.week}: блок «долгая схватка» не вставлен — нет безопасного места (3×20 с).`);
      }
    }
  }

  (copy as any).techniqueCurriculum = curriculum;
  for (const line of result.notes) copy.rationale.push(line);
  return result;
}

/** Данные для UI: дрилл недели + стадия (без мутации плана). */
export function techniqueDrillForWeek(
  week: number,
  weeks: number,
  restrictions: string[] = [],
): { drill: ArmTechniqueDrill; stage: ArmTechniqueStage; label: string } | null {
  const set = restrictionSet(restrictions);
  const stage = armTechniqueStageForWeek(week, weeks);
  for (let k = 0; k < ARM_TECHNIQUE_DRILLS.length; k++) {
    const cand = ARM_TECHNIQUE_DRILLS[(Math.max(1, week) - 1 + k) % ARM_TECHNIQUE_DRILLS.length];
    if (!drillBlocked(cand, set)) return { drill: cand, stage, label: RU_STAGE[stage] };
  }
  return null;
}
