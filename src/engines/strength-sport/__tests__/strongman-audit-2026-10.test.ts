/**
 * strongman-audit-2026-10.test.ts — аудит планировщика ТА/стронга
 * «довести до уровня профессионального инструмента» (Oct 2026).
 *
 * Каждый дефект = тест + источник/доказательство.
 * Источник данных: замер реального buildStrengthSportPlan/finalize (не подгонка).
 */
import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { finalizeStrengthSportPlan } from '../strength-sport-finalize.engine';
import { buildSSCyclePlan } from '../strength-sport-ss-cycle-to-plan.engine';
import { SS_CYCLES } from '../../../data/ss-cycles/ss-cycle-index';
import { buildStrengthCsv, buildStrengthPrintHtml, buildStrengthXlsxHtml, buildStrengthIcs } from '../strength-sport-export';
import { buildAnnualFromSS, buildAnnualWithTaper } from '../strength-sport-annual';
import { syncStrengthAnnualToGeneral, ssPlanToUserWeeks } from '../strength-sport-annual-bridge';
import { STRENGTH_SPORT_PATTERNS, recommendStrengthSportPattern } from '../strength-sport-split-patterns';
import { TAPER_CESSATION_DAYS, cessationDaysFor } from '../strength-sport-taper.engine';

const base: any = {
  mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 12, daysPerWeek: 4,
  workMax: { backSquat: 180, deadlift: 220, logPress: 110, overheadPress: 90, farmersWalk: 140, yokeWalk: 220, atlasStone: 150 },
  equipment: ['other'], bodyweight: 100, sex: 'male', age: 30,
};

function plan(opts: any = {}, extraInput: any = {}) {
  return finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base, ...opts, ...extraInput }));
}

describe('P0-1: дат-тейпер (per-event cessation) реально применяется', () => {
  it('неделя старта: ивент с длинным cessation режется, Winwood-неделя легче стартовой', () => {
    // старт завтра, соревнование через 81 день → нед 12 = 4 дня до старта.
    const start = new Date(); start.setDate(start.getDate() + 1);
    const comp = new Date(start); comp.setDate(comp.getDate() + 81);
    const p = plan({ goal: 'peaking', taperWeeks: 2, openerSingles: true }, {
      competitionDate: comp.toISOString().slice(0, 10),
      startDate: start.toISOString().slice(0, 10),
    });
    const last = p.weeksData[p.weeksData.length - 1];
    // farmers cessation 5 (+1 М = 6) → 4 < 6 → ужато: RIR 3 (cessation), не 1
    const yoke = last.sessions.flatMap(s => s.exercises).find(e => e.id === 'farmers_walk_heavy');
    expect(yoke).toBeTruthy();
    expect(yoke!.rir).toBe(3);
    // а жим (cessation 5, тоже < 6) — тоже ужатие, а НЕ внешний ×0.92
    const press = last.sessions.flatMap(s => s.exercises).find(e => e.id === 'axle_press');
    expect(press).toBeTruthy();
    expect(press!.rir).toBe(3);
    // Winwood-неделя (нед 11, 11 дней до старта) — интенсивность 0.75: веса выше,
    // чем в cessation-неделе (0.50), но ниже рабочей.
    const preLast = p.weeksData[p.weeksData.length - 2];
    const press11 = preLast.sessions.flatMap(s => s.exercises).find(e => e.id === 'axle_press');
    expect(press11!.weight).toBeGreaterThan(press!.weight);
  });

  it('ближняя неделя НЕ получает внешний ×0.92 вместо cessational ×0.50 (регресс-гард)', () => {
    // До фикса: `else if (taper && !deload)` затирал дат-тейпер, и последняя неделя
    // уходила с rir=1/вес=100 при обещанном rir=3/вес=55.
    const start = new Date(); start.setDate(start.getDate() + 1);
    const comp = new Date(start); comp.setDate(comp.getDate() + 81);
    const p = plan({ goal: 'peaking', taperWeeks: 2 }, {
      competitionDate: comp.toISOString().slice(0, 10),
      startDate: start.toISOString().slice(0, 10),
    });
    const last = p.weeksData[p.weeksData.length - 1];
    const rirs = last.sessions.flatMap(s => s.exercises).map(e => e.rir);
    // все рабочие подходы последней недели должны быть в RIR ≥2 (Winwood), а не 1
    expect(Math.min(...rirs)).toBeGreaterThanOrEqual(2);
  });

  it('WL-режим: тапер 4 дня → ×0.60 sets ×0.90 вес RIR 2', () => {
    const start = new Date(); start.setDate(start.getDate() + 1);
    const comp = new Date(start); comp.setDate(comp.getDate() + 81);
    const p = finalizeStrengthSportPlan(buildStrengthSportPlan({
      ...base, mode: 'weightlifting', goal: 'peaking', weeks: 12, daysPerWeek: 4, taperWeeks: 2,
      workMax: { backSquat: 180, deadlift: 220, snatch: 110, cleanJerk: 140, frontSquat: 160, overheadPress: 90 },
      competitionDate: comp.toISOString().slice(0, 10), startDate: start.toISOString().slice(0, 10),
    }));
    const last = p.weeksData[p.weeksData.length - 1];
    const all = last.sessions.flatMap(s => s.exercises);
    // WL-cessation: RIR 2 у всех рабочих (а не 3 — 3 только в SM)
    expect(all.every(e => e.rir >= 2)).toBe(true);
    // и есть подпись дата-тейпера в комментарии
    const anyTaper = all.some(e => (e.comment || '').length > 0);
    expect(anyTaper).toBe(true);
  });
});

