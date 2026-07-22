/**
 * planner-categories.ts — Категории бодибилдинга и целевой %жира.
 *
 * #5 Разные категории (bikini/figure/wellness/women's physique/women's BB,
 * men's physique/classic/men's BB/212) имеют разные цели по сухости и массе.
 * Категория задаёт целевой %жира (для stage condition) и влияет на агрессивность
 * сушки и акценты (V-taper для men's physique, масса для BB, и т.д.).
 */

export type BBCategory =
  | 'none'
  | 'mens_physique' | 'classic_physique' | 'mens_bb' | 'bb_212'
  | 'bikini' | 'figure' | 'wellness' | 'womens_physique' | 'womens_bb';

export interface BBCategoryInfo {
  id: Exclude<BBCategory, 'none'>;
  label: string;
  sex: 'male' | 'female';
  /** Целевой %жира для stage condition (пиковая форма). */
  targetBodyFatPct: number;
  /** Акцент/особенности подготовки. */
  focus: string;
  note: string;
}

export const BB_CATEGORIES: BBCategoryInfo[] = [
  // ── Мужские ──
  { id: 'mens_physique', label: "Men's Physique", sex: 'male', targetBodyFatPct: 6, focus: 'V-taper, плечи/пресс, меньше акцент на ноги', note: "Men's Physique: сухость ~5-6%, V-taper (широкие плечи, узкая талия), брюки досуха. Меньше массы, больше эстетики." },
  { id: 'classic_physique', label: 'Classic Physique', sex: 'male', targetBodyFatPct: 5, focus: 'классические пропорции, позирование', note: 'Classic Physique: ~4-5%, классические пропорции (Vacuum), баланс массы и эстетики.' },
  { id: 'mens_bb', label: 'Bodybuilding (открытая)', sex: 'male', targetBodyFatPct: 4, focus: 'максимум массы, сепарация, зернистость', note: 'Bodybuilding: ~3-5%, максимум массы + зернистость/сепарация. Самая агрессивная сушка.' },
  { id: 'bb_212', label: '212 Olympia', sex: 'male', targetBodyFatPct: 4, focus: 'масса при весовом лимите 212 фунтов', note: '212: ~3-5%, максимальная масса в весовом лимите 96 кг. Баланс массы и сухости.' },
  // ── Женские ──
  { id: 'bikini', label: 'Bikini', sex: 'female', targetBodyFatPct: 11, focus: 'тонированное тело, мягкая сухость, ягодицы', note: 'Bikini: ~10-12%, мягкая сухость, тонус, акцент на ягодицы/пресс. Не пересушивать — судьи хотят «fitness model».' },
  { id: 'figure', label: 'Figure', sex: 'female', targetBodyFatPct: 9, focus: 'мышечная сепарация, V-taper верх', note: 'Figure: ~8-10%, мышечная сепарация, V-taper верх тела. Больше массы чем bikini, меньше чем physique.' },
  { id: 'wellness', label: 'Wellness', sex: 'female', targetBodyFatPct: 12, focus: 'нижняя часть тела, бёдра/ягодицы, мягкость', note: 'Wellness: ~11-13%, акцент на нижнюю часть (бёдра/ягодицы), мягкая форма. Меньше сухости верха.' },
  { id: 'womens_physique', label: "Women's Physique", sex: 'female', targetBodyFatPct: 7, focus: 'мышечность, сепарация, меньше массы чем BB', note: "Women's Physique: ~6-8%, выраженная мышечность и сепарация, но меньше массы чем wBB." },
  { id: 'womens_bb', label: "Women's Bodybuilding", sex: 'female', targetBodyFatPct: 6, focus: 'максимум массы, зернистость', note: "Women's Bodybuilding: ~5-7%, максимум массы + зернистость. Самая сухая женская категория." },
];

export function getBBCategory(id: BBCategory, sex: 'male' | 'female'): BBCategoryInfo | null {
  if (id === 'none') return null;
  const info = BB_CATEGORIES.find(c => c.id === id);
  if (!info) return null;
  if (info.sex !== sex) return null; // категория не соответствует полу
  return info;
}

/** Список категорий для селектора по полу. */
export function categoriesForSex(sex: 'male' | 'female'): BBCategoryInfo[] {
  return BB_CATEGORIES.filter(c => c.sex === sex);
}


// ── #4 Peak-week protocol (competition prep) ─────────────────────────
// daysBeforeShow: 0 = show day, 1 = day before, ..., 6 = 6 days out.
// Стандартный протокол: depletion → load → cut water/Na в день выступления.
export interface PeakWeekDay {
  carbMod: number;
  waterMod: number;   // множитель воды
  sodiumMod: number;  // множитель натрия
  note: string;
}

export function getPeakWeekDay(daysBeforeShow: number): PeakWeekDay {
  if (daysBeforeShow >= 5) return { carbMod: 0.5, waterMod: 1.3, sodiumMod: 1.0, note: `🏋 Peak-week D-${daysBeforeShow}: ИСТОЩЕНИЕ гликогена — низкие углеводы (×0.5), много воды (×1.3), натрий стабилен. Тяжёлые тренировки depletion.` };
  if (daysBeforeShow >= 3) return { carbMod: 2.0, waterMod: 1.3, sodiumMod: 1.0, note: `🏋 Peak-week D-${daysBeforeShow}: ЗАГРУЗКА гликогена — высокие углеводы (×2.0), вода высокая, натрий стабилен. Мышцы наполняются.` };
  if (daysBeforeShow === 2) return { carbMod: 1.5, waterMod: 0.8, sodiumMod: 0.8, note: `🏋 Peak-week D-2: загрузка продолжается (×1.5), вода снижается (×0.8), натрий начинает снижаться (×0.8).` };
  if (daysBeforeShow === 1) return { carbMod: 1.0, waterMod: 0.5, sodiumMod: 0.5, note: `🏋 Peak-week D-1: вода резко вниз (×0.5), наторий вниз (×0.5), углеводы умеренно. Сушка под кожей.` };
  // show day
  return { carbMod: 0.8, waterMod: 0.3, sodiumMod: 0.3, note: `🏆 SHOW DAY: минимум воды (×0.3), минимум натрия (×0.3), углеводы умеренно для пампинга. Тренировка пампинга перед выходом.` };
}
