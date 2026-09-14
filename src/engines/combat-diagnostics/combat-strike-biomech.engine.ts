/**
 * combat-strike-biomech.engine.ts — P1 ударный блок хаба диагностики единоборств.
 *
 * 8 точек (jab/cross/lead-hook/rear-hook/uppercut/lowkick/elbow/knee) × фазы
 * (старт/разгон/контакт/возврат) + диагностика по замерам.
 * Синтез: Kacprzak/MDPI 2025 (effective mass прямые ~30–31 кг, хуки ~12–14 кг;
 * импульс jab ~64 / cross ~58 Нс), Dinu/Louis 2020 (элита > юниоров, перекос
 * юниоров на плечо), Walilko/Bir 2005, Mack/Wayne State (сила ~ скорости кисти
 * R² 0.38, не ног R² 0.10), JSCR punch-force.
 * GRF-дисбаланс кросса 60/40 — норма, не дефект (Dinu).
 * Чистые функции, без стораджа и планировщика.
 */

export type CombatStrikePoint =
  | 'jab' | 'cross' | 'lead_hook' | 'rear_hook'
  | 'uppercut' | 'lowkick' | 'elbow' | 'knee';

export type CombatStrikePhase = 'start' | 'drive' | 'contact' | 'return';

export interface CombatStrikePhaseInfo {
  phase: CombatStrikePhase;
  phaseRu: string;
  angleRangeDeg: [number, number];
  keyJoint: string;
  weakMuscles: string[];
  intensityPct: number;
  cue: string;
}

export interface CombatStrikeBiomech {
  point: CombatStrikePoint;
  label: string;
  trajectory: 'прямая' | 'дуга' | 'петля';
  phases: CombatStrikePhaseInfo[];
  references: string[];
}

export const COMBAT_STRIKE_POINTS: CombatStrikePoint[] = [
  'jab', 'cross', 'lead_hook', 'rear_hook', 'uppercut', 'lowkick', 'elbow', 'knee',
];

export const COMBAT_STRIKE_LABELS: Record<CombatStrikePoint, string> = {
  jab: 'Джеб',
  cross: 'Кросс',
  lead_hook: 'Хук передней',
  rear_hook: 'Хук задней',
  uppercut: 'Апперкот',
  lowkick: 'Лоукик',
  elbow: 'Локоть',
  knee: 'Колено',
};

function ph(
  phase: CombatStrikePhase, phaseRu: string, angleRangeDeg: [number, number],
  keyJoint: string, weakMuscles: string[], intensityPct: number, cue: string,
): CombatStrikePhaseInfo {
  return { phase, phaseRu, angleRangeDeg, keyJoint, weakMuscles, intensityPct, cue };
}

