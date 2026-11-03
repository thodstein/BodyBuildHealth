import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildNextActions,
  BB_DIAG_DEEP_LINKS,
  BB_DIAG_DEEP_LINK_TARGETS,
  type NextActionsInput,
} from '../bb-diag-next-actions.engine';

/** Полный «здоровый» вход: данных хватает, ограничителей нет. */
const healthy: NextActionsInput = {
  score: { score: 82, level: 'ok', verification: 1, verificationMissing: [] },
  redFlags: { active: false, blocked: false },
  volume: { limiter: null, hasVolume: true, hasAcwr: true, hasMobility: true, rows: [] },
  weakZones: [],
  weakCauses: {},
  planPresent: true,
  diaryCount: 12,
  measuresCount: 5,
  screenTouched: true,
  effect: { status: 'no_injection', text: '' },
};

const screenIds = (input: NextActionsInput): string[] =>
  buildNextActions(input).actions.filter((a) => a.target?.type === 'screen').map((a) => a.target!.id);

describe('BB-G-08 · «что делать дальше»', () => {
  it('пустой хаб: первое действие — добрать данные, второе — собрать план', () => {
    const r = buildNextActions({ score: { score: 0, verification: 0, verificationMissing: ['diary', 'circumf', 'vbt'] }, planPresent: false });
    expect(r.actions.map((a) => a.id)).toEqual(['data', 'plan']);
    expect(r.actions[0].zone).toBe('nodata');
    // Нет ни «снять подходы», ни «держать MAV» — советовать нечего.
    expect(r.considered).not.toContain('mrv');
    expect(r.considered).not.toContain('maintain');
    expect(r.note).toBeNull();
    // Текст «пусто» честный, без выдуманных чисел.
    expect(r.actions[0].title).toMatch(/Добрать данные/);
    expect(r.actions[0].why).toMatch(/без измерений/);
  });

  it('действий не больше двух, порядок = «с чего начинать»', () => {
    const r = buildNextActions({
      score: { verification: 0.4, verificationMissing: ['vbt'] },
      redFlags: { active: true, blocked: true, text: 'Боль 8/10 при жиме' },
      volume: {
        limiter: { id: 'pain', label: 'Боль 8/10', zone: 'red', detail: 'Острая боль — стоп-флаги' },
        rows: [{ label: 'Грудь', over: 4, sets: 26, mrv: 22 }],
        hasVolume: true,
      },
      planPresent: true,
      diaryCount: 8,
      measuresCount: 4,
      screenTouched: true,
    });
    expect(r.actions.map((a) => a.id)).toEqual(['red-flag', 'mrv']);
    expect(r.actions[0].zone).toBe('red');
    // Одно и то же место (Ортопедия) дважды не предлагается — боль уходит в «considered»,
    // но вторым шагом становится объём, а не дубль ссылки.
    expect(r.considered).toContain('pain');
    expect(screenIds({
      score: { verification: 0.4 },
      redFlags: { active: true, blocked: true, text: 'Боль 8/10' },
      volume: { limiter: { id: 'pain', label: 'Боль 8/10', zone: 'red', detail: 'стоп' }, rows: [{ label: 'Грудь', over: 4, sets: 26, mrv: 22 }], hasVolume: true },
      diaryCount: 8, measuresCount: 4, screenTouched: true, planPresent: true,
    })).toEqual(['joints_ortho', 'volume_hub']);
  });

  it('превышение MRV: число подходов и факт берутся из данных', () => {
    const r = buildNextActions({
      ...healthy,
      volume: { limiter: { id: 'mrv', label: 'Спина 26/22', zone: 'yellow', detail: 'выше MRV' }, hasVolume: true, rows: [{ group: 'back', label: 'Спина', over: 4, sets: 26, mrv: 22 }] },
    });
    const mrv = r.actions.find((a) => a.id === 'mrv')!;
    expect(mrv.title).toBe('Снять 4 подх. с Спина');
    expect(mrv.why).toContain('26');
    expect(mrv.why).toContain('22');
    expect(mrv.target).toEqual({ type: 'screen', id: 'volume_hub', label: 'Объём-хаб' });
  });

  it('нет превышения MRV — нет совета «снять подходы» (только из данных)', () => {
    const r = buildNextActions({
      ...healthy,
      volume: { limiter: null, hasVolume: true, rows: [{ label: 'Спина', over: 0, sets: 12, mrv: 22 }] },
    });
    expect(r.considered).not.toContain('mrv');
    expect(r.actions[0].id).toBe('maintain');
    expect(r.actions[0].zone).toBe('green');
  });

  it('сон как ограничитель: шаг ведёт в дневник, а не в объём', () => {
    const r = buildNextActions({
      ...healthy,
      volume: { limiter: { id: 'sleep', label: 'Сон 5.5 ч', zone: 'yellow', detail: 'Сон <7 ч — приоритеты на MAV' }, hasVolume: true },
    });
    expect(r.actions[0].id).toBe('sleep');
    expect(r.actions[0].why).toBe('Сон <7 ч — приоритеты на MAV');
    expect(r.actions[0].target).toEqual({ type: 'screen', id: 'diary', label: 'Дневник · сон' });
  });

  it('пробелы в данных ведут туда, где их закрывают: скрининг → дневник → замеры', () => {
    const base: NextActionsInput = { score: { verification: 0.3, verificationMissing: ['vbt'] }, planPresent: true, screenTouched: false, diaryCount: 0, measuresCount: 0 };
    expect(buildNextActions(base).actions[0].target).toEqual({ type: 'tab', id: 'screening', label: 'Скрининг' });
    expect(buildNextActions({ ...base, screenTouched: true }).actions[0].target).toEqual({ type: 'screen', id: 'diary', label: 'Дневник' });
    expect(buildNextActions({
      ...base, screenTouched: true, diaryCount: 6, score: { verification: 0.35, verificationMissing: ['circumf'] },
    }).actions[0].target).toEqual({ type: 'tab', id: 'symmetry', label: 'Симметрия · замеры' });
  });

  it('причина отставания: берётся самая уверенная и её фикс', () => {
    const r = buildNextActions({
      ...healthy,
      weakCauses: {
        chest_upper: { cause: 'volume', confidence: 0.4, fix: 'добавить 2 подхода' },
        back_width: { cause: 'recovery', confidence: 0.8, fix: 'разгрузить тягу' },
      },
    });
    const a = r.actions.find((x) => x.id === 'weak-cause')!;
    expect(a.title).toContain('back_width');
    expect(a.title).toContain('восстановление');
    expect(a.why).toContain('80%');
    expect(a.why).toContain('разгрузить тягу');
    expect(a.target).toEqual({ type: 'tab', id: 'weak', label: 'Слабые зоны' });
  });

  it('эффект вставки ещё не срок — задача «вернуться», а не вывод', () => {
    const r = buildNextActions({
      ...healthy,
      effect: { status: 'too_early', text: 'До окна оценки 2 нед — перепроверить 2026-11-20' },
    });
    const a = r.actions.find((x) => x.id === 'effect')!;
    expect(a.why).toContain('2026-11-20');
    expect(a.title).toMatch(/Вернуться/);
  });

  it('два шага не ведут в одно место, даже если это вкладка хаба', () => {
    const r = buildNextActions({
      ...healthy,
      volume: { limiter: { id: 'readiness', label: 'Готовность красная', zone: 'red', detail: 'сон 5 ч' }, hasVolume: true },
      effect: { status: 'too_early', text: 'рано — перепроверить' },
      maxActions: 3,
    });
    // «Готовность» и «эффект» оба ведут в таб «Объём · Recovery» — остаётся первый.
    expect(r.considered).toContain('effect');
    expect(r.actions.filter((a) => a.target?.id === 'volume')).toHaveLength(1);
    expect(r.actions[0].id).toBe('readiness');
  });

  it('без плана появляется шаг «собрать план» без deep-link (это кнопка хаба)', () => {
    const r = buildNextActions({ ...healthy, planPresent: false });
    const a = r.actions.find((x) => x.id === 'plan')!;
    expect(a.target).toBeNull();
    expect(a.why).toMatch(/Без плана/);
  });

  it('maxActions ограничивает длину, порядок детерминирован', () => {
    const input: NextActionsInput = {
      score: { verification: 0.4, verificationMissing: ['vbt'] },
      volume: { limiter: { id: 'acwr', label: 'ACWR x1.9', zone: 'red', detail: 'скачок' }, hasVolume: true, rows: [{ label: 'Ноги', over: 2, sets: 24, mrv: 22 }] },
      weakCauses: { quads: { cause: 'volume', confidence: 0.6, fix: 'добрать 3 подхода' } },
      planPresent: false, diaryCount: 9, measuresCount: 4, screenTouched: true,
    };
    const a = buildNextActions({ ...input, maxActions: 1 });
    const b = buildNextActions({ ...input, maxActions: 1 });
    expect(a).toEqual(b);
    expect(a.actions).toHaveLength(1);
    expect(a.actions[0].id).toBe('mrv');
    // Полный порядок кандидатов фиксирован: mrv → acwr → причина → план.
    expect(buildNextActions(input).considered.slice(0, 4)).toEqual(['mrv', 'acwr', 'weak-cause', 'plan']);
  });

  it('недостающий только VBT/LVP — не «действие»: цифры есть, уверенность ниже', () => {
    const r = buildNextActions({
      ...healthy,
      score: { score: 78, level: 'warn', verification: 0.65, verificationMissing: ['vbt'] },
    });
    expect(r.considered).not.toContain('data');
    expect(r.actions[0].id).toBe('maintain');
    expect(r.actions[0].why).toContain('65%');
  });

  it('нитка «нет данных»: ни одного действия без данных, note объясняет почему', () => {
    const r = buildNextActions({
      score: { verification: 0, verificationMissing: [] },
      planPresent: true, diaryCount: 5, measuresCount: 4, screenTouched: true,
    });
    expect(r.actions).toHaveLength(0);
    expect(r.note).toMatch(/Данных нет/);
  });

  it('deep-link только из белого списка TrainingScreen (BB-G-02)', () => {
    const all = buildNextActions({
      score: { verification: 0.4, verificationMissing: ['vbt'] },
      redFlags: { active: true, blocked: true, text: 'флаг' },
      volume: { limiter: { id: 'pain', label: 'Боль 5/10', zone: 'yellow', detail: 'боль' }, hasVolume: true, rows: [{ label: 'Ноги', over: 3, sets: 25, mrv: 22 }] },
      weakCauses: { quads: { cause: 'volume', confidence: 0.6, fix: 'добрать' } },
      planPresent: false, diaryCount: 2, measuresCount: 1, screenTouched: false,
      effect: { status: 'too_early', text: 'рано' },
      maxActions: 3,
    });
    for (const a of all.actions) {
      if (a.target?.type !== 'screen') continue;
      expect(BB_DIAG_DEEP_LINKS.has(a.target.id)).toBe(true);
    }
    // Источник правды — движок: TrainingScreen импортирует белый список, а не дублирует.
    const src = readFileSync(join(process.cwd(), 'src/ui/screens/TrainingScreen.tsx'), 'utf8');
    expect(src).toMatch(/from '\.\.\/\.\.\/engines\/bb\/bb-diag-next-actions\.engine'/);
    expect(src).toMatch(/BB_DIAG_DEEP_LINKS/);
    expect(src).not.toMatch(/const BB_DIAG_DEEP_LINKS: ReadonlySet<string> = new Set\(\[/);
    expect([...BB_DIAG_DEEP_LINK_TARGETS]).toEqual(['volume_hub', 'joints_ortho', 'calc_vbt', 'diary', 'progress', 'strength_analysis']);
  });

  it('порядок и состав действий детерминированы (без дат и случайностей)', () => {
    const input: NextActionsInput = {
      ...healthy,
      volume: { limiter: null, hasVolume: true, rows: [{ label: 'Спина', over: 4, sets: 26, mrv: 22 }] },
      diaryCount: 6,
      measuresCount: 3,
    };
    const a = buildNextActions(input);
    const b = buildNextActions({ ...input });
    expect(a).toEqual(b);
    const text = a.actions.map((x) => `${x.title} ${x.why}`).join(' ');
    expect(/\d{4}-\d{2}-\d{2}/.test(text)).toBe(false);
  });
});
