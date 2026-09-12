/**
 * support-hub-timing.engine.ts — P5: канон тайминга (утро/вечер, разносы, связки).
 * Информация из открытых источников (NIH ODS, GoodRx 2026, VitaminDB 2026,
 * Bodybuilding Dietitians 2026): без новых чисел, только правила.
 * CATEGORY_TIMING не трогаем — это дополняющие хинты.
 */

export interface TimingCanonRule { id: string; label: string; detail: string; test: (nameRu: string, cats: string[]) => boolean }

const has = (t: string, ...kws: string[]) => kws.some(k => t.includes(k));

export const TIMING_CANON: TimingCanonRule[] = [
  { id: 'fe_morning', label: 'Железо — утро + C', detail: 'Утром (гепсидин низкий), с витамином C; врозь с Ca/молочкой и кофе/чаем ≥1–2 ч (танины −50…−70% негемового Fe).', test: (n) => has(n, 'желез', 'iron', 'феррум') },
  { id: 'ca_evening', label: 'Кальций — вечер', detail: 'Вечером с едой: пик костной резорбции ночью. Разовая доза элемента ≤500 мг; врозь с Fe/Zn ≥2 ч.', test: (n) => has(n, 'кальц', 'calcium') },
  { id: 'd3k2_fat', label: 'D3+K2 — с жиром', detail: 'Жирорастворимые A/D/E/K и омега — с приёмом пищи ≥10 г жира; D3+K2 вместе (K2 направляет Ca в кость).', test: (n) => has(n, 'витамин d', 'd3', 'холекальц', 'k2', 'мк-7', 'менахинон', 'омега', 'omega', 'coq10', 'убихин') },
  { id: 'zn_cu', label: 'Zn:Cu 10:1', detail: 'Длительный Zn >40 мг/сут вымывает Cu (металлотионеин). Держите баланс ~10:1, контроль Cu каждые 3–6 мес.', test: (n) => has(n, 'цинк', 'zinc') },
  { id: 'mgzn_split', label: 'Mg/Zn высокие — врозь', detail: 'Стандартные дозы вместе допустимы; высокие (>250 мг Mg и >40 мг Zn) разнести на несколько часов.', test: (n) => has(n, 'магн', 'magnesium', 'цинк', 'zinc') },
  { id: 'mg_evening', label: 'Магний — вечер', detail: 'Вечером: GABA-тонус, сон, АД. Цитрат/глицинат предпочтительнее оксида (NIH ODS).', test: (n) => has(n, 'магн', 'magnesium') },
  { id: 'b_morning', label: 'B — утро', detail: 'B-комплекс утром (энергетический эффект); вечером может мешать сну.', test: (n) => has(n, 'b12', 'b-12', 'b6', 'фолат', 'folat', 'b1', 'b2', 'кобаламин') },
  { id: 'tudca_night', label: 'TUDCA — ночь натощак', detail: 'Желчные кислоты: перед сном натощак (2+ ч после ужина), иначе всасывание падает.', test: (n) => has(n, 'tudca', 'тудк', 'урсодез') },
  { id: 'enzyme_empty', label: 'Ферменты — натощак', detail: 'Протеолитики (серра, натто, бромелайн): натощак за 30–40 мин; с едой переваривают пищу, не работают системно.', test: (n) => has(n, 'серра', 'натто', 'бромелайн', 'папаин', 'лумбро') },
  { id: 'adaptogen_am', label: 'Адаптогены — утро/день', detail: 'Стимулирующие адаптогены (родиола, женьшень) — утром/днём; седативные (ашваганда, валериана, мелатонин) — вечером.', test: (n) => has(n, 'родиол', 'женьшен', 'ашваганд', 'валериан', 'мелатон') },
  { id: 'creatine_any', label: 'Креатин — ежедневно', detail: 'Моногидрат 3–5 г ежедневно (главное — регулярность, не час); с углеводами/белком ретенция выше.', test: (n) => has(n, 'креатин', 'creatine') },
  { id: 'thyroid_empty', label: 'Щитовидка — натощак врозь', detail: 'L-T4 натощак за 30–60 мин; Ca/Fe/Mg/соя — через 4 ч (снижают абсорбцию на 20–40%).', test: (n) => has(n, 'левотирокс', 'тироксин', 'эутирокс') },
];

export function timingHintsFor(nameRu: string, category: string[]): TimingCanonRule[] {
  const n = (nameRu || '').toLowerCase();
  const cats = category || [];
  return TIMING_CANON.filter(r => {
    try { return r.test(n, cats); } catch { return false; }
  });
}
