/**
 * food-search.engine.ts — локальный поиск по FOOD_DB для поля «Добавить еду».
 *
 * Чистая функция над массивом продуктов: без импорта баз, без сети, без DOM.
 * Даёт ранжирование «exact → prefix → все токены-префиксы → токен внутри слова →
 * синоним → опечатка» и разумный запас на бытовые слова («ветчина», «мясо», «овсянка»),
 * которых в каталоге нет как отдельных названий.
 *
 * Словарь синонимов ниже — ИМЕННО СЛОВАРЬ ПОИСКА (бытовые названия и стеммы для
 * сопоставления слов из пользовательского ввода), а не медицинские утверждения о
 * составе или свойствах продуктов.
 */

export interface SearchableFood {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
}

export type FoodMatchReason = 'exact' | 'prefix' | 'tokens' | 'synonym' | 'fuzzy';

export interface FoodMatch<T> {
  item: T;
  /** Меньше — выше в выдаче: 0 exact, 1 prefix, 2 tokens (все слова — префиксы), 3 tokens (слово внутри имени), 4 synonym, 5 fuzzy. */
  score: number;
  reason: FoodMatchReason;
}

const DEFAULT_LIMIT = 20;

/**
 * Группы взаимозаменяемых слов (раскрываются в обе стороны).
 * Стеммы (например «курин», «свин») нужны потому, что в каталоге стоят
 * прилагательные («Куриная грудка», «Свиная вырезка»), а пользователь пишет существительное.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // Овсянка: хлопья/геркулес/oat
  ['овсянка', 'овсяные', 'овсян', 'геркулес', 'oat', 'овес'],
  // Ветчина: окорок/буженина/хамон
  ['ветчина', 'ветчин', 'окорок', 'буженина', 'буженин', 'хамон'],
  // Колбаса как продукт: толькo сама колбаса (сосиски/сардельки — отдельная группа ниже)
  ['колбаса', 'колбас', 'колбасн'],
  // Сосиски/сардельки — настоящая синонимия между собой
  ['сосиски', 'сосиск', 'сардельки', 'сардельк'],
  // Конкретные виды мяса — каждый вид отдельно, чтобы «говядина» не находила курицу
  ['говядина', 'говядин', 'говяж'],
  ['свинина', 'свин', 'свиной'],
  ['курица', 'курин', 'куриц'],
  ['индейка', 'индейк'],
  ['баранина', 'баранин', 'ягненок', 'ягненк'],
  // Творог/творожный
  ['творог', 'творож', 'творожн'],
  // Хлеб/батон/булка
  ['хлеб', 'батон', 'булка', 'булк'],
  // Рис/рисовая
  ['рис', 'рисовая', 'рисов'],
  // Картофель/картошка
  ['картофель', 'картоф', 'картошка', 'картошк'],
];

/**
 * Обобщающие слова: раскрываются ТОЛЬКО от запроса к названию, не наоборот.
 * «мясо» находит все виды мяса, но «говядина» не находит курицу и свинину.
 * «сосиски» не выдаёт всю колбасу — «колбаса» и сосиски не симметричны.
 */
const GENERIC_TERMS: Record<string, readonly string[]> = {
  мясо: ['мяс', 'говядин', 'свин', 'курин', 'индейк', 'баранин', 'фарш'],
  // «клетчатка» → порошок псиллиума и отруби (src/data/fiber-foods.ts):
  // пользователь ищет тип продукта, а в названиях стоят «псиллиум»/«отруби».
  клетчатка: ['клетчатк', 'псиллиум', 'отруб', 'шелух'],
  колбаса: ['колбас', 'сосиск', 'сардельк', 'ветчин'],
  рыба: ['рыб', 'лосос', 'треск', 'минтай', 'тунец', 'скумбри', 'сельд', 'форел'],
};

const EMPTY: ReadonlySet<string> = new Set<string>();

let synonymIndex: Map<string, Set<string>> | null = null;

function buildSynonymIndex(): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    const members = group.map((word) => normalizeFoodQuery(word)).filter(Boolean);
    for (const word of members) {
      let aliases = index.get(word);
      if (!aliases) {
        aliases = new Set<string>();
        index.set(word, aliases);
      }
      for (const other of members) {
        if (other !== word) aliases.add(other);
      }
    }
  }
  return index;
}

