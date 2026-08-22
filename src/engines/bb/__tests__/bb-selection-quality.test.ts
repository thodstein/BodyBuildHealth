import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const FORBIDDEN_PUSH = new Set(['back', 'quads', 'hamstrings', 'glutes', 'calves']);
const FORBIDDEN_PULL = new Set(['chest', 'quads', 'hamstrings', 'glutes', 'calves']);
// Ноги: верх не входит (кроме рук/пресса — существуют композитные теги LegsBiceps/LegsArms)
const FORBIDDEN_LOWER = new Set(['chest', 'back', 'shoulders', 'triceps']);

function sessionForbidden(sessionTag: string): Set<string> | null {
  const t = (sessionTag || '').toLowerCase();
  if (t.includes('push')) return FORBIDDEN_PUSH;
  if (t.includes('pull')) return FORBIDDEN_PULL;
  if (t.includes('lower') || t.includes('legs')) return FORBIDDEN_LOWER;
  return null;
}

function muscleOf(ex: any): string | null {
  return ex.muscle || null;
}

describe('BB-auto quality of exercise selection & comments', () => {
  it('no cross-contamination: Push has no back/legs, Pull no chest/legs, Lower no upper — across all splits×levels', () => {
    const levels = ['beginner', 'intermediate', 'advanced', 'enhanced'] as const;
    let built = 0;
    for (const split of SPLIT_PATTERNS) {
      for (const level of levels) {
        const plan = buildBBPlan({ patternId: split.id, level, goal: 'mass', weeks: 1, workMax: WM });
        for (const sess of plan.weeks[0].sessions) {
          const forbidden = sessionForbidden(sess.sessionTag || '');
          if (!forbidden) continue;
          for (const ex of sess.exercises) {
            const m = muscleOf(ex);
            if (m && forbidden.has(m)) {
              // eslint-disable-next-line no-console
              console.log(`CROSS-TAG ${split.id} ${level} ${sess.sessionTag} → ${ex.name} (muscle=${m})`);
            }
            expect(m === null || !forbidden.has(m)).toBe(true);
          }
        }
        built++;
      }
    }
    expect(built).toBe(SPLIT_PATTERNS.length * levels.length);
  });

  it('weak-point methodology applies: chest_upper → incline chest in Push, back_width → vertical pull in Pull', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['chest_upper', 'back_width'] });
    const push = plan.weeks[0].sessions.find(s => (s.sessionTag || '').toLowerCase().includes('push'))!;
    const pull = plan.weeks[0].sessions.find(s => (s.sessionTag || '').toLowerCase().includes('pull'))!;
    const incline = push.exercises.find(e => muscleOf(e) === 'chest' && /наклон|incline/i.test(e.name));
    expect(incline).toBeDefined();
    expect(incline!.comment).toContain('Отстающая');
    const vertical = pull.exercises.find(e => muscleOf(e) === 'back' && /подтяг|верхн|lat.?pull|пуллдаун|подъем|подъём/i.test(e.name));
    expect(vertical).toBeDefined();
  });

  it('no weak points → comments carry no "Отстающая" marker', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM });
    const comments = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).map(e => e.comment || '');
    expect(comments.some(c => c.includes('Отстающая'))).toBe(false);
  });

  it('comments are clean: no double punctuation, no duplicate tempo, typo fixed, explanation present', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['chest_upper'] });
    const exercises = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises);
    expect(exercises.length).toBeGreaterThan(0);
    for (const ex of exercises) {
      const c = ex.comment || '';
      if (!c) continue;
      expect(c).not.toContain('..');
      expect(c).not.toContain('?.');
      expect(c).not.toContain('!.');
      expect(c).not.toContain('. .');
      expect(c).not.toContain('шише');
      // Темп не должен дублироваться в одном комментарии
      const tempoCount = (c.match(/Темп:/g) || []).length;
      expect(tempoCount).toBeLessThanOrEqual(1);
      // Отдых не должен дублироваться
      const restCount = (c.match(/Отдых:/g) || []).length;
      expect(restCount).toBeLessThanOrEqual(1);
      // Каждый основной (не warmup/фидер/спец-инъекция) комментарий объясняет темп/отдых ИЛИ паттерн
      if (c.startsWith('🎯 Основное') || c.startsWith('📌 Добивочное')) {
        expect(c).toMatch(/Темп:|Паттерн:|Отдых:/);
      }
    }
  });

  it('primary exercises always explain tempo + rest', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2, workMax: WM });
    const primaries = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter(e => e.role === 'primary' && !(e as any).warmupActivator);
    expect(primaries.length).toBeGreaterThan(0);
    for (const ex of primaries) {
      expect(ex.comment).toMatch(/Темп:/);
      expect(ex.comment).toMatch(/отдых/i);
    }
  });
});
