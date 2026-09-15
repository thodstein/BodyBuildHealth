/**
 * 4.5 (план BB-AUTO-EXHAUSTIVE-PRO): мобильные контролы ББ-авто под АПК —
 * нативные select/checkbox заменены китом (`BbRowSwitch`/`BbToggleChip` +
 * `PopupSelect`), касание ≥44px, шрифты ≥10px. Полный jsdom-рендер
 * god-component виснет, поэтому guard по исходникам (паттерн bb-a11y-dialogs).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '..', 'BbAutoConstructor.tsx'), 'utf8');
const SHARED = readFileSync(resolve(__dirname, '..', 'bb-auto-constructor-shared.tsx'), 'utf8');

describe('4.5 APK-контролы ББ-авто (source-guard)', () => {
  it('в конструкторе нет нативных select/checkbox', () => {
    expect(SRC).not.toMatch(/<select[\s>]/);
    expect(SRC).not.toMatch(/type="checkbox"/);
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
    expect(SRC).toContain('PopupSelect');
    expect((SRC.match(/<PopupSelect/g) || []).length).toBeGreaterThanOrEqual(8);
  });
});
