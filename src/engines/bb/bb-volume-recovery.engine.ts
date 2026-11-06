/**
 * bb-volume-recovery.engine.ts — BB-G-01: панель «Объём · Recovery · Mobility».
 *
 * Зачем: ACWR по мышцам, ориентиры MEV/MAV/MRV и провалы мобилити считались,
 * но жили в разных местах (чипы сверху хаба + строка подсказок). PRO-5 обещал
 * шестой экран с ответом «что сейчас ограничивает рост», а пользователь видел
 * набор разрозненных чисел.
 *
 * Панель сводит три канала в один детерминированный результат:
 *  1) объём: факт за 7 дней (ПРЯМЫЕ сеты/нед) против ориентиров уровня —
 *     ориентиры в `volume-landmarks` заданы для прямого объёма, поэтому
 *     effectiveSets (с косвенной нагрузкой) в сравнение не идут;
 *  2) острая:хроническая нагрузка (per-muscle ACWR из дневника);
 *  3) восстановление: сон, боль, готовность, провалы мобилити.
 *
 * Ограничитель (limiter) выбирается по приоритету, а не «первый попавшийся»:
 * боль → сон → ACWR → превышение MRV → мобилити. Это отвечает на вопрос
 * «с чего начинать», иначе на экране пять равноправных красных чипов.
 *
 * Честность данных: отсутствие дневника/ACWR/скрининга — это «нет данных»
 * (zone='nodata'), а не измеренный ноль. Никаких выдуманных процентов.
 *
 * Публичный контракт держат тесты `bb-volume-recovery.test.ts`.
 */

import {
  computeVolumeLandmarks,
  MUSCLE_LABEL_RU,
  type VolumeLandmarkRow,
  type VolumeStatus,
} from '../volume-landmarks.engine';
import { canonicalOfZone, isGranularZone } from './bb-granular-zone.engine';
import { canonicalMuscle } from './bb-specialization.engine';
import { ruCount, RU_FAILURES } from '../ru-plural';

export type VrZone = 'green' | 'yellow' | 'red' | 'nodata';

export interface VolumeRecoveryChip {
  id: 'readiness' | 'acwr' | 'mrv' | 'mobility' | 'limiter';
  label: string;
  value: string;
  zone: VrZone;
  detail: string;
}

/** Строка объёма: ориентиры + факт + ACWR этой мышцы. */
export interface VrRow extends VolumeLandmarkRow {
  /** Сетов сверх MRV (0 = не превышен). */
  over: number;
  /** Запас до MRV (может быть отрицательным). */
  headroom: number;
  acwrRatio: number | null;
  acwrZone: string | null;
}

export interface VrLimiter {
  id: string;
  label: string;
  zone: VrZone;
  detail: string;
}

export interface VolumeRecoveryPanel {
  /** Отсортировано: превышение MRV → подход к MRV → ниже MEV → оптимум. */
  rows: VrRow[];
  chips: VolumeRecoveryChip[];
  /** Самый жёсткий ограничитель или null, если ограничителей нет. */
  limiter: VrLimiter | null;
  /** 1–3 конкретных действия (без обещаний эффекта). */
  advice: string[];
  /** Был ли недельный факт в дневнике (иначе rows пустые — это не нули). */
  hasVolume: boolean;
  /** Был ли ACWR (нужно ≥4 сессии и ≥2 недели). */
  hasAcwr: boolean;
  /** Проводился ли мобилити-скрининг. */
  hasMobility: boolean;
}

export interface VolumeRecoveryInput {
  level: string;
  /** Факт 7 дней из `aggregateBBVolume`: directSets — прямые сеты, effectiveSets — с косвенной. */
  factVolume: Record<string, { directSets?: number; effectiveSets?: number }> | null | undefined;
  /** `computePerMuscleACWR(diarySessions)`. */
  perMuscleAcwr?: Record<string, { ratio?: number; zone?: string }> | null;
  /** Слабые зоны (приоритет для добивки объёма). */
  weakZones?: string[] | null;
  readiness?: { level?: string; tested?: boolean; noData?: boolean; reasons?: string[] } | null;
  sleepHours?: number | null;
  /** Худшая боль 0–10 (во время / на след. утро). */
  pain010?: number | null;
  /** Кол-во проваленных мобилити-тестов. */
  mobilityFails?: number;
  /** Был ли вообще пройден мобилити-скрининг. */
  mobilityChecked?: boolean;
  maxRows?: number;
}

