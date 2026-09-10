/**
 * bb-diagnostics-pro2.test.ts — P1–P4 + P7 PRO-2 (чистые движки).
 * Только русские инварианты поведения, без UI.
 */
import { describe, it, expect } from 'vitest';
import { lrVerdictsFromSessions, lrVerdictFor, sideOfExercise } from '../bb-lr-volume.engine';
import { assessBbReadiness } from '../bb-readiness.engine';
import { assessBbRedFlags } from '../bb-red-flags.engine';
import { bbBarPathVerdict } from '../bb-bar-path.engine';
import { femaleSymmetryNotes, teenTrainingNote } from '../bb-symmetry.engine';

const sets = (n: number) => Array.from({ length: n }, () => ({ weightKg: 20, reps: 10 }));

describe('P1 L/R-объём', () => {
  it('унилатеральные сеты ложатся своей стороне, штанга — поровну', () => {
    const sessions = [{
      date: '2026-09-01',
      exercises: [
        { muscleGroup: 'biceps', side: 'left', sets: sets(4) },
        { muscleGroup: 'biceps', side: 'right', sets: sets(2) },
        { muscleGroup: 'chest', sets: sets(3) }, // грудь не руки/ноги — мимо
      ],
    }];
    const res = lrVerdictsFromSessions(sessions);
    expect(res.length).toBe(1);
    expect(res[0].group).toBe('biceps');
    expect(res[0].left).toBe(4);
    expect(res[0].right).toBe(2);
    expect(res[0].asymPct).toBe(50);
    expect(res[0].weakSide).toBe('right');
    expect(res[0].verdict).toBe('topup');
    expect(res[0].text).toMatch(/Слабее: правая/);
  });
  it('сторона читается из имени (левая/правая) и маркера руки', () => {
    expect(sideOfExercise({ name: 'Сгибание гантели левой', sets: sets(1) })).toBe('left');
    expect(sideOfExercise({ name: 'Dumbbell curl right arm', sets: sets(1) })).toBe('right');
    expect(sideOfExercise({ exerciseName: 'bench_bar', name: 'Жим', sets: sets(1) })).toBe('both');
  });
  it('билатераль без перекоса — норма без добивки', () => {
    const v = lrVerdictFor('quads', 6, 6);
    expect(v.verdict).toBe('norm');
    expect(v.topUpSets).toBe(0);
    expect(v.text).toMatch(/норма/);
  });
  it('перекос 7–12% — наблюдение +15%, ≥12% — добивка +25%', () => {
    const w = lrVerdictFor('triceps', 10, 9);
    expect(w.verdict).toBe('watch');
    expect(w.bonus).toBe(0.15);
    const t = lrVerdictFor('triceps', 10, 8);
    expect(t.verdict).toBe('topup');
    expect(t.bonus).toBe(0.25);
    expect(t.topUpSets).toBeGreaterThanOrEqual(2);
  });
});

describe('P2 готовность дня', () => {
  it('зелёный без жалоб', () => {
    const r = assessBbReadiness({ sleepHours: 8, pain010: 0, vbtLossPct: 10, dangerMuscles: 0 });
    expect(r.level).toBe('green');
    expect(r.advice).toMatch(/Зелёный/);
  });
  it('жёлтый при недосыпе или умеренной боли', () => {
    expect(assessBbReadiness({ sleepHours: 6, pain010: 0 }).level).toBe('yellow');
    expect(assessBbReadiness({ sleepHours: 8, pain010: 5 }).level).toBe('yellow');
  });
  it('красный при сильной боли или двух перегруженных мышцах', () => {
    expect(assessBbReadiness({ sleepHours: 8, pain010: 8 }).level).toBe('red');
    expect(assessBbReadiness({ sleepHours: 8, dangerMuscles: 2 }).level).toBe('red');
    expect(assessBbReadiness({ sleepHours: 5 }).level).toBe('red');
  });
});

describe('P3 красные флаги', () => {
  it('пусто — вставка разрешена', () => {
    const r = assessBbRedFlags({ acutePain: false, swelling: false, numbness: false, jointClickPain: false });
    expect(r.active).toBe(false);
    expect(r.blocked).toBe(false);
  });
  it('острая боль/отёк/онемение — стоп с блокировкой', () => {
    const r = assessBbRedFlags({ acutePain: true, swelling: false, numbness: false, jointClickPain: false });
    expect(r.blocked).toBe(true);
    expect(r.text).toMatch(/Стоп/);
    expect(r.text).toMatch(/острая боль/);
  });
  it('щелчки с болью — осторожность без жёсткого блока', () => {
    const r = assessBbRedFlags({ acutePain: false, swelling: false, numbness: false, jointClickPain: true });
    expect(r.active).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.text).toMatch(/Осторожно/);
  });
});

