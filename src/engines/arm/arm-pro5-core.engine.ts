/**
 * arm-pro5-core.engine.ts — PRO-5 P6 ядро-гигиена (чистый модуль без импортов).
 *
 * Закрывает техдолги билдера без смены поведения по умолчанию:
 * - G4: taperStateFor — явный стейт хвостового окна тейпера вместо флага;
 * - G3: resolveProgressionRates — распил correctionPct на cyclePctPerWeek/mesoRatePct;
 * - G6: acwrMultFor — живой ACWR-мультипликатор вместо константы 1;
 * - G2: pedHonestyNote — честная пометка неизвестных PED-id (формула сохранена);
 * - G7/G8: weightHonestyMark + foreignPoolWarnings — честные пометки веса/пула.
 */

/** Явный стейт тейпера: хвостовое окно = непрерывный run deload/peaking с конца. */
export interface ArmTaperState {
  tailStart: number; // первая неделя хвостового окна (weeks+1 = нет окна)
  hasTail: boolean;
  tailPhases: string[];
}

export function taperStateFor(phaseMap: Record<number, string>, weeks: number): ArmTaperState {
  let tailStart = weeks + 1;
  try {
    for (let w = weeks; w >= 1; w--) {
      const ph = String((phaseMap as Record<number, string>)[w] || '');
      if (ph === 'deload' || ph === 'peaking') tailStart = w;
      else break;
    }
  } catch { tailStart = weeks + 1; }
  const tailPhases: string[] = [];
  for (let w = tailStart; w <= weeks; w++) tailPhases.push(String(phaseMap[w] || ''));
  return { tailStart, hasTail: tailStart <= weeks, tailPhases };
}

/** Хвостовая неделя идёт полным объёмом (режет только кривая финализатора)? */
export function isCycleTaperActive(state: ArmTaperState, phase: string, week: number, taperPreset: string | null): boolean {
  return taperPreset != null && (phase === 'deload' || phase === 'peaking') && week >= state.tailStart;
}

/** Распил correctionPct: внутрицикловой %/нед + кросс-мезо ставка. correctionPct — legacy-фолбэк обоих. */
export interface ProgressionRates {
  cyclePctPerWeek: number; // 0 = выкл (внутрицикловой рост)
  mesoRate: number; // кросс-мезо ставка (1.025 дефолт)
  migrated: boolean; // true = взято из новых полей, не из legacy
}

export function resolveProgressionRates(input: {
  correctionPct?: unknown;
  cyclePctPerWeek?: unknown;
  mesoRatePct?: unknown;
}): ProgressionRates {
  const legacyRaw = Number((input as { correctionPct?: unknown }).correctionPct);
  const legacyOk = Number.isFinite(legacyRaw) && legacyRaw > 0 && legacyRaw <= 5;
  const cycleRaw = Number((input as { cyclePctPerWeek?: unknown }).cyclePctPerWeek);
  const mesoRaw = Number((input as { mesoRatePct?: unknown }).mesoRatePct);
  const cycleOk = Number.isFinite(cycleRaw) && cycleRaw >= 0 && cycleRaw <= 5;
  const mesoOk = Number.isFinite(mesoRaw) && mesoRaw >= 0 && mesoRaw <= 5;
  const cyclePctPerWeek = cycleOk ? cycleRaw : legacyOk ? legacyRaw : 0;
  const mesoRate = mesoOk ? 1 + mesoRaw / 100 : legacyOk ? 1 + legacyRaw / 100 : 1.025;
  return { cyclePctPerWeek, mesoRate, migrated: cycleOk || mesoOk };
}

/** Живой ACWR-мультипликатор по sRPE-дневнику (зоны как arm-acwr: ok<1.3/caution/danger≥1.5). */
export function acwrMultFor(input: {
  diary?: Array<{ dateIso?: string; srpe?: number; sRPE?: number; durationMin?: number; minutes?: number }>;
}): { mult: number; ratio: number | null; zone: 'ok' | 'caution' | 'danger' | 'none'; note: string | null } {
  const diary = Array.isArray(input.diary) ? input.diary : [];
  const loads = diary
    .map((d) => {
      const rpe = Number((d as { srpe?: unknown }).srpe ?? (d as { sRPE?: unknown }).sRPE);
      const mins = Number((d as { durationMin?: unknown }).durationMin ?? (d as { minutes?: unknown }).minutes ?? 60);
      if (!Number.isFinite(rpe) || rpe <= 0 || !Number.isFinite(mins) || mins <= 0) return null;
      return rpe * mins;
    })
    .filter((v): v is number => v != null);
  if (loads.length < 8) return { mult: 1, ratio: null, zone: 'none', note: null };
  // Упрощённый coupled ACWR: острая (последние 7 нагрузок) / хроническая (все).
  const acute = loads.slice(-7);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const ratio = Math.round((avg(acute) / Math.max(1, avg(loads))) * 100) / 100;
  if (ratio >= 1.5) return { mult: 0.65, ratio, zone: 'danger', note: `ACWR ${ratio} danger — объём ×0.65, RIR+2, делоад (дневник sRPE).` };
  if (ratio >= 1.3) return { mult: 0.85, ratio, zone: 'caution', note: `ACWR ${ratio} caution — объём ×0.85, RIR+1.` };
  return { mult: 1, ratio, zone: 'ok', note: null };
}

