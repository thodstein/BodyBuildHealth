/**
 * bb-recovery-relief.engine.ts — численный эффект боли и крепатуры (G5).
 *
 * Дефект (аудит 2026-10): сигналы восстановления собирались, но не имели численного
 * эффекта. `pain010` в хабе захардкожен `null` («боль сегодня не спрашиваем»),
 * вердикт боль-мониторинга уезжал только ТЕКСТОМ в `bits`/`movementExtra`,
 * крепатура из wellness-чекина не читалась ни одним bb-движком. Итог: два самых
 * восстанавливаемых сигнала профессионального планирования ничего не меняли.
 *
 * Канон правила прогрессии по боли — Silbernagel pain-monitoring model:
 * боль ≤5/10 во время допустима, но на следующее утро должна быть <5; при
 * превышении объём снижается, вес не прогрессирует. BJSM 2021 (VAS ≤3 для
 * patellar): «двигаться в пределах боли», а не «терпеть».
 *
 * Важно: боль МЫШЕЧНО-НАПРАВЛЕННАЯ. Боль в колене режет квадрицепс, а не весь
 * план — иначе одно натруженное сухожилие обнуляло бы тренировку целиком.
 *
 * По умолчанию (нет входов) — байт-в-байт: весь проход выключен.
 */

export type PainLevel = 'green' | 'yellow' | 'red' | 'not_tested';

/** Локация → канонические мышцы, которых касается разгрузка. */
const PAIN_MUSCLES: Record<string, string[]> = {
  patellar: ['quads', 'glutes'],
  achilles: ['calves', 'hamstrings'],
  elbow: ['triceps', 'biceps', 'forearms'],
  shoulder: ['shoulders', 'delt_front', 'delt_mid', 'delt_rear', 'chest'],
  lower_back: ['lower_back', 'hamstrings', 'glutes'],
  other: [],
};

export function musclesForPainLocation(location: string | null | undefined): string[] {
  if (!location) return [];
  return PAIN_MUSCLES[String(location)] || [];
}

export interface RecoveryReliefInput {
  /** Вердикт боль-мониторинга (bb-pain-monitor). */
  painLevel?: PainLevel;
  /** Локация боли — сужает разгрузку до поражённых мышц. */
  painLocation?: string | null;
  /** Крепатура/усталость 0–10 (wellness-чек, readiness). */
  soreness010?: number | null;
}

export interface RecoveryReliefResult {
  plan: any;
  changes: string[];
  /** Скольким упражнениям срезан объём (для честного отчёта). */
  adjusted: number;
}

const MARK = '🩹 разгрузка по восстановлению';

/**
 * Применить разгрузку по боли/крепатуре к плану.
 * Чистая функция: план не мутируется. Делод/taper-недели не трогаются — они уже
 * разгружены (иначе двойное снижение = перетрен).
 */
export function applyRecoveryRelief(
  plan: any,
  input: RecoveryReliefInput,
): RecoveryReliefResult {
  const noop = { plan, changes: [], adjusted: 0 };
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return noop;

  const level = input.painLevel;
  const sore = Number.isFinite(input.soreness010 as number) ? Number(input.soreness010) : null;
  const hasPain = level === 'red' || level === 'yellow';
  const hasSore = sore != null && sore >= 7;
  if (!hasPain && !hasSore) return noop;

  // Множители: красный = Silbernagel «объём вниз до ≤3/10», жёлтый = удержание.
  const painMult = level === 'red' ? 0.6 : level === 'yellow' ? 0.85 : 1;
  const painRir = level === 'red' ? 2 : level === 'yellow' ? 1 : 0;
  const soreMult = hasSore ? 0.9 : 1;
  const factor = Math.max(0.5, painMult * soreMult);
  // Нет локации («other») — разгружаем весь план («не знаем где» лучше, чем
  // промолчать), но множителем мягче: это диагностический фолбэк, не норма.
  const targeted = musclesForPainLocation(input.painLocation);
  const scoped = targeted.length > 0;

  const already = plan.weeks.some((w: any) => (w.sessions || []).some((s: any) =>
    (s.exercises || []).some((e: any) => String(e.comment || '').includes(MARK))));
  if (already) return noop;

  let adjusted = 0;
  // Накопительный остаток: слабый множитель (крепатура ×0.9) при округлении
  // «съедался» в ноль (3 сета → round(2.7)=3), и разгрузка не применялась
  // никогда. Остаток переносится на следующие упражнения, поэтому НЕДЕЛЬНЫЙ
  // объём падает на заявленный процент, даже если отдельный сет не изменился.
  let debt = 0;
  const newWeeks = plan.weeks.map((w: any) => {
    if (w?.deload === true || String(w?.phase || '').toLowerCase() === 'deload') return w;
    if (w?.taper === true || w?.taperApplied === true) return w;
    return {
      ...w,
      sessions: w.sessions.map((s: any) => ({
        ...s,
        exercises: s.exercises.map((ex: any) => {
          if (ex?.warmupActivator) return ex;
          if (scoped && !targeted.includes(String(ex.muscle || ''))) return ex;
          const cur = ex.sets || 0;
          if (cur <= 2) return ex;
          const raw = cur * factor + debt;
          let next = Math.max(2, Math.round(raw));
          // Накопленный долг ≥0.5 сета — снимаем один сет принудительно, иначе
          // слабый множитель так и останется неApplied.
          if (next >= cur && debt <= -0.5) next = Math.max(2, cur - 1);
          debt = raw - next;
          const rir = Math.min(5, (ex.rir ?? 2) + painRir);
          if (next >= cur && rir === (ex.rir ?? 2)) return ex;
          adjusted++;
          const why = hasPain
            ? `боль ${level === 'red' ? 'красный' : 'жёлтый'}${scoped ? ` (${input.painLocation})` : ''}`
            : `крепатура ${sore}/10`;
          return {
            ...ex,
            sets: next,
            workSets: (ex.workSets || []).slice(0, next).map((ws: any) => ({ ...ws, rir })),
            rir,
            comment: `${ex.comment || ''} | ${MARK}: ${why} — объём ×${factor.toFixed(2)}${painRir ? `, RIR +${painRir}` : ''} (Silbernagel: нагрузка в пределах восстановления, не «терпеть»).`,
          };
        }),
      })),
    };
  });

  if (!adjusted) return { plan, changes: [], adjusted: 0 };
  const scope = scoped ? ` [${input.painLocation}: ${targeted.join(', ')}]` : ' (локация не указана — весь план)';
  const changes = [
    `🩹 Разгрузка по восстановлению: боль ${level}${scope} — объём ×${factor.toFixed(2)}${painRir ? `, RIR +${painRir}` : ''} (${adjusted} упр.). Правило Silbernagel: работа в пределах боли, вес не прогрессирует.`,
  ];
  return { plan: { ...plan, weeks: newWeeks }, changes, adjusted };
}

/** TRUE — нужно ли передавать разгрузку (для UI-подсказки). */
export function needsRecoveryRelief(input: RecoveryReliefInput): boolean {
  const sore = Number.isFinite(input.soreness010 as number) ? Number(input.soreness010) : null;
  return input.painLevel === 'red' || input.painLevel === 'yellow' || (sore != null && sore >= 7);
}
