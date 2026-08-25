/**
 * bb-summary.engine.ts — расширенная недельная сводка сетов по каждой мышце.
 *
 * Пример формата для спины:
 *   Спина — 2 тренировки/нед
 *     тренировка 1: 30 рабочих сетов, 12 разминочных
 *     тренировка 2: 25 рабочих сетов, 10 разминочных
 *     паттерн vertical_pull — 12, horizontal_pull — 10, isolation — 8
 *     широчайшие (direct) — 20, косвенная нагрузка — 8
 *
 * Считает direct/indirect объём, рабочие vs разминочные сеты, паттерны.
 * Этап 21: подгруппы для ВСЕХ мышц (display-only, вне капа) + пояснения.
 */
import type { BBPlan } from './bb-builder.engine';
import { exerciseVolumeContributions } from './bb-volume.engine';
import { derivePattern } from '../movement-pattern';

export interface BBMuscleSummary {
  muscle: string;
  sessionsPerWeek: number;
  workingSets: number;
  warmupSets: number;
  directSets: number;
  indirectSets: number;
  byPattern: Record<string, number>;
  bySession: Array<{ day: number; working: number; warmup: number }>;
  byExercise: Record<string, number>;
  subGroups?: Record<string, { workingSets: number; byPattern: Record<string, number>; byExercise: Record<string, number>; explanation?: { why: string; how: string; patternRu: string; labelRu: string } }>;
}

export interface BBExpandedSummary {
  byMuscle: Record<string, BBMuscleSummary>;
  totalWorkingSets: number;
}

export interface SubgroupDef {
  id: string;
  labelRu: string;
  patternNeedles: RegExp;
  why: string;
  how: string;
  patternRu: string;
}

