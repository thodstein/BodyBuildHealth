/**
 * bb-labels.ts — русские подписи для ББ-авто (дни/сессии/мышцы).
 * Единый слой локализации, применяемый во всех рендерах плана (UI/PDF/CSV).
 */
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';

/** sessionTag (EN) → русская подпись дня. */
export const SESSION_TAG_RU: Record<string, string> = {
  Push: 'Грудь/Плечи/Трицепс',
  Pull: 'Спина/Бицепс',
  Legs: 'Ноги',
  Upper: 'Верх',
  Lower: 'Низ',
  FullBody: 'Всё тело',
  Chest: 'Грудь',
  Back: 'Спина',
  Shoulders: 'Плечи',
  Arms: 'Руки',
  ChestBack: 'Грудь/Спина',
  ShouldersArms: 'Плечи/Руки',
  Torso: 'Торс',
  Limbs: 'Конечности',
  UpperPower: 'Верх (сила)',
  LowerPower: 'Низ (сила)',
  UpperHyp: 'Верх (гипертрофия)',
  LowerHyp: 'Низ (гипертрофия)',
  LegsBiceps: 'Ноги/Бицепс',
  Glutes: 'Ягодицы',
  GlutesHams: 'Ягодицы/Бицепс бедра',
};

/** Подпись дня: sessionTag → RU (fallback на исходный тег). */
export function sessionTagLabel(tag?: string): string {
  if (!tag) return '';
  return SESSION_TAG_RU[tag] || tag;
}

/** Подпись мышцы: canonical EN-ключ → RU. */
export function muscleLabel(muscle?: string): string {
  if (!muscle) return '';
  return MUSCLE_LABEL_RU[muscle] || muscle;
}

/** Подпись мышцы для план-таблиц (мускулы могут приходить в композитной группе). */
export function muscleLabelOrName(muscle: string): string {
  return MUSCLE_LABEL_RU[muscle] || muscle;
}

export { MUSCLE_LABEL_RU };

interface TargetableExercise {
  muscle?: string;
  name?: string;
  movementPattern?: string;
  backSubgroup?: string;
  armSubgroup?: string;
}

/**
 * Явное пояснение «хват + куда тянуть + цель» для упражнения (не общий принцип).
 * Тяга на растяжение / на широчайшую / на толщину / заднюю дельту / трапеции.
 */
