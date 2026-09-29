/**
 * support-genetics-diet.engine.ts — опции подбора поддержки (opt-in, выбор пользователя).
 *
 * Три опции (карточка «⚙️ Опции подбора» в AutoCalculator):
 *  1. 🧬 geneticsOn — корректировка плана по генетическим маркерам:
 *     - MTHFR C677T: фолат — только активная форма (метилфолат/L-5-MTHF),
 *       кофактор MTHFR — рибофлавин (B2), контроль гомоцистеина.
 *       Источники: EFSA 2014 (метилфолат эквивалентен фолиевой), RCT рибофлавин при C677T
 *       (McNulty 2006, AJCN — ↓ гомоцистеин у TT-носителей), ACOG (пренатальные витамины).
 *     - HFE (C282Y/H63D): железо ПРОТИВОПОКАЗАНО (перегрузка железом) — вычищается
 *       из плана, контроль ферритин/TSAT. Канон: CONTRAINDICATIONS iron_bisglycinate
 *       absoluteConditions 'hemochromatosis' (substance-contraindications.ts).
 *  2. 🍽 dietAware — учёт уже принимаемых добавок (профиль nutrition.currentSupplements):
 *       принятая доза ≥ плановой → позиция исключается из плана («перекрыто приёмом»),
 *       частичное перекрытие → остаётся с пометкой.
 *  3. 📥 diaryLabs — авто-подстановка свежих анализов из дневника (UI-эффект AutoCalculator,
 *     здесь не реализуется — только данные).
 *
 * Чистые функции: вход не мутируется, дедуп по canonId, опции ВЫКЛ = байт-в-байт прежний план.
 */
import type { PlanSubstance } from './support-plan/types';
import type { RecommendedSub } from './tz-mapper-engine';
import { canonId } from './support-plan/shared-constants';
import { IRON_FAMILY_IDS } from './female-support-layer';

export interface GeneticsInput {
  mthfr?: string;
  hfe?: string;
}

export interface TakenSupplement {
  id: string;
  doseMg: number;
}

const MTHFR_NOTE = '🧬 MTHFR C677T: фолат — только в активной форме (метилфолат/L-5-MTHF); рибофлавин (B2) 200 мг/сут — кофактор MTHFR (McNulty 2006); контроль гомоцистеина.';
const HFE_NOTE = '⛔ Гемохроматоз (HFE): железо исключено из плана — риск перегрузки железом. Контроль: ферритин, насыщение трансферрина (решение — врач).';

/** Положительный HFE-статус (любой носитель C282Y/H63D). */
function hfePositive(hfe: string | undefined): boolean {
  if (!hfe) return false;
  const h = hfe.toLowerCase();
  return h === 'c282y' || h === 'h63d' || h === 'compound' || h === 'positive';
}

// ─── PlanSubstance (support-plan/index → SupportScreen план) ───

export function applyGeneticsToPlanSubs(
  subs: PlanSubstance[],
  genetics: GeneticsInput | null | undefined,
): { subs: PlanSubstance[]; notes: string[] } {
  if (!genetics || (!genetics.mthfr && !genetics.hfe)) return { subs, notes: [] };
  const notes: string[] = [];
  let out = subs;

  if (hfePositive(genetics.hfe)) {
    out = out.filter(s => {
      const covered = IRON_FAMILY_IDS.has(canonId(s.id));
      return !covered;
    });
    notes.push(HFE_NOTE);
  }

  if (genetics.mthfr === 'c677t') {
    notes.push(MTHFR_NOTE);
    out = out.map(s => {
      if (canonId(s.id) !== 'folate') return s;
      const mark = '🧬 MTHFR C677T: активная форма — метилфолат (L-5-MTHF)';
      if (s.mechanismReason?.includes(mark)) return s;
      return { ...s, mechanismReason: s.mechanismReason ? `${s.mechanismReason} · ${mark}` : mark };
    });
  }

  return { subs: out, notes };
}

