/**
 * bb-day-types.ts — типизация дней бодибилдинг-цикла (Этап BB4).
 *
 * Три уровня:
 *  1. Тип дня по характеру: тяж / памп / лёг (механическое натяжение / метаболический стресс / разгрузка).
 *  2. Первичная / добивочная мышца дня с ротацией пар (квадр↔бицепс бедра, грудь↔плечи, ...):
 *     первичная = тяж (полный объём MAV-тяж), добивка = лёг-памп (~MEV, 1-2 упр).
 *     За ротацию каждая группа получает тяж-сессию + памп-добивку = MAV за ротацию.
 *  3. Per-group forceDayType: НОГИ всегда тяж (никогда не ставятся на памп-слот).
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

/** Per-group блокировка: группа всегда только тяж (ноги), никогда чистый памп. */
export const FORCE_HEAVY_GROUPS: ReadonlySet<string> = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'forearms', 'traps']);

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
  if (FORCE_HEAVY_GROUPS.has(muscle) && requested === 'памп') return 'тяж'; // ноги всегда тяж
  return requested;
}