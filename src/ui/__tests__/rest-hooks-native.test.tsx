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
import { DiaryRecordingForm } from '../screens/TrainingScreen_parts/DiaryRecordingForm';
import { QuickEntry } from '../screens/TrainingScreen_parts/QuickEntry';
import { PlDeadpointsBarPathCard } from '../screens/TrainingScreen_parts/PlDeadpointsBarPathCard';
import { WarmupDiaryView } from '../screens/TrainingScreen_parts/WarmupDiaryView';
import { CooldownDiaryView } from '../screens/TrainingScreen_parts/CooldownDiaryView';
import { TrainingMixTab } from '../screens/TrainingScreen_parts/TrainingMixTab';
import { VolumeOptimizerTab } from '../screens/TrainingScreen_parts/VolumeOptimizerTab';
import { MesocycleTrackerTab } from '../screens/TrainingScreen_parts/MesocycleTrackerTab';
import { CardioAnalyticsDashboard } from '../screens/TrainingScreen_parts/CardioAnalyticsDashboard';
import { MobilityTab } from '../screens/TrainingScreen_parts/MobilityTab';
import { BBContestPrepCard } from '../screens/SRCBBScreen_parts/BBContestPrepCard';
import { TaperCoachCard } from '../screens/SRCBBScreen_parts/TaperCoachCard';
import { StrengthDiary } from '../../engines/strength-diary.engine';
import { SupportFavoritesView } from '../screens/SupportScreen_parts/SupportFavoritesView';
import { SupportTimingPlanner } from '../screens/SupportScreen_parts/SupportTimingPlanner';
import { WeeklyPlanView } from '../screens/SupportScreen_parts/WeeklyPlanView';
import { LabDiaryTab } from '../screens/LabsScreen_parts/LabDiaryTab';
import { default as LabsCatalogTab } from '../screens/LabsScreen_parts/LabsCatalogTab';
import { RiskInfo } from '../screens/RiskScreen_parts/RiskInfo';
import { ProductUsefulnessPlanner } from '../screens/NutritionScreen_parts/ProductUsefulnessPlanner';
import { InjurySelectCard } from '../screens/TrainingScreen_parts/InjurySelectCard';
import { JointMasterCard } from '../screens/TrainingScreen_parts/JointMasterCard';
import { LiftMasterCard } from '../screens/TrainingScreen_parts/LiftMasterCard';
import { LoadSafetyCard } from '../screens/TrainingScreen_parts/LoadSafetyCard';
import { QualityChecklistCard } from '../screens/TrainingScreen_parts/QualityChecklistCard';
import { RIRCalibrationCard } from '../screens/TrainingScreen_parts/RIRCalibrationCard';
import { SplitGenCard } from '../screens/TrainingScreen_parts/SplitGenCard';
import { CalcQualityTab } from '../screens/TrainingScreen_parts/CalcQualityTab';
import { DeloadSchedulerTab } from '../screens/TrainingScreen_parts/DeloadSchedulerTab';
import { TrainingLoadCalculator } from '../screens/TrainingScreen_parts/TrainingLoadCalculator';
import { ExerciseSafetyPanel } from '../screens/SRCBBScreen_parts/ExerciseSafetyPanel';
import { MobilitySessionPanel } from '../screens/SRCBBScreen_parts/MobilitySessionPanel';
import { TrainingMetricsChart } from '../screens/SRCBBScreen_parts/TrainingMetricsChart';
import { SupportPeptideCalc } from '../screens/SupportScreen_parts/SupportPeptideCalc';
import { SupportAnalogCalculator } from '../screens/SupportScreen_parts/SupportAnalogCalculator';
import { SupportEffectiveDose } from '../screens/SupportScreen_parts/SupportEffectiveDose';
import { RiskTimelineChart } from '../screens/SupportScreen_parts/RiskTimelineChart';
import { CardioAutoTunePanel } from '../screens/TrainingScreen_parts/CardioAutoTunePanel';
import { CardioImportPanel } from '../screens/TrainingScreen_parts/CardioImportPanel';
import { JointJsiCalculatorCard } from '../screens/TrainingScreen_parts/JointJsiCalculatorCard';
import { LimiterCalculatorCard } from '../screens/TrainingScreen_parts/LimiterCalculatorCard';
import { MixDiarySection } from '../screens/TrainingScreen_parts/MixDiarySection';
import { PeakingProtocolsTab } from '../screens/TrainingScreen_parts/PeakingProtocolsTab';
import { ProgramNotes } from '../screens/TrainingScreen_parts/ProgramExtras';
import { VideoCaptureCard } from '../screens/TrainingScreen_parts/VideoCaptureCard';
import { default as ExerciseLabCatalog } from '../screens/TrainingScreen_parts/ExerciseLabCatalog';
import { SupportBioavailability } from '../screens/SupportScreen_parts/SupportBioavailability';
import { SupportProtocolSleep } from '../screens/SupportScreen_parts/supportProtocolSleep';
import { SupportProtocolJoints } from '../screens/SupportScreen_parts/supportProtocolJoints';
import { SupportProtocolNeuro } from '../screens/SupportScreen_parts/supportProtocolNeuro';
import { SupportProtocolCardio } from '../screens/SupportScreen_parts/supportProtocolCardio';
import { SupportProtocolE2 } from '../screens/SupportScreen_parts/supportProtocolE2';
import { SupportProtocolGH } from '../screens/SupportScreen_parts/supportProtocolGH';
import { ArmDiagnosticsHub } from '../screens/TrainingScreen_parts/ArmDiagnosticsHub';
import { WLDiagnosticsHub } from '../screens/TrainingScreen_parts/WLDiagnosticsHub';
import { StrongmanDiagnosticsHub } from '../screens/TrainingScreen_parts/StrongmanDiagnosticsHub';
import { default as ExerciseLabMerged } from '../screens/TrainingScreen_parts/ExerciseLabMerged';
import { default as ExerciseLabPrescription } from '../screens/TrainingScreen_parts/ExerciseLabPrescription';
import { SupportProtocolAcne } from '../screens/SupportScreen_parts/supportProtocolAcne';
import { SupportProtocolImmune } from '../screens/SupportScreen_parts/supportProtocolImmune';
import { SupportProtocolHepatic } from '../screens/SupportScreen_parts/supportProtocolHepatic';
import { SupportProtocolRenal } from '../screens/SupportScreen_parts/supportProtocolRenal';
import { SupportProtocolThyroid } from '../screens/SupportScreen_parts/supportProtocolThyroid';
import { SupportProtocolMetabolic } from '../screens/SupportScreen_parts/supportProtocolMetabolic';
import { SupportProtocolHemato } from '../screens/SupportScreen_parts/supportProtocolHemato';
import { SupportProtocolDetox } from '../screens/SupportScreen_parts/supportProtocolDetox';
import { ArmTechniqueCard } from '../screens/TrainingScreen_parts/ArmTechniqueCard';
import { MicrocyclePlannerCard } from '../screens/TrainingScreen_parts/MicrocyclePlannerCard';
import { PlanFeedbackCard } from '../screens/TrainingScreen_parts/PlanFeedbackCard';
import { QualityDiagnosticsHub } from '../screens/TrainingScreen_parts/QualityDiagnosticsHub';
import { TrainingSafetyHub } from '../screens/TrainingScreen_parts/TrainingSafetyHub';
import { EditorOverlay } from '../screens/TrainingScreen_parts/EditorPopup';
import { ProfileDiariesTab } from '../screens/ProfileScreen_v2/ProfileDiariesTab';
import { ProfileSettingsTab } from '../screens/ProfileScreen_v2/ProfileSettingsTab';
import { SupportProtocolPeptide } from '../screens/SupportScreen_parts/supportProtocolPeptide';
import { SupportProtocolRAAS } from '../screens/SupportScreen_parts/supportProtocolRAAS';
import { Achievements } from '../screens/NutritionScreen_parts/Achievements';
import { DailyQuests } from '../screens/NutritionScreen_parts/DailyQuests';
import { default as MMCTrackingCard } from '../screens/TrainingScreen_parts/MMCTrackingCard';
import { HysteresisChart } from '../screens/RiskScreen_parts/HysteresisChart';
import { PredictiveAnalytics } from '../screens/RiskScreen_parts/PredictiveAnalytics';
import { PeriWorkoutCard } from '../screens/NutritionScreen_parts/PeriWorkoutCard';
import { ProgressTracker } from '../screens/NutritionScreen_parts/ProgressTracker';
import { VisualTab } from '../screens/TrainingScreen_parts/VisualTab';
import { MMCSetPanel } from '../screens/TrainingScreen_parts/MMCSetPanel';
import { ManualLibraryDrawer } from '../screens/TrainingScreen_parts/ManualLibraryDrawer';
import { default as MesoCorrectionCard } from '../screens/TrainingScreen_parts/MesoCorrectionCard';
import { CardioDayCard } from '../screens/TrainingScreen_parts/CardioDayCard';
import { CardioDiaryStep } from '../screens/TrainingScreen_parts/CardioDiaryStep';
import { CheckinMetricsCard } from '../screens/TrainingScreen_parts/CheckinMetricsCard';
import { DeloadProtocolCard } from '../screens/TrainingScreen_parts/DeloadProtocolCard';
import { MethodologyEncyclopedia } from '../screens/TrainingScreen_parts/MethodologyEncyclopedia';
import { PLToolsCard } from '../screens/SRCBBScreen_parts/PLToolsCard';
import { SupportCalcToolsHub } from '../screens/SupportScreen_parts/SupportCalcToolsHub';
import { SupportGeneratorInfo } from '../screens/SupportScreen_parts/SupportGeneratorInfo';
import { SupportProtocolElectrolytes } from '../screens/SupportScreen_parts/supportProtocolElectrolytes';
import { SupportProtocolInteractions } from '../screens/SupportScreen_parts/supportProtocolInteractions';
import { BBFeedbackCard } from '../screens/TrainingScreen_parts/BBFeedbackCard';
import { BbToolsCard } from '../screens/TrainingScreen_parts/BbToolsCard';
import { BbProgramLibraryPicker } from '../screens/TrainingScreen_parts/BbProgramLibraryPicker';
import { default as ExerciseLabPro } from '../screens/TrainingScreen_parts/ExerciseLabPro';
import { default as ExerciseLabProSubstitute } from '../screens/TrainingScreen_parts/ExerciseLabProSubstitute';
import { ManualLibraryGallery } from '../screens/TrainingScreen_parts/ManualLibraryGallery';
import { RirWaveChart } from '../screens/TrainingScreen_parts/ProgramEditorPanels2';
import { SubstitutionPopup } from '../screens/TrainingScreen_parts/SubstitutionPopup';
import { SupportProtocolCost } from '../screens/SupportScreen_parts/supportProtocolCost';
import { SupportProtocolEmergency } from '../screens/SupportScreen_parts/supportProtocolEmergency';
import { SupportProtocolGI } from '../screens/SupportScreen_parts/supportProtocolGI';
import { SupportProtocolGLP1 } from '../screens/SupportScreen_parts/supportProtocolGLP1';
import { SupportProtocolHair } from '../screens/SupportScreen_parts/supportProtocolHair';
import { SupportProtocolInjections } from '../screens/SupportScreen_parts/supportProtocolInjections';
import { SupportProtocolWomen } from '../screens/SupportScreen_parts/supportProtocolWomen';
import { ArmAutoConstructor } from '../screens/TrainingScreen_parts/ArmAutoConstructor';
import { FatigueIndexTab } from '../screens/TrainingScreen_parts/FatigueIndexTab';
import { MRVEstimatorTab } from '../screens/TrainingScreen_parts/MRVEstimatorTab';
import { TonnageCalcTab } from '../screens/TrainingScreen_parts/TonnageCalcTab';
import { CsvImportTab } from '../screens/TrainingScreen_parts/CsvImportTab';
import { CardioLinkCard } from '../screens/TrainingScreen_parts/CardioLinkCard';
import { MixPresetsCard } from '../screens/TrainingScreen_parts/MixPresetsCard';
import { PlannerToolsPanel } from '../screens/TrainingScreen_parts/PlannerToolsPanel';
import ConjugateDesigner from '../screens/TrainingScreen_parts/ConjugateDesigner';
import { MesocycleProgressionCard } from '../screens/TrainingScreen_parts/MesocycleProgressionCard';
import { PedInputPanel } from '../screens/TrainingScreen_parts/PedCoursePanel';

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

  it('12. Training deep-3 несут корни', () => {
    const { container: c1 } = render(
      <QuickEntry
        diary={new StrengthDiary()}
        historyWorkouts={[]}
        selectedWeek={1}
        onSave={() => {}}
      />,
    );
    expect(c1.querySelector('.train-quickentry'), 'quickentry').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<WarmupDiaryView historyWorkouts={[]} />);
    expect(c2.querySelector('.train-warmupdiary'), 'warmup').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<CooldownDiaryView />);
    expect(c3.querySelector('.train-cooldowndiary'), 'cooldown').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<TrainingMixTab />);
    expect(c4.querySelector('.train-mix'), 'mix').not.toBeNull();
  });

  it('13. Volume, meso, cardio-stats, mobility несут корни', () => {
    const { container: c1 } = render(<VolumeOptimizerTab />);
    expect(c1.querySelector('.train-volopt'), 'volopt').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<MesocycleTrackerTab />);
    expect(c2.querySelector('.train-meso'), 'meso').not.toBeNull();
    cleanup();
    const { container: c3 } = render(
      <CardioAnalyticsDashboard cycle={null} log={[]} />,
    );
    expect(c3.querySelector('.train-cardiostats'), 'cardiostats').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<MobilityTab />);
    expect(c4.querySelector('.train-mobility'), 'mobility').not.toBeNull();
  });

  it('14. Contest/taper несут корни (season — тяжёлый, хук в проде)', () => {
    const { container: c2 } = render(<BBContestPrepCard />);
    expect(c2.querySelector('.pl-contestprep'), 'contestprep').not.toBeNull();
    cleanup();
    const { container: c3 } = render(
      <TaperCoachCard
        builtSrc={null}
        hasTaper={false}
        buildCtx={() => ({}) as never}
        applyRamp={() => {}}
      />,
    );
    expect(c3.querySelector('.pl-tapercoach'), 'tapercoach').not.toBeNull();
    // PLSeasonBuilder требует полный LMSSelectorInput — хук .pl-season
    // живёт в прод-ветке, здесь не проверяется.
  });

  it('15. Support fav/timing/weekplan несут корни', () => {
    const { container: c1 } = render(<SupportFavoritesView s={{}} />);
    expect(c1.querySelector('.sup-fav'), 'fav').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<SupportTimingPlanner />);
    expect(c2.querySelector('.sup-timing'), 'timing').not.toBeNull();
    cleanup();
    const { container: c3 } = render(
      <WeeklyPlanView planResult={{ schedule: [] } as never} courseWeek={1} />,
    );
    expect(c3.querySelector('.sup-weekplan'), 'weekplan').not.toBeNull();
  });

  it('16. LabDiary, LabsCatalog, RiskInfo, Usefulness несут корни', () => {
    const { container: c1 } = render(<LabDiaryTab labs={[]} />);
    expect(c1.querySelector('.labs-labdiary'), 'labdiary').not.toBeNull();
    cleanup();
    const { container: c2 } = render(
      <LabsCatalogTab labs={[]} selectedPhase="baseline" onPhaseChange={() => {}} tick={0} />,
    );
    expect(c2.querySelector('.labs-labscatalog'), 'labscatalog').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<RiskInfo />);
    expect(c3.querySelector('.risk-info'), 'riskinfo').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<ProductUsefulnessPlanner />);
    expect(c4.querySelector('.nut-usefulness'), 'usefulness').not.toBeNull();
  });

  it('17. Карточки тренинга несут корни', () => {
    const { container: c1 } = render(
      <InjurySelectCard injuries={[]} onChange={() => {}} />,
    );
    expect(c1.querySelector('.train-injury'), 'injury').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<JointMasterCard />);
    expect(c2.querySelector('.train-joint'), 'joint').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<LoadSafetyCard />);
    expect(c3.querySelector('.train-loadsafety'), 'loadsafety').not.toBeNull();
    cleanup();
    const { container: c4 } = render(
      <QualityChecklistCard
        program={
          {
            meta: { direction: 'bb', weeks: 4, daysPerWeek: 3, title: 'Test program' },
            bb: { weeks: [] },
          } as never
        }
        onChange={() => {}}
        showToast={() => {}}
        tprofile={{} as never}
        labMrv={1}
      />,
    );
    expect(c4.querySelector('.train-quality'), 'quality').not.toBeNull();
  });

  it('18. RIR, сплит, качество, делоад, нагрузка несут корни', () => {
    const { container: c1 } = render(<RIRCalibrationCard />);
    expect(c1.querySelector('.train-rir'), 'rir').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<SplitGenCard />);
    expect(c2.querySelector('.train-splitgen'), 'splitgen').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<DeloadSchedulerTab />);
    expect(c3.querySelector('.train-deload'), 'deload').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<TrainingLoadCalculator />);
    expect(c4.querySelector('.train-loadcalc'), 'loadcalc').not.toBeNull();
  });

  it('19. SRCBB safety/mobility/metrics несут корни', () => {
    const { container: c1 } = render(<ExerciseSafetyPanel />);
    expect(c1.querySelector('.pl-safety'), 'safety').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<TrainingMetricsChart />);
    expect(c2.querySelector('.pl-metrics'), 'metrics').not.toBeNull();
  });

  it('20. Support calc/protocols несут корни', () => {
    const { container: c1 } = render(
      <SupportPeptideCalc
        s={{
          peptideId: '',
          pepAmount: '',
          pepDose: '',
          pepDilution: '',
          pepSyringe: '',
          pepProtocol: '',
          pepSchedule: [],
          pepTotalDays: 0,
        }}
      />,
    );
    expect(c1.querySelector('.sup-pepcalc'), 'pepcalc').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<SupportAnalogCalculator />);
    expect(c2.querySelector('.sup-analog'), 'analog').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<SupportEffectiveDose />);
    expect(c3.querySelector('.sup-effdose'), 'effdose').not.toBeNull();
    cleanup();
    const { container: c4 } = render(
      <RiskTimelineChart
        timeline={[
          {
            week: 1,
            activeDrugs: [],
            drugConcentrations: {},
            organPercents: {},
            organAfterPercents: {},
            overallRaw: 10,
            overallAfter: 8,
          },
        ]}
      />,
    );
    expect(c4.querySelector('.sup-risktimeline'), 'risktimeline').not.toBeNull();
  });

  it('24. Batch-6 корни: autotune, import, jsi, limiter', () => {
    const { container: c1 } = render(<CardioAutoTunePanel cycle={null} />);
    expect(c1.querySelector('.train-autotune'), 'autotune').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<CardioImportPanel />);
    expect(c2.querySelector('.train-cardioimport'), 'cardioimport').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<JointJsiCalculatorCard />);
    expect(c3.querySelector('.train-jsi'), 'jsi').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<LimiterCalculatorCard />);
    expect(c4.querySelector('.train-limiter'), 'limiter').not.toBeNull();
  });

  it('25. Batch-6 корни: peakproto, prognotes, videocap', () => {
    // MixDiarySection возвращает null без записей (строка 70) —
    // хук .train-mixdiary живёт в прод-ветке, здесь не проверяется.
    const { container: c2 } = render(<PeakingProtocolsTab />);
    expect(c2.querySelector('.train-peakproto'), 'peakproto').not.toBeNull();
    cleanup();
    const { container: c3 } = render(
      <ProgramNotes program={{ meta: { notes: '' } } as never} onChange={() => {}} />,
    );
    expect(c3.querySelector('.train-prognotes'), 'prognotes').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<VideoCaptureCard lift={'bench' as never} />);
    expect(c4.querySelector('.train-videocap'), 'videocap').not.toBeNull();
  });

  it('26. Batch-6 корни: exlabcatalog, bio, протоколы', () => {
    const { container: c1 } = render(<ExerciseLabCatalog />);
    expect(c1.querySelector('.train-exlabcatalog'), 'exlabcatalog').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<SupportBioavailability s={{}} />);
    expect(c2.querySelector('.sup-bio'), 'bio').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<SupportProtocolSleep s={{}} />);
    expect(c3.querySelector('.sup-proto-sleep'), 'sleep').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<SupportProtocolJoints s={{}} />);
    expect(c4.querySelector('.sup-proto-joints'), 'joints').not.toBeNull();
    cleanup();
    const { container: c5 } = render(<SupportProtocolNeuro s={{}} />);
    expect(c5.querySelector('.sup-proto-neuro'), 'neuro').not.toBeNull();
    cleanup();
    const { container: c6 } = render(<SupportProtocolCardio s={{}} />);
    expect(c6.querySelector('.sup-proto-cardio'), 'cardio').not.toBeNull();
    cleanup();
    const { container: c7 } = render(<SupportProtocolE2 s={{}} />);
    expect(c7.querySelector('.sup-proto-e2'), 'e2').not.toBeNull();
    cleanup();
    const { container: c8 } = render(<SupportProtocolGH s={{}} />);
    expect(c8.querySelector('.sup-proto-gh'), 'gh').not.toBeNull();
  });

  it('21. Batch-5 корни: arm, fatigue, mrv, tonnage', () => {
    const { container: c1 } = render(<ArmAutoConstructor />);
    expect(c1.querySelector('.train-arm'), 'arm').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<FatigueIndexTab />);
    expect(c2.querySelector('.train-fatigue'), 'fatigue').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<MRVEstimatorTab />);
    expect(c3.querySelector('.train-mrvest'), 'mrvest').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<TonnageCalcTab />);
    expect(c4.querySelector('.train-tonnage'), 'tonnage').not.toBeNull();
  });

  it('22. Batch-5 корни: csv, cardiolink, mixpresets', () => {
    const { container: c1 } = render(<CsvImportTab />);
    expect(c1.querySelector('.train-csvimport'), 'csvimport').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<CardioLinkCard />);
    expect(c2.querySelector('.train-cardiolink'), 'cardiolink').not.toBeNull();
    cleanup();
    // CardioVolumeChart возвращает null без цикла (строка 46) —
    // хук .train-cardiovol живёт в прод-ветке, здесь не проверяется.
    const { container: c4 } = render(<MixPresetsCard />);
    expect(c4.querySelector('.train-mixpresets'), 'mixpresets').not.toBeNull();
  });

  it('23. Batch-5 корни: plannertools, conjugate, mesoprog, pedinput', () => {
    const { container: c1 } = render(<PlannerToolsPanel mode="pl" />);
    expect(c1.querySelector('.train-plannertools'), 'plannertools').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<ConjugateDesigner />);
    expect(c2.querySelector('.train-conjugate'), 'conjugate').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<MesocycleProgressionCard />);
    expect(c3.querySelector('.train-mesoprog'), 'mesoprog').not.toBeNull();
    cleanup();
    const { container: c4 } = render(
      <PedInputPanel
        peds={[]}
        onToggle={() => {}}
        pedDoses={{}}
        onDose={() => {}}
        courseIntensity={'moderate' as never}
        onIntensity={() => {}}
      />,
    );
    expect(c4.querySelector('.train-pedinput'), 'pedinput').not.toBeNull();
  });

  it('27. Batch-7 корни: диагностика и лаборатория', () => {
    const { container: c1 } = render(<ArmDiagnosticsHub />);
    expect(c1.querySelector('.train-armdiag'), 'armdiag').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<WLDiagnosticsHub />);
    expect(c2.querySelector('.train-wldiag'), 'wldiag').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<StrongmanDiagnosticsHub />);
    expect(c3.querySelector('.train-strongdiag'), 'strongdiag').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<ExerciseLabMerged />);
    expect(c4.querySelector('.train-exlabmerged'), 'exlabmerged').not.toBeNull();
    cleanup();
    const { container: c5 } = render(<ExerciseLabPrescription />);
    expect(c5.querySelector('.train-exlabpresc'), 'exlabpresc').not.toBeNull();
    // MindsetTab/StrengthAnalyticsCard/LoadGuardPanel/PlanDiagnosticsPanel
    // требуют hub/snapshot/program — хуки живут в прод-ветках.
  });

  it('28. Batch-7 корни: протоколы, вторая волна', () => {
    const { container: c1 } = render(<SupportProtocolAcne s={{}} />);
    expect(c1.querySelector('.sup-proto-acne'), 'acne').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<SupportProtocolImmune s={{}} />);
    expect(c2.querySelector('.sup-proto-immune'), 'immune').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<SupportProtocolHepatic s={{}} />);
    expect(c3.querySelector('.sup-proto-hepatic'), 'hepatic').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<SupportProtocolRenal s={{}} />);
    expect(c4.querySelector('.sup-proto-renal'), 'renal').not.toBeNull();
    cleanup();
    const { container: c5 } = render(<SupportProtocolThyroid s={{}} />);
    expect(c5.querySelector('.sup-proto-thyroid'), 'thyroid').not.toBeNull();
    cleanup();
    const { container: c6 } = render(<SupportProtocolMetabolic s={{}} />);
    expect(c6.querySelector('.sup-proto-metabolic'), 'metabolic').not.toBeNull();
    cleanup();
    const { container: c7 } = render(<SupportProtocolHemato s={{}} />);
    expect(c7.querySelector('.sup-proto-hemato'), 'hemato').not.toBeNull();
    cleanup();
    const { container: c8 } = render(<SupportProtocolDetox s={{}} />);
    expect(c8.querySelector('.sup-proto-detox'), 'detox').not.toBeNull();
  });

  it('34. Batch-10 корни: трекинг, предикт, пери, прогресс', () => {
    const { container: c1 } = render(<MMCTrackingCard />);
    expect(c1.querySelector('.train-mmctrack'), 'mmctrack').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<HysteresisChart />);
    expect(c2.querySelector('.risk-hysteresis'), 'hysteresis').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<PredictiveAnalytics />);
    expect(c3.querySelector('.risk-predictive'), 'predictive').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<PeriWorkoutCard />);
    expect(c4.querySelector('.nut-peri'), 'peri').not.toBeNull();
    cleanup();
    const { container: c5 } = render(<ProgressTracker />);
    expect(c5.querySelector('.nut-progress'), 'progress').not.toBeNull();
  });

  it('35. Batch-10 корни: visual, mmcset, manlibdrawer, mesocorr', () => {
    const { container: c1 } = render(<VisualTab sessions={[]} />);
    expect(c1.querySelector('.train-visual'), 'visual').not.toBeNull();
    cleanup();
    const { container: c2 } = render(
      <MMCSetPanel
        exerciseId="bench"
        exerciseName="Жим"
        setNumber={1}
        date="2026-01-01"
      />,
    );
    expect(c2.querySelector('.train-mmcset'), 'mmcset').not.toBeNull();
    cleanup();
    const { container: c3 } = render(
      <ManualLibraryDrawer onSelectBB={() => {}} onSelectPL={() => {}} onAddTemplate={() => {}} />,
    );
    expect(c3.querySelector('.train-manlibdrawer'), 'manlibdrawer').not.toBeNull();
    cleanup();
    const { container: c4 } = render(
      <MesoCorrectionCard
        profile={{} as never}
        acwr={1}
        monotony={1}
        avgReadiness={70}
        mesoWeeks={4}
        missedSessions={0}
        exercises={[]}
        currentVolume={10}
        currentRir={2}
      />,
    );
    expect(c4.querySelector('.train-mesocorr'), 'mesocorr').not.toBeNull();
    // ArmHeatmap/InsightsCard/PriRepPatternCard/ProgramRevisions/
    // ProgramTimeline/StrengthDiaryPanel/VolumeHub/ExerciseLabCompare
    // требуют сложные входные объекты — хуки живут в прод-ветках.
  });

  it('31. Batch-9 корни: кардио-шаги и чекин', () => {
    const { container: c1 } = render(<CardioDayCard />);
    expect(c1.querySelector('.train-cardioday'), 'cardioday').not.toBeNull();
    cleanup();
    const { container: c2 } = render(
      <CardioDiaryStep cycle={null} recoveryLow={false} onChanged={() => {}} />,
    );
    expect(c2.querySelector('.train-cardiodiarystep'), 'cardiodiarystep').not.toBeNull();
    cleanup();
    // CardioTaperStep без цикла рендерит null — хук .train-cardiotaper
    // живёт в прод-ветке с данными, здесь не проверяется.
    const { container: c4 } = render(<CheckinMetricsCard />);
    expect(c4.querySelector('.train-checkin'), 'checkin').not.toBeNull();
  });

  it('32. Batch-9 корни: делоад, методология, тулы, саппорт', () => {
    const { container: c1 } = render(
      <DeloadProtocolCard
        ctx={{
          weeksSinceDeload: 5,
          fatigue: 60,
          recovery: 50,
          hasCompetitionSoon: false,
          jointPain: false,
          cnsFatigue: false,
          goal: 'strength',
        }}
      />,
    );
    expect(c1.querySelector('.train-deloadproto'), 'deloadproto').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<MethodologyEncyclopedia />);
    expect(c2.querySelector('.train-methodology'), 'methodology').not.toBeNull();
    cleanup();
    const { container: c3 } = render(
      <PLToolsCard
        level="intermediate"
        days={3}
        totalSets={{}}
        e1RM={{ squat: 180, bench: 140, deadlift: 200 }}
      />,
    );
    expect(c3.querySelector('.pl-tools'), 'tools').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<SupportCalcToolsHub s={{}} />);
    expect(c4.querySelector('.sup-calctools'), 'calctools').not.toBeNull();
    cleanup();
    const { container: c5 } = render(<SupportGeneratorInfo s={{}} />);
    expect(c5.querySelector('.sup-geninfo'), 'geninfo').not.toBeNull();
  });

  it('33. Batch-9 корни: электролиты, взаимодействия, ББ-карточки', () => {
    const { container: c1 } = render(<SupportProtocolElectrolytes s={{}} />);
    expect(c1.querySelector('.sup-proto-electrolytes'), 'electrolytes').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<SupportProtocolInteractions s={{}} />);
    expect(c2.querySelector('.sup-proto-interactions'), 'interactions').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<BBFeedbackCard />);
    expect(c3.querySelector('.train-bbfeedback'), 'bbfeedback').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<BbToolsCard />);
    expect(c4.querySelector('.train-bbtools'), 'bbtools').not.toBeNull();
    // CardioCompsStep/ExerciseLabSubstitute/MesoHeatmap/DayCard требуют
    // сложные входные объекты — хуки живут в прод-ветках.
  });

  it('29. Batch-8 корни: библиотека, лаборатория, модалки', () => {
    const { container: c1 } = render(
      <BbProgramLibraryPicker value={null} label="Программа" programs={[]} onSelect={() => {}} />,
    );
    expect(c1.querySelector('.train-bblib'), 'bblib').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<ExerciseLabPro />);
    expect(c2.querySelector('.train-exlabpro'), 'exlabpro').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<ExerciseLabProSubstitute />);
    expect(c3.querySelector('.train-exlabsub'), 'exlabsub').not.toBeNull();
    cleanup();
    const { container: c4 } = render(
      <ManualLibraryGallery bbPrograms={[]} plCycles={[]} onSelectBB={() => {}} onSelectPL={() => {}} />,
    );
    expect(c4.querySelector('.train-manlib'), 'manlib').not.toBeNull();
    cleanup();
    const { container: c5 } = render(
      <SubstitutionPopup exerciseName="Жим" group="chest" onSelect={() => {}} onClose={() => {}} />,
    );
    expect(
      c5.querySelector('.train-subspopup') ?? c5.querySelector('.train-subspopup-main'),
      'subspopup',
    ).not.toBeNull();
  });

  it('30. Batch-8 корни: протоколы, третья волна', () => {
    const { container: c1 } = render(<SupportProtocolCost s={{}} />);
    expect(c1.querySelector('.sup-proto-cost'), 'cost').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<SupportProtocolEmergency s={{}} />);
    expect(c2.querySelector('.sup-proto-emergency'), 'emergency').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<SupportProtocolGI s={{}} />);
    expect(c3.querySelector('.sup-proto-gi'), 'gi').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<SupportProtocolGLP1 s={{}} />);
    expect(c4.querySelector('.sup-proto-glp1'), 'glp1').not.toBeNull();
    cleanup();
    const { container: c5 } = render(<SupportProtocolHair s={{}} />);
    expect(c5.querySelector('.sup-proto-hair'), 'hair').not.toBeNull();
    cleanup();
    const { container: c6 } = render(<SupportProtocolInjections s={{}} />);
    expect(c6.querySelector('.sup-proto-inj'), 'inj').not.toBeNull();
    cleanup();
    const { container: c7 } = render(<SupportProtocolWomen s={{}} />);
    expect(c7.querySelector('.sup-proto-women'), 'women').not.toBeNull();
    // BBRecommendationsTab/RirWaveChart требуют hub/program —
    // хуки живут в прод-ветках, здесь не проверяются.
  });

  it('36. Batch-11 корни: планировщики и оверлей', () => {
    const { container: c1 } = render(<ArmTechniqueCard />);
    expect(c1.querySelector('.train-armtech'), 'armtech').not.toBeNull();
    cleanup();
    const { container: c2 } = render(
      <MicrocyclePlannerCard plan={{ phases: [] } as never} />,
    );
    expect(c2.querySelector('.train-microcyc'), 'microcyc').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<QualityDiagnosticsHub program={null as never} />);
    expect(c3.querySelector('.train-qualityhub'), 'qualityhub').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<TrainingSafetyHub />);
    expect(c4.querySelector('.train-safetyhub'), 'safetyhub').not.toBeNull();
    cleanup();
    const { unmount: unmountOverlay } = render(
      <EditorOverlay onClose={() => {}}>
        <div>тело</div>
      </EditorOverlay>,
    );
    // Portal уходит в document.body, а не в container
    expect(document.body.querySelector('.train-editoroverlay'), 'editoroverlay').not.toBeNull();
    unmountOverlay();
  });

  it('37. Batch-11 корни: вкладки профиля и протоколы', () => {
    const { container: c1 } = render(<ProfileDiariesTab />);
    expect(c1.querySelector('.profile-diaries'), 'diaries').not.toBeNull();
    cleanup();
    const { container: c2 } = render(<ProfileSettingsTab />);
    expect(c2.querySelector('.profile-settings'), 'settings').not.toBeNull();
    cleanup();
    const { container: c3 } = render(<SupportProtocolPeptide s={{}} />);
    expect(c3.querySelector('.sup-proto-peptide'), 'peptide').not.toBeNull();
    cleanup();
    const { container: c4 } = render(<SupportProtocolRAAS s={{}} />);
    expect(c4.querySelector('.sup-proto-raas'), 'raas').not.toBeNull();
    cleanup();
    const { container: c5 } = render(<Achievements />);
    expect(c5.querySelector('.nut-achieve'), 'achieve').not.toBeNull();
    cleanup();
    const { container: c6 } = render(<DailyQuests />);
    expect(c6.querySelector('.nut-quests'), 'quests').not.toBeNull();
    // PlanFeedbackCard требует plan/feedback — хук живёт в прод-ветке.
  });
});
