/**
 * bb-step-params.tsx — шаг 1 ББ-авто («📋 Базовые параметры»), вынесен из
 * god-component `BbAutoConstructor.tsx` (§4.3, этап 3). Перенос 1-в-1:
 * логика/тексты/стили не менялись; state-ссылки/хендлеры названы теми же именами,
 * поэтому тело шага побайтово совпадает с оригиналом (кроме двух замен:
 * `renderSpecializationSelection()` → prop `specializationSelection`,
 * `linked?...sex === 'female'` → prop `isFemaleProfile`).
 */
import React from 'react';
import { PopupSelect, PopupNumber, PopupSelectSmart, PopupExerciseList } from '../SRCBBScreen_parts/TrainingPopups';
import { BbProgramLibraryPicker } from './BbProgramLibraryPicker';
import { InjurySelectCard, type InjurySelectEntry } from './InjurySelectCard';
import { BbRowSwitch, WEAK_GROUPS, type PlanMode, type Step } from './bb-auto-constructor-shared';
import { BTN, BTN_GHOST, H, IN, ACCENT } from './training-ui';
import { PLATE_SET_PRESETS } from '../../../engines/bb/bb-plates.engine';
import { DELOAD_PROTOCOLS, INTENSITY_TECHNIQUES, type LoadStrategy, type DeloadType, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import type { SessionMethodology } from '../../../engines/bb/bb-session-order.engine';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import type { PED } from '../../../engines/bb/bb-ped-adaptation.engine';
import { computeAASEquivDose } from '../../../engines/bb/bb-ped-adaptation.engine';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { useOriginalPrograms } from './useOriginalPrograms';
import { getBBSuggestions } from './bb-compat';
import { labTrainingAdjust } from './lab-training-adjust';
import { sessionLimitsFor } from '../../../engines/bb/bb-volume.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import {
  isMEVCalibrationComplete, mevCalibrationProgress, mevSignalDegradation,
  resolveMEVAfterCalibration, saveMEVCalibration, type MEVCalibration, type MEVSignal,
} from '../../../engines/bb/bb-mev-calibration.engine';
import type { TrainingProfile } from './training-profile';
import type { SavedBBPlan } from './bb-plans-store';

export interface BbParamsStepProps {
  planMode: PlanMode;
  setPlanMode: React.Dispatch<React.SetStateAction<PlanMode>>;
  specializationSelection: React.ReactNode;
  mevCal: MEVCalibration | null;
  setMevCal: React.Dispatch<React.SetStateAction<MEVCalibration | null>>;
  mevDraft: MEVSignal;
  setMevDraft: React.Dispatch<React.SetStateAction<MEVSignal>>;
  startMEVCalibration: () => void;
  commitMEVWeek: () => void;
  resetMEVCalibration: () => void;
  bbSource: 'cycle' | 'program';
  setBbSource: React.Dispatch<React.SetStateAction<'cycle' | 'program'>>;
  selectedCycleId: string;
  setSelectedCycleId: React.Dispatch<React.SetStateAction<string>>;
  bbCyclesList: SRCycleTemplate[];
  setBbDays: React.Dispatch<React.SetStateAction<number>>;
  setBbWeeks: React.Dispatch<React.SetStateAction<number>>;
  selectedProgramId: string | null;
  bbLibraryPrograms: FullProgram[];
  applyProgramToBb: (program: FullProgram) => void;
  customCycle: SRCycleTemplate | null;
  bbAdaptMode: 'faithful' | 'adapt';
  setBbAdaptMode: React.Dispatch<React.SetStateAction<'faithful' | 'adapt'>>;
  bbLevel: string;
  setBbLevel: React.Dispatch<React.SetStateAction<string>>;
  bbGoal: string;
  setBbGoal: React.Dispatch<React.SetStateAction<string>>;
  bbTrainingYears: number;
  setBbTrainingYears: React.Dispatch<React.SetStateAction<number>>;
  bbDays: number;
  bbWeeks: number;
  bbSuggest: ReturnType<typeof getBBSuggestions>;
  bbTrainingFocus: 'strength' | 'hypertrophy' | 'endurance';
  setBbTrainingFocus: React.Dispatch<React.SetStateAction<'strength' | 'hypertrophy' | 'endurance'>>;
  bbMethodology: SessionMethodology;
  setBbMethodology: React.Dispatch<React.SetStateAction<SessionMethodology>>;
  intensityTech: IntensityTechnique;
  setIntensityTech: React.Dispatch<React.SetStateAction<IntensityTechnique>>;
  dupMode: DUPMode;
  setDupMode: React.Dispatch<React.SetStateAction<DUPMode>>;
  dupRecommendChip: React.ReactNode;
  dupMuscles: string[];
  setDupMuscles: React.Dispatch<React.SetStateAction<string[]>>;
  supersetMode: 'none' | 'antagonist' | 'same_muscle' | 'giant';
  setSupersetMode: React.Dispatch<React.SetStateAction<'none' | 'antagonist' | 'same_muscle' | 'giant'>>;
  volumeScheme: 'standard' | 'gvt' | 'fst7' | 'gironda';
  setVolumeScheme: React.Dispatch<React.SetStateAction<'standard' | 'gvt' | 'fst7' | 'gironda'>>;
  pedDoses: Record<string, number>;
  peds: PED[];
  loadStrategy: LoadStrategy;
  setLoadStrategy: React.Dispatch<React.SetStateAction<LoadStrategy>>;
  onUserLoadStrategy: (v: string) => void;
  deloadType: DeloadType;
  setDeloadType: React.Dispatch<React.SetStateAction<DeloadType>>;
  onUserDeloadType: (v: string) => void;
  onUserIntensityTech: (v: string) => void;
  eccentricMult: number;
  setEccentricMult: React.Dispatch<React.SetStateAction<number>>;
  calorieSurplus: number;
  setCalorieSurplus: React.Dispatch<React.SetStateAction<number>>;
  rotationMode: 'forbid' | 'strict' | 'variety';
  setRotationMode: React.Dispatch<React.SetStateAction<'forbid' | 'strict' | 'variety'>>;
  intensityLevel: 'light' | 'moderate' | 'high';
  setIntensityLevel: React.Dispatch<React.SetStateAction<'light' | 'moderate' | 'high'>>;
  bbVolGoal: string;
  setBbVolGoal: React.Dispatch<React.SetStateAction<string>>;
  onUserVolGoal: (v: string) => void;
  trainingVolumeMode: 'standard' | 'high';
  setTrainingVolumeMode: React.Dispatch<React.SetStateAction<'standard' | 'high'>>;
  avoidAxialLoadUi: boolean;
  setAvoidAxialLoadUi: React.Dispatch<React.SetStateAction<boolean>>;
  fewerCompound: boolean;
  setFewerCompound: React.Dispatch<React.SetStateAction<boolean>>;
  allowStrengthLifts: boolean;
  setAllowStrengthLifts: React.Dispatch<React.SetStateAction<boolean>>;
  abRotation: boolean;
  setAbRotation: React.Dispatch<React.SetStateAction<boolean>>;
  packingV2: boolean;
  setPackingV2: React.Dispatch<React.SetStateAction<boolean>>;
  autoRegOn: boolean;
  setAutoRegOn: React.Dispatch<React.SetStateAction<boolean>>;
  labAdjust: ReturnType<typeof labTrainingAdjust>;
  labMultOverride: number | null;
  setLabMultOverride: React.Dispatch<React.SetStateAction<number | null>>;
  recoveryOverride: number | null;
  setRecoveryOverride: React.Dispatch<React.SetStateAction<number | null>>;
  bbFavEx: string[];
  setBbFavEx: React.Dispatch<React.SetStateAction<string[]>>;
  bbExclEx: string[];
  setBbExclEx: React.Dispatch<React.SetStateAction<string[]>>;
  syncProf: (patch: Partial<TrainingProfile>) => void;
  bbEquipment: string[];
  setBbEquipment: React.Dispatch<React.SetStateAction<string[]>>;
  platePreset: string;
  setPlatePreset: React.Dispatch<React.SetStateAction<string>>;
  isFemaleProfile: boolean;
  cycleDay: number | undefined;
  setCycleDay: React.Dispatch<React.SetStateAction<number | undefined>>;
  targetBodyFat: number | undefined;
  setTargetBodyFat: React.Dispatch<React.SetStateAction<number | undefined>>;
  wearableData: any;
  setWearableTick: React.Dispatch<React.SetStateAction<number>>;
  injuries: InjurySelectEntry[];
  setInjuries: React.Dispatch<React.SetStateAction<InjurySelectEntry[]>>;
  rehabMuscles: string[];
  setRehabMuscles: React.Dispatch<React.SetStateAction<string[]>>;
  mobilityRestrictions: string[];
  setMobilityRestrictions: React.Dispatch<React.SetStateAction<string[]>>;
  autoDeload: boolean;
  setAutoDeload: React.Dispatch<React.SetStateAction<boolean>>;
  savedPlans: SavedBBPlan[];
  usePreviousPlan: boolean;
  setUsePreviousPlan: React.Dispatch<React.SetStateAction<boolean>>;
  flash: (m: string) => void;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
}

