/**
 * support-meta-dead-doses.test.ts — guard прохода 18 аудита калькулятора поддержки.
 *
 * В `support-meta.ts` жил экспорт `SUBSTANCE_ENHANCERS` — мёртвый (0 потребителей)
 * и с перепутанными единицами: селен и K2 «200 мг» (на деле мкг), B6 для магния
 * 50 мг = 417 % EFSA UL 12 мг. Второй кураторской таблицы доз быть не должно:
 * пары «с чем принимать» выводит `detectEnhancers` из каталога.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

describe('support-meta: нет второй таблицы доз-усилителей', () => {
  it('SUBSTANCE_ENHANCERS удалён из support-meta (и не вернулся в ре-экспорт)', () => {
    expect(src('src/data/support-meta.ts')).not.toContain('export const SUBSTANCE_ENHANCERS');
    expect(src('src/data/support-meta.ts')).not.toMatch(/SUBSTANCE_ENHANCERS\s*:\s*Record/);
    expect(src('src/data/support-database.ts')).not.toContain('SUBSTANCE_ENHANCERS');
  });

  it('усилители выводятся из каталога (detectEnhancers), а не из ручной таблицы', () => {
    expect(src('src/ui/screens/SupportScreen_parts/SupportBioavailabilityData.tsx'))
      .toContain('export function detectEnhancers');
  });
});
