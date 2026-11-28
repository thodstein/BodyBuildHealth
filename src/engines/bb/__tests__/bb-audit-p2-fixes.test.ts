/**
 * bb-audit-p2-fixes.test.ts — регрессы на P2-находки аудитов 2026-11.
 *
 * Покрыто:
 * - P2-6: `buildBBQualityReport` / `calculatePlanSafetyScore` / `analyzePlanStress`
 *   не падают TypeError'ом на плане без `weeks` (импорт/частичный снапшот);
 * - P2-5: пустой `weeklyVolume` больше не печатает «-Infinity» в сообщении
 *   `target_volume_deficit`.
 * - P2-1 (финализация): головки дельт (`delt_*`) делят общий лимит упражнений «плечи».
 * - P2-2 (финализация): добивка дельт в финализаторе расходует место и по УПРАЖНЕНИЯМ,
 *   а не только по сетам (иначе `session_exercise_cap`).
 * - P2-1 (ядро): auto-MEV-feeder не добавляет упражнения в делод/тапер-недели.
 * - P2-2 (ядро): `schemeActive` считается по `effVolumeScheme` — понижение схемы
 *   объёма до 'standard' не выключает добивку мышц дня.
 * - P2-3 (ядро): эксцентрическая надбавка не выводит вес primary за рабочий максимум.
 * - P2-4 (ядро): макроцикл обновляет фазу недели и ведёт RIR по всему диапазону блока.
 * - P2-7 (ядро): auto-MEV-feeder считает разрыв до MEV по каждой неделе и не перебирает цель.
 * - P2-9 (ядро): лабораторные предупреждения и заметка по интенсивности попадают в rationale
 *   и без снижения MRV (раньше выводились только при `labMrvMultiplier < 1`).
 * - P2-7 (финализация): финальный кап/порядок упражнений выполняется для всех сессий, а не
 *   только для тех, где есть разминка-активатор (сторож инварианта, см. комментарий у теста).
 * - P2-8 (ядро): добивка плеч считается по ГОЛОВКАМ (средняя/задняя дельта по имени
 *   упражнения), а не по метке группы; в переполненный день головка не добивается вовсе.
 * - P2-3 (валидация): safety-ремонт (замена упражнения + пересчёт веса) работает и при
 *   `reorder:false` — раньше error-коды валидатора оставались на плане навсегда.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBBQualityReport } from '../bb-quality-report.engine';
import { calculatePlanSafetyScore } from '../bb-safety-score.engine';
import { analyzePlanStress } from '../bb-injury-prevention.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { capExercisesPerMuscle } from '../bb-session-order.engine';
import { buildBBPlan, applyMacrocycleToBBPlan } from '../bb-builder.engine';
import { finalizeBBPlan } from '../bb-finalize.engine';
import { makeInput } from './bb-test-helpers';

describe('P2-6: отчёт качества переживает план без weeks', () => {
  it('buildBBQualityReport({}) не бросает и даёт числовой скор', () => {
    expect(() => buildBBQualityReport({} as any, {})).not.toThrow();
    const report = buildBBQualityReport({} as any, {});
    expect(Number.isFinite(report.score)).toBe(true);
    expect(['ok', 'caution', 'danger']).toContain(report.riskLevel);
  });

  it('неделя без sessions не роняет отчёт', () => {
    const plan: any = { weeks: [{ week: 1 }], validation: { valid: true, issues: [] } };
    expect(() => buildBBQualityReport(plan, {})).not.toThrow();
    expect(Number.isFinite(buildBBQualityReport(plan, {}).score)).toBe(true);
  });

  it('сессия без exercises не роняет safety-скор и анализ стресса', () => {
    const plan: any = { weeks: [{ week: 1, sessions: [{ day: 1 }] }] };
    expect(() => calculatePlanSafetyScore(plan)).not.toThrow();
    expect(() => analyzePlanStress(plan)).not.toThrow();
    expect(Number.isFinite(calculatePlanSafetyScore(plan).score)).toBe(true);
  });
});

describe('P2-5: пустой weeklyVolume не даёт «-Infinity» в тексте валидатора', () => {
  it('сообщение target_volume_deficit остаётся читаемым', () => {
    const plan: any = {
      weeks: [{ week: 1, sessions: [{ day: 1, exercises: [{ muscle: 'forearms', name: 'Сгибание запястий', sets: 3, rir: 2 }] }] }],
      volumeTargets: {
        forearms: { muscle: 'forearms', frequency: 2, mev: 6, mav: 10, mrv: 14, targetSets: 6, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
      },
      weeklyVolume: {},
    };
    const result = validateBBPlan(plan, { level: 'intermediate' });
    const deficit = result.issues.filter(i => i.code === 'target_volume_deficit');
    expect(deficit.length).toBeGreaterThan(0);
    for (const issue of deficit) {
      expect(issue.message).not.toMatch(/Infinity|NaN/);
    }
  });
});

describe('P2-1 (финализация): головки дельт делят общий лимит «плечи»', () => {
  const ex = (muscle: string, name: string, weight: number) => ({
    muscle, name, exerciseName: name, role: 'accessory' as const, character: 'памп' as const,
    sets: 3, repsRange: [12, 15] as [number, number], rir: 2,
    workSets: [{ reps: 12, rir: 2, weight }],
  } as any);

  it('шесть упражнений на дельты (2 головки × 2 + 2 «плечи») срезаются до общего капа', () => {
    const list = [
      ex('shoulders', 'Жим гантелей сидя', 20),
      ex('shoulders', 'Разводка в тренажёре', 15),
      ex('delt_mid', 'Махи гантелей в стороны', 10),
      ex('delt_mid', 'Махи в кроссовере', 8),
      ex('delt_rear', 'Обратные разведения', 6),
      ex('delt_rear', 'Face pull', 5),
    ];
    const kept = capExercisesPerMuscle(list);
    const deltFamily = kept.filter((e: any) => /^delt_|^shoulders$/.test(String(e.muscle)));
    expect(deltFamily.length).toBeLessThanOrEqual(4);
  });

  it('свой лимит на головку сохранён (не больше 2 на delt_mid)', () => {
    const list = [
      ex('delt_mid', 'Махи 1', 10), ex('delt_mid', 'Махи 2', 9), ex('delt_mid', 'Махи 3', 8),
    ];
    const kept = capExercisesPerMuscle(list);
    expect(kept.filter((e: any) => e.muscle === 'delt_mid')).toHaveLength(2);
  });
});

describe('P2-2: добивка дельт не выходит за лимит упражнений в сессии', () => {
  it('второе упражнение (задняя дельта) проверяет и расходует roomEx', () => {
    const src = readFileSync(resolve(__dirname, '..', 'bb-finalize.engine.ts'), 'utf8');
    // Ищем ровно тот блок: после push идут убывания roomSets/roomEx, а второе
    // добавление требует roomEx >= 1.
    expect(src).toMatch(/roomSets -= sideSets;\s*\n\s*roomEx -= 1;/);
    expect(src).toMatch(/roomEx >= 1 && roomSets >= 2/);
  });
});

describe('P2-1 (ядро): auto-MEV-feeder не добивает разгрузочные недели', () => {
  const isDeload = (w: any) => String(w?.phase || '').toLowerCase() === 'deload' || !!w?.deload;
  const feedersOf = (weeks: any[]) => weeks
    .flatMap((w: any) => w.sessions || [])
    .flatMap((s: any) => s.exercises || [])
    .filter((e: any) => /auto-mev-feeder/i.test(String(e.comment || '')));

  it('в deload-неделе нет feeder-упражнений, в рабочих неделях — есть', () => {
    const plan = buildBBPlan(makeInput({ patternId: 'bro_5', weeks: 8 })) as any;
    const deload = plan.weeks.filter(isDeload);
    const working = plan.weeks.filter((w: any) => !isDeload(w));
    expect(deload.length).toBeGreaterThan(0);
    // Гейт не отключил проход целиком: в рабочих неделях фидер остаётся.
    expect(feedersOf(working).length).toBeGreaterThan(0);
    expect(feedersOf(deload)).toHaveLength(0);
  });
});

// P2-2 (ядро): `schemeActive` должен читать ЭФФЕКТИВНУЮ схему объёма. FST-7 при
// не-enhanced уровне понижается до 'standard' — значит и добивка мышц дня
// (гарантия рук по дню) должна работать, как в обычном плане.
describe('P2-2 (ядро): понижённая схема объёма не выключает добивку мышц дня', () => {
  const shape = (plan: any) => (plan.weeks || []).map((w: any) => (w.sessions || []).map((s: any) =>
    (s.exercises || []).map((e: any) => `${e.muscle}|${e.name}|${e.sets}`)));

  it('fst7 при intermediate понижается до standard и даёт тот же состав, что явный standard', () => {
    const downgraded = buildBBPlan(makeInput({ volumeScheme: 'fst7', weeks: 4 })) as any;
    const plain = buildBBPlan(makeInput({ volumeScheme: 'standard', weeks: 4 })) as any;
    // Понижение действительно произошло — иначе тест проверял бы не то.
    expect(downgraded.volumeScheme).toBe('standard');
    expect(shape(downgraded)).toEqual(shape(plain));
  });
});

// P2-3 (ядро): вес primary не должен выходить за рабочий максимум мышцы.
// На низких повторах Brzycki даёт ~85-92% 1ПМ, и эксцентрическая надбавка ×1.5
// уводила назначенный вес за 100% — такой вес не поднимается концентрически,
// а прогрессия/cap-adjust считают его от workMax.
describe('P2-3 (ядро): эксцентрика не выводит вес за рабочий максимум', () => {
  const WM: Record<string, number> = {
    chest: 100, back: 120, quads: 140, hamstrings: 100, glutes: 120, shoulders: 70,
    biceps: 50, triceps: 60, forearms: 35, calves: 80, abs: 40,
  };

  for (const patternId of ['bro_5', 'upper_lower_4']) {
    it(`${patternId}: ни один primary не тяжелее workMax мышцы при eccentricMult 1.5`, () => {
      const plan = buildBBPlan(makeInput({
        patternId, weeks: 12, level: 'enhanced', trainingYears: 4, eccentricMult: 1.5,
      })) as any;
      const over: string[] = [];
      let maxRatio = 0;
      for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
        if (e.role !== 'primary') continue;
        const wm = WM[e.muscle];
        if (!wm) continue;
        const wt = Number(e.workSets?.[0]?.weight ?? 0);
        maxRatio = Math.max(maxRatio, wt / wm);
        if (wt > wm + 0.001) over.push(`w${w.week} ${e.muscle} ${e.name}: ${wt} > ${wm}`);
      }
      expect(over).toEqual([]);
      // Надбавка реально применялась: без неё вес держится ~0.6-0.75 от максимума.
      expect(maxRatio).toBeGreaterThan(0.95);
    });
  }
});

// P2-4 (ядро): макроцикл раньше менял только объём/RIR/флаг делода, а `week.phase`
// оставалась той, что выдал билдер, и из RIR-диапазона брался только минимум.
describe('P2-4 (ядро): макроцикл обновляет фазу недели и ведёт RIR по диапазону', () => {
  const macro = {
    blocks: [
      { phase: 'hypertrophy', weeks: 4, weekOffset: 1, description: '' },
      { phase: 'contest_prep', weeks: 3, weekOffset: 5, description: '' },
      { phase: 'transition', weeks: 1, weekOffset: 8, description: '' },
    ],
    totalWeeks: 8,
    trainingFocus: 'bodybuilding',
    rationale: [],
  } as any;

  const applied = () => applyMacrocycleToBBPlan(buildBBPlan(makeInput({ weeks: 8 })), macro) as any;

  it('фаза каждой недели соответствует своему блоку', () => {
    const p = applied();
    expect(p.weeks.map((w: any) => w.phase)).toEqual([
      'accumulation', 'accumulation', 'accumulation', 'accumulation',
      'peaking', 'peaking', 'peaking', 'deload',
    ]);
    expect(p.weeks[7].deload).toBe(true);
  });

  it('RIR дрейфует от максимума диапазона к минимуму внутри блока', () => {
    const p = applied();
    const rirOf = (w: any): number => {
      const primary = (w.sessions || []).flatMap((s: any) => s.exercises || []).find((e: any) => e.role === 'primary');
      return Number(primary?.rir);
    };
    // hypertrophy, compound [2,3]: первая неделя — лёгкий край, третья — тяжёлый.
    expect(rirOf(p.weeks[0])).toBe(3);
    expect(rirOf(p.weeks[2])).toBe(2);
    // contest_prep, compound [0,1]: неделя 5 — 1, неделя 7 — 0.
    expect(rirOf(p.weeks[4])).toBe(1);
    expect(rirOf(p.weeks[6])).toBe(0);
  });
});

// P2-7 (ядро): разрыв до MEV считался по первой неделе и добавлялся в каждую неделю
// мезо (объём внутри мезо растёт → перебор в поздних неделях), а `Math.max(2, gap)`
// превращал разрыв в 1 сет в лишний сет.
describe('P2-7 (ядро): auto-MEV-feeder добивает точно и по своей неделе', () => {
  it('не перебирает MEV и считает разрыв по каждой неделе', () => {
    const plan = buildBBPlan(makeInput({ patternId: 'bro_5', weeks: 8 })) as any;
    const groups = new Map<string, { muscle: string; week: number; before: number; mev: number; sets: number; added: number }>();
    for (const w of plan.weeks) {
      for (const e of (w.sessions || []).flatMap((s: any) => s.exercises || [])) {
        if (!/Auto-MEV-feeder/i.test(String(e.comment || ''))) continue;
        // P2-8 (аудит 2026-11): цель фидера берём из ЕГО КОММЕНТАРИЯ («для X»), а не
        // из метки упражнения. Добивка головки дельты помечена ГРУППОЙ (`shoulders`),
        // чтобы не добавлять дню новый ключ мышцы и не ломать guard-бюджет фита, —
        // при ключе по метке две добивки разных головок (delt_mid 4 + delt_rear 2)
        // сливались в одну «shoulders 0+6 vs MEV 4».
        const target = /для\s+([a-z_]+)\s*:/.exec(String(e.comment));
        const muscle = target ? target[1] : String(e.muscle);
        const key = `${w.week}|${muscle}`;
        const g = groups.get(key) || { muscle, week: Number(w.week), before: -1, mev: -1, sets: 0, added: 0 };
        const mm = /недельный объём (\d+) < MEV (\d+)/.exec(String(e.comment));
        if (mm) { g.before = Number(mm[1]); g.mev = Number(mm[2]); }
        g.sets += Number(e.sets) || 0;
        // Сеты, которые добавил САМ фидер, — из его комментария («N×15-20»).
        // `e.sets` для этой инварианты не годится: поздние проходы (минимумы
        // группы, рампа, прогрессия) законно доращивают упражнение, и двойной
        // учёт `before + e.sets` обвинял бы фидер в чужом объёме (bro_5 w3:
        // комментарий 2×, факт 5, before 2, MEV 4 → «2+5 > 4» при 2+2 = 4).
        const add = /Auto-MEV-feeder[^:]*:\s*(\d+)×/.exec(String(e.comment));
        if (add) g.added += Number(add[1]);
        groups.set(key, g);
      }
    }
    const list = [...groups.values()];
    expect(list.length).toBeGreaterThan(0);
    for (const g of list) {
      expect(g.mev, `MEV в комментарии фидера ${g.muscle}/w${g.week}`).toBeGreaterThan(0);
      expect(g.added, `фидер не пишет число сетов ${g.muscle}/w${g.week}`).toBeGreaterThan(0);
      expect(g.before + g.added, `${g.muscle} w${g.week}: ${g.before}+${g.added} vs MEV ${g.mev}`)
        .toBeLessThanOrEqual(g.mev);
    }
    // Если бы разрыв брался из первой недели, число фидер-сетов было бы одинаковым
    // во всех неделях мезо (проверяем на сплите с разными разрывами по неделям).
    const ulPlan = buildBBPlan(makeInput({ patternId: 'upper_lower_4', weeks: 8 })) as any;
    const byMuscle = new Map<string, Set<number>>();
    for (const w of ulPlan.weeks || []) {
      for (const s of w.sessions || []) for (const e of s.exercises || []) {
        if (!/Auto-MEV-feeder/i.test(String(e.comment || ''))) continue;
        const st = byMuscle.get(e.muscle) || new Set<number>();
        st.add(Number(e.sets) || 0);
        byMuscle.set(e.muscle, st);
      }
    }
    expect([...byMuscle.values()].some(s => s.size > 1)).toBe(true);
  });
});

// P2-9 (ядро; в плане нумеровалась P2-6 из §4): предупреждения лаборатории и заметка по
// интенсивности выводились ТОЛЬКО внутри `if (labMrvMultiplier < 1)`. Если лаборатория не
// снизила допустимый объём (или предупреждение не дошло до снижения MRV), пользователь не
// видел ни одного своего анализа — а это информация о здоровье, а не часть коррекции MRV.
describe('P2-9 (ядро): лабораторные предупреждения не зависят от снижения MRV', () => {
  const LAB = ['АЛТ умеренно выше нормы', 'Ферритин низкий'];
  const NOTE = 'не повышать интенсивность, держать RIR 3';

  it('при нейтральной лаборатории (MRV не снижен) предупреждения и заметка всё равно в rationale', () => {
    const plan = buildBBPlan(makeInput({ labWarnings: LAB, labIntensityNote: NOTE })) as any;
    const text = (plan.rationale || []).join('\n');
    for (const w of LAB) expect(text, `предупреждение «${w}» потерялось`).toContain(w);
    expect(text).toContain(`Интенсивность: ${NOTE}`);
    // Коррекции MRV не было — строки про неё быть не должно.
    expect(text).not.toContain('Лабораторная коррекция');
  });

  it('при сниженном MRV и предупреждения, и строка коррекции на месте и не дублируются', () => {
    const plan = buildBBPlan(makeInput({ labMrvMultiplier: 0.85, labWarnings: LAB, labIntensityNote: NOTE })) as any;
    const lines = ((plan.rationale || []) as string[]);
    const text = lines.join('\n');
    expect(text).toContain('Лабораторная коррекция: MRV ×0.85');
    expect(lines.filter(l => l.includes(LAB[0])).length).toBe(1);
    expect(lines.filter(l => l.includes('Интенсивность:')).length).toBe(1);
  });
});

// P2-7 (финализация; пункт §4 аудита): финальный проход «кап упражнений на мышцу + порядок»
// стоял под `if (warmups.length && …)`, то есть применялся только к сессиям с
// warmupActivator (фактически — дни спины). Изменение защитное: на 336 сборках матрицы
// (7 сплитов × 3 уровня × 2 цели × 8 вариантов опций) планы до и после правки побайтово
// совпадают, поэтому тест — сторож инварианта, а не «красный» тест: если проход снова
// сузится до разминочных дней, инвариант «плечи ≤ кап группы» перестанет проверяться
// на всех сессиях и тест потеряет смысл.
describe('P2-7 (финализация): финальный кап/порядок применяется ко всем сессиям', () => {
  it('группа «плечи» (shoulders + delt_*) не превышает кап 4 ни в одной сессии, разминка — первая', () => {
    for (const patternId of ['upper_lower_4', 'ppl_6', 'bro_5']) {
      const p: any = buildBBPlan(makeInput({ patternId, weeks: 8 }));
      for (const w of p.weeks || []) {
        for (const s of w.sessions || []) {
          const all = s.exercises || [];
          const working = all.filter((e: any) => !e.warmupActivator);
          const shoulders = working.filter((e: any) => /^(shoulders|delt_)/.test(String(e.muscle))).length;
          expect(shoulders, `${patternId} нед.${w.week} ${s.sessionTag}: плечи ${shoulders}`).toBeLessThanOrEqual(4);
          if (all.some((e: any) => e.warmupActivator)) {
            expect(all[0].warmupActivator, `${patternId} нед.${w.week} ${s.sessionTag}: разминка не первая`).toBe(true);
          }
          // Порядок: ни одно упражнение мышцы не должно стоять после чужой мышцы, если
          // сессия не круги (full-body/верх тела чередуются намеренно).
          const interleaved = /FullBody|Full|Комбинир|Круг/i.test(String(s.sessionTag || ''));
          if (!interleaved) {
            const seen = new Set<string>();
            let last = '';
            for (const e of working) {
              const m = String(e.muscle);
              if (m !== last && seen.has(m)) {
                throw new Error(`${patternId} нед.${w.week} ${s.sessionTag}: мышца ${m} разорвана (порядок: ${working.map((x: any) => x.muscle).join(',')})`);
              }
              seen.add(m);
              last = m;
            }
          }
        }
      }
    }
  });
});

// P2-8 (ядро, аудит 2026-11): добивка плеч считалась по МЕТКЕ мышцы, поэтому группа
// «shoulders» видела 0-4 сета при 8-24 реальных сетов пучков и добивалась заново
// (двойная добивка), а средняя/задняя дельта не имели своего минимума. Теперь головка
// определяется по ИМЕНИ упражнения (bbShoulderHeadOf) и добивается до своего MEV.
describe('P2-8 (ядро): добивка плеч идёт по ГОЛОВКАМ и только в свободное место дня', () => {
  const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
  const PED = { pedDoses: { AAS: 500 }, courseIntensity: 'moderate' as const };
  const feedersFor = (plan: any, target: RegExp) => (plan.weeks || [])
    .flatMap((w: any) => (w.sessions || []).flatMap((s: any) => (s.exercises || [])))
    .filter((e: any) => /Auto-MEV-feeder/i.test(String(e.comment || '')) && target.test(String(e.comment || '')));

  it('ppl_6: группа «плечи» накормлена пучками — группового фидера нет, добита головка', () => {
    const p: any = buildBBPlan(makeInput({ patternId: 'ppl_6', level: 'intermediate', weeks: 1 }));
    // До P2-8 здесь стояли ДВЕ добивки `для shoulders` (махи Lu 3 + YTЛ лёжа 3):
    // группа считалась по метке и «видела» 0 сетов, хотя в неделе 24 сета плеч
    // (замер HEAD: delt_front 6 + delt_mid 3 + delt_rear 12 + shoulders 3).
    expect(feedersFor(p, /для shoulders:/)).toHaveLength(0);
    // Вместо этого добита ГОЛОВКА: средняя дельта доходит до своего MEV
    // (natural intermediate: delt_mid MEV 4; до P2-8 было 3 сета).
    const vol = p.weeklyVolume?.[1] || {};
    expect(vol.delt_mid?.directSets || 0).toBeGreaterThanOrEqual(4);
  });

  it('добивка головки помечена ГРУППОЙ: нового ключа мышцы в дне не появляется', () => {
    // ppl_6 уже набирает 9 сетов delt_mid нативно (≥ MEV 4); добивка головки
    // срабатывает на fullbody_3 intermediate и должна нести метку группы 'shoulders'.
    const p: any = buildBBPlan(makeInput({ patternId: 'fullbody_3', level: 'intermediate', weeks: 1 }));
    const headFeeds = feedersFor(p, /для delt_(mid|rear):/);
    expect(headFeeds.length).toBeGreaterThan(0);
    // До P2-8 добивка несла СОБСТВЕННУЮ метку `delt_mid`: в сессии появлялся новый
    // ключ мышцы, рос guard-бюджет дня (замер upper_lower_4/enhanced: total 79→85,
    // scale 0.759→0.706) и трим снимал ЧУЖУЮ работу — трапеции 6→5, пресс 13→10.
    // Плечи и так живут одной группой в guard/капе, поэтому метка — группа.
    for (const e of headFeeds) {
      expect(String(e.muscle), `добивка головки «${e.name}» получила метку ${e.muscle}`).toBe('shoulders');
    }
  });

  it('upper_lower_4 enhanced: в переполненный день добивка головки не входит', () => {
    const p: any = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, ...PED });
    // Дни Upper заполнены (15 упражнений / 37 сетов, кап группы плеч занят): добивка
    // головки не входит — иначе её 2 сета вытесняли чужую работу (замер при собственной
    // метке головки: пресс 13→10, спина 35→31, guard-бюджет 79→85).
    expect(feedersFor(p, /для delt_(mid|rear):/)).toHaveLength(0);
    // И группа не добивается «вслепую»: плечи уже покрыты пучками.
    expect(feedersFor(p, /для shoulders:/)).toHaveLength(0);
  });
});

// P2-3 (валидация; пункт §4): единственный ремонт safety-ограничений
// (`repairAdaptiveSafety`) стоял под гейтом `reorder !== false`, хотя он не переставляет
// упражнения — только подменяет имя и пересчитывает вес. В режиме `reorder:false` план
// оставался с error-кодами `equipment_restriction_violation` (и по той же причине
// `axial_restriction_violation`, `excluded_exercise_present`), то есть невалидным навсегда.
describe('P2-3 (валидация): safety-ремонт не зависит от reorder', () => {
  const EQ = ['dumbbell', 'machine', 'cable', 'bodyweight'];
  const planWithBarbell = (): any => ({
    pattern: {} as any,
    weeks: [{
      week: 1,
      sessions: [{
        day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Upper',
        exercises: [
          {
            muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж',
            sets: 4, repsRange: [6, 8], rir: 2,
            workSets: Array.from({ length: 4 }, () => ({ reps: 8, rir: 2, weight: 80 })),
          },
          {
            muscle: 'back', name: 'Тяга штанги в наклоне', role: 'accessory', character: 'тяж',
            sets: 3, repsRange: [8, 10], rir: 2,
            workSets: Array.from({ length: 3 }, () => ({ reps: 10, rir: 2, weight: 60 })),
          },
        ],
      }],
    }],
    rotationMuscleVolume: {}, rationale: [],
  });

  for (const reorder of [true, false]) {
    it(`штанга без оборудования заменяется доступным вариантом (reorder=${reorder})`, () => {
      const result: any = finalizeBBPlan(planWithBarbell(), { equipment: EQ, level: 'intermediate', reorder });
      const exs: any[] = result.weeks[0].sessions[0].exercises;
      const barbell = exs.filter(e => /штанг|barbell|гриф/i.test(String(e.name || '')));
      expect(barbell, 'упражнения со штангой остались в плане').toHaveLength(0);
      // Ремонт прошёл именно штатным проходом, а не побочной заменой.
      expect(exs.some(e => /Safety repair/.test(String(e.comment || '')))).toBe(true);
      const errors = (result.validation?.issues || []).filter((i: any) => i.level === 'error').map((i: any) => i.code);
      expect(errors).not.toContain('equipment_restriction_violation');
    });
  }
});
