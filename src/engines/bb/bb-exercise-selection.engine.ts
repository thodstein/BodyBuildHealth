/**
 * bb-exercise-selection.engine.ts — извлечённая логика выбора упражнений для мышц.
 *
 * ЭТО КАНОНИЧЕСКИЙ REFERENCE-СЛОЙ multi-angle-выбора: источник ANGLE_CLASSES и
 * lengthenedBonus. `buildSession` использует ЭТИ ЖЕ ANGLE_CLASSES в своём inline-
 * multi-angle цикле (оптимизированная специализация с _score/ротацией/фазами),
 * поэтому selectDiverseExercises не вызывается напрямую из builder — он служит
 * эталоном и покрыт тестами (bb-pro-quality-phase-c). Не удалять: это единственный
 * документированный источник классификации углов.
 *
 * FIX-C1: ранее ANGLE_CLASSES и lengthenedBonus были встроены в buildSession
 * (1700+ строк, 40+ параметров). Теперь выделены в отдельный engine для
 * независимого тестирования и переиспользования.
 *
 * Schoenfeld 2022, Maeo 2023: lengthened-position bias — упражнения в
 * растянутой позиции дают больше гипертрофии.
 * Pedrosa 2022: incline curl > preacher curl для длинной головки бицепса.
 */
import type { Exercise } from '../../core/types';
import type { BBTrainingFocus } from './bb-goal-types';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

export interface AngleClass {
  name: string;
  match: (e: any) => boolean;
}

/**
 * Классификатор углов/паттернов по мышцам.
 * Проф-порядок: первый класс = самое тяжёлое (макс. механическое натяжение),
 * последние = изоляция/растяжение/пиковое сокращение.
 */
