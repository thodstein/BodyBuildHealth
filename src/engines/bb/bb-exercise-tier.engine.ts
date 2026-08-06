/**
 * bb-exercise-tier.engine.ts — классификатор «обычности» упражнений для ББ-гипертрофии.
 *
 * Профессиональный тренер по умолчанию программирует КАНОНИЧЕСКИЕ упражнения
 * (жим лёжа, тяга в наклоне, присед, OHP, махи в стороны, подъём на бицепс, …),
 * а не экзотику (жим гири донышком вверх, кубинский жим, махи Lu, свенд-жим,
 * гильотинный жим, швунг, прогулка фермера, турецкий подъём). Экзотика уместна
 * только как вариативность для опытных, не как дефолтный подбор.
 *
 * Тиры:
 *  1 — canonical: стандартный тренерский инструментарий (предпочитать).
 *  2 — acceptable: допустимая вариативность (Смит, тренажёры, Арнольд-жим).
 *  3 — exotic: специфичные/нестандартные (гиря, ол./стронгмен, мобилити) — штраф.
 *  4 — inappropriate: не для дефолтной ББ-гипертрофии (гильотина, швунг, TGU,
 *      прогулка фермера, плиометрика, одной рукой) — исключать из пула по умолчанию.
 */
import type { Exercise } from '../../core/types';

export type BBExerciseTier = 1 | 2 | 3 | 4;

/* ───────────────────────── Канонический инструментарий ───────────────────────── */
// По id/имени — то, что тренер ставит в 90% программ.
// планки/dead bug/bird dog/pallof исключены: не ББ-гипертрофия (isBBJunk отсекает раньше).
const CANONICAL_PATTERNS: RegExp = /жим.*штанг.*лёж|жим.*гантел.*лёж|жим.*наклонн|жим.*отрицат|жим.*смите.*лёж|отжиман.*брусь|отжиман.*кольц|алмазн.*отжиман|разводк.*гантел|сведен.*кроссовер|сведен.*тренаж|butterfly|пуловер|жим.*грудн.*тренаж|подтяг|pull-?up|тяга.*верхн.*блок|тяга.*наклон|тяга.*тренаж|тяга.*т-гриф|тяга.*горизонтальн|тяга.*подбород|upright.?row|шраги.*штанг|шраги.*гантел|армейск.*жим|жим.*гантел.*сидя|жим.*смите.*сидя|жим.*стоя|махи.*гантел.*стор|махи.*кроссовер.*стор|махи.*наклон.*задн|тяга.*лиц|обратн.*сведен|присед.*штанг|фронт.*присед|жим.*ногам|выпад|rdl|румынск|сгибан.*ног|разгибан.*ног|ягодичн.*мост|ягодичн.*мостик|hip.?thrust|подъём.*носки|подъём.*носк.*стоя|подъём.*носк.*сидя|подъём.*штанг.*бицепс|подъём.*гантел.*бицепс|подъём.*гир|подъём.*на бицепс|сгибани.*бицепс|сгибани.*блок|молотк|скамье.*скотт|разгибан.*блок|разгибани.*трицепс|разгибани.*канат|французск.*жим|жим.*узким хват|жим.*узк|pushdown|face.?pull|lateral.?raise|lat.?pulldown|barbell.?row|dumbbell.?row|bench.?press|incline.?press|leg.?press|leg.?curl|leg.?ext|calf.?raise|shrug|ohp/i;

/* ───────────────────────── Экзотика / специфика ───────────────────────── */
const EXOTIC_PATTERNS: RegExp = /гир[яеюи]|kettlebell|донышк|кубан|cuban|пугало|scarecrow|lu.?raise|махи.*lu|svend|свенд|hex.?press|железн.*крест|iron.?cross|landmine|лэндмайн|guillotine|гильотин|швунг|jerk|из-за.*голов|behind.?neck|рывок.*гир|взят.*гир|олимп|olymp|прогулк.*фермер|farmer.*walk|турецк.*подъём|tgu|halo|ореол|мельниц.*гир|windmill|waiter.?s?.?walk|прогулк.*гир|spiderman|человек.?паук|плиометр|plyo|дефицит|deficit|trx|кольц|suspension|svend|свенд|жим.*резин|band.*press|жим.*цеп|bench.*chain|chain.*bench|доск|board.?press|pin.?press|жим.*спот|spoto|жим.*пола|floor.?press|гильотин|guillotine|жимовой.*швунг|жим.*широк|wide.?grip.?press|железн|iron/i;

