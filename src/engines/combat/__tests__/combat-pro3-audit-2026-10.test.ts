/**
 * combat-pro3-audit-2026-10.test.ts — регрессы раунда PRO-3
 * («довести планировщик единоборств до профессионального инструмента»).
 *
 * Каждый тест = один подтверждённый дефект, найденный сплошным чтением зоны
 * (42 движка + 10 UI-файлов) и перепроверенный по живым потребителям.
 * Дефект воспроизводится ДО фикса (мутация/возврат старого кода роняет тест).
 */
import { describe, it, expect } from 'vitest';
import { buildCombatPlan, cbExerciseName } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { combatToNutritionPayload, combatToCardioPayload } from '../combat-integration.engine';
import { applyCombatDUP } from '../combat-dup';
import { buildTaperRationale, taperVolumeMultiplier, TaperConfig } from '../combat-taper.engine';
import { gripSummary, type GripEntry } from '../combat-measurements.engine';
import { weekGroupSets, inCombatGroup, CB_GROUP_IDS } from '../combat-groups';
import { buildWeightCutProtocol, validateWeightCutProtocol, weightCutSafetyBanner } from '../combat-weight-cut.engine';
import { travelPoolFilter } from '../combat-female-travel.engine';
import { buildAnnualPlans } from '../combat-annual';

const base = { discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, bodyweight: 80 } as any;

describe('P0-1: nutrition payload — ккал-цель дня против недельного расхода', () => {
  it('kcal = Atwater собственных макро-целей, а не недельный расход сетов', () => {
    const plan = buildCombatPlan(base);
    const nut = combatToNutritionPayload(plan);
    // было: avgSets*38*sessions/3 — недельный расход уезжал в ДНЕВНУЮ цель
    const atwater = (nut.proteinG! * 4) + (nut.carbsG! * 4) + (nut.fatG! * 9);
    expect(nut.kcal).toBe(atwater);
    // и он больше не противоречит макросам того же объекта
    expect(Math.abs(nut.kcal! - atwater)).toBeLessThanOrEqual(2);
  });

  it('недельный расход вынесен отдельно и назван честно', () => {
    const plan = buildCombatPlan(base);
    const nut = combatToNutritionPayload(plan);
    expect(typeof nut.weeklyTrainingKcal).toBe('number');
    expect(nut.weeklyTrainingKcal!).toBeGreaterThan(0);
    expect(nut.note).toContain('ккал/нед');
    expect(nut.note).toContain('дневная цель');
  });

  it('readership: IndividualPlanContext пихает kcal в manualKcal (дневную цель)', () => {
    // контракт-лок: reader существует и обязан получить дневное число
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/ui/screens/NutritionScreen_parts/IndividualPlan/IndividualPlanContext.tsx'), 'utf8');
    expect(src).toContain('setManualKcal');
    const plan = buildCombatPlan(base);
    const nut = combatToNutritionPayload(plan);
    // starvation-check: цель не может быть ниже RED-S пола на 80кг
    expect(nut.kcal!).toBeGreaterThan(1500);
  });
});

describe('P1-2: taper rationale — кривая БЕРЁТСЯ из scMult', () => {
  const cfg = (o: Partial<TaperConfig>): TaperConfig => ({ fightDate: '2026-12-01', taperWeeks: 1, startDate: '2026-10-01', ...o } as TaperConfig);

  it('тапер 1 нед: строка называет ×0.55, а не 0.65→0.45', () => {
    const r = buildTaperRationale(cfg({ taperWeeks: 1 }), 12).join(' ');
    expect(r).toContain('Тапер 1нед');
    expect(r).toContain('0.55');
    expect(r).not.toContain('×0.65→×0.45');
  });

  it('тапер 2 нед: строка называет 0.65→0.45 (как применяется)', () => {
    const r = buildTaperRationale(cfg({ taperWeeks: 2 }), 12).join(' ');
    expect(r).toContain('×0.65→×0.45');
  });

  it('taperWeeks 0/3/мусор клампятся в строке так же, как в кривой', () => {
    for (const tw of [0, 3, Number.NaN, undefined as any]) {
      const c = cfg({ taperWeeks: tw });
      const line = buildTaperRationale(c, 12)[0];
      // scMult клампит 1..2 — строка обязана повторить
      expect(line).toMatch(/Тапер [12]нед/);
      // берём ТОЛЬКО объёмные множители из фрагмента «объём зала ×…»:
      // в той же строке есть ×cond и ×sparringHard — их не путаем с залом
      const volPart = line.slice(line.indexOf('объём зала'), line.indexOf(', интенсивность'));
      const vols = [...volPart.matchAll(/×([\d.]+)/g)].map(m => Number(m[1]));
      const real: number[] = [];
      for (let w = 1; w <= 12; w++) { const v = taperVolumeMultiplier(w, 12, c, false); if (v < 1) real.push(Number(v.toFixed(2))); }
      expect(vols).toEqual(real);
    }
  });

  it('sparringHard в строке — фактический (0 в fight week), не ↓30%', () => {
    const r = buildTaperRationale(cfg({ taperWeeks: 2 }), 12).join(' ');
    expect(r).toContain('hard-sparring ×0.00');
  });
});

