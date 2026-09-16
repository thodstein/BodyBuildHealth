/**
 * arm-vector-timeline.engine.ts — P3: векторная динамика схватки.
 *
 * Стол держится 4 векторами: rising / pronation / back / side.
 * Атлет оценивает каждый 0–10 в трёх точках (старт/середина/пин).
 * Движок считает просадки и находит слабый вектор — без выдуманных норм,
 * только дельты своих оценок. Опора EMG: просадка pron на высоком торке
 * → pronator teres; просадка удержания → FCU/ulnar-deviation.
 */

export type ArmVector = 'rising' | 'pron' | 'back' | 'side';

export const ARM_VECTORS: readonly ArmVector[] = ['rising', 'pron', 'back', 'side'] as const;

export interface VectorPoint {
  rising?: number | null;
  pron?: number | null;
  back?: number | null;
  side?: number | null;
}

export interface VectorTimelineInput {
  start?: VectorPoint | null;
  mid?: VectorPoint | null;
  pin?: VectorPoint | null;
}

export interface VectorDrop {
  vector: ArmVector;
  from: number;
  to: number;
  drop: number;
}

export interface VectorTimelineResult {
  hasData: boolean;
  weakestVector: ArmVector | null;
  drops: VectorDrop[];
  containLoss: boolean;
  note: string;
  corrections: string[];
}

const VECTOR_RU: Record<ArmVector, string> = {
  rising: 'райзинг',
  pron: 'пронация',
  back: 'тяга на себя',
  side: 'бок',
};

function clamp010(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 10) return 10;
  return Math.round(n * 10) / 10;
}

function readPoint(p: VectorPoint | null | undefined): Record<ArmVector, number | null> {
  return {
    rising: clamp010(p?.rising),
    pron: clamp010(p?.pron),
    back: clamp010(p?.back),
    side: clamp010(p?.side),
  };
}

export function analyzeVectorTimeline(input: VectorTimelineInput = {}): VectorTimelineResult {
  const s = readPoint(input.start);
  const m = readPoint(input.mid);
  const p = readPoint(input.pin);
  const hasData = ARM_VECTORS.some(
    (v) => s[v] != null || m[v] != null || p[v] != null,
  );
  if (!hasData) {
    return {
      hasData: false,
      weakestVector: null,
      drops: [],
      containLoss: false,
      note: 'Векторов нет — оцени rising/pron/back/side 0–10 в трёх точках: старт/середина/пин.',
      corrections: [],
    };
  }
  // Итог вектора = среднее заполненных точек; просадка = старт − пин (если оба есть).
  const drops: VectorDrop[] = [];
  const avgs: Array<{ vector: ArmVector; avg: number }> = [];
  for (const v of ARM_VECTORS) {
    const vals = [s[v], m[v], p[v]].filter((x): x is number => x != null);
    if (!vals.length) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    avgs.push({ vector: v, avg: Math.round(avg * 10) / 10 });
    if (s[v] != null && p[v] != null) {
      const drop = Math.round(((s[v] as number) - (p[v] as number)) * 10) / 10;
      if (drop >= 2) drops.push({ vector: v, from: s[v] as number, to: p[v] as number, drop });
    }
  }
  avgs.sort((a, b) => a.avg - b.avg);
  const weakest = avgs.length ? avgs[0].vector : null;
  // Потеря containment: пальцы/кисть сыплются раньше руки — rising+pron просели оба ≥2.
  const dropSet = new Set(drops.map((d) => d.vector));
  const containLoss = dropSet.has('rising') && dropSet.has('pron');
  const corrections: string[] = [];
  if (weakest === 'rising') corrections.push('rising_top', 'cup_hold');
  if (weakest === 'pron') corrections.push('pron_open', 'pron_lock');
  if (weakest === 'back') corrections.push('back_start', 'back_drag');
  if (weakest === 'side') corrections.push('side_mid', 'side_pin');
  if (containLoss) corrections.push('contain_fingers');
  const weakLine = weakest
    ? `Слабый вектор: ${VECTOR_RU[weakest]} (среднее ${avgs[0].avg}/10).`
    : 'Слабый вектор не выделяется.';
  const dropLine = drops.length
    ? ` Просадки старт→пин: ${drops.map((d) => `${VECTOR_RU[d.vector]} ${d.from}→${d.to}`).join('; ')}.`
    : ' Просадок старт→пин ≥2 нет.';
  const containLine = containLoss ? ' Потеря containment: rising+pron сыплются парой — чинить пальцы/cup первым.' : '';
  return {
    hasData: true,
    weakestVector: weakest,
    drops,
    containLoss,
    note: weakLine + dropLine + containLine,
    corrections: Array.from(new Set(corrections)),
  };
}