export function applyDietAwareToPlanSubs(
  subs: PlanSubstance[],
  taken: TakenSupplement[] | null | undefined,
): { subs: PlanSubstance[]; notes: string[] } {
  if (!taken || taken.length === 0) return { subs, notes: [] };
  const takenByCanon = new Map<string, number>();
  for (const t of taken) {
    if (!t?.id) continue;
    const cid = canonId(t.id);
    const dose = Number(t.doseMg) || 0;
    // максимум по канону (алиасы/дубли принимаемых)
    takenByCanon.set(cid, Math.max(takenByCanon.get(cid) || 0, dose));
  }
  const notes: string[] = [];
  const out: PlanSubstance[] = [];
  for (const s of subs) {
    const takenDose = takenByCanon.get(canonId(s.id));
    if (takenDose === undefined) { out.push(s); continue; }
    if (takenDose >= s.doseMg && s.doseMg > 0) {
      notes.push(`🍽 ${s.name}: уже принимаете ${takenDose} мг — исключено из плана (перекрыто приёмом)`);
      continue;
    }
    if (takenDose > 0 && s.doseMg > 0) {
      notes.push(`🍽 ${s.name}: частично перекрыто вашим приёмом (${takenDose} из ${s.doseMg} мг) — в плане полная доза`);
    }
    out.push(s);
  }
  return { subs: out, notes };
}

// ─── RecommendedSub (tz-mapper resolvePlan → Calc.mapper) ───

export function applyGeneticsToRecSubs(
  subs: RecommendedSub[],
  genetics: GeneticsInput | null | undefined,
): { subs: RecommendedSub[]; notes: string[] } {
  if (!genetics || (!genetics.mthfr && !genetics.hfe)) return { subs, notes: [] };
  const notes: string[] = [];
  let out = subs;

  if (hfePositive(genetics.hfe)) {
    out = out.filter(s => !IRON_FAMILY_IDS.has(canonId(s.substanceId)));
    notes.push(HFE_NOTE);
  }

  if (genetics.mthfr === 'c677t') {
    notes.push(MTHFR_NOTE);
    out = out.map(s => {
      if (canonId(s.substanceId) !== 'folate') return s;
      const mark = '🧬 MTHFR C677T: активная форма — метилфолат';
      if (s.reason?.includes(mark)) return s;
      return { ...s, reason: s.reason ? `${s.reason} · ${mark}` : mark };
    });
  }

  return { subs: out, notes };
}

/**
 * Учет принятых добавок на уровне rec (Calc.mapper): перекрытые позиции исключаются,
 * частично перекрытые помечаются. Доза rec — из callback (каталог/DEFAULT_DOSAGES).
 */
export function applyDietAwareToRecSubs(
  subs: RecommendedSub[],
  taken: TakenSupplement[] | null | undefined,
  doseOf: (id: string) => { mg: number } | null,
): { subs: RecommendedSub[]; notes: string[] } {
  if (!taken || taken.length === 0) return { subs, notes: [] };
  const takenByCanon = new Map<string, number>();
  for (const t of taken) {
    if (!t?.id) continue;
    const cid = canonId(t.id);
    takenByCanon.set(cid, Math.max(takenByCanon.get(cid) || 0, Number(t.doseMg) || 0));
  }
  const notes: string[] = [];
  const out: RecommendedSub[] = [];
  for (const s of subs) {
    const takenDose = takenByCanon.get(canonId(s.substanceId));
    const planDose = doseOf(s.substanceId)?.mg || 0;
    if (takenDose !== undefined && planDose > 0) {
      if (takenDose >= planDose) {
        notes.push(`🍽 Уже принимаете: ${s.substanceId} (${takenDose} мг) — исключено из плана (перекрыто приёмом)`);
        continue;
      }
      notes.push(`🍽 Частично перекрыто приёмом: ${s.substanceId} (${takenDose} из ${planDose} мг)`);
    }
    out.push(s);
  }
  return { subs: out, notes };
}
