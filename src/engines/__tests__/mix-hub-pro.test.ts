/** mix-hub-pro.test.ts — PRO-план миксов (эпики A–G). */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildDefaultStack, calculateMixScore, resolveTemplateItems, buildBestRecipe,
  type MixProfile,
} from '../training-mix-scoring.engine';
import { caffeineMgFor, evidenceFor, isUnderdosed, referenceMg } from '../mix-evidence-doses.engine';
import { mixSafetyGates } from '../mix-safety-gates.engine';
import {
  analyzeMixEffectiveness, buildMixExportHtml, buildMixExportCsv, toggleMixPhaseIntake,
} from '../training-plan-save.engine';

const baseProfile = (over: Partial<MixProfile> = {}): MixProfile => ({
  goal: 'pump', timing: 'pre', weightKg: 80, isOnCycle: false,
  drugs: { insulin: false, igf: false, gh: false, mgf: false, glp1: false },
  hasNandrolone: false,
  userElectrolytes: { sodiumMmolL: 140, potassiumMmolL: 4.2, chlorideMmolL: 102 },
  workoutType: 'moderate', timeOfDay: 'morning', workoutDurationMin: 90,
  ...over,
});

beforeEach(() => { localStorage.clear(); });

describe('A: честные дозы', () => {
  it('кофеин — 3 мг/кг с капом 400', () => {
    expect(caffeineMgFor(80)).toBe(240);
    expect(caffeineMgFor(200)).toBe(400);
  });
  it('PL-стек: креатин 5 г (не 8 г), кофеин по весу', () => {
    const stack = buildDefaultStack('powerlifting', 'pre', 80, 1.5);
    const cr = stack.find(s => s.id === 'creatine')!;
    expect(cr.mg).toBe(5000);
    const caf = stack.find(s => s.id === 'caffeine')!;
    expect(caf.mg).toBe(240);
  });
  it('OKG имеет свой id (не глутамин)', () => {
    const stack = buildDefaultStack('powerlifting', 'pre', 80, 1.5);
    expect(stack.some(s => s.id === 'okg')).toBe(true);
  });
  it('HBCD интра с капом', () => {
    const stack = buildDefaultStack('endurance', 'intra', 80, 4);
    const hb = stack.find(s => s.id === 'hbcd')!;
    expect(hb.mg).toBeLessThanOrEqual(120000);
  });
  it('экдистерон — грейд WADA', () => {
    expect(evidenceFor('ecdysterone')?.grade).toBe('WADA');
  });
  it('underdosed-границы', () => {
    expect(isUnderdosed('citrulline', 1000)).toBe(true);
    expect(isUnderdosed('citrulline', 6000)).toBe(false);
    expect(referenceMg('caffeine', 80)).toBe(240);
  });
});

describe('B: скоринг v2', () => {
  it('монотонен по дозе', () => {
    const lo = calculateMixScore([{ id: 'citrulline', name: 'Ц', doseMg: 1000 }], baseProfile());
    const hi = calculateMixScore([{ id: 'citrulline', name: 'Ц', doseMg: 6000 }], baseProfile());
    expect(hi.pumpScore).toBeGreaterThan(lo.pumpScore);
  });
  it('бета-аланин вне острого pre-скора (chronic-only)', () => {
    const s = calculateMixScore([{ id: 'beta_alanine', name: 'БА', doseMg: 4000 }], baseProfile({ timing: 'pre' }));
    expect(s.enduranceScore).toBe(0);
    expect(s.substanceBreakdown[0].baseScore).toBe(0);
  });
  it('пресет-вещества скорятся (коллаген)', () => {
    const s = calculateMixScore([{ id: 'collagen', name: 'Кол', doseMg: 15000 }], baseProfile({ goal: 'joint', timing: 'post' }));
    expect(s.recoveryScore).toBeGreaterThan(0);
    expect(s.compositeScore).toBeGreaterThan(0);
  });
  it('onCycle не надувает скор', () => {
    const subs = [{ id: 'citrulline', name: 'Ц', doseMg: 6000 }];
    const a = calculateMixScore(subs, baseProfile({ isOnCycle: false }));
    const b = calculateMixScore(subs, baseProfile({ isOnCycle: true }));
    expect(b.compositeScore).toBe(a.compositeScore);
  });
});

