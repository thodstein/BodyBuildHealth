/**
 * movement-pattern.ts — общие эвристики классификации упражнений.
 *
 * Вынесено из manual-plan-builder.ts, чтобы разорвать циклическую зависимость
 * между manual-plan-builder.ts ↔ exercise-substitution.engine.ts.
 * Обе стороны импортируют derivePattern / isCarryExercise отсюда.
 */

const BODYWEIGHT_TERMS = ['подтяг', 'отжим', 'скручиван', 'планк', 'турник', 'подъём ног', 'уголок', 'кошка'];

/** Упражнение с собственным весом (без внешнего отягощения). */
export function isBodyweightExercise(ex: any): boolean {
  if (ex.type === 'bodyweight') return true;
  const eq = ex.equipment;
  const eqArr = Array.isArray(eq) ? eq : (eq ? [String(eq)] : []);
  if (eqArr.includes('bodyweight')) return true;
  const nm = (ex.name || '').toLowerCase();
  return BODYWEIGHT_TERMS.some(t => nm.includes(t)) && !/(гантел|блином|весом|блок|тренаж|штанг|кросс)/.test(nm);
}

const CARRY_TERMS = ['прогулк', 'carry', 'walk', 'носил'];

/** Упражнение-переноска (фермерская прогулка и т.п.). */
export function isCarryExercise(ex: any): boolean {
  const nm = (ex.name || '').toLowerCase();
  return CARRY_TERMS.some(t => nm.includes(t));
}

/** Эвристический вывод movementPattern для записей каталога без тега
 *  (275/529 упражнений лишены movementPattern — иначе patternBalance сыплет «unknown»). */
export function derivePattern(ex: any): string {
  const g: string = ex.group || '';
  const nm: string = (ex.name || '').toLowerCase();
  const tgt: string = (ex.targetMuscle || '').toLowerCase();
  const hay = nm + ' ' + tgt;
  const type: string = ex.type;

  if (isCarryExercise(ex)) return 'carry';
  if (/паллоф|анти-?рот|антирот/.test(nm)) return 'anti_rotation';

  // HINGE: специфичные движения (deadlift, RDL, good_morning, hyperextension) — до общей "тяга",
  // иначе row_*/pulldown_* ошибочно классифицируются как hinge
  if (/станов|deadlift|румын|мёртв|гудморнинг|good.?morning|гиперэкстенз|back.?extension|разгибани.*спин/.test(hay)) return 'hinge';
  // GLUTE_BRIDGE / HIP_THRUST: до isolation-ветки (g=legs → должен быть glute_squat, не isolation_legs_ham)
  if (/ягодич|мост|thrust|hip.?thrust|glute.?bridge|ягодичн/.test(hay)) return 'glute_squat';

  if (type === 'isolation') {
    if (g === 'chest') return 'isolation_chest';
    if (g === 'shoulders' || g === 'delts' || g === 'delts_rear') return 'isolation_shoulders';
    if (g === 'back' || g === 'traps') return 'isolation_back';
    if (g === 'arms' || g === 'forearms') return 'isolation_arms';
    if (g === 'legs') {
      if (/икронож|икры|calf|камбалов/.test(hay)) return 'isolation_calves';
      if (/квад|quad|разгиб|присед|выпрям.*ног| squat/.test(hay)) return 'isolation_legs_quad';
      if (/бедр|сгибани|ham/.test(hay)) return 'isolation_legs_ham';
      return /квад|quad/.test(tgt) ? 'isolation_legs_quad' : 'isolation_legs_ham';
    }
    if (g === 'quads') return 'isolation_legs_quad';
    if (g === 'hamstrings') return 'isolation_legs_ham';
    if (g === 'glutes') return 'glute_squat';
    if (g === 'calves') return 'isolation_calves';
    if (g === 'core') return 'core';
    return 'core';
  }

  if (/присед|квад|разгибани|выпрям.*ног| squat/i.test(hay)) return 'squat';
  if (/шраг/.test(nm)) return 'isolation_back';
  // Горизонтальные тяги (штанга в наклоне, т-гриф, гантель в наклоне, горизонтальный блок) — ДО общего regex "тяга"
  if (/ тяга .*наклон|тяга .*т-?гриф|тяга .*гантел|тяга .*штанги| тяга .*блок .*горизонт| тяга горизонтальн|seated.?row| тяга блока/.test(hay) || /^row[ _]/.test(nm)) return 'horizontal_pull';
  // Вертикальные тяги (верхний блок, подтягивания, пулдаун)
  if (/тяга .*верхн|пулдаун|pulldown|подтяг|chin.?up|chinup|pullup/.test(hay)) return 'vertical_pull';
  // Пуловер (не тяга, не вертикальная, не горизонтальная)
  if (/пуловер|pullover|пулов/.test(hay)) return 'isolation_back';
  if (/выпад|лунг|болгар/.test(nm)) return 'lunge';
  if (/жим.*наклон|incline|наклонн/.test(nm)) return 'incline_push';
  if (/отрицат|decline|опускан/.test(nm)) return 'decline_push';
  if (/жим|пресс.*груд| bench/i.test(nm)) return 'horizontal_push';
  if (/армейск|над голов|вертик|выталк|push.?up/.test(nm)) return 'vertical_push';
  if (/мах|разводк|fly|пек-дек|сведен/.test(nm)) return 'isolation_chest';
  if (/поворот|рубк|rotation/i.test(nm)) return 'rotation';

  const gMap: Record<string, string> = {
    chest: 'horizontal_push', back: 'horizontal_pull', legs: 'squat', shoulders: 'vertical_push',
    arms: 'isolation_arms', core: 'core', traps: 'isolation_back', calves: 'isolation_calves',
    delts: 'vertical_push', delts_rear: 'isolation_shoulders', forearms: 'isolation_arms',
    glutes: 'glute_squat', quads: 'isolation_legs_quad', hamstrings: 'isolation_legs_ham',
  };
  return gMap[g] || 'unknown';
}

