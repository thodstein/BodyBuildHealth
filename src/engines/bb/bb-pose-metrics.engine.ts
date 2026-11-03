/**
 * bb-pose-metrics.engine.ts — BB-G-05: метрики позы из лендмарков (BlazePose 33 точки).
 *
 * Чистые функции: кадры лендмарков → сводка (глубина, наклон корпуса, пятка, вальгус,
 * сдвиг/перекос таза, руки над стопой). Ни DOM, ни камеры, ни модели — поэтому весь
 * расчёт проверяется юнит-тестами без WebView и WASM.
 *
 * ЧЕСТНОСТЬ 2D (почему два ракурса, а не «всё сразу»):
 *  - Фронтально видно вальгус/сдвиг/перекос таза, но НЕ видно глубину приседа
 *    (колено сгибается в плоскости камеры — угол проецируется).
 *  - Сбоку видно глубину/наклон корпуса/подъём пятки, но НЕ видно вальгус
 *    (сведение колена происходит по нормали к камере).
 *  Поэтому каждый показатель считается только в своём ракурсе, а в чужом — null
 *  с пояснением, а не «0° = идеально». Ноль означает «измерили и ноль», не «не смотрели».
 *
 * Пороги — продукт-решения (документ §10.9.2): выше/ниже них меняется вердикт,
 * поэтому они лежат в одном месте и попадают в отчёт («что значит 8°»).
 */

/** Лендмарк BlazePose: нормализованные координаты [0..1], y вниз, visibility — уверенность. */
export interface BbPoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type BbPoseView = 'front' | 'side';

/** Индексы BlazePose Pose (33 точки). Один источник для движка и UI. */
export const BB_POSE_LM = {
  shoulderL: 11, shoulderR: 12,
  wristL: 15, wristR: 16,
  hipL: 23, hipR: 24,
  kneeL: 25, kneeR: 26,
  ankleL: 27, ankleR: 28,
  heelL: 29, heelR: 30,
  toeL: 31, toeR: 32,
} as const;

/** Пороги вердиктов. Меняются здесь — и меняется отчёт (он печатает эти же числа). */
export const BB_POSE_THRESHOLDS = {
  /** Угол в колене (180 = прямая нога): ≤100 — глубоко, ≤120 — до параллели. */
  depthDeep: 100,
  depthParallel: 120,
  /** Наклон корпуса к вертикали: >25 — умеренный, >45 — сильный. */
  trunkModerate: 25,
  trunkExcessive: 45,
  /** Вальгус (колено внутрь, °): ≥5 — пограничный, ≥10 — заметный. */
  valgusBorderline: 5,
  valgusNotable: 10,
  /** Сдвиг таза / перекос таза, % ширины стойки. */
  shiftBorderline: 6,
  shiftNotable: 10,
  pelvicBorderline: 4,
  pelvicNotable: 8,
  /** Подъём пятки, % длины стопы: ≥15 — подъём есть, ≥30 — заметный. */
  heelBorderline: 15,
  heelNotable: 30,
  /** Руки над серединой стопы: допуск в долях длины «плечо–таз». */
  armsOverMidfootTol: 0.2,
  /** Минимальная уверенность точки, чтобы кадр считался кадром с позой. */
  visMin: 0.5,
  /** Меньше этого числа кадров — результат черновой (quality: 'low'). */
  minPosedFrames: 4,
} as const;

export type BbPoseQuality = 'ok' | 'low' | 'none';
export type BbDepthLevel = 'deep' | 'parallel' | 'shallow';
export type BbTrunkLevel = 'upright' | 'moderate' | 'excessive';
export type BbDeviationLevel = 'none' | 'borderline' | 'notable';