export const BbParamsStep: React.FC<BbParamsStepProps> = ({
  planMode, setPlanMode, specializationSelection,
  mevCal, setMevCal, mevDraft, setMevDraft, startMEVCalibration, commitMEVWeek, resetMEVCalibration,
  bbSource, setBbSource, selectedCycleId, setSelectedCycleId, bbCyclesList, setBbDays, setBbWeeks,
  selectedProgramId, bbLibraryPrograms, applyProgramToBb, customCycle,
  bbAdaptMode, setBbAdaptMode, bbLevel, setBbLevel, bbGoal, setBbGoal, bbTrainingYears, setBbTrainingYears,
  bbDays, bbWeeks, bbSuggest, bbTrainingFocus, setBbTrainingFocus, bbMethodology, setBbMethodology,
  intensityTech, setIntensityTech, dupMode, setDupMode, dupRecommendChip, dupMuscles, setDupMuscles,
  supersetMode, setSupersetMode, volumeScheme, setVolumeScheme, pedDoses, peds,
  loadStrategy, setLoadStrategy, onUserLoadStrategy, deloadType, setDeloadType, onUserDeloadType, onUserIntensityTech,
  eccentricMult, setEccentricMult, calorieSurplus, setCalorieSurplus,
  rotationMode, setRotationMode, intensityLevel, setIntensityLevel, bbVolGoal, setBbVolGoal, onUserVolGoal,
  trainingVolumeMode, setTrainingVolumeMode,
  avoidAxialLoadUi, setAvoidAxialLoadUi, fewerCompound, setFewerCompound,
  allowStrengthLifts, setAllowStrengthLifts, abRotation, setAbRotation, packingV2, setPackingV2, autoRegOn, setAutoRegOn,
  labAdjust, labMultOverride, setLabMultOverride, recoveryOverride, setRecoveryOverride,
  bbFavEx, setBbFavEx, bbExclEx, setBbExclEx, syncProf,
  bbEquipment, setBbEquipment, platePreset, setPlatePreset, isFemaleProfile,
  cycleDay, setCycleDay, targetBodyFat, setTargetBodyFat,
  wearableData, setWearableTick, injuries, setInjuries, rehabMuscles, setRehabMuscles,
  mobilityRestrictions, setMobilityRestrictions, autoDeload, setAutoDeload,
  savedPlans, usePreviousPlan, setUsePreviousPlan, flash, setStep,
}) => (
  <div>
    <div style={H}>📋 Шаг 1: Базовые параметры</div>

    {/* Plan mode: generic vs programs */}
    <div style={{ marginBottom:10, padding:'8px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📌 Источник программы</div>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={() => setPlanMode('generic_split')} style={{
          flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:11,
          border: planMode === 'generic_split' ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
          background: planMode === 'generic_split' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.02)',
          color: planMode === 'generic_split' ? '#a855f7' : '#fff',
        }}>🧩 Генерик-сплит (авто-генерация)</button>
        <button onClick={() => setPlanMode('programs')} style={{
          flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:11,
          border: planMode === 'programs' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
          background: planMode === 'programs' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
          color: planMode === 'programs' ? '#00e68a' : '#fff',
        }}>📚 Программы (точно / адаптация)</button>
      </div>
     </div>

    {specializationSelection}

    {/* Epic A: калибровка личного MEV */}
    <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, fontWeight:800, color:'#60a5fa' }}>🧪 Личный MEV (калибровка)</span>
        {mevCal && (
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'rgba(96,165,250,0.15)', color:'#93c5fd', border:'1px solid rgba(96,165,250,0.3)' }}>
            {isMEVCalibrationComplete(mevCal) ? '✅ калиброван' : `📈 нед ${mevCalibrationProgress(mevCal).weeksDone}`}
          </span>
        )}
      </div>
      <div style={{ fontSize:9, opacity:0.8, marginBottom:8 }}>
        Протокол RP: старт с MEV−2, +1 сет/нед, пока крепатура ≤2 и производительность не падает; 2 подряд недели деградации → фикс личного MEV. Применяется вместо таблицы (внутри капов).
      </div>
      {!mevCal ? (
        <button style={{ ...BTN, width:'100%' }} onClick={startMEVCalibration}>🧪 Запустить калибровку MEV</button>
      ) : (
        <>
          {isMEVCalibrationComplete(mevCal) && mevCal.userMevByMuscle && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
              {Object.entries(mevCal.userMevByMuscle).map(([m, v]) => (
                <span key={m} style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:999, background:'rgba(96,165,250,0.12)', color:'#bfdbfe', border:'1px solid rgba(96,165,250,0.25)' }}>{MUSCLE_LABEL_RU[m] || m}: {v}</span>
              ))}
            </div>
          )}
          {!isMEVCalibrationComplete(mevCal) && (
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#93c5fd', marginBottom:4 }}>Сигнал этой недели (после недели №{mevCal.weeks.length + 1}):</div>
              {([['pump', 'Накачка 0-5'], ['soreness', 'Крепатура 0-5'], ['performance', 'Производительность 0-5']] as const).map(([k, label]) => (
                <div key={k} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:9, width:120, opacity:0.85 }}>{label}</span>
                  <input type="range" min={0} max={5} step={1} value={mevDraft[k]} onChange={e => setMevDraft({ ...mevDraft, [k]: Number(e.target.value) })} style={{ flex:1, accentColor:'#60a5fa' }} />
                  <span style={{ fontSize:9, fontWeight:800, width:16 }}>{mevDraft[k]}</span>
                </div>
              ))}
              {mevSignalDegradation(mevDraft) && <div style={{ fontSize:9, color:'#fbbf24', marginBottom:4 }}>⚠ Сигнал деградации — MEV зафиксируется на прошлой неделе (если это 2-я подряд).</div>}
              <button style={{ ...BTN, width:'100%' }} onClick={commitMEVWeek}>📈 Записать неделю</button>
            </div>
          )}
          <div style={{ display:'flex', gap:6, marginTop:4 }}>
            {!isMEVCalibrationComplete(mevCal) && <button style={{ ...BTN_GHOST, flex:1, fontSize:9 }} onClick={() => { const r = resolveMEVAfterCalibration(mevCal); saveMEVCalibration(r); setMevCal(r); flash('🧪 MEV зафиксирован вручную'); }}>✅ Завершить сейчас</button>}
            <button style={{ ...BTN_GHOST, flex:1, fontSize:9 }} onClick={resetMEVCalibration}>🗑 Сбросить</button>
          </div>
        </>
      )}
    </div>

    {planMode === 'programs' && (
      <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
        {/* Под-источник: ПРОФ-цикл / Библиотека программ */}
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button onClick={() => setBbSource('cycle')} style={{
            flex:1, padding:'7px 8px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:11,
            border: bbSource === 'cycle' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
            background: bbSource === 'cycle' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
            color: bbSource === 'cycle' ? '#00e68a' : '#fff',
          }}>📋 ПРОФ-цикл</button>
          <button onClick={() => setBbSource('program')} style={{
            flex:1, padding:'7px 8px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:11,
            border: bbSource === 'program' ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
            background: bbSource === 'program' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)',
            color: bbSource === 'program' ? '#60a5fa' : '#fff',
          }}>📚 Из библиотеки</button>
        </div>

        {bbSource === 'cycle' && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:'#00e68a', marginBottom:6 }}>📚 Выберите BB-цикл</div>
            <PopupSelect label="BB-цикл" value={selectedCycleId} onChange={v => { setSelectedCycleId(v); const c = getCycleById(v); if (c) { setBbDays(c.meta.sessionsPerWeek); setBbWeeks(c.meta.weeks); } }} options={[
              ...bbCyclesList.map(c => ({
                id: c.meta.id,
                label: `${c.meta.title} (${c.meta.weeks} нед, ${c.meta.sessionsPerWeek}×/нед)`,
                description: c.meta.description?.slice(0, 120),
              })),
            ]} />
            {selectedCycleId && (() => {
              const c = getCycleById(selectedCycleId);
              if (!c) return null;
              return (
                <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight: 1.5 }}>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Уровень:</span> {c.meta.level}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Фокус:</span> {c.meta.targetFocus || '—'}</div>
                  {c.meta.deloadWeeks && c.meta.deloadWeeks.length > 0 && <div><span style={{ fontWeight:700, color:'#fff' }}>Разгрузка:</span> нед {c.meta.deloadWeeks.join(', ')}</div>}
                  {c.meta.rirProgression && <div><span style={{ fontWeight:700, color:'#fff' }}>RIR:</span> {c.meta.rirProgression.start}→{c.meta.rirProgression.end}</div>}
                  {c.meta.phases && c.meta.phases.length > 0 && <div><span style={{ fontWeight:700, color:'#fff' }}>Фазы:</span> {c.meta.phases.map(ph => ph.title || `нед ${ph.weekStart}-${ph.weekEnd}`).join(', ')}</div>}
                  <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(0,230,138,0.06)', fontSize:11, color:'#fff' }}>{c.meta.description?.slice(0, 200)}</div>
                </div>
              );
            })()}
          </>
        )}

        {(bbSource === 'program' || bbSource === 'cycle') && (
          <>
            {bbSource === 'program' && (<>
            <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📚 Готовая программа из библиотеки</div>
            <BbProgramLibraryPicker
              label='Программа'
              value={selectedProgramId}
              programs={bbLibraryPrograms}
              onSelect={applyProgramToBb}
            />
            {bbSource === 'program' && customCycle && (
              <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight: 1.5 }}>
                <div><span style={{ fontWeight:700, color:'#fff' }}>Программа:</span> {customCycle.meta.title}</div>
                <div><span style={{ fontWeight:700, color:'#fff' }}>Уровень:</span> {customCycle.meta.level}</div>
                <div><span style={{ fontWeight:700, color:'#fff' }}>Дней/нед:</span> {customCycle.meta.sessionsPerWeek}</div>
                <div><span style={{ fontWeight:700, color:'#fff' }}>Недель:</span> {customCycle.meta.weeks}</div>
                <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(96,165,250,0.06)', fontSize:11, color:'#fff' }}>{customCycle.meta.description?.slice(0, 200)}</div>
              </div>
            )}
            {bbSource === 'program' && selectedProgramId && !customCycle && (() => {
              const p = bbLibraryPrograms.find(pr => pr.id === selectedProgramId);
              if (!p) return null;
              return (
                <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight: 1.5 }}>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Программа:</span> {p.name}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Автор:</span> {p.author}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Уровень:</span> {p.level}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Дней/нед:</span> {p.daysPerWeek}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Недель:</span> {p.durationWeeks}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Цель:</span> {p.goal}{p.direction && p.direction !== p.goal ? ` (${p.direction})` : ''}</div>
                  {p.targetAudience && <div style={{ marginTop:3, fontSize: 10, color: '#fff' }}><b>Кому:</b> {p.targetAudience.slice(0, 160)}{p.targetAudience.length > 160 ? '…' : ''}</div>}
                  {p.warnings && p.warnings.length > 0 && (
                    <div style={{ marginTop:3, padding:'4px 8px', borderRadius:8, background:'rgba(245,158,11,0.08)', fontSize:10, color:'#fbbf24', lineHeight:1.4 }}>
                      ⚠️ {p.warnings.slice(0, 2).join(' · ')}{p.warnings.length > 2 ? '…' : ''}
                    </div>
                  )}
                  <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(96,165,250,0.06)', fontSize:11, color:'#fff' }}>{p.description?.slice(0, 240)}</div>
                </div>
              );
            })()}
            </>)}

            {/* 🔧 Дополнительная настройка выбранного источника (программа/цикл) */}
            {((bbSource === 'program' && selectedProgramId) || (bbSource === 'cycle' && selectedCycleId)) && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 8, display:'flex', alignItems:'center', gap:6 }}>
                  🔧 Дополнительная настройка {bbSource === 'cycle' ? 'цикла' : 'программы'}
                </div>
                <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, marginBottom: 10 }}>
                  Переопределяет параметры выбранного источника под ваш профиль — слабые группы, интенсивность и стратегию прогрессии.
                  Если не менять — берутся разумные дефолты.
                </div>
                {/* 0c-3 (аудит 2026-09): честная пометка build-only опций — они живут
                    только в generic-пути и здесь не влияют (не тихий no-op). */}
                <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, marginBottom: 10, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  ⚠ В режиме источника не действуют (только «Генерик-сплит»): женский цикл, целевой % жира, packing-заливка.
                </div>

                {/* Режим адаптации (faithful vs adapt) */}
                {(planMode === 'programs') && (
                  <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>🔒 Режим конвертации программы</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setBbAdaptMode('faithful')} style={{
                        flex: 1, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 10,
                        border: bbAdaptMode === 'faithful' ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
                        background: bbAdaptMode === 'faithful' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)',
                        color: bbAdaptMode === 'faithful' ? '#60a5fa' : '#fff',
                      }}>🎯 Точно по программе</button>
                      <button onClick={() => setBbAdaptMode('adapt')} style={{
                        flex: 1, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 10,
                        border: bbAdaptMode === 'adapt' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
                        background: bbAdaptMode === 'adapt' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
                        color: bbAdaptMode === 'adapt' ? '#00e68a' : '#fff',
                      }}>🔧 Адаптировать</button>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#fff', lineHeight: 1.4 }}>
                      {bbAdaptMode === 'faithful'
                        ? 'Все недели, RIR/множители/фазы/warmup/rest/reps/notes берутся дословно из программы. Применяются только safety-фильтры (травмы/исключённые упражнения/оборудование).'
                        : 'Структура программы сохраняется, но добавляется добивка слабых групп (+isolation), интенсив-техники, авто-делод и стратегия прогрессии.'}
                    </div>
                  </div>
                )}
                {/* 🔧 Полная настройка как в генерик-сплите — видна только в adapt режиме */}
                {bbAdaptMode === 'adapt' && (
                <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <PopupSelect label="🎯 Фокус тренировки" value={bbTrainingFocus} onChange={v => setBbTrainingFocus(v as 'strength' | 'hypertrophy' | 'endurance')} options={[
                    { id:'strength', label:'Сила: RIR 1-2', desc:'Тяжёлые веса, RIR 1-2 — максимальный натяг.' },
                    { id:'hypertrophy', label:'Гипертрофия: RIR 2-3', desc:'Умеренные веса 8-12 повт, темп 3-1-1-0.' },
                    { id:'endurance', label:'Выносливость: RIR 3-4', desc:'Лёгкие веса 15-20 повт, короткая пауза.' },
                  ]} />
                  <PopupSelect label="🧩 Методика порядка" value={bbMethodology} onChange={v => setBbMethodology(v as SessionMethodology)} hint="Порядок упражнений в дне — в коде: compound_first / pre_exhaust / post_exhaust / mountain_dog / fst7 / hyperemia" options={[
                    { id:'compound_first', label:'Базовые → изоляция', desc:'Сначала тяжёлые многосуставные.' },
                    { id:'pre_exhaust', label:'Pre-exhaust', desc:'Изоляция первой, затем база.' },
                    { id:'post_exhaust', label:'Post-exhaust', desc:'База в полную силу, затем изоляция.' },
                    { id:'mountain_dog', label:'Mountain Dog (Meadows)', desc:'Активация RIR≥3 → тяжёлая база → памп → стретч последним.' },
                    { id:'fst7', label:'FST-7 порядок (Rambod)', desc:'Памп-праймер первым, финишер и стретч в конце.' },
                    { id:'hyperemia', label:'Hyperemia (Sarcev)', desc:'У аксессуаров памп раньше тяжестей — кровь первее веса.' },
                  ]} />
                  <PopupSelect
                    label='🔥 Интенсив-техника'
                    value={intensityTech}
                    onChange={v => setIntensityTech(v as IntensityTechnique)}
                    hint='В коде: none / rest_pause / drop_set / myo_reps / pause_rep / mechanical_drop / negative'
                    options={[
                      { id: 'none', label: 'Авто по фазе', desc:'Accumulation → пауза-репс, intensification → rest-pause/dropset.' },
                      { id: 'rest_pause', label: 'Рест-пауза', desc:'Финал 8 + 15с → 3-4 + 15с → 3-4.' },
                      { id: 'drop_set', label: 'Дроп-сет', desc:'−20% веса → 6 повт, ещё −20% → 4 повт.' },
                      { id: 'myo_reps', label: 'Myo-reps', desc:'12-15 + 4×4 с 5с паузой.' },
                      { id: 'pause_rep', label: 'Пауза-репс', desc:'Пауза 2-3с внизу.' },
                      { id: 'mechanical_drop', label: 'Мех. дроп-сет', desc:'Смена угла/хвата без отдыха.' },
                      { id: 'negative', label: 'Негативы (3-4с)', desc:'Медленный негатив 3-4с.' },
                      { id: 'twenty_ones', label: '21s (7-7-7)', desc:'7 снизу +7 сверху +7 полных — бицепс.' },
                    ]}
                  />
                  <PopupSelect
                    label='🌊 Волновая периодизация (DUP)'
                    value={dupMode}
                    onChange={v => setDupMode(v as DUPMode)}
                    hint='В коде: none / heavy_light / strength_hypertrophy / full_dup'
                    options={[
                      { id: 'none', label: 'Выкл (стандарт)', desc:'Блочная: накопление → интенс. → разгрузка.' },
                      { id: 'heavy_light', label: 'Тяж/лёг (2 дня)', desc:'Тяж сила + лёгк объём.' },
                      { id: 'strength_hypertrophy', label: 'Сила/гипертрофия (2 дня)', desc:'4-6 RIR1 + 10-15 RIR3.' },
                      { id: 'full_dup', label: 'Полный DUP (3 дня)', desc:'Сила/гипер/выносл.' },
                    ]}
                  />
                  {dupRecommendChip}
                  {dupMode !== 'none' && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#22d3ee', marginBottom:4 }}>🎯 Per-muscle DUP (пусто = ко всем primary):</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {WEAK_GROUPS.map(([id, l]) => {
                          const on = dupMuscles.includes(id);
                          return (
                            <button key={id} onClick={() => setDupMuscles(on ? dupMuscles.filter(x => x !== id) : [...dupMuscles, id])}
                              style={{ padding:'3px 7px', borderRadius:999, fontSize:9, fontWeight:700, cursor:'pointer', minHeight:26,
                                background:on?'rgba(34,211,238,0.15)':'rgba(255,255,255,0.03)',
                                border:on?'1px solid rgba(34,211,238,0.4)':'1px solid rgba(255,255,255,0.08)',
                                color:on?'#22d3ee':'#fff' }}>
                              {on ? '✓ ' : ''}{l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <PopupSelect
                    label='🔗 Суперсеты'
                    value={supersetMode}
                    onChange={v => setSupersetMode(v as 'none' | 'antagonist' | 'same_muscle' | 'giant')}
                    hint='В коде: none / antagonist / same_muscle / giant'
                    options={[
                      { id: 'none', label: 'Выкл', desc:'По очереди с отдыхом.' },
                      { id: 'antagonist', label: 'Антагонисты', desc:'Грудь↔спина, биц↔триц.' },
                      { id: 'same_muscle', label: 'Одна группа', desc:'База+изоляция без отдыха.' },
                      { id: 'giant', label: 'Гигант-сет', desc:'Три упр. одной группы.' },
                    ]}
                  />
                  <PopupSelect
                    label='📦 Схема объёма памп-дней'
                    value={volumeScheme}
                    onChange={v => setVolumeScheme(v as any)}
                    hint={'В коде: standard / gvt / fst7 / gironda' + (bbLevel !== 'enhanced' ? ' · FST-7 7-in-1: только enhanced.' : '') + (((pedDoses.insulin || 0) > 0 && !((computeAASEquivDose(pedDoses)) > 0) && !((pedDoses.GH || 0) > 0)) ? ' · Соло-инсулин: FST-7 запрещён.' : '') + (((pedDoses.GH || 0) >= 4) ? ' · GH≥4: joint-guard, FST-7 недоступен.' : '')}
                    options={[
                      { id: 'standard', label: 'Стандартная', desc:'Авто: тяж база, памп изоляция.' },
                      { id: 'gvt', label: 'GVT 10×10', desc:'10×10, 60%, 60-90с.' },
                      ...((bbLevel === 'enhanced' && !((pedDoses.GH || 0) >= 4) && !((pedDoses.insulin || 0) > 0 && !((computeAASEquivDose(pedDoses)) > 0) && !((pedDoses.GH || 0) > 0))) ? [{ id: 'fst7', label: 'FST-7 (7×8-12 одним финишером)', desc:'Rambod: 7 сетов одной изоляцией в конце мышцы, 30-45с. Только enhanced без joint-guard.' } as any] : []),
                      { id: 'gironda', label: '8×8 Gironda', desc:'8×8, 45-60с.' },
                    ]}
                  />
                  <PopupSelect
                    label='📈 Стратегия прогрессии'
                    value={loadStrategy}
                    onChange={v => setLoadStrategy(v as LoadStrategy)}
                    options={[
                      { id: 'double_progression', label: 'Двойная прогрессия', desc:'Сначала добить повторы, затем +вес.' },
                      { id: 'linear', label: 'Линейная', desc:'+2.5 кг/нед компаунд, +1 кг изоляция.' },
                      { id: 'wave', label: 'Волновая', desc:'3-нед волны тяж/сред/лёг.' },
                      { id: 'rpe_based', label: 'RPE-based', desc:'Вес по ощущению RPE.' },
                    ]}
                  />
                  <PopupSelect
                    label='📉 Тип разгрузки'
                    value={deloadType}
                    onChange={v => setDeloadType(v as DeloadType)}
                    hint='В коде: pump / neural / full_rest'
                    options={[
                      { id: 'pump', label: 'Памп-делод 50%', desc:'Лёгкие веса 15-20 повт.' },
                      { id: 'neural', label: 'Нейр-делод', desc:'Мало сетов, тяж вес.' },
                      { id: 'full_rest', label: 'Полный отдых', desc:'20% объёма, 40% веса.' },
                    ]}
                  />
                  <PopupSelect label="⬇️ Эксцентрик" value={String(eccentricMult)} onChange={v => setEccentricMult(parseFloat(v))} hint="В коде eccentricMult: 1.0 / 1.1 / 1.2 (Schoenfeld 2021)." options={[
                    { id:'1.0', label:'1.0 — Норма', desc:'Стандартный темп.' },
                    { id:'1.1', label:'1.1 — +10%', desc:'Медленнее опускание.' },
                    { id:'1.2', label:'1.2 — +20%', desc:'Выраженный негатив.' },
                  ]} />
                  <PopupNumber label="🍽️ Профицит (ккал/день)" value={calorieSurplus} onChange={v => setCalorieSurplus(Math.round(v))} step={50} min={-500} max={1000} />
                  <PopupSelect label="🔄 Вариативность" value={rotationMode} onChange={v => setRotationMode(v as any)} hint="В коде rotationMode: forbid / strict / variety" options={[
                    { id:'forbid', label:'🚫 Запрет — одни и те же', desc:'Строго одни упражнения.' },
                    { id:'strict', label:'📅 Строгий — раз в 4 недели', desc:'Смена на границе фаз.' },
                    { id:'variety', label:'🎨 Разнообразие — при 2×/мышцу', desc:'Чередование углов.' },
                  ]} />
                  <PopupSelect label="🔥 Интенсивность" value={intensityLevel} onChange={v => setIntensityLevel(v as any)} hint="В коде intensityLevel: light / moderate / high" options={[
                    { id:'light', label:'🌿 Лёгкая — отдых +20%', desc:'Тяж 3 мин, памп 75с.' },
                    { id:'moderate', label:'⚖️ Умеренная — стандарт', desc:'Тяж 2-3 мин, памп 60с.' },
                    { id:'high', label:'🔥 Высокая — отдых −20%', desc:'Тяж 1.5 мин, памп 45с.' },
                  ]} />
                  <PopupSelect label="📦 Цель объёма" value={bbVolGoal} onChange={v => setBbVolGoal(v)} options={[['mev','Минимум (MEV)'],['mav','Оптимум (MAV)'],['mrv','Максимум (MRV)']].map(([id,label]) => ({ id, label }))} />
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:10, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.12)' }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'#3b82f6' }}>📦 Объёмный</span>
                    <button onClick={() => setTrainingVolumeMode('standard')} style={{ flex:1, padding:'6px 8px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', border: trainingVolumeMode==='standard' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)', background: trainingVolumeMode==='standard' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)', color: trainingVolumeMode==='standard' ? '#3b82f6' : '#fff' }}>Обычный</button>
                    <button onClick={() => setTrainingVolumeMode('high')} style={{ flex:1, padding:'6px 8px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', border: trainingVolumeMode==='high' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', background: trainingVolumeMode==='high' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)', color: trainingVolumeMode==='high' ? '#f59e0b' : '#fff' }}>Объёмный</button>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Подбор упражнений</div>
                  {[
                    { icon: '🚫', title: 'Исключить осевую нагрузку', desc: 'Убрать приседы, тяги со штангой', on: avoidAxialLoadUi, set: setAvoidAxialLoadUi, accent: '#ef4444', enabled: true },
                    { icon: '🏗️', title: 'Меньше многосуставных', desc: 'Больше тренажёров и изоляций', on: fewerCompound, set: setFewerCompound, accent: '#f59e0b', enabled: true },
                    { icon: '🏋️', title: 'Становая / жим стоя', desc: bbGoal === 'strength_mass' ? 'Включить становую и жим стоя' : 'Доступно в «Сила + Масса»', on: allowStrengthLifts, set: setAllowStrengthLifts, accent: '#3b82f6', enabled: bbGoal === 'strength_mass' },
                    { icon: '🔀', title: 'A/B ротация паттернов', desc: 'Одинаковые дни недели — разные движения (generic + adapt; faithful дословно)', on: abRotation, set: setAbRotation, accent: '#22d3ee', enabled: true },
                    { icon: '📦', title: 'Packing заливка', desc: 'Меньше движений: заливка 6/5/4 с пирамидой (спина/грудь)', on: packingV2, set: setPackingV2, accent: '#a78bfa', enabled: true },
                  ].map(t => {
                    const active = t.enabled && t.on;
                    return (
                      <button key={t.title} type="button" onClick={() => t.enabled && t.set(!t.on)} aria-pressed={!!active} aria-disabled={!t.enabled} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '10px 12px', borderRadius: 12, cursor: t.enabled ? 'pointer' : 'not-allowed', textAlign: 'left', boxSizing: 'border-box', fontFamily: 'inherit', background: active ? `linear-gradient(135deg, ${t.accent}1e, rgba(24,24,27,0.35))` : 'rgba(255,255,255,0.03)', border: active ? `1px solid ${t.accent}66` : '1px solid rgba(255,255,255,0.08)', opacity: t.enabled ? 1 : 0.45, transition: 'all .15s' }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: active ? t.accent : '#fff', lineHeight: 1.2 }}>{t.title}</span>
                          <span style={{ display: 'block', fontSize: 10, color: '#fff', lineHeight: 1.3, marginTop: 2 }}>{t.desc}</span>
                        </span>
                        <span style={{ marginLeft: 'auto', width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative', background: active ? t.accent : 'rgba(255,255,255,0.15)', transition: 'background .2s' }}>
                          <span style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <PopupExerciseList label="⭐ Любимые" ids={bbFavEx} onChange={ids => { setBbFavEx(ids); syncProf({ favoriteExercises: ids }); }} accent="#00e68a" />
                  <PopupExerciseList label="✕ Не любимые" ids={bbExclEx} onChange={ids => { setBbExclEx(ids); syncProf({ excludedExercises: ids }); }} accent="#ef4444" />
                </div>
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🏋️ Оборудование</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {([['barbell','Штанга'],['dumbbell','Гантели'],['cable','Блок'],['machine','Тренажёр'],['kettlebell','Гири'],['bodyweight','Свой вес'],['bands','Резинки']] as const).map(([id,label]) => {
                      const on = bbEquipment.includes(id);
                      return <button key={id} onClick={() => setBbEquipment(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} style={{ padding:'5px 10px', borderRadius:14, fontSize:10, fontWeight:700, cursor:'pointer', minHeight:38, border:on?'1px solid #60a5fa':'1px solid rgba(255,255,255,0.08)', background:on?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.02)', color:on?'#60a5fa':'#fff' }}>{label}{on?' ✓':''}</button>;
                    })}
                  </div>
                </div>
                {/* P1: набор пластин зала — реалистичные веса */}
                <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(147,197,253,0.04)', border:'1px solid rgba(147,197,253,0.14)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#93c5fd', marginBottom:4 }}>🏋️ Набор пластин (микрозагрузка)</div>
                  <div style={{ fontSize:9, opacity:0.8, marginBottom:6 }}>Веса плана округляются к реально достижимым на вашем наборе пластин (стандарт / микрозагрузка / домашний / машины-шаг 1).</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {PLATE_SET_PRESETS.map(p => (
                      <button key={p.id} onClick={() => setPlatePreset(p.id)} style={{ padding:'3px 8px', borderRadius:999, fontSize:9, fontWeight:700, cursor:'pointer', minHeight:28,
                        background: platePreset === p.id ? 'rgba(147,197,253,0.15)' : 'rgba(255,255,255,0.03)',
                        border: platePreset === p.id ? '1px solid rgba(147,197,253,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: platePreset === p.id ? '#93c5fd' : '#fff' }}>{p.label}</button>
                    ))}
                  </div>
                </div>
                {/* P1: женский цикл */}
                {isFemaleProfile && (
                  <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.14)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>🌸 Женский цикл</div>
                    <div style={{ fontSize:9, opacity:0.8, marginBottom:4 }}>День цикла (1-28): в лютеиновую фазу объём −5%.</div>
                    <input type="number" min={1} max={60} value={cycleDay ?? ''} placeholder="день цикла" onChange={e => setCycleDay(e.target.value ? Number(e.target.value) : undefined)}
                      style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'#fff', fontSize:11, padding:'4px 8px', width:90 }} />
                  </div>
                )}
                {/* P1: целевой % жира — уточнение cut/recomp */}
                {(bbGoal === 'cut' || bbGoal === 'recomp') && (
                  <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.14)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f87171', marginBottom:4 }}>🎯 Целевой % жира</div>
                    <div style={{ fontSize:9, opacity:0.8, marginBottom:4 }}>Далеко от цели → объём ближе к MEV (сохранение мышц); близко → полный объём.</div>
                    <input type="number" min={3} max={50} step={0.5} value={targetBodyFat ?? ''} placeholder="%" onChange={e => setTargetBodyFat(e.target.value ? Number(e.target.value) : undefined)}
                      style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'#fff', fontSize:11, padding:'4px 8px', width:80 }} />
                  </div>
                )}
                {/* P2 D: ручной ввод wearable-данных (слой-слияние реально используем) */}
                <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.14)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#93c5fd', marginBottom:4 }}>📱 Восстановление (носимое / ручной)</div>
                  <div style={{ fontSize:9, opacity:0.8, marginBottom:6 }}>Утренний HRV и сон перекрывают профиль в recovery (или введите вручную — пишется в he_wearable_daily).</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <input type="number" placeholder="утр. HRV (мс)" onChange={e => { try { const v = Number(e.target.value); if (v > 0) { localStorage.setItem('he_wearable_daily', JSON.stringify({ ...wearableData, morningHRV: v })); setWearableTick(t => t + 1); } } catch { /* noop */ } }}
                      style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'#fff', fontSize:11, padding:'4px 8px', width:110 }} />
                    <input type="number" step="0.5" placeholder="сон (ч)" onChange={e => { try { const v = Number(e.target.value); if (v > 0) { localStorage.setItem('he_wearable_daily', JSON.stringify({ ...wearableData, sleepHours: v })); setWearableTick(t => t + 1); } } catch { /* noop */ } }}
                      style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'#fff', fontSize:11, padding:'4px 8px', width:90 }} />
                  </div>
                </div>
                <div style={{ marginTop:8 }}>
                  <InjurySelectCard injuries={injuries} onChange={setInjuries} />
                </div>
                {/* R1: реабилитация — прогрессивная рампа возврата мышцы */}
                <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(16,185,129,0.04)', border:'1px solid rgba(16,185,129,0.15)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#34d399', marginBottom:4 }}>🩹 Реабилитация (возврат мышцы)</div>
                  <div style={{ fontSize:9, opacity:0.8, marginBottom:6 }}>Выберите мышцы для прогрессивной рампы возврата: нед 1-2 ×50% объёма/×70% вес, далее ramp к полному (не пересекается со щадящими травмами).</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {WEAK_GROUPS.map(([id, l]) => {
                      const on = rehabMuscles.includes(id);
                      return (
                        <button key={id} onClick={() => setRehabMuscles(on ? rehabMuscles.filter(x => x !== id) : [...rehabMuscles, id])}
                          style={{ padding:'3px 8px', borderRadius:999, fontSize:9, fontWeight:700, cursor:'pointer', minHeight:28,
                            background:on?'rgba(16,185,129,0.15)':'rgba(255,255,255,0.03)',
                            border:on?'1px solid rgba(16,185,129,0.4)':'1px solid rgba(255,255,255,0.08)',
                            color:on?'#34d399':'#fff' }}>
                          {on ? '✓ ' : ''}{l}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginTop:8, padding:12, borderRadius:12, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.18)' }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#f59e0b', marginBottom:6 }}>🦴 Ограничения мобильности</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {([
                      { id: 'shoulder', icon: '🤸', label: 'Плечи' },
                      { id: 'hip', icon: '🦵', label: 'Таз' },
                      { id: 'ankle', icon: '🦶', label: 'Голеностоп' },
                      { id: 'lower_back', icon: '🔙', label: 'Поясница' },
                      { id: 'wrist', icon: '✋', label: 'Запястья' },
                    ] as const).map(r => {
                      const active = mobilityRestrictions.includes(r.id);
                      return (
                        <button key={r.id} onClick={() => setMobilityRestrictions(prev => active ? prev.filter(x => x !== r.id) : [...prev, r.id])} style={{ padding:'7px 10px', borderRadius:10, fontSize:11, cursor:'pointer', border: active ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)', background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)', color: active ? '#f59e0b' : '#fff' }}>
                          {r.icon} {r.label} {active ? '✕' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
                </>
                )}
                <button
                  onClick={() => setAutoDeload(a => !a)}
                  style={{
                    width:'100%', marginTop: 8, padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, textAlign: 'left', boxSizing: 'border-box',
                    background: autoDeload ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.03)',
                    border: autoDeload ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    color: autoDeload ? ACCENT : '#fff',
                  }}
                >
                  {autoDeload ? '✅ Авто-делод при перегрузке' : '⬜ Авто-делод при перегрузке'} (ACWR&gt;1.3)
                </button>

              </div>
            )}
          </>
        )}
      </div>
    )}

    {planMode === 'generic_split' && (
    <div>
      {/* Smart suggestions info banner */}
      <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>★ Smart-подбор (цепочка)</div>
        <div style={{ fontSize:10, color:'#fff', lineHeight:1.5 }}>
          <div><b style={{ color:'#f59e0b' }}>Цель «{bbGoal === 'mass' ? 'Масса' : bbGoal === 'cut' ? 'Сушка' : bbGoal === 'recomp' ? 'Рекомпозиция' : bbGoal === 'maintenance' ? 'Поддержание' : 'Сила+Масса'}»:</b> {bbSuggest.goalDesc}</div>
          <div style={{ marginTop:3 }}><b style={{ color:'#f59e0b' }}>Уровень «{bbLevel === 'beginner' ? 'Новичок' : bbLevel === 'intermediate' ? 'Средний' : bbLevel === 'advanced' ? 'Опытный' : 'Enhanced'}»:</b> {bbSuggest.levelDesc}</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
      <PopupSelect label="Уровень" value={bbLevel} onChange={setBbLevel} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Опытный'],['enhanced','Enhanced (PED)']].map(([id,label]) => ({ id, label }))} />
      <PopupNumber label="Стаж" value={bbTrainingYears} min={0} max={50} step={0.5} suffix=" лет" onChange={v => { setBbTrainingYears(v); syncProf({ trainingYears: v }); }} />
      <PopupSelect label="Цель" value={bbGoal} onChange={setBbGoal} options={[['mass','Мышечная масса'],['cut','Сушка'],['recomp','Рекомпозиция'],['maintenance','Поддержание'],['strength_mass','Сила + Масса']].map(([id,label]) => ({ id, label }))} />
      <PopupNumber label="Дней/нед" value={bbDays} min={3} max={6} onChange={v => setBbDays(v)} />
       <PopupNumber label="Недель мезо" value={bbWeeks} min={4} max={24} suffix=" нед" onChange={v => setBbWeeks(v)} />
        <PopupSelectSmart label="Цель объёма" value={bbVolGoal} onChange={onUserVolGoal} suggestedIds={bbSuggest.volumeGoal} suggestionReason="По цели и уровню" options={[['mev','Минимум (MEV)'],['mav','Оптимум (MAV)'],['mrv','Максимум (MRV)']].map(([id,label]) => ({ id, label }))} />
        <div style={{ gridColumn:'1 / span 2', padding:'10px 12px', borderRadius:12, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.18)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>📦 Объёмный тренинг <span style={{ fontSize:9, fontWeight:400, color:'#fff' }}>капы от уровня — новичок без фармы 60 сетов недоступно</span></div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setTrainingVolumeMode('standard')} style={{ flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:11, border: trainingVolumeMode==='standard' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)', background: trainingVolumeMode==='standard' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)', color: trainingVolumeMode==='standard' ? '#3b82f6' : '#fff' }}>Обычный</button>
            {(() => {
              const highDisabled = false;
              const isBeginnerNoPed = bbLevel === 'beginner' && peds.length === 0;
              return (
                <button
                  disabled={false}
                  title={isBeginnerNoPed ? 'Новичок: объёмный 60 сетов ограничен капами 24/10, но доступен — объём MRV + GVT/FST-7' : 'Объёмный: MRV + GVT/FST-7, капы те же от уровня'}
                  onClick={() => { if (isBeginnerNoPed) flash('Объёмный для новичка: капы 24/10, объём MRV, GVT/FST-7 доступны.'); setTrainingVolumeMode('high'); }}
                  style={{ flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', opacity:1, fontWeight:700, fontSize:11, border: trainingVolumeMode==='high' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', background: trainingVolumeMode==='high' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)', color: trainingVolumeMode==='high' ? '#f59e0b' : '#fff' }}
                >Объёмный</button>
              );
            })()}
          </div>
          <div style={{ marginTop:6, fontSize:10, color:'#fff', lineHeight:1.5 }}>
            {trainingVolumeMode==='standard' ? (
              <>Обычный: цель MAV, без GVT/FST-7, капы по уровню. Лимит: {(() => { try { const l=sessionLimitsFor({level:bbLevel, trainingYears:bbTrainingYears, onCourse:peds.length>0}); return `${l.maxWorkingSets} сетов / ${l.maxExercises} упр.`; } catch { return '24/10'; } })()} (дефолт 24 с фармой — норма). </>
            ) : (
              <>Объёмный: цель MRV + памп-схемы (GVT 10×10/FST-7 — кап 5/упр сохраняется). Капы те же от уровня: новичок 24/10 недоступно 60; enhanced 3г+ 60/18. ACWR/дефицит — отдельной кнопкой Авто-делод.</>
            )}
          </div>
        </div>
        <div style={{ gridColumn:'1 / span 2', padding:'6px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.18)', fontSize:10, color:'#fff', display:'flex', gap:14, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontWeight:800, color:'#a78bfa' }}>⚙️ Оверрайды</span>
          <label style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
            Лаб-множитель MRV (авто {labAdjust.mrvMultiplier.toFixed(2)}):
            <input type="number" step="0.05" min={0.5} max={1.5} value={labMultOverride ?? ''} placeholder="авто" onChange={e2 => { const v = e2.target.value === '' ? null : parseFloat(e2.target.value); setLabMultOverride(v != null && Number.isFinite(v) ? Math.max(0.5, Math.min(1.5, v)) : null); }} style={{ width:55, ...IN }} />
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
            Множитель восстановления (0.6–1.5, авто 1.0):
            <input type="number" step="0.05" min={0.6} max={1.5} value={recoveryOverride ?? ''} placeholder="1.0" onChange={e2 => { const v = e2.target.value === '' ? null : parseFloat(e2.target.value); setRecoveryOverride(v != null && Number.isFinite(v) ? Math.max(0.6, Math.min(1.5, v)) : null); }} style={{ width:55, ...IN }} />
          </label>
          <button onClick={() => { setLabMultOverride(null); setRecoveryOverride(null); flash('Оверрайды сброшены — авто'); }} style={{ padding:'3px 8px', borderRadius:6, fontSize:10, cursor:'pointer', border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'#fff' }}>Сбросить</button>
        </div>
        <div style={{ gridColumn:'1 / span 2', marginTop:2, padding:'6px 10px', borderRadius:10, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', fontSize:10, color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {(() => {
            try {
              const srpe: any = (loadSRPESessions as any)();
              if (!srpe || srpe.length < 2) return <><span>📊 ACWR: нет данных sRPE (нужно ≥2 сессии)</span><span style={{ color:'#fff' }}>дефицит/восстановление — кнопкой Авто-делод</span></>;
              const acwr = (acuteChronicRatio as any)((toDailyLoads as any)(srpe));
              const ratio = acwr?.ratio ?? 1;
              const zone = ratio > 1.5 ? '🔴 опасно' : ratio > 1.3 ? '🟡 осторожность' : ratio < 0.8 ? '🔵 недогруз' : '🟢 норма';
              return <><span>📊 ACWR {ratio.toFixed(2)} — {zone}</span><span style={{ fontSize:9, color:'#fff' }}>дефицит/восстановление — Авто-делод</span></>;
            } catch { return <span>📊 ACWR: —</span>; }
          })()}
        </div>
        <PopupSelect label="🎯 Фокус тренировки" value={bbTrainingFocus} onChange={v => setBbTrainingFocus(v as 'strength' | 'hypertrophy' | 'endurance')} options={[
          { id:'strength', label:'Сила: RIR 1-2', desc:'Тяжёлые веса, низкая скорость, RIR 1-2 — максимальный механический натяг, прогрессия через 1ПМ.' },
          { id:'hypertrophy', label:'Гипертрофия: RIR 2-3', desc:'Умеренные веса 8-12 повт, контроль темпа 3-1-1-0, объём для роста.' },
          { id:'endurance', label:'Выносливость: RIR 3-4', desc:'Лёгкие веса 15-20 повт, короткая пауза, метаболический стресс.' },
        ]} />
        <PopupSelect label="🧩 Методика порядка" value={bbMethodology} onChange={v => setBbMethodology(v as SessionMethodology)} hint="Порядок упражнений в дне — влияет на силу и утомление. В коде: compound_first / pre_exhaust / post_exhaust / mountain_dog / fst7 / hyperemia" options={[
          { id:'compound_first', label:'Базовые → изоляция (по умолчанию)', desc:'Сначала тяжёлые многосуставные на свежие мышцы — максимум веса и безопасная техника, затем изоляция. Классика для гипертрофии.' },
          { id:'pre_exhaust', label:'Pre-exhaust: изоляция первой', desc:'Изоляция целевой мышцы до базы — утомляет заранее, база добивает. Сильный памп, но вес в базе −10-15%.' },
          { id:'post_exhaust', label:'Post-exhaust: базовые → изоляция', desc:'База в полную силу, сразу изоляция без отдыха — «пробить» мышцу двойным стимулом.' },
          { id:'mountain_dog', label:'Mountain Dog: активация → база → памп → стретч', desc:'Лёгкая активация (RIR≥3, не в отказ) готовит связь мозг-мышца, затем тяжёлая база, памп и loaded stretch 30-60с. Для MGF-фаз и суставов.' },
          { id:'fst7', label:'FST-7 порядок: праймер → финишер', desc:'Памп-праймер первым (front-load), тяжёлая работа в середине, 7-сетовый финишер и стретч в конце. Под GH+инсулин окно.' },
          { id:'hyperemia', label:'Hyperemia: памп раньше тяжестей', desc:'У аксессуаров кровь первее веса — памп-изоляция перед тяжёлой, короткие паузы 30-60с. Под intra-углеводы (Sarcev).' },
        ]} />
        <PopupSelect
          label='🔥 Интенсив-техника'
          value={intensityTech}
          onChange={v => setIntensityTech(v as IntensityTechnique)}
          hint='Техника на последнем подходе — продлевает сет за отказом. В коде: none / rest_pause / drop_set / myo_reps / pause_rep / mechanical_drop / negative'
          options={[
            { id: 'none', label: 'Авто по фазе', desc:'Accumulation → пауза-репс, intensification/peaking → rest-pause/dropset по профилю мышцы.' },
            { id: 'rest_pause', label: 'Рест-пауза', desc:'Финал 8 повт + 15с пауза → 3-4 повт + 15с → 3-4 повт. Продлевает подход без сброса веса.' },
            { id: 'drop_set', label: 'Дроп-сет', desc:'После отказа −20% веса → 6 повт, ещё −20% → 4 повт. Метаболический стресс, жжение.' },
            { id: 'myo_reps', label: 'Myo-reps', desc:'Активация 12-15 повт, затем 4×4 повт с 5с паузой. Эффективна для изоляций.' },
            { id: 'pause_rep', label: 'Пауза-репс', desc:'Пауза 2-3с внизу каждого повтора — убирает читинг, усиливает растянутую.' },
            { id: 'mechanical_drop', label: 'Мех. дроп-сет', desc:'Смена угла/хвата без отдыха (жим гантелей → разводка). Продлевает сет механикой.' },
            { id: 'negative', label: 'Негативы (3-4с)', desc:'Медленный негатив 3-4с, быстрый подъём 1с — акцент на эксцентрике.' },
          ]}
        />
        <PopupSelect
          label='🌊 Волновая периодизация (DUP)'
          value={dupMode}
          onChange={v => setDupMode(v as DUPMode)}
          hint='Чередование стимулов внутри недели — в коде: none / heavy_light / strength_hypertrophy / full_dup (Schoenfeld 2017)'
          options={[
            { id: 'none', label: 'Выкл (стандартная периодизация)', desc:'Блочная периодизация: накопление → интенсификация → разгрузка. Просто и надёжно.' },
            { id: 'heavy_light', label: 'Тяж/лёг (2 дня)', desc:'Чередование тяжёлых и лёгких дней — тяж сила, лёгк объём/техника.' },
            { id: 'strength_hypertrophy', label: 'Сила/гипертрофия (2 дня)', desc:'День силы 4-6 повт RIR 1-2 + день гипертрофии 10-15 RIR 2-3 — оптимум.' },
            { id: 'full_dup', label: 'Полный DUP (3 дня)', desc:'Три стимула: сила / гипертрофия / выносливость. Максимум вариативности, нужен опыт ≥2 года.' },
          ]}
        />
        {dupRecommendChip}
        <PopupSelect
          label='🔗 Суперсеты'
          value={supersetMode}
          onChange={v => setSupersetMode(v as 'none' | 'antagonist' | 'same_muscle' | 'giant')}
          hint='Суперсеты — в коде: none / antagonist / same_muscle / giant. Выполняются без отдыха между упражнениями пары.'
          options={[
            { id: 'none', label: 'Выкл', desc:'По очереди с полным отдыхом. Максимум силы в каждом движении.' },
            { id: 'antagonist', label: 'Антагонисты (пары)', desc:'Пары противоположных групп: грудь ↔ спина, бицепс ↔ трицепс. Экономия 30% времени.' },
            { id: 'same_muscle', label: 'Одна группа (пробить)', desc:'Компаунд + изоляция одной мышцы без отдыха — «пробить» группу, сильный памп.' },
            { id: 'giant', label: 'Гигант-сет (3 упр. одной группы)', desc:'Три упражнения одной группы подряд без отдыха. Только для продвинутых, RIR 3+.' },
          ]}
        />
        <PopupSelect
          label='📦 Схема объёма памп-дней'
          value={(trainingVolumeMode === 'high' && volumeScheme === 'standard') ? 'gvt' : volumeScheme}
          onChange={v => setVolumeScheme(v as any)}
          hint={'Методики для памп-изоляций (кап 5 сетов/упр; FST-7 финишер — 7 одним движением) — в коде: standard / gvt / fst7 / gironda' + (bbLevel !== 'enhanced' ? ' · FST-7 7-in-1: только enhanced.' : '') + (((pedDoses.insulin || 0) > 0 && !((computeAASEquivDose(pedDoses)) > 0) && !((pedDoses.GH || 0) > 0)) ? ' · Соло-инсулин: FST-7 запрещён.' : '')}
          options={[
            { id: 'standard', label: 'Стандартная (авто)', desc:'Авто-распределение: тяж — база, памп — изоляция по необходимости. Баланс сила/объём.' },
            { id: 'gvt', label: 'GVT 10×10 (10 сетов на мышцу)', desc:'Немецкий объём 10×10, 60% 1ПМ, 60-90с пауза. Экстремальный объём, только для опытных.' },
            ...((bbLevel === 'enhanced' && !((pedDoses.GH || 0) >= 4) && !((pedDoses.insulin || 0) > 0 && !((computeAASEquivDose(pedDoses)) > 0) && !((pedDoses.GH || 0) > 0))) ? [{ id: 'fst7', label: 'FST-7 (7×8-12 одним финишером)', desc:'Rambod: 7 сетов одной изоляцией в конце мышцы, 30-45с. Только enhanced без joint-guard.' } as any] : []),
            { id: 'gironda', label: '8×8 Gironda (60с)', desc:'8×8, 45-60с пауза, умеренный вес — плотный объём Жиронды для сухой массы.' },
          ]}
        />
       <PopupSelect label="⬇️ Эксцентрик" value={String(eccentricMult)} onChange={v => setEccentricMult(parseFloat(v))} hint="Множитель эксцентрики — в коде eccentricMult: 1.0 / 1.1 / 1.2 (Schoenfeld 2021)." options={[
          { id:'1.0', label:'1.0 — Норма', desc:'Концентрика = эксцентрика. Стандартный темп 2-1-1-0.' },
          { id:'1.1', label:'1.1 — Лёгкий эксцентрик +10%', desc:'Медленнее опускание, больше микроповреждений, умеренный рост стимула.' },
          { id:'1.2', label:'1.2 — Выраженный эксцентрик +20%', desc:'Выраженный акцент на негативе, требует техники и восстановления.' },
        ]} />
        <PopupNumber label="🍽️ Профицит калорий (ккал/день)" value={calorieSurplus} onChange={v => setCalorieSurplus(Math.round(v))} step={50} min={-500} max={1000} hint="Профицит >100 → +5% MRV, >300 → +10% MRV. Дефицит <-200 → -20% MRV. 0 = нейтрально (Helms 2022)." />
        <PopupSelect label="🔄 Вариативность упражнений" value={rotationMode} onChange={v => setRotationMode(v as any)} hint="Вариативность — в коде rotationMode: forbid / strict / variety (как часто менять упражнения)." options={[
          { id:'forbid', label:'🚫 Запрет — одни и те же', desc:'Строго одни упражнения весь мезоцикл — стабильная прогрессия по весам.' },
          { id:'strict', label:'📅 Строгий — смена раз в 4 недели', desc:'Смена на границе фаз — баланс стабильности и разнообразия.' },
          { id:'variety', label:'🎨 Разнообразие — смена при 2×/мышцу', desc:'Чередование углов при 2+ тренировках мышцы — снижает привыкание.' },
        ]} />
        <PopupSelect label="🔥 Интенсивность тренинга" value={intensityLevel} onChange={v => setIntensityLevel(v as any)} hint="Плотность тренировки — в коде intensityLevel: light / moderate / high (управляет паузой)." options={[
          { id:'light', label:'🌿 Лёгкая — отдых +20%', desc:'Тяж 3 мин, памп 75с. Низкая плотность, подходит при плохом восстановлении.' },
          { id:'moderate', label:'⚖️ Умеренная — стандарт', desc:'Тяж 2-3 мин, памп 60с. Оптимум для большинства.' },
          { id:'high', label:'🔥 Высокая — отдых −20%', desc:'Тяж 1.5 мин, памп 45с. Высокая плотность, метаболический стресс.' },
        ]} />
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Подбор упражнений</div>
        {[
          {
            icon: '🚫', title: 'Исключить осевую нагрузку',
            desc: 'Убрать упражнения с нагрузкой на позвоночник (приседы, тяги со штангой)',
            on: avoidAxialLoadUi, set: setAvoidAxialLoadUi, accent: '#ef4444', enabled: true,
          },
          {
            icon: '🏗️', title: 'Меньше многосуставных',
            desc: 'Больше замен на тренажёры и изолирующие упражнения',
            on: fewerCompound, set: setFewerCompound, accent: '#f59e0b', enabled: true,
          },
          {
            icon: '🏋️', title: 'Становая / жим стоя',
            desc: bbGoal === 'strength_mass' ? 'Включить становую и жим стоя в план' : 'Доступно в цели «Сила + Масса»',
            on: allowStrengthLifts, set: setAllowStrengthLifts, accent: '#3b82f6', enabled: bbGoal === 'strength_mass',
          },
          {
            icon: '🔀', title: 'A/B ротация паттернов',
            desc: 'Одинаковые дни недели — разные движения (generic + adapt; faithful дословно)',
            on: abRotation, set: setAbRotation, accent: '#22d3ee', enabled: true,
          },
          {
            icon: '🤖', title: 'Авто-регуляция по готовности',
            desc: 'Объём/вес/RIR корректируются по сну, HRV, стрессу и ACWR (P0-10: ранее тогл был мёртвым)',
            on: autoRegOn, set: setAutoRegOn, accent: '#22c55e', enabled: true,
          },
          {
            icon: '📦', title: 'Packing заливка',
            desc: 'Меньше движений: заливка 6/5/4 с пирамидой (спина/грудь)',
            on: packingV2, set: setPackingV2, accent: '#a78bfa', enabled: true,
          },
        ].map(t => {
          const active = t.enabled && t.on;
          return (
            <button
              key={t.title}
              type="button"
              onClick={() => t.enabled && t.set(!t.on)}
              aria-pressed={!!active}
              aria-disabled={!t.enabled}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                padding: '10px 12px', borderRadius: 12, cursor: t.enabled ? 'pointer' : 'not-allowed',
                textAlign: 'left', boxSizing: 'border-box', fontFamily: 'inherit',
                background: active ? `linear-gradient(135deg, ${t.accent}1e, rgba(24,24,27,0.35))` : 'rgba(255,255,255,0.03)',
                border: active ? `1px solid ${t.accent}66` : '1px solid rgba(255,255,255,0.08)',
                opacity: t.enabled ? 1 : 0.45,
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: active ? t.accent : '#fff', lineHeight: 1.2 }}>{t.title}</span>
                <span style={{ display: 'block', fontSize: 10, color: '#fff', lineHeight: 1.3, marginTop: 2 }}>{t.desc}</span>
              </span>
              <span style={{
                marginLeft: 'auto', width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative',
                background: active ? t.accent : 'rgba(255,255,255,0.15)', transition: 'background .2s',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left .2s',
                }} />
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <PopupExerciseList
          label="⭐ Любимые упражнения"
          ids={bbFavEx}
          onChange={ids => { setBbFavEx(ids); syncProf({ favoriteExercises: ids }); }}
          accent="#00e68a"
        />
        <PopupExerciseList
          label="✕ Не любимые"
          ids={bbExclEx}
          onChange={ids => { setBbExclEx(ids); syncProf({ excludedExercises: ids }); }}
          accent="#ef4444"
        />
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: '#fff' }}>
        Любимые получают приоритет при отборе упражнений. Не любимые полностью исключаются из генерации плана. Синхронизируется с профилем (🧬 Профиль тренированности).
      </div>
    </div>
    )}
    <div style={{ marginTop:12, padding:10, borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📈 Стратегия прогрессии</div>
      <PopupSelectSmart label="" value={loadStrategy} onChange={onUserLoadStrategy} suggestedIds={bbSuggest.loadStrategy} suggestionReason={bbSuggest.goalDesc.split('.')[0]} options={[
        { id:'double_progression', label:'🔄 Двойная прогрессия: сначала повторы → потом вес (рекоменд.)' },
        { id:'linear', label:'📈 Линейная: +2.5 кг/нед для compounds, +1 кг для изоляции' },
        { id:'wave', label:'🌊 Волновая: 3-нед микроциклы (тяж/ср/лёг)' },
        { id:'rpe_based', label:'🎯 RPE-базированная: авто-подбор веса по ощущению (продвинутый)' },
      ]} />
      <div style={{ marginTop:4, fontSize:11, color:'#fff' }}>
        {loadStrategy === 'double_progression' && 'Стратегия PRO-бодибилдеров: добейте повторы до верхней границы, затем повысьте вес на 5%.'}
        {loadStrategy === 'linear' && 'Классическая силовая прогрессия: еженедельное прибавление веса. Эффективно для новичков и intermediates.'}
        {loadStrategy === 'wave' && 'Продвинутая периодизация: 3-нед циклы тяжёлая/средняя/лёгкая неделя. Управление утомлением.'}
        {loadStrategy === 'rpe_based' && 'Для опытных: вес подбирается по ощущению (RPE). Авто-регуляция под текущее состояние.'}
      </div>
    </div>
    <button
      type="button"
      onClick={() => setAutoDeload(v => !v)}
      aria-pressed={autoDeload}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
        padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box', fontFamily: 'inherit',
        background: autoDeload ? `linear-gradient(135deg, ${ACCENT}1e, rgba(24,24,27,0.35))` : 'rgba(255,255,255,0.03)',
        border: autoDeload ? `1px solid ${ACCENT}66` : '1px solid rgba(255,255,255,0.08)',
        transition: 'all .15s',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>🛡️</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: autoDeload ? ACCENT : '#fff', lineHeight: 1.2 }}>Авто-разгрузка при ACWR {`>`} 1.3</span>
        <span style={{ display: 'block', fontSize: 10, color: '#fff', lineHeight: 1.3, marginTop: 2 }}>Автоматически вставить разгрузочную неделю при перегрузке (ACWR &gt; 1.3)</span>
      </span>
      <span style={{
        marginLeft: 'auto', width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative',
        background: autoDeload ? ACCENT : 'rgba(255,255,255,0.15)', transition: 'background .2s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: autoDeload ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left .2s',
        }} />
      </span>
    </button>
    {savedPlans.length > 0 && (
      <div style={{ marginTop:8 }}>
        <BbRowSwitch
          checked={usePreviousPlan}
          onChange={setUsePreviousPlan}
          icon="🔗"
          title="Cross-mesocycle: прогрессия из последнего плана"
          desc={savedPlans[0]?.name || ''}
          ariaLabel="Прогрессия из последнего плана"
        />
      </div>
    )}
    {autoDeload && (
      <div style={{ marginTop:6 }}>
        <PopupSelectSmart label="Тип разгрузки" value={deloadType} onChange={onUserDeloadType} suggestedIds={bbSuggest.deloadType} suggestionReason="По цели" options={[
          { id:'pump', label:'🩸 Pump-разгрузка: лёгкие веса, высокие повторы (рекоменд.)' },
          { id:'neural', label:'🧠 Нейральная: низкий объём, умеренный вес, долгий отдых' },
          { id:'full_rest', label:'😴 Полный отдых: минимальная активность, только при перетрене' },
          { id:'mini', label:'🪶 Мини-делоад: −1-2 сета, вес почти тот же, без смены схемы' },
        ]} />
        <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(34,197,94,0.06)', fontSize:11, color:'#fff' }}>
          {DELOAD_PROTOCOLS[deloadType].description}
        </div>
      </div>
    )}
    {/* P6: intensity technique (применяется к primary упражнениям) */}
    <div style={{ marginTop:8 }}>
      <PopupSelectSmart label="🎯 Intensity-техника (P6)" value={intensityTech} onChange={onUserIntensityTech} suggestedIds={bbSuggest.intensityTechnique} suggestionReason="По цели и уровню (цепочка)" options={[
        { id:'none', label:'Авто (по фазе): accumulation→pause_rep, intensification/peaking→rest_pause' },
        { id:'rest_pause', label:'⏸ Rest-pause: финальный сет 1×8 + 15с + 1×3-4 + 15с + 1×3-4' },
        { id:'drop_set', label:'⤵ Drop-set: финал 1×10 → -20% → 1×6 → -20% → 1×4' },
        { id:'myo_reps', label:'🔁 Myo-reps: 1×12-15 + 4 mini × 4 reps × 5с' },
        { id:'pause_rep', label:'🛑 Pause-rep: пауза 2-3с в нижней точке каждого повторения' },
        { id:'mechanical_drop', label:'🔄 Mechanical drop: смена угла/хвата без отдыха' },
      ]} />
      <div style={{ marginTop:4, fontSize:10, color:'#fff' }}>
        {INTENSITY_TECHNIQUES[intensityTech]?.description || 'Без техники'}
      </div>
    </div>
    {/* Фаза 7: Фильтр оборудования */}
    <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🏋️ Доступное оборудование</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
        {([['barbell','Штанга'],['dumbbell','Гантели'],['cable','Блок/кроссовер'],['machine','Тренажёр'],['kettlebell','Гири'],['bodyweight','Свой вес'],['bands','Резинки']] as const).map(([id,label]) => {
          const on = bbEquipment.includes(id);
          return <button key={id} onClick={() => setBbEquipment(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            style={{ padding:'5px 10px', borderRadius:14, fontSize:10, fontWeight:700, cursor:'pointer', minHeight:38, border:on?'1px solid #60a5fa':'1px solid rgba(255,255,255,0.08)', background:on?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.02)', color:on?'#60a5fa':'#fff' }}>{label}{on?' ✓':''}</button>;
        })}
      </div>
      <div style={{ marginTop:4, fontSize:10, color:'#fff' }}>Если ничего не выбрано — используются все упражнения. Выбор ограничивает пул отбора.</div>
    </div>
    {/* Карточка травм */}
    <div style={{ marginTop:8 }}>
      <InjurySelectCard
        injuries={injuries}
        onChange={setInjuries}
      />
    </div>
    {/* PRO: Mobility restrictions — biomechanics-based exercise filtering */}
    <div style={{ marginTop:8, padding:12, borderRadius:12, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <div style={{ fontSize:12, fontWeight:800, color:'#f59e0b' }}>🦴 Ограничения мобильности</div>
        <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:999, background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)' }}>биомеханика</span>
      </div>
      <div style={{ fontSize:10, color:'#fff', lineHeight:1.45, marginBottom:8 }}>
        Если какое-то движение даётся тяжело из-за ограниченной подвижности сустава — отметьте зону. Такие упражнения будут <b style={{ color:'#fbbf24' }}>заменены</b> на биомеханически безопасные альтернативы.
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {([
          { id: 'shoulder', icon: '🤸', label: 'Плечи', desc: 'жим над головой, за голову, тяга к подбородку' },
          { id: 'hip', icon: '🦵', label: 'Таз', desc: 'глубокие приседы, sissy, гоблет' },
          { id: 'ankle', icon: '🦶', label: 'Голеностоп', desc: 'приседания, выпады, болгарские' },
          { id: 'lower_back', icon: '🔙', label: 'Поясница', desc: 'становая, тяга в наклоне, RDL' },
          { id: 'wrist', icon: '✋', label: 'Запястья', desc: 'сгибания со штангой, франц. жим' },
        ] as const).map(r => {
          const active = mobilityRestrictions.includes(r.id);
          return (
            <button key={r.id} onClick={() => setMobilityRestrictions(prev => active ? prev.filter(x => x !== r.id) : [...prev, r.id])}
              style={{ padding:'7px 10px', borderRadius:10, fontSize:11, cursor:'pointer', textAlign:'left', minWidth:'110px', flex:'1 1 auto',
                border: active ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)', background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)', color: active ? '#f59e0b' : '#fff' }}>
              <div style={{ fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>{r.icon} {r.label} {active && <span style={{ marginLeft:'auto', fontSize:10 }}>✕</span>}</div>
              <div style={{ fontSize:8.5, opacity:0.75, marginTop:2, lineHeight:1.3 }}>{r.desc}</div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop:8, fontSize:9, color:'#fff', lineHeight:1.45 }}>
        💡 <b style={{ color:'#fff' }}>Чем отличается от «Травм»:</b> травмы защищают <b>мышцу</b> (исключение или щадящая нагрузка), а мобильность — конкретные <b>движения</b>. Работают вместе, не дублируя друг друга.
      </div>
    </div>

    <button style={{ ...BTN, width:'100%', marginTop:12 }} onClick={() => setStep('ped')}>Далее: PED и рабочие веса →</button>
  </div>
);
