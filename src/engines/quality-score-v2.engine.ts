/**
 * quality-score-v2.engine.ts — ЕДИНЫЙ канон оценки качества программы (Quality Hub PRO, P1–P5).
 *
 * Проблема: 5 скорингов (plan-quality S1 / plan-quality-score S2 / manual-quality S3 /
 * pro-quality-analysis S4 / bb-quality-report S5) считали по разным формулам и грейдам.
 * Этот файл — единый источник формул V2: веса подсчёта, MV-статус, session-кап,
 * effective-объём, частота-от-объёма, RIR-гейты, качество делода, плечо v2, длина, нагрузка.
 *
 * Совместимость: S1/S3ww вызывают отсюда ТОЛЬКО отдельные хелперы и только при новых
 * опциональных входах (без новых входов — байт-в-байт старое поведение). Старые сигнатуры
 * НЕ ломаются. Числа VOLUME_LANDMARKS_DB НЕ переписываются.
 *
 * Источники: Israetel/RP MEV-MAV-MRV + MV 0–6 + session MAV 5–12 (Arvo/TrainerStudio 2026);
 * Schoenfeld 2016 (2×>1×) + Grgic 2018 / Hamarsland 2022 (2×≈3–4× при равном объёме);
 * Refalo 2024 (1–2 RIR ≈ отказ) + Martikainen 2025 (волна RIR 4→1); Rogerson Delphi 2024
 * (делод 6.4±1.7 дня каждые 5.6±2.3 нед, объём −30…−50%); Maeo 2021–2023 / Kassiano 2023 /
 * Wolf 2023 / Strey 2026 (длина > короткой, ES 0.283); Gabbett ACWR 0.8–1.3; Foster монотония.
 */

export const QUALITY_WEIGHTS = {
  volume: 40,
  frequency: 15,
  rir: 10,
  deload: 10,
  shoulder: 10,
  length: 10,
  load: 5,
} as const;

export const QUALITY_WEIGHT_SUM = 40 + 15 + 10 + 10 + 10 + 10 + 5; // 100

/** Канонический грейд V2. Legacy-грейды S1 («🟢 Профессионально ≥85») совпадают по границам;
 *  S3 («A ≥90») и S5 (riskLevel) оставлены как есть, V2-грейд — для новых поверхностей. */
export type QualityV2Grade =
  | '🟢 Профессионально'
  | '🟡 Хорошо'
  | '🟠 Удовлетворительно'
  | '🔴 Требует доработки';

export function gradeQualityScore(score: number): QualityV2Grade {
  if (score >= 85) return '🟢 Профессионально';
  if (score >= 65) return '🟡 Хорошо';
  if (score >= 45) return '🟠 Удовлетворительно';
  return '🔴 Требует доработки';
}

export type QualityV2Severity = 'critical' | 'warning' | 'info';

export interface QualityV2Issue {
  id: string;
  severity: QualityV2Severity;
  category: 'volume' | 'frequency' | 'balance' | 'deload' | 'weak_point' | 'progression' | 'exercise' | 'injury' | 'rir' | 'shoulder' | 'length' | 'load';
  message: string;
  muscle?: string;
  fix?: string;
}

export interface QualityV2Breakdown {
  volume: number;
  frequency: number;
  rir: number;
  deload: number;
  shoulder: number;
  length: number;
  load: number;
}

export interface QualityScoreV2 {
  score: number;
  grade: QualityV2Grade;
  perMuscle: Array<{
    muscle: string;
    weeklySets: number;
    effectiveSets: number;
    frequency: number;
    mev: number;
    mav: number;
    mrv: number;
    status: 'below_mev' | 'maintenance' | 'in_mav' | 'approaching_mrv' | 'exceeding_mrv';
  }>;
  issues: QualityV2Issue[];
  recommendations: string[];
  breakdown: QualityV2Breakdown;
  meta: { totalSets: number; muscles: number; hasDiary: boolean };
}

