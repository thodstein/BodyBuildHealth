/**
 * weakpoint-pl.ts — диагностика мёртвой точки силовых движений → ассистентные упражнения (Этап PL0, NEW).
 * Жим лёжа / Присед / Становая: по слабому участку амплитуды подбирает спецификацию
 * (дожимы 3/5/8/10 см, жим в раме старт/дожим, тяга из ямы/с плинтов/с остановками, присед в широкой/на груди).
 * Ассистентные берутся из lms-exercises (каталог СРЦ) и exercise-catalog.
 */
import { LMS_EXERCISES } from '../../data/lms-cycles/lms-exercises';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import type { Exercise } from '../../core/types';

const AVAILABLE_NAMES = new Set<string>(LMS_EXERCISES.map((e: { name: string }) => e.name));

function getNamesAvailable(): Set<string> {
  return AVAILABLE_NAMES;
}

function findExerciseByLabel(label: string): Exercise | undefined {
  const n = label.toLowerCase().replace(/ё/g, 'е');
  const ex = EXERCISE_CATALOG.find((e: Exercise) => e.name.toLowerCase().replace(/ё/g, 'е') === n);
  if (ex) return ex;
  // contains-match для длинных названий
  return EXERCISE_CATALOG.find((e: Exercise) => {
    const en = e.name.toLowerCase().replace(/ё/g, 'е');
    return en.length > 2 && (en.includes(n) || n.includes(en));
  });
}

export type Lift = 'bench' | 'squat' | 'deadlift' | 'ohp' | 'row' | 'pulldown' | 'incline_press' | 'sumo' | 'biceps' | 'triceps' | 'calf' | 'shrug';
export type WeakPoint = 'off_chest' | 'mid' | 'lockout' | 'start' | 'bottom'
  | 'sumo_start' | 'sumo_mid' | 'sumo_lockout'
  | 'ohp_start' | 'ohp_mid' | 'ohp_lockout'
  | 'row_start' | 'row_mid' | 'row_squeeze'
  | 'pd_top' | 'pd_mid' | 'pd_squeeze'
  | 'inc_off' | 'inc_mid' | 'inc_lockout'
  | 'biceps_start' | 'biceps_mid' | 'biceps_top'
  | 'triceps_start' | 'triceps_mid' | 'triceps_lockout'
  | 'calf_bottom' | 'calf_mid' | 'calf_top'
  | 'shrug_start' | 'shrug_mid' | 'shrug_top';

export interface WeakPointDiagnosis {
  lift: Lift;
  weakPoint: WeakPoint;
  label: string;
  description: string;
  assistance: string[];      // названия ассистентных упражнений
  intensityPct: number;      // % от PM для ассистентных
  rationale: string;
}