describe('P4 петля штанги SRD', () => {
  it('до 4 см — допуск, 4–6 — грань, выше 6 — чинить', () => {
    expect(bbBarPathVerdict(2.5).flag).toBe('ok');
    expect(bbBarPathVerdict(5).flag).toBe('warn');
    expect(bbBarPathVerdict(7).flag).toBe('crit');
    expect(bbBarPathVerdict(7).text).toMatch(/чиним технику/);
    expect(bbBarPathVerdict(1.5).type).toBe('прямая');
    expect(bbBarPathVerdict(5).type).toBe('широкая петля');
  });
});

describe('PRO-2 в экспорте (HTML/CSV)', () => {
  it('HTML несёт разделы L/R, готовность, флаги, штанга, углы, подросток, женские', async () => {
    const { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv } = await import('../bb-diagnostics-export.engine');
    const rep = {
      score: { score: 70, level: 'ok', verification: '1', floors: [] },
      weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [],
      symmetry: { ratios: {}, issues: [], score: 80 },
      stimulus: { issues: [], global: { lengthened: 1, midRange: 1, shortened: 0, compound: 1, isolation: 1 } },
      findings: [], priorities: [],
    } as any;
    const meta = {
      lr: [{ group: 'biceps', left: 5, right: 2, asymPct: 60, weakSide: 'right', verdict: 'topup', topUpSets: 2, text: 'Слабее: правая' }],
      readiness: { level: 'red', advice: 'Красный', reasons: ['Боль 8/10'] },
      redFlags: { active: true, blocked: true, items: ['острая боль'], text: 'Стоп' },
      bar: { xLoop: 7, yMax: 20, type: 'широкая петля', text: 'чиним' },
      pose: { hip: 90, knee: 80, ankle: 40, shoulder: 170, n: 2, faults: [] as string[] },
      teen: '14–15 лет: техника без отказа',
      femaleNotes: ['Лютеиновая фаза: вода'],
    } as any;
    const html = buildBBDiagnosticsHtml(rep, meta);
    for (const needle of ['Лево/право', 'Готовность', 'Флаги', 'Штанга', 'Углы', 'Подросток', 'Женские ориентиры']) {
      expect(html).toContain(needle);
    }
    const csv = buildBBDiagnosticsCsv(rep, null, meta);
    for (const needle of ['lr_group', 'readiness', 'red_flags', 'bar_xLoop', 'pose', 'teen', 'female_notes']) {
      expect(csv).toContain(needle);
    }
  });
  it('без PRO-2 мета экспорт как раньше (без новых разделов)', async () => {
    const { buildBBDiagnosticsHtml } = await import('../bb-diagnostics-export.engine');
    const rep = {
      score: { score: 80, level: 'ok', verification: '1', floors: [] },
      weakCandidates: [], weakMusclesCanonical: [], weakZonesGranular: [],
      symmetry: { ratios: {}, issues: [], score: 80 },
      stimulus: { issues: [], global: { lengthened: 1, midRange: 1, shortened: 0, compound: 1, isolation: 1 } },
      findings: [], priorities: [],
    } as any;
    const html = buildBBDiagnosticsHtml(rep, {});
    expect(html).not.toContain('Лево/право');
    expect(html).toContain('Симметрия');
  });
});

describe('P7 женская симметрия + teen', () => {
  it('коридор 0.65–0.80 — норма, лютеиновая — пометка про воду', () => {
    expect(femaleSymmetryNotes({ waist: 70, hips: 95 })[0]).toMatch(/коридор нормы/);
    const luteal = femaleSymmetryNotes({ waist: 70, hips: 95 }, { cyclePhase: 'luteal' });
    expect(luteal.join(' ')).toMatch(/Лютеиновая фаза/);
    expect(femaleSymmetryNotes({ waist: 85, hips: 95 })[0]).toMatch(/акцент ягодицы/);
  });
  it('бедро/бёдра < 0.30 — сигнал бедру', () => {
    expect(femaleSymmetryNotes({ waist: 70, hips: 100, thigh: 25 }).join(' ')).toMatch(/бедру нужен объём/);
  });
  it('teen-гейт: до 14 — ОФП, 14–15 — без отказа, 16+ — тихо', () => {
    expect(teenTrainingNote(13)).toMatch(/ОФП/);
    expect(teenTrainingNote(14)).toMatch(/без отказа/);
    expect(teenTrainingNote(16)).toBeNull();
    expect(teenTrainingNote(null)).toBeNull();
  });
});
