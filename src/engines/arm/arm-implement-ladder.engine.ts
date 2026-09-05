/**
 * arm-implement-ladder.engine.ts — TOP T3: лестница инвентаря + нормы.
 *
 * Источники: ArmliftingUSA (Fat Gripz — стартер; RT/Axle/Saxon — база),
 * IronMind (RT WR M130.5 Tyukalov 2013 / F77.2 Gaiduchenko 2012; Axle, Hub,
 * Silver Bullet — секунды, не кг), GodsOfGrip 6-week RT (max-таблица),
 * SAR 2024 (разряды по имплементам).
 *
 * Лестница: fat_gripz → rolling_thunder → apollon_axle → saxon_bar/pinch_block
 * → hub → coc_bullet (support → pinch → crush).
 */

export type LadderRung = 'fat_gripz' | 'rolling_thunder' | 'apollon_axle' | 'saxon_bar' | 'pinch_block' | 'hub' | 'coc_bullet';

export const IMPLEMENT_LADDER: LadderRung[] = [
  'fat_gripz',
  'rolling_thunder',
  'apollon_axle',
  'saxon_bar',
  'pinch_block',
  'hub',
  'coc_bullet',
];

export const LADDER_RU: Record<LadderRung, string> = {
  fat_gripz: 'Fat Gripz (стартер)',
  rolling_thunder: 'Rolling Thunder 60мм',
  apollon_axle: 'Apollon Axle 58мм',
  saxon_bar: 'Saxon Bar 3"',
  pinch_block: 'Pinch Block',
  hub: 'IronMind Hub',
  coc_bullet: 'CoC Silver Bullet (сек)',
};

export const LADDER_GRIP: Record<LadderRung, 'support' | 'pinch' | 'crush' | 'hub'> = {
  fat_gripz: 'support',
  rolling_thunder: 'support',
  apollon_axle: 'support',
  saxon_bar: 'pinch',
  pinch_block: 'pinch',
  hub: 'hub',
  coc_bullet: 'crush',
};

/** Мировые ориентиры (муж/жен, кг; Silver Bullet — секунды). */
export const LADDER_WR: Record<LadderRung, { male: number; female: number; unit: 'kg' | 'sec' }> = {
  fat_gripz: { male: 0, female: 0, unit: 'kg' }, // стартер без WR
  rolling_thunder: { male: 130.5, female: 77.2, unit: 'kg' },
  apollon_axle: { male: 210, female: 110, unit: 'kg' },
  saxon_bar: { male: 100, female: 55, unit: 'kg' },
  pinch_block: { male: 60, female: 32, unit: 'kg' },
  hub: { male: 25, female: 14, unit: 'kg' },
  coc_bullet: { male: 60, female: 30, unit: 'sec' },
};

/** Порог перехода на следующую ступень (доля от WR/норматива, консервативно). */
const PROMOTE_PCT: Record<LadderRung, number> = {
  fat_gripz: 0, // переход по технике, не по весу
  rolling_thunder: 0.55,
  apollon_axle: 0.5,
  saxon_bar: 0.5,
  pinch_block: 0.5,
  hub: 0.5,
  coc_bullet: 0.6,
};

function normRung(v: unknown): LadderRung | null {
  const s = String(v || '').toLowerCase();
  return (IMPLEMENT_LADDER as string[]).includes(s) ? (s as LadderRung) : null;
}

/** % от WR (0–100+, null для стартера без WR). */
export function ladderWrPct(rung: string, value: number, sex: string): number | null {
  const r = normRung(rung);
  const v = Number(value);
  if (!r || !Number.isFinite(v) || v <= 0) return null;
  const wr = LADDER_WR[r];
  if (!wr || wr.male <= 0) return null;
  const ref = String(sex || 'male').toLowerCase() === 'female' ? wr.female : wr.male;
  if (!(ref > 0)) return null;
  return Math.round((v / ref) * 1000) / 10;
}

/** Следующая ступень + условие промоушена. */
export function nextImplement(current: string, value: number, sex: string): { next: LadderRung | null; ready: boolean; note: string } {
  const r = normRung(current);
  if (!r) return { next: 'fat_gripz', ready: true, note: 'Старт лестницы: Fat Gripz на тяги/шраги/сгибания (ArmliftingUSA).' };
  const idx = IMPLEMENT_LADDER.indexOf(r);
  if (r === 'fat_gripz')
    return { next: 'rolling_thunder', ready: true, note: 'Техника DOH чистая 4 недели → Rolling Thunder (аренда/зал с имплементом).' };
  const pct = ladderWrPct(r, value, sex);
  const need = PROMOTE_PCT[r] * 100;
  const next = idx + 1 < IMPLEMENT_LADDER.length ? IMPLEMENT_LADDER[idx + 1] : null;
  if (pct == null || !next) return { next, ready: false, note: `${LADDER_RU[r]}: держите базу, тест раз в мезоцикл.` };
  if (pct >= need)
    return { next, ready: true, note: `${LADDER_RU[r]} ${pct}% WR (порог ${need}%) → готов к ${LADDER_RU[next]}.` };
  return { next, ready: false, note: `${LADDER_RU[r]} ${pct}% WR — до порога ${need}% оставайтесь, добор объёмом RPE7.` };
}

/** Коэффициент переноса между имплементами (оценка для планирования попыток). */
export function transferFactor(from: string, to: string): number {
  const f = normRung(from);
  const t = normRung(to);
  if (!f || !t) return 1;
  if (f === t) return 1;
  const key = `${f}→${t}`;
  const map: Record<string, number> = {
    'rolling_thunder→apollon_axle': 1.35, // Axle не вращается — выше абсолют
    'apollon_axle→rolling_thunder': 0.7,
    'rolling_thunder→saxon_bar': 0.55,
    'saxon_bar→pinch_block': 0.9,
    'pinch_block→hub': 0.45,
    'fat_gripz→rolling_thunder': 0.8,
  };
  return map[key] ?? 0.8;
}

/** Совет лестницы одной строкой для rationale. */
export function ladderAdvice(current: string, value: number, sex: string): string {
  const n = nextImplement(current, value, sex);
  if (!n.next) return 'Лестница пройдена до CoC Silver Bullet — удержание + специализация.';
  return n.ready ? `Лестница: ${n.note}` : `Лестница: ${n.note}`;
}
