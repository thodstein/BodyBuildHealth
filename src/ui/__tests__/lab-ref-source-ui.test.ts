/**
 * lab-ref-source-ui.test.ts — проход 208: выбор границ нормы при ручном вводе.
 *
 * Проверяем проводку, а не математику (математика — `lab-reference-presets.test.ts`):
 * ручной ввод на экране «Анализы» обязан записывать выбранные границы в саму
 * запись (`refLow`/`refHigh`), потому что вердикт вкладки «Анализы» уже считает
 * по ним (`lab-marker-risks`: бланк главнее каталога). Если проводка порвётся,
 * поле «Границы нормы» станет декоративным — и человек будет думать, что судят
 * по его бланку, а судят по норме приложения.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');

describe('проход 208: источник границ на ручном вводе', () => {
  it('модалка предлагает три источника: норма приложения, пресет лаборатории, бланк', () => {
    expect(src).toContain('value="app"');
    expect(src).toContain('value="blank"');
    expect(src).toContain('labsWithPresets()');
    expect(src).toContain('refSourceLabel(id, code)');
  });

  it('выбор лаборатории не подменяется нормой приложения молча', () => {
    // Пресет спрашивается через `presetForEntry`: он отказывает, если числа нет
    // или единица бланка не совпадает, и отказ печатается человеку.
    expect(src).toContain('const check = presetForEntry(inputCode, inputRefSource, inputUnit);');
    expect(src).toContain('setAddError(check.reason)');
    // Границы бланка — только пара чисел.
    expect(src).toContain('const range = blankRange(inputRefLo, inputRefHi);');
    expect(src).toContain("setAddError('Границы бланка: ' + range.reason)");
  });

  it('выбранные границы попадают в запись склада, а не только на экран', () => {
    expect(src).toContain('...(refLow !== undefined && refHigh !== undefined ? { refLow, refHigh } : {})');
    expect(src).toContain('...(refSource ? { source: refSource } : {})');
  });

  it('единица берётся из пресета, только если её не ввели', () => {
    expect(src).toContain('if (!unit.trim()) unit = check.unit;');
    expect(src).toContain("unit: unit || info?.prefUnit || '',");
  });

  it('после сохранения и закрытия выбор не залипает на следующем поле', () => {
    const resets = src.split("setInputRefSource('app')").length - 1;
    expect(resets).toBeGreaterThanOrEqual(2);
    expect(src).toContain("setInputRefLo('')");
    expect(src).toContain("setInputRefHi('')");
  });
});
