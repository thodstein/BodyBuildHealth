import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { BbParamsStep, type BbParamsStepProps } from '../bb-step-params';
import { BbPedWorkMaxStep, type BbPedWorkMaxStepProps } from '../bb-step-ped';
import { BbSplitStep } from '../bb-step-split';
import { BbPlanStep } from '../bb-step-plan';
import { InjurySelectCard } from '../InjurySelectCard';
import { getBBSuggestions } from '../bb-compat';
import { adaptForPEDs } from '../../../../engines/bb/bb-ped-adaptation.engine';
import { buildBBPlan } from '../../../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics } from '../../../../engines/bb/bb-metrics.engine';
import { computeBulkWeekEdits, propagateEditAcrossWeeks } from '../bb-auto-constructor-shared';

const noop = () => { /* noop */ };
const setStub = (v: any) => v;

const baseParams = (over: Partial<BbParamsStepProps> = {}): BbParamsStepProps => ({
  planMode: 'generic_split',
  setPlanMode: noop as any,
  specializationSelection: null,
  mevCal: null,
  setMevCal: noop as any,
  mevDraft: { pump: 4, soreness: 2, performance: 4 },
  setMevDraft: noop as any,
  startMEVCalibration: noop,
  commitMEVWeek: noop,
  resetMEVCalibration: noop,
  bbSource: 'cycle',
  setBbSource: noop as any,
  selectedCycleId: '',
  setSelectedCycleId: noop as any,
  bbCyclesList: [],
  setBbDays: noop as any,
  setBbWeeks: noop as any,
  selectedProgramId: null,
  bbLibraryPrograms: [],
  applyProgramToBb: noop as any,
  bbAdaptMode: 'adapt',
  setBbAdaptMode: noop as any,
  bbLevel: 'intermediate',
  setBbLevel: noop as any,
  bbGoal: 'mass',
  setBbGoal: noop as any,
  bbTrainingYears: 3,
  setBbTrainingYears: noop as any,
  bbDays: 4,
  bbWeeks: 8,
  bbSuggest: getBBSuggestions('mass', 'intermediate'),
  bbTrainingFocus: 'hypertrophy',
  setBbTrainingFocus: noop as any,
  bbMethodology: 'compound_first',
  setBbMethodology: noop as any,
  intensityTech: 'none',
  setIntensityTech: noop as any,
  dupMode: 'none',
  setDupMode: noop as any,
  dupRecommendChip: null,
  dupMuscles: [],
  setDupMuscles: noop as any,
  supersetMode: 'none',
  setSupersetMode: noop as any,
  volumeScheme: 'standard',
  setVolumeScheme: noop as any,
  pedDoses: {},
  peds: [],
  loadStrategy: 'double_progression',
  setLoadStrategy: noop as any,
  onUserLoadStrategy: setStub,
  deloadType: 'pump',
  setDeloadType: noop as any,
  onUserDeloadType: setStub,
  onUserIntensityTech: setStub,
  eccentricMult: 1,
  setEccentricMult: noop as any,
  calorieSurplus: 0,
  setCalorieSurplus: noop as any,
  rotationMode: 'variety',
  setRotationMode: noop as any,
  intensityLevel: 'moderate',
  setIntensityLevel: noop as any,
  bbVolGoal: 'mav',
  setBbVolGoal: noop as any,
  onUserVolGoal: setStub,
  bbVolumeRamp: 'standard',
  setBbVolumeRamp: noop as any,
  volumeWave: false,
  setVolumeWave: noop as any,
  trainingVolumeMode: 'standard',
  setTrainingVolumeMode: noop as any,
  avoidAxialLoadUi: false,
  setAvoidAxialLoadUi: noop as any,
  fewerCompound: false,
  setFewerCompound: noop as any,
  allowStrengthLifts: false,
  setAllowStrengthLifts: noop as any,
  abRotation: false,
  setAbRotation: noop as any,
  packingV2: false,
  setPackingV2: noop as any,
  autoRegOn: true,
  setAutoRegOn: noop as any,
  labAdjust: { mrvMultiplier: 1, warnings: [] } as any,
  labMultOverride: null,
  setLabMultOverride: noop as any,
  recoveryOverride: null,
  setRecoveryOverride: noop as any,
  bbFavEx: [],
  setBbFavEx: noop as any,
  bbExclEx: [],
  setBbExclEx: noop as any,
  syncProf: noop,
  bbEquipment: [],
  setBbEquipment: noop as any,
  platePreset: 'standard',
  setPlatePreset: noop as any,
  isFemaleProfile: false,
  cycleDay: undefined,
  setCycleDay: noop as any,
  targetBodyFat: undefined,
  setTargetBodyFat: noop as any,
  wearableData: null,
  setWearableTick: noop as any,
  injuries: [],
  setInjuries: noop as any,
  rehabMuscles: [],
  setRehabMuscles: noop as any,
  mobilityRestrictions: [],
  setMobilityRestrictions: noop as any,
  autoDeload: true,
  setAutoDeload: noop as any,
  savedPlans: [],
  usePreviousPlan: false,
  setUsePreviousPlan: noop as any,
  tempoProfile: 'auto',
  setTempoProfile: noop as any,
  mesoTemplate: 'classic',
  setMesoTemplate: noop as any,
  maxSessionMinutes: 0,
  setMaxSessionMinutes: noop as any,
  flash: noop,
  setStep: noop as any,
  ...over,
});

