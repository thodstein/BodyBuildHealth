/**
 * strength-sport-sm-hold-event.engine.ts — УДЕРЖАНИЯ ПОД ИВЕНТ (SM PRO P5)
 *
 * Геркулес (WSM): столбы 160 кг/рука без лимита времени; Феликс 87.52 с (2019);
 * Уильямс 82.14 с при 159 кг/рука — мировой рекорд WSM 2025. Шкала по эффективному
 * времени (сек × нагрузка/160): ≥80 элита · ≥45 соревновательный · ≥25 развивающийся ·
 * <25 слабо. Медли: падения/подборы/потеря на развороте — 0 ок · 1 внимание ·
 * ≥2 крит (темп рвётся переходами 5 с, см. buildMedleyPlan).
 *
 * Чистый движок, без UI/storage.
 */

export const HERCULES_REF_KG = 160;

export interface SMHoldEventInput {
  herculesSec?: number | null;
  herculesKg?: number | null; // нагрузка на руку
  medleyDrops?: number | null; // падения/подборы в медли
}

export interface SMHoldEventResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  effectiveSec: number | null;
  lines: string[];
}

export function diagnoseSMHoldEvent(input: SMHoldEventInput): SMHoldEventResult | null {
  const sec = input.herculesSec;
  const lines: string[] = [];
  let bad = 0;
  let effectiveSec: number | null = null;
  if (sec != null && Number.isFinite(sec) && (sec as number) > 0) {
    const load = input.herculesKg != null && Number.isFinite(input.herculesKg) && (input.herculesKg as number) > 0
      ? (input.herculesKg as number)
      : HERCULES_REF_KG;
    effectiveSec = Math.round((sec as number) * (load / HERCULES_REF_KG) * 10) / 10;
    if (effectiveSec >= 80) {
      lines.push(`Геркулес ${sec} с @${load} кг (эфф. ${effectiveSec} с) — элита (рекорд 82–87 с)`);
    } else if (effectiveSec >= 45) {
      lines.push(`Геркулес ${sec} с @${load} кг (эфф. ${effectiveSec} с) — соревновательный уровень, цель 80 с`);
    } else if (effectiveSec >= 25) {
      bad++;
      lines.push(`Геркулес ${sec} с @${load} кг (эфф. ${effectiveSec} с) < 45 с — развивающийся: статика 3×макс/нед + магнезия`);
    } else {
      bad += 2;
      lines.push(`Геркулес ${sec} с @${load} кг (эфф. ${effectiveSec} с) < 25 с — провал: фермер-статия 4×30 с + толстый гриф`);
    }
  }
  const drops = input.medleyDrops;
  if (drops != null && Number.isFinite(drops) && (drops as number) >= 0) {
    if ((drops as number) === 0) {
      lines.push('Медли: 0 падений — переходы чистые');
    } else if ((drops as number) === 1) {
      bad++;
      lines.push('Медли: 1 падение — подборы без потери темпа (переход 5 с) + разворот без остановки');
    } else {
      bad += 2;
      lines.push(`Медли: ${drops} падения — темп рвётся: связки подбор→разворот 5× + хват до 60 с`);
    }
  }
  if (!lines.length) return null;
  const verdict: SMHoldEventResult['verdict'] = bad === 0 ? 'ok' : bad >= 2 ? 'critical' : 'warn';
  return { valid: true, verdict, effectiveSec, lines };
}