/** RU-подпись мышцы: гранулярная зона → канон → справочник. */
export function vrMuscleLabel(muscle: string): string {
  const raw = String(muscle || '');
  if (!raw) return '';
  try {
    if (isGranularZone(raw)) {
      const parent = canonicalOfZone(raw);
      return `${MUSCLE_LABEL_RU[parent] || parent}·${raw}`;
    }
  } catch { /* noop */ }
  try {
    const canon = canonicalMuscle(raw);
    return MUSCLE_LABEL_RU[canon] || MUSCLE_LABEL_RU[raw] || raw;
  } catch {
    return MUSCLE_LABEL_RU[raw] || raw;
  }
}

const STATUS_SEVERITY: Record<VolumeStatus, number> = {
  exceeding_mrv: 3,
  approaching_mrv: 2,
  below_mev: 1,
  optimal: 0,
};

const ZONE_SEVERITY: Record<string, number> = {
  dangerous: 3,
  caution: 2,
  undertrained: 1,
  optimal: 0,
};

const safeCanon = (m: string): string => {
  try { return canonicalMuscle(String(m || '')) || String(m || ''); } catch { return String(m || ''); }
};

/** Мягкое сопоставление мышц: 'chest_upper' и 'chest' — одна группа для ACWR. */
const sameMuscle = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  if (a === b) return true;
  return safeCanon(a) === safeCanon(b);
};

const acwrOf = (
  muscle: string,
  acwr: Record<string, { ratio?: number; zone?: string }> | null | undefined,
): { ratio: number | null; zone: string | null } => {
  if (!acwr) return { ratio: null, zone: null };
  for (const [k, v] of Object.entries(acwr)) {
    if (!v || !sameMuscle(k, muscle)) continue;
    const ratio = Number(v.ratio);
    return {
      ratio: Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : null,
      zone: typeof v.zone === 'string' ? v.zone : null,
    };
  }
  return { ratio: null, zone: null };
};

const zoneForLevel = (lvl: string | null | undefined): VrZone => {
  if (lvl === 'red') return 'red';
  if (lvl === 'yellow') return 'yellow';
  if (lvl === 'green') return 'green';
  return 'nodata';
};

const ZONE_RU: Record<VrZone, string> = {
  red: 'красный',
  yellow: 'жёлтый',
  green: 'зелёный',
  nodata: 'нет данных',
};