export const ANGLE_CLASSES: Record<string, AngleClass[]> = {
  chest: [
    { name: 'horizontal_press', match: (e) => /жим.*(лёжа|лежа|гориз)|bench.*(press|жим)|жим штанги|жим в смите лёжа|жим в тренажёре|machine.*chest|chest.*press|грудн.*тренаж/i.test(e.name) && !/наклон|incline|decline|сниз|отриц|узк/i.test(e.name) },
    { name: 'incline_press', match: (e) => (/жим.*(наклон|incline|верх)/i.test(e.name) || /incline.*(press|жим)/i.test(e.name)) && !/отриц|decline|сниз|нижн/i.test(e.name) },
    { name: 'fly_cable', match: (e) => /развод|fly|crossover|кроссов|сведен|пек.?дек|бабоч|сведение/i.test(e.name) },
    { name: 'decline_press', match: (e) => /жим.*(отриц|decline|сниз|нижн)/i.test(e.name) || /decline.*(press|жим)/i.test(e.name) },
    { name: 'dips_press', match: (e) => /отжим.*(брус|dip|параллел)|брусь/i.test(e.name) && !/трицепс/i.test(e.name) },
  ],
  back: [
    { name: 'vertical_pull', match: (e) => /подтяг|pull.?up|тяга.*верх|lat.?pull|пуллдаун|верхн.*блок/i.test(e.name) && !/одной рук/i.test(e.name) },
    { name: 'heavy_row', match: (e) => (/тяга.*наклон.*штанг|тяга.*штанг.*наклон|тяга.*т-?гриф|тяга.*гриф|тяга.*пендл|тяга.*йейт|тяга.*мэдоус|тяга.*леж.*скам|seal.?row|pendlay|yates|meadows/i.test(e.name) || (/row/i.test(e.id) && !/one.?arm|single|cable|machine/i.test(e.name))) && !/верх|вертик|подтяг|одной рук|за голов/i.test(e.name) },
    { name: 'single_arm_row', match: (e) => (/тяга.*гантел.*наклон|тяга.*одной рук|тяга.*блок.*одной|тяга.*лэндмайн|тяга.*грудь.*упор|chest.?supported|тяга.*тренаж/i.test(e.name) || (/row/i.test(e.id) && /one.?arm|single|cable|machine/i.test(e.name))) && !/подтяг|за голов/i.test(e.name) },
    { name: 'pullover_lat_iso', match: (e) => /пуловер|pullover|пулов|прям.*рук|прямые руки|straight.?pull|жиз.*широчайш/i.test(e.name) },
    { name: 'rear_delt_facepull', match: (e) => /лиц.*тяга|face.?pull|тяга к лиц|задн.*дельт|rear.?delt|обратн.*бабоч/i.test(e.name) },
    { name: 'shrugs', match: (e) => /шраг/i.test(e.name) },
  ],
  quads: [
    { name: 'compound_squat', match: (e) => /присед|squat|жим.*ног|leg.?press|хак|hack/i.test(e.name) && !/над голов|overhead|пистол|pistol|split|выпад|lunge|болгар|bulgarian|гоблет|goblet|гантел|сисси|sissy|поясн|belt/i.test(e.name) },
    { name: 'lunge_bulgarian', match: (e) => /выпад|lunge|болгар|bulgarian|гоблет|goblet|фронт.*присед|front.*squat|split.*squat|присед.*ножниц/i.test(e.name) && !/сисси|sissy/i.test(e.name) },
    { name: 'sissy_lengthened', match: (e) => /сисси|sissy|наклон.*назад|reverse.*nordic|обратн.*скандинав/i.test(e.name) },
    { name: 'extension', match: (e) => /разгибан.*ног|leg.?extension/i.test(e.name) },
    { name: 'belt_stepup', match: (e) => /поясн.*присед|belt.?squat|step.?up|вставан.*скам|зашагиван/i.test(e.name) },
  ],
  hamstrings: [
    { name: 'curl', match: (e) => /сгибан.*ног|leg.?curl|сгибания ног/i.test(e.name) },
    { name: 'seated_curl', match: (e) => /сгибан.*сидя|seated.*curl/i.test(e.name) },
    { name: 'rdl_bridge', match: (e) => /румын|rdl|ягодичн.*мост|hip.?thrust|glute.?bridge/i.test(e.name) },
    { name: 'good_morning', match: (e) => /гудморнинг|good.?morning|гиперэкстенз|back.?extension/i.test(e.name) },
    { name: 'nordic_ghr', match: (e) => /норд|nordic|glute.?ham|ghr/i.test(e.name) },
    { name: 'lunge', match: (e) => /выпад|lunge/i.test(e.name) },
  ],
  glutes: [
    { name: 'hip_thrust', match: (e) => /ягодичн.*мост|hip.?thrust|glute.?bridge/i.test(e.name) },
    { name: 'squat_variant', match: (e) => /присед|squat|выпад|lunge|болгар/i.test(e.name) },
    { name: 'kickback', match: (e) => /отведен.*ног|kick.?back|мах.*ног|glute.?kick/i.test(e.name) },
    { name: 'abduction', match: (e) => /отведен.*бедр|abduction|разведен.*ног/i.test(e.name) },
    { name: 'extension', match: (e) => /гиперэкстенз|back.?extension|45.?degree/i.test(e.name) },
  ],
  calves: [
    { name: 'standing_calf', match: (e) => /подъём.*носки.*стоя|подъем.*носки.*стоя|standing.*calf|calf.*stand/i.test(e.name) },
    { name: 'seated_calf', match: (e) => /подъём.*носки.*сидя|подъем.*носки.*сидя|seated.*calf|calf.*seat/i.test(e.name) },
    { name: 'donkey_calf', match: (e) => /ослин|donkey.*calf|наклон.*носки/i.test(e.name) },
  ],
  biceps: [
    { name: 'barbell_curl', match: (e) => /сгибан.*штанг|barbell.*curl|подъём.*штанг.*бицепс|подъем.*штанг.*бицепс/i.test(e.name) && !/молот|наклон|проповед|концентр/i.test(e.name) },
    { name: 'incline_lengthened', match: (e) => /сгибан.*наклон|incline.*curl|сгибан.*скам.*наклон/i.test(e.name) },
    { name: 'hammer_brachialis', match: (e) => /молот|hammer.*curl/i.test(e.name) },
    { name: 'preacher_shortened', match: (e) => /проповед|preacher|концентр|concentration|спайдер|spider/i.test(e.name) },
    { name: 'cable_constant', match: (e) => /сгибан.*блок|cable.*curl|бицепс.*блок/i.test(e.name) },
    { name: 'dumbbell_curl', match: (e) => /сгибан.*гантел|dumbbell.*curl|бицепс.*гантел/i.test(e.name) && !/молот|наклон|проповед|концентр/i.test(e.name) },
  ],
  triceps: [
    { name: 'press_closegrip', match: (e) => /жим.*узк|close.?grip|француз.*жим/i.test(e.name) },
    { name: 'extension_overhead', match: (e) => /разгибан.*из.?за|overhead.*triceps|француз|french/i.test(e.name) },
    { name: 'pushdown', match: (e) => /разгибан.*блок|pushdown|трицепс.*блок|канат.*рукоят/i.test(e.name) },
    { name: 'dips_triceps', match: (e) => /отжим.*брус|dip|брусь/i.test(e.name) },
  ],
  abs: [
    { name: 'crunch', match: (e) => /скручиван|crunch|пресс.*скручив/i.test(e.name) },
    { name: 'leg_raise', match: (e) => /подъём.*ног|подъем.*ног|leg.?raise|подниман.*ног/i.test(e.name) },
    { name: 'cable_crunch', match: (e) => /пресс.*блок|cable.*crunch|скручиван.*блок/i.test(e.name) },
  ],
};

