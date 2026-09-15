/**
 * planner-comfort.ts — вкус и комфорт (E5): детерминированные проверки дня.
 *
 * Возвращает адресные замечания (не режет калораж), чтобы выдача была
 * «вкусно и комфортно»: не более 2 сладких приёмов, капы комфорт-порций,
 * ≤2 повторов семейства-стейпла, съедобный вес приёма.
 * Используется движком/UI как advisory-слой поверх калибровок.
 */

const SWEET_IDS = new Set([
  'jam', 'honey', 'pryaniki', 'chocolate_dark', 'chocolate_milk', 'dates', 'raisins',
  'dried_apricots', 'syrup_maple', 'ice_cream', 'cake', 'sweet_roll', 'marmalade',
]);
const STAPLE_FAMS: Record<string, string[]> = {
  rice: ['rice_white', 'rice_brown', 'rice_basmati', 'rice_cream', 'cream_of_rice'],
  oats: ['oats', 'oats_dry', 'cereal_oat_bran', 'muesli'],
  buckwheat: ['buckwheat', 'buckwheat_dry'],
  pasta: ['pasta_durum', 'pasta_white'],
  potato: ['potato', 'sweet_potato'],
  bread: ['bread_white', 'bread_rye', 'bread_protein', 'crispbread', 'rice_cake'],
};
export const COMFORT_PORTION_CAPS: Record<string, number> = {
  honey: 40, jam: 35, pryaniki: 50, dried_apricots: 60, dates: 60, raisins: 60,
  chocolate_dark: 30, chocolate_milk: 30, olive_oil: 30, walnuts: 40, almonds: 40,
  mayonnaise: 20, cream_sauce: 30, butter: 15,
};

export interface ComfortFinding {
  kind: 'sweets' | 'comfortCap' | 'stapleRepeat' | 'solid';
  text: string;
}

export function comfortFindings(
  meals: Array<{ label?: string; items?: Array<{ id?: string; amount?: number; role?: string }> }>,
  opts: { maxSweetsPerDay?: number; maxStapleRepeats?: number; maxSolidGPerMeal?: number } = {},
): ComfortFinding[] {
  const maxSweets = opts.maxSweetsPerDay ?? 2;
  const maxStaples = opts.maxStapleRepeats ?? 2;
  const maxSolid = opts.maxSolidGPerMeal ?? 750;
  const out: ComfortFinding[] = [];
  if (!Array.isArray(meals) || meals.length === 0) return out;

  let sweets = 0;
  const famCount: Record<string, number> = {};
  for (const m of meals) {
    const items = Array.isArray(m?.items) ? m!.items! : [];
    let mealSweets = 0;
    let solidG = 0;
    for (const it of items) {
      const id = String(it?.id || '');
      if (!id) continue;
      if (it?.role !== 'liquid') solidG += Number(it?.amount) || 0;
      if (SWEET_IDS.has(id)) mealSweets++;
      const cap = COMFORT_PORTION_CAPS[id];
      if (cap && (Number(it?.amount) || 0) > cap * 1.15) {
        out.push({ kind: 'comfortCap', text: `⚖️ Комфорт: ${id} ${Math.round(Number(it?.amount) || 0)} г > комфортного ${cap} г` });
      }
      for (const [fam, ids] of Object.entries(STAPLE_FAMS)) {
        if (ids.includes(id)) famCount[fam] = (famCount[fam] || 0) + 1;
      }
    }
    if (mealSweets > 0) sweets++;
    if (solidG > maxSolid) {
      out.push({ kind: 'solid', text: `🍽 Комфорт: «${m.label || 'приём'}» ${Math.round(solidG)} г не-жидкости > ${maxSolid} г` });
    }
  }
  if (sweets > maxSweets) {
    out.push({ kind: 'sweets', text: `🍬 Комфорт: сладких приёмов ${sweets} > ${maxSweets} — уберите лишний десерт` });
  }
  for (const [fam, n] of Object.entries(famCount)) {
    if (n > maxStaples) {
      out.push({ kind: 'stapleRepeat', text: `🥣 Комфорт: семейство «${fam}» ${n} раз > ${maxStaples} — замените один приём` });
    }
  }
  return out;
}

/** Сводка комфорта для плана дня (то, что показывает UI). */
export function comfortSummaryForPlan(
  plan: { meals?: Array<{ label?: string; items?: Array<{ id?: string; amount?: number; role?: string }> }> } | null | undefined,
  opts?: { maxSweetsPerDay?: number; maxStapleRepeats?: number; maxSolidGPerMeal?: number },
): string[] {
  try {
    const meals = plan && Array.isArray(plan.meals) ? plan.meals : [];
    return comfortFindings(meals as any, opts).map(f => f.text);
  } catch {
    return [];
  }
}