export function buildVolumeRecoveryPanel(input: VolumeRecoveryInput): VolumeRecoveryPanel {
  const fact = input.factVolume || null;
  const direct: Record<string, number> = {};
  if (fact) {
    for (const [m, v] of Object.entries(fact)) {
      const sets = Number((v as { directSets?: number } | null)?.directSets ?? 0);
      // Ориентиры volume-landmarks — для ПРЯМЫХ сетов; effectiveSets сюда не идут,
      // иначе косвенная нагрузка «съедала» бы весь MEV и панель льстила бы.
      if (Number.isFinite(sets) && sets > 0) direct[m] = sets;
    }
  }
  const hasVolume = Object.keys(direct).length > 0;

  const rows: VrRow[] = hasVolume
    ? computeVolumeLandmarks(direct, input.level)
      .map((r) => {
        const a = acwrOf(r.group, input.perMuscleAcwr);
        return {
          ...r,
          over: Math.max(0, Math.round(r.sets - r.mrv)),
          headroom: Math.round(r.mrv - r.sets),
          acwrRatio: a.ratio,
          acwrZone: a.zone,
        };
      })
      .sort((a, b) => (STATUS_SEVERITY[b.status] - STATUS_SEVERITY[a.status])
        || (b.sets / Math.max(1, b.mrv)) - (a.sets / Math.max(1, a.mrv)))
    : [];

  const maxRows = Math.max(1, Math.round(input.maxRows ?? 8));
  const shownRows = rows.slice(0, maxRows);

  const acwr = input.perMuscleAcwr || null;
  const acwrEntries = acwr ? Object.entries(acwr).filter(([, v]) => !!v) : [];
  const hasAcwr = acwrEntries.length > 0;
  const worstAcwr = hasAcwr
    ? [...acwrEntries].sort((a, b) => {
      const za = ZONE_SEVERITY[String(a[1]?.zone)] ?? 0;
      const zb = ZONE_SEVERITY[String(b[1]?.zone)] ?? 0;
      return (zb - za) || (Number(b[1]?.ratio) || 0) - (Number(a[1]?.ratio) || 0);
    })[0]
    : null;
  const acwrDanger = acwrEntries.filter(([, v]) => v?.zone === 'dangerous').length;
  const acwrCaution = acwrEntries.filter(([, v]) => v?.zone === 'caution').length;

  const overRows = rows.filter((r) => r.status === 'exceeding_mrv');
  const belowRows = rows.filter((r) => r.status === 'below_mev');
  const worstOver = overRows.length > 0
    ? [...overRows].sort((a, b) => (b.sets / Math.max(1, b.mrv)) - (a.sets / Math.max(1, a.mrv)))[0]
    : null;

  const mobilityChecked = !!input.mobilityChecked;
  const mobilityFails = Math.max(0, Math.round(Number(input.mobilityFails) || 0));

  const readiness = input.readiness || null;
  // `tested` = хотя бы один канал (сон/боль/ACWR) реально измерен. Без него
  // «жёлтая готовность» была бы выдумкой по умолчанию.
  const readinessZone = readiness && readiness.tested === true && !readiness.noData
    ? zoneForLevel(readiness.level)
    : 'nodata';
  const readinessReasons = (readiness?.reasons || []).filter(Boolean);

  const sleep = Number.isFinite(Number(input.sleepHours)) && Number(input.sleepHours) > 0
    ? Number(input.sleepHours)
    : null;
  const pain = Number.isFinite(Number(input.pain010)) && input.pain010 != null
    ? Number(input.pain010)
    : null;

  // ── Ограничитель: приоритет «с чего начать» ────────────────────────────────
  const candidates: Array<{ id: string; label: string; zone: VrZone; detail: string; sev: number }> = [];
  if (pain != null && pain >= 4) {
    candidates.push({
      id: 'pain',
      label: `Боль ${pain}/10`,
      zone: pain >= 7 ? 'red' : 'yellow',
      detail: pain >= 7 ? 'Острая боль — сначала стоп-флаги и возврат в план, не добивки' : 'Боль ≥4/10 — объём не наращиваем',
      sev: pain >= 7 ? 3 : 2,
    });
  }
  if (sleep != null && sleep < 7) {
    candidates.push({
      id: 'sleep',
      label: `Сон ${sleep} ч`,
      zone: sleep < 6 ? 'red' : 'yellow',
      detail: sleep < 6 ? 'Дефицит сна <6 ч — объём приоритетных мышц режем до восстановления' : 'Сон <7 ч — приоритеты держим на MAV, не выше',
      sev: sleep < 6 ? 3 : 2,
    });
  }
  if (worstAcwr && (worstAcwr[1]?.zone === 'dangerous' || worstAcwr[1]?.zone === 'caution')) {
    const dangerous = worstAcwr[1]?.zone === 'dangerous';
    candidates.push({
      id: 'acwr',
      label: `ACWR ${vrMuscleLabel(worstAcwr[0])} ×${worstAcwr[1]?.ratio ?? '—'}`,
      zone: dangerous ? 'red' : 'yellow',
      detail: dangerous ? 'Резкий рост объёма за неделю — 10–14 дней без отказных и добивок' : 'ACWR 1.3–1.5 — не наращивай объём этой мышцы',
      sev: dangerous ? 3 : 2,
    });
  }
  if (worstOver) {
    const ratio = worstOver.sets / Math.max(1, worstOver.mrv);
    candidates.push({
      id: 'mrv',
      label: `${worstOver.label} ${worstOver.sets}/${worstOver.mrv}`,
      zone: ratio >= 1.1 ? 'red' : 'yellow',
      detail: `Факт выше MRV на ${worstOver.over} подх. — урезать, пока не упадут маркеры восстановления`,
      sev: ratio >= 1.1 ? 3 : 2,
    });
  }
  if (mobilityChecked && mobilityFails > 0) {
    candidates.push({
      id: 'mobility',
      label: `Мобилити ${mobilityFails}`,
      zone: 'yellow',
      detail: mobilityFails >= 2 ? 'Два и более провала — упражнения зоны меняем на варианты с опорой' : 'Один провал — добавь целевой дрил перед сессией',
      sev: mobilityFails >= 2 ? 2 : 1,
    });
  }
  if (readinessZone === 'red') {
    candidates.push({
      id: 'readiness',
      label: 'Готовность красная',
      zone: 'red',
      detail: readinessReasons.slice(0, 2).join(' · ') || 'Готовность красная — неделя без отказных, объём ×0.75',
      sev: 3,
    });
  } else if (readinessZone === 'yellow') {
    candidates.push({
      id: 'readiness',
      label: 'Готовность жёлтая',
      zone: 'yellow',
      detail: readinessReasons.slice(0, 2).join(' · ') || 'Готовность жёлтая — RIR 2, без добивок',
      sev: 1,
    });
  }
  const limiter = candidates.length > 0
    ? candidates.reduce((best, c) => (c.sev > best.sev ? c : best), candidates[0])
    : null;

  // ── Действия: только то, что следует из данных ────────────────────────────
  const advice: string[] = [];
  const weak = (input.weakZones || []).map(String).filter(Boolean);
  for (const r of overRows.slice(0, 2)) {
    advice.push(`Снять ${r.over} подх. с ${r.label} (факт ${r.sets} > MRV ${r.mrv})`);
  }
  if (worstAcwr && worstAcwr[1]?.zone === 'dangerous') {
    advice.push(`${vrMuscleLabel(worstAcwr[0])}: ACWR ×${worstAcwr[1]?.ratio ?? '—'} — 10–14 дней без отказных подходов`);
  }
  for (const r of belowRows) {
    const isWeak = weak.some((z) => sameMuscle(z, r.group));
    if (!isWeak) continue;
    const need = Math.max(0, Math.round(r.mev - r.sets));
    if (need > 0) advice.push(`Добрать ${need} подх. до MEV: ${r.label} (слабая зона, факт ${r.sets})`);
  }
  if (sleep != null && sleep < 7 && advice.length < 3) {
    advice.push(`Сон ${sleep} ч — объём приоритетов ×0.8, пока не будет 7+ ч три ночи подряд`);
  }
  if (mobilityChecked && mobilityFails > 0 && advice.length < 3) {
    advice.push(`${ruCount(mobilityFails, RU_FAILURES)} мобилити — дрилл перед сессией на проблемную зону (🦴 Ортопедия)`);
  }

  // ── Чипы ──────────────────────────────────────────────────────────────────
  const chips: VolumeRecoveryChip[] = [
    {
      id: 'readiness',
      label: 'Готовность',
      value: ZONE_RU[readinessZone],
      zone: readinessZone,
      detail: readinessZone === 'nodata'
        ? 'Нет данных сна/боли/ACWR — светофор не считается'
        : (readinessReasons.slice(0, 2).join(' · ') || 'Без замечаний по сну, боли и ACWR'),
    },
    {
      id: 'acwr',
      label: 'ACWR',
      value: hasAcwr && worstAcwr
        ? `${vrMuscleLabel(worstAcwr[0])} ×${worstAcwr[1]?.ratio ?? '—'}`
        : 'нет данных',
      zone: !hasAcwr
        ? 'nodata'
        : acwrDanger > 0 ? 'red' : acwrCaution > 0 ? 'yellow' : 'green',
      detail: hasAcwr
        ? `опасно: ${acwrDanger} · осторожно: ${acwrCaution} · мышц в расчёте: ${acwrEntries.length}`
        : 'Нужно ≥4 сессии в дневнике за 2+ недели',
    },
    {
      id: 'mrv',
      label: 'MRV',
      value: !hasVolume
        ? 'нет данных'
        : worstOver
          ? `${worstOver.label} ${worstOver.sets}/${worstOver.mrv}`
          : belowRows.length > 0
            ? `ниже MEV: ${belowRows.length}`
            : 'в ориентирах',
      zone: !hasVolume
        ? 'nodata'
        : worstOver ? 'red' : belowRows.length > 0 ? 'yellow' : 'green',
      detail: !hasVolume
        ? 'Нет тренировок за 7 дней — сравнивать нечего'
        : overRows.length > 0
          ? `сверх MRV: ${overRows.map((r) => r.label).join(', ')}`
          : `все мышцы ≤ MRV · ${rows.filter((r) => r.status === 'optimal').length} в оптимальной зоне`,
    },
    {
      id: 'mobility',
      label: 'Мобилити',
      value: mobilityChecked ? ruCount(mobilityFails, RU_FAILURES) : 'не проверено',
      zone: !mobilityChecked ? 'nodata' : mobilityFails >= 2 ? 'red' : mobilityFails === 1 ? 'yellow' : 'green',
      detail: mobilityChecked
        ? (mobilityFails > 0 ? 'Провалы закрывают часть упражнений зоны — см. скрининг' : 'Скрининг пройден без провалов')
        : 'Скрининг не проводился — панель не делает выводов',
    },
    {
      id: 'limiter',
      label: 'Ограничитель',
      value: limiter ? limiter.label : 'нет',
      zone: limiter ? limiter.zone : 'green',
      detail: limiter ? limiter.detail : 'Ни один канал не ограничивает объём',
    },
  ];

  return {
    rows: shownRows,
    chips,
    limiter: limiter ? { id: limiter.id, label: limiter.label, zone: limiter.zone, detail: limiter.detail } : null,
    advice: advice.slice(0, 3),
    hasVolume,
    hasAcwr,
    hasMobility: mobilityChecked,
  };
}
