import { describe, it, expect } from 'vitest';
import { loadedHingeVerdict, HINGE_LOAD_NOTE } from '../bb-hinge-screen.engine';
import { erIrVerdict, ERIR_DISCLAIMER, ERIR_RATIO_MIN } from '../bb-shoulder-screen.engine';
import { assessBbTendonGuard } from '../bb-tendon-guard.engine';
import { resolveBbDiagIntakeExtras } from '../bb-diag-intake.engine';

describe('bb-movement R5 — нагруженный шарнир', () => {
  it('чисто на обоих — нейтраль держится', () => {
    const v = loadedHingeVerdict({ rdl: 'pass', floor: 'pass' });
    expect(v.degraded).toBe(false);
    expect(v.text).toMatch(/держится/);
  });
  it('RDL чисто, пол плывёт — замена без деградации (честно)', () => {
    const v = loadedHingeVerdict({ rdl: 'pass', floor: 'fail' });
    expect(v.degraded).toBe(false);
    expect(v.text).toMatch(/трап-гриф/);
  });
  it('под весом поясница уходит — degraded + снизь вес', () => {
    const v = loadedHingeVerdict({ rdl: 'fail', floor: null });
    expect(v.degraded).toBe(true);
    expect(v.text).toMatch(/снизь вес/);
  });
  it('пусто — тихо, не падает', () => {
    const v = loadedHingeVerdict({ rdl: null, floor: null });
    expect(v.degraded).toBe(false);
    expect(v.text).toMatch(/не проверялся/);
  });
  it('нота честная: флексия >90% 3ПМ + трап-гриф', () => {
    expect(HINGE_LOAD_NOTE).toMatch(/90% ?3ПМ|90% 3ПМ/);
    expect(HINGE_LOAD_NOTE).toMatch(/трап-гриф/);
  });
});

describe('bb-movement R6 — ER/IR-ratio', () => {
  it('0.63 < 0.75 — warn + ротация, жимы не убирать', () => {
    const v = erIrVerdict({ erKg: 10, irKg: 16 });
    expect(v.ratio).toBe(0.63);
    expect(v.warn).toBe(true);
    expect(v.text).toMatch(/наружную ротацию/);
    expect(v.text).toMatch(/жимы не убирай/);
  });
  it('0.85 — норма', () => {
    const v = erIrVerdict({ erKg: 17, irKg: 20 });
    expect(v.warn).toBe(false);
    expect(v.text).toMatch(/норма/);
  });
  it('>1.15 — warn «проверь замер»', () => {
    const v = erIrVerdict({ erKg: 25, irKg: 20 });
    expect(v.warn).toBe(true);
    expect(v.text).toMatch(/нетипично/);
  });
  it('не замерялся — tested false', () => {
    expect(erIrVerdict({ erKg: null, irKg: null }).tested).toBe(false);
  });
  it('граница 0.75 — не warn', () => {
    expect(erIrVerdict({ erKg: 12, irKg: 16 }).warn).toBe(false);
    expect(ERIR_RATIO_MIN).toBe(0.75);
  });
  it('дисклеймер: экстраполяция + надёжность замера', () => {
    expect(ERIR_DISCLAIMER).toMatch(/Экстраполяция|extrapol/i);
    expect(ERIR_DISCLAIMER).toMatch(/ICC/);
  });
});

describe('bb-movement R2 — тендон-связка PMM', () => {
  const sess = (name: string, sets: number) => [{ exercises: [{ exerciseName: name, sets: Array.from({ length: sets }, () => ({ weightKg: 60, reps: 8 })) }] }];
  it('painRedJoint=elbow → локоть стоп независимо от объёма', () => {
    const g = assessBbTendonGuard(sess('Тяга штанги', 2), { painRedJoint: 'elbow' });
    expect(g.elbow.level).toBe('stop');
    expect(g.elbow.text).toMatch(/боль-мониторинг красный/);
    expect(g.shoulder.level).toBe('ok'); // другой сустав не тронут
  });
  it('painRedJoint=null — старые пороги целы (2 сета → ok)', () => {
    const g = assessBbTendonGuard(sess('Тяга штанги', 2), {});
    expect(g.elbow.level).toBe('ok');
    expect(g.elbow.text).not.toMatch(/боль-мониторинг/);
  });
});

