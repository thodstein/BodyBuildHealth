/**
 * diary-import-guards.ts — сверка импортируемого факта с действующими значениями программы.
 *
 * Зачем этот модуль. План питания и дневник жили в разных контурах:
 * генерация рациона всегда фильтровала аллергии/исключения
 * (`IndividualPlan/planner-restrictions.ts` — единственный источник истины),
 * а импорт ФАКТА (фото через OCR, штрихкод) писался в дневник без сверки.
 * Пользователь с аллергией на орехи фотографировал смесь с арахисом — запись
 * проходила молча, отчёт молчал. Это разрыв двух контуров, а не «дневник не знает
 * про аллергии»: дневник — это факт, он не должен ничего удалять, но ОБЯЗАН
 * предупредить.
 *
 * Принцип: ПРЕДУПРЕЖДЕНИЕ, а не запрет. Дневник записывает то, что человек съел.
 * Авто-удаление реальной еды из факта — потеря данных. Мы помечаем позицию и
 * говорим человеку, что она противоречит его же настройкам.
 *
 * Ключевой случай — продукт, которого НЕТ в FOOD_DB: сканер штрихкодов отдаёт
 * `retail:<сеть>:<id>`, OCR-очередь — часто голое название. Для них тегов нет,
 * поэтому сверка идёт по названию через `allergenTextMatches` (тот же канон,
 * что и у плана). Русские бланки/упаковки читаются на кириллице — поэтому
 * нормализация id аллергена принимает И латинский id из профиля, И русское
 * название (исторические расхождения ровно такого класса уже стоили проекту
 * «всегда ✅ аллергенов нет» в отчёте).
 */

import { FOOD_DB } from '../../../../core/nutrition-database';
import { getProfile } from '../../../../core/profile-manager';
import {
  allergenTextMatches,
  getFoodAllergenTags,
  selectedAllergenTags,
} from '../IndividualPlan/planner-restrictions';

/**
 * Латинские id из `ALLERGEN_LIST` (core/contraindications) → русские канонические
 * ключи `USER_ALLERGEN_TO_TAGS` (planner-restrictions). Без этого слоя
 * `allergenTextMatches('молочные', …)` никогда не вызывался бы для профиля,
 * где аллергии лежат как 'dairy'/'lactose'.
 */
const ALLERGEN_ID_TO_RU: Record<string, string> = {
  lactose: 'лактоза',
  dairy: 'молочные',
  gluten: 'глютен',
  nuts: 'орехи',
  peanuts: 'арахис',
  eggs: 'яйца',
  soy: 'соя',
  fish: 'рыба',
  shellfish: 'морепродукты',
  sesame: 'кунжут',
  celery: 'сельдерей',
  mustard: 'горчица',
  sulfites: 'сульфиты',
  lupin: 'люпин',
};

/** Человекочитаемое название аллергена для сообщения. */
const ALLERGEN_LABEL: Record<string, string> = {
  лактоза: 'лактоза',
  молочные: 'молочные продукты',
  глютен: 'глютен',
  орехи: 'орехи',
  арахис: 'арахис',
  яйца: 'яйца',
  соя: 'соя',
  рыба: 'рыба',
  морепродукты: 'морепродукты',
  кунжут: 'кунжут',
  горчица: 'горчица',
  сельдерей: 'сельдерей',
  сульфиты: 'сульфиты',
  люпин: 'люпин',
};

/**
 * Неканонические варианты аллергена в профиле: 'молоко' vs канон 'молочные',
 * 'орех' vs 'орехи', 'молочка' vs 'молочные'. Точное и префиксное сравнение их
 * не ловят, и аллерген молча выпадал из сверки (запись проходила без
 * предупреждения). Сравниваем по ОСНОВЕ (первые STEM букв) — для всех ключей
 * ALLERGEN_LABEL основы уникальны, ложных склеек нет.
 */
const ALLERGEN_STEM = 4;
const ALLERGEN_BASE_TO_CANON: Record<string, string> = {};
for (const ru of Object.keys(ALLERGEN_LABEL)) {
  ALLERGEN_BASE_TO_CANON[ru.slice(0, ALLERGEN_STEM)] = ru;
}
for (const ru of Object.values(ALLERGEN_ID_TO_RU)) {
  ALLERGEN_BASE_TO_CANON[ru.slice(0, ALLERGEN_STEM)] = ru;
}

/** Приводит любой вариант записи аллергена к каноническому русскому ключу. */
export function normalizeAllergenId(raw: string): string {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  if (ALLERGEN_ID_TO_RU[v]) return ALLERGEN_ID_TO_RU[v];
  // 'орехи (tree_nuts)', 'молочные белки' и т.п. — префиксное совпадение.
  for (const [id, ru] of Object.entries(ALLERGEN_ID_TO_RU)) if (v.startsWith(id)) return ru;
  for (const ru of Object.keys(ALLERGEN_LABEL)) if (v.startsWith(ru)) return ru;
  const byBase = ALLERGEN_BASE_TO_CANON[v.slice(0, ALLERGEN_STEM)];
  if (byBase) return byBase;
  return v;
}

/** Действующие ограничения программы, применимые к импорту факта. */
export interface ProgramRestrictions {
  /** Русские канонические id аллергенов (без дублей). */
  allergens: string[];
  /** foodId, которые пользователь исключил в настройках рациона. */
  excludedFoodIds: string[];
  /** Категории, которые пользователь исключил («мясо», «молочное»). */
  excludedCategories: string[];
  /** Ограничения реально применены (пустой профиль → false, гейт молчит). */
  active: boolean;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
}

