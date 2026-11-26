/**
 * meso-correction-rir-honesty.test.tsx — карточка коррекции мезоцикла не выдумывает RIR:
 * без измерений пишет «нет измерений», не сдвигает RIR и не выводит «было 2».
 */
import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import MesoCorrectionCard from '../MesoCorrectionCard';

const profile = { injuries: [], weakPoints: [], fatigue: 5, equipment: [] } as any;

const baseProps = {
  profile,
  avgReadiness: 70,
  mesoWeeks: 12,
  missedSessions: 0,
  exercises: [],
  currentVolume: 12,
};

afterEach(() => cleanup());

describe('MesoCorrectionCard: честный RIR', () => {
  it('currentRir=null — «нет измерений», без «было 2» и без сдвига RIR', () => {
    const { container } = render(<MesoCorrectionCard {...baseProps} currentRir={null} />);
    const text = container.textContent || '';
    expect(text).toContain('нет измерений');
    expect(text).toContain('RIR: нет измерений — сдвиг RIR не применяется');
    expect(text).not.toContain('было 2');
    // Строка рекомендаций движка тоже не печатает выдуманный RIR.
    expect(text).toContain('RIR: нет измерений)');
    expect(text).not.toMatch(/RIR \d+(\.\d+)?,/);
    // Объём совпал с рекомендацией, RIR неизвестен → применять нечего.
    const applyBtn = container.querySelector('[data-lift="meso-apply"]') as HTMLButtonElement;
    expect(applyBtn).toBeTruthy();
    expect(applyBtn.disabled).toBe(true);
    expect(applyBtn.textContent).not.toMatch(/RIR\s*[+−-]?\s*\d/);
  });

  it('пол движка (6 сетов) и потолок RIR (4) не выдаются за рекомендацию', () => {
    // 4 сета в неделе: движок поднимает до 6 полом, но применять нечего.
    const lowVolume = render(<MesoCorrectionCard {...baseProps} currentVolume={4} currentRir={2} />);
    const lowBtn = lowVolume.container.querySelector('[data-lift="meso-apply"]') as HTMLButtonElement;
    expect(lowBtn.disabled).toBe(true);
    expect(lowBtn.textContent).not.toMatch(/объём ×/);
    cleanup();

    // Измеренный RIR 6: движок не поднимает выше 4, но сдвига от базы нет — RIR→6.
    const highRir = render(<MesoCorrectionCard {...baseProps} currentRir={6} />);
    const highBtn = highRir.container.querySelector('[data-lift="meso-apply"]') as HTMLButtonElement;
    expect(highBtn.disabled).toBe(true);
    expect(highRir.container.textContent).toContain('было 6');
    expect(highRir.container.textContent).not.toMatch(/RIR\s*[+−-]\s*\d/);
  });

  it('currentRir=1.5 — пишет «было 1.5» и не пишет «нет измерений»', () => {
    const { container } = render(<MesoCorrectionCard {...baseProps} currentRir={1.5} />);
    const text = container.textContent || '';
    expect(text).toContain('было 1.5');
    expect(text).not.toContain('нет измерений');
    expect(text).toContain('RIR 1.5');
  });
});
