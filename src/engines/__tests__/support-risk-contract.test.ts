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
