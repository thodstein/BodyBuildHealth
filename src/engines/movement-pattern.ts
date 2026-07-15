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

  if (type === 'isolation') {
    if (g === 'chest') return 'isolation_chest';
    if (g === 'shoulders' || g === 'delts' || g === 'delts_rear') return 'isolation_shoulders';
    if (g === 'back' || g === 'traps') return 'isolation_back';
    if (g === 'arms' || g === 'forearms') return 'isolation_arms';
    if (g === 'legs') return /квад|бедр|разгиб|присед|выпрям|quad/i.test(hay) ? 'isolation_legs_quad' : 'isolation_legs_ham';
    if (g === 'calves') return 'isolation_calves';
    if (g === 'core') return 'core';
    return 'core';
  }

  if (/присед|квад|разгибани|выпрям.*ног| squat/i.test(hay)) return 'squat';
  if (/шраг/.test(nm)) return 'isolation_back';
  if (/тяга|deadlift|наклон.*тяг|гиперэкстенз/.test(hay)) return 'hinge';
  if (/выпад|лунг|болгар/.test(nm)) return 'lunge';
  if (/жим.*наклон|incline|наклонн/.test(nm)) return 'incline_push';
  if (/отрицат|decline|опускан/.test(nm)) return 'decline_push';
  if (/жим|отжим|дип|dip|пресс.*груд/i.test(nm)) return 'horizontal_push';
  if (/армейск|над голов|вертик|олимп|выталк|push.*up/i.test(nm)) return 'vertical_push';
  if (/подтяг|row|блок.*тяг|тяга/i.test(hay)) return 'vertical_pull';
  if (/мах|разводк|fly|пек-дек|сведен/.test(nm)) return 'isolation_chest';
  if (/поворот|рубк|rotation/i.test(nm)) return 'rotation';

  const gMap: Record<string, string> = {
    chest: 'horizontal_push', back: 'vertical_pull', legs: 'squat', shoulders: 'vertical_push',
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
  horizontal_push: 'chest', incline_push: 'chest', dip_push: 'chest', decline_push: 'chest', vertical_push: 'chest',
  isolation_chest: 'chest',
  vertical_pull: 'back', horizontal_pull: 'back', isolation_back: 'back',
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
  // Соревновательные/ПЛ движения — не принадлежат ББ-плану
  if (/станов|рывок|толчок|пендл|подъём на грудь|взятие на грудь|армлифт|конвой|удержание штанг|олимп/.test(nm)) return null;
  // Hinge (good morning / deadlift / RDL) — ПЛ-движение, не ББ
  if (mp === 'hinge') return null;
  const base = MP_TO_MUSCLE[mp];
  if (base) return base;
  if (mp === 'isolation_arms') {
    if (/трицепс/.test(tgt)) return 'triceps';
    if (/предплеч|хват/.test(tgt)) return 'forearms';
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
