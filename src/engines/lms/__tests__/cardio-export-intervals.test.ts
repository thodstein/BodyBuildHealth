/**
 * Экспорт интервальных сессий: TCX и ZWO должны совпадать с таймером.
 *
 * Дефекты, найденные аудитом 2026-11 (четвёртый проход):
 *  - TCX строил лапы только из `structured` — без разминки/заминки, поэтому
 *    сумма лапов была короче сессии (75 из 95 мин у вело-темпа);
 *  - ZWO терял `reps` (8×1 мин выгружались одним 60-секундным отрезком), писал
 *    рабочий отрезок как `<Warmup>` (в Zwift это рампа, а не ровная работа) и
 *    склеивал ВСЕ сессии недели в одну «тренировку» на несколько часов.
 */
import { describe, it, expect } from 'vitest';
import { buildCardioCycle, buildCardioTcx, buildCardioZwo, buildCardioIntervalPlan } from '../cardio.engine';

function cycleWithStructured(): any {
  const base = buildCardioCycle({ goal: 'cut', totalWeeks: 1, id: 'exp-1', startDate: '2026-03-09' });
  const tpl = base.weeks[0].sessions[0];
  return {
    ...base,
    startDate: '2026-03-09',
    weeks: [{
      ...base.weeks[0],
      week: 1,
      phase: 'base',
      totalMinutes: 90,
      sessions: [
        { ...tpl, type: 'zone2', durationMin: 60, dayOfWeek: 1, weeklyFrequency: 1, structured: undefined },
        {
          ...tpl, type: 'miss', durationMin: 30, dayOfWeek: 3, weeklyFrequency: 1, equipment: 'cycling',
          structured: [{ workSec: 60, restSec: 30, reps: 3, target: 'power', note: '88-94% FTP' }],
        },
      ],
    }],
  };
}

function sessionWithStructure(): any {
  const c = cycleWithStructured();
  return c.weeks[0].sessions[1];
}

const lapSecs = (xml: string) => [...xml.matchAll(/<TotalTimeSeconds>(\d+)<\/TotalTimeSeconds>/g)].map(m => Number(m[1]));
const zwoSecs = (xml: string) => {
  let total = 0;
  for (const m of xml.matchAll(/<SteadyState Duration="(\d+)"/g)) total += Number(m[1]);
  for (const m of xml.matchAll(/<IntervalsT Repeat="(\d+)" OnDuration="(\d+)" OffDuration="(\d+)"/g)) {
    total += Number(m[1]) * (Number(m[2]) + Number(m[3]));
  }
  return total;
};

describe('buildCardioTcx: интервалы совпадают с таймером', () => {
  it('лапы = шаги таймлайна, включая разминку и заминку', () => {
    const c = cycleWithStructured();
    const plan = buildCardioIntervalPlan(sessionWithStructure())!;
    const tcx = buildCardioTcx(c, '2026-03-09');
    const secs = lapSecs(tcx);

    // В файл попадают все сессии цикла: последние лапы — наша интервальная.
    expect(secs.slice(-plan.steps.length)).toEqual(plan.steps.map(s => s.sec));
    expect(secs.slice(-plan.steps.length).reduce((a, b) => a + b, 0)).toBe(plan.totalSec);
    // 3×(60 работа + 30 отдых) + разминка/заминка из остатка 30-минутной сессии.
    expect(secs[secs.length - plan.steps.length]).toBe(765);
    expect(secs[secs.length - 1]).toBe(765);
    expect(tcx).toContain('30 мин по структуре');
  });

  it('без структуры — один лап на всю сессию (ничего не выдумываем)', () => {
    const c = cycleWithStructured();
    c.weeks[0].sessions = [c.weeks[0].sessions[0]];
    const tcx = buildCardioTcx(c, '2026-03-09');
    expect(lapSecs(tcx)).toEqual([3600]);
    expect(tcx).not.toContain('по структуре');
  });
});

describe('buildCardioZwo: одна тренировка, все повторы', () => {
  it('берёт ключевую сессию недели, а не склеивает все подряд', () => {
    const zwo = buildCardioZwo(cycleWithStructured());
    // Z2-сессия 60 мин в файл не попадает.
    expect(zwo).not.toContain('Duration="3600"');
    expect(zwo).toContain('нед 1');
    expect(zwoSecs(zwo)).toBe(1800);
  });

  it('сохраняет reps и использует IntervalsT для рабочих отрезков', () => {
    const zwo = buildCardioZwo(cycleWithStructured());
    expect(zwo).toContain('<IntervalsT Repeat="3" OnDuration="60" OffDuration="30"');
    // Рабочий отрезок — не рампа: <Warmup> в файле быть не должно.
    expect(zwo).not.toContain('<Warmup ');
  });

  it('мощность берётся из «88-94% FTP» в примечании (середина диапазона)', () => {
    const zwo = buildCardioZwo(cycleWithStructured());
    expect(zwo).toContain('OnPower="0.91"');
  });

  it('разминка и заминка в файле такие же, как в таймере', () => {
    const zwo = buildCardioZwo(cycleWithStructured());
    expect(zwo).toContain('<SteadyState Duration="765" Power="0.50"');
  });

  it('hiit без структуры — по-прежнему 60/90, но с числом повторов по длительности', () => {
    const c = cycleWithStructured();
    c.weeks[0].sessions = [{
      ...c.weeks[0].sessions[0], type: 'hiit', durationMin: 30, structured: undefined,
    }];
    const zwo = buildCardioZwo(c);
    expect(zwo).toMatch(/<IntervalsT Repeat="\d+" OnDuration="60" OffDuration="90"/);
    expect(zwo).toContain('HIIT');
  });
});