export const SUBGROUP_MAP: Record<string, SubgroupDef[]> = {
  chest: [
    { id: 'chest_upper', labelRu: 'верх груди (ключичная)', patternNeedles: /incline_push/i, why: 'Ключичная порция отстаёт — наклон 30° переносит тягу к ключице.', how: 'Жим на наклонной 30°, локти 75°, пауза 1с внизу, сведение гантелей.', patternRu: 'наклонный жим' },
    { id: 'chest_mid', labelRu: 'середина груди', patternNeedles: /horizontal_push/i, why: 'Стернальная середина — основной массив, горизонталь даёт макс. натяжение.', how: 'Жим лёжа, хват чуть шире плеч, грудь «колесом», без отбива.', patternRu: 'горизонтальный жим' },
    { id: 'chest_lower', labelRu: 'низ груди', patternNeedles: /decline_push|dip_push/i, why: 'Низ формирует край — dips/decline.', how: 'Брусья наклон 30° или decline -15°, растяжение внизу.', patternRu: 'низкий жим/брусья' },
    { id: 'chest_iso', labelRu: 'изоляция груди', patternNeedles: /isolation_chest/i, why: 'Растянутая изоляция — пик без трицепса.', how: 'Разводка/кроссовер, пауза 2с внизу и 1с в сведении.', patternRu: 'изоляция' },
  ],
  back: [
    { id: 'back_width', labelRu: 'широчайшая (ширина)', patternNeedles: /vertical_pull|lat_isolation|подтяг|верхн.*блок/i, why: 'Ширина — вертикальная тяга.', how: 'Тяга локтями вниз, сведение лопаток.', patternRu: 'вертикальная тяга' },
    { id: 'back_thickness', labelRu: 'толщина (ромб)', patternNeedles: /horizontal_pull|тяга.*наклон|тяга.*гриф/i, why: 'Толщина — горизонтальная тяга.', how: 'Тяга к низу живота, 45°.', patternRu: 'горизонтальная тяга' },
    { id: 'upper_back', labelRu: 'верх спины', patternNeedles: /supported_row|upper_back/i, why: 'Верх держит осанку.', how: 'Тяга с упором.', patternRu: 'верхняя тяга' },
    { id: 'rear_delts', labelRu: 'задняя дельта', patternNeedles: /rear_delt|задн.*дельт|face.?pull/i, why: 'Задняя дельта — здоровье плеча.', how: 'Face pull, локти вверх.', patternRu: 'тяга к лицу' },
    { id: 'traps', labelRu: 'трапеции', patternNeedles: /shrug|шраг/i, why: 'Трапеции — шраги.', how: 'Плечи к ушам, пауза 1с.', patternRu: 'шраги' },
    { id: 'erectors', labelRu: 'разгибатели', patternNeedles: /erector|гиперэкстенз/i, why: 'Разгибатели — нейтраль.', how: 'Гиперэкстензия.', patternRu: 'гиперэкстензия' },
  ],
  shoulders: [
    { id: 'delt_front', labelRu: 'передняя дельта', patternNeedles: /vertical_push|жим.*стоя|армейск/i, why: 'Передняя — от жимов.', how: 'Армейский жим, без прогиба.', patternRu: 'вертикальный жим' },
    { id: 'delt_mid', labelRu: 'средняя дельта', patternNeedles: /abduction|lateral.*raise|мах.*сторон|отведен.*сторон/i, why: 'Средняя — ширина.', how: 'Махи до уровня плеч.', patternRu: 'махи в стороны' },
    { id: 'delt_rear', labelRu: 'задняя дельта', patternNeedles: /rear.*delt|задн.*дельт|обратн.*мах/i, why: 'Задняя — баланс тяг.', how: 'Махи в наклоне, локти вверх.', patternRu: 'махи на заднюю' },
  ],
  quads: [
    { id: 'quads_compound', labelRu: 'квадрицепс — база', patternNeedles: /squat|присед|жим.*ног|leg.?press|lunge|выпад/i, why: 'База — присед/жим.', how: 'Глубоко, колени по носкам.', patternRu: 'присед/жим' },
    { id: 'quads_iso', labelRu: 'квадрицепс — изоляция', patternNeedles: /isolation_legs_quad|разгибан.*ног|sissy/i, why: 'Изоляция — добивка.', how: 'Разгибания, пауза 1с.', patternRu: 'разгибание' },
  ],
  hamstrings: [
    { id: 'ham_hip', labelRu: 'бицепс бедра — таз', patternNeedles: /hinge|румын|rdl|гудморнинг/i, why: 'Тазовый шарнир — stretch.', how: 'RDL, таз назад.', patternRu: 'румынская' },
    { id: 'ham_knee', labelRu: 'бицепс бедра — колено', patternNeedles: /isolation_legs_ham|сгибан.*ног|leg.?curl/i, why: 'Сгибание колена — пик.', how: 'Сгибания лёжа/сидя.', patternRu: 'сгибание' },
  ],
  glutes: [
    { id: 'glutes_max', labelRu: 'ягодицы — большая', patternNeedles: /glute_squat|мост|hip.?thrust/i, why: 'Большая — разгибание.', how: 'Мост, пауза 2с.', patternRu: 'мост' },
    { id: 'glutes_med', labelRu: 'ягодицы — средняя', patternNeedles: /abduction|отведен.*бедр|kick/i, why: 'Средняя — стабилизация.', how: 'Отведение.', patternRu: 'отведение' },
  ],
  biceps: [
    { id: 'biceps_long', labelRu: 'бицепс — длинная', patternNeedles: /biceps_lengthened|incline.*curl|наклон.*скам/i, why: 'Длинная — растянутая.', how: 'Наклонная 30°, супинация.', patternRu: 'наклонная' },
    { id: 'biceps_short', labelRu: 'бицепс — короткая', patternNeedles: /biceps_shortened|preacher|скотт|спайдер/i, why: 'Короткая — пик.', how: 'Скотт, без читинга.', patternRu: 'скотт' },
    { id: 'biceps_brachialis', labelRu: 'брахиалис', patternNeedles: /biceps_hammer|hammer|молот/i, why: 'Брахиалис — толщина руки.', how: 'Молотки нейтрально.', patternRu: 'молотки' },
  ],
  triceps: [
    { id: 'triceps_long', labelRu: 'трицепс — длинная', patternNeedles: /triceps_overhead|overhead|француз/i, why: 'Длинная — overhead.', how: 'Француз за голову.', patternRu: 'overhead' },
    { id: 'triceps_push', labelRu: 'трицепс — латеральная', patternNeedles: /triceps_pushdown|pushdown|разгибан.*блок/i, why: 'Латеральная — пик.', how: 'Блок, локти прижаты.', patternRu: 'блок' },
  ],
  calves: [
    { id: 'calves_gastro', labelRu: 'икры — икроножная', patternNeedles: /isolation_calves|подъём.*носк.*стоя|standing/i, why: 'Икроножная — прямое колено.', how: 'Стоя, пауза 2с.', patternRu: 'стоя' },
    { id: 'calves_soleus', labelRu: 'икры — камбаловидная', patternNeedles: /seated|сидя/i, why: 'Камбаловидная — согнуто.', how: 'Сидя, колено 90°.', patternRu: 'сидя' },
  ],
  traps: [{ id: 'traps', labelRu: 'трапеции', patternNeedles: /shrug|шраг/i, why: 'Трапеции.', how: 'Шраги.', patternRu: 'шраги' }],
  forearms: [{ id: 'forearms', labelRu: 'предплечья', patternNeedles: /forearm|запяст/i, why: 'Хват.', how: 'Сгибания запястий.', patternRu: 'запястья' }],
  abs: [{ id: 'abs', labelRu: 'пресс', patternNeedles: /crunch|скручиван/i, why: 'Пресс.', how: 'Скручивания.', patternRu: 'скручивания' }],
};

