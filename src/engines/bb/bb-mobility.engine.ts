/**
 * bb-mobility.engine.ts — ограничения мобильности (биомеханика).
 *
 * В отличие от травм (защищают МЫШЦУ: исключение или щадящая нагрузка),
 * мобильность защищает ДВИЖЕНИЯ: упражнения с ограниченной амплитудой
 * заменяются на биомеханически безопасные альтернативы.
 *
 * Вынесено в отдельный модуль, чтобы и bb-builder (фильтр пула), и
 * bb-finalize (фильтр добавляемых упражнений) использовали единый
 * источник без циклических импортов.
 */

export const MOBILITY_PATTERNS: Record<string, RegExp> = {
  shoulder: /overhead|жим.*стоя|ohp|за.*голов|behind.?neck|upright.?row|тяга.*подбород|арнольд|arnold/i,
  hip: /atg|ass.?to.?grass|глубок.*присед|гоблет.*присед|goblet.*squat|sissy|сисси/i,
  ankle: /присед.*штанг|back.?squat|front.?squat|выпад|lunge|болгар|bulgarian/i,
  lower_back: /станов.*классик|conventional.*deadlift|тяга.*наклон|barbell.?row|good.?morning|гудморнинг|румынск.*штанг|rdl.*barbell/i,
  wrist: /штанг.*бицепс|бицепс.*штанг|barbell.?curl|ez.?bar|ez.?гриф|француз.*(штанг|гриф)|french.?press.*barbell|skullcrusher.*barbell/i,
};

export function isMobilityRestricted(ex: any, restrictions?: string[]): boolean {
  if (!restrictions || restrictions.length === 0) return false;
  const n = (ex.name || '').toLowerCase();
  for (const r of restrictions) {
    const pattern = MOBILITY_PATTERNS[r];
    if (pattern && pattern.test(n)) return true;
  }
  return false;
}
