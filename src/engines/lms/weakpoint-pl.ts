/**
 * weakpoint-pl.ts — диагностика мёртвой точки силовых движений → ассистентные упражнения (Этап PL0, NEW).
 * Жим лёжа / Присед / Становая: по слабому участку амплитуды подбирает спецификацию
 * (дожимы 3/5/8/10 см, жим в раме старт/дожим, тяга из ямы/с плинтов/с остановками, присед в широкой/на груди).
 * Ассистентные берутся из lms-exercises (каталог СРЦ) и exercise-catalog.
 */
import { LMS_EXERCISES } from '../../data/lms-cycles/lms-exercises';

export type Lift = 'bench' | 'squat' | 'deadlift' | 'ohp' | 'row' | 'pulldown' | 'incline_press';
export type WeakPoint = 'off_chest' | 'mid' | 'lockout' | 'start' | 'bottom' | 'sticking_mid'
  | 'ohp_start' | 'ohp_mid' | 'ohp_lockout'
  | 'row_start' | 'row_mid' | 'row_squeeze'
  | 'pd_top' | 'pd_mid' | 'pd_squeeze'
  | 'inc_off' | 'inc_mid' | 'inc_lockout';

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
    bottom: { weakPoint: 'bottom', label: 'Низ (выход из ямы)', description: 'Не выходит из нижней точки — слабые квадрицепсы/ягодицы.', assistanceFromCatalog: ['Приседание до параллели', 'Присед на груди', 'Присед в широкой постановке'], intensityPct: 0.7, rationale: 'Присед на груди акцентирует квадрицепсы; широкая постановка — ягодицы/приводящие.' },
    mid: { weakPoint: 'mid', label: 'Средняя фаза', description: 'Зависание в середине.', assistanceFromCatalog: ['Приседание', 'Жим ногами'], intensityPct: 0.7, rationale: 'Базовый присед + жим ногами для общего объёма квадрицепсов.' },
    lockout: { weakPoint: 'lockout', label: 'Дожим вверх', description: 'Не дожимает — слабые ягодицы/разгибатели.', assistanceFromCatalog: ['Наклоны', 'Присед в широкой постановке'], intensityPct: 0.65, rationale: 'Наклоны укрепляют разгибатели спины; широкая постановка — ягодицы.' },
  },
  deadlift: {
    start: { weakPoint: 'start', label: 'Старт (с пола)', description: 'Не отрывает от пола — слабые ноги/спина в стартовой позиции.', assistanceFromCatalog: ['Становая тяга из ямы', 'Становая тяга с плинтов', 'Присед'], intensityPct: 0.7, rationale: 'Тяга из ямы (ниже обычного старта) + присед для силы ног в старте.' },
    mid: { weakPoint: 'mid', label: 'Середина (колени)', description: 'Зависание на коленях — слабая спина/переход.', assistanceFromCatalog: ['Становая тяга с остановками', 'Тяга на прямых ногах'], intensityPct: 0.7, rationale: 'Тяга с остановками тренирует удержание позиции; RDL — бицепс бедра/разгибатели.' },
    lockout: { weakPoint: 'lockout', label: 'Дожим (локдаун)', description: 'Не дожимает — слабые ягодицы/верх спины.', assistanceFromCatalog: ['Становая тяга с плинтов'], intensityPct: 0.75, rationale: 'Тяга с плинтов (выше колен) — изолированный дожим.' },
  },
  ohp: {
    ohp_start: { weakPoint: 'ohp_start', label: 'Старт с плеч', description: 'Не хватает стартовой силы — слабые передние дельты в нижней точке.', assistanceFromCatalog: ['Армейский жим', 'Жим гантелей', 'Махи гантелями в стороны'], intensityPct: 0.65, rationale: 'Армейский жим + жим гантелей для силы дельт в старте.' },
    ohp_mid: { weakPoint: 'ohp_mid', label: 'Середина (переход)', description: 'Зависание по ходу — переход дельты→трицепс.', assistanceFromCatalog: ['Армейский жим', 'Жим гантелей', 'Махи гантелями в стороны'], intensityPct: 0.7, rationale: 'Скоростной жим + средний хват для мощности в средней фазе.' },
    ohp_lockout: { weakPoint: 'ohp_lockout', label: 'Дожим вверх', description: 'Не дожимает вверху — слабый трицепс/трапеции.', assistanceFromCatalog: ['Французский жим', 'Махи гантелями в стороны', 'Армейский жим'], intensityPct: 0.75, rationale: 'Французский жим изолирует трицепс в локдауне.' },
  },
  row: {
    row_start: { weakPoint: 'row_start', label: 'Старт (съём)', description: 'Не начать тягу — слабые широчайшие в старте.', assistanceFromCatalog: ['Тяга штанги в наклоне', 'Тяга гантели в наклоне', 'Гиперэкстензия'], intensityPct: 0.7, rationale: 'Тяга штанги/гантели в наклоне — базовый горизонтальный пул.' },
    row_mid: { weakPoint: 'row_mid', label: 'Середина (на пояс)', description: 'Зависание на уровне пояса — слабая концентрика.', assistanceFromCatalog: ['Тяга штанги в наклоне', 'Тяга верхнего блока', 'Тяга гантели в наклоне'], intensityPct: 0.7, rationale: 'Тяга верхнего блока + штанги в наклоне для усиления концентрической фазы.' },
    row_squeeze: { weakPoint: 'row_squeeze', label: 'Сведение лопаток', description: 'Не свести лопатки в пике — слабые ромбовидные/средняя трапеция.', assistanceFromCatalog: ['Гиперэкстензия', 'Тяга штанги в наклоне', 'Тяга верхнего блока'], intensityPct: 0.65, rationale: 'Гиперэкстензия + тяга к поясу для завершающего сведения.' },
  },
  pulldown: {
    pd_top: { weakPoint: 'pd_top', label: 'Верх (старт сверху)', description: 'Лопатки не опущены при старте — слабые широчайшие в верхней точке.', assistanceFromCatalog: ['Тяга верхнего блока', 'Подтягивания', 'Тяга гантели в наклоне'], intensityPct: 0.65, rationale: 'Подтягивания + тяга верхнего блока для силы в старте сверху.' },
    pd_mid: { weakPoint: 'pd_mid', label: 'Середина (на грудь)', description: 'Зависание по ходу — слабый переход.', assistanceFromCatalog: ['Тяга верхнего блока', 'Тяга гантели в наклоне'], intensityPct: 0.7, rationale: 'Тяга блока к груди + гантели для мощности в средней фазе.' },
    pd_squeeze: { weakPoint: 'pd_squeeze', label: 'Сведение к груди', description: 'Не дотянуть до груди — слабые широчайшие/большая круглая.', assistanceFromCatalog: ['Подтягивания', 'Тяга верхнего блока'], intensityPct: 0.75, rationale: 'Подтягивания — изолированная работа широчайших в нижней точке.' },
  },
  incline_press: {
    inc_off: { weakPoint: 'inc_off', label: 'Сход с груди (верх)', description: 'Не хватает стартовой силы верха груди — слабые ключичные пучки.', assistanceFromCatalog: ['Жим гантелей на наклонной', 'Жим гантелей', 'Армейский жим'], intensityPct: 0.65, rationale: 'Жим гантелей на наклонной акцентирует верх груди в старте.' },
    inc_mid: { weakPoint: 'inc_mid', label: 'Середина', description: 'Зависание в середине — переход верх груди→трицепс.', assistanceFromCatalog: ['Жим гантелей на наклонной', 'Жим гантелей', 'Армейский жим'], intensityPct: 0.7, rationale: 'Жим гантелей + средний хват для мощности в средней фазе.' },
    inc_lockout: { weakPoint: 'inc_lockout', label: 'Дожим', description: 'Не дожимает вверху — слабый трицепс.', assistanceFromCatalog: ['Французский жим', 'Жим гантелей на наклонной', 'Жим гантелей'], intensityPct: 0.75, rationale: 'Французский жим изолирует трицепс в локдауне.' },
  },
};

