import { describe, expect, it } from 'vitest';
import {
  bbAuditBuild, bbAuditCycles,
  cycleAuditAllEx, cycleAuditComments, cycleAuditSig, cycleAuditWorkSets, cycleAuditPush,
} from './helpers/bb-cycle-audit.helper';

/**
 * M3-остаток (план BB-AUTO-EXHAUSTIVE-PRO §8.3), лёгкая часть аудита
 * UI-пути «📋 ПРОФ-цикл» (cycleTemplateToFullProgram → programToBBPlan):
 * состав библиотеки, влияние цели/пола (паритет generic↔program), маркеры
 * выбранных методик, дословность faithful. Тяжёлые матрицы — в файлах
 * bb-cycle-audit-{beginner,intermediate,advanced,enhanced}.test.ts.
 */

const cycles = bbAuditCycles();

describe('M3-остаток: BB-циклы — библиотека, паритет настроек, маркеры методик', () => {
  it('список циклов UI-селектора: ≥35, уникальные id, без embed-*', () => {
    const ids = cycles.map(c => c.meta.id);
    expect(ids.length).toBeGreaterThanOrEqual(35);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => !id.startsWith('embed-'))).toBe(true);
  });

  it('adapt: цель и пол реально влияют на план (паритет generic↔program)', () => {
    const b: string[] = [];
    const sample = cycles.filter((_, i) => i % 5 === 0);
    expect(sample.length).toBeGreaterThanOrEqual(6);
    for (const c of sample) {
      const mass = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass');
      const cut = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'cut');
      const female = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'female', 'mass');
      if (cycleAuditSig(mass) === cycleAuditSig(cut)) cycleAuditPush(b, `${c.meta.id}: цель не влияет (mass === cut)`);
      if (cycleAuditSig(mass) === cycleAuditSig(female)) cycleAuditPush(b, `${c.meta.id}: пол не влияет (male === female)`);
    }
    expect(b).toEqual([]);
  }, 600000);

  it('faithful: дословность — пол/цель не меняют план (выборка)', () => {
    const b: string[] = [];
    const sample = cycles.filter((_, i) => i % 9 === 0);
    for (const c of sample) {
      const male = bbAuditBuild(c.meta.id, 'faithful', 'intermediate', 'male', 'mass');
      const femaleCut = bbAuditBuild(c.meta.id, 'faithful', 'intermediate', 'female', 'cut');
      if (cycleAuditSig(male) !== cycleAuditSig(femaleCut)) cycleAuditPush(b, c.meta.id);
    }
    expect(b).toEqual([]);
  }, 300000);

  it('adapt: маркеры методик доезжают в цикловой путь', () => {
    const sample = cycles.filter(c => ['cycle-bb-01', 'cycle-bb-04', 'cycle-bb-f-glute-12', 'cycle-bb-m-arms-8'].includes(c.meta.id));
    expect(sample.length).toBeGreaterThanOrEqual(3);
    const b: string[] = [];
    const extra = (opts: Record<string, unknown>) => opts;
    for (const c of sample) {
      const base = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass');
      // drop_set — render-only маркер (комментарий): мини-сеты техник не хранятся
      // в workSets (инвариант sets === workSets.length; дизайн «цепочка в UI» Aug-2026).
      const drop = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass', extra({ intTechnique: 'drop_set' }));
      if (!/дроп|drop/i.test(cycleAuditComments(drop) + cycleAuditWorkSets(drop).map((x: any) => x.technique || '').join(' '))) cycleAuditPush(b, `${c.meta.id}: нет маркера drop_set`);

      const rp = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass', extra({ intTechnique: 'rest_pause' }));
      if (!/рест|rest|пауз/i.test(cycleAuditComments(rp) + cycleAuditWorkSets(rp).map((x: any) => x.technique || '').join(' '))) cycleAuditPush(b, `${c.meta.id}: нет маркера rest_pause`);

      // negative — реальная модификация темпа (оба канала: workSets + comment).
      const neg = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass', extra({ intTechnique: 'negative' }));
      if (cycleAuditSig(base) === cycleAuditSig(neg)) cycleAuditPush(b, `${c.meta.id}: intTechnique negative не влияет`);

      const lin = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass', extra({ loadStrategy: 'linear' }));
      if (cycleAuditSig(base) === cycleAuditSig(lin)) cycleAuditPush(b, `${c.meta.id}: loadStrategy не влияет`);

      const pre = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass', extra({ methodology: 'pre_exhaust' }));
      const isoFirst = pre.weeks.some((w: any) => w.sessions.some((s: any) => s.exercises.length > 1 && s.exercises[0].role !== 'primary'));
      if (!isoFirst) cycleAuditPush(b, `${c.meta.id}: pre_exhaust не двигает изоляцию вперёд`);

      const gvt = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass', extra({ volumeScheme: 'gvt' }));
      if (!cycleAuditWorkSets(gvt).some((x: any) => x.reps === 10)) cycleAuditPush(b, `${c.meta.id}: GVT без 10 повторов`);

      const ss = bbAuditBuild(c.meta.id, 'adapt', 'intermediate', 'male', 'mass', extra({ supersetMode: 'antagonist' }));
      if (!cycleAuditAllEx(ss).some((e: any) => !!e.supersetWith)) cycleAuditPush(b, `${c.meta.id}: supersetMode без пар`);
    }
    expect(b).toEqual([]);
  }, 900000);
});
