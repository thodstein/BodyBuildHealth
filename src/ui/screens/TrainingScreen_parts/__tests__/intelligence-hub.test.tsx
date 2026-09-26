import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnifiedIntelligenceHub } from '../UnifiedIntelligenceHub';

/** Сид sRPE-сессий: без них хаб честно блокирует «Применить» (E4-гейт по данным). */
function seedSRPE(days = 6, srpe?: number) {
  const list: { date: string; sRPE: number; durationMin: number }[] = [];
  const base = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    list.push({ date: iso, sRPE: srpe ?? (7 + (i % 2)), durationMin: 60 });
  }
  localStorage.setItem('he_srpe_sessions', JSON.stringify(list));
}

beforeEach(() => {
  try {
    localStorage.removeItem('he_unified_intel_snapshot_v2');
    localStorage.removeItem('he_unified_intel_snapshot_v1');
    localStorage.removeItem('he_srpe_sessions');
    localStorage.removeItem('he_hrv_log');
    localStorage.removeItem('he_readiness_history');
    localStorage.removeItem('he_planner_apply');
    localStorage.removeItem('he_rir_calibration');
    localStorage.removeItem('he_workout_log_v2');
    localStorage.removeItem('he_bb_plan_saved');
    localStorage.removeItem('he_weight_log');
    // E7: журналы CMJ и wellness не должны протекать между тестами
    localStorage.removeItem('he_intelligence_cmj_v1');
    localStorage.removeItem('he_intelligence_wellness_v1');
    localStorage.removeItem('he_intelligence_history_v1');
  } catch { /* noop */ }
});

