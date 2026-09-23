/**
 * pl-alert-toasts.test.tsx — §4 ПЛ-плана: alert()/prompt() заменены на тосты/шиты.
 *
 *  1. Source-guard: в 4 файлах нет ВЫЗОВОВ alert(/prompt( с аргументом
 *     (упоминания в комментариях допустимы).
 *  2. Поведение: RecoveryPanel/AutoregPanel показывают тост при сохранении
 *     (раньше в тренинге window.showToast не определён → срабатывал alert).
 *  3. PopupText compact: триггер «➕ Своё» → шит → ввод → onChange
 *     (замена prompt() в PlDeadpointsBarPathCard).
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RecoveryPanel } from '../RecoveryPanel';
import { AutoregPanel } from '../AutoregPanel';
import { PopupText } from '../TrainingPopups';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('§4 ПЛ: alert/prompt → тосты/шиты', () => {
  it('source-guard: нет вызовов alert(/prompt( с аргументом в 4 файлах', () => {
    const files = [
      'src/ui/screens/SRCBBScreen_parts/AutoregPanel.tsx',
      'src/ui/screens/SRCBBScreen_parts/RecoveryPanel.tsx',
      'src/ui/screens/SRCBBScreen_parts/PeakingPanel.tsx',
      'src/ui/screens/TrainingScreen_parts/PlDeadpointsBarPathCard.tsx',
    ];
    for (const f of files) {
      const src = read(f);
      const calls = src.match(/(?<![\w.])(alert|prompt)\(\s*['"`]/g) ?? [];
      expect(calls, `${f}: ${calls.join(', ')}`).toEqual([]);
    }
  });

  it('RecoveryPanel: сохранение показывает тост (не alert)', () => {
    render(<RecoveryPanel />);
    fireEvent.click(screen.getByText('💾 Сохранить в профиль'));
    expect(screen.getByText('✓ Сохранено в профиль')).toBeTruthy();
  });

  it('AutoregPanel: сохранение показывает тост (не alert)', () => {
    render(<AutoregPanel />);
    fireEvent.click(screen.getByText('💾 Сохранить в профиль'));
    expect(screen.getByText('✓ Сохранено в профиль')).toBeTruthy();
  });

  it('PopupText compact: «➕ Своё» открывает шит и отдаёт ввод через onChange', () => {
    const onChange = vi.fn();
    render(<PopupText compact label="➕ Своё" placeholder="Жим с паузой" value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('➕ Своё'));
    const input = screen.getByPlaceholderText('Жим с паузой');
    fireEvent.change(input, { target: { value: 'Жим с паузой 3с' } });
    fireEvent.click(screen.getByText('OK'));
    expect(onChange).toHaveBeenCalledWith('Жим с паузой 3с');
  });
});
