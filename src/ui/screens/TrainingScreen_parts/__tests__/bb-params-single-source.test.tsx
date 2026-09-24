/**
 * Аудит «дубли шаг 1-2» (docs/BB-AUTO-STEPS-DEDUP-PLAN.md): каждая настройка
 * рендерится РОВНО ОДИН РАЗ — независимо от режима источника. Раньше общий хвост
 * шага 1 дублировал 7 контролов в режиме «Программы + Адаптировать», а
 * интенсив-техника дублировалась ещё и в генерике двумя разными селектами.
 *
 * Тест рендерит шаги напрямую (BbParamsStep/BbPedWorkMaxStep) — это позволяет
 * проверить ОБА режима, а не только дефолтный generic (как в bb-auto-smoke).
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbParamsStep, type BbParamsStepProps } from '../bb-step-params';
import { BbPedWorkMaxStep, type BbPedWorkMaxStepProps } from '../bb-step-ped';
import { getBBSuggestions } from '../bb-compat';
import { adaptForPEDs } from '../../../../engines/bb/bb-ped-adaptation.engine';

const noop = () => { /* noop */ };
const setStub = (v: any) => v;

const baseParams = (over: Partial<BbParamsStepProps>): BbParamsStepProps => ({
  planMode: 'generic_split', setPlanMode: noop as any,
  specializationSelection: null,
  mevCal: null, setMevCal: noop as any,
  mevDraft: { pump: 4, soreness: 2, performance: 4 }, setMevDraft: noop as any,
  startMEVCalibration: noop, commitMEVWeek: noop, resetMEVCalibration: noop,
  bbSource: 'cycle', setBbSource: noop as any,
  selectedCycleId: '', setSelectedCycleId: noop as any, bbCyclesList: [],
  setBbDays: noop as any, setBbWeeks: noop as any,
  selectedProgramId: null, bbLibraryPrograms: [], applyProgramToBb: noop as any,
  bbAdaptMode: 'adapt', setBbAdaptMode: noop as any,
  bbLevel: 'intermediate', setBbLevel: noop as any,
  bbGoal: 'mass', setBbGoal: noop as any,
  bbTrainingYears: 3, setBbTrainingYears: noop as any,
  bbDays: 4, bbWeeks: 8,
  bbSuggest: getBBSuggestions('mass', 'intermediate'),
  bbTrainingFocus: 'hypertrophy', setBbTrainingFocus: noop as any,
  bbMethodology: 'compound_first', setBbMethodology: noop as any,
  intensityTech: 'none', setIntensityTech: noop as any,
  dupMode: 'none', setDupMode: noop as any, dupRecommendChip: null, dupMuscles: [], setDupMuscles: noop as any,
  supersetMode: 'none', setSupersetMode: noop as any,
  volumeScheme: 'standard', setVolumeScheme: noop as any,
  pedDoses: {}, peds: [],
  loadStrategy: 'double_progression', setLoadStrategy: noop as any, onUserLoadStrategy: setStub,
  deloadType: 'pump', setDeloadType: noop as any, onUserDeloadType: setStub, onUserIntensityTech: setStub,
  eccentricMult: 1, setEccentricMult: noop as any,
  calorieSurplus: 0, setCalorieSurplus: noop as any,
  rotationMode: 'variety', setRotationMode: noop as any,
  intensityLevel: 'moderate', setIntensityLevel: noop as any,
  bbVolGoal: 'mav', setBbVolGoal: noop as any, onUserVolGoal: setStub,
  trainingVolumeMode: 'standard', setTrainingVolumeMode: noop as any,
  avoidAxialLoadUi: false, setAvoidAxialLoadUi: noop as any,
  fewerCompound: false, setFewerCompound: noop as any,
  allowStrengthLifts: false, setAllowStrengthLifts: noop as any,
  abRotation: false, setAbRotation: noop as any,
  packingV2: false, setPackingV2: noop as any,
  autoRegOn: false, setAutoRegOn: noop as any,
  labAdjust: { mrvMultiplier: 1, warnings: [], intensityNote: undefined } as any,
  labMultOverride: null, setLabMultOverride: noop as any,
  recoveryOverride: null, setRecoveryOverride: noop as any,
  bbFavEx: [], setBbFavEx: noop as any, bbExclEx: [], setBbExclEx: noop as any,
  syncProf: noop as any,
  bbEquipment: [], setBbEquipment: noop as any,
  platePreset: 'standard', setPlatePreset: noop as any,
  isFemaleProfile: false, cycleDay: undefined, setCycleDay: noop as any,
  targetBodyFat: undefined, setTargetBodyFat: noop as any,
  wearableData: null, setWearableTick: noop as any,
  injuries: [], setInjuries: noop as any,
  rehabMuscles: [], setRehabMuscles: noop as any,
  mobilityRestrictions: [], setMobilityRestrictions: noop as any,
  autoDeload: false, setAutoDeload: noop as any,
  savedPlans: [], usePreviousPlan: false, setUsePreviousPlan: noop as any,
  flash: noop, setStep: noop as any,
  ...over,
});