/**
 * FIX-B4: lengthenedBonus — приоритет упражнениям в растянутой позиции.
 * Schoenfeld 2022, Maeo 2023: длина мышцы при натяжении — ключевой драйвер гипертрофии.
 * RDL > stiff-leg deadlift, incline curl > preacher curl, sissy squat > leg extension.
 * P2-4: trainingFocus модулирует бонус — strength меньше заботит растяжение
 * (механическое натяжение важнее), endurance больше (метаболический стресс + растяжение).
 */
export function lengthenedBonus(name: string, focus?: BBTrainingFocus): number {
  const n = (name || '').toLowerCase();
  if (/наклон.*скам|incline|наклонн|rdl|румынская|good.?morning|гудморнинг|сисси|sissy|overhead.*tricep|француз|french|за голов|behind.?neck|сгибан.*наклон|incline.*curl|пуловер|pullover|дефицит|deficit|атг|atg|глубок.*присед|ass.?to.?grass/i.test(n)) {
    const mult = focus === 'strength' ? 0.5 : focus === 'endurance' ? 1.5 : 1.0;
    return Math.round(10 * mult);
  }
  return 0;
}

/**
 * Подобрать упражнения для мышцы с учётом multi-angle diversity.
 * Возвращает N упражнений из разных angle classes.
 */
export function selectDiverseExercises(
  pool: Exercise[],
  muscle: string,
  exerciseCount: number,
  usedIds: Set<string>,
  rotationNames: Set<string>,
  week: number,
  dayInRotation: number,
  weakPoints: string[] = [],
): Exercise[] {
  const classes = ANGLE_CLASSES[muscle];
  if (!classes || classes.length === 0 || pool.length === 0) return [];

  const diverse: Exercise[] = [];
  const usedIdsLocal = new Set(usedIds);

  const usedClassIdx = new Set<number>();
  for (let ci = 0; ci < classes.length; ci++) {
    const ac = classes[ci];
    if (diverse.length >= exerciseCount) break;
    let candidates = pool.filter(e => ac.match(e) && !usedIdsLocal.has((e as any).id) && !rotationNames.has((e as any).name));
    if (candidates.length === 0) continue;
    // offset для вариативности между неделями (не для первого класса)
    const offset = ci === 0 ? 0 : (week * 31 + dayInRotation * 17 + ci * 7) % candidates.length;
    const pick = candidates[offset];
    if (pick) {
      diverse.push(pick);
      usedIdsLocal.add((pick as any).id);
      usedClassIdx.add(ci);
    }
  }
  // Добрать до exerciseCount если не хватило — только из неиспользованных классов (не дублируем угол)
  for (const e of pool) {
    if (diverse.length >= exerciseCount) break;
    if (diverse.some(d => (d as any).id === (e as any).id) || usedIdsLocal.has((e as any).id)) continue;
    // проверить, что угол ещё не занят — иначе это дубль паттерна
    const clsIdx = classes.findIndex(c => c.match(e));
    if (clsIdx >= 0 && usedClassIdx.has(clsIdx)) continue;
    diverse.push(e);
    usedIdsLocal.add((e as any).id);
    if (clsIdx >= 0) usedClassIdx.add(clsIdx);
  }
  return diverse.slice(0, exerciseCount);
}

/* ═══════════════════════════════════════════════════════════════════
 * ЖЁСТКИЕ ГРУППЫ ЗАМЕНЫ (требование пользователя):
 * упражнения ВНУТРИ группы меняются ТОЛЬКО между собой (в один день могут
 * стоять все, между программами/неделями — ротация членов группы), и каждая
 * группа ОБЯЗАНА быть представлена в сессии мышцы (если группа доступна в пуле).
 *
 * Грудь: разводки (гантели/пек-дек) + жим под углом 30° (гантели/Смит/штанга).
 * Спина: тяга верхнего блока (широкий прямой/параллельный хват), тяга двух
 * гантелей лёжа на скамье (seal), Т-тяга.
 * Бицепс бедра: сгибания ног (лёжа/сидя), гакк на бицепс/«колодец» (нет в
 * каталоге — группа сработает, если появится), румынская тяга.
 * Квадрицепс: приседания со штангой/гакк, разгибания ног сидя.
 * ═══════════════════════════════════════════════════════════════════ */
