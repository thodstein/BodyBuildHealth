/**
 * diet-coverage-wire.test.ts — опция «🍽 рацион покрывает вещество» в едином
 * движке поддержки (`runSupportUnified`).
 *
 * Контракт:
 *  - ВЫКЛ: план байт-в-байт прежний, новых полей в позициях нет, массивы пусты;
 *  - ВКЛ: позиции НЕ удаляются, покрытая рационом получает note «покрыто питанием»;
 *  - intake — агрегат дневника питания за сегодня из engine.ts (клетчатка;
 *    микронутриенты — проход 210, см. `diet-coverage-micros.test.ts`).
 *    Нет данных → движок честно возвращает 'unknown', а не подставляет
 *    дефолты `DEFAULT_STATE.nutrition` (25 г клетчатки и т. п.).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { runSupportUnified } from '../index';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';
import { localIsoDate } from '../../../core/local-date';
import type { CalculatorState } from '../types';

/**
 * Фаза ПКТ: в плане есть позиция `fiber` (рацион её и может закрыть).
 * AAS пуст — иначе план курса, где клетчатки нет.
 */
const pctState = (options?: CalculatorState['options']): CalculatorState =>
  ({
    ...DEFAULT_STATE,
    pharma: { ...DEFAULT_STATE.pharma, phase: 'pct', hasSERM: true, aas: [] },
    options,
  }) as CalculatorState;

/** Дневник на сегодня: одна запись с заданной клетчаткой (г). */
function seedDiaryFiber(fiberG: number): void {
  const today = localIsoDate();
  localStorage.setItem(
    'nutrition_diary_v2',
    JSON.stringify({
      [today]: { meals: { breakfast: [{ kcal: 600, p: 40, f: 15, c: 60, fiber: fiberG }] } },
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('🍽 dietCoverage ВЫКЛ', () => {
  it('не добавляет ни одного поля и не меняет позиции (id/доза/порядок)', () => {
    seedDiaryFiber(30); // дневник полный, но опция выключена
    const off = runSupportUnified(pctState());
    const plain = runSupportUnified(pctState({}));

    expect(off.substances.map((s) => [s.id, s.doseMg])).toEqual(plain.substances.map((s) => [s.id, s.doseMg]));
    expect(off.substances.map((s) => s.id)).toContain('fiber');
    // байт-в-байт: ни одного нового поля (в т. ч. note: undefined)
    expect(JSON.stringify(off.substances)).toBe(JSON.stringify(plain.substances));
    expect(off.substances.some((s) => 'note' in (s as any))).toBe(false);
    // заметки и покрытие — пустые массивы
    expect(off.dietCoverageNotes).toEqual([]);
    expect(off.dietCoverage).toEqual([]);
  });
});

describe('🍽 dietCoverage ВКЛ', () => {
  it('клетчатка ≥ 25 г: fiber помечен «покрыто питанием» и остаётся в плане', () => {
    seedDiaryFiber(30);
    const on = runSupportUnified(pctState({ dietCoverage: true }));
    const off = runSupportUnified(pctState());

    const fiber = on.substances.filter((s) => s.id === 'fiber');
    expect(fiber).toHaveLength(1);
    expect(fiber[0].note).toContain('покрыто питанием');
    expect(fiber[0].note).toContain('120%');

    // позиции не удалены: тот же состав и порядок
    expect(on.substances.map((s) => s.id)).toEqual(off.substances.map((s) => s.id));

    // заметка движка + проценты покрытия
    expect(on.dietCoverageNotes).toHaveLength(1);
    expect(on.dietCoverageNotes[0]).toContain('покрыто питанием');
    expect(on.dietCoverage.find((c) => c.key === 'fiberG')?.state).toBe('covered');
  });

  it('клетчатка 5 г: пометки нет, покрытие посчитано как недостаточное', () => {
    seedDiaryFiber(5);
    const on = runSupportUnified(pctState({ dietCoverage: true }));

    expect(on.substances.find((s) => s.id === 'fiber')?.note).toBeUndefined();
    expect(on.dietCoverageNotes).toEqual([]);
    expect(on.dietCoverage.find((c) => c.key === 'fiberG')?.state).toBe('insufficient');
  });

  it('позиция вне нутриентов не меняется (NAC: ни note, ни новых полей)', () => {
    seedDiaryFiber(30);
    const on = runSupportUnified(pctState({ dietCoverage: true }));
    const off = runSupportUnified(pctState());

    const nacOn = on.substances.find((s) => s.id === 'nac');
    const nacOff = off.substances.find((s) => s.id === 'nac');
    expect(nacOn).toBeDefined();
    expect(nacOn).toEqual(nacOff);
    expect(nacOn!.note).toBeUndefined();
  });

  it('без дневника intake = undefined: unknown без выдуманных нулей и дефолтов', () => {
    // DEFAULT_STATE.nutrition.fiberG = 25 — это НЕ измерение, его нельзя брать.
    const on = runSupportUnified(pctState({ dietCoverage: true }));

    expect(on.dietCoverage).toHaveLength(7);
    expect(on.dietCoverage.every((c) => c.state === 'unknown' && c.intake === null && c.ratio === null)).toBe(true);
    expect(on.dietCoverageNotes).toEqual([]);
    expect(on.substances.some((s) => (s as any).note?.includes('покрыто питанием'))).toBe(false);
  });
});

describe('🍽 dietCoverage на битом дневнике', () => {
  it('битый nutrition_diary_v2 не роняет расчёт: покрытие unknown, позиции прежние', () => {
    localStorage.setItem('nutrition_diary_v2', '{это не json');
    const on = runSupportUnified(pctState({ dietCoverage: true }));
    // Битый дневник — это «нет данных», а не повод упасть или подставить нули.
    expect(on.error).toBeUndefined();
    expect(on.dietCoverage.every((c) => c.state === 'unknown' && c.intake === null)).toBe(true);
    expect(on.substances.some((s) => (s as any).note?.includes('покрыто питанием'))).toBe(false);
  });
});