export function targetLabelFor(ex: TargetableExercise): string {
  const n = (ex.name || '').toLowerCase();
  const m = ex.muscle || '';
  const sub = ex.backSubgroup || '';
  const pattern = ex.movementPattern || '';

  // СПИНА
  if (m === 'back') {
    if (sub === 'back_width' || /vertical|подтяг|пуллдаун|верхн.*блок|lat.?pull/i.test(pattern + ' ' + n)) {
      if (/широк|wide/i.test(n)) return 'На широчайшие: широкий хват, тянуть локтями вниз к груди, свести лопатки';
      if (/обратн|underhand|нижн.*хват/i.test(n)) return 'На широчайшие (низ): обратный хват, тянуть грудью к перекладине';
      if (/нейтр|hammer|параллел/i.test(n)) return 'На широчайшие: нейтральный хват, тянуть локтями вниз';
      return 'На широчайшие: тянуть локтями вниз к груди, свести лопатки';
    }
    if (sub === 'back_thickness' || /тяга|row|пендл|т-?гриф/i.test(n)) {
      if (/одной рук|одноруч/i.test(n)) return 'На толщину (односторонне): тянуть к поясу, свести лопатку, разворот вверху';
      return 'На толщину: локти в стороны, свести лопатки, тянуть к животу';
    }
    if (/пуловер|прям.*рук|straight.?pull/i.test(n)) return 'Растяжение широчайших: руки прямые, тянуть вниз к бёдрам, не сгибать локти';
    if (/шраг|shrug/i.test(n)) return 'Трапеции: подъём вверх без вращения плеч';
    if (/тяга.*лиц|face.?pull|задн.*дельт/i.test(n)) return 'Задняя дельта/здоровье плеч: тянуть к лицу, разворот кистей наружу';
    if (/тяга.*верт|пуллдаун|вертикальн/i.test(n)) return 'На широчайшие (вертикальная тяга): хват на ширине/шире плеч, локти вниз';
  }

  // РУКИ
  if (m === 'biceps') {
    if (/наклон|incline|растяж/i.test(n)) return 'Бицепс (длинная головка): наклонная скамья, растяжение внизу, супинация вверху';
    if (/скотт|propov|концентр|паучий|spider/i.test(n)) return 'Бицепс (короткая/пик): без читинга, полное растяжение/пиковое сокращение';
    if (/молот|hammer/i.test(n)) return 'Брахиалис: нейтральный хват (молот), без супинации';
    if (/блок|cable/i.test(n)) return 'Бицепс: постоянное натяжение, не отдыхать внизу';
    return 'Бицепс: хват на ширине плеч, супинация вверху, медленное опускание 2-3 сек';
  }
  if (m === 'triceps') {
    if (/француз|overhead|из-за голов/i.test(n)) return 'Трицепс (длинная головка): локти фиксированы, опускание за голову = растяжение';
    if (/блок|pushdown|разгибан.*блок/i.test(n)) return 'Трицепс (латеральная/медиальная): локти прижаты, полное разгибание + задержка 1с';
    if (/жим.*узк|close.?grip/i.test(n)) return 'Трицепс: узкий хват, локти вдоль тела, гриф к низу груди';
    if (/брус|dip/i.test(n)) return 'Трицепс: локти назад, без раскачки';
  }

  // ГРУДЬ
  if (m === 'chest') {
    if (/наклон|incline/i.test(n)) return 'Верх груди: угол 30°, сведение лопаток, гриф к верхней части груди';
    if (/развод|fly|cable.*свед|кроссовер|пек-дек/i.test(n)) return 'Растяжение/пик груди: локти чуть согнуты, сведение как обнять дерево';
    if (/брус.*груд|dips/i.test(n)) return 'Низ груди: наклон корпуса вперёд 30-40°, локти в стороны';
    return 'Грудь: лопатки сведены, грудь «колесом», опускание на уровень сосков';
  }

  // КВАДРИЦЕПСЫ
  if (m === 'quads') {
    if (/присед|squat|жим.*ног|hack/i.test(n)) return 'Квадрицепсы: стопы на ширине плеч, глубоко (бёдра ниже параллели), колени по линии носков';
    if (/разгибан.*ног|leg.?extension/i.test(n)) return 'Квадрицепсы (изоляция): полное разгибание, задержка 1-2с, медленный возврат 3с';
    if (/выпад|lunge|болгар/i.test(n)) return 'Квадрицепсы: шаг широкий, корпус вертикально, заднее колено к полу';
  }

  // БИЦЕПС БЕДРА / ЯГОДИЦЫ
  if (m === 'hamstrings') {
    if (/румын|rdl|stiff/i.test(n)) return 'Бицепс бедра/задняя цепь: таз назад, гриф по ногам, растяжение в бицепсе бедра — затем сокращение ягодицами';
    if (/сгибан.*ног|leg.?curl/i.test(n)) return 'Бицепс бедра (изоляция): полное сгибание, задержка 1-2с, таз не отрывать';
    if (/гудморнинг|good.?morning/i.test(n)) return 'Бицепс бедра/разгибатели: наклон с тазом назад, спина прямая';
  }
  if (m === 'glutes') {
    if (/мост|hip.?thrust|glute.?bridge/i.test(n)) return 'Ягодицы: таз вверх, мощное сокращение, задержка 2с наверху';
  }

  // ПЛЕЧИ
  if (m === 'shoulders' || m === 'delt_mid') {
    if (/жим|press|армей/i.test(n)) return 'Плечи (передняя+средняя): хват чуть шире плеч, гриф к ключице, таз напряжён';
    if (/мах|lateral|отведен/i.test(n)) return 'Средняя дельта: мах до уровня плеч, локти чуть согнуты, не выше плеч';
  }

  return '';
}

/** Собрать пояснение упражнения: targetLabel + паттерн (для comment/export). */
export function exerciseTargetNote(ex: TargetableExercise): string {
  const t = targetLabelFor(ex);
  if (t) return `🎯 ${t}`;
  return '';
}
