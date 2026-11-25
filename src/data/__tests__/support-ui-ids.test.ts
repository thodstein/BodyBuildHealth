/**
 * support-ui-ids.test.ts — guard пути «кнопка поддержки → каталог → доза».
 *
 * UI Калькулятора отдаёт в план готовые списки id (`SPECIALIZED_DOMAINS[].ids`,
 * пресеты joint/neuro/hemato, `rawGenericConfigs.*.core/lv2/lv3`), а карточку
 * рисует по `SUPPORT_CATALOG_DATA[id]` и `DEFAULT_DOSAGES[canonId(id)]`
 * (Calc.mapper.tsx:713-722). Если id в UI есть, а канонической записи каталога
 * нет, пользователь видит пустую карточку без дозы — молча, без ошибки.
 *
 * Так уже было: `clomiphene`/`enclomiphene` живут в каталоге только под ключами
 * `PHARMA_CLOMIPHENE`/`PHARMA_ENCLOMIPHENE` + алиасами `pharma_*` → `clomi`,
 * а UI зовёт их lowercase-именами — попадания нет. Guard читает исходники UI и
 * падает на первом же таком id вместо тихого рендера.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SUPPORT_CATALOG_DATA } from '../support-catalog-data';
import '../support-catalog-init';
import { DEFAULT_DOSAGES } from '../support-meta';
import { canonId } from '../../engines/support-plan/shared-constants';

const MAPPER_SRC = 'src/ui/screens/Calculator/Calc.mapper.tsx';

/**
 * id, для которых карточка каталога СОЗНАТЕЛЬНО без дозы поддержки.
 * Причина обязательна: без неё это не исключение, а забытая доза.
 */
const NO_DOSE_BY_DESIGN: Record<string, string> = {};

/**
 * id, которые UI кладёт в план: массивы `ids` (домены систем), `subs`
 * (пресеты joint/neuro/hemato) и `core`/`lv2`/`lv3` (универсальные модули
 * усиления). Все id — lowercase snake_case, поэтому прочие строковые литералы
 * (маркеры анализов, подписи) в выборку не попадают.
 */
function uiAddedIds(): string[] {
  const src = fs.readFileSync(path.resolve(process.cwd(), MAPPER_SRC), 'utf8');
  const arrays = /\b(?:ids|subs|core|lv2|lv3)\s*:\s*\[([^\]]*)\]/g;
  const ids = new Set<string>();
  for (const m of src.matchAll(arrays)) {
    for (const q of m[1].matchAll(/'([a-z0-9_]+)'|"([a-z0-9_]+)"/g)) ids.add(q[1] || q[2]);
  }
  return [...ids].sort();
}

/** Резолвер карточки: канонический id (движок) → ключ как его зовёт UI. */
function catalogOf(id: string) {
  const cid = canonId(id);
  return (
    SUPPORT_CATALOG_DATA[cid] ||
    SUPPORT_CATALOG_DATA[id] ||
    SUPPORT_CATALOG_DATA[id.toUpperCase()] ||
    SUPPORT_CATALOG_DATA[id.toLowerCase()] ||
    null
  );
}

/** Резолвер дозы как в `subDosage`: доза карточки → DEFAULT_DOSAGES по канону. */
function doseOf(id: string): { mg: number } | undefined {
  const entry = catalogOf(id);
  if (entry?.dosage) return entry.dosage;
  return DEFAULT_DOSAGES[canonId(id)] || DEFAULT_DOSAGES[id] || DEFAULT_DOSAGES[id.toLowerCase()];
}

const UI_IDS = uiAddedIds();

describe('CI guard: id из UI калькулятора резолвятся в каталог поддержки', () => {
  it('парсер видит id UI (защита от «пустого» зелёного прогона)', () => {
    expect(UI_IDS.length).toBeGreaterThan(60);
    expect(UI_IDS).toContain('clomiphene');
    expect(UI_IDS).toContain('enoxaparin');
  });

  it('исключения NO_DOSE_BY_DESIGN снабжены причиной', () => {
    for (const [id, reason] of Object.entries(NO_DOSE_BY_DESIGN)) {
      expect(UI_IDS, `${id}: исключение для id, которого нет в UI`).toContain(id);
      expect(reason.length, `${id}: нет причины исключения`).toBeGreaterThan(20);
    }
  });

  describe.each(UI_IDS)('%s', (id) => {
    it('есть карточка каталога', () => {
      expect(catalogOf(id), `${id}: UI предлагает добавить вещество, а SUPPORT_CATALOG_DATA его не знает`).toBeTruthy();
    });

    it('есть доза (или исключение с причиной)', () => {
      if (NO_DOSE_BY_DESIGN[id]) return;
      // Проверяем наличие дозовой записи. `dosage.mg === 0` в каталоге —
      // отдельный, уже существующий пробел (hydration/cardio_aerobic/
      // electrolyte_balance — доза в не-мг единицах; vitex — нет источника),
      // он вынесен в отчёт, а не замаскирован allowlist'ом.
      expect(doseOf(id), `${id}: ни дозы каталога, ни DEFAULT_DOSAGES — карточка покажет пустую дозу`).toBeTruthy();
    });
  });
});
