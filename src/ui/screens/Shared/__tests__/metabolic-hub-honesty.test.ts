/**
 * Source-guard честности калькуляторного хаба (Wave 1, E1.x).
 *
 * Зачем guard, а не только тесты поведения: дефекты E1.1/E1.2 были не в арифметике,
 * а в ПОДПИСЯХ — UI врал о том, как получено число (метод «Mifflin» для livingston)
 * и молчал про то, что формульная оценка может быть занижена на треть.
 * Такие правки не ловятся тестами чисел, поэтому строки источника тут зафиксированы.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const hub = () => read('src/ui/screens/Shared/MetabolicHub.tsx');
const engine = () => read('src/engines/metabolic-hub.engine.ts');
const constants = () => read('src/core/metabolic-constants.ts');

describe('хаб «Метаболизм» — честность подписей (Wave 1)', () => {
  it('E1.2: в UI нет цепочки подписей с фолбэком (из-за неё 3 метода читались как Mifflin)', () => {
    const src = hub();
    // inline-тернарники вида method==='cunningham'?'Cunningham':... — источник прошлой лжи
    expect(src).not.toMatch(/nat\.method\s*===?\s*'/);
    expect(src).not.toMatch(/method\s*==\s*'cunningham'\s*\?/);
    // единственный источник подписи — канон движка
    expect(src).toContain('bmrMethodLabel');
  });

  it('E1.2: сырой внутренний id метода в UI не показывается пользователю', () => {
    const src = hub();
    expect(src).not.toMatch(/\{kbju\.nat\.method\}/);
    // измерено: 2 вызова (карточка BMR + блок щитовидки) + импорт без скобки
    const calls = src.match(/bmrMethodLabel\(/g) || [];
    expect(calls.length).toBe(2);
    expect(src).toMatch(/import \{[^}]*bmrMethodLabel[^}]*\} from/);
  });

  it('E1.2: канон покрывает все 8 методов, а не 5', () => {
    const src = constants();
    for (const id of ['katch_mcardle', 'cunningham', 'owen', 'ten_haaf', 'mifflin', 'harris_revised', 'henry', 'livingston']) {
      expect(src, `метод ${id} должен иметь подпись`).toContain(`${id}:`);
    }
  });

  it('E1.1: Pontzer-оговорка есть, и она НЕ превращена в надбавку +30%', () => {
    const src = engine();
    expect(src).toContain('PONTZER_FORMULA_NOTE');
    expect(src).toContain('TDEE_ALREADY_ADAPTED_NOTE');
    // нигде не прибавляем 30% к расходу
    expect(src).not.toMatch(/tdee\s*\*\s*1\.3/);
    expect(src).not.toMatch(/\*\s*1\.30/);
    expect(src).not.toMatch(/palEff\s*\*\s*1\.3/);
  });

  it('E1.1: обе честные оговорки реально показываются пользователю', () => {
    const src = engine();
    // формульный путь подписывает оценку…
    expect(src).toMatch(/`формула · \$\{PONTZER_FORMULA_NOTE\}`/);
    // …а путь adaptive-v3 подписывает, что TDEE УЖЕ адаптирован
    expect(src).toMatch(/\$\{TDEE_ALREADY_ADAPTED_NOTE\}/);
  });

  it('E1.1: оговорка не прячется только в одном из двух TDEE-выводов', () => {
    const src = engine();
    // calcSteps и calcKBJU — два места, где пользователь видит TDEE
    const uses = src.match(/PONTZER_FORMULA_NOTE\}/g) || [];
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });

  it('E1.2: разброс по формулам подаётся с оговоркой, а не как «точность»', () => {
    const src = constants();
    // в UI рядом с числом разброса обязана стоять оговорка про неприменимость
    const hubSrc = hub();
    expect(hubSrc).toMatch(/неприменима/);
    // и в движке зафиксировано, что это НЕ доверительный интервал
    expect(src).toMatch(/НЕЛЬЗЯ подавать как «?погрешность/);
  });

  it('E1.3: оговорка «общий вход глюкозы» видна в UI рядом с обоими маркерами', () => {
    const src = hub();
    expect(src).toContain('IR_MARKERS_SHARED_INPUT_NOTE');
    // замер (не прикидка): оговорка стоит в той же сводке, где печатаются TyG и пороги.
    // Ищем ВТОРОЕ вхождение — первое это импорт, он ничего не говорит пользователю.
    const importIdx = src.indexOf('IR_MARKERS_SHARED_INPUT_NOTE');
    const useIdx = src.indexOf('IR_MARKERS_SHARED_INPUT_NOTE', importIdx + 1);
    const tygIdx = src.lastIndexOf('TyG {tyg');
    expect(tygIdx).toBeGreaterThan(-1);
    expect(useIdx).toBeGreaterThan(-1);
    // замерено: 401 символ (та же карточка сводки), не «где-то в файле»
    expect(useIdx - tygIdx).toBeGreaterThan(0);
    expect(useIdx - tygIdx).toBeLessThan(1500);
  });

  it('E1.3: формулы не подменены — TyG остаётся ln(TG×Gluc/2), HOMA-IR — глюкоза×инсулин', () => {
    const src = constants();
    // страховка от «сделаем один показатель копией другого»
    expect(src).toMatch(/calcTyG[\s\S]{0,400}?Math\.log\(\(tgMgDl\*glucoseMgDl\)\/2\)/);
    expect(src).toMatch(/calcHomaIR[\s\S]{0,400}?glucoseMmol \* insulinMuMl \/ 22\.5/);
  });
});