/**
 * Читает ограничения из профиля (`he_profile_v2` через profile-manager).
 * Отдельная функция, чтобы тесты проверяли чистую логику без localStorage.
 */
export function readProgramRestrictions(): ProgramRestrictions {
  let n: any = {};
  try {
    n = getProfile()?.settings?.nutrition || {};
  } catch {
    n = {};
  }
  const allergens = [...new Set(strArray(n.foodAllergies).map(normalizeAllergenId).filter(Boolean))];
  const excludedFoodIds = new Set(strArray(n.excludedFoods).map(s => s.trim()));
  const excludedCategories = new Set(strArray(n.excludedCategories).map(s => s.trim().toLowerCase()));
  return {
    allergens,
    excludedFoodIds: [...excludedFoodIds],
    excludedCategories: [...excludedCategories],
    active: allergens.length > 0 || excludedFoodIds.size > 0 || excludedCategories.size > 0,
  };
}

/** Проверяемая позиция импорта (OCR-очередь или результат штрихкода). */
export interface ImportCandidate {
  name?: string;
  foodId?: string;
  category?: string;
}

export interface ImportVerdict {
  name: string;
  /** 'ok' — можно молча; 'caution' — показать предупреждение пользователю. */
  status: 'ok' | 'caution';
  reasons: string[];
}

/**
 * Молочные БЕЛКИ при аллергии только на лактозу допустимы (тот же смысл, что в
 * `isMilkProteinId`): изолят/казеин лактозы практически не содержат.
 * Без этой оговорки «Сывороточный изолят» ловился под /сыр/ и получал ложную тревогу.
 */
const MILK_PROTEIN_NAME = /сывороточн|изолят|casein|whey|казеин|молочн.{0,3}белок/i;

/**
 * Сверка одной позиции импорта с ограничениями программы.
 *
 * Порядок источников важен: id → теги каталога → название.
 * Продукт из сети/OCR часто без id, и тогда работает только текстовый слой,
 * поэтому он не «запасной», а основной для этих путей.
 */
export function checkImportItem(item: ImportCandidate, r: ProgramRestrictions): ImportVerdict {
  const name = (item.name || '').trim() || 'Без названия';
  if (!r.active) return { name, status: 'ok', reasons: [] };

  const reasons: string[] = [];
  const foodId = (item.foodId || '').trim();
  const category = (item.category || '').trim().toLowerCase();
  const lactoseOnly = r.allergens.includes('лактоза') && !r.allergens.includes('молочные');

  // 1. Явное исключение продукта пользователем.
  if (foodId && r.excludedFoodIds.includes(foodId)) reasons.push('продукт исключён в настройках рациона');

  // 2. Исключённая категория.
  if (category && r.excludedCategories.includes(category)) reasons.push(`категория «${category}» исключена в настройках`);

  // 3. Аллергены: теги каталога (для известных продуктов) + название (для сети/OCR).
  if (r.allergens.length > 0) {
    const food = foodId ? FOOD_DB.find(f => f.id === foodId) : undefined;
    if (food) {
      const tags = getFoodAllergenTags(food.id, FOOD_DB as any);
      const selected = selectedAllergenTags(r.allergens);
      if (tags.some(t => selected.has(t))) {
        // whey/casein при аллергии только на лактозу — не считаем молоком
        const isMilkProtein = food.id === 'whey_protein' || food.id === 'whey_isolate' || food.id === 'casein' || food.id === 'milk_powder';
        if (!(lactoseOnly && isMilkProtein)) {
          const hit = tags.find(t => selected.has(t));
          reasons.push(`содержит «${hit}» — это в ваших аллергенах`);
        }
      }
    }
    for (const a of r.allergens) {
      if (allergenTextMatches(a, name)) {
        if (lactoseOnly && a === 'лактоза' && MILK_PROTEIN_NAME.test(name)) continue;
        reasons.push(`название содержит признак «${ALLERGEN_LABEL[a] || a}»`);
      }
    }
  }

  const unique = [...new Set(reasons)];
  return { name, status: unique.length > 0 ? 'caution' : 'ok', reasons: unique };
}

export interface ImportSummary {
  cautions: ImportVerdict[];
  /** Готовый текст для тоста/подсказки; пусто, если предупреждений нет. */
  text: string;
}

/**
 * Сверка всей очереди импорта. `maxNames` ограничивает длину сообщения —
 * в тост не влезат десяток строк, а молчать о девятом нельзя.
 */
export function summarizeImportChecks(items: ImportCandidate[], r: ProgramRestrictions, maxNames = 3): ImportSummary {
  const cautions = (Array.isArray(items) ? items : [])
    .map(it => checkImportItem(it, r))
    .filter(v => v.status === 'caution');
  if (cautions.length === 0) return { cautions, text: '' };
  const shown = cautions.slice(0, maxNames).map(v => v.name);
  const rest = cautions.length - shown.length;
  const list = shown.join(', ') + (rest > 0 ? ` и ещё ${rest}` : '');
  return {
    cautions,
    text: `⚠️ ${cautions.length} из позиций противоречат вашим ограничениям (${list}). Записано как факт — проверьте состав.`,
  };
}