describe('C: гейты', () => {
  it('кофеин-кап — блок', () => {
    const g = mixSafetyGates([{ id: 'caffeine', mg: 500 }], { caffeineMg: 500, bwKg: 80, hasInsulin: false });
    expect(g.some(x => x.code === 'caffeine_over_cap' && x.level === 'block')).toBe(true);
  });
  it('инсулин — блок с врачом', () => {
    const g = mixSafetyGates([{ id: 'creatine', mg: 5000 }], { caffeineMg: 0, bwKg: 80, hasInsulin: true });
    expect(g.some(x => x.code === 'insulin_doctor' && x.level === 'block')).toBe(true);
  });
  it('цинк-стек UL', () => {
    const g = mixSafetyGates([{ id: 'zinc', mg: 30 }, { id: 'zinc', mg: 20 }], { caffeineMg: 0, bwKg: 80, hasInsulin: false });
    expect(g.some(x => x.code === 'zinc_ul')).toBe(true);
  });
  it('вечерний кофеин — варн', () => {
    const g = mixSafetyGates([{ id: 'caffeine', mg: 200 }], { caffeineMg: 200, bwKg: 80, hasInsulin: false, timeOfDay: 'evening' });
    expect(g.some(x => x.code === 'caffeine_evening')).toBe(true);
  });
});

describe('D: рецепты', () => {
  it('инсулин+ГПП-1 даёт insulin_only (не null)', () => {
    const r = buildBestRecipe(baseProfile({ drugs: { insulin: true, insulinDose: 5, insulinTiming: 'post', igf: false, gh: false, mgf: false, glp1: true } }));
    expect(r).not.toBeNull();
    expect(r!.recipe.id).toBe('insulin_only');
  });
  it('5 препаратов (4+ГПП-1) дают полный коктейль', () => {
    const r = buildBestRecipe(baseProfile({ drugs: { insulin: true, insulinDose: 5, insulinTiming: 'post', igf: true, igfDose: 50, igfTiming: 'post', gh: true, ghDose: 5, ghTiming: 'pre', mgf: true, mgfDose: 200, mgfTiming: 'pre', glp1: true } }));
    expect(r).not.toBeNull();
    expect(r!.recipe.id).toBe('full_anabolic_cocktail');
  });
});

describe('E: юниты', () => {
  it('г/кг раскрывается в абсолют', () => {
    const [r] = resolveTemplateItems([{ id: 'protein', dose: '0.4', unit: 'г/кг', note: '' }], 1, 80);
    expect(r.unit).toBe('г');
    expect(r.dose).toBe('32');
    expect(r.mg).toBe(32000);
  });
  it('МЕ и порц не врут в мг', () => {
    const [d3] = resolveTemplateItems([{ id: 'vitamin_d3', dose: '2000', unit: 'МЕ', note: '' }], 1, 80);
    expect(d3.mg).toBe(0);
    const [zma] = resolveTemplateItems([{ id: 'zma', dose: '1', unit: 'порц', note: '' }], 1, 80);
    expect(zma.mg).toBe(0);
  });
});

describe('F: эффект v2', () => {
  it('minPerGroup режет 1 vs 1', () => {
    toggleMixPhaseIntake('2026-08-10', 'mix_1', 'pre');
    const r = analyzeMixEffectiveness([
      { date: '2026-08-10', overallRPE: 8, totalVolume: 12000 },
      { date: '2026-08-12', overallRPE: 7, totalVolume: 10000 },
    ], { minPerGroup: 5 });
    expect(r).toBeNull();
  });
  it('дефолт совместим (2 vs 2)', () => {
    toggleMixPhaseIntake('2026-08-10', 'mix_1', 'pre');
    toggleMixPhaseIntake('2026-08-11', 'mix_1', 'pre');
    const r = analyzeMixEffectiveness([
      { date: '2026-08-10', overallRPE: 8, totalVolume: 12000 },
      { date: '2026-08-11', overallRPE: 9, totalVolume: 14000 },
      { date: '2026-08-12', overallRPE: 7, totalVolume: 10000 },
      { date: '2026-08-13', overallRPE: 6, totalVolume: 9000 },
    ]);
    expect(r).not.toBeNull();
  });
});

