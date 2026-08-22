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
 * Этап 21 (2026-08-22): подгруппы для ВСЕХ мышц, не только спины, + пояснения
 * «чем хорошо и как работает» из единого источника (каталог + биомеханика).
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
  subGroups?: Record<string, { workingSets: number; byPattern: Record<string, number>; byExercise: Record<string, number>; explanation?: { why: string; how: string; patternRu: string } }>;
}

export interface BBExpandedSummary {
  byMuscle: Record<string, BBMuscleSummary>;
  totalWorkingSets: number;
}

// Каноническая таксономия подмышц (источник: TARGET_MUSCLE_DB + EXERCISE_CATALOG.targetMuscle + WEAK_TO_MUSCLE)
// Для каждой мышцы — список подгрупп с ожидаемыми паттернами, RU-лейблом и пояснением «чем хорошо / как работает».
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
    { id: 'chest_upper', labelRu: 'верх груди (ключичная)', patternNeedles: /incline|наклон.*30|верх.*груд/i, why: 'Ключичная порция чаще отстаёт — наклон 30° переносит линию тяги к ключице и растягивает верх в нижней точке.', how: 'Жим гантелей/штанги на наклонной 30°, локти 75°, лопатки сведены, пауза 1с внизу, сведение гантелей вверху — пик. Не 45° (уходит в дельту).', patternRu: 'наклонный жим' },
    { id: 'chest_mid', labelRu: 'середина груди (стернальная)', patternNeedles: /horizontal_push|жим лёжа|жим.*лёж|bench/i, why: 'Стернальная середина — основной массив, горизонтальный жим даёт максимум механического натяжения.', how: 'Жим штанги/гантелей лёжа, хват чуть шире плеч, локти под 75°, грудь «колесом», касание сосков, без отбива.', patternRu: 'горизонтальный жим' },
    { id: 'chest_lower', labelRu: 'низ груди (край)', patternNeedles: /decline|dip_push|брус|отриц|decline/i, why: 'Нижняя порция формирует край и толщину — dips/decline дают плечо в отведении вниз.', how: 'Отжимания на брусьях (наклон вперёд 30°) или жим на decline -15°, локти в стороны, растяжение внизу, мощное сведение.', patternRu: 'низкий жим / брусья' },
    { id: 'chest_iso', labelRu: 'изоляция груди (растянутая)', patternNeedles: /isolation_chest|fly|развод|кроссовер|crossover|бабоч|pec.?deck|сведение/i, why: 'Изоляция в растянутой позиции — метаболический стресс и пиковое сокращение без трицепса.', how: 'Разводка/кроссовер/бабочка, локти фиксированы полусогнуты, пауза 2с в растяжении и 1с в сведении, вес второстепенен — форма важнее.', patternRu: 'изоляция груди' },
  ],
  back: [
    { id: 'back_width', labelRu: 'широчайшая (ширина)', patternNeedles: /vertical_pull|lat_isolation|подтяг|верхн.*блок|пуловер|прям.*рук/i, why: 'Ширина — широчайшая; вертикальная тяга даёт длинный рычаг и растяжение по дуге.', how: 'Тяга локтями вниз к рёбрам, хват шире плеч на 15см, сведение лопаток вверху, возврат 2-3с, не тянуть за голову.', patternRu: 'вертикальная тяга' },
    { id: 'back_thickness', labelRu: 'толщина (ромб/середина)', patternNeedles: /heavy_row|supported_row|unilateral_row|тяга.*наклон|тяга.*гриф|горизонтал/i, why: 'Толщина — ромбовидные/середина; горизонтальная тяга строит плотность и сводит лопатки.', how: 'Тяга штанги/Т-грифа/блока к низу живота, наклон 45°, локти вдоль тела = широчайшие, в стороны = ромб, сведение лопаток обязательно.', patternRu: 'горизонтальная тяга' },
    { id: 'upper_back', labelRu: 'верх спины', patternNeedles: /upper_back|тяга.*груд.*упор|seal|гребн/i, why: 'Верх спины держит осанку и стабилизирует жимы/тяги.', how: 'Тяга с упором грудью/seal row/гребной тренажёр, грудь на подушке, тяга к животу, локти в стороны.', patternRu: 'верхняя тяга' },
    { id: 'rear_delts', labelRu: 'задняя дельта', patternNeedles: /rear_delt|задн.*дельт|лиц.*тяга|face.?pull/i, why: 'Задняя дельта — самая отстающая, отвечает за здоровье плеч и 3D-эффект.', how: 'Тяга к лицу/обратная бабочка, локти вверх, разворот мизинцем наружу, медленный возврат 3с, сведение лопаток.', patternRu: 'тяга к лицу' },
    { id: 'traps', labelRu: 'трапеции', patternNeedles: /shrug|шраг|трапец/i, why: 'Трапеции — каркас верха, шраги дают пиковое сокращение с паузой.', how: 'Шраги штанги/гантелей, плечи к ушам без вращения, пауза 1с вверху, не тянуть бицепсом.', patternRu: 'шраги' },
    { id: 'erectors', labelRu: 'разгибатели', patternNeedles: /erector|гиперэкстенз|good.?morning|гудморнинг|станов/i, why: 'Разгибатели держат нейтральный позвоночник при тягах/приседах.', how: 'Гиперэкстензия/гудморнинг, нейтральная спина, таз ниже плеч, не переразгибаться вверху.', patternRu: 'гиперэкстензия' },
    { id: 'other', labelRu: 'прочее спины', patternNeedles: /other/i, why: 'Смешанный паттерн — закрывает пробел объёма без акцентированного стимула.', how: 'Держит объём, но не заменяет вертикаль/горизонталь; проверьте паттерн.', patternRu: 'прочее' },
  ],
  shoulders: [
    { id: 'delt_front', labelRu: 'передняя дельта', patternNeedles: /vertical_push|жим.*стоя|жим.*сидя|армейск|перед.*собой/i, why: 'Передняя дельта получает косвенно от жимов груди; прямой объём — только при specialization.', how: 'Армейский жим/жим гантелей сидя, хват чуть шире плеч, без прогиба поясницы, гриф к ключице → над головой.', patternRu: 'вертикальный жим' },
    { id: 'delt_mid', labelRu: 'средняя дельта', patternNeedles: /abduction|lateral.*raise|мах|отведен.*рук|разведен/i, why: 'Средняя дельта — ширина плеч; изолированные махи в середине амплитуды дают пик без трапеции.', how: 'Махи в стороны/в кроссовере, чуть наклон вперёд, локти полусогнуты, до уровня плеч (выше — трапеция), мизинец ведёт.', patternRu: 'махи в стороны' },
    { id: 'delt_rear', labelRu: 'задняя дельта', patternNeedles: /rear.*delt|задн.*дельт|обратн.*мах|face.?pull/i, why: 'Задняя дельта балансирует тяги и стабилизирует плечо.', how: 'Махи в наклоне/обратная бабочка/face pull, наклон 60-70°, локти вверх, не круглить спину.', patternRu: 'махи на заднюю дельту' },
  ],
  quads: [
    { id: 'quads_compound', labelRu: 'квадрицепс — база', patternNeedles: /compound_squat|squat|присед|жим.*ног|leg.?press|хак|hack|lunge|выпад/i, why: 'База квадрицепса — присед/жим ногами дают максимум натяжения при глубокой амплитуде и вертикальном корпусе.', how: 'Присед/гакк/жим ногами, стопы на ширине плеч, колени по линии носков, глубина ниже параллели, грудь вверх, не отрывать поясницу.', patternRu: 'присед/жим ногами' },
    { id: 'quads_iso', labelRu: 'квадрицепс — изоляция (растянутая)', patternNeedles: /leg_extension|разгибан.*ног|sissy|sissy/i, why: 'Изоляция в растянутой — добивка прямой головки без осевой нагрузки, пик наверху.', how: 'Разгибания ног/сисси-присед, полное разгибание с паузой 1с наверху, возврат 3с, без читинга.', patternRu: 'разгибание ног' },
  ],
  hamstrings: [
    { id: 'ham_hip', labelRu: 'бицепс бедра — тазобедренный шарнир', patternNeedles: /rdl_hinge|hinge|румын|rdl|гудморнинг|good.?morning|мёртв/i, why: 'Длинная головка бицепса бедра растягивается при наклоне с тазом назад — hinge даёт максимальный stretch.', how: 'Румынская тяга/гудморнинг, таз назад, гриф скользит по ногам, растяжение → мощное сокращение ягодицами, без округления поясницы.', patternRu: 'румынская тяга' },
    { id: 'ham_knee', labelRu: 'бицепс бедра — сгибание колена', patternNeedles: /leg_curl|сгибан.*ног|сгибания ног/i, why: 'Сгибание колена изолирует бицепс бедра в сокращённой позиции, баланс к hinge.', how: 'Сгибания лёжа/сидя/стоя, полное сгибание с паузой 1с, таз прижат, возврат медленный.', patternRu: 'сгибание ног' },
  ],
  glutes: [
    { id: 'glutes_max', labelRu: 'ягодицы — большая', patternNeedles: /hip_thrust|glute.*bridge|мост|hip/i, why: 'Большая ягодичная — главный разгибатель бедра; мост/hip thrust даёт пик в полном разгибании.', how: 'Ягодичный мост/hip thrust, гриф на складке таза, таз вверх до полного разгибания, пауза 2с, не гиперэкстензия поясницы.', patternRu: 'ягодичный мост' },
    { id: 'glutes_med', labelRu: 'ягодицы — средняя', patternNeedles: /abduction|отведен.*бедр|разведен.*ног|kick.?back/i, why: 'Средняя ягодичная стабилизирует таз и формирует округлость сбоку.', how: 'Отведение/разведение ног, kickback в блоке, корпус фиксирован, пауза 1с в пике, без раскачки.', patternRu: 'отведение бедра' },
  ],
  biceps: [
    { id: 'biceps_long', labelRu: 'бицепс — длинная головка (растянутая)', patternNeedles: /biceps_lengthened|incline.*curl|наклон.*скам/i, why: 'Длинная головка растягивается при плече за корпусом — incline curl даёт максимальный lengthened-стимул.', how: 'Подъём на наклонной 30-45°, руки висят = растяжение, супинация наверху, пауза 1с, без читинга.', patternRu: 'подъём на наклонной' },
    { id: 'biceps_short', labelRu: 'бицепс — короткая головка (пик)', patternNeedles: /biceps_shortened|preacher|проповед|спайдер|spider|концентр/i, why: 'Короткая головка отвечает за пик; скамья Скотта убирает читинг и даёт чистое сокращение.', how: 'Скотт/спайдер/концентрация, подмышки на скамье, полное растяжение внизу, без раскачки, пауза 1с наверху.', patternRu: 'скотт/пик' },
    { id: 'biceps_brachialis', labelRu: 'брахиалис', patternNeedles: /biceps_hammer|hammer|молот|нейтрал/i, why: 'Брахиалис под бицепсом толстит руку визуально и усиливает хват.', how: 'Молотки/нейтральный хват, без супинации, локти прижаты, пауза 1с наверху.', patternRu: 'молотки' },
  ],
  triceps: [
    { id: 'triceps_long', labelRu: 'трицепс — длинная головка', patternNeedles: /triceps_overhead|overhead|француз|french|из.?за.*голов/i, why: 'Длинная головка растягивается при руке за головой — overhead даёт лучший рост.', how: 'Француз/overhead в блоке, локти к потолку, опускание за голову = растяжение, не разводить локти.', patternRu: 'overhead/француз' },
    { id: 'triceps_push', labelRu: 'трицепс — латеральная/медиальная', patternNeedles: /triceps_pushdown|pushdown|разгибан.*блок|канат/i, why: 'Латеральная/медиальная — объём и «подкова»; pushdown даёт пик без плеча.', how: 'Разгибания на блоке, локти прижаты, плечо неподвижно, полное разгибание с паузой 1с, разворот каната.', patternRu: 'разгибание на блоке' },
    { id: 'triceps_compound', labelRu: 'трицепс — компаунд', patternNeedles: /triceps_compound|жим.*узк|close.?grip|брус/i, why: 'Жим узким/отжимания — тяжёлый compound для трицепса при наличии силового бюджета.', how: 'Жим узким хватом/брусья, хват на ширине плеч, локти вдоль тела, без flaring.', patternRu: 'жим узким' },
  ],
  calves: [
    { id: 'calves_gastro', labelRu: 'икры — икроножная (прямое колено)', patternNeedles: /calf|носк|стоя/i, why: 'Икроножная работает при прямом колене — стоя даёт максимум растяжения внизу.', how: 'Подъёмы стоя/в тренажёре, полная амплитуда ниже платформы, пауза 2с наверху, возврат 3с.', patternRu: 'подъёмы стоя' },
    { id: 'calves_soleus', labelRu: 'икры — камбаловидная (согнуто)', patternNeedles: /seated|сидя/i, why: 'Камбаловидная под икроножной — акцент при согнутом колене (сидя).', how: 'Подъёмы сидя, колено 90°, пауза 2с наверху, полный stretch внизу.', patternRu: 'подъёмы сидя' },
  ],
  traps: [
    { id: 'traps', labelRu: 'трапеции', patternNeedles: /shrug|шраг/i, why: 'Трапеции — шраги с паузой и без вращения дают пик.', how: 'Шраги, плечи к ушам, пауза 1с, без вращения плеч, не тянуть бицепсом.', patternRu: 'шраги' },
  ],
  forearms: [
    { id: 'forearms', labelRu: 'предплечья', patternNeedles: /forearm|запяст|wrist/i, why: 'Хват и супинация — изолирующие сгибания/разгибания запястий.', how: 'Сгибания запястий, предплечье на скамье, полный ROM, пауза 1с.', patternRu: 'сгибания запястий' },
  ],
  abs: [
    { id: 'abs', labelRu: 'пресс', patternNeedles: /crunch|скручив|подъём.*ног|leg.?raise/i, why: 'Пресс — скручивания с короткой амплитудой и пиком, без рывков.', how: 'Скручивания/подъёмы ног, лопатки от пола, пауза 1с в пике, руки за головой без тяги шеи.', patternRu: 'скручивания' },
  ],
  glutes_full: [
    { id: 'glutes_max', labelRu: 'ягодицы — большая', patternNeedles: /hip_thrust|glute/i, why: 'См. glutes_max', how: 'См. glutes_max', patternRu: 'ягодичный мост' },
  ],
};

