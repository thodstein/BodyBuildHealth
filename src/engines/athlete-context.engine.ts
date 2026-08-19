/**
 * Общий контекст спортсмена для BB-auto и PL-auto.
 *
 * Пол и женский режим не являются заменой уровня, стажа, PED, recovery или
 * MRV-капам. Этот модуль нормализует контекст и формирует прозрачные policy
 * hints; скрытых объёмных множителей здесь нет.
 */

export type AthleteSex = 'male' | 'female';
export type AthleteMode = 'standard' | 'female_context';
export type ReproductiveContext =
  | 'unknown'
  | 'cycle'
  | 'contraception'
  | 'pregnancy'
  | 'postpartum'
  | 'perimenopause'
  | 'menopause';

/** Опции для UI-чипов (label + hint: что даёт и на что влияет выбор). */
export interface ReproductiveContextOption {
  id: ReproductiveContext;
  label: string;
  /** Краткое пояснение: зачем выбирать и на что влияет. */
  hint: string;
}

export const REPRODUCTIVE_CONTEXT_OPTIONS: ReproductiveContextOption[] = [
  { id: 'unknown', label: 'Не указано', hint: 'Без учёта репродуктивного статуса — только общий женский контекст.' },
  { id: 'cycle', label: 'Естественный цикл', hint: 'План не перестраивается по фазам автоматически; отслеживайте сон, RPE, восстановление и симптомы (безопасно в лютеиновую фазу анализировать вес по средним за 7 дней).' },
  { id: 'contraception', label: 'Контрацепция (КОК)', hint: 'КОК сглаживают гормональные колебания: авто-периодизация по фазам не нужна; ориентир — индивидуальная реакция на тренировки.' },
  { id: 'pregnancy', label: 'Беременность', hint: 'Требует медицинского review (ACOG 2020): интенсивная подготовка, дефицит и пиковые протоколы не применяются без врача.' },
  { id: 'postpartum', label: 'Послеродовой период', hint: 'Возврат к интенсивному объёму и дефициту — только после медицинского разрешения; важно тазовое дно и постепенность.' },
  { id: 'perimenopause', label: 'Перименопауза', hint: 'Гормональные колебания и снижение эстрогена: следите за восстановлением, костным здоровьем и достатком белка/кальция.' },
  { id: 'menopause', label: 'Менопауза', hint: 'Снижение эстрогена: акцент на силовую нагрузку для костей, достаточный белок (1.4–2.2 г/кг) и восстановление.' },
];

/** Подсказка выбранной опции (для UI). */
export function reproductiveContextHint(id: ReproductiveContext): string {
  return REPRODUCTIVE_CONTEXT_OPTIONS.find(o => o.id === id)?.hint ?? '';
}

export interface AthletePedExperience {
  totalYears?: number;
  coursesCount?: number;
  monthsSinceLastCourse?: number;
  enhancedNow?: boolean;
}

export interface AthleteContext {
  sex: AthleteSex;
  athleteMode: AthleteMode;
  trainingYears?: number;
  pedExperience?: AthletePedExperience;
  reproductiveContext?: ReproductiveContext;
  competitionFederation?: string;
  competitionDivision?: string;
}

export interface AthletePolicyHints {
  mode: AthleteMode;
  sex: AthleteSex;
  volumeMultiplier: 1;
  warnings: string[];
  notes: string[];
}

const finite = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export function normalizeAthleteContext(
  input?: Partial<AthleteContext> | null,
  fallbackSex: AthleteSex = 'male',
): AthleteContext {
  const sex: AthleteSex = input?.sex === 'female' ? 'female' : input?.sex === 'male' ? 'male' : fallbackSex;
  const mode: AthleteMode = input?.athleteMode === 'female_context' && sex === 'female'
    ? 'female_context'
    : 'standard';
  const ped = input?.pedExperience;

  return {
    sex,
    athleteMode: mode,
    trainingYears: finite(input?.trainingYears),
    pedExperience: ped ? {
      totalYears: finite(ped.totalYears),
      coursesCount: finite(ped.coursesCount),
      monthsSinceLastCourse: finite(ped.monthsSinceLastCourse),
      enhancedNow: Boolean(ped.enhancedNow),
    } : undefined,
    reproductiveContext: input?.reproductiveContext || 'unknown',
    competitionFederation: typeof input?.competitionFederation === 'string' ? input.competitionFederation : undefined,
    competitionDivision: typeof input?.competitionDivision === 'string' ? input.competitionDivision : undefined,
  };
}

/**
 * Женский policy-слой намеренно не меняет MRV/RIR/веса автоматически.
 * Объём и капы остаются ответственностью существующих движков.
 */