// ─── MV-статус (P1): поддерживающий объём — плашка, не штраф ───

/** Порог maintenance: от половины MEV (минимум 2 сета), MEV=0 (delt_front) — всегда ok. */
export function maintenanceFloor(mev: number): number {
  if (mev <= 0) return 0;
  return Math.max(2, Math.ceil(mev * 0.5));
}

export function mvStatus(
  sets: number,
  mev: number,
): 'below_mev' | 'maintenance' | 'at_or_above_mev' {
  if (mev <= 0) return 'at_or_above_mev';
  if (sets >= mev) return 'at_or_above_mev';
  if (sets >= maintenanceFloor(mev)) return 'maintenance';
  return 'below_mev';
}

// ─── Session-кап (P1): ≤10 прямых сетов на мышцу за сессию (RP session MAV 5–12) ───

export const SESSION_MAV_CAP = 10;

/** maxSetsInSession — максимум прямых сетов мышцы в одной сессии недели. */
export function checkSessionCap(
  muscle: string,
  maxSetsInSession: number | null | undefined,
): QualityV2Issue | null {
  if (maxSetsInSession == null || maxSetsInSession <= SESSION_MAV_CAP) return null;
  return {
    id: `session_cap_${muscle}`,
    severity: 'warning',
    category: 'volume',
    muscle,
    message: `${muscle}: ${maxSetsInSession} сетов в одной сессии > ${SESSION_MAV_CAP} — разбейте на 2 сессии (session MAV 5–12, Israetel/RP)`,
    fix: `Разбить объём ${muscle} на 2 сессии по ≤${SESSION_MAV_CAP} сетов`,
  };
}

// ─── Effective-объём (P1): direct + indirect по паттернам имён ───

/** Коэффициенты косвенной работы (консервативные, паритет с manual-volume/bb-volume:
 *  трицепс 0.45 от жимов, бицепс 0.4 от тяг, дельты 0.3, ягодицы 0.4 от приседа). */
const INDIRECT_TABLE: Array<{ re: RegExp; target: string; coeff: number }> = [
  { re: /жим.*л[её]ж|bench|брус/i, target: 'triceps', coeff: 0.45 },
  { re: /жим.*л[её]ж|bench|брус/i, target: 'delt_front', coeff: 0.3 },
  { re: /жим.*стоя|overhead|армей|воен/i, target: 'triceps', coeff: 0.3 },
  { re: /тяга|row|подтяг|pull.?up|pulldown/i, target: 'biceps', coeff: 0.4 },
  { re: /тяга|row|подтяг/i, target: 'delt_rear', coeff: 0.3 },
  { re: /присед|squat|leg.?press|жим.*ног/i, target: 'glutes', coeff: 0.4 },
  { re: /подъем.*бицепс|biceps?.*curl|сгибан.*рук/i, target: 'forearms', coeff: 0.3 },
];

/**
 * Приближённый effective-объём: сеты мышцы делятся поровну между её именами,
 * indirect начисляется по таблице. Точный расчёт — в analyzeManualVolume (S3);
 * здесь — лёгкая аппроксимация для универсального валидатора (S1), где имён может не быть.
 * Без имён (names пусто) возвращает direct без изменений.
 */
export function applyIndirectBonus(
  directSets: Record<string, number>,
  namesByMuscle?: Record<string, string[]>,
): Record<string, number> {
  const eff: Record<string, number> = { ...directSets };
  if (!namesByMuscle) return eff;
  for (const [muscle, sets] of Object.entries(directSets)) {
    const names = namesByMuscle[muscle] || [];
    if (!names.length || sets <= 0) continue;
    const perName = sets / names.length;
    for (const name of names) {
      for (const row of INDIRECT_TABLE) {
        if (row.re.test(name)) {
          eff[row.target] = (eff[row.target] || 0) + perName * row.coeff;
        }
      }
    }
  }
  for (const k of Object.keys(eff)) eff[k] = Math.round(eff[k] * 10) / 10;
  return eff;
}

