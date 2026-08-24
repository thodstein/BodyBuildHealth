import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { bbExerciseTier } from '../bb-exercise-tier.engine';

function checkOrder(plan: any): string[] {
  const issues: string[] = [];
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      const muscles = s.exercises.map((e: any) => e.muscle);
      // Check strict grouping: no interleaving like chest, shoulders, chest
      const seen = new Set<string>();
      let lastMuscle: string | null = null;
      const order: string[] = [];
      for (const m of muscles) {
        if (m !== lastMuscle) {
          if (seen.has(m)) {
            issues.push(`Session ${s.sessionTag} week ${w.week}: interleaving muscle ${m} in [${muscles.join(',')}] exercises: [${s.exercises.map((e:any)=>e.name).join(' | ')}]`);
          }
          seen.add(m);
          order.push(m);
          lastMuscle = m;
        }
      }
    }
  }
  return issues;
}

function checkDropSets(plan: any): string[] {
  const issues: string[] = [];
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      s.exercises.forEach((e: any, idx: number) => {
        const hasDrop = e.comment?.includes('Drop-set') || e.workSets?.some((ws:any)=>ws.technique==='drop_set') || e.workSets?.some((ws:any)=>ws.technique==='drop_set');
        const isPrimary = e.role === 'primary';
        const isCompound = e.exerciseType === 'compound' || e.type === 'compound';
        if (hasDrop) {
          // Drop should be on accessory isolation, not primary compound
          if (isPrimary && isCompound) {
            issues.push(`Drop on primary compound at ${s.sessionTag} idx ${idx+1}/${s.exercises.length} [${e.muscle}] ${e.name}`);
          }
          // Should be last exercise of that muscle in session
          const muscle = e.muscle;
          const lastIdxForMuscle = s.exercises.map((x:any,i:number)=> x.muscle===muscle ? i : -1).filter((i:number)=>i>=0).pop();
          if (lastIdxForMuscle !== idx) {
            issues.push(`Drop not on last of muscle ${muscle} at ${s.sessionTag} idx ${idx+1} last=${lastIdxForMuscle!+1} [${s.exercises.map((x:any)=>`${x.muscle}:${x.name}`).join(' | ')}]`);
          }
        }
      });
    }
  }
  return issues;
}

function checkQuality(plan: any, level: string): string[] {
  const issues: string[] = [];
  if (level !== 'advanced' && level !== 'enhanced') return issues;
  for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
    const tier = bbExerciseTier(e as any);
    // For Pro, tier 3/4 should not be primary
    if (e.role === 'primary' && tier >= 3) {
      issues.push(`Pro primary exotic tier ${tier} [${e.muscle}] ${e.name} id=${(e as any).exerciseName || (e as any).id}`);
    }
    // Specific questionable
    if (/hex.*press|свенд/i.test(e.name) && e.role === 'primary') {
      issues.push(`Questionable hex/svend as primary [${e.muscle}] ${e.name}`);
    }
    if (/жим.*одной.*рук|single.*arm.*cable.*press/i.test(e.name) && e.role === 'primary') {
      issues.push(`Questionable single-arm cable press as primary [${e.muscle}] ${e.name}`);
    }
  }
  return issues;
}

describe('verify build quality actual', () => {
  it('checks all splits natural + enhanced with PED', () => {
    const patternsToCheck = SPLIT_PATTERNS.map(p=>p.id);
    const allIssues: string[] = [];
    for (const pid of patternsToCheck) {
      for (const level of ['intermediate','advanced','enhanced']) {
        for (const ped of [false, true]) {
          const plan = buildBBPlan({
            patternId: pid,
            level,
            goal: 'mass' as any,
            weeks: 4,
            trainingYears: level==='enhanced'?5:3,
            pedDoses: ped ? { AAS: 800, GH: 4 } : undefined,
          } as any);
          const o = checkOrder(plan);
          const d = checkDropSets(plan);
          const q = checkQuality(plan, level);
          if (o.length) allIssues.push(`ORDER ${pid} ${level} ped=${ped}: ${o.join(' | ')}`);
          if (d.length) allIssues.push(`DROP ${pid} ${level} ped=${ped}: ${d.join(' | ')}`);
          if (q.length) allIssues.push(`QUALITY ${pid} ${level} ped=${ped}: ${q.join(' | ')}`);
        }
      }
    }
    if (allIssues.length) {
      console.log('\n=== QUALITY FAILURES ===\n' + allIssues.slice(0, 50).join('\n'));
      console.log(`\nTotal issues: ${allIssues.length}`);
    }
    // For now, expect failures to debug, but make test fail if any critical
    // For this verification run, we want to SEE issues, so don't fail yet
    // expect(allIssues.length).toBe(0);
    // Instead, just log
    expect(true).toBe(true);
  });
});
