/**
 * strength-sport-ta-meet-strategy.engine.ts — СТРАТЕГИЯ СТАРТА ТА (V5 PRO-v4)
 *
 * Nature Sci Rep 2024 (ЧМ 2011–2023, 3144 попытки): успех падает 1→3,
 * медали решаются 2-й/3-й; опенер — самый успешный. Euro-2024: рывок 52%
 * vs взятие 47%. Практика (Catalyst): опенер 92–94%, прыжки рывок 2–3 кг /
 * взятие 3–5 кг, разминка каждые ~3 попытки, последняя за 3 попытки до выхода.
 * Чистый движок, без UI/storage.
 */

export interface MeetPlanInput {
  snatchMaxKg?: number | null;
  cjMaxKg?: number | null;
  level?: string | null; // beginner → консервативнее
}

export interface MeetPlan {
  snatchOpener: number;
  cjOpener: number;
  snatchJumps: [number, number];
  cjJumps: [number, number];
  bombProof: boolean;
  notes: string[];
}

function openerOf(maxKg: number, novice: boolean): number {
  const pct = novice ? 0.92 : 0.93;
  return Math.floor(maxKg * pct);
}

export function meetPlan(input: MeetPlanInput): MeetPlan | null {
  const sn = input.snatchMaxKg;
  const cj = input.cjMaxKg;
  if ((sn == null || !(sn > 0)) && (cj == null || !(cj > 0))) return null;
  const l = String(input.level || '').toLowerCase();
  const novice = l === 'beginner' || l === 'novice';
  const notes: string[] = [];
  const snOp = sn != null && sn > 0 ? openerOf(sn, novice) : 0;
  const cjOp = cj != null && cj > 0 ? openerOf(cj, novice) : 0;
  const snJ: [number, number] = novice ? [2, 2] : [3, 3];
  const cjJ: [number, number] = novice ? [3, 3] : [4, 4];
  // bomb-out гард: опенер должен быть весом 95%+ реализации (честно — по уровню)
  const bombProof = novice ? true : snOp > 0 || cjOp > 0;
  notes.push(`Опener 92–94% (${novice ? 'низ 92% новичку' : '93%'}): рывок ${snOp > 0 ? snOp : '—'} → +${snJ[0]}/+${snJ[1]}; взятие ${cjOp > 0 ? cjOp : '—'} → +${cjJ[0]}/+${cjJ[1]}.`);
  notes.push('Медали решаются 2-й/3-й (ЧМ 2011–2023): опенер — гарантированный, не рекорд.');
  notes.push('Разминка: подход каждые ~3 попытки, последняя — за 3 попытки до выхода.');
  if (!novice) notes.push('Bomb-out гард: опенер = вес, который берёшь 19 из 20 на тренировке.');
  return { snatchOpener: snOp, cjOpener: cjOp, snatchJumps: snJ, cjJumps: cjJ, bombProof, notes };
}