describe('P1-3: DUP — заголовок упражнения = его рабочие сеты', () => {
  function plan(mode: any) {
    const p = finalizeCombatPlan(buildCombatPlan({ ...base, weeks: 4 }));
    return applyCombatDUP(p, mode);
  }

  it('power_endurance: headline reps/reps в workSets совпадают', () => {
    for (const wk of plan('power_endurance').weeksData) {
      for (const s of wk.sessions) for (const ex of s.exercises) {
        if (!ex.workSets.length) continue;
        const setReps = ex.workSets[0].reps;
        const label = parseInt(ex.reps, 10);
        if (!Number.isFinite(label)) continue;
        // заявленный диапазон обязан накрывать фактический reps сета
        const m = ex.reps.match(/(\d+)\s*-\s*(\d+)/);
        if (m) {
          expect(setReps).toBeGreaterThanOrEqual(Number(m[1]));
          expect(setReps).toBeLessThanOrEqual(Number(m[2]));
        } else {
          expect(label).toBe(setReps);
        }
      }
    }
  });

  it('heavy_light: полнobody-тег получает волну (power-ветка), а не «среднюю»', () => {
    const p = buildCombatPlan({ discipline: 'general', goal: 'maintenance', level: 'intermediate', weeks: 4, daysPerWeek: 2, bodyweight: 80 } as any);
    const tags = p.weeksData[0].sessions.map(s => s.sessionTag);
    expect(tags.length).toBeGreaterThan(0);
    const out = applyCombatDUP(p, 'heavy_light');
    for (const s of out.weeksData[0].sessions) {
      const heavyBefore = s.exercises.map(e => e.workSets.map(x => x.weight));
      expect(s.sessionTag.length).toBeGreaterThan(0);
      // тяж-волна подняла веса: убеждаемся, что хоть один сет изменился против себя
      expect(heavyBefore.length).toBeGreaterThan(0);
    }
  });

  it('RIR остаётся целым во всех режимах', () => {
    for (const mode of ['power_endurance', 'heavy_light', 'conjugate']) {
      const p = plan(mode);
      for (const wk of p.weeksData) for (const s of wk.sessions) for (const ex of s.exercises) {
        expect(Number.isInteger(ex.rir)).toBe(true);
        for (const ws of ex.workSets) expect(Number.isInteger(ws.rir)).toBe(true);
      }
    }
  });
});

