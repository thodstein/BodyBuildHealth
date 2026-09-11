/**
 * taper-hub-pro.test.tsx — PRO-план хаба «Периодизация и Тапер» (P1–P5).
 * P1: главная кривая = канон, пик-цикл главнее режима, last-hard UI, варнинги прикидов.
 * P2: мёртвые слайдеры удалены, PRO-2 колонки, trial-замок, CSV/XSS-гарды.
 * P3: адаптив-high → 3 нед, пик-дата не двигается (движок), UI empty-state.
 * P4: explainer тапер≠делод, сценарии пусты, мёртвые storage не пишутся.
 * P5: сценарии CRUD/кап, префилл из макро, residual-хинты.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TaperPlannerTab, attemptWarnings, loadTaperScenarios, saveTaperScenario, removeTaperScenario, macroCompetitionDate, taperEscHtml, taperCsvCell, TAPER_RESIDUAL_HINTS } from '../TaperPlannerTab';
import { buildPLTaperCurve } from '../../../../engines/lms/lms-taper.engine';
import { getPeakCycles, buildPeakCycleTaperCurve } from '../../../../engines/lms/pl-peak-cycle-taper.engine';
import { TAPER_VS_DELOAD_NOTE, manipulationLockNote, recommendBBTaperConfig } from '../../../../engines/bb/bb-contest-prep.engine';

function seedProfile(weight = 80) {
  try {
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { personal: { weight, age: 25, height: 180, sex: 'male' }, training: { pmSquat: 180, pmBench: 120, pmDeadlift: 220 } } }));
    localStorage.setItem('he_training_profile', JSON.stringify({ pmSquat: 180, pmBench: 120, pmDead: 220 }));
  } catch {}
}

describe('P1 — честный PL-тапер', () => {
  it('главная кривая = канон: 2 нед pl, объём <100%, интенсивность сохранена', () => {
    const curve = buildPLTaperCurve({ taperWeeks: 2, mode: 'pl' });
    expect(curve.length).toBe(2);
    const last = curve[curve.length - 1];
    expect(last.volumePct).toBeLessThan(1);
    expect(last.volumePct).toBeGreaterThan(0.3);
  });

  it('пик-цикл главнее режима: кривая из цикла строится', () => {
    const peaks = getPeakCycles();
    expect(peaks.length).toBeGreaterThan(0);
    const curve = buildPeakCycleTaperCurve(peaks[0].meta.id, 2);
    expect(curve.length).toBeGreaterThan(0);
    expect(curve[curve.length - 1].volumePct).toBeLessThan(1);
  });

  it('attemptWarnings: aggressive — варнинг, balanced — пусто', () => {
    expect(attemptWarnings('aggressive').length).toBeGreaterThan(0);
    expect(attemptWarnings('aggressive')[0]).toMatch(/93%/);
    expect(attemptWarnings('balanced')).toEqual([]);
    expect(attemptWarnings('conservative')).toEqual([]);
  });

  it('UI: per-lift last-hard селекты с каноном рендерятся', () => {
    localStorage.clear(); seedProfile(80);
    try {
      render(<TaperPlannerTab />);
      expect(screen.getByText(/Последний тяжёлый день по лифтам/)).toBeTruthy();
      expect(screen.getAllByText(/канон/).length).toBeGreaterThan(0);
    } finally { cleanup(); localStorage.clear(); }
  });
});

describe('P2 — честный BB-пик', () => {
  beforeEach(() => { localStorage.clear(); seedProfile(80); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('мёртвые слайдеры удалены: нет «Толерантность к углеводам»', () => {
    render(<TaperPlannerTab />);
    fireEvent.click(screen.getByText(/BB: Шоу-пик/));
    expect(screen.queryByText(/Толерантность к углеводам/)).toBeNull();
    expect(screen.getByText(/ББ-авто → шаг Contest/)).toBeTruthy();
  });

  it('BB-превью: таблица с клетчаткой/калием + подсказка про сохранённый план', () => {
    render(<TaperPlannerTab />);
    fireEvent.click(screen.getByText(/BB: Шоу-пик/));
    expect(screen.getByText(/превью \(нет сохранённого плана\)/)).toBeTruthy();
    expect(screen.getByText(/Клетч\./)).toBeTruthy();
  });

  it('trial-замок: high-вода без trial — lockNote не null', () => {
    const cfg: any = { sex: 'male', category: 'mens_physique', weightKg: 80, experienceLevel: 'intermediate', enhanced: false, prepCount: 0, showDate: '2026-10-01', weeksOut: 2, trainingProtocol: 'bb', carbLoadStrategy: 'moderate', waterStrategy: 'high', sodiumStrategy: 'stable' };
    expect(manipulationLockNote(cfg)).toMatch(/🔒/);
  });

  it('CSV-антиформула и XSS-escape', () => {
    expect(taperCsvCell('=cmd|calc')).toMatch(/^"'=cmd/);
    expect(taperCsvCell('80')).toBe('"80"');
    expect(taperEscHtml('<script>alert(1)</script>')).not.toMatch(/<script>/);
    expect(taperEscHtml('<script>alert(1)</script>')).toMatch(/&lt;script&gt;/);
  });
});

describe('P3 — адаптив из дневника', () => {
  it('high-усталость → 3 нед (движок), пик-дата не двигается (нет поля даты в rec)', () => {
    const rec = recommendBBTaperConfig({ fatigue: 95 });
    expect(rec.weeksOut).toBe(3);
    expect((rec as any).showDate).toBeUndefined();
    expect(rec.reasons.join(' ')).toMatch(/усталость/);
  });

  it('UI: empty-state адаптива без sRPE', () => {
    localStorage.clear(); seedProfile(80);
    try {
      render(<TaperPlannerTab />);
      expect(screen.getByText(/Адаптив из дневника/)).toBeTruthy();
      expect(screen.getByText(/Нет данных sRPE/)).toBeTruthy();
    } finally { cleanup(); localStorage.clear(); }
  });
});

describe('P4 — гигиена', () => {
  beforeEach(() => { localStorage.clear(); seedProfile(80); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('TAPER_VS_DELOAD_NOTE: тапер держит ≥85%, делод роняет', () => {
    expect(TAPER_VS_DELOAD_NOTE).toMatch(/85%/);
    expect(TAPER_VS_DELOAD_NOTE).toMatch(/Делод/);
  });

  it('UI: explainer рендерится в планере', () => {
    render(<TaperPlannerTab />);
    expect(screen.getByText(/Тапер держит вес/)).toBeTruthy();
  });

  it('мёртвые storage не пишутся: сейв идёт только в сценарии', () => {
    render(<TaperPlannerTab />);
    fireEvent.click(screen.getByRole('button', { name: /Сохранить сценарий пика/ }));
    expect(localStorage.getItem('he_taper_plan')).toBeNull();
    expect(localStorage.getItem('he_bb_peak_plan')).toBeNull();
    expect(loadTaperScenarios().length).toBe(1);
  });
});

describe('P5 — сценарии + годовой мост + экспорт', () => {
  beforeEach(() => { localStorage.clear(); seedProfile(80); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('CRUD сценариев + кап 6', () => {
    for (let i = 0; i < 8; i++) {
      saveTaperScenario({ id: `t${i}`, savedAt: Date.now() + i, kind: 'pl', meetDate: '2026-10-01', weeks: 2, volumePct: 0.5, rir: '+2', label: `T${i}` });
    }
    const arr = loadTaperScenarios();
    expect(arr.length).toBe(6);
    expect(arr[0].id).toBe('t7');
    removeTaperScenario('t7');
    expect(loadTaperScenarios().length).toBe(5);
  });

  it('macroCompetitionDate: пусто → null; с he_pl_macro → дата', () => {
    expect(macroCompetitionDate()).toBeNull();
    localStorage.setItem('he_pl_macro', JSON.stringify({ competitions: [{ id: 'c1', name: 'Чемпионат', week: 12, date: '2026-11-15' }] }));
    expect(macroCompetitionDate()).toEqual({ date: '2026-11-15', name: 'Чемпионат' });
  });
});

describe('Добивка «всё полностью»: мост + хаб + разрез', () => {
  beforeEach(() => { localStorage.clear(); seedProfile(80); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('peakHandler: extras уезжают в meta.notes + revisions, без extras — как было', async () => {
    const { applyBridgePayloadDispatch } = await import('../planner-bridge-handlers');
    const { createBlank } = await import('../../../../engines/user-program/program-store');
    const mkCtx = (update: any): any => ({ program: createBlank('bb'), dir: 'bb', update, onChange: () => {}, showToast: () => {}, tprofile: {} });
    const calls1: any[] = [];
    const ctx1 = mkCtx((p: any) => { calls1.push(p); });
    ctx1.program.bb!.weeks = [{ week: 1, phase: 'accumulation', deload: false, sessions: [{ id: 's1', name: 'Д1', focus: '', blocks: [{ id: 'b1', type: 'compound', exerciseName: 'Жим', muscle: 'chest', role: 'primary', sets: [{ reps: 5, rir: 2, weight: 100, restSec: 120 }] }] }] }] as any;
    applyBridgePayloadDispatch({ kind: 'peak', label: 'BB шоу-пик', data: { volumeMult: 0.6, rirTarget: 2, showDate: '2026-11-15', carbDoseGPerKg: 7.5, postShowTrack: 'recovery', peakCycleId: 'cycle-peak-01' }, ts: 1 } as any, ctx1);
    expect(calls1[0].meta.notes).toMatch(/2026-11-15/);
    expect(calls1[0].meta.notes).toMatch(/7\.5 г\/кг/);
    expect(calls1[0].meta.notes).toMatch(/recovery/);
    expect(calls1[0].meta.notes).toMatch(/cycle-peak-01/);
    expect(calls1[0].meta.revisions.length).toBeGreaterThan(0);
    // без extras — notes не трогаем
    const calls2: any[] = [];
    const ctx2 = mkCtx((p: any) => { calls2.push(p); });
    ctx2.program.bb!.weeks = ctx1.program.bb!.weeks;
    applyBridgePayloadDispatch({ kind: 'peak', label: 'PL пик', data: { volumeMult: 0.5, rirTarget: 1 }, ts: 1 } as any, ctx2);
    expect(calls2[0].meta?.notes ?? '').not.toMatch(/🏁 Пик/);
    expect(calls2[0].bb.weeks[calls2[0].bb.weeks.length - 1].phase).toBe('peaking');
  });

  it('хаб taper: есть оба контура (блоки + калькулятор), дефолт — блоки', async () => {
    const { PeriodizationHub } = await import('../PeriodizationHub');
    render(<PeriodizationHub initialMode="taper" />);
    expect(screen.getByText(/Блоки дизайна/)).toBeTruthy();
    expect(screen.getByText(/Калькулятор тейпера/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Калькулятор тейпера/));
    expect(screen.getByText(/Тапер-планер \(ПОЛНЫЙ\)/)).toBeTruthy();
  });

  it('разрез: попапы и taper-секция импортируются из новых файлов', async () => {
    const popups = await import('../PeriodizationPopups');
    expect(typeof popups.PhOverlay).toBe('function');
    expect(typeof popups.PhSelect).toBe('function');
    const section = await import('../PeriodizationTaperSection');
    expect(typeof section.PeriodizationTaperSection).toBe('function');
  });
});

describe('P6 residual-хинты', () => {
  it('3 записи (сила/гипертрофия/выносливость) + рендер', () => {
    expect(TAPER_RESIDUAL_HINTS.length).toBe(3);
    expect(TAPER_RESIDUAL_HINTS.map(r => r.key).join(',')).toBe('strength,hypertrophy,endurance');
    localStorage.clear(); seedProfile(80);
    try {
      render(<TaperPlannerTab />);
      expect(screen.getByText(/Residual-эффекты/)).toBeTruthy();
    } finally { cleanup(); localStorage.clear(); }
  });
});
