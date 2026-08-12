import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../core/db', () => ({
  db: {
    getAll: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    getByIndex: vi.fn(),
    getByDateRange: vi.fn(),
    clear: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
}));

import {
  splitCSVRow, importSessionsFromCSV, updateSession, deleteSession, workoutLogToSession,
  logSet, startSession, addExerciseToSession, getVolumeTrend, getISOWeekNumber, getISOWeekYear,
  getStorageTrimWarning, clearStorageTrimWarning, saveSessions, loadSessions, cleanLegacyExerciseName, SET_LIMITS,
  findDuplicateWorkouts, workoutContentSignature, finishSession, getLastSession, compareWithPrevious,
} from '../workout-logger.engine';
import { StrengthDiary, sessionToWorkoutLog } from '../strength-diary.engine';
import { db } from '../../core/db';
import type { WorkoutLog, StrengthLogEntry } from '../../core/types';

function getMockDb() {
  return db as any;
}

const mkLog = (id: string, date: string, exName: string, sets: Array<{ weight: number; reps: number; rpe?: number; rir?: number }>): WorkoutLog => ({
  id, date, duration: 60,
  exercises: [{
    id: `${id}_ex`, date, exerciseId: exName, exerciseName: exName, isCompound: true,
    sets, totalVolume: sets.reduce((s, x) => s + x.weight * x.reps, 0),
    estimated1RM: Math.max(0, ...sets.map(x => x.weight * (1 + x.reps / 30))),
  }],
  overallRPE: 7, recoveryBefore: 5, split: 'PPL', weekNumber: 1,
});

describe('splitCSVRow', () => {
  it('парсит кавычки и запятые внутри полей', () => {
    const row = '2026-08-01,"Жим штанги лёжа, узкий",1,80,5,8,2,"заметка, с запятой"';
    expect(splitCSVRow(row)).toEqual(['2026-08-01', 'Жим штанги лёжа, узкий', '1', '80', '5', '8', '2', 'заметка, с запятой']);
  });
  it('поддерживает точку с запятой', () => {
    const row = '2026-08-01;Приседания;1;100;5;8;1';
    expect(splitCSVRow(row)).toEqual(['2026-08-01', 'Приседания', '1', '100', '5', '8', '1']);
  });
  it('обрабатывает экранированные кавычки ("" внутри поля)', () => {
    expect(splitCSVRow('"Жим ""б"" лёжа",1')).toEqual(['Жим "б" лёжа', '1']);
  });
});

describe('importSessionsFromCSV', () => {
  beforeEach(() => { localStorage.clear(); });
  it('импортирует формат экспорта хаба (с заметками и кавычками)', () => {
    const csv = [
      'date,exercise,set,weight,reps,rpe,rir,notes',
      '2026-08-01,"Жим штанги лёжа",1,80,5,8,2,"хорошо"',
      '2026-08-01,"Жим штанги лёжа",2,80,4,9,1,"тяжело"',
      '2026-08-01,"Приседания",1,100,5,8,2,',
    ].join('\n');
    const res = importSessionsFromCSV(csv);
    expect(res.importedSessions).toBe(1);
    expect(res.importedSets).toBe(3);
    expect(res.errors).toEqual([]);
    const [s] = loadSessions();
    expect(s.weekNumber).toBe(getISOWeekNumber('2026-08-01'));
    expect(s.exercises[0].sets.length).toBe(2);
    expect(s.exercises[0].sets[0].notes).toBe('хорошо');
    // PR по росту e1RM: 80×5 (93.3) > 80×4 (90.7) → только 1-й подход PR
    expect(s.exercises[0].sets[0].isPR).toBe(true);
    expect(s.exercises[0].sets[1].isPR).toBe(false);
  });
  it('импортирует формат с точкой с запятой', () => {
    const csv = 'date;exercise;set;weight;reps;rpe;rir\n2026-08-02;Тяга;1;60;8;7;2\n';
    const res = importSessionsFromCSV(csv);
    expect(res.importedSessions).toBe(1);
    expect(res.importedSets).toBe(1);
    expect(res.errors).toEqual([]);
  });
  it('импортирует формат движка (Date,Exercise,...,1RM,PR,Focus) без путаницы колонок', () => {
    const csv = [
      'Date,Exercise,Set,Weight,Reps,RPE,RIR,1RM,PR,Session Focus',
      '2026-08-03,Bench,1,80,5,8,2,93,Yes,PPL',
    ].join('\n');
    const res = importSessionsFromCSV(csv);
    expect(res.importedSessions).toBe(1);
    const [s] = loadSessions();
    expect(s.exercises[0].sets[0].rir).toBe(2);
  });
  it('дедуплицирует повторный импорт одинаковых строк', () => {
    const csv = 'date,exercise,set,weight,reps\n2026-08-04,Жим,1,80,5\n';
    importSessionsFromCSV(csv);
    const res = importSessionsFromCSV(csv);
    expect(res.importedSessions).toBe(0);
    expect(loadSessions().length).toBe(1);
  });
  it('сообщает об ошибках в строках', () => {
    const csv = 'date,exercise,set,weight,reps\n2026-08-04,Жим,1,abc,5\n2026-08-04,Жим,1,80,5\n';
    const res = importSessionsFromCSV(csv);
    expect(res.errors.length).toBe(1);
    expect(res.importedSessions).toBe(1);
  });
});

