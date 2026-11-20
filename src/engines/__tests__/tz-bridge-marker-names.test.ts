/**
 * tz-bridge-marker-names.test.ts — проход 181: второй механизм одного анализа.
 *
 * Класс дефекта: `MARKER_TO_TZ_MECH` умеет несколько механизмов на анализ, но
 * второе направление было записано выдуманным именем (`POTASSIUM_HIGH`,
 * `INSULIN_FAST`, `GLUCOSE_FAST`, `PROLAC_REP`). В лабораторных данных таких имён
 * нет — приходит код склада, поэтому вторая строка не срабатывала никогда:
 * калий 6.0 не активировал электролитный механизм, инсулин 40 — инсулино-
 * резистентность, пролактин 40 — подавление HPG-оси, гипогликемия — только ЦНС.
 *
 * Вторая половина — имена анализа. Форма отдаёт `PLATELETS`, `TROPONIN_I`,
 * `NT-PROBNP`, а строки назывались `PLT`, `TROPONIN`, `NTproBNP`.
 *
 * Гард меряет поведением: активируется ли нужный механизм, одна ли находка на
 * один анализ, и остались ли блокеры без выдуманного моста.
 */
import { describe, expect, it } from 'vitest';
import {
  MARKER_SECOND_NAME,
  MARKER_TO_TZ_MECH,
  getActivatedTzMechs,
  normalizeMarker,
} from '../tz-bridge-marker';

const rows = new Set(MARKER_TO_TZ_MECH.map((r) => r.marker));
const mechsOf = (labs: Record<string, number>) =>
  getActivatedTzMechs(labs).map((m) => m.mechId).sort();

describe('проход 181: имена строк механизмов', () => {
  it('таблица вторых имён ссылается только на существующие строки', () => {
    for (const [marker, extra] of Object.entries(MARKER_SECOND_NAME)) {
      expect(normalizeMarker(marker), `ключ ${marker}`).toBe(marker);
      expect(extra.length).toBeGreaterThan(0);
      for (const name of extra) {
        expect(rows.has(name), `нет строки ${name} (для ${marker})`).toBe(true);
        expect(name).not.toBe(marker);
        // Выдуманное имя не должно само прийти из данных: его находит только таблица.
        expect(normalizeMarker(name), `${name} не псевдоним`).toBe(name);
      }
    }
  });

  it('второе имя не делит псевдоним с другим анализом', () => {
    // Все имена строк, кроме своих, не должны быть целями `MARKER_ALIASES`:
    // иначе один код склада открывал бы чужую строку.
    for (const extra of Object.values(MARKER_SECOND_NAME)) {
      for (const name of extra) {
        expect(normalizeMarker(name)).toBe(name);
      }
    }
  });
});

describe('проход 181: калий, глюкоза, инсулин, пролактин, кортизол, HOMA', () => {
  it('калий высокий и низкий — электролитный механизм', () => {
    expect(mechsOf({ POTASSIUM: 6.0 })).toContain('hem4');
    expect(mechsOf({ POTASSIUM: 3.0 })).toContain('hem4');
    // Норма не активирует.
    expect(mechsOf({ POTASSIUM: 4.2 })).toEqual([]);
  });

  it('глюкоза: гипогликемия — ЦНС и гематология, гипергликемия — инсулинорезистентность', () => {
    expect(mechsOf({ GLUCOSE: 2.5 })).toEqual(['cns5', 'hem3']);
    expect(mechsOf({ GLUCOSE: 8.0 })).toEqual(['hem2']);
  });

  it('инсулин высокий — ЦНС и инсулинорезистентность', () => {
    expect(mechsOf({ INSULIN: 40 })).toEqual(['cns5', 'hem2']);
  });

  it('пролактин высокий — ЦНС и HPG-ось', () => {
    expect(mechsOf({ PROLACTIN: 40 })).toEqual(['cns1', 'rep1']);
  });

  it('кортизол высокий — ЦНС и метаболизм', () => {
    expect(mechsOf({ CORTISOL: 900 })).toEqual(['cns4', 'hem2']);
  });

  it('HOMA-IR под обоими кодами склада', () => {
    for (const code of ['HOMA_IR', 'HOMA', 'HOMAIR']) {
      expect(mechsOf({ [code]: 5 }), code).toEqual(['cns5', 'hem2']);
    }
  });

  it('магний и кальций — почечный и электролитный механизм, без дубля находки', () => {
    const mg = getActivatedTzMechs({ MG: 0.5 });
    expect(mg.map((m) => m.mechId).sort()).toEqual(['hem4', 'ren4']);
    expect(mg.find((m) => m.mechId === 'hem4')!.markers).toHaveLength(1);
    expect(mg.find((m) => m.mechId === 'ren4')!.markers).toHaveLength(1);

    const ca = getActivatedTzMechs({ CA: 3.0 });
    expect(ca.map((m) => m.mechId).sort()).toEqual(['hem4', 'ren4']);
  });

  it('натрий высокий активирует почечный механизм', () => {
    expect(mechsOf({ SODIUM: 155 })).toEqual(['ren4']);
    expect(mechsOf({ SODIUM: 130 })).toEqual(['hem5']);
  });
});

describe('проход 181: канон формы находит строку', () => {
  it('тромбоциты, тропонин I, NT-proBNP', () => {
    expect(mechsOf({ PLATELETS: 700 })).toEqual(['hem1']);
    expect(mechsOf({ PLT: 700 })).toEqual(['hem1']);
    expect(mechsOf({ TROPONIN_I: 0.5 })).toEqual(['cv4']);
    expect(mechsOf({ TROPONIN: 0.5 })).toEqual(['cv4']);
    expect(mechsOf({ 'NT-PROBNP': 1000 })).toEqual(['cv1']);
    expect(mechsOf({ NT_PROBNP: 1000 })).toEqual(['cv1']);
  });
});

describe('проход 181: блокеры остаются блокерами', () => {
  it('без выдуманного моста: разные анализы и отсутствующие механизмы', () => {
    // Тропонин T — другой анализ (в модели читается тропонин I, причина прохода 140).
    expect(getActivatedTzMechs({ TROPONIN_T: 5 })).toEqual([]);
    // КФК-МВ: каталог в нг/мл, форма в Е/л — величины разные (проход 178/180).
    expect(getActivatedTzMechs({ CK_MB: 50 })).toEqual([]);
    // АТ-ТГ не подменяет АТ-ТПО, лейкоциты/фолат не имеют механизма в модели.
    expect(getActivatedTzMechs({ ANTI_TG: 200 })).toEqual([]);
    expect(getActivatedTzMechs({ WBC: 20 })).toEqual([]);
    expect(getActivatedTzMechs({ FOLATE: 1 })).toEqual([]);
  });
});
