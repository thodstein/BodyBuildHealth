/**
 * bb-show-coach.engine.ts — 🧠 ТРЕНЕРСКИЙ SCORE ББ-ШОУ-ПИКА (проф-слой).
 *
 * Чистый слой ПОВЕРХ bb-contest-prep.engine (файл чужого агента не изменяется —
 * только импорт типов/функций). Оценивает готовность к шоу по единому плану
 * BBContestPrepPlan:
 *  - подготовка (неедель дефицита, темп %/нед, финальная подготовка);
 *  - taper (объём ↓, интенсивность сохраняется, RIR 2-4);
 *  - пик-неделя (стратегии вода/натрий/карбс, безопасность модов);
 *  - готовность тела (% жира vs целевой, verdict on_track/behind/ahead);
 *  - безопасность (requiresReview/blockedProtocol/противопоказания);
 *  - прогресс веса (prepWeightAdvice — тренд последних недель).
 *
 * Возвращает score 0-100 + заметки + конкретные действия (авто-подбор конфига).
 */
import {
  type BBContestPrepPlan, type BBContestPrepConfig,
  professionalReviewConditions, CATEGORY_PROFILES,
} from './bb-contest-prep.engine';

export interface BBShowCoachCtx {
  /** Единый план подготовки (BBContestPrepPlan). */
  plan: BBContestPrepPlan;
  /** Текущий % жира (актуальный, не из плана). */
  currentBodyFatPct?: number;
  /** Текущий вес (кг) — для прогресса к целевому. */
  currentWeightKg?: number;
  /** Лог весов за последние недели (для prepWeightAdvice). */
  weightLog?: { date: string; weight: number }[];
}

export type BBShowNoteSeverity = 'ok' | 'info' | 'warn' | 'danger';

export interface BBShowNote {
  severity: BBShowNoteSeverity;
  icon: string;
  text: string;
}