export interface StrictExerciseGroup {
  key: string;
  label: string;
  ids?: string[];
  re?: RegExp;
  /** Имена, НЕ входящие в группу (например, жимы не попадают в разводки). */
  not?: RegExp;
}

export const STRICT_EXERCISE_GROUPS: Record<string, StrictExerciseGroup[]> = {
  chest: [
    {
      key: 'chest_fly', label: 'Разводки/пек-дек',
      ids: ['fly_db', 'pec_deck', 'fly_cable', 'cable_fly', 'cable_fly_low', 'cable_fly_mid', 'cable_fly_incline',
        'incline_fly_db', 'incline_fly_cable', 'decline_fly_db', 'machine_fly', 'dumbbell_crossover',
        'bb_cable_upper', 'bb_cable_mid', 'bb_cable_lower', 'cable_crossover_low_high', 'cable_decline_fly',
        'incline_bench_cable_fly', 'cable_iron_cross'],
      re: /развод|пек.?дек|бабоч|сведен|кроссов|crossover|сведение|fly/i,
      not: /жим|press|bench/i,
    },
    {
      key: 'chest_incline', label: 'Жим под углом 30°',
      ids: ['incline_bar', 'incline_db', 'smith_incline', 'machine_incline_press'],
      re: /жим.*(наклон|incline)|incline.*(жим|press)/i,
    },
  ],
  back: [
    {
      key: 'back_pulldown', label: 'Тяга верхнего блока',
      ids: ['pulldown', 'pulldown_wide', 'pulldown_rev', 'pulldown_vbar', 'lat_pulldown_mag'],
      re: /тяга верхнего блока|pulldown|lat.?pull/i,
    },
    {
      key: 'back_seal', label: 'Тяга лёжа на скамье',
      ids: ['row_seal', 'row_chest_supported'],
      re: /л[её]жа на скамь|seal|упор.*груд|chest.?supported/i,
    },
    {
      key: 'back_tbar', label: 'Т-тяга',
      ids: ['row_tbar', 'tbar_row_v2'],
      re: /т-?гриф|t.?bar/i,
    },
  ],
  hamstrings: [
    {
      key: 'ham_curl', label: 'Сгибания ног (лёжа/сидя)',
      ids: ['leg_curl', 'leg_curl_seated', 'leg_curl_standing', 'leg_curl_seated_v2', 'leg_curl_single',
        'leg_curl_lying', 'seated_leg_curl', 'lying_leg_curl', 'single_leg_curl', 'nordic_curl'],
      re: /сгибан.*ног|leg.?curl/i,
    },
    {
      key: 'ham_hack', label: 'Гакк на бицепс бедра/«колодец»',
      ids: [],
      re: /гакк|hack|колодец/i,
    },
    {
      key: 'ham_rdl', label: 'Румынская тяга',
      ids: ['rdl', 'rdl_db', 'rdl_v2', 'b_stance_rdl', 'deadlift_stiff_leg', 'deadlift_romanian'],
      re: /румын|rdl|м[её]ртв.*прям/i,
    },
  ],
  quads: [
    {
      key: 'quad_squat', label: 'Приседания со штангой/гакк',
      ids: ['squat', 'squat_bar', 'front_squat', 'front_squat_v2', 'front_squat_clean_grip', 'hack_squat',
        'hack_squat_v2', 'hack_squat_reverse', 'squat_ssb', 'squat_smith', 'squat_belt', 'squat_lowbar',
        'squat_pause', 'squat_tempo', 'squat_anderson', 'squat_box', 'squat_zercher', 'goblet_squat',
        'sumo_squat', 'pendulum_squat', 'squat_overhead'],
      re: /присед|squat|хак|hack|гакк/i,
    },
    {
      key: 'quad_ext', label: 'Разгибания ног сидя',
      ids: ['leg_ext', 'leg_ext_v2', 'leg_ext_single', 'seated_leg_extension', 'single_leg_extension', 'wall_sit'],
      re: /разгибан.*ног|leg.?extension/i,
    },
  ],
};

/** Проверить, входит ли упражнение в жёсткую группу (по id или имени). */
export function strictGroupMatches(ex: { id?: string; name?: string }, g: StrictExerciseGroup): boolean {
  if (g.ids && ex.id && g.ids.includes(ex.id)) return true;
  if (g.not && ex.name && g.not.test(ex.name)) return false;
  if (g.re && ex.name && g.re.test(ex.name)) return true;
  return false;
}