// ─── Частота-от-объёма (P2): 1× допустим при объёме ≤ MAV ───

export function frequencyForVolume(
  muscle: string,
  sets: number,
  mav: number,
  mrv: number,
  freq: number,
): QualityV2Issue | null {
  if (freq < 1) {
    return {
      id: `freq_zero_${muscle}`, severity: 'critical', category: 'frequency', muscle,
      message: `${muscle}: тренируется 0×/нед — группа не получает нагрузки`,
      fix: `Добавить день с ${muscle}`,
    };
  }
  if (freq >= 2) return null; // 2×≈3–4× при равном объёме — не штрафуем
  // freq === 1
  if (sets > mrv) {
    return {
      id: `freq_split_${muscle}`, severity: 'critical', category: 'frequency', muscle,
      message: `${muscle}: ${sets} сетов в 1 сессию/нед > MRV (${mrv}) — разбить на ≥2 сессии`,
      fix: `Разбить объём ${muscle} на 2 сессии (Schoenfeld 2016: 2×>1×)`,
    };
  }
  if (sets > mav) {
    return {
      id: `freq_split_${muscle}`, severity: 'warning', category: 'frequency', muscle,
      message: `${muscle}: ${sets} сетов/нед в 1×/нед > MAV (${mav}) — разбейте на 2× (session MAV ≤${SESSION_MAV_CAP})`,
      fix: `Разбить объём ${muscle} на 2 сессии`,
    };
  }
  return {
    id: `freq_once_ok_${muscle}`, severity: 'info', category: 'frequency', muscle,
    message: `${muscle}: 1×/нед при объёме ${sets} ≤ MAV (${mav}) — допустимо (bro-сплит)`,
  };
}

// ─── RIR-гейты (P2): средний RIR 1–3, доля RIR≤2 ≥30%, RIR 0 не новичку ───

export interface RirStats {
  avgRir: number;
  fracRirLE2: number; // доля сетов с RIR≤2
  fracRir0: number; // доля сетов с RIR 0 (отказ)
  totalSets: number;
}

export function rirProfileCheck(stats: RirStats | null | undefined, level: string): QualityV2Issue[] {
  if (!stats || stats.totalSets < 5) return [];
  const out: QualityV2Issue[] = [];
  const lvl = (level || '').toLowerCase();
  const isBeginner = lvl === 'beginner' || lvl === 'novice' || lvl === 'новичок';
  if (isBeginner && stats.fracRir0 > 0) {
    out.push({
      id: 'rir_beginner_failure', severity: 'critical', category: 'rir',
      message: `Новичок с отказными сетами (RIR 0: ${Math.round(stats.fracRir0 * 100)}%) — техника и связки под риском, держите RIR 2–3`,
      fix: 'Поднять RIR до 2–3 во всех сетах',
    });
    return out;
  }
  if (!isBeginner && stats.fracRir0 > 0.15) {
    out.push({
      id: 'rir_too_much_failure', severity: 'warning', category: 'rir',
      message: `Отказных сетов ${Math.round(stats.fracRir0 * 100)}% (>15%) — усталость растёт быстрее стимула (Refalo 2024: 1–2 RIR достаточно)`,
      fix: 'Оставить отказ ≤15% сетов, остальное RIR 1–2',
    });
  }
  if (stats.fracRirLE2 < 0.3) {
    out.push({
      id: 'rir_junk_volume', severity: 'warning', category: 'rir',
      message: `Тяжёлых сетов (RIR≤2) только ${Math.round(stats.fracRirLE2 * 100)}% — остальное «мусорный объём», стимула мало`,
      fix: 'Довести долю RIR≤2 до ≥30% сетов',
    });
  }
  if (stats.avgRir > 3.5 && stats.fracRirLE2 < 0.2) {
    out.push({
      id: 'rir_too_easy', severity: 'warning', category: 'rir',
      message: `Средний RIR ${stats.avgRir.toFixed(1)} — слишком легко, гипертрофии почти нет`,
      fix: 'Снизить средний RIR к 1–3',
    });
  }
  return out;
}

