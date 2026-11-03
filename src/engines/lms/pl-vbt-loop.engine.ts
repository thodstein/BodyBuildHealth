/**
 * pl-vbt-loop.engine.ts — VBT замкнутый контур для PL (Фаза 6, п.7).
 *
 * ЧТО БЫЛО: VBT в плеере только кричал «потеря скорости 24 % — заканчивайте сет»,
 * но следующий подход всё равно шёл по плану. То есть скорость измерялась, а
 * решение оставалось за человеком, который в зале не считает.
 *
 * ЧТО ЗДЕСЬ: скорость сделанных подходов → рекомендация для СЛЕДУЮЩЕГО подхода
 * (вес и «держать/легче/тяжелее»). Рекомендация никогда не применяется молча —
 * пользователь видит её и нажимает «Применить».
 *
 * ЖЁСТКИЕ ПРАВИЛА (их и держат тесты):
 *  • без записанной скорости И веса пересчёт невозможен — возвращаем no-data,
 *    а не «средние по больнице»;
 *  • одного подхода мало для тренда → hold и честная пометка low confidence;
 *  • вслед за падением скорости вес НИКОГДА не растёт;
 *  • за одно решение вес меняется не больше чем на один шаг диска (2.5 кг,
 *    для лёгких весов < 40 кг — 1 кг);
 *  • «быстрее зоны» ≠ «можно больше»: если скорость между подходами уже падает
 *    (> 3 %), увеличения не будет.
 *
 * ЧЕСТНОСТЬ ЧИСЕЛ: зоны и пороги — справочные ориентиры приложения
 * (Gonzalez-Badillo / Pareja-Blanco), а не персональный замер. Персональный
 * профиль — калибровка LVP (vbt.engine.calibrateLVP), здесь он не подменяется.
 */
import {
  INTENT_ZONES,
  thresholdForIntent,
  velocityLossZone,
  type VBTIntent,
  type VelocityLossThreshold,
} from '../pro/vbt.engine';

export interface VBTSetSample {
  /** Вес подхода, кг (факт, если записан; иначе план). */
  weight: number;
  /** Повторы, если известны — для подписи. */
  reps?: number;
  /** Средняя скорость подхода, м/с (MCV/MPV). */
  velocity: number;
}

export type VBTAdviceAction = 'no-data' | 'hold' | 'decrease' | 'increase';

export interface VBTNextSetAdvice {
  action: VBTAdviceAction;
  /** Рекомендуемый вес следующего подхода; null — данных недостаточно. */
  nextWeight: number | null;
  /** Изменение к плану следующего подхода, кг (0 — без изменений). */
  deltaKg: number;
  /** Падение скорости от первого записанного подхода к последнему, %. */
  dropPct: number;
  /** Порог потери скорости под текущий интент, %. */
  thresholdPct: VelocityLossThreshold;
  /** Справочная зона скорости интента, м/с. */
  zone: { min: number; max: number; ideal: number };
  /** Что произошло — одной строкой, готово для UI. */
  reason: string;
  /** Насколько данным можно верить (сколько подходов со скоростью). */
  confidence: 'none' | 'low' | 'ok';
  /** Сколько подходов использовано. */
  usedSets: number;
  /** Что пересчёт НЕ делает — для UI. */
  notes: string[];
}

const roundToPlate = (kg: number): number => Math.round(kg / 2.5) * 2.5;
const roundTo = (kg: number, step: number): number => Math.round(kg / step) * step;

/** Шаг веса как в остальном плеере: тяжёлые снаряды — 2.5 кг, лёгкие — 1 кг. */
export function vbtWeightStep(plannedWeight: number): number {
  return plannedWeight >= 40 ? 2.5 : 1;
}

const NOTES: string[] = [
  'Считаем по средней скорости штанги (MCV/MPV). Пиковая скорость завышена — пересчёт пик→средняя делается отдельно, в карточке скорости.',
  'Зоны и порог потери скорости — справочные ориентиры приложения (Gonzalez-Badillo / Pareja-Blanco), а не ваш персональный замер. Персональный профиль — калибровка LVP.',
  'Скорость без веса подхода не используется: без веса пересчёт веса был бы угадыванием.',
];

/**
 * Рекомендация для следующего подхода по скорости уже сделанных.
 *
 * @param samples            сделанные подходы со скоростью (порядок — как в зале)
 * @param plannedNextWeight  вес следующего подхода по плану
 * @param intent             цель тренировки (сила/гипертрофия/мощность/скорость)
 */