const count = (html: string, needle: string): number => {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (html.match(new RegExp(escaped, 'g')) || []).length;
};

describe('Шаг 1: один контрол на настройку (нет дублей)', () => {
  const generic = renderToStaticMarkup(React.createElement(BbParamsStep, baseParams({ planMode: 'generic_split' })));
  const programs = renderToStaticMarkup(React.createElement(BbParamsStep, baseParams({
    planMode: 'programs', bbAdaptMode: 'adapt', autoDeload: true,
    cycleDay: 14, targetBodyFat: 12, isFemaleProfile: true, bbGoal: 'cut',
  })));

  it('generic: ключевые секции и контролы ровно по одному разу', () => {
    expect(count(generic, 'Объём тренировки')).toBe(1);
    expect(count(generic, 'Объёмный тренинг')).toBe(1);
    expect(count(generic, 'Интенсив-техника')).toBe(1);
    expect(count(generic, 'Стратегия прогрессии')).toBe(1);
    expect(count(generic, 'Оборудование и загрузка')).toBe(1);
    expect(count(generic, 'Травмы / ограничения')).toBe(1);
    expect(count(generic, 'Ограничения мобильности')).toBe(1);
    expect(count(generic, 'A/B ротация паттернов')).toBe(1);
    expect(count(generic, 'Packing заливка')).toBe(1);
    expect(count(generic, 'Волновая периодизация (DUP)')).toBe(1);
    expect(count(generic, 'Суперсеты')).toBe(1);
    expect(count(generic, 'Схема объёма памп-дней')).toBe(1);
    expect(count(generic, 'Авто-разгрузка при ACWR')).toBe(1);
    // «Цель объёма» — ровно 2 контроля быть НЕ должно (был дубль в атлете и объёме):
    // после дедупа в секции «Атлет» и в секции «Объём» — по одному, тег отличает.
    expect(count(generic, '🎯 Цель объёма')).toBe(1);
  });

  it('programs+adapt: раньше было по 2 контрола на настройку — теперь по одному', () => {
    for (const label of ['Интенсив-техника', 'Стратегия прогрессии', 'Тип разгрузки', 'Оборудование и загрузка', 'Травмы / ограничения', 'Ограничения мобильности', 'Авто-разгрузка при ACWR']) {
      expect(count(programs, label), `дубль: ${label}`).toBe(1);
    }
  });

  it('мягкие настройки работают в обоих режимах; packing в источнике заблокирован', () => {
    // generic с женским профилем и целью cut — карточки видны и применимы
    const gFemale = renderToStaticMarkup(React.createElement(BbParamsStep, baseParams({ planMode: 'generic_split', isFemaleProfile: true, bbGoal: 'cut' })));
    expect(count(gFemale, '🌸 Женский цикл')).toBe(1);
    expect(count(gFemale, '🎯 Целевой % жира')).toBe(1);
    // programs — те же карточки видны: применяются в adapt-конвертации источника
    expect(count(programs, '🌸 Женский цикл')).toBe(1);
    expect(count(programs, '🎯 Целевой % жира')).toBe(1);
    expect(count(programs, 'Оверрайды (ручные)')).toBe(1);
    // packing в источнике — disabled с пояснением (виден, но не действует)
    expect(programs).toContain('Только генерик-сплит — в режиме источника не действует');
    // честная пометка: в источнике остался только packing-гейт
    expect(programs).toContain('не действует только packing-заливка');
  });

  it('объёмный режим честно перечисляет эффекты и не подменяет селект схемы', () => {
    const high = renderToStaticMarkup(React.createElement(BbParamsStep, baseParams({ planMode: 'generic_split', trainingVolumeMode: 'high' })));
    expect(high).toContain('цель MRV');
    expect(high).toContain('+25/+30/+35%');
    expect(high).toContain('кап 5 сетов/упр сохраняется');
    // Цель объёма помечена перебитой (в секции атлета), селект схемы показывает реальное значение
    expect(high).toContain('Цель объёма перебита режимом «Объёмный»');
    expect(high).toContain('Стандартная (при «Объёмном» исполняется как GVT 10×10)');
  });
});

