/**
 * strength-sport-ta-bar-consistency.engine.ts — КОНСИСТЕНТНОСТЬ ТРАЕКТОРИИ ТА (V1 PRO-v4)
 *
 * Один xLoop ни о чём: элита отличается повторяемостью (PoinT GO 2026:
 * PCI elite >90, intermediate 75–89, beginner 60–75; воббл 5 см → −8–12% скорости).
 * L/R-асимметрия разово ≠ сигнал: персист одного знака ≥4 точек → риск ×1.7.
 * Чистый движок, без UI/storage.
 */

export interface BarConsistencyResult {
  pci: number; // 0–100
  level: 'elite' | 'intermediate' | 'beginner' | 'learning';
  text: string;
}

/** PCI из серии xLoop (см): 100 − нормированный разброс. Пусто/<2 → null. */
export function pciFromTrackings(xLoops: Array<number | null | undefined>): BarConsistencyResult | null {
  const vs = (Array.isArray(xLoops) ? xLoops : []).filter((v): v is number => v != null && Number.isFinite(v) && v >= 0);
  if (vs.length < 2) return null;
  const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
  if (!(mean > 0)) return null;
  const sd = Math.sqrt(vs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vs.length);
  const cv = sd / mean;
  const pci = Math.max(0, Math.min(100, Math.round(100 - cv * 160)));
  const level = pci >= 90 ? 'elite' : pci >= 75 ? 'intermediate' : pci >= 60 ? 'beginner' : 'learning';
  const lvRu = level === 'elite' ? 'элита' : level === 'intermediate' ? 'средний' : level === 'beginner' ? 'новичок' : 'разучивание';
  return { pci, level, text: `PCI ${pci} (${lvRu}): разброс xLoop ${Math.round(sd * 10) / 10} см при среднем ${Math.round(mean * 10) / 10} — ${pci >= 75 ? 'повторяемость в норме' : 'техника гуляет: приоритет — повтор, не вес'}` };
}

export interface PersistAsymResult {
  persisting: boolean;
  n: number;
  text: string | null;
}

/**
 * Персист L/R-асимметрии: знаки отклонений (signed, см; + = вправо).
 * Тот же знак ≥4 точек подряд → сигнал; иначе разовый замер — молчим.
 */
export function persistingAsymmetry(signed: Array<number | null | undefined>, need = 4): PersistAsymResult {
  const vs = (Array.isArray(signed) ? signed : []).filter((v): v is number => v != null && Number.isFinite(v) && v !== 0);
  if (vs.length < need) return { persisting: false, n: vs.length, text: null };
  const tail = vs.slice(-need);
  const allPos = tail.every((v) => v > 0);
  const allNeg = tail.every((v) => v < 0);
  const maxAbs = Math.max(...tail.map((v) => Math.abs(v)));
  if ((allPos || allNeg) && maxAbs >= 2) {
    return { persisting: true, n: vs.length, text: `Асимметрия ${allPos ? 'вправо' : 'влево'} держится ${need}+ замеров (до ${Math.round(maxAbs * 10) / 10} см) — коррекция 4–6 нед, разовый замер диагнозом не является` };
  }
  return { persisting: false, n: vs.length, text: null };
}