export const COMBAT_STRIKE_BIOMECH: Record<CombatStrikePoint, CombatStrikeBiomech> = {
  jab: {
    point: 'jab', label: 'Джеб', trajectory: 'прямая',
    phases: [
      ph('start', 'Старт', [150, 170], 'локоть', ['дельты', 'трицепс'], 40, 'Подбородок за плечом, локоть не отрывать'),
      ph('drive', 'Разгон', [170, 180], 'плечо', ['дельты', 'кор'], 70, 'Толчок передней ногой, плечо доворачивает'),
      ph('contact', 'Контакт', [175, 180], 'запястье', ['предплечья', 'кулак'], 85, 'Кулак жёсткий в последний момент, не толкать'),
      ph('return', 'Возврат', [150, 170], 'локоть', ['дельты', 'широчайшие'], 50, 'Возврат по той же линии, рука не падает'),
    ],
    references: ['Kacprzak/MDPI 2025 (impulse jab ~64 Нс)', 'Dinu/Louis 2020'],
  },
  cross: {
    point: 'cross', label: 'Кросс', trajectory: 'прямая',
    phases: [
      ph('start', 'Старт', [90, 120], 'бедро', ['квадрицепсы', 'ягодицы'], 45, 'Задняя нога заряжена, корпус закрыт'),
      ph('drive', 'Разгон', [120, 170], 'бедро', ['ягодицы', 'кор', 'широчайшие'], 80, 'Цепь: нога→бедро→торс→кисть, GRF 60/40 — норма'),
      ph('contact', 'Контакт', [175, 180], 'запястье', ['предплечья', 'кулак'], 90, 'Доворот стопы и бедра, плечо закрывает подбородок'),
      ph('return', 'Возврат', [90, 120], 'локоть', ['дельты', 'широчайшие'], 50, 'Возврат в гард без провала корпуса'),
    ],
    references: ['Kacprzak/MDPI 2025 (effective mass ~31 кг)', 'Dinu/Louis 2020 (GRF-дисбаланс — норма)'],
  },
  lead_hook: {
    point: 'lead_hook', label: 'Хук передней', trajectory: 'дуга',
    phases: [
      ph('start', 'Старт', [90, 110], 'плечо', ['дельты', 'кор'], 45, 'Локоть на высоте кулака, не заводить за спину'),
      ph('drive', 'Разгон', [90, 120], 'бедро', ['косые', 'ягодицы'], 80, 'Вращение на передней ноге, локоть 90°'),
      ph('contact', 'Контакт', [85, 100], 'запястье', ['предплечья'], 90, 'Кулак горизонтально, запястье жёсткое'),
      ph('return', 'Возврат', [90, 110], 'локоть', ['дельты'], 50, 'Возврат дугой обратно в гард'),
    ],
    references: ['Kacprzak/MDPI 2025 (effective mass ~14 кг)', 'Walilko/Bir 2005'],
  },
  rear_hook: {
    point: 'rear_hook', label: 'Хук задней', trajectory: 'дуга',
    phases: [
      ph('start', 'Старт', [80, 100], 'бедро', ['ягодицы', 'кор'], 50, 'Корпус слегка закручен, вес на задней ноге'),
      ph('drive', 'Разгон', [90, 120], 'бедро', ['косые', 'широчайшие'], 85, 'Мощный разворот, пик скорости кисти — здесь'),
      ph('contact', 'Контакт', [85, 100], 'запястье', ['предплечья'], 95, 'Не проносить мимо цели, стопорить корпусом'),
      ph('return', 'Возврат', [80, 100], 'локоть', ['дельты', 'широчайшие'], 50, 'Возврат без опускания рук'),
    ],
    references: ['Kacprzak/MDPI 2025 (rear hook accel ~213 м/с², масса ~12.5 кг)'],
  },
  uppercut: {
    point: 'uppercut', label: 'Апперкот', trajectory: 'петля',
    phases: [
      ph('start', 'Старт', [70, 90], 'колено', ['квадрицепсы', 'ягодицы'], 45, 'Подсесть ногами, спина прямая'),
      ph('drive', 'Разгон', [90, 130], 'плечо', ['дельты', 'бицепс'], 80, 'Вверх по дуге, локоть близко к корпусу'),
      ph('contact', 'Контакт', [100, 130], 'запястье', ['предплечья'], 85, 'Ладонь к себе, не выпрямлять локоть полностью'),
      ph('return', 'Возврат', [70, 90], 'локоть', ['дельты'], 50, 'Опустить по той же дуге в гард'),
    ],
    references: ['Dinu/Louis 2020 (uppercut elite ~10.2 м/с)'],
  },
  lowkick: {
    point: 'lowkick', label: 'Лоукик', trajectory: 'дуга',
    phases: [
      ph('start', 'Старт', [150, 170], 'бедро', ['сгибатели бедра', 'кор'], 40, 'Шаг опорной наружу, руки в гарде'),
      ph('drive', 'Разгон', [120, 160], 'бедро', ['ягодицы', 'квадрицепсы'], 85, 'Голень — как битой, через цель'),
      ph('contact', 'Контакт', [160, 180], 'голень', ['голень', 'стопа'], 90, 'Бить голенью, не стопой; опорная на носке'),
      ph('return', 'Возврат', [150, 170], 'бедро', ['сгибатели бедра'], 50, 'Возврат в стойку, не скрещивать ноги'),
    ],
    references: ['Полевая норма зала: скорость голени > скорости кисти'],
  },
  elbow: {
    point: 'elbow', label: 'Локоть', trajectory: 'дуга',
    phases: [
      ph('start', 'Старт', [60, 90], 'плечо', ['дельты', 'кор'], 45, 'Дистанция клинча, локоть согнут'),
      ph('drive', 'Разгон', [60, 100], 'корпус', ['косые', 'широчайшие'], 80, 'Короткий разворот корпусом, не замах рукой'),
      ph('contact', 'Контакт', [70, 100], 'локоть', ['трицепс'], 90, 'Жёсткий клин, возврат сразу'),
      ph('return', 'Возврат', [60, 90], 'плечо', ['дельты'], 55, 'Локоть возвращается в рамку'),
    ],
    references: ['Клинч-техника: короткий рычаг, без замаха'],
  },
  knee: {
    point: 'knee', label: 'Колено', trajectory: 'прямая',
    phases: [
      ph('start', 'Старт', [90, 120], 'бедро', ['сгибатели бедра', 'кор'], 45, 'Тянуть за шею вниз, корпус вертикально'),
      ph('drive', 'Разгон', [100, 140], 'бедро', ['ягодицы', 'квадрицепсы'], 85, 'Таз вперёд, носок оттянут'),
      ph('contact', 'Контакт', [120, 150], 'колено', ['квадрицепсы'], 90, 'Встреча корпусом, не наклоняться'),
      ph('return', 'Возврат', [90, 120], 'бедро', ['сгибатели бедра'], 55, 'Нога ставится в стойку, не падает'),
    ],
    references: ['Клинч-техника: таз и тяга, не наклон'],
  },
};

