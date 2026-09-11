/**
 * cardio-cycle-library.test.ts — библиотека именных кардио-циклов + новые движки.
 * P0: мета/построение всех шаблонов/селектор/мост/HIIT;
 * P1: валидатор/пик-блок/персональные зоны;
 * P2: кросс-мезо/рекорды/год-прогноз.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CARDIO_CYCLES, CARDIO_PRO_CYCLES, getCardioCycleTemplateById } from '../../../data/cardio-cycles/cardio-cycle-index';
import {
  buildCardioCycleFromTemplate, buildCardioCycleFromTemplateId,
} from '../cardio-templates.engine';
import { rankCardioCycles, pickCardioTemplate } from '../cardio-cycle-selector.engine';
import {
  requestCardioTemplateBuild, consumeCardioTemplatePending,
} from '../cardio-cycle-bridge';
import { CARDIO_INTERVAL_PRESETS, getCardioIntervalPreset } from '../cardio-interval-presets.engine';
import { validateCardioCycle } from '../cardio-plan-validate.engine';
import { peakBlockSpecFor, applyPeakBlockToInput } from '../cardio-peak-block.engine';
import { extractCardioProgression, cardioProgressionAdvice } from '../cardio-meso-progression.engine';
import {
  saveCardioRecord, loadCardioRecords, removeCardioRecord, bestCardioRecord,
  predictRunningTime, billatPaceFrom6Min, formatCardioTime,
} from '../cardio-records.engine';
import { forecastYearCtl } from '../cardio-year-forecast.engine';
import { applyPersonalTargetsToCycle, formatPace } from '../cardio-personal-zones.engine';
import type { CardioCycle } from '../cardio.engine';

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

describe('библиотека: мета', () => {
  it('шаблонов >= 25 (13 PRO готовых + база), id уникальны', () => {
    expect(CARDIO_CYCLES.length).toBeGreaterThanOrEqual(25);
    expect(CARDIO_PRO_CYCLES.length).toBe(13);
    const ids = CARDIO_CYCLES.map(c => c.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('все цели конструктора покрыты генератором', () => {
    const goals = new Set(CARDIO_CYCLES.map(c => c.meta.goal));
    for (const g of ['health', 'mass', 'cut', 'recomp', 'maintenance', 'recovery', 'bb_prep', 'pl_prep', 'bb_taper']) {
      expect(goals.has(g as never)).toBe(true);
    }
  });
  it('мета валидна: недели/уровни/оборудование/источник', () => {
    for (const t of CARDIO_CYCLES) {
      expect(t.meta.weeks).toBeGreaterThanOrEqual(4);
      expect(t.meta.level.length).toBeGreaterThan(0);
      expect(t.meta.equipment.length).toBeGreaterThan(0);
      expect(t.meta.sourceLabel.length).toBeGreaterThan(5);
      expect(t.meta.sessionsPerWeek).toBeGreaterThanOrEqual(2);
      if (t.meta.kind === 'explicit') {
        expect(t.weeks?.length).toBe(t.meta.weeks);
        for (const w of t.weeks!) {
          expect(w.sessions.length).toBeGreaterThan(0);
          for (const s of w.sessions) expect(s.durationMin).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('библиотека: построение всех шаблонов', () => {
  it('каждый шаблон собирается без бросков, недели/ккал > 0', () => {
    for (const t of CARDIO_CYCLES) {
      const c = buildCardioCycleFromTemplate(t, { bodyWeight: 80, age: 30 });
      expect(c.totalWeeks).toBe(t.meta.weeks);
      expect(c.weeks.length).toBe(t.meta.weeks);
      expect(c.totalKcal).toBeGreaterThan(0);
      for (const w of c.weeks) {
        expect(w.sessions.length).toBeGreaterThan(0);
        expect(w.totalMinutes).toBeGreaterThan(0);
      }
      expect(c.config).toBeDefined();
    }
  });
  it('неизвестный id → null (без fallback)', () => {
    expect(buildCardioCycleFromTemplateId('nope', {})).toBeNull();
    expect(getCardioCycleTemplateById('nope')).toBeUndefined();
  });
  it('C25K: 9 нед × 3 сессии, первая — бег/ходьба', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-c25k-9', {})!;
    expect(c.weeks.length).toBe(9);
    expect(c.weeks[0].sessions.length).toBe(3);
    expect(c.weeks[8].sessions.length).toBe(3);
  });
  it('Concept2 2K-12: 12 нед, есть HIIT-интервалы со structured', () => {
    const c = buildCardioCycleFromTemplateId('cardio-row-2k-12', {})!;
    expect(c.weeks.length).toBe(12);
    const withStruct = c.weeks.flatMap(w => w.sessions).filter(s => s.structured && s.structured.length > 0);
    expect(withStruct.length).toBeGreaterThan(5);
  });
  it('daysAvailable урезает явные недели', () => {
    const full = buildCardioCycleFromTemplateId('cardio-run-half-14', {})!;
    const cut = buildCardioCycleFromTemplateId('cardio-run-half-14', { daysAvailable: 3 })!;
    expect(cut.weeks[0].sessions.length).toBeLessThanOrEqual(3);
    expect(full.weeks[0].sessions.length).toBe(5);
  });
});

describe('селектор', () => {
  it('новичок + суставы → топ lowImpact', () => {
    const top = rankCardioCycles({ goal: 'health', level: 'beginner', lowImpact: true })[0];
    expect(top.template.meta.lowImpact).toBe(true);
  });
  it('гребля → топ row', () => {
    const top = rankCardioCycles({ sport: 'row' })[0];
    expect(top.template.meta.sport).toBe('row');
  });
  it('детерминирован: два прогона — один порядок', () => {
    const a = rankCardioCycles({ goal: 'cut' }).map(r => r.template.meta.id);
    const b = rankCardioCycles({ goal: 'cut' }).map(r => r.template.meta.id);
    expect(a).toEqual(b);
  });
  it('pickCardioTemplate: пустой пул → null', () => {
    expect(pickCardioTemplate({}, [])).toBeNull();
  });
});

describe('мост каталог → конструктор', () => {
  it('request → consume once (второй consume — null)', () => {
    requestCardioTemplateBuild('cardio-run-c25k-9');
    expect(consumeCardioTemplatePending()).toBe('cardio-run-c25k-9');
    expect(consumeCardioTemplatePending()).toBeNull();
  });
});

describe('HIIT-пресеты', () => {
  it('4×4: 240/180×4', () => {
    const p = getCardioIntervalPreset('norwegian-4x4')!;
    const b = p.build({});
    expect(b.workSec).toBe(240); expect(b.restSec).toBe(180); expect(b.reps).toBe(4);
  });
  it('4×4 с HRmax 190 → зоны 162-181', () => {
    const b = getCardioIntervalPreset('norwegian-4x4')!.build({ hrMax: 190 });
    expect(b.targetHr).toEqual({ min: 162, max: 181 });
  });
  it('Billat: 6-мин тест 1720 м → 143 м в note', () => {
    const b = getCardioIntervalPreset('billat-30-30')!.build({ sixMinDistanceM: 1720 });
    expect(b.workSec).toBe(30); expect(b.restSec).toBe(30);
    expect(b.note).toContain('143');
  });
  it('Tabata: 20/10×8, только вело/гребля', () => {
    const p = getCardioIntervalPreset('tabata')!;
    const b = p.build({});
    expect(b.workSec).toBe(20); expect(b.restSec).toBe(10); expect(b.reps).toBe(8);
    expect(p.equipment).not.toContain('running');
  });
  it('пресетов ровно 3', () => {
    expect(CARDIO_INTERVAL_PRESETS.length).toBe(3);
  });
});

describe('валидатор', () => {
  it('хороший шаблон валиден (C25K)', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-c25k-9', {})!;
    const v = validateCardioCycle(c);
    expect(v.valid).toBe(true);
    expect(v.qualityScore).toBeGreaterThanOrEqual(90);
  });
  it('мутация: скачок +50% → error volume_jump', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-base-12', {})!;
    // Мутируем нед.6 (индекс 5): рабочая, prev нед.5 тоже рабочая —
    // нед.4 у генератора делод и честно скипается валидатором.
    const bad: CardioCycle = {
      ...c,
      weeks: c.weeks.map((w, i) => (i === 5 ? { ...w, totalMinutes: w.totalMinutes * 1.5 } : w)),
    };
    const v = validateCardioCycle(bad);
    expect(v.valid).toBe(false);
    expect(v.issues.some(i => i.code === 'volume_jump' && i.level === 'error')).toBe(true);
  });
  it('пустой цикл → error empty, score 0', () => {
    const v = validateCardioCycle({ weeks: [] } as unknown as CardioCycle);
    expect(v.valid).toBe(false); expect(v.qualityScore).toBe(0);
  });
});

describe('пик-блок A/B/C', () => {
  it('A: taper 2 + пик; B: taper 1 + пик; C: без taper', () => {
    expect(peakBlockSpecFor('A')).toMatchObject({ taperWeeks: 2, peakWeek: true, taper: true });
    expect(peakBlockSpecFor('B')).toMatchObject({ taperWeeks: 1, peakWeek: true, taper: true });
    expect(peakBlockSpecFor('C')).toMatchObject({ taperWeeks: 0, peakWeek: false, taper: false });
  });
  it('applyPeakBlockToInput патчит taper/peakWeek', () => {
    const out = applyPeakBlockToInput({ taper: true, taperWeeks: 2, peakWeek: true }, 'C');
    expect(out.taper).toBe(false); expect(out.peakWeek).toBe(false);
  });
});

describe('персональные зоны', () => {
  it('no-op без targets — тот же объект', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-base-12', {})!;
    expect(applyPersonalTargetsToCycle(c, {})).toBe(c);
  });
  it('темпы дописываются в purpose', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-base-12', {})!;
    const next = applyPersonalTargetsToCycle(c, { easyPaceSec: 360, tempoPaceSec: 300, intervalPaceSec: 270 });
    const z2 = next.weeks.flatMap(w => w.sessions).find(s => s.type === 'zone2');
    expect(z2?.purpose).toContain('6:00/км');
    expect(formatPace(300)).toBe('5:00/км');
  });
  it('FTP дописывает ватты вело-HIIT', () => {
    const c = buildCardioCycleFromTemplateId('cardio-bike-1k-8', {})!;
    const next = applyPersonalTargetsToCycle(c, { ftpWatts: 200 });
    const hiit = next.weeks.flatMap(w => w.sessions).find(s => s.type === 'hiit');
    expect(hiit?.purpose).toContain('220 Вт');
  });
});

describe('кросс-мезо', () => {
  it('короткий цикл → null + честный advice', () => {
    const c = buildCardioCycleFromTemplateId('cardio-row-2k-4', {})!;
    expect(extractCardioProgression(c)).toBeNull();
    expect(cardioProgressionAdvice(null)).toContain('нет');
  });
  it('длинный цикл → startMult в [1, 1.15]', () => {
    const c = buildCardioCycleFromTemplateId('cardio-run-half-14', {})!;
    const p = extractCardioProgression(c);
    expect(p).not.toBeNull();
    expect(p!.startMult).toBeGreaterThanOrEqual(1);
    expect(p!.startMult).toBeLessThanOrEqual(1.15);
  });
});

describe('рекорды', () => {
  it('CRUD + best (меньше — лучше для бега)', () => {
    saveCardioRecord({ id: 'r1', kind: 'run5k', value: 1500, date: '2026-01-01' });
    saveCardioRecord({ id: 'r2', kind: 'run5k', value: 1400, date: '2026-02-01' });
    expect(bestCardioRecord('run5k')?.value).toBe(1400);
    expect(loadCardioRecords().length).toBe(2);
    removeCardioRecord('r1');
    expect(loadCardioRecords().length).toBe(1);
  });
  it('Riegel: 5к за 20:00 → 10к ≈ 41:42', () => {
    const t = predictRunningTime(1200, 5000, 10000)!;
    expect(Math.abs(t - 2502)).toBeLessThan(5);
    expect(formatCardioTime(t)).toBe('41:42');
  });
  it('Riegel: мусор → null', () => {
    expect(predictRunningTime(0, 5000, 10000)).toBeNull();
    expect(billatPaceFrom6Min(100)).toBeNull();
  });
  it('Billat: 1720 м → 143', () => {
    expect(billatPaceFrom6Min(1720)).toBe(143);
  });
});

describe('год-прогноз', () => {
  it('пустая лента → null', () => {
    expect(forecastYearCtl([])).toBeNull();
  });
  it('два цикла → verdict + числа', () => {
    const a = buildCardioCycleFromTemplateId('cardio-run-base-12', {})!;
    const b = buildCardioCycleFromTemplateId('cardio-row-2k-4', {})!;
    const f = forecastYearCtl([a, b])!;
    expect(f.weeks).toBe(16);
    expect(Number.isFinite(f.ctl)).toBe(true);
    expect(f.verdict.length).toBeGreaterThan(5);
  });
});

describe('PRO готовые циклы (дословно по источникам)', () => {
  const build = (id: string) => buildCardioCycleFromTemplateId(id, { bodyWeight: 80 })!;
  it('Хигдон Half-1: 12 нед, long 4→10 миль, старты 5K/10K/HM', () => {
    const c = build('cardio-pro-higdon-half1-12');
    expect(c.weeks.length).toBe(12);
    const longs = c.weeks.map(w => w.sessions[w.sessions.length - 1].purpose);
    expect(longs[0]).toContain('4 мили');
    expect(longs[10]).toContain('10 мили');
    expect(longs[5]).toContain('5K');
    expect(longs[8]).toContain('10K');
    expect(longs[11]).toContain('13.1');
  });
  it('Хигдон Half-2: среды pace по чётным, кросс 60 мин', () => {
    const c = build('cardio-pro-higdon-half2-12');
    expect(c.weeks[1].sessions[1].purpose).toContain('темпе гонки');
    expect(c.weeks[0].sessions.some(s => s.purpose.includes('Кросс 60'))).toBe(true);
  });
  it('Хигдон Marathon-1: 18 нед, long 6→20, откаты, HM на 8-й', () => {
    const c = build('cardio-pro-higdon-mar1-18');
    expect(c.weeks.length).toBe(18);
    expect(c.weeks[14].sessions.some(s => s.purpose.includes('20 мили'))).toBe(true);
    expect(c.weeks[7].sessions.some(s => s.purpose.includes('Half Marathon'))).toBe(true);
    expect(c.weeks[17].sessions.some(s => s.purpose.includes('26.2'))).toBe(true);
    expect(c.weeks[2].deload).toBe(true);
  });
  it('FIRST-finish: 16 нед × 3 ключа, легенда PMP, финал марафон', () => {
    const c = build('cardio-pro-first-finish-16');
    expect(c.weeks.length).toBe(16);
    expect(c.weeks[0].sessions.length).toBe(3);
    expect(c.weeks[0].sessions[0].purpose).toContain('3×1600');
    expect(c.weeks[15].sessions[2].purpose).toContain('26.2');
    expect(c.weeks[3].sessions[2].purpose).toContain('20 миль');
  });
  it('BarryP: 6 сессий 3-2-1, средняя/длинная не подряд', () => {
    const c = build('cardio-pro-barryp-8');
    expect(c.weeks[0].sessions.length).toBe(6);
    const dows = c.weeks[0].sessions.map(s => s.dayOfWeek);
    expect(dows).toEqual([0, 1, 2, 4, 5, 6]);
  });
  it('Daniels: 24 нед, фазы I-IV, Q1 R→I, финал гонки', () => {
    const c = build('cardio-pro-daniels-5k-24');
    expect(c.weeks.length).toBe(24);
    expect(c.weeks[0].phase).toBe('base');
    expect(c.weeks[6].sessions[0].purpose).toContain('Q1 R');
    expect(c.weeks[12].sessions[0].purpose).toContain('Q1 I');
    expect(c.weeks[19].sessions.some(s => s.purpose.includes('Старт'))).toBe(true);
  });
  it('MAF: тесты на 1/4/8/12-й, всё ≤ MAF', () => {
    const c = build('cardio-pro-maf-12');
    expect(c.weeks[0].sessions.some(s => s.purpose.includes('MAF-ТЕСТ'))).toBe(true);
    expect(c.weeks[3].sessions.some(s => s.purpose.includes('MAF-ТЕСТ'))).toBe(true);
    expect(c.weeks[1].sessions.some(s => s.purpose.includes('MAF-ТЕСТ'))).toBe(false);
    expect(c.weeks.every(w => w.sessions.every(s => s.purpose.includes('MAF')))).toBe(true);
  });
  it('Pete-full: 6 сессий, ротация 3 нед, пирамида/8×500/4×1000', () => {
    const c = build('cardio-pro-pete-full-12');
    expect(c.weeks[0].sessions.length).toBe(6);
    expect(c.weeks[0].sessions[0].purpose).toContain('8×500');
    expect(c.weeks[1].sessions[0].purpose).toContain('Пирамида');
    expect(c.weeks[2].sessions[0].purpose).toContain('4×1000');
    expect(c.weeks[3].sessions[0].purpose).toContain('8×500');
    expect(c.weeks[0].sessions[2].purpose).toContain('5×1500');
  });
  it('Pete-beginner: 24 нед, 1-я — 5000/6×500/5000', () => {
    const c = build('cardio-pro-petebeg-24');
    expect(c.weeks.length).toBe(24);
    expect(c.weeks[0].sessions[0].purpose).toContain('5000 м');
    expect(c.weeks[0].sessions[1].purpose).toContain('6×500');
    expect(c.weeks[23].sessions[0].purpose).toContain('12000');
  });
  it('SSB-LV: ramp test + Acho + пик + recovery', () => {
    const c = build('cardio-pro-ssb-lv-6');
    expect(c.weeks[0].sessions[0].purpose).toContain('Ramp Test');
    expect(c.weeks[0].sessions[1].purpose).toContain('Acho');
    expect(c.weeks[5].deload).toBe(true);
    expect(c.weeks[5].sessions.every(s => s.type === 'zone2')).toBe(true);
  });
  it('Swim-base: 4 нед × 2, ярды 1000→1500', () => {
    const c = build('cardio-pro-swim-base-4');
    expect(c.weeks[0].sessions[0].purpose).toContain('1000 ярдов');
    expect(c.weeks[3].sessions[1].purpose).toContain('1500 ярдов');
    expect(c.weeks.every(w => w.sessions.every(s => s.equipment === 'swimming'))).toBe(true);
  });
  it('Tri-sprint: 8 нед, кирпичи с 4-й, старт', () => {
    const c = build('cardio-pro-tri-sprint-8');
    expect(c.weeks.length).toBe(8);
    expect(c.weeks[3].sessions.some(s => s.purpose.includes('Кирпич'))).toBe(true);
    expect(c.weeks[7].sessions.some(s => s.purpose.includes('СТАРТ'))).toBe(true);
    const sports = new Set(c.weeks.flatMap(w => w.sessions.map(s => s.equipment)));
    expect(sports.has('swimming')).toBe(true);
    expect(sports.has('cycling')).toBe(true);
    expect(sports.has('running')).toBe(true);
  });
  it('Bridge-10K: 6 нед, финиш 60 мин нон-стоп', () => {
    const c = build('cardio-pro-bridge10k-6');
    expect(c.weeks[5].sessions.filter(s => s.purpose.includes('НОН-СТОП')).length).toBe(2);
    expect(c.weeks[0].sessions[0].purpose).toContain('10 мин');
  });
  it('все PRO валидны без error', () => {
    for (const t of CARDIO_PRO_CYCLES) {
      const c = build(t.meta.id);
      const v = validateCardioCycle(c);
      expect(v.issues.filter(i => i.level === 'error')).toEqual([]);
    }
  });
});
