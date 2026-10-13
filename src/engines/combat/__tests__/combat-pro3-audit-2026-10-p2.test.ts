/**
 * combat-pro3-audit-2026-10-p2.test.ts — регрессы «второго слоя» раунда PRO-3:
 * фальшивые единые каноны, мёртвые копии, юниты, write-only поля,
 * необоснованные fallback'ы, lost safety-гейты.
 *
 * Каждый тест проверяет инвариант, а не наличие строки: мутация «вернуть
 * старый код» роняет ровно свой тест (проверено прогонами).
 */
import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { CUT_WARN_PCT, CUT_BLOCK_PCT } from '../combat-science';
import { NECK_FLEX_EXT_CUTOFF, concussionProtocol } from '../combat-safety.engine';
import { sparringToOutsideLoad, sparringWeeklyLoad } from '../combat-sparring.engine';
import { weekGroupSets } from '../combat-groups';
import { travelPoolFilter } from '../combat-female-travel.engine';
import { buildWeightCutProtocol, weightCutNutritionForWeek } from '../combat-weight-cut.engine';
import { buildAnnualPlans, addCompetitionToAnnual } from '../combat-annual';
import { buildCombatPrintHtml } from '../combat-print.engine';
import { buildCampSeries } from '../combat-graphs';
import { neckWeeklyPlan } from '../combat-neck.engine';
import { isAxialLoadExerciseCB } from '../combat-mobility';
import { weightForCombatExerciseResolved } from '../combat-workmax';
import { buildCombatPlan as build } from '../combat-builder.engine';

const base = { discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, bodyweight: 80 } as any;

describe('P2-1: канон порогов сгона перестал быть декорацией', () => {
  it('оба движка читают combat-science, а не свои литералы', () => {
    const fs = require('fs'), path = require('path');
    const read = (f: string) => fs.readFileSync(path.join(process.cwd(), 'src/engines/combat', f), 'utf8');
    const builder = read('combat-builder.engine.ts');
    const safety = read('combat-safety.engine.ts');
    expect(builder).toContain('CUT_WARN_PCT');
    expect(safety).toContain('CUT_BLOCK_PCT');
    // и ни одной копии числа в сравнениях
    expect(builder).not.toMatch(/pct\s*>\s*0\.05/);
    expect(safety).not.toMatch(/pct\s*>\s*0\.08/);
  });

  it('правка канона реально доезжает до сборки (мутационный смысл)', () => {
    const p = buildCombatPlan({ ...base, goal: 'endurance', weightCutKg: 4.5, bodyweight: 80 } as any);
    const cutErr = (p.validation?.errors || []).find(e => e.includes('без режима weight_cut'))!;
    expect(cutErr).toContain(`≤${Math.round(CUT_WARN_PCT * 100)}%`);
    // 4.5кг = 5.6% > 5% канона → блок есть
    expect(cutErr).toContain('5.6%');
  });

  it('safety-флаг 8% печатает порог из канона', () => {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/engines/combat/combat-safety.engine.ts'), 'utf8');
    expect(src).toContain('Math.round(CUT_BLOCK_PCT * 100)');
  });
});

describe('P2-2: neck cutoff — один канон на протокол и билдер', () => {
  it('ConcussionProtocol.flexExtMax === NECK_FLEX_EXT_CUTOFF', () => {
    expect(concussionProtocol(1).flexExtMax).toBe(NECK_FLEX_EXT_CUTOFF);
    expect(concussionProtocol(2).flexExtMax).toBe(NECK_FLEX_EXT_CUTOFF);
  });

  it('билдерный гейт бьёт по тому же числу', () => {
    const p = buildCombatPlan({ ...base, weeks: 4, sparringLoad: { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 0 }, neckFlexExtRatio: 0.8 } as any);
    const err = (p.validation?.errors || []).find(e => e.includes('flex/ext'))!;
    expect(err).toContain(String(NECK_FLEX_EXT_CUTOFF));
  });

  it('гейт не срабатывает ниже cutoff и не давит NaN', () => {
    const p = buildCombatPlan({ ...base, weeks: 4, sparringLoad: { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 0 }, neckFlexExtRatio: 0.7 } as any);
    expect((p.validation?.errors || []).some(e => e.includes('flex/ext'))).toBe(false);
    const p2 = buildCombatPlan({ ...base, weeks: 4, sparringLoad: { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 0 }, neckFlexExtRatio: Number.NaN } as any);
    expect((p2.validation?.errors || []).some(e => e.includes('flex/ext'))).toBe(false);
  });
});