export interface BbPoseSummary {
  view: BbPoseView;
  framesTotal: number;
  framesPosed: number;
  quality: BbPoseQuality;
  /** Сбоку: угол в колене в самой глубокой точке (180 = прямая нога). */
  depthKneeDeg: number | null;
  depthLevel: BbDepthLevel | null;
  /** Сбоку: наклон корпуса в самой глубокой точке, °. */
  trunkLeanDeg: number | null;
  trunkLevel: BbTrunkLevel | null;
  /** Сбоку: подъём пятки в самой глубокой точке, % длины стопы. */
  heelRisePct: number | null;
  /** Фронтально: вальгус (плюс = колено внутрь), °. */
  valgusDeg: number | null;
  valgusLevel: BbDeviationLevel | null;
  /** Фронтально: сдвиг таза от середины стоп, % ширины стойки. */
  hipShiftPct: number | null;
  hipShiftLevel: BbDeviationLevel | null;
  /** Фронтально: перекос таза (разница высот), % ширины стойки. */
  pelvicDropPct: number | null;
  pelvicDropLevel: BbDeviationLevel | null;
  /** Оба ракурса: доля кадров, где кисти над серединой стопы, %. */
  armsOverMidfootPct: number | null;
  thresholds: typeof BB_POSE_THRESHOLDS;
  notes: string[];
}

/** Подпись уровня для UI/отчёта (один словарь — «показано = выгружено»). */
export const BB_POSE_LEVEL_RU: Record<string, string> = {
  deep: 'глубоко (таз ниже параллели)',
  parallel: 'до параллели',
  shallow: 'неполная глубина',
  upright: 'корпус вертикально',
  moderate: 'умеренный наклон',
  excessive: 'сильный наклон',
  none: 'в норме',
  borderline: 'пограничный',
  notable: 'заметный',
};

export const BB_POSE_QUALITY_RU: Record<BbPoseQuality, string> = {
  ok: 'ок',
  low: 'черновой (мало кадров)',
  none: 'поза не найдена',
};

/** Честные ограничения ракурса — печатаются и в карточке, и в отчёте. */
export const BB_POSE_VIEW_NOTE: Record<BbPoseView, string> = {
  front:
    'Ракурс фронтально: вальгус, сдвиг и перекос таза. Глубина приседа и наклон корпуса в этой проекции не измеряются — для них нужен ракурс сбоку.',
  side:
    'Ракурс сбоку: глубина, наклон корпуса, подъём пятки. Вальгус и сдвиг таза в этой проекции не видны — для них нужен фронтальный ракурс.',
};

export const BB_POSE_2D_NOTE =
  '2D-видео: углы — оценка по проекции. Поворот телефона больше ~15° и съёмка сверху/снизу искажают цифры; чистый ракурс важнее качества записи.';

/** Что переносится в OHS-скрининг, а что нет (чтобы «→ В скрининг» не врал). */
export const BB_POSE_APPLY_NOTE =
  'В скрининг переносятся только измеренные признаки: вальгус (фронт), глубина и наклон корпуса (сбоку), пятка (сбоку), руки над стопой. Нейтраль поясницы и «подворот таза» по видео не определяются — их отмечайте сами.';

// ── Геометрия ──────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

const vis = (l: BbPoseLandmark | undefined): number => (l && typeof l.visibility === 'number' ? l.visibility : 1);

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Внутренний угол a–b–c в градусах (180 = прямая). */
export function bbAngleDeg(a: Pt, b: Pt, c: Pt): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const n1 = Math.hypot(abx, aby);
  const n2 = Math.hypot(cbx, cby);
  if (n1 < 1e-6 || n2 < 1e-6) return NaN;
  const cos = Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Наклон отрезка bottom→top к вертикали, ° (0 = вертикально, всё равно в какую сторону). */
export function bbTiltFromVerticalDeg(top: Pt, bottom: Pt): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return NaN;
  return Math.abs((Math.atan2(dx, Math.abs(dy)) * 180) / Math.PI);
}

interface Side {
  shoulder: Pt; hip: Pt; knee: Pt; ankle: Pt; wrist: Pt;
  heel?: Pt; toe?: Pt;
}

