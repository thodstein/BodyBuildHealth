/**
 * arm-foul-risk.engine.ts — P6: фол-аналитика из данных (WAF-зеркало).
 *
 * Фолы хаба были счётчиком + статикой. Здесь: персональный риск-профиль
 * по 5 WAF-направлениям + slip-профиль (clean → strap-сигнал vs losing →
 * фол-риск) + топ-причина. Без видеодетекта — только журнал и самооценка.
 */

export interface FoulRiskInput {
  elbowLift?: number | null; // 0–3 самооценка риска отрыва локтя
  shoulderLine?: number | null; // 0–3 плечо за центр
  pegLoss?: number | null; // 0–3 потеря peg свободной рукой
  slipClean?: number | null; // чистых срывов
  slipLosing?: number | null; // срывов в проигрыше
  foulHistory?: number | null; // фолов всего
  bouts?: number | null; // схваток всего
}

export interface FoulRisk {
  id: string;
  label: string;
  level: 'high' | 'mid' | 'low';
  line: string;
  drillId: string;
}

export interface FoulRiskResult {
  risks: FoulRisk[];
  foulRate: number | null;
  topCause: string | null;
  slipProfile: 'clean' | 'losing' | 'mixed' | null;
  note: string;
}

function lvl03(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 3) return 3;
  return n;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const META: Array<{ id: string; label: string; drillId: string; fix: string }> = [
  { id: 'elbow_lift', label: 'Отрыв локтя', drillId: 'foul_freeze', fix: 'давление через подушку, локоть — якорь' },
  { id: 'shoulder_line', label: 'Плечо за центр', drillId: 'referee_grip_drill', fix: 'кор-якорь + тяга на себя, не валиться' },
  { id: 'peg_loss', label: 'Потеря peg', drillId: 'foul_freeze', fix: 'свободная рука на peg до Stop' },
  { id: 'slip', label: 'Срыв хвата', drillId: 'strap_start', fix: 'containment + cup, strap-сессия заранее' },
  { id: 'false_start', label: 'Фальстарт-риск', drillId: 'reaction_go', fix: 'старт только по Go' },
];

export function assessFoulRisk(input: FoulRiskInput = {}): FoulRiskResult {
  const elbow = lvl03(input.elbowLift);
  const shoulder = lvl03(input.shoulderLine);
  const peg = lvl03(input.pegLoss);
  const clean = num(input.slipClean) ?? 0;
  const losing = num(input.slipLosing) ?? 0;
  const fouls = num(input.foulHistory) ?? 0;
  const bouts = num(input.bouts);
  const vals: Record<string, number | null> = {
    elbow_lift: elbow, shoulder_line: shoulder, peg_loss: peg,
  };
  // slip-уровень: losing-слипы опаснее clean (фол+поражение при >2/3).
  let slipLvl: number | null = null;
  if (clean + losing > 0) slipLvl = losing > 0 ? (losing >= 2 ? 3 : 2) : 1;
  vals['slip'] = slipLvl;
  vals['false_start'] = null; // идёт из P2, здесь не дублируем оценкой
  const risks: FoulRisk[] = META.map((m) => {
    const v = vals[m.id];
    if (v == null) {
      return { id: m.id, label: m.label, level: 'low' as const, line: `${m.label}: нет данных — оцени 0–3.`, drillId: m.drillId };
    }
    const level = v >= 2 ? 'high' : v >= 1 ? 'mid' : 'low';
    const mark = v >= 2 ? '🔴' : v >= 1 ? '🟡' : '🟢';
    return { id: m.id, label: m.label, level, line: `${mark} ${m.label} ${v}/3 — ${m.fix}.`, drillId: m.drillId };
  });
  const foulRate = bouts != null && bouts > 0 ? Math.round((fouls / bouts) * 100) / 100 : null;
  // Топ-причина: максимум оценки (slip — по losing-весу).
  const scored = risks
    .map((r) => ({ r, v: vals[r.id] ?? -1 }))
    .filter((x) => x.v >= 0)
    .sort((a, b) => b.v - a.v);
  const topCause = scored.length && scored[0].v >= 1 ? scored[0].r.id : null;
  let slipProfile: FoulRiskResult['slipProfile'] = null;
  if (clean + losing > 0) {
    if (clean > 0 && losing === 0) slipProfile = 'clean';
    else if (losing > 0 && clean === 0) slipProfile = 'losing';
    else slipProfile = 'mixed';
  }
  const slipLine = slipProfile === 'clean'
    ? 'Слипы чистые — готовь strap заранее (нейтральный слип → лямка).'
    : slipProfile === 'losing'
      ? 'Слипы в проигрыше — фол-риск: не срываться уходя (>2/3 = фол+поражение), лучше ремень по процедуре.'
      : slipProfile === 'mixed'
        ? 'Слипы смешанные — раздели: чистые → strap-готовность, losing → дисциплина.'
        : 'Слипов в журнале нет.';
  const rateLine = foulRate != null
    ? ` Фол-рейт ${foulRate}/схватку${foulRate >= 1 ? ' ≥1 — красная зона (2 фола = поражение).' : foulRate >= 0.5 ? ' — жёлтая зона.' : ' — чисто.'}`
    : '';
  return {
    risks,
    foulRate,
    topCause,
    slipProfile,
    note: `Фол-профиль: ${topCause ? 'топ-причина — ' + (META.find((m) => m.id === topCause)?.label || topCause) + '.' : 'оценок ≥1 нет — заполни 0–3.'} ${slipLine}${rateLine}`,
  };
}