const namesAvailable = new Set(LMS_EXERCISES.map(e => e.name));

export function diagnoseWeakPoint(lift: Lift, weakPoint: WeakPoint): WeakPointDiagnosis {
  const d = DIAGNOSIS[lift][weakPoint];
  if (!d) return { lift, weakPoint, label: '—', description: 'нет данных для этой комбинации', assistance: [], intensityPct: 0.7, rationale: 'диагноз не определён' };
  // фильтруем ассистентные, которые есть в каталоге СРЦ; если нет — оставляем как рекомендацию
  const assistance = d.assistanceFromCatalog.filter(n => namesAvailable.has(n));
  const missing = d.assistanceFromCatalog.filter(n => !namesAvailable.has(n));
  const list = assistance.length ? assistance : d.assistanceFromCatalog;
  return {
    lift, weakPoint, label: d.label, description: d.description,
    assistance: list, intensityPct: d.intensityPct,
    rationale: d.rationale + (missing.length ? ` (рекомендуется добавить в каталог: ${missing.join(', ')})` : ''),
  };
}

export const WEAK_POINTS_BY_LIFT: Record<Lift, WeakPoint[]> = {
  bench: ['off_chest', 'mid', 'lockout', 'start'],
  squat: ['bottom', 'mid', 'lockout'],
  deadlift: ['start', 'mid', 'lockout'],
  ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
  row: ['row_start', 'row_mid', 'row_squeeze'],
  pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
  incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
};