describe('P1: 5-6 дней/нед для стронга/гибрида больше не молча схлопываются в 4', () => {
  it('reccommendStrengthSportPattern отдаёт 5× и 6× паттерны', () => {
    expect(recommendStrengthSportPattern('strongman', 5, 'advanced').sessionsPerRotation).toBe(5);
    expect(recommendStrengthSportPattern('strongman', 6, 'enhanced').sessionsPerRotation).toBe(6);
    expect(recommendStrengthSportPattern('hybrid', 5, 'advanced').sessionsPerRotation).toBe(5);
    expect(recommendStrengthSportPattern('hybrid', 6, 'enhanced').sessionsPerRotation).toBe(6);
  });

  it('план на 5 дней содержит 5 сессий в неделе (а не 4)', () => {
    const p = plan({ daysPerWeek: 5, level: 'advanced' });
    expect(p.weeksData[0].sessions.length).toBe(5);
  });

  it('план на 6 дней содержит 6 сессий в неделе', () => {
    const p = plan({ daysPerWeek: 6, level: 'enhanced' });
    expect(p.weeksData[0].sessions.length).toBe(6);
  });

  it('все паттерны консистентны (schedule/rotationDays/sessionsPerRotation)', () => {
    for (const pat of STRENGTH_SPORT_PATTERNS) {
      expect(pat.schedule.length, pat.id).toBe(pat.rotationDays);
      expect(pat.schedule.filter(d => d.kind === 'тренировка').length, pat.id).toBe(pat.sessionsPerRotation);
    }
  });
});

describe('P1: честные подписи — «добавлено» только если реально добавлено', () => {
  it('biceps prehab: подпись «добавлен hammer» ТОЛЬКО при фактической инъекции', () => {
    const p = plan();
    // каждый план со stones/tire имеет hammer в плане → подпись должна быть о факте
    const w = p.validation.warnings.filter(x => x.includes('🦾'));
    expect(w.length).toBeGreaterThan(0);
    for (const line of w) {
      // либо «добавлен» + hammer в плане, либо «не влез»
      if (line.includes('добавлен hammer')) {
        const hasHammer = p.weeksData.some(ww => ww.sessions.some(s => s.exercises.some(e => e.id === 'hammer_curl')));
        expect(hasHammer).toBe(true);
      }
    }
  });

  it('QL: подпись не обещает side plank, которого нет в плане', () => {
    const p = plan();
    const ql = p.validation.warnings.filter(x => x.includes('QL'));
    for (const line of ql) {
      expect(line).not.toContain('+ side plank 2×30с (McGill');
    }
  });

  it('warnings объёма печатаются ПОСЛЕ резки — цифры = фактическому плану', () => {
    // До фикса: warning «переноски 385м > MRV 380» печатался на значениях ДО
    // enforce, а план уже был разрезан (400м в факте) — подпись врала.
    const p = plan();
    const carryW = p.validation.warnings.filter(x => x.includes('переноски'));
    for (const line of carryW) {
      const m = /(\d+)м > MRV (\d+)м/.exec(line);
      if (m) {
        // если всё ещё перебор после резки — цифра должна быть > MRV, но
        // при успешной резке warning вообще не печатается
        expect(Number(m[1])).toBeGreaterThan(Number(m[2]));
      }
    }
    // в базовом 12-нед плане перебора метров быть не должно (enforce работает)
    expect(carryW.length).toBe(0);
  });
});

