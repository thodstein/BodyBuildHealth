export interface SupportItem {
  id: string; name: string; dose: string; category: 'supplement' | 'pharma' | 'peptide';
  covers: string[]; // ID механизмов риска (system_id)
  synergy: string;
}

// База покрытия (фрагмент ТЗ §10)
const SUPPORT_DB: SupportItem[] = [
  { id: 'telmi', name: 'Телмисартан 40 мг', dose: '1×40 мг утро', category: 'pharma', covers: ['cardio_2','cardio_3','renal_1'], synergy: '+Небилет: АД/ЧСС контроль' },
  { id: 'nac', name: 'NAC 1200 мг', dose: '2×600 мг с едой', category: 'supplement', covers: ['hepatic_3','hepatic_2','cardio_5'], synergy: '+TUDCA: гепатопротекция' },
  { id: 'omega3', name: 'Омега-3 (EPA/DHA) 3 г', dose: '3 г/день', category: 'supplement', covers: ['cardio_1','cardio_4','neuro_4'], synergy: '+Телмисартан: кардиориск -45%' },
  { id: 'magnesium', name: 'Магний бисглицинат 400 мг', dose: '400 мг вечер', category: 'supplement', covers: ['neuro_2','neuro_3','cardio_7'], synergy: '+L-теанин: сон/стресс' },
  { id: 'berberine', name: 'Берберин 1000 мг', dose: '2×500 мг до еды', category: 'supplement', covers: ['endocrine_4','endo_1'], synergy: '+Ретрутид: чувствительность к инсулину' },
  { id: 'hcg', name: 'HCG 500 МЕ', dose: '2×/нед (3/1)', category: 'pharma', covers: ['repro_1','repro_2'], synergy: 'Профилактика атрофии тестикул' }
];

export function generateSupportStack(
  risks: Record<string, { raw: number; net: number }>,
  genetics: Record<string, string> = {}
): SupportItem[] {
  const stack: SupportItem[] = [];
  const threshold = 35; // raw risk порог для назначения поддержки

  // Простое правило: если raw > threshold → добавляем препарат
  if (risks['cardio']?.raw > threshold) stack.push(SUPPORT_DB[0], SUPPORT_DB[2]);
  if (risks['hepatic']?.raw > threshold) stack.push(SUPPORT_DB[1]);
  if (risks['neuro']?.raw > threshold) stack.push(SUPPORT_DB[3]);
  if (risks['endocrine']?.raw > threshold) stack.push(SUPPORT_DB[4]);
  if (risks['reproductive']?.raw > threshold) stack.push(SUPPORT_DB[5]);

  // Убираем дубликаты
  return [...new Map(stack.map(i => [i.id, i])).values()];
}

export function calcSupportCoverage(stack: SupportItem[], mechanisms: string[]): Record<string, number> {
  const coverage: Record<string, number> = {};
  mechanisms.forEach(m => coverage[m] = 0);
  
  for (const item of stack) {
    for (const mech of item.covers) {
      // Базовое покрытие ~0.4–0.6 на препарат (ТЗ §13.2)
      const baseCov = item.category === 'pharma' ? 0.55 : 0.40;
      coverage[mech] = Math.min(1, coverage[mech] + baseCov);
    }
  }
  return coverage;
}