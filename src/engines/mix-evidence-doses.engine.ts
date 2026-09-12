/** mix-evidence-doses.engine.ts — эталонные дозы миксов по источникам (ISSN и др.).
 *  S1–S9 из docs/MIX-HUB-PRO-PLAN.md. Только данные + чистые хелперы, стеков не мутирует. */

export type EvidenceGrade = 'A' | 'B' | 'C' | 'WADA';

export interface EvidenceDose {
  /** Канонический id вещества (как в SUBSTANCE_DB / каталоге). */
  id: string;
  /** Стандартная разовая/суточная доза, мг (для perKg — мг/кг). */
  stdMg: number;
  /** Доза задана на кг веса? */
  perKg?: boolean;
  /** Жёсткий кап разовой дозы, мг. */
  capMg?: number;
  /** Минимальная эргогенная доза, мг (ниже — underdosed). */
  minMg?: number;
  /** Только курсом, острый приём не работает (бета-аланин). */
  chronicOnly?: boolean;
  /** Грейд доказательств. */
  grade: EvidenceGrade;
  /** Короткая нота для UI. */
  note: string;
}

/** Эталоны S1–S9. Источники — в note (коротко), полный список — в PRO-плане. */
export const EVIDENCE_DOSES: Record<string, EvidenceDose> = {
  // S2 кофеин: ISSN Guest 2021 — 3–6 мг/кг, кап EFSA 400 мг/сут
  caffeine: {
    id: 'caffeine', stdMg: 3, perKg: true, capMg: 400, minMg: 100,
    grade: 'A', note: 'ISSN 2021: 3–6 мг/кг за 30–60 мин; <2 мг/кг не работает',
  },
  // S1 цитруллин: 6–8 г/сут
  citrulline: {
    id: 'citrulline', stdMg: 6000, minMg: 3000,
    grade: 'A', note: 'Цитруллин 6–8 г/сут (малат — по цитруллину)',
  },
  // S3 бета-аланин: только хроника 4–6 г/сут 2–4 нед
  beta_alanine: {
    id: 'beta_alanine', stdMg: 4800, minMg: 3200, chronicOnly: true,
    grade: 'A', note: 'ISSN 2015: только курсом 4–6 г/сут ≥2–4 нед; разово не работает',
  },
  // S4 креатин: 3–5 г/сут, загрузка 0.3 г/кг 5–7 дн
  creatine: {
    id: 'creatine', stdMg: 5000, minMg: 3000, capMg: 5000,
    grade: 'A', note: 'ISSN 2017: 3–5 г/сут; разовая 8 г pre — без смысла',
  },
  // S5 HBCD/угли интра: 30–60 г/ч, раствор 6–8%
  hbcd: {
    id: 'hbcd', stdMg: 45000, minMg: 15000, capMg: 60000,
    grade: 'B', note: 'Интра 30–60 г/ч, 6–8% раствор; больше — ЖКТ-риск',
  },
  dextrose: {
    id: 'dextrose', stdMg: 45000, minMg: 15000, capMg: 80000,
    grade: 'B', note: 'Быстрые угли интра/пост; с инсулином — только с гейтом',
  },
  // S9 глицерол: 1.0–1.2 г/кг + вода; малое — underdosed
  glycerol: {
    id: 'glycerol', stdMg: 1000, perKg: true, capMg: 90000, minMg: 20000,
    grade: 'B', note: 'Гипергидратация: 1.0–1.2 г/кг + вода за 60–90 мин; 3–5 г — недодоза',
  },
  // Аминокислоты / белок
  eaa: {
    id: 'eaa', stdMg: 10000, minMg: 6000,
    grade: 'B', note: 'EAA 8–15 г интра/пост; лейцин-триггер MPS',
  },
  protein: {
    id: 'protein', stdMg: 400, perKg: true, minMg: 15000,
    grade: 'A', note: 'Пост-белок ~0.4 г/кг (сыворотка, быстро)',
  },
  glutamine: {
    id: 'glutamine', stdMg: 5000, minMg: 3000,
    grade: 'C', note: 'ЖКТ/иммунитет; эргоген слабый',
  },
  // S6 коллаген + C
  collagen: {
    id: 'collagen', stdMg: 15000, minMg: 5000,
    grade: 'B', note: 'Shaw 2017: 15 г + вит.C за 40–60 мин до нагрузки',
  },
  vitamin_c: {
    id: 'vitamin_c', stdMg: 500, minMg: 75, capMg: 1000,
    grade: 'B', note: 'Кофактор коллагена; >1 г/сут — ЖКТ/оксалаты',
  },
  // Электролиты/осмо
  taurine: {
    id: 'taurine', stdMg: 2000, minMg: 1000, capMg: 3000,
    grade: 'C', note: 'Осморегуляция; данные слабые',
  },
  electrolyte: {
    id: 'electrolyte', stdMg: 1500, minMg: 500,
    grade: 'B', note: 'Na/K/Mg интра по поту; см. нормы приёма',
  },
  magnesium: {
    id: 'magnesium', stdMg: 400, minMg: 200, capMg: 800,
    grade: 'B', note: 'Сон/НМП: 200–400 мг (глицинат); слабит выше',
  },
  // Фокус/адаптогены — честный грейд C
  tyrosine: {
    id: 'tyrosine', stdMg: 2000, minMg: 1000, capMg: 6000,
    grade: 'C', note: 'Дофамин-прекурсор; эффект при недосыпе/стрессе',
  },
  alcar: {
    id: 'alcar', stdMg: 1500, minMg: 500, capMg: 3000,
    grade: 'C', note: 'ALCAR 1–2 г; ГЭБ-форма карнитина',
  },
  l_carnitine: {
    id: 'l_carnitine', stdMg: 2000, minMg: 1000, capMg: 3000,
    grade: 'C', note: 'Транспорт ЖК; жиросжигание слабое',
  },
  rhodiola: {
    id: 'rhodiola', stdMg: 500, minMg: 200, capMg: 1000,
    grade: 'C', note: 'Адаптоген; утомление −20–30% (малые RCT)',
  },
  cordyceps: {
    id: 'cordyceps', stdMg: 2000, minMg: 1000, capMg: 4000,
    grade: 'C', note: 'Митохондрии/VO2max — ранние данные',
  },
  ashwagandha: {
    id: 'ashwagandha', stdMg: 600, minMg: 300, capMg: 1000,
    grade: 'B', note: 'Кортизол −15–30%, сон; KSM-66',
  },
  // S7 экдистерон / тонжкат — честный грейд
  ecdysterone: {
    id: 'ecdysterone', stdMg: 500, minMg: 250, capMg: 1000,
    grade: 'WADA', note: 'WADA monitoring с 2020; данные людей ограничены',
  },
  tongkat_ali: {
    id: 'tongkat_ali', stdMg: 400, minMg: 200, capMg: 600,
    grade: 'C', note: 'Свободный тестостерон — слабые данные',
  },
  // S8 сон
  melatonin: {
    id: 'melatonin', stdMg: 3, minMg: 1, capMg: 5,
    grade: 'B', note: 'Cruz-Sanabria 2024: пик ~4 мг за ~3 ч до сна',
  },
  glycine: {
    id: 'glycine', stdMg: 3000, minMg: 1000, capMg: 5000,
    grade: 'C', note: 'Сон: 3 г за 30–60 мин',
  },
  l_theanine: {
    id: 'l_theanine', stdMg: 200, minMg: 100, capMg: 400,
    grade: 'C', note: 'Альфа-волны/релакс 100–200 мг',
  },
  // Пост-восстановление
  omega3: {
    id: 'omega3', stdMg: 2000, minMg: 1000, capMg: 3000,
    grade: 'B', note: 'EPA+DHA; >3 г — кровоточивость с антикоагулянтами',
  },
  curcumin: {
    id: 'curcumin', stdMg: 800, minMg: 500, capMg: 1500,
    grade: 'C', note: 'NF-kB; только с пиперином/липидами',
  },
  nac: {
    id: 'nac', stdMg: 1200, minMg: 600, capMg: 1800,
    grade: 'B', note: 'Глутатион-прекурсор',
  },
  zinc: {
    id: 'zinc', stdMg: 25, minMg: 10, capMg: 40,
    grade: 'B', note: 'UL 40 мг/сут (сумма со стеком!)',
  },
};

