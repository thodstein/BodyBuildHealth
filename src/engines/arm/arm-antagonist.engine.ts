/**
 * arm-antagonist.engine.ts — минимум антагонистов (локоть/плечо).
 *
 * Источники: RU-методика (антагонисты 1–2×/нед в конце или отдельным днём,
 * 2–3×12–15 памп/жжение, не сила) + IronMind (expanders 2×10–15 каждую
 * сессию) + школьная таблица агонист/антагонист (flex/ext, pron/sup,
 * fingers flex/ext, biceps/triceps) + внутренний wrist-balance 1.5×.
 *
 * Проверка по недельному объёму плана: только warnings. Чистый модуль.
 */

export interface AntagonistWeek {
  wristFlex: number;
  wristExt: number;
  pron: number;
  sup: number;
  fingerFlexSets: number; // cup/crush/rising как сгибатели пальцев
  fingerExtSets: number; // containment/резина-разведения
  shoulderIntSets: number;
}

export interface AntagonistResult {
  warnings: string[];
  note: string;
}

export function weekToAntagonistWeek(vol: Record<string, number>): AntagonistWeek {
  const g = (k: string) => Number(vol[k] || 0);
  return {
    wristFlex: g('wrist_flexors'),
    wristExt: g('wrist_extensors'),
    pron: g('pronators'),
    sup: g('supinators'),
    fingerFlexSets: g('wrist_flexors') + g('grip_crush') + g('risers'),
    fingerExtSets: g('risers') + g('thumb'),
    shoulderIntSets: g('shoulder_stab'),
  };
}

export function checkAntagonistMinimum(w: AntagonistWeek, weekNo: number): AntagonistResult {
  const warnings: string[] = [];
  const tag = `Н${weekNo}`;
  // разгибатели кисти: минимум 2 сета при рабочем flex ≥6 (школа: 2–3×12–15)
  if (w.wristFlex >= 6 && w.wristExt < 2)
    warnings.push(`${tag}: антагонисты — wrist_ext ${w.wristExt} <2 при flex ${w.wristFlex} (нужно 2–3×12–15 лёгко, локоть).`);
  // супинация при пронации ≥6 (UCL-баланс, паритет с injury-guard)
  if (w.pron >= 6 && w.sup < 2)
    warnings.push(`${tag}: антагонисты — sup ${w.sup} <2 при pron ${w.pron} (баланс pron/sup, иначе UCL).`);
  // разгибатели пальцев: containment/резина при большом crush/rising
  if (w.fingerFlexSets >= 8 && w.fingerExtSets < 2)
    warnings.push(`${tag}: антагонисты — разгибатели пальцев ${w.fingerExtSets} <2 при сгибателях ${w.fingerFlexSets} (резина-разведения 3×20–25).`);
  // плечо: ротаторы high-rep уже проверяет shoulder-guard; здесь только отсутствие при side
  const note =
    warnings.length === 0
      ? `${tag}: антагонисты закрыты (ext/sup/fingers).`
      : `${tag}: добрать ${warnings.length} антагонист-блок(а) лёгко 12–20, RIR≥2.`;
  return { warnings, note };
}

export function checkAntagonistPlan(weekly: Record<number, Record<string, number>>): { warnings: string[]; notes: string[] } {
  const warnings: string[] = [];
  const notes: string[] = [];
  for (const [wk, vol] of Object.entries(weekly)) {
    const r = checkAntagonistMinimum(weekToAntagonistWeek(vol as Record<string, number>), Number(wk));
    warnings.push(...r.warnings);
    notes.push(r.note);
  }
  return { warnings, notes };
}
