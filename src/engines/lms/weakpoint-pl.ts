/**
 * weakpoint-pl.ts — диагностика мёртвой точки силовых движений → ассистентные упражнения (Этап PL0, NEW).
 * Жим лёжа / Присед / Становая: по слабому участку амплитуды подбирает спецификацию
 * (дожимы 3/5/8/10 см, жим в раме старт/дожим, тяга из ямы/с плинтов/с остановками, присед в широкой/на груди).
 * Ассистентные берутся из lms-exercises (каталог СРЦ) и exercise-catalog.
 */
import { LMS_EXERCISES } from '../../data/lms-cycles/lms-exercises';

export type Lift = 'bench' | 'squat' | 'deadlift';
export type WeakPoint = 'off_chest' | 'mid' | 'lockout' | 'start' | 'bottom' | 'sticking_mid';

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
};