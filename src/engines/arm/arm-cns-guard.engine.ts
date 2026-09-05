/**
 * arm-cns-guard.engine.ts — TOP T6c: CNS-guard малых мышц.
 *
 * Источники: GripStrength (малый пул мышц — CNS-цена максимумов недооценивается;
 * max-синглы + max-holds в один день — тяжёлая комбинация; no max через боль),
 * StrengthLog (48ч между тяжёлыми; резкая боль ≠ норма).
 *
 * Правила: ≤2 тяжёлых хвата/нед (RPE≥8), grip ↔ тяжёлые тяги ≥24ч,
 * max-день + max-hold в один день запрещены при суставной боли,
 * 3+ сессий подряд с накопленной усталостью → делоад.
 * Чистый модуль.
 */

export interface CnsGuardInput {
  heavyGripThisWeek?: number; // уже выполнено тяжёлых хвата
  plannedHeavy?: boolean; // планируется ли ещё тяжёлый
  hoursSinceHeavyPull?: number; // часов с тяжёлых тяг спины
  jointPain?: boolean;
  fatigueStreak?: number; // сессий подряд с усталостью/спадом
  maxHoldsToday?: boolean; // уже были max-holds сегодня
  maxSingleToday?: boolean; // уже был max-сингл сегодня
}

export interface CnsGuardResult {
  allowed: boolean;
  volumeMult: number;
  rules: string[];
  note: string;
}

export function checkCnsGuard(input: CnsGuardInput = {}): CnsGuardResult {
  const rules: string[] = [];
  const heavy = Math.max(0, Math.round(Number(input.heavyGripThisWeek ?? 0) || 0));
  const planned = !!input.plannedHeavy;
  // 1. Лимит тяжёлых
  if (planned && heavy >= 2) {
    rules.push('Тяжёлых хвата уже 2/нед — третий запрещён (CNS). Только RPE≤7.');
    return { allowed: false, volumeMult: 0.6, rules, note: 'CNS-лимит: 2 тяжёлых хвата/нед исчерпан.' };
  }
  // 2. Разнос с тягами
  const h = Number(input.hoursSinceHeavyPull ?? 72);
  if (planned && Number.isFinite(h) && h < 24) {
    rules.push('С тяжёлых тяг прошло <24ч — хват перенести (минимум 24ч).');
    return { allowed: false, volumeMult: 0.7, rules, note: 'Разнос grip ↔ тяги: минимум 24ч.' };
  }
  // 3. Комбинация max в один день
  if (input.maxHoldsToday && input.maxSingleToday) {
    if (input.jointPain) {
      rules.push('Max-сингл + max-hold в один день при суставной боли — запретить одно, RPE→7.');
      return { allowed: false, volumeMult: 0.7, rules, note: 'High-intensity комбинация при боли запрещена.' };
    }
    rules.push('Max-сингл + max-hold в один день — высокая CNS-цена, следить за суставами.');
  }
  // 4. Серия усталости
  const streak = Math.max(0, Math.round(Number(input.fatigueStreak ?? 0) || 0));
  if (streak >= 3) {
    rules.push('3+ сессий спад подряд — делоад: −40% объёма, RPE≤6, без максимумов.');
    return { allowed: true, volumeMult: 0.6, rules, note: 'Накопленная CNS-усталость — делоад.' };
  }
  // 5. Боль
  if (input.jointPain && planned) {
    rules.push('Суставная боль: тяжёлый запрещён, только объём RPE7.');
    return { allowed: false, volumeMult: 0.7, rules, note: 'Боль — не тренировать сквозь (только объём).' };
  }
  rules.push('CNS-допуск: тяжёлый хват разрешён.');
  return { allowed: true, volumeMult: 1, rules, note: 'CNS-допуск: лимиты не превышены.' };
}

export interface CnsDiaryResult {
  heavyDays: number;
  volumeMult: number;
  note: string | null;
}

/**
 * TOP wave-4: автоподсчёт тяжёлых из дневника (последние 7 записей, sRPE≥8).
 * 0–1 тяжёлых → без изменений; 2+ → план облегчается ×0.8 (третий тяжёлый
 * на неделе уже был — добивать CNS нельзя). Чистая функция.
 */
export function cnsFromDiary(days: Array<{ srpe?: number }> | undefined | null): CnsDiaryResult {
  const list = Array.isArray(days) ? days.slice(-7) : [];
  const heavyDays = list.filter((d) => Number(d?.srpe ?? 0) >= 8).length;
  if (heavyDays >= 2) {
    return {
      heavyDays,
      volumeMult: 0.8,
      note: `CNS: в дневнике уже ${heavyDays} тяжёлых (RPE≥8) за 7 дней — план облегчён ×0.8, максимумы запрещены.`,
    };
  }
  return { heavyDays, volumeMult: 1, note: null };
}
