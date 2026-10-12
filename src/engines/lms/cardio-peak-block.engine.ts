/**
 * cardio-peak-block.engine.ts — пик-блок под старт по приоритету A/B/C (P1-4).
 * Аналог PL-season: A (главный) — taper 2 нед + пик-неделя;
 * B (контрольный) — taper 1 нед, без пик-недели (объём −30%, HIIT убран);
 * C (тренировочный) — без taper, старт внутри наращивания.
 *
 * P2-аудит: спека была ЕДИНСТВЕННЫМ источником окон тапера, но её вариант B
 * расходился с реальным `applyCardioCompetitionCascade`: подсказка UI
 * (`peakBlockHint`) обещала «taper 1 нед + пик-неделя», а каскад пик-неделю
 * для B не строил. Сведено к одному источнику — спека описывает ровно то,
 * что делает каскад (он теперь берёт окна отсюда).
 */

export type CardioCompPriority = 'A' | 'B' | 'C';

export interface CardioPeakBlockSpec {
  priority: CardioCompPriority;
  /** Длина taper-окна перед стартом (0 = без taper). */
  taperWeeks: number;
  /** Строить ли пик-неделю старта (только лёгкое recovery). */
  peakWeek: boolean;
  /** Включать ли taper-кривую движка. */
  taper: boolean;
  note: string;
}

/** Спецификация пик-блока по приоритету старта. */
export function peakBlockSpecFor(priority: CardioCompPriority): CardioPeakBlockSpec {
  switch (priority) {
    case 'A':
      return { priority, taperWeeks: 2, peakWeek: true, taper: true, note: 'A (главный): taper 2 нед + пик-неделя.' };
    // Было→стало (аудит P2): было peakWeek:true и нота «+ пик-неделя», но
    // каскад пик для B не строил — подсказка врала. Теперь спека = факт.
    case 'B':
      return { priority, taperWeeks: 1, peakWeek: false, taper: true, note: 'B (контрольный): taper 1 нед (объём −30%, HIIT убран), без пик-недели.' };
    case 'C':
    default:
      return { priority: 'C', taperWeeks: 0, peakWeek: false, taper: false, note: 'C (тренировочный): без taper — старт внутри наращивания.' };
  }
}

/**
 * Применить спецификацию к параметрам сборки цикла.
 * Возвращает патч CardioCycleInput-совместимый (taper/taperWeeks/peakWeek).
 */
export function applyPeakBlockToInput<T extends { taper?: boolean; taperWeeks?: number; peakWeek?: boolean }>(
  input: T,
  priority: CardioCompPriority,
): T {
  const spec = peakBlockSpecFor(priority);
  return { ...input, taper: spec.taper, taperWeeks: Math.max(1, spec.taperWeeks), peakWeek: spec.peakWeek };
}

/** Подсказка для UI: что даст смена приоритета. */
export function peakBlockHint(priority: CardioCompPriority): string {
  return peakBlockSpecFor(priority).note;
}