function sideOf(lm: BbPoseLandmark[], s: 'L' | 'R'): Side | null {
  const idx = s === 'L'
    ? { sh: BB_POSE_LM.shoulderL, hip: BB_POSE_LM.hipL, knee: BB_POSE_LM.kneeL, ank: BB_POSE_LM.ankleL, wr: BB_POSE_LM.wristL, heel: BB_POSE_LM.heelL, toe: BB_POSE_LM.toeL }
    : { sh: BB_POSE_LM.shoulderR, hip: BB_POSE_LM.hipR, knee: BB_POSE_LM.kneeR, ank: BB_POSE_LM.ankleR, wr: BB_POSE_LM.wristR, heel: BB_POSE_LM.heelR, toe: BB_POSE_LM.toeR };
  const core = [idx.sh, idx.hip, idx.knee, idx.ank].every((i) => lm[i] && vis(lm[i]) >= BB_POSE_THRESHOLDS.visMin);
  if (!core) return null;
  const heel = lm[idx.heel] && vis(lm[idx.heel]) >= BB_POSE_THRESHOLDS.visMin ? lm[idx.heel] : undefined;
  const toe = lm[idx.toe] && vis(lm[idx.toe]) >= BB_POSE_THRESHOLDS.visMin ? lm[idx.toe] : undefined;
  const wrist = lm[idx.wr] && vis(lm[idx.wr]) >= BB_POSE_THRESHOLDS.visMin ? lm[idx.wr] : lm[idx.sh];
  return { shoulder: lm[idx.sh], hip: lm[idx.hip], knee: lm[idx.knee], ankle: lm[idx.ank], wrist, heel, toe };
}

/** Средняя уверенность ключевых точек ноги — выбор «камерной» стороны. */
function sideConfidence(lm: BbPoseLandmark[], s: 'L' | 'R'): number {
  const ids = s === 'L'
    ? [BB_POSE_LM.hipL, BB_POSE_LM.kneeL, BB_POSE_LM.ankleL]
    : [BB_POSE_LM.hipR, BB_POSE_LM.kneeR, BB_POSE_LM.ankleR];
  return ids.reduce((a, i) => a + vis(lm[i]), 0) / ids.length;
}

interface FrameSide {
  kneeDeg: number;
  trunkDeg: number;
  heelRisePct: number | null;
  armsOverMidfoot: boolean | null;
}

interface FrameFront {
  valgusDeg: number;
  hipShiftPct: number;
  pelvicDropPct: number;
  armsOverMidfoot: boolean | null;
}

function armsOverMidfootOk(lm: BbPoseLandmark[], s: Side): boolean | null {
  const footL = lm[BB_POSE_LM.heelL] || lm[BB_POSE_LM.ankleL];
  const footR = lm[BB_POSE_LM.heelR] || lm[BB_POSE_LM.ankleR];
  if (!footL || !footR) return null;
  const toeL = lm[BB_POSE_LM.toeL] || footL;
  const toeR = lm[BB_POSE_LM.toeR] || footR;
  const midFoot = mid(mid(toeL, footL), mid(toeR, footR));
  // Руки над стопой: середина кистей (если видны обе) против середины стоп.
  const wl = lm[BB_POSE_LM.wristL];
  const wr = lm[BB_POSE_LM.wristR];
  const midWrist = wl && wr ? mid(wl, wr) : s.wrist;
  const torso = dist(s.shoulder, s.hip);
  const tol = BB_POSE_THRESHOLDS.armsOverMidfootTol * torso;
  if (!Number.isFinite(tol) || tol <= 0) return null;
  return Math.abs(midWrist.x - midFoot.x) <= tol;
}

