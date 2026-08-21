/**
 * bb-day-types.ts — типизация дней бодибилдинг-цикла (Этап BB4).
 *
 * Три уровня:
 *  1. Тип дня по характеру: тяж / памп / лёг (механическое натяжение / метаболический стресс / разгрузка).
 *  2. Первичная / добивочная мышца дня с ротацией пар (квадр↔бицепс бедра, грудь↔плечи, ...):
 *     первичная = тяж (полный объём MAV-тяж), добивка = лёг-памп (~MEV, 1-2 упр).
 *     За ротацию каждая группа получает тяж-сессию + памп-добивку = MAV за ротацию.
 *  3. Per-group forceDayType: forearms/traps всегда тяж (P0-4, audit 2026-07).
 *     Ноги теперь МОГУТ быть памп-днём (стандарт BB metabolic work для ног).
 */

export type DayCharacter = 'тяж' | 'памп' | 'лёг';

/** Слоты мышц в дне: первичная (main) и добивочные (accessory). */
export interface MuscleSlot {
  muscle: string;          // канонический EN-ключ (chest/back/quads/...)
  role: 'primary' | 'accessory';
  character: DayCharacter; // характер нагрузки для этой мышцы в этот день
  volumeSets: number;      // целевые сеты на эту мышцу в этот день
}

export interface BBDay {
  index: number;           // 1-based в ротации
  character: DayCharacter; // общий характер сессии (по раскладке)
  restDay: boolean;
  slots: MuscleSlot[];     // мышцы, тренируемые в этот день
  comment?: string;
}

/** Per-group блокировка: группа всегда только тяж (никогда чистый памп).
 *  forearms/traps — нет метаболического стимула, всегда тяж.
 *  НОГИ всегда тяжёлые (модель пользователя): главная мышца ножного дня
 *  (quads/hamstrings/glutes) не уходит в чистый памп — вторая мышца ног получает
 *  памп-нагрузку (8-10), а главная всегда тяж. */
export const FORCE_HEAVY_GROUPS: ReadonlySet<string> = new Set(['forearms', 'traps', 'quads', 'hamstrings', 'glutes']);

/** FIX-8: Единый источник sessionTag→мышцы для bb-builder + bb-selector.
 *  Ранее дублировался в двух файлах (bb-selector без LegsBiceps). */
export const TAG_MUSCLES: Record<string, string[]> = {
  Push: ['chest', 'delt_front', 'delt_mid', 'triceps'],
  Pull: ['back', 'biceps', 'delt_rear', 'traps'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  // Upper имеет две полноценные верхние сессии: спина не должна быть
  // остаточным одним упражнением между грудью и руками.
  Upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  Lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  FullBody: ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'arms'],
  Chest: ['chest', 'delt_front', 'triceps'],
  Back: ['back', 'biceps', 'delt_rear', 'traps'],
  Shoulders: ['delt_front', 'delt_mid', 'delt_rear', 'traps'],
  Arms: ['biceps', 'triceps', 'forearms'],
  ChestBack: ['chest', 'back', 'delt_front', 'delt_rear', 'traps', 'forearms'],
  ShouldersArms: ['delt_front', 'delt_mid', 'delt_rear', 'biceps', 'triceps', 'traps', 'forearms'],
  Torso: ['chest', 'back', 'shoulders', 'traps', 'abs'],
  Limbs: ['quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves', 'forearms'],
  UpperPower: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'traps'],
  LowerPower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lower_back'],
  UpperHyp: ['chest', 'back', 'delt_front', 'delt_mid', 'delt_rear', 'biceps', 'triceps'],
  LowerHyp: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  LegsBiceps: ['quads', 'hamstrings', 'calves', 'biceps'],
  /** Женский glute-фокус: только ягодицы + бицепс бедра (задняя цепь) — без quads. */
  Glutes: ['glutes', 'hamstrings'],
  GlutesHams: ['glutes', 'hamstrings', 'calves'],
};

/** Пары ротации первичная/добивочная: (A тяж + B добивка) / (B тяж + A добивка). */
export const ROTATION_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['quads', 'hamstrings'],
  ['chest', 'delt_front'],
  ['back', 'delt_rear'],
  ['shoulders', 'delt_mid'],
  ['biceps', 'triceps'],
  ['delt_front', 'delt_mid'],
  ['delt_rear', 'traps'],
  // PRO-расширение: дополнительные пары для специализированных сплитов
  ['chest', 'triceps'],           // грудь+трицепс (жимовые дни)
  ['back', 'biceps'],             // спина+бицепс (тяговые дни)
  ['quads', 'calves'],            // квадрицепс+икры (передняя поверхность)
  ['hamstrings', 'glutes'],       // бицепс бедра+ягодицы (задняя цепь)
  ['delt_mid', 'traps'],          // средняя дельта+трапеции (ширина плеч)
  ['abs', 'lower_back'],          // пресс+поясница (кор)
  ['forearms', 'biceps'],         // предплечья+бицепс (хват+сгибание)
];

/** Получить пару для мышцы (если есть). */
export function getPair(muscle: string): [string, string] | null {
  for (const [a, b] of ROTATION_PAIRS) {
    if (muscle === a) return [a, b];
    if (muscle === b) return [b, a];
  }
  return null;
}

/** Разрешённый характер для мышцы с учётом forceDayType. */
export function resolveCharacter(muscle: string, requested: DayCharacter): DayCharacter {
  if (FORCE_HEAVY_GROUPS.has(muscle) && requested === 'памп') return 'тяж'; // forearms/traps всегда тяж
  return requested;
}
