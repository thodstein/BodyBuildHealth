/**
 * arm-vbt-capture.engine.ts — VBT для арм-движений (как vbt-engine в DiagnosticsHub).
 * Wrist curl / pronation с датчиком или ручной ввод скорости → потеря скорости, e1RM.
 */
export interface VbtRecord {
  weight: number;
  reps: number;
  velocityMs?: number; // м/с последнего повтора (или лучшего)
  exerciseId?: string; // wrist_curl_belt, pronation_cable etc
}

export interface VbtAdvice {
  velocityLossPct: number | null;
  e1RM: number | null;
  zone: 'ok' | 'warn' | 'stop';
  advice: string;
}

export function estimateVbtLoss(records: VbtRecord[]): number | null {
  if (records.length < 2) return null;
  const vs = records.map(r => r.velocityMs).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vs.length < 2) return null;
  const best = Math.max(...vs);
  const last = vs[vs.length - 1];
  if (best <= 0) return null;
  return Math.round(((best - last) / best) * 100);
}

export function vbtZone(lossPct: number | null, exerciseId?: string): 'ok' | 'warn' | 'stop' {
  if (lossPct == null) return 'ok';
  const { warnPct, stopPct } = vbtForExercise(exerciseId || '');
  if (lossPct >= stopPct) return 'stop';
  if (lossPct >= warnPct) return 'warn';
  return 'ok';
}

export function diagnoseVbt(records: VbtRecord[]): VbtAdvice {
  const loss = estimateVbtLoss(records);
  const exId = records.length ? records[records.length - 1].exerciseId || '' : '';
  const zone = vbtZone(loss, exId);
  let e1RM: number | null = null;
  if (records.length > 0) {
    const last = records[records.length - 1];
    if (last.weight && last.reps) {
      e1RM = Math.round(last.weight * (1 + last.reps / 30));
    }
  }
  let advice = '—';
  const { warnPct, stopPct } = vbtForExercise(exId);
  if (zone === 'stop') advice = `Потеря ≥${stopPct}% — стоп, риск tendon, снизить вес`;
  else if (zone === 'warn') advice = `Потеря ${warnPct}–${stopPct}% — на грани, +1 день отдыха`;
  else if (loss != null) advice = `Потеря ${loss}% — в допуске (<${warnPct}%)`;
  else advice = 'Введите скорость (м/с) для двух подходов';
  return { velocityLossPct: loss, e1RM, zone, advice };
}

export function vbtForExercise(exerciseId: string): { warnPct: number; stopPct: number } {
  const low = (exerciseId || '').toLowerCase();
  if (low.includes('wrist') || low.includes('cup')) return { warnPct: 20, stopPct: 30 };
  if (low.includes('pronation') || low.includes('supination')) return { warnPct: 25, stopPct: 35 };
  if (low.includes('grip') || low.includes('coc') || low.includes('pinch') || low.includes('rolling')) return { warnPct: 15, stopPct: 25 };
  if (low.includes('side_press') || low.includes('side')) return { warnPct: 15, stopPct: 25 };
  return { warnPct: 20, stopPct: 30 };
}