// Односторонние упражнения (одной рукой) — НЕ экзотика, норма для ББ (асимметрия, лучшая связь мозг-мышца).
// Исключение из EXOTIC_PATTERNS: убрали `одной.*рук`/`one.?arm`.

/* ───────────────────────── Категорически не для дефолта ───────────────────────── */
// ИСКЛЮЧЕНО: `одной.*рук`/`one.?arm.?push` (раньше ошибочно ловил row_db, pulldown_single, lateral_raise_single, tricep_pushdown_single и т.д.).
const INAPPROPRIATE_PATTERNS: RegExp = /донышк|bottom.?up|гильотин|guillotine|швунг|jerk|турецк.*подъём|tgu|прогулк.*фермер|farmer.?walk|прогулк.*гир|waiter.?s?.?walk|рывок.*гир|snatch|spiderman|человек.?паук|плиометр|plyo|мельниц.*гир|windmill|halo|ореол|жим.*цеп|bench.*chain|chain.*bench|доск|board|pin.?press|спот|spoto|горизонт.*групп|front.?lever|kb_snatch|kb_dead_snatch|kb_tgu|kb_halo|kb_windmill|bottom_up/i;

/** substitutionGroup, помечающий ол./стронгмен/мобилити — не ББ-гипертрофия. */
const EXOTIC_SUBGROUPS = new Set(['oly', 'strongman', 'mobility', 'core_stab']);

export function bbExerciseTier(ex: Exercise | any): BBExerciseTier {
  const n = (ex?.name || '').toLowerCase();
  const id = (ex?.id || '').toLowerCase();
  const equip = String(ex?.equipment || '').toLowerCase();
  const diff = String(ex?.difficulty || '').toLowerCase();
  const sub = String(ex?.substitutionGroup || '').toLowerCase();
  const movementType = String(ex?.movementType || '').toLowerCase();
  const joint = String(ex?.jointStress || '').toLowerCase();

  // 4) Категорически не для дефолтной ББ-гипертрофии
  if (INAPPROPRIATE_PATTERNS.test(n) || INAPPROPRIATE_PATTERNS.test(id)) return 4;
  if (movementType === 'competition_lift' && !/присед|станов|жим.*лёж|squat|deadlift|bench/i.test(n)) return 4;

  // 3) Экзотика: гиря-специфика / ол./стронгмен / мобилити / нестабильность / TRX/кольца
  if (equip === 'kettlebell' && !/кубков|goblet/i.test(n)) return 3;
  if (EXOTIC_SUBGROUPS.has(sub)) return 3;
  if (EXOTIC_PATTERNS.test(n) || EXOTIC_PATTERNS.test(id)) return 3;
  if (/trx|suspension|кольц/i.test(n)) return 3;
  // Травмоопасные/нестандартные для гипертрофии.
  // P2-7: OHP (жим стоя) — валидное плечевое compound, не должен быть tier 3 из-за jointStress:'high'.
  // C8: upright row (тяга к подбородку) УБРАН из исключений — высокий риск импинджмента
  // при абдукции >90° (Reinold 2009). Теперь tier 3 (exotic) — только для intermediate+ с allowExotic.
  if (joint === 'high' && !/присед.*штанг|станов|жим.*лёж|squat|deadlift|bench|жим.*ног|overhead|жим.*стоя|ohp/i.test(n)) return 3;

  // 1) Канонический инструментарий
  if (CANONICAL_PATTERNS.test(n) || CANONICAL_PATTERNS.test(id)) return 1;

  // 2) Допустимая вариативность (Смит-варианты без явного канон, тренажёры, Арнольд-жим, нейтральные)
  if (diff === 'beginner' || diff === 'intermediate') return 2;
  return 2;
}

export function isCanonicalBB(ex: Exercise | any): boolean { return bbExerciseTier(ex) === 1; }
export function isExoticBB(ex: Exercise | any): boolean { const t = bbExerciseTier(ex); return t === 3 || t === 4; }
export function isInappropriateBB(ex: Exercise | any): boolean { return bbExerciseTier(ex) === 4; }
export function isAcceptableBB(ex: Exercise | any): boolean { return bbExerciseTier(ex) === 2; }