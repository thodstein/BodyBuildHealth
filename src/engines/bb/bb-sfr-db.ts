/**
 * bb-sfr-db.ts — SFR (Stimulus-to-Fatigue Ratio) + профиль сопротивления упражнений (Epic C).
 *
 * Независимая БД над реальными id из EXERCISE_CATALOG (общий каталог НЕ трогается).
 * Для топ-60 упражнений реальных ББ-планов: SFR 1-5 (отношение стимула к усталости;
 * машины/кабели/изоляция обычно выше SFR, свободные compound — ниже из-за системной
 * усталости) и resistanceProfile (lengthened/mid/short — позиция максимального натяжения,
 * Maeo 2023: lengthened даёт больше гипертрофии).
 *
 * ПРАВИЛО ПЛАНА: SFR/lengthened НЕ меняют объёмную модель (effectiveSets) — иначе
 * сдвинулись бы MRV-overflow инварианты. Здесь данные используются для:
 *   - приоритета выбора упражнений (мягкий бонус к _score);
 *   - отчёта качества (покрытие lengthened, unilateral-баланс);
 *   - UI-подсказок «чем хорошо и почему».
 *
 * Капы не меняются.
 */

export type ResistanceProfile = 'lengthened' | 'mid' | 'short';

export interface SFRRecord {
  /** SFR 1-5: 5 = максимум стимула на минимум усталости. */
  sfr: number;
  /** Позиция максимального натяжения/растяжения. */
  resistanceProfile: ResistanceProfile;
  /** Одностороннее движение (унилатеральный баланс). */
  unilateral?: boolean;
}

/** Идентификаторы топ-60 упражнений (ключи EXERCISE_CATALOG). */
export const SFR_EXERCISE_DB: Record<string, SFRRecord> = {
  // ── Грудь ──────────────────────────────────────────────────────────────
  fly_cable:            { sfr: 5, resistanceProfile: 'lengthened' },
  fly_db:               { sfr: 4, resistanceProfile: 'lengthened' },
  fly_incline_db:       { sfr: 4, resistanceProfile: 'lengthened' },
  crossover_cable:      { sfr: 4, resistanceProfile: 'short' },
  pec_deck:             { sfr: 5, resistanceProfile: 'mid' },
  butterfly:            { sfr: 4, resistanceProfile: 'mid' },
  machine_chest_press:  { sfr: 4, resistanceProfile: 'mid' },
  machine_incline_press:{ sfr: 4, resistanceProfile: 'lengthened' },
  incline_bar:          { sfr: 4, resistanceProfile: 'lengthened' },
  incline_db:           { sfr: 4, resistanceProfile: 'lengthened' },
  smith_incline:        { sfr: 4, resistanceProfile: 'lengthened' },
  bench_bar:            { sfr: 3, resistanceProfile: 'mid' },
  bench_db:             { sfr: 3, resistanceProfile: 'mid' },
  // ── Спина ──────────────────────────────────────────────────────────────
  pulldown:             { sfr: 4, resistanceProfile: 'lengthened' },
  pulldown_wide:        { sfr: 4, resistanceProfile: 'lengthened' },
  pulldown_vbar:        { sfr: 4, resistanceProfile: 'lengthened' },
  pullup:               { sfr: 4, resistanceProfile: 'lengthened' },
  chinup:               { sfr: 4, resistanceProfile: 'lengthened' },
  pullup_wide:          { sfr: 4, resistanceProfile: 'lengthened' },
  row_bar:              { sfr: 3, resistanceProfile: 'mid' },
  row_tbar:             { sfr: 4, resistanceProfile: 'mid' },
  row_db:               { sfr: 3, resistanceProfile: 'mid' },
  row_chest_supported:  { sfr: 5, resistanceProfile: 'mid' },
  row_seal:             { sfr: 4, resistanceProfile: 'mid' },
  row_pendlay:          { sfr: 3, resistanceProfile: 'mid' },
  yates_row:            { sfr: 3, resistanceProfile: 'mid' },
  straight_arm_pullover:{ sfr: 4, resistanceProfile: 'lengthened' },
  dumbbell_pullover:    { sfr: 4, resistanceProfile: 'lengthened' },
  face_pull:            { sfr: 4, resistanceProfile: 'short' },
  // ── Квадрицепс ─────────────────────────────────────────────────────────
  leg_ext:              { sfr: 5, resistanceProfile: 'short' },
  leg_ext_v2:           { sfr: 5, resistanceProfile: 'short' },
  hack_squat:           { sfr: 4, resistanceProfile: 'lengthened' },
  squat_smith:          { sfr: 4, resistanceProfile: 'lengthened' },
  leg_press:            { sfr: 4, resistanceProfile: 'lengthened' },
  squat:                { sfr: 3, resistanceProfile: 'lengthened' },
  bulgarian_split_squat:{ sfr: 4, resistanceProfile: 'lengthened', unilateral: true },
  walking_lunge:        { sfr: 3, resistanceProfile: 'lengthened', unilateral: true },
  walking_lunge_db:     { sfr: 3, resistanceProfile: 'lengthened', unilateral: true },
  // ── Бицепс бедра ───────────────────────────────────────────────────────
  rdl:                  { sfr: 4, resistanceProfile: 'lengthened' },
  deadlift_romanian:    { sfr: 4, resistanceProfile: 'lengthened' },
  leg_curl:             { sfr: 5, resistanceProfile: 'short' },
  leg_curl_lying:       { sfr: 5, resistanceProfile: 'short' },
  leg_curl_seated:      { sfr: 5, resistanceProfile: 'short' },
  // ── Плечи ──────────────────────────────────────────────────────────────
  lateral_raise:        { sfr: 5, resistanceProfile: 'mid' },
  lateral_raise_cable:  { sfr: 5, resistanceProfile: 'mid' },
  lateral_raise_machine:{ sfr: 5, resistanceProfile: 'mid' },
  rear_delt_fly:        { sfr: 4, resistanceProfile: 'short' },
  ohp_seated_bar:       { sfr: 3, resistanceProfile: 'mid' },
  ohp_seated_db:        { sfr: 3, resistanceProfile: 'mid' },
  smith_shoulder_press: { sfr: 4, resistanceProfile: 'mid' },
  // ── Руки ───────────────────────────────────────────────────────────────
  curl_bar:             { sfr: 4, resistanceProfile: 'mid' },
  curl_db:              { sfr: 4, resistanceProfile: 'mid' },
  hammer_curl:          { sfr: 4, resistanceProfile: 'mid' },
  incline_curl:         { sfr: 4, resistanceProfile: 'lengthened' },
  preacher_curl:        { sfr: 4, resistanceProfile: 'short' },
  tricep_pushdown_rope: { sfr: 5, resistanceProfile: 'short' },
  tricep_pushdown_bar:  { sfr: 5, resistanceProfile: 'short' },
  overhead_triceps:     { sfr: 4, resistanceProfile: 'lengthened' },
  french_press:         { sfr: 4, resistanceProfile: 'lengthened' },
  // ── Икры / Пресс ───────────────────────────────────────────────────────
  calf_raise:           { sfr: 5, resistanceProfile: 'lengthened' },
  crunch:               { sfr: 4, resistanceProfile: 'mid' },
};

