/**
 * cardio-week-structured.test.tsx — конструктор недели: оборудование ручной
 * сессии и редактор структуры интервалов (⚡).
 *
 * Проверяем то, что видит атлет в APK: выбор оборудования меняет ккал,
 * структура сохраняется в сессию, длительность поднимается до неё (структура
 * не режется), а таймер получает ровно то, что показал редактор.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CardioWeekEditor } from '../CardioWeekEditor';
import {
  buildCardioCycle, loadCardioCycles, setActiveCardioCycle,
  buildCardioIntervalPlan, cardioStructuredMainSec, kcalForCardio, cycleBodyWeight, cycleFfmKg,
  saveCardioCycleVersion,
  type CardioCycle,
  type CardioSession,
} from '../../../../engines/lms/cardio.engine';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';

/** Цикл из одной hiit-сессии на 20 минут в неделе 1. */
function oneWeekCycle(): CardioCycle {
  const base = buildCardioCycle({ goal: 'cut', totalWeeks: 2, daysAvailable: 3, bodyWeight: 80 });
  const session = { type: 'hiit' as const, durationMin: 20, weeklyFrequency: 1, intensity: 'high' as const, kcalPerSession: 250, purpose: 'Ручная сессия' };
  const cycle: CardioCycle = {
    ...base,
    weeks: base.weeks.map(w => (w.week === 1 ? { ...w, sessions: [session], totalMinutes: 20, totalKcal: 250 } : w)),
  };
  return cycle;
}

function seed(): CardioCycle {
  const c = oneWeekCycle();
  localStorage.setItem(CYCLES_KEY, JSON.stringify([c]));
  setActiveCardioCycle(c);
  return c;
}

const savedSession = () => loadCardioCycles()[0].weeks[0].sessions[0];

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem('he_cardio_cycle_history');
    localStorage.removeItem('he_cardio_sessions');
  } catch { /* ignore */ }
});

describe('конструктор недели: оборудование сессии', () => {
  it('выбор «Вело» сохраняется в сессию и пересчитывает ккал', () => {
    const c = seed();
    const before = c.weeks[0].sessions[0].kcalPerSession;
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));

    fireEvent.click(screen.getByLabelText('Оборудование сессии 1'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Вело/ }));

    const after = savedSession();
    expect(after.equipment).toBe('cycling');
    // Ккал пересчитаны тем же движком и с тем же оборудованием (а не «на глаз»).
    expect(after.kcalPerSession).toBe(kcalForCardio('hiit', 20, cycleBodyWeight(c), 'cycling', c.config?.sex, cycleFfmKg(c)));
    expect(after.kcalPerSession).not.toBe(before);
  });

  it('новую сессию можно добавить сразу с оборудованием', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Оборудование новой сессии'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Гребля/ }));
    fireEvent.click(screen.getByRole('button', { name: /Добавить сессию/ }));

    const sessions = loadCardioCycles()[0].weeks[0].sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[1].equipment).toBe('rowing');
  });
});

