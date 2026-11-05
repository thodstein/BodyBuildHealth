/**
 * coach-mode.test.ts — режим тренера: карточки атлетов и разделы.
 *
 * Проверяем продуктовые обещания, а не «геттеры»:
 *  • количество атлетов не ограничено (парсер защищён от испорченного файла);
 *  • включение режима с пустым выбором разделов не оставляет тренера с пустым экраном;
 *  • активный атлет не может «повиснуть» после удаления;
 *  • битый/чужой JSON не роняет профиль, мусорные атлеты не загружаются;
 *  • числа (возраст/вес/рост) фильтруются от опечаток, но это не нормативы.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_STORED_ATHLETES,
  COACH_SECTIONS,
  addCoachAthlete,
  allCoachSections,
  coachActiveAthlete,
  coachStatusCounts,
  coachSummary,
  emptyCoachState,
  parseCoachState,
  readCoachState,
  removeCoachAthlete,
  serializeCoachState,
  setActiveCoachAthlete,
  setCoachAthleteStatus,
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

  it('количество атлетов не ограничено: 40-й добавляется', () => {
    let s = emptyCoachState();
    for (let i = 1; i <= 40; i++) {
      s = addCoachAthlete(s, { name: `Атлет ${i}` }, { id: `a${i}`, now: NOW }).state;
    }
    expect(s.athletes).toHaveLength(40);
    const r = addCoachAthlete(s, { name: 'Сорок первый' }, { id: 'a41', now: NOW });
    expect(r.error).toBeNull();
    expect(r.athlete?.name).toBe('Сорок первый');
    expect(r.state.athletes).toHaveLength(41);
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

  it('испорченный файл с тысячами атлетов не роняет парсер и не теряет всех', () => {
    const athletes = Array.from({ length: MAX_STORED_ATHLETES + 50 }, (_, i) => ({ id: `a${i}`, name: `А${i}` }));
    const s = parseCoachState(JSON.stringify({ version: 1, enabled: true, athletes }));
    expect(s.athletes).toHaveLength(MAX_STORED_ATHLETES);
    expect(s.athletes[0].name).toBe('А0');
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
    expect(coachSummary(s)).toContain('Атлетов: 1');
    expect(coachSummary(s)).toContain('активный: Иван');
  });
});

describe('карточка v2: статус, группа, метки, контакт, дата старта', () => {
  it('новая карточка: активна, дата старта = день создания, остальное пусто', () => {
    const a = withAthlete('Иван', 'a1').athletes[0];
    expect(a.status).toBe('active');
    expect(a.startedAt).toBe('2026-11-04');
    expect(a.group).toBe('');
    expect(a.tags).toEqual([]);
    expect(a.contact).toBe('');
  });

  it('старая карточка без полей v2 мигрирует без потери данных', () => {
    const legacy = JSON.stringify({
      version: 1,
      enabled: true,
      sections: ['training'],
      activeAthleteId: 'a1',
      athletes: [
        {
          id: 'a1',
          name: 'Иван',
          sex: 'male',
          age: 30,
          weightKg: 82,
          heightCm: 180,
          direction: 'ПЛ',
          goal: '200',
          sections: ['training'],
          note: 'спина',
          createdAt: '2026-01-15T09:00:00.000Z',
          updatedAt: '2026-01-15T09:00:00.000Z',
        },
      ],
    });
    const a = parseCoachState(legacy).athletes[0];
    expect(a.name).toBe('Иван');
    expect(a.status).toBe('active');
    // Дата старта — день создания старой карточки, а не «сегодня».
    expect(a.startedAt).toBe('2026-01-15');
    expect(a.group).toBe('');
    expect(a.tags).toEqual([]);
  });

  it('патч сохраняет статус, группу, метки, контакт и дату', () => {
    const s = updateCoachAthlete(
      withAthlete('Иван', 'a1'),
      'a1',
      {
        status: 'paused',
        group: 'Вечерняя',
        tags: 'сила, спина, Сила',
        contact: '+7 900 000-00-00',
        startedAt: '2026-09-01',
      },
      { now: NOW },
    );
    const a = s.athletes[0];
    expect(a.status).toBe('paused');
    expect(a.group).toBe('Вечерняя');
    // Регистр не создаёт дубль: «Сила» и «сила» — одна метка.
    expect(a.tags).toEqual(['сила', 'спина']);
    expect(a.contact).toBe('+7 900 000-00-00');
    expect(a.startedAt).toBe('2026-09-01');
  });

  it('метки ограничены восемью и не растут от повторов', () => {
    const s = updateCoachAthlete(
      withAthlete('Иван', 'a1'),
      'a1',
      { tags: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
      { now: NOW },
    );
    expect(s.athletes[0].tags).toHaveLength(8);
  });

  it('неизвестный статус из чужой версии → активен (не ломает список)', () => {
    const legacy = JSON.stringify({
      version: 1,
      enabled: true,
      sections: [],
      activeAthleteId: null,
      athletes: [{ id: 'a1', name: 'Иван', status: 'нечто', createdAt: NOW, updatedAt: NOW }],
    });
    expect(parseCoachState(legacy).athletes[0].status).toBe('active');
  });

  it('архив и возврат не теряют остальные поля карточки', () => {
    let s = updateCoachAthlete(withAthlete('Иван', 'a1'), 'a1', { group: 'Г1', goal: '200' }, { now: NOW });
    s = setCoachAthleteStatus(s, 'a1', 'archived', { now: NOW });
    expect(s.athletes[0].status).toBe('archived');
    expect(s.athletes[0].group).toBe('Г1');
    expect(s.athletes[0].goal).toBe('200');
    s = setCoachAthleteStatus(s, 'a1', 'active', { now: NOW });
    expect(s.athletes[0].status).toBe('active');
    expect(s.athletes[0].group).toBe('Г1');
  });

  it('счётчики статусов считают всех, включая архив', () => {
    let s = emptyCoachState();
    s = addCoachAthlete(s, { name: 'A' }, { id: 'a1', now: NOW }).state;
    s = addCoachAthlete(s, { name: 'B' }, { id: 'a2', now: NOW }).state;
    s = addCoachAthlete(s, { name: 'C' }, { id: 'a3', now: NOW }).state;
    s = setCoachAthleteStatus(s, 'a2', 'paused', { now: NOW });
    s = setCoachAthleteStatus(s, 'a3', 'archived', { now: NOW });
    expect(coachStatusCounts(s)).toEqual({ active: 1, paused: 1, archived: 1 });
  });

  it('статус переживает запись/чтение состояния', () => {
    const storage = new Map<string, string>();
    const fake = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => { storage.set(k, v); },
    };
    let s = withAthlete('Иван', 'a1');
    s = setCoachAthleteStatus(s, 'a1', 'archived', { now: NOW });
    s = updateCoachAthlete(s, 'a1', { tags: ['сила'], group: 'Г1' }, { now: NOW });
    writeCoachState(fake, s);
    const back = readCoachState(fake).athletes[0];
    expect(back.status).toBe('archived');
    expect(back.tags).toEqual(['сила']);
    expect(back.group).toBe('Г1');
  });
});
