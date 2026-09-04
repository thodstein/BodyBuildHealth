/**
 * rest-hooks-native.test.tsx — остаточные корни PRO-слоя: маркет,
 * фарма-вкладки, анализы, тренинг, питание. Поведение не изменилось.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { CatalogTab } from '../screens/PharmaScreen_parts/CatalogTab';
import { DosageCalculatorTab } from '../screens/PharmaScreen_parts/DosageCalculatorTab';
import { MapperTab } from '../screens/PharmaScreen_parts/MapperTab';
import { LabsSchedule } from '../screens/LabsScreen_parts/LabsSchedule';
import { LabsResults } from '../screens/LabsScreen_parts/LabsResults';
import { TimersTab } from '../screens/TrainingScreen_parts/TimersTab';
import { StrengthAnalysisHub } from '../screens/TrainingScreen_parts/StrengthAnalysisHub';
import { TaperPlannerTab } from '../screens/TrainingScreen_parts/TaperPlannerTab';
import { TempoTab } from '../screens/TrainingScreen_parts/TempoTab';
import { ProMetricsPanel } from '../screens/SRCBBScreen_parts/ProMetricsPanel';
import { AutoregPanel } from '../screens/SRCBBScreen_parts/AutoregPanel';
import { SupplementComplianceCard } from '../screens/SupportScreen_parts/SupplementComplianceCard';
import { default as ExtendedLabsTab } from '../screens/LabsScreen_parts/ExtendedLabsTab';
import { LabsTzRiskTab } from '../screens/LabsScreen_parts/LabsTzRiskTab';
import { TimersTab } from '../screens/TrainingScreen_parts/TimersTab';
import { PlateCalcTab } from '../screens/TrainingScreen_parts/PlateCalcTab';
import { OneRmCalcTab } from '../screens/TrainingScreen_parts/OneRmCalcTab';
import { VBTCalcTab } from '../screens/TrainingScreen_parts/VBTCalcTab';
import { CycleCatalog } from '../screens/TrainingScreen_parts/CycleCatalog';
import { TrainingCalendarTab } from '../screens/TrainingScreen_parts/TrainingCalendarTab';
import { CardioSessionTimer } from '../screens/TrainingScreen_parts/CardioSessionTimer';
import { ProgramsTab } from '../screens/TrainingScreen_parts/ProgramsTab';
import { PeakingPanel } from '../screens/SRCBBScreen_parts/PeakingPanel';
import { RecoveryPanel } from '../screens/SRCBBScreen_parts/RecoveryPanel';
import { NutritionCharts } from '../screens/NutritionScreen_parts/NutritionCharts';
import { NutritionReference } from '../screens/NutritionScreen_parts/NutritionReference';

async function resetPlatform() {
  const { resetAppPlatformCache } = await import('../../core/app-platform');
  resetAppPlatformCache();
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  await resetPlatform();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  await resetPlatform();
});

describe('market + pharma + labs roots', () => {
  it('1. Marketplace: шапка, табы, фильтры, сетка', () => {
    const { container } = render(<MarketplaceScreen />);
    expect(container.querySelector('.market-root')).not.toBeNull();
    expect(container.querySelector('.market-head')).not.toBeNull();
    expect(container.querySelectorAll('.market-tab').length).toBe(2);
    expect(container.querySelector('.market-body')).not.toBeNull();
    expect(container.querySelector('.market-filters')).not.toBeNull();
  });

  it('2. Marketplace: переключение каталог/корзина работает', () => {
    const { container } = render(<MarketplaceScreen />);
    const tabs = container.querySelectorAll('.market-tab');
    fireEvent.click(tabs[1]);
    expect((tabs[1] as HTMLElement).dataset.active).toBe('true');
  });

  it('3. Pharma tabs несут корни', () => {
    const { container: c1 } = render(<CatalogTab />);
    expect(c1.querySelector('.pharma-catalog'), 'catalog').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<DosageCalculatorTab />);
    expect(c2.querySelector('.pharma-dose'), 'dose').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<MapperTab />);
    expect(c3.querySelector('.pharma-mapper'), 'mapper').not.toBeNull();
  });

  it('4. Labs views несут корни', () => {
    const { container: c1 } = render(<LabsSchedule />);
    expect(c1.querySelector('.labs-schedule')).not.toBeNull();
    cleanup();
    const { container: c2 } = render(
      <LabsResults labs={[{ code: 'GLUCOSE', value: 5.2, unit: 'mmol/L', date: '2026-01-01' } as never]} />,
    );
    expect(c2.querySelector('.labs-results')).not.toBeNull();
  });

  it('5. Training calcs несут корни', () => {
    const { container: c1 } = render(<TimersTab />);
    expect(c1.querySelector('.train-timers'), 'timers').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<PlateCalcTab />);
    expect(c2.querySelector('.train-plates'), 'plates').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<OneRmCalcTab />);
    expect(c3.querySelector('.train-onerm'), 'onerm').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<VBTCalcTab />);
    expect(c4.querySelector('.train-vbt'), 'vbt').not.toBeNull();
  });

  it('6. Training каталоги и таймеры несут корни', () => {
    const { container: c1 } = render(
      <CycleCatalog goal="strength" level="intermediate" daysPerWeek={3} />,
    );
    expect(c1.querySelector('.train-cycles'), 'cycles').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<TrainingCalendarTab />);
    expect(c2.querySelector('.train-calendar'), 'calendar').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<CardioSessionTimer cycle={null} />);
    expect(c3.querySelector('.train-cardiotimer'), 'cardiotimer').not.toBeNull();
    cleanup();
    const { container: c4 } = render(
      <ProgramsTab selectedProgram={null} setSelectedProgram={() => {}} />,
    );
    expect(c4.querySelector('.train-programs'), 'programs').not.toBeNull();
  });

  it('7. PL-панели несут корни', () => {
    const { container: c1 } = render(<PeakingPanel />);
    expect(c1.querySelector('.pl-peak'), 'peak').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<RecoveryPanel />);
    expect(c2.querySelector('.pl-recovery'), 'recovery').not.toBeNull();
  });

  it('8. Nutrition views несут корни', () => {
    const { container: c1 } = render(
      <NutritionCharts
        kcalData={[]}
        proteinData={[]}
        labels={[]}
        dailyLogs={{}}
        targets={{ kcal: 2500, protein: 160, fats: 70, carbs: 300 }}
      />,
    );
    expect(c1.querySelector('.nut-charts'), 'charts').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<NutritionReference />);
    expect(c2.querySelector('.nut-ref'), 'ref').not.toBeNull();
  });

  it('9. Training deep-2 несут корни', () => {
    const { container: c1 } = render(<TimersTab />);
    expect(c1.querySelector('.train-timers'), 'timers2').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<StrengthAnalysisHub />);
    expect(c2.querySelector('.train-strength'), 'strength').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<TaperPlannerTab />);
    expect(c3.querySelector('.train-taper'), 'taper').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<TempoTab />);
    expect(c4.querySelector('.train-tempo'), 'tempo').not.toBeNull();
  });

  it('10. SRCBB панели и комплаенс несут корни', () => {
    const { container: c1 } = render(<ProMetricsPanel />);
    expect(c1.querySelector('.pl-prometrics'), 'prometrics').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<AutoregPanel />);
    expect(c2.querySelector('.pl-autoreg'), 'autoreg').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<SupplementComplianceCard />);
    expect(c3.querySelector('.sup-compliance'), 'compliance').not.toBeNull();
  });

  it('11. Labs deep несут корни', () => {
    const { container: c1 } = render(
      <ExtendedLabsTab labs={[]} selectedPhase="baseline" onPhaseChange={() => {}} tick={0} />,
    );
    expect(c1.querySelector('.labs-extended'), 'extended').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<LabsTzRiskTab />);
    expect(c2.querySelector('.labs-tzrisk'), 'tzrisk').not.toBeNull();
    // DailyDietDashboard рендерится только при наличии плана (null без него) —
    // хук .nut-dailydiet живёт в прод-ветке, здесь не проверяется.
  });
});