describe('CRUD сессий (localStorage)', () => {
  beforeEach(() => { localStorage.clear(); });
  it('updateSession обновляет поля', () => {
    const s = startSession('PPL', 1);
    addExerciseToSession(s, { id: 'bench', name: 'Жим', pattern: 'horizontal_push', muscleGroup: 'chest' });
    const finished = { ...s, sessionId: 'sess_test' };
    saveSessions([finished]);
    const updated = updateSession('sess_test', { notes: 'обновлено', durationMin: 90 });
    expect(updated?.notes).toBe('обновлено');
    expect(loadSessions()[0].durationMin).toBe(90);
  });
  it('updateSession возвращает null для несуществующей сессии', () => {
    expect(updateSession('nope', { notes: 'x' })).toBeNull();
  });
  it('deleteSession удаляет сессию', () => {
    saveSessions([{ ...startSession('PPL', 1), sessionId: 'a' }, { ...startSession('PPL', 1), sessionId: 'b' }]);
    expect(deleteSession('a')).toBe(true);
    expect(loadSessions().map(s => s.sessionId)).toEqual(['b']);
    expect(deleteSession('nope')).toBe(false);
  });
});

describe('workoutLogToSession', () => {
  it('обратный маппинг сохраняет id/дату/упражнения и веса', () => {
    const log = mkLog('workout_1', '2026-08-05', 'Жим штанги лёжа', [{ weight: 80, reps: 5, rpe: 8, rir: 2 }]);
    const s = workoutLogToSession(log);
    expect(s.sessionId).toBe('workout_1');
    expect(s.date).toBe('2026-08-05');
    expect(s.exercises[0].exerciseName).toBe('Жим штанги лёжа');
    expect(s.exercises[0].sets[0].weightKg).toBe(80);
    expect(s.exercises[0].sets[0].rir).toBe(2);
    expect(s.totalVolume).toBe(400);
  });
});

describe('logSet PR по e1RM', () => {
  it('PR засчитывается по росту e1RM, а не только веса', () => {
    let s = startSession('PPL', 1);
    s = addExerciseToSession(s, { id: 'bench', name: 'Жим', pattern: 'horizontal_push', muscleGroup: 'chest' });
    let r = logSet(s, 0, { setNumber: 1, weightKg: 82, reps: 1, rpe: 9, rir: 0 });
    expect(r.success).toBe(true);
    expect(r.session.exercises[0].sets[0].isPR).toBe(true);
    // 80×5 (e1RM 93.3) > 82×1 (e1RM 84.7) → PR даже при меньшем весе
    r = logSet(r.session, 0, { setNumber: 2, weightKg: 80, reps: 5, rpe: 8, rir: 2 });
    expect(r.session.exercises[0].sets[1].isPR).toBe(true);
    // Повторный 80×5 — уже не PR
    r = logSet(r.session, 0, { setNumber: 3, weightKg: 80, reps: 5, rpe: 8, rir: 2 });
    expect(r.session.exercises[0].sets[2].isPR).toBe(false);
  });
});

describe('getVolumeTrend — окно по датам', () => {
  beforeEach(() => { localStorage.clear(); });
  it('фильтрует сессии старше N дней', () => {
    const old = { ...startSession('PPL', 1), date: '2020-01-01', sessionId: 'old' };
    const recent = { ...startSession('PPL', 1), date: new Date().toISOString().slice(0, 10), sessionId: 'recent', totalVolume: 1000, totalSets: 3, exercises: [] };
    saveSessions([old, recent]);
    const trend = getVolumeTrend(14);
    expect(trend.length).toBe(1);
    expect(trend[0].volume).toBe(1000);
  });
});

describe('ISO год недели', () => {
  it('2021-01-01 принадлежит ISO-неделе 2020 года', () => {
    expect(getISOWeekNumber('2021-01-01')).toBe(53);
    expect(getISOWeekYear('2021-01-01')).toBe(2020);
  });
  it('обычная дата — тот же год', () => {
    expect(getISOWeekYear('2026-07-15')).toBe(2026);
  });
});