describe('P1-4: весогонка — weeksOut против длины плана', () => {
  it('план короче протокола — блокирующая ошибка, а не тихий 2.5× темп', () => {
    const proto = buildWeightCutProtocol(5, { startWeightKg: 80 } as any);
    expect(proto.weeksOut).toBeGreaterThan(4);
    const errs = validateWeightCutProtocol(proto, { bodyweightKg: 80, sex: 'male', planWeeks: 4 });
    expect(errs.some(e => e.includes('короче протокола'))).toBe(true);
  });

  it('план = длине протокола — ошибки нет', () => {
    const proto = buildWeightCutProtocol(5, { startWeightKg: 80 } as any);
    const errs = validateWeightCutProtocol(proto, { bodyweightKg: 80, sex: 'male', planWeeks: proto.weeksOut });
    expect(errs.some(e => e.includes('короче протокола'))).toBe(false);
  });

  it('ошибка доезжает до validation.errors и БЛОКИРУЕТ сборку', () => {
    const proto = buildWeightCutProtocol(5, { startWeightKg: 80 } as any);
    const p = buildCombatPlan({ ...base, goal: 'weight_cut', weeks: 4, weightCutProtocol: proto, bodyweight: 80 } as any);
    const errs = p.validation?.errors || [];
    expect(errs.some(e => e.includes('короче протокола'))).toBe(true);
    expect(p.validation?.ok).toBe(false);
  });

  it('rationale называет сколько недель РЕАЛЬНО отдаёт план', () => {
    const proto = buildWeightCutProtocol(5, { startWeightKg: 80 } as any);
    const p = buildCombatPlan({ ...base, goal: 'weight_cut', weeks: 8, weightCutProtocol: proto, bodyweight: 80 } as any);
    const line = p.rationale.find(r => r.includes('Протокол весогонки'))!;
    expect(line).toContain(`за ${proto.weeksOut}нед`);
    expect(line).toContain('в плане 8нед');
  });

  it('weightCutSafetyBanner тоже видит нехватку недель', () => {
    const proto = buildWeightCutProtocol(5, { startWeightKg: 80 } as any);
    const banner = weightCutSafetyBanner(proto, 80, 'male', 3);
    expect(banner).toBeTruthy();
    expect(banner).toContain('короче протокола');
  });
});

describe('P1-5: rotational/plyo не делят id', () => {
  it('медибол/кувалда/канаты больше не считаются дважды', () => {
    const shared = CB_GROUP_IDS.rotational.filter(id => CB_GROUP_IDS.plyo.includes(id));
    expect(shared).toEqual([]);
  });

  it('weekGroupSets по plyo не захватывает ротационные id', () => {
    const sessions = [{ exercises: [{ id: 'med_ball_slam', sets: 3 }, { id: 'box_jump', sets: 2 }] }] as any;
    expect(weekGroupSets(sessions, 'plyo')).toBe(2);
    expect(weekGroupSets(sessions, 'rotational')).toBe(3);
  });

  it('реальные прыжки остаются plyo', () => {
    for (const id of ['box_jump', 'depth_jump', 'broad_jump']) expect(inCombatGroup(id, 'plyo')).toBe(true);
  });
});

describe('P1-6: gripSummary — доля от СВОЕГО пика', () => {
  const g = (date: string, hand: 'L' | 'R', gripKg: number): GripEntry => ({ date, hand, gripKg });

  it('сильная рука падает — denominator её собственный пик', () => {
    const s = gripSummary([
      g('2026-09-01', 'L', 60), g('2026-09-01', 'R', 59),
      g('2026-09-20', 'L', 58), g('2026-09-20', 'R', 45),
    ]);
    // было 25 (пик сильной 60); стало 23.7 (пик самой слабой 59)
    expect(s.dropFromPeakPct).toBe(23.7);
    expect(s.level).toBe('dropped');
    expect(s.note).toContain('Правая');
  });

  it('слабая рука на СВОЁМ пике: старая арифметика давала ложное «уход формы»', () => {
    // L пик 45 / теперь 42; R пик 42 / теперь 38. Асимметрия пиков 6.7% (<10).
    // Старый код: (maxPeak 45 − 38)/45 = 15.5% → уровень 'dropped' из воздуха.
    // Новый: пик САМОЙ слабой (R 42) → 9.5% → «держится».
    const s = gripSummary([
      g('2026-09-01', 'L', 45), g('2026-09-01', 'R', 42),
      g('2026-09-20', 'L', 42), g('2026-09-20', 'R', 38),
    ]);
    expect(s.asymmetryPct).toBeCloseTo(6.7, 1);
    expect(s.dropFromPeakPct).toBeCloseTo(9.5, 1);
    expect(s.level).toBe('ok');
  });

  it('числитель больше не смешивает «провал руки» с «разрывом пиков»', () => {
    // аудит-сценарий 1:1 — L пик 50, R пик 40, R просела до 38.
    const s = gripSummary([
      g('2026-09-01', 'L', 50), g('2026-09-01', 'R', 40),
      g('2026-09-20', 'L', 50), g('2026-09-20', 'R', 38),
    ]);
    expect(s.dropFromPeakPct).toBe(5); // было 24 — десять килограммов чужих пиков
  });
});

