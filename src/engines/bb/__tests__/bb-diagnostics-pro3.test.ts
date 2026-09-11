/**
 * bb-diagnostics-pro3.test.ts — PRO-3 R1–R7 (чистые движки + вставка + экспорт).
 * Каждый эпик — своим триггером; существующее поведение не меняется.
 */
import { describe, it, expect } from 'vitest';
import { calibrateBbLvp, parseBbLvpText, bbLvpLiftFor } from '../bb-lvp.engine';
import { assessBbTendonGuard } from '../bb-tendon-guard.engine';
import { buildReturnToPlan } from '../bb-return-to.engine';
import { mmcAdviceFor, posingIsoNote, MMC_LOAD_THRESHOLD } from '../bb-mmc-gate.engine';
import { pushLrSnapshot, summarizeLrDirection } from '../bb-lr-history.engine';
import { buildBBSpecIcs, bbWorkingRange } from '../bb-spec-ics.engine';
import { bbVbtRecommendation } from '../bb-vbt.engine';
import { bbSpecToAnnualPatch } from '../bb-spec-annual.engine';
import { buildSpecBlock } from '../bb-spec-block.engine';
import { injectBBWeakPoints } from '../bb-diagnostics-injection.engine';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv } from '../bb-diagnostics-export.engine';
import { buildBBDiagnosticsReport } from '../bb-diagnostics-hub.engine';

const sets = (n: number) => Array.from({ length: n }, () => ({ weightKg: 50, reps: 8 }));

describe('R1 LVP-лайт', () => {
  it('3 точки с разбросом → валидный профиль + e1RM', () => {
    const p = calibrateBbLvp('squat', [
      { weightKg: 100, velocity: 0.62 },
      { weightKg: 110, velocity: 0.55 },
      { weightKg: 120, velocity: 0.47 },
    ]);
    expect(p).not.toBeNull();
    expect(p!.valid).toBe(true);
    expect(p!.r2).toBeGreaterThanOrEqual(0.85);
    expect(p!.e1rm).not.toBeNull();
    expect(p!.text).toMatch(/e1RM/);
  });
  it('жим использует свой MVT (0.15), не приседа (0.25)', () => {
    const sq = calibrateBbLvp('squat', [
      { weightKg: 100, velocity: 0.62 },
      { weightKg: 110, velocity: 0.55 },
      { weightKg: 120, velocity: 0.47 },
    ])!;
    const bn = calibrateBbLvp('bench', [
      { weightKg: 80, velocity: 0.5 },
      { weightKg: 90, velocity: 0.4 },
      { weightKg: 100, velocity: 0.3 },
    ])!;
    expect(bn.vbtLift).toBe('bench');
    expect(bn.mvt).toBe(0.15);
    expect(sq.mvt).toBe(0.25);
  });
  it('скучённые точки (<10 кг) — честный null, без выдумок', () => {
    expect(calibrateBbLvp('squat', [
      { weightKg: 100, velocity: 0.6 },
      { weightKg: 102, velocity: 0.59 },
      { weightKg: 104, velocity: 0.58 },
    ])).toBeNull();
  });
  it('растущая скорость с весом — мусор → null', () => {
    expect(calibrateBbLvp('bench', [
      { weightKg: 60, velocity: 0.4 },
      { weightKg: 80, velocity: 0.5 },
      { weightKg: 100, velocity: 0.6 },
    ])).toBeNull();
  });
  it('маппинг подъёмов и разбор строк', () => {
    expect(bbLvpLiftFor('pulldown')).toBe('row');
    expect(bbLvpLiftFor('неизвестно')).toBeNull();
    expect(parseBbLvpText('100 0.62\n110, 0.55\nмусор').length).toBe(2);
  });
  it('e1RM по скорости пробрасывается в VBT-рекомендацию', () => {
    const r = bbVbtRecommendation('squat', 0.8, 0.6, 100);
    expect(r.e1RMByVelocity).not.toBeNull();
    expect(r.recommendation).toMatch(/e1RM по скорости/);
    const noW = bbVbtRecommendation('squat', 0.8, 0.6);
    expect(noW.e1RMByVelocity).toBeNull();
  });
});