export const SUBGROUP_LABEL_RU: Record<string, string> = Object.fromEntries(
  Object.values(SUBGROUP_MAP).flat().map(d => [d.id, d.labelRu])
);

function resolveSubgroup(muscle: string, pattern: string, name: string, backSubgroup?: string, armSubgroup?: string): string {
  const lowerName = (name || '').toLowerCase();
  const pat = (pattern || '').toLowerCase();
  if (muscle === 'back' && backSubgroup) return backSubgroup;
  if (['biceps', 'triceps', 'forearms'].includes(muscle) && armSubgroup) {
    if (muscle === 'biceps') {
      if (/молот|hammer/i.test(lowerName)) return 'biceps_brachialis';
      if (/наклон.*скам|incline/i.test(lowerName)) return 'biceps_long';
      if (/проповед|preacher|спайдер|spider/i.test(lowerName)) return 'biceps_short';
      return 'biceps_short';
    }
    if (muscle === 'triceps') {
      if (/француз|french|overhead|из.?за.*голов/i.test(lowerName)) return 'triceps_long';
      if (/жим.*узк|close.?grip|брус/i.test(lowerName)) return 'triceps_long';
      return 'triceps_push';
    }
  }
  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(muscle)) {
    if (muscle === 'quads') {
      if (/разгибан.*ног|leg.?extension|sissy/i.test(lowerName) || pat.includes('isolation_legs_quad')) return 'quads_iso';
      return 'quads_compound';
    }
    if (muscle === 'hamstrings') {
      if (/сгибан.*ног|leg.?curl/i.test(lowerName) || pat.includes('isolation_legs_ham')) return 'ham_knee';
      return 'ham_hip';
    }
    if (muscle === 'glutes') {
      if (/отведен|abduction|kick/i.test(lowerName)) return 'glutes_med';
      return 'glutes_max';
    }
    if (muscle === 'calves') {
      if (/сидя|seated/i.test(lowerName)) return 'calves_soleus';
      return 'calves_gastro';
    }
  }
  const defs = SUBGROUP_MAP[muscle];
  if (!defs) return 'other';
  const hay = `${pat} ${lowerName}`;
  for (const d of defs) {
    if (d.patternNeedles.test(hay)) return d.id;
  }
  return defs[0]?.id || 'other';
}

function subgroupExplanation(muscle: string, subId: string): { why: string; how: string; patternRu: string; labelRu: string } | undefined {
  const def = (SUBGROUP_MAP[muscle] || []).find(d => d.id === subId);
  if (def) return { why: def.why, how: def.how, patternRu: def.patternRu, labelRu: def.labelRu };
  if (subId === 'other') return { why: 'Смешанный паттерн.', how: 'Проверьте паттерн.', patternRu: 'прочее', labelRu: 'прочее' };
  return undefined;
}

function getPatternForExercise(ex: any): string {
  if ((ex as any).movementPattern) return (ex as any).movementPattern;
  // BBPlan хранит muscle, не group — передаём group=muscle и type=exerciseType
  return derivePattern({ name: ex.name, group: ex.muscle, type: (ex as any).exerciseType || (ex as any).type, targetMuscle: ex.muscle } as any) || 'other';
}