const DIAGNOSIS: Record<Lift, Partial<Record<WeakPoint, Omit<WeakPointDiagnosis, 'lift' | 'assistance'> & { assistanceFromCatalog: string[] }>>> = {
  bench: {
    off_chest: { weakPoint: 'off_chest', label: 'Сход со груди (старт)', description: 'Не хватает стартовой силы — слабые грудные/передняя дельта в нижней точке.', assistanceFromCatalog: ['Жим с паузой 2 секунды', 'Жим на наклонной скамье', 'Жим гантелей лежа на гор скамье'], intensityPct: 0.65, rationale: 'Усилить старт: пауза на груди + наклонный жим на верх груди.' },
    mid: { weakPoint: 'mid', label: 'Средняя точка', description: 'Зависание в середине — слабый переход грудные→трицепс.', assistanceFromCatalog: ['Жим средним хватом', 'Жим с остановками', 'Скоростной жим'], intensityPct: 0.7, rationale: 'Скоростной жим + средний хват для мощности в средней фазе.' },
    lockout: { weakPoint: 'lockout', label: 'Дожим (локдаун)', description: 'Не дожимает вверху — слабый трицепс/верхняя фаза.', assistanceFromCatalog: ['Дожим с 3 см', 'Дожим с 5 см', 'Дожим с 8 см', 'Дожим с 10 см', 'Жим в раме (дожим)'], intensityPct: 0.75, rationale: 'Дожимы с плинтов разной высоты — изолированная работа трицепса в верхней фазе.' },
    start: { weakPoint: 'start', label: 'Старт (с груди)', description: 'Стартовая сила.', assistanceFromCatalog: ['Жим в раме (старт)'], intensityPct: 0.7, rationale: 'Жим в раме со старта — съём с груди без опоры.' },
  },
  squat: {
    bottom: { weakPoint: 'bottom', label: 'Низ (выход из ямы)', description: 'Не выходит из нижней точки — слабые квадрицепсы/ягодицы.', assistanceFromCatalog: ['Приседание до параллели', 'Присед на груди', 'Жим ногами'], intensityPct: 0.7, rationale: 'Присед на груди акцентирует квадрицепсы; жим ногами — объём без нагрузки на поясницу.' },
    mid: { weakPoint: 'mid', label: 'Средняя фаза', description: 'Зависание в середине.', assistanceFromCatalog: ['Присед с остановками', 'Присед с паузой', 'Жим ногами'], intensityPct: 0.7, rationale: 'Остановки и паузы тренируют удержание позиции в переходе.' },
    lockout: { weakPoint: 'lockout', label: 'Дожим вверх', description: 'Не дожимает — слабые ягодицы/разгибатели.', assistanceFromCatalog: ['Наклоны', 'Румынская тяга', 'Присед в широкой постановке'], intensityPct: 0.65, rationale: 'Наклоны укрепляют разгибатели спины; РДЛ и широкая постановка — ягодицы/задняя цепь.' },
  },
  deadlift: {
    start: { weakPoint: 'start', label: 'Старт (с пола)', description: 'Не отрывает от пола — слабые ноги/спина в стартовой позиции.', assistanceFromCatalog: ['Становая тяга из ямы', 'Становая тяга с плинтов', 'Присед'], intensityPct: 0.7, rationale: 'Тяга из ямы (ниже обычного старта) + присед для силы ног в старте.' },
    mid: { weakPoint: 'mid', label: 'Середина (колени)', description: 'Зависание на коленях — слабая спина/переход.', assistanceFromCatalog: ['Становая тяга с остановками', 'Румынская тяга', 'Становая тяга с паузой ниже колен'], intensityPct: 0.7, rationale: 'Остановки/пауза тренируют удержание позиции; РДЛ — бицепс бедра/разгибатели.' },
    lockout: { weakPoint: 'lockout', label: 'Дожим (локдаун)', description: 'Не дожимает — слабые ягодицы/верх спины.', assistanceFromCatalog: ['Тяга с плинтов (rack pull)', 'Румынская тяга', 'Шраги'], intensityPct: 0.75, rationale: 'Тяга с плинтов (выше колен) — изолированный дожим; шраги — жёсткость верха.' },
    sumo_start: { weakPoint: 'sumo_start', label: 'Сумо: старт (срыв)', description: 'Срыв с пола в сумо — слабые ягодицы/приводящие бедра.', assistanceFromCatalog: ['Присед в широкой постановке', 'Становая тяга из ямы', 'Тяга с плинтов (rack pull)'], intensityPct: 0.7, rationale: 'Широкая постановка и тяга из ямы перегружают ягодицы/приводящие в стартовом положении сумо.' },
    sumo_lockout: { weakPoint: 'sumo_lockout', label: 'Сумо: дожим (замыкание)', description: 'Не замыкает бёдра вверху — слабые ягодицы/разгибатели спины.', assistanceFromCatalog: ['Тяга с плинтов (rack pull)', 'Присед в широкой постановке', 'Румынская тяга'], intensityPct: 0.75, rationale: 'Тяга с плинтов выше колен + широкая постановка — изоляция финальной фазы сумо.' },
  },
  ohp: {
    ohp_start: { weakPoint: 'ohp_start', label: 'Старт с плеч', description: 'Не хватает стартовой силы — слабые передние дельты в нижней точке.', assistanceFromCatalog: ['Армейский жим', 'Жим гантелей', 'Махи гантелями в стороны'], intensityPct: 0.65, rationale: 'Армейский жим + жим гантелей для силы дельт в старте.' },
    ohp_mid: { weakPoint: 'ohp_mid', label: 'Середина (переход)', description: 'Зависание по ходу — переход дельты→трицепс.', assistanceFromCatalog: ['Скоростной жим', 'Жим с остановками', 'Жим гантелей'], intensityPct: 0.7, rationale: 'Скоростной жим и остановки — мощность и контроль в переходе.' },
    ohp_lockout: { weakPoint: 'ohp_lockout', label: 'Дожим вверх', description: 'Не дожимает вверху — слабый трицепс/трапеции.', assistanceFromCatalog: ['Французский жим', 'Жим узким хватом', 'Армейский жим'], intensityPct: 0.75, rationale: 'Французский жим и узкий хват изолируют трицепс в локдауне.' },
  },
  row: {
    row_start: { weakPoint: 'row_start', label: 'Старт (съём)', description: 'Не начать тягу — слабые широчайшие в старте.', assistanceFromCatalog: ['Тяга гантели в наклоне', 'Тяга с плинтов (rack pull)', 'Гиперэкстензия'], intensityPct: 0.7, rationale: 'Тяга гантели и тяга с плинтов (мёртвая точка) — сила старта без дубля основного движения.' },
    row_mid: { weakPoint: 'row_mid', label: 'Середина (на пояс)', description: 'Зависание на уровне пояса — слабая концентрика.', assistanceFromCatalog: ['Тяга горизонтального блока', 'Тяга гантели в наклоне', 'Тяга верхнего блока обратным хватом'], intensityPct: 0.7, rationale: 'Тяга горизонтального блока и обратный хват — контролируемая концентрика к поясу.' },
    row_squeeze: { weakPoint: 'row_squeeze', label: 'Сведение лопаток', description: 'Не свести лопатки в пике — слабые ромбовидные/средняя трапеция.', assistanceFromCatalog: ['Гиперэкстензия', 'Тяга горизонтального блока', 'Подтягивания (прямой хват)'], intensityPct: 0.65, rationale: 'Гиперэкстензия + тяга к поясу для завершающего сведения лопаток.' },
  },
  pulldown: {
    pd_top: { weakPoint: 'pd_top', label: 'Верх (старт сверху)', description: 'Лопатки не опущены при старте — слабые широчайшие в верхней точке.', assistanceFromCatalog: ['Подтягивания (прямой хват)', 'Тяга верхнего блока широким хватом', 'Тяга верхнего блока обратным хватом'], intensityPct: 0.65, rationale: 'Подтягивания и широкий хват — сила старта сверху без дубля основного.' },
    pd_mid: { weakPoint: 'pd_mid', label: 'Середина (на грудь)', description: 'Зависание по ходу — слабый переход.', assistanceFromCatalog: ['Тяга верхнего блока обратным хватом', 'Тяга горизонтального блока', 'Тяга гантели в наклоне'], intensityPct: 0.7, rationale: 'Обратный хват и горизонтальная тяга — контроль в средней фазе.' },
    pd_squeeze: { weakPoint: 'pd_squeeze', label: 'Сведение к груди', description: 'Не дотянуть до груди — слабые широчайшие/большая круглая.', assistanceFromCatalog: ['Тяга верхнего блока V-рукоятью', 'Подтягивания (прямой хват)', 'Тяга гантели в наклоне'], intensityPct: 0.75, rationale: 'V-рукоять и подтягивания — доводка до груди и сведение.' },
  },
  incline_press: {
    inc_off: { weakPoint: 'inc_off', label: 'Сход с груди (верх)', description: 'Не хватает стартовой силы верха груди — слабые ключичные пучки.', assistanceFromCatalog: ['Жим гантелей на наклонной', 'Жим с паузой', 'Армейский жим'], intensityPct: 0.65, rationale: 'Жим гантелей на наклонной акцентирует верх груди в старте.' },
    inc_mid: { weakPoint: 'inc_mid', label: 'Середина', description: 'Зависание в середине — переход верх груди→трицепс.', assistanceFromCatalog: ['Жим с остановками', 'Скоростной жим', 'Жим гантелей на наклонной'], intensityPct: 0.7, rationale: 'Остановки и скоростной жим — мощность в средней фазе.' },
    inc_lockout: { weakPoint: 'inc_lockout', label: 'Дожим', description: 'Не дожимает вверху — слабый трицепс.', assistanceFromCatalog: ['Французский жим', 'Дожим с плинтов', 'Жим в раме (дожим)'], intensityPct: 0.75, rationale: 'Французский жим и дожимы изолируют трицепс в локдауне.' },
  },
  sumo: {
    sumo_start: { weakPoint: 'sumo_start', label: 'Сумо: срыв (старт с пола)', description: 'Срыв с пола в сумо — слабые ягодицы/приводящие бедра при вертикальном корпусе.', assistanceFromCatalog: ['Присед в широкой постановке', 'Становая тяга из ямы', 'Тяга с плинтов (rack pull)'], intensityPct: 0.7, rationale: 'Широкая постановка и тяга из ямы перегружают ягодицы/приводящие в стартовом положении сумо.' },
    sumo_mid: { weakPoint: 'sumo_mid', label: 'Сумо: середина (проход коленей)', description: 'Зависание на коленях в сумо — удержание позиции спиной и тазом при вертикальном торсе.', assistanceFromCatalog: ['Становая тяга с остановками', 'Румынская тяга', 'Тяга с плинтов (rack pull)'], intensityPct: 0.7, rationale: 'Остановки тренируют удержание позиции; РДЛ — бицепс бедра/ягодицы в проходе.' },
    sumo_lockout: { weakPoint: 'sumo_lockout', label: 'Сумо: замыкание бёдер (дожим)', description: 'Не замыкает бёдра вверху — слабые ягодицы/разгибатели спины.', assistanceFromCatalog: ['Тяга с плинтов (rack pull)', 'Присед в широкой постановке', 'Румынская тяга'], intensityPct: 0.75, rationale: 'Тяга с плинтов выше колен + широкая постановка — изоляция финальной фазы сумо.' },
  },
  biceps: {
    biceps_start: { weakPoint: 'biceps_start', label: 'Сгибание: старт (с полного разгибания)', description: 'Слабый срыв из полного разгибания локтя — недостаточная сила бицепса/брахиалиса в нижней точке.', assistanceFromCatalog: ['Подъём штанги на бицепс', 'Подъём на скамье Скотта', 'Сгибание на бицепс в блоках'], intensityPct: 0.6, rationale: 'Контролируемый старт без раскачки + изоляция Скотта — стартовая сила бицепса.' },
    biceps_mid: { weakPoint: 'biceps_mid', label: 'Сгибание: середина (переход)', description: 'Зависание в середине — слабый переход и недостаток объёма бицепса/брахиалиса.', assistanceFromCatalog: ['Подъём штанги на бицепс', 'Молотки (нейтральный хват)', 'Подъём гантелей на бицепс'], intensityPct: 0.65, rationale: 'Молотки включают брахиалис (толщина руки); штанга/гантели — контролируемая середина.' },
    biceps_top: { weakPoint: 'biceps_top', label: 'Сгибание: верхнее сокращение (пик)', description: 'Слабая пиковая контракция вверху — бицепс не «выкручивается» в верхней точке.', assistanceFromCatalog: ['Подъём гантелей на наклонной скамье', 'Паучий подъём (на наклонной скамье лицом вниз)', 'Молотки (нейтральный хват)'], intensityPct: 0.6, rationale: 'Наклонная скамья (растянутая позиция) и паучий подъём — пиковое сокращение и контроль верха.' },
  },
  triceps: {
    triceps_start: { weakPoint: 'triceps_start', label: 'Разгибание: старт (с согнутых рук)', description: 'Слабый старт из полного сгибания — недостаточная сила трицепса в растянутой позиции.', assistanceFromCatalog: ['Французский жим', 'Разгибание на трицепс в верхнем блоке', 'Жим узким хватом'], intensityPct: 0.6, rationale: 'Растянутая позиция (французский/overhead) — стартовая сила длинной головки.' },
    triceps_mid: { weakPoint: 'triceps_mid', label: 'Разгибание: середина', description: 'Зависание в середине — слабый переход трицепса.', assistanceFromCatalog: ['Жим узким хватом', 'Разгибание на трицепс в верхнем блоке', 'Отжимания на брусьях'], intensityPct: 0.65, rationale: 'Базовые жимы узким хватом + блок — объём середины амплитуды.' },
    triceps_lockout: { weakPoint: 'triceps_lockout', label: 'Разгибание: дожим (пик)', description: 'Слабый дожим вверху — трицепс не замыкает локоть.', assistanceFromCatalog: ['Разгибание на трицепс в верхнем блоке', 'Французский жим', 'Жим узким хватом'], intensityPct: 0.65, rationale: 'Блок и дожимы — изоляция пикового сокращения трицепса.' },
  },
  calf: {
    calf_bottom: { weakPoint: 'calf_bottom', label: 'Икры: низ (растяжение)', description: 'Слабая стартовая фаза из полного растяжения — недостаточная сила камбаловидной/икроножной.', assistanceFromCatalog: ['Подъём на носки стоя', 'Подъём на носки сидя', 'Жим носками в тренажёре'], intensityPct: 0.6, rationale: 'Полная амплитуда с паузой внизу — растянутая позиция икроножной.' },
    calf_mid: { weakPoint: 'calf_mid', label: 'Икры: середина', description: 'Зависание в середине подъёма — общий объём икр.', assistanceFromCatalog: ['Подъём на носки стоя', 'Подъём на носки в Смите', 'Подъём на носки сидя'], intensityPct: 0.65, rationale: 'Базовый объём икр + разные углы стопы.' },
    calf_top: { weakPoint: 'calf_top', label: 'Икры: верх (пик)', description: 'Слабое пиковое сокращение вверху — икры не удерживают пик.', assistanceFromCatalog: ['Подъём на носки стоя с паузой вверху', 'Подъём на носки сидя', 'Подъём на носки на одной ноге'], intensityPct: 0.6, rationale: 'Пауза 2с в пике — удержание сокращения.' },
  },
  shrug: {
    shrug_start: { weakPoint: 'shrug_start', label: 'Шраги: старт (съём)', description: 'Слабый съём штанги/гантелей — трапеции не стартуют движение.', assistanceFromCatalog: ['Шраги со штангой', 'Шраги с гантелями', 'Тяга штанги к подбородку'], intensityPct: 0.65, rationale: 'Тяжёлые шраги со штангой — стартовая сила трапеций.' },
    shrug_mid: { weakPoint: 'shrug_mid', label: 'Шраги: середина', description: 'Зависание по ходу — недостаточный объём трапеций.', assistanceFromCatalog: ['Шраги со штангой', 'Шраги в Смите', 'Тяга штанги к подбородку'], intensityPct: 0.65, rationale: 'Объёмные шраги + тяга к подбородку — середина траектории.' },
    shrug_top: { weakPoint: 'shrug_top', label: 'Шраги: пик (удержание)', description: 'Слабое пиковое удержание вверху — трапеции не фиксируют пик.', assistanceFromCatalog: ['Шраги со штангой с паузой вверху', 'Шраги с гантелями', 'Шраги в тренажёре'], intensityPct: 0.65, rationale: 'Пауза 2с в пике + изометрия — фиксация верха.' },
  },
};

