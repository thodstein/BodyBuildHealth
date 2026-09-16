/**
 * arm-start-reaction.engine.ts — P2: старт-диагностика.
 *
 * Дриллы уже есть (reaction_go/referee_grip_drill/strap_start/foul_freeze),
 * замера — не было: startReadiness знал только reactionMs+falseStarts.
 * Здесь: реакция + захват центра + фальстарт-риск. Порог 350мс — канон
 * хаба (startReadiness), новых популяционных норм не выдумываем:
 * зоны только относительно своего прошлого и канона 350мс.
 */

export interface StartReactionInput {
  reactionMs?: number | null;
  falseStarts?: number | null;
  centerTakeoverMs?: number | null;
  sessionsCount?: number | null;
}

export type StartLevel = 'ready' | 'work' | 'nodata';

export interface StartReactionResult {
  level: StartLevel;
  ready: boolean;
  note: string;
  drills: string[];
  centerNote: string | null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function reactionZone(reactionMs: number | null): 'fast' | 'ok' | 'slow' | null {
  if (reactionMs == null) return null;
  if (reactionMs <= 250) return 'fast';
  if (reactionMs <= 350) return 'ok';
  return 'slow';
}

export function assessStartReaction(input: StartReactionInput = {}): StartReactionResult {
  const r = num(input.reactionMs);
  const f = num(input.falseStarts) ?? 0;
  const c = num(input.centerTakeoverMs);
  if (r == null) {
    return {
      level: 'nodata',
      ready: false,
      note: 'Нет замера реакции — проведи 5 стартов по команде (пауза Ready…Go 1–3с).',
      drills: ['reaction_go'],
      centerNote: null,
    };
  }
  const drills: string[] = [];
  if (f > 0) drills.push('foul_freeze');
  if (r > 350) drills.push('reaction_go');
  let centerNote: string | null = null;
  if (c != null) {
    if (c <= 1000) centerNote = `Центр за ${c}мс — захват есть, держать back+contain.`;
    else if (c <= 2500) centerNote = `Центр за ${c}мс — середняк: добавить скорость пронации (speed pronation, band).`;
    else {
      centerNote = `Центр за ${c}мс >2.5с — старта нет: чинить pron_open/rising_top, не силу.`;
      if (!drills.includes('reaction_go')) drills.push('reaction_go');
    }
  }
  if (f > 0) {
    return {
      level: 'work',
      ready: false,
      note: `Фальстарты: ${f} — старт запрещён до чистых 5 (foul_freeze, старт только по Go). Реакция ${r}мс.`,
      drills: drills.length ? drills : ['foul_freeze'],
      centerNote,
    };
  }
  if (r <= 350) {
    return {
      level: 'ready',
      ready: true,
      note: `Реакция ${r}мс ≤350мс — старт готов.${c != null ? ' ' + (centerNote || '') : ''}`,
      drills,
      centerNote,
    };
  }
  return {
    level: 'work',
    ready: false,
    note: `Реакция ${r}мс >350мс — добавить reaction_go 2×/нед до ≤350мс.`,
    drills: drills.length ? drills : ['reaction_go'],
    centerNote,
  };
}
