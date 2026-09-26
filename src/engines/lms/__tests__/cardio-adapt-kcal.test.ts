/**
 * cardio-adapt-kcal.test.ts — спринт 5.4: адаптация цикла обязана переоценивать
 * калории, когда меняет физиологию сессии.
 *
 * Дефект (реальный, найден чтением): в `adaptCardioToStrength` ветка
 * «частые ноги ≥4/нед» конвертирует MISS → zone2 (KCAL_PER_MIN miss=10,
 * zone2=7), но НЕ пересчитывает `kcalPerSession` — в ACWR-ветках рядом
 * пересчёт есть, здесь его нет. Итог: сессия объявляет zone2, а калории
 * остались от MISS → завышение ~40% внутри плана (и в totalKcal, и в мосте
 * «кардио → питание»).
 *
 * Проверка НЕ циркулярная: эталон — соотношение в самом цикле (7/10 по
 * KCAL_PER_MIN), а не вызов того же пересчётчика, что и в фиксе.
 */
import { describe, it, expect } from 'vitest';
import { buildCardioCycle, adaptCardioToStrength } from '../cardio.engine';
import type { CardioSession } from '../cardio-cycle-types.engine';

/** MISS-сессия в любой неделе цикла: она живёт в фазе build, не в base. */
function firstMiss(cycle: { weeks: { sessions: CardioSession[] }[] }): CardioSession {
  for (const w of cycle.weeks) {
    const s = w.sessions.find(x => x.type === 'miss');
    if (s) return s;
  }
  throw new Error('в цикле нет MISS-сессии — тест не проверяет ничего');
}

/** Та же сессия после адаптации: ищем по неизменным duration/weeklyFrequency. */
function findSame(cycle: { weeks: { sessions: CardioSession[] }[] }, ref: CardioSession): CardioSession | undefined {
  for (const w of cycle.weeks) {
    const s = w.sessions.find(x => x.durationMin === ref.durationMin && x.weeklyFrequency === ref.weeklyFrequency);
    if (s) return s;
  }
  return undefined;
}

describe('adaptCardioToStrength переоценивает калории при смене типа', () => {
  it('частые ноги: MISS → zone2 не должен тащить за собой калории MISS', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'adapt-kcal' });
    const before = firstMiss(c);
    const kcMiss = before.kcalPerSession;

    const adapted = adaptCardioToStrength(c, { legDaysPerWeek: 5 });
    const after = findSame(adapted, before);
    expect(after).toBeDefined();
    expect(after!.type).toBe('zone2');                 // тип конвертирован
    // zone2 = 7 kcal/min против MISS = 10 → 0.70 от старой цены.
    // Допуск ±0.02 покрывает округление kcalForCardio.
    const ratio = after!.kcalPerSession / kcMiss;
    expect(ratio).toBeGreaterThan(0.68);
    expect(ratio).toBeLessThan(0.72);
  });

  it('без гейта частых ног MISS не трогается (контроль атрибуции)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'adapt-ctrl' });
    const before = firstMiss(c);
    const adapted = adaptCardioToStrength(c, { acwr: 0.9 });   // зона optimal
    const after = findSame(adapted, before);
    // Ни тип, ни калории не должны меняться без причины.
    expect(after?.type).toBe('miss');
    expect(after?.kcalPerSession).toBe(before.kcalPerSession);
  });

  it('исходный цикл не мутируется (регресс-контракт)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, id: 'adapt-pure' });
    const snapshot = JSON.stringify(c);
    adaptCardioToStrength(c, { legDaysPerWeek: 5 });
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});