export function diagnoseWeakPoint(lift: Lift, weakPoint: WeakPoint): WeakPointDiagnosis {
  const d = DIAGNOSIS[lift][weakPoint];
  if (!d) return { lift, weakPoint, label: '-', description: 'нет данных', assistance: [], intensityPct: 0.7, rationale: 'диагноз не определён' };
  // фильтруем ассистентные, которые есть в каталоге СРЦ; если нет - ищем в EXERCISE_CATALOG по имени
  const namesSet = getNamesAvailable();
  const assistance: string[] = [];
  const missing: string[] = [];
  for (const n of d.assistanceFromCatalog) {
    if (namesSet.has(n)) { assistance.push(n); continue; }
    const ex = findExerciseByLabel(n);
    if (ex) { assistance.push(ex.name); }
    else { missing.push(n); }
  }
  // Never leak unresolved labels downstream: builders expect catalog-backed
  // names and otherwise silently create unusable prescriptions.
  const list = assistance;
  return {
    lift, weakPoint, label: d.label, description: d.description,
    assistance: list, intensityPct: d.intensityPct,
    rationale: d.rationale + (missing.length ? ` (рекомендуется добавить в каталог: ${missing.join(', ')})` : ''),
  };
}

export const WEAK_POINTS_BY_LIFT: Record<Lift, WeakPoint[]> = {
  bench: ['off_chest', 'mid', 'lockout', 'start'],
  squat: ['bottom', 'mid', 'lockout'],
  deadlift: ['start', 'mid', 'lockout', 'sumo_start', 'sumo_lockout'],
  ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
  row: ['row_start', 'row_mid', 'row_squeeze'],
  pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
  incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
  sumo: ['sumo_start', 'sumo_mid', 'sumo_lockout'],
  biceps: ['biceps_start', 'biceps_mid', 'biceps_top'],
  triceps: ['triceps_start', 'triceps_mid', 'triceps_lockout'],
  calf: ['calf_bottom', 'calf_mid', 'calf_top'],
  shrug: ['shrug_start', 'shrug_mid', 'shrug_top'],
};
