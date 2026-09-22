/**
 * calendar-view-switch.test.tsx — Фаза 2 дедупа: единый переключатель
 * «Оригинальный / С тапером». Раньше разметка была скопирована дважды в PLPlanView.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CalendarViewSwitch } from '../CalendarViewSwitch';

describe('CalendarViewSwitch — единый переключатель', () => {
  it('рендерит переданные метки, aria-pressed и сообщает onChange', () => {
    const onChange = vi.fn();
    render(<CalendarViewSwitch value="tapered" onChange={onChange} originalLabel="🔵 Оригинальный (12 нед)" taperedLabel="📉 С тапером (15 нед)" />);
    const original = screen.getByText('🔵 Оригинальный (12 нед)');
    const tapered = screen.getByText('📉 С тапером (15 нед)');
    expect(original.getAttribute('aria-pressed')).toBe('false');
    expect(tapered.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(original);
    expect(onChange).toHaveBeenCalledWith('original');
    fireEvent.click(tapered);
    expect(onChange).toHaveBeenCalledWith('tapered');
  });

  it('дедуп: PLPlanView использует компонент дважды и не держит локальных кнопок', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/SRCBBScreen_parts/PLPlanView.tsx'), 'utf8');
    expect((src.match(/<CalendarViewSwitch/g) ?? []).length).toBe(2);
    expect(src).not.toContain("onClick={() => setCalendarView('original')}");
    expect(src).not.toContain("onClick={() => setCalendarView('tapered')}");
    expect(src).toContain("from './CalendarViewSwitch'");
  });
});