/** RU-ключевые слова → id упражнения (для sfrOf по русскому имени из каталога). */
const RU_NAME_LOOKUP: Array<[RegExp, string]> = [
  [/разводк.*гантел|разводк.*л[её]жа/, 'fly_db'],
  [/разводк.*блок|сведен.*блок|кроссовер/, 'crossover_cable'],
  [/пек.?дек|бабочк|бабочка/, 'pec_deck'],
  [/сведен.*тренаж|сведени.*в тренаж/, 'pec_deck'],
  [/жим штанги л[её]жа|жим.*л[её]жа/, 'bench_bar'],
  [/жим гантел.*л[её]жа|жим гантел.*наклон/, 'incline_db'],
  [/жим.*наклон.*(штанга|смит)/, 'incline_bar'],
  [/тяга верхн|пуллдаун|вертик.*блок/, 'pulldown'],
  [/подтягивания/, 'pullup'],
  [/тяга штанги в наклон|тяга.*наклон/, 'row_bar'],
  [/тяга.*тренаж|тяга.*грудь.*упор/, 'row_chest_supported'],
  [/разгибание ног|разгибан.*ног/, 'leg_ext'],
  [/жим ногами/, 'leg_press'],
  [/приседания/, 'squat'],
  [/болгар/, 'bulgarian_split_squat'],
  [/выпад/, 'walking_lunge'],
  [/румынская тяга|румын/, 'rdl'],
  [/сгибание ног|сгибан.*ног/, 'leg_curl'],
  [/махи гантел.*сторон|развед.*гантел|махи в стороны/, 'lateral_raise'],
  [/развед.*блок/, 'lateral_raise_cable'],
  [/жим гантел.*сидя|жим.*сидя/, 'ohp_seated_db'],
  [/сгибание рук|подъём штанги на бицепс/, 'curl_bar'],
  [/сгибание рук.*гантел/, 'curl_db'],
  [/молоток|молот/, 'hammer_curl'],
  [/сгибание рук.*наклон/, 'incline_curl'],
  [/разгибание рук.*блок|трицепс.*блок|канат/, 'tricep_pushdown_rope'],
  [/француз/, 'french_press'],
  [/подъём на носки|подъем на носки|calf/, 'calf_raise'],
  [/скручивани/, 'crunch'],
];