describe('Финал 1–6: дозы/инфо/ориентир/сплит/мелочи', () => {
  it('П1: в сигнатуре нет множителя — дозы только по весу', () => {
    expect(buildDefaultStack.length).toBe(4);
    const a = buildDefaultStack('pump', 'pre', 60, 1.5);
    const b = buildDefaultStack('pump', 'pre', 100, 1.5);
    // Весозависимые позиции различаются, статичные — нет
    expect(a.find(s => s.id === 'glycerol')!.mg).toBeLessThan(b.find(s => s.id === 'glycerol')!.mg);
    expect(a.find(s => s.id === 'creatine')!.mg).toBe(b.find(s => s.id === 'creatine')!.mg);
  });
  it('П2: фарма/ААС — инфо, скор не мутирует', () => {
    const subs = [{ id: 'citrulline', name: 'Ц', doseMg: 6000 }, { id: 'creatine', name: 'Кр', doseMg: 5000 }];
    const plain = calculateMixScore(subs, baseProfile());
    const drug = calculateMixScore(subs, baseProfile({ drugs: { insulin: true, insulinDose: 5, insulinTiming: 'post', igf: true, igfDose: 50, igfTiming: 'post', gh: true, ghDose: 5, ghTiming: 'pre', mgf: true, mgfDose: 200, mgfTiming: 'pre', glp1: false }, aas: ['trenbolone'] }));
    expect(drug.pumpScore).toBe(plain.pumpScore);
    expect(drug.recoveryScore).toBe(plain.recoveryScore);
    expect(drug.compositeScore).toBe(plain.compositeScore);
    expect(drug.drugModifiers.length).toBeGreaterThan(plain.drugModifiers.length);
    expect(drug.drugModifiers.every(m => m.bonus === 0)).toBe(true);
  });
  it('strength/focus/HIIT/MMA — кофеин по весу, БА chronic, экдистерон WADA', () => {
    const st = buildDefaultStack('strength', 'pre', 60, 1.5);
    expect(st.find(s => s.id === 'caffeine')!.mg).toBe(180);
    expect(st.find(s => s.id === 'beta_alanine')!.name).toMatch(/курсом/);
    expect(st.find(s => s.id === 'ecdysterone')!.note).toMatch(/WADA/);
    const fo = buildDefaultStack('focus', 'pre', 60, 1.5);
    expect(fo.find(s => s.id === 'caffeine')!.mg).toBeLessThanOrEqual(200);
    const hi = buildDefaultStack('hiit', 'pre', 60, 1.5);
    expect(hi.find(s => s.id === 'caffeine')!.mg).toBe(180);
    const mm = buildDefaultStack('mma', 'pre', 100, 1.5);
    expect(mm.find(s => s.id === 'caffeine')!.mg).toBe(200);
  });
  it('endurance-глицерол по весу', () => {
    const st = buildDefaultStack('endurance', 'pre', 90, 1.5);
    expect(st.find(s => s.id === 'glycerol')!.mg).toBe(90000);
  });
  it('нормы нейтральны к стажу и дню', () => {
    const a = calculateMixScore([{ id: 'citrulline', name: 'Ц', doseMg: 6000 }], baseProfile({ experience: 'novice', dayType: 'legs' }));
    const b = calculateMixScore([{ id: 'citrulline', name: 'Ц', doseMg: 6000 }], baseProfile({ experience: 'advanced', dayType: 'push' }));
    expect(a.recommendedCarbsG).toBe(b.recommendedCarbsG);
    expect(a.recommendedWaterMl).toBe(b.recommendedWaterMl);
  });
  it('гейты из профиля: АГ/беременность/teen/антикоагулянт', () => {
    expect(mixSafetyGates([{ id: 'caffeine', mg: 200 }], { caffeineMg: 200, bwKg: 80, hasInsulin: false, hasHypertension: true }).some(g => g.code === 'caffeine_htn')).toBe(true);
    expect(mixSafetyGates([{ id: 'caffeine', mg: 100 }], { caffeineMg: 100, bwKg: 60, hasInsulin: false, isPregnant: true }).some(g => g.code === 'caffeine_pregnancy')).toBe(true);
    expect(mixSafetyGates([{ id: 'melatonin', mg: 3 }], { caffeineMg: 0, bwKg: 60, hasInsulin: false, melatoninMg: 3, ageYears: 15 }).some(g => g.code === 'melatonin_teen')).toBe(true);
    expect(mixSafetyGates([{ id: 'omega3', mg: 3000 }], { caffeineMg: 0, bwKg: 80, hasInsulin: false, omega3MgTotal: 3000, takesAnticoagulant: true }).some(g => g.code === 'omega3_anticoag')).toBe(true);
  });
  it('competition-цель строится (PL-путь)', () => {
    const st = buildDefaultStack('competition', 'pre', 80, 1.5);
    expect(st.length).toBeGreaterThan(5);
    expect(st.find(s => s.id === 'creatine')!.mg).toBe(5000);
  });
  it('presetEffect null без замеров после', async () => {
    const { saveMixToDiary } = await import('../training-plan-save.engine');
    const d = new Date(); d.setDate(d.getDate() - 3);
    const ds = d.toISOString().slice(0, 10);
    localStorage.setItem('he_sleep_diary', JSON.stringify([
      { date: '2026-01-01', hours: 6.5 }, { date: '2026-01-02', hours: 6.8 }, { date: '2026-01-03', hours: 7.0 },
    ]));
    const rec = saveMixToDiary({ title: 'Сон', kind: 'preset', goal: 'sleep', substances: [] }, ds);
    const { analyzePresetEffect } = await import('../training-plan-save.engine');
    expect(analyzePresetEffect(rec)).toBeNull();
  });
  it('напоминания персистентны', async () => {
    const { scheduleMixReminder, readMixReminders } = await import('../../ui/screens/TrainingScreen_parts/MixDiarySection');
    scheduleMixReminder('Тест', 30, 'mix_x');
    expect(readMixReminders().some(r => r.id === 'mix_x')).toBe(true);
  });
  it('goal-фильтр эффективности', () => {
    toggleMixPhaseIntake('2026-08-10', 'mix_1', 'pre');
    toggleMixPhaseIntake('2026-08-11', 'mix_1', 'pre');
    const r = analyzeMixEffectiveness([
      { date: '2026-08-10', overallRPE: 8, totalVolume: 12000 },
      { date: '2026-08-11', overallRPE: 9, totalVolume: 14000 },
      { date: '2026-08-12', overallRPE: 7, totalVolume: 10000 },
      { date: '2026-08-13', overallRPE: 6, totalVolume: 9000 },
    ] as any, { minPerGroup: 1, goal: 'pump' });
    expect(r).not.toBeNull();
    expect(r!.withMix.sessions).toBe(2);
  });
});