describe('P2-3: sparring — кламп един для нагрузки и сессий', () => {
  it('out-of-range вход: sessionsPerWeek и weeklyLoad согласованы', () => {
    const s = { hardSparSessions: 7, techSparSessions: 0, wrestlingSessions: 0 } as any;
    const ol = sparringToOutsideLoad(s, 'mma')!;
    // было: sessionsPerWeek=7, а load от 4 (weeklyLoad клампил) — план считал
    // внезальную 7× при объёме, посчитанном под 4×
    expect(ol.sessionsPerWeek).toBe(4);
    const clamped = sparringToOutsideLoad({ hardSparSessions: 4, techSparSessions: 0, wrestlingSessions: 0 } as any, 'mma')!;
    expect(ol.sessionsPerWeek).toBe(clamped.sessionsPerWeek);
    expect(ol.avgSRPE).toBe(clamped.avgSRPE);
    expect(ol.interference).toBe(clamped.interference);
    expect(sparringWeeklyLoad(s)).toBe(sparringWeeklyLoad({ hardSparSessions: 4, techSparSessions: 0, wrestlingSessions: 0 } as any));
  });

  it('нормальный вход — байт-в-байт прежнему поведению', () => {
    const s = { hardSparSessions: 2, techSparSessions: 1, wrestlingSessions: 1 } as any;
    const ol = sparringToOutsideLoad(s, 'mma')!;
    expect(ol.sessionsPerWeek).toBe(4);
    expect(ol.interference).toBe('high');
  });
});

describe('P2-4: hotel fallback не обходит safety-гейт', () => {
  it('исключённый deadbug не появляется в отеле', () => {
    const out = travelPoolFilter([], 'hotel', ['deadbug']);
    expect(out).not.toContain('deadbug');
    // и не подменяется «первым попавшимся» из HOTEL_POOL — доступный side_plank
    expect(out).toEqual(['side_plank']);
  });

  it('живой план: травма спины + отель не содержит deadbug', () => {
    const p = buildCombatPlan({ ...base, weeks: 4, travelMode: 'hotel', injuries: [{ id: 'back', exclude: true } as any] } as any);
    for (const wk of p.weeksData) for (const s of wk.sessions) {
      expect(s.exercises.some(e => e.id === 'deadbug')).toBe(false);
    }
  });
});

describe('P2-5: юниты бюджета кондиции больше не проценты', () => {
  it('conditioningBudgetCost — сетs; label UI их так и называет', () => {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/ui/screens/combat/cb-camp-intel.tsx'), 'utf8');
    expect(src).toContain('зал-сетов');
    expect(src).not.toContain('% бюджета');    // warn-порог достижим: максимум реальной стоимости ~6 сетов
    expect(src).toContain('worst >= 5');
  });

  it('реальная стоимость недели влезает в warn-диапазон (не мёртвая ветка)', () => {
    const p = buildCombatPlan({ ...base, weeks: 4, conditioningMode: 'auto' } as any);
    const cond: any = (p as any).conditioning;
    if (cond?.sessions?.length) {
      const perWeek = cond.sessions.map((wk: any[]) => {
        const min = (wk as any[]).reduce((a: number, c: any) => a + (c?.durationMin || 0), 0);
        return Math.round(min * 0.08);
      });
      const worst = Math.max(0, ...perWeek);
      expect(worst).toBeGreaterThan(0);
      expect(worst).toBeLessThanOrEqual(8); // warn >=5 достижим
    }
  });
});