describe('конструктор недели: структура интервалов (⚡)', () => {
  it('структура сохраняется, длительность поднимается до неё, таймер получает все отрезки', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));

    // 15 × (60 с работа + 60 с отдых) = 30 мин > 20 мин сессии.
    const reps = screen.getByLabelText('Повторов отрезка 1') as HTMLInputElement;
    fireEvent.change(reps, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    const s = savedSession();
    expect(s.structured).toHaveLength(1);
    expect(s.structured![0].reps).toBe(15);
    expect(s.durationMin).toBe(30);
    expect(s.purpose).toContain('⚡ Структура: 15×1 мин/1 мин');

    // Таймер не обрезает структуру: все 15 подходов в плане и total ≤ бюджета.
    const plan = buildCardioIntervalPlan({ type: s.type, durationMin: s.durationMin, structured: s.structured })!;
    expect(plan.steps.filter(st => st.kind === 'work')).toHaveLength(15);
    expect(plan.totalSec).toBeLessThanOrEqual(s.durationMin * 60);
    expect(cardioStructuredMainSec(s.structured)).toBe(1800);
  });

  it('«Очистить» + сохранить убирает структуру — сессия снова ровным темпом', () => {
    const c = seed();
    // Сессия уже со структурой.
    const withStruct: CardioCycle = {
      ...c,
      weeks: c.weeks.map(w => (w.week === 1
        ? { ...w, sessions: [{ ...w.sessions[0], structured: [{ workSec: 30, restSec: 30, reps: 6 }], purpose: 'Ручная сессия · ⚡ Структура: 6×30 с/30 с' }] }
        : w)),
    };
    localStorage.setItem(CYCLES_KEY, JSON.stringify([withStruct]));
    setActiveCardioCycle(withStruct);
    render(<CardioWeekEditor cycle={withStruct} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    // Кнопка показывает текущую структуру из сессии.
    expect(screen.getByRole('button', { name: /Интервалы сессии 1/ }).textContent).toContain('6×30 с/30 с');
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    const s = savedSession();
    expect(s.structured).toBeUndefined();
    expect(s.purpose).not.toContain('⚡ Структура');
  });
});

/** Три недели с одной HIIT-сессией в каждой — для прогрессии и истории. */
function threeWeekHiitCycle(): CardioCycle {
  const base = buildCardioCycle({ goal: 'cut', totalWeeks: 3, daysAvailable: 3, bodyWeight: 80 });
  const session = { type: 'hiit' as const, durationMin: 20, weeklyFrequency: 1, intensity: 'high' as const, kcalPerSession: 250, purpose: 'Ручная сессия' };
  const cycle: CardioCycle = {
    ...base,
    weeks: base.weeks.map(w => (w.week <= 3 ? { ...w, sessions: [{ ...session }], totalMinutes: 20, totalKcal: 250 } : w)),
  };
  localStorage.setItem(CYCLES_KEY, JSON.stringify([cycle]));
  setActiveCardioCycle(cycle);
  return cycle;
}

const savedWeek = (no: number) => loadCardioCycles()[0].weeks.find(w => w.week === no)!;

describe('конструктор недели: пресеты, цель и примечание отрезка', () => {
  it('пресет заполняет работу/отдых/повторы, сохраняется в сессию и текст', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));

    fireEvent.click(screen.getByLabelText('Пресет интервалов 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Billat/ }));

    expect((screen.getByLabelText('Работа отрезка 1, секунд') as HTMLInputElement).value).toBe('30');
    expect((screen.getByLabelText('Отдых отрезка 1, секунд') as HTMLInputElement).value).toBe('30');
    expect((screen.getByLabelText('Повторов отрезка 1') as HTMLInputElement).value).toBe('20');

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    const s = savedSession();
    expect(s.structured).toHaveLength(1);
    expect(s.structured![0]).toMatchObject({ workSec: 30, restSec: 30, reps: 20, target: 'pace' });
    expect(s.purpose).toContain('⚡ Структура: 20×30 с/30 с');
    // Структура 20×60 с = 20 мин; сессия поднята минимум до неё.
    expect(s.durationMin).toBeGreaterThanOrEqual(20);
  });

  it('пресет другого типа меняет тип сессии при сохранении (Sweet Spot → MISS)', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByLabelText('Пресет интервалов 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Sweet Spot/ }));
    expect(screen.getByText(/тип сессии станет «MISS»/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    const s = savedSession();
    expect(s.type).toBe('miss');
    expect(s.structured![0]).toMatchObject({ workSec: 720, restSec: 240, reps: 3, target: 'power' });
  });

  it('цель «пульс», диапазон и примечание уходят в таймер', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));

    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^пульс$/ }));
    fireEvent.change(screen.getByLabelText('Пульс от отрезка 1'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Пульс до отрезка 1'), { target: { value: '170' } });
    fireEvent.change(screen.getByLabelText('Примечание отрезка 1'), { target: { value: 'держать ровно' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    const block = savedSession().structured![0];
    expect(block.target).toBe('hr');
    expect(block.targetHr).toEqual({ min: 150, max: 170 });
    expect(block.note).toBe('держать ровно');
    // Таймер получает тот же пульс-диапазон на рабочих отрезках.
    const plan = buildCardioIntervalPlan(savedSession())!;
    expect(plan.steps.find(st => st.kind === 'work')!.hrZone).toEqual({ min: 150, max: 170 });
  });
});

describe('конструктор недели: цель сессии и день новой сессии', () => {
  it('цель сессии сохраняется по blur (не на каждый символ)', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    const input = screen.getByLabelText('Цель сессии 1');
    fireEvent.change(input, { target: { value: 'Темповая база' } });
    // До blur в хранилище ещё старое значение.
    expect(savedSession().purpose).toBe('Ручная сессия');
    fireEvent.blur(input);
    expect(savedSession().purpose).toBe('Темповая база');
  });

  it('новую сессию можно добавить сразу на выбранный день', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('День новой сессии'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Пт$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Добавить сессию/ }));

    const sessions = savedWeek(1).sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[1].dayOfWeek).toBe(4);
  });
});

