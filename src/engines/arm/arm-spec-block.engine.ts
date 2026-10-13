/**
 * arm-spec-block.engine.ts — спец-блок 4–8 нед под мёртвые точки (E5 P0).
 * Parity: bb `buildSpecBlock` + `tableWeekKind` (3/2/1 Кузнецов).
 * Чистая функция: волна объёма коррекций + dayMap по ARM_CORRECTIONS.dayTags.
 */
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';
import { tableWeekKind } from './arm-table.engine';

export interface ArmSpecWeek {
  week: number;
  kind: 'moderate' | 'heavy' | 'stress';
  targetSets: Record<string, number>;
  note: string;
}

export interface ArmSpecBlock {
  weeks: ArmSpecWeek[];
  dayMap: Record<string, string>;
  summary: string;
}

export function buildArmSpecBlock(input: {
  weakPoints: ArmWeakPoint[];
  level?: string;
  weeks?: number;
  technique?: string;
}): ArmSpecBlock {
  const points = Array.from(new Set((input.weakPoints || []).filter(Boolean))).slice(0, 3) as ArmWeakPoint[];
  const wantWeeks = Number(input.weeks);
  const n = Number.isFinite(wantWeeks) ? Math.max(4, Math.min(8, Math.round(wantWeeks))) : 6;
  const dayMap: Record<string, string> = {};
  for (const wp of points) {
    const corr = ARM_CORRECTIONS[wp];
    if (corr?.dayTags?.[0]) dayMap[wp] = corr.dayTags[0];
  }
  const weeks: ArmSpecWeek[] = [];
  // Волна спец-блока — мезоцикл 4–8 нед (техника → объём → стресс-контроль).
  // D4 PRO-2: микро-волна correctiveWaveForWeek (Н1/Н2+1/Н3−1) живёт отдельно и
  // применяется в инъекции/симе; targetSets спец-блока ПРИОРИТЕТНЕЕ волны
  // (инъекция: targetSets > waveWeek > доза — lock-тест arm-corrective-pro2).
  for (let w = 1; w <= n; w++) {
    const kind = tableWeekKind(w, n);
    const targetSets: Record<string, number> = {};
    for (const wp of points) {
      const corr = ARM_CORRECTIONS[wp];
      const base = corr?.sets ?? 3;
      // волна: нед.1–2 техника (база), нед.3–4 объём (+1), нед.5+ интенсивность (база, но heavy-строка)
      let sets = base;
      if (w >= 3 && w <= 4) sets = base + 1;
      if (kind === 'stress') sets = Math.max(2, base - 1);
      targetSets[wp] = sets;
    }
    // Аудит 2026-10 было→стало: note выводился из `kind` («Объём +1 сет» для любой heavy),
    // хотя +1 даётся только на неделях 3–4 — на неделе 5 подпись обещала +1 при факте базы.
    // Теперь текст считается от ФАКТИЧЕСКОЙ дельты к базе точки.
    const firstBase = points.length ? (ARM_CORRECTIONS[points[0]]?.sets ?? 3) : 3;
    const delta = (targetSets[points[0]] ?? firstBase) - firstBase;
    const note = delta > 0
      ? `Объём +${delta} сет @65-70%`
      : delta < 0
        ? `Стресс-контроль: ${delta} сет, изометрия`
        : 'Техника 8-12 @60-65%';
    weeks.push({ week: w, kind, targetSets, note });
  }
  const summary = points.length
    ? `Спец-блок ${n} нед: ${points.join(', ')} · дни ${Object.values(dayMap).join(', ') || '—'}`
    : 'Нет точек — спец-блок не нужен';
  return { weeks, dayMap, summary };
}
