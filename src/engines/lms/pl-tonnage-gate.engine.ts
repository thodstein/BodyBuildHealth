/**
 * pl-tonnage-gate.engine.ts — гейт недельного тоннажа (Sheiko: +7-10% в неделю → риск травмы)
 * Проверяет план на резкие скачки тоннажа и средней интенсивности.
 *
 * Аудит P1-8: гейт Шейко — про РОСТ тоннажа. Снижение (делод/тапер/пик-выход)
 * не является риском и раньше ложно помечалось «Скачок −50%» — теперь снижение
 * идёт отдельной справочной заметкой с flag 'ok'.
 */
import type { LMSBuildOutput } from './lms-builder.engine';
import { isPseudoExercise } from './lms-metrics.engine';

export type TonnageGateResult = { week: number; tonnage: number; prev: number; changePct: number; flag: 'ok' | 'warn' | 'danger'; note: string };

export function checkTonnageGate(plan: LMSBuildOutput, warnPct = 7, dangerPct = 10): TonnageGateResult[] {
  const weeks = plan.weeks.map(w => ({
    week: w.week,
    tonnage: w.days.reduce((a, d) => a + d.exercises.reduce((aa, e) => isPseudoExercise(e.name) ? aa : aa + e.workSets.reduce((aaa, ws) => aaa + ws.weight * ws.reps * ws.sets, 0), 0), 0),
  }));
  const out: TonnageGateResult[] = [];
  for (let i=1;i<weeks.length;i++) {
    const prev = weeks[i-1].tonnage, cur = weeks[i].tonnage;
    const changePct = prev>0 ? Math.round(((cur-prev)/prev)*1000)/10 : 0;
    const sign = changePct > 0 ? '+' : '';
    let flag: TonnageGateResult['flag'] = 'ok';
    let note = 'ок';
    if (prev > 0) {
      if (changePct > dangerPct) { flag = 'danger'; note = `Скачок ${sign}${changePct}% >${dangerPct}% — риск`; }
      else if (changePct > warnPct) { flag = 'warn'; note = `Рост ${sign}${changePct}% >${warnPct}% — осторожно`; }
      else if (changePct < -warnPct) { note = `Снижение ${changePct}% — разгрузка/тапер, не флаг`; }
    }
    out.push({ week: weeks[i].week, tonnage: cur, prev, changePct, flag, note });
  }
  return out;
}

export function avgIntensity(plan: LMSBuildOutput): number {
  let sumW=0,sumT=0;
  for (const w of plan.weeks) for (const d of w.days) for (const e of d.exercises) {
    if (isPseudoExercise(e.name)) continue;
    for (const ws of e.workSets) { sumW += ws.pct * ws.sets; sumT += ws.sets; }
  }
  return sumT? Math.round((sumW/sumT)*1000)/10 : 0;
}
