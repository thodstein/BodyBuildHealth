/**
 * arm-coc-ladder.engine.ts — CoC-прогрессия IronMind (warm/work/challenge).
 *
 * Источник: IronMind CoC FAQ + booklet (warm 1–2×10–12 легко; work 1–3×5–7
 * в отказ 3×/нед; challenge — партиалы/негативы/холды 3–5с после ~6 нед;
 * 10–12 повт → следующий уровень; 20–25 = уверенный переход; half-steps
 * .5 как мостики; extensor bands 2×10–15 каждую сессию; warm-up лесенка
 * Trainer×10 → No.1×8–10 → No.2×6).
 * GripStrength CoC 8/12: делоады W4/W8(/W12) −40%, тест после 48–72ч.
 *
 * Чистый модуль без импортов.
 */

export type CocLevel = 'guide' | 'sport' | 'trainer' | 'pointfive' | 'no1' | 'no1_5' | 'no2' | 'no2_5' | 'no3' | 'no3_5' | 'no4';

export const COC_ORDER: CocLevel[] = [
  'guide', 'sport', 'trainer', 'pointfive', 'no1', 'no1_5', 'no2', 'no2_5', 'no3', 'no3_5', 'no4',
];

export const COC_RU: Record<CocLevel, string> = {
  guide: 'Guide', sport: 'Sport', trainer: 'Trainer', pointfive: 'Point Five',
  no1: 'CoC №1 (140 lb)', no1_5: 'CoC №1.5 (167.5 lb)', no2: 'CoC №2 (195 lb)',
  no2_5: 'CoC №2.5 (237.5 lb)', no3: 'CoC №3 (280 lb)', no3_5: 'CoC №3.5 (322.5 lb)', no4: 'CoC №4 (365 lb)',
};

export const COC_LB: Record<CocLevel, number> = {
  guide: 60, sport: 80, trainer: 100, pointfive: 120, no1: 140, no1_5: 167.5,
  no2: 195, no2_5: 237.5, no3: 280, no3_5: 322.5, no4: 365,
};

function normCoc(v: unknown): CocLevel | null {
  const s = String(v || '').toLowerCase().replace(/[\s._-]/g, '');
  const map: Record<string, CocLevel> = {
    guide: 'guide', sport: 'sport', trainer: 'trainer', pointfive: 'pointfive', '05': 'pointfive',
    no1: 'no1', '1': 'no1', no15: 'no1_5', '15': 'no1_5', no2: 'no2', '2': 'no2',
    no25: 'no2_5', '25': 'no2_5', no3: 'no3', '3': 'no3', no35: 'no3_5', '35': 'no3_5', no4: 'no4', '4': 'no4',
  };
  return map[s] || null;
}

export interface CocTriple {
  warm: CocLevel[];
  work: CocLevel;
  challenge: CocLevel | null;
  note: string;
}

/**
 * Тройка под текущий рабочий уровень: warm — всё ниже лёгким объёмом,
 * work — 5–10 повт зона, challenge — на уровень выше (негативы/холды).
 */
export function planCocTriple(working: string): CocTriple {
  const w = normCoc(working) || 'trainer';
  const idx = COC_ORDER.indexOf(w);
  const warm = COC_ORDER.slice(Math.max(0, idx - 2), idx);
  const challenge = idx + 1 < COC_ORDER.length ? COC_ORDER[idx + 1] : null;
  return {
    warm,
    work: w,
    challenge,
    note: `CoC: warm ${warm.map((l) => COC_RU[l]).join(' → ') || 'мяч/резина'} 1–2×10–12 → work ${COC_RU[w]} 1–3×5–7 в отказ → challenge ${challenge ? COC_RU[challenge] + ' партиалы/негативы 3–5с' : '—'} + expanders 2×10–15.`,
  };
}

/** Готов ли к следующему уровню (IronMind: 10–12 повт → пробовать; 20–25 = переход). */
export function cocReadyToAdvance(repsOnWork: number): { tryNext: boolean; confident: boolean; note: string } {
  const r = Number(repsOnWork || 0);
  if (r >= 20) return { tryNext: true, confident: true, note: `${r} повт — уверенный переход на следующий уровень.` };
  if (r >= 10) return { tryNext: true, confident: false, note: `${r} повт — начинать challenge (партиалы/негативы следующего).` };
  return { tryNext: false, confident: false, note: `${r} повт — держать work-уровень, добирать объёмом RPE 7–8.` };
}

/** Недельный протокол CoC под фазу (accumulation/intensification/peaking/deload). */
export function cocWeekProtocol(phase: string, working: string): { sets: string; note: string } {
  const t = planCocTriple(working);
  const p = String(phase || 'accumulation').toLowerCase();
  if (p === 'deload') return { sets: 'warm 2×10 @RPE5–6', note: 'Делоад CoC: −40% объёма, без max и негативов (GripStrength W4/W8).' };
  if (p === 'peaking') return { sets: `work ${COC_RU[t.work]} speed-singles 3×5×90с + challenge singles 2–3`, note: 'Пик: rate of force development + 1 попытка цели, тест после 48–72ч отдыха.' };
  if (p === 'intensification') return { sets: `work ${COC_RU[t.work]} 5×3–5 RPE8–9 + negatives ${t.challenge ? COC_RU[t.challenge] : '—'} 4×3×6с`, note: t.note };
  return { sets: `work ${COC_RU[t.work]} 4–6×8–12 RPE6–7 + pinch/thick 3×`, note: 'База: объём + подсобка pinch/thick-bar (питает дожим последних см).' };
}
