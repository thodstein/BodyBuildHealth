/**
 * Итерация K: заявленная в плане частота мышц = ФАКТ плана.
 *
 * До правки строка `Частота на группу/нед: …` считалась по РАСПИСАНИЮ сплита
 * (`musclesForTag`: «в каждом FullBody-дне есть бицепс»). Замер на матрице 512
 * планов дал 902 расхождения: например `fullbody_3`/новичок обещал
 * `biceps=3×`, а прямой работы на бицепс — 1-2 сессии из 3 (остальное —
 * косвенная нагрузка компаундных тяг).
 */
import { buildBBPlan, WEAK_TO_MUSCLE } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import {
  FREQUENCY_LINE_PREFIX,
  formatFrequencyClaim,
  reconcileFrequencyClaim,
  sessionHasDirectWork,
  sessionsWithMuscleInWeek,
  weeklyFrequencyFacts,
  type MuscleFrequencyFact,
} from '../bb-frequency';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const canonical = (m: string) => (WEAK_TO_MUSCLE as Record<string, string>)[m] || m;

/** Разбор строки плана в факты (min/max по рабочим неделям). */
function parseClaim(plan: any): Record<string, { min: number; max: number }> {
  const line = (plan.rationale || []).find((r: string) => String(r).startsWith(FREQUENCY_LINE_PREFIX));
  const out: Record<string, { min: number; max: number }> = {};
  if (!line) return out;
  const tail = line.replace(/^Частота на группу\/нед( \(факт\))?:/, '');
  for (const part of tail.split(',')) {
    const m = part.trim().match(/^([a-z_]+)=(\d+)(?:-(\d+))?×$/);
    if (m) out[m[1]] = { min: Number(m[2]), max: Number(m[3] ?? m[2]) };
  }
  return out;
}

function claimLines(plan: any): string[] {
  return (plan.rationale || []).filter((r: string) => String(r).startsWith(FREQUENCY_LINE_PREFIX));
}

const session = (...exercises: any[]) => ({ exercises });