export interface CombatStrikeMeasurement {
  /** Скорость кисти/голени в м/с (ручной ввод или трекер). */
  handSpeedMs?: number | null;
  /** Импульс в Нс (опционально, с динамометра/плиты). */
  impulseNs?: number | null;
  /** Пиковая сила в Н (опционально). */
  forceN?: number | null;
}

export type CombatStrikeLevel = 'ok' | 'warn' | 'critical' | 'no_data';

export interface CombatStrikeDiagnosis {
  point: CombatStrikePoint;
  label: string;
  level: CombatStrikeLevel;
  /** Эффективная масса = импульс / скорость (кг), если оба замера есть. */
  effectiveMassKg: number | null;
  findings: string[];
  corrections: string[];
}

/** Ориентиры скорости (м/с) по точкам — из Dinu/Kacprzak, честные ориентиры, не разряды. */
const SPEED_FLOOR: Record<CombatStrikePoint, number> = {
  jab: 6, cross: 7, lead_hook: 8, rear_hook: 8, uppercut: 7.5, lowkick: 9, elbow: 5, knee: 6,
};

/** Ориентиры эффективной массы (кг) = импульс/скорость кисти.
 * Прямые требуют большей массы (Kacprzak: cross > hook); абсолютные числа
 * привязаны к скорости кисти (~8 м/с), не к массе тела. Честные ориентиры. */
const MASS_BAND: Record<CombatStrikePoint, [number, number]> = {
  jab: [4, 12], cross: [4, 12],
  lead_hook: [2.5, 8], rear_hook: [2.5, 8],
  uppercut: [3, 9], lowkick: [4, 12], elbow: [2.5, 8], knee: [3, 10],
};

export function effectiveMassKg(m: CombatStrikeMeasurement): number | null {
  if (m.impulseNs == null || m.handSpeedMs == null) return null;
  if (!Number.isFinite(m.impulseNs) || !Number.isFinite(m.handSpeedMs) || m.handSpeedMs <= 0) return null;
  return m.impulseNs / m.handSpeedMs;
}

