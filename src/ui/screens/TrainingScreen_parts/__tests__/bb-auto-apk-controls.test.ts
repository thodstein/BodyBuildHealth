/**
 * 4.5 (план BB-AUTO-EXHAUSTIVE-PRO): мобильные контролы ББ-авто под АПК —
 * нативные select/checkbox заменены китом (`BbRowSwitch`/`BbToggleChip` +
 * `PopupSelect`), касание ≥44px, шрифты ≥10px. Полный jsdom-рендер
 * god-component виснет, поэтому guard по исходникам (паттерн bb-a11y-dialogs).
 * Этап 3 §4.3: шаги выносятся в `bb-step-*.tsx` — guard читает и их.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(__dirname, '..');
const SRC = readFileSync(resolve(DIR, 'BbAutoConstructor.tsx'), 'utf8');
const SHARED = readFileSync(resolve(DIR, 'bb-auto-constructor-shared.tsx'), 'utf8');
const STEPS = readdirSync(DIR)
  .filter(f => /^bb-step-.*\.tsx$/.test(f))
  .map(f => readFileSync(resolve(DIR, f), 'utf8'))
  .join('\n');
const ALL = SRC + '\n' + STEPS;

describe('4.5 APK-контролы ББ-авто (source-guard)', () => {
  it('в конструкторе и шагах нет нативных select/checkbox', () => {
    expect(ALL).not.toMatch(/<select[\s>]/);
    expect(ALL).not.toMatch(/type="checkbox"/);
  });

  it('кит переключателей: role=switch, касание 44px, шрифты ≥10px', () => {
    expect(SHARED).toContain('BbRowSwitch');
    expect(SHARED).toContain('BbToggleChip');
    expect((SHARED.match(/role="switch"/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((SHARED.match(/minHeight: 44/g) || []).length).toBeGreaterThanOrEqual(2);
    // Заголовок 12px и описание 10px — минимум для телефона.
    expect(SHARED).toContain('fontSize: 12');
    expect(SHARED).toContain('fontSize: 10');
  });

  it('выпадающие списки — через PopupSelect (АПК-кит), не нативный select', () => {
    expect(ALL).toContain('PopupSelect');
    expect((ALL.match(/<PopupSelect/g) || []).length).toBeGreaterThanOrEqual(8);
  });
});