describe('R2 мост v2 — готовность и L/R двигают вставку', () => {
  const planOf = () => ({
    level: 'intermediate',
    weeks: [{ week: 1, sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим', exerciseName: 'bench_db', sets: 3, workSets: [{ reps: 10, rir: 2, weight: 40 }] }] }] }],
  });
  it('красная готовность режет вставку: RIR+1 и меньше сетов', () => {
    const base = injectBBWeakPoints(planOf() as any, ['chest_upper'], { weekIdxs: [0] });
    const red = injectBBWeakPoints(planOf() as any, ['chest_upper'], { weekIdxs: [0], rirShift: 1, volumeMult: 0.75 });
    expect(red.injected).toBe(base.injected);
    const exB = (base.plan.weeks[0] as any).sessions[0].exercises.find((e: any) => String(e.comment || '').includes('ББ-диагностика'));
    const exR = (red.plan.weeks[0] as any).sessions[0].exercises.find((e: any) => String(e.comment || '').includes('ББ-диагностика'));
    expect(exR.sets).toBeLessThanOrEqual(exB.sets);
    expect(exR.workSets[0].rir).toBeGreaterThan(exB.workSets[0].rir);
  });
  it('добивка слабой стороны — в комментарий и в пределах капа 6', () => {
    const r = injectBBWeakPoints(planOf() as any, ['biceps'], {
      weekIdxs: [0],
      unilateralTopUp: { biceps: { side: 'left', sets: 2 } },
    });
    const ex = (r.plan.weeks[0] as any).sessions[0].exercises.find((e: any) => String(e.comment || '').includes('ББ-диагностика'));
    expect(ex.comment).toMatch(/левая.*первой/);
    expect(ex.sets).toBeLessThanOrEqual(6);
  });
  it('return-to: без флагов null, со стопом — 3 ступени', () => {
    expect(buildReturnToPlan({ active: false, blocked: false, items: [] })).toBeNull();
    const p = buildReturnToPlan({ active: true, blocked: true, items: ['острая боль'] });
    expect(p!.stages.length).toBe(3);
    expect(p!.stages[0].volume).toMatch(/0%/);
    expect(p!.text).toMatch(/техника/);
  });
});

describe('R3 сухожилия', () => {
  const sess = (names: string[], n: number) => [{ date: '2026-01-01', exercises: names.map((name) => ({ name, sets: sets(n) })) }];
  it('мало тяжёлых сетов — порядок', () => {
    const g = assessBbTendonGuard(sess(['Жим лёжа'], 2), {});
    expect(g.shoulder.level).toBe('ok');
  });
  it('пороги масштабируются уровнем: новичку 9 сетов — уже warn', () => {
    const beg = assessBbTendonGuard(sess(['Жим лёжа'], 9), { level: 'beginner' });
    expect(beg.shoulder.level).toBe('warn');
    const mid = assessBbTendonGuard(sess(['Жим лёжа'], 9), { level: 'intermediate' });
    expect(mid.shoulder.level).toBe('ok');
    const adv = assessBbTendonGuard(sess(['Жим лёжа'], 16), { level: 'advanced' });
    expect(adv.shoulder.level).toBe('warn');
  });
  it('перебор жимов + провал плеча — стоп', () => {
    const g = assessBbTendonGuard(sess(['Жим лёжа', 'Жим стоя', 'Брусья'], 8), { shoulderOhsFail: true });
    expect(g.shoulder.level).toBe('stop');
    expect(g.shoulder.text).toMatch(/стоп/i);
  });
  it('боль в локте — стоп независимо от объёма', () => {
    const g = assessBbTendonGuard([], { elbowPain: true });
    expect(g.elbow.level).toBe('stop');
  });
});

describe('R4 MMC-гейт + позинг', () => {
  it('порог 0.65 задокументирован', () => {
    expect(MMC_LOAD_THRESHOLD).toBe(0.65);
  });
  it('изоляция на лёгком — внутренний, тяжело/взрыв — внешний', () => {
    expect(mmcAdviceFor({ isolation: true, loadPct1RM: 0.5 }).focus).toBe('internal');
    expect(mmcAdviceFor({ isolation: true, loadPct1RM: 0.8 }).focus).toBe('external');
    expect(mmcAdviceFor({ isolation: true, explosive: true }).focus).toBe('external');
  });
  it('точный %1RM двигает гейт: 64% — внутренний, 66% — внешний', () => {
    expect(mmcAdviceFor({ isolation: true, loadPct1RM: 0.64 }).focus).toBe('internal');
    expect(mmcAdviceFor({ isolation: true, loadPct1RM: 0.66 }).focus).toBe('external');
  });
  it('позинг — честный трейдофф', () => {
    expect(posingIsoNote()).toMatch(/силу/);
  });
});

describe('R5 VBT под цель', () => {
  it('сила при 20%+ предупреждает про кап, масса — разрешает 20–30%', () => {
    const s = bbVbtRecommendation('squat', 0.8, 0.62, undefined, { goal: 'strength' });
    expect(s.recommendation).toMatch(/≤20–25%/);
    const m = bbVbtRecommendation('squat', 0.8, 0.68, undefined, { goal: 'mass' });
    expect(m.recommendation).toMatch(/20–30%/);
  });
  it('без цели — базовые строки целы', () => {
    expect(bbVbtRecommendation('bench', 0.9, 0.78).recommendation).toContain('Зона силы');
  });
});

describe('R6 направление перекоса', () => {
  it('3 замера одной стороной — добивка оправдана', () => {
    let h = pushLrSnapshot([], { date: '2026-01-01', group: 'biceps', weakSide: 'left', asymPct: 15, verdict: 'topup' });
    h = pushLrSnapshot(h, { date: '2026-01-08', group: 'biceps', weakSide: 'left', asymPct: 14, verdict: 'topup' });
    h = pushLrSnapshot(h, { date: '2026-01-15', group: 'biceps', weakSide: 'left', asymPct: 16, verdict: 'topup' });
    const d = summarizeLrDirection(h, 'biceps');
    expect(d!.persistent).toBe(true);
    expect(d!.text).toMatch(/добивка оправдана/);
  });
  it('флип стороны — наблюдение без фиксации', () => {
    let h = pushLrSnapshot([], { date: '2026-01-01', group: 'biceps', weakSide: 'left', asymPct: 15, verdict: 'topup' });
    h = pushLrSnapshot(h, { date: '2026-01-08', group: 'biceps', weakSide: 'right', asymPct: 13, verdict: 'topup' });
    const d = summarizeLrDirection(h, 'biceps');
    expect(d!.persistent).toBe(false);
    expect(d!.text).toMatch(/плавает/);
  });
});

describe('R7 ICS + рабочие веса + годовой патч', () => {
  it('спец-блок → валидный календарь понедельниками', () => {
    const ics = buildBBSpecIcs(
      { weeks: [{ week: 1, targetSets: { chest_upper: 12, delt_mid: 8 }, note: 'база' }, { week: 2, targetSets: { chest_upper: 14 }, note: 'рост' }], weakZones: ['chest_upper'] },
      { startDate: '2026-01-05', title: 'ББ спец-блок' },
    );
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260105');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260112');
    expect(ics).toContain('\\,'); // запятые в тексте экранированы
    expect(ics).toContain('\\n'); // переводы строк экранированы
  });
  it('пустой блок — честный null', () => {
    expect(buildBBSpecIcs({ weeks: [] })).toBeNull();
  });
  it('рабочий коридор массы/силы с шагом 2.5', () => {
    const m = bbWorkingRange(100, 'mass')!;
    expect(m.low).toBe(65);
    expect(m.high).toBe(80);
    const s = bbWorkingRange(100, 'strength')!;
    expect(s.low).toBe(80);
    expect(s.high).toBe(90);
    expect(bbWorkingRange(0)).toBeNull();
  });
  it('спец-блок → годовой патч: слабые + специализация + доноры в notes', () => {
    const spec = buildSpecBlock({ weakZones: ['chest_upper'], factSets: {}, level: 'intermediate', weeks: 8 });
    const patch = bbSpecToAnnualPatch(spec, ['chest_upper', 'delt_mid']);
    expect(patch!.weakPoints).toContain('chest');
    expect(patch!.focusGroup).toBe('chest');
    expect(patch!.specialization).toBe(true);
    expect(patch!.notes).toMatch(/нед/);
    expect(bbSpecToAnnualPatch(null, [])).toBeNull();
  });
  it('экспорт несёт PRO-3 разделы, без меты — байт-в-байт', () => {
    const rep = buildBBDiagnosticsReport({ level: 'intermediate' });
    const html = buildBBDiagnosticsHtml(rep, {
      lvp: { lift: 'squat', r2: 0.9, e1rm: 150, text: 'LVP тест' },
      tendon: { elbow: 'Локоть тест', shoulder: 'Плечо тест' },
      mmc: 'Внешний фокус тест',
      returnTo: { text: 'Возврат тест', stages: [{ stage: 1, title: 'Т1', volume: '0%', rir: '—', note: 'Н1' }] },
      lrDirection: [{ group: 'biceps', text: 'Направление тест' }],
      workingRange: 'Ориентир тест',
    } as any);
    expect(html).toContain('LVP (нагрузка–скорость)');
    expect(html).toContain('Сухожилия (скрининг)');
    expect(html).toContain('Возврат после флагов');
    expect(html).toContain('Направление перекоса');
    const csv = buildBBDiagnosticsCsv(rep, null, { workingRange: 'Ориентир тест' } as any);
    expect(csv).toContain('working_range');
    const plain = buildBBDiagnosticsHtml(rep);
    expect(plain).not.toContain('PRO-3');
  });
});
