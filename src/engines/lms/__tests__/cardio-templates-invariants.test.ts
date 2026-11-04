/**
 * cardio-templates-invariants.test.ts — инварианты ВСЕХ именных шаблонов.
 *
 * Аудит 2026-11: 43 авторских плана никто не проверял машинно — в данных жили
 * `durationMin` меньше суммы интервалов, работа в «секундах», но задуманная в
 * метрах, 260-минутный «HIIT»-марафон и недели, выбранные не по той формуле.
 * Эти тесты — контракт данных: план не может обещать больше, чем помещается
 * в заявленную длительность, и обязан получать пульсовые цели атлета.
 */
import { describe, expect, it } from 'vitest';
import { CARDIO_CYCLES } from '../../../data/cardio-cycles/cardio-cycle-index';
import { buildCardioCycleFromTemplate } from '../cardio-templates.engine';
import { buildCardioCycle, expandWeekSchedule } from '../cardio.engine';
import { rankCardioCycles, scoreCardioTemplate, cardioTemplateWeeklyMinutes } from '../cardio-cycle-selector.engine';
import type { CardioCycleTemplate } from '../../../data/cardio-cycles/cardio-cycle-types';

const explicit: CardioCycleTemplate[] = CARDIO_CYCLES.filter(t => t.meta.kind === 'explicit');

const structureMin = (s: CardioCycleTemplate['weeks'] extends undefined ? never : NonNullable<CardioCycleTemplate['weeks']>[number]['sessions'][number]): number => {
  const blocks = s.structured ?? [];
  return blocks.reduce((sum, b) => sum + ((b.workSec + b.restSec) * Math.max(1, b.reps || 1)) / 60, 0);
};

describe('шаблоны: реестр', () => {
  it('46 шаблонов, id уникальны', () => {
    expect(CARDIO_CYCLES.length).toBe(46);
    expect(new Set(CARDIO_CYCLES.map(t => t.meta.id)).size).toBe(CARDIO_CYCLES.length);
  });

  it('явных шаблонов — 33, длина недель = meta.weeks', () => {
    expect(explicit.length).toBe(CARDIO_CYCLES.length - 13);
    for (const t of explicit) {
      expect(t.weeks, `${t.meta.id}: нет недель`).toBeTruthy();
      expect(t.weeks!.length, `${t.meta.id}: недель ${t.weeks!.length} vs meta ${t.meta.weeks}`).toBe(t.meta.weeks);
    }
  });
});

describe('шаблоны: данные сессий', () => {
  it('длительность положительная и правдоподобная (1–360 мин)', () => {
    const bad: string[] = [];
    for (const t of explicit) {
      t.weeks!.forEach((w, wi) => w.sessions.forEach((s, si) => {
        if (!Number.isFinite(s.durationMin) || s.durationMin < 1 || s.durationMin > 360) {
          bad.push(`${t.meta.id} w${wi + 1} s${si + 1}: ${s.durationMin} мин (${s.type})`);
        }
      }));
    }
    expect(bad).toEqual([]);
  });

  it('Σ structured ≤ durationMin (план не обещает больше, чем длится)', () => {
    const bad: string[] = [];
    for (const t of explicit) {
      t.weeks!.forEach((w, wi) => w.sessions.forEach((s, si) => {
        const need = structureMin(s);
        if (need > 0 && need > s.durationMin + 0.01) {
          bad.push(`${t.meta.id} w${wi + 1} s${si + 1}: структура ${need.toFixed(0)} мин > план ${s.durationMin}`);
        }
      }));
    }
    expect(bad).toEqual([]);
  });

  it('structured: секунды в разумных пределах, reps 1–60', () => {
    const bad: string[] = [];
    for (const t of explicit) {
      t.weeks!.forEach((w, wi) => w.sessions.forEach((s, si) => {
        (s.structured ?? []).forEach(b => {
          if (!(b.workSec >= 5 && b.workSec <= 1800)) bad.push(`${t.meta.id} w${wi + 1} s${si + 1}: workSec=${b.workSec}`);
          if (!(b.restSec >= 0 && b.restSec <= 1800)) bad.push(`${t.meta.id} w${wi + 1} s${si + 1}: restSec=${b.restSec}`);
          if (!(b.reps >= 1 && b.reps <= 60)) bad.push(`${t.meta.id} w${wi + 1} s${si + 1}: reps=${b.reps}`);
        });
      }));
    }
    expect(bad).toEqual([]);
  });

  it('ни одна HIIT-сессия не длиннее 90 мин (это не интервалы)', () => {
    const bad: string[] = [];
    for (const t of explicit) {
      t.weeks!.forEach((w, wi) => w.sessions.forEach((s, si) => {
        if (s.type === 'hiit' && s.durationMin > 90) bad.push(`${t.meta.id} w${wi + 1} s${si + 1}: HIIT ${s.durationMin} мин`);
      }));
    }
    expect(bad).toEqual([]);
  });

  it('гонка/длинный старт не типизированы HIIT', () => {
    const bad: string[] = [];
    for (const t of explicit) {
      t.weeks!.forEach((w, wi) => w.sessions.forEach((s, si) => {
        const text = `${s.purpose ?? ''}`.toLowerCase();
        const isRace = /старт|забег|гонк|марафон|race|тест 2000|half marathon/.test(text);
        if (isRace && s.type === 'hiit' && s.durationMin >= 60) {
          bad.push(`${t.meta.id} w${wi + 1} s${si + 1}: гонка как HIIT ${s.durationMin} мин — «${s.purpose}»`);
        }
      }));
    }
    expect(bad).toEqual([]);
  });

  it('totalMinutes = Σ duration × weeklyFrequency (в сумме по неделе не врёт)', () => {
    for (const t of explicit) {
      const c = buildCardioCycleFromTemplate(t, { age: 30, bodyWeight: 80 });
      for (const w of c.weeks) {
        const sum = w.sessions.reduce((s, x) => s + x.durationMin * Math.max(1, Math.round(x.weeklyFrequency)), 0);
        expect(w.totalMinutes, `${t.meta.id} w${w.week}`).toBe(sum);
      }
      expect(c.totalKcal).toBe(c.weeks.reduce((s, w) => s + w.totalKcal, 0));
    }
  });
});

