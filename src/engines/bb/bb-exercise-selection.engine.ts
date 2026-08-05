/**
 * bb-exercise-selection.engine.ts — извлечённая логика выбора упражнений для мышц.
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
    { name: 'horizontal_press', match: (e) => /жим.*(лёжа|лежа|гориз)|bench.*(press|жим)|жим штанги|жим в смите лёжа/i.test(e.name) && !/наклон|incline|decline|сниз|отриц|узк/i.test(e.name) },
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
    }
  }
  // Добрать до exerciseCount если не хватило
  for (const e of pool) {
    if (diverse.length >= exerciseCount) break;
    if (!diverse.some(d => (d as any).id === (e as any).id) && !usedIdsLocal.has((e as any).id)) {
      diverse.push(e);
      usedIdsLocal.add((e as any).id);
    }
  }
  return diverse.slice(0, exerciseCount);
}
