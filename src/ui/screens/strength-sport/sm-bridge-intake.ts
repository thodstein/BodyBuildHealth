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

export type SmBridgeMode = 'strongman' | 'weightlifting';
export type SmBridgeStrategy = 'conservative' | 'balanced' | 'aggressive';

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
  return {
    weakPoints,
    diagnosticLevel,
    mode,
    contest: hasContest ? rawContest : null,
    velocityLossPct,
    hubVelocity,
    swayCm,
    strategy,
  };
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
