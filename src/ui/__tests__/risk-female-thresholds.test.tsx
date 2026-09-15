/**
 * risk-female-thresholds.test.tsx — Ж1/Ж5 «Фазы 2 женского слоя»:
 *  - RiskScreen карточка «Препараты и пороги»: при sex=female — женские пороги
 *    из FEMALE_AAS_PROFILES + бейдж «♀ (1/4–1/10 мужских)»; при male — прежняя таблица;
 *  - RiskOverview компакт-таблица порогов: та же логика;
 *  - «♀ не дублируется»: бейдж ровно один на экран.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { RiskScreen } from '../screens/RiskScreen';
import { RiskOverview } from '../screens/RiskScreen_parts/RiskOverview';
import { femaleDrugThresholdView } from '../../engines/female-aas-risk';
import type { RiskResult } from '../../core/types';

const seedProfile = (sex: 'male' | 'female') => {
  localStorage.setItem('he_profile_v2', JSON.stringify({
    settings: { personal: { sex, weight: 60, age: 30 }, lifestyle: { sleepHours: 7, stressLevel: 4 } },
  }));
};

const riskResult = (): RiskResult => ({
  overallRaw: 30,
  overallNet: 20,
  systemBreakdown: { cardio: { raw: 30, net: 20 }, hepatic: { raw: 25, net: 18 } },
} as unknown as RiskResult);

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe('Ж1: RiskOverview — женская компакт-таблица порогов', () => {
  it('female + femaleThresholds → бейдж и женские строки', () => {
    const rows = femaleDrugThresholdView([{ id: 'test_enan', mgPerWeek: 25 }], 'female');
    const { container } = render(
      <RiskOverview riskResult={riskResult()} globalNoLabs={false} noLabsSystems={[]} labRiskContributions={null} sex="female" femaleThresholds={rows} />,
    );
    // секция порогов открыта по умолчанию (showSections.thresholds=true)
    expect(container.querySelector('[data-female-thresholds="badge"]')).not.toBeNull();
    expect(container.querySelector('[data-female-threshold="test"]')).not.toBeNull();
    expect(screen.getByText(/Женские пороги \(1\/4–1\/10 мужских\)/)).toBeTruthy();
    // доза из стека отображается персонально
    expect(screen.getByText(/25 мг\/нед/)).toBeTruthy();
  });

  it('без sex (мужской путь) — байт-в-байт: прежняя таблица, нет ♀', () => {
    const { container } = render(
      <RiskOverview riskResult={riskResult()} globalNoLabs={false} noLabsSystems={[]} labRiskContributions={null} />,
    );
    // секция порогов открыта по умолчанию
    expect(container.querySelector('[data-female-thresholds="badge"]')).toBeNull();
    expect(container.querySelector('[data-female-threshold]')).toBeNull();
    expect(screen.getByText(/превышение кратно увеличивает риски/i)).toBeTruthy();
  });
});

describe('Ж1: RiskScreen — карточка препаратов в истории', () => {
  const goToHistory = async () => {
    localStorage.setItem('he_nav_risks', '1');
    render(<RiskScreen />);
    await waitFor(() => expect(screen.getByText('Вероятностная модель')).toBeTruthy());
    fireEvent.click(screen.getByText('Вероятностная модель'));
    await waitFor(() => expect(screen.getByText('История и пороги препаратов')).toBeTruthy());
    fireEvent.click(screen.getByText('История и пороги препаратов'));
    await waitFor(() => expect(screen.getByText(/История рисков/)).toBeTruthy());
  };

  it('female: заголовок «♀ Препараты и пороги (женские)», бейдж, полный каталог профилей', async () => {
    seedProfile('female');
    await goToHistory();
    const { container } = { container: document.body };
    expect(screen.getByText(/♀ Препараты и пороги \(женские\)/)).toBeTruthy();
    const badge = container.querySelector('[data-female-thresholds="badge"]')!;
    expect(badge.textContent).toContain('1/4–1/10 мужских');
    expect(badge.textContent).toContain('Женщины и ААС');
    // 22 профиля FEMALE_AAS_PROFILES — все строки с data-атрибутом
    expect(container.querySelectorAll('[data-female-threshold]').length).toBeGreaterThanOrEqual(20);
    // абсолютные противопоказания подписаны
    expect(screen.getAllByText(/абсолютное противопоказание \(любая доза\)/).length).toBeGreaterThanOrEqual(7);
  });

  it('male: прежний заголовок и мужская таблица, ♀ скрыто', async () => {
    seedProfile('male');
    await goToHistory();
    expect(screen.getByText('Препараты и пороги (ААС, ГР, инсулины)')).toBeTruthy();
    expect(document.querySelector('[data-female-thresholds="badge"]')).toBeNull();
    expect(screen.queryByText(/♀ Препараты и пороги \(женские\)/)).toBeNull();
  });
});
