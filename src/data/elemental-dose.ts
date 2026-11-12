/**
 * elemental-dose.ts — пересчёт «масса соли на этикетке → элементарное вещество».
 *
 * Зачем отдельный модуль: и UL-контур (`biostack-safety.engine`), и карточка
 * вещества в калькуляторе должны отвечать на один вопрос — сколько МИНЕРАЛА
 * реально в таблетке. Пока пересчёт жил внутри движка, UI не мог показать
 * элементарную величину, и «Магний цитрат 400 мг» читался как «400 мг магния»
 * (в 6 раз выше факта), а UL сравнивался то с солью, то с элементом.
 *
 * Конвенция (решение продукта, ноябрь 2026):
 *  - каталог (`dosage.mg`) хранит то, что напечатано на этикетке: для минералов
 *    это МАССА СОЕДИНЕНИЯ (цитрат/глицинат/оксид), для микронутриентов — уже мг
 *    вещества (селен 0.2 мг = 200 мкг, D3 0.05 мг = 2000 МЕ);
 *  - UL и рекомендации считаются в ЭЛЕМЕНТАРНОМ веществе;
 *  - коэффициент берётся из формы соединения, при неизвестной форме — из
 *    консервативного дефолта (лучше занизить ожидаемый элемент, чем выдать
 *    ложное «превышение UL»).
 */

/** Доля элементарного минерала в массе соли по ключевому слову формы. */
const MINERAL_FORM_FRACTION: Record<string, Record<string, number>> = {
  magnesium: {
    'оксид': 0.603, 'треонат': 0.072, 'цитрат': 0.16, 'глицинат': 0.139,
    'бисглицинат': 0.139, 'лизинат': 0.106, 'малат': 0.155, 'таурат': 0.087,
    'хлорид': 0.12, 'лактат': 0.12,
  },
  zinc: {
    'пиколинат': 0.20, 'глюконат': 0.143, 'карнозин': 0.22, 'цитрат': 0.345,
    'оксид': 0.80, 'сульфат': 0.23, 'бисглицинат': 0.16, 'хелат': 0.16,
  },
  iron: {
    'бисглицинат': 0.16, 'сульфат': 0.20, 'фумарат': 0.329, 'глюконат': 0.12, 'цитрат': 0.18,
  },
  calcium: {
    'карбонат': 0.40, 'цитрат': 0.21, 'глюконат': 0.089, 'лактат': 0.13, 'малат': 0.13,
  },
  copper: {
    'бисглицинат': 0.154, 'глюконат': 0.143, 'цитрат': 0.38, 'сульфат': 0.254,
  },
  manganese: {
    'глицинат': 0.136, 'глюконат': 0.228, 'сульфат': 0.368, 'цитрат': 0.30,
  },
  boron: {
    'цитрат': 0.16, 'глицинат': 0.16,
  },
  potassium: {
    'цитрат': 0.28, 'хлорид': 0.52, 'глюконат': 0.14, 'оратат': 0.30,
  },
};

/** Консервативная доля, если форма не распознана. */
const MINERAL_DEFAULT_FRACTION: Record<string, number> = {
  magnesium: 0.15, zinc: 0.20, iron: 0.16, calcium: 0.30,
  copper: 0.15, manganese: 0.15, boron: 0.16, potassium: 0.30,
};

function mineralKey(id: string): string {
  const lc = String(id || '').toLowerCase();
  return lc.includes('magnesium') ? 'magnesium'
    : lc.includes('zinc') ? 'zinc'
    : lc.includes('iron') ? 'iron'
    : lc.includes('calcium') ? 'calcium'
    : lc.includes('copper') ? 'copper'
    : lc.includes('manganese') ? 'manganese'
    : lc.includes('boron') ? 'boron'
    : lc.includes('potassium') ? 'potassium'
    : '';
}

/**
 * Коэффициент «масса соли → элементарное вещество» для id каталога.
 * `undefined` — значение уже элементарное (микронутриенты, органика).
 */
export function resolveElementalFactor(id: string, cat: any): number | undefined {
  const key = mineralKey(id);
  if (!key) return undefined;
  const form = ((cat?.dosage?.form || '') + ' ' + (cat?.nameRu || '')).toLowerCase();
  const table = MINERAL_FORM_FRACTION[key];
  for (const kw of Object.keys(table)) {
    if (form.includes(kw)) return table[kw];
  }
  return MINERAL_DEFAULT_FRACTION[key];
}

/** Доза в мг ЭЛЕМЕНТАРНОГО вещества (с пересчётом массы соли, если нужно). */
export function elementalMgOf(id: string, cat: any, doseMg?: number): number {
  const raw = doseMg ?? cat?.dosage?.mg ?? 0;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const factor = resolveElementalFactor(id, cat);
  return factor !== undefined ? raw * factor : raw;
}