/** Честная пометка PED: известные id идут через adaptForPEDs, неизвестные — грубая оценка. */
const KNOWN_PED_SUBSTR = [
  'test', 'tren', 'deca', 'nand', 'bold', 'eq_', 'primo', 'mast', 'drosta', 'stan', 'oxan',
  'anavar', 'winst', 'dbol', 'methan', 'tbol', 'turin', 'anadrol', 'oxy', 'sust', 'enan', 'cyp',
  'prop', 'gh_', 'hgh', 'soma', 'igf', 'mgf', 'ins', 'mk_', 'ghrp', 'ghrh', 'sarm', 'osta', 'lpd',
  'dhb', 'trest', 'superdrol', 's23', 'yk11', 'sr9009', 'gw50', 'hcg',
];

export function pedHonestyNote(pedDoses: Record<string, number> | undefined): string | null {
  if (!pedDoses || Object.keys(pedDoses).length === 0) return null;
  const unknown = Object.keys(pedDoses).filter((k) => {
    const low = k.toLowerCase();
    return !KNOWN_PED_SUBSTR.some((s) => low.includes(s));
  });
  if (unknown.length === 0) return null;
  return `PED: неизвестные id (${unknown.join(', ')}) — оценка грубая по сумме доз, не фармакология. Проверьте канон pharma-db.`;
}

/** Честная пометка веса: workMax пуст для мышцы → вес-ориентир, прогрессия по нему не ведётся. */
export function weightHonestyMark(muscle: string, workMax: Record<string, number>): boolean {
  const low = muscle.toLowerCase();
  if (workMax[low] != null) return false;
  if (workMax['wrist'] != null && low.includes('wrist')) return false;
  if (workMax['grip'] != null && low.includes('grip')) return false;
  if (workMax['pron'] != null && low.includes('pron')) return false;
  if (workMax['sup'] != null && low.includes('sup')) return false;
  return true;
}

/** Разрешённые substitutionGroup на мышцу (зеркало exactMap билдера) — чужеродный пул ловится пост-чеком. */
const ALLOWED_SG: Record<string, string[]> = {
  wrist_flexors: ['cup_iso', 'cupping'],
  wrist_extensors: ['wrist_ext'],
  pronators: ['pronation'],
  supinators: ['supination'],
  brachialis: ['hammer'],
  grip_support: ['grip_support'],
  grip_pinch: ['grip_pinch', 'thumb_iso'],
  grip_crush: ['grip_crush'],
  risers: ['rising'],
  side_pressure: ['side_press'],
  back_pressure: ['back_drag'],
  thumb: ['grip_pinch', 'thumb_iso'],
  shoulder_stab: ['shoulder_int', 'shoulder_ext'],
  core_anchor: ['core_anti'],
  ulnar_deviators: ['ulnar_iso'],
  radial_deviators: ['radial_iso'],
};

export function foreignPoolWarnings(
  weeks: Array<{ week: number; sessions: Array<{ exercises: Array<{ muscle: string; name: string; substitutionGroup?: string; movementPattern?: unknown }> }> }>,
): string[] {
  const out: string[] = [];
  for (const wk of weeks) {
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        const allowed = ALLOWED_SG[ex.muscle];
        if (!allowed) continue;
        const sg = String(ex.substitutionGroup || '').toLowerCase();
        const mp = String(ex.movementPattern || '').toLowerCase();
        const ok = allowed.some((s) => sg === s || sg.includes(s) || mp.includes(s));
        if (!ok) out.push(`Н${wk.week} ${ex.muscle}: «${ex.name}» вне своей группы (${sg || '—'}) — пул-фолбэк, проверьте замену.`);
      }
    }
  }
  return out;
}