describe('Шаг 2: один контрол на настройку + честный пресет', () => {
  const pedAdapt = adaptForPEDs(['AAS', 'GH', 'insulin', 'MGF', 'IGF1'], { chest: 20, back: 22 }, { AAS: 750, GH: 4, insulin: 10, MGF: 200, IGF1: 50 }, 'heavy');
  const pedProps: BbPedWorkMaxStepProps = {
    peds: ['AAS', 'GH', 'insulin', 'MGF', 'IGF1'], setPeds: noop as any,
    pedDoses: { AAS: 750, GH: 4, insulin: 10, MGF: 200, IGF1: 50 }, setPedDoses: noop as any,
    courseIntensity: 'heavy', setCourseIntensity: noop as any,
    pedAdapt,
    level: 'advanced', goal: 'mass', trainingFocus: 'hypertrophy', weeks: 12,
    pedPhaseOverride: 'auto', setPedPhaseOverride: noop as any,
    proPreset: 'none', setProPreset: noop as any,
    dupMode: 'none', setDupMode: noop as any,
    supersetMode: 'none', setSupersetMode: noop as any,
    volumeScheme: 'standard', setVolumeScheme: noop as any,
    methodology: 'compound_first', setMethodology: noop as any,
    bfrMode: false, setBfrMode: noop as any,
    dcMode: false, setDcMode: noop as any,
    blastCruiseEnabled: false, setBlastCruiseEnabled: noop as any,
    blastWeeks: 8, setBlastWeeks: noop as any,
    cruiseWeeks: 4, setCruiseWeeks: noop as any,
    workMax: {}, setWorkMax: noop as any,
    planMode: 'generic_split', onBuild: noop, onNext: noop, onBackToParams: noop, flash: noop,
  };
  const html = renderToStaticMarkup(React.createElement(BbPedWorkMaxStep, pedProps));

  it('кнопка «Применить методику» ровно одна (был дубль из двух одинаковых блоков)', () => {
    expect(count(html, 'Применить методику')).toBe(1);
  });

  it('карточки шага 2 в едином стиле и без дублей', () => {
    expect(count(html, 'Особые режимы')).toBe(1);
    expect(count(html, 'Pro-пресет')).toBe(1);
    expect(count(html, 'Рабочие максимумы (кг)')).toBe(1);
    expect(count(html, 'Ориентиры по питанию')).toBe(1);
    // Фаза MGF/IGF1 — один селект (peds включают MGF+IGF1 с дозами)
    expect(count(html, 'Фаза MGF/IGF1')).toBe(1);
  });

  it('подпись пресета честная: что меняет настройки шага 1', () => {
    expect(html).toContain('меняет настройки шага 1');
  });

  it('рабочие максимумы подписаны честно (профиль + приоритет шага реальных весов)', () => {
    expect(html).toContain('Авто-подтягиваются из профиля');
    expect(html).toContain('Реальные веса');
  });
});
