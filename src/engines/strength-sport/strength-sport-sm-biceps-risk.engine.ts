/**
 * strength-sport-sm-biceps-risk.engine.ts — КОЛИЧЕСТВЕННЫЙ РИСК БИЦЕПСА (SM PRO P4)
 *
 * Winwood 2014 (опрос 213 атлетов): бицепс — 11% травм стронга (2-е место с коленом);
 * шина + камни — слабые/уставшие бицепсы не передают силу плеча и корпуса.
 * IJSPT 2025 (Lorenz): механизм — согнутый локоть + супинация + пиковая тяга;
 * альтернатива — эксцентрик на разогнутой супинированной (становая разнохватом,
 * Kapicioglu 2021); травмы бицепса у стронгов выше ТА/ПЛ/ББ; 91% травм на ≥90% 1ПМ.
 * Баллы (кап 100): камень в плане +25 · разнохват +20 · интенсивность ≥95% +25
 * (≥90% +20) · согнутые руки +10 · хват-провалы ≥2 +15 · анамнез травмы +20.
 * ≥70 — гейт: запрет супинации и камня, только лямки/нейтраль (скрининг, не диагноз).
 *
 * Чистый движок, без UI/storage.
 */

export interface SMBicepsRiskInput {
  stonePlanned?: boolean | null; // камень/шина в плане
  mixedGrip?: boolean | null; // разнохват
  intensityPct?: number | null; // % от макса рабочего ивента
  armsBent?: boolean | null; // руки согнуты на камне/шине
  gripFails?: number | null; // провалы хвата 0–3
  historyBiceps?: boolean | null; // травма бицепса в прошлом
}

export interface SMBicepsRiskResult {
  valid: boolean;
  score: number; // 0–100
  level: 'low' | 'moderate' | 'high';
  gate: { blockSupinated: boolean; blockStone: boolean; allowOnly: string[] } | null;
  lines: string[];
}

export function scoreSMBicepsRisk(input: SMBicepsRiskInput): SMBicepsRiskResult {
  const lines: string[] = [];
  let score = 0;
  const add = (pts: number, text: string) => {
    score += pts;
    lines.push(`+${pts}: ${text}`);
  };
  if (input.stonePlanned) add(25, 'камень/шина в плане (топ-травма, Winwood)');
  if (input.mixedGrip) add(20, 'разнохват — супинация под нагрузкой');
  const inten = input.intensityPct;
  if (inten != null && Number.isFinite(inten) && inten > 0) {
    if (inten >= 95) add(25, `интенсивность ${inten}% ≥95% (91% травм — на ≥90%)`);
    else if (inten >= 90) add(20, `интенсивность ${inten}% ≥90%`);
  }
  if (input.armsBent) add(10, 'руки согнуты — бицепс держит вес (Hooper: прямые руки!)');
  if (input.gripFails != null && Number.isFinite(input.gripFails) && (input.gripFails as number) >= 2) {
    add(15, `хват-провалы ${input.gripFails}/3 — уставший хват не передаёт силу`);
  }
  if (input.historyBiceps) add(20, 'анамнез травмы бицепса');
  if (score > 100) score = 100;
  const level: SMBicepsRiskResult['level'] = score >= 70 ? 'high' : score >= 35 ? 'moderate' : 'low';
  const gate =
    level === 'high'
      ? { blockSupinated: true, blockStone: false, allowOnly: ['straps', 'neutral'] }
      : null;
  if (level === 'high') {
    lines.push('ГЕЙТ ≥70: запрет супинации — только лямки/нейтраль + к врачу (скрининг, не диагноз)');
  } else if (level === 'moderate') {
    lines.push('Умеренно: разминка бицепса + контроль супинации, камень — только прямыми руками');
  } else {
    lines.push('Низкий: держи прямые руки на камне и следи за хватом');
  }
  return { valid: true, score, level, gate, lines };
}