export function diagnoseCombatStrikePoint(
  point: CombatStrikePoint, m: CombatStrikeMeasurement,
): CombatStrikeDiagnosis {
  const label = COMBAT_STRIKE_LABELS[point];
  const findings: string[] = [];
  const corrections: string[] = [];
  const eff = effectiveMassKg(m);
  const hasSpeed = m.handSpeedMs != null && Number.isFinite(m.handSpeedMs);
  if (!hasSpeed && eff == null && (m.forceN == null || !Number.isFinite(m.forceN))) {
    return { point, label, level: 'no_data', effectiveMassKg: null, findings: ['Нет замеров — введите скорость кисти'], corrections: ['Замерьте скорость (трекер/видео 240fps) или введите вручную'] };
  }
  let penalties = 0;
  if (hasSpeed) {
    const v = m.handSpeedMs as number;
    const floor = SPEED_FLOOR[point];
    if (v < floor * 0.8) {
      penalties += 2;
      findings.push(`Скорость ${v.toFixed(1)} м/с — ниже ориентира ${floor} м/с`);
      corrections.push(point === 'jab' || point === 'cross'
        ? 'Цепь снизу: толчок ногой + доворот бедра, не толкать плечом'
        : 'Разворот корпуса и ног, рука расслаблена до контакта');
    } else if (v < floor) {
      penalties += 1;
      findings.push(`Скорость ${v.toFixed(1)} м/с — чуть ниже ориентира ${floor} м/с`);
      corrections.push('Бой с тенью 3×3 мин на скорость + возврат в гард');
    } else {
      findings.push(`Скорость ${v.toFixed(1)} м/с — в ориентире (≥${floor})`);
    }
  }
  if (eff != null) {
    const [lo, hi] = MASS_BAND[point];
    if (eff < lo * 0.7) {
      penalties += 2;
      findings.push(`Эффективная масса ${eff.toFixed(1)} кг — цепь не включена (ориентир ${lo}–${hi})`);
      corrections.push('Включать массу: жёсткая опора + доворот + жёсткий кулак в контакт');
    } else if (eff < lo) {
      penalties += 1;
      findings.push(`Эффективная масса ${eff.toFixed(1)} кг — ниже ориентира ${lo}–${hi}`);
      corrections.push('Медбол-ротация и кувалда 2×/нед — перенос массы в удар');
    } else if (eff > hi * 1.6) {
      penalties += 1;
      findings.push(`Эффективная масса ${eff.toFixed(1)} кг — выше ориентира: проверьте замер скорости`);
      corrections.push('Перезамерьте скорость (ошибка входа даёт завышение массы)');
    } else {
      findings.push(`Эффективная масса ${eff.toFixed(1)} кг — в ориентире ${lo}–${hi}`);
    }
  }
  if (point === 'cross' && penalties === 0) findings.push('GRF-дисбаланс перед/зад ~60/40 — норма, не дефект');
  const level: CombatStrikeLevel = penalties >= 3 ? 'critical' : penalties >= 1 ? 'warn' : 'ok';
  return { point, label, level, effectiveMassKg: eff, findings, corrections };
}

export function weakestCombatStrikePoint(
  measures: Partial<Record<CombatStrikePoint, CombatStrikeMeasurement>>,
): CombatStrikePoint | null {
  let worst: CombatStrikePoint | null = null;
  let worstScore = -1;
  for (const p of COMBAT_STRIKE_POINTS) {
    const d = diagnoseCombatStrikePoint(p, measures[p] ?? {});
    const score = d.level === 'critical' ? 2 : d.level === 'warn' ? 1 : d.level === 'ok' ? 0 : -1;
    if (score > worstScore) { worstScore = score; worst = score >= 0 ? p : worst; }
  }
  return worstScore >= 1 ? worst : null;
}