describe('конструктор недели: прогрессия по неделям и история версий', () => {
  it('📈 раскладывает структуру на все недели с +1 повтором каждые 2 недели', () => {
    const c = threeWeekHiitCycle();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.change(screen.getByLabelText('Повторов отрезка 1'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /На все недели/ }));

    const w1 = savedWeek(1).sessions[0];
    const w2 = savedWeek(2).sessions[0];
    const w3 = savedWeek(3).sessions[0];
    expect(w1.structured![0].reps).toBe(4);
    expect(w2.structured![0].reps).toBe(4);
    expect(w3.structured![0].reps).toBe(5);   // +1 за 2 недели
    expect(w1.purpose).toContain('⚡ Структура');
    expect(w2.purpose).toContain('⚡ Структура');
    expect(w3.purpose).toContain('⚡ Структура');
    // Прогрессия тоже не ломает бюджет таймера.
    for (const s of [w1, w2, w3]) {
      expect(cardioStructuredMainSec(s.structured)).toBeLessThanOrEqual(s.durationMin * 60);
    }
  });

  it('🕘 история показывает версии и возвращает выбранную в два тапа', () => {
    const c = seed();
    saveCardioCycleVersion(c, 'до правки');
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByRole('button', { name: /История/ }));
    expect(screen.getByText('до правки')).toBeTruthy();

    const first = screen.getByRole('button', { name: 'Восстановить версию' });
    fireEvent.click(first);
    const confirm = screen.getByRole('button', { name: 'Подтвердить восстановление версии' });
    fireEvent.click(confirm);
    expect(screen.getByRole('status').textContent).toContain('Версия восстановлена');
  });
});

/** Цикл с мед-блоком: HIIT/MISS запрещены скринингом. */
function gatedCycle(session?: Partial<CardioSession>): CardioCycle {
  const c = seed();
  const gated: CardioCycle = {
    ...c,
    config: { ...c.config, redFlags: ['syncope'] },
    weeks: c.weeks.map(w => (w.week === 1 && session
      ? { ...w, sessions: [{ ...w.sessions[0], ...session }] }
      : w)),
  };
  localStorage.setItem(CYCLES_KEY, JSON.stringify([gated]));
  setActiveCardioCycle(gated);
  return gated;
}

