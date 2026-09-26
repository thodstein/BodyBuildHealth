/**
 * PRO-5 (docs/BB-DIAGNOSTICS-HUB-PRO-5.md) — UI-локи эпиков хаба диагностики ББ.
 * Э2 свежесть: профиль без ремаунта + report/balance по planNonce + локальные даты.
 * Э1 возврат: ступени возврата в работу.
 * Э3 паритет выдачи: спец-блок/трекинг.
 * Э4 каталог Разбора: план первыми + поиск.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';
import { aggregateBBVolume } from '../../../../engines/bb/bb-volume.engine';
import { buildSpecBlock } from '../../../../engines/bb/bb-spec-block.engine';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';

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

  it('source-guard: report/balance зависят от planNonce (через мемо savedPlan); профиль-мемы от profileNonce', () => {
    // Э5-доводка: план читается один раз (savedPlan), report/balance зависят от него
    expect(SRC).toMatch(/const savedPlan = useMemo\([\s\S]{0,300}?\}, \[planNonce, diarySessions\]\);/);
    expect(SRC).toMatch(/const balance = useMemo\([\s\S]{0,300}?\}, \[savedPlan\]\);/);
    expect(SRC).toMatch(/state\.weakManual, savedPlan\]\);/);
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

  /* П2 (26.09.2026): критерии выхода должны быть ИЗМЕРИМЫМИ и вводимыми, а не декларацией. */
  it('П2: карточка показывает 4 критерия с «нет данных» и принимает ввод', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getAllByText('Верх груди')[0]);
    fireEvent.click(screen.getByRole('switch', { name: /Острая боль/ }));

    const box = document.querySelector('[data-bb="return-criteria"]');
    expect(box).not.toBeNull();
    const rows = Array.from(document.querySelectorAll('[data-bb="return-criterion"]'));
    expect(rows).toHaveLength(4);
    // без ввода все — «нет данных», а не «зелёные»
    for (const r of rows) expect(r.getAttribute('data-state')).toBe('no_data');
    expect(box?.textContent).toContain('0 из 4');
    expect(box?.textContent).toMatch(/«нет данных»/);
    expect(box?.textContent).toMatch(/а не «всё хорошо»/);

    // ввод боли 8/10 → провал по критерию нагрузки
    const load = document.querySelector('[data-bb="return-criterion-input"][data-key="retPainLoad"]') as HTMLInputElement;
    expect(load).toBeTruthy();
    fireEvent.change(load, { target: { value: '8' } });
    const after = Array.from(document.querySelectorAll('[data-bb="return-criterion"]'));
    expect(after[0].getAttribute('data-state')).toBe('not_met');
    expect(document.querySelector('[data-bb="return-criteria-verdict"]')?.textContent).toMatch(/Провал/);

    // плиометрика чипом
    fireEvent.click(document.querySelector('[data-bb="return-plyo"]')!);
    expect(document.querySelectorAll('[data-bb="return-criterion"]')[3].getAttribute('data-state')).toBe('met');
    // оговорка честная видна
    expect(box?.textContent).toMatch(/эвристика/);
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

describe('PRO-5 Э4 каталог Разбора', () => {
  it('упражнение из плана за пределами первых 80 — доступно, первым в списке, ищется', () => {
    const beyond = EXERCISE_CATALOG.find((c, i) => i >= 100 && (c as any).id && (c as any).name) as any;
    expect(beyond).toBeTruthy();
    localStorage.setItem('he_bb_plan_saved', JSON.stringify(planWith([
      { exerciseName: beyond.id, name: beyond.name, muscle: beyond.group || 'chest', sets: 3, rir: 2 },
    ])));
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
    fireEvent.click(screen.getByTestId('bb-exercise'));
    const opts = Array.from(document.querySelectorAll('[data-bb="sheet-option"]'));
    expect(opts.length).toBeGreaterThan(1);
    const short = String(beyond.name).slice(0, 8);
    expect(opts[1].textContent).toContain(short);
    // поиск сужает/находит это упражнение
    fireEvent.change(screen.getByTestId('bb-ex-search'), { target: { value: short } });
    const opts2 = Array.from(document.querySelectorAll('[data-bb="sheet-option"]'));
    expect(opts2.some((o) => (o.textContent || '').includes(short))).toBe(true);
    // срез каталога с начала в пикере больше не применяется
    expect(SRC).not.toContain('EXERCISE_CATALOG.slice(0, 80)');
  });
});

describe('PRO-5 Э7 гигиена симметрии', () => {
  it('мёртвое поле circ.bodyFat удалено из дефолта (замеры — сантиметры, % жира живёт в профиле)', () => {
    expect(SRC).not.toContain("bodyFat: ''");
  });
});

describe('PRO-5 Э6 сироты и LVP', () => {
  it('LVP-карточка калибрует и сохраняет валидный профиль (движок был без UI)', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
    expect(document.querySelector('[data-bb="lvp-card"]')).not.toBeNull();
    fireEvent.change(screen.getByTestId('bb-lvp-text'), { target: { value: '100 0.7\n120 0.55\n140 0.4' } });
    fireEvent.click(document.querySelector('[data-bb="lvp-run"]') as HTMLElement);
    expect(document.querySelector('[data-bb="lvp-result"]')?.textContent).toMatch(/e1RM/);
    const store = JSON.parse(localStorage.getItem('he_bb_lvp_profile') || '{}');
    expect(store.squat?.valid).toBe(true);
    expect(store.squat?.e1rm).toBeGreaterThan(150);
  });

  it('шумный профиль (разброс <10 кг) честно не сохраняется', () => {
    render(<BBDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
    fireEvent.change(screen.getByTestId('bb-lvp-text'), { target: { value: '100 0.5\n102 0.49\n103 0.5' } });
    fireEvent.click(document.querySelector('[data-bb="lvp-run"]') as HTMLElement);
    expect(localStorage.getItem('he_bb_lvp_profile')).toBeNull();
  });

  it('сирота bb-joint-jsi-bridge удалён (ноль импортёров/тестов)', () => {
    expect(existsSync(resolve(__dirname, '..', '..', '..', '..', 'engines', 'bb', 'bb-joint-jsi-bridge.ts'))).toBe(false);
  });
});