describe('bb-frequency: модель «сессия даёт мышце работу»', () => {
  it('пучок засчитывается по неклассифицированному остатку shoulders', () => {
    const s = session({ muscle: 'shoulders', name: 'Махи гантелями в стороны', sets: 3, role: 'accessory', character: 'памп' });
    expect(sessionHasDirectWork(s, 'delt_mid')).toBe(true);
  });

  it('ключ shoulders засчитывается по любому пучку (обратная симметрия)', () => {
    const s = session({ muscle: 'delt_rear', name: 'Разведения в наклоне', sets: 3, role: 'accessory', character: 'памп' });
    expect(sessionHasDirectWork(s, 'shoulders')).toBe(true);
  });

  it('алиас (chest_upper -> chest) учитывается через инжектированную канонизацию', () => {
    const s = session({ muscle: 'chest_upper', name: 'Жим гантелей на наклонной', sets: 4, role: 'primary', character: 'тяж' });
    expect(sessionHasDirectWork(s, 'chest', canonical)).toBe(true);
  });

  it('чужая мышца не засчитывается', () => {
    const s = session({ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary', character: 'тяж' });
    expect(sessionHasDirectWork(s, 'biceps')).toBe(false);
  });

  it('частота недели = число сессий с прямой работой', () => {
    const week = {
      sessions: [
        session({ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary', character: 'тяж' }),
        session({ muscle: 'chest', name: 'Жим гантелей лёжа', sets: 3, role: 'accessory', character: 'памп' }),
        session({ muscle: 'quads', name: 'Приседания со штангой', sets: 4, role: 'primary', character: 'тяж' }),
      ],
    };
    expect(sessionsWithMuscleInWeek(week, 'chest')).toBe(2);
  });

  it('делод и тейпер не занижают обещание частоты', () => {
    const plan: any = {
      muscleFrequency: { chest: 2 },
      weeks: [
        { week: 1, sessions: [
          session({ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary', character: 'тяж' }),
          session({ muscle: 'chest', name: 'Жим гантелей лёжа', sets: 3, role: 'accessory', character: 'памп' }),
        ] },
        { week: 2, phase: 'deload', sessions: [
          session({ muscle: 'chest', name: 'Жим штанги лёжа', sets: 2, role: 'primary', character: 'тяж' }),
        ] },
        { week: 3, phase: 'deload', sessions: [] },
        { week: 4, contestPhase: 'peak', sessions: [] },
      ],
    };
    const { facts, weeksCounted } = weeklyFrequencyFacts(plan, { canonical });
    expect(weeksCounted).toBe(1);
    expect(facts.chest).toEqual({ muscle: 'chest', min: 2, max: 2, perWeek: [2] });
  });

  it('formatFrequencyClaim: стабильно — одно число, меняется — диапазон', () => {
    const facts: Record<string, MuscleFrequencyFact> = {
      chest: { muscle: 'chest', min: 2, max: 2, perWeek: [2, 2] },
      biceps: { muscle: 'biceps', min: 1, max: 2, perWeek: [2, 1] },
    };
    expect(formatFrequencyClaim(facts, ['chest', 'biceps'])).toBe('chest=2×, biceps=1-2×');
  });
});

describe('bb-frequency: сверка в плане', () => {
  it('строка переписывается по факту ровно один раз (идемпотентно)', () => {
    const plan: any = {
      muscleFrequency: { chest: 3, biceps: 3 },
      rationale: [`${FREQUENCY_LINE_PREFIX}: chest=3×, biceps=3×`],
      weeks: [{
        week: 1,
        sessions: [
          session({ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary', character: 'тяж' }),
          session({ muscle: 'biceps', name: 'Подъём штанги на бицепс', sets: 3, role: 'accessory', character: 'памп' }),
        ],
      }],
    };
    reconcileFrequencyClaim(plan, { canonical });
    reconcileFrequencyClaim(plan, { canonical });
    reconcileFrequencyClaim(plan, { canonical });
    expect(claimLines(plan).length).toBe(1);
    expect(claimLines(plan)[0]).toBe(`${FREQUENCY_LINE_PREFIX} (факт): chest=1×, biceps=1×`);
  });

  it('легаси-текст без фактического значения не остаётся в плане', () => {
    const plan: any = {
      muscleFrequency: { chest: 1 },
      rationale: [`${FREQUENCY_LINE_PREFIX}: chest=1×`],
      weeks: [{ week: 1, sessions: [session({ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary', character: 'тяж' })] }],
    };
    reconcileFrequencyClaim(plan, { canonical });
    expect((plan.rationale as string[]).some((r) => /^Частота на группу\/нед: /.test(r))).toBe(false);
  });

  it('факт меньше расписания -> в плане есть объясняющая заметка (один раз)', () => {
    const plan: any = {
      muscleFrequency: { biceps: 3 },
      rationale: [],
      weeks: [{ week: 1, sessions: [session({ muscle: 'biceps', name: 'Подъём штанги на бицепс', sets: 3, role: 'accessory', character: 'памп' })] }],
    };
    const first = reconcileFrequencyClaim(plan, { canonical });
    expect(first.lowerThanPlanned).toEqual([{ muscle: 'biceps', planned: 3, factMax: 1 }]);
    reconcileFrequencyClaim(plan, { canonical });
    expect(claimLines(plan).length).toBe(1);
  });
});

describe('bb-frequency: инвариант «обещание = факт» на реальных планах', () => {
  const levels = ['beginner', 'advanced'] as const;
  const goals = ['mass', 'cut'] as const;
  const variants: Array<{ tag: string; extra: any }> = [
    { tag: 'base', extra: {} },
    { tag: 'weak-chest', extra: { weakPoints: ['chest_upper'] } },
    { tag: 'dumbbell', extra: { equipment: ['dumbbell', 'bodyweight'] } },
  ];
  const splits = SPLIT_PATTERNS.filter((s) => ['fullbody_3', 'upper_lower_4', 'ppl_6'].includes(s.id));

  it('каждое число в строке частоты совпадает с фактом плана', () => {
    let checked = 0;
    for (const split of splits) {
      for (const level of levels) {
        for (const goal of goals) {
          for (const v of variants) {
            const plan: any = buildBBPlan({ patternId: split.id, level, goal, weeks: 2, workMax: WM, ...v.extra });
            expect(claimLines(plan).length).toBe(1);
            const claim = parseClaim(plan);
            const { facts } = weeklyFrequencyFacts(plan, { canonical });
            expect(Object.keys(claim).length).toBeGreaterThan(0);
            for (const [m, f] of Object.entries(facts)) {
              const c = claim[m];
              expect(c, `${split.id}/${level}/${goal}/${v.tag}: в строке нет ключа ${m}`).toBeDefined();
              expect({ min: c.min, max: c.max }, `${split.id}/${level}/${goal}/${v.tag}: ${m}`).toEqual({ min: f.min, max: f.max });
            }
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(splits.length * levels.length * goals.length * variants.length);
  }, 600000);

  it('обещание никогда не выше факта (ошибка класса «3× в расписании, 1× в плане»)', () => {
    for (const variant of variants) {
      const plan: any = buildBBPlan({ patternId: 'fullbody_3', level: 'beginner', goal: 'mass', weeks: 2, workMax: WM, ...variant.extra });
      const claim = parseClaim(plan);
      const { facts } = weeklyFrequencyFacts(plan, { canonical });
      for (const [m, c] of Object.entries(claim)) {
        expect(c.max, `${variant.tag}: ${m} обещает ${c.max}× при факте ${facts[m]?.max}×`).toBeLessThanOrEqual(facts[m].max);
      }
    }
  });
});