function frameSideMetrics(lm: BbPoseLandmark[]): FrameSide | null {
  const l = sideOf(lm, 'L');
  const r = sideOf(lm, 'R');
  const pick = (l && r ? (sideConfidence(lm, 'L') >= sideConfidence(lm, 'R') ? l : r) : l || r);
  if (!pick) return null;
  const kneeDeg = bbAngleDeg(pick.hip, pick.knee, pick.ankle);
  if (!Number.isFinite(kneeDeg)) return null;
  // Наклон корпуса: линия «середина плеч → таз» к вертикали (плечи одной стороны
  // в профиле почти совпадают; если видны оба — берём середину, это устойчивее).
  const sl = lm[BB_POSE_LM.shoulderL];
  const sr = lm[BB_POSE_LM.shoulderR];
  const shoulderPlumb = sl && sr ? mid(sl, sr) : pick.shoulder;
  const trunkDeg = bbTiltFromVerticalDeg(shoulderPlumb, pick.hip);
  let heelRisePct: number | null = null;
  if (pick.heel && pick.toe) {
    const footLen = dist(pick.heel, pick.toe);
    if (footLen > 1e-4) heelRisePct = Math.max(0, ((pick.toe.y - pick.heel.y) / footLen) * 100);
  }
  return { kneeDeg, trunkDeg, heelRisePct, armsOverMidfoot: armsOverMidfootOk(lm, pick) };
}

function frameFrontMetrics(lm: BbPoseLandmark[]): FrameFront | null {
  const l = sideOf(lm, 'L');
  const r = sideOf(lm, 'R');
  if (!l || !r) return null;
  const stance = Math.abs(l.ankle.x - r.ankle.x);
  if (!(stance > 0.02)) return null; // стопы слиплись/не видны — фронтальные метрики недостоверны
  const midHip = mid(l.hip, r.hip);
  const midAnkle = mid(l.ankle, r.ankle);
  const valgus = (s: Side): number => {
    const dy = s.ankle.y - s.hip.y;
    if (Math.abs(dy) < 1e-4) return 0;
    const t = (s.knee.y - s.hip.y) / dy;
    const chordX = s.hip.x + (s.ankle.x - s.hip.x) * t;
    const inward = Math.abs(chordX - midHip.x) - Math.abs(s.knee.x - midHip.x); // px, + = колено внутрь
    return (Math.atan2(inward, Math.abs(dy)) * 180) / Math.PI;
  };
  return {
    valgusDeg: Math.max(valgus(l), valgus(r)),
    hipShiftPct: (Math.abs(midHip.x - midAnkle.x) / stance) * 100,
    pelvicDropPct: (Math.abs(l.hip.y - r.hip.y) / stance) * 100,
    armsOverMidfoot: armsOverMidfootOk(lm, sideConfidence(lm, 'L') >= sideConfidence(lm, 'R') ? l : r),
  };
}

// ── Сводка ─────────────────────────────────────────────────────────────────

const depthLevelOf = (deg: number): BbDepthLevel =>
  deg <= BB_POSE_THRESHOLDS.depthDeep ? 'deep' : deg <= BB_POSE_THRESHOLDS.depthParallel ? 'parallel' : 'shallow';

const trunkLevelOf = (deg: number): BbTrunkLevel =>
  deg <= BB_POSE_THRESHOLDS.trunkModerate ? 'upright' : deg <= BB_POSE_THRESHOLDS.trunkExcessive ? 'moderate' : 'excessive';

const devLevelOf = (v: number, borderline: number, notable: number): BbDeviationLevel =>
  v >= notable ? 'notable' : v >= borderline ? 'borderline' : 'none';

/**
 * Кадры → сводка. Берём «самую глубокую» точку для позных метрик (там паттерн виден
 * максимально), а нарушения (вальгус/сдвиг/перекос) — максимумом по сету: колено,
 * которое «уезжает» хоть раз, уже риск, среднее это размывает.
 */