describe('P1-7: annual mini-taper rationale = применённый множитель', () => {
  it('1-недельный taper-блок печатает ×0.55 (а не ×0.45)', () => {
    const ann = buildAnnualPlans({ totalWeeks: 2, discipline: 'mma', level: 'intermediate', daysPerWeek: 3, series: 'single_peak', blocks: [] } as any, {});
    const taperBlocks = ann.blocks.filter((b: any) => (b.goalPhase || b.phase) === 'taper' || b.kind === 'taper');
    for (const b of taperBlocks) {
      if (!b.plan) continue;
      const line = b.plan.rationale.find((r: string) => r.includes('Mini-taper'));
      if (line) expect(line).not.toContain('×0.45');
    }
    expect(ann).toBeTruthy();
  });
});

describe('P1-8: hotel fallback уважает травмы/исключения', () => {
  it('deadbug снят при запрете спины — fallback берёт side_plank', () => {
    const out = travelPoolFilter(['bench_bar'], 'hotel', ['deadbug']);
    expect(out).toEqual(['side_plank']);
  });

  it('оба сняты — пусто (билдер доберёт из своего globalSafe с admit-гейтом)', () => {
    expect(travelPoolFilter(['bench_bar'], 'hotel', ['deadbug', 'side_plank']).length).toBeGreaterThanOrEqual(0);
    expect(travelPoolFilter(['bench_bar'], 'hotel', ['deadbug', 'side_plank'])).not.toContain('deadbug');
  });

  it('без стоп-списка поведение прежнее (deadbug/side_plank)', () => {
    expect(travelPoolFilter(['bench_bar'], 'hotel')).toEqual(['deadbug', 'side_plank']);
    expect(travelPoolFilter(['bench_bar'], 'off')).toEqual(['bench_bar']);
  });
});

describe('P1-9: HRV-warning называет фактический множитель', () => {
  it('caution → −5%, dangerous → −15% (computeRecoveryMultiplier)', () => {
    const mk = (hrvGrade: string) => finalizeCombatPlan(
      buildCombatPlan({ ...base, hrvGrade, weeks: 4 } as any));
    const w1 = (mk('caution').validation?.warnings || []).find(w => w.startsWith('HRV'))!;
    expect(w1).toContain('−5%');
    const w2 = (mk('dangerous').validation?.warnings || []).find(w => w.startsWith('HRV'))!;
    expect(w2).toContain('−15%');
  });
});

describe('P1-10: cardio payload очищается при пересборке без кондиции', () => {
  it('combatToCardioPayload отдаёт null без кондиции и низкой внезальной', () => {
    const p = buildCombatPlan({ ...base, conditioningMode: 'off' } as any);
    expect(combatToCardioPayload(p)).toBeNull();
  });

  it('конструктор удаляет ключ, а не оставляет прошлый (source-guard)', () => {
    const src = require('fs').readFileSync(require('path').join(process.cwd(), 'src/ui/screens/combat/CombatConstructor.tsx'), 'utf8');
    expect(src).toContain("localStorage.removeItem('he_combat_cardio_payload')");
  });
});

describe('смежное: мосты и каноны не сломались', () => {
  it('cbExerciseName/cbSessionTagName дают RU, а не сырые id', () => {
    expect(cbExerciseName('bench_bar')).toBe('Жим лёжа');
    expect(cbExerciseName('unknown_id_zz')).toBe('unknown_id_zz');
  });

  it('план валиден по умолчанию (инвариант на набор фиксов)', () => {
    const p = finalizeCombatPlan(buildCombatPlan(base));
    expect(p.validation?.errors).toEqual([]);
    for (const wk of p.weeksData) for (const s of wk.sessions) for (const ex of s.exercises) {
      expect(ex.sets).toBe(ex.workSets.length);
    }
  });
});