export function athletePolicyHints(context?: Partial<AthleteContext> | null): AthletePolicyHints {
  const c = normalizeAthleteContext(context);
  const warnings: string[] = [];
  const notes: string[] = [];

  if (c.athleteMode === 'female_context') {
    notes.push('Женский контекст включён: базовая модель объёма, RIR и капы сохранена.');
    notes.push('Фазовые изменения цикла применяются только по индивидуальному фидбэку, не автоматически.');
    if (c.reproductiveContext === 'pregnancy' || c.reproductiveContext === 'postpartum') {
      warnings.push('Требуется медицинская оценка перед интенсивной подготовкой, дефицитом и пиковыми протоколами.');
    }
    if (c.reproductiveContext === 'cycle' || c.reproductiveContext === 'contraception') {
      notes.push('Отслеживайте симптомы, сон, RPE и восстановление вместо автоматической периодизации по календарю.');
    }
    if (c.reproductiveContext === 'perimenopause' || c.reproductiveContext === 'menopause') {
      notes.push('Учитывайте индивидуальное восстановление, костное здоровье и достаточность белка/энергии.');
    }
    if (c.reproductiveContext === 'menopause') {
      notes.push('Менопауза: приоритет — силовая нагрузка для костной плотности, белок 1.4–2.2 г/кг, кальций.');
    }
    if (c.reproductiveContext === 'perimenopause') {
      notes.push('Перименопауза: гормональные колебания — ориентируйтесь на восстановление, а не на календарь.');
    }
    if (c.reproductiveContext === 'cycle') {
      notes.push('Естественный цикл: возможна индивидуальная вариативность — ведите свой отклик, а не фиксированный протокол по фазам.');
    }
    if (c.reproductiveContext === 'contraception') {
      notes.push('КОК: гормональный фон стабильнее — фазовые корректировки не нужны.');
    }
    warnings.push('При дефиците, нарушениях цикла, стресс-повреждениях или признаках RED-S нужен врач/спортдиетолог.');
  }

  return { mode: c.athleteMode, sex: c.sex, volumeMultiplier: 1, warnings, notes };
}

export function athletePolicySummary(context?: Partial<AthleteContext> | null): string {
  const hints = athletePolicyHints(context);
  const label = hints.mode === 'female_context' ? '♀ Женский контекст' : 'Стандартный контекст';
  return [label, 'MRV/RIR/кaps: без скрытого изменения', ...hints.notes].join(' · ');
}

export interface RedsRiskInput {
  /** Темп снижения веса, %/нед (среднее за 7-14 дней). */
  weightTrendPctPerWeek?: number;
  bodyFatPct?: number;
  sleepHours?: number;
  cycleIrregular?: boolean;
  calorieDeficitActive?: boolean;
}

/**
 * RED-S сигналы для женского контекста. Только предупреждения и рекомендация
 * медицинской оценки — никаких автоматических изменений тренировочного плана.
 */
export function redsRiskSignals(context?: Partial<AthleteContext> | null, opts: RedsRiskInput = {}): string[] {
  const c = normalizeAthleteContext(context);
  if (c.athleteMode !== 'female_context') return [];
  const warnings: string[] = [];
  const deficit = opts.calorieDeficitActive === true;
  const rate = opts.weightTrendPctPerWeek;

  if (deficit && rate != null && rate > 0.5) {
    warnings.push(`⚠ RED-S: темп снижения ${rate.toFixed(1)}%/нед выше безопасного 0.5% — риск низкой энергетической доступности (IOC REDs).`);
  }
  if (deficit && opts.bodyFatPct != null && opts.bodyFatPct < 14) {
    warnings.push(`⚠ RED-S: % жира ${opts.bodyFatPct}% на дефиците — риск нарушений цикла и костного здоровья; нужен врач/спортдиетолог.`);
  }
  if (opts.sleepHours != null && opts.sleepHours < 6) {
    warnings.push('⚠ Восстановление: сон < 6 ч — снизьте объём/интенсивность и проверьте энергетическую доступность.');
  }
  if (opts.cycleIrregular) {
    warnings.push('⚠ Нарушения цикла (аменорея/олигоменорея) — возможный признак RED-S: мед-консультация и пересмотр дефицита.');
  }
  return warnings;
}

export interface AthleteAdvisory {
  level: 'ok' | 'review' | 'blocked';
  reasons: string[];
}

/**
 * Медицинский advisory для особых контекстов (беременность/postpartum).
 * Не меняет тренировочный план — только явная оценка для UI/экспорта.
 */
export function athleteContextAdvisory(context?: Partial<AthleteContext> | null): AthleteAdvisory {
  const c = normalizeAthleteContext(context);
  if (c.athleteMode !== 'female_context') return { level: 'ok', reasons: [] };
  if (c.reproductiveContext === 'pregnancy' || c.reproductiveContext === 'postpartum') {
    return {
      level: 'review',
      reasons: [
        c.reproductiveContext === 'pregnancy'
          ? 'Беременность: интенсивная подготовка, дефицит и пиковые протоколы требуют медицинской оценки (ACOG 2020).'
          : 'Послеродовой период: возврат к интенсивному объёму и дефициту — после медицинского разрешения.',
      ],
    };
  }
  return { level: 'ok', reasons: [] };
}
