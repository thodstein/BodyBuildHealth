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
  // Паритет со старым intake: truthy-массив (даже пустой) уже переключал режим.
  const mode: SmBridgeMode | null = hasContest || d.smWeakPoints
    ? 'strongman'
    : d.wlWeakPoints
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
