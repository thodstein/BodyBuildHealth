/**
 * armlift-mobility.engine.ts — ROM-тесты под хват (PRO-5 D13).
 * Только армлифтинг-домен. Нормы — гониометрия кисти (внутренние ориентиры хаба,
 * не федеральные нормативы): разгибание запястья ≥70°, сгибание ≥75°,
 * оппозиция большого (достаёт до основания мизинца). Ретест через 2 нед.
 * Чистые функции.
 */

export interface ArmliftMobilityInput {
  wristExtDeg?: number | null;
  wristFlexDeg?: number | null;
  /** Оппозиция большого: достаёт до основания мизинца без боли. */
  thumbOppOk?: boolean | null;
}

export interface ArmliftMobilityResult {
  /** id проваленных тестов: wrist_ext | wrist_flex | thumb_opp. */
  fails: string[];
  passed: boolean;
  notes: string[];
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function assessArmliftMobility(i: ArmliftMobilityInput): ArmliftMobilityResult {
  const fails: string[] = [];
  const notes: string[] = [];
  const ext = num(i.wristExtDeg);
  if (ext != null) {
    if (ext < 60) { fails.push('wrist_ext'); notes.push(`Разгибание ${ext}° < 60° — жёстко`); }
    else if (ext < 70) { notes.push(`Разгибание ${ext}° — погранично (норма 70°)`); }
  }
  const flex = num(i.wristFlexDeg);
  if (flex != null) {
    if (flex < 65) { fails.push('wrist_flex'); notes.push(`Сгибание ${flex}° < 65° — жёстко`); }
    else if (flex < 75) { notes.push(`Сгибание ${flex}° — погранично (норма 75°)`); }
  }
  if (i.thumbOppOk === false) {
    fails.push('thumb_opp');
    notes.push('Оппозиция большого не дотягивает до мизинца');
  }
  return { fails, passed: fails.length === 0, notes };
}
