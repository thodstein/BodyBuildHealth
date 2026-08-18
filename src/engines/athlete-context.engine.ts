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
    warnings.push('При дефиците, нарушениях цикла, стресс-повреждениях или признаках RED-S нужен врач/спортдиетолог.');
  }

  return { mode: c.athleteMode, sex: c.sex, volumeMultiplier: 1, warnings, notes };
}

export function athletePolicySummary(context?: Partial<AthleteContext> | null): string {
  const hints = athletePolicyHints(context);
  const label = hints.mode === 'female_context' ? '♀ Женский контекст' : 'Стандартный контекст';
  return [label, 'MRV/RIR/кaps: без скрытого изменения', ...hints.notes].join(' · ');
}
