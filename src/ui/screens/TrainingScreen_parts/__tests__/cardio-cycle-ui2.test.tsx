/**
 * cardio-cycle-ui2.test.tsx — UI-поверхность новых движков:
 * темпы VDOT, валидация, кросс-мезо, HIIT-секция, рекорды, каскад A/B/C.
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { parsePaceText } from '../../../../engines/lms/cardio-personal-zones.engine';
import { applyMesoMult } from '../../../../engines/lms/cardio-meso-progression.engine';
import { applyCardioCompetitionCascade, type CardioCycle } from '../../../../engines/lms/cardio.engine';
import { buildCardioCycleFromTemplateId } from '../../../../engines/lms/cardio-templates.engine';
import { CardioValidationCard, CardioMesoRow } from '../CardioPlanExtras';
import { CardioHiitSection } from '../CardioHiitSection';
import { CardioRecordsSection } from '../CardioRecordsSection';
import { CardioConstructor } from '../CardioConstructor';
import { requestCardioTemplateBuild } from '../../../../engines/lms/cardio-cycle-bridge';
import { loadActiveCardioCycle } from '../../../../engines/lms/cardio.engine';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';
const PENDING_KEY = 'he_cardio_template_pending';
const WIZARD_KEY = 'he_cardio_wizard_state';
const RECORDS_KEY = 'he_cardio_records';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(WIZARD_KEY);
    localStorage.removeItem(RECORDS_KEY);
  } catch { /* ignore */ }
});

describe('parsePaceText', () => {
  it('M:SS, десятичные, секунды, мусор', () => {
    expect(parsePaceText('5:20')).toBe(320);
    expect(parsePaceText('5.5')).toBe(330);
    expect(parsePaceText('320')).toBe(320);
    expect(parsePaceText('')).toBeNull();
    expect(parsePaceText('abc')).toBeNull();
    expect(parsePaceText('5:75')).toBeNull();
    expect(parsePaceText('1:00')).toBeNull();
  });
});

describe('applyMesoMult', () => {
  it('mult ≤ 1 — тот же объект (no-op)', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-base-12', {})!;
    expect(applyMesoMult(c, 1)).toBe(c);
    expect(applyMesoMult(c, 0.9)).toBe(c);
  });
  it('mult > 1 — длительности растут, итоги сходятся', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-base-12', {})!;
    const next = applyMesoMult(c, 1.1);
    expect(next).not.toBe(c);
    expect(next.weeks[0].totalMinutes).toBeGreaterThan(c.weeks[0].totalMinutes);
    for (const w of next.weeks) {
      const mins = w.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      expect(w.totalMinutes).toBe(mins);
    }
    expect(next.rationale.some(r => r.includes('×1.1'))).toBe(true);
  });
});

describe('CardioValidationCard', () => {
  it('показывает скор и замечания', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-base-12', {})!;
    const bad: CardioCycle = {
      ...c,
      weeks: c.weeks.map((w, i) => (i === 5 ? { ...w, totalMinutes: w.totalMinutes * 1.5 } : w)),
    };
    const { container } = render(<CardioValidationCard cycle={bad} beginner={false} />);
    expect(container.textContent).toContain('Валидация плана');
    expect(container.textContent).toContain('/100');
  });
  it('без цикла — пусто', () => {
    const { container } = render(<CardioValidationCard cycle={null} beginner={false} />);
    expect(container.textContent).toBe('');
  });
});

