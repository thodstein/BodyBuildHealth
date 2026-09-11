/**
 * sm-bridge-intake.ts — чистый маппер payload planner-bridge (хабы ТА/стронг)
 * в патч состояния StrengthSportConstructor.
 *
 * Зачем: раньше приём жил инлайном в useEffect и молча терял данные хаба:
 *  1. hub velocityHistory {liftId:[best,last]} вливался в vbtMap под чужим
 *     форматом ключей (`week-day-ex-set`) — build() его отбрасывал
 *     (exId '' → skip), VBT хаба НИКОГДА не доходил до плана;
 *  2. strategy хаба вообще не читалась — попытки всегда 'balanced';
 *  3. swayCm хаба никуда не сохранялся.
 * Теперь: parseSmBridgePayload — чистая функция (покрыта тестом
 * sm-bridge-intake), intake конструктора только раскладывает патч по сеттерам.
 */
import { rankCorrectionsForTA } from '../../../engines/strength-sport/strength-sport-ta-correction-rank.engine';
import type { WLWeakPoint } from '../../../engines/strength-sport/strength-sport-weakpoint';

export type SmBridgeMode = 'strongman' | 'weightlifting';
export type SmBridgeStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface SmBridgeTaAttempts {
  snatch: number[];
  cj: number[];
}

export interface SmBridgeTaSinclair {
  total: number;
  value: number;
  cycle?: string | null;
  q?: number | null;
}

export interface SmBridgePatch {
  /** Дедуплицированные слабые зоны, максимум 4 (как было в intake). */
  weakPoints: string[];
  /** Уровень диагностики (level ?? diagnosticLevel) или null. */
  diagnosticLevel: string | null;
  /** Режим по источнику: контест/sm → strongman, wl → weightlifting. */
  mode: SmBridgeMode | null;
  /** Контест-пакет (только объект с массивом events) или null. */
  contest: any | null;
  /** Потеря скорости % (velocityLossPct ?? vbtLossPct) или null. */
  velocityLossPct: number | null;
  /** VBT-история хаба {liftId: [..≤3 точек]} — санитизирована. */
  hubVelocity: Record<string, number[]>;
  /** Sway carry см (>0) или null. */
  swayCm: number | null;
  /** Стратегия попыток из хаба или null. */
  strategy: SmBridgeStrategy | null;
  /** V4-добой (G8): заявки ТА-хаба 90/96/102 или null. */
  taAttempts: SmBridgeTaAttempts | null;
  /** V4-добой (G8): Sinclair/Q прогресса ТА-хаба или null. */
  taSinclair: SmBridgeTaSinclair | null;
  /** V4-добой (G8): недель в спец-блоке ТА-хаба или null. */
  taSpecWeeks: number | null;
  /** V4-добой-2 (П1): предпочитаемые коррекции {weakPoint: corrId} или null. */
  taPreferredCorr: Record<string, string> | null;
  /** V4-добой-2 (П1): причины слабых фаз {weakPoint: cause} или null. */
  taWeakCauses: Record<string, string> | null;
  /** V4-добой-2 (П1): FvR-оценка хаба {snatchTh, pmax} или null. */
  taFvr: { snatchTh: number; pmax: number } | null;
  /** V4-добой-2 (П1): L/R-асимметрия хаба % или null. */
  taAsymPct: number | null;
  /** V4-добой-2 (П1): провалов OHS (0–6) или null. */
  taOhsFailed: number | null;
  /** Spec-блок opt-in: сеты по неделям из taSpecBlock.weeks[].targetSets или null. */
  taSpecTargets: number[] | null;
}

const STRATEGIES: readonly string[] = ['conservative', 'balanced', 'aggressive'];