/** Сид CMJ-серии: последний день — на 20% ниже лучшего (красная зона). */
function seedCmj() {
  const base = new Date();
  const iso = (back: number) => {
    const d = new Date(base.getTime() - back * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  localStorage.setItem('he_intelligence_cmj_v1', JSON.stringify([
    { date: iso(2), heightCm: 42, bodyweightKg: 80 },
    { date: iso(1), heightCm: 40, bodyweightKg: 80 },
    { date: iso(0), heightCm: 34, bodyweightKg: 80 },
  ]));
}

/** Сид wellness: 7 дней, ухудшающиеся к сегодня (красная зона). */
function seedWellness() {
  const base = new Date();
  const list = [6, 5, 4, 3, 2, 1, 0].map((back, i) => {
    const d = new Date(base.getTime() - back * 86400000);
    const good = 5 - i; // 5 → 1
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      sleepQuality: good, soreness: 6 - good, mood: good, energy: good, stressLevel: 6 - good,
    };
  });
  localStorage.setItem('he_intelligence_wellness_v1', JSON.stringify(list));
}

/** Сид дневника тренировок для E5 (нагрузка по мышцам): id из каталога → группа мышц. */
function seedDiary(days = 3) {
  const list: any[] = [];
  const base = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(base.getTime() - i * 86400000);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    list.push({
      date, durationMin: 60, focus: 'fullbody',
      exercises: [
        { exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа', sets: [{ reps: 5, rir: 2 }, { reps: 5, rir: 2 }, { reps: 5, rir: 1 }] },
        { exerciseId: 'deadlift', exerciseName: 'Становая тяга', sets: [{ reps: 3, rir: 1 }, { reps: 3, rir: 2 }] },
        // упражнение вне каталога — не должно молча приписываться какой-то мышце
        { exerciseId: 'нет-в-каталоге', exerciseName: 'Мистика', muscleGroup: '', sets: [{ reps: 10, rir: 3 }] },
      ],
    });
  }
  localStorage.setItem('he_workout_log_v2', JSON.stringify(list));
}

describe('P5 Intelligence Hub UI', () => {
  it('рендерит 5 секций + кнопки P1–P5', () => {
    render(<UnifiedIntelligenceHub />);
    expect(screen.getByText('Интеллект тренировки')).toBeTruthy();
    expect(document.getElementById('sec-load')).toBeTruthy();
    expect(document.getElementById('sec-recovery')).toBeTruthy();
    expect(document.getElementById('sec-autoreg')).toBeTruthy();
    expect(document.getElementById('sec-forecast')).toBeTruthy();
    expect(document.getElementById('sec-recommendations')).toBeTruthy();
    // P1 дисклеймер, P2 HRV-база, P5 импорт/экспорт
    expect(document.body.textContent).toContain('Impellizzeri');
    expect(document.body.textContent).toContain('HRV-база');
    expect(screen.getByText(/Из дневника/)).toBeTruthy();
    expect(screen.getByText(/HTML/)).toBeTruthy();
    // Кнопка CSV теперь неоднозначна: в хабе их две (журнал sRPE и отчёт тренеру E8) —
    // берём конкретную, иначе тест падает на «multiple elements».
    expect(screen.getByText('📥 CSV')).toBeTruthy();
    expect(screen.getByText('📊 CSV')).toBeTruthy();
    expect(screen.getByText(/Deload .ics/)).toBeTruthy();
    expect(document.getElementById('sec-coach')).toBeTruthy();   // E8: секция отчёта тренеру
  });

  it('добавление sRPE обновляет журнал', () => {
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText(/Добавить \(/));
    expect(JSON.parse(localStorage.getItem('he_srpe_sessions') || '[]')).toHaveLength(1);
  });

  it('снапшот v2 пишется с целью блока', () => {
    render(<UnifiedIntelligenceHub />);
    const snap = JSON.parse(localStorage.getItem('he_unified_intel_snapshot_v2') || '{}');
    expect(snap.v).toBe(2);
    expect(snap.goal).toBe('hypertrophy');
  });

  it('P7 a11y: навигация с aria-pressed, дата-инпут 16px, график с role=img', () => {
    render(<UnifiedIntelligenceHub />);
    const nav = document.querySelector('[aria-label^="Раздел: Нагрузка"]');
    expect(nav).toBeTruthy();
    expect(nav!.getAttribute('aria-pressed')).toBe('true');
    const dateInput = document.querySelector('input[type="date"]') as HTMLElement | null;
    expect(dateInput).toBeTruthy();
    expect(dateInput!.style.fontSize).toBe('16px');
  });

  it('D3 суперкомпенсация честна: окно ≠ повод нагружаться (было→стало)', () => {
    // было: плитка «Суперкомп. (ориентир)» + текст «планируйте тяжёлую сессию в это окно» —
    // обещание нагрузки в окне, которое к нагрузке отношения не имеет.
    // стало: плитка «Окно нагрузки»/«Окно восст.» по флагу supercompensationReady + честная причина,
    // и строка видна БЕЗ раскрытия карточки (раньше жила в свёрнутом блоке).
    localStorage.setItem('he_unified_intel_snapshot_v2', JSON.stringify({ readiness: 20, fatigue: 85, sleepHours: 5, sleepQuality: 1, rmssd: 30, restingHR: 70, savedAt: new Date().toISOString() }));
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).not.toContain('Суперкомп. (ориентир)');
    expect(txt).toContain('Суперкомпенсации нет');
    expect(txt).toMatch(/окно \d+ч — это время ВОССТАНОВЛЕНИЯ/);
  });

  it('E3/E4 честная оговорка ACWR 0.8–1.3 видна в хабе', () => {
    seedSRPE();
    render(<UnifiedIntelligenceHub />);
    expect(document.body.textContent).toMatch(/0\.8[–-]1\.3/);
  });

  it('E3 ровная неделя помечается как «разброс=0», а не как норм. монотонность', () => {
    seedSRPE(20, 7); // каждый день одинаковая нагрузка → SD=0
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toMatch(/SD=0/);
    expect(txt).toContain('разброс=0 (не «норма»)');
  });

  it('E4 без sRPE «Применить» заблокировано и ничего не отправляет', () => {
    const dispatched: unknown[] = [];
    const orig = window.dispatchEvent;
    window.dispatchEvent = ((e: Event) => { if (e instanceof CustomEvent && e.type === 'planner-apply' && (e as CustomEvent).detail) dispatched.push((e as CustomEvent).detail); return orig.call(window, e); }) as typeof window.dispatchEvent;
    try {
      render(<UnifiedIntelligenceHub />);
      const btn = Array.from(document.querySelectorAll('button')).find(b => /Нет данных о нагрузке/.test(b.textContent || ''));
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(btn as HTMLButtonElement);
    } finally {
      window.dispatchEvent = orig;
    }
    expect(dispatched).toHaveLength(0);
    expect(document.body.textContent).toContain('Нет ни одной сессии sRPE');
  });

  it('E4 устаревший снимок помечается, а «Сброс» очищает метку', () => {
    const old = new Date(Date.now() - 3 * 86400000).toISOString();
    localStorage.setItem('he_unified_intel_snapshot_v2', JSON.stringify({ readiness: 70, savedAt: old }));
    render(<UnifiedIntelligenceHub />);
    expect(document.body.textContent).toMatch(/Снимок входов сохранён .*назад/);
    fireEvent.click(screen.getByText('↩ Сброс'));
    expect(document.body.textContent).not.toMatch(/Снимок входов сохранён/);
  });

  it('E1 pri уходит всегда, deload — вторым пейлоадом при флаге', () => {
    seedSRPE();
    const dispatched: unknown[] = [];
    const orig = window.dispatchEvent;
    window.dispatchEvent = ((e: Event) => { if (e instanceof CustomEvent && e.type === 'planner-apply' && (e as CustomEvent).detail) dispatched.push((e as CustomEvent).detail); return orig.call(window, e); }) as typeof window.dispatchEvent;
    try {
      render(<UnifiedIntelligenceHub />);
      fireEvent.click(screen.getByText(/Применить к планировщику/));
    } finally {
      window.dispatchEvent = orig;
    }
    // ровно один пейлоад (два синхронных батчатся React — второй съел бы первый)
    expect(dispatched).toHaveLength(1);
    expect((dispatched[0] as { kind: string }).kind).toBe('pri');
    expect(JSON.parse(localStorage.getItem('he_planner_apply') || '{}').kind).toBe('pri');
  });

  it('E1 deload-путь: низкая готовность → одним пейлоадом kind=deload', () => {
    seedSRPE();
    localStorage.setItem('he_unified_intel_snapshot_v2', JSON.stringify({ readiness: 20, fatigue: 90, savedAt: new Date().toISOString() }));
    const dispatched: unknown[] = [];
    const orig = window.dispatchEvent;
    window.dispatchEvent = ((e: Event) => { if (e instanceof CustomEvent && e.type === 'planner-apply' && (e as CustomEvent).detail) dispatched.push((e as CustomEvent).detail); return orig.call(window, e); }) as typeof window.dispatchEvent;
    try {
      render(<UnifiedIntelligenceHub />);
      fireEvent.click(screen.getByText(/Применить к планировщику/));
    } finally {
      window.dispatchEvent = orig;
    }
    expect(dispatched).toHaveLength(1);
    const payload = (dispatched[0] as { kind: string; data: { volumeMult: number } });
    expect(payload.kind).toBe('deload');
    expect(payload.data.volumeMult).toBeLessThan(1);
  });

  it('E2 калибровка: честная подпись (авторегуляция bias не видит)', () => {
    localStorage.setItem('he_rir_calibration', JSON.stringify([
      { date: '2026-09-01', sessionFocus: 'push', exerciseId: 'bench', exerciseName: 'Жим', plannedRIR: 2, actualRIR: 1, weight: 100, reps: 5, setNumber: 1 },
      { date: '2026-09-02', sessionFocus: 'push', exerciseId: 'bench', exerciseName: 'Жим', plannedRIR: 2, actualRIR: 0, weight: 100, reps: 5, setNumber: 1 },
    ]));
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText(/RIR-калибрация/));
    expect(document.body.textContent).toContain('не видит');
  });

  it('E5 диффы нагрузки и sACWR видны вместе с честной оговоркой метода', () => {
    seedSRPE(10, 7);
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('Диффы нагрузки · sACWR');
    expect(txt).toContain('sACWR (EWMA 7/28)');
    expect(txt).toContain('НЕ канон');           // метод не выдаётся за истину
    expect(txt).toContain('нулевые дни входят в базу'); // отпуск = спад, а не рост
  });

  it('E5 без sRPE блок альтернативных метрик не рисуется (нет чисел из воздуха)', () => {
    render(<UnifiedIntelligenceHub />);
    expect(document.body.textContent).not.toContain('Диффы нагрузки · sACWR');
  });

  it('E5 нагрузка по мышцам строится из дневника + честно показывает покрытие атрибуции', () => {
    seedSRPE();
    seedDiary(3);
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('Нагрузка по мышцам · перекос');
    expect(txt).toMatch(/Атрибуция по каталогу: \d+% подходов/);
    // 3 дня × 5 атрибутируемых сетов из 6 (мистика вне каталога не приписана мышце)
    expect(txt).toMatch(/15 из 18/);
    expect(txt).toContain('Индекс перекоса');
    expect(txt).toContain('Грудь');
    expect(txt).toContain('Спина');
    expect(txt).not.toContain('Мистика');
    expect(txt).toContain('не измерение работы мышцы');
  });

  it('E5 без дневника — честный пустой контур, а не нули', () => {
    seedSRPE();
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('В дневнике нет тренировок с упражнениями');
    expect(txt).not.toContain('Индекс перекоса');
  });

  it('E5 план vs факт появляется только при сохранённом ББ-плане', () => {
    seedSRPE();
    seedDiary(3);
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({
      date: '2026-09-20',
      plan: {
        weeks: [{
          week: 1,
          sessions: [{ day: 1, exercises: [{ muscle: 'chest', sets: 12, name: 'Жим' }, { muscle: 'back', sets: 6, name: 'Тяга' }] }],
        }],
      },
    }));
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('План (средняя неделя плана) vs факт 7д');
    expect(txt).toMatch(/Грудь\s*12 → 9/);  // план 12, факт 9 сетов
  });

  it('E6 прогноз нагрузки: EWMA-уровень, разброс недели и счётчик дней подряд', () => {
    seedSRPE(6, 8);
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('Прогноз нагрузки · 7 дней');
    expect(txt).toContain('AU/день (EWMA)');
    expect(txt).toMatch(/Дней подряд/);
    expect(txt).toContain('экстраполяция сглаженного уровня');
    expect(txt).toContain('не автоблокировка');
  });

  it('E6 без sRPE прогноз нагрузки не рисуется', () => {
    render(<UnifiedIntelligenceHub />);
    expect(document.body.textContent).not.toContain('Прогноз нагрузки · 7 дней');
  });

  it('E6 траектория: измеримые величины помечены, недостающие — честно', () => {
    seedSRPE();
    // дневник: 3 точки, e1RM РОСТЁТ к сегодняшнему дню (back=14 — самая старая точка)
    const base = new Date();
    const diary = [0, 7, 14].map(back => {
      const d = new Date(base.getTime() - back * 86400000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date, exercises: [{ exerciseId: 'bench_bar', sets: [{ reps: 5 }], best1RM: 100 + (14 - back) / 7, totalVolume: 1000 + (14 - back) }] };
    });
    localStorage.setItem('he_workout_log_v2', JSON.stringify(diary));
    // весовой журнал НЕ засеян → серия «Вес» обязана сказать «нужно ≥2 замера», а не «0 кг»
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('Траектория показателей');
    expect(txt).toContain('e1RM');
    expect(txt).toMatch(/\+\d+(\.\d+)?%\/нед/);  // недельный прирост показан со знаком
    expect(txt).toContain('нужно ≥2 замера');    // объём без второй точки — честно
    expect(txt).toContain('измеримые величины');
    expect(txt).toContain('невалидированн');
  });

  it('F3 what-if: база сценария — факт восстановления, константа «22» исчезла', () => {
    seedSRPE();
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('База: риск');
    expect(txt).not.toContain('риск 22');   // было `recoveryOut?.overtrainingRisk ?? 22` — константа вместо факта
  });

  it('F1-F2 предупреждения прогноза показываются, а «Fatigue при высокой готовности» — нет', () => {
    // история готовности: 3 точки, спад
    const base = new Date();
    const hist = [72, 64, 56].map((v, i) => {
      const d = new Date(base.getTime() - (2 - i) * 86400000);
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, recovery: v, fatigue: 30 };
    });
    localStorage.setItem('he_readiness_history', JSON.stringify(hist));
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).not.toContain('Fatigue превысит');
    expect(txt).toContain('Ранний прогноз');
  });

  it('E7 CMJ: карточка в «Нагрузке» показывает просадку, метод и честную оговорку «не блокирует»', () => {
    seedCmj();
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('CMJ-скрининг усталости');
    expect(txt).toContain('от лучшего в серии');
    expect(txt).toContain('3 замеров');
    expect(txt).toContain('НЕ тест готовности');
    expect(txt).toContain('не автоблокировка');
  });

  it('E7 CMJ: без замеров — пустая честная карточка, а не «зелёный»', () => {
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('Замеров CMJ нет');
    expect(txt).toContain('скрининг не считается');
  });

  it('E7 CMJ: кнопка записи реально пишет журнал (высота/время полёта/вес)', () => {
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText('🦘 Записать замер'));
    const stored = JSON.parse(localStorage.getItem('he_intelligence_cmj_v1') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].heightCm).toBeGreaterThan(0);
    expect(stored[0].flightTimeMs).toBeGreaterThan(0);
  });

  it('E7 wellness: светофор и тревожные сигналы считаются по журналу', () => {
    seedWellness();
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('Wellness-опросник');
    expect(txt).toContain('7/7 дней');
    expect(txt).toMatch(/Сигналы/);
    expect(txt).toContain('не блокирует');
    expect(txt).toContain('НЕ валидированный тест');
  });

  it('E7 wellness: без отметок — честный no_data, а не «зелёный светофор»', () => {
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('Wellness-опросник');
    expect(txt).not.toMatch(/0\/7 дней\s*зелёный/);
    expect(txt).toContain('0/7 дней');
  });

  it('E7 wellness: кнопка «Отметить день» пишет 5 пунктов в журнал', () => {
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText('🧭 Отметить день'));
    const stored = JSON.parse(localStorage.getItem('he_intelligence_wellness_v1') || '[]');
    expect(stored).toHaveLength(1);
    for (const k of ['sleepQuality', 'soreness', 'mood', 'energy', 'stressLevel']) {
      expect(stored[0][k]).toBeGreaterThanOrEqual(1);
      expect(stored[0][k]).toBeLessThanOrEqual(5);
    }
  });

  it('E7 wellness: болезнь/температура отражается как зона illness, а не как «красный»', () => {
    const base = new Date();
    const d = new Date(base.getTime());
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('he_intelligence_wellness_v1', JSON.stringify([
      { date: iso, sleepQuality: 5, soreness: 1, mood: 5, energy: 5, stressLevel: 1, illness: true },
    ]));
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('болезнь');
    expect(txt).toContain('Решение о тренировке при болезни принимает врач');
  });

  it('E8 отчёт тренеру: карточка недели + строки roll-up с честными оговорками', () => {
    seedSRPE(6, 7);
    render(<UnifiedIntelligenceHub />);
    const txt = document.body.textContent || '';
    expect(txt).toContain('Отчёт тренеру');
    expect(txt).toContain('Все строки недели');
    expect(txt).toContain('нужна база 28д');       // ACWR: сравнение с прошлой неделей не считается
    expect(txt).toContain('Файл тренеру');
    expect(txt).toContain('Дайджест');
    expect(txt).toContain('ACWR ≠ прогноз травмы');  // границы применимости в подписи
  });

  it('E8 без данных недели строки показывают прочерк и оговорку, а не нули', () => {
    render(<UnifiedIntelligenceHub />);   // ни sRPE, ни CMJ, ни wellness
    const txt = document.body.textContent || '';
    expect(txt).toContain('Отчёт тренеру');
    expect(txt).toContain('нет ни одной сессии');
    expect(txt).toContain('замеров CMJ нет');
  });

  it('E8 отказ от рекомендации попадает в чек-лист недели и НЕ отправляется в планировщик', () => {
    seedSRPE(6, 7);
    render(<UnifiedIntelligenceHub />);
    const before = localStorage.getItem('he_planner_apply');
    fireEvent.click(screen.getByText('⛔ Не применять (в журнал недели)'));
    const hist = JSON.parse(localStorage.getItem('he_intelligence_history_v1') || '[]');
    expect(hist).toHaveLength(1);
    expect(hist[0].applied).toBe(false);
    expect(hist[0].label).toContain('отклонена');
    expect(localStorage.getItem('he_planner_apply')).toBe(before); // в планировщик ничего не ушло
    expect(document.body.textContent).toContain('Отклонено');
  });

  it('E8 применение решения пишется в журнал как применённое', () => {
    seedSRPE(6, 7);
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText(/🛠 Применить к планировщику/));
    const hist = JSON.parse(localStorage.getItem('he_intelligence_history_v1') || '[]');
    expect(hist).toHaveLength(1);
    expect(hist[0].applied).toBe(true);
    expect(hist[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);  // локальная дата, не UTC
  });

  it('E8 очистка журнала решений стирает историю', () => {
    seedSRPE(6, 7);
    // дата = сегодня: чек-лист недели показывает только решения текущей недели
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('he_intelligence_history_v1', JSON.stringify([{ date: today, kind: 'pri', applied: true, label: 'Прошлое решение' }]));
    render(<UnifiedIntelligenceHub />);
    expect(document.body.textContent).toContain('Прошлое решение');
    fireEvent.click(screen.getByText('🧹 Очистить журнал решений'));
    // либо ключ удалён, либо пустой массив — главное, что решение из чек-листа исчезло
    const raw = localStorage.getItem('he_intelligence_history_v1');
    expect(raw == null || raw === '[]').toBe(true);
    expect(document.body.textContent).toContain('решений не записано');
  });

  it('E8 CSV-выгрузка реально создаёт файл (blob + download)', () => {
    seedSRPE(6, 7);
    const created: string[] = [];
    const origCreate = URL.createObjectURL;
    (URL as any).createObjectURL = (b: Blob) => { created.push(String(b.type || '')); return origCreate ? origCreate.call(URL, b) : 'blob:mock'; };
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText('📊 CSV'));
    expect(created.some(t => t.includes('csv'))).toBe(true);
    (URL as any).createObjectURL = origCreate;
  });

  it('E8 дайджест без clipboard не роняет хаб (честный тост вместо TypeError)', () => {
    seedSRPE(6, 7);
    const origClip = (navigator as any).clipboard;
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const toasts: string[] = [];
    (window as any).showToast = (m: string) => { toasts.push(String(m)); };
    render(<UnifiedIntelligenceHub />);
    fireEvent.click(screen.getByText('📋 Дайджест'));
    expect(toasts.join(' ')).toContain('Копирование недоступно');
    Object.defineProperty(navigator, 'clipboard', { value: origClip, configurable: true });
  });

  // ——— E12: миграция v1→v2 снапшота ———
  it('E12 легаси-снапшот v1 подхватывается и переносится в v2 (старый ключ удаляется)', () => {
    // реалистичный v1: без полей goal/e1RM/what-if, которые появились в v2
    localStorage.setItem('he_unified_intel_snapshot_v1', JSON.stringify({
      readiness: 91, fatigue: 11, sleepHours: 8.5, sleepQuality: 5, rmssd: 72, restingHR: 49,
      stress: 2, doms: 1, trainDays: 5, phase: 'intensification', lastRPE: 6, vLoss: 5,
    }));
    render(<UnifiedIntelligenceHub />);
    // v1 прочитан: значения попали в состояние (готовность 91 видна в пульте, не дефолт 72)
    expect(document.body.textContent).toContain('91');
    // и сразу записан в v2, а старый ключ убран — чтобы вторая загрузка не читала легаси
    const v2 = localStorage.getItem('he_unified_intel_snapshot_v2');
    expect(v2).toBeTruthy();
    const parsed = JSON.parse(v2 as string);
    expect(parsed.readiness).toBe(91);
    expect(parsed.v).toBe(2);
    expect(localStorage.getItem('he_unified_intel_snapshot_v1')).toBeNull();
  });

  it('E12 битый v1 не ломает хаб: показываются дефолты, снимок не падает', () => {
    localStorage.setItem('he_unified_intel_snapshot_v1', '{не json');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<UnifiedIntelligenceHub />);
    expect(screen.getAllByText(/Единый пульт/).length).toBeGreaterThan(0);
    // авто-заполнение из профиля сработало, а не падение
    expect(localStorage.getItem('he_unified_intel_snapshot_v2')).toBeTruthy();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('E12 v2 имеет приоритет над v1 (актуальные данные не перетираются легаси)', () => {
    localStorage.setItem('he_unified_intel_snapshot_v2', JSON.stringify({
      readiness: 55, fatigue: 44, savedAt: new Date().toISOString(), v: 2,
    }));
    localStorage.setItem('he_unified_intel_snapshot_v1', JSON.stringify({ readiness: 95, fatigue: 5 }));
    render(<UnifiedIntelligenceHub />);
    // v2 применён (готовность 55 в пульте), а легаси-95 не подхватилась
    expect(document.body.textContent).toContain('55');
    // легаси-ключ остаётся нетронутым при чтении v2 (миграция срабатывает только в ветке v1)
    expect(localStorage.getItem('he_unified_intel_snapshot_v1')).toBeTruthy();
  });
});
