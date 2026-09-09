/**
 * planner-variety-ledger.ts — P1-1/P1-3/P1-4 (план docs/NUTRITION-VARIETY-PLAN.md).
 *
 * Скользящий ledger разнообразия, ПЕРЕЖИВАЮЩИЙ перегенерации (раньше сбрасывался
 * на каждой не-месячной генерации → «генерация почти одно и то же всегда»):
 *  - foods — мягкая деприоритизация продуктов (FIFO, кап 60);
 *  - recipes — имена использованных рецептов между «Перегенерировать» (кап 30);
 *  - recent — окно последних 2 дней (жёсткое в strict-режиме);
 *  - weekFamilies — семейства гарниров последних 7 дней (ротация
 *    «одна крупа ≤2 дней недели» — гейт в движке, fresh ≥2 не даёт голода).
 *
 * Соль-инвариантный урок (P0-отзывы): разнообразие идёт ТОЛЬКО через ledger
 * (soft-деприоритизация с fresh-гейтами), НЕ через salt-векторы, которые ломали
 * калиброванные гарантии (красное ≤3/7, яйцо-квоты, HV-сходимость).
 */
export const VARIETY_LEDGER_KEY = 'he_planner_variety_ledger_v1';
export const LEDGER_FOODS_CAP = 60;
export const LEDGER_RECIPES_CAP = 30;
export const LEDGER_WEEK_FAMILIES_CAP = 7;

export interface VarietyLedgerShape {
  foods: string[];
  recipes: string[];
  recent: string[][];
  weekFamilies: string[][];
  ts?: number;
}

function emptyLedger(): VarietyLedgerShape {
  return { foods: [], recipes: [], recent: [], weekFamilies: [] };
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Чтение с валидацией/капами (битый сторедж → пустой ledger, не падаем). */
export function loadVarietyLedger(): VarietyLedgerShape {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(VARIETY_LEDGER_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return emptyLedger();
    const o = raw as Record<string, unknown>;
    return {
      foods: strArr(o.foods).slice(-LEDGER_FOODS_CAP),
      recipes: strArr(o.recipes).slice(-LEDGER_RECIPES_CAP),
      recent: Array.isArray(o.recent) ? (o.recent as unknown[]).slice(-2).map(d => strArr(d)) : [],
      weekFamilies: Array.isArray(o.weekFamilies) ? (o.weekFamilies as unknown[]).slice(-LEDGER_WEEK_FAMILIES_CAP).map(d => strArr(d)) : [],
    };
  } catch {
    return emptyLedger();
  }
}

/** Запись с капами (quota-переполнение глотается тихо — разнообразие не критичные данные). */
export function saveVarietyLedger(l: VarietyLedgerShape): void {
  try {
    localStorage.setItem(VARIETY_LEDGER_KEY, JSON.stringify({
      foods: strArr(l.foods).slice(-LEDGER_FOODS_CAP),
      recipes: strArr(l.recipes).slice(-LEDGER_RECIPES_CAP),
      recent: Array.isArray(l.recent) ? l.recent.slice(-2).map(d => strArr(d)) : [],
      weekFamilies: Array.isArray(l.weekFamilies) ? l.weekFamilies.slice(-LEDGER_WEEK_FAMILIES_CAP).map(d => strArr(d)) : [],
      ts: Date.now(),
    }));
  } catch {}
}

/** Сколько дней недели (последних ≤7) содержали семейство — гейт P1-3 «≤2 дней недели». */
export function familyDaysInWeek(weekFamilies: string[][], fam: string): number {
  if (!fam) return 0;
  return weekFamilies.filter(day => Array.isArray(day) && day.includes(fam)).length;
}