export function evidenceFor(id: string): EvidenceDose | null {
  if (!id) return null;
  const key = String(id).trim().toLowerCase();
  return EVIDENCE_DOSES[key] ?? null;
}

/** Эталонная доза в мг для веса тела (perKg × bw, иначе std). */
export function referenceMg(id: string, bwKg: number): number | null {
  const ev = evidenceFor(id);
  if (!ev) return null;
  const bw = bwKg > 0 ? bwKg : 80;
  const ref = ev.perKg ? ev.stdMg * bw : ev.stdMg;
  return ev.capMg != null ? Math.min(ref, ev.capMg) : ref;
}

/** Доза ниже минимальной эргогенной? */
export function isUnderdosed(id: string, mg: number): boolean {
  const ev = evidenceFor(id);
  if (!ev || ev.minMg == null) return false;
  return mg > 0 && mg < ev.minMg;
}

/** Кофеин по весу: 3 мг/кг, кап 400 мг (ISSN 3–6, EFSA ≤400/сут). */
export function caffeineMgFor(bwKg: number): number {
  const bw = bwKg > 0 ? bwKg : 80;
  return Math.min(400, Math.round(3 * bw));
}

/** Креатин честно: 3–5 г (не 8 г остро). */
export function creatineMgFor(): number {
  return 5000;
}

/** Глицерол честно: 1 г/кг с капом 90 г (требует воды — см. note). */
export function glycerolMgFor(bwKg: number): number {
  const bw = bwKg > 0 ? bwKg : 80;
  return Math.min(90000, Math.round(1000 * bw));
}
