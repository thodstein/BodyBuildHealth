/**
 * support-risk-contract.test.ts — контракт `he_support_risk` пишут ДВА места
 * (SupportScreen после «Рассчитать поддержку» и Calc.mapper при ручных
 * правках), а читает один RiskScreen/LabsScreen. Если набор полей разъедется,
 * «Риски» покажут статус без причины или наоборот.
 *
 * Аудит 2026-11: поля честности (`riskStatus`, `unmodeledDrugs`,
 * `derivedSupport`, `unmappedSupport`) добавлялись в писателей по одному —
 * `unmappedSupport` сначала появился только у Calc.mapper.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIELDS = ['riskStatus', 'unmodeledDrugs', 'derivedSupport', 'unmappedSupport', 'mechanismCoverage'];

function writerBlock(file: string, marker: RegExp): string {
  const src = readFileSync(resolve(process.cwd(), file), 'utf8');
  const idx = src.search(marker);
  expect(idx, `${file}: не найден писатель he_support_risk`).toBeGreaterThan(0);
  // Берём окно вокруг литерала записи — этого достаточно для проверки ключей.
  return src.slice(idx, idx + 1400);
}

describe('контракт he_support_risk: оба писателя передают поля честности', () => {
  const writers = [
    writerBlock('src/ui/screens/SupportScreen.tsx', /setItem\('he_support_risk'/),
    writerBlock('src/ui/screens/Calculator/Calc.mapper.tsx', /setItem\(SUPPORT_RISK_KEY/),
  ];

  for (const field of FIELDS) {
    it(`${field} пишут оба места`, () => {
      for (const block of writers) {
        expect(block, `${field} отсутствует в писателе`).toContain(`${field}:`);
      }
    });
  }
});

describe('контракт покрытия механизмов: записанное доходит до «Рисков»', () => {
  it('RiskScreen читает mechanismCoverage и передаёт в каждую ветку RiskOverview', () => {
    const screen = readFileSync(resolve(process.cwd(), 'src/ui/screens/RiskScreen.tsx'), 'utf8');
    expect(screen).toContain('sr.mechanismCoverage');
    const passed = screen.split('mechanismCoverage={supportCalcHonesty?.mechanismCoverage}').length - 1;
    // Возврат по 'overview' и default — обе ветки показывают карточку.
    expect(passed).toBeGreaterThanOrEqual(2);
  });

  it('RiskOverview не рисует «0 из 0» и подписывает покрытие отдельно от снижения риска', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/RiskScreen_parts/RiskOverview.tsx'), 'utf8');
    expect(src).toContain('Снижение риска поддержкой');
    expect(src).toContain('Механизмы риска: закрыто');
    expect(src).toContain('mechanismCoverage && mechanismCoverage.total > 0');
  });
});