function findByName(n: string): string | null {
  for (const [re, id] of RU_NAME_LOOKUP) {
    if (re.test(n)) return id;
  }
  return null;
}

/** SFR записи для упражнения (по id, fallback по имени). */
export function sfrOf(ex: { id?: string; name?: string }): number | null {
  if (ex?.id && SFR_EXERCISE_DB[ex.id]) return SFR_EXERCISE_DB[ex.id].sfr;
  const n = String(ex?.name || '').toLowerCase();
  const idByName = findByName(n);
  if (idByName && SFR_EXERCISE_DB[idByName]) return SFR_EXERCISE_DB[idByName].sfr;
  for (const [id, rec] of Object.entries(SFR_EXERCISE_DB)) {
    if (id.includes('_') && n.includes(id.replace(/_/g, ' '))) return rec.sfr;
  }
  return null;
}

/** Профиль сопротивления (позиция натяжения) для упражнения. */
export function resistanceProfileOf(ex: { id?: string; name?: string }): ResistanceProfile | null {
  const n = String(ex?.name || '').toLowerCase();
  if (ex?.id && SFR_EXERCISE_DB[ex.id]) return SFR_EXERCISE_DB[ex.id].resistanceProfile;
  // Эвристика: явные lengthened-маркеры (Maeo 2023).
  if (/rdl|румын|наклон.*скам|incline|француз|french|overhead|сисси|sissy|дефицит|deficit|пуловер|pullover|подтяг|pull.?up|выпад|lunge|болгар|разводк|fly/i.test(n)) return 'lengthened';
  if (/концентр|concentration|проповед|preacher|crossover|кроссовер|сведен|разгибан.*блок|pushdown|подъём.*нос|calf/i.test(n)) return 'short';
  return 'mid';
}

/** Одностороннее ли движение (для унилатерального баланса). */
export function isUnilateralExercise(ex: { id?: string; name?: string }): boolean {
  if (ex?.id && SFR_EXERCISE_DB[ex.id]) return !!SFR_EXERCISE_DB[ex.id].unilateral;
  return /болгар|bulgarian|одной рук|одной ног|single|выпад|lunge|step.?up|зашагиван|отведен.*одной|kick.?back/i.test(String(ex?.name || ''));
}

/** Строка «чем хорошо» (SFR + позиция) для UI-тултипа. */
export function exerciseQualityNote(ex: { id?: string; name?: string; muscle?: string }): string | null {
  const sfr = sfrOf(ex);
  const profile = resistanceProfileOf(ex);
  if (sfr == null && profile === 'mid') return null;
  const parts: string[] = [];
  if (sfr != null) parts.push(`SFR ${sfr}/5 (${sfr >= 5 ? 'максимум стимула на минимум усталости' : sfr >= 4 ? 'высокий стимул-к-усталости' : 'умеренный (системная усталость выше)'})`);
  if (profile === 'lengthened') parts.push('растянутая позиция — ключевой драйвер гипертрофии (Maeo 2023)');
  else if (profile === 'short') parts.push('пиковое сокращение — дополняет растянутую фазу');
  if (isUnilateralExercise(ex)) parts.push('одностороннее — исправляет асимметрию');
  return parts.join(' · ');
}

/** Доля унилатеральных сетов в плане (0..1) — для отчёта качества. */
export function unilateralRatioOf(plan: { weeks?: Array<{ sessions: Array<{ exercises: Array<{ name?: string; id?: string; sets?: number; workSets?: unknown[] }> }> }> }): number {
  let total = 0, unilateral = 0;
  for (const wk of plan.weeks || []) for (const s of wk.sessions || []) for (const ex of s.exercises || []) {
    const sets = Number(ex.workSets?.length ?? ex.sets ?? 0);
    if (!sets) continue;
    total += sets;
    if (isUnilateralExercise(ex)) unilateral += sets;
  }
  return total > 0 ? unilateral / total : 0;
}

/**
 * Мягкий бонус к _score выбора упражнения (SFR высокий + lengthened в intensification).
 * НЕ меняет количество сетов/упражнений — только приоритет среди кандидатов одного пула.
 */
export function sfrSelectionBonus(ex: { id?: string; name?: string }, phase?: string): number {
  let bonus = 0;
  const sfr = sfrOf(ex);
  if (sfr != null) bonus += sfr >= 5 ? 4 : sfr >= 4 ? 2 : 0;
  const profile = resistanceProfileOf(ex);
  if (profile === 'lengthened' && phase === 'intensification') bonus += 3;
  return bonus;
}