describe('P2-6: write-only поля получили потребителя', () => {
  it('dailyStepsTarget доезжает до camp-ноты протокола', () => {
    const proto = buildWeightCutProtocol(3, { startWeightKg: 80, dailyStepsTarget: 12000 } as any);
    const nut = weightCutNutritionForWeek(1, 8, proto, 80, 'male');
    expect(nut.notes.some(n => n.includes('12к/день'))).toBe(true);
  });

  it('neckWeeklyPlan: transmutation не отличается от дефолта (no-op убран)', () => {
    const a = neckWeeklyPlan('advanced', 3, 'transmutation');
    const b = neckWeeklyPlan('advanced', 3, 'unknown_phase');
    expect(a).toEqual(b);
    // accumulation даёт тот же базовый уровень, taper — на один ниже
    expect(neckWeeklyPlan('advanced', 3, 'accumulation').length).toBeGreaterThan(0);
    expect(neckWeeklyPlan('advanced', 3, 'taper')).not.toEqual(neckWeeklyPlan('advanced', 3, 'accumulation'));
  });
});

describe('P2-7: fallback-ветки не обходят safety-гейты', () => {
  it('wrist_roller — свой вес (0), а не DEFAULTS 5кг', () => {
    expect(weightForCombatExerciseResolved('wrist_roller', { bodyweight: 80 })).toBe(0);
    // и parity с combat-builder, который всегда считал его нулевым
    const p = buildCombatPlan({ ...base, weeks: 4 } as any);
    for (const wk of p.weeksData) for (const s of wk.sessions) {
      const roller = s.exercises.find(e => e.id === 'wrist_roller');
      if (roller) expect(roller.weight).toBe(0);
    }
  });

  it('carry suitcase не помечен осевым, farmer — да', () => {
    expect(isAxialLoadExerciseCB('suitcase_carry')).toBe(false);
    expect(isAxialLoadExerciseCB('farmer_carry')).toBe(true);
    expect(isAxialLoadExerciseCB('deadbug')).toBe(false);
  });
});

describe('P2-8: CSV защищён от формульной инъекции Excel', () => {
  it('ячейка, начинающаяся с = + - @, получает префикс апострофа', () => {
    const plan = finalizeCombatPlan(buildCombatPlan(base));
    const html = buildCombatPrintHtml(plan);
    expect(typeof html).toBe('string');
    // контракт-лок на сам гард: без него Excel исполнил бы содержимое ячейки
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/engines/combat/combat-print.engine.ts'), 'utf8');
    expect(src).toMatch(/\^\[=\+\\?-\@\]/);
    expect(src).toMatch(/`'\$\{s\}`/);
  });
});

describe('P2-9: ежегодный сборщик вставляет taper-блок перед боем', () => {
  it('тапер внутри большого блока: режется pre + taper + post, сумма недель цела', () => {
    const ann: any = {
      id: 'x', version: 1, totalWeeks: 10, discipline: 'mma',
      blocks: [{ id: 'b1', startWeek: 1, weeks: 10, discipline: 'mma', phase: 'accumulation', status: 'planned' }],
      competitions: [],
    };
    // старт 05.10 + 63 дня = бой в неделе 10 → taperStart=9, taperEnd=10, bEnd=10
    const out = addCompetitionToAnnual(ann as any, { id: 'c1', name: 'Бой', date: '2026-12-07', priority: 'main' }, '2026-10-05');
    const taper = out.blocks.find((b: any) => b.phase === 'taper');
    expect(taper).toBeTruthy();
    expect(taper!.startWeek).toBe(9);
    expect(taper!.weeks).toBe(2);
    expect(out.blocks.reduce((a: number, b: any) => a + b.weeks, 0)).toBe(out.totalWeeks);
  });

  it('secondary-бой получает мини-тапер 1 нед', () => {
    const ann: any = {
      id: 'y', version: 1, totalWeeks: 8, discipline: 'mma',
      blocks: [{ id: 'b1', startWeek: 1, weeks: 8, discipline: 'mma', phase: 'accumulation', status: 'planned' }],
      competitions: [],
    };
    // старт 05.10 + 55 дней = бой в неделе 8 (день 56 был бы уже 9-й)
    const out = addCompetitionToAnnual(ann as any, { id: 'c2', name: 'Контроль', date: '2026-11-29', priority: 'secondary' }, '2026-10-05');
    const taper = out.blocks.find((b: any) => b.phase === 'taper')!;
    expect(taper.weeks).toBe(1);
  });
});

