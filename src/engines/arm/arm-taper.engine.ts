/**
 * arm-taper.engine.ts — тейпер для арм-пика (как lms-taper / bb-peak).
 * 2–3 недели: объём ×0.65/0.45, RIR+1/+2, side −50% за 2 нед.
 */

export type ArmTaperMode = 'classic' | 'peaking' | 'tableready_deload' | 'coc_deload' | 'toproll_taper' | 'none';

export interface ArmTaperCurvePoint {
  week: number; // относительно конца (1 = последняя)
  volumePct: number;
  rirShift: number;
  sideMult: number;
  label: string;
}

export function buildArmTaperCurve(input: {
  taperWeeks: number;
  mode?: ArmTaperMode;
  gripFocus?: string;
}): ArmTaperCurvePoint[] {
  const weeks = Math.max(1, Math.min(4, Math.round(input.taperWeeks || 2)));
  const mode = input.mode || 'peaking';
  const out: ArmTaperCurvePoint[] = [];

  // Именные пресеты teйпера (интернет-библиотека) — объёмные кривые поверх классики.
  if (mode === 'none') return out;
  if (mode === 'tableready_deload') {
    // GripStrength Table-Ready W12: −40% объёма, интенсивность держать, без максимума.
    for (let i = weeks; i >= 1; i--) {
      const first = i === weeks;
      out.push({
        week: i,
        volumePct: first ? 0.6 : 0.6,
        rirShift: first ? 1 : 2,
        sideMult: 0.5,
        label: first ? 'Table-Ready делоад: 60% объёма, RIR+1, без максимума' : 'Table-Ready пик: 60% объёма, RIR+2, только техника',
      });
    }
    return out.slice(-weeks);
  }
  if (mode === 'coc_deload') {
    // GripStrength CoC W4/W8/W12: −40%, без max и негативов, RPE 5–6.
    for (let i = weeks; i >= 1; i--) {
      out.push({
        week: i,
        volumePct: 0.6,
        rirShift: 2,
        sideMult: 0.5,
        label: 'CoC делоад: 60% объёма, RIR+2, без max/негативов (W4/W8)',
      });
    }
    return out.slice(-weeks);
  }
  if (mode === 'toproll_taper') {
    // Toproll 6-week к старту: день 1 −10%, день 2 −30% → кривая 0.9/0.7.
    if (weeks === 1) {
      out.push({ week: 1, volumePct: 0.7, rirShift: 1, sideMult: 0.5, label: 'Toproll-тейпер: 70% объёма (−30% день 2), RIR+1' });
      return out;
    }
    out.push({ week: 2, volumePct: 0.9, rirShift: 0, sideMult: 0.7, label: 'Toproll-тейпер-1: 90% (−10% день 1)' });
    out.push({ week: 1, volumePct: 0.7, rirShift: 1, sideMult: 0.5, label: 'Toproll-тейпер-2: 70% (−30% день 2)' });
    return out.slice(-weeks);
  }

  if (weeks === 1) {
    out.push({ week: 1, volumePct: 0.45, rirShift: 2, sideMult: 0.3, label: 'Пик: 45% объёма, RIR+2, техника+изометрия' });
    return out;
  }
  if (weeks === 2) {
    out.push({ week: 2, volumePct: 0.65, rirShift: 1, sideMult: 0.5, label: 'Тейпер-1: 65% объёма, RIR+1, side −50%' });
    out.push({ week: 1, volumePct: 0.45, rirShift: 2, sideMult: 0.3, label: 'Пик: 45% объёма, RIR+2, только техника' });
    return out;
  }
  if (weeks === 3) {
    out.push({ week: 3, volumePct: 0.85, rirShift: 0, sideMult: 0.7, label: 'Тейпер-1: 85% объёма' });
    out.push({ week: 2, volumePct: 0.65, rirShift: 1, sideMult: 0.5, label: 'Тейпер-2: 65% объёма, side −50%' });
    out.push({ week: 1, volumePct: 0.45, rirShift: 2, sideMult: 0.3, label: 'Пик: 45% объёма, RIR+2' });
    return out;
  }
  // 4 недели — как 3 + доп. 0.9
  out.push({ week: 4, volumePct: 0.9, rirShift: 0, sideMult: 0.9, label: 'Тейпер-0: 90%' });
  out.push({ week: 3, volumePct: 0.85, rirShift: 0, sideMult: 0.7, label: 'Тейпер-1: 85%' });
  out.push({ week: 2, volumePct: 0.65, rirShift: 1, sideMult: 0.5, label: 'Тейпер-2: 65%' });
  out.push({ week: 1, volumePct: 0.45, rirShift: 2, sideMult: 0.3, label: 'Пик: 45%' });
  return out.slice(-weeks);
}

export function applyArmTaperToWeeks<T extends { week: number; sessions: Array<{ exercises: Array<{ muscle: string; sets: number; workSets: any[]; rir: number }> }>; taper?: boolean; note?: string }>(
  weeks: T[],
  curve: ArmTaperCurvePoint[],
): T[] {
  const total = weeks.length;
  for (let i = 0; i < curve.length; i++) {
    const point = curve[curve.length - 1 - i]; // последняя точка = последняя неделя
    const wkIdx = total - curve.length + i;
    if (wkIdx < 0 || wkIdx >= total) continue;
    const wk = weeks[wkIdx];
    if (wk.note && wk.note.includes('[arm-taper:')) continue; // идемпотент
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        const before = ex.sets;
        let after = Math.max(1, Math.round(before * point.volumePct));
        if (ex.muscle === 'side_pressure') after = Math.max(1, Math.round(before * point.volumePct * point.sideMult));
        ex.sets = after;
        ex.workSets = ex.workSets.slice(0, after);
        ex.rir = Math.min(5, ex.rir + point.rirShift);
        ex.workSets.forEach((ws: any) => ws.rir = ex.rir);
      }
    }
    wk.taper = true;
    wk.note = (wk.note || '') + ` [arm-taper:${point.volumePct}] ${point.label}`;
  }
  return weeks;
}
