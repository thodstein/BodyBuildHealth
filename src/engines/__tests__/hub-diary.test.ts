import { describe, it, expect, beforeEach } from 'vitest';
import { loadHubDiarySessions, loadHubDiaryFlatEntries } from '../hub-diary.engine';

const V2 = [
  {
    sessionId: 's1', date: '2026-09-20', focus: 'upper',
    exercises: [
      { exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа', muscleGroup: 'chest', sets: [
        { setNumber: 1, weightKg: 100, reps: 5, rpe: 8 },
        { setNumber: 2, weightKg: 110, reps: 3, rpe: 9, velocityMs: 0.42 },
      ] },
      { exerciseId: 'curl_db', exerciseName: 'Сгибание с гантелями', muscleGroup: 'biceps', sets: [{ weightKg: 16, reps: 10 }] },
    ],
  },
  { sessionId: 's2', date: '2026-09-18', exercises: [{ exerciseName: 'Присед', sets: [{ weightKg: 160, reps: 5, isWarmup: false }] }] },
];

describe('ROUND-10: единый адаптер дневника для хабов', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

  it('v2-форма: сессии и сеты (weightKg→weight, velocityMs→velocity)', () => {
    localStorage.setItem('he_workout_log_v2', JSON.stringify(V2));
    const s = loadHubDiarySessions();
    expect(s.length).toBe(2);
    expect(s[0].date).toBe('2026-09-20');
    expect(s[0].exercises[0].exerciseName).toBe('Жим штанги лёжа');
    expect(s[0].exercises[0].muscleGroup).toBe('chest');
    expect(s[0].exercises[0].sets[0]).toMatchObject({ weight: 100, reps: 5, rpe: 8 });
    expect(s[0].exercises[0].sets[1].velocity).toBe(0.42);
  });

  it('пустой легаси-ключ ([]) НЕ блокирует живой v2 (корень бага «хаб слеп к дневнику»)', () => {
    localStorage.setItem('he_workout_log_v1', '[]');
    localStorage.setItem('he_training_log', '[]');
    localStorage.setItem('he_workout_log_v2', JSON.stringify(V2));
    expect(loadHubDiarySessions().length).toBe(2);
    expect(loadHubDiaryFlatEntries().length).toBe(3);
  });

  it('фолбэк: легаси-плоские записи оборачиваются в сессии', () => {
    localStorage.setItem('he_training_log', JSON.stringify([
      { date: '2026-09-19', exerciseName: 'Становая', sets: [{ weight: 200, reps: 3 }] },
    ]));
    const s = loadHubDiarySessions();
    expect(s.length).toBe(1);
    expect(s[0].exercises[0].exerciseName).toBe('Становая');
    expect(s[0].exercises[0].sets[0]).toMatchObject({ weight: 200, reps: 3 });
  });

  it('плоские записи: по строке на упражнение (для buildDiaryTrendSS/smWeeklySetsByLift)', () => {
    localStorage.setItem('he_workout_log_v2', JSON.stringify(V2));
    const flat = loadHubDiaryFlatEntries();
    expect(flat.length).toBe(3);
    expect(flat[0]).toMatchObject({ date: '2026-09-20', exerciseName: 'Жим штанги лёжа' });
    expect(flat[0].sets.length).toBe(2);
    expect(flat[2].exerciseName).toBe('Присед');
  });

  it('битый JSON и мусор — тихо, идём дальше по цепочке ключей', () => {
    localStorage.setItem('he_workout_log_v2', '{broken');
    localStorage.setItem('he_workout_log_v1', JSON.stringify([{ date: 'не-дата', exerciseName: 'x', sets: [{ weight: 1, reps: 1 }] }, { date: '2026-09-01' }]));
    const s = loadHubDiarySessions();
    expect(s).toEqual([]); // не-ISO дата и запись без сетов отброшены
    localStorage.setItem('he_workout_log_v1', JSON.stringify([{ date: '2026-09-01', exerciseName: 'Тяга', sets: [{ weight: 90, reps: 8 }] }]));
    expect(loadHubDiarySessions().length).toBe(1);
  });

  it('пустое хранилище → пустые обе формы (без throw)', () => {
    expect(loadHubDiarySessions()).toEqual([]);
    expect(loadHubDiaryFlatEntries()).toEqual([]);
  });
});
