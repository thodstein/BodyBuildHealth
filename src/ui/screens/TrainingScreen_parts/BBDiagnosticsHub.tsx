/**
 * BBDiagnosticsHub.tsx — диагностика ДВИЖЕНИЙ под бодибилдинг (мышца + упражнение → стимул → коррекция).
 * 6 табов: weak (слабые зоны + причина + топ-3)/screening (OHS-скрининг + односторонний + драйвер)/
 * exercise (разбор + PROF-техника + Δ + LVP)/stimulus (стимул-карта)/symmetry (пропорции)/volume (объём·recovery·mobility).
 * Нагрузка/восстановление/объём/VBT/LVP/видео/ортопедия — НЕ дублируются, только ссылки на свои хабы.
 * Хедер RSS 0-100 (движения: слабые/симметрия/стимул/скрининг/SFR/углы/длина) + verification. Мост weakpoints → BbAutoConstructor.
 *
 * Декомпозиция (волна 3 плана хабов) — вся разметка табов живёт отдельными файлами,
 * здесь остаются состояние/мемо/хендлеры/экспорт и композиция:
 *   `bb-hub-weak-tab.tsx` — «Слабые» (зоны, причины, топ-3, коррекции ⭐);
 *   `bb-hub-screening-tab.tsx` — «Скрининг» (OHS/односторонний/драйвер/YBT/боль);
 *   `bb-hub-exercise-tab.tsx` — «Разбор» (техника, замены, SFR, LVP, рабочий коридор);
 *   `bb-hub-stimulus-tab.tsx` — «Стимул-карта»; `bb-hub-symmetry-tab.tsx` — «Пропорции»;
 *   `bb-hub-volume-tab.tsx` — 6-й таб «Объём · Recovery»;
 *   `bb-hub-next-actions-card.tsx` — карточка «Что делать дальше» (BB-G-08);
 *   `bb-hub-controls.tsx` — общие контролы (BbNum/BbCheckCard/BbSheetSelect);
 *   `bb-hub-zones.ts` — цвета зон; `bb-hub-export.ts` — единая PRO-мета для HTML/CSV/печати.
 */
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { CARD } from './training-ui';
import { BbScreeningTab } from './bb-hub-screening-tab';
import { BbCheckCard, BbNum, bbNum } from './bb-hub-controls';
// Декомпозиция (волна 3 плана хабов): секции хаба живут отдельными файлами,
// разметка и data-bb-контракты при переезде не меняются.
import { BbNextActionsCard } from './bb-hub-next-actions-card';
import { BbVolumeTab } from './bb-hub-volume-tab';
import { BbWeakTab } from './bb-hub-weak-tab';
import { BbExerciseTab } from './bb-hub-exercise-tab';
import { BbStimulusTab } from './bb-hub-stimulus-tab';
import { BbSymmetryTab } from './bb-hub-symmetry-tab';
import { applyToPlanner } from './planner-bridge';
import { buildPro2Meta } from './bb-hub-export';
import { localIsoDate } from './diary-shared';
import { localIsoDateOffset } from '../../../core/local-date';
import { scoreColor as bbScoreColor, BB_VERIFICATION_LABEL_RU } from '../../../engines/bb/bb-scoring.engine';
import { buildBBDiagnosticsReport } from '../../../engines/bb/bb-diagnostics-hub.engine';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv, downloadHtml, downloadCsv } from '../../../engines/bb/bb-diagnostics-export.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { aggregateBBVolume } from '../../../engines/bb/bb-volume.engine';
import { analyzeBBBalance } from '../../../engines/bb/bb-balance.engine';
import { computePerMuscleACWR } from '../../../engines/bb/bb-progression-feedback.engine';
import { assessOHS } from '../../../engines/strength-sport/strength-sport-ohs.engine';
import { lrVerdictsFromSessions, LR_PHASE_ASYM_NOTE } from '../../../engines/bb/bb-lr-volume.engine';
import { assessBbReadiness } from '../../../engines/bb/bb-readiness.engine';
import { assessBbRedFlags } from '../../../engines/bb/bb-red-flags.engine';
import { buildReturnToPlan, activeReturnToStage, evaluateReturnToCriteria } from '../../../engines/bb/bb-return-to.engine';
import { mmcAdviceFor } from '../../../engines/bb/bb-mmc-gate.engine';
import { pushLrSnapshot, summarizeLrDirection, type BbLrSnapshot } from '../../../engines/bb/bb-lr-history.engine';
import { buildBBSpecIcs, downloadBBSpecIcs, bbWorkingRange, bbWorkingRangeNote } from '../../../engines/bb/bb-spec-ics.engine';
import { bbSpecToAnnualPatch } from '../../../engines/bb/bb-spec-annual.engine';
import { loadAnnualTrainingPlan, saveAnnualTrainingPlan } from '../../../engines/annual-training/annual-training-storage';
import { setAnnualBlockConfig } from '../../../engines/annual-training/block-builders.engine';
import { isSpecializationTargetConflict, canonicalMuscle } from '../../../engines/bb/bb-specialization.engine';
import { isGranularZone, granularZoneOf } from '../../../engines/bb/bb-granular-zone.engine';
import { calcExerciseEffect, exerciseEffectScore } from '../../../engines/bb/bb-exercise-effect.engine';
import { auditPlanExercises } from '../../../engines/bb/bb-plan-exercise-audit.engine';
import { diagnoseExercise } from '../../../engines/bb/bb-exercise-diagnosis.engine';
import { prescribeCorrections } from '../../../engines/bb/bb-exercise-correction.engine';
import { simulateCorrection } from '../../../engines/bb/bb-exercise-simulator.engine';
import { getProfExecutionProfile } from '../../../engines/bb/bb-execution-prof.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { buildExerciseInstructions } from '../../../engines/bb/bb-exercise-instructions.engine';
import { sfrOf } from '../../../engines/bb/bb-sfr-db';
import { diagnoseWeakCausesBatch } from '../../../engines/bb/bb-weak-cause.engine';
import { volumeHistory28d, e1rmTrend28d } from '../../../engines/bb/bb-weak-detection.engine';
import { rankCorrectionsForWeak } from '../../../engines/bb/bb-correction-rank.engine';
import { loadHubDiarySessions } from '../../../engines/hub-diary.engine';
import { rankCorrectives, correctiveDose, correctiveLoadFactor } from '../../../engines/bb/bb-corrective.engine';
import { correctiveBlockForBB, correctiveBlockExportLines } from '../../../engines/bb/bb-corrective-block.engine';
import { buildSpecBlock } from '../../../engines/bb/bb-spec-block.engine';
import { injectBBWeakPoints, correctiveWeightHint, pushPlanSnapshot, readPlanHistory, type PlanSnapshot } from '../../../engines/bb/bb-diagnostics-injection.engine';
import { calculatePlanSafetyScore } from '../../../engines/bb/bb-safety-score.engine';
import { bbPlanSaveBlockReason } from './bb-plan-save-guard';
import { readDiagHistory, appendDiagHistory, diagHistoryTrend, type DiagHistoryEntry } from '../../../engines/bb/bb-diag-history.engine';
import { idealMcCallumMap, symmetryTriadDeviation, appendMeasureSnapshot, femaleSymmetryNotes, teenTrainingNote, type MeasureSnapshot } from '../../../engines/bb/bb-symmetry.engine';
import { weakHeadForZone, HEAD_FUNCTIONS, auditHeadCoverage, headsHitOf } from '../../../engines/bb/bb-stimulus-target.engine';
import { resolveMovementDriver, singleLegVerdict, ohsFailCodes, d1d5FailCodes, v3FailCodes, movementDelta, screenPriorityList, teenLoadedGate, type MovementSnapshot } from '../../../engines/bb/bb-movement-screen.engine';
// Аудит 2026-11 (BB-24): экран скрининга вынесен в `bb-hub-screening-tab.tsx`,
// поэтому оговорки/справочники рисуются ТАМ. Раньше хаб держал их импорты
// «на память» — 13 имён ни разу не использовались в этом файле.
import { shoulderWallVerdict, thoracicRotationVerdict, erIrVerdict } from '../../../engines/bb/bb-shoulder-screen.engine';
import { hingeVerdict, loadedSquatVerdict, loadedHingeVerdict } from '../../../engines/bb/bb-hinge-screen.engine';
import { ybtLqVerdict } from '../../../engines/bb/bb-ybt-lq.engine';
import { substitutesForDriver, asymPriorityText } from '../../../engines/bb/bb-movement-to-plan.engine';
import { benchScreenVerdict } from '../../../engines/bb/bb-bench-screen.engine';
import { painMonitorVerdict, painMonitorLine, type PainLocation } from '../../../engines/bb/bb-pain-monitor.engine';
import { nheVerdict, adductorVerdict, type CphLevel } from '../../../engines/bb/bb-posterior-readiness.engine';
import { assessBbTendonGuard } from '../../../engines/bb/bb-tendon-guard.engine';
import { calibrateBbLvp, parseBbLvpText, loadBbLvpProfiles, saveBbLvpProfile, clearBbLvpProfiles, type BbLvpProfile } from '../../../engines/bb/bb-lvp.engine';
import { buildVolumeRecoveryPanel } from '../../../engines/bb/bb-volume-recovery.engine';
// BB-G-08: «что делать дальше» — 1–2 шага из данных + белый список deep-link'ов.
import { buildNextActions } from '../../../engines/bb/bb-diag-next-actions.engine';
import { buildCorrectionEffect, logDiagInjection, readDiagInjections, type DiagInjection } from '../../../engines/bb/bb-diag-effect.engine';
// BB-G-05: типы результата видео-разбора позы (метрики считает отдельный чистый движок).
import { bbPoseLines, type BbPoseSummary, type BbPoseView } from '../../../engines/bb/bb-pose-metrics.engine';

const STORAGE_KEY = 'he_bb_diagnostics_hub_v1';
type BBTab = 'weak' | 'screening' | 'exercise' | 'stimulus' | 'symmetry' | 'volume';

export type BBState = {
  weakManual: string[];
  circ: Record<string, string>;
  ohsHeelsFlat: boolean; ohsKneeValgus: boolean; ohsHipBelowParallel: boolean; ohsTrunkUpright: boolean; ohsArmsOverMidfoot: boolean; ohsLumbarNeutral: boolean;
  kneeToWallCm: string; ankleDeg: string; heelRetest: '' | 'better' | 'same';
  /** Сгибание плеча по гониометру (градусы; норма 180°). */
  shoulderFlexDeg: string;
  /** Когда скрининг пройден в последний раз (ISO-дата) — для авто-напоминания о re-screen. */
  screenDoneAt: string;
  /** КТС левая/правая (см). kneeToWallCm — legacy (мигрирует в обе при загрузке). */
  ktwL: string; ktwR: string;
  /** Скрининг v2: руки на бёдрах чистят поясницу (тест на широчайшие) + односторонний + снимок. */
  handsOnHipsBetter: boolean;
  splitL: '' | 'pass' | 'fail';
  splitR: '' | 'pass' | 'fail';
  rdlL: '' | 'pass' | 'fail';
  rdlR: '' | 'pass' | 'fail';
  /** Опциональный угломер FPPA (градусы, замер с фото). Только tiebreak при чистой качественной оценке. */
  fppaL: string;
  fppaR: string;
  exerciseSelectedId: string | null;
  exerciseFilterSfr: number;
  exerciseFilterProfile: string;
  exerciseFilterUnilateral: boolean;
  wristCm: string;
  sex: '' | 'male' | 'female';
  specWeeks: string;
  showSpecBlock: boolean;
  stimCheating: boolean;
  stimShortRom: boolean;
  stimSetupNote: string;
  acutePain: boolean;
  swelling: boolean;
  numbness: boolean;
  jointClickPain: boolean;
  /** PRO-4 S3: подтверждённая ступень возврата ('' — авто: ступень 1). */
  returnStage: '' | '1' | '2' | '3';
  /** П2: измеримые критерии выхода из return-to (pain-monitoring, Silbernagel 2007).
   *  null/undefined = не введено → «нет данных», а не «всё хорошо». */
  retPainLoad?: number | null;
  retPainMorning?: number | null;
  retStiffness?: 'better' | 'same' | 'worse' | null;
  retPlyo?: boolean | null;
  /** D1 плечо у стены (true = чисто; фолс — провал признака). */
  shBackOnWall: boolean; shHeadOnWall: boolean; shBicepsAtEars: boolean; shRibsDown: boolean; shNoShrug: boolean;
  /** D1 ротация грудного, градусы. */
  rotL: string; rotR: string;
  /** D2 шарнир (палка) + нагруженный присед. */
  hingeDowel: '' | 'full' | 'lumbar_loss' | 'neck_loss' | 'both';
  sqBody: '' | 'pass' | 'fail'; sqBar: '' | 'pass' | 'fail'; sqWork: '' | 'pass' | 'fail';
  /** D3 YBT-LQ anterior + длина голени. */
  ybtL: string; ybtR: string; shinCm: string;
  /** D4 скапула/болевая дуга + видео-стандарт. */
  painArc: boolean; scapWinging: boolean; videoTwoAngles: boolean;
  /** R4: таз/голеностоп — КТС прямым коленом (гастрокнемиус), сгибание бедра, «подворот» таза. */
  ktwStraightL: string; ktwStraightR: string; hipFlexDeg: string; ppTilt: boolean;
  /** R5: шарнир под весом (RDL / тяга с пола). */
  rdlLoaded: '' | 'pass' | 'fail'; floorLoaded: '' | 'pass' | 'fail';
  /** R6: ER/IR-ratio (кг, ручной замер). */
  erKg: string; irKg: string;
  /** R1: жим — хват/касание/лопатки/отведение/локти/боль. */
  benchGripCm: string; benchTouch: '' | 'nipple' | 'upper_abs' | 'neck'; benchScapula: '' | 'retracted' | 'neutral' | 'released';
  benchAbduction: string; benchElbowsBelow: boolean; benchPain: boolean;
  /** R2: боль-мониторинг (0–10 днём/утром + флаги). */
  pmLoc: '' | PainLocation; pmDuring: string; pmMorning: string; pmRising: boolean; pmNight: boolean; pmSharp: boolean;
  /** R3: задняя цепь — NHE (повторы/угол) + аддукторы (сжатие/уровень Copenhagen). */
  nheL: string; nheR: string; nheAngle: string; addL: string; addR: string; cphLevel: '' | CphLevel;
  /** YBT-LQ: posteromedial / posterolateral / длина конечности (полный композит по протоколу). */
  ybtPmL: string; ybtPmR: string; ybtPlL: string; ybtPlR: string; limbCm: string;
  /** Скрининг вообще затронут (иначе все «чисто» — это дефолт, а не результат). */
  screenTouched: boolean;
  /**
   * BB-G-05: видео-разбор позы — результаты ДЕРЖИМ ПО РАКУРСАМ.
   * Фронт и бок меряют разные признаки, поэтому второй замер не должен затирать
   * первый: иначе «снято с 2 ракурсов» в отчёте противоречит единственной секции.
   */
  poseView: BbPoseView;
  poseResults: { front: BbPoseSummary | null; side: BbPoseSummary | null };
  /** Перенос в OHS — отдельно по ракурсу: у каждого свой патч и своя кнопка. */
  poseApplied: { front: boolean; side: boolean };
  /** Выбранное пользователем упражнение коррекции по зоне (⭐ = id записи библиотеки коррекций).
   *  Единственный источник выбора: карточка/экспорт/вставка/мост читают тот же мемо. */
  prefCorr: Record<string, string>;
};

const DEFAULT_STATE: BBState = {
  weakManual: [],
  circ: { heightCm: '175', weightKg: '80', neck: '', chest: '', waist: '', hips: '', bicepL: '', bicepR: '', thighL: '', thighR: '', calfL: '', calfR: '', shoulderWidth: '', forearmL: '', forearmR: '' },
  ohsHeelsFlat: true, ohsKneeValgus: false, ohsHipBelowParallel: true, ohsTrunkUpright: true, ohsArmsOverMidfoot: true, ohsLumbarNeutral: true,
  kneeToWallCm: '', ankleDeg: '', heelRetest: '', shoulderFlexDeg: '', screenDoneAt: '',
  ktwL: '', ktwR: '',
  handsOnHipsBetter: false,
  splitL: '', splitR: '', rdlL: '', rdlR: '',
  fppaL: '', fppaR: '',
  exerciseSelectedId: null,
  exerciseFilterSfr: 0,
  exerciseFilterProfile: 'all',
  exerciseFilterUnilateral: false,
  wristCm: '',
  sex: '',
  specWeeks: '6',
  showSpecBlock: false,
  stimCheating: false,
  stimShortRom: false,
  stimSetupNote: '',
  acutePain: false,
  swelling: false,
  numbness: false,
  jointClickPain: false,
  returnStage: '',
  retPainLoad: null, retPainMorning: null, retStiffness: null, retPlyo: null,
  shBackOnWall: true, shHeadOnWall: true, shBicepsAtEars: true, shRibsDown: true, shNoShrug: true,
  rotL: '', rotR: '',
  hingeDowel: '',
  sqBody: '', sqBar: '', sqWork: '',
  ybtL: '', ybtR: '', shinCm: '',
  ybtPmL: '', ybtPmR: '', ybtPlL: '', ybtPlR: '', limbCm: '',
  painArc: false, scapWinging: false, videoTwoAngles: false,
  ktwStraightL: '', ktwStraightR: '', hipFlexDeg: '', ppTilt: false,
  rdlLoaded: '', floorLoaded: '',
  erKg: '', irKg: '',
  benchGripCm: '', benchTouch: '', benchScapula: '', benchAbduction: '', benchElbowsBelow: false, benchPain: false,
  pmLoc: '', pmDuring: '', pmMorning: '', pmRising: false, pmNight: false, pmSharp: false,
  nheL: '', nheR: '', nheAngle: '', addL: '', addR: '', cphLevel: '',
  screenTouched: false,
  poseView: 'front',
  poseResults: { front: null, side: null },
  poseApplied: { front: false, side: false },
  prefCorr: {},
};

const TAB_DEFS: Array<{ id: BBTab; label: string; icon: string; desc: string }> = [
  { id: 'weak', label: 'Слабые', icon: '🎯', desc: 'зоны 1–2 + причина + топ-3' },
  { id: 'screening', label: 'Скрининг', icon: '🦿', desc: 'присед-тест + драйвер + 1 нога' },
  { id: 'exercise', label: 'Разбор', icon: '🏋️', desc: 'упражнение + техника + замена' },
  { id: 'stimulus', label: 'Стимул-карта', icon: '🎯', desc: 'SFR + длина + углы + читинг' },
  { id: 'symmetry', label: 'Пропорции', icon: '⚖️', desc: 'замеры + лево/право + дельты' },
  { id: 'volume', label: 'Объём · Recovery', icon: '📐', desc: 'ACWR + MRV + ограничитель' },
];

