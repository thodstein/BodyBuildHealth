import { describe, it, expect } from 'vitest';
import {
  assessShoulderCluster, assessHipScreen, assessKneeValgus, assessRts,
  assessSpineMin, assessAchilles, assessHand, assessElbowValgus,
  scoreBeighton, beightonCutoff, assessBeighton, assessYellow, teenGate,
  rankJointSupport, screenOrtho, orthoGuardsForPlan, buildOrthoCsv, orthoBridgePayload,
  hopLsi, hopLsiOverall, strengthLsiOverall, bbOrthoMobilityAdd, applyOrthoToProfile,
  isRiskyOpenChain, riskyOpenChainIds, decideBbOrthoIntake, subtractTracked,
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

describe('ortho-screen П5 hop-LSI', () => {
  it('LSI = min/max×100; мусор → null', () => {
    expect(hopLsi(180, 200)).toBe(90);
    expect(hopLsi(200, 180)).toBe(90);
    expect(hopLsi(0, 200)).toBeNull();
    expect(hopLsi(-5, 200)).toBeNull();
    expect(hopLsi(undefined, 200)).toBeNull();
    expect(hopLsi(NaN, 200)).toBeNull();
  });
  it('overall = худший из замеренных; пусто → null', () => {
    expect(hopLsiOverall({ singleL: 180, singleR: 200, tripleL: 500, tripleR: 600 }).overall).toBeLessThan(90);
    expect(hopLsiOverall({ singleL: 195, singleR: 200 }).overall).toBe(97.5);
    expect(hopLsiOverall({}).overall).toBeNull();
  });
  it('замер бьёт чекбоксы: LSI≥90 без галок — измерено', () => {
    const r = assessRts({ monthsSinceOp: 9, graft: 'btb', fear: false, preventionProgram: true, hop: { singleL: 195, singleR: 200, tripleL: 590, tripleR: 600 } });
    expect(r.ready).toBe(true);
    expect(r.status).toBe('ready');
  });
  it('замер <90 — не готов с цифрой в причине', () => {
    const r = assessRts({ monthsSinceOp: 9, graft: 'btb', fear: false, preventionProgram: true, hop: { singleL: 150, singleR: 200 } });
    expect(r.ready).toBe(false);
    expect(r.flags[0].label).toMatch(/75%/);
    expect(r.flags[0].action).toMatch(/single 75%/);
  });
});

describe('ortho-screen профиль: wrist/elbow-мэппинг', () => {
  it('кисть → wrist, локоть → elbow (ключи ARM-пула)', () => {
    const r = applyOrthoToProfile([
      { id: 'hand_cluster', joint: 'hand', level: 'doctor', label: 'x', action: 'y', evidence: 'z' },
      { id: 'elbow_valgus', joint: 'elbow', level: 'watch', label: 'x', action: 'y', evidence: 'z' },
    ]);
    expect(r.mobilityAdd).toContain('wrist');
    expect(r.mobilityAdd).toContain('elbow');
  });
  it('гарды моста несут wrist/elbow', () => {
    const r = screenOrtho({ hand: { finkelsteinPain: true }, elbowValgusPain: true });
    expect(orthoGuardsForPlan(r).mobilityAdd).toContain('wrist');
    expect(orthoGuardsForPlan(r).mobilityAdd).toContain('elbow');
  });
});

describe('ortho-screen SM-мост: parseSmBridgePayload ест орто-поля', () => {
  it('mobility/yoke/teen/summary парсятся, мусор режется', async () => {
    const { parseSmBridgePayload } = await import('../../../ui/screens/strength-sport/sm-bridge-intake');
    const p = parseSmBridgePayload({
      orthoGuards: { yokeGate: true, closedChainOnly: true, blockedPatterns: ['vertical_push', '  ', 42], mobilityAdd: ['shoulder', 'knee', 'нос', 'hip'] },
      orthopedic: { blockedPatterns: ['squat'] },
      teenNote: 'Подросток 14–15',
      orthoSummary: 'x'.repeat(500),
    });
    expect(p.orthoYokeGate).toBe(true);
    expect(p.orthoClosedChain).toBe(true);
    expect(p.orthoTeen).toBe(true);
    expect(p.orthoBlocked).toEqual(['squat', 'vertical_push', '42']);
    expect(p.orthoMobility).toEqual(['shoulder', 'knee', 'hip']);
    expect(p.orthoSummary?.length).toBe(200);
    const empty = parseSmBridgePayload({});
    expect(empty.orthoBlocked).toEqual([]);
    expect(empty.orthoTeen).toBe(false);
    expect(empty.orthoSummary).toBeNull();
  });
  it('orthoBlocked ПЛ-словаря → mobility SM/TA (П3)', async () => {
    const { parseSmBridgePayload } = await import('../../../ui/screens/strength-sport/sm-bridge-intake');
    const p = parseSmBridgePayload({ orthopedic: { blockedPatterns: ['vertical_push', 'lunge', 'нос', 'hinge'] } });
    expect(p.orthoBlocked).toEqual(['vertical_push', 'lunge', 'нос', 'hinge']);
    expect(p.orthoMobility).toEqual(['shoulder', 'knee', 'lower_back']);
  });
});

describe('ortho-screen strength-LSI + ББ-хелпер', () => {
  it('сила: квадр/хамс LSI тем же min/max; мусор → null', () => {
    expect(strengthLsiOverall({ quadL: 90, quadR: 100, hamL: 80, hamR: 100 }).overall).toBe(80);
    expect(strengthLsiOverall({}).overall).toBeNull();
    expect(strengthLsiOverall({ quadL: 0, quadR: 100 }).quad).toBeNull();
  });
  it('RTS: сила <90 блокирует даже при hop≥90 (худший побеждает)', () => {
    const r = assessRts({
      monthsSinceOp: 9, graft: 'btb', fear: false, preventionProgram: true,
      hop: { singleL: 195, singleR: 200 }, strength: { quadL: 80, quadR: 100 },
    });
    expect(r.ready).toBe(false);
    expect(r.flags[0].label).toMatch(/80%/);
  });
  it('RTS: сила+hop ≥90 — готов без чекбоксов', () => {
    const r = assessRts({
      monthsSinceOp: 9, graft: 'btb', fear: false, preventionProgram: true,
      hop: { singleL: 195, singleR: 200 }, strength: { quadL: 95, quadR: 100, hamL: 92, hamR: 100 },
    });
    expect(r.ready).toBe(true);
  });
  it('bbOrthoMobilityAdd: паузы + whitelist, чужие режутся', () => {
    expect(bbOrthoMobilityAdd({ pauseOverhead: true, limitDeepSquat: true, mobilityAdd: ['wrist', 'нос', 'knee'] })).toEqual(['shoulder', 'hip', 'wrist']);
    expect(bbOrthoMobilityAdd({ pauseOverhead: false, limitDeepSquat: false, mobilityAdd: [] })).toEqual([]);
  });
  it('decideBbOrthoIntake: пусто — inactive, всё false', () => {
    expect(decideBbOrthoIntake({}, 'linear')).toEqual({
      active: false, mobAdd: [], light: false, deload: false, techNone: false, forceDouble: false, excludeRisky: false, teen: false,
    });
    expect(decideBbOrthoIntake({ orthoGuards: 'мусор' }, 'linear').active).toBe(false);
  });
  it('decideBbOrthoIntake: closedChain — полный щадящий + forceDouble только не-double', () => {
    const g = { pauseOverhead: true, limitDeepSquat: true, closedChainOnly: true, mobilityAdd: ['wrist'] };
    const d = decideBbOrthoIntake({ orthoGuards: g }, 'linear');
    expect(d).toEqual({
      active: true, mobAdd: ['shoulder', 'hip', 'wrist'], light: true, deload: true, techNone: true, forceDouble: true, excludeRisky: true, teen: false,
    });
    expect(decideBbOrthoIntake({ orthoGuards: g }, 'double_progression').forceDouble).toBe(false);
  });
  it('decideBbOrthoIntake: teen без гардов — light/deload/tech, без mobility/exclude', () => {
    const d = decideBbOrthoIntake({ teenNote: 'Подросток 14–15' }, 'wave');
    expect(d.active).toBe(true);
    expect(d.teen).toBe(true);
    expect(d.light && d.deload && d.techNone).toBe(true);
    expect(d.mobAdd).toEqual([]);
    expect(d.excludeRisky).toBe(false);
    expect(d.forceDouble).toBe(false);
  });
});

describe('ortho-screen Э1 risky open-chain', () => {
  it('раскрытие ловится, база — нет', () => {
    expect(isRiskyOpenChain({ name: 'Разводка гантелей лёжа' })).toBe(true);
    expect(isRiskyOpenChain({ name: 'Пек-дек (бабочка)' })).toBe(true);
    expect(isRiskyOpenChain({ name: 'Махи гантелями в стороны' })).toBe(true);
    expect(isRiskyOpenChain({ name: 'Разгибания ног в тренажёре' })).toBe(true);
    expect(isRiskyOpenChain({ name: 'Пуловер с гантелью' })).toBe(true);
    expect(isRiskyOpenChain({ name: 'Французский жим лёжа' })).toBe(true);
    expect(isRiskyOpenChain({ name: 'Cable fly' })).toBe(true);
    expect(isRiskyOpenChain({ name: 'Приседания со штангой' })).toBe(false);
    expect(isRiskyOpenChain({ name: 'Подтягивания широким хватом' })).toBe(false);
    expect(isRiskyOpenChain({ name: 'Отжимания на брусьях' })).toBe(false);
    expect(isRiskyOpenChain({ name: 'Жим штанги лёжа' })).toBe(false);
    expect(isRiskyOpenChain({ name: 'Тяга штанги в наклоне' })).toBe(false);
    expect(isRiskyOpenChain({ name: 'Сгибание рук со штангой' })).toBe(false);
    expect(isRiskyOpenChain({ name: 'Планка' })).toBe(false);
  });
  it('пусто/мусор — безопасно (сейф-дефолт)', () => {
    expect(isRiskyOpenChain(null)).toBe(false);
    expect(isRiskyOpenChain(undefined)).toBe(false);
    expect(isRiskyOpenChain({})).toBe(false);
    expect(isRiskyOpenChain({ name: '' })).toBe(false);
  });
  it('riskyOpenChainIds: только id строкой + cap', () => {
    const cat = [
      { id: 'fly_db', name: 'Разводка гантелей' },
      { id: 'squat', name: 'Присед' },
      { id: 42, name: 'Мусор' },
      { id: 'cable_fly', name: 'Cable fly' },
    ] as any;
    expect(riskyOpenChainIds(cat, 1)).toEqual(['fly_db']);
    expect(riskyOpenChainIds(cat)).toEqual(['fly_db', 'cable_fly']);
    expect(riskyOpenChainIds(null as any)).toEqual([]);
  });
});

describe('ortho-screen Э3 subtractTracked', () => {
  it('вычитает только отслеженные, своё цело', () => {
    expect(subtractTracked(['shoulder', 'hip', 'wrist'], ['shoulder'])).toEqual(['hip', 'wrist']);
    expect(subtractTracked(['hip'], [])).toEqual(['hip']);
    expect(subtractTracked(['hip'], null)).toEqual(['hip']);
    expect(subtractTracked(['hip'], 'мусор')).toEqual(['hip']);
  });
});