/** Русские подписи паттернов движения (derivePattern / movementPattern → RU). */
export const PATTERN_RU: Record<string, string> = {
  horizontal_push: 'горизонтальный жим',
  incline_push: 'наклонный жим',
  decline_push: 'жим в наклоне вниз',
  dip_push: 'брусья',
  vertical_push: 'вертикальный жим',
  horizontal_pull: 'горизонтальная тяга',
  vertical_pull: 'вертикальная тяга',
  squat: 'присед / жим ногами',
  hinge: 'тазобедренный шарнир (RDL)',
  glute_squat: 'ягодичный мост / тяга',
  lunge: 'выпады',
  isolation_chest: 'изоляция груди',
  isolation_back: 'изоляция спины',
  isolation_shoulders: 'изоляция плеч',
  isolation_arms: 'изоляция рук',
  isolation_legs_quad: 'разгибание ног',
  isolation_legs_ham: 'сгибание ног',
  isolation_calves: 'икры',
  vertical_pull_lat: 'вертикальная тяга',
  horizontal_pull_row: 'тяга в наклоне',
  heavy_row: 'тяжёлая тяга',
  supported_row: 'тяга с упором',
  unilateral_row: 'тяга одной рукой',
  lat_isolation: 'изоляция широчайших',
  upper_back: 'верх спины',
  rear_delts: 'задняя дельта',
  traps: 'шраги',
  erectors: 'разгибатели',
  biceps_lengthened: 'бицепс растянутый',
  biceps_shortened: 'бицепс сокращённый',
  biceps_hammer: 'молотки',
  triceps_overhead: 'трицепс над головой',
  triceps_pushdown: 'трицепс блок',
  triceps_compound: 'трицепс база',
  forearm: 'предплечья',
  core: 'кор',
  anti_rotation: 'анти-ротация',
  rotation: 'ротация',
  carry: 'переноска',
  unknown: 'прочее',
  other: 'прочее',
};

export function patternRu(pattern: string): string {
  return PATTERN_RU[pattern] || pattern;
}

export function buildBBExpandedSummary(plan: BBPlan): BBExpandedSummary {
  const byMuscle: Record<string, BBMuscleSummary> = {};
  let totalWorkingSets = 0;
  const weeksCount = Math.max(1, plan.weeks?.length || 1);

  // Агрегируем суммарно по всем неделям, затем усредним на неделю (иначе 8-нед план даёт 8×).
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      const seenMuscles = new Set<string>();
      for (const ex of session.exercises) {
        const isWarmup = !!(ex as any).warmupActivator;
        const muscle = ex.muscle;
        if (!muscle) continue;
        if (!byMuscle[muscle]) byMuscle[muscle] = { muscle, sessionsPerWeek: 0, workingSets: 0, warmupSets: 0, directSets: 0, indirectSets: 0, byPattern: {}, bySession: [], byExercise: {}, subGroups: {} };
        const m = byMuscle[muscle];
        if (isWarmup) {
          m.warmupSets += ex.sets || 0;
          continue;
        }
        const contributions = exerciseVolumeContributions(ex as any);
        let hasDirect = false;
        for (const c of contributions) {
          if (c.muscle === muscle) { if (c.source === 'direct') { m.directSets += c.directSets; hasDirect = true; } else m.indirectSets += c.effectiveSets; }
          else if (c.source === 'indirect' && c.muscle === muscle) m.indirectSets += c.effectiveSets;
        }
        if (!hasDirect && contributions.every(c => c.muscle !== muscle)) m.directSets += ex.sets || 0;
        m.workingSets += ex.sets || 0;
        totalWorkingSets += ex.sets || 0;
        const pattern = getPatternForExercise(ex);
        m.byPattern[pattern] = (m.byPattern[pattern] || 0) + (ex.sets || 0);
        const exName = ex.exerciseName || ex.name || 'unknown';
        m.byExercise[exName] = (m.byExercise[exName] || 0) + (ex.sets || 0);
        const sub = resolveSubgroup(muscle, pattern, ex.name || '', (ex as any).backSubgroup, (ex as any).armSubgroup);
        if (!m.subGroups) m.subGroups = {};
        if (!m.subGroups[sub]) {
          const expl = subgroupExplanation(muscle, sub);
          m.subGroups[sub] = { workingSets: 0, byPattern: {}, byExercise: {}, explanation: expl as any };
        }
        const sg = m.subGroups[sub];
        sg.workingSets += ex.sets || 0;
        sg.byPattern[pattern] = (sg.byPattern[pattern] || 0) + (ex.sets || 0);
        sg.byExercise[exName] = (sg.byExercise[exName] || 0) + (ex.sets || 0);
        if (!seenMuscles.has(muscle)) { seenMuscles.add(muscle); m.sessionsPerWeek += 1; }
      }
    }
  }

  // Нормализуем на неделю (среднее) — только целые подходы, без дробных 16.5.
  for (const m of Object.values(byMuscle)) {
    m.workingSets = Math.round(m.workingSets / weeksCount);
    m.warmupSets = Math.round(m.warmupSets / weeksCount);
    m.directSets = Math.round(m.directSets / weeksCount);
    m.indirectSets = Math.round(m.indirectSets / weeksCount);
    m.sessionsPerWeek = Math.round(m.sessionsPerWeek / weeksCount * 10) / 10;
    for (const k of Object.keys(m.byPattern)) m.byPattern[k] = Math.round(m.byPattern[k] / weeksCount);
    for (const k of Object.keys(m.byExercise)) m.byExercise[k] = Math.round(m.byExercise[k] / weeksCount);
    if (m.subGroups) {
      for (const sg of Object.values(m.subGroups as Record<string, any>)) {
        sg.workingSets = Math.round(sg.workingSets / weeksCount);
        for (const k of Object.keys(sg.byPattern)) sg.byPattern[k] = Math.round(sg.byPattern[k] / weeksCount);
        for (const k of Object.keys(sg.byExercise)) sg.byExercise[k] = Math.round(sg.byExercise[k] / weeksCount);
      }
    }
    // Гарантируем, что все подгруппы/головки мышцы присутствуют в сводке (даже с 0), включая бицепс/трицепс.
    const defs = SUBGROUP_MAP[m.muscle];
    if (defs) {
      if (!m.subGroups) m.subGroups = {};
      for (const d of defs) {
        if (!m.subGroups[d.id]) {
          m.subGroups[d.id] = { workingSets: 0, byPattern: {}, byExercise: {}, explanation: { why: d.why, how: d.how, patternRu: d.patternRu, labelRu: d.labelRu } as any };
        }
      }
    }
  }
  totalWorkingSets = Math.round(totalWorkingSets / weeksCount);

  // bySession — только шаблоная неделя (первая), иначе 8 нед × 5 дн = 40 записей «в куче».
  const templateWeek = plan.weeks[0];
  if (templateWeek) {
    for (const session of templateWeek.sessions) {
      const perSession: Record<string, { working: number; warmup: number }> = {};
      for (const ex of session.exercises) {
        const isWarmup = !!(ex as any).warmupActivator;
        if (!ex.muscle) continue;
        if (!perSession[ex.muscle]) perSession[ex.muscle] = { working: 0, warmup: 0 };
        if (isWarmup) perSession[ex.muscle].warmup += ex.sets || 0;
        else perSession[ex.muscle].working += ex.sets || 0;
      }
      for (const [muscle, v] of Object.entries(perSession)) {
        if (!byMuscle[muscle]) continue;
        byMuscle[muscle].bySession.push({ day: session.day, working: v.working, warmup: v.warmup });
      }
    }
  }

  return { byMuscle, totalWorkingSets };
}