export function summarizeBbPose(frames: BbPoseLandmark[][], view: BbPoseView): BbPoseSummary {
  const framesTotal = frames.length;
  const notes: string[] = [BB_POSE_VIEW_NOTE[view], BB_POSE_2D_NOTE];
  const base: BbPoseSummary = {
    view, framesTotal, framesPosed: 0, quality: 'none',
    depthKneeDeg: null, depthLevel: null,
    trunkLeanDeg: null, trunkLevel: null,
    heelRisePct: null,
    valgusDeg: null, valgusLevel: null,
    hipShiftPct: null, hipShiftLevel: null,
    pelvicDropPct: null, pelvicDropLevel: null,
    armsOverMidfootPct: null,
    thresholds: BB_POSE_THRESHOLDS,
    notes,
  };
  if (!framesTotal) {
    notes.push('Кадров нет — разбирать нечего.');
    return base;
  }

  const arms: boolean[] = [];
  const pushArms = (v: boolean | null | undefined) => { if (typeof v === 'boolean') arms.push(v); };

  if (view === 'side') {
    const perFrame = frames.map(frameSideMetrics).filter((x): x is FrameSide => !!x);
    base.framesPosed = perFrame.length;
    if (!perFrame.length) {
      notes.push('Поза не распознана ни в одном кадре: нужен весь силуэт от плеч до стоп, свет ровный, ракурс строго сбоку.');
      return base;
    }
    const deepest = perFrame.reduce((a, b) => (b.kneeDeg < a.kneeDeg ? b : a), perFrame[0]);
    base.depthKneeDeg = round1(deepest.kneeDeg);
    base.depthLevel = depthLevelOf(deepest.kneeDeg);
    if (Number.isFinite(deepest.trunkDeg)) {
      base.trunkLeanDeg = round1(deepest.trunkDeg);
      base.trunkLevel = trunkLevelOf(deepest.trunkDeg);
    }
    const heels = perFrame.map((f) => f.heelRisePct).filter((v): v is number => v != null);
    if (heels.length) base.heelRisePct = round1(Math.max(...heels));
    perFrame.forEach((f) => pushArms(f.armsOverMidfoot));
  } else {
    const perFrame = frames.map(frameFrontMetrics).filter((x): x is FrameFront => !!x);
    base.framesPosed = perFrame.length;
    if (!perFrame.length) {
      notes.push('Поза не распознана ни в одном кадре или стопы слиплись: нужен весь силуэт от плеч до стоп и стойка шире плеч.');
      return base;
    }
    const maxOf = (f: (x: FrameFront) => number) => Math.max(...perFrame.map(f));
    const valgus = maxOf((f) => f.valgusDeg);
    base.valgusDeg = round1(valgus);
    base.valgusLevel = devLevelOf(valgus, BB_POSE_THRESHOLDS.valgusBorderline, BB_POSE_THRESHOLDS.valgusNotable);
    const shift = maxOf((f) => f.hipShiftPct);
    base.hipShiftPct = round1(shift);
    base.hipShiftLevel = devLevelOf(shift, BB_POSE_THRESHOLDS.shiftBorderline, BB_POSE_THRESHOLDS.shiftNotable);
    const pelvic = maxOf((f) => f.pelvicDropPct);
    base.pelvicDropPct = round1(pelvic);
    base.pelvicDropLevel = devLevelOf(pelvic, BB_POSE_THRESHOLDS.pelvicBorderline, BB_POSE_THRESHOLDS.pelvicNotable);
    perFrame.forEach((f) => pushArms(f.armsOverMidfoot));
  }

  if (arms.length) base.armsOverMidfootPct = Math.round((arms.filter(Boolean).length / arms.length) * 100);

  const ratio = base.framesPosed / framesTotal;
  if (base.framesPosed < BB_POSE_THRESHOLDS.minPosedFrames || ratio < 0.3) {
    base.quality = 'low';
    notes.push(`Мало кадров с позой (${base.framesPosed} из ${framesTotal}) — результат черновой: переснимите 5 повторов в полный рост.`);
  } else {
    base.quality = 'ok';
  }
  return base;
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

// ── Строки вердикта (UI + отчёт: один источник) ─────────────────────────────

const pct = (v: number): string => `${Math.round(v)}%`;

/** Человеческие строки результата. Пустой массив — измерять нечего. */
export function bbPoseLines(s: BbPoseSummary | null): string[] {
  if (!s || s.framesPosed === 0) return [];
  const out: string[] = [];
  if (s.view === 'side') {
    if (s.depthKneeDeg != null) out.push(`Глубина: колено ${s.depthKneeDeg}° при 180°=прямая — ${BB_POSE_LEVEL_RU[s.depthLevel || 'shallow']}`);
    if (s.trunkLeanDeg != null) out.push(`Наклон корпуса: ${s.trunkLeanDeg}° — ${BB_POSE_LEVEL_RU[s.trunkLevel || 'upright']} (порог 25°/45°)`);
    if (s.heelRisePct != null) out.push(`Пятка: подъём ${pct(s.heelRisePct)} длины стопы — ${s.heelRisePct >= BB_POSE_THRESHOLDS.heelNotable ? 'заметный' : s.heelRisePct >= BB_POSE_THRESHOLDS.heelBorderline ? 'есть' : 'на полу'}`);
  } else {
    if (s.valgusDeg != null) out.push(`Вальгус: ${s.valgusDeg}° внутрь — ${BB_POSE_LEVEL_RU[s.valgusLevel || 'none']} (порог 5°/10°)`);
    if (s.hipShiftPct != null) out.push(`Сдвиг таза: ${pct(s.hipShiftPct)} ширины стойки — ${BB_POSE_LEVEL_RU[s.hipShiftLevel || 'none']}`);
    if (s.pelvicDropPct != null) out.push(`Перекос таза: ${pct(s.pelvicDropPct)} ширины стойки — ${BB_POSE_LEVEL_RU[s.pelvicDropLevel || 'none']}`);
  }
  if (s.armsOverMidfootPct != null) out.push(`Руки над серединой стопы: ${s.armsOverMidfootPct}% кадров`);
  out.push(`Кадров с позой: ${s.framesPosed} из ${s.framesTotal} · качество: ${BB_POSE_QUALITY_RU[s.quality]}`);
  return out;
}

// ── Перенос в OHS-скрининг ─────────────────────────────────────────────────

export interface BbPoseScreeningPatch {
  ohsKneeValgus?: boolean;
  ohsHipBelowParallel?: boolean;
  ohsTrunkUpright?: boolean;
  ohsHeelsFlat?: boolean;
  ohsArmsOverMidfoot?: boolean;
}

/**
 * Измеренные признаки → чекбоксы OHS. Только то, что реально измерено этим ракурсом:
 * фронт даёт вальгус, бок — глубину/корпус/пятку; «руки над стопой» меряется в обоих.
 * Ключи, которых нет в результате, НЕ появляются (иначе «→ В скрининг» ставит галочки
 * по непроверенным признакам — тот же класс вранья, что «✓ Применено» при отказе).
 */
export function bbPoseScreeningPatch(s: BbPoseSummary | null): BbPoseScreeningPatch {
  if (!s || s.framesPosed === 0) return {};
  const p: BbPoseScreeningPatch = {};
  if (s.view === 'front' && s.valgusLevel) p.ohsKneeValgus = s.valgusLevel !== 'none';
  if (s.view === 'side') {
    if (s.depthLevel) p.ohsHipBelowParallel = s.depthLevel === 'deep';
    if (s.trunkLevel) p.ohsTrunkUpright = s.trunkLevel === 'upright';
    if (s.heelRisePct != null) p.ohsHeelsFlat = s.heelRisePct < BB_POSE_THRESHOLDS.heelBorderline;
  }
  if (s.armsOverMidfootPct != null) p.ohsArmsOverMidfoot = s.armsOverMidfootPct >= 60;
  return p;
}

/** Есть ли что переносить (для кнопки «→ В скрининг»). */
export function bbPoseHasPatch(s: BbPoseSummary | null): boolean {
  return Object.keys(bbPoseScreeningPatch(s)).length > 0;
}
