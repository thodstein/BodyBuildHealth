import { describe, it, expect } from 'vitest';
import {
  assessShoulderCluster, assessHipScreen, assessKneeValgus, assessRts,
  assessSpineMin, assessAchilles, assessHand, assessElbowValgus,
  scoreBeighton, beightonCutoff, assessBeighton, assessYellow, teenGate,
  rankJointSupport, screenOrtho, orthoGuardsForPlan, buildOrthoCsv, orthoBridgePayload,
} from '../ortho-screen.engine';

describe('ortho-screen J1 плечо', () => {
  it('0–1/5 — кластер отрицательный', () => {
    const r = assessShoulderCluster({ painfulArc: true });
    expect(r.score).toBe(1);
    expect(r.positive).toBe(false);
    expect(r.flags).toHaveLength(0);
  });
  it('2+/5 — кластер положительный с маршрутом', () => {
    const r = assessShoulderCluster({ painfulArc: true, hawkinsPain: true });
    expect(r.positive).toBe(true);
    expect(r.flags[0].level).toBe('doctor');
    expect(r.flags[0].action).toMatch(/паузу/);
  });
  it('apprehension+dropArm — urgent', () => {
    const r = assessShoulderCluster({ apprehension: true, dropArm: true });
    expect(r.flags[0].level).toBe('urgent');
  });
});

describe('ortho-screen J2 ТБС', () => {
  it('пусто — clear', () => {
    expect(assessHipScreen({}).level).toBe('clear');
  });
  it('1/3 — watch', () => {
    const r = assessHipScreen({ faddirPain: true });
    expect(r.level).toBe('watch');
  });
  it('2/3 или 1+ROM — doctor', () => {
    expect(assessHipScreen({ faddirPain: true, faberPain: true }).level).toBe('doctor');
    expect(assessHipScreen({ faddirPain: true, romFlag: true }).level).toBe('doctor');
  });
});

describe('ortho-screen J3 колено/YBT/RTS', () => {
  it('вальгус SLS — флаг с aOR-строкой', () => {
    const r = assessKneeValgus({ valgusSls: true });
    expect(r.positive).toBe(true);
    expect(r.flags[0].label).toMatch(/SLS/);
  });
  it('YBT триггер ровно >4см (4.0 — нет, 4.1 — да)', () => {
    expect(assessKneeValgus({ ybtAntDiffCm: 4.0 }).positive).toBe(false);
    expect(assessKneeValgus({ ybtAntDiffCm: 4.1 }).positive).toBe(true);
  });
  it('RTS без измерения — not_measured, не ready', () => {
    const r = assessRts({});
    expect(r.ready).toBe(false);
    expect(r.status).toBe('not_measured');
  });
  it('RTS полный — ready', () => {
    const r = assessRts({ lsiMeasured: true, lsiPass: true, monthsSinceOp: 9, graft: 'btb', fear: false, preventionProgram: true });
    expect(r.ready).toBe(true);
  });
  it('RTS hamstring 6 мес — не готов (нужно 7+)', () => {
    const r = assessRts({ lsiMeasured: true, lsiPass: true, monthsSinceOp: 6, graft: 'hamstring', fear: false, preventionProgram: true });
    expect(r.ready).toBe(false);
  });
});

describe('ortho-screen J4 минимум', () => {
  it('SLR — doctor без диагноза', () => {
    const f = assessSpineMin({ slrPain: true });
    expect(f[0].level).toBe('doctor');
    expect(f[0].action).not.toMatch(/грыжа/);
  });
  it('Thompson пара — urgent', () => {
    const f = assessAchilles({ popSound: true, cantHeelRaise: true });
    expect(f[0].level).toBe('urgent');
  });
  it('кисть 0/3 — пусто', () => {
    expect(assessHand({})).toHaveLength(0);
  });
  it('локоть — watch', () => {
    expect(assessElbowValgus(true)[0].level).toBe('watch');
  });
});