export interface BBShowCoachVerdict {
  /** 0-100 готовность к шоу. */
  score: number;
  label: string;
  notes: BBShowNote[];
  /** Конкретные действия (авто-подбор/рекомендации). */
  actions: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Оценка готовности тела: % жира vs целевой (по катего-профилю из плана/результата). */
function bodyReadiness(ctx: BBShowCoachCtx): { score: number; note: BBShowNote | null } {
  const bf = ctx.currentBodyFatPct;
  if (bf == null) {
    return { score: 0, note: { severity: 'info', icon: '⚖️', text: 'Укажите текущий % жира — без него оценка готовности тела неполная.' } };
  }
  // Фаза 3.31: единый источник targetBodyFat — CATEGORY_PROFILES (bikini 13,
  // wellness 14, figure 11, mens_bb 5 и т.д.), а не локальная эвристика 10/7/5,
  // которая противоречила категорийным таблицам.
  const cat = ctx.plan.category;
  const targetBf = CATEGORY_PROFILES[cat]?.targetBodyFatPct ?? (cat === 'bikini' || cat === 'wellness' ? 13 : cat === 'figure' ? 11 : cat === 'womens_physique' ? 9 : cat === 'mens_physique' || cat === 'classic_physique' ? 7 : 5);
  const gap = bf - targetBf;
  if (gap <= 0) return { score: 100, note: { severity: 'ok', icon: '✅', text: `% жира ${bf}% — в целевой зоне (${targetBf}%).` } };
  if (gap <= 2) return { score: 80, note: { severity: 'info', icon: '⚖️', text: `% жира ${bf}% — чуть выше цели (${targetBf}%), сушитесь дальше.` } };
  if (gap <= 5) return { score: 55, note: { severity: 'warn', icon: '⚠', text: `% жира ${bf}% против цели ${targetBf}% — до формы ещё ${gap}%.` } };
  return { score: 30, note: { severity: 'danger', icon: '⛔', text: `% жира ${bf}% далеко от цели ${targetBf}% — подготовка к шоу преждевременна.` } };
}

/**
 * Тренерский score готовности к ББ-шоу по единому плану подготовки.
 */
export function scoreBBShowPrep(ctx: BBShowCoachCtx): BBShowCoachVerdict {
  const notes: BBShowNote[] = [];
  let score = 100;
  const p = ctx.plan;

  // ── Подготовка ──
  const prepWeeks = p.preparation.weeks;
  if (prepWeeks < 4) { score -= 15; notes.push({ severity: 'warn', icon: '📅', text: `Подготовка всего ${prepWeeks} нед — для качественной сушки нужно ≥8 нед.` }); }
  else if (prepWeeks < 8) { score -= 5; notes.push({ severity: 'info', icon: '📅', text: `Подготовка ${prepWeeks} нед — короткая, но допустимая.` }); }
  else notes.push({ severity: 'ok', icon: '✅', text: `Подготовка ${prepWeeks} нед — достаточный срок для сушки.` });

  const rate = p.preparation.targetRatePctPerWeek;
  if (rate < 0.25 || rate > 0.75) { score -= 10; notes.push({ severity: 'warn', icon: '⚖️', text: `Темп сушки ${rate}%/нед вне безопасного диапазона 0.25-0.75% — риск потери мышц.` }); }
  else notes.push({ severity: 'ok', icon: '✅', text: `Темп сушки ${rate}%/нед — в безопасном диапазоне.` });

  const volMult = p.preparation.volumeMult ?? 1;
  if (volMult < 1) { score -= 4; notes.push({ severity: 'info', icon: '🏋️', text: `Режим подготовки «поддерживающий» (объём ×${volMult}) — сохраняет массу при дефиците.` }); }

  // ── Taper ──
  if (!p.taper.enabled || p.taper.weeks < 1) { score -= 15; notes.push({ severity: 'warn', icon: '📉', text: 'Taper не включён — без разгрузки объёма к пику форма не выйдет.' }); }
  else {
    const vol = p.taper.volumeProfile;
    const volDown = vol.length > 1 && vol[vol.length - 1] < vol[0];
    if (!volDown) { score -= 10; notes.push({ severity: 'warn', icon: '📉', text: 'Taper-кривая не снижает объём к пику — разгрузка должна нарастать.' }); }
    else notes.push({ severity: 'ok', icon: '✅', text: `Taper ${p.taper.weeks} нед: объём ↓ к пику, интенсивность сохраняется.` });
    const rirOk = p.taper.rirProfile.every(([lo, hi]) => lo >= 2 && hi <= 4);
    if (!rirOk) { score -= 8; notes.push({ severity: 'warn', icon: '🔥', text: 'RIR в taper вне 2-4 — без отказных серий восстановление к пику неполное.' }); }
  }

  // ── Пик-неделя ──
  if (!p.peakWeek.enabled) { score -= 15; notes.push({ severity: 'warn', icon: '🎭', text: 'Пик-неделя не включена — вода/натрий/карбс не спланированы к шоу.' }); }
  else {
    // Безопасность модов: умеренные (moderate вода/натрий) — агрессивнее стабильных.
    const riskyWater = p.peakWeek.waterMode === 'moderate';
    const riskySodium = p.peakWeek.sodiumMode === 'moderate';
    if (riskyWater || riskySodium) {
      score -= 10;
      notes.push({ severity: 'warn', icon: '💧', text: `Умеренные моды пик-недели (вода ${p.peakWeek.waterMode}, натрий ${p.peakWeek.sodiumMode}) — мягкая модуляция, следите за самочувствием.` });
    } else {
      notes.push({ severity: 'ok', icon: '✅', text: `Пик-неделя: стабильные вода/натрий (${p.peakWeek.waterMode}/${p.peakWeek.sodiumMode}), карбс ${p.peakWeek.carbMode}.` });
    }
  }

  // ── Готовность тела ──
  const body = bodyReadiness(ctx);
  if (body.note) notes.push(body.note);
  score -= (100 - body.score) * 0.7;

  // ── Безопасность ──
  if (p.safety.blockedProtocol) { score -= 25; notes.push({ severity: 'danger', icon: '🛡', text: 'Протокол пик-недели заблокирован (противопоказания) — экстремальные моды недоступны.' }); }
  if (p.safety.requiresReview) {
    const conds = professionalReviewConditions(p.safety.contraindications);
    score -= 15;
    notes.push({ severity: 'danger', icon: '👨‍⚕️', text: `Требуется мед. сопровождение: ${conds.length ? conds.join(', ') : 'есть противопоказания'}.` });
  }
  if (p.safety.warnings.length > 0) { score -= 5; notes.push({ severity: 'info', icon: '⚠', text: p.safety.warnings.slice(0, 2).join(' · ') }); }

  // ── Прогресс веса (тренд последних недель) ──
  if (ctx.weightLog && ctx.weightLog.length >= 2) {
    const sorted = [...ctx.weightLog].sort((a, b) => a.date.localeCompare(b.date));
    const recent = sorted.slice(-7);
    const prev = sorted.slice(-14, -7);
    const avg = (arr: { weight: number }[]) => arr.length ? arr.reduce((s, x) => s + x.weight, 0) / arr.length : 0;
    const r = avg(recent), pr = avg(prev);
    if (pr > 0 && r > 0) {
      const delta = ((r - pr) / pr) * 100;
      if (delta > 0.2) { score -= 12; notes.push({ severity: 'warn', icon: '📈', text: `Вес за последние 7 дней растёт (+${delta.toFixed(1)}%) — сушка буксует, пересмотрите калории.` }); }
      else if (delta < -0.1) notes.push({ severity: 'ok', icon: '📉', text: `Вес снижается (−${Math.abs(delta).toFixed(1)}%/нед) — сушка идёт.` });
    }
  }

  score = clamp(Math.round(score), 0, 100);
  const label = score >= 85 ? 'Готов к шоу — план сбалансирован'
    : score >= 65 ? 'Небольшие правки перед шоу'
    : score >= 40 ? 'Требует корректировки подготовки'
    : 'Пересмотрите подготовку к шоу';

  const actions: string[] = [];
  if (score < 85) {
    if (prepWeeks < 8) actions.push('Увеличьте недели подготовки до ≥8.');
    if (!p.taper.enabled) actions.push('Включите taper (объём ↓, RIR 2-4).');
    if (!p.peakWeek.enabled) actions.push('Включите пик-неделю (стабильные вода/натрий).');
    if (body.score < 60) actions.push('Продолжите сушку — сните % жира к целевой зоне.');
    if (p.safety.requiresReview) actions.push('Обеспечьте мед. сопровождение перед пик-неделей.');
  } else actions.push('План готов — следуйте taper и пик-неделе, не меняйте моды без необходимости.');

  return { score, label, notes: notes.sort((a, b) => a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : b.severity === 'danger' ? 1 : a.severity === 'warn' ? -1 : 1), actions };
}

/** Авто-подбор конфига ББ-шоу (безопасные дефолты + рекомендации). */
export function recommendBBShowConfig(plan: BBContestPrepPlan): Partial<BBContestPrepConfig> {
  const patch: Partial<BBContestPrepConfig> = {};
  if (!plan.taper.enabled) patch.trainingProtocol = 'bb';
  // Фаза 3.32: legacy-алиасы 'minimal'/'constant' → канон 'stable'.
  if (!plan.peakWeek.enabled) { patch.waterStrategy = 'stable'; patch.sodiumStrategy = 'stable'; patch.carbLoadStrategy = 'moderate'; }
  if (plan.safety.requiresReview) { patch.waterStrategy = 'stable'; patch.sodiumStrategy = 'stable'; }
  return patch;
}