function synonymsFor(word: string): ReadonlySet<string> {
  if (!synonymIndex) synonymIndex = buildSynonymIndex();
  return synonymIndex.get(word) ?? EMPTY;
}

/** Обобщающие стеммы для запроса («мясо» → виды мяса); обратное направление не работает. */
function genericStemsFor(word: string): readonly string[] {
  return GENERIC_TERMS[word] ?? [];
}

/** lowercase, ё→е, знаки и лишние пробелы схлопываются в одиночный пробел. */
export function normalizeFoodQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Допуск на опечатку: 3 символа и меньше — только точное/префиксное совпадение. */
function fuzzyTolerance(word: string): number {
  if (word.length <= 3) return 0;
  if (word.length <= 6) return 1;
  return 2;
}

/** Расстояние Левенштейна с ранним выходом за пределы max. */
function levenshteinWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return false;
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length] <= max;
}

function matchName(
  name: string,
  queryNorm: string,
  queryWords: readonly string[],
): { score: number; reason: FoodMatchReason } | null {
  const nameNorm = normalizeFoodQuery(name);
  if (!nameNorm) return null;
  const nameWords = nameNorm.split(' ');

  if (nameNorm === queryNorm) return { score: 0, reason: 'exact' };
  // Префикс имени на границе слова: «хлеб» → «Хлеб ржаной», но не «Хлебцы».
  if (nameNorm.startsWith(`${queryNorm} `)) return { score: 1, reason: 'prefix' };

  if (queryWords.every((q) => nameWords.some((w) => w.startsWith(q)))) {
    return { score: 2, reason: 'tokens' };
  }

  if (queryWords.every((q) => q.length >= 2 && nameWords.some((w) => w.includes(q)))) {
    return { score: 3, reason: 'tokens' };
  }

  const synonymHit = queryWords.every((q) => {
    const aliases = synonymsFor(q);
    if (aliases.size === 0) return false;
    return nameWords.some((w) => {
      for (const alias of aliases) {
        if (w === alias || w.startsWith(alias)) return true;
      }
      return false;
    });
  });
  if (synonymHit) return { score: 4, reason: 'synonym' };

  // Обобщающее слово раскрывается только от запроса к названию: «мясо» → говядина/курица,
  // но не «говядина» → курица. Score тот же 4, чтобы конкретные совпадения были выше.
  const genericHit = queryWords.every((q) => {
    const stems = genericStemsFor(q);
    if (stems.length === 0) return false;
    return nameWords.some((w) => stems.some((stem) => w === stem || w.startsWith(stem)));
  });
  if (genericHit) return { score: 4, reason: 'synonym' };

  const fuzzyHit = queryWords.every((q) => {
    const tolerance = fuzzyTolerance(q);
    if (tolerance === 0) return false;
    return nameWords.some((w) => levenshteinWithin(q, w, tolerance));
  });
  if (fuzzyHit) return { score: 5, reason: 'fuzzy' };

  return null;
}

/**
 * Поиск по локальному каталогу. Не мутирует входной массив; результат
 * детерминирован: score ↑, затем название по алфавиту, затем id.
 */
export function searchLocalFoods<T extends SearchableFood>(
  items: readonly T[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): FoodMatch<T>[] {
  const queryNorm = normalizeFoodQuery(query);
  if (queryNorm.length < 2) return [];
  const queryWords = queryNorm.split(' ');
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;

  const matches: FoodMatch<T>[] = [];
  for (const item of items) {
    if (!item || typeof item.name !== 'string') continue;
    // Бренд ищем тем же матчером, но ранжируем по названию продукта.
    const byName = matchName(item.name, queryNorm, queryWords);
    const byBrand = byName || !item.brand ? null : matchName(item.brand, queryNorm, queryWords);
    const hit = byName ?? byBrand;
    if (!hit) continue;
    matches.push({ item, score: hit.score, reason: hit.reason });
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const byName = normalizeFoodQuery(a.item.name).localeCompare(normalizeFoodQuery(b.item.name), 'ru');
    if (byName !== 0) return byName;
    return String(a.item.id ?? '').localeCompare(String(b.item.id ?? ''));
  });

  return matches.slice(0, max);
}