/**
 * Каноническая мышца упражнения (по movementPattern + targetMuscle).
 * Возвращает null для упражнений, которые НЕ принадлежат телу-строительному
 * плану (переноски, становая/рывок/толчок/олимпийские, good morning/hinge).
 * Это устраняет корень бага: bb-builder брал пул из КОМПОЗИТНЫХ групп
 * (arms/legs) и метил упражнение ролью плана → leg curls считались «calves»,
 * farmer's walk — «biceps», good morning — «quads».
 */
const MP_TO_MUSCLE: Record<string, string | null> = {
  horizontal_push: 'chest', incline_push: 'chest', dip_push: 'chest', decline_push: 'chest', vertical_push: 'shoulders',
  isolation_chest: 'chest',
  vertical_pull: 'back', horizontal_pull: 'back',
  // isolation_back — НЕ здесь; обрабатывается ниже (traps vs back по targetMuscle)
  isolation_shoulders: 'shoulders',
  squat: 'quads', lunge: 'quads', isolation_legs_quad: 'quads',
  isolation_legs_ham: 'hamstrings',
  glute_squat: 'glutes',
  isolation_calves: 'calves',
  core: 'abs', anti_rotation: 'abs', rotation: 'abs',
  carry: null, hinge: null,
};

export function trueMuscleOf(ex: any): string | null {
  const mp = ex?.movementPattern || derivePattern(ex);
  const tgt: string = (ex?.targetMuscle || '').toLowerCase();
  const nm: string = (ex?.name || '').toLowerCase();
  // Переноски (фермерская/официанта) — не мышечная группа ББ
  if (isCarryExercise(ex)) return null;
  // Соревновательные/ПЛ/олимпийские движения — не принадлежат ББ-плану
  // Включая: становая, рывок, толчок, пендл, взятие на грудь, швунг (жимовой/толчковый),
  // armlift, конвой, удержание штанги, олимпийские подъёмы.
  // ИСКЛЮЧЕНИЕ: «румынская становая тяга» (= deadlift_romanian) — RDL-вариант с
  // альтернативным названием. Имена с маркером «румын» уходят в ББ-ветку (хамстринги).
  const isRdlAlias = /румын/i.test(nm);
  if (!isRdlAlias && /станов|рывок|толчок|пендл|подъём на грудь|взятие на грудь|армлифт|конвой|удержание штанг|олимп|швунг|push.?press|push.?jerk|clean.?pull|muscle.?snatch|power.?clean|power.?snatch|hang.?clean/.test(nm)) return null;
  // Hinge-движения — ДВА пути в зависимости от типа лифта:
  // 1) ПЛ/олимпийский путь: классическая/сумо становая, дефицит, ол. тяги, трап-гриф, махи гирей
  //    (силовые/соревновательные лифты). Возвращаем null → выпадают из ББ-пула.
  // 2) ББ-путь: RDL/мёртвая на прямых ногах/гудморнинг/гиперэкстензия/обратная гипер
  //    (гипертрофия задней цепи/бицепса бедра). Возвращаем 'hamstrings' → попадают в ББ-пул.
  // Раньше все hinge → null, поэтому хамстринги-дни собирали только leg_curl (изоляция)
  // и не имели тяжёлого компаунда. Теперь задняя цепь возвращается как 'hamstrings'.
  if (mp === 'hinge') {
    // Dead bug / мёртвый жук — определяется как 'hinge' из-за "мёртв" в имени
    // (anti_rotation-проверка не срабатывает раньше, потому что mp уже 'hinge').
    // Это core-упражнение → 'abs', не 'hamstrings'.
    if (/мёртв.*жук|dead.?bug/i.test(nm)) {
      return 'abs';
    }
    // (1) ПЛ/олимпийские лифты — в ББ-плане НЕТ.
    // ИСКЛЮЧЕНИЕ: «румынская становая тяга» (= deadlift_romanian) — это RDL-вариант
    // с альтернативным названием, не ПЛ-лифт, попадает в хамстринги-ветку ниже.
    // Если есть «станов» И нет «румын» — это силовая становая / сумо / дефицит / ол. → null.
    if (
      /станова|классич|сумо.?дл|дефицит|рывков|толчков|швунг|clean|snatch|трап.?гриф|landmine|лэндмайн|pendlay/.test(nm)
      && !/румын/i.test(nm)
    ) {
      return null;
    }
    // (2) ББ-поза-цепь hinges: Румынская / на прямых ногах / в Смите / одной ноге /
    //     Гудморнинг (compound) / Гиперэкстензия / обратная гипер. Канонический путь
    //     задней цепи для ББ-плана → 'hamstrings' (ведущий гипертрофийный таргет).
    if (/румын|мёртв|stiff.?leg|rdl|гудморнинг|good.?morning|гиперэкстенз|back.?extension|обратн.*гипер|reverse.?hyper/.test(nm)) {
      return 'hamstrings';
    }
    // (3) Прочие hinge (махи гирь, jerk pull, snatch pull и т.д.) — null вне ББ-плана.
    return null;
  }
  // Catalog mis-tags overhead presses as movementPattern 'horizontal_push'; force shoulders-group presses to shoulders.
  const _g = (ex?.group || '').toLowerCase();
  if (_g === 'shoulders' && /жим|press|армей|overhead|ohp|жимовой швунг/i.test(nm) && !/мах|raise|fly|развод|отведен/i.test(nm)) return 'shoulders';
  // Close-grip bench is a triceps compound, not chest.
  if (/жим.*узк|close.?grip/i.test(nm) || (/узким хватом/.test(nm) && /жим|press|bench/i.test(nm))) return 'triceps';
  const base = MP_TO_MUSCLE[mp];
  if (base) return base;
  // isolation_back: шраги → traps, остальное → back
  if (mp === 'isolation_back') {
    if (/трапеци/.test(tgt)) return 'traps';
    return 'back';
  }
  if (mp === 'isolation_arms') {
    if (/трицепс/.test(tgt)) return 'triceps';
    if (/предплеч|хват|запяст|wrist/.test(tgt)) return 'forearms';
    return 'biceps'; // сгибания на бицепс по умолчанию
  }
  if (mp === 'isolation_back') {
    if (/трапеци/.test(tgt)) return 'traps';
    return 'back';
  }
  return null;
}

/** Множество канонических мышц для роли плана (композиты раскрываются). */
export function musclesForRole(repKey: string): string[] {
  const m = (repKey || '').toLowerCase();
  const map: Record<string, string[]> = {
    chest: ['chest'], back: ['back'], traps: ['traps'],
    shoulders: ['shoulders'], delt_front: ['shoulders'], delt_mid: ['shoulders'], delt_rear: ['shoulders'],
    quads: ['quads'], hamstrings: ['hamstrings'], glutes: ['glutes'], calves: ['calves'], legs: ['quads', 'hamstrings', 'glutes', 'calves'],
    abs: ['abs'], forearms: ['forearms'],
    biceps: ['biceps'], triceps: ['triceps'], arms: ['biceps', 'triceps'],
  };
  return map[m] || [m];
}