describe('BB-Auto Roadmap UI Fixes (Phases 1–5)', () => {
  afterEach(() => {
    cleanup();
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('Step 1 BbParamsStep: defaults to basic toggle, opens MEV diary button, gym profiles, mesoTemplate and maxSessionMinutes', () => {
    const { container } = render(React.createElement(BbParamsStep, baseParams()));
    expect(container.querySelector('[data-bb="params-mode-basic"]')).toBeTruthy();
    expect(container.querySelector('[data-bb="params-mode-pro"]')).toBeTruthy();
    expect(container.querySelector('[data-bb="gym-profile-gym_full"]')).toBeTruthy();
    expect(container.textContent).toContain('Шаблон мезоцикла');
    expect(container.textContent).toContain('Лимит времени сессии');
    expect(container.textContent).toContain('Профиль темпа');

    fireEvent.click(screen.getByText(/Личный MEV \(калибровка\)/i));
    expect(container.querySelector('[data-bb="mev-diary-calibrate"]')).toBeTruthy();
  });

  it('InjurySelectCard: opens modal showing Поясница & joint syndromes', () => {
    const { container } = render(
      React.createElement(InjurySelectCard, { injuries: [{ muscle: 'lower_back', exclude: true }], onChange: noop }),
    );
    expect(container.textContent).toContain('Травмы / ограничения (мышцы и суставы)');
    fireEvent.click(screen.getByRole('button'));
    expect(document.body.textContent).toContain('Поясница');
    expect(document.body.textContent).toContain('Плечо (импинджмент)');
  });

  it('Step 2 BbPedWorkMaxStep: renders manual pedPhase selector for adults', () => {
    const props: BbPedWorkMaxStepProps = {
      peds: ['AAS'],
      setPeds: noop as any,
      pedDoses: { AAS: 500 },
      setPedDoses: noop as any,
      courseIntensity: 'moderate',
      setCourseIntensity: noop as any,
      pedAdapt: adaptForPEDs(['AAS'], { chest: 18 }, { AAS: 500 }, 'moderate'),
      level: 'enhanced',
      goal: 'mass',
      trainingFocus: 'hypertrophy',
      weeks: 8,
      pedPhaseOverride: 'auto',
      setPedPhaseOverride: noop as any,
      proPreset: 'none',
      setProPreset: noop as any,
      dupMode: 'none',
      setDupMode: noop as any,
      supersetMode: 'none',
      setSupersetMode: noop as any,
      volumeScheme: 'standard',
      setVolumeScheme: noop as any,
      methodology: 'compound_first',
      setMethodology: noop as any,
      bfrMode: false,
      setBfrMode: noop as any,
      dcMode: false,
      setDcMode: noop as any,
      blastCruiseEnabled: false,
      setBlastCruiseEnabled: noop as any,
      blastWeeks: 8,
      setBlastWeeks: noop as any,
      cruiseWeeks: 4,
      setCruiseWeeks: noop as any,
      workMax: { chest: 100 },
      setWorkMax: noop as any,
      planMode: 'generic_split',
      age: 30,
      manualPedPhase: 'cruise',
      setManualPedPhase: noop as any,
      onBuild: noop,
      onNext: noop,
      onBackToParams: noop,
      flash: noop,
    };
    const { container } = render(React.createElement(BbPedWorkMaxStep, props));
    expect(container.textContent).toContain('Фаза курса (ручной режим)');
    expect(container.textContent).toContain('Фаза фармакологии');
  });

  it('Step 3 BbSplitStep: renders and opens custom split builder card', () => {
    const { container } = render(
      React.createElement(BbSplitStep, {
        selectedSplitId: 'upper_lower_4',
        onSelectSplit: noop,
        bestSplit: undefined,
        phases: [],
        ranked: [],
        suggestSplitIds: new Set(),
        goal: 'mass',
        level: 'intermediate',
        weeks: 6,
        isBuilding: false,
        onBuild: noop,
        onBack: noop,
      }),
    );
    expect(container.textContent).toContain('Свой сплит');
    fireEvent.click(screen.getByText(/Создать свой сплит/i));
    expect(container.textContent).toContain('Сохранить и выбрать');
  });

  it('Step 4 BbPlanStep: renders travel week, mid-meso wizard, and 1-click superset buttons', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      workMax: { chest: 100, back: 100, quads: 120, hamstrings: 90 },
    });
    const metrics = calcBBPlanMetrics(plan);
    const { container } = render(
      React.createElement(BbPlanStep, {
        builtPlan: plan,
        metrics,
        bbWeekSel: 2,
        setBbWeekSel: noop as any,
        bbWeeks: 4,
        autoDeload: true,
        weakPoints: [],
        dupMode: 'none',
        autoRegOn: true,
        autoRegResult: null,
        exerciseEdits: {},
        setExerciseEdits: noop as any,
        editMode: null,
        setEditMode: noop as any,
        collapsedDays: new Set(),
        setCollapsedDays: noop as any,
        collapsedExercises: new Set(),
        setCollapsedExercises: noop as any,
        bbTrainingFocus: 'hypertrophy',
        bbLevel: 'intermediate',
        setSubTarget: noop as any,
        handleSendToExecution: noop,
        setWeightEntries: noop as any,
        setWeightsApplied: noop as any,
        setStep: noop as any,
        onApplySupersetsToSession: noop,
        onAdaptTravelWeek: noop,
        onMidMesoReplan: noop,
        actionRow: null,
      }),
    );
    expect(container.textContent).toContain('Командировка на нед. 2');
    expect(container.textContent).toContain('Травма / пропуск');
    expect(container.textContent).toContain('Уложить в время (суперсеты)');
    fireEvent.click(container.querySelector('[data-bb="mid-meso-wizard-btn"]') as Element);
    expect(container.querySelector('[data-bb="mid-meso-apply-btn"]')).toBeTruthy();
  });

  it('Phase 5 shared helpers: computeBulkWeekEdits supports restSeconds/tempo and propagateEditAcrossWeeks copies across weeks', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      workMax: { chest: 100, back: 100, quads: 120, hamstrings: 90 },
    });
    const restRes = computeBulkWeekEdits({
      sessions: plan.weeks[0].sessions,
      weekNo: 1,
      field: 'restSeconds',
      mode: 'set',
      rawValue: 75,
    });
    expect('edits' in restRes).toBe(true);
    if ('edits' in restRes) {
      expect(restRes.edits['1-0-0'].restSeconds).toBe(75);
    }

    const tempoRes = computeBulkWeekEdits({
      sessions: plan.weeks[0].sessions,
      weekNo: 1,
      field: 'tempo',
      mode: 'set',
      rawValue: '3-0-1-2',
    });
    expect('edits' in tempoRes).toBe(true);
    if ('edits' in tempoRes) {
      expect(tempoRes.edits['1-0-0'].tempo).toBe('3-0-1-2');
    }

    const firstEx = plan.weeks[0].sessions[0].exercises[0];
    const id = String(firstEx.exerciseName || firstEx.name || '');
    const prop = propagateEditAcrossWeeks({
      weeks: plan.weeks,
      sourceEdit: { sets: 4, reps: 10, weight: 80, restSeconds: 105, tempo: '4-0-1-0', exerciseKey: id },
      exerciseIdentity: id,
    });
    expect(prop.updated).toBeGreaterThanOrEqual(1);
    expect(prop.edits['1-0-0'].restSeconds).toBe(105);
    expect(prop.edits['1-0-0'].tempo).toBe('4-0-1-0');
  });
});
