/**
 * 4.4 (план BB-AUTO-EXHAUSTIVE-PRO): a11y inline-модалок ББ-авто.
 * Полный jsdom-рендер god-component виснет, поэтому guard по исходнику:
 * role=dialog + aria-modal + Escape + возврат фокуса; сообщения — role=status.
 * Этап 1 §4.3: a11y-хук вынесен в `bb-auto-constructor-shared.tsx` (guard читает оба файла).
 * Этап 3 §4.3: модалка замены упражнения вынесена в `bb-step-ex-swap.tsx` — guard читает и её.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '..', 'BbAutoConstructor.tsx'), 'utf8');
const SHARED = readFileSync(resolve(__dirname, '..', 'bb-auto-constructor-shared.tsx'), 'utf8');
const EXSWAP = readFileSync(resolve(__dirname, '..', 'bb-step-ex-swap.tsx'), 'utf8');
const ALL = SRC + '\n' + SHARED + '\n' + EXSWAP;

describe('4.4 a11y inline-модалок ББ-авто (source-guard)', () => {
  it('единый a11y-хук присутствует (роль/esc/фокус)', () => {
    expect(SHARED).toContain('function useInlineDialogA11y');
    expect(SHARED).toContain("e.key === 'Escape'");
    expect(SHARED).toContain('ref.current?.focus()');
  });

  it('все 3 inline-модалки — role=dialog + aria-modal', () => {
    const dialogs = (ALL.match(/role="dialog"/g) || []).length;
    const modals = (ALL.match(/aria-modal="true"/g) || []).length;
    expect(dialogs).toBeGreaterThanOrEqual(3);
    expect(modals).toBeGreaterThanOrEqual(3);
  });

  it('модалки снабжены доступным именем (aria-label)', () => {
    expect(EXSWAP).toContain('aria-label={`Замена упражнения:');
    expect(SRC).toContain('aria-label={namePrompt.title}');
    expect(SRC).toContain('aria-label="Начать заново?"');
  });

  it('сообщения моста/flash остаются live-region (role=status)', () => {
    expect((SRC.match(/role="status"/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
