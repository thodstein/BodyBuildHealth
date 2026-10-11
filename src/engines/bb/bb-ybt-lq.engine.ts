/**
 * bb-ybt-lq.engine.ts — YBT-LQ для ББ (чистые функции).
 *
 * Канон (Plisky / Gribble / Alger 2025, FMS YBT-LQ протокол):
 *  - три направления: anterior (ANT) + posteromedial (PM) + posterolateral (PL);
 *  - composite = (ANT+PM+PL) / (3 × длина конечности), длина = ASIS→медиальная лодыжка;
 *  - порог риска basketball: composite <94% и anterior-асимметрия >4 см (OR ~2.2–2.5).
 * ВАЖНО: композит из ОДНОГО anterior, нормированный на голень, литературным 94% НЕ является —
 * раньше именно это и сравнивалось с 94% (порог был практически недостижим, проверка декоративна).
 * Поэтому: композит считается только при всех трёх направлениях и длине конечности;
 * асимметрия anterior — при обеих сторонах. Чувствительность ~58%, специфичность ~72%
 * (Eckart 2025, BMJ SEM 2025) — только скрининг, не прогноз травм.
 */

export const YBT_ANT_ASYM_CM = 4;
export const YBT_COMPOSITE_CUT = 94;

export const YBT_DISCLAIMER =
  'YBT — скрининг, не прогноз травм (чувствительность ~58%): чинит приоритет коррекций, а не запрещает тренироваться';

export interface YbtLqInput {
  antL: number | null; // см, anterior-досягаемость левая
  antR: number | null; // правая
  /** Posteromedial (задневнутренний) — для композита. */
  pmL?: number | null;
  pmR?: number | null;
  /** Posterolateral (задненаружный) — для композита. */
  plL?: number | null;
  plR?: number | null;
  /** Длина конечности (ASIS→медиальная лодыжка), см — знаменатель композита. */
  limbCm?: number | null;
  /** Голень (бугристость→лодыжка) — только ранний ориентир, НЕ знаменатель композита. */
  shinCm?: number | null;
}

export interface YbtLqVerdict {
  tested: boolean;
  asymCm: number | null;
  compositePct: number | null;
  /** true — введены все 3 направления и длина конечности (композит посчитан по протоколу). */
  compositeFull: boolean;
  warn: boolean;
  text: string;
}

const fin = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function ybtLqVerdict(s: YbtLqInput): YbtLqVerdict {
  const l = fin(s.antL);
  const r = fin(s.antR);
  if (l == null && r == null) {
    return { tested: false, asymCm: null, compositePct: null, compositeFull: false, warn: false, text: 'YBT-баланс: не замерялся' };
  }
  const asymCm = l != null && r != null ? Math.abs(l - r) : null;
  // Полный композит: все три направления ОБЕИХ сторон + длина конечности.
  const pmL = fin(s.pmL), pmR = fin(s.pmR), plL = fin(s.plL), plR = fin(s.plR);
  const limb = fin(s.limbCm);
  const full = l != null && r != null && pmL != null && pmR != null && plL != null && plR != null && limb != null;
  const compositePct = full && limb != null
    ? Math.round((((l as number) + (pmL as number) + (plL as number)) / (3 * (limb as number))) * 1000) / 10
    : null;
  const asymWarn = asymCm != null && asymCm > YBT_ANT_ASYM_CM;
  const compWarn = compositePct != null && compositePct < YBT_COMPOSITE_CUT;
  const partial = asymCm == null || compositePct == null;
  if (!asymWarn && !compWarn) {
    const tail = partial
      ? (asymCm == null ? ' введи вторую сторону' : '') + (compositePct == null ? ' для композита нужны PM/PL + длина конечности' : '')
      : '';
    return {
      tested: true,
      asymCm,
      compositePct,
      compositeFull: !!full,
      warn: false,
      text: `YBT-баланс: замечаний пока нет (асим ${asymCm ?? '—'} см · композит ${compositePct ?? '—'}%)${tail}`.trim(),
    };
  }
  const bits: string[] = [];
  if (asymWarn) {
    const weak = (l as number) < (r as number) ? 'левая' : 'правая';
    bits.push(`асимметрия anterior ${asymCm} см (>4) — слабее ${weak}: унилатеральная на слабую первой + баланс 2×/нед`);
  }
  if (compWarn) bits.push(`композит ${compositePct}% (<94) — общая стабильность: босиком + сплит-стойки + голеностоп`);
  return { tested: true, asymCm, compositePct, compositeFull: !!full, warn: true, text: `YBT-баланс: ${bits.join(' · ')}` };
}