describe('предупреждение о срезе хранилища', () => {
  beforeEach(() => { localStorage.clear(); });
  it('set/clear/get roundtrip', () => {
    saveSessions([{ ...startSession('PPL', 1), sessionId: 'a' }]);
    expect(getStorageTrimWarning()).toBeNull();
    // markTrimmed вызывается только при quota-ошибке; проверим обход через localStorage напрямую
    localStorage.setItem('he_workout_log_trimmed', JSON.stringify({ kept: 50, at: 123 }));
    expect(getStorageTrimWarning()).toEqual({ kept: 50, at: 123 });
    clearStorageTrimWarning();
    expect(getStorageTrimWarning()).toBeNull();
  });
});

describe('валидация лимитов и legacy-чистка имён', () => {
  beforeEach(() => { localStorage.clear(); });
  it('logSet отклоняет вес/повторы сверх лимитов', () => {
    let s = startSession('PPL', 1);
    s = addExerciseToSession(s, { id: 'bench', name: 'Жим', pattern: 'horizontal_push', muscleGroup: 'chest' });
    expect(logSet(s, 0, { setNumber: 1, weightKg: 600, reps: 5, rpe: 8, rir: 2 }).success).toBe(false);
    expect(logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 200, rpe: 8, rir: 2 }).success).toBe(false);
    expect(logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 5, rpe: 8, rir: 2 }).success).toBe(true);
    expect(SET_LIMITS.maxWeightKg).toBe(500);
  });
  it('cleanLegacyExerciseName убирает маркеры [superset:N] и [note:...]', () => {
    expect(cleanLegacyExerciseName('Жим штанги лёжа [superset:1] [note:тяжело]')).toBe('Жим штанги лёжа');
    expect(cleanLegacyExerciseName('Приседания')).toBe('Приседания');
    expect(cleanLegacyExerciseName('Тяга [note:с паузой]')).toBe('Тяга');
  });
  it('techniqueScore проходит круг: сессия → WorkoutLog → сессия', () => {
    let s = startSession('PPL', 1);
    s = addExerciseToSession(s, { id: 'bench', name: 'Жим', pattern: 'horizontal_push', muscleGroup: 'chest' });
    const r = logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 5, rpe: 8, rir: 2, techniqueScore: 4 });
    expect(r.session.exercises[0].sets[0].techniqueScore).toBe(4);
    const wl = sessionToWorkoutLog(r.session);
    expect(wl.exercises[0].sets[0].techniqueScore).toBe(4);
    const back = workoutLogToSession(wl);
    expect(back.exercises[0].sets[0].techniqueScore).toBe(4);
  });
});

describe('findDuplicateWorkouts', () => {
  it('находит идентичные тренировки (дата + контент) и оставляет keep', () => {
    const a = mkLog('idb_copy', '2026-08-11', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]);
    const b = mkLog('ls_copy', '2026-08-11', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]);
    const dupes = findDuplicateWorkouts([a, b]);
    expect(dupes.length).toBe(1);
    expect(dupes[0].keep.id).toBe('ls_copy'); // наибольший id — keep
    expect(dupes[0].dupes.map(d => d.id)).toEqual(['idb_copy']);
  });
  it('не считает дублями разные тренировки за один день', () => {
    const a = mkLog('a', '2026-08-11', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]);
    const b = mkLog('b', '2026-08-11', 'Жим', [{ weight: 85, reps: 5, rir: 2, rpe: 8 }]);
    expect(findDuplicateWorkouts([a, b]).length).toBe(0);
  });
  it('не считает дублями разные дни', () => {
    const a = mkLog('a', '2026-08-11', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]);
    const b = mkLog('b', '2026-08-12', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]);
    expect(findDuplicateWorkouts([a, b]).length).toBe(0);
  });
  it('workoutContentSignature игнорирует порядок упражнений', () => {
    const a = mkLog('a', '2026-08-11', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]);
    const b = { ...mkLog('b', '2026-08-11', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]), exercises: [mkLog('b', '2026-08-11', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]).exercises[0]] };
    expect(workoutContentSignature(a)).toBe(workoutContentSignature(b));
  });
});

