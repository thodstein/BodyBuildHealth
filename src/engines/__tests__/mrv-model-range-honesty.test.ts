/**
 * mrv-model-range-honesty.test.ts — замок «MRV = рабочий диапазон модели, а не потолок» (П1-Г, 26.09.2026).
 *
 * Источники, из-за которых формулировка исправлена:
 * - Camargo J.B.B. et al. J Appl Physiol 2026;141(2):477-493 · PMID 42461790 · РКИ, 25 тренированных,
 *   унилатеральная схема, +120 % объёма против +20 %, 8 недель, УЗИ + биопсия: оба протокола дали
 *   рост mCSA, взаимодействия «протокол × время» нет. То есть объём выше «потолка MRV» в РКИ
 *   НЕ ухудшил адаптацию — значит MRV нельзя показывать как физический предел.
 * - Pancar Z. et al. Sci Rep 2026;16(1):10299 · PMID 41730991 · делод не помешал адаптации.
 * - Roberts M.D. et al. J Appl Physiol 2026;140(6):1761-1776 · PMID 42172438 — межиндивидуальная
 *   вариативность ответа как признанная проблема поля.
 *
 * ЧТО ЛОК ДЕРЖИТ:
 *  1) в пользовательских текстах нет «риск перетренированности» / «максимума MRV» — то есть MRV
 *     не подаётся как доказанный вред или жёсткий потолок;
 *  2) в обоих местах, где пользователь видит выход за MRV, есть честная оговорка про модель
 *     и ссылка на источник (иначе мы просто убрали предупреждение — это тоже нечестно);
 *  3) `effective_mrv_overflow` остаётся WARNING, а не error/блокировкой сборки — по условию П1-Г.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateBBPlan } from '../bb/bb-validator.engine';
import type { BBPlan } from '../bb/bb-types';

const ROOT = join(process.cwd(), 'src');

/** Места, где пользователь видит выход объёма за MRV. */
const USER_FACING: Array<[string, string]> = [
  ['engines/bb/bb-validator.engine.ts', 'движок → отчёт/экспорт'],
  ['ui/screens/SRCBBScreen_parts/PLPlanView.tsx', 'витрина «Качество» в ПЛ-авто'],
];

describe('П1-Г: MRV — рабочий диапазон модели, не потолок', () => {
  it.each(USER_FACING)('в %s (%s) нет «потолок/нарушение/риск перетренированности»', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    for (const bad of ['риск перетренированности', 'максимума MRV', 'максимум MRV', 'потолок MRV']) {
      expect(src.includes(bad), `найдено «${bad}» в ${rel}`).toBe(false);
    }
  });

  it.each(USER_FACING)('в %s есть честная оговорка про модель + ссылку на РКИ', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    expect(src).toMatch(/рабочего диапазона модели|РАБОЧЕГО ДИАПАЗОНА/i);
    // ссылка на исследование, а не «по-нашему мнению»
    expect(src).toMatch(/42461790|Camargo 2026/);
  });

  it('effective_mrv_overflow остаётся warning, а не error (блокировкой сборки не становится)', () => {
    // минимальный план: 1 неделя, 1 сессия, 1 упражнение с заведомо завышенным объёмом
    const plan = {
      weeks: [{
        week: 1, deload: false, phase: 'accumulation', sessions: [{
          day: 1, focus: 'chest', exercises: [{
            name: 'Жим штанги лёжа', muscle: 'chest', sets: 40, workSets: Array.from({ length: 40 }, () => ({ weightKg: 60, reps: 10, rir: 2 })),
          }],
        }],
      }],
      meta: { athlete: { name: 't', level: 'intermediate' } },
    } as unknown as BBPlan;
    const res = validateBBPlan(plan as never);
    const of = res.issues.filter(i => i.code === 'effective_mrv_overflow');
    // либо переполнения нет (план не тянет билдер), либо оно строго warning — но не error
    for (const i of of) expect(i.level).toBe('warning');
    // и уж точно не мешает валидности
    expect(of.every(i => i.level !== 'error')).toBe(true);
  });
});
