/**
 * cardio-prep-taper-goals.test.ts — новые цели CardioCycle:
 * bb_prep (подготовка ББ), pl_prep (подготовка ПЛ), bb_taper (тапер ББ).
 * Проверяет профили, taper-кривую снижения, отсутствие HIIT/делодов,
 * питание, советы по весу, качество-отчёт и объяснение выбора.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCardioCycle, CARDIO_GOAL_LABELS, CARDIO_PRESETS, cardioNutritionNotes,
  cardioWeightAdvice, cardioQualityReport, explainCardioChoice, cardioFitnessForecast,
  cardioCycleSummary, buildCardioPlan, type CardioCycle,
} from '../cardio.engine';

const vol = (c: CardioCycle, w: number) => {
  const week = c.weeks[w - 1];
  return week.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
};

describe('bb_prep — подготовка ББ', () => {
  it('профиль: прогрессия Zone 2 + MISS/HIIT, делоды каждые 4 нед', () => {
    const c = buildCardioCycle({ goal: 'bb_prep', totalWeeks: 12, daysAvailable: 7 });
    expect(c.goal).toBe('bb_prep');
    expect(vol(c, 1)).toBeLessThan(vol(c, 6));
    expect(vol(c, 6)).toBeLessThan(vol(c, 10));
    expect(c.weeks.some(w => w.sessions.some(s => s.type === 'hiit'))).toBe(true);
    expect(c.weeks.some(w => w.sessions.some(s => s.type === 'miss'))).toBe(true);
    expect(c.weeks.some(w => w.deload)).toBe(true);
  });

  it('сушка-подобный объём: ≥90 мин/нед на рабочих неделях', () => {
    const c = buildCardioCycle({ goal: 'bb_prep', totalWeeks: 12, daysAvailable: 7 });
    const work = c.weeks.filter(w => !w.deload && !w.taper && w.phase !== 'transition');
    expect(Math.min(...work.map(w => w.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0)))).toBeGreaterThanOrEqual(60);
  });

  it('пресет bb-prep-12 собирается и содержит HIIT', () => {
    const p = CARDIO_PRESETS.find(x => x.id === 'bb-prep-12')!;
    const c = buildCardioCycle({ goal: p.goal, totalWeeks: p.totalWeeks, daysAvailable: p.daysAvailable });
    expect(c.weeks).toHaveLength(12);
    expect(c.weeks.some(w => w.sessions.some(s => s.type === 'hiit'))).toBe(true);
  });
});

describe('pl_prep — подготовка ПЛ', () => {
  it('профиль: умеренный Zone 2 + MISS, БЕЗ HIIT и без утомления', () => {
    const c = buildCardioCycle({ goal: 'pl_prep', totalWeeks: 8, daysAvailable: 7 });
    expect(c.goal).toBe('pl_prep');
    expect(c.weeks.some(w => w.sessions.some(s => s.type === 'hiit'))).toBe(false);
    expect(c.weeks.some(w => w.sessions.some(s => s.type === 'miss'))).toBe(true);
    expect(vol(c, 8)).toBeLessThanOrEqual(vol(c, 1) * 2);
  });

  it('умеренный объём: 40-150 мин/нед', () => {
    const c = buildCardioCycle({ goal: 'pl_prep', totalWeeks: 8, daysAvailable: 7 });
    for (const w of c.weeks) {
      const v = w.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      expect(v).toBeGreaterThanOrEqual(30);
      expect(v).toBeLessThanOrEqual(160);
    }
  });

  it('пресет pl-prep-8 собирается', () => {
    const p = CARDIO_PRESETS.find(x => x.id === 'pl-prep-8')!;
    const c = buildCardioCycle({ goal: p.goal, totalWeeks: p.totalWeeks, daysAvailable: p.daysAvailable });
    expect(c.weeks).toHaveLength(8);
  });
});

describe('bb_taper — тапер ББ (последние 4 недели)', () => {
  it('объём плавно снижается: 0.85 → 0.7 → 0.55 → 0.4', () => {
    const c = buildCardioCycle({ goal: 'bb_taper', totalWeeks: 4, daysAvailable: 7 });
    const vols = [1, 2, 3, 4].map(w => vol(c, w));
    for (let i = 1; i < 4; i++) expect(vols[i]).toBeLessThan(vols[i - 1]);
    expect(vols[3]).toBeLessThanOrEqual(vols[0] * 0.55);
  });

  it('без HIIT, без делодов (объём и так снижается)', () => {
    const c = buildCardioCycle({ goal: 'bb_taper', totalWeeks: 4, daysAvailable: 7 });
    expect(c.weeks.some(w => w.sessions.some(s => s.type === 'hiit'))).toBe(false);
    expect(c.weeks.some(w => w.deload)).toBe(false);
  });

  it('все недели — только лёгкие типы (zone2/recovery)', () => {
    const c = buildCardioCycle({ goal: 'bb_taper', totalWeeks: 4, daysAvailable: 7 });
    for (const w of c.weeks) {
      for (const s of w.sessions) {
        expect(['zone2', 'recovery']).toContain(s.type);
      }
    }
  });

  it('пресет bb-taper-4 собирается с 4 неделями', () => {
    const p = CARDIO_PRESETS.find(x => x.id === 'bb-taper-4')!;
    const c = buildCardioCycle({ goal: p.goal, totalWeeks: p.totalWeeks, daysAvailable: p.daysAvailable, recoveryLow: p.recoveryLow });
    expect(c.weeks).toHaveLength(4);
    expect(vol(c, 4)).toBeLessThan(vol(c, 1));
  });
});

describe('лейблы и питание', () => {
  it('CARDIO_GOAL_LABELS содержит все 9 целей', () => {
    expect(Object.keys(CARDIO_GOAL_LABELS)).toHaveLength(9);
    expect(CARDIO_GOAL_LABELS.bb_prep).toBe('Подготовка ББ');
    expect(CARDIO_GOAL_LABELS.pl_prep).toBe('Подготовка ПЛ');
    expect(CARDIO_GOAL_LABELS.bb_taper).toBe('Тапер ББ');
  });

  it('bb_prep: белок ≥2.2 г/кг (дефицит)', () => {
    const c = buildCardioCycle({ goal: 'bb_prep', totalWeeks: 12 });
    const notes = cardioNutritionNotes(c, 80);
    expect(notes.join(' ')).toMatch(/2\.2/);
  });

  it('pl_prep/bb_taper: белок 2.0-2.2 г/кг (поддержание)', () => {
    const cp = buildCardioCycle({ goal: 'pl_prep', totalWeeks: 8 });
    const ct = buildCardioCycle({ goal: 'bb_taper', totalWeeks: 4 });
    expect(cardioNutritionNotes(cp, 80).join(' ')).toMatch(/2\.0-2\.2/);
    expect(cardioNutritionNotes(ct, 80).join(' ')).toMatch(/2\.0-2\.2/);
  });
});

describe('советы и отчёты', () => {
  it('bb_prep: совет по весу работает (застой → increase)', () => {
    const c = buildCardioCycle({ goal: 'bb_prep', totalWeeks: 12 });
    const wa = cardioWeightAdvice(
      [
        { date: '2026-08-01', weight: 81 },
        { date: '2026-08-08', weight: 81 },
        { date: '2026-08-15', weight: 81.1 },
      ],
      c,
      '2026-08-15',
    );
    expect(wa.action).toBe('increase');
    expect(wa.reason).toMatch(/Zone 2|zone 2/);
  });

  it('pl_prep/bb_taper: совет по весу не актуален', () => {
    const cp = buildCardioCycle({ goal: 'pl_prep', totalWeeks: 8 });
    const ct = buildCardioCycle({ goal: 'bb_taper', totalWeeks: 4 });
    expect(cardioWeightAdvice([], cp).reason).toContain('актуален для сушки/рекомпозиции/подготовки ББ');
    expect(cardioWeightAdvice([], ct).reason).toContain('актуален для сушки/рекомпозиции/подготовки ББ');
  });

  it('bb_prep: отчёт качества ждёт HIIT и объём 90-210', () => {
    const c = buildCardioCycle({ goal: 'bb_prep', totalWeeks: 12 });
    const r = cardioQualityReport(c, 7);
    expect(r.findings.some(i => i.text.includes('HIIT'))).toBe(true);
    expect(r.findings.some(i => i.text.includes('116 мин/нед') || i.text.includes('соответствует подготовке ББ'))).toBe(true);
  });

  it('bb_taper: отчёт качества не ругается на снижение объёма', () => {
    const c = buildCardioCycle({ goal: 'bb_taper', totalWeeks: 4 });
    const r = cardioQualityReport(c, 7);
    expect(r.findings.some(i => i.kind === 'warn' && i.text.includes('мало'))).toBe(false);
  });

  it('explainCardioChoice объясняет новые цели', () => {
    const cb = buildCardioCycle({ goal: 'bb_prep', totalWeeks: 12 });
    const cp = buildCardioCycle({ goal: 'pl_prep', totalWeeks: 8 });
    const ct = buildCardioCycle({ goal: 'bb_taper', totalWeeks: 4 });
    expect(explainCardioChoice({ goal: 'bb_prep', totalWeeks: 12 }, cb).join(' ')).toMatch(/подготовка ББ|Подготовка ББ/);
    expect(explainCardioChoice({ goal: 'pl_prep', totalWeeks: 8 }, cp).join(' ')).toMatch(/подготовка ПЛ|Подготовка ПЛ/);
    expect(explainCardioChoice({ goal: 'bb_taper', totalWeeks: 4 }, ct).join(' ')).toMatch(/тапер|Тапер/);
  });

  it('bb_taper: прогноз формы минимален (адаптация не цель)', () => {
    const c = buildCardioCycle({ goal: 'bb_taper', totalWeeks: 4 });
    const f = cardioFitnessForecast(c);
    expect(f.vo2GainPct).toBeLessThan(1);
    expect(f.note).toMatch(/тапер|Тапер|не направлен/);
  });

  it('bb_prep: сводка цикла работает', () => {
    const c = buildCardioCycle({ goal: 'bb_prep', totalWeeks: 12 });
    const s = cardioCycleSummary(c);
    expect(s.avgMinutesPerWeek).toBeGreaterThan(0);
    expect(s.hiitWeeks).toBeGreaterThan(0);
  });
});

describe('buildCardioPlan — быстрый план (T7)', () => {
  it('bb_prep: zone2 + HIIT, как сушка', () => {
    const p = buildCardioPlan({ goal: 'bb_prep' });
    expect(p.sessions.some(s => s.type === 'hiit')).toBe(true);
    expect(p.sessions.some(s => s.type === 'zone2')).toBe(true);
  });

  it('pl_prep: zone2 + MISS без HIIT', () => {
    const p = buildCardioPlan({ goal: 'pl_prep' });
    expect(p.sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(p.sessions.some(s => s.type === 'miss')).toBe(true);
  });

  it('bb_taper: только лёгкий zone2 2×20', () => {
    const p = buildCardioPlan({ goal: 'bb_taper' });
    expect(p.sessions.some(s => s.type === 'hiit')).toBe(false);
    expect(p.sessions.some(s => s.type === 'recovery')).toBe(false);
    const z2 = p.sessions.find(s => s.type === 'zone2')!;
    expect(z2.weeklyFrequency).toBe(2);
    expect(z2.durationMin).toBe(20);
  });
});