/**
 * coach-mode.test.ts — режим тренера: карточки атлетов и разделы.
 *
 * Проверяем продуктовые обещания, а не «геттеры»:
 *  • лимит 20 атлетов — жёсткий: 21-й не добавляется, чужие данные не вытесняются;
 *  • включение режима с пустым выбором разделов не оставляет тренера с пустым экраном;
 *  • активный атлет не может «повиснуть» после удаления;
 *  • битый/чужой JSON не роняет профиль, мусорные атлеты не загружаются;
 *  • числа (возраст/вес/рост) фильтруются от опечаток, но это не нормативы.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_MAX_ATHLETES,
  COACH_SECTIONS,
  addCoachAthlete,
  allCoachSections,
  coachActiveAthlete,
  coachLimits,
  coachSummary,
  emptyCoachState,
  parseCoachState,
  readCoachState,
  removeCoachAthlete,
  serializeCoachState,
  setActiveCoachAthlete,
  setCoachEnabled,
  setCoachSections,
  toggleCoachSection,
  updateCoachAthlete,
  writeCoachState,
  type CoachState,
} from '../coach-mode.engine';

const NOW = '2026-11-04T10:00:00.000Z';

const withAthlete = (name = 'Иван', id = 'a1'): CoachState => {
  const r = addCoachAthlete(emptyCoachState(), { name }, { id, now: NOW });
  return r.state;
};

describe('переключатель и разделы', () => {
  it('по умолчанию режим выключен, атлетов и разделов нет', () => {
    const s = emptyCoachState();
    expect(s.enabled).toBe(false);
    expect(s.athletes).toEqual([]);
    expect(s.sections).toEqual([]);
    expect(s.activeAthleteId).toBeNull();
  });

  it('первое включение подставляет ВСЕ разделы (без пустого экрана)', () => {
    const s = setCoachEnabled(emptyCoachState(), true);
    expect(s.enabled).toBe(true);
    expect(s.sections).toEqual(allCoachSections());
    expect(s.sections.length).toBe(COACH_SECTIONS.length);
  });

  it('выбор разделов сохраняется при повторном включении (не сбрасывается)', () => {
    let s = setCoachEnabled(emptyCoachState(), true);
    s = toggleCoachSection(s, 'nutrition');
    s = toggleCoachSection(s, 'labs');
    s = setCoachEnabled(s, false);
    s = setCoachEnabled(s, true);
    expect(s.sections).toEqual(['training', 'risks', 'pharma', 'supplements']);
  });

  it('неизвестные/дубли/чужие разделы отбрасываются, порядок — каталога', () => {
    const s = setCoachSections(emptyCoachState(), ['labs', 'labs', 'nope', 'training', 42]);
    expect(s.sections).toEqual(['training', 'labs']);
  });
});

describe('атлеты: добавление', () => {
  it('имя обязательно (пробелы не считаются именем)', () => {
    const r = addCoachAthlete(emptyCoachState(), { name: '   ' });
    expect(r.error).toBe('name');
    expect(r.athlete).toBeNull();
    expect(r.state.athletes).toHaveLength(0);
  });

  it('первый атлет становится активным, разделы наследуются от режима', () => {
    const base = setCoachEnabled(emptyCoachState(), true);
    const r = addCoachAthlete(base, { name: '  Иван  ', age: '28', weightKg: '82,5', heightCm: 180, direction: 'Пауэрлифтинг', goal: 'Присед 200' });
    expect(r.error).toBeNull();
    expect(r.athlete?.name).toBe('Иван');
    expect(r.athlete?.age).toBe(28);
    expect(r.athlete?.weightKg).toBe(82.5);
    expect(r.state.activeAthleteId).toBe(r.athlete?.id);
    expect(r.athlete?.sections).toEqual(allCoachSections());
  });

  it('лимит 20 атлетов жёсткий: 21-й отклоняется, состояние не меняется', () => {
    let s = emptyCoachState();
    for (let i = 1; i <= COACH_MAX_ATHLETES; i++) {
      s = addCoachAthlete(s, { name: `Атлет ${i}` }, { id: `a${i}`, now: NOW }).state;
    }
    expect(s.athletes).toHaveLength(COACH_MAX_ATHLETES);
    const r = addCoachAthlete(s, { name: 'Двадцать первый' }, { id: 'a21', now: NOW });
    expect(r.error).toBe('limit');
    expect(r.athlete).toBeNull();
    expect(r.state).toBe(s); // именно то же состояние, без «тихого» вытеснения
    expect(coachLimits(r.state)).toMatchObject({ count: 20, max: 20, canAdd: false, remaining: 0 });
  });

  it('мусор в числах не превращается в «норму»: null вместо выдумки', () => {
    const r = addCoachAthlete(emptyCoachState(), { name: 'Тест', age: -5, weightKg: 'abc', heightCm: 500 });
    expect(r.athlete?.age).toBeNull();
    expect(r.athlete?.weightKg).toBeNull();
    expect(r.athlete?.heightCm).toBeNull();
  });

  it('пол незнакомый → unspecified (не угадываем)', () => {
    const r = addCoachAthlete(emptyCoachState(), { name: 'Тест', sex: 'other' });
    expect(r.athlete?.sex).toBe('unspecified');
  });
});

describe('атлеты: правка и удаление', () => {
  it('правка нормализует поля, пустое имя не применяется', () => {
    const s = withAthlete();
    const ok = updateCoachAthlete(s, 'a1', { name: '  Иван П.  ', age: 29 }, { now: NOW });
    expect(ok.athletes[0].name).toBe('Иван П.');
    expect(ok.athletes[0].age).toBe(29);
    const bad = updateCoachAthlete(ok, 'a1', { name: '   ' }, { now: NOW });
    expect(bad).toBe(ok); // пустое имя — не «атлет без имени»
  });

  it('неизвестный id — no-op (тот же объект)', () => {
    const s = withAthlete();
    expect(updateCoachAthlete(s, 'nope', { name: 'X' })).toBe(s);
    expect(removeCoachAthlete(s, 'nope')).toBe(s);
    expect(setActiveCoachAthlete(s, 'nope')).toBe(s);
  });

  it('удаление активного сбрасывает активного, остальные остаются', () => {
    let s = withAthlete('Иван', 'a1');
    s = addCoachAthlete(s, { name: 'Пётр' }, { id: 'a2', now: NOW }).state;
    s = setActiveCoachAthlete(s, 'a2');
    s = removeCoachAthlete(s, 'a2');
    expect(s.athletes.map(a => a.id)).toEqual(['a1']);
    expect(s.activeAthleteId).toBeNull();
    expect(coachActiveAthlete(s)).toBeNull();
  });

  it('переключение активного и сброс в null', () => {
    let s = withAthlete('Иван', 'a1');
    s = addCoachAthlete(s, { name: 'Пётр' }, { id: 'a2', now: NOW }).state;
    s = setActiveCoachAthlete(s, 'a1');
    expect(coachActiveAthlete(s)?.name).toBe('Иван');
    s = setActiveCoachAthlete(s, null);
    expect(s.activeAthleteId).toBeNull();
  });
});

describe('хранение и терпимость', () => {
  it('сериализация → парсер сохраняет состояние', () => {
    let s = setCoachEnabled(emptyCoachState(), true);
    s = toggleCoachSection(s, 'pharma');
    s = addCoachAthlete(s, { name: 'Иван', age: 28 }, { id: 'a1', now: NOW }).state;
    s = setActiveCoachAthlete(s, 'a1');
    const round = parseCoachState(serializeCoachState(s));
    expect(round.enabled).toBe(true);
    expect(round.sections).toEqual(s.sections);
    expect(round.athletes[0].name).toBe('Иван');
    expect(round.activeAthleteId).toBe('a1');
  });

  it('битый JSON / чужая версия / не объект → пусто', () => {
    expect(parseCoachState('{oops').athletes).toEqual([]);
    expect(parseCoachState(JSON.stringify({ version: 2, athletes: [{ id: 'a', name: 'X' }] })).athletes).toEqual([]);
    expect(parseCoachState('null').athletes).toEqual([]);
    expect(parseCoachState(null).athletes).toEqual([]);
  });

  it('мусорные атлеты отбрасываются, дубли id и активный-призрак чистятся', () => {
    const raw = JSON.stringify({
      version: 1,
      enabled: true,
      sections: ['training', 'unknown'],
      activeAthleteId: 'ghost',
      athletes: [
        { id: 'a1', name: 'Иван' },
        { id: 'a1', name: 'Дубль' },
        { id: 'a2', name: '   ' },
        { name: 'Без id' },
        'мусор',
      ],
    });
    const s = parseCoachState(raw);
    expect(s.athletes.map(a => a.name)).toEqual(['Иван']);
    expect(s.activeAthleteId).toBeNull();
    expect(s.sections).toEqual(['training']);
  });

  it('больше 20 атлетов в файле — грузим только 20', () => {
    const athletes = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, name: `А${i}` }));
    const s = parseCoachState(JSON.stringify({ version: 1, enabled: true, athletes }));
    expect(s.athletes).toHaveLength(COACH_MAX_ATHLETES);
  });

  it('read/write через хранилище; недоступное хранилище не роняет', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
    };
    const s = withAthlete('Иван', 'a1');
    writeCoachState(storage, s);
    expect(readCoachState(storage).athletes[0].name).toBe('Иван');
    expect(readCoachState(null).athletes).toEqual([]);
    const throwing = { getItem: () => { throw new Error('boom'); }, setItem: () => { throw new Error('quota'); } };
    expect(readCoachState(throwing).athletes).toEqual([]);
    expect(() => writeCoachState(throwing, s)).not.toThrow();
  });
});

describe('подписи', () => {
  it('summary объясняет состояние, а не «магия»', () => {
    expect(coachSummary(emptyCoachState())).toMatch(/Выключен/);
    let s = setCoachEnabled(emptyCoachState(), true);
    s = addCoachAthlete(s, { name: 'Иван' }, { id: 'a1', now: NOW }).state;
    expect(coachSummary(s)).toContain('1/20');
    expect(coachSummary(s)).toContain('активный: Иван');
  });
});
