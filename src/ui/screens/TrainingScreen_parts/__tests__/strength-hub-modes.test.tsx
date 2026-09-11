import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { StrengthAnalysisHub } from '../StrengthAnalysisHub';
import { RelStrengthTab } from '../RelStrengthTab';
import { PlNormsCalcTab } from '../PlNormsCalcTab';
import { StrengthAnalyticsCard } from '../StrengthAnalyticsCard';

afterEach(() => cleanup());

function clickPill(container: HTMLElement, label: string) {
  const btn = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes(label));
  expect(btn, `пилюля «${label}»`).toBeTruthy();
  fireEvent.click(btn!);
}

describe('StrengthAnalysisHub: 5 входов → 5 мод', () => {
  it('пилюли переключают все 5 корней без сброса хаба', () => {
    const { container } = render(<StrengthAnalysisHub />);
    expect(container.querySelector('.train-onerm'), 'дефолт 1RM').not.toBeNull();
    clickPill(container, 'VBT');
    expect(container.querySelector('.train-vbt'), 'VBT').not.toBeNull();
    clickPill(container, 'Отн. сила');
    expect(container.querySelector('.train-relstr'), 'relstrength').not.toBeNull();
    clickPill(container, 'Нормативы');
    expect(container.querySelector('.train-plnorms'), 'norms').not.toBeNull();
    clickPill(container, 'Аналитика');
    expect(container.querySelector('.train-strengthanalytics'), 'analytics').not.toBeNull();
    // снапшот пережил переключения (тотал виден в шапке)
    expect(container.textContent).toContain('кг');
  });
  it('ряд выдачи: CSV/JSON/ICS/блины на месте', () => {
    const { container } = render(<StrengthAnalysisHub />);
    const t = container.textContent || '';
    expect(t).toContain('e1RM-история (CSV)');
    expect(t).toContain('JSON тренеру');
    expect(t).toContain('Прикидка (.ics)');
    expect(t).toContain('Раскладка блинов');
  });
});

describe('RelStrengthTab', () => {
  it('показывает 4 очка вне категорий', () => {
    const { container } = render(<RelStrengthTab snapshot={{ sex: 'male', bw: 83, squat: 180, bench: 120, dead: 220, ohp: 60 }} />);
    expect(container.querySelector('.train-relstr')).not.toBeNull();
    const t = container.textContent || '';
    expect(t).toContain('DOTS');
    expect(t).toContain('IPF GL classic');
    expect(t).toContain('IPF GL equipped');
    expect(t).toContain('Wilks');
  });
});

describe('PlNormsCalcTab: попытки и лесенка', () => {
  it('блок попыток с прогнозом тотала', () => {
    const { container } = render(<PlNormsCalcTab />);
    expect((container.textContent || '')).toContain('Раскладка попыток');
    expect((container.textContent || '')).toContain('Прогноз тотала');
  });
});

describe('StrengthAnalyticsCard: MEV и Sinclair', () => {
  it('6 MEV-статусов и Sinclair-бейдж', () => {
    const { container } = render(<StrengthAnalyticsCard snapshot={{ sex: 'male', bw: 83, squat: 180, bench: 120, dead: 220, ohp: 60 }} />);
    expect(container.querySelector('.train-strengthanalytics')).not.toBeNull();
    expect((container.textContent || '')).toContain('Sinclair');
    expect((container.textContent || '')).toContain('/нед');
  });
});