function finiteNum(v: unknown): number | null {
  const n = typeof v === 'string' || typeof v === 'number' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Чистый парсинг data из planner-bridge payload kind='weakpoints'. */
export function parseSmBridgePayload(data: any): SmBridgePatch {
  const d = (data && typeof data === 'object' ? data : {}) as any;
  const merged: unknown[] = [
    ...(Array.isArray(d.smWeakPoints) ? d.smWeakPoints : []),
    ...(Array.isArray(d.groups) ? d.groups : []),
    ...(Array.isArray(d.wlWeakPoints) ? d.wlWeakPoints : []),
    ...(Array.isArray(d.weakPoints) ? d.weakPoints : []),
  ];
  const weakPoints = Array.from(
    new Set(merged.map((s) => String(s)).filter((s) => s.length > 0)),
  ).slice(0, 4);
  const validContest = (c: unknown): boolean =>
    c != null && typeof c === 'object' && Array.isArray((c as any).events);
  // Паритет со старым intake: contest || smContest (фолбэк хаба на первый пресет),
  // но с валидацией events-массива.
  const rawContest = validContest(d.contest) ? d.contest : validContest(d.smContest) ? d.smContest : null;
  const hasContest = rawContest != null;
  // Пустой массив режим не переключает (раньше truthy-[] давал strongman из ничего).
  const hasSmWp = Array.isArray(d.smWeakPoints) && d.smWeakPoints.length > 0;
  const hasWlWp = Array.isArray(d.wlWeakPoints) && d.wlWeakPoints.length > 0;
  const mode: SmBridgeMode | null = hasContest || hasSmWp
    ? 'strongman'
    : hasWlWp
      ? 'weightlifting'
      : null;
  const diagnosticLevel =
    typeof d.level === 'string' && d.level.length > 0
      ? d.level
      : typeof d.diagnosticLevel === 'string' && d.diagnosticLevel.length > 0
        ? d.diagnosticLevel
        : null;
  const velocityLossPct = finiteNum(d.velocityLossPct) ?? finiteNum(d.vbtLossPct);
  const hubVelocity: Record<string, number[]> = {};
  const vh: unknown = d.velocityHistory;
  if (vh != null && typeof vh === 'object' && !Array.isArray(vh)) {
    for (const [k, arr] of Object.entries(vh as Record<string, unknown>)) {
      if (!k || !Array.isArray(arr)) continue;
      const pts = (arr as unknown[])
        .map((v) => finiteNum(v))
        .filter((n): n is number => n != null && n > 0)
        .slice(-3);
      if (pts.length > 0) hubVelocity[k] = pts;
    }
  }
  const swayRaw = finiteNum(d.swayCm);
  const swayCm = swayRaw != null && swayRaw > 0 ? swayRaw : null;
  const strategy =
    typeof d.strategy === 'string' && STRATEGIES.includes(d.strategy)
      ? (d.strategy as SmBridgeStrategy)
      : null;
  // V4-добой (G8): заявки/прогресс/спец-блок ТА-хаба — раньше игнорировались.
  const numArr = (v: unknown): number[] | null => {
    if (!Array.isArray(v)) return null;
    const clean = (v as unknown[]).map((x) => finiteNum(x)).filter((n): n is number => n != null && n > 0).slice(0, 3);
    return clean.length > 0 ? clean : null;
  };
  const taRaw: any = d.taAttempts != null && typeof d.taAttempts === 'object' ? d.taAttempts : null;
  const taSn = taRaw ? numArr(taRaw.snatch) : null;
  const taCj = taRaw ? numArr(taRaw.cj) : null;
  const taAttempts: SmBridgeTaAttempts | null = taSn || taCj ? { snatch: taSn ?? [], cj: taCj ?? [] } : null;
  const sinRaw: any = d.taSinclair != null && typeof d.taSinclair === 'object' ? d.taSinclair : null;
  const sinVal = sinRaw ? finiteNum(sinRaw.value) : null;
  const sinTot = sinRaw ? finiteNum(sinRaw.total) : null;
  const taSinclair: SmBridgeTaSinclair | null = sinVal != null && sinVal > 0
    ? { total: sinTot ?? 0, value: sinVal, cycle: typeof sinRaw.cycle === 'string' ? sinRaw.cycle : null, q: finiteNum(sinRaw.q) }
    : null;
  const specRaw: any = d.taSpecBlock != null && typeof d.taSpecBlock === 'object' ? d.taSpecBlock : null;
  const specW = specRaw ? finiteNum(specRaw.totalWeeks) : null;
  const taSpecWeeks = specW != null && specW >= 1 && specW <= 12 ? Math.round(specW) : null;
  // V4-добой-2 (П1): остаток payload — строки/записи, всё санитизировано, null-safe.
  const strRecord = (v: unknown, cap = 6): Record<string, string> | null => {
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (Object.keys(out).length >= cap) break;
      if (!k || typeof val !== 'string' || !val) continue;
      out[String(k).slice(0, 40)] = val.slice(0, 40);
    }
    return Object.keys(out).length ? out : null;
  };
  const taPreferredCorr = strRecord(d.taPreferredCorr);
  const taWeakCauses = strRecord(d.taWeakCauses);
  const fvrRaw: any = d.fvr != null && typeof d.fvr === 'object' ? d.fvr : null;
  const fvrTh = fvrRaw ? finiteNum(fvrRaw.snatchTh) : null;
  const fvrPmax = fvrRaw ? finiteNum(fvrRaw.Pmax ?? fvrRaw.pmax) : null;
  const taFvr = fvrTh != null && fvrTh > 0 ? { snatchTh: fvrTh, pmax: fvrPmax ?? 0 } : null;
  const asymRaw = finiteNum(d.asymmetry ?? d.asymmetryPct);
  const taAsymPct = asymRaw != null && asymRaw >= 0 && asymRaw <= 50 ? Math.round(asymRaw * 10) / 10 : null;
  const ohsRaw: any = d.ohs != null && typeof d.ohs === 'object' ? d.ohs : null;
  const ohsF = ohsRaw ? finiteNum(ohsRaw.failed) : null;
  const taOhsFailed = ohsF != null && ohsF >= 0 && ohsF <= 6 ? Math.round(ohsF) : null;
  // Spec-блок opt-in: понедельные сеты из taSpecBlock.weeks[].targetSets.
  let taSpecTargets: number[] | null = null;
  try {
    const wks = specRaw && Array.isArray(specRaw.weeks) ? specRaw.weeks : null;
    if (wks) {
      const arr = wks.map((w: any) => finiteNum(w?.targetSets)).filter((n: number | null): n is number => n != null && n > 0 && n <= 30).slice(0, 12);
      if (arr.length > 0) taSpecTargets = arr;
    }
  } catch { /* noop */ }
  return {
    weakPoints,
    diagnosticLevel,
    mode,
    contest: hasContest ? rawContest : null,
    velocityLossPct,
    hubVelocity,
    swayCm,
    strategy,
    taAttempts,
    taSinclair,
    taSpecWeeks,
    taPreferredCorr,
    taWeakCauses,
    taFvr,
    taAsymPct,
    taOhsFailed,
    taSpecTargets,
  };
}

