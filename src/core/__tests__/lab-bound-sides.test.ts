/**
 * lab-bound-sides.test.ts — проход 142: знак границы означает одно и то же
 * везде.
 *
 * Проход 138 научил импорт не делать вывод, который граница не доказывает, но
 * правило жило в разборщике бланка. Дневник анализов, выгрузка HL7 и повторное
 * сохранение панели знак не читали вовсе:
 *  - дневник получал только число — «>1000» на графике и в карточке выглядел
 *    точным измерением, а «>5» при верхней границе 400 — зелёным «в норме»;
 *  - HL7 OBX печатал 1000 без знака и без флага отклонения;
 *  - «Расширенная панель» и «Каталог» при пересохранении писали в склад 1000
 *    без знака, потому что в числовом поле знака нет.
 *
 * Теперь толкование границы одно (`core/lab-bound`), и оно отвечает на вопрос
 * «какую сторону запись доказывает», а не только «какой вывод был бы выдумкой».
 */
import { describe, it, expect } from 'vitest';
import { boundMakesConclusionUnsafe, boundProvesSide, keptBound } from '../lab-bound';

describe('проход 142: какую сторону доказывает запись', () => {
  it('число без границы доказано целиком', () => {
    expect(boundProvesSide(undefined, 500, 30, 400)).toBe('high');
    expect(boundProvesSide(undefined, 20, 30, 400)).toBe('low');
    expect(boundProvesSide(undefined, 200, 30, 400)).toBeUndefined();
  });

  it('«>N» доказывает только высокую сторону', () => {
    // «>1000» при верхней границе 400 — точно высокое.
    expect(boundProvesSide('>', 1000, 30, 400)).toBe('high');
    // «>400» при верхней границе 400 — уже выше нормы (значение больше 400).
    expect(boundProvesSide('>', 400, 30, 400)).toBe('high');
    // «>100» при верхней границе 400 — может быть и нормой: стороны нет.
    expect(boundProvesSide('>', 100, 30, 400)).toBeUndefined();
    // «>1000» при нижней границе 30 не делает результат низким.
    expect(boundProvesSide('>', 1000, 30, undefined)).toBeUndefined();
  });

  it('«<N» доказывает только низкую сторону', () => {
    expect(boundProvesSide('<', 0.5, 3, 10)).toBe('low');
    expect(boundProvesSide('<', 3, 3, 10)).toBe('low');
    // «<0.5» при верхней границе 3 — не «выше нормы».
    expect(boundProvesSide('<', 0.5, undefined, 3)).toBeUndefined();
    // «<500» при верхней границе 400 тоже ничего не доказывает.
    expect(boundProvesSide('<', 500, 30, 400)).toBeUndefined();
  });

  it('нет границ нормы — нет вывода', () => {
    expect(boundProvesSide('>', 1000, undefined, undefined)).toBeUndefined();
    expect(boundProvesSide(undefined, 1000, undefined, undefined)).toBeUndefined();
  });

  it('«вывод небезопасен» остался прежним (проход 138)', () => {
    expect(boundMakesConclusionUnsafe('>', 1000, 30, 400)).toBe(false);
    expect(boundMakesConclusionUnsafe('>', 110, 130, 170)).toBe(true);
    expect(boundMakesConclusionUnsafe('<', 500, 30, 400)).toBe(true);
    expect(boundMakesConclusionUnsafe('<', 50, 62, 106)).toBe(false);
    expect(boundMakesConclusionUnsafe(undefined, 110, 130, 170)).toBe(false);
  });
});

describe('проход 142: знак переживает повторное сохранение', () => {
  it('число не меняли — знак остаётся', () => {
    expect(keptBound({ value: 1000, bound: '>' }, 1000)).toBe('>');
  });

  it('число изменили — чужой знак не приклеивается', () => {
    expect(keptBound({ value: 1000, bound: '>' }, 900)).toBeUndefined();
  });

  it('у записи без знака приклеивать нечего', () => {
    expect(keptBound({ value: 1000 }, 1000)).toBeUndefined();
    expect(keptBound(undefined, 1000)).toBeUndefined();
  });
});