/** Текстовое представление сводки (для отчёта/расширенного вывода). */
export function formatBBExpandedSummary(plan: BBPlan): string {
  const s = buildBBExpandedSummary(plan);
  const lines: string[] = [];
  for (const [muscle, m] of Object.entries(s.byMuscle)) {
    lines.push(`${muscle} — ${m.sessionsPerWeek} тренировок/нед, ${m.workingSets} рабочих, ${m.warmupSets} разминочных`);
    for (const sess of m.bySession) {
      lines.push(`  День ${sess.day}: ${sess.working} рабочих подходов, ${sess.warmup} разминочных`);
    }
    const patterns = Object.entries(m.byPattern).map(([p, v]) => `${patternRu(p)}: ${v}`).join(', ');
    if (patterns) lines.push(`  Паттерны: ${patterns}`);
    lines.push(`  Прямая нагрузка: ${m.directSets}, косвенная: ${Math.round(m.indirectSets)}`);
    if (m.subGroups && Object.keys(m.subGroups).length) {
      for (const [subId, sg] of Object.entries(m.subGroups)) {
        const expl = (sg as any).explanation;
        lines.push(`  └ ${expl?.labelRu || subId}: ${sg.workingSets} сетов`);
        const subPat = Object.entries(sg.byPattern).map(([p, v]) => `${patternRu(p)}: ${v}`).join(', ');
        if (subPat) lines.push(`     Паттерн: ${subPat}`);
        if (expl?.why) lines.push(`     Чем хорошо: ${expl.why}`);
        if (expl?.how) lines.push(`     Как работает: ${expl.how}`);
      }
    }
  }
  lines.push(`Итого рабочих сетов/нед: ${s.totalWorkingSets}`);
  return lines.join('\n');
}