// ─── Качество делода + taper-различение (P3) ───

export interface DeloadQualityInput {
  hasDeload: boolean;
  totalWeeks: number;
  deloadWeeks: number[];
  /** Срез объёма в делод (0–1, напр. 0.4 = −40%). null = нет данных. */
  depthVolume?: number | null;
  /** Прирост RIR в делод (напр. 2). null = нет данных. */
  rirShift?: number | null;
  /** Срез нагрузки в делод (0–1). null = нет данных. */
  loadDrop?: number | null;
  phaseTag?: 'deload' | 'taper' | 'peak' | 'none';
}

export function deloadQualityCheck(d: DeloadQualityInput): QualityV2Issue[] {
  const out: QualityV2Issue[] = [];
  const tag = d.phaseTag || 'none';
  if (!d.hasDeload && d.totalWeeks >= 6 && tag !== 'taper' && tag !== 'peak') {
    out.push({
      id: 'no_deload', severity: 'critical', category: 'deload',
      message: `Нет разгрузочной фазы при мезо ${d.totalWeeks} нед — риск перетренированности`,
      fix: 'Добавить разгрузку каждые 4–6 недель (объём −30…−50%, RIR+2)',
    });
    return out;
  }
  if (!d.hasDeload) return out;
  // Призрачный делод: флаг есть, среза нет
  if (d.depthVolume != null && d.depthVolume < 0.15) {
    out.push({
      id: 'deload_ghost', severity: 'warning', category: 'deload',
      message: `Делод-призрак: флаг есть, а объём срезан лишь на ${Math.round(d.depthVolume * 100)}% (<15%) — усталость не уйдёт`,
      fix: 'Срезать объём делода на 30–50%',
    });
  }
  if (d.rirShift != null && d.rirShift < 1 && tag === 'deload') {
    out.push({
      id: 'deload_no_rir_shift', severity: 'warning', category: 'deload',
      message: 'Делод без сдвига RIR — добавьте +2 RIR к рабочим весам',
      fix: 'Поднять RIR делода на +2',
    });
  }
  // Taper держит интенсивность — это норма, не ошибка
  if (tag === 'taper' && d.loadDrop != null && d.loadDrop > 0.3) {
    out.push({
      id: 'taper_intensity_drop', severity: 'info', category: 'deload',
      message: 'Тапер со срезом нагрузки >30% — для пика держите интенсивность (Bosquet/Travis), режьте объём',
      fix: 'В tapere резать объём, нагрузку держать',
    });
  }
  if (d.deloadWeeks.length > 0) {
    const interval = d.totalWeeks / d.deloadWeeks.length;
    if (interval > 7) {
      out.push({
        id: 'deload_rare', severity: 'warning', category: 'deload',
        message: `Разгрузка каждые ${Math.round(interval)} нед — рекомендуется каждые 4–6 нед`,
      });
    }
  }
  return out;
}

// ─── Плечо v2 (P4): верх отдельно от ног + плоскости + face-pull ───

export interface ShoulderBalanceInput {
  pressSets: number; // грудь+трицепс+плечи (верх-жим)
  pullSets: number; // спина+бицепс (верх-тяга), БЕЗ ног
  hasVerticalPull: boolean;
  hasHorizontalPull: boolean;
  hasFacePullOrER: boolean;
}