describe('конструктор недели: мед-гейт нельзя обойти протоколом/прогрессией', () => {
  it('пресет HIIT при красном флаге не применяется в черновик', () => {
    const c = gatedCycle();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByLabelText('Пресет интервалов 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Tabata/ }));

    expect(screen.getByText(/не применён/)).toBeTruthy();
    // Черновик остался пустым: отрезков нет.
    expect(screen.queryByLabelText('Повторов отрезка 1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    const s = savedSession();
    expect(s.structured).toBeUndefined();
    expect(s.type).toBe('hiit');  // тип сессии не менялся задним числом
  });

  it('📈 не раскладывает HIIT-структуру на недели при красном флаге', () => {
    // HIIT-сессия осталась с прошлой версии плана (скрининг добавлен позже).
    const c = gatedCycle({ type: 'hiit' });
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.click(screen.getByRole('button', { name: /На все недели/ }));

    expect(screen.getByText(/не добавлен/)).toBeTruthy();
    expect(savedSession().structured).toBeUndefined();
  });
});

describe('конструктор недели: структура не пишется чужой сессии', () => {
  it('удаление сессии выше открытой панели сдвигает индекс, а не теряет правку', () => {
    const c = seed();
    const two: CardioCycle = {
      ...c,
      weeks: c.weeks.map(w => (w.week === 1
        ? { ...w, sessions: [w.sessions[0], { ...w.sessions[0], purpose: 'Вторая сессия' }] }
        : w)),
    };
    localStorage.setItem(CYCLES_KEY, JSON.stringify([two]));
    setActiveCardioCycle(two);
    // Харнесс с обновлением cycle после каждой правки: в APK это делает
    // родительский экран по onChanged, и две правки подряд не должны
    // откатывать друг друга.
    const Harness: React.FC = () => {
      const [cur, setCur] = React.useState<CardioCycle>(two);
      return <CardioWeekEditor cycle={cur} onChanged={() => setCur(loadCardioCycles()[0])} />;
    };
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));

    // Открываем структуру ВТОРОЙ сессии и вводим отрезки.
    fireEvent.click(screen.getByLabelText('Интервалы сессии 2'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.change(screen.getByLabelText('Повторов отрезка 1'), { target: { value: '5' } });

    // Удаляем первую: панель должна остаться на той же (теперь первой) сессии.
    fireEvent.click(screen.getByLabelText('Удалить сессию 1'));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    const sessions = savedWeek(1).sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].purpose).toContain('Вторая сессия');
    expect(sessions[0].structured?.[0]?.reps).toBe(5);
  });
});

describe('конструктор недели: смена типа на Zone 2 снимает интервалы', () => {
  it('HIIT со структурой → Zone 2: структура и ⚡-пометка уходят', () => {
    const c = seed();
    const withStruct: CardioCycle = {
      ...c,
      weeks: c.weeks.map(w => (w.week === 1
        ? { ...w, sessions: [{ ...w.sessions[0], structured: [{ workSec: 30, restSec: 30, reps: 8 }], purpose: 'Спринты · ⚡ Структура: 8×30 с/30 с' }] }
        : w)),
    };
    localStorage.setItem(CYCLES_KEY, JSON.stringify([withStruct]));
    setActiveCardioCycle(withStruct);
    render(<CardioWeekEditor cycle={withStruct} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Тип сессии 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Zone 2/ }));

    const s = savedSession();
    expect(s.type).toBe('zone2');
    expect(s.structured).toBeUndefined();
    expect(s.purpose).toBe('Спринты');
  });
});

describe('конструктор недели: числовые поля набираются по цифрам', () => {
  it('работа «3»→«30» остаётся 30 секунд, а не 50', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    const work = screen.getByLabelText('Работа отрезка 1, секунд') as HTMLInputElement;
    fireEvent.change(work, { target: { value: '3' } });
    fireEvent.change(work, { target: { value: '30' } });
    expect(work.value).toBe('30');
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(savedSession().structured?.[0]?.workSec).toBe(30);
  });

  it('пульс «1»→«145» сохраняется как 145, а не 220', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^пульс$/ }));
    const min = screen.getByLabelText('Пульс от отрезка 1') as HTMLInputElement;
    fireEvent.change(min, { target: { value: '1' } });
    fireEvent.change(min, { target: { value: '145' } });
    expect(min.value).toBe('145');
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(savedSession().structured?.[0]?.targetHr).toEqual({ min: 145, max: undefined });
  });

  it('минуты сессии «3»→«30» — 30, а не 55', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    const inp = screen.getByLabelText('Минуты сессии 1') as HTMLInputElement;
    fireEvent.change(inp, { target: { value: '3' } });
    fireEvent.change(inp, { target: { value: '30' } });
    expect(inp.value).toBe('30');
    fireEvent.blur(inp);
    expect(savedWeek(1).sessions[0].durationMin).toBe(30);
  });

  it('цель RPE сохраняется числом и чистится при смене на пульс', () => {
    const c = seed();
    const first = render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^RPE$/ }));
    fireEvent.change(screen.getByLabelText('RPE отрезка 1'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(savedSession().structured?.[0]).toMatchObject({ target: 'rpe', targetValue: 8 });
    first.unmount();

    // Смена цели на пульс должна снять числовую метку, иначе в таймере
    // осталась бы «RPE 8» на отрезке с пульсовым диапазоном.
    render(<CardioWeekEditor cycle={loadCardioCycles()[0]} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^пульс$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(savedSession().structured?.[0].target).toBe('hr');
    expect(savedSession().structured?.[0].targetValue).toBeUndefined();
  });
});

