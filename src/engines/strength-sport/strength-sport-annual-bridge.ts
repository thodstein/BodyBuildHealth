/**
 * strength-sport-annual-bridge.ts — мост SS annual → общий annual-training (MANUAL блоки).
 * Изолировано, не мутирует annual-training движок, только пишет localStorage.
 */
import type { StrengthSportPlan } from './strength-sport.types';
import type { AnnualSS } from './strength-sport-annual';
import { saveAnnualSS } from './strength-sport-annual';

export function ssPlanToUserWeeks(plan: StrengthSportPlan): any[] {
  return plan.weeksData.map(w => ({
    week: w.week,
    phase: w.phase,
    deload: !!w.deload,
    sessions: w.sessions.map(s => ({
      id: `ss-${w.week}-${s.day}`,
      name: s.sessionTag,
      dayOfWeek: s.day - 1,
      focus: s.focus || s.sessionTag,
      blocks: s.exercises.map(ex => ({
        id: `blk-${ex.id}`,
        type: ex.role === 'primary' ? 'compound' : 'accessory',
        exerciseName: ex.name,
        muscle: ex.group,
        role: ex.role,
        sets: ex.workSets.map(ws => ({ reps: ws.reps, rir: ws.rir, restSec: ws.restSeconds, note: ws.tempo ? `tempo ${ws.tempo}` : undefined })),
        note: ex.comment,
      })),
    })),
  }));
}

