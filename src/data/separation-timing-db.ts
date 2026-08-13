// ════════════════════════════════════════════════════════════════════
//  separation-timing-db.ts — разнесение приёма по времени для пар,
//  которые конфликтуют при совместном приёме (усвоение ↓, CYP3A4,
//  ЖКТ, тироксин+минералы и т.д.). Минеральные пары (Zn/Ca/Fe/Mg/Cu)
//  уже покрыты MINERAL_SEPARATION_HOURS в support-plan/types.ts.
// ════════════════════════════════════════════════════════════════════

export interface SeparationRule {
  a: string;
  b: string;
  gap: string;
  reason: string;
}

export const SEPARATION_TIMING_DB: SeparationRule[] = [
  { a: 'iron', b: 'levothyroxine', gap: '≥4 ч', reason: 'железо ↓ всасывание тироксина' },
  { a: 'calcium', b: 'levothyroxine', gap: '≥4 ч', reason: 'кальций ↓ всасывание тироксина' },
  { a: 'magnesium', b: 'levothyroxine', gap: '≥4 ч', reason: 'магний ↓ всасывание тироксина' },
  { a: 'iron', b: 'coffee', gap: '≥1 ч', reason: 'танины/кофеин ↓ всасывание железа' },
  { a: 'iron', b: 'milk', gap: '≥2 ч', reason: 'казеин ↓ всасывание железа' },
  { a: 'tadalafil', b: 'milk_thistle', gap: '≥2 ч', reason: 'силимарин ингибирует CYP3A4 → ↑ тадалафил' },
  { a: 'tadalafil', b: 'berberine', gap: '≥2 ч', reason: 'берберин ингибирует CYP3A4 → ↑ тадалафил' },
  { a: 'tadalafil', b: 'grapefruit', gap: '≥4 ч', reason: 'грейпфрут ингибирует CYP3A4 → ↑ тадалафил' },
  { a: 'anastrozole', b: 'milk_thistle', gap: '≥2 ч', reason: 'силимарин ингибирует CYP3A4 → ↑ анастрозол' },
  { a: 'anastrozole', b: 'berberine', gap: '≥2 ч', reason: 'берберин ингибирует CYP3A4 → ↑ анастрозол' },
  { a: 'aspirin', b: 'curcumin', gap: '≥2 ч', reason: 'куркумин усиливает антиагрегантный эффект → ЖКТ-риск' },
  { a: 'aspirin', b: 'omega3', gap: 'с едой', reason: 'высокие дозы вместе → аддитивный ЖКТ-риск' },
  { a: 'aspirin', b: 'ginkgo', gap: '≥2 ч', reason: 'аддитивная антиагрегация → кровотечение' },
  { a: 'aspirin', b: 'garlic', gap: '≥2 ч', reason: 'высокие дозы чеснока усиливают антиагрегацию' },
  { a: 'vitamin_c', b: 'vitamin_b12', gap: '≥1 ч', reason: 'высокие дозы C могут окислять B12 в ЖКТ' },
  { a: 'magnesium', b: 'bisphosphonates', gap: '≥2 ч', reason: 'магний ↓ всасывание бифосфонатов' },
  { a: 'calcium', b: 'bisphosphonates', gap: '≥2 ч', reason: 'кальций ↓ всасывание бифосфонатов' },
  { a: 'chromium', b: 'vitamin_c', gap: 'совместно', reason: 'витамин C улучшает усвоение хрома (позитивная пара)' },
  { a: 'zinc', b: 'iron', gap: '≥2 ч', reason: 'конкуренция за транспортёры' },
  { a: 'creatine', b: 'coffee', gap: 'нет', reason: 'кофеин не влияет на усвоение креатина (миф)' },
];

/** Найти правила разнесения для пары id (в обе стороны). */
export function findSeparationRules(planIds: string[]): SeparationRule[] {
  const ids = new Set(planIds.map(id => id.toLowerCase()));
  const out: SeparationRule[] = [];
  for (const r of SEPARATION_TIMING_DB) {
    if (ids.has(r.a.toLowerCase()) && ids.has(r.b.toLowerCase())) out.push(r);
  }
  return out;
}
