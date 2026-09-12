/** mix-safety-gates.engine.ts — гейты безопасности миксов (эпик C).
 *  Чистые функции: стек + контекст → список гейтов block/warn/info. */

export type GateLevel = 'block' | 'warn' | 'info';

export interface MixGate {
  level: GateLevel;
  code: string;
  text: string;
}

export interface MixGateCtx {
  caffeineMg: number;
  bwKg: number;
  hasInsulin: boolean;
  hasHypertension?: boolean;
  isPregnant?: boolean;
  isTeen?: boolean;
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  caffeineSensitive?: boolean;
  zincMgTotal?: number;
  vitaminCMgTotal?: number;
  omega3MgTotal?: number;
  takesAnticoagulant?: boolean;
  melatoninMg?: number;
  ageYears?: number;
}

export function mixSafetyGates(
  stack: { id: string; mg: number }[],
  ctx: MixGateCtx,
): MixGate[] {
  const gates: MixGate[] = [];
  const ids = new Set(stack.map(s => String(s.id || '').toLowerCase()));
  const bw = ctx.bwKg > 0 ? ctx.bwKg : 80;

  // Кофеин: кап + группы риска
  if (ctx.caffeineMg > 0) {
    const cap = 400;
    if (ctx.caffeineMg > cap) {
      gates.push({ level: 'block', code: 'caffeine_over_cap', text: `⛔ Кофеин ${ctx.caffeineMg} мг > кап 400 мг/сут (EFSA). Снизьте до ${Math.min(cap, Math.round(3 * bw))} мг.` });
    } else if (ctx.caffeineMg > 6 * bw) {
      gates.push({ level: 'warn', code: 'caffeine_over_6mgkg', text: `⚠️ Кофеин выше 6 мг/кг — побочки без прироста (ISSN). Для ${bw} кг — не выше ${Math.round(6 * bw)} мг.` });
    }
    if (ctx.hasHypertension) {
      gates.push({ level: 'warn', code: 'caffeine_htn', text: '⚠️ При гипертонии кофеин даёт прессорный эффект (Lovallo: +3…+14 мм рт.ст.). Обсудите с врачом, рассмотрите безстимовый стек.' });
    }
    if (ctx.isPregnant) {
      gates.push({ level: 'block', code: 'caffeine_pregnancy', text: '⛔ Беременность: стимуляторы и предтрены — только с врачом. Этот стек заблокирован.' });
    }
    if (ctx.timeOfDay === 'evening') {
      gates.push({ level: 'warn', code: 'caffeine_evening', text: '⚠️ Вечер + кофеин = сломанный сон. Перенесите тренировку или уберите стимы за 8 ч до сна.' });
    }
    if (ctx.isTeen) {
      gates.push({ level: 'warn', code: 'caffeine_teen', text: '⚠️ Подросткам — без высоких доз стимуляторов. Кофеин минимум или ноль.' });
    }
    if (ctx.caffeineSensitive) {
      gates.push({ level: 'info', code: 'caffeine_sensitive', text: 'ℹ️ Чувствительность к кофеину: начните с 1–1.5 мг/кг и оцените сон/тревогу.' });
    }
  }

  // Инсулин — только harm-reduction + врач
  if (ctx.hasInsulin || ids.has('insulin')) {
    gates.push({ level: 'block', code: 'insulin_doctor', text: '⛔ Инсулин вне клиники — риск тяжёлой гипогликемии. Рецепт-советы заблокированы: только врач + глюкометр + быстрые угли под рукой. Хаб не дозирует инсулин.' });
  }

  // Цинк-стек UL 40 мг
  const zinc = ctx.zincMgTotal ?? stack.filter(s => s.id.toLowerCase() === 'zinc').reduce((a, s) => a + (s.mg || 0), 0);
  if (zinc > 40) {
    gates.push({ level: 'warn', code: 'zinc_ul', text: `⚠️ Цинк ${Math.round(zinc)} мг > UL 40 мг/сут (сумма пресета + ZMA). Уберите дубль.` });
  }

  // Витамин C UL
  const vc = ctx.vitaminCMgTotal ?? stack.filter(s => s.id.toLowerCase() === 'vitamin_c').reduce((a, s) => a + (s.mg || 0), 0);
  if (vc > 1000) {
    gates.push({ level: 'warn', code: 'vitc_ul', text: `⚠️ Витамин C ${Math.round(vc)} мг > 1 г/сут — ЖКТ/оксалаты. Достаточно 75–500 мг + коллаген-протокол.` });
  }

  // Омега-3 + антикоагулянты
  const om = ctx.omega3MgTotal ?? stack.filter(s => s.id.toLowerCase() === 'omega3').reduce((a, s) => a + (s.mg || 0), 0);
  if (om >= 3000 && ctx.takesAnticoagulant) {
    gates.push({ level: 'warn', code: 'omega3_anticoag', text: '⚠️ Омега-3 ≥3 г + антикоагулянт/аспирин + куркумин/бромелайн — риск кровоточивости. Только с врачом.' });
  }

  // Мелатонин: возраст/беременность
  const mel = ctx.melatoninMg ?? stack.filter(s => s.id.toLowerCase() === 'melatonin').reduce((a, s) => a + (s.mg || 0), 0);
  if (mel > 0) {
    if ((ctx.ageYears ?? 30) < 18) {
      gates.push({ level: 'block', code: 'melatonin_teen', text: '⛔ Мелатонин подросткам — только с врачом (эндокринные эффекты).' });
    }
    if (ctx.isPregnant) {
      gates.push({ level: 'block', code: 'melatonin_pregnancy', text: '⛔ Мелатонин при беременности/лактации — только с врачом.' });
    }
    if (mel > 5) {
      gates.push({ level: 'warn', code: 'melatonin_dose', text: `⚠️ Мелатонин ${mel} мг > 5 мг — выше пика dose-response (~4 мг). Больше ≠ лучше.` });
    }
  }

  return gates;
}
