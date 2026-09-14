/**
 * combat-takedown.engine.ts — P2 борцовский блок хаба диагностики единоборств.
 * 5 точек (double/single/body-lock/clinch-entry/sprawl-defense) × фазы
 * (level-change/penetration/contact/drive) + elite-ориентиры Frontiers 2020.
 * Чистые функции, без стораджа и планировщика.
 */

export type CombatTakedownPoint =
  | 'double' | 'single' | 'body_lock' | 'clinch_entry' | 'sprawl_defense';

export type CombatTakedownPhase = 'level_change' | 'penetration' | 'contact' | 'drive';

export interface CombatTakedownPhaseInfo {
  phase: CombatTakedownPhase;
  phaseRu: string;
  cue: string;
  weakMuscles: string[];
}

export interface CombatTakedownBiomech {
  point: CombatTakedownPoint;
  label: string;
  phases: CombatTakedownPhaseInfo[];
  references: string[];
}

export const COMBAT_TAKEDOWN_POINTS: CombatTakedownPoint[] = [
  'double', 'single', 'body_lock', 'clinch_entry', 'sprawl_defense',
];

export const COMBAT_TAKEDOWN_LABELS: Record<CombatTakedownPoint, string> = {
  double: 'Дабл-лег',
  single: 'Сингл-лег',
  body_lock: 'Боди-лок',
  clinch_entry: 'Вход в клинч',
  sprawl_defense: 'Спрол-защита',
};

function ph(phase: CombatTakedownPhase, phaseRu: string, cue: string, weakMuscles: string[]): CombatTakedownPhaseInfo {
  return { phase, phaseRu, cue, weakMuscles };
}

export const COMBAT_TAKEDOWN_BIOMECH: Record<CombatTakedownPoint, CombatTakedownBiomech> = {
  double: {
    point: 'double', label: 'Дабл-лег',
    phases: [
      ph('level_change', 'Смена уровня', 'Согнуть ноги, спина прямая, голова вверх (не гильотина)', ['квадрицепсы', 'ягодицы']),
      ph('penetration', 'Проход', 'Взрыв задней ногой, корпус быстро вперёд раньше защиты', ['ягодицы', 'икроножные']),
      ph('contact', 'Контакт', 'Плечо в живот, руки за колени, голова прижата к боку', ['широчайшие', 'бицепс']),
      ph('drive', 'Дожим', 'Добежать ногами, завалить в сторону, голова вверх', ['квадрицепсы', 'кор']),
    ],
    references: ['Frontiers 2020 (элита: корпус вперёд + толчок задней раньше защиты)'],
  },
  single: {
    point: 'single', label: 'Сингл-лег',
    phases: [
      ph('level_change', 'Смена уровня', 'Изолировать ногу: уровень ниже колена соперника', ['квадрицепсы', 'ягодицы']),
      ph('penetration', 'Проход', 'Шаг в сторону захваченной ноги, голову к боку', ['ягодицы', 'кор']),
      ph('contact', 'Контакт', 'Тянуть ногу к себе, уводить центр тяжести', ['широчайшие', 'бицепс']),
      ph('drive', 'Дожим', 'Подсечка/забегание, не отпускать захват', ['квадрицепсы', 'икроножные']),
    ],
    references: ['Evolve/Human Kinetics (изоляция ноги + увод центра тяжести)'],
  },
  body_lock: {
    point: 'body_lock', label: 'Боди-лок',
    phases: [
      ph('level_change', 'Вход', 'Pummeling до double-underhooks, голова на груди', ['дельты', 'широчайшие']),
      ph('penetration', 'Замок', 'Сцепить кисти на пояснице, бедро в бедро', ['предплечья', 'кор']),
      ph('contact', 'Контакт', 'Тяга поясницы на себя + давление головой', ['ягодицы', 'широчайшие']),
      ph('drive', 'Дожим', 'Бросок/подсечка, безопаснее прохода в ноги (меньше гильотин)', ['квадрицепсы', 'кор']),
    ],
    references: ['Evolve (боди-лок безопаснее прохода: меньше гильотин/коленей)'],
  },
  clinch_entry: {
    point: 'clinch_entry', label: 'Вход в клинч',
    phases: [
      ph('level_change', 'Сближение', 'Руки в рамке, подбородок опущен', ['дельты', 'шея']),
      ph('penetration', 'Вход', 'Шаг с ударом-прикрытием (джеб/лоукик), голова в сторону', ['квадрицепсы', 'кор']),
      ph('contact', 'Клинч', 'Внутренний контроль (шея/локоть), бедро в бедро', ['широчайшие', 'шея']),
      ph('drive', 'Работа', 'Колени/локти короткие, борьба за underhook', ['сгибатели бедра', 'кор']),
    ],
    references: ['Техника клинча: прикрытие + внутренний контроль'],
  },
  sprawl_defense: {
    point: 'sprawl_defense', label: 'Спрол-защита',
    phases: [
      ph('level_change', 'Реакция', 'Руки вниз на плечи/голову, бёдра назад', ['трицепс', 'широчайшие']),
      ph('penetration', 'Спрол', 'Ноги выстрелом назад, грудь на спину соперника', ['квадрицепсы', 'ягодицы']),
      ph('contact', 'Контроль', 'Вес на соперника, голова в сторону от гильотины', ['кор', 'шея']),
      ph('drive', 'Разворот', 'Забегание за спину / фронт-хедлок', ['косые', 'широчайшие']),
    ],
    references: ['База защиты: спрол раньше контакта'],
  },
};