export const SUBGROUP_LABEL_RU: Record<string, string> = Object.fromEntries(
  Object.values(SUBGROUP_MAP).flat().map(d => [d.id, d.labelRu])
);

function resolveSubgroup(muscle: string, pattern: string, name: string, backSubgroup?: string, armSubgroup?: string): string {
  const lowerName = (name || '').toLowerCase();
  const pat = (pattern || '').toLowerCase();
  // Приоритет — явные аннотации движка (не теряем точность для спины/рук)
  if (muscle === 'back' && backSubgroup) return backSubgroup;
  if (['biceps', 'triceps', 'forearms'].includes(muscle) && armSubgroup) {
    // armSubgroup из annotateArmExercise — coarse (biceps/triceps), маппим к детальному по имени
    if (muscle === 'biceps') {
      if (/молот|hammer/i.test(lowerName)) return 'biceps_brachialis';
      if (/наклон.*скам|incline/i.test(lowerName)) return 'biceps_long';
      if (/проповед|preacher|спайдер|spider|концентр/i.test(lowerName)) return 'biceps_short';
      return 'biceps_short';
    }
    if (muscle === 'triceps') {
      if (/француз|french|overhead|из.?за.*голов/i.test(lowerName)) return 'triceps_long';
      if (/жим.*узк|close.?grip|брус/i.test(lowerName)) return 'triceps_compound';
      return 'triceps_push';
    }
  }
  // Ноги — используем classifyLegExercise паттерн как подсказку
  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(muscle)) {
    if (muscle === 'quads') {
      if (/разгибан.*ног|leg.?extension|sissy/i.test(lowerName) || pat.includes('leg_extension') || pat.includes('sissy')) return 'quads_iso';
      return 'quads_compound';
    }
    if (muscle === 'hamstrings') {
      if (/сгибан.*ног|leg.?curl/i.test(lowerName) || pat.includes('leg_curl')) return 'ham_knee';
      return 'ham_hip';
    }
    if (muscle === 'glutes') {
      if (/отведен|abduction|kick/i.test(lowerName) || pat.includes('glute_accessory')) return 'glutes_med';
      return 'glutes_max';
    }
    if (muscle === 'calves') {
      if (/сидя|seated/i.test(lowerName)) return 'calves_soleus';
      return 'calves_gastro';
    }
  }
  // Общий путь — по SUBGROUP_MAP паттерн-регуляркам
  const defs = SUBGROUP_MAP[muscle];
  if (!defs) return 'other';
  const hay = `${pat} ${lowerName}`;
  for (const d of defs) {
    if (d.patternNeedles.test(hay)) return d.id;
  }
  // Fallback: первая подгруппа мышцы (покрывает 100% directSets, не теряем объём)
  return defs[0]?.id || 'other';
}