export function syncStrengthAnnualToGeneral(annual: AnnualSS): void {
  try {
    const raw = localStorage.getItem('he_annual_training_plan_v1');
    if (!raw) {
      // нет общего годового — создаём минимальный из SS, выносим taper отдельной фазой если есть (как в annual-training/block-builders)
      const general = {
        id: `annual_${Date.now()}`,
        version: 1,
        totalWeeks: annual.totalWeeks,
        direction: 'mixed',
        macroRef: null,
        blocks: annual.blocks.flatMap(b => {
          const taperWeeks = b.taperWeeks && b.competitionDate ? Math.max(1, Math.min(2, b.taperWeeks)) : 0;
          if (taperWeeks > 0 && b.plan && b.weeks > taperWeeks) {
            const mainWeeks = b.weeks - taperWeeks;
            return [
              {
                ref: { blockKey: b.id, blockIndex: 0, kind: 'MANUAL', phase: 'strength', startWeek: b.startWeek, weeks: mainWeeks, description: `SS ${b.mode} ${mainWeeks}нед` },
                config: { notes: `SS ${b.mode} ${b.plan?.mode || ''}` },
                status: 'built',
                result: b.plan ? { blockKey: b.id, kind: 'MANUAL', weeks: ssPlanToUserWeeks({ ...b.plan, weeksData: b.plan.weeksData.slice(0, mainWeeks) } as any), program: null, bbPlan: null, warnings: [], taperApplied: false, peakApplied: false, configHash: 'ss' } : undefined,
                builtAt: new Date().toISOString(),
              },
              {
                ref: { blockKey: `${b.id}-taper`, blockIndex: 1, kind: 'MANUAL', phase: 'taper', startWeek: b.startWeek + mainWeeks, weeks: taperWeeks, description: `SS taper ${taperWeeks}нед к ${b.competitionDate}` },
                config: { notes: `taper ${taperWeeks}нед`, taper: { enabled: true, weeks: taperWeeks } },
                status: 'built',
                result: b.plan ? { blockKey: `${b.id}-taper`, kind: 'MANUAL', weeks: ssPlanToUserWeeks({ ...b.plan, weeksData: b.plan.weeksData.slice(mainWeeks) } as any), program: null, bbPlan: null, warnings: [], taperApplied: true, peakApplied: false, configHash: 'ss-taper' } : undefined,
                builtAt: new Date().toISOString(),
              },
            ];
          }
          return [{
            ref: { blockKey: b.id, blockIndex: 0, kind: 'MANUAL', phase: 'strength', startWeek: b.startWeek, weeks: b.weeks, description: `SS ${b.mode} ${b.weeks}нед` },
            config: { notes: `SS ${b.mode} ${b.plan?.mode || ''}` },
            status: 'built',
            result: b.plan ? { blockKey: b.id, kind: 'MANUAL', weeks: ssPlanToUserWeeks(b.plan), program: null, bbPlan: null, warnings: [], taperApplied: !!b.taperWeeks, peakApplied: false, configHash: 'ss' } : undefined,
            builtAt: new Date().toISOString(),
          }];
        }),
        status: 'built',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('he_annual_training_plan_v1', JSON.stringify(general));
      window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated', { detail: general }));
      return;
    }
    const general = JSON.parse(raw);
    // добавляем/обновляем MANUAL блоки для SS (помечаем ss- prefix) — taper выносим отдельной фазой
    const existingKeys = new Set(general.blocks.map((b: any) => b.ref.blockKey));
    for (const b of annual.blocks) {
      if (!b.plan) continue;
      const key = `ss-${b.id}`;
      if (existingKeys.has(key)) continue;
      const taperWeeks = b.taperWeeks && b.competitionDate ? Math.max(1, Math.min(2, b.taperWeeks)) : 0;
      if (taperWeeks > 0 && b.weeks > taperWeeks) {
        const mainWeeks = b.weeks - taperWeeks;
        const mainKey = key;
        general.blocks.push({
          ref: { blockKey: mainKey, blockIndex: general.blocks.length, kind: 'MANUAL', phase: 'strength', startWeek: b.startWeek, weeks: mainWeeks, description: `SS ${b.mode} ${mainWeeks}нед` },
          config: { notes: `SS ${b.mode} ${b.plan.mode} ${mainWeeks}нед` },
          status: 'built',
          result: { blockKey: mainKey, kind: 'MANUAL', weeks: ssPlanToUserWeeks({ ...b.plan, weeksData: b.plan.weeksData.slice(0, mainWeeks) } as any), program: null, bbPlan: null, warnings: [], taperApplied: false, peakApplied: false, configHash: 'ss-bridge' },
          builtAt: new Date().toISOString(),
        });
        const taperKey = `${key}-taper`;
        if (!existingKeys.has(taperKey)) {
          general.blocks.push({
            ref: { blockKey: taperKey, blockIndex: general.blocks.length, kind: 'MANUAL', phase: 'taper', startWeek: b.startWeek + mainWeeks, weeks: taperWeeks, description: `SS taper ${taperWeeks}нед к ${b.competitionDate}` },
            config: { notes: `taper ${taperWeeks}нед`, taper: { enabled: true, weeks: taperWeeks } },
            status: 'built',
            result: { blockKey: taperKey, kind: 'MANUAL', weeks: ssPlanToUserWeeks({ ...b.plan, weeksData: b.plan.weeksData.slice(mainWeeks) } as any), program: null, bbPlan: null, warnings: [], taperApplied: true, peakApplied: false, configHash: 'ss-taper-bridge' },
            builtAt: new Date().toISOString(),
          });
        }
        general.totalWeeks = Math.max(general.totalWeeks, b.startWeek + b.weeks - 1);
        continue;
      }
      general.blocks.push({
        ref: { blockKey: key, blockIndex: general.blocks.length, kind: 'MANUAL', phase: 'strength', startWeek: b.startWeek, weeks: b.weeks, description: `SS ${b.mode} ${b.weeks}нед` },
        config: { notes: `SS ${b.mode} ${b.plan.mode} ${b.weeks}нед` },
        status: 'built',
        result: { blockKey: key, kind: 'MANUAL', weeks: ssPlanToUserWeeks(b.plan), program: null, bbPlan: null, warnings: [], taperApplied: !!b.plan.weeksData.some(w=> w.taper), peakApplied: false, configHash: 'ss-bridge' },
        builtAt: new Date().toISOString(),
      });
      general.totalWeeks = Math.max(general.totalWeeks, b.startWeek + b.weeks - 1);
    }
    general.updatedAt = new Date().toISOString();
    localStorage.setItem('he_annual_training_plan_v1', JSON.stringify(general));
    window.dispatchEvent(new CustomEvent('he-annual-training-plan-updated', { detail: general }));
    // также пишем синк-ключ
    localStorage.setItem('he_strength_annual_sync_v1', JSON.stringify({ updatedAt: new Date().toISOString(), totalWeeks: annual.totalWeeks, blocks: annual.blocks.map(b=> ({ startWeek: b.startWeek, weeks: b.weeks, mode: b.mode })) }));
  } catch {}
}
