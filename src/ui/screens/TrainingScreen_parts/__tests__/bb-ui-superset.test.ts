/**
 * Аудит UI, проход 13 — ручной суперсет (P3).
 *
 * Правка суперсета живёт в `exerciseEdits` и переприменяется при каждой пересборке
 * плана. Раньше это давало два дефекта:
 *  1) повторное применение искало «свободного» партнёра — после замены/перестановки
 *     упражнения находился другой партнёр или никто (если прежний уже был в суперсете);
 *  2) при неудаче в план навсегда дописывался комментарий
 *     «⚠ суперсет: подходящий партнёр не найден» — ложное предупреждение в данных.
 *
 * Теперь `applyManualSupersetTo` идемпотентна, оборванная ссылка снимается и партнёр
 * ищется заново, а неудача возвращает `false`, не трогая план.
 */
import { describe, expect, it } from 'vitest';
import { applyManualSupersetTo } from '../bb-auto-constructor-shared';

const ex = (name: string, muscle: string, extra: Record<string, any> = {}) => ({
  name,
  muscle,
  sets: 4,
  reps: 8,
  restSeconds: 90,
  workSets: [{ weight: 100, reps: 8, restSeconds: 90 }],
  ...extra,
});

const count = (s: any, needle: string) => String(s || '').split(needle).length - 1;

describe('аудит UI: ручной суперсет', () => {
  it('антагонист: связывает реального партнёра, обнуляет отдых, пишет комментарий', () => {
    const session = [ex('Жим лёжа', 'chest'), ex('Тяга штанги', 'back'), ex('Сведение в кроссовере', 'chest')];
    expect(applyManualSupersetTo(session, 0, 'антагонист')).toBe(true);
    const [a, b] = session;
    expect(a.supersetWith).toBe('Тяга штанги');
    expect(b.supersetWith).toBe('Жим лёжа');
    expect(a.supersetGroup).toBe(b.supersetGroup);
    expect([a.supersetSlot, b.supersetSlot]).toEqual([0, 1]);
    expect(a.restSeconds).toBe(0);
    expect(b.restSeconds).toBe(0);
    expect(a.workSets[0].restSeconds).toBe(0);
    expect(a.comment).toContain('🔗 Суперсет с');
    expect(b.comment).toContain('🔗 Суперсет с');
  });

  it('повторное применение той же правки — не меняет план', () => {
    const session = [ex('Жим лёжа', 'chest'), ex('Тяга штанги', 'back')];
    applyManualSupersetTo(session, 0, 'антагонист');
    const group = session[0].supersetGroup;
    const comments = session.map(s => s.comment);
    expect(applyManualSupersetTo(session, 0, 'антагонист')).toBe(true);
    expect(session[0].supersetGroup).toBe(group);
    expect(session.map(s => s.comment)).toEqual(comments);
    expect(count(session[0].comment, '🔗 Суперсет с')).toBe(1);
  });

  it('после замены партнёра — ссылка переезжает на нового партнёра, ложного «не найден» нет', () => {
    const session = [ex('Жим лёжа', 'chest'), ex('Тяга штанги', 'back')];
    applyManualSupersetTo(session, 0, 'антагонист');
    // Партнёра заменили (шаг «замена упражнения»).
    session[1] = ex('Тяга в наклоне', 'back');
    expect(applyManualSupersetTo(session, 0, 'антагонист')).toBe(true);
    expect(session[0].supersetWith).toBe('Тяга в наклоне');
    expect(session[1].supersetWith).toBe('Жим лёжа');
    expect(session[0].supersetGroup).toBe(session[1].supersetGroup);
    expect(String(session[0].comment)).not.toContain('не найден');
  });

  it('партнёра нет — `false` и никаких следов в плане', () => {
    const session = [ex('Жим лёжа', 'chest'), ex('Сведение в кроссовере', 'chest')];
    expect(applyManualSupersetTo(session, 0, 'антагонист')).toBe(false);
    expect(session[0].comment ?? '').toBe('');
    expect(session[0].supersetGroup ?? null).toBeNull();
    expect(session[1].supersetWith ?? null).toBeNull();
  });

  it('явное имя партнёра: связывает по имени, отсутствующее имя — `false`', () => {
    const session = [ex('Жим лёжа', 'chest'), ex('Французский жим', 'triceps')];
    expect(applyManualSupersetTo(session, 0, 'Французский жим')).toBe(true);
    expect(session[0].supersetWith).toBe('Французский жим');
    const other = [ex('Жим лёжа', 'chest')];
    expect(applyManualSupersetTo(other, 0, 'Нет такого')).toBe(false);
    expect(other[0].comment ?? '').toBe('');
  });

  it('«та же группа» — партнёр той же мышцы', () => {
    const session = [ex('Подъём на бицепс', 'biceps'), ex('Молотки', 'biceps'), ex('Жим лёжа', 'chest')];
    expect(applyManualSupersetTo(session, 0, 'та же группа')).toBe(true);
    expect(session[0].supersetWith).toBe('Молотки');
    expect(session[2].supersetWith ?? null).toBeNull();
  });

  it('занятый партнёр не отбирается: второй суперсет ищет свободного', () => {
    const session = [ex('Жим лёжа', 'chest'), ex('Тяга штанги', 'back'), ex('Сведение в кроссовере', 'chest'), ex('Тяга блока', 'back')];
    expect(applyManualSupersetTo(session, 0, 'антагонист')).toBe(true);
    expect(applyManualSupersetTo(session, 2, 'антагонист')).toBe(true);
    expect(session[2].supersetWith).toBe('Тяга блока');
    expect(session[0].supersetWith).toBe('Тяга штанги');
    expect(session[0].supersetGroup).not.toBe(session[2].supersetGroup);
  });
});
