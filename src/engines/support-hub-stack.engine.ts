/**
 * support-hub-stack.engine.ts — P4: синергия PRO.
 * Дедуп деплеций + overlap ингредиентов + Stack Score 0–100.
 * Чистые функции, без UI. Калькулятор поддержки не тронут.
 */

export interface Depletion { depleter: string; depleted: string; mechanism: string; severity: string; recommendation: string }

/** Дедуп точных дублей (в проде были CURCUMIN→IRON и OMEGA3→VITAMIN_E по 2 раза). */
export function dedupeDepletions(list: Depletion[]): Depletion[] {
  const seen = new Set<string>();
  const out: Depletion[] = [];
  for (const d of list) {
    const k = `${d.depleter}→${d.depleted}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

const NUTRIENT_KEYWORDS: Record<string, string[]> = {
  zinc: ['цинк', 'zinc', 'zn'],
  magnesium: ['магний', 'magnesium', 'mg'],
  calcium: ['кальций', 'calcium', 'ca'],
  iron: ['железо', 'iron', 'fe', 'феррум'],
  copper: ['медь', 'copper', 'cu'],
  selenium: ['селен', 'selenium', 'se'],
  iodine: ['йод', 'иод', 'iodine'],
  vitamin_d: ['витамин d', 'вит.d', 'vitamin d', 'd3', 'холекальциферол'],
  vitamin_c: ['витамин c', 'вит.c', 'vitamin c', 'аскорб'],
  vitamin_b12: ['b12', 'b-12', 'кобаламин', 'cobalamin'],
  vitamin_k2: ['k2', 'мк-7', 'mk-7', 'менахинон'],
  omega3: ['омега', 'omega', 'epa', 'dha'],
  creatine: ['креатин', 'creatine'],
  caffeine: ['кофеин', 'caffeine'],
};

export interface StackOverlap { nutrient: string; sources: string[]; note: string }

/** Один нутриент в нескольких банках → кандидат на суммирование vs UL. */
export function stackOverlap(ids: string[], nameOf: (id: string) => string): StackOverlap[] {
  const out: StackOverlap[] = [];
  for (const [nutrient, kws] of Object.entries(NUTRIENT_KEYWORDS)) {
    const sources = ids.filter(id => {
      const n = nameOf(id).toLowerCase();
      return kws.some(k => n.includes(k));
    });
    if (sources.length >= 2) {
      out.push({
        nutrient,
        sources,
        note: `${nutrient}: найден в ${sources.length} позициях (${sources.map(nameOf).join(' + ')}). Суммируйте суточную дозу и сверьте с UL — дубли чаще всего прячутся в мультивитаминах.`,
      });
    }
  }
  return out;
}

export interface StackScoreInput {
  total: number;
  conflictCount: number;
  severeCount: number;
  synergyCount: number;
  depletionCount: number;
  overlapCount: number;
  evidenceA: number;
  evidenceD: number;
}

export interface StackScore { score: number; grade: string; breakdown: string[] }

/**
 * Stack Score 0–100 (информационный, не медицинский вердикт):
 * старт 100, штрафы за конфликты/тяжесть/деплеции/дубли/D-грейды, бонусы за синергии/A-грейды.
 */
export function stackScore(i: StackScoreInput): StackScore {
  let s = 100;
  const breakdown: string[] = [];
  if (i.total > 12) { s -= Math.min(15, (i.total - 12) * 2); breakdown.push(`Нагрузка: ${i.total} позиций (−${Math.min(15, (i.total - 12) * 2)})`); }
  if (i.severeCount > 0) { s -= i.severeCount * 12; breakdown.push(`Тяжёлые конфликты: ${i.severeCount} (−${i.severeCount * 12})`); }
  if (i.conflictCount > 0) { s -= i.conflictCount * 5; breakdown.push(`Конфликты: ${i.conflictCount} (−${i.conflictCount * 5})`); }
  if (i.depletionCount > 0) { s -= i.depletionCount * 3; breakdown.push(`Истощения: ${i.depletionCount} (−${i.depletionCount * 3})`); }
  if (i.overlapCount > 0) { s -= i.overlapCount * 4; breakdown.push(`Дубли нутриента: ${i.overlapCount} (−${i.overlapCount * 4})`); }
  if (i.evidenceD > 0) { s -= i.evidenceD * 2; breakdown.push(`Грейд D: ${i.evidenceD} (−${i.evidenceD * 2})`); }
  if (i.synergyCount > 0) { const b = Math.min(8, i.synergyCount * 2); s += b; breakdown.push(`Синергии: ${i.synergyCount} (+${b})`); }
  if (i.evidenceA > 0) { const b = Math.min(6, i.evidenceA); s += b; breakdown.push(`Грейд A: ${i.evidenceA} (+${b})`); }
  s = Math.max(0, Math.min(100, Math.round(s)));
  const grade = s >= 85 ? 'Отлично' : s >= 70 ? 'Хорошо' : s >= 50 ? 'Средне' : 'Требует чистки';
  return { score: s, grade, breakdown };
}
