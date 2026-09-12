// Mapper matrix — pairwise 4 уровня (паритет StacksnStats + пептидный чекер).
// Synergy/Safe/Monitor/Caution; симметрия A+B=B+A; худший сигнал — общий.
export type MatrixLevel = 'synergy' | 'safe' | 'monitor' | 'caution';

export interface PairResult {
  a: string;
  b: string;
  level: MatrixLevel;
  reason: string;
}

const SYNERGY_PAIRS: [RegExp, RegExp, string][] = [
  [/cjc|ghrh|tesamorelin|sermorelin/i, /ipamorelin|ghrp|hexarelin/i, 'GHRH+GHRP: разные рецепторы, синергия GH-оси'],
  [/bpc/i, /tb-?500|thymosin/i, 'BPC+TB-500: NO/ангиогенез + актин — разные пути, часто ко-исследуются'],
];

const CAUTION_PAIRS: [RegExp, RegExp, string][] = [
  [/tren/i, /.*/, 'Тренболон — доминантный усилитель нейро-пси нагрузки (K_N 1.40)'],
  [/semaglutide|tirzepatide|retatrutide/i, /semaglutide|tirzepatide|retatrutide/i, 'Два GLP-1 — нет аддитивной пользы, гастро-риск ×'],
  [/cjc-?1295/i, /tesamorelin|sermorelin/i, 'Два GHRH — конкуренция за рецептор, десенситизация'],
  [/nandrolone|deca/i, /tren/i, 'Два 19-nor — пролактин/прогестагенный стек, мониторинг PRL'],
];

const MONITOR_PAIRS: [RegExp, RegExp, string][] = [
  [/testosterone|enan|cyp/i, /.*/, 'Следи АД/гематокрит/эстрадиол'],
  [/oxan|stan|methand|anadrol|turinabol|oral/i, /.*/, 'Оралы 17-aa — АЛТ/АСТ/холестаз, срок ограничен'],
];

function matchPair(list: [RegExp, RegExp, string][], a: string, b: string): string | null {
  for (const [ra, rb, reason] of list) {
    if ((ra.test(a) && rb.test(b)) || (ra.test(b) && rb.test(a))) return reason;
  }
  return null;
}

export function pairLevel(a: string, b: string): PairResult {
  const x = String(a || '');
  const y = String(b || '');
  const s = matchPair(SYNERGY_PAIRS, x, y);
  if (s) return { a: x, b: y, level: 'synergy', reason: s };
  const c = matchPair(CAUTION_PAIRS, x, y);
  if (c) return { a: x, b: y, level: 'caution', reason: c };
  const m = matchPair(MONITOR_PAIRS, x, y);
  if (m) return { a: x, b: y, level: 'monitor', reason: m };
  return { a: x, b: y, level: 'safe', reason: 'Известных негативных связок нет — базовый мониторинг' };
}

export function stackMatrix(names: string[]): PairResult[] {
  const uniq = [...new Set((names || []).map((n) => String(n || '').trim()).filter(Boolean))];
  const out: PairResult[] = [];
  for (let i = 0; i < uniq.length; i++)
    for (let j = i + 1; j < uniq.length; j++) out.push(pairLevel(uniq[i], uniq[j]));
  return out;
}

export function worstLevel(pairs: PairResult[]): MatrixLevel | null {
  if (!pairs.length) return null;
  const rank: Record<MatrixLevel, number> = { safe: 0, synergy: 1, monitor: 2, caution: 3 };
  return pairs.slice().sort((p, q) => rank[q.level] - rank[p.level])[0].level;
}

// Саджест опечаток — Левенштейн к известным именам.
function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export function suggestClosest(input: string, known: string[], limit = 3): string[] {
  const q = String(input || '').toLowerCase();
  if (!q || !known.length) return [];
  return known
    .map((k) => {
      const kl = String(k).toLowerCase();
      if (kl === q) return { k, d: -1 };
      if (kl.includes(q) || q.includes(kl)) return { k, d: 0.5 };
      return { k, d: lev(q, kl) };
    })
    .filter((x) => x.d >= 0 && x.d <= Math.max(4, Math.floor(Math.max(q.length, 8) / 2) + 6))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.k);
}
