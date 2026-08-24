import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { derivePattern } from '../../movement-pattern';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('AUDIT FULL MATRIX', () => {
  it('no duplicate isolation patterns per session across all splits/levels/goals', () => {
    const levels = ['beginner','intermediate','advanced','enhanced'] as const;
    const goals = ['mass','cut','recomp','strength_mass'] as const;
    const patterns = SPLIT_PATTERNS.slice(0, 5); // sample 5 splits for speed
    let total = 0;
    for (const split of patterns) {
      for (const level of levels) {
        for (const goal of goals) {
          const plan = buildBBPlan({ patternId: split.id, level, goal, weeks: 1, workMax: WM });
          for (const sess of plan.weeks[0].sessions) {
            const seen = new Map<string, number>();
            for (const ex of sess.exercises) {
              if ((ex as any).warmupActivator) continue;
              const pat = derivePattern({ name: ex.name, group: ex.muscle, type: (ex as any).exerciseType } as any);
              const key = ex.muscle + ':' + pat;
              const isIso = pat.startsWith('isolation') || ['isolation_chest','isolation_back','isolation_legs_quad','isolation_legs_ham','isolation_calves','isolation_arms','core'].includes(pat) || /fly|pullover|leg_ext|leg_curl|calf_raise/.test(pat);
              // For isolation, allow 1 per session per muscle for most, 2 for leg_ext even at intermediate (quads need 2 for volume) and for advanced/enhanced
              if (isIso) {
                const limit = (pat === 'isolation_legs_quad' || level === 'advanced' || level === 'enhanced') ? 2 : 1;
                const count = seen.get(key) || 0;
                if (count >= limit) {
                  // eslint-disable-next-line no-console
                  console.log(`DUP isolation ${pat} in ${sess.sessionTag} ${ex.name} level=${level} goal=${goal} split=${split.id} count=${count}`);
                }
                expect(count).toBeLessThan(limit);
                seen.set(key, count+1);
              }
            }
          }
          total++;
        }
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it('descriptions are program-specific (contain weak/phase/selection)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['chest_upper'] });
    const push = plan.weeks[0].sessions.find(s=>s.sessionTag==='Push')!;
    const ex = push.exercises.find(e=>e.muscle==='chest' && /наклон|incline/i.test(e.name));
    expect(ex).toBeDefined();
    expect(ex!.comment).toContain('Отстающая');
    expect(ex!.comment).toContain('Накопление');
    expect(ex!.comment.length).toBeGreaterThan(50);
    // Should contain selection rationale or phase (темп/отдых — регистр может варьировать)
    expect(ex!.comment).toMatch(/Темп|отдых/i);
  });

  it('all generation paths produce valid plans', () => {
    const splits = ['ppl_6','upper_lower_4','fullbody_3'];
    for (const pid of splits) {
      const p1 = buildBBPlan({ patternId: pid, level: 'intermediate', goal: 'mass', weeks: 2, workMax: WM });
      expect(p1.weeks.length).toBe(2);
      expect(p1.weeks[0].sessions.length).toBeGreaterThan(0);
    }
  });
});
