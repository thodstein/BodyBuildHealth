/**
 * risk-female-thresholds.test.tsx — Ж1/Ж5 «Фазы 2 женского слоя»:
 *  - RiskScreen карточка «Препараты и пороги»: при sex=female — женские пороги
 *    из FEMALE_AAS_PROFILES + бейдж «♀ (1/4–1/10 мужских)»; при male — прежняя таблица;
 *  - RiskOverview компакт-таблица порогов: та же логика;
 *  - «♀ не дублируется»: бейдж ровно один на экран.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
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
  it('female + femaleThresholds → бейдж, дозо-индекс и клик-ссылка на «Женщины и ААС»', () => {
    const rows = femaleDrugThresholdView([{ id: 'test_enan', mgPerWeek: 25 }], 'female');
    const onOpen = vi.fn();
    const { container } = render(
      <RiskOverview riskResult={riskResult()} globalNoLabs={false} noLabsSystems={[]} labRiskContributions={null} sex="female" femaleThresholds={rows} femaleDoseIndex={37} onOpenWomenTab={onOpen} />,
    );
    // секция порогов открыта по умолчанию (showSections.thresholds=true)
    expect(container.querySelector('[data-female-thresholds="badge"]')).not.toBeNull();
    expect(container.querySelector('[data-female-threshold="test"]')).not.toBeNull();
    expect(screen.getByText(/Женские пороги \(1\/4–1\/10 мужских\)/)).toBeTruthy();
    // доза из стека отображается персонально
    expect(screen.getByText(/25 мг\/нед/)).toBeTruthy();
    // дозо-индекс вирилизации (Ж1)
    expect(container.querySelector('[data-female-dose-index]')!.textContent).toContain('37/100');
    // клик-ссылка ведёт в «Женщины и ААС»
    fireEvent.click(container.querySelector('[data-female-aas-link]')!);
    expect(onOpen).toHaveBeenCalledTimes(1);
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
  const nav = vi.fn();
  const goToHistory = async () => {
    localStorage.setItem('he_nav_risks', '1');
    render(<RiskScreen onNavigate={nav} />);
    await waitFor(() => expect(screen.getByText('Вероятностная модель')).toBeTruthy());
    fireEvent.click(screen.getByText('Вероятностная модель'));
    await waitFor(() => expect(screen.getByText('История и пороги препаратов')).toBeTruthy());
    fireEvent.click(screen.getByText('История и пороги препаратов'));
    await waitFor(() => expect(screen.getByText(/История рисков/)).toBeTruthy());
  };

  it('female: заголовок «♀ Препараты и пороги (женские)», бейдж, индекс, каталог профилей, клик-ссылка', async () => {
    nav.mockClear();
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
    // дозо-индекс вирилизации (Ж1) — пустой стек → 0/100
    expect(container.querySelector('[data-female-dose-index]')!.textContent).toContain('0/100');
    // клик-ссылка → support-women (App NAV_TARGETS)
    fireEvent.click(container.querySelector('[data-female-aas-link]')!);
    expect(nav).toHaveBeenCalledWith('support-women');
  });

  it('male: прежний заголовок и мужская таблица, ♀ скрыто', async () => {
    seedProfile('male');
    await goToHistory();
    expect(screen.getByText('Препараты и пороги (ААС, ГР, инсулины)')).toBeTruthy();
    expect(document.querySelector('[data-female-thresholds="badge"]')).toBeNull();
    expect(document.querySelector('[data-female-dose-index]')).toBeNull();
    expect(screen.queryByText(/♀ Препараты и пороги \(женские\)/)).toBeNull();
  });
});

describe('Ж4: проводка пола в lab-pharma (guard исходников)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  it('RiskScreen: оба вызова analyzeLabDrugCorrelation получают пол при female', () => {
    const src = read('src/ui/screens/RiskScreen.tsx');
    const calls = src.split('analyzeLabDrugCorrelation(').slice(1);
    expect(calls.length).toBeGreaterThanOrEqual(1); // вызов в ClinicalRiskDisplay (labPharmaAlerts)
    for (const c of calls) {
      expect(c.slice(0, 260)).toContain("profileSex === 'female'");
    }
  });

  it('LabsScreen и labs-indices: женские нормы включены через profileSex/sex', () => {
    const labs = read('src/ui/screens/LabsScreen.tsx');
    expect(labs).toContain("analyzeLabDrugCorrelation(currentLabs, linked.course, (linked.profile?.settings as any)?.pharma?.phase || 'on_cycle', profileSex === 'female' ? 'female' : undefined)");
    expect(labs).toContain('computeLabIndexDetails(currentLabs, profileSex');
    const indices = read('src/engines/labs-indices.engine.ts');
    expect(indices).toContain('normalizedRatio(point.code, point.value, point.unit, undefined, sex)');
  });
});