describe('CardioMesoRow', () => {
  it('совет + тоггл с aria-pressed', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<CardioMesoRow advice="совет" mult={1.1} on={false} onToggle={onToggle} />);
    expect(screen.getByText('совет')).toBeTruthy();
    const btn = screen.getByRole('button', { name: /прошлого цикла/ });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<CardioMesoRow advice="совет" mult={1.1} on={true} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: /прошлого цикла/ }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('CardioHiitSection', () => {
  it('3 протокола + клик отдаёт id и калибровку', () => {
    const onAdd = vi.fn();
    const { container } = render(<CardioHiitSection onAdd={onAdd} />);
    expect(container.textContent).toContain('Norwegian 4×4');
    expect(container.textContent).toContain('Billat 30-30');
    expect(container.textContent).toContain('Tabata');
    fireEvent.change(container.querySelector('input[aria-label="HRmax для 4×4"]') as HTMLInputElement, { target: { value: '190' } });
    fireEvent.click(screen.getByRole('button', { name: /Norwegian 4×4.*в неделю 1/ }));
    expect(onAdd).toHaveBeenCalledWith('norwegian-4x4', expect.objectContaining({ hrMax: 190 }));
  });
});

describe('CardioRecordsSection', () => {
  it('добавление 5к + прогноз Riegel + удаление', async () => {
    render(<CardioRecordsSection />);
    fireEvent.change(screen.getByLabelText('Минуты рекорда'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Секунды рекорда'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('＋ Добавить'));
    await waitFor(() => { expect(screen.getByText('20:00')).toBeTruthy(); });
    expect(screen.getByText(/Прогноз: 41:42/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Удалить рекорд/ }));
    await waitFor(() => { expect(screen.queryByText('20:00')).toBeNull(); });
  });
});

describe('каскад A/B/C (движок)', () => {
  it('A на нед 9: нед 9 — peak, 7-8 — taper', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-c25k-9', {})!;
    const out = applyCardioCompetitionCascade(c, [{ week: 9, priority: 'A' }]);
    expect(out.weeks[8].phase).toBe('peak');
    expect(out.weeks[6].taper).toBe(true);
    expect(out.weeks[7].taper).toBe(true);
    expect(out.weeks[0].taper).toBe(false);
  });
  it('C на рабочую неделю: HIIT убран, остальные целы', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-half-14', {})!;
    const before = c.weeks[9].sessions.filter(s => s.type === 'hiit').length;
    expect(before).toBeGreaterThan(0);
    const out = applyCardioCompetitionCascade(c, [{ week: 10, priority: 'C' }]);
    expect(out.weeks[9].sessions.every(s => s.type !== 'hiit')).toBe(true);
    expect(out.weeks[9].sessions.length).toBeGreaterThan(0);
  });
});

describe('CardioConstructor — сквозная проводка', () => {
  it('шаблон + темп VDOT + старт A: темп в сессиях, нед 9 — peak', async () => {
    try {
      localStorage.setItem(WIZARD_KEY, JSON.stringify({
        version: 2,
        easyPace: '6:00',
        comps: [{ id: 'c1', name: 'Старт', week: 9, priority: 'A' }],
      }));
    } catch { /* ignore */ }
    requestCardioTemplateBuild('cardio-run-c25k-9');
    render(<CardioConstructor />);
    await waitFor(() => { expect(loadActiveCardioCycle()).not.toBeNull(); });
    const c = loadActiveCardioCycle()!;
    expect(c.weeks[8].phase).toBe('peak');
    const z2 = c.weeks.flatMap(w => w.sessions).find(s => s.type === 'zone2');
    expect(z2?.purpose).toContain('6:00/км');
  });
  it('шаг Атлет показывает поля темпов', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Атлет/ }));
    fireEvent.click(screen.getByRole('button', { name: /полевые тесты/ }));
    expect(screen.getByLabelText('Темп E')).toBeTruthy();
    expect(screen.getByLabelText('Темп T')).toBeTruthy();
    expect(screen.getByLabelText('Темп I')).toBeTruthy();
  });
  it('taper выкл + старт A: каскад не накладывается (opt-out старше)', async () => {
    try {
      localStorage.setItem(WIZARD_KEY, JSON.stringify({
        version: 2,
        taperEnabled: false,
        comps: [{ id: 'c1', name: 'Старт', week: 9, priority: 'A' }],
      }));
    } catch { /* ignore */ }
    requestCardioTemplateBuild('cardio-run-c25k-9');
    render(<CardioConstructor />);
    await waitFor(() => { expect(loadActiveCardioCycle()).not.toBeNull(); });
    const c = loadActiveCardioCycle()!;
    expect(c.weeks.some(w => w.phase === 'taper')).toBe(false);
  });
});