describe('Финал-2 (доделка): шаблоны/множитель/goal-проводка', () => {
  it('шаблонный кофеин — на вес с капом', async () => {
    const { MIX_TEMPLATES } = await import('../training-mix-scoring.engine');
    const tpl = MIX_TEMPLATES.find(t => t.id === 'fat_loss')!;
    const caf = tpl.pre.find(i => i.id === 'caffeine')!;
    expect(caf.dosePerKg).toBe(3);
    const lo = resolveTemplateItems([caf], 1, 60);
    expect(lo[0].mg).toBe(180);
    const hi = resolveTemplateItems([caf], 1, 150);
    expect(hi[0].mg).toBe(300);
    expect(hi[0].dose).toBe('300');
  });
  it('пост-экдистерон с WADA-пометкой', () => {
    const st = buildDefaultStack('strength', 'post', 80, 1.5);
    const ecd = st.find(s => s.id === 'ecdysterone');
    if (ecd) expect(ecd.note).toMatch(/WADA/);
  });
  it('нормы нейтральны к курсу', () => {
    const subs = [{ id: 'citrulline', name: 'Ц', doseMg: 6000 }];
    const a = calculateMixScore(subs, baseProfile({ isOnCycle: false }));
    const b = calculateMixScore(subs, baseProfile({ isOnCycle: true }));
    expect(b.recommendedCarbsG).toBe(a.recommendedCarbsG);
    expect(b.recommendedEAAG).toBe(a.recommendedEAAG);
  });
  it('attachMixGoalsToWorkouts маппит goal по приёму', async () => {
    const mod = await import('../training-plan-save.engine');
    localStorage.setItem('he_training_mixes', JSON.stringify([
      { id: 'mix_9', title: 'Микс', kind: 'mix', goal: 'strength', substances: [], recommendations: null, date: '2026-08-10', ts: 1 },
    ]));
    localStorage.setItem('he_support_diary', JSON.stringify([
      { date: '2026-08-10', mixIntake: { mix_9: { pre: true } } },
    ]));
    const out = mod.attachMixGoalsToWorkouts([
      { date: '2026-08-10' },
      { date: '2026-08-11' },
    ]);
    expect(out[0].goal).toBe('strength');
    expect(out[1].goal).toBeUndefined();
  });
});

describe('groupRecipeItemsByTiming: дедуп по id+таймингу', () => {
  it('дубли схлопываются, тайминги раскладываются', async () => {
    const { groupRecipeItemsByTiming } = await import('../training-mix-scoring.engine');
    const g = groupRecipeItemsByTiming([
      { id: 'creatine', dose: '5', unit: 'г', note: '', mg: 5000, timing: 'post' },
      { id: 'creatine', dose: '5', unit: 'г', note: '', mg: 5000, timing: 'post' },
      { id: 'caffeine', dose: '200', unit: 'мг', note: '', mg: 200, timing: 'pre' },
    ]);
    expect(g.post.length).toBe(1);
    expect(g.pre.length).toBe(1);
    expect(g.intra.length).toBe(0);
  });
});

describe('G: экспорт', () => {
  it('HTML экранирует XSS, CSV с BOM', () => {
    const html = buildMixExportHtml([{ id: '1', title: '<script>alert(1)</script>', kind: 'mix', goal: 'pump', substances: [], recommendations: null, date: '2026-09-01', ts: 1 } as any]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    const csv = buildMixExportCsv([{ id: '1', title: '=cmd', kind: 'mix', goal: 'pump', substances: [], recommendations: null, date: '2026-09-01', ts: 1 } as any]);
    expect(csv.charCodeAt(0)).toBe(65279);
    expect(csv).toContain("'=cmd");
  });
});