export function adviseVBTNextSet(input: {
  samples: VBTSetSample[];
  plannedNextWeight: number;
  intent: VBTIntent;
  /** Переопределить порог (по умолчанию — под интент). */
  threshold?: VelocityLossThreshold;
}): VBTNextSetAdvice {
  const planned = Number.isFinite(input.plannedNextWeight) ? Math.max(0, input.plannedNextWeight) : 0;
  const zoneDef = INTENT_ZONES[input.intent] ?? INTENT_ZONES.strength;
  const zone = { min: zoneDef.velocity[0], max: zoneDef.velocity[1], ideal: zoneDef.idealVelocity };
  const thresholdPct = input.threshold ?? thresholdForIntent(input.intent);

  const valid = (input.samples ?? []).filter(
    s => s && Number.isFinite(s.velocity) && s.velocity > 0 && Number.isFinite(s.weight) && s.weight > 0,
  );

  const base = {
    deltaKg: 0,
    thresholdPct,
    zone,
    usedSets: valid.length,
    notes: NOTES,
  };

  if (valid.length === 0) {
    return {
      ...base,
      action: 'no-data',
      nextWeight: null,
      dropPct: 0,
      confidence: 'none',
      reason: 'Скорость не записана — пересчёт веса невозможен (нужны скорость и вес хотя бы двух подходов).',
    };
  }

  const step = vbtWeightStep(planned || valid[valid.length - 1].weight);
  const bestVelocity = Math.max(...valid.map(s => s.velocity));
  const lastVelocity = valid[valid.length - 1].velocity;
  const dropPct = bestVelocity > 0
    ? Math.round(((bestVelocity - lastVelocity) / bestVelocity) * 1000) / 10
    : 0;

  if (valid.length === 1) {
    return {
      ...base,
      action: 'hold',
      nextWeight: planned,
      dropPct,
      confidence: 'low',
      reason: `Пока один подход со скоростью (${lastVelocity} м/с) — тренда нет, держим план ${planned} кг. Нужен второй подход.`,
    };
  }

  const confidence: 'low' | 'ok' = valid.length >= 3 ? 'ok' : 'low';
  const decreaseStep = Math.max(step, roundToPlate(planned * 0.05));
  const down = (reason: string, kg: number): VBTNextSetAdvice => ({
    ...base,
    action: 'decrease',
    nextWeight: Math.max(0, roundTo(planned - kg, step)),
    deltaKg: -kg,
    dropPct,
    confidence,
    reason,
  });
  const up = (reason: string): VBTNextSetAdvice => ({
    ...base,
    action: 'increase',
    nextWeight: roundTo(planned + step, step),
    deltaKg: step,
    dropPct,
    confidence,
    reason,
  });
  const hold = (reason: string): VBTNextSetAdvice => ({
    ...base,
    action: 'hold',
    nextWeight: planned,
    deltaKg: 0,
    dropPct,
    confidence,
    reason,
  });

  // 1) Порог потери скорости пробит — только вниз.
  if (dropPct >= thresholdPct) {
    return down(
      `Скорость упала на ${dropPct}% — порог ${thresholdPct}% пробит (${velocityLossZone(dropPct)}). Следующий подход легче на ${decreaseStep} кг, повторы не добиваем.`,
      decreaseStep,
    );
  }
  // 2) Усталость ещё до порога, но тренд уже вниз — увеличивать нечего.
  if (dropPct > 8) {
    return down(
      `Скорость падает на ${dropPct}% между подходами — это усталость, а не «легко». Следующий подход легче на ${decreaseStep} кг.`,
      decreaseStep,
    );
  }
  // 3) Заметно быстрее зоны при стабильной скорости — можно шаг вверх.
  if (lastVelocity > zone.max && dropPct <= 3) {
    return up(
      `Скорость ${lastVelocity} м/с выше зоны ${zone.min}–${zone.max} м/с при стабильном тренде (−${dropPct}%) — можно ${step} кг сверху, но только один шаг.`,
    );
  }
  // 4) Медленнее зоны — снаряд тяжёлый для цели.
  if (lastVelocity < zone.min) {
    return down(
      `Скорость ${lastVelocity} м/с ниже зоны ${zone.min}–${zone.max} м/с — снаряд тяжёл для цели «${input.intent}». Следующий подход легче на ${decreaseStep} кг.`,
      decreaseStep,
    );
  }

  return hold(
    `Скорость ${lastVelocity} м/с в зоне ${zone.min}–${zone.max} м/с, тренд −${dropPct}% — держим ${planned} кг.`,
  );
}