/** Группа, в которую входит упражнение (для свопа: менять ТОЛЬКО внутри группы). */
export function strictGroupForExercise(ex: { id?: string; name?: string }, muscle?: string): StrictExerciseGroup | undefined {
  const groups = muscle
    ? (STRICT_EXERCISE_GROUPS[muscle] || [])
    : Object.values(STRICT_EXERCISE_GROUPS).flat();
  return groups.find(g => strictGroupMatches(ex, g));
}

/** Члены группы из каталога — кандидаты на замену упражнения (свод-модал). */
export function strictGroupMembersOf(ex: { id?: string; name?: string }, muscle?: string): Exercise[] {
  const g = strictGroupForExercise(ex, muscle);
  if (!g) return [];
  return EXERCISE_CATALOG.filter(c => strictGroupMatches(c, g));
}

/**
 * Pass покрытия жёстких групп для сессии мышцы (buildSession):
 * каждая группа, доступная в пуле, обязана быть представлена в exDatas.
 *
 * Политика (сохраняет объёмную модель и finalize-балансы неизменными):
 *  - ТОЛЬКО замена, без добавления слотов: количество упражнений мышцы и
 *    делитель pl.sets/exDatas.length не меняются (weeklySets инвариантны);
 *  - кандидат выбирается В ПРЕДЕЛАХ ТОГО ЖЕ углового класса (ANGLE_CLASSES),
 *    что и заменяемое упражнение — width/thickness и прочие балансы
 *    финализатора не сдвигаются; если в том же классе кандидатов нет —
 *    группа не форсируется (ротация недель принесёт её позже);
 *  - заменяемый элемент НЕ является единственным представителем другой
 *    обязательной группы (иначе создадим дыру); lead (позиция 0) НЕ трогается;
 *  - выбор детерминирован (лучший _score из пула, без freshness недели) —
 *    primary-упражнения стабильны между неделями (включая deload);
 *  - применяется ТОЛЬКО для primary-мышц (accessory-дни не трогаются).
 */
export function ensureStrictGroupCoverage(
  exDatas: any[],
  pool: any[],
  muscle: string,
  exerciseCount: number,
  sessionSelectedIds: string[],
  sessionSelectedNames: string[],
  opts?: { isPrimary?: boolean },
): void {
  if (opts?.isPrimary === false) return;
  const groups = STRICT_EXERCISE_GROUPS[muscle];
  if (!groups || groups.length === 0 || exDatas.length < 2) return;
  for (const g of groups) {
    if (exDatas.some(ex => strictGroupMatches(ex, g))) continue;
    const poolMembers = pool.filter(ex => strictGroupMatches(ex, g));
    if (poolMembers.length === 0) continue; // группа недоступна (нет в каталоге/оборудовании)
    // Ищем заменяемый элемент: последний, НЕ являющийся единственным
    // представителем другой обязательной группы (иначе создадим дыру).
    let idx = -1;
    for (let i = exDatas.length - 1; i >= 1; i--) {
      const d = exDatas[i];
      const onlyRep = groups.some(other => other !== g
        && strictGroupMatches(d, other)
        && !exDatas.some((x, xi) => xi !== i && strictGroupMatches(x, other)));
      if (!onlyRep) { idx = i; break; }
    }
    // Lead-compound (позиция 0) НЕ трогаем никогда — стабильность дня.
    if (idx < 0) continue;
    const replaced = exDatas[idx];
    // Кандидат — ТОЛЬКО члены группы в том же угловом классе, что и заменяемое
    // упражнение: width/thickness и прочие паттерны финализатора не сдвигаются,
    // indirect-перекрытия рук не меняются. Если в том же классе кандидатов нет —
    // группа не форсируется (ротация недель принесёт её позже).
    const classes = ANGLE_CLASSES[muscle] || [];
    const sameClass = poolMembers.filter(m =>
      classes.some(ac => ac.match(replaced) && ac.match(m))
      && !exDatas.some(d => d.id === m.id));
    if (sameClass.length === 0) continue;
    const best = sameClass.slice().sort((a, b) => ((b._score ?? 0) - (a._score ?? 0)))[0];
    if (!best) continue;
    exDatas[idx] = best;
    const iId = sessionSelectedIds.indexOf(replaced.id);
    if (iId >= 0) sessionSelectedIds[iId] = best.id; else sessionSelectedIds.push(best.id);
    const iNm = sessionSelectedNames.indexOf(replaced.name);
    if (iNm >= 0) sessionSelectedNames[iNm] = best.name; else sessionSelectedNames.push(best.name);
  }
}
