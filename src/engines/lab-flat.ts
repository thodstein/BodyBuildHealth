/**
 * engines/lab-flat.ts — «плоский мир»: список анализов в числах единиц расчёта.
 *
 * Проход 182 завёл этот переход внутри `support-plan/engine-helpers`, где он и
 * родился для плана поддержки. Проход 194 вынес его в отдельный модуль: тем же
 * переходом читают индексы здоровья (`labs-indices`) и разбор (`lab-analysis`),
 * а `engine-helpers` тянет за собой каталог поддержки, рекомендации и фазовые
 * протоколы — индексам они не нужны. Поведение не менялось:
 * `readFlatLabs`/`flatLabUnit`/`normalizeFlatLabs` — те же функции, `engine-helpers`
 * их ре-экспортирует, поэтому старые импорты продолжают работать.
 *
 * Единственное уточнение (проход 194): единица расчёта ищется по коду склада.
 * Раньше `flatLabUnit('BILIRUBIN_TOTAL')` и `flatLabUnit('CREAT')` возвращали
 * пустую строку — у алиаса нет своей записи в каталоге, — и число читалось «как
 * есть». Для индексов, которые с этого прохода судят число по ступеням,
 * это значило бы, что креатинин в мг/дл сравнивается с мкмоль/л.
 */
import { normalizeLabValue, ucumInfo } from '../core/constants';
import { mapToUcumCode, readLabInUnit } from '../core/labs-mapping';
import { e2PgPerMl } from './lab-norms.engine';

/**
 * Единицы «плоского» мира (риск-модель, тиры) — те же, к которым приводит
 * `normalizeLabValue`: E2 пг/мл, пролактин нг/мл, тестостерон нмоль/л, кортизол
 * нмоль/л, ДГЭА-С мкг/дл, прогестерон нг/мл.
 *
 * Проход 182: таблица отвечает только за те шесть гормонов, у которых единица
 * норм приложения не совпадает с единицей каталога (общий тестостерон: каталог
 * ng/dL, норма 12–33 нмоль/л; прогестерон: каталог нмоль/л, норма 1.2 нг/мл).
 * У остальных анализ ждёт числа в единице каталога — её даёт `ucumInfo`.
 */
const FLAT_TARGET_UNIT: Record<string, string> = {
  E2: 'pg/mL', ESTRADIOL: 'pg/mL', 'ЭСТРАДИОЛ': 'pg/mL',
  PRL: 'ng/mL', PROLACTIN: 'ng/mL',
  TT: 'nmol/L', 'TOTAL T': 'nmol/L', TESTOSTERONE: 'nmol/L', TESTOSTERONE_TOTAL: 'nmol/L',
  CORTISOL: 'nmol/L',
  'DHEA-S': 'μg/dL', 'DHEA_S': 'μg/dL', DHEAS: 'μg/dL',
  PROG: 'ng/mL', PROGESTERONE: 'ng/mL', OH17_PROGESTERONE: 'nmol/L',
};

/**
 * Единица, в которой плоский мир (риск-модель, ступени) ждёт число (проход 182).
 *
 * Второго списка единиц нет: шесть гормонов — `FLAT_TARGET_UNIT`, остальные —
 * `prefUnit` каталога (`ucumInfo`), того же, к которому приводит импорт бланка.
 * Поиск записи каталога — по коду склада (`mapToUcumCode`), поэтому алиас
 * (`BILIRUBIN_TOTAL`, `CREAT`, `TOTAL_CHOLESTEROL`) получает ту же единицу, что
 * и канон. Неизвестный анализ и анализ без единицы (HOMA-IR, INR, pH мочи) —
 * пустая строка: переводить некуда, и число остаётся как есть.
 */
export function flatLabUnit(code: string): string {
  const key = String(code || '').trim().toUpperCase();
  if (!key) return '';
  const canon = mapToUcumCode(key).toUpperCase();
  return FLAT_TARGET_UNIT[key] ?? FLAT_TARGET_UNIT[canon] ?? ucumInfo(canon)?.prefUnit ?? '';
}

export interface FlatLabsRead {
  /** Числа в единицах плоского мира — то, что читает риск-модель. */
  values: Record<string, number>;
  /** Записи с числом, но в единице, которую нельзя привести к единице расчёта. */
  unread: Array<{ code: string; value: number; unit: string }>;
}

/**
 * Прочитать плоский список анализов (`linked.labs`) — проход 182.
 *
 * Проходы 84 и 88: единица бланка главнее эвристики. `normalizeLabValue`
 * угадывает по величине («у E2 >300 — значит пмоль/л», «у пролактина >100 —
 * значит мЕд/л») и на реальных крайностях врёт: лютеиновая E2 450 пг/мл
 * режется втрое, а пролактинома 120 нг/мл превращается в 5.7. Здесь единица
 * известна из точки анализа — переводим по ней; эвристика остаётся только
 * для ввода без единицы.
 *
 * Проход 182: пересчёт перестал быть «только у шести гормонов». Раньше всем
 * остальным число отдавалось как есть, и 60 пмоль/л инсулина читались как
 * 60 мЕд/л (норма 17), 90 мг/дл глюкозы — как 90 ммоль/л. Теперь единицу
 * приводит `readLabInUnit`; если величины разные и пересчитать нечем
 * (КФК-МВ Е/л против нормы в нг/мл), запись не попадает в `values`, а
 * называется в `unread` — «нет записи» не выдаётся за «в норме».
 */
export function readFlatLabs(labs: Array<{ code?: string; name?: string; value?: number; unit?: string }>): FlatLabsRead {
  const values: Record<string, number> = {};
  const unread = new Map<string, { code: string; value: number; unit: string }>();
  for (const l of labs) {
    const code = (l.code || l.name || '').toUpperCase();
    if (!code || l.value == null || isNaN(l.value)) continue;
    const unit = l.unit == null ? '' : String(l.unit).trim();
    if (unit) {
      const read = readLabInUnit(code, l.value, unit, flatLabUnit(code));
      if (read === null) {
        // Пересчитать нечем: запись остаётся названной, но в числа не идёт.
        unread.set(code, { code, value: l.value, unit });
        continue;
      }
      // Проход 84: у эстрадиола своё правило «пмоль/л → пг/мл», и оно понимает
      // написания с опечаткой («пмол/л»), которых общий разбор единицы не знает.
      const e2 = code === 'E2' || code === 'ESTRADIOL' ? e2PgPerMl(l.value, l.unit) : l.value;
      values[code] = e2 !== l.value && read === l.value ? e2 : read;
      unread.delete(code);
      continue;
    }
    values[code] = normalizeLabValue(code, l.value);
    unread.delete(code);
  }
  return { values, unread: Array.from(unread.values()) };
}

/** Нормализация плоского списка анализов (linked.labs) — те же числа, что `readFlatLabs`. */
export function normalizeFlatLabs(labs: Array<{ code?: string; name?: string; value?: number; unit?: string }>): Record<string, number> {
  return readFlatLabs(labs).values;
}