describe('шаблоны: пульс атлета и урезание под дни', () => {
  it('каждая сессия получает targetHr (LTHR / talk-test / возраст)', () => {
    const bad: string[] = [];
    for (const t of explicit) {
      const c = buildCardioCycleFromTemplate(t, { age: 35, restingHr: 55, bodyWeight: 80 });
      for (const w of c.weeks) {
        for (const s of w.sessions) {
          if (!s.targetHr || !(s.targetHr.max && s.targetHr.max > s.targetHr.min!)) {
            bad.push(`${t.meta.id} w${w.week}: ${s.type} без targetHr`);
          }
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('LTHR приоритетнее возраста', () => {
    const t = explicit.find(x => x.meta.sport === 'run')!;
    const byAge = buildCardioCycleFromTemplate(t, { age: 60, bodyWeight: 80 });
    const byLthr = buildCardioCycleFromTemplate(t, { age: 60, lthr: 175, bodyWeight: 80 });
    const z2age = byAge.weeks[0].sessions.find(s => s.type === 'zone2')?.targetHr?.max ?? 0;
    const z2lthr = byLthr.weeks[0].sessions.find(s => s.type === 'zone2')?.targetHr?.max ?? 0;
    expect(z2lthr).toBeGreaterThan(z2age);
  });

  it('lowImpact: ни одной беговой сессии', () => {
    const bad: string[] = [];
    for (const t of explicit) {
      const c = buildCardioCycleFromTemplate(t, { lowImpact: true, equipment: ['running', 'cycling', 'rowing', 'swimming', 'elliptical'], bodyWeight: 80 });
      for (const w of c.weeks) {
        for (const s of w.sessions) {
          if (s.equipment === 'running') bad.push(`${t.meta.id} w${w.week}: бег при lowImpact`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('daysAvailable=1: одна сессия в неделю, но потеря минут озвучена', () => {
    for (const t of explicit) {
      const c = buildCardioCycleFromTemplate(t, { daysAvailable: 1, bodyWeight: 80 });
      for (const w of c.weeks) expect(w.sessions.length, `${t.meta.id} w${w.week}`).toBeLessThanOrEqual(1);
      if (t.weeks!.some(w => w.sessions.length > 1)) {
        expect(c.rationale.join(' '), `${t.meta.id}: нет честной ноты об урезании`).toMatch(/убрано|урезан/i);
      }
    }
  });
});

describe('селектор: жёсткие гейты', () => {
  it('новичку в топ-3 не попадают планы на 2 ступени выше', () => {
    const top = rankCardioCycles({ goal: 'health', level: 'beginner' }).slice(0, 3);
    const advancedOnly = top.filter(r => r.template.meta.level.every(l => l === 'advanced'));
    expect(advancedOnly).toEqual([]);
  });

  it('гейт даёт предупреждение и большой минус скорингу', () => {
    const hard = CARDIO_CYCLES.find(t => t.meta.level.every(l => l === 'advanced'));
    if (!hard) return;
    const r = scoreCardioTemplate(hard, { level: 'beginner' });
    expect(r.warnings?.join(' ')).toMatch(/выше/i);
    expect(r.score).toBeLessThan(-20);
  });

  it('новичку с объёмом >300 мин/нед — предупреждение', () => {
    for (const t of CARDIO_CYCLES) {
      const r = scoreCardioTemplate(t, { level: 'beginner' });
      const peak = cardioTemplateWeeklyMinutes(t);
      if (peak > 300) {
        expect(r.warnings?.some(w => /300/.test(w)), `${t.meta.id} ${peak}`).toBe(true);
      }
    }
  });

  it('conditions из meta отдаются чек-листом', () => {
    const t = CARDIO_CYCLES[0];
    const r = scoreCardioTemplate(t, {});
    expect(r.conditions).toEqual(t.meta.conditions);
  });
});

describe('инвариант «план по дням = план недели»', () => {
  it('для любого шаблона и любой недели сумма по дням равна totalMinutes', () => {
    for (const t of explicit) {
      const c = buildCardioCycleFromTemplate(t, { age: 35, bodyWeight: 80 });
      c.weeks.forEach((w, wi) => {
        const sched = expandWeekSchedule(w, c.startDate, { weekNo: w.week ?? wi + 1 });
        const sum = sched.reduce((s, x) => s + x.session.durationMin, 0);
        expect(sum, `${t.meta.id} w${w.week ?? wi + 1}`).toBe(w.totalMinutes);
      });
    }
  });

  it('4×40 мин раскладываются на 4 РАЗНЫЕ даты, план дня = 40 мин', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: '2026-03-02' });
    const w = c.weeks[0];
    w.sessions = [{ ...w.sessions[0], type: 'zone2', durationMin: 40, weeklyFrequency: 4, dayOfWeek: undefined }];
    w.totalMinutes = 160;
    const sched = expandWeekSchedule(w, c.startDate, { weekNo: 1 });
    expect(sched).toHaveLength(4);
    expect(new Set(sched.map(x => x.date)).size).toBe(4);
    const byDate = new Map<string, number>();
    for (const x of sched) byDate.set(x.date, (byDate.get(x.date) ?? 0) + x.session.durationMin);
    expect([...byDate.values()]).toEqual([40, 40, 40, 40]);
  });
});

describe('HIIT-политика: дефицит ≤ 2/нед, офф-сезон ≤ 3/нед', () => {
  const maxHiitPerWeek = (goal: 'cut' | 'mass' | 'maintenance'): number => {
    const c = buildCardioCycle({ goal, totalWeeks: 8, startDate: '2026-03-02' });
    return Math.max(...c.weeks.map(w =>
      w.sessions.filter(s => s.type === 'hiit' && !s.optional)
        .reduce((s, x) => s + Math.max(1, Math.round(x.weeklyFrequency)), 0)));
  };

  it('дефицит (cut): не больше 2 HIIT в неделю', () => {
    expect(maxHiitPerWeek('cut')).toBeLessThanOrEqual(2);
  });

  it('офф-сезон (mass/maintenance): не больше 3 HIIT в неделю', () => {
    expect(maxHiitPerWeek('mass')).toBeLessThanOrEqual(3);
    expect(maxHiitPerWeek('maintenance')).toBeLessThanOrEqual(3);
  });

  it('bb_prep: не больше 2 HIIT в неделю', () => {
    const c = buildCardioCycle({ goal: 'bb_prep', totalWeeks: 8, startDate: '2026-03-02' });
    const worst = Math.max(...c.weeks.map(w => w.sessions.filter(s => s.type === 'hiit')
      .reduce((s, x) => s + Math.max(1, Math.round(x.weeklyFrequency)), 0)));
    expect(worst).toBeLessThanOrEqual(2);
  });
});

describe('шаблоны: безопасность новичка', () => {
  it('новичок на продвинутом плане получает ноту', () => {
    for (const t of explicit) {
      const hardForBeginner = (t.meta.level ?? []).length > 0 && !t.meta.level.includes('beginner');
      if (!hardForBeginner) continue;
      const c = buildCardioCycleFromTemplate(t, { level: 'beginner', bodyWeight: 80 });
      expect(c.rationale.join(' '), t.meta.id).toMatch(/новичк/i);
    }
  });
});