/**
 * Протоколы спец-блока для инъекции: предпочитаемая коррекция хаба (⭐) —
 * первой, иначе топ-1 ранжира. Чистая функция (покрыта тестом).
 */
export function buildSpecProtocols(
  weakPoints: string[],
  prefCorr: Record<string, string> | null | undefined,
  causes: Record<string, string> | null | undefined,
  equipment?: string[],
  mobilityRestrictions?: string[],
): Record<string, { sets: number; reps: number; pct: number }> {
  const out: Record<string, { sets: number; reps: number; pct: number }> = {};
  for (const wp of Array.isArray(weakPoints) ? weakPoints : []) {
    if (!wp) continue;
    try {
      const ranked = rankCorrectionsForTA(wp as WLWeakPoint, {
        equipment,
        mobilityRestrictions,
        cause: (causes?.[wp] ?? null) as any,
      });
      if (!ranked.length) continue;
      const prefId = prefCorr?.[wp];
      const pick = (prefId && ranked.find((c) => c.id === prefId)) || ranked[0];
      if (pick) out[wp] = { sets: pick.protocol.sets, reps: pick.protocol.reps, pct: pick.protocol.pct };
    } catch { /* noop — фаза без протокола скипается */ }
  }
  return out;
}
/**
 * Собирает velocityHistory для билда из трёх источников (порядок = приоритет):
 * посетовый vbtMap (ключи `week-day-ex-set`) → per-lift ввод → hubVelocity хаба.
 *
 * Про свежесть честно: vbtMap переживает пересборки, т.к. ключи стабильны
 * между планами одинаковой структуры, а замеры — это история последних
 * сессий (EWMA), а не содержимое плана. Очищать при сборке НЕЛЬЗЯ — убьёт
 * легитимную непрерывность «собрал → подтюнил → пересобрал».
 */
export function collectSsVelocityHistory(
  vbtMap: Record<string, number>,
  vbtPerLift: Record<string, { best: number; last: number }>,
  hubVelocity: Record<string, number[]>,
): Record<string, number[]> | undefined {
  let velocityHistory: Record<string, number[]> | undefined;
  try {
    const grouped: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(vbtMap || {})) {
      if (!v || v <= 0) continue;
      const parts = String(k).split('-');
      const exId = parts.slice(2, -1).join('-');
      if (!exId) continue;
      if (!grouped[exId]) grouped[exId] = [];
      grouped[exId].push(v);
      if (grouped[exId].length > 3) grouped[exId] = grouped[exId].slice(-3);
    }
    if (Object.keys(grouped).length) velocityHistory = grouped;
  } catch {}
  // per-lift VBT 3× → velocityHistory (приоритет)
  try {
    for (const [lift, vals] of Object.entries(vbtPerLift || {})) {
      if (vals != null && vals.best > 0 && vals.last > 0) {
        if (!velocityHistory) velocityHistory = {};
        if (!velocityHistory[lift]) velocityHistory[lift] = [];
        // best/last как 2 точки истории для EWMA
        velocityHistory[lift] = [...(velocityHistory[lift] || []), vals.best, vals.last].slice(-3);
      }
    }
  } catch {}
  // VBT из хаба: hubVelocity уже в формате {liftId:[точки]} — напрямую в историю
  try {
    for (const [lift, pts] of Object.entries(hubVelocity || {})) {
      if (!lift || !Array.isArray(pts) || pts.length === 0) continue;
      const clean = pts.filter((v) => Number.isFinite(v) && (v as number) > 0).slice(-3);
      if (!clean.length) continue;
      if (!velocityHistory) velocityHistory = {};
      if (!velocityHistory[lift]) velocityHistory[lift] = [];
      velocityHistory[lift] = [...velocityHistory[lift], ...clean].slice(-3);
    }
  } catch {}
  return velocityHistory;
}