export function shoulderBalanceCheck(s: ShoulderBalanceInput): QualityV2Issue[] {
  const out: QualityV2Issue[] = [];
  if (s.pressSets <= 0 && s.pullSets <= 0) return out;
  const ratio = s.pullSets > 0 ? s.pressSets / s.pullSets : s.pressSets > 0 ? 99 : 0;
  if (ratio > 1.8) {
    out.push({
      id: 'shoulder_press_dominant', severity: 'warning', category: 'shoulder',
      message: `Жимовая доминация верха: жимы ${s.pressSets} vs тяги ${s.pullSets} (×${ratio.toFixed(1)}) — проверьте технику жимов и добавьте тяг`,
      fix: 'Добавить горизонтальную/вертикальную тягу (rows, pull-ups)',
    });
  }
  if (!s.hasVerticalPull || !s.hasHorizontalPull) {
    const missing = [!s.hasVerticalPull ? 'вертикальной тяги' : '', !s.hasHorizontalPull ? 'горизонтальной тяги' : ''].filter(Boolean).join(' и ');
    out.push({
      id: 'shoulder_plane_gap', severity: 'warning', category: 'shoulder',
      message: `Нет ${missing} — для здоровья плеча нужны обе плоскости (лопатка: подъём + сведение)`,
      fix: `Добавить ${missing}`,
    });
  }
  if (s.pressSets >= 12 && !s.hasFacePullOrER) {
    out.push({
      id: 'shoulder_no_facepull', severity: 'info', category: 'shoulder',
      message: 'При жимах ≥12 сетов/нед нет тяги к лицу/наружной ротации — добавьте 2–3 сета для ротаторной манжеты',
      fix: 'Добавить face-pull 2–3×15–20',
    });
  }
  return out;
}

// ─── Длина/углы (P4): доля длины ≥50% для ключевых мышц ───

const LENGTH_TARGET_MUSCLES = new Set(['chest', 'hamstrings', 'triceps', 'calves', 'glutes', 'quads']);

export function lengthBiasCheck(
  lengthShare: Record<string, { lengthSets: number; totalSets: number }> | null | undefined,
): QualityV2Issue[] {
  if (!lengthShare) return [];
  const out: QualityV2Issue[] = [];
  for (const [muscle, v] of Object.entries(lengthShare)) {
    if (!LENGTH_TARGET_MUSCLES.has(muscle)) continue;
    if (v.totalSets < 6) continue;
    const share = v.totalSets > 0 ? v.lengthSets / v.totalSets : 0;
    if (share < 0.5) {
      out.push({
        id: `length_low_${muscle}`, severity: 'warning', category: 'length', muscle,
        message: `${muscle}: на длине только ${Math.round(share * 100)}% сетов (<50%) — добавьте RDL/инклайн/overhead/глубокий присед (Maeo/Kassiano: длина растит больше)`,
        fix: `Довести долю длины ${muscle} до ≥50%`,
      });
    }
  }
  return out;
}

// ─── Нагрузка из дневника (P5): ACWR + монотония, без дневника — тишина ───

export interface LoadLayerInput {
  acwr?: number | null;
  monotony?: number | null;
  hasDiary: boolean;
}

export function loadLayerCheck(l: LoadLayerInput): { issues: QualityV2Issue[]; status: 'no_data' | 'ok' | 'warn' } {
  if (!l.hasDiary) return { issues: [], status: 'no_data' };
  const issues: QualityV2Issue[] = [];
  if (l.acwr != null && (l.acwr > 1.5 || l.acwr < 0.6)) {
    issues.push({
      id: 'load_acwr_danger', severity: 'warning', category: 'load',
      message: `ACWR ${l.acwr.toFixed(2)} вне 0.6–1.5 (Gabbett) — ${l.acwr > 1.5 ? 'резкий скачок объёма, риск травмы' : 'растренированность, стимула мало'}`,
      fix: l.acwr > 1.5 ? 'Снизить объём недели на 15–20%' : 'Плавно поднять объём к MAV',
    });
  }
  if (l.monotony != null && l.monotony > 2.0) {
    issues.push({
      id: 'load_monotony_high', severity: 'info', category: 'load',
      message: `Монотония ${l.monotony.toFixed(2)} > 2.0 (Foster) — однообразная нагрузка, добавьте вариативность дней`,
    });
  }
  return { issues, status: issues.length ? 'warn' : 'ok' };
}

// ─── Специализация/MV-осознанность (P5) ───