describe('bb-movement R8 — intake новых полей', () => {
  it('заполненное едет в bits + persist, каждый ключ', () => {
    const r = resolveBbDiagIntakeExtras({
      bench: { level: 'fix', text: 'Жим: хват 1.8 BAW — сузь до 1.2–1.5' },
      painMon: 'Боль [Локоть]: красный — 7/10 днём, 4/10 утром (порог ≤5/<5)',
      posterior: { nhe: 'NHE: 3 повтора — слабо', adductor: 'Аддукторы: асимметрия 20% (≥15)' },
      loadedHinge: { text: 'Нагруженный наклон: под весом поясница уходит' },
      erir: { text: 'ER/IR 0.62 (<0.75): добавь наружную ротацию' },
      screenPriority: ['1. Боль (красный): разгрузка', '2. Голеностоп: мобилизация'],
    } as any);
    expect(r.bits.some((b) => /^жим:/.test(b))).toBe(true);
    expect(r.bits.some((b) => /Боль \[Локоть\]/.test(b))).toBe(true);
    expect(r.bits.some((b) => /^задняя цепь:/.test(b))).toBe(true);
    expect(r.bits.some((b) => /^шарнир-нагрузка:/.test(b))).toBe(true);
    expect(r.bits.some((b) => /^ER\/IR:/.test(b))).toBe(true);
    expect(r.bits.some((b) => /^приоритет:/.test(b))).toBe(true);
    expect(r.persist.movementExtra?.bench).toMatch(/BAW/);
    expect(r.persist.movementExtra?.painMonitor).toMatch(/красный/);
    expect(r.persist.movementExtra?.posterior).toMatch(/NHE/);
    expect(r.persist.movementExtra?.loadedHinge).toMatch(/поясница/);
    expect(r.persist.movementExtra?.erir).toMatch(/ER\/IR/);
    expect(r.persist.movementExtra?.screenPriority).toMatch(/приоритет|Боль/);
  });
  it('«не проверялся/не замерялся/не заполнен» и пустой приоритет — тихо', () => {
    const r = resolveBbDiagIntakeExtras({
      bench: { level: 'not_tested', text: 'Жим: не проверялся' },
      painMon: 'Боль-мониторинг: не заполнен',
      posterior: { nhe: 'NHE-готовность: не замерялась', adductor: 'Аддукторы: не замерялись' },
      loadedHinge: { text: 'Нагруженный наклон: не проверялся' },
      erir: { text: 'ER/IR: не замерялся' },
      screenPriority: ['Приоритетов нет: паттерн чистый — поддерживающий объём и перепроверка 6–8 нед'],
    } as any);
    expect(r.bits).toEqual([]);
    expect(r.persist.movementExtra).toBeUndefined();
  });
  it('мусор вместо объектов — тихо, не падает', () => {
    const r = resolveBbDiagIntakeExtras({
      bench: 'мусор', painMon: 123, posterior: [], loadedHinge: 1, erir: null, screenPriority: 'мусор',
    } as any);
    expect(r.bits).toEqual([]);
  });
  it('vbtLossPct-инвариант: прежние поля (драйвер/плечо) не сломаны', () => {
    const r = resolveBbDiagIntakeExtras({
      movementDriver: { driver: 'ankle', label: 'Голеностоп', fix: 'пятка', confidence: 0.7 },
      shoulder: { pass: false, locus: 'thoracic', text: 'Плечо у стены: ribs → экстензия' },
    } as any);
    expect(r.bits.some((b) => /Голеностоп/.test(b))).toBe(true);
    expect(r.persist.movementDriver?.driver).toBe('ankle');
  });
});
