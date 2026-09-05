/**
 * arm-table-iq.engine.ts — TOP T7b: Table-IQ аналитика (стол говорит правду).
 *
 * Источники: Ezreal (стол — мера side; связность, не напряжение),
 * WAF фолы (чистота игры), supermatch TUT (выносливость поздних раундов).
 *
 * Вход — журнал схваток/турнира (ручной ввод): фолы, срывы, ремень,
 * удержание центра, финиши. Выход — 3 главных рычага в план.
 * Скрининг-аналитика, не приговор. Чистый модуль.
 */

export interface TableBout {
  fouls?: number; // фолов за схватку
  slip?: boolean; // был срыв хвата
  dateIso?: string; // дата схватки (для тренда)
  strap?: boolean; // ушли в ремень
  centerHoldSec?: number; // удержание центра, с
  win?: boolean; // выиграна ли схватка
  finishSec?: number; // время финиша из выигрышной, с
}

export interface TableIqInput {
  bouts?: TableBout[];
  sideKg?: number; // сила side для связки с цифрами
}

export interface TableIq {
  bouts: number;
  winPct: number | null;
  foulRate: number | null; // фолов/схватку
  slipRate: number | null; // доля схваток со срывом
  strapRate: number | null; // доля в ремне
  avgCenterSec: number | null;
  avgFinishSec: number | null;
  levers: string[]; // топ-3 рычага в план
  note: string;
}

function avg(v: number[]): number | null {
  const a = v.filter((x) => Number.isFinite(x));
  if (!a.length) return null;
  return Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10;
}

export function analyzeTableIq(input: TableIqInput = {}): TableIq {
  const bouts = Array.isArray(input.bouts) ? input.bouts : [];
  if (!bouts.length) {
    return {
      bouts: 0, winPct: null, foulRate: null, slipRate: null, strapRate: null,
      avgCenterSec: null, avgFinishSec: null, levers: ['Нет журнала схваток — вести Table-IQ: фолы/срывы/ремень/центр/финиш.'],
      note: 'Table-IQ: нет данных.',
    };
  }
  const n = bouts.length;
  const wins = bouts.filter((b) => b.win).length;
  const winPct = Math.round((wins / n) * 100);
  const foulRate = Math.round((bouts.reduce((s, b) => s + (Number(b.fouls ?? 0) || 0), 0) / n) * 100) / 100;
  const slipRate = Math.round((bouts.filter((b) => b.slip).length / n) * 100);
  const strapRate = Math.round((bouts.filter((b) => b.strap).length / n) * 100);
  const avgCenterSec = avg(bouts.map((b) => Number(b.centerHoldSec ?? NaN)));
  const avgFinishSec = avg(bouts.filter((b) => b.win).map((b) => Number(b.finishSec ?? NaN)));
  const levers: string[] = [];
  if (foulRate >= 1) levers.push(`Фолы ${foulRate}/схватку ≥1: foul_freeze + referee-grip дриллы, игра чище (2 fouls = поражение).`);
  else if (foulRate >= 0.5) levers.push(`Фолы ${foulRate}/схватку: 30% ready-go репетиция, старт только по Go.`);
  if (slipRate >= 40) levers.push(`Срывы ${slipRate}%: containment + cup, 1 strap-сессия/нед заранее.`);
  else if (strapRate >= 50) levers.push(`Ремень ${strapRate}%: борьба уходит в ремень — готовить strap-изометрию 4×10с.`);
  if (avgCenterSec != null && avgCenterSec < 5) levers.push(`Центр ${avgCenterSec}с <5с: back pressure + drag сначала, бок только по выигранной.`);
  if (avgFinishSec != null && avgFinishSec > 12) levers.push(`Финиш ${avgFinishSec}с >12с: side-изометрия 10–20с + пин-холды в слабом углу.`);
  if (!levers.length) levers.push('Стол чистый: держать волну table 3/2/1, специализация по матчапу.');
  if (winPct < 40) levers.push(`Победы ${winPct}% <40%: разведка стиля + матчап-план, спарринг 70% (не красная линия).`);
  return {
    bouts: n, winPct, foulRate, slipRate, strapRate, avgCenterSec, avgFinishSec,
    levers: levers.slice(0, 3),
    note: `Table-IQ ${n} схваток: победы ${winPct}%, фолы ${foulRate}/схв, срывы ${slipRate}%, ремень ${strapRate}%.`,
  };
}

export interface TableIqTrend {
  trend: 'up' | 'down' | 'flat' | null; // улучшение / ухудшение / стабильно / мало данных
  foulDelta: number | null; // вторая половина минус первая (фолы/схватку)
  slipDelta: number | null; // вторая половина минус первая (п.п. срывов)
  note: string;
}

/**
 * TOP wave-10: тренд чистоты борьбы. Первая половина журнала vs вторая
 * (по dateIso, без дат — по порядку ввода). Нужно ≥4 схватки, иначе null-тренд.
 */
export function tableIqTrend(bouts: TableBout[] | undefined | null): TableIqTrend {
  const list = Array.isArray(bouts) ? bouts.slice() : [];
  if (list.length < 4) return { trend: null, foulDelta: null, slipDelta: null, note: 'Мало схваток для тренда (нужно ≥4).' };
  list.sort((a, b) => String(a.dateIso || '').localeCompare(String(b.dateIso || '')));
  const half = Math.floor(list.length / 2);
  const first = list.slice(0, half);
  const second = list.slice(-half);
  const foulOf = (arr: TableBout[]) =>
    Math.round((arr.reduce((s, x) => s + (Number(x.fouls ?? 0) || 0), 0) / Math.max(1, arr.length)) * 100) / 100;
  const slipOf = (arr: TableBout[]) =>
    Math.round(((arr.filter((x) => x.slip).length / Math.max(1, arr.length)) * 100) * 10) / 10;
  const foulDelta = Math.round((foulOf(second) - foulOf(first)) * 100) / 100;
  const slipDelta = Math.round((slipOf(second) - slipOf(first)) * 10) / 10;
  let trend: TableIqTrend['trend'];
  let note: string;
  if (foulDelta < 0 || slipDelta < 0) {
    if (foulDelta <= 0 && slipDelta <= 0) {
      trend = 'up';
      note = `Тренд ▲ чище: фолы ${foulDelta}/схв, срывы ${slipDelta}п.п. — держать линию.`;
    } else {
      trend = 'down';
      note = `Тренд ▼ смешанный: фолы ${foulDelta > 0 ? '+' : ''}${foulDelta}/схв, срывы ${slipDelta > 0 ? '+' : ''}${slipDelta}п.п. — смотреть худшее.`;
    }
  } else if (foulDelta > 0 || slipDelta > 0) {
    trend = 'down';
    note = `Тренд ▼ грязнее: фолы +${foulDelta}/схв, срывы +${slipDelta}п.п. — процедура + containment.`;
  } else {
    trend = 'flat';
    note = 'Тренд ► стабильно: чистота борьбы не меняется.';
  }
  return { trend, foulDelta, slipDelta, note };
}