/** Не-цель спец-блока на MEV — норма (поддержание), не «недогруз». */
export function isSpecMaintenance(
  muscle: string,
  sets: number,
  mev: number,
  specTargets?: string[],
  maintenanceMuscles?: string[],
): boolean {
  if (mvStatus(sets, mev) !== 'maintenance') return false;
  if (maintenanceMuscles?.includes(muscle)) return true;
  if (specTargets && specTargets.length > 0 && !specTargets.includes(muscle)) return true;
  return false;
}

// ─── Композитор V2 ───

export interface V2ComposerInput {
  level: string;
  weeklySets: Record<string, number>;
  frequency: Record<string, number>;
  mev: Record<string, number>;
  mav: Record<string, number>;
  mrv: Record<string, number>;
  effectiveSets?: Record<string, number>;
  sessionMaxByMuscle?: Record<string, number>;
  namesByMuscle?: Record<string, string[]>;
  rir?: RirStats | null;
  deload?: DeloadQualityInput | null;
  shoulder?: ShoulderBalanceInput | null;
  lengthShare?: Record<string, { lengthSets: number; totalSets: number }> | null;
  load?: LoadLayerInput | null;
  specTargets?: string[];
  maintenanceMuscles?: string[];
  exerciseNames?: string[][];
}

export function composeQualityScoreV2(input: V2ComposerInput): QualityScoreV2 {
  const issues: QualityV2Issue[] = [];
  const recommendations: string[] = [];
  const b: QualityV2Breakdown = {
    volume: QUALITY_WEIGHTS.volume,
    frequency: QUALITY_WEIGHTS.frequency,
    rir: QUALITY_WEIGHTS.rir,
    deload: QUALITY_WEIGHTS.deload,
    shoulder: QUALITY_WEIGHTS.shoulder,
    length: QUALITY_WEIGHTS.length,
    load: QUALITY_WEIGHTS.load,
  };
  const perMuscle: QualityScoreV2['perMuscle'] = [];
  const eff = input.effectiveSets || applyIndirectBonus(input.weeklySets, input.namesByMuscle);

  for (const [muscle, sets] of Object.entries(input.weeklySets)) {
    const mev = input.mev[muscle] ?? 0;
    const mav = input.mav[muscle] ?? 0;
    const mrv = input.mrv[muscle] ?? 0;
    const freq = input.frequency[muscle] ?? 1;
    const effective = eff[muscle] ?? sets;
    let status: QualityScoreV2['perMuscle'][number]['status'];
    if (mrv > 0 && sets > mrv) {
      status = 'exceeding_mrv';
      b.volume = Math.max(0, b.volume - 8);
      issues.push({
        id: `vol_over_${muscle}`, severity: 'critical', category: 'volume', muscle,
        message: `${muscle}: ${sets} сетов/нед > MRV (${mrv}) — риск перетренированности`,
        fix: `Снизить до ${mav} сетов/нед (MAV)`,
      });
    } else if (mav > 0 && sets > mav) {
      status = 'approaching_mrv';
      b.volume = Math.max(0, b.volume - 2);
      issues.push({
        id: `vol_high_${muscle}`, severity: 'warning', category: 'volume', muscle,
        message: `${muscle}: ${sets} сетов/нед > MAV (${mav}) — зона толерантности`,
        fix: `Оптимально ${mav} сетов/нед`,
      });
    } else if (sets >= mev || mev <= 0) {
      status = 'in_mav';
    } else if (isSpecMaintenance(muscle, sets, mev, input.specTargets, input.maintenanceMuscles)) {
      status = 'maintenance';
      issues.push({
        id: `vol_maint_${muscle}`, severity: 'info', category: 'volume', muscle,
        message: `${muscle}: ${sets} сетов — поддержание (MV-режим спец-блока), не штрафуется`,
      });
    } else if (mvStatus(sets, mev) === 'maintenance' && !input.specTargets?.length && !input.maintenanceMuscles?.length) {
      status = 'maintenance';
      issues.push({
        id: `vol_maint_${muscle}`, severity: 'info', category: 'volume', muscle,
        message: `${muscle}: ${sets} сетов — поддержание (между MV и MEV), для роста добавьте до ${mev}`,
        fix: `Добавить ${mev - sets} сетов/нед (до MEV)`,
      });
    } else {
      status = 'below_mev';
      b.volume = Math.max(0, b.volume - 6);
      issues.push({
        id: `vol_low_${muscle}`, severity: 'warning', category: 'volume', muscle,
        message: `${muscle}: ${sets} сетов/нед < MEV (${mev})`,
        fix: `Добавить ${mev - sets} сетов/нед (до MEV)`,
      });
    }

    // Частота-от-объёма
    if (mav > 0 && mrv > 0) {
      const f = frequencyForVolume(muscle, sets, mav, mrv, freq);
      if (f) {
        issues.push(f);
        if (f.severity === 'critical') b.frequency = Math.max(0, b.frequency - 10);
        else if (f.severity === 'warning') b.frequency = Math.max(0, b.frequency - 5);
      }
    }

    // Session-кап
    const sessMax = input.sessionMaxByMuscle?.[muscle];
    const capIssue = checkSessionCap(muscle, sessMax);
    if (capIssue) {
      issues.push(capIssue);
      b.volume = Math.max(0, b.volume - 2);
    }

    perMuscle.push({
      muscle, weeklySets: sets, effectiveSets: Math.round(effective * 10) / 10,
      frequency: freq, mev, mav, mrv, status,
    });
  }

  // RIR
  for (const i of rirProfileCheck(input.rir, input.level)) {
    issues.push(i);
    b.rir = Math.max(0, b.rir - (i.severity === 'critical' ? 8 : 4));
  }

  // Делод
  if (input.deload) {
    for (const i of deloadQualityCheck(input.deload)) {
      issues.push(i);
      b.deload = Math.max(0, b.deload - (i.severity === 'critical' ? 8 : i.severity === 'warning' ? 3 : 1));
    }
  }

  // Плечо
  if (input.shoulder) {
    for (const i of shoulderBalanceCheck(input.shoulder)) {
      issues.push(i);
      b.shoulder = Math.max(0, b.shoulder - (i.severity === 'warning' ? 4 : 1));
    }
  }

  // Длина + разнообразие
  for (const i of lengthBiasCheck(input.lengthShare)) {
    issues.push(i);
    b.length = Math.max(0, b.length - 2);
  }
  if (input.exerciseNames && input.exerciseNames.length > 0) {
    const flat = input.exerciseNames.flat();
    if (flat.length >= 8) {
      const div = new Set(flat).size / flat.length;
      if (div < 0.4) {
        issues.push({
          id: 'low_diversity', severity: 'info', category: 'exercise',
          message: `Низкое разнообразие упражнений (${new Set(flat).size}/${flat.length}) — рассмотрите вариации`,
        });
        b.length = Math.max(0, b.length - 1);
      }
    }
  }

  // Нагрузка (без дневника — 0 штрафа)
  if (input.load) {
    const { issues: li } = loadLayerCheck(input.load);
    for (const i of li) {
      issues.push(i);
      b.load = Math.max(0, b.load - (i.severity === 'warning' ? 4 : 1));
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(
    b.volume + b.frequency + b.rir + b.deload + b.shoulder + b.length + b.load,
  )));
  const criticals = issues.filter(i => i.severity === 'critical');
  if (criticals.length > 0) {
    recommendations.unshift(`⚠ ${criticals.length} критических проблем — исправить до начала`);
  }
  const totalSets = Object.values(input.weeklySets).reduce((a, c) => a + c, 0);
  return {
    score,
    grade: gradeQualityScore(score),
    perMuscle,
    issues,
    recommendations,
    breakdown: b,
    meta: { totalSets, muscles: perMuscle.length, hasDiary: input.load?.hasDiary ?? false },
  };
}
