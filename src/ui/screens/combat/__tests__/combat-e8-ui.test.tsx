/**
 * combat-e8-ui.test.tsx — журналы и скрининги E8 доходят до экрана.
 *
 * Как и в E4/E7: проверяем рендер и поведение, а не чтение исходника.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CbCampMeasurementsCard } from '../cb-camp-measurements';
import { buildCombatPlan } from '../../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan } from '../../../../engines/combat/combat-finalize.engine';
import { COMBAT_SPARRING_KEY, COMBAT_WIGHINS_KEY, COMBAT_GRIP_KEY, COMBAT_RTP_KEY, COMBAT_TESTS_KEY } from '../../../../engines/combat/combat-measurements.engine';

beforeEach(() => localStorage.clear());

const mkPlan = (over: any = {}) =>
  finalizeCombatPlan(buildCombatPlan({
    discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3, bodyweight: 80, ...over,
  } as any));

const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;

describe('E8.1 — журнал веса на экране', () => {
  it('без записей честно говорит, что траектории нет', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Нет двух замеров/)).toBeTruthy();
  });

  it('взвешивание через UI попадает в хранилище и рисует траекторию', () => {
    const plan = mkPlan();
    render(<CbCampMeasurementsCard plan={plan} />);
    fireEvent.change(screen.getByLabelText('Дата взвешивания'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Вес кг'), { target: { value: '80' } });
    fireEvent.click(screen.getByText('＋ Взвесить'));
    expect(JSON.parse(localStorage.getItem(COMBAT_WIGHINS_KEY) || '[]').length).toBe(1);
  });

  it('мусорный ввод не попадает в журнал и даёт понятное сообщение', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    fireEvent.change(screen.getByLabelText('Дата взвешивания'), { target: { value: 'позавчера' } });
    fireEvent.change(screen.getByLabelText('Вес кг'), { target: { value: '80' } });
    fireEvent.click(screen.getByText('＋ Взвесить'));
    expect(localStorage.getItem(COMBAT_WIGHINS_KEY)).toBeNull();
    expect(screen.getByText(/корректные дата и вес/)).toBeTruthy();
  });

  it('две записи из хранилища сразу дают траекторию', () => {
    localStorage.setItem(COMBAT_WIGHINS_KEY, JSON.stringify([
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-15', weightKg: 79.4 },
    ]));
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(q('[data-cb="weigh-traj"]')).toBeTruthy();
    expect(screen.getByText(/80.0 → 79.4 кг/)).toBeTruthy();
  });
});

describe('E8.2 — журнал спарринга на экране', () => {
  it('запись без RPE честно показывает, что нагрузка не посчитана', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    fireEvent.change(screen.getByLabelText('Раундов'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('＋ Записать'));
    expect(JSON.parse(localStorage.getItem(COMBAT_SPARRING_KEY) || '[]').length).toBe(1);
    expect(screen.getByText(/без RPE 1/)).toBeTruthy();
  });

  it('с RPE нагрузка считается и недели видно', () => {
    localStorage.setItem(COMBAT_SPARRING_KEY, JSON.stringify([
      { date: new Date().toISOString().slice(0, 10), type: 'hard', rounds: 5, roundMinutes: 5, rpe: 9 },
    ]));
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/неделя: учтён/)).toBeTruthy();
    expect(screen.getByText(/нагрузка 225/)).toBeTruthy();
  });

  it('нет нативных select — тип через попап', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(document.querySelectorAll('select')).toHaveLength(0);
    expect(screen.getByText('Тип спарринга')).toBeTruthy();
  });
});

describe('E8.4 — скрининг LEA на экране', () => {
  it('без данных: неопределённость, а не выдуманный вердикт', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Не хватает данных/)).toBeTruthy();
  });

  it('зона REDs помечается и даёт понятный совет', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} kcal={2500} trainingKcal={1000} ffmKg={60} />);
    expect(screen.getByText(/ниже порога 30/)).toBeTruthy();
    expect(screen.getByText(/Сгон поверх этого/)).toBeTruthy();
  });

  it('CAT2 важнее цифры', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} kcal={4000} trainingKcal={1000} ffmKg={60} cat2Flags={2} />);
    expect(screen.getByText(/CAT2-опросник отмечен/)).toBeTruthy();
  });
});

describe('E8.7 / E8.8 — сон и тепло на экране', () => {
  it('плохая ночь включает запрет на интенсивное', () => {
    // 4 ч — это буквально условие исследования (PMID 41824810)
    render(<CbCampMeasurementsCard plan={mkPlan()} sleepHours={4} />);
    expect(screen.getByText(/критично мало/)).toBeTruthy();
    expect(screen.getByText(/⛔/)).toBeTruthy();
  });

  it('5-6 ч — тоже переносим интенсивное (жёлтый уровень)', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} sleepHours={6} />);
    expect(screen.getByText(/меньше 7 ч/)).toBeTruthy();
    expect(screen.getByText(/⛔/)).toBeTruthy();
  });

  it('сон не внесён — предупреждение молчит', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Сон за ночь не внесён/)).toBeTruthy();
    expect(screen.queryByText(/⛔/)).toBeNull();
  });

  it('тепловой протокол показывает честную пометку про непроверенные ступени', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} heatSessions={12} />);
    expect(screen.getByText(/экстраполяция/)).toBeTruthy();
  });

  it('на сгоне тепловой протокол отложен', () => {
    const wc = mkPlan({ weightCutKg: 4 });
    render(<CbCampMeasurementsCard plan={wc} />);
    expect(screen.getByText(/Сгон: акклиматация/)).toBeTruthy();
  });
});

describe('E8.3 — сила хвата на экране', () => {
  it('без замеров честно говорит, что данных нет', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Нет замеров хвата/)).toBeTruthy();
  });

  it('замер хвата через UI попадает в хранилище', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    fireEvent.change(screen.getByLabelText('Дата замера хвата'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Сила хвата кг'), { target: { value: '58' } });
    fireEvent.click(screen.getByText('＋ Замерить'));
    expect(JSON.parse(localStorage.getItem(COMBAT_GRIP_KEY) || '[]').length).toBe(1);
    expect(screen.getByText(/Записано: левая/)).toBeTruthy();
  });

  it('мусорный ввод не попадает в журнал', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    fireEvent.change(screen.getByLabelText('Дата замера хвата'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Сила хвата кг'), { target: { value: '999' } });
    fireEvent.click(screen.getByText('＋ Замерить'));
    expect(localStorage.getItem(COMBAT_GRIP_KEY)).toBeNull();
    expect(screen.getByText(/10–120 кг/)).toBeTruthy();
  });

  it('разрыв рук виден на экране, а не прячется в движке', () => {
    localStorage.setItem(COMBAT_GRIP_KEY, JSON.stringify([
      { date: '2026-03-01', hand: 'L', gripKg: 60 },
      { date: '2026-03-01', hand: 'R', gripKg: 45 },
    ]));
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/разрыв 25%/)).toBeTruthy();
    expect(screen.getByText(/разошлись/)).toBeTruthy();
  });

  it('под блоком видна честная пометка, что это своя база, а не норма', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Своя база/)).toBeTruthy();
    expect(screen.getByText(/без популяционной нормы/)).toBeTruthy();
  });

  it('ориентир P50 не показывается без пола и честно зовёт внести пол', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.queryByText(/Ориентир P50 \d/)).toBeNull();
    expect(screen.getByText(/Ориентир P50: внесите пол/)).toBeTruthy();
  });

  it('с полом виден ориентир P50 с PMID и пометкой, что это не гейт', () => {
    const plan = mkPlan();
    (plan as any).inputSnapshot = { ...(plan as any).inputSnapshot, sex: 'male' };
    render(<CbCampMeasurementsCard plan={plan} />);
    expect(screen.getByText(/Ориентир P50 43.0 кг/)).toBeTruthy();
    expect(screen.getByText(/не гейт/)).toBeTruthy();
    expect(screen.getByText(/34330493/)).toBeTruthy();
  });
});

describe('E8.6 — RTP на экране', () => {
  it('без записей предлагает начать с покоя и показывает источники', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Нет записей RTP/)).toBeTruthy();
    expect(screen.getByText(/24–72 ч/)).toBeTruthy();
    expect(screen.getByText(/28152320/)).toBeTruthy();
  });

  it('запись ступени без симптомов попадает в журнал', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    fireEvent.change(screen.getByLabelText('Дата ступени'), { target: { value: '2026-03-01' } });
    fireEvent.click(screen.getByText('✓ Без симптомов'));
    expect(JSON.parse(localStorage.getItem(COMBAT_RTP_KEY) || '[]').length).toBe(1);
    expect(screen.getByText(/Записано: Покой/)).toBeTruthy();
  });

  it('симптомы держат ступень и это видно на экране', () => {
    localStorage.setItem(COMBAT_RTP_KEY, JSON.stringify([
      { date: '2026-03-01', stage: 'rest_light', symptomsFree: false },
    ]));
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Симптомы/)).toBeTruthy();
  });

  it('честно сказано, что ступени — структура приложения, а не протокол', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/структура приложения/)).toBeTruthy();
    expect(screen.getByText(/одобренных протоколов нет/)).toBeTruthy();
  });

  it('окно протокола с цифрами источника видно на карточке', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/5–21 сут/)).toBeTruthy();
    expect(screen.getByText(/~14 сут/)).toBeTruthy();
  });
});

describe('E8 UI — 8.5 журнал тестов', () => {
  beforeEach(() => localStorage.clear());

  it('карточка показывает оговорку, что это не норма и не прогноз', () => {
    const { container } = render(<CbCampMeasurementsCard plan={mkPlan()} />);
    const h = container.innerHTML;
    expect(h).toContain('measure-tests');
    expect(h).toContain('test-caveat');
    expect(h).toMatch(/не норма/);
    expect(h).toMatch(/41214825/);
    expect(h).toMatch(/планировать бой по этим цифрам нельзя/);
  });

  it('без замеров честно «Замеров нет», а не выдуманный ноль', () => {
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Замеров нет/)).toBeTruthy();
  });

  it('форма записи на месте: тест, дата, значение, кнопка', () => {
    const { container } = render(<CbCampMeasurementsCard plan={mkPlan()} />);
    const h = container.innerHTML;
    expect(h).toContain('test-form');
    expect(h).toContain('test-date');
    expect(h).toContain('test-value');
    expect(h).toContain('test-add');
  });

  it('клик по «Записать» без даты честно отвечает, а не молчит', () => {
    const { container } = render(<CbCampMeasurementsCard plan={mkPlan()} />);
    fireEvent.click(q('[data-cb="test-add"]')!);
    expect(container.innerHTML).toContain('test-msg');
    expect(screen.getByText(/корректные дата/)).toBeTruthy();
  });

  it('после записи видна своя динамика: последний, лучший, отклонение к пику', () => {
    localStorage.setItem(COMBAT_TESTS_KEY, JSON.stringify([
      { date: '2026-09-01', testId: 'pushup', value: 20 },
      { date: '2026-09-10', testId: 'pushup', value: 25 },
      { date: '2026-09-01', testId: 'shuttle_4x10', value: 19 },
      { date: '2026-09-10', testId: 'shuttle_4x10', value: 24 },
    ]));
    const { container } = render(<CbCampMeasurementsCard plan={mkPlan()} />);
    const h = container.innerHTML;
    expect(h).toContain('test-row');
    // «лучший» для времени = меньшее число (19), а не большее (24)
    expect(h).toMatch(/Челночный 4×10 м: 24 с[^]*лучший 19 с/);
    // одна метрика лучше, другая хуже → «растёт» было бы враньём
    expect(h).toMatch(/Динамика смешанная/);
    expect(h).not.toMatch(/Форма растёт/);
  });

  it('когда всё растёт — сводка прямо говорит, что форма растёт', () => {
    localStorage.setItem(COMBAT_TESTS_KEY, JSON.stringify([
      { date: '2026-09-01', testId: 'pushup', value: 20 },
      { date: '2026-09-10', testId: 'pushup', value: 25 },
      { date: '2026-09-01', testId: 'plank', value: 60 },
      { date: '2026-09-10', testId: 'plank', value: 90 },
    ]));
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Форма растёт/)).toBeTruthy();
  });

  it('форма растёт вверх — сетка данных не придумывает норм', () => {
    localStorage.setItem(COMBAT_TESTS_KEY, JSON.stringify([
      { date: '2026-09-01', testId: 'plank', value: 60 },
      { date: '2026-09-10', testId: 'plank', value: 120 },
    ]));
    render(<CbCampMeasurementsCard plan={mkPlan()} />);
    expect(screen.getByText(/Планка: 120 с/)).toBeTruthy();
  });
});