describe('конструктор недели: дистанционные интервалы', () => {
  it('400 м с темпом 4:00 дают 96 с работы и сохраняются в сессию', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^темп$/ }));

    const dist = screen.getByLabelText('Дистанция отрезка 1, м') as HTMLInputElement;
    fireEvent.change(dist, { target: { value: '400' } });
    fireEvent.blur(dist);
    const pace = screen.getByLabelText('Темп отрезка 1') as HTMLInputElement;
    fireEvent.change(pace, { target: { value: '4:00' } });
    fireEvent.blur(pace);
    // Работа — производная от дистанции и темпа, а не ручные 60 с.
    expect(screen.queryByLabelText('Работа отрезка 1, секунд')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    const b = savedSession().structured?.[0];
    expect(b).toMatchObject({ target: 'pace', distanceM: 400, targetValue: 240, workSec: 96 });
  });

  it('смена цели с «темп» на «пульс» убирает дистанцию, а не оставляет её без темпа', () => {
    const c = seed();
    const first = render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^темп$/ }));
    const dist = screen.getByLabelText('Дистанция отрезка 1, м') as HTMLInputElement;
    fireEvent.change(dist, { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(savedSession().structured?.[0].distanceM).toBe(400);
    first.unmount();

    render(<CardioWeekEditor cycle={loadCardioCycles()[0]} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^пульс$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(savedSession().structured?.[0].target).toBe('hr');
    expect(savedSession().structured?.[0].distanceM).toBeUndefined();
  });

  it('переключение «темп» → «RPE» не превращает 240 с/км в «RPE 10»', () => {
    const c = seed();
    const first = render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^темп$/ }));
    const dist = screen.getByLabelText('Дистанция отрезка 1, м') as HTMLInputElement;
    fireEvent.change(dist, { target: { value: '400' } });
    const pace = screen.getByLabelText('Темп отрезка 1') as HTMLInputElement;
    fireEvent.change(pace, { target: { value: '4:00' } });
    fireEvent.blur(pace);
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(savedSession().structured?.[0].targetValue).toBe(240);
    first.unmount();

    render(<CardioWeekEditor cycle={loadCardioCycles()[0]} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^RPE$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(savedSession().structured?.[0].target).toBe('rpe');
    expect(savedSession().structured?.[0].targetValue).toBeUndefined();
  });
});

describe('конструктор недели: пульсовой диапазон отрезка', () => {
  it('перепутанные границы нормализуются при сохранении', () => {
    const c = seed();
    render(<CardioWeekEditor cycle={c} />);
    fireEvent.click(screen.getByRole('button', { name: /Редактировать сессии/ }));
    fireEvent.click(screen.getByLabelText('Интервалы сессии 1'));
    fireEvent.click(screen.getByRole('button', { name: '+ Отрезок' }));
    fireEvent.click(screen.getByLabelText('Цель отрезка 1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^пульс$/ }));
    fireEvent.change(screen.getByLabelText('Пульс от отрезка 1'), { target: { value: '170' } });
    fireEvent.change(screen.getByLabelText('Пульс до отрезка 1'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(savedSession().structured![0].targetHr).toEqual({ min: 150, max: 170 });
  });
});
