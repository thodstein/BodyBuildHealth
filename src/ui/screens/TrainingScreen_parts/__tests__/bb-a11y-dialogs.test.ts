/**
 * 4.4 (план BB-AUTO-EXHAUSTIVE-PRO): a11y inline-модалок ББ-авто.
 * Полный jsdom-рендер god-component виснет, поэтому guard по исходнику:
 * role=dialog + aria-modal + Escape + возврат фокуса; сообщения — role=status.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '..', 'BbAutoConstructor.tsx'), 'utf8');

describe('4.4 a11y inline-модалок ББ-авто (source-guard)', () => {
  it('единый a11y-хук присутствует (роль/esc/фокус)', () => {
    expect(SRC).toContain('function useInlineDialogA11y');
    expect(SRC).toContain("e.key === 'Escape'");
    expect(SRC).toContain('ref.current?.focus()');
  });

  it('все 3 inline-модалки — role=dialog + aria-modal', () => {
    const dialogs = (SRC.match(/role="dialog"/g) || []).length;
    const modals = (SRC.match(/aria-modal="true"/g) || []).length;
    expect(dialogs).toBeGreaterThanOrEqual(3);
    expect(modals).toBeGreaterThanOrEqual(3);
  });

  it('модалки снабжены доступным именем (aria-label)', () => {
    expect(SRC).toContain('aria-label={`Замена упражнения:');
    expect(SRC).toContain('aria-label={namePrompt.title}');
    expect(SRC).toContain('aria-label="Начать заново?"');
  });

  it('сообщения моста/flash остаются live-region (role=status)', () => {
    expect((SRC.match(/role="status"/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
