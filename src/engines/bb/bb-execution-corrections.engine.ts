/**
 * bb-execution-corrections.engine.ts — PROF-коррекции выполнения (темп/ROM/техника).
 *
 * 3.10 (план BB-AUTO-EXHAUSTIVE-PRO): коррекции из ББ-диагностики применялись
 * ко ВСЕМ упражнениям всех недель — выбор упражнения в хабе игнорировался.
 * Теперь каждая коррекция гейтится по `targetId`/`targetName`; без цели —
 * прежнее поведение (legacy, для обратной совместимости).
 */
import type { BBPlan } from './bb-builder.engine';

export interface ExecutionCorrection {
  type: string;
  tempo?: string;
  rom?: string;
  execCues?: string[];
  /** Цель коррекции: id упражнения (как в плане) или отображаемое имя. */
  targetId?: string | null;
  targetName?: string | null;
  [key: string]: unknown;
}

function matchesTarget(ex: Record<string, unknown>, tid: string, tname: string): boolean {
  // Без цели — legacy-поведение (применяем ко всем упражнениям).
  if (!tid && !tname) return true;
  const id = String((ex as { exerciseName?: unknown; id?: unknown }).exerciseName ?? (ex as { id?: unknown }).id ?? '').toLowerCase().trim();
  const nm = String((ex as { name?: unknown }).name ?? '').toLowerCase().trim();
  return (!!tid && (id === tid || nm === tid)) || (!!tname && (nm === tname || id === tname));
}

/** Применить PROF-коррекции выполнения. Возвращает число затронутых упражнений. */
export function applyExecutionCorrections(plan: BBPlan, corrections: ExecutionCorrection[]): number {
  if (!Array.isArray(corrections) || corrections.length === 0) return 0;
  const weeks = (plan as unknown as { weeks?: unknown }).weeks;
  if (!Array.isArray(weeks)) return 0;

  let touched = 0;
  const forEachEx = (fn: (ex: Record<string, any>) => void) => {
    for (const w of weeks as any[]) {
      for (const s of (w?.sessions || []) as any[]) {
        for (const ex of (s?.exercises || []) as any[]) fn(ex);
      }
    }
  };

  for (const corr of corrections) {
    if (!corr) continue;
    const t = String(corr.type || '').toLowerCase();
    const tid = String(corr.targetId ?? '').toLowerCase().trim();
    const tname = String(corr.targetName ?? '').toLowerCase().trim();

    if (t === 'modifytempo' && corr.tempo) {
      forEachEx((ex) => {
        if (!matchesTarget(ex, tid, tname)) return;
        ex.tempo = corr.tempo;
        ex.tempoSpec = corr.tempo;
        if (Array.isArray(ex.workSets)) for (const st of ex.workSets) st.tempo = corr.tempo;
        ex.comment = (ex.comment ? ex.comment + ' · ' : '') + `🧬 PROF темп ${corr.tempo}`;
        touched++;
      });
    } else if (t === 'modifyrom') {
      forEachEx((ex) => {
        if (!matchesTarget(ex, tid, tname)) return;
        ex.pauseSeconds = 1;
        ex.stretchPhase = true;
        ex.comment = (ex.comment ? ex.comment + ' · ' : '') + `🧬 PROF ${corr.rom || 'пауза 1с в растянутой'}`;
        touched++;
      });
    } else if (t === 'modifyexecution' && Array.isArray(corr.execCues)) {
      const cues = corr.execCues.slice(0, 2).join(' · ');
      forEachEx((ex) => {
        if (!matchesTarget(ex, tid, tname)) return;
        ex.comment = (ex.comment ? ex.comment + ' · ' : '') + `🧬 PROF ${cues}`;
        touched++;
      });
    }
  }
  return touched;
}