/** Движения LVP-калибровки: один источник для селекта и для подписи рабочего коридора. */
const LVP_LIFTS: Array<{ id: string; label: string }> = [
  { id: 'squat', label: 'Присед' },
  { id: 'bench', label: 'Жим лёжа' },
  { id: 'deadlift', label: 'Тяга' },
  { id: 'ohp', label: 'Жим стоя' },
  { id: 'row', label: 'Тяга в наклоне' },
];

// Цвета зон (BB-G-01: «нет данных» — серый, а не зелёный) — в `bb-hub-zones.ts`,
// потому что их красят и панель объёма, и карточка «что делать дальше».

const GRANULAR_OPTS: Array<{ id: string; label: string }> = [  { id: 'delt_mid', label: 'Средняя дельта' },
  { id: 'delt_rear', label: 'Задняя дельта' },
  { id: 'delt_front', label: 'Передняя дельта' },
  { id: 'chest_upper', label: 'Верх груди' },
  { id: 'chest_lower', label: 'Низ груди' },
  { id: 'back_width', label: 'Ширина спины' },
  { id: 'back_thickness', label: 'Толщина спины' },
  { id: 'quads', label: 'Квадрицепс' },
  { id: 'hamstrings', label: 'Бицепс бедра' },
  { id: 'glutes', label: 'Ягодицы' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'calves', label: 'Икры' },
  { id: 'traps', label: 'Трапеции' },
  { id: 'forearms', label: 'Предплечья' },
];

/** Русские подписи профилей/мышц для вывода (движковые id не меняются). */
const PROFILE_RU: Record<string, string> = { lengthened: 'растянутая', mid: 'средняя', short: 'пиковая', all: 'все' };

/** PRO-5 Э3: RU-расшифровка кодов трекинга снимков (D1–D5/R1–R8; неизвестный код — как есть). */
const TRACKED_CODE_RU: Record<string, string> = {
  heels: 'пятки', valgus: 'вальгус', depth: 'глубина', trunk: 'корпус', arms: 'руки', lumbar: 'поясница', ppt: 'наклон таза',
  'sh-flexion': 'плечо: сгибание', 'sh-thoracic': 'плечо: грудной', 'sh-lats': 'плечо: широчайшие', 'sh-control': 'плечо: контроль', 'sh-position': 'плечо: позиция', 'sh-fail': 'плечо: провал',
  'rot-gap': 'ротация: разрыв', 'rot-low': 'ротация: мало',
  'hinge-lumbar': 'шарнир: поясница', 'hinge-neck': 'шарнир: шея', 'hinge-both': 'шарнир: поясница+шея',
  'sq-degraded': 'присед под весом', 'ybt-asym': 'YBT: асимметрия', 'ybt-comp': 'YBT: композит',
  'bench-fix': 'жим: правка', 'bench-watch': 'жим: наблюдать', 'nhe-asym': 'NHE: асимметрия', 'add-asym': 'аддукторы: асимметрия',
  'pm-red': 'боль: красная', 'pm-yellow': 'боль: жёлтая', 'hip-flex': 'сгибание бедра', 'hng-degraded': 'шарнир под весом', 'erir-low': 'ER/IR низко',
};
const trackedRu = (codes: string[]): string => codes.map((c) => TRACKED_CODE_RU[c] || c).join(' · ');
const profileRu = (p: string | null | undefined): string => (p && PROFILE_RU[p]) || String(p || '—');
const FLAG_RU: Record<string, string> = {
  synergistTakeover: 'нагрузку забирают соседи', stabilityGap: 'не хватает стабильности', wrongHead: 'бьёт мимо слабой головки',
  singleAngle: 'один угол — нужен второй', shortOnly: 'только короткая позиция', missingLengthened: 'нет растянутой позиции',
  jointOverload: 'перегруз сустава', mobilityBlock: 'мешает подвижность', asymRisk: 'риск перекоса',
  tempoOff: 'темп не тот', romShort: 'амплитуда укорочена', cheating: 'читинг',
};
const flagRu = (f: string): string => FLAG_RU[f] || f;
const CIRC_RU: Record<string, string> = {
  heightCm: 'рост', weightKg: 'вес', chest: 'грудь', waist: 'талия', hips: 'бёдра', neck: 'шея',
  shoulderWidth: 'плечи', bicepL: 'бицепс Л', bicepR: 'бицепс П', bicep: 'бицепс',
  thighL: 'бедро Л', thighR: 'бедро П', calfL: 'голень Л', calfR: 'голень П',
  forearmL: 'предплечье Л', forearmR: 'предплечье П', wristCm: 'запястье',
};
const circRu = (k: string): string => CIRC_RU[k] || k;
const weakRu = (z: string): string => GRANULAR_OPTS.find((o) => o.id === z)?.label || MUSCLE_LABEL_RU[z] || z;
const weakListRu = (zs: string[]): string => zs.map(weakRu).join(' · ');


/* 3.11: единый парсинг плана ББ из localStorage (было 4 копии). */
export function pickPlanFromSaved(parsed: unknown): any | null {
  const j: any = parsed;
  if (Array.isArray(j) && j[0]?.plan?.weeks) return j[0].plan;
  if (j?.plan?.weeks) return j.plan;
  if (j?.weeks) return j;
  return null;
}
function readSavedBbPlanRaw(): string | null {
  try { return localStorage.getItem('he_bb_plan_saved') || localStorage.getItem('he_bb_plans'); } catch { return null; }
}
function readSavedBbPlan(): any | null {
  const raw = readSavedBbPlanRaw();
  if (!raw) return null;
  try { return pickPlanFromSaved(JSON.parse(raw)); } catch { return null; }
}

/** КТС: L/R приоритетнее legacy-одиночки; eff — худшая сторона (разница ≥2 см — см. драйвер). */
function ktwOf(s: { ktwL?: string; ktwR?: string; kneeToWallCm?: string }): { l: number | null; r: number | null; eff: number | null } {
  const num = (v: unknown): number | null => { const n = bbNum(v as any); return n != null && n >= 0 ? n : null; };
  const l = num(s.ktwL) ?? num(s.kneeToWallCm);
  const r = num(s.ktwR) ?? num(s.kneeToWallCm);
  return { l, r, eff: l != null && r != null ? Math.min(l, r) : (l ?? r) };
}