export interface CombatTakedownMeasurement {
  /** Время входа в секундах (от смены уровня до контакта). */
  entryTimeS?: number | null;
  /** Покрытие дистанции в метрах за вход. */
  coverM?: number | null;
  /** Высота корпуса в % роста на входе (акромион). Ориентир ~50–55%. */
  bodyHeightPct?: number | null;
  /** Успешные входы из попыток (0–1). */
  successRate?: number | null;
}

export type CombatTakedownLevel = 'ok' | 'warn' | 'critical' | 'no_data';

export interface CombatTakedownDiagnosis {
  point: CombatTakedownPoint;
  label: string;
  level: CombatTakedownLevel;
  findings: string[];
  corrections: string[];
  guillotineNote: boolean;
}

export function diagnoseCombatTakedown(
  point: CombatTakedownPoint, m: CombatTakedownMeasurement,
): CombatTakedownDiagnosis {
  const label = COMBAT_TAKEDOWN_LABELS[point];
  const findings: string[] = [];
  const corrections: string[] = [];
  const hasAny = m.entryTimeS != null || m.coverM != null || m.bodyHeightPct != null || m.successRate != null;
  if (!hasAny) {
    return { point, label, level: 'no_data', findings: ['Нет замеров — введите время входа или успешность'], corrections: ['Замерьте секундомером время входа или считайте успешные/всего'], guillotineNote: point === 'double' || point === 'single' };
  }
  let penalties = 0;
  if (m.entryTimeS != null && Number.isFinite(m.entryTimeS)) {
    if (m.entryTimeS > 1.2) {
      penalties += 2;
      findings.push(`Вход ${m.entryTimeS.toFixed(2)} с — медленно (ориентир ≤0.8 с)`);
      corrections.push('Взрыв задней ногой + вынос корпуса: медбол-броски и спринты 10 м');
    } else if (m.entryTimeS > 0.8) {
      penalties += 1;
      findings.push(`Вход ${m.entryTimeS.toFixed(2)} с — чуть медленно (ориентир ≤0.8 с)`);
      corrections.push('Проходы на скорость 5×3 без сопротивления, отдых полный');
    } else {
      findings.push(`Вход ${m.entryTimeS.toFixed(2)} с — в ориентире`);
    }
  }
  if (m.bodyHeightPct != null && Number.isFinite(m.bodyHeightPct)) {
    if (m.bodyHeightPct > 62) {
      penalties += 1;
      findings.push(`Корпус ${m.bodyHeightPct.toFixed(0)}% роста — высоко (ориентир 50–55%)`);
      corrections.push('Ниже уровень: приседы в стойке + проходы с палкой на спине');
    } else {
      findings.push(`Высота корпуса ${m.bodyHeightPct.toFixed(0)}% — в ориентире`);
    }
  }
  if (m.successRate != null && Number.isFinite(m.successRate)) {
    if (m.successRate < 0.3) {
      penalties += 2;
      findings.push(`Успешность ${Math.round(m.successRate * 100)}% — низкая (<30%)`);
      corrections.push('Сетапы перед проходом: джеб/смена стойки; разбирайте связку проход↔защита');
    } else if (m.successRate < 0.5) {
      penalties += 1;
      findings.push(`Успешность ${Math.round(m.successRate * 100)}% — средняя (30–50%)`);
      corrections.push('Один проход + один сетап доводить до автоматизма');
    } else {
      findings.push(`Успешность ${Math.round(m.successRate * 100)}% — в порядке`);
    }
  }
  const guillotineNote = point === 'double' || point === 'single';
  if (guillotineNote) findings.push('Напоминание: голова прижата к боку — иначе гильотина');
  const level: CombatTakedownLevel = penalties >= 3 ? 'critical' : penalties >= 1 ? 'warn' : 'ok';
  return { point, label, level, findings, corrections, guillotineNote };
}

/** Готовность проходов: спрол-защита должна быть не хуже warn, иначе проходы рано. */
export function takedownReadiness(
  measures: Partial<Record<CombatTakedownPoint, CombatTakedownMeasurement>>,
): { ready: boolean; text: string } {
  const sprawl = diagnoseCombatTakedown('sprawl_defense', measures.sprawl_defense ?? {});
  if (sprawl.level === 'critical' || sprawl.level === 'no_data') {
    return { ready: false, text: 'Сначала спрол-защита: проходы при дырявой защите — пропуски и гильотины' };
  }
  return { ready: true, text: 'Спрол в порядке — проходы можно нагружать' };
}
