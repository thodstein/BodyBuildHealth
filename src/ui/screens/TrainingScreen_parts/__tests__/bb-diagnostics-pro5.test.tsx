/**
 * PRO-5 (docs/BB-DIAGNOSTICS-HUB-PRO-5.md) — UI-локи эпиков хаба диагностики ББ.
 * Э2 свежесть: профиль без ремаунта + report/balance по planNonce + локальные даты.
 * Э1 возврат: ступени возврата в работу.
 * Э3 паритет выдачи: спец-блок/трекинг.
 * Э4 каталог Разбора: план первыми + поиск.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';
import { aggregateBBVolume } from '../../../../engines/bb/bb-volume.engine';
import { buildSpecBlock } from '../../../../engines/bb/bb-spec-block.engine';

const SRC = readFileSync(resolve(__dirname, '..', 'BBDiagnosticsHub.tsx'), 'utf8');

const planWith = (ex: Array<Record<string, unknown>>) => ({ weeks: [{ sessions: [{ exercises: ex }] }] });

beforeEach(() => { localStorage.clear(); });

describe('PRO-5 Э2 свежесть данных', () => {
  it('профиль: profile-updated без ремаунта включает teen-гейт', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    expect(document.querySelector('[data-bb="teen-gate"]')).toBeNull();
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { personal: { age: 14 } } }));
    fireEvent(window, new CustomEvent('profile-updated'));
    expect(document.querySelector('[data-bb="teen-gate"]')).not.toBeNull();
  });

  it('report/balance: откат снимка пересчитывает отчёт (planNonce) — кольцо меняет балл', () => {
    localStorage.setItem('he_bb_plan_saved', JSON.stringify(planWith([
      { exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 6, rir: 2 },
    ])));
    localStorage.setItem('he_bb_plan_history', JSON.stringify([{
      date: '2026-01-01', label: 'снимок',
      plan: planWith([{ exerciseName: 'leg_ext', name: 'Разгибание ног сидя', muscle: 'quads', sets: 6, rir: 2 }]),
    }]));
    render(<BBDiagnosticsHub />);
    const before = document.querySelector('[data-bb="score"]')?.textContent || '';
    expect(before).not.toBe('');
    fireEvent.click(screen.getByText('↩ Восстановить'));
    const after = document.querySelector('[data-bb="score"]')?.textContent || '';
    expect(after).not.toBe('');
    expect(after).not.toBe(before);
  });

  it('локальные даты: снимок замеров пишется локальной датой, UTC-срез в хабе не остался', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Пропорции/ }));
    fireEvent.click(screen.getByText('Снимок сегодня'));
    const hist = JSON.parse(localStorage.getItem('he_bb_measure_history') || '[]');
    const local = new Date().toLocaleDateString('sv-SE');
    expect(hist[0]?.date).toBe(local);
    // source-guard: ни одного UTC-среза даты и ≥7 канонических localIsoDate
    expect(SRC.includes('toISOString().slice(0, 10)')).toBe(false);
    expect((SRC.match(/localIsoDate\(\)/g) || []).length).toBeGreaterThanOrEqual(7);
  });

  it('source-guard: report/balance зависят от planNonce; профиль-мемы от profileNonce', () => {
    expect(SRC).toMatch(/const balance = useMemo\([\s\S]{0,600}?\}, \[diarySessions, planNonce\]\);/);
    expect(SRC).toMatch(/state\.weakManual, planNonce\]\);/);
    expect((SRC.match(/\[profileNonce\]/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});

describe('PRO-5 Э1 возврат в работу', () => {
  it('стоп-флаг → карточка ступеней; выбор ступени 2 активен + персист', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    expect(document.querySelector('[data-bb="return-card"]')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /Острая боль/ }));
    const card = document.querySelector('[data-bb="return-card"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toMatch(/Возврат в работу/);
    const stage2 = Array.from(document.querySelectorAll('[data-bb="return-stage"]')).find((el) => /2 ·/.test(el.textContent || ''));
    expect(stage2).toBeTruthy();
    fireEvent.click(stage2!);
    expect(stage2!.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-bb="return-active"]')?.textContent).toMatch(/Активная/);
    // ступень персистится в стор хаба (в мост уедет при «→ В ББ-авто»)
    const saved = JSON.parse(localStorage.getItem('he_bb_diagnostics_hub_v1') || '{}');
    expect(saved.returnStage).toBe('2');
  });

  it('source-guard: returnTo/returnStage/returnAction уезжают в мост только при активных флагах', () => {
    expect(SRC).toMatch(/\.\.\.\(returnToPlan \? \{/);
    expect(SRC).toMatch(/returnTo: returnToPlan,/);
    expect(SRC).toMatch(/returnStage: state\.returnStage \|\| null,/);
    expect(SRC).toMatch(/returnAction: state\.returnStage \? \(returnActive\?\.action \?\? null\) : null,/);
  });
});

describe('PRO-5 Э3 паритет выдачи', () => {
  it('трекинг снимка: новый код pm-red показан RU-строкой', () => {
    localStorage.setItem('he_bb_screen_history', JSON.stringify([{ date: '2026-01-01', fails: ['heels'] }]));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Скрининг/ }));
    fireEvent.change(screen.getByTestId('bb-pm-during'), { target: { value: '8' } });
    const tr = document.querySelector('[data-bb="screen-tracked"]');
    expect(tr).not.toBeNull();
    expect(tr?.textContent).toMatch(/боль: красная/);
  });

  it('спец-блок в HTML-экспорте = показанному (реальный факт-объём, а не пустые factSets)', async () => {
    // факт-объём: 12 сетов груди за последние 7 дней (тогда factSets в выдаче не пустые)
    const d = new Date(); d.setDate(d.getDate() - 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('he_workout_log_v1', JSON.stringify([{
      date: iso,
      exercises: [{ muscleGroup: 'chest', sets: Array.from({ length: 12 }, () => ({ weightKg: 100, reps: 8 })) }],
    }]));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    // ожидаемый старт блока — тем же движком, что карточка (факт+4, кап MAV/MRV)
    const fv: any = aggregateBBVolume([{ exercises: [{ name: 'bench_bar', muscle: 'chest', sets: 12, rir: 2, role: 'accessory' }] }] as any);
    const factSets: Record<string, number> = {};
    for (const [k, v] of Object.entries(fv as any)) factSets[k] = (v as any)?.effectiveSets ?? (v as any)?.directSets ?? 0;
    const expected = buildSpecBlock({ weakZones: ['chest_upper'], factSets, level: 'intermediate', weeks: 8 }).weeks[0].targetSets.chest_upper;
    expect(expected).toBeGreaterThan(12);
    let captured: Blob | null = null;
    (URL as any).createObjectURL = (b: Blob) => { captured = b; return 'blob:mock'; };
    fireEvent.click(document.querySelector('[data-bb="export-html"]') as HTMLElement);
    expect(captured).not.toBeNull();
    const html = typeof (captured as any)?.text === 'function'
      ? await (captured as any).text()
      : await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(captured as Blob); });
    expect(html).toContain(`chest_upper ${expected}`);
    expect(html).not.toContain('chest_upper 12');
  });

  it('source-guard: specBlock-мемо — единственный вызов buildSpecBlock, им пользуются выдача/ICS/год/инъекция', () => {
    expect((SRC.match(/buildSpecBlock\(/g) || []).length).toBe(1);
    // Э5: выдача берёт мемо напрямую (HTML+CSV), ICS/год/инъекция — через const sb
    expect((SRC.match(/specBlock as any/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(SRC).toMatch(/specPayload = specBlock;/);
    expect((SRC.match(/const sb = specBlock;/g) || []).length).toBe(3);
  });
});
