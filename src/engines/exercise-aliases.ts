/**
 * exercise-aliases.ts — маппинг альтернативных названий упражнений на canonical ID.
 *
 * Используется для:
 *  1. Fuzzy match в diary-autoreg (сопоставление planned vs logged exercises)
 *  2. Поиск в дневнике по пользовательскому вводу
 *  3. Автозаполнение из CSV-импорта
 */

export interface ExerciseAlias {
  canonicalId: string;
  aliases: string[];
}

const ALIASES: ExerciseAlias[] = [
  { canonicalId: 'bench_bar', aliases: ['жим лежа', 'жим штанги лежа', 'жим штанги лёжа', 'bench press', 'жим', 'bp'] },
  { canonicalId: 'bench_db', aliases: ['жим гантелей лежа', 'жим гантелей лёжа', 'жим гантелей', 'db press'] },
  { canonicalId: 'squat', aliases: ['присед', 'приседания', 'приседания со штангой', 'back squat', 'присед со штангой', 'приседания со штангой'] },
  { canonicalId: 'deadlift', aliases: ['становая тяга', 'становая', 'становка', 'deadlift', 'стол', 'сdl'] },
  { canonicalId: 'rdl', aliases: ['румынская тяга', 'румынская', 'романян', 'romanian deadlift', 'rdl', 'тяга на прямых ногах', 'тяга прямых ног'] },
  { canonicalId: 'ohp', aliases: ['жим стоя', 'жим штанги стоя', 'жим над головой', 'overhead press', 'армейский жим', 'армейский', 'жим сидя'] },
  { canonicalId: 'row_bar', aliases: ['тяга штанги в наклоне', 'тяга штанги', 'barbell row', 'тяга в наклоне'] },
  { canonicalId: 'row_db', aliases: ['тяга гантели', 'тяга гантелей', 'single arm row', 'тяга гантели в наклоне'] },
  { canonicalId: 'pull_up', aliases: ['подтягивания', 'подтягивание', 'pull up', 'pull-up', 'pullup'] },
  { canonicalId: 'lat_pulldown', aliases: ['тяга верхнего блока', 'тяга к груди', 'верхний блок', 'lat pulldown', 'pulldown'] },
  { canonicalId: 'cable_fly', aliases: ['разводка в кроссовере', 'разводка кабель', 'кроссовер', 'cable fly', 'crossover'] },
  { canonicalId: 'dumbbell_fly', aliases: ['разводка гантелей', 'разводка гантелей лежа', 'db fly'] },
  { canonicalId: 'dips', aliases: ['отжимания на брусьях', 'брусья', 'отжимания на брусьях', 'dip', 'dips', 'parallettes'] },
  { canonicalId: 'leg_press', aliases: ['жим ногами', 'leg press', 'ножной жим'] },
  { canonicalId: 'hack_squat', aliases: ['гакк', 'гакк-присед', 'hack squat', 'гак присед'] },
  { canonicalId: 'leg_ext', aliases: ['разгибания ног', 'разгибание ног', 'leg extension', 'в тренажере для разгибания', 'разгибание'] },
  { canonicalId: 'leg_curl', aliases: ['сгибания ног', 'сгибание ног', 'leg curl', 'hamstring curl', 'сгибание'] },
  { canonicalId: 'calf_raise', aliases: ['подъёмы на носки', 'икры', 'calf raise', ' calf', 'подъем на носки', 'икроножные'] },
  { canonicalId: 'bicep_curl', aliases: ['сгибания на бицепс', 'бицепс', 'curl', 'бicep curl', 'бицепс штангой', 'бицепс гантелями'] },
  { canonicalId: 'hammer_curl', aliases: ['молотки', 'hammer curl', 'молоток', 'crossover curl'] },
  { canonicalId: 'tricep_pushdown', aliases: ['разгибания на трицепс', 'трицепс', 'pushdown', 'трицепс на блоке', 'трицепс трос'] },
  { canonicalId: 'skull_crusher', aliases: ['французский жим', 'французский', 'skull crusher', 'laying tricep extension'] },
  { canonicalId: 'face_pull', aliases: ['фейс пул', 'face pull', 'facepull', 'к лицу'] },
  { canonicalId: 'lateral_raise', aliases: ['разводка на плечи', 'боковые', 'lateral raise', 'разводка в стороны', 'плечи'] },
  { canonicalId: 'front_raise', aliases: ['передняя', 'front raise', 'подъем передний'] },
  { canonicalId: 'rear_delt_fly', aliases: ['задняя', 'rear delt', 'обратная разводка', 'задний пучок'] },
  { canonicalId: 'shrug', aliases: ['шраги', 'shrug', 'трапеции', 'трапеция'] },
  { canonicalId: 'hip_thrust', aliases: ['ягодичный', 'hip thrust', 'hipthrust', 'жим ягодицами'] },
  { canonicalId: 'glute_bridge', aliases: ['ягодичный мостик', 'glute bridge', 'bridge'] },
  { canonicalId: 'bulgarian_squat', aliases: ['болгарские', 'болгарский присед', 'bulgarian split squat', 'разножка'] },
  { canonicalId: 'lunge', aliases: ['выпады', 'выпад', 'lunge', 'lunges'] },
  { canonicalId: 'hip_adduction', aliases: ['сведение ног', 'adduction', 'внутренняя часть'] },
  { canonicalId: 'hip_abduction', aliases: ['разведение ног', 'abduction', 'наружная часть', 'отведение'] },
  { canonicalId: 'plank', aliases: ['планка', 'plank', 'stabilization'] },
  { canonicalId: 'crunch', aliases: ['скручивания', 'crunch', 'abdominal'] },
  { canonicalId: 'hanging_leg_raise', aliases: ['подъём ног', 'hanging leg raise', 'подъем ног вис'] },
  { canonicalId: 'cable_woodchop', aliases: ['древосек', 'woodchop', 'кроссовер поворот'] },
  { canonicalId: 'chest_dip', aliases: ['отжимания грудь на брусьях', 'chest dip'] },
  { canonicalId: 'preacher_curl', aliases: ['молитва', 'preacher curl', 'скамья Скотта', 'preacher'] },
  { canonicalId: 'incline_curl', aliases: ['наклонные сгибания', 'incline curl', 'на наклонной'] },
  { canonicalId: 'concentration_curl', aliases: ['концентрированные', 'concentration curl', 'концентрированный'] },
  { canonicalId: 'cable_kickback', aliases: ['кикбек', 'kickback', 'кабельный'] },
  { canonicalId: 'tricep_overhead', aliases: ['разгибание над головой', 'overhead extension', 'французский стоя'] },
  { canonicalId: 'upright_row', aliases: ['тяга к подбородку', 'upright row', 'к подбородку'] },
  { canonicalId: 'barbell_row_underhand', aliases: ['тяга штанги обратным хватом', 'underhand row'] },
  { canonicalId: 'chest_press_machine', aliases: ['жим в тренажере', 'chest press machine', 'жим от груди'] },
  { canonicalId: 'pec_deck', aliases: ['бабочка', 'pec deck', 'дельтавлав'] },
  { canonicalId: 'reverse_fly', aliases: ['обратная разводка', 'reverse fly', 'rear delt'] },
  { canonicalId: 't_bar_row', aliases: ['t-образная', 't-bar row', 'тяга т-грифа', 'тяга т'] },
  { canonicalId: 'good_morning', aliases: ['.good morning', 'гуд-монинг', 'good morning', 'гудмонинг'] },
  { canonicalId: 'hyperextension', aliases: ['гиперextension', 'hyperextension', 'на римском стуле', 'гипер'] },
  { canonicalId: 'seated_row', aliases: ['горизонтальная тяга', 'тяга к поясу', 'seated row', 'нижний блок'] },
  { canonicalId: 'chest_fly_machine', aliases: ['разводка в тренажере', 'fly machine'] },
  { canonicalId: 'smith_machine_squat', aliases: ['присед в смите', 'smith squat', 'присед в тренажере смита'] },
  { canonicalId: 'smith_machine_bench', aliases: ['жим в смите', 'smith bench', 'жим в тренажере смита'] },
  { canonicalId: 'preacher_machine', aliases: ['молитва в тренажере', 'preacher machine'] },
  { canonicalId: 'lat_pulldown_close', aliases: ['тяга верхнего блока узким', 'close grip pulldown', 'узкий хват верх'] },
  { canonicalId: 'lat_pulldown_wide', aliases: ['тяга верхнего блока широким', 'wide grip pulldown', 'широкий хват верх'] },
  { canonicalId: 'cable_pullover', aliases: ['пулlover кабель', 'cable pullover', 'кроссовер'] },
  { canonicalId: 'dumbbell_pullover', aliases: ['пулlover гантелей', 'db pullover', 'гантель pullover'] },
  { canonicalId: 'barbell_pullover', aliases: ['пулlover штангой', 'barbell pullover'] },
];