export const BBDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<BBState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Миграция legacy: одно значение КТС → обе стороны (дальше живут раздельно)
        if ((parsed.ktwL == null || parsed.ktwL === '') && (parsed.ktwR == null || parsed.ktwR === '') && parsed.kneeToWallCm) {
          parsed.ktwL = parsed.ktwR = parsed.kneeToWallCm;
        }
        const merged: BBState = { ...DEFAULT_STATE, ...parsed, circ: { ...DEFAULT_STATE.circ, ...(parsed.circ || {}) } };
        // Миграция BB-G-05: старый снимок без `poseView` не должен ломать выбор ракурса
        // (движок читает BB_POSE_VIDEO_GUIDE[view] — undefined уронил бы карточку).
        if (merged.poseView !== 'front' && merged.poseView !== 'side') merged.poseView = 'front';
        // Миграция BB-G-05 (2): до разделения по ракурсам был один `poseResult: BbPoseSummary`.
        // Не теряем замер: кладём его в тот ракурс, который в нём записан.
        const legacyPose = (parsed as any)?.poseResult as BbPoseSummary | null | undefined;
        merged.poseResults = {
          front: merged.poseResults?.front ?? null,
          side: merged.poseResults?.side ?? null,
        };
        merged.poseApplied = {
          front: !!merged.poseApplied?.front,
          side: !!merged.poseApplied?.side,
        };
        if (legacyPose && typeof legacyPose === 'object' && (legacyPose.view === 'front' || legacyPose.view === 'side')) {
          if (!merged.poseResults[legacyPose.view]) merged.poseResults[legacyPose.view] = legacyPose;
          if ((parsed as any)?.poseApplied === true) merged.poseApplied[legacyPose.view] = true;
        }
        return merged;
      }
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<BBTab>('weak');
  const [toast, setToast] = useState<string>('');
  /**
   * Скрининг «пройден» только после реального ввода. Дефолтные OHS-галочки все `true`
   * (пользователь ещё ничего не отмечал) — без этого флага чистый стор печатал бы
   * «Присед-тест 6/6 · хорошо» и «Драйвер не найден — паттерн чистый».
   */
  const touchScreen = () => setState((s) => (s.screenTouched ? s : { ...s, screenTouched: true, screenDoneAt: localIsoDate() }));
  const [measureHist, setMeasureHist] = useState<MeasureSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem('he_bb_measure_history');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((s) => s && typeof s.date === 'string' && s.meas) : [];
    } catch { return []; }
  });
  const [hasInjectPrev, setHasInjectPrev] = useState<boolean>(() => {
    try { return !!localStorage.getItem('he_bb_plan_saved_prev'); } catch { return false; }
  });
  // Нонс перечитывания плана из хранилища (инъекция/откат меняют его мимо мемов)
  const [planNonce, setPlanNonce] = useState(0);
  // PRO-5 Э2: профиль читают мемы — бампим тик по profile-updated/storage (правка профиля без ремаунта)
  const [profileNonce, setProfileNonce] = useState(0);
  // PRO-CORR: после записи he_bb_lr_history (applyToConstructor) флип-гейт и lrDirection
  // считались по СТАРОМУ срезу — текст и мост уезжали на один клик назад.
  const [lrHistNonce, setLrHistNonce] = useState(0);
  useEffect(() => {
    const bump = () => setProfileNonce((t) => t + 1);
    try {
      window.addEventListener('profile-updated', bump as EventListener);
      window.addEventListener('storage', bump as EventListener);
    } catch { /* noop */ }
    return () => {
      try {
        window.removeEventListener('profile-updated', bump as EventListener);
        window.removeEventListener('storage', bump as EventListener);
      } catch { /* noop */ }
    };
  }, []);

  /**
   * AUDIT 2026-11: 40+ мест делали `setTimeout(() => setToast(''), N)` без очистки.
   * Таймеры жили после размонтирования (тост-апдейт по мёртвому дереву), а быстрые
   * подряд тосты гасили друг друга раньше времени. Один таймер + очистка по unmount.
   */
  const toastTimer = useRef<number | null>(null);
  const scheduleToastClear = useCallback((ms = 2200) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), ms);
  }, []);
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {
      // Тихий отказ терял настройки хаба (замеры/скрининг) без единого сигнала.
      setToast('⚠ Настройки хаба не сохранились — переполнено хранилище (очисти старые планы/замеры)');
      scheduleToastClear(3000);
    }
  }, [state, scheduleToastClear]);
  // Э4 PRO-5: поиск упражнения в «Разборе» (план — первыми, каталог без произвольного среза)
  const [exQuery, setExQuery] = useState('');
  // Э6 PRO-5: LVP-калибровка (движок был без UI-потребителя) — аккордеон в «Разборе»
  const [lvpLift, setLvpLift] = useState('squat');
  const [lvpText, setLvpText] = useState('');
  const [lvpProfile, setLvpProfile] = useState<BbLvpProfile | null>(null);
  const [lvpSaved, setLvpSaved] = useState<number>(() => { try { return Object.keys(loadBbLvpProfiles()).length; } catch { return 0; } });

  const level = useMemo(() => {
    try { const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}'); return p?.settings?.training?.level || p?.training?.level || 'intermediate'; } catch { return 'intermediate'; }
  }, [profileNonce]);

  // Оборудование зала из профиля — фильтр кандидатов (без него — весь каталог)
  const profileEquipment = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const eq = p?.settings?.training?.equipment ?? p?.training?.equipment;
      if (Array.isArray(eq)) {
        const clean = eq.map((s) => String(s)).filter(Boolean);
        return clean.length ? clean : undefined;
      }
      return undefined;
    } catch { return undefined; }
  }, [profileNonce]);

  // K3: рабочие максимумы профиля для веса коррекций (точный id упражнения → мышца).
  // Единый вход карточки и вставки («показано = вставится»); нет данных — движок честно без кг.
  const profileWorkMax = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const t = p?.settings?.training ?? p?.training;
      const byMuscle = (t?.workMax || {}) as Record<string, number>;
      const byEx = (t?.workMaxByExercise || {}) as Record<string, number>;
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(byEx)) { const n = Number(v); if (Number.isFinite(n) && n > 0) out[k] = n; }
      for (const [k, v] of Object.entries(byMuscle)) { const n = Number(v); if (Number.isFinite(n) && n > 0) out[k] = n; }
      return Object.keys(out).length ? out : undefined;
    } catch { return undefined; }
  }, [profileNonce]);

  // K4: ограничения мобильности профиля — гейт кандидатов инъекции (те же каноны, что у билдера).
  const profileMobility = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const m = p?.settings?.training?.mobilityRestrictions ?? p?.training?.mobilityRestrictions;
      if (Array.isArray(m)) {
        const clean = m.map((s) => String(s)).filter(Boolean);
        return clean.length ? clean : undefined;
      }
      return undefined;
    } catch { return undefined; }
  }, [profileNonce]);

  // Пол и сон — из профиля (единый источник; в хабе своих селектов нет, без дублей)
  const profileSex = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const s = p?.settings?.personal?.sex ?? p?.personal?.sex;
      return s === 'female' || s === 'male' ? (s as 'male' | 'female') : '';
    } catch { return ''; }
  }, [profileNonce]);
  const profileSleep = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const n = Number(p?.settings?.lifestyle?.sleepHours ?? p?.lifestyle?.sleepHours);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  }, [profileNonce]);
  // R6: возраст из профиля — гейт нагруженных проб для 14–15 (прецедент teenNotes ББ-авто)
  const profileAge = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const a = Number(p?.settings?.personal?.age ?? p?.personal?.age);
      return Number.isFinite(a) && a > 0 ? a : null;
    } catch { return null; }
  }, [profileNonce]);
  const teenGate = useMemo(() => teenLoadedGate(profileAge), [profileAge]);
  // state.sex — замороженный легаси-фолбэк (UI-селекта больше нет); профиль приоритетнее
  const effSex = ((profileSex || state.sex || '') as '' | 'male' | 'female');

  /**
   * AUDIT 2026-11: дневник читался ОДИН раз при монтировании (deps=[]), поэтому
   * тренировка, записанная в другой вкладке/экране, не попадала в диагностику до
   * перезагрузки. Обновляем при возврате к приложению и при storage-событии.
   */
  const [diaryNonce, setDiaryNonce] = useState(0);
  useEffect(() => {
    const bump = () => setDiaryNonce(n => n + 1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || /he_workout_log|he_bb_diagnostics_hub/.test(e.key)) bump();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') bump(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', bump);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const diarySessions: any[] = useMemo(() => {
    // ROUND-10: единый адаптер (живой he_workout_log_v2; цепочка `||` с `'[]'` глушила v2)
    try { return loadHubDiarySessions(); } catch { return []; }
  }, [diaryNonce]);

  const factVolume = useMemo(() => {
    try {
      // последние 7 дней факт (effective). Окно — КАЛЕНДАРНОЕ (localIsoDateOffset):
      // `new Date('YYYY-MM-DD')` — полночь UTC, и в зонах UTC− окно съезжало на сутки
      // (сессия 6-дневной давности выпадала/заезжала).
      const from = localIsoDateOffset(-7);
      const recent = diarySessions.filter((s: any) => {
        const d = String(s.date || '').slice(0, 10);
        return d && d >= from;
      });
      if (recent.length === 0) return null;
      // 3.11: факт-объём через канонический aggregateBBVolume (direct + EMG-indirect),
      // а не своя сумма «direct = effective» без косвенной нагрузки.
      const exercises = recent.flatMap((s: any) => ((s.exercises || []) as any[]).map((ex) => ({
        name: String(ex.exerciseName || ex.name || ''),
        muscle: String(ex.muscleGroup || ex.muscle || '').toLowerCase(),
        sets: Array.isArray(ex.sets) ? ex.sets.length : Math.max(0, Number(ex.sets) || 0),
        rir: Number(ex.rir) || 2,
        role: 'accessory' as const,
      })).filter((e) => e.muscle && e.sets > 0));
      if (exercises.length === 0) return null;
      return aggregateBBVolume([{ exercises }]);
    } catch { return null; }
  }, [diarySessions]);

  const perMuscleAcwr = useMemo(() => {
    try { return computePerMuscleACWR(diarySessions as any); } catch { return {}; }
  }, [diarySessions]);

  // Э5-доводка (R6): сохранённый план читается ОДИН раз на рендер (было 3 точки readSavedBbPlan)
  const savedPlan = useMemo(() => {
    try { return readSavedBbPlan(); } catch { return null; }
  }, [planNonce, diarySessions]);

  const balance = useMemo(() => {
    try {
      if (savedPlan?.weeks) return analyzeBBBalance(savedPlan);
      return null;
    } catch { return null; }
  }, [savedPlan]);

  const ohs = useMemo(() => assessOHS({
    heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
    trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
    kneeToWallCm: ktwOf(state).eff,
    ankleDorsiflexDeg: bbNum(state.ankleDeg),
    shoulderFlexionDeg: bbNum(state.shoulderFlexDeg),
    heelRaiseRetest: state.heelRetest === 'better' ? true : state.heelRetest === 'same' ? false : null,
  }), [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ktwL, state.ktwR, state.kneeToWallCm, state.ankleDeg, state.heelRetest, state.shoulderFlexDeg]);

  // P1: L/R-объём из дневника + флип-гейт по истории (D2: сторона плавает — шум измерения,
  // добивку не фиксируем; стабильная сторона ≥3 замеров — добивка оправдана).
  const lrVerdicts = useMemo(() => {
    try {
      const base = lrVerdictsFromSessions(diarySessions as any);
      let hist: BbLrSnapshot[] = [];
      try {
        const raw = localStorage.getItem('he_bb_lr_history');
        hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      } catch { /* noop */ }
      return base.map((v) => {
        if ((v.verdict === 'topup' || v.verdict === 'watch') && v.weakSide) {
          try {
            const d = summarizeLrDirection(hist, v.group);
            if (d && d.flipped && !d.persistent) {
              return { ...v, verdict: 'watch' as const, topUpSets: 0, text: `${v.text} · сторона плавает — шум измерения, добивку не фиксируем` };
            }
          } catch { /* noop */ }
        }
        return v;
      });
    } catch { return []; }
  }, [diarySessions, lrHistNonce]);
  // P2/P3: готовность + красные флаги
  const redFlags = useMemo(() => {
    try {
      return assessBbRedFlags({ acutePain: state.acutePain, swelling: state.swelling, numbness: state.numbness, jointClickPain: state.jointClickPain });
    } catch { return { active: false, blocked: false, items: [], text: '' } as any; }
  }, [state.acutePain, state.swelling, state.numbness, state.jointClickPain]);
  const readiness = useMemo(() => {
    try {
      // Сон — из профиля; боль — из pain-monitoring (pmDuring/pmMorning), если её
      // вводили; ACWR — из дневника. Важно: без данных это «нет данных», а не
      // измеренный ноль — раньше Number(null)=0 давал зелёный «можно включая добивки».
      const sl = profileSleep;
      const hasAcwr = Object.keys(perMuscleAcwr as any).length > 0;
      const danger = Object.values(perMuscleAcwr as any).filter((v: any) => v?.zone === 'dangerous').length;
      // Боль 0–10: берём худшую из «во время» и «на след. утро» — восстановление
      // определяется не лучшим показателем. (painMon объявлен ниже — читаем поля напрямую.)
      const p1 = bbNum(state.pmDuring);
      const p2 = bbNum(state.pmMorning);
      const pain = (p1 != null || p2 != null) ? Math.max(p1 ?? 0, p2 ?? 0) : null;
      return assessBbReadiness({
        sleepHours: Number.isFinite(sl as number) ? (sl as number) : null,
        pain010: pain,
        vbtLossPct: null,
        dangerMuscles: hasAcwr ? danger : null,
      });
    } catch { return { level: 'yellow', reasons: [], advice: '', tested: false, noData: true } as any; }
  }, [profileSleep, perMuscleAcwr, state.pmDuring, state.pmMorning]);
  // PRO-3 R2 + PRO-4 S3: return-to после стоп-флагов (ступень выбирается вручную) — гейт вставки
  const returnToPlan = useMemo(() => {
    try { return buildReturnToPlan(redFlags as any); } catch { return null; }
  }, [redFlags]);
  const returnActive = useMemo(() => {
    try { return activeReturnToStage(returnToPlan as any, state.returnStage as any); } catch { return null; }
  }, [returnToPlan, state.returnStage]);
  // П2: измеримые критерии выхода (pain-monitoring). Ничего не двигает автоматически.
  const chipStyle = (on: boolean) => ({
    minHeight: 44, padding: '8px 12px', borderRadius: 999,
    border: '1px solid', borderColor: on ? '#22c55e' : 'rgba(255,255,255,0.12)',
    background: on ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
    color: on ? '#22c55e' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  });
  const returnCriteria = useMemo(() => {
    try {
      return evaluateReturnToCriteria({
        painDuringLoad: state.retPainLoad,
        painNextMorning: state.retPainMorning,
        morningStiffness: state.retStiffness,
        plyoTolerated: state.retPlyo,
      });
    } catch { return null; }
  }, [state.retPainLoad, state.retPainMorning, state.retStiffness, state.retPlyo]);
  // PRO-3 R6: направление перекоса (история слабых сторон)
  const lrDirection = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_bb_lr_history');
      const hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      const out: Array<{ group: string; text: string }> = [];
      for (const v of lrVerdicts.slice(0, 2)) {
        const d = summarizeLrDirection(hist, v.group);
        if (d) out.push({ group: v.group, text: d.text });
      }
      return out;
    } catch { return []; }
  }, [lrVerdicts, lrHistNonce]);

  const measNum: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(state.circ)) {
      const n = bbNum(v as string);
      if (n != null && n > 0) out[k] = n;
    }
    return out;
  }, [state.circ]);

  const report = useMemo(() => buildBBDiagnosticsReport({
    level,
    factVolume: factVolume as any,
    sessions: diarySessions as any,
    meas: measNum as any,
    heightCm: measNum.heightCm ?? null,
    plan: savedPlan as any,
    balance,
    // AUDIT 2026-11: ACWR считается строкой выше и уже стоит в чипах — он обязан
    // доходить и до балла (пол «ACWR danger → ≤59»), иначе чип красный, а цифра целая.
    perMuscleAcwr: (perMuscleAcwr as any) || null,
    mobilityFails: state.screenTouched ? ohs.failed : 0,
    vbtLossPct: null,
    hasDiary: diarySessions.length > 0,
    hasCircumf: Object.keys(measNum).some(k => ['chest','waist','bicepL','bicepR','thighL','thighR'].includes(k)),
    // Канал «скорость» подтверждён, если есть калиброванный LVP-профиль (реальные
    // замеры скорость-вес). Раньше здесь стояло false — 100% проверки были недостижимы.
    hasVbt: lvpSaved > 0,
    manualWeak: state.weakManual,
  }), [level, factVolume, diarySessions, measNum, balance, ohs.failed, state.screenTouched, state.weakManual, savedPlan, perMuscleAcwr, lvpSaved]);

  /**
   * BB-D-39: append-only история балла. Раньше хаб не сохранял результат — сравнить
   * «до/после блока» было нечем. Дедуп по дате: повторный заход за день перезаписывает
   * сегодняшнюю запись (балл мог измениться после ввода данных).
   */
  const [diagHistory, setDiagHistory] = useState<DiagHistoryEntry[]>(() => readDiagHistory());
  useEffect(() => {
    try {
      const list = appendDiagHistory({
        date: localIsoDate(),
        score: report.score.score,
        level: report.score.level,
        floors: report.score.floors,
        weakZones: report.weakZonesGranular,
      });
      setDiagHistory((prev) => (prev.length === list.length && prev.every((e, i) => e.date === list[i].date && e.score === list[i].score) ? prev : list));
    } catch { /* история не критична — отчёт важнее */ }
  }, [report.score.score, report.score.level, report.score.floors.join('|'), report.weakZonesGranular.join('|')]);
  const diagTrend = useMemo(() => diagHistoryTrend(diagHistory), [diagHistory]);

  /**
   * BB-G-01: панель «Объём · Recovery · Mobility». ACWR, ориентиры MEV/MAV/MRV и
   * провалы мобилити считались по отдельности (строка подсказок), но нигде не
   * сходились в ответ «что ограничивает рост». Панель собирает три канала и
   * выбирает один ограничитель по приоритету (боль → сон → ACWR → MRV → мобилити).
   */
  const painWorst = useMemo(() => {
    const p1 = bbNum(state.pmDuring);
    const p2 = bbNum(state.pmMorning);
    return (p1 != null || p2 != null) ? Math.max(p1 ?? 0, p2 ?? 0) : null;
  }, [state.pmDuring, state.pmMorning]);

  /** BB-G-04: журнал вставок коррекций (до/после по зоне через 4–6 нед). */
  const [injections, setInjections] = useState<DiagInjection[]>(() => readDiagInjections());

  const vrPanel = useMemo(() => {
    try {
      return buildVolumeRecoveryPanel({
        level,
        factVolume: factVolume as any,
        perMuscleAcwr: perMuscleAcwr as any,
        weakZones: report.weakZonesGranular,
        readiness: readiness as any,
        sleepHours: profileSleep,
        pain010: painWorst,
        mobilityFails: state.screenTouched ? (ohs.failed as any) : 0,
        mobilityChecked: !!state.screenTouched,
      });
    } catch {
      // Ошибка расчёта — честная панель «нет данных», а не падение хаба.
      return buildVolumeRecoveryPanel({ level, factVolume: null });
    }
  }, [level, factVolume, perMuscleAcwr, report.weakZonesGranular, readiness, profileSleep, painWorst, ohs.failed, state.screenTouched]);

  const corrEffect = useMemo(() => {
    try {
      return buildCorrectionEffect({ injections, sessions: diarySessions as any, today: localIsoDate() });
    } catch {
      return buildCorrectionEffect({ injections: [], sessions: [], today: localIsoDate() });
    }
  }, [injections, diarySessions]);

  /**
   * BB-G-02: deep-link в профильный экран. Хабу не нужен onNavigate из App —
   * TrainingScreen уже слушает `training-open-tab` (этим же путём открывается
   * сам хаб из виджета), достаточно расширить белый список целей.
   */
  const goToScreen = useCallback((target: string) => {
    try { window.dispatchEvent(new CustomEvent('training-open-tab', { detail: target })); } catch { /* нет window — тест */ }
  }, []);

  // Э5-доводка (R3): макс перекос L/R — один мемо (было 5 копий расчёта в карточках/выдаче/мосте)
  const asymMax = useMemo(() => {
    try {
      const vals = Object.entries(report.symmetry.ratios).filter(([k]) => k.endsWith('_asym')).map(([, v]) => Number(v));
      return vals.length ? Math.max(...vals) : null;
    } catch { return null; }
  }, [report.symmetry.ratios]);

  // Скрининг v2: драйвер + односторонний + коды/снимок (чистые функции движка)
  const moveDriver = useMemo(() => {
    try {
      return resolveMovementDriver({
        heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
        trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
        kneeToWallCm: ktwOf(state).eff,
        kneeToWallL: ktwOf(state).l,
        kneeToWallR: ktwOf(state).r,
        ankleDeg: bbNum(state.ankleDeg),
        heelRetest: state.heelRetest === 'better' ? 'better' : state.heelRetest === 'same' ? 'same' : null,
        handsOnHipsBetter: state.handsOnHipsBetter || null,
        // R4: гастрокнемиус (прямое колено) + ROM сгибания бедра + задний наклон таза
        ktwStraightL: bbNum(state.ktwStraightL), ktwStraightR: bbNum(state.ktwStraightR),
        hipFlexionDeg: bbNum(state.hipFlexDeg),
        ppTilt: state.ppTilt,
        // Пока скрининг не тронут — «не заполнен», а не «паттерн чистый».
        tested: state.screenTouched,
      });
    } catch { return { driver: 'none', label: '—', fix: '', confidence: 0, tested: false } as any; }
  }, [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ktwL, state.ktwR, state.kneeToWallCm, state.ankleDeg, state.heelRetest, state.handsOnHipsBetter, state.ktwStraightL, state.ktwStraightR, state.hipFlexDeg, state.ppTilt, state.screenTouched]);
  const singleLeg = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n >= 0 ? n : null; };
      return singleLegVerdict({
        splitSquatL: (state.splitL || null) as any, splitSquatR: (state.splitR || null) as any,
        rdlL: (state.rdlL || null) as any, rdlR: (state.rdlR || null) as any,
        fppaL: num(state.fppaL), fppaR: num(state.fppaR),
      });
    } catch { return { weakSide: null, text: 'Односторонний: ошибка расчёта — данные не учтены', tested: false } as any; }
  }, [state.splitL, state.splitR, state.rdlL, state.rdlR, state.fppaL, state.fppaR]);
  // D1–D5: плечо/шарнир/YBT/асимметрии/замены (чистые мемы, без TDZ — выше экспорта/моста)
  const shoulderV = useMemo(() => {
    try {
      // Не проверялся → pass=false + tested=false: иначе UI красил «непройденный»
      // скрининг зелёным («всё чисто»), хотя замеров не было.
      if (!state.screenTouched) return { pass: false, fails: [], locus: 'ok', text: 'Плечо у стены: не проверялся', tested: false } as any;
      return shoulderWallVerdict({
        backOnWall: state.shBackOnWall, headOnWall: state.shHeadOnWall, bicepsAtEars: state.shBicepsAtEars,
        ribsDown: state.shRibsDown, noShrug: state.shNoShrug,
      });
    } catch { return { pass: true, fails: [], locus: 'ok', text: '', tested: false } as any; }
  }, [state.shBackOnWall, state.shHeadOnWall, state.shBicepsAtEars, state.shRibsDown, state.shNoShrug, state.screenTouched]);
  const rotV = useMemo(() => {
    try {
      const n = (v: string): number | null => { const x = bbNum(v); return x != null && x >= 0 ? x : null; };
      return thoracicRotationVerdict({ rotL: n(state.rotL), rotR: n(state.rotR) });
    } catch { return { text: '', gap: null, low: false } as any; }
  }, [state.rotL, state.rotR]);
  const hingeV = useMemo(() => {
    try { return hingeVerdict((state.hingeDowel || null) as any); } catch { return { pass: true, locus: 'not_tested', text: '' } as any; }
  }, [state.hingeDowel]);
  const loadedV = useMemo(() => {
    try {
      // Teen-гейт: рабочая нагрузка у 14–15 не измеряется (прецедент teenNote ББ-авто).
      if (teenGate.blocked) return { degraded: false, text: teenGate.note };
      return loadedSquatVerdict({
        bodyweight: (state.sqBody || null) as any, bar: (state.sqBar || null) as any, working: (state.sqWork || null) as any,
      });
    } catch { return { degraded: false, text: '' }; }
  }, [state.sqBody, state.sqBar, state.sqWork, teenGate]);
  const ybtV = useMemo(() => {
    try {
      return ybtLqVerdict({
        antL: bbNum(state.ybtL), antR: bbNum(state.ybtR), shinCm: bbNum(state.shinCm),
        pmL: bbNum(state.ybtPmL), pmR: bbNum(state.ybtPmR), plL: bbNum(state.ybtPlL), plR: bbNum(state.ybtPlR),
        limbCm: bbNum(state.limbCm),
      });
    } catch { return { tested: false, asymCm: null, compositePct: null, compositeFull: false, warn: false, text: '' } as any; }
  }, [state.ybtL, state.ybtR, state.shinCm, state.ybtPmL, state.ybtPmR, state.ybtPlL, state.ybtPlR, state.limbCm]);
  const asymText = useMemo(() => {
    try {
      const n = (v: string): number | null => bbNum(v);
      const kl = n(state.ktwL); const kr = n(state.ktwR);
      const fl = n(state.fppaL); const fr = n(state.fppaR);
      return asymPriorityText({
        ktwGapCm: kl != null && kr != null ? Math.abs(kl - kr) : null,
        fppaGapDeg: fl != null && fr != null ? Math.abs(fl - fr) : null,
        ybtAsymCm: (ybtV as any)?.asymCm ?? null,
        rotGapDeg: (rotV as any)?.gap ?? null,
      });
    } catch { return ''; }
  }, [state.ktwL, state.ktwR, state.fppaL, state.fppaR, ybtV, rotV]);
  const driverSubs = useMemo(() => {
    try { return substitutesForDriver((moveDriver as any)?.driver); } catch { return { avoid: [], prefer: [], note: '' } as any; }
  }, [moveDriver]);
  // ── R1–R6 PRO-2: жим / боль-мониторинг / задняя цепь / шарнир-нагрузка / ER:IR (чистые мемы) ──
  const benchV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n > 0 ? n : null; };
      return benchScreenVerdict({
        gripCm: num(state.benchGripCm),
        biacromialCm: num(state.circ.shoulderWidth),
        touchPoint: (state.benchTouch || null) as any,
        scapula: (state.benchScapula || null) as any,
        abductionDeg: num(state.benchAbduction),
        elbowsBelowBench: state.benchElbowsBelow,
        pain: state.benchPain,
      });
    } catch { return benchScreenVerdict({}); }
  }, [state.benchGripCm, state.circ.shoulderWidth, state.benchTouch, state.benchScapula, state.benchAbduction, state.benchElbowsBelow, state.benchPain]);
  const painMon = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n >= 0 ? n : null; };
      const input = {
        location: (state.pmLoc || null) as any,
        during010: num(state.pmDuring),
        nextMorning010: num(state.pmMorning),
        weeksRising: state.pmRising,
        nightPain: state.pmNight,
        sharp: state.pmSharp,
      };
      return { verdict: painMonitorVerdict(input), line: painMonitorLine(input) };
    } catch { return { verdict: painMonitorVerdict({}), line: '' }; }
  }, [state.pmLoc, state.pmDuring, state.pmMorning, state.pmRising, state.pmNight, state.pmSharp]);
  const painJointTendon = useMemo(() => {
    try {
      const joint = state.pmLoc === 'elbow' ? 'elbow' : state.pmLoc === 'shoulder' ? 'shoulder' : null;
      if (!joint || !diarySessions.length) return null;
      const g = assessBbTendonGuard(diarySessions as any, {
        level,
        painRedJoint: painMon.verdict.level === 'red' ? joint : null,
        // W2: оживлены мёртвые параметры. `elbowPain` — заявленная боль в этом суставе
        // (любой уровень, не только красный); `shoulderOhsFail` — провал плеча в
        // присед-тесте (стеновый тест). Без них сухожильный стоп не видел ни того, ни
        // другого, хотя хаб эти данные собирает.
        elbowPain: state.pmLoc === 'elbow' && painMon.verdict.tested,
        
      });
      return (g as any)[joint] as { text: string; level: string } | null;
    } catch { return null; }
  }, [state.pmLoc, diarySessions, level, painMon.verdict.level, painMon.verdict.tested, shoulderV]);
  const nheV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n >= 0 ? n : null; };
      const angle = num(state.nheAngle);
      return nheVerdict({ repsL: num(state.nheL), repsR: num(state.nheR), breakAngleL: angle, breakAngleR: angle });
    } catch { return nheVerdict({}); }
  }, [state.nheL, state.nheR, state.nheAngle]);
  const adductorV = useMemo(() => {
    try {
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n > 0 ? n : null; };
      return adductorVerdict({ squeezeL: num(state.addL), squeezeR: num(state.addR), cphLevel: (state.cphLevel || '') as any });
    } catch { return adductorVerdict({}); }
  }, [state.addL, state.addR, state.cphLevel]);
  const loadedHingeV = useMemo(() => {
    try {
      if (teenGate.blocked) return { degraded: false, text: teenGate.note };
      return loadedHingeVerdict({ rdl: (state.rdlLoaded || null) as any, floor: (state.floorLoaded || null) as any });
    } catch { return { degraded: false, text: '' }; }
  }, [state.rdlLoaded, state.floorLoaded, teenGate]);
  const erIrV = useMemo(() => {
    try {
      if (teenGate.blocked) return erIrVerdict({});
      const num = (v: string): number | null => { const n = bbNum(v); return n != null && n > 0 ? n : null; };
      return erIrVerdict({ erKg: num(state.erKg), irKg: num(state.irKg) });
    } catch { return erIrVerdict({}); }
  }, [state.erKg, state.irKg, teenGate]);
  const ohsCodes = useMemo(() => {
    try {
      return ohsFailCodes({
        heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
        trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
        ppTilt: state.ppTilt,
      });
    } catch { return []; }
  }, [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.ppTilt]);
  // П1: D1–D5 коды снимка из вердиктов (только провалы; чисто — тихо).
  const d1d5Codes = useMemo(() => {
    try {
      return d1d5FailCodes({
        shoulder: { pass: !!(shoulderV as any).pass, locus: String((shoulderV as any).locus || '') },
        rotGap: (rotV as any).gap ?? null,
        rotLow: !!(rotV as any).low,
        hinge: { pass: !!(hingeV as any).pass, locus: String((hingeV as any).locus || '') },
        loadedDegraded: !!(loadedV as any).degraded,
        ybtAsymCm: (ybtV as any).asymCm ?? null,
        ybtCompositePct: (ybtV as any).compositePct ?? null,
        ybtTested: !!(ybtV as any).tested,
      });
    } catch { return []; }
  }, [shoulderV, rotV, hingeV, loadedV, ybtV]);
  // R7: R1–R6 коды снимка (жим/боль/NHE/аддукторы/бедро/шарнир-нагрузка/ER:IR)
  const v3Codes = useMemo(() => {
    try {
      const n = (v: string): number | null => bbNum(v);
      return v3FailCodes({
        benchLevel: benchV.level,
        nheAsymReps: nheV.asymReps,
        addAsymPct: adductorV.asymPct,
        painLevel: painMon.verdict.level,
        hipFlexionDeg: n(state.hipFlexDeg),
        ppTilt: state.ppTilt,
        loadedHingeDegraded: teenGate.blocked ? false : loadedHingeV.degraded,
        erIrRatio: teenGate.blocked ? null : erIrV.ratio,
      });
    } catch { return []; }
  }, [benchV.level, nheV.asymReps, adductorV.asymPct, painMon.verdict.level, state.hipFlexDeg, state.ppTilt, teenGate.blocked, loadedHingeV.degraded, erIrV.ratio]);
  const screenCodes = useMemo(() => Array.from(new Set([...ohsCodes, ...d1d5Codes, ...v3Codes])), [ohsCodes, d1d5Codes, v3Codes]);
  const screenPriority = useMemo(() => {
    try {
      return screenPriorityList({
        painLevel: painMon.verdict.level,
        painText: painMon.line,
        driver: moveDriver as any,
        asymText,
        tendon: painJointTendon && painJointTendon.level === 'stop' ? { level: 'stop', text: painJointTendon.text } : null,
        bench: { level: benchV.level, text: benchV.text },
        posterior: { nhe: nheV.tested ? nheV.text : null, adductor: adductorV.tested ? adductorV.text : null },
        loadedHinge: { degraded: teenGate.blocked ? false : loadedHingeV.degraded, text: loadedHingeV.text },
        // Wave-0 Э0.7 (проверено): `erIr` здесь — это локальный параметр движка
        // screenPriorityList (ScreenPriorityInput.erIr), НЕ поле моста. Контракт бриджа
        // (`erir`) собирается отдельно на строках выше/ниже и там уже корректен.
        // Переименовывать здесь нельзя — иначе строка ER:IR молча пропадёт из приоритетов.
        erIr: erIrV.tested ? { warn: erIrV.warn, text: erIrV.text } : null,
      });
    } catch { return []; }
  }, [painMon, moveDriver, asymText, painJointTendon, benchV, nheV, adductorV, loadedHingeV, erIrV, teenGate.blocked]);
  const [screenHist, setScreenHist] = useState<MovementSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem('he_bb_screen_history');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((s) => s && typeof s.date === 'string' && Array.isArray(s.fails)) : [];
    } catch { return []; }
  });
  const screenDelta = useMemo(() => {
    try {
      const prev = screenHist.length ? screenHist[screenHist.length - 1] : null;
      return movementDelta(prev, screenCodes);
    } catch { return { fixed: [], regressed: [], tracked: [], text: '' } as any; }
  }, [screenHist, screenCodes]);

  const score = report.score.score;
  const sLevel = report.score.level;
  // BB-D-05 (хвост): 100 при пустых входах — арифметика композита, а не измерение.
  // Пока не тронут скрининг, нет ЗАМЕРОВ, дневника, выбранного упражнения и ручных
  // слабых зон, балл — «—» серым: иначе новый пользователь читает «100 ОК» как «всё отлично».
  // Замер = значение, отличное от предзаполненной заглушки (175/80 в DEFAULT_STATE.circ):
  // это подсказка для долей, а не измерение пользователя.
  const enteredMeasures = Object.keys(measNum).filter((k) => String((state.circ as any)[k] ?? '') !== String((DEFAULT_STATE.circ as any)[k] ?? ''));
  const noDataAtAll = !state.screenTouched
    && diarySessions.length === 0
    && enteredMeasures.length === 0
    && !state.exerciseSelectedId
    && state.weakManual.length === 0
    // Разбор видео (BB-G-05) — это измерение: с ним балл уже посчитан по данным.
    && !state.poseResults.front && !state.poseResults.side
    // Сохранённый план — это уже данные: хаб его аудирует (баланс/стимул/объём).
    && !savedPlan;
  const sColor = noDataAtAll ? '#94a3b8' : bbScoreColor(sLevel);
  const sLabel = noDataAtAll ? 'НЕТ ДАННЫХ' : sLevel === 'ok' ? 'ОК' : sLevel === 'warn' ? 'ВНИМАНИЕ' : 'КРИТИЧНО';
  // Фокус внимания: изоляция слабой зоны → внутренний, иначе внешний (нагрузка %1RM — в Анализе силы)
  const mmcAdvice = useMemo(() => {
    try {
      const iso = (report.weakZonesGranular || []).length > 0;
      return mmcAdviceFor({ isolation: iso, loadPct1RM: null, explosive: false });
    } catch { return null; }
  }, [report]);
  // Э5-доводка (R5): MMC-строка — одна (карточка/мост/экспорт)
  const mmcLine = useMemo(() => {
    try {
      const a = mmcAdvice;
      return a ? `${a.focus === 'internal' ? 'Внутренний' : 'Внешний'} фокус: ${a.cue} — ${a.text}` : null;
    } catch { return null; }
  }, [mmcAdvice]);

  // ── MAX PRO: причины слабых + McCallum + триада + спец-блок + топ-3 ──
  const wristNum = bbNum(state.wristCm) ?? NaN;
  const mcCallum = useMemo(() => (Number.isFinite(wristNum) && wristNum > 0 ? idealMcCallumMap(wristNum) : null), [wristNum]);
  const triadDev = useMemo(() => {
    try {
      const n = (k: string): number | null => { const v = bbNum((state.circ as any)[k]); return v != null && v > 0 ? v : null; };
      const b = n('bicepL') ?? n('bicepR') ?? (measNum as any).bicep ?? null;
      const c = n('calfL') ?? n('calfR') ?? null;
      const nk = n('neck');
      return symmetryTriadDeviation({ neck: nk, bicep: b, calf: c });
    } catch { return null; }
  }, [state.circ, measNum]);

  const toggleWeak = (id: string) => {
    setState(s => {
      const has = s.weakManual.includes(id);
      let next: string[];
      if (has) next = s.weakManual.filter(x => x !== id);
      else {
        // проверка конфликта parent+zone
        if (s.weakManual.some(ex => isSpecializationTargetConflict(ex, id))) {
          setToast('Конфликт: плечи+зона нельзя, две зоны можно');
          scheduleToastClear(2000);
          return s;
        }
        next = [...s.weakManual, id].slice(0, 2);
      }
      return { ...s, weakManual: next };
    });
  };

  const applyToConstructor = () => {
    if (report.weakMusclesCanonical.length === 0) {
      setToast('Слабые зоны не выбраны — выберите 1-2 (или заполните дневник/замеры для авто)');
      scheduleToastClear(2500);
      return;
    }
    // MAX PRO payload: причины + топ-3 + спец-блок (лениво, без TDZ — считается внутри хендлера)
    let weakCausesPayload: Record<string, unknown> = {};
    let topIds: string[] = [];
    let weakHeads: string[] = [];
    let specPayload: unknown = null;
    // Э5 PRO-5: причины — то же мемо, что в карточке/экспорте (единый набор входов + auditFor)
    try { weakCausesPayload = weakCauses as Record<string, unknown>; } catch { /* noop */ }
    try {
      specPayload = specBlock;
      // PRO-CORR-FIX: в мост едет ТОТ ЖЕ порядок, что и в инъекцию/экспорт — ⭐-выбор
      // библиотеки первым, каталожный топ-3 только как добор. Раньше уходил чисто
      // top3ByZone, и выбор звезды в приёмнике расходился с показанным/вставленным.
      const seen = new Set<string>();
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        try {
          for (const r of (correctiveTopByZone[z] || [])) {
            const id = String(r.corr.exerciseId || '').toLowerCase();
            if (!id || seen.has(id)) continue;
            seen.add(id); topIds.push(r.corr.exerciseId);
          }
        } catch { /* noop */ }
        try {
          for (const r of (top3ByZone[z] || [])) {
            const id = String(r.id).toLowerCase();
            if (!id || seen.has(id)) continue;
            seen.add(id); topIds.push(r.id);
          }
        } catch { /* noop */ }
      }
      topIds = topIds.slice(0, 6);
      weakHeads = exportHeads;
    } catch { /* noop */ }
    // PRO-3 R6: копим направление перекоса (сырые стороны + дата) для динамики
    try {
      const raw = localStorage.getItem('he_bb_lr_history');
      let hist = raw ? (JSON.parse(raw) as BbLrSnapshot[]) : [];
      const today = localIsoDate();
      for (const v of lrVerdictsFromSessions(diarySessions as any).slice(0, 4)) {
        hist = pushLrSnapshot(hist, { date: today, group: v.group, weakSide: v.weakSide, asymPct: v.asymPct, verdict: v.verdict });
      }
      localStorage.setItem('he_bb_lr_history', JSON.stringify(hist));
      setLrHistNonce((n) => n + 1);
    } catch { /* noop */ }
    applyToPlanner({
      kind: 'weakpoints',
      label: `ББ-диагностика: ${report.weakZonesGranular.map(weakRu).join(', ')}`,
      data: {
        groups: report.weakZonesGranular,
        weakPoints: report.weakZonesGranular,
        weakZonesGranular: report.weakZonesGranular,
        weakMusclesCanonical: report.weakMusclesCanonical,
        bbDiagScore: score, bbDiagLevel: sLevel, verification: report.score.verification,
        symmetry: report.symmetry, stimulus: report.stimulus,
        // Движения, не нагрузка: скрининг + односторонний драйвер (ACWR/readiness/VBT/LVP/сон/боль — чужие хабы, в мост не едут)
        ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
        movementDriver: moveDriver,
        singleLeg,
        vbtLossPct: null,
        weakCauses: weakCausesPayload,
        preferredExerciseIds: topIds,
        // Э5 PRO-5: единая деталь коррекций библиотеки (карточка = экспорт = мост)
        correctiveDetail: correctiveDetailForExport,
        weakHeads,
        specBlock: specPayload,
        // MMC-строка: приёмник ББ-авто её уже читает (typeof string) — шлём тот же текст, что в карточке
        mmc: mmcLine,
        sleepHours: Number.isFinite(profileSleep as number) ? profileSleep : null,
        // G5: структурированный вердикт монитора боли (уровень + локация) — приёмник
        // ББ-авто передаёт это в движок (срез объёма/RIR по зоне), а не только текст.
        painLevel: (painMon.verdict.level === 'red' || painMon.verdict.level === 'yellow' || painMon.verdict.level === 'green')
          ? painMon.verdict.level : null,
        painLocation: state.pmLoc || null,
        soreness010: null,
        // Симметрия L/R — движения, с флип-гейтом (сторона плавает — без добивки); направление — из истории
        lrVerdicts,
        lrDirection,
        // D1–D5: плечо/шарнир/YBT/лопатка/видео + замены драйвера (всё опционально, приёмник только сохраняет/показывает)
        shoulder: (() => { try { return { pass: (shoulderV as any).pass, locus: (shoulderV as any).locus, text: (shoulderV as any).text }; } catch { return null; } })(),
        hinge: (() => { try { return { pass: (hingeV as any).pass, locus: (hingeV as any).locus, text: (hingeV as any).text, loaded: (loadedV as any).text }; } catch { return null; } })(),
        ybt: (() => { try { return { tested: (ybtV as any).tested, asymCm: (ybtV as any).asymCm, compositePct: (ybtV as any).compositePct, text: (ybtV as any).text }; } catch { return null; } })(),
        scapPain: (() => { try { return { painArc: state.painArc, winging: state.scapWinging, text: state.painArc || state.scapWinging ? 'Лопатка/дуга: есть замечания (скрининг, не диагноз)' : null }; } catch { return null; } })(),
        videoStandard: state.videoTwoAngles ? 'снято с 2 ракурсов' : null,
        driverSubs: (() => { try { return { prefer: (driverSubs as any).prefer, avoid: (driverSubs as any).avoid, note: (driverSubs as any).note }; } catch { return null; } })(),
        asymPriority: (() => { try { return asymText; } catch { return null; } })(),
        // Э1 PRO-5: возврат в работу — план ступеней (инфо) + ручная ступень + её исполняемое
        // действие для автосборки (BbAutoConstructor применяет через he_bb_return_action).
        ...(returnToPlan ? {
          returnTo: returnToPlan,
          returnStage: state.returnStage || null,
          returnAction: state.returnStage ? (returnActive?.action ?? null) : null,
        } : {}),
        // R1–R8 PRO-2: жим/боль/задняя цепь/шарнир-нагрузка/ER:IR/приоритет (инфо-слой, сборку не меняет §9.2)
        bench: benchV.tested ? { level: benchV.level, text: benchV.text } : null,
        painMon: painMon.line || null,
        posterior: nheV.tested || adductorV.tested ? { nhe: nheV.tested ? nheV.text : null, adductor: adductorV.tested ? adductorV.text : null } : null,
        loadedHinge: !teenGate.blocked && !/не проверялся/.test(loadedHingeV.text) ? { text: loadedHingeV.text } : null,
        erir: !teenGate.blocked && erIrV.tested ? { text: erIrV.text } : null,
        screenPriority: screenPriority.length ? screenPriority : null,
        // W5: честность статуса диагностики. ВСЁ это info-слой приёмника (bits/persist):
        // сборку плана он не меняет — применение только по кнопке пользователя.
        // W5: статус диагностики — info-слой приёмника (bits/persist), сборку не меняет.
        // Отдельым ключом, не legacy-каналом readiness (сон, боль, скорость - чужие хабы;
        diagStatus: {
          screenTouched: state.screenTouched,
          readinessLevel: (readiness as any)?.level ?? 'yellow',
          readinessNoData: !!(readiness as any)?.noData,
          ybtCompositeFull: !!(ybtV as any)?.compositeFull,
        },
      },
      // AUDIT 2026-11: раньше здесь стоял source:'intellectual', и planner-bridge
      // подставлял targetCycleId из ПЛ-сессии (window.__intellectual_cycle_id /
      // he_pl_session.selectedCycleId). Если последний цикл был силовым, приёмник
      // ББ-авто отбрасывал payload как «не ББ», а хаб уже показывал «✓ Применено».
      // Диагностика — это ББ-канал: source 'bb-auto' маршрутизируется только в ББ.
      source: 'bb-auto',
    });
    // «Отправлено», а не «Применено»: приёмник живёт в конструкторе и подтверждает
    // применение своим сообщением («Слабые группы → ББ-авто: …»).
    setToast(`→ Отправлено в ББ-авто: ${report.weakZonesGranular.map(weakRu).join(', ')} (оценка ${score})`);
    scheduleToastClear(3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'bb' } as any));
      localStorage.setItem('he_training_planning_track', 'bb');
    } catch {}
  };

  const applyMobilityToProfile = () => {
    const restrictions: string[] = [];
    if (!state.ohsHeelsFlat) restrictions.push('ankle');
    if (state.ohsKneeValgus) restrictions.push('hip');
    if (!state.ohsHipBelowParallel) restrictions.push('hip');
    if (!state.ohsTrunkUpright) restrictions.push('hip');
    if (!state.ohsArmsOverMidfoot) restrictions.push('shoulder');
    if (!state.ohsLumbarNeutral) restrictions.push('lower_back');
    // D1: провал плеча у стены — тоже плечо в профиль (тот же канал, без дублей)
    try { if (shoulderV && (shoulderV as any).tested && !(shoulderV as any).pass) restrictions.push('shoulder'); } catch { /* noop */ }
    const ktwEff = ktwOf(state).eff;
    if (ktwEff != null && ktwEff < 12) restrictions.push('ankle');
    const uniq = [...new Set(restrictions)];
    try {
      const raw = localStorage.getItem('he_profile_v2');
      const p = raw ? JSON.parse(raw) : {};
      // ЕДИНСТВЕННАЯ ошибка прошлого раунда: писали в корень (`p.health` / `p.training`),
      // а loadTrainingProfile читает `p.settings.training` → ББ-авто не видел ограничений.
      p.settings = p.settings || {};
      p.settings.training = p.settings.training || {};
      (p.settings.training as any).mobilityRestrictions = uniq;
      p.settings.health = p.settings.health || {};
      (p.settings.health as any).mobilityRestrictions = uniq;
      localStorage.setItem('he_profile_v2', JSON.stringify(p));
      try { window.dispatchEvent(new CustomEvent('profile-updated')); } catch {}
      const restrRu: Record<string, string> = { ankle: 'голеностоп', hip: 'таз', shoulder: 'плечо', lower_back: 'поясница' };
      setToast(`✓ Подвижность ${uniq.map((r) => restrRu[r] || r).join(', ') || 'в порядке'} → профиль (ББ-авто учтёт)`);
      scheduleToastClear(2500);
    } catch {}
  };

  // PRO-CORR-FIX: единый конструктор сигналов библиотеки — карточка, HTML- и CSV-экспорт
  // обязаны считать одним набором входов (иначе топ в файле ≠ показанному/вставленному).
  const corrSignalsFor = (z: string, cause: unknown) => {
    const drv = (() => { try { return String((moveDriver as any)?.driver || ''); } catch { return ''; } })();
    const pLevel = (() => { try { return String((painMon as any)?.verdict?.level || 'green'); } catch { return 'green'; } })();
    return {
      zones: [z],
      driver: drv && drv !== 'none' ? drv : null,
      benchLevel: (() => { try { return String((benchV as any)?.level || '') || null; } catch { return null; } })(),
      nheWeak: (() => { try { const l = String((nheV as any)?.level || ''); return l === 'weak' || l === 'very_weak'; } catch { return false; } })(),
      addWeak: (() => { try { return String((adductorV as any)?.level || '') === 'weak'; } catch { return false; } })(),
      erirLow: (() => { try { const r = (erIrV as any)?.ratio; return typeof r === 'number' && Number.isFinite(r) && r < 0.75; } catch { return false; } })(),
      painLevel: (pLevel === 'red' || pLevel === 'yellow' ? pLevel : 'green') as 'green' | 'yellow' | 'red',
      hingeFail: (() => { try { return !!((hingeV as any)?.pass === false); } catch { return false; } })(),
      shoulderFail: (() => { try { return !!((shoulderV as any)?.pass === false); } catch { return false; } })(),
      ybtAsym: (() => { try { const a = (ybtV as any)?.asymCm; return typeof a === 'number' && Number.isFinite(a) && a > 4; } catch { return false; } })(),
      ktwAsym: (() => { try { return String(asymText || '').includes('голеностоп'); } catch { return false; } })(),
      asym: asymMax != null && asymMax >= 7,
      teenBlocked: (() => { try { return !!teenGate.blocked; } catch { return false; } })(),
      shoulderPain: state.pmLoc === 'shoulder' && (pLevel === 'yellow' || pLevel === 'red'),
      rotGap: (() => { try { const g = (rotV as any)?.gap; return typeof g === 'number' && Number.isFinite(g) && g >= 10; } catch { return false; } })(),
      loadedFail: (() => { try { return teenGate.blocked ? false : !!loadedHingeV.degraded; } catch { return false; } })(),
      cause: (cause ?? null) as 'volume' | 'activation' | 'recovery' | 'technique' | 'genetics' | null,
      level, equipment: profileEquipment,
      // K5: топ библиотеки не должен быть занят планом (иначе зона остаётся без коррекции).
      inPlanIds: inPlanExerciseIds,
    };
  };

  // PRO-CORR-FIX П2-финал: единые флаги дозы — карточка, мост, оба экспорта и вставка
  // обязаны показывать/класть одно и то же («показано = вставится = экспортировано»).
  const corrDoseFlags = () => ({
    readinessRed: (readiness as any)?.level === 'red',
    painYellow: (() => { try { return String((painMon as any)?.verdict?.level || '') === 'yellow'; } catch { return false; } })(),
    painRed: (() => { try { return String((painMon as any)?.verdict?.level || '') === 'red'; } catch { return false; } })(),
  });

  // Э6 PRO-5: LVP-калибровка — валидный профиль (r²≥0.85) сохраняем, шумный честно не пишем
  const runLvp = () => {
    try {
      const pts = parseBbLvpText(lvpText);
      const p = calibrateBbLvp(lvpLift, pts);
      setLvpProfile(p);
      if (p && p.valid) {
        const store = saveBbLvpProfile(p);
        setLvpSaved(Object.keys(store).length);
        setToast(`✓ LVP ${p.lift}: e1RM ≈ ${p.e1rm} кг (r² ${p.r2}) — профиль сохранён`);
      } else {
        setToast(p ? `LVP: r² ${p.r2} — мало/шумно, профиль не сохранён` : 'LVP: нужно 3+ точки с разбросом (формат «вес скорость»)');
      }
      scheduleToastClear(3000);
    } catch { /* noop */ }
  };
  const clearLvp = () => {
    try {
      clearBbLvpProfiles();
      setLvpSaved(0);
      setLvpProfile(null);
      setToast('LVP-профили очищены');
      scheduleToastClear(2000);
    } catch { /* noop */ }
  };

  // BB-D-33 (хвост): сохранённый профиль поднимаем из хранилища — иначе после
  // перезагрузки «сохранено профилей: N» показывало профили, которых не видно,
  // а рабочий вес не доезжал до отчёта (мета слала null).
  useEffect(() => {
    try { setLvpProfile(loadBbLvpProfiles()[String(lvpLift).toLowerCase()] || null); }
    catch { setLvpProfile(null); }
  }, [lvpLift]);

  // Рабочий вес (BB-D-33): единственный честный источник — индивидуальный e1RM из LVP.
  // Нет профиля или e1RM — коридора нет (секция в отчёте не рисуется), а не «примерно».
  const lvpWorkingRange = useMemo(() => {
    const e = Number(lvpProfile?.e1rm);
    if (!Number.isFinite(e) || e <= 0) return null;
    const range = bbWorkingRange(e, 'mass');
    if (!range) return null;
    return bbWorkingRangeNote(range, e, {
      liftRu: LVP_LIFTS.find((l) => l.id === String(lvpProfile?.lift))?.label,
      source: lvpProfile?.valid ? 'individual' : 'population',
    });
  }, [lvpProfile]);

  const handleExport = () => {
    // Э5 PRO-5: причины — мемо weakCauses (с auditFor: «показано = экспортировано»), PRO-мета — общий сборщик
    const html = buildBBDiagnosticsHtml(report, { date: localIsoDate(), level, plan: bbPlan, weakHeads: exportHeads, weakCauses: weakCauses as any, specBlock: specBlock as any, ...pro2Meta } as any);
    downloadHtml(html, `bb-diagnostics-${localIsoDate()}.html`);
    setToast('✓ HTML-файл сохранён (движения: причины + спец-блок + разбор + скрининг)');
    scheduleToastClear(2000);
  };
  /**
   * AUDIT 2026-11 (BB-D-34): кнопка «Печать» скачивала .html — печать не открывалась.
   * Теперь печатаем отчёт в отдельном окне; если окно заблокировано — честно
   * сообщаем и сохраняем файл (пользователь печатает его сам).
   */
  const handleExportPrint = () => {
    const html = buildBBDiagnosticsHtml(report, { date: localIsoDate(), level, plan: bbPlan, weakHeads: exportHeads, weakCauses: weakCauses as any, specBlock: specBlock as any, ...pro2Meta } as any);
    try {
      const w = window.open('', '_blank');
      if (!w) {
        downloadHtml(html, `bb-diagnostics-${localIsoDate()}.html`);
        setToast('⚠ Окно печати заблокировано — сохранил HTML-файл, печать из него');
        scheduleToastClear(3000);
        return;
      }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      setToast('🖨 Печать открыта в новом окне');
      scheduleToastClear(2000);
    } catch {
      downloadHtml(html, `bb-diagnostics-${localIsoDate()}.html`);
      setToast('⚠ Печать не открылась — сохранил HTML-файл');
      scheduleToastClear(3000);
    }
  };
  const handleExportCsv = () => {
    // Э5 PRO-5: тот же объект меты, что HTML (CSV больше не теряет driver_subs)
    const csv = buildBBDiagnosticsCsv(report, bbPlan as any, { weakCauses: weakCauses as any, weakHeads: exportHeads, specBlock: specBlock as any, ...pro2Meta });
    downloadCsv(csv, `bb-diagnostics-${localIsoDate()}.csv`);
    setToast('✓ CSV экспорт (движения: причины + спец-блок + разбор + скрининг)');
    scheduleToastClear(2000);
  };

  // PRO-3 R7: спец-блок → конфиг BB-блока годового плана (официальный setAnnualBlockConfig)
  const handleAnnualApply = () => {
    try {
      if (!report.weakZonesGranular.length) {
        setToast('Выбери 1-2 слабые зоны — нечего класть в год');
        scheduleToastClear(2000);
        return;
      }
      const plan = loadAnnualTrainingPlan();
      if (!plan || !plan.blocks.length) {
        setToast('Годового плана нет — собери разметку в «Годовой план»');
        scheduleToastClear(2500);
        return;
      }
      const bbBlocks = plan.blocks.filter((b) => b?.ref?.kind === 'BB');
      if (!bbBlocks.length) {
        setToast('В году нет ББ-блоков — спец-блок класть некуда');
        scheduleToastClear(2500);
        return;
      }
      // Блок года выбирает годовой план сам (первый ББ-блок) — селекта в диагностике нет, без дублей
      const key = bbBlocks[0].ref.blockKey;
      const sb = specBlock;
      if (!sb) {
        setToast('Не удалось собрать спец-блок');
        scheduleToastClear(2000);
        return;
      }
      const patch = bbSpecToAnnualPatch(sb, report.weakZonesGranular);
      if (!patch) {
        setToast('Не удалось собрать патч спец-блока');
        scheduleToastClear(2000);
        return;
      }
      const next = setAnnualBlockConfig(plan, key, patch as any);
      saveAnnualTrainingPlan(next);
      setToast(`✓ Спец-блок → годовой план (${key}): слабые + специализация, блок помечен stale`);
      scheduleToastClear(3000);
    } catch {
      setToast('⚠ Не удалось применить в годовой план');
      scheduleToastClear(2000);
    }
  };

  // PRO-3 R7: календарь спец-блока (.ics) — тот же паттерн, что SM/TA
  const handleSpecIcs = () => {
    try {
      if (!report.weakZonesGranular.length) {
        setToast('Выбери 1-2 слабые зоны — нечего класть в календарь');
        scheduleToastClear(2000);
        return;
      }
      const sb = specBlock;
      if (!sb) {
        setToast('Не удалось собрать календарь');
        scheduleToastClear(2000);
        return;
      }
      const ics = buildBBSpecIcs(
        { weeks: (sb.weeks || []).map((w) => ({ week: w.week, targetSets: w.targetSets, note: w.note })), weakZones: report.weakZonesGranular },
        { title: 'ББ спец-блок' },
      );
      if (!ics) {
        setToast('Не удалось собрать календарь');
        scheduleToastClear(2000);
        return;
      }
      downloadBBSpecIcs(ics, `bb-spec-${localIsoDate()}.ics`);
      setToast('📅 Календарь спец-блока скачан');
      scheduleToastClear(2000);
    } catch {
      setToast('⚠ Не удалось собрать календарь');
      scheduleToastClear(2000);
    }
  };

  // ── Упражнения → эффект (единый инструмент) ──
  const bbPlan = useMemo(() => {
    return savedPlan && savedPlan.weeks ? savedPlan : null;
  }, [savedPlan]);

  const planAudit = useMemo(() => {
    try { return bbPlan ? auditPlanExercises(bbPlan) : null; } catch { return null; }
  }, [bbPlan]);

  /**
   * AUDIT 2026-11: бакет аудита для приоритетной зоны.
   * Головка (chest_upper / back_width / delt_mid) ищется в `byZone`: отсутствие ключа —
   * это ДИАГНОЗ «в плане нет сетов на эту головку», а не повод показать данные всей
   * мышцы. Канонические мышцы (quads, biceps…) — из `byMuscle` (с фолбэком на сырой ключ).
   */
  const zoneBucket = useCallback((z: string) => {
    try {
      if (!planAudit) return null;
      if (isGranularZone(z)) return planAudit.byZone?.[z] ?? null;
      return planAudit.byMuscle?.[canonicalMuscle(z)] ?? planAudit.byMuscle?.[z] ?? null;
    } catch { return null; }
  }, [planAudit]);

  // ── MAX PRO: причины + спец-блок + топ-3 (после planAudit/bbPlan — порядок важен) ──
  const hist28 = useMemo(() => {
    try { return volumeHistory28d(diarySessions as any); } catch { return {}; }
  }, [diarySessions]);
  const e1rmTrend = useMemo(() => {
    try { return e1rmTrend28d(diarySessions as any); } catch { return {}; }
  }, [diarySessions]);
  const weakCauses = useMemo(() => {
    try {
      return diagnoseWeakCausesBatch(report.weakZonesGranular.slice(0, 2), {
        level,
        factVolume: factVolume as any,
        perMuscleAcwr: perMuscleAcwr as any,
        sleepHours: Number.isFinite(profileSleep as number) ? (profileSleep as number) : null,
        vbtLossPct: null, // VBT живёт в Анализе силы — в диагностику движений не входит
        hist28: hist28 as any,
        e1rmTrend: e1rmTrend as any,
        meas: measNum as any,
        heightCm: measNum.heightCm ?? bbNum(state.circ.heightCm),
        wristCm: bbNum(state.wristCm),
        canonicalOf: canonicalMuscle,
        auditFor: (z) => {
          const aud = zoneBucket(z);
          if (!aud) return null;
          return {
            lengthened: aud.lengthened > 0,
            singleAngle: aud.angleCoverage.total > 1 && aud.angleCoverage.covered === 1 && aud.totalSets >= 6,
            missingStrict: aud.strictCoverage.missing.length > 0,
            avgSfr: aud.avgSfr ?? null,
            // BB-D-28: объём есть, но темп не задан — реальная причина отставания.
            tempoMissing: aud.totalSets >= 6 && (aud.tempoSets ?? 0) === 0,
          };
        },
      });
    } catch { return {}; }
  }, [report.weakZonesGranular, level, factVolume, perMuscleAcwr, profileSleep, planAudit, hist28, e1rmTrend, measNum, state.circ.heightCm, state.wristCm]);
  const specBlock = useMemo(() => {
    try {
      if (!report.weakZonesGranular.length) return null;
      const f: Record<string, number> = {};
      for (const [k, v] of Object.entries((factVolume as any) || {})) f[k] = (v as any)?.effectiveSets ?? (v as any)?.directSets ?? 0;
      // План ББ-авто держит один спец-блок 3–6 нед: просим 4–6, чтобы движок не
    // выдал 8 и приёмник не обрезал длину молча (BB-D-24).
    const weeksReq = (() => { const n = parseInt(state.specWeeks) || 6; return Math.max(4, Math.min(6, n)); })();
    return buildSpecBlock({ weakZones: report.weakZonesGranular, factSets: f, level, weeks: weeksReq, sex: effSex || undefined });
    } catch { return null; }
  }, [report.weakZonesGranular, factVolume, level, state.specWeeks, effSex]);
  const inPlanExerciseIds = useMemo(() => {
    const out: string[] = [];
    try {
      if (bbPlan) for (const w of (bbPlan.weeks || [])) for (const s of (w.sessions || [])) for (const ex of (s.exercises || [])) out.push(String((ex as any).exerciseName || (ex as any).name || ''));
    } catch { /* noop */ }
    return out;
  }, [bbPlan]);
  const top3ByZone = useMemo(() => {
    const out: Record<string, ReturnType<typeof rankCorrectionsForWeak>> = {};
    for (const z of report.weakZonesGranular.slice(0, 2)) {
      try {
        const aud = zoneBucket(z);
        out[z] = rankCorrectionsForWeak(z, null, {
          cause: weakCauses[z]?.cause,
          weakHead: weakHeadForZone(z),
          asymPct: asymMax,
          level,
          equipment: profileEquipment,
          missingAngles: aud?.angleCoverage.missing || [],
          missingStrict: aud?.strictCoverage.missing || [],
          missingShort: (aud?.totalSets ?? 0) >= 6 && (aud?.shortened ?? 0) === 0,
          inPlanIds: inPlanExerciseIds,
          sex: effSex || undefined,
        }).slice(0, 3);
      } catch { out[z] = []; }
    }
    return out;
  }, [report.weakZonesGranular, report.symmetry.ratios, weakCauses, level, effSex, planAudit, inPlanExerciseIds, profileEquipment, asymMax]);

  // PRO-CORR: библиотека коррекций — зона + причина + сигналы скринингов (единый corrSignalsFor: паритет с экспортом/вставкой).
  // ⭐ Выбор пользователя поднимает запись наверх ОДИН ЗДЕСЬ — карточка, оба экспорта, блок волны,
  // превью моста и инъекция в план читают этот же мемо (правка ранжира в 4 копиях = расхождение).
  const correctiveTopByZone = useMemo(() => {
    const out: Record<string, ReturnType<typeof rankCorrectives>> = {};
    for (const z of report.weakZonesGranular.slice(0, 2)) {
      try {
        const ranked = rankCorrectives(corrSignalsFor(z, (weakCauses as any)?.[z]?.cause));
        const prefId = String((state.prefCorr || {})[z] || '').trim();
        // Выбранная запись идёт первой, но только если реально доступна в окне (иначе — честный тихий фолбэк).
        const pi = prefId ? ranked.findIndex((r) => r.corr.id === prefId) : -1;
        if (pi > 0) {
          const picked = ranked[pi];
          out[z] = [picked, ...ranked.filter((r) => r.corr.id !== prefId)].slice(0, 3);
        } else {
          out[z] = ranked.slice(0, 3);
        }
      } catch { out[z] = []; }
    }
    return out;
  }, [report.weakZonesGranular, report.symmetry.ratios, weakCauses, level, profileEquipment, inPlanExerciseIds, moveDriver, benchV, nheV, adductorV, erIrV, painMon, hingeV, shoulderV, ybtV, asymText, teenGate, state.pmLoc, state.prefCorr, rotV, loadedHingeV]);

  // Сколько вариантов скрыто, потому что упражнение УЖЕ ЕСТЬ в плане. Раньше это отсечение
  // было невидимым: пользователь видел «почему нет приседания, которое я делаю?» без ответа.
  const corrInPlanDropped = useMemo(() => {
    const out: Record<string, number> = {};
    for (const z of report.weakZonesGranular.slice(0, 2)) {
      try {
        const sig = corrSignalsFor(z, (weakCauses as any)?.[z]?.cause) as any;
        // Тот же corrSignalsFor, только без плана — так «скрытые» считаются честно.
        // Объект собирается отдельно: инлайн-литерал сигналов тут запрещён (паритет-гард).
        const sigNoPlan = { ...sig, inPlanIds: [] } as any;
        // Ранжир режется до 6 записей (rankCorrectives → slice(0, 6)) и ПОСЛЕ отсечения
        // «уже в плане» добирается следующими вариантами, поэтому разница ДЛИН всегда 0:
        // пометка «скрыто N: упражнение уже есть в плане» была мёртвой (не показывалась
        // никогда). Считаем не длину, а идентичности: какие записи выдачи без плана
        // отсутствуют в выдаче с планом.
        const withPlanIds = new Set(rankCorrectives(sig).map((r) => r.corr.id));
        const dropped = rankCorrectives(sigNoPlan).filter((r) => !withPlanIds.has(r.corr.id)).length;
        out[z] = Math.max(0, dropped);
      } catch { out[z] = 0; }
    }
    return out;
  }, [report.weakZonesGranular, report.symmetry.ratios, weakCauses, level, profileEquipment, inPlanExerciseIds, moveDriver, benchV, nheV, adductorV, erIrV, painMon, hingeV, shoulderV, ybtV, asymText, teenGate, state.pmLoc, rotV, loadedHingeV]);
  // ROUND-10: блок коррекции (волна) — единый источник для карточки и экспорта (HTML/CSV/печать)
  const corrBlockLines = useMemo(() => {
    try {
      const flags = corrDoseFlags();
      const picks = Object.entries(correctiveTopByZone).flatMap(([z, list]) =>
        list.map((r) => ({ corr: r.corr, why: r.why, cause: (weakCauses as any)?.[z]?.cause ?? null })));
      // PRO-CORR-FIX: доза блока — теми же входами, что карточка/экспорт/вставка.
      // Без opts (cause=null, флаги {}) блок показывал другие сеты/RIR при жёлтой/красной боли
      // и причине recovery — «показано ≠ вставится».
      const block = correctiveBlockForBB(picks, 6, { flags });
      const lines = correctiveBlockExportLines(block);
      return lines.length ? { lines, block } : null;
    } catch { return null; }
  }, [correctiveTopByZone, weakCauses, readiness, painMon]);

  // Э5 PRO-5: единые входы выдачи — головки, детали коррекций и PRO-мета (HTML/CSV/мост одним объектом)
  const exportHeads = useMemo(() => {
    try {
      const out: string[] = [];
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        const wh = weakHeadForZone(z);
        if (wh && !out.includes(wh)) out.push(wh);
      }
      return out;
    } catch { return []; }
  }, [report.weakZonesGranular]);
  const correctiveDetailForExport = useMemo(() => {
    try {
      const det: Array<{
        id: string; zone: string; exerciseId: string; protocol: string; cues: string[]; source: string;
        weightHint?: number | null; bodyweight?: boolean; restSec?: number; reps?: number; repsMax?: number; rir?: number;
        phase?: string; level?: string; alt?: string[];
      }> = [];
      for (const z of report.weakZonesGranular.slice(0, 2)) {
        const r = (correctiveTopByZone[z] || [])[0];
        if (!r) {
          // Зона без доступных коррекций молча исчезала из выгрузки, хотя инъекция
          // для той же ситуации честно пишет «⊘ …». Пусто должна быть видна.
          det.push({
            id: 'none', zone: z, exerciseId: '',
            protocol: 'недоступно под текущие фильтры (оборудование/подвижность/план)',
            cues: [], source: 'фильтры хаба', reps: 0, repsMax: 0, rir: 0, phase: 'none', level: 'any',
          });
          continue;
        }
        const dose = correctiveDose(r.corr, (weakCauses as any)?.[z]?.cause ?? null, corrDoseFlags());
        // K7: доза 1-в-1 с карточкой и вставкой (тот же workMax/loadFactor) — «выгружено = вставится».
        const hint = (() => { try { return correctiveWeightHint(r.corr.exerciseId, profileWorkMax, canonicalMuscle(z), { loadFactor: correctiveLoadFactor(r.corr.phase) }); } catch { return null; } })();
        det.push({
          id: r.corr.id, zone: z, exerciseId: r.corr.exerciseId,
          protocol: `${dose.sets}×${dose.repsMin}–${dose.repsMax} RIR${dose.rir} ${dose.tempo}`,
          cues: r.corr.cues.slice(0, 3), source: r.corr.source,
          weightHint: hint ? hint.kg : null, bodyweight: hint ? hint.bodyweight : undefined,
          restSec: r.corr.protocol.restSec, reps: dose.repsMin, repsMax: dose.repsMax, rir: dose.rir,
          phase: r.corr.phase, level: r.corr.level, alt: r.corr.equipmentAlt.slice(),
        });
      }
      return det.length ? det : null;
    } catch { return null; }
  }, [report.weakZonesGranular, correctiveTopByZone, weakCauses, readiness, painMon, profileWorkMax]);
  // BB-D-38/33: ориентиры по полу и возрасту + сухожильный скрининг считались в
  // движках, но в хаб/экспорт не попадали (пользователь их не видел вообще).
  const teenNoteText = useMemo(() => {
    try { return teenTrainingNote(profileAge); } catch { return null; }
  }, [profileAge]);
  const femaleNotesShort = useMemo(() => {
    try {
      if (effSex !== 'female') return null;
      const notes = femaleSymmetryNotes(
        { waist: measNum.waist ?? null, hips: measNum.hips ?? null, thigh: measNum.thighL ?? measNum.thigh ?? null },
        // Фаза цикла в хабе не вводится (ввод убран) — ориентиры без фазовой поправки.
        {},
      );
      return notes.length ? notes : null;
    } catch { return null; }
  }, [effSex, measNum]);
  const tendonTexts = useMemo(() => {
    try {
      const g = assessBbTendonGuard(diarySessions as any, { level });
      return { elbow: g.elbow.text, shoulder: g.shoulder.text };
    } catch { return null; }
  }, [diarySessions, level]);

  /**
   * BB-G-08: «что делать дальше». Правила и приоритет — в движке (там же белый
   * список целей deep-link'а), здесь только вход из уже посчитанных мемов.
   * Действия не дублируют экран: два шага ведут в два разных места.
   */
  const nextActions = useMemo(() => {
    try {
      return buildNextActions({
        score: {
          score: report.score.score,
          level: report.score.level,
          verification: report.score.verification,
          verificationMissing: report.score.verificationMissing,
        },
        redFlags: redFlags?.active
          ? { active: true, blocked: !!redFlags.blocked, items: (redFlags.items ?? []) as string[], text: redFlags.text }
          : null,
        volume: {
          limiter: vrPanel.limiter
            ? { id: vrPanel.limiter.id, label: vrPanel.limiter.label, zone: vrPanel.limiter.zone, detail: vrPanel.limiter.detail }
            : null,
          hasVolume: vrPanel.hasVolume,
          hasAcwr: vrPanel.hasAcwr,
          hasMobility: vrPanel.hasMobility,
          rows: vrPanel.rows.map((r) => ({ group: r.group, label: r.label, over: r.over, sets: r.sets, mrv: r.mrv })),
        },
        weakZones: report.weakZonesGranular,
        weakCauses: weakCauses as any,
        // `false` только когда план точно отсутствует: «нет плана» — совет, а не догадка.
        planPresent: !!savedPlan,
        diaryCount: diarySessions.length,
        measuresCount: Object.keys(measNum).length,
        screenTouched: !!state.screenTouched,
        effect: corrEffect.status === 'no_injection' ? null : { status: corrEffect.status, text: corrEffect.text },
      });
    } catch {
      // Ошибка расчёта — честное «не посчитано», а не пустой блок без объяснений.
      return { actions: [], considered: [], note: 'Действия не посчитаны — ошибка расчёта' };
    }
  }, [
    report.score.score, report.score.level, report.score.verification, report.score.verificationMissing.join('|'),
    redFlags, vrPanel, report.weakZonesGranular, weakCauses, savedPlan, diarySessions.length, measNum, state.screenTouched, corrEffect,
  ]);

  const pro2Meta = useMemo(() => buildPro2Meta({
    lrVerdicts: lrVerdicts as any,
    moveDriver,
    singleLeg,
    ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
    mmcLine,
    shoulder: (() => { try { return { pass: (shoulderV as any).pass, locus: (shoulderV as any).locus, text: (shoulderV as any).text }; } catch { return null; } })(),
    hingeText: (() => { try { return `${(hingeV as any).text} · ${(loadedV as any).text}`; } catch { return ''; } })(),
    ybt: (() => { try { return { text: (ybtV as any).text }; } catch { return null; } })(),
    asymText,
    driverSubsText: (() => { try { const pref = ((driverSubs as any).prefer || []) as string[]; const note = String((driverSubs as any).note || ''); return pref.length || note ? `${pref.join(' · ')} — ${note}` : null; } catch { return null; } })(),
    bench: benchV.tested ? { level: benchV.level, text: benchV.text } : null,
    painMonLine: painMon.line || null,
    posterior: nheV.tested || adductorV.tested ? { nhe: nheV.tested ? nheV.text : null, adductor: adductorV.tested ? adductorV.text : null } : null,
    loadedHinge: !teenGate.blocked && !/не проверялся/.test(loadedHingeV.text) ? { text: loadedHingeV.text } : null,
    erir: !teenGate.blocked && erIrV.tested ? { text: erIrV.text } : null,
    screenPriority: screenPriority.length ? screenPriority : null,
    correctiveDetail: correctiveDetailForExport,
    correctionBlock: corrBlockLines?.lines ?? null,
    lrDirection,
    // BB-D-33: секции HTML, которые хаб уже считает, но не отдавал в экспорт.
    readiness: readiness?.tested ? { level: readiness.level, advice: readiness.advice, reasons: readiness.reasons } : null,
    redFlags: redFlags?.active ? { active: redFlags.active, blocked: redFlags.blocked, items: redFlags.items ?? [], text: redFlags.text } : null,
    returnTo: (() => {
      try {
        const plan = returnToPlan as any;
        if (!plan || !plan.stages?.length) return null;
        return {
          text: String(plan.text || 'поэтапный возврат после стоп-флагов'),
          stages: plan.stages.map((s: any) => ({
            stage: Number(s.stage), title: String(s.title || ''), volume: String(s.volume || ''),
            rir: String(s.rir || ''), note: String(s.note || ''), action: s.action,
          })),
        };
      } catch { return null; }
    })(),
    lvp: lvpProfile ? { lift: String(lvpProfile.lift), r2: Number(lvpProfile.r2), e1rm: lvpProfile.e1rm ?? null, text: String(lvpProfile.text), valid: !!lvpProfile.valid } : null,
    tendon: tendonTexts,
    teen: teenNoteText,
    femaleNotes: femaleNotesShort,
    workingRange: lvpWorkingRange,
    // BB-D-05 (хвост): «нет данных» — состояние, а не 100. Отчёт обязан говорить то же.
    scoreState: noDataAtAll ? 'no_data' : undefined,
    // BB-G-05: видео-разбор позы — те же строки, что карточка («показано = выгружено»),
    // плюс числа для машинного чтения. Ракурсы независимы: фронт и бок идут отдельными
    // секциями, иначе второй разбор затирал бы первый в отчёте.
    poseVideos: (['front', 'side'] as const)
      .map((v) => {
        const r = state.poseResults[v];
        if (!r) return null;
        return {
          view: v,
          quality: r.quality,
          framesPosed: r.framesPosed,
          framesTotal: r.framesTotal,
          depthKneeDeg: r.depthKneeDeg ?? undefined,
          trunkLeanDeg: r.trunkLeanDeg ?? undefined,
          heelRisePct: r.heelRisePct ?? undefined,
          valgusDeg: r.valgusDeg ?? undefined,
          hipShiftPct: r.hipShiftPct ?? undefined,
          pelvicDropPct: r.pelvicDropPct ?? undefined,
          armsOverMidfootPct: r.armsOverMidfootPct ?? undefined,
          applied: state.poseApplied[v],
          lines: bbPoseLines(r),
        };
      })
      .filter(Boolean) as any,
    // BB-G-01/04: панель объёма/восстановления и эффект коррекции — «показано = выгружено».
    volumeRecovery: {
      chips: vrPanel.chips.map((c) => ({ label: c.label, value: c.value, detail: c.detail })),
      limiter: vrPanel.limiter ? { label: vrPanel.limiter.label, detail: vrPanel.limiter.detail } : null,
      advice: vrPanel.advice,
      effect: corrEffect.status === 'no_injection' ? null : corrEffect.text,
    },
    // BB-G-08: те же 1–2 действия, что в шапке хаба («показано = выгружено»).
    nextActions: nextActions.actions.map((a) => ({
      title: a.title,
      why: a.why,
      kind: a.kind,
      zone: a.zone,
      where: a.target ? { type: a.target.type, id: a.target.id, label: a.target.label } : null,
    })),
  }), [lrVerdicts, moveDriver, singleLeg, ohs, mmcLine, shoulderV, hingeV, loadedV, ybtV, asymText, driverSubs, benchV, painMon, nheV, adductorV, loadedHingeV, erIrV, teenGate, screenPriority, correctiveDetailForExport, corrBlockLines, lrDirection, readiness, redFlags, returnToPlan, lvpProfile, tendonTexts, teenNoteText, femaleNotesShort, vrPanel, corrEffect, nextActions, lvpWorkingRange, noDataAtAll, state.poseResults, state.poseApplied]);

  // Покрытие слабых головок текущим планом (есть ли хоть одно упражнение в головку)
  const headCoverage = useMemo(() => {
    try {
      const heads = report.weakZonesGranular.slice(0, 2).map(weakHeadForZone).filter(Boolean) as string[];
      if (!heads.length || !bbPlan) return [];
      return auditHeadCoverage(bbPlan as any, heads);
    } catch { return []; }
  }, [report.weakZonesGranular, bbPlan]);

  // Слабые головки для подсветки библиотеки (🎯 бьёт в цель)
  const libWeakHeads = useMemo(() => {
    try {
      return report.weakZonesGranular.map(weakHeadForZone).filter(Boolean) as string[];
    } catch { return []; }
  }, [report.weakZonesGranular]);

  // Прошлый разбор из ББ-авто (he_bb_last_weak_heads) — вернуть в работу одной кнопкой
  const lastWeakHeads = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_bb_last_weak_heads');
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const valid = new Set(GRANULAR_OPTS.map((o) => o.id));
      return arr.map((h) => String(h)).filter((h) => valid.has(h)).slice(0, 2);
    } catch { return []; }
  }, []);

  const selectedExRaw = useMemo(() => {
    const id = state.exerciseSelectedId;
    if (!id) return null;
    // ищем в плане
    if (bbPlan) {
      for (const w of (bbPlan.weeks || [])) for (const s of (w.sessions || [])) for (const ex of (s.exercises || [])) {
        const curId = String(ex.exerciseName || ex.id || ex.name || '').toLowerCase();
        if (curId === String(id).toLowerCase()) return { id: String(ex.exerciseName || ex.id), name: String(ex.name || ex.exerciseName || id), muscle: String(ex.muscle || ''), sets: ex.sets ?? ex.workSets?.length ?? 3, rir: ex.rir ?? 2, tempo: ex.tempo, pauseSeconds: ex.pauseSeconds, stretchPhase: (ex as any).stretchPhase };
      }
    }
    const cat = EXERCISE_CATALOG.find(c => c.id === id);
    if (cat) return { id: cat.id, name: cat.name, muscle: cat.group, sets: 3, rir: 2 };
    // Неизвестное упражнение: мышцу НЕ выдумываем (раньше подставлялся 'chest'
    // и диагноз считался по чужой груди).
    return { id, name: id, muscle: '' };
  }, [state.exerciseSelectedId, bbPlan]);

  /** Головка выбранного упражнения (для точного аудита плана по головке). */
  const selectedZone = useMemo(() => {
    if (!selectedExRaw?.id) return null;
    const cat = EXERCISE_CATALOG.find((c: any) => c.id === selectedExRaw.id);
    if (!cat) return null;
    return granularZoneOf({
      id: (cat as any).id,
      name: (cat as any).name,
      targetMuscle: (cat as any).targetMuscle,
      substitutionGroup: (cat as any).substitutionGroup,
      muscle: (cat as any).group,
    }, (cat as any).group);
  }, [selectedExRaw]);

  // Э4 PRO-5: «Разбор» больше не режет каталог с начала — упражнения плана первыми + живой поиск
  const plannedCatalogIds = useMemo(() => {
    const set = new Set<string>();
    try {
      if (bbPlan) for (const w of (bbPlan.weeks || [])) for (const s of (w.sessions || [])) for (const ex of (s.exercises || [])) {
        const id = String((ex as any).exerciseName || (ex as any).id || '');
        if (id) set.add(id);
      }
    } catch { /* noop */ }
    return set;
  }, [bbPlan]);
  // Э4 PRO-5 + волна 4 (каталог): поиск фильтрует ВЕСЬ каталог, но в шторку кладём
  // первые 80 совпадений (иначе 562 кнопки в одном sheet). Показываем честно
  // «80 из N» — раньше кап молчал, и выглядело, будто упражнений всего 80.
  const exPicker = useMemo(() => {
    const q = exQuery.trim().toLowerCase();
    let list = EXERCISE_CATALOG;
    if (q) list = list.filter((c) => String(c.name).toLowerCase().includes(q) || String(c.id).toLowerCase().includes(q));
    const planFirst = list.filter((c) => plannedCatalogIds.has(c.id));
    const rest = list.filter((c) => !plannedCatalogIds.has(c.id));
    const ordered = [...planFirst, ...rest];
    const CAP = 80;
    return {
      options: [{ id: '', label: 'Не выбрано' }, ...ordered.slice(0, CAP).map((c) => ({ id: c.id, label: `${c.name}`, hint: `${MUSCLE_LABEL_RU[(c as any).group] || (c as any).group} · СФР ${sfrOf(c as any) ?? '—'}` }))],
      shown: Math.min(CAP, ordered.length),
      total: ordered.length,
    };
  }, [exQuery, plannedCatalogIds]);

  const selectedDiagnosis = useMemo(() => {
    if (!selectedExRaw) return null;
    // Упражнение не найдено ни в плане, ни в каталоге — мышца неизвестна: диагноз не врём.
    if (!selectedExRaw.muscle) return null;
    try {
      const selAud = (selectedZone && zoneBucket(selectedZone)) || zoneBucket(selectedExRaw.muscle);
      const singleAngleMuscle = planAudit ? Object.entries(planAudit.byMuscle).find(([, bm]) => bm.angleCoverage.total > 1 && bm.angleCoverage.covered === 1 && bm.totalSets >= 6)?.[0] || null : null;
      const uncovered = selAud?.regionalCoverage.missing || [];
      const strictMissing = selAud?.strictCoverage.missing || [];
      // слабая головка под выбранную мышцу (для wrongHead): первая зона, чья головка из той же семьи
      const weakHead = (() => {
        try {
          const m = String(selectedExRaw.muscle || '').toLowerCase();
          const LEGS = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs']);
          for (const z of report.weakZonesGranular) {
            const h = weakHeadForZone(z);
            if (!h) continue;
            const hm = HEAD_FUNCTIONS[h]?.muscle || '';
            if (hm === m || (LEGS.has(hm) && LEGS.has(m))) return h;
          }
          return null;
        } catch { return null; }
      })();
      return diagnoseExercise(selectedExRaw as any, {
        goal: 'hypertrophy', level, weakZones: report.weakZonesGranular, weakMusclesCanonical: report.weakMusclesCanonical,
        muscle: selectedExRaw.muscle, mobilityFails: ohs.failed, asymPct: asymMax, planTempo: selectedExRaw.tempo || null, planPauseSeconds: selectedExRaw.pauseSeconds ?? null, planReps: 10,
        singleAngleMuscle, uncoveredSubregions: uncovered, strictMissing, weakHead,
        cheating: state.stimCheating || null,
        rangeFull: state.stimShortRom ? false : null,
        setupIssues: state.stimSetupNote.trim() ? [state.stimSetupNote.trim()] : undefined,
      } as any);
    } catch { return null; }
  }, [selectedExRaw, selectedZone, report.weakZonesGranular, report.weakMusclesCanonical, asymMax, ohs.failed, level, planAudit, zoneBucket, state.stimCheating, state.stimShortRom, state.stimSetupNote]);

  const selectedCorrections = useMemo(() => {
    if (!selectedDiagnosis || !selectedExRaw) return [];
    try {
      const aud = (selectedZone && zoneBucket(selectedZone)) || zoneBucket(selectedExRaw.muscle);
      // слабая головка под мышцу — замены целятся в неё
      let weakHead: string | null = null;
      try {
        const m = String(selectedExRaw.muscle || '').toLowerCase();
        const LEGS = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs']);
        for (const z of report.weakZonesGranular) {
          const h = weakHeadForZone(z);
          if (!h) continue;
          const hm = HEAD_FUNCTIONS[h]?.muscle || '';
          if (hm === m || (LEGS.has(hm) && LEGS.has(m))) { weakHead = h; break; }
        }
      } catch { /* noop */ }
      return prescribeCorrections(selectedDiagnosis, selectedExRaw as any, { goal: 'hypertrophy', level, muscle: selectedExRaw.muscle, weakHead, asymPct: asymMax, equipment: profileEquipment, mobilityRestrictions: profileMobility, missingAngles: aud?.angleCoverage.missing || [], missingStrict: aud?.strictCoverage.missing || [], sex: effSex || undefined });
    } catch { return []; }
  }, [selectedDiagnosis, selectedExRaw, selectedZone, level, asymMax, report.weakZonesGranular, planAudit, zoneBucket, effSex, profileEquipment, profileMobility]);

  const selectedProf = useMemo(() => {
    if (!selectedExRaw) return null;
    try { return getProfExecutionProfile(selectedExRaw.muscle || ''); } catch { return null; }
  }, [selectedExRaw]);

  // Библиотека (секция 5 «Разбора») — те же фильтры + тот же поиск: без поиска
  // кап 40 из 562 оставлял 522 упражнения недостижимыми МОЛЧА (жалоба из аудита хабов).
  const exerciseLibrary = useMemo(() => {
    const q = exQuery.trim().toLowerCase();
    let list = EXERCISE_CATALOG;
    if (q) list = list.filter((e) => String(e.name).toLowerCase().includes(q) || String(e.id).toLowerCase().includes(q));
    if (state.exerciseFilterSfr >= 4) list = list.filter(e => (sfrOf(e as any) ?? 0) >= 4);
    if (state.exerciseFilterProfile !== 'all') list = list.filter(e => {
      try {
        const eff = calcExerciseEffect(e as any, {});
        return eff.profile === state.exerciseFilterProfile;
      } catch { return false; }
    });
    if (state.exerciseFilterUnilateral) list = list.filter(e => {
      try { const eff = calcExerciseEffect(e as any, {}); return eff.unilateral; } catch { return false; }
    });
    const CAP = 40;
    return { list: list.slice(0, CAP), shown: Math.min(CAP, list.length), total: list.length };
  }, [state.exerciseFilterSfr, state.exerciseFilterProfile, state.exerciseFilterUnilateral, exQuery]);

  const handleApplyExerciseCorrection = (action: any, targetExId?: string | null) => {
    const weak = report.weakZonesGranular;
    if (!weak.length && !action.targetId && action.type !== 'modifyExecution' && action.type !== 'modifyTempo' && action.type !== 'modifyROM') {
      setToast('Выбери слабую зону или упражнение — нечего применять');
      scheduleToastClear(2500);
      return;
    }
    const delta = (() => { try { return bbPlan && action ? simulateCorrection(bbPlan, action, targetExId || selectedExRaw?.id || null) : null; } catch { return null; } })();
    applyToPlanner({
      kind: 'weakpoints',
      label: `ББ: ${weak.map(weakRu).join(', ') || 'техника'} → ${action.targetName || action.type}`,
      data: {
        groups: weak.length ? weak : report.weakMusclesCanonical,
        weakPoints: weak.length ? weak : report.weakMusclesCanonical,
        weakZonesGranular: weak, weakMusclesCanonical: report.weakMusclesCanonical,
        preferredExerciseIds: action.targetId ? [action.targetId] : [],
        exerciseSwap: action.targetId && targetExId ? { oldId: targetExId, newId: action.targetId } : action.targetId && selectedExRaw?.id ? { oldId: selectedExRaw.id, newId: action.targetId } : undefined,
        labDiagnosis: selectedDiagnosis ? { flags: selectedDiagnosis.flags, issues: selectedDiagnosis.issues, score: selectedDiagnosis.score } : null,
        // 3.10: цель коррекции (id/имя упражнения) — иначе приёмник менял все упражнения.
        labCorrection: { ...action, targetId: action.targetId || targetExId || selectedExRaw?.id || null, targetName: action.targetName || selectedExRaw?.name || null },
        labDelta: delta,
        bbDiagScore: score, bbDiagLevel: sLevel, verification: report.score.verification,
      },
      // AUDIT 2026-11: см. applyToConstructor — это ББ-канал, а не «intellectual»
      // (иначе targetCycleId из ПЛ-сессии уводил payload мимо ББ-авто).
      source: 'bb-auto',
    });
    setToast(`→ Коррекция ${action.type} отправлена в ББ-авто${delta?.summary ? ` (${delta.summary})` : ''}`);
    scheduleToastClear(3000);
    try { window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'bb' } as any)); localStorage.setItem('he_training_planning_track', 'bb'); } catch {}
  };

  // 🎯 Худшее упражнение плана по полному диагнозу (со слабыми головками) — открыть на разбор
  const selectWorstExercise = () => {
    if (!bbPlan) {
      setToast('Нет плана ББ — собери в ББ-авто');
      scheduleToastClear(2000);
      return;
    }
    let worst: { id: string; name: string; score: number } | null = null;
    try {
      const LEGS = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs']);
      for (const w of (bbPlan.weeks || [])) {
        for (const s of (w.sessions || [])) {
          for (const ex of (s.exercises || [])) {
            const id = String((ex as any).exerciseName || (ex as any).id || '');
            const name = String((ex as any).name || id);
            const muscle = String((ex as any).muscle || '');
            if (!id && !name) continue;
            let wh: string | null = null;
            try {
              const m = muscle.toLowerCase();
              for (const z of report.weakZonesGranular) {
                const h = weakHeadForZone(z);
                if (!h) continue;
                const hm = HEAD_FUNCTIONS[h]?.muscle || '';
                if (hm === m || (LEGS.has(hm) && LEGS.has(m))) { wh = h; break; }
              }
            } catch { /* noop */ }
            let sc = 100;
            try {
              sc = diagnoseExercise(
                { id: id || undefined, name, muscle, rir: (ex as any).rir ?? 2, tempo: (ex as any).tempo, pauseSeconds: (ex as any).pauseSeconds } as any,
                { muscle, weakHead: wh, level } as any,
              ).score;
            } catch { /* noop */ }
            if (!worst || sc < worst.score) worst = { id: id || name, name, score: sc };
          }
        }
      }
    } catch { /* noop */ }
    if (!worst) {
      setToast('В плане нет упражнений');
      scheduleToastClear(2000);
      return;
    }
    setState((st) => ({ ...st, exerciseSelectedId: worst!.id, stimCheating: false, stimShortRom: false, stimSetupNote: '' }));
    setToast(`🎯 Худшее в плане: ${worst.name} (${worst.score}/100) — разбираем`);
    scheduleToastClear(3000);
  };

  const takeMeasureSnapshot = () => {
    let meas: Record<string, number> = {};
    try {
      for (const [k, v] of Object.entries(state.circ)) {
        const n = bbNum(v as string);
        if (n != null && n > 0) meas[k] = n;
      }
    } catch { /* noop */ }
    if (!Object.keys(meas).length) {
      setToast('Введи хотя бы один замер — снимать нечего');
      scheduleToastClear(2000);
      return;
    }
    const entry = { date: localIsoDate(), meas };
    setMeasureHist((prev) => {
      const next = appendMeasureSnapshot(prev, entry);
      try { localStorage.setItem('he_bb_measure_history', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    setToast(`✓ Снимок замеров ${entry.date} сохранён`);
    scheduleToastClear(2500);
  };

  // 💉 Инъекция коррекций в сохранённый план (лениво — мемы ниже недоступны из-за TDZ).
  // Пишет he_bb_plan_saved (+снапшот he_bb_plan_saved_prev) и будит конструктор событием he-bb-plan-saved.
  const handleInjectToPlan = () => {
    try {
      const gate = assessBbRedFlags({ acutePain: state.acutePain, swelling: state.swelling, numbness: state.numbness, jointClickPain: state.jointClickPain });
      if (gate.blocked) {
        setToast(`⛔ ${gate.text}`);
        scheduleToastClear(3000);
        return;
      }
      if (gate.active) {
        setToast(`⚠ ${gate.text} — вставляем только технику, без объёма`);
        scheduleToastClear(3000);
      }
    } catch { /* noop */ }
    const zones = report.weakZonesGranular.slice(0, 2);
    if (!zones.length) {
      setToast('Выбери 1-2 слабые зоны — нечего вставлять');
      scheduleToastClear(2000);
      return;
    }
    let raw: string | null = null;
    let rawKey: 'saved' | 'plans' = 'saved';
    try { raw = localStorage.getItem('he_bb_plan_saved'); } catch { /* noop */ }
    if (!raw) {
      // AUDIT 2026-11: план может жить только в he_bb_plans (вариантах) — раньше
      // хаб говорил «Нет плана ББ», хотя конструктор показывал собранный план.
      try { const alt = localStorage.getItem('he_bb_plans'); if (alt) { raw = alt; rawKey = 'plans'; } } catch { /* noop */ }
    }
    if (!raw) {
      setToast('Нет плана ББ — собери в ББ-авто, потом вставляй коррекции');
      scheduleToastClear(2500);
      return;
    }
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {
      setToast('План в хранилище битый — пересобери в ББ-авто');
      scheduleToastClear(2500);
      return;
    }
    const plan = pickPlanFromSaved(parsed);
    if (!plan) {
      setToast('План не распознан — пересобери в ББ-авто');
      scheduleToastClear(2500);
      return;
    }
    // dayMap/targetSets из спец-блока, темп из PROF, упражнения из топ-3
    let dayMap: Record<string, number[]> | undefined;
    let specWeeks: Array<{ targetSets: Record<string, number> }> = [];
    try {
      const sb = specBlock;
      if (sb) {
        dayMap = sb.dayMap;
        specWeeks = sb.weeks || [];
      }
    } catch { /* noop */ }
    const profTempo: Record<string, string> = {};
    for (const z of zones) {
      try {
        const p = getProfExecutionProfile(z) || getProfExecutionProfile(canonicalMuscle(z));
        if (p?.tempo) profTempo[z] = p.tempo;
      } catch { /* noop */ }
    }
    const preferredIds: Record<string, string> = {};
    const corrective: Record<string, { sets?: number; reps?: number; repsMax?: number; rir?: number; tempo?: string; restSec?: number; loadFactor?: number; label?: string }> = {};
    // K4: кандидаты на зону — библиотека top-2/3 (осознанные дриллы) → каталожный fallback;
    // движок перебирает их канонами билдера и берёт первого прошедшего (замена с note).
    const candidates: Record<string, Array<{ exerciseId: string; sets?: number; reps?: number; repsMax?: number; rir?: number; tempo?: string; restSec?: number; loadFactor?: number; label?: string; allowJunk?: boolean; equipmentAlt?: string[] }>> = {};
    for (const z of zones) {
      try {
        // PRO-CORR: библиотека первична (зона+причина+сигналы+доза); каталоговый топ-3 — fallback.
        const lib = (correctiveTopByZone[z] || [])[0];
        const list: Array<{ exerciseId: string; sets?: number; reps?: number; repsMax?: number; rir?: number; tempo?: string; restSec?: number; loadFactor?: number; label?: string; allowJunk?: boolean; equipmentAlt?: string[] }> = [];
        for (const r of (correctiveTopByZone[z] || [])) {
          const dose = correctiveDose(r.corr, (weakCauses as any)?.[z]?.cause ?? null, corrDoseFlags());
          list.push({
            exerciseId: r.corr.exerciseId, sets: dose.sets, reps: dose.repsMin, repsMax: dose.repsMax, rir: dose.rir, tempo: dose.tempo,
            restSec: r.corr.protocol.restSec, loadFactor: correctiveLoadFactor(r.corr.phase),
            label: `${r.corr.title} · ${dose.note}`, allowJunk: true,
            // K6: «чем заменить» при отказе оборудования — до перехода к следующему кандидату.
            equipmentAlt: r.corr.equipmentAlt.slice(),
          });
        }
        for (const r of (top3ByZone[z] || [])) list.push({ exerciseId: r.id, allowJunk: false });
        if (list.length) candidates[z] = list;
        if (lib) {
          const dose = correctiveDose(lib.corr, (weakCauses as any)?.[z]?.cause ?? null, corrDoseFlags());
          preferredIds[z] = lib.corr.exerciseId;
          // K3: реальная доза — rest/repsMax/loadFactor записи (вес считается в движке от workMax профиля).
          corrective[z] = {
            sets: dose.sets, reps: dose.repsMin, repsMax: dose.repsMax, rir: dose.rir, tempo: dose.tempo,
            restSec: lib.corr.protocol.restSec, loadFactor: correctiveLoadFactor(lib.corr.phase),
            label: `${lib.corr.title} · ${dose.note}`,
          };
          profTempo[z] = dose.tempo;
          continue;
        }
        const top = (top3ByZone[z] || [])[0];
        if (top) preferredIds[z] = top.id;
      } catch { /* noop */ }
    }
    let working: any = plan;
    let injected = 0;
    let skippedBudget = 0;
  let skippedDup = 0;
    let onlyTechSkip = false;
    const nWeeks = Array.isArray(working.weeks) ? working.weeks.length : 0;
    for (let wi = 0; wi < nWeeks; wi++) {
      if (!working.weeks[wi] || working.weeks[wi].deload) continue;
      const sw = specWeeks[wi] || specWeeks[specWeeks.length - 1];
      const targetSets: Record<string, number> = {};
      if (sw) for (const z of zones) {
        const v = Number((sw.targetSets as any)?.[z]);
        if (Number.isFinite(v)) targetSets[z] = v;
      }
      try {
        // PRO-3 R2 + S3: готовность + возврат + L/R-добивка двигают вставку (не мезоцикл)
        const baseRir = readiness?.level === 'red' ? 1 : 0;
        const baseVol = readiness?.level === 'red' ? 0.75 : 1;
        const retAct = returnActive?.action ?? null;
        const rirShift = baseRir + (retAct ? retAct.rirShift : 0);
        const volumeMult = baseVol * (retAct ? retAct.volumeMult : 1);
        if (retAct && retAct.volumeMult <= 0) {
          onlyTechSkip = true;
          skippedBudget++;
          continue;
        }
        const unilateralTopUp: Record<string, { side: 'left' | 'right'; sets: number }> = {};
        try {
          if (!retAct || retAct.volumeMult > 0) {
            for (const v of lrVerdicts) {
              if ((v.verdict === 'topup' || v.verdict === 'watch') && v.weakSide) {
                unilateralTopUp[v.group] = { side: v.weakSide, sets: Math.max(1, Math.min(3, v.topUpSets)) };
              }
            }
          }
        } catch { /* noop */ }
        const r = injectBBWeakPoints(working, zones, { dayMap, targetSets, profTempo, preferredIds, corrective, correctiveCandidates: candidates, equipment: profileEquipment, mobilityRestrictions: profileMobility, workMax: profileWorkMax, weekIdxs: [wi], level, rirShift, volumeMult, unilateralTopUp, returnAction: retAct ?? undefined });
        working = r.plan;
        injected += r.injected;
        skippedBudget += r.skippedBudget;
        skippedDup += r.skippedDup;
      } catch { /* noop */ }
    }
    // Честный счёт пропусков: «уже есть в днях» — это r.skippedDup, а не догадка.
    // Только-техника — отдельная причина (ступень возврата), её нельзя писать как «бюджет».
    const skipNote = [
      skippedBudget > 0 ? `бюджет: ${skippedBudget}` : '',
      skippedDup > 0 ? `уже в плане: ${skippedDup}` : '',
    ].filter(Boolean).join(' · ');
    if (!injected) {
      setToast(onlyTechSkip
        ? '↩ Ступень 1 — вставка без силового объёма (только техника). Выбери ступень 2–3, когда боли нет'
        : `⊘ Не вставлено (${skipNote || 'нечего вставлять'})`);
      scheduleToastClear(3000);
      return;
    }
    // Аудит 2026-11: инъекция писала план в обход bb-plan-save-guard — план с
    // критическим SafetyScore (<60) доезжал до хранилища и мог быть исполнен.
    // Валидацию проверяем, только если она есть у плана (у сохранённого её может не быть).
    try {
      const safety = calculatePlanSafetyScore(working as any, {
        mobilityRestrictions: (profileMobility || []) as string[],
        currentPain: state.acutePain ? [String(state.pmLoc || 'acute')] : [],
      });
      const hasValidation = !!(working as any).validation;
      const block = hasValidation
        ? bbPlanSaveBlockReason(working as any, safety)
        : (safety.riskLevel === 'dangerous'
          ? `⛔ План не записан: SafetyScore ${safety.score}/100 (<60 — критические риски). ${safety.recommendations?.[0] || ''}`.trim()
          : null);
      if (block) {
        setToast(block);
        scheduleToastClear(4000);
        return;
      }
    } catch { /* noop */ }
    // Снапшот — только при реальном изменении + журнал последних (для отката на N шагов)
    try {
      // _prev хранит ровно то, что было в каноническом ключе. Если канонического
      // плана не было (план пришёл из he_bb_plans), ставим маркер «не было» —
      // иначе откат записал бы в he_bb_plan_saved массив вариантов.
      let prevRaw: string;
      if (rawKey === 'saved') prevRaw = raw as string;
      else {
        const existed = (() => { try { return localStorage.getItem('he_bb_plan_saved'); } catch { return null; } })();
        prevRaw = existed || JSON.stringify({ __bbDiagNone: true });
      }
      localStorage.setItem('he_bb_plan_saved_prev', prevRaw);
      const next = pushPlanSnapshot(planHistory, {
        date: localIsoDate(),
        label: `до вставки: ${zones.map(weakRu).join(', ')}`,
        plan,
      });
      localStorage.setItem('he_bb_plan_history', JSON.stringify(next));
    } catch { /* noop */ }
    try {
      working.rationale = [...(working.rationale || []), `ББ-диагностика: вставка коррекций (${zones.map(weakRu).join(', ')})`];
      localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: working, date: new Date().toISOString() }));
    } catch {
      setToast('Не влезло в хранилище — очисти старые планы');
      scheduleToastClear(2500);
      return;
    }
    setHasInjectPrev(true);
    // BB-G-04: журнал вставок — единственный способ потом честно сравнить
    // «сеты/нед по зоне до и после» (план перезаписан, исходных цифр больше нет).
    try { setInjections(logDiagInjection({ date: localIsoDate(), zones })); } catch { /* журнал не критичен */ }
    setPlanNonce((n) => n + 1);
    // detail обязателен: конструктор по нему отличает «вставку диагностики» от
    // «план из годового планировщика» и не затирает несохранённую сборку молча.
    try { window.dispatchEvent(new CustomEvent('he-bb-plan-saved', { detail: { source: 'bb-diag-injection', injected, zones, date: localIsoDate() } })); } catch { /* noop */ }
    setToast(`✓ Вставлено коррекций: ${injected} (нед: ${nWeeks})${skipNote ? ` · пропущено (${skipNote})` : ''} · открыт ББ-авто`);
    scheduleToastClear(3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'bb' } as any));
      localStorage.setItem('he_training_planning_track', 'bb');
    } catch { /* noop */ }
  };

  const handleRollbackInject = () => {
    let prev: string | null = null;
    try { prev = localStorage.getItem('he_bb_plan_saved_prev'); } catch { /* noop */ }
    if (!prev) {
      // Раньше молчаливый return: кнопка нажималась, ничего не происходило.
      setHasInjectPrev(false);
      setToast('↩ Откатывать нечего: снимка до вставки нет');
      scheduleToastClear(2500);
      return;
    }
    try {
      // Маркер «канонического плана не было» — откат = удалить ключ, а не записать маркер.
      let isNone = false;
      try { isNone = !!JSON.parse(prev)?.__bbDiagNone; } catch { /* noop */ }
      if (isNone) localStorage.removeItem('he_bb_plan_saved');
      else localStorage.setItem('he_bb_plan_saved', prev);
      localStorage.removeItem('he_bb_plan_saved_prev');
    } catch { /* noop */ }
    setHasInjectPrev(false);
    setPlanNonce((n) => n + 1);
    try { window.dispatchEvent(new CustomEvent('he-bb-plan-saved', { detail: { source: 'bb-diag-rollback' } })); } catch { /* noop */ }
    setToast('↩ План восстановлен до инъекции');
    scheduleToastClear(2500);
  };

  // Э5-доводка (R6): журнал плана — одно чтение на рендер (инъекция/откат бампят planNonce)
  const planHistory = useMemo(() => {
    try { return readPlanHistory(localStorage.getItem('he_bb_plan_history')); } catch { return []; }
  }, [planNonce]);

  const handleRestoreSnapshot = (idx: number) => {
    const snap: PlanSnapshot | null = planHistory[idx] || null;
    if (!snap) return;
    // Восстановление снимка ≠ «инъекция в истории»: иначе кнопка «↩ Откатить вставку»
    // оставалась живой и возвращала не тот план, откат которого обещал.
    setHasInjectPrev(false);
    try { localStorage.removeItem('he_bb_plan_saved_prev'); } catch { /* noop */ }
    try {
      localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: snap.plan, date: new Date().toISOString() }));
    } catch {
      setToast('Не влезло в хранилище — очисти старые планы');
      scheduleToastClear(2500);
      return;
    }
    setPlanNonce((n) => n + 1);
    try { window.dispatchEvent(new CustomEvent('he-bb-plan-saved', { detail: { source: 'bb-diag-snapshot' } })); } catch { /* noop */ }
    setToast(`↩ Восстановлен снимок ${snap.date} (${snap.label || 'без метки'})`);
    scheduleToastClear(2500);
  };

  return (
    <div className="train-bbdiag" data-bb="hub-root" style={{ padding: '6px 6px 12px', color: '#fff', maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ ...CARD, padding: '10px 10px 8px', margin: 0, background: 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(168,85,247,0.08))', border: '1px solid rgba(0,230,138,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(0,230,138,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#00e68a,#a855f7)', color: '#fff', fontWeight: 900, fontSize: 16 }}>💪</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Движения ББ — диагностика</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>Скрининг + разбор упражнения + стимул-карта + пропорции. Нагрузка — ⚡ Интеллект, объём — 📐 Объём-хаб, суставы — 🦴 Ортопедия (здесь только ссылки).</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              data-bb="score"
              data-state={noDataAtAll ? 'nodata' : sLevel}
              title={noDataAtAll ? 'Данных нет: скрининг не заполнен, замеров и дневника нет — балл не считается' : undefined}
              style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${sColor} ${noDataAtAll ? 0 : score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${noDataAtAll ? 'rgba(148,163,184,0.45)' : sColor}`, fontWeight: 900, color: noDataAtAll ? '#94a3b8' : '#fff', fontSize: 14 }}
            >{noDataAtAll ? '—' : score}</div>
            <div
              style={{ fontSize: 9, color: sColor, fontWeight: 700, marginTop: 2 }}
              title={noDataAtAll
                ? 'Пока нечего оценивать: сюда должны прийти скрининг, замеры или дневник'
                : report.score.verificationMissing.length
                  ? `Не подтверждено: ${report.score.verificationMissing.map(c => BB_VERIFICATION_LABEL_RU[c]).join(', ')}`
                  : 'Все каналы данных подтверждены'}
            >{sLabel} · пров. {report.score.verification > 0 ? `${Math.round(report.score.verification * 100)}%` : '—'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>Драйвер: {moveDriver.driver === 'none' ? '—' : moveDriver.label}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}>{report.weakMusclesCanonical.length ? `${report.weakMusclesCanonical.length} слабые` : 'баланс'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: !report.symmetry.tested ? 'rgba(255,255,255,0.04)' : report.symmetry.score < 70 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: !report.symmetry.tested ? '#94a3b8' : report.symmetry.score < 70 ? '#ef4444' : '#22c55e' }}>{report.symmetry.tested ? `Симметрия ${report.symmetry.score}` : 'Симметрия — нет замеров'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: report.stimulus.noPlan ? '#94a3b8' : '#fff' }}>{report.stimulus.noPlan ? 'Стимул — нет плана' : report.stimulus.scorePenalty ? `Стимул −${report.stimulus.scorePenalty}` : 'Стимул: порядок'}</span>
          {planAudit && <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.avgSfr != null && planAudit.avgSfr < 3.5 ? '#ef4444' : '#22c55e' }}>SFR {planAudit.avgSfr ?? '—'}</span>}
          {planAudit && <span style={{ padding: '2px 8px', borderRadius: 20, background: planAudit.lengthenedRatio < 0.3 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: planAudit.lengthenedRatio < 0.3 ? '#ef4444' : '#22c55e' }}>раст. {(planAudit.lengthenedRatio * 100).toFixed(0)}%</span>}
          {report.score.floors.length > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444' }}>порог: {report.score.floors[0]}</span>}
        </div>
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери слабые зоны + упражнение → разбор 12 признаков + «как дать в мышцу» → изменение эффекта. Кнопка <b style={{ color: '#00e68a' }}>«Применить в ББ-авто»</b> отправит зоны + технику/темп/замену в конструктор (стимул + растянутая позиция + рисунок движения).
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 10 }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: Object.keys(measNum).length >= 3 ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: Object.keys(measNum).length >= 3 ? '#22c55e' : '#f59e0b' }}>1.Замеры {Object.keys(measNum).length >= 3 ? '✓' : '→ Пропорции'}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: diarySessions.length >= 4 ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', border: '1px solid rgba(255,255,255,0.06)', color: diarySessions.length >= 4 ? '#22c55e' : '#f59e0b' }}>2.Дневник/план {diarySessions.length >= 4 ? `✓ ${diarySessions.length}` : '→ введи тренировки'}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: report.weakZonesGranular.length ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: report.weakZonesGranular.length ? '#22c55e' : '#fff' }}>3.Коррекция {report.weakZonesGranular.length ? `→ ${report.weakZonesGranular.join(', ')}` : '— выбери зону'}</span>
        </div>
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      <BbNextActionsCard
        actions={nextActions.actions}
        note={nextActions.note}
        onGoScreen={goToScreen}
        onGoTab={(id) => setTab(id as BBTab)}
      />

      <div style={{ ...CARD, padding: 10, margin: 0 }} data-bb="tabs-card">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }} data-bb="tabs-row">
          {TAB_DEFS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} aria-pressed={tab === t.id} data-bb="tab" data-active={tab === t.id ? '1' : '0'} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 999, border: '1px solid', borderColor: tab === t.id ? '#00e68a' : 'rgba(255,255,255,0.12)', background: tab === t.id ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)', color: tab === t.id ? '#00e68a' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={applyToConstructor} data-bb="apply-top" style={{ marginLeft: 'auto', minHeight: 44, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>→ В ББ-авто</button>
        </div>

        {tab === 'weak' && (
          <BbWeakTab
            state={state}
            setState={setState}
            toggleWeak={toggleWeak}
            bbPlan={bbPlan}
            canonicalMuscle={canonicalMuscle}
            chipStyle={chipStyle}
            corrBlockLines={corrBlockLines}
            corrDoseFlags={corrDoseFlags}
            corrInPlanDropped={corrInPlanDropped}
            correctiveDose={correctiveDose}
            correctiveLoadFactor={correctiveLoadFactor}
            correctiveTopByZone={correctiveTopByZone}
            correctiveWeightHint={correctiveWeightHint}
            diarySessions={diarySessions}
            e1rmTrend={e1rmTrend}
            handleAnnualApply={handleAnnualApply}
            handleInjectToPlan={handleInjectToPlan}
            handleRestoreSnapshot={handleRestoreSnapshot}
            handleRollbackInject={handleRollbackInject}
            handleSpecIcs={handleSpecIcs}
            hasInjectPrev={hasInjectPrev}
            headCoverage={headCoverage}
            lastWeakHeads={lastWeakHeads}
            lrDirection={lrDirection}
            lrVerdicts={lrVerdicts}
            mmcAdvice={mmcAdvice}
            planHistory={planHistory}
            profileWorkMax={profileWorkMax}
            readiness={readiness}
            redFlags={redFlags}
            report={report}
            returnActive={returnActive}
            returnCriteria={returnCriteria}
            returnToPlan={returnToPlan}
            top3ByZone={top3ByZone}
            weakCauses={weakCauses}
            weakRu={weakRu}
            GRANULAR_OPTS={GRANULAR_OPTS}
            MUSCLE_LABEL_RU={MUSCLE_LABEL_RU}
            LR_PHASE_ASYM_NOTE={LR_PHASE_ASYM_NOTE}
          />
        )}

        {tab === 'symmetry' && (
          <BbSymmetryTab
            state={state}
            setState={setState}
            symmetry={report.symmetry}
            mcCallum={mcCallum}
            triadDev={triadDev}
            measureHist={measureHist}
            takeMeasureSnapshot={takeMeasureSnapshot}
            measNum={measNum}
            circRu={circRu}
          />
        )}

        {tab === 'exercise' && (
          <BbExerciseTab
            state={state}
            setState={setState}
            weakRu={weakRu}
            LVP_LIFTS={LVP_LIFTS}
            MUSCLE_LABEL_RU={MUSCLE_LABEL_RU}
            asymMax={asymMax}
            bbPlan={bbPlan}
            buildExerciseInstructions={buildExerciseInstructions}
            calcExerciseEffect={calcExerciseEffect}
            clearLvp={clearLvp}
            exPicker={exPicker}
            exQuery={exQuery}
            exerciseEffectScore={exerciseEffectScore}
            exerciseLibrary={exerciseLibrary}
            flagRu={flagRu}
            handleApplyExerciseCorrection={handleApplyExerciseCorrection}
            headsHitOf={headsHitOf}
            libWeakHeads={libWeakHeads}
            lvpLift={lvpLift}
            lvpProfile={lvpProfile}
            lvpSaved={lvpSaved}
            lvpText={lvpText}
            lvpWorkingRange={lvpWorkingRange}
            planAudit={planAudit}
            profileRu={profileRu}
            report={report}
            runLvp={runLvp}
            selectWorstExercise={selectWorstExercise}
            selectedCorrections={selectedCorrections}
            selectedDiagnosis={selectedDiagnosis}
            selectedExRaw={selectedExRaw}
            selectedProf={selectedProf}
            setExQuery={setExQuery}
            setLvpLift={setLvpLift}
            setLvpText={setLvpText}
            simulateCorrection={simulateCorrection}
            weakListRu={weakListRu}
          />
        )}

        {tab === 'stimulus' && (
          <BbStimulusTab report={report} planAudit={planAudit} balance={balance} muscleLabelRu={MUSCLE_LABEL_RU} />
        )}

        {tab === 'volume' && (
          <BbVolumeTab panel={vrPanel} effect={corrEffect} level={level} zoneLabel={weakRu} onGoScreen={goToScreen} />
        )}

        {tab === 'screening' && (
          <BbScreeningTab
            state={state}
            setState={setState}
            setToast={setToast}
            touchScreen={touchScreen}
            ohs={ohs}
            moveDriver={moveDriver}
            singleLeg={singleLeg}
            shoulderV={shoulderV}
            rotV={rotV}
            hingeV={hingeV}
            loadedV={loadedV}
            loadedHingeV={loadedHingeV}
            ybtV={ybtV}
            asymText={asymText}
            driverSubs={driverSubs}
            benchV={benchV}
            painMon={painMon}
            painJointTendon={painJointTendon}
            nheV={nheV}
            adductorV={adductorV}
            erIrV={erIrV}
            screenPriority={screenPriority}
            screenHist={screenHist}
            setScreenHist={setScreenHist}
            screenCodes={screenCodes}
            screenDelta={screenDelta}
            teenGate={teenGate}
            applyMobilityToProfile={applyMobilityToProfile}
            trackedRu={trackedRu}
          />
        )}
      </div>

      <div style={{ ...CARD, padding: 10, margin: 0, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.16)' }} data-bb="footer">
        <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>Выбрано: {weakListRu(report.weakZonesGranular) || '— баланс'} · оценка {noDataAtAll ? '—' : score} · пров. {report.score.verification > 0 ? `${Math.round(report.score.verification * 100)}%` : '—'} {report.score.floors.join(' · ')}</div>
        <div style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>{report.findings.slice(0, 3).join(' · ') || '—'}</div>
        {/* BB-D-39: тренд балла к предыдущему замеру (честно: без второго замера — «мало данных»). */}
        <div data-bb="diag-history" style={{ fontSize: 10, color: diagTrend.delta == null ? '#9ca3af' : diagTrend.delta > 0 ? '#22c55e' : diagTrend.delta < 0 ? '#f87171' : '#9ca3af', lineHeight: 1.5, marginBottom: 6 }}>
          {diagTrend.text}
        </div>
        {/* AUDIT 2026-11 (BB-D-38): ориентиры по возрасту/полу считались, но не показывались. */}
        {(teenNoteText || (femaleNotesShort && femaleNotesShort.length > 0)) && (
          <div data-bb="sex-age-notes" style={{ fontSize: 10, color: '#a78bfa', lineHeight: 1.5, marginBottom: 6 }}>
            {teenNoteText ? `🧒 ${teenNoteText}` : ''}
            {teenNoteText && femaleNotesShort && femaleNotesShort.length ? ' · ' : ''}
            {femaleNotesShort && femaleNotesShort.length ? `♀ ${femaleNotesShort.join(' · ')}` : ''}
          </div>
        )}
        {sLevel === 'critical' && <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>⚠️ Критично — урезание предельного объёма и коррекция до пика. Проверь присед-тест + объём.</div>}
        {specBlock && (
          <div style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)', fontSize: 11, lineHeight: 1.5 }} data-bb="spec-block">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
              <b style={{ color: '#fff' }}>Спец-блок {specBlock.lengthWeeks} нед: {report.weakZonesGranular.map(weakRu).join(', ')}</b>
              <span style={{ marginLeft: 'auto', minWidth: 120, flex: '0 1 140px' }}><BbNum label="Длина блока, нед (4–6)" value={state.specWeeks} onChange={(v) => setState(s => ({ ...s, specWeeks: v }))} placeholder="6" step={1} /></span>
              <button onClick={() => setState(s => ({ ...s, showSpecBlock: !s.showSpecBlock }))} data-bb="spec-toggle" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{state.showSpecBlock ? 'Скрыть' : 'Недели'}</button>
            </div>
            <div style={{ color: '#fff' }}>{specBlock.rationale.join(' · ')}</div>
            {state.showSpecBlock && <div style={{ marginTop: 4, color: '#fff' }}>{specBlock.weeks.slice(0, 8).map((w) => `Н${w.week}: ${Object.entries(w.targetSets).map(([k, v]) => `${MUSCLE_LABEL_RU[k] || k} ${v}`).join(', ')} ×${Object.entries(w.frequency).map(([, f]) => `${f}`).join('/')}/нед`).join(' · ')}</div>}
          </div>
        )}
        {/* ROUND-10: превью моста — что реально уедет в конструктор (паритет с ТА/стронг/арм) */}
        <div style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)', fontSize: 11, lineHeight: 1.5 }} data-bb="bridge-preview">
          <b style={{ color: '#60a5fa' }}>📦 Что уедет в конструктор</b>
          {(() => {
            try {
              const lines: string[] = [];
              const zones = report.weakZonesGranular.map(weakRu);
              if (zones.length) lines.push(`Зоны: ${zones.join(', ')}`);
              // упражнения — из ТОГО ЖЕ источника, что уходит в мост (top3ByZone → preferredExerciseIds)
              const names = report.weakZonesGranular.map((z) => {
                const first = (correctiveTopByZone[z] || [])[0];
                if (!first) return null;
                try {
                  const c = (EXERCISE_CATALOG as Array<{ id?: string; name?: string }>).find((e) => String(e.id).toLowerCase() === String(first.corr.exerciseId).toLowerCase());
                  return c?.name ? String(c.name) : first.corr.exerciseId;
                } catch { return first.corr.exerciseId; }
              }).filter((x): x is string => !!x);
              if (names.length) lines.push(`Упражнения (⭐ первым): ${names.slice(0, 6).join(', ')}`);
              const det = Array.isArray(correctiveDetailForExport) ? correctiveDetailForExport.slice(0, 3) : [];
              if (det.length) lines.push(`Коррекции: ${det.map((d) => `${String((d as { zone?: unknown }).zone ?? '')}: ${String((d as { protocol?: unknown }).protocol ?? '')}`).join(' · ')}`);
              if (corrBlockLines) lines.push(`Блок: ${corrBlockLines.block.summary}`);
              if (specBlock) lines.push(`Спец-блок: ${specBlock.lengthWeeks} нед, доноры ${specBlock.donors.join(', ') || '—'}`);
              if (lrDirection?.length) lines.push(`Перекос: ${lrDirection.map((d) => String(d.text)).join(' · ')}`);
              if (!lines.length) return <div style={{ color: '#fff' }} data-bb="bridge-empty">Нечего отправлять — нет слабых зон/причин (баланс).</div>;
              return <div style={{ color: '#fff' }}>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>;
            } catch { return null; }
          })()}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-bb="export-row">
          <button onClick={applyToConstructor} data-bb="apply-bottom" style={{ flex: '2 1 200px', minHeight: 52, padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>→ Применить в ББ-авто ({report.weakZonesGranular.map(weakRu).join(', ') || 'баланс'})</button>
          <button onClick={handleExport} data-bb="export-html" style={{ flex: '1 1 120px', minHeight: 52, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>⤓ HTML</button>
          <button onClick={handleExportPrint} data-bb="export-print" style={{ flex: '1 1 120px', minHeight: 52, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>🖨 Печать</button>
          <button onClick={handleExportCsv} data-bb="export-csv" style={{ flex: '1 1 120px', minHeight: 52, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>📊 Таблица</button>
        </div>
        <div style={{ fontSize: 11, color: '#fff', marginTop: 6 }}>Объём: <b>📐 Объём-хаб</b> · Нагрузка: <b>⚡ Интеллект</b> · Суставы: <b>🦴 Суставы и ортопедия</b> · Сила: <b>🏋️ Анализ силы</b> — без дублей, только чтение.</div>
      </div>
    </div>
  );
};

export default BBDiagnosticsHub;
