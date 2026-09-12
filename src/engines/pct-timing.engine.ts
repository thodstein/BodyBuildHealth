// PCT timing — честный старт: longest clearance + поправка накопления + окна-канон.
// Паритет StacksnStats PCT Timing + postcycletherapy.com (last + 3.5×t½).
import { PK_ESTER_CANON, resolveEsterCanon } from './pk-bateman.engine';
import { resolvePedAlias } from '../data/ped-alias-map';

export interface PctCompound {
  substanceId: string;
  ester?: string;
  weeksOn: number;
}

export interface PctPlan {
  startDay: number;
  startLabel: string;
  longestId: string;
  longestHalfLife: number;
  protocol: string;
  bloodworkAfter: string;
  note: string;
}

// Окна-канон postcycletherapy.com для сверки.
const WINDOWS: { re: RegExp; label: string }[] = [
  { re: /prop/i, label: '3–5 дн' },
  { re: /enan/i, label: '14–18 дн' },
  { re: /cyp/i, label: '18–21 дн' },
  { re: /deca|nandrolone/i, label: '21–30 дн' },
  { re: /oral|oxan|stan|methand|anadrol|turinabol|dbol/i, label: '1–3 дн' },
];

export function pctWindowLabel(substanceId: string): string | null {
  for (const w of WINDOWS) if (w.re.test(String(substanceId || ''))) return w.label;
  return null;
}

function esterOf(compound: { substanceId: string; ester?: string }): string {
  if (compound.ester) return compound.ester;
  const s = String(compound.substanceId || '').toLowerCase();
  if (s.includes('sust')) return 'sustanon';
  if (s.includes('prop')) return 'propionate';
  if (s.includes('cyp')) return 'cypionate';
  if (s.includes('enan')) return 'enanthate';
  if (s.includes('deca') || s.includes('nand')) return 'decanoate';
  if (s.includes('undec')) return 'undecanoate';
  if (s.includes('phenylprop') || s.includes('npp')) return 'phenylpropionate';
  if (s.includes('acet')) return 'acetate';
  if (s.includes('hex')) return 'hexahydrobenzylcarbonate';
  if (s.includes('oral') || s.includes('oxan') || s.includes('stan') || s.includes('methand') || s.includes('anadrol') || s.includes('turinabol') || s.includes('dbol') || s.includes('winny') || s.includes('anavar'))
    return 'oral';
  return 'enanthate';
}

// Резолвер через PHARMA_DB-алиасы + канон (sust = max 4 эфиров через 7.2).
export function halfLifeOf(substanceId: string, ester?: string): { tHalf: number; source: string } {
  try {
    const alias = resolvePedAlias(String(substanceId || '').toLowerCase());
    void alias;
  } catch {
    /* алиас опционален */
  }
  const key = esterOf({ substanceId, ester });
  // Sustanon: берём max долгого эфира канона (деканоат 10.2) вместо плоских 4.5
  if (key === 'sustanon') return { tHalf: 10.2, source: 'Sustanon max-эфир (decanoate 10.2)' };
  const c = resolveEsterCanon(key);
  void PK_ESTER_CANON;
  return { tHalf: c.tHalfDays, source: c.source };
}

const PROTOCOLS: Record<string, string> = {
  nolva: 'Nolvadex 20 мг/день 4–6 нед (стандарт лёгких курсов)',
  combo: 'Clomid 50 + Nolvadex 20 мг/день 4 нед, затем taper 2 нед (средние курсы)',
  scally: 'hCG-мост → Clomid 50 + Nolvadex 20 с taper 30 дн (тяжёлые/длинные, Scally-lite). Схему согласуй с врачом',
};

export function planPctStart(compounds: PctCompound[], protocol: keyof typeof PROTOCOLS | string = 'nolva'): PctPlan {
  const list = (compounds || []).filter(Boolean);
  if (!list.length)
    return { startDay: 0, startLabel: 'Нет соединений', longestId: '—', longestHalfLife: 0, protocol: String(protocol), bloodworkAfter: '—', note: 'Добавь препараты' };
  let longest = list[0];
  let longestH = -1;
  for (const c of list) {
    const { tHalf } = halfLifeOf(c.substanceId, c.ester);
    if (tHalf > longestH) {
      longestH = tHalf;
      longest = c;
    }
  }
  // Поправка накопления: длинный курс держит steady-state дольше (+1–7 дн по t½).
  const maxWeeks = Math.max(...list.map((c) => c.weeksOn || 0), 0);
  const accum = longestH > 7 ? Math.min(7, Math.floor(maxWeeks / 4)) : longestH > 3 ? Math.min(4, Math.floor(maxWeeks / 6)) : 0;
  const startDay = Math.round(longestH * 3.5 + accum);
  const d = new Date(Date.now() + startDay * 86400000);
  const label = `День ${startDay} (${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')})`;
  const bw = new Date(Date.now() + (startDay + 14) * 86400000);
  return {
    startDay,
    startLabel: label,
    longestId: longest.substanceId,
    longestHalfLife: Math.round(longestH * 10) / 10,
    protocol: PROTOCOLS[protocol as string] ?? String(protocol),
    bloodworkAfter: `Кровь (ЛГ/ФСГ/тест/эстрадиол) после ${String(bw.getDate()).padStart(2, '0')}.${String(bw.getMonth() + 1).padStart(2, '0')} (старт +14д)`,
    note: `Формула last + 3.5×t½ + накопление ${accum}д. Sweet spot 90–97% клиренса. Подтверди анализом, схему — с врачом.`,
  };
}
