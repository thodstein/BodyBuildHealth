/**
 * bb-hub-state.ts — состояние ББ-диагностики и словари подписей.
 *
 * Декомпозиция `BBDiagnosticsHub.tsx` (волна 3 плана хабов, прецедент
 * `metabolic-hub.parts.tsx`): тип состояния, дефолты, миграции хранилища и
 * RU-подписи движковых id вынесены сюда, чтобы хаб остался контейнером
 * (мемо/хендлеры/композиция), а не хранилищем констант на 2649 строк.
 *
 * Границы: здесь НЕТ React и НЕТ доступа к DOM — только чтение localStorage
 * внутри функций, которые вызывает хаб (модуль можно тестировать как движок).
 * Разметка/интерактив сюда не переезжают.
 */
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { bbNum } from './bb-hub-controls';
import type { BbPoseSummary, BbPoseView } from '../../../engines/bb/bb-pose-metrics.engine';
import type { PainLocation } from '../../../engines/bb/bb-pain-monitor.engine';
import type { CphLevel } from '../../../engines/bb/bb-posterior-readiness.engine';

export const STORAGE_KEY = 'he_bb_diagnostics_hub_v1';
export type BBTab = 'weak' | 'screening' | 'exercise' | 'stimulus' | 'symmetry' | 'volume';

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

export const DEFAULT_STATE: BBState = {
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

export const TAB_DEFS: Array<{ id: BBTab; label: string; icon: string; desc: string }> = [
  { id: 'weak', label: 'Слабые', icon: '🎯', desc: 'зоны 1–2 + причина + топ-3' },
  { id: 'screening', label: 'Скрининг', icon: '🦿', desc: 'присед-тест + драйвер + 1 нога' },
  { id: 'exercise', label: 'Разбор', icon: '🏋️', desc: 'упражнение + техника + замена' },
  { id: 'stimulus', label: 'Стимул-карта', icon: '🎯', desc: 'SFR + длина + углы + читинг' },
  { id: 'symmetry', label: 'Пропорции', icon: '⚖️', desc: 'замеры + лево/право + дельты' },
  { id: 'volume', label: 'Объём · Recovery', icon: '📐', desc: 'ACWR + MRV + ограничитель' },
];

/** Движения LVP-калибровки: один источник для селекта и для подписи рабочего коридора. */
export const LVP_LIFTS: Array<{ id: string; label: string }> = [
  { id: 'squat', label: 'Присед' },
  { id: 'bench', label: 'Жим лёжа' },
  { id: 'deadlift', label: 'Тяга' },
  { id: 'ohp', label: 'Жим стоя' },
  { id: 'row', label: 'Тяга в наклоне' },
];

// Цвета зон (BB-G-01: «нет данных» — серый, а не зелёный) — в `bb-hub-zones.ts`,
// потому что их красят и панель объёма, и карточка «что делать дальше».

export const GRANULAR_OPTS: Array<{ id: string; label: string }> = [  { id: 'delt_mid', label: 'Средняя дельта' },
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
export const trackedRu = (codes: string[]): string => codes.map((c) => TRACKED_CODE_RU[c] || c).join(' · ');
export const profileRu = (p: string | null | undefined): string => (p && PROFILE_RU[p]) || String(p || '—');
const FLAG_RU: Record<string, string> = {
  synergistTakeover: 'нагрузку забирают соседи', stabilityGap: 'не хватает стабильности', wrongHead: 'бьёт мимо слабой головки',
  singleAngle: 'один угол — нужен второй', shortOnly: 'только короткая позиция', missingLengthened: 'нет растянутой позиции',
  jointOverload: 'перегруз сустава', mobilityBlock: 'мешает подвижность', asymRisk: 'риск перекоса',
  tempoOff: 'темп не тот', romShort: 'амплитуда укорочена', cheating: 'читинг',
};
export const flagRu = (f: string): string => FLAG_RU[f] || f;
const CIRC_RU: Record<string, string> = {
  heightCm: 'рост', weightKg: 'вес', chest: 'грудь', waist: 'талия', hips: 'бёдра', neck: 'шея',
  shoulderWidth: 'плечи', bicepL: 'бицепс Л', bicepR: 'бицепс П', bicep: 'бицепс',
  thighL: 'бедро Л', thighR: 'бедро П', calfL: 'голень Л', calfR: 'голень П',
  forearmL: 'предплечье Л', forearmR: 'предплечье П', wristCm: 'запястье',
};
export const circRu = (k: string): string => CIRC_RU[k] || k;
export const weakRu = (z: string): string => GRANULAR_OPTS.find((o) => o.id === z)?.label || MUSCLE_LABEL_RU[z] || z;
export const weakListRu = (zs: string[]): string => zs.map(weakRu).join(' · ');

/* 3.11: единый парсинг плана ББ из localStorage (было 4 копии). */
export function pickPlanFromSaved(parsed: unknown): any | null {
  const j: any = parsed;
  if (Array.isArray(j) && j[0]?.plan?.weeks) return j[0].plan;
  if (j?.plan?.weeks) return j.plan;
  if (j?.weeks) return j;
  return null;
}
export function readSavedBbPlanRaw(): string | null {
  try { return localStorage.getItem('he_bb_plan_saved') || localStorage.getItem('he_bb_plans'); } catch { return null; }
}
export function readSavedBbPlan(): any | null {
  const raw = readSavedBbPlanRaw();
  if (!raw) return null;
  try { return pickPlanFromSaved(JSON.parse(raw)); } catch { return null; }
}

/** КТС: L/R приоритетнее legacy-одиночки; eff — худшая сторона (разница ≥2 см — см. драйвер). */
export function ktwOf(s: { ktwL?: string; ktwR?: string; kneeToWallCm?: string }): { l: number | null; r: number | null; eff: number | null } {
  const num = (v: unknown): number | null => { const n = bbNum(v as any); return n != null && n >= 0 ? n : null; };
  const l = num(s.ktwL) ?? num(s.kneeToWallCm);
  const r = num(s.ktwR) ?? num(s.kneeToWallCm);
  return { l, r, eff: l != null && r != null ? Math.min(l, r) : (l ?? r) };
}

/**
 * Чтение состояния из хранилища с миграциями. Вынесено из `useState`-инициализатора
 * один-в-один: правила те же, но их теперь можно проверить без рендера хаба.
 *
 * Миграции:
 *  - legacy КТС-одиночка → обе стороны;
 *  - BB-G-05: `poseView` вне 'front'/'side' → 'front' (движок читает гид по ракурсу);
 *  - BB-G-05 (2): одиночный `poseResult` → свой ракурс (второй замер не теряется).
 */
export function loadBbHubState(): BBState {
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
}
