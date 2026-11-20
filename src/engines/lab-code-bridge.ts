/**
 * lab-code-bridge.ts — проход 169: одно место, где имя анализа приводится к коду склада.
 *
 * Один анализ жил в риск-контуре и в складе под разными именами. Движок риска
 * читал `TC`/`CREAT`/`URIC`/`eGFR`/`DHEAS`/`PHOS`/`FOLATE`/`ANTI_TPO`/`TNFA`, а склад
 * (`UCUM_MAP`, парсеры, `normalizeFlatLabs`, `labs-profile-sync`) пишет
 * `CHOL`/`CREATININE`/`UA`/`EGFR`/`DHEA_S`/`P`/`FOL`/`TPO_AB`/`TNF_ALPHA`.
 * Цена: значение склада не находило своего ключа — анализ есть, вклада нет,
 * верификация пишет «нет данных», а «подтверждено анализами» занижено.
 *
 * Мост один и стоит на границе `labValues`: `canonicalLabValues` вызывают движок
 * риска, верификация и те, кто передаёт им плоский список анализов. Канон —
 * код склада (верхний регистр `UCUM_MAP`); старые снапшоты калькулятора с
 * прежними именами продолжают читаться.
 *
 * `T3`/`T4` сюда не входят намеренно: это **общие** гормоны (nmol/L), а не
 * свободные. Свободные — `FT3`/`FT4` (pmol/L), и подменять одно другим нельзя:
 * общий Т3 2.0 nmol/L — норма, а свободный 2.0 pmol/L — тяжёлый дефицит.
 */
import { mapToUcumCode } from '../core/labs-mapping';
import { UCUM_MAP } from '../core/constants';

/**
 * Прежние имена риск-модели → код склада.
 * Только те, что не являются самостоятельными кодами склада (`UCUM_MAP`):
 * иначе мост занял бы имя другого анализа.
 */
export const LEGACY_LAB_CODES: Record<string, string> = {
  // ── прежние имена риск-модели (движок `risk-engine-tz-spec`, верификация) ──
  TC: 'CHOL',
  CREAT: 'CREATININE',
  URIC: 'UA',
  DHEAS: 'DHEA_S',
  PHOS: 'P',
  FOLATE: 'FOL',
  ANTI_TPO: 'TPO_AB',
  TNFA: 'TNF_ALPHA',
  ALDO: 'ALDOSTERONE',
  PTH: 'PARATHYROID',
  HB: 'HGB',
  BILIRUBIN: 'BIL',
  // ── подписи полей формы (`labMarkerCanon`) → тот же код склада ──
  TOTAL_CHOLESTEROL: 'CHOL',
  TESTOSTERONE: 'TT',
  FREE_TESTOSTERONE: 'FT',
  ESTRADIOL: 'E2',
  ANTI_TG: 'TG_AB',
  IL_6: 'IL6',
  PSA_TOTAL: 'PSA',
};

/**
 * Плоский список анализов в кодах склада.
 *
 * Канонические ключи не перезаписываются: если в карте уже есть `CHOL`, значение
 * `TC` рядом с ним ничего не меняет. Ключи не удаляются — счётчик «сколько
 * анализов введено» (`labCoverage`) остаётся прежним. Если менять нечего,
 * возвращается тот же объект (лишних копий на каждом механизме нет).
 */
export function canonicalLabValues(labValues: Record<string, number>): Record<string, number> {
  let out: Record<string, number> | null = null;
  for (const [key, value] of Object.entries(labValues)) {
    if (!Number.isFinite(value)) continue;
    const upper = key.trim().toUpperCase();
    // Легаси-имя модели — по таблице; иначе код UCUM бланка (`CREAT` → `CREATININE`,
    // `URIC` → `UA`, `FOLATE` → `FOL`). `mapToUcumCode` отдаёт имя как есть, если
    // алиаса нет, поэтому берём результат, только когда это настоящий код склада.
    const legacy = LEGACY_LAB_CODES[upper];
    const mapped = mapToUcumCode(key).trim().toUpperCase();
    const canon = legacy ?? (mapped !== key && UCUM_MAP[mapped] ? mapped : undefined);
    if (!canon || canon === key || labValues[canon] !== undefined || out?.[canon] !== undefined) continue;
    if (!out) out = { ...labValues };
    out[canon] = value;
  }
  return out ?? labValues;
}