describe('finishSession roundtrip (проведение тренировки → дневник)', () => {
  beforeEach(() => { localStorage.clear(); });
  it('завершённая сессия появляется в loadSessions и getLastSession', () => {
    let s = startSession('ББ', 1);
    s = addExerciseToSession(s, { id: 'bench_press', name: 'Жим штанги лёжа', pattern: 'horizontal_push', muscleGroup: 'chest' });
    const r = logSet(s, 0, { setNumber: 1, weightKg: 80, reps: 5, rpe: 8, rir: 2 });
    const finished = finishSession(r.session, 'тест');
    expect(finished.durationMin).toBeGreaterThanOrEqual(0);
    const stored = loadSessions();
    expect(stored.length).toBe(1);
    expect(stored[0].sessionId).toBe(finished.sessionId);
    expect(stored[0].exercises[0].sets[0].weightKg).toBe(80);
    expect(getLastSession()?.sessionId).toBe(finished.sessionId);
  });
  it('сравнение с предыдущей сессией (compareWithPrevious)', () => {
    let s1 = startSession('ББ', 1);
    s1 = { ...s1, sessionId: 'a', totalVolume: 1000, totalSets: 5 };
    let s2 = startSession('ББ', 1);
    s2 = { ...s2, sessionId: 'b', totalVolume: 1200, totalSets: 6 };
    saveSessions([s2, s1]);
    const cmp = compareWithPrevious(s2);
    expect(cmp.older?.sessionId).toBe('a');
    expect(cmp.volumeDelta).toBe(200);
  });
  it('повторное сохранение workout с тем же id не дублирует зеркало в localStorage', async () => {
    const diary = new StrengthDiary();
    const w = mkLog('w_dup', '2026-08-13', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]);
    await diary.saveWorkoutLog(w);
    await diary.saveWorkoutLog(w);
    expect(loadSessions().filter(s => s.sessionId === 'w_dup').length).toBe(1);
  });
});

describe('StrengthDiary — единый слой и дедуп', () => {
  beforeEach(() => { localStorage.clear(); getMockDb().getAll.mockReset(); getMockDb().put.mockReset().mockResolvedValue(undefined); getMockDb().delete.mockReset().mockResolvedValue(undefined); });
  it('saveWorkoutLog зеркалит в localStorage', async () => {
    const diary = new StrengthDiary();
    await diary.saveWorkoutLog(mkLog('w1', '2026-08-06', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]));
    expect(loadSessions().map(s => s.sessionId)).toContain('w1');
  });
  it('deleteWorkoutLog удаляет из IDB и localStorage + дочерние strength-логи', async () => {
    const mockDb = getMockDb();
    const diary = new StrengthDiary();
    await diary.saveWorkoutLog(mkLog('w2', '2026-08-07', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]));
    mockDb.getAll.mockResolvedValueOnce([
      { id: 'w2_ex', exerciseId: 'Жим', sets: [], totalVolume: 0, estimated1RM: 0, isCompound: true, date: '2026-08-07' } as StrengthLogEntry,
    ]);
    await diary.deleteWorkoutLog('w2');
    expect(mockDb.delete).toHaveBeenCalledWith('workout_log', 'w2');
    expect(mockDb.delete).toHaveBeenCalledWith('training_log', 'w2_ex');
    expect(loadSessions().map(s => s.sessionId)).not.toContain('w2');
  });
  it('getWorkoutLogs: две сессии за день с разными весами сохраняются, идентичные — схлопываются', async () => {
    const mockDb = getMockDb();
    mockDb.getAll.mockResolvedValueOnce([]); // workout_log пуст
    saveSessions([
      { ...workoutLogToSession(mkLog('w_am', '2026-08-08', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }])) },
      { ...workoutLogToSession(mkLog('w_pm', '2026-08-08', 'Жим', [{ weight: 85, reps: 5, rir: 2, rpe: 8 }])) },
    ]);
    const diary = new StrengthDiary();
    const logs = await diary.getWorkoutLogs();
    const жим = logs.flatMap(l => l.exercises).filter(e => e.exerciseName === 'Жим');
    expect(жим.reduce((s, e) => s + (e.sets || []).length, 0)).toBe(2); // оба подхода сохранены

    // Свежий экземпляр (кэш 5 мин не должен возвращать устаревшие данные)
    mockDb.getAll.mockReset();
    mockDb.getAll.mockResolvedValueOnce([]);
    localStorage.clear();
    saveSessions([
      { ...workoutLogToSession(mkLog('w_a', '2026-08-09', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }])) },
      { ...workoutLogToSession(mkLog('w_b', '2026-08-09', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }])) },
    ]);
    const logs2 = await new StrengthDiary().getWorkoutLogs();
    const жим2 = logs2.flatMap(l => l.exercises).filter(e => e.exerciseName === 'Жим');
    expect(жим2.reduce((s, e) => s + (e.sets || []).length, 0)).toBe(1); // дубликат схлопнут
  });
  it('getWorkoutLogs: write-back сессий из localStorage в IndexedDB', async () => {
    const mockDb = getMockDb();
    mockDb.getAll.mockResolvedValueOnce([]);
    saveSessions([workoutLogToSession(mkLog('ls_only', '2026-08-10', 'Жим', [{ weight: 80, reps: 5, rir: 2, rpe: 8 }]))]);
    const diary = new StrengthDiary();
    await diary.getWorkoutLogs();
    expect(mockDb.put).toHaveBeenCalledWith('workout_log', expect.objectContaining({ id: 'ls_only' }));
  });
});
