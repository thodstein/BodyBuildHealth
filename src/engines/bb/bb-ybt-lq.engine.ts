/**
 * bb-ybt-lq.engine.ts — YBT-LQ лайт для ББ (только anterior + композит, чистые функции).
 * Пороги строго по литературе: anterior-асимметрия >4 см (Plisky: OR ~2.2–2.5),
 * композит <94% длины голени (у девушек OR до 6.5). Чувствительность ~58%,
 * специфичность ~72% — только скрининг, не прогноз травм (Eckart 2025, BMJ SEM 2025).
 */

export const YBT_ANT_ASYM_CM = 4;
export const YBT_COMPOSITE_CUT = 94;

export const YBT_DISCLAIMER =
  'YBT — скрининг, не прогноз травм (чувствительность ~58%): чинит приоритет коррекций, а не запрещает тренироваться';

export interface YbtLqInput {
  antL: number | null; // см, anterior-досягаемость левая
  antR: number | null; // см, правая
  shinCm: number | null; // длина голени для нормализации (бугристость–лодыжка)
}

export interface YbtLqVerdict {
  tested: boolean;
  asymCm: number | null;
  compositePct: number | null;
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
  const shin = fin(s.shinCm);
  if (l == null && r == null) {
    return { tested: false, asymCm: null, compositePct: null, warn: false, text: 'YBT-баланс: не замерялся' };
  }
  const asymCm = l != null && r != null ? Math.abs(l - r) : null;
  const compositePct = l != null && r != null && shin != null ? Math.round(((l + r) / 2 / shin) * 100) : null;
  const asymWarn = asymCm != null && asymCm > YBT_ANT_ASYM_CM;
  const compWarn = compositePct != null && compositePct < YBT_COMPOSITE_CUT;
  if (!asymWarn && !compWarn) {
    return {
      tested: true,
      asymCm,
      compositePct,
      warn: false,
      text: `YBT-баланс: норма (асим ${asymCm ?? '—'} см · композит ${compositePct ?? '—'}%)`,
    };
  }
  const bits: string[] = [];
  if (asymWarn) {
    const weak = (l ?? 99) < (r ?? 99) ? 'левая' : 'правая';
    bits.push(`асимметрия anterior ${asymCm} см (>4) — слабее ${weak}: унилатеральная на слабую первой + баланс 2×/нед`);
  }
  if (compWarn) bits.push(`композит ${compositePct}% (<94): общая стабильность стопы/голени — босиком + сплит-стойки`);
  return { tested: true, asymCm, compositePct, warn: true, text: `YBT-баланс: ${bits.join(' · ')}` };
}