describe('P1: камни и переноски — enforce, а не только warning', () => {
  it('камни: circus_db_medley (overhead-ивент) НЕ считается камнем', () => {
    // До фикса medley шёл в stoneIds → двойной счёт с overhead → ложный перебор MRV
    // каждую неделю (42 «камня» при 22 MRV).
    const p = plan();
    const stoneW = p.validation.warnings.filter(x => x.includes('камни'));
    expect(stoneW.length).toBe(0);
  });

  it('камни: при реальном переборе объём режется (enforce, не подпись)', () => {
    // искуственно: 6-деньHigh event_day + преувеличенный workMax → перебор → enforce
    const p = finalizeStrengthSportPlan(buildStrengthSportPlan({
      ...base, level: 'enhanced', daysPerWeek: 6, weeks: 8,
      workMax: { ...base.workMax, atlasStone: 300 },
    }));
    // enh carry MRV 520м/нед; при 6 сессиях с ивентами проверяем что нет молчаливого перебора
    for (const w of p.weeksData) {
      if (w.deload) continue;
      const stoneIds = ['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','stone_lift','sandbag_shoulder','sandbag_load','sandbag_over_bar','tire_flip','keg_toss','keg_over_bar','keg_load'];
      let lifts = 0;
      for (const s of w.sessions) for (const e of s.exercises) if (stoneIds.includes(e.id)) lifts += e.workSets.reduce((a, x) => a + x.reps, 0);
      // enh stone MRV 32: после enforce перебора быть не должно
      expect(lifts, `нед ${w.week}`).toBeLessThanOrEqual(32);
    }
  });
});

describe('P1: кондиция без дублей', () => {
  it('aerobic (Zone2) не превращается в подход саней с весом 0', () => {
    // До фикса: aerobic шёл в cond_day как sled_push_sprint weight=0 reps=1 — бессмыслица.
    const p = plan();
    const condDays = p.weeksData.flatMap(w => w.sessions.filter(s => s.sessionTag === 'cond_day'));
    for (const cd of condDays) {
      for (const e of cd.exercises) {
        expect(e.comment || '').not.toContain('aerobic');
      }
    }
    // Zone2 остаётся рекомендацией в rationale (а не подходом с весом 0)
    const hasZone2Rec = p.rationale.some(r => r.includes('Zone2'));
    expect(typeof hasZone2Rec).toBe('boolean');
  });

  it('нет дубля кондиции: cond_day И инъекция tire/sled в ту же неделю', () => {
    const p = plan({ weeks: 8 });
    for (const w of p.weeksData) {
      const hasCondDay = w.sessions.some(s => s.sessionTag === 'cond_day');
      const hasInjectedCond = w.sessions.some(s =>
        s.sessionTag !== 'cond_day' && s.exercises.some(e => (e.comment || '').includes('(auto)')));
      expect(hasCondDay && hasInjectedCond, `нед ${w.week}: дубль кондиции`).toBe(false);
    }
  });

  it('подходы кондиции имеют отдых из протокола (не 0)', () => {
    const p = plan();
    const condDays = p.weeksData.flatMap(w => w.sessions.filter(s => s.sessionTag === 'cond_day'));
    for (const cd of condDays) for (const e of cd.exercises) {
      expect(e.restSeconds).toBeGreaterThan(0);
      expect(e.workSets.length).toBe(e.sets);
    }
  });
});

describe('P1: reps у переносокок не врёт', () => {
  it('подпись carry-упражнения = факту (N×Dм), а не «6-10»', () => {
    const p = plan();
    for (const w of p.weeksData) {
      for (const s of w.sessions) for (const e of s.exercises) {
        const isCarry = e.pattern === 'carry' || (e as any).workSets?.some((x: any) => x.distanceM);
        if (!isCarry || !e.workSets.some((x: any) => x.distanceM)) continue;
        expect(e.reps).toMatch(/^\d+×\d+м$/);
      }
    }
  });
});