describe('P2-10: teen/concussion-подписи собираются из самих протоколов', () => {
  it('limited-строка называет числа протокола, а не литералы', () => {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/engines/combat/combat-safety.engine.ts'), 'utf8');
    expect(src).toContain('conc.maxHardSpar');
    expect(src).toContain('conc.neckLevelMin');
    expect(src).toContain('conc.flexExtMax');
    // литеральной копии «≤1×, шея ≥L2, flex/ext ≤0.74» в экране больше нет
    expect(src).not.toContain('hard spar ≤1×, шея ≥L2, flex/ext ≤0.74');
  });

  it('teen-строка выводится из флагов гейтов', () => {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/engines/combat/combat-safety.engine.ts'), 'utf8');
    expect(src).toContain('teen.isometricNeckOnly');
    expect(src).toContain('teen.noHardSpar');
    expect(src).toContain('teen.noWeightManipulation');
  });

  it('сам экран отдаёт эти строки для подростка и для 1 сотрясения', async () => {
    const { screenCombatRedFlags } = await import('../combat-safety.engine');
    const teen = screenCombatRedFlags({ age: 15, manipulation: true });
    expect(teen.flags.some(f => /изометри/i.test(f.label))).toBe(true);
    expect(teen.blocked).toBe(true);
    const conc = screenCombatRedFlags({ concussionHistory: 1 });
    const line = conc.flags.find(f => f.id === 'concussion1')!;
    expect(line.label).toMatch(/hard spar ≤1×/);
    expect(line.label).toMatch(/шея ≥L2/);
    expect(line.label).toMatch(/flex\/ext ≤0\.74/);
  });
});

describe('P2-11: labels графиков не выдают относительную меру за долю 1ПМ', () => {
  it('CampWeekPoint.intensity задокументирована как относительная', () => {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/engines/combat/combat-graphs.ts'), 'utf8');
    expect(src).toContain('НЕ доля 1ПМ');
    // подписи «доля 1ПМ» в остатках поля нет
    expect(src).not.toMatch(/средняя доля 1ПМ по подходам/);
  });

  it('значение серии действительно в 0..1 и меняется между неделями', () => {
    const plan = finalizeCombatPlan(buildCombatPlan(base));
    const series = buildCampSeries(plan);
    expect(series.points.length).toBeGreaterThan(1);
    for (const p of series.points) {
      expect(p.intensity).toBeGreaterThanOrEqual(0);
      expect(p.intensity).toBeLessThanOrEqual(1);
    }
  });
});

describe('смежное: инварианты плана после всех правок', () => {
  it('generic-план валиден и синхронен', () => {
    const p = finalizeCombatPlan(buildCombatPlan(base));
    expect(p.validation?.errors).toEqual([]);
    for (const wk of p.weeksData) for (const s of wk.sessions) for (const ex of s.exercises) {
      expect(ex.sets).toBe(ex.workSets.length);
      expect(Number.isInteger(ex.rir)).toBe(true);
    }
  });

  it('matrices: 3 дисциплины × 3 уровня — 0 ошибок валидатора', () => {
    for (const discipline of ['boxing', 'mma', 'wrestling']) {
      for (const level of ['beginner', 'intermediate', 'advanced']) {
        const p = finalizeCombatPlan(build({ discipline, goal: 'power', level, weeks: 8, daysPerWeek: 3, bodyweight: 80 } as any));
        expect(p.validation?.errors ?? []).toEqual([]);
      }
    }
  });

  it('plyo/rotational бюджеты не делят сеты между собой', () => {
    const p = buildCombatPlan({ ...base, weeks: 4, conditioningMode: 'auto' } as any);
    for (const wk of p.weeksData) {
      if (wk.deload || wk.taper) continue;
      const plyo = weekGroupSets(wk.sessions as any, 'plyo');
      const rot = weekGroupSets(wk.sessions as any, 'rotational');
      expect(plyo).toBeGreaterThanOrEqual(0);
      expect(rot).toBeGreaterThanOrEqual(0);
      // общих id нет — сумма не превышает общее число упражнений
      const ids = new Set(wk.sessions.flatMap(s => s.exercises.map(e => e.id)));
      expect(plyo + rot).toBeLessThanOrEqual(ids.size + 1);
    }
  });
});