describe('ortho-screen J5 Beighton', () => {
  it('счёт 9/9', () => {
    expect(scoreBeighton({ pinkyL: true, pinkyR: true, thumbL: true, thumbR: true, elbowL: true, elbowR: true, kneeL: true, kneeR: true, trunk: true })).toBe(9);
  });
  it('пороги по возрастам 6/5/4', () => {
    expect(beightonCutoff(15)).toBe(6);
    expect(beightonCutoff(30)).toBe(5);
    expect(beightonCutoff(60)).toBe(4);
  });
  it('пограничный + 5PQ≥2 — positive', () => {
    const r = assessBeighton({ pinkyL: true, pinkyR: true, thumbL: true, thumbR: true, age: 30, fivePQ: 2 });
    expect(r.score).toBe(4);
    expect(r.positive).toBe(true);
    expect(r.flags[0].action).toMatch(/Сила НЕ запрещена/);
  });
  it('ниже порога без 5PQ — negative', () => {
    expect(assessBeighton({ pinkyL: true, age: 30 }).positive).toBe(false);
  });
});

describe('ortho-screen yellow/teen/J6', () => {
  it('yellow 0 — пусто', () => {
    expect(assessYellow({})).toHaveLength(0);
  });
  it('teen только 14–15', () => {
    expect(teenGate('adult')).toHaveLength(0);
    expect(teenGate('teen_14_15')[0].action).toMatch(/RIR≥2/);
  });
  it('ранжир: коллаген proven, G+C weak, BPC investigational + WADA', () => {
    const r = rankJointSupport();
    expect(r.find(x => x.id === 'collagen_hydro')!.evidence).toBe('proven');
    expect(r.find(x => x.id === 'glucosamine')!.evidence).toBe('weak');
    const bpc = r.find(x => x.id === 'bpc_tb')!;
    expect(bpc.evidence).toBe('investigational');
    expect(bpc.note).toMatch(/WADA/);
  });
});

describe('ortho-screen J7 агрегатор/гарды/экспорт', () => {
  it('пустой вход — чистый summary', () => {
    const r = screenOrtho({});
    expect(r.flags).toHaveLength(0);
    expect(r.summary).toMatch(/чистый/);
  });
  it('гарды: плечо → vertical_push, колено → yoke, Beighton → closed-chain', () => {
    const r = screenOrtho({ shoulder: { painfulArc: true, hawkinsPain: true }, knee: { valgusSls: true }, beighton: { pinkyL: true, pinkyR: true, thumbL: true, thumbR: true, elbowL: true } });
    const g = orthoGuardsForPlan(r);
    expect(g.pauseOverhead).toBe(true);
    expect(g.blockedPatterns).toContain('vertical_push');
    expect(g.yokeGate).toBe(true);
    expect(g.closedChainOnly).toBe(true);
  });
  it('CSV с BOM и шапкой', () => {
    const r = screenOrtho({ shoulder: { painfulArc: true, hawkinsPain: true } });
    const csv = buildOrthoCsv(r);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toMatch(/joint,level,label,action/);
  });
  it('bridge payload несёт флаги и гарды', () => {
    const r = screenOrtho({ shoulder: { painfulArc: true, hawkinsPain: true } });
    const p = orthoBridgePayload(r, orthoGuardsForPlan(r)) as any;
    expect(p.orthoFlags.length).toBeGreaterThan(0);
    expect(p.orthoGuards.pauseOverhead).toBe(true);
  });
  it('bridge замыкает живые контуры: orthopedic.blockedPatterns в ПЛ + teenNote в ББ', () => {
    const r = screenOrtho({ shoulder: { painfulArc: true, hawkinsPain: true }, beighton: undefined, yellow: undefined, ageBand: 'teen_14_15' });
    const p = orthoBridgePayload(r, orthoGuardsForPlan(r)) as any;
    // ПЛ-контур: SRCBBScreen читает orthopedic.blockedPatterns
    expect(p.orthopedic.blockedPatterns).toContain('vertical_push');
    // ББ-контур: приёмник читает teenNote
    expect(typeof p.teenNote).toBe('string');
    expect(p.teenNote).toMatch(/14–15/);
    // Без teen — честный null, не пустая строка
    const r2 = screenOrtho({ shoulder: { painfulArc: true, hawkinsPain: true } });
    expect((orthoBridgePayload(r2, orthoGuardsForPlan(r2)) as any).teenNote).toBeNull();
  });
});