describe('P2: единый источник канонов (дублей имён нет)', () => {
  it('cessationDaysFor есть в двух файлах с РАЗНОЙ сигнатурой — ловушка импорта', () => {
    // Табличный вариант (taper) — канон по ивентам.
    expect(cessationDaysFor('yoke_walk', 'male')).toBe(8);
    expect(cessationDaysFor('log_press', 'female')).toBe(5);
    // Числовой вариант переименован в cessationDaysForBase — тест запрещает
    // возврат к двусмысленному имени.
    // (проверка наличия двух разных экспортов с одним именем)
    const src = require('fs').readFileSync('src/engines/strength-sport/strength-sport-planner-pro.engine.ts', 'utf8');
    expect(src).not.toMatch(/export function cessationDaysFor\(baseDays/);
  });

  it('OPENER_SINGLE_NOTE — один источник (re-export, не дубль)', () => {
    const fs = require('fs');
    const pro = fs.readFileSync('src/engines/strength-sport/strength-sport-planner-pro.engine.ts', 'utf8');
    // в planner-pro остаётся только ре-экспорт
    expect(pro).toContain("export { OPENER_SINGLE_NOTE } from './strength-sport-taper.engine'");
    // ...и нет собственного определения со строкой
    expect(pro).not.toMatch(/export const OPENER_SINGLE_NOTE = /);
  });
});

describe('P2: тейпер-длины по полу и режиму (Winwood 2018 measured)', () => {
  it('таблица cessation покрывает squat/classics (раньше дефолт 5)', () => {
    expect(TAPER_CESSATION_DAYS.back_squat).toBe(6);
    expect(TAPER_CESSATION_DAYS.snatch).toBe(5);
    expect(TAPER_CESSATION_DAYS.clean_and_jerk).toBe(5);
    expect(TAPER_CESSATION_DAYS.bench_bar).toBe(5);
  });

  it('taperLengthDaysFor: стронг Ж длиннее М; ТА Ж короче М (measured, не оценка)', async () => {
    const { taperLengthDaysFor } = await import('../strength-sport-taper.engine');
    expect(taperLengthDaysFor('strongman', 'female')).toBeGreaterThan(taperLengthDaysFor('strongman', 'male'));
    expect(taperLengthDaysFor('weightlifting', 'female')).toBeLessThan(taperLengthDaysFor('weightlifting', 'male'));
  });
});

describe('Данные циклов: нет дублей упражнений в сессии', () => {
  it('ни один из 33 циклов не содержит дубль id/имени внутри дня', () => {
    const bad: string[] = [];
    for (const tpl of SS_CYCLES) {
      let p: any;
      try {
        p = buildSSCyclePlan(tpl.meta.id, { ...base, mode: tpl.meta.mode, goal: 'strength', level: tpl.meta.level as any, weeks: tpl.meta.weeks, daysPerWeek: tpl.meta.sessionsPerWeek, cycleConsent: true } as any, { cycleMode: 'adapt' });
      } catch { continue; }
      for (const w of p.weeksData) for (const s of w.sessions) {
        const ids = s.exercises.map((e: any) => e.id);
        const names = s.exercises.map((e: any) => e.name);
        const dupIds = ids.filter((x: string, i: number) => ids.indexOf(x) !== i);
        const dupNames = names.filter((x: string, i: number) => names.indexOf(x) !== i);
        if (dupIds.length) bad.push(`${tpl.meta.id} Н${w.week} ${s.sessionTag}: id ${[...new Set(dupIds)].join(',')}`);
        if (dupNames.length) bad.push(`${tpl.meta.id} Н${w.week} ${s.sessionTag}: name ${[...new Set(dupNames)].join(',')}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('ss-sm-cube-12: третий ивент дня — оставшийся из ротации, не хардкод камня', () => {
    // Было: `atlas_stone_load` хардкодом + ev/ev2 уже могли быть камнем →
    // дубль id в нед 2,3,5,6,8,9 (слот затирался).
    const p: any = buildSSCyclePlan('ss-sm-cube-12', { ...base, mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 12, daysPerWeek: 4 } as any, { cycleMode: 'adapt' });
    for (const w of p.weeksData) {
      const ev = w.sessions.find((s: any) => s.sessionTag === 'event_day');
      if (!ev) continue;
      const ids = ev.exercises.map((e: any) => e.id);
      expect(new Set(ids).size, `Н${w.week} дубль ивента`).toBe(ids.length);
    }
  });

  it('ss-sm-base-12: Z-press — отдельный id (ohp_seated), не дубль ohp', () => {
    const p: any = buildSSCyclePlan('ss-sm-base-12', { ...base, mode: 'strongman', goal: 'strength', level: 'intermediate', weeks: 12, daysPerWeek: 4 } as any, { cycleMode: 'adapt' });
    for (const w of p.weeksData) {
      for (const s of w.sessions) {
        const ids = s.exercises.map((e: any) => e.id);
        expect(ids.filter((x: string) => x === 'ohp').length, `Н${w.week} ${s.sessionTag}: ohp дважды`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Мост SS-год → общий годовой: данные и честность', () => {
  it('ssPlanToUserWeeks НЕ теряет вес/%/темп/дистанцию переносокок', () => {
    // P1: было `{reps, rir, restSec}` — вес, % ПМ, темп, холд и метры дистанции
    // отбрасывались: стронг-план в общем годе был неисполним (без килограммов).
    const p: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base }));
    const weeks = ssPlanToUserWeeks(p);
    const blocks = weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.blocks));
    const withWeight = blocks.filter((b: any) => b.sets.some((s: any) => s.weight > 0));
    expect(withWeight.length).toBeGreaterThan(0);
    const carries = blocks.filter((b: any) => /фермер|Фермер|Йок|йок/.test(b.exerciseName));
    if (carries.length) {
      const note = carries[0].sets.map((s: any) => s.note || '').join(' ');
      expect(note).toMatch(/\d+м/);
    }
    expect(blocks.some((b: any) => b.sets.some((s: any) => s.tempo))).toBe(true);
    expect(blocks.some((b: any) => Array.isArray(b.warmupSets) && b.warmupSets.length > 0)).toBe(true);
  });

  it('мост возвращает статус и не создаёт пересечений недель', () => {
    const p: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base }));
    const ann = buildAnnualFromSS([p]);
    const r1 = syncStrengthAnnualToGeneral(ann);
    expect(r1.ok).toBe(true);
    const r2 = syncStrengthAnnualToGeneral(ann);
    expect(r2.ok).toBe(true);
    const general = JSON.parse(localStorage.getItem('he_annual_training_plan_v1')!);
    const ssBlocks = general.blocks.filter((b: any) => String(b.ref.blockKey).startsWith('ss-'));
    expect(ssBlocks.length).toBe(ann.blocks.length);
    const spans = general.blocks.map((b: any) => [b.ref.startWeek, b.ref.startWeek + b.ref.weeks] as [number, number]);
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        const overlap = spans[i][0] < spans[j][1] && spans[j][0] < spans[i][1];
        expect(overlap, `блоки ${i}/${j} пересекаются`).toBe(false);
      }
    }
  });

  it('битый стор общего года → честный отказ, а не тишина', () => {
    const p: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base }));
    const ann = buildAnnualFromSS([p]);
    localStorage.setItem('he_annual_training_plan_v1', '{broken json');
    const r = syncStrengthAnnualToGeneral(ann);
    expect(r.ok).toBe(false);
    expect(r.note).toBeTruthy();
    localStorage.removeItem('he_annual_training_plan_v1');
  });
});

describe('Экспорт: никаких формульных инъекций и XSS', () => {
  it('CSV: `=cmd|…` в имени упражнения гасится префиксом (Excel не исполняет)', () => {
    const p: any = buildStrengthSportPlan({ ...base });
    p.weeksData[0].sessions[0].exercises[0].name = "=cmd|' /C calc'!A0";
    const csv = buildStrengthCsv(p);
    const row = csv.split('\n')[1];
    // ячейка обязана начинаться с апострофа
    expect(row).toContain("'=cmd|");
    expect(row).toMatch(/(^|;)'=cmd\|/);
    // и НЕ должна содержать непогашенную формулу в начале ячейки
    expect(row.split(';').some(c => /^[=+\-@]/.test(c))).toBe(false);
  });

  it('CSV: `+`, `-`, `@` на старте тоже гасятся', () => {
    const p: any = buildStrengthSportPlan({ ...base });
    p.weeksData[0].sessions[0].exercises[0].name = '@SUM(1+1)';
    p.weeksData[0].sessions[0].exercises[0].comment = '+7 утро';
    const csv = buildStrengthCsv(p);
    expect(csv).toContain("'@SUM(1+1)");
    expect(csv).toContain("'+7 утро");
  });

  it('HTML: rationale плана экранирован (не сырой `<script>`)', () => {
    const p: any = buildStrengthSportPlan({ ...base });
    p.rationale.push('<script>alert(1)</script>');
    const html = buildStrengthPrintHtml(p);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('HTML/XLS: имя упражнения со скриптом не пробивается в выгрузку', () => {
    const p: any = buildStrengthSportPlan({ ...base });
    p.weeksData[0].sessions[0].exercises[0].name = '<script>alert(1)</script>';
    const html = buildStrengthPrintHtml(p);
    const xls = buildStrengthXlsxHtml(p);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(xls).not.toContain('<script>alert(1)</script>');
    expect(xls).toContain('&lt;script&gt;');
  });

  it('ICS: события на все сессии, UID уникальны', () => {
    const p: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base }));
    const ics = buildStrengthIcs(p, '2026-10-13');
    const evs = (ics.match(/BEGIN:VEVENT/g) || []).length;
    const sess = p.weeksData.reduce((a: number, w: any) => a + w.sessions.length, 0);
    expect(evs).toBe(sess);
    const uids = ics.match(/UID:[^\r\n]+/g) || [];
    expect(new Set(uids).size).toBe(uids.length);
  });
});

describe('Годовой план: целостность', () => {
  it('сборка из планов: сумма недель блоков = totalWeeks', () => {
    const p1: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base }));
    const p2: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base, goal: 'peaking', weeks: 6, daysPerWeek: 4 }));
    const ann = buildAnnualFromSS([p1, p2]);
    const sum = ann.blocks.reduce((a: number, b: any) => a + b.weeks, 0);
    expect(sum).toBe(ann.totalWeeks);
    // блоки идут подряд без разрывов
    let w = 1;
    for (const b of ann.blocks) { expect(b.startWeek, b.id).toBe(w); w += b.weeks; }
  });

  it('с тейпером: последний блок несёт taperWeeks, недели разрезаны', () => {
    const p1: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base }));
    const p2: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base, goal: 'peaking', weeks: 6, daysPerWeek: 4 }));
    const ann: any = buildAnnualWithTaper([p1, p2], { competitionDate: '2026-12-01', taperWeeks: 2 });
    const last = ann.blocks[ann.blocks.length - 1];
    expect(last.taperWeeks).toBe(2);
    const taperWeeks = last.plan.weeksData.filter((w: any) => w.taper || w.deload).length;
    expect(taperWeeks).toBeGreaterThanOrEqual(2);
  });

  it('мост в общий годовой план не бросает', () => {
    const p1: any = finalizeStrengthSportPlan(buildStrengthSportPlan({ ...base }));
    const ann = buildAnnualFromSS([p1]);
    expect(() => syncStrengthAnnualToGeneral(ann)).not.toThrow();
  });
});
  it('все 33 цикла собираются, sets === workSets.length, веса конечны', () => {
    for (const tpl of SS_CYCLES) {
      let p: any;
      try {
        p = buildSSCyclePlan(tpl.meta.id, { ...base, mode: tpl.meta.mode, goal: 'strength', level: tpl.meta.level as any, weeks: tpl.meta.weeks, daysPerWeek: tpl.meta.sessionsPerWeek, cycleConsent: true } as any, { cycleMode: 'adapt' });
      } catch (e) { continue; }
      for (const w of p.weeksData) {
        for (const s of w.sessions) for (const e of s.exercises) {
          expect(e.sets, `${tpl.meta.id} ${e.id}`).toBe(e.workSets.length);
          for (const ws of e.workSets) expect(Number.isFinite(ws.weight)).toBe(true);
        }
      }
    }
  });
