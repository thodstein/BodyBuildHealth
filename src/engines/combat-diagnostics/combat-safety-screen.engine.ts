/**
 * combat-safety-screen.engine.ts — P5 безопасность хаба (стоп-гейты, не скоринг).
 * REUSE combat-safety / combat-neck как источника норм; здесь — только
 * экранирование хаба: redflags → блок моста, teen 14–15 → баннер, шея — чек.
 * Честная формулировка BJSM/ACSM: шея гасит кинематику, связь с риском inconclusive.
 */

export interface CombatSafetyInput {
  age?: number | null;
  concussionsLastYear?: number | null;
  neckPain?: boolean;
  numbness?: boolean;
  headacheAfterSparring?: boolean;
  neckExtensionKg?: number | null;
  bodyWeightKg?: number | null;
}

export interface CombatSafetyScreen {
  blocked: boolean;
  teen: boolean;
  items: string[];
  neckNote: string | null;
  text: string;
}

export const NECK_SAFETY_NOTE =
  'Сильная шея + готовность к контакту снижают кинематику головы (p<.001), прямая связь с риском сотрясения не доказана окончательно (ACSM 2026) — качаем, но не обещаем неуязвимость.';

export function screenCombatSafety(inp: CombatSafetyInput): CombatSafetyScreen {
  const items: string[] = [];
  let blocked = false;
  const teen = inp.age != null && Number.isFinite(inp.age) && inp.age >= 14 && inp.age <= 15;
  if (teen) items.push('Подросток 14–15: только изометрия шеи, без мостов/манипуляций с весом');
  if ((inp.concussionsLastYear ?? 0) > 0) {
    blocked = true;
    items.push(`Сотрясения за год: ${inp.concussionsLastYear} — к врачу, спарринги и вставки запрещены до допуска`);
  }
  if (inp.neckPain) { blocked = true; items.push('Боль в шее — к врачу, проходы и клинч запрещены'); }
  if (inp.numbness) { blocked = true; items.push('Онемение рук — к врачу (шейный отдел), контакт запрещён'); }
  if (inp.headacheAfterSparring) { blocked = true; items.push('Головная боль после спарринга — пауза + врач'); }
  let neckNote: string | null = null;
  if (inp.neckExtensionKg != null && inp.bodyWeightKg != null && inp.bodyWeightKg > 0) {
    const ratio = inp.neckExtensionKg / inp.bodyWeightKg;
    neckNote = ratio >= 0.35
      ? `Разгибатели шеи ${(ratio * 100).toFixed(0)}% веса — в порядке (≥35%)`
      : `Разгибатели шеи ${(ratio * 100).toFixed(0)}% веса — слабее ориентира 35%: изометрия 4 плоскости 2×/нед`;
  }
  const text = blocked
    ? `🔴 Стоп: ${items.join('; ')}`
    : items.length ? `🟡 ${items.join('; ')}` : '🟢 Red-флагов нет';
  return { blocked, teen, items, neckNote, text };
}