function subgroupExplanation(muscle: string, subId: string): { why: string; how: string; patternRu: string; labelRu: string } | undefined {
  const def = (SUBGROUP_MAP[muscle] || []).find(d => d.id === subId);
  if (def) return { why: def.why, how: def.how, patternRu: def.patternRu, labelRu: def.labelRu };
  if (subId === 'other') return { why: 'Смешанный паттерн — держит объём, но не заменяет целевые подгруппы.', how: 'Проверьте паттерн, замените на целевое движение подгруппы.', patternRu: 'прочее', labelRu: 'прочее' };
  return undefined;
}

export function buildBBExpandedSummary(plan: BBPlan): BBExpandedSummary {
  const byMuscle: Record<string, BBMuscleSummary> = {};
  let totalWorkingSets = 0;

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
        // Косвенный вклад (secondary мышцы compound) — отдельно.
        const contributions = exerciseVolumeContributions(ex as any);
        let hasDirect = false;
        for (const c of contributions) {
          if (c.muscle === muscle) { if (c.source === 'direct') { m.directSets += c.directSets; hasDirect = true; } else m.indirectSets += c.effectiveSets; }
          else if (c.source === 'indirect' && c.muscle === muscle) m.indirectSets += c.effectiveSets;
        }
        if (!hasDirect && contributions.every(c => c.muscle !== muscle)) m.directSets += ex.sets || 0;
        m.workingSets += ex.sets || 0;
        totalWorkingSets += ex.sets || 0;
        const pattern = (ex as any).movementPattern || derivePattern(ex as any) || 'other';
        m.byPattern[pattern] = (m.byPattern[pattern] || 0) + (ex.sets || 0);
        const exName = ex.exerciseName || ex.name || 'unknown';
        m.byExercise[exName] = (m.byExercise[exName] || 0) + (ex.sets || 0);
        // Подгруппы для ВСЕХ мышц (этап 21): не только back, но и chest/shoulders/legs/arms
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

  // bySession: накопим по дням (порядок).
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
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
      lines.push(`  тренировка: ${sess.working} рабочих, ${sess.warmup} разминочных`);
    }
    const patterns = Object.entries(m.byPattern).map(([p, v]) => `${p}: ${v}`).join(', ');
    if (patterns) lines.push(`  паттерн: ${patterns}`);
    lines.push(`  direct: ${m.directSets}, косвенная: ${Math.round(m.indirectSets)}`);
    if (m.subGroups && Object.keys(m.subGroups).length) {
      for (const [subId, sg] of Object.entries(m.subGroups)) {
        const expl = (sg as any).explanation;
        lines.push(`  └ ${expl?.labelRu || subId}: ${sg.workingSets} сетов`);
        const subPat = Object.entries(sg.byPattern).map(([p, v]) => `${p}: ${v}`).join(', ');
        if (subPat) lines.push(`     паттерн: ${subPat}`);
        if (expl?.why) lines.push(`     чем хорошо: ${expl.why}`);
        if (expl?.how) lines.push(`     как работает: ${expl.how}`);
      }
    }
  }
  lines.push(`Итого рабочих сетов/нед: ${s.totalWorkingSets}`);
  return lines.join('\n');
}
