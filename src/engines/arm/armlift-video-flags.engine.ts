/**
 * armlift-video-flags.engine.ts — видео-разбор попытки лайт (PRO-6 M6).
 * Переиспользуем канон-парсер Kinovea-CSV (`strength-sport-video`, без дубля):
 * из трека маркера снаряда берём только гуляние по горизонтали (xLoop) и
 * длительность. Угол запястья и параллель — ручной ввод из Kinovea-угломера
 * (авто-углы без калибровки врали бы — честно ручками).
 * Без CSV — тихо (null), диагноз не трогаем. Чистые функции.
 */
import { parseKinoveaCSV } from '../strength-sport/strength-sport-video.engine';

export type ArmliftVideoFlag = 'drift' | 'drift_big' | 'wrist_break' | 'not_parallel' | 'quick_pull';

export interface ArmliftVideoInput {
  csv?: string;
  /** Угол запястья из Kinovea-угломера (180 = нейтраль). */
  wristDeg?: number | null;
  /** Снаряд параллелен земле на стойке (визуально по кадру). */
  parallelOk?: boolean | null;
}

export interface ArmliftVideoResult {
  parsed: boolean;
  xLoopCm: number | null;
  durationSec: number | null;
  flags: ArmliftVideoFlag[];
  note: string;
}

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) ? (v as number) : null;

const FLAG_RU: Record<ArmliftVideoFlag, string> = {
  drift: 'гуляет по горизонтали >6 см — веди без опоры о бедро',
  drift_big: 'гуляние >10 см — протяжка по ноге, стойка прямо',
  wrist_break: 'запястье ломается — нейтраль, кулак продолжение предплечья',
  not_parallel: 'не параллелен — держи плоскость, перекос открывает пальцы',
  quick_pull: 'рывок <1 с — тяни в одно движение, но без спешки',
};

export function analyzeArmliftVideo(i: ArmliftVideoInput): ArmliftVideoResult | null {
  const csv = typeof i.csv === 'string' ? i.csv.trim() : '';
  const wrist = num(i.wristDeg);
  const flags: ArmliftVideoFlag[] = [];

  if (!csv) {
    // Без трека — только ручные флаги (угол/параллель), иначе тихо.
    if (wrist != null && wrist < 160) flags.push('wrist_break');
    if (i.parallelOk === false) flags.push('not_parallel');
    if (!flags.length) return null;
    return {
      parsed: false,
      xLoopCm: null,
      durationSec: null,
      flags,
      note: flags.map((f) => FLAG_RU[f]).join(' · '),
    };
  }
  let pts: Array<{ x: number; y: number; t: number }> | null = null;
  try {
    pts = parseKinoveaCSV(csv);
  } catch {
    pts = null;
  }
  if (!pts || pts.length < 2) {
    if (wrist != null && wrist < 160) flags.push('wrist_break');
    if (i.parallelOk === false) flags.push('not_parallel');
    if (!flags.length) return null;
    return { parsed: false, xLoopCm: null, durationSec: null, flags, note: `CSV не разобрался — ${flags.map((f) => FLAG_RU[f]).join(' · ')}` };
  }
  const xs = pts.map((p) => p.x);
  const xLoop = Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10;
  const dur = Math.round((pts[pts.length - 1].t - pts[0].t) * 10) / 10;
  /** Разброс >30 см — не рука (либо вёлся по полу, либо пиксели без калибровки): флага дрейфа нет, честная пометка. */
  if (xLoop > 30) {
    if (wrist != null && wrist < 160) flags.push('wrist_break');
    if (i.parallelOk === false) flags.push('not_parallel');
    const tail = flags.length ? ` · ${flags.map((f) => FLAG_RU[f]).join(' · ')}` : '';
    return { parsed: true, xLoopCm: xLoop, durationSec: dur, flags, note: `Трек: гуляние ${xLoop} см — единицы не похожи на см (калибруй Kinovea)${tail}` };
  }
  if (xLoop > 10) flags.push('drift_big');
  else if (xLoop > 6) flags.push('drift');
  if (dur > 0 && dur < 1) flags.push('quick_pull');
  if (wrist != null && wrist < 160) flags.push('wrist_break');
  if (i.parallelOk === false) flags.push('not_parallel');
  const track = `Трек: гуляние ${xLoop} см, длительность ${dur} с`;
  if (!flags.length) {
    return { parsed: true, xLoopCm: xLoop, durationSec: dur, flags, note: `${track} — чисто` };
  }
  return {
    parsed: true,
    xLoopCm: xLoop,
    durationSec: dur,
    flags,
    note: `${track} — ${flags.map((f) => FLAG_RU[f]).join(' · ')}`,
  };
}
