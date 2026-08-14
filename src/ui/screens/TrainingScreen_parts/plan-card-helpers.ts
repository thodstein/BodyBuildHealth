/**
 * plan-card-helpers.ts — структуризация текстовых описаний плана/недели
 * в плитки-карточки (PED-стиль). Чистые функции + тесты.
 */

export interface ProgressionInfo {
  /** true — программа задана дословно по источнику (без авто-прогрессии). */
  explicitSource: boolean;
  /** Режим прогрессии (натуральный / на курсе / расчёт/по фазам / другой). */
  mode: string | null;
  /** Прирост ПМ в % за неделю. */
  weeklyPct: string | null;
  /** Начальный ПМ (средний по упражнениям), кг. */
  pm0: number | null;
  /** Итоговый ПМ к концу цикла, кг. */
  pmFinal: number | null;
  /** Число недель цикла. */
  weeks: number | null;
  /** Дополнительные пояснения (заметки сборки) — отдельными пунктами. */
  notes: string[];
}

/** Разбор строки progressionRationale (lms-progression.engine / lms-builder). */
export function parseProgressionRationale(text: string): ProgressionInfo {
  const info: ProgressionInfo = {
    explicitSource: false, mode: null, weeklyPct: null, pm0: null, pmFinal: null, weeks: null, notes: [],
  };
  if (!text) return info;
  const t = text.trim();
  if (t.includes('дословно')) {
    info.explicitSource = true;
    info.mode = 'Дословно (явная раскладка недель)';
  } else {
    const modeMatch = t.match(/^([^:：]+):/);
    if (modeMatch) info.mode = modeMatch[1].trim();
    const pctMatch = t.match(/([+-]?[\d.,]+)%\/нед/);
    if (pctMatch) info.weeklyPct = pctMatch[1].replace(',', '.');
    const pm0Match = t.match(/ПМ0=(\d+(?:[.,]\d+)?)/);
    if (pm0Match) info.pm0 = parseFloat(pm0Match[1].replace(',', '.'));
    const finalMatch = t.match(/к\s+\d+\s+нед[^:]*:?\s*(\d+(?:[.,]\d+)?)\s*кг/);
    if (finalMatch) info.pmFinal = parseFloat(finalMatch[1].replace(',', '.'));
    const weeksMatch = t.match(/к\s+(\d+)\s+нед/);
    if (weeksMatch) info.weeks = parseInt(weeksMatch[1], 10);
  }
  // Заметки: предложения после основного (первого) — отдельными пунктами.
  // Отсекаем дубли того, что уже показано плитками (режим/прирост/ПМ0/недели).
  const sentences = t.split(/\.\s+|!\s+|\?\s+/).map(s => s.trim()).filter(Boolean);
  const first = sentences[0] || '';
  const covered = (s: string): boolean =>
    /%\/нед/.test(s) || /ПМ0=/.test(s) || /к\s+\d+\s+нед/.test(s) ||
    (info.mode != null && s.startsWith(info.mode)) ||
    (info.explicitSource && /дословно/.test(s));
  for (const s of sentences.slice(1)) {
    if (s && s !== first && !covered(s)) info.notes.push(s.replace(/[.;]+$/, ''));
  }
  return info;
}

/** Разбивает текст-пояснение недели на пункты-бейджи (по предложениям). */
export function splitDescriptionPoints(text: string): string[] {
  if (!text) return [];
  return text.split(/\.\s+|!\s+|\?\s+/).map(s => s.trim()).filter(Boolean);
}

/** Плитки для карточки «Как собран план» (label → value). */
export function progressionTiles(info: ProgressionInfo): Array<{ l: string; v: string }> {
  if (info.explicitSource) {
    return [
      { l: 'Источник', v: 'Дословно (явная раскладка всех недель)' },
      { l: 'Прогрессия ПМ', v: 'Без авто-прогрессии' },
    ];
  }
  const tiles: Array<{ l: string; v: string }> = [];
  if (info.mode) tiles.push({ l: 'Режим', v: info.mode });
  if (info.weeklyPct != null) tiles.push({ l: 'Прирост ПМ', v: `${info.weeklyPct}%/нед` });
  if (info.pm0 != null) tiles.push({ l: 'ПМ (старт)', v: `${info.pm0} кг` });
  if (info.pmFinal != null) tiles.push({ l: 'ПМ (финал)', v: `${info.pmFinal} кг` });
  if (info.weeks != null) tiles.push({ l: 'Цикл', v: `${info.weeks} нед` });
  return tiles;
}