// Построение обратного индекса (alias → canonicalId) для O(1) поиска
const _aliasToId = new Map<string, string>();
for (const entry of ALIASES) {
  _aliasToId.set(entry.canonicalId.toLowerCase(), entry.canonicalId);
  for (const alias of entry.aliases) {
    _aliasToId.set(alias.toLowerCase(), entry.canonicalId);
  }
}

/**
 * Разрешить пользовательский ввод в canonical exercise ID.
 * Возвращает canonicalId если найдено, или null.
 */
export function resolveExerciseAlias(input: string): string | null {
  const key = input.toLowerCase().trim();
  return _aliasToId.get(key) ?? null;
}

/**
 * Получить все алиасы для упражнения по его canonical ID.
 */
export function getAliasesForExercise(canonicalId: string): string[] {
  const entry = ALIASES.find(e => e.canonicalId === canonicalId);
  return entry ? [...entry.aliases] : [];
}

/**
 * Улучшенный fuzzy match: сначала точное имя, потом ядро (без штанги/гантелей/тренажера),
 * потом алиасы. Возвращает score 0-1 или null.
 */
export function exerciseMatchScore(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1.0;

  // Resolve aliases
  const idA = resolveExerciseAlias(na);
  const idB = resolveExerciseAlias(nb);
  if (idA && idB && idA === idB) return 0.95;

  // Substring match
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = na.length < nb.length ? na : nb;
    const longer = na.length < nb.length ? nb : na;
    if (shorter.length >= 3) return 0.8 + (shorter.length / longer.length) * 0.15;
  }

  // Core match (strip equipment/grip descriptors)
  const core = (s: string) => s.replace(/штанг[иеы]?|гантел[иеы]?|в тренажере|в тренажёре|на блоке|кабель|смит|плоск|наклон|гриф/gi, '').replace(/\s+/g, ' ').trim();
  const ca = core(na), cb = core(nb);
  if (ca.length >= 3 && cb.length >= 3 && (ca.includes(cb) || cb.includes(ca))) {
    return 0.7;
  }

  // Token overlap
  const tokensA = na.split(/\s+/).filter(t => t.length > 2);
  const tokensB = nb.split(/\s+/).filter(t => t.length > 2);
  const overlap = tokensA.filter(t => tokensB.includes(t)).length;
  if (overlap >= 2) return 0.5 + overlap * 0.05;
  if (overlap === 1 && tokensA.length <= 3 && tokensB.length <= 3) return 0.5;

  return 0;
}

/**
 * Найти лучшее совпадение из каталога по строке пользователя.
 */
export function findBestCatalogMatch(userInput: string, catalog: { id: string; name: string }[]): { id: string; name: string; score: number } | null {
  let best: { id: string; name: string; score: number } | null = null;
  for (const ex of catalog) {
    const score = exerciseMatchScore(userInput, ex.name) || exerciseMatchScore(userInput, ex.id);
    if (score > 0 && (!best || score > best.score)) {
      best = { id: ex.id, name: ex.name, score };
    }
  }
  return best;
}
