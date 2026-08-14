/**
 * macrocycle-panel-actions.test.tsx — регрессия новых действий годового
 * планировщика: кнопки «💾 Сохранить» и «▶️ Начать работу по циклу».
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { MacrocyclePanel } from '../../SRCBBScreen_parts/MacrocyclePanel';
import { buildBbMacrocycle, serializeBbMacro } from '../../../../engines/lms/macrocycle.engine';

const baseProps = {
  level: 'advanced',
  goal: 'bodybuilding' as const,
  onApplyCycle: () => {},
};

describe('MacrocyclePanel — действия годового плана', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('SSR: кнопки «Сохранить» и «Начать работу по циклу» рендерятся при наличии макро', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    try { localStorage.setItem('he_bb_macro', serializeBbMacro(macro)); } catch { /* ignore */ }
    const html = renderToStaticMarkup(<MacrocyclePanel {...baseProps} onApplyMacrocycle={() => {}} />);
    expect(html).toContain('💾 Сохранить');
    expect(html).toContain('▶️ Начать работу по циклу');
    expect(html).toContain('🗓 Применить весь макроцикл');
  });

  it('CSR: «Сохранить» показывает «✅ Сохранено»', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    try { localStorage.setItem('he_bb_macro', serializeBbMacro(macro)); } catch { /* ignore */ }
    render(<MacrocyclePanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(screen.getByText(/✅ Сохранено/)).toBeTruthy();
  });

  it('CSR: «Начать работу по циклу» вызывает onApplyMacrocycle с макро', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    try { localStorage.setItem('he_bb_macro', serializeBbMacro(macro)); } catch { /* ignore */ }
    let applied: any = null;
    render(<MacrocyclePanel {...baseProps} onApplyMacrocycle={(m: any) => { applied = m; }} />);
    fireEvent.click(screen.getByRole('button', { name: /Начать работу по циклу/ }));
    expect(applied).toBeTruthy();
    expect(applied.totalWeeks).toBe(12);
  });

  it('без макро: кнопки действий не рендерятся (нечему сохранять)', () => {
    const html = renderToStaticMarkup(<MacrocyclePanel {...baseProps} />);
    expect(html).not.toContain('▶️ Начать работу по циклу');
  });
});
