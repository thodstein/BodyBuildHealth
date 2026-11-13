/**
 * Женские пороги notification-engine.
 *
 * Зачем: мужские правила давали ложные алерты у женщин 2–3 раза в неделю —
 * E2 <15 (норма ранней фолликулярной фазы) и E2 >80 (норма цикла) — и советовали
 * «увеличить АИ» / пугали гинекомастией. Здесь фиксируем:
 *  - HCT: ♀ 48 = эритроцитоз, 52 = ургент (норма 36–48);
 *  - АЛТ: ♀ порог 2.5×ULN 31 = 78 (у ♂ 2.5×40 = 100);
 *  - E2: ♀ алерты только на фоне ИА (краш) или выше типичного овуляторного пика;
 *  - без `sex` — прежний мужской путь (обратная совместимость).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { checkNotifications, markNotificationShown, type NotificationState } from '../notification-engine';

const state = (over: Partial<NotificationState> = {}): NotificationState => ({
  labs: {},
  pharma: { phase: 'course' },
  goals: {},
  ...over,
});

const ids = (s: NotificationState): string[] => checkNotifications(s).map((r) => r.id);

beforeEach(() => {
  localStorage.clear();
});

describe('notification-engine: гематокрит', () => {
  it('♂ и без sex: 51 — эритроцитоз (warning), 54 — флеботомия (critical)', () => {
    const run = (hct: number, sex?: 'male' | 'female') =>
      checkNotifications(state({ labs: { hct }, ...(sex ? { sex } : {}) }));
    expect(run(50).map(r => r.id)).not.toContain('hct_high');
    const warn = run(51);
    expect(warn.map(r => r.id)).toContain('hct_high');
    // Проход 43: предупреждение не должно грозить флеботомией — она с 54.
    expect(warn.find(r => r.id === 'hct_high')!.message).toMatch(/эритроцитоз/i);
    expect(warn.find(r => r.id === 'hct_high')!.message).not.toMatch(/Флеботомия 300/);
    const crit = run(54);
    expect(crit.map(r => r.id)).toContain('hct_critical');
    expect(crit.map(r => r.id)).not.toContain('hct_high');
    expect(crit.find(r => r.id === 'hct_critical')!.message).toMatch(/флеботомия 300-450/i);
  });

  it('♀: 48 — предупреждение, 52 — ургент, мужское правило не дублируется', () => {
    const warn = ids(state({ labs: { hct: 48 }, sex: 'female' }));
    expect(warn).toContain('hct_high_female');
    expect(warn).not.toContain('hct_high');

    const crit = ids(state({ labs: { hct: 52 }, sex: 'female' }));
    expect(crit).toContain('hct_critical_female');
    expect(crit).not.toContain('hct_high_female');
    expect(crit).not.toContain('hct_high');
  });
});

describe('notification-engine: эстрадиол', () => {
  it('♂ напоминание о E2 не занижает порог краша: <15 (как в e2_crash), не <20', () => {
    const rules = checkNotifications(state({ labs: { e2: 90 }, pharma: { phase: 'course', hasAI: true } }));
    const mon = rules.find((r) => r.id === 'e2_monitor');
    expect(mon).toBeTruthy();
    expect(mon!.message).toContain('<15');
    expect(mon!.message).not.toContain('<20');
  });
  it('♀ E2 120 — физиология цикла, «высокий E2» не срабатывает (у ♂ срабатывает)', () => {
    expect(ids(state({ labs: { e2: 120 }, sex: 'female' }))).not.toContain('e2_high');
    expect(ids(state({ labs: { e2: 120 }, sex: 'male' }))).toContain('e2_high');
  });

  it('♀ E2 450 — выше овуляторного пика → женское предупреждение', () => {
    expect(ids(state({ labs: { e2: 450 }, sex: 'female' }))).toContain('e2_high_female');
  });

  it('♀ E2 10 без ИА — не краш (фолликулярная фаза); на ИА — краш', () => {
    expect(ids(state({ labs: { e2: 10 }, sex: 'female' }))).not.toContain('e2_crash_female');

    const onAI = ids(state({ labs: { e2: 10 }, sex: 'female', pharma: { phase: 'course', hasAI: true } }));
    expect(onAI).toContain('e2_crash_female');
    expect(onAI).not.toContain('e2_crash');
  });

  it('♂ E2 10 — прежний краш-алерт', () => {
    expect(ids(state({ labs: { e2: 10 }, sex: 'male' }))).toContain('e2_crash');
  });

  it('♀ мониторинг E2 — только на ИА (иначе цикл сам меняет E2)', () => {
    expect(ids(state({ sex: 'female' }))).not.toContain('e2_monitor_female');
    expect(ids(state({ sex: 'female', pharma: { phase: 'course', hasAI: true } }))).toContain('e2_monitor_female');
  });
});

describe('notification-engine: АЛТ', () => {
  it('♀ порог 78 (2.5×ULN 31), ♂ порог 100 (2.5×ULN 40)', () => {
    expect(ids(state({ labs: { alt: 85 }, sex: 'female' }))).toContain('alt_critical_female');
    expect(ids(state({ labs: { alt: 85 }, sex: 'male' }))).not.toContain('alt_critical');
    expect(ids(state({ labs: { alt: 120 }, sex: 'male' }))).toContain('alt_critical');
  });

  it('♀ 85 не поднимает мужское правило', () => {
    const out = ids(state({ labs: { alt: 85 }, sex: 'female' }));
    expect(out).not.toContain('alt_critical');
  });
});

describe('notification-engine: неизменные пороги', () => {
  it('пролактин: верх ~25 нг/мл для обоих полов', () => {
    expect(ids(state({ labs: { prl: 27 }, sex: 'female' }))).toContain('prl_high');
    expect(ids(state({ labs: { prl: 27 }, sex: 'male' }))).toContain('prl_high');
  });

  it('без sex — мужской путь (обратная совместимость)', () => {
    const out = ids(state({ labs: { hct: 52, e2: 10, alt: 120 } }));
    expect(out).toContain('hct_high');
    expect(out).toContain('e2_crash');
    expect(out).toContain('alt_critical');
  });

  it('markNotificationShown стартует cooldown (баннер не мигает на каждом рендере)', () => {
    const s = state({ labs: { hct: 52 }, sex: 'female' });
    expect(ids(s)).toContain('hct_critical_female');

    markNotificationShown('hct_critical_female');
    expect(ids(s)).not.toContain('hct_critical_female');
    // остальные правила не затронуты
    expect(ids(state({ labs: { hct: 52 }, sex: 'male' }))).toContain('hct_high');
  });
});
