/**
 * bb-stimulus-target.test.ts — «стимул в цель» (пилот руки+дельты).
 * Головки / сетап / линия / читинг / RIR / синергисты / скор + интеграция в диагноз и ранжир.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveStimulus,
  headsHitOf,
  alternativesForHead,
  setupGuideFor,
  diagnoseStimulusTarget,
  headsForMuscle,
  HEAD_FUNCTIONS,
} from '../bb-stimulus-target.engine';
import { diagnoseExercise } from '../bb-exercise-diagnosis.engine';
import { rankCorrectionsForWeak } from '../bb-correction-rank.engine';
import { getProfExecutionProfile } from '../bb-execution-prof.engine';

describe('resolve + головки', () => {
  it('блок по id резолвится', () => {
    const r = resolveStimulus({ id: 'tricep_pushdown_rope' });
    expect(r?.key).toBe('pushdown');
  });
  it('блок по русскому имени резолвится', () => {
    const r = resolveStimulus({ name: 'Разгибание на блоке с канатом' });
    expect(r?.key).toBe('pushdown');
  });
  it('блок бьёт в латеральную, мимо длинной', () => {
    expect(headsHitOf({ id: 'tricep_pushdown_rope' })).toContain('triceps_lateral');
    expect(headsHitOf({ id: 'tricep_pushdown_rope' })).not.toContain('triceps_long');
  });
  it('overhead бьёт в длинную', () => {
    expect(headsHitOf({ id: 'overhead_tricep_ext' })).toContain('triceps_long');
  });
  it('наклонное сгибание бьёт в длинную бицепса', () => {
    expect(headsHitOf({ id: 'incline_db_curl' })).toContain('biceps_long');
  });
  it('молот бьёт в брахиалис, мимо длинной', () => {
    const h = headsHitOf({ id: 'hammer_curl' });
    expect(h).toContain('brachialis');
    expect(h).not.toContain('biceps_long');
  });
  it('махи бьют в среднюю дельту', () => {
    expect(headsHitOf({ id: 'lateral_raise' })).toContain('delt_mid');
  });
  it('без записи (планка) — neutral', () => {
    expect(resolveStimulus({ id: 'plank', name: 'Планка' })).toBe(null);
  });
  it('headsForMuscle покрывает руки/плечи', () => {
    expect(headsForMuscle('triceps')).toContain('triceps_long');
    expect(headsForMuscle('biceps')).toContain('brachialis');
    expect(headsForMuscle('shoulders')).toContain('delt_mid');
  });
  it('HEAD_FUNCTIONS: у длинной трицепса — условие overhead', () => {
    expect(HEAD_FUNCTIONS.triceps_long.stretchCondition).toMatch(/над головой|за головой/);
  });
});

describe('wrongHead — мимо слабой головки', () => {
  it('блок при weakHead=triceps_long → wrongHead + альтернативы', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { weakHead: 'triceps_long' });
    expect(d.flags).toContain('wrongHead');
    expect(d.issues.join(' ')).toMatch(/Французский|из-за головы/);
    expect(d.score as number).toBeLessThan(100);
  });
  it('overhead при weakHead=triceps_long → тихо', () => {
    const d = diagnoseStimulusTarget({ id: 'overhead_tricep_ext' }, { weakHead: 'triceps_long' });
    expect(d.flags).not.toContain('wrongHead');
    expect(d.score).toBe(100);
  });
  it('молот при weakHead=biceps_long → wrongHead', () => {
    const d = diagnoseStimulusTarget({ id: 'hammer_curl' }, { weakHead: 'biceps_long' });
    expect(d.flags).toContain('wrongHead');
  });
  it('махи при weakHead=delt_rear → wrongHead', () => {
    const d = diagnoseStimulusTarget({ id: 'lateral_raise' }, { weakHead: 'delt_rear' });
    expect(d.flags).toContain('wrongHead');
  });
});

describe('сетап / линия / читинг / ROM / RIR', () => {
  it('локти вперёд на блоке → synergistTakeover в дельту', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { setupIssues: ['локти ушли вперёд'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.flags).toContain('setupRisk');
    expect(d.issues.join(' ')).toMatch(/дельта/);
  });
  it('блок без паузы → resistanceLineGap', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { tempoHasPause: false });
    expect(d.flags).toContain('resistanceLineGap');
  });
  it('блок с паузой → линии тихо', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { tempoHasPause: true });
    expect(d.flags).not.toContain('resistanceLineGap');
  });
  it('укороченная амплитуда → romShort с нормой', () => {
    const d = diagnoseStimulusTarget({ id: 'incline_db_curl' }, { rangeFull: false });
    expect(d.flags).toContain('romShort');
    expect(d.issues.join(' ')).toMatch(/Полный вис|амплитуд/i);
  });
  it('читинг → stabilityGap и просадка stability', () => {
    const d = diagnoseStimulusTarget({ id: 'lateral_raise' }, { cheating: true });
    expect(d.flags).toContain('stabilityGap');
    expect(d.breakdown?.stability).toBeLessThan(80);
  });
  it('недожим изоляции RIR 4 → rirMismatch', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { rirActual: 4 });
    expect(d.flags).toContain('rirMismatch');
    expect(d.issues.join(' ')).toMatch(/Недожим/);
  });
  it('пережим базы RIR 0 → rirMismatch', () => {
    const d = diagnoseStimulusTarget({ id: 'ohp' }, { rirActual: 0 });
    expect(d.flags).toContain('rirMismatch');
    expect(d.issues.join(' ')).toMatch(/Пережим/);
  });
  it('норма RIR 2 на блоке → тихо', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { rirActual: 2 });
    expect(d.flags).not.toContain('rirMismatch');
  });
  it('без тапов — только выводимое из плана (тихо)', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, {});
    expect(d.flags).toEqual([]);
    expect(d.score).toBe(100);
  });
});

describe('скор и breakdown', () => {
  it('breakdown 6 компонент 0-100', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { cheating: true, rirActual: 5 });
    expect(Object.keys(d.breakdown || {}).sort()).toEqual(['effort', 'line', 'profile', 'rom', 'setup', 'stability'].sort());
    for (const v of Object.values(d.breakdown || {})) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
  it('читинг+недожим роняют скор (100-12-8=80)', () => {
    const d = diagnoseStimulusTarget({ id: 'tricep_pushdown_rope' }, { cheating: true, rirActual: 5 });
    expect(d.score).toBe(80);
    expect(d.breakdown?.stability).toBeLessThan(80);
    expect(d.breakdown?.effort).toBeLessThan(80);
  });
  it('alternativesForHead(long) ведёт в overhead', () => {
    expect(alternativesForHead('triceps_long').join(' ')).toMatch(/Французский|Overhead|из-за головы/);
  });
  it('setupGuideFor: чеклист + утечки', () => {
    const g = setupGuideFor('triceps');
    expect(g.checklist.length).toBeGreaterThan(0);
    expect(g.leaks.length).toBeGreaterThan(0);
  });
});

describe('интеграция в diagnoseExercise', () => {
  it('блок + weakHead long → wrongHead в флагах диагноза', () => {
    const d = diagnoseExercise(
      { id: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', rir: 2 } as any,
      { muscle: 'triceps', weakHead: 'triceps_long' } as any,
    );
    expect(d.flags).toContain('wrongHead');
    expect(d.stimulus?.score).toBeLessThan(100);
  });
  it('блок RIR 4 → rirMismatch в диагнозе', () => {
    const d = diagnoseExercise(
      { id: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', rir: 4 } as any,
      { muscle: 'triceps' } as any,
    );
    expect(d.flags).toContain('rirMismatch');
  });
  it('без записи — silent neutral (планка)', () => {
    const d = diagnoseExercise(
      { id: 'plank', name: 'Планка', muscle: 'abs', rir: 2, tempo: '3-1-1-0', pauseSeconds: 1 } as any,
      { muscle: 'abs' } as any,
    );
    expect(d.stimulus?.score).toBe(null);
    expect(d.flags).not.toContain('wrongHead');
  });
  it('скор диагноза в 0-100', () => {
    const d = diagnoseExercise(
      { id: 'tricep_pushdown_rope', name: 'Разгибание на блоке', muscle: 'triceps', rir: 5 } as any,
      { muscle: 'triceps', weakHead: 'triceps_long', cheating: true, rangeFull: false } as any,
    );
    expect(d.score).toBeGreaterThanOrEqual(0);
    expect(d.score).toBeLessThan(100);
  });
});

describe('интеграция в ранжир', () => {
  it('weakHead=triceps_long топит overhead первым', () => {
    const r = rankCorrectionsForWeak('triceps', null, { weakHead: 'triceps_long' } as any);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].headsHit).toContain('triceps_long');
    expect(r[0].reason).toMatch(/головку/);
  });
  it('без weakHead порядок прежний (SFR-первый)', () => {
    const r = rankCorrectionsForWeak('triceps', null, {});
    expect(r.length).toBeGreaterThan(0);
  });
});

describe('PROF сетап/утечки', () => {
  it('трицепс PROF: чеклист + утечка', () => {
    const p = getProfExecutionProfile('triceps');
    expect(p?.setupChecklist?.length).toBeGreaterThan(0);
    expect(p?.leakTo).toMatch(/дельта/);
  });
  it('средняя дельта PROF: утечка в трапецию', () => {
    expect(getProfExecutionProfile('delt_mid')?.leakTo).toMatch(/трапеция/);
  });
  it('верх груди PROF: сетап 30° + утечка в дельту', () => {
    const p = getProfExecutionProfile('chest_upper');
    expect(p?.setupChecklist?.join(' ')).toMatch(/30°/);
    expect(p?.leakTo).toMatch(/дельта/);
  });
  it('квадрицепс PROF: утечка полуприседа', () => {
    expect(getProfExecutionProfile('quads')?.leakTo).toMatch(/полуприсед|растянутая/i);
  });
});

describe('грудь: головки и wrongHead', () => {
  it('incline бьёт в верх', () => {
    expect(headsHitOf({ id: 'incline_db' })).toContain('chest_upper');
  });
  it('плоский жим бьёт в середину, мимо верха', () => {
    const h = headsHitOf({ id: 'bench_bar' });
    expect(h).toContain('chest_mid');
    expect(h).not.toContain('chest_upper');
  });
  it('брусья бьют в низ', () => {
    expect(headsHitOf({ id: 'dips_chest' })).toContain('chest_lower');
  });
  it('плоский при weakHead=chest_upper → wrongHead + подсказка 30°', () => {
    const d = diagnoseStimulusTarget({ id: 'bench_bar' }, { weakHead: 'chest_upper' });
    expect(d.flags).toContain('wrongHead');
    expect(d.issues.join(' ')).toMatch(/30°|наклон/i);
  });
  it('incline при weakHead=chest_upper → тихо', () => {
    const d = diagnoseStimulusTarget({ id: 'incline_db' }, { weakHead: 'chest_upper' });
    expect(d.flags).not.toContain('wrongHead');
  });
  it('угол 45° на incline → synergistTakeover в дельту', () => {
    const d = diagnoseStimulusTarget({ id: 'incline_bar' }, { setupIssues: ['угол 45 градусов'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/дельта/);
  });
  it('кроссовер без паузы → resistanceLineGap (пик в сокращённой)', () => {
    const d = diagnoseStimulusTarget({ id: 'pec_deck' }, { tempoHasPause: false });
    expect(d.flags).toContain('resistanceLineGap');
  });
  it('weakHeadForZone: chest_upper прямо, chest→mid, traps→traps', async () => {
    const mod = await import('../bb-stimulus-target.engine');
    expect(mod.weakHeadForZone('chest_upper')).toBe('chest_upper');
    expect(mod.weakHeadForZone('chest')).toBe('chest_mid');
    expect(mod.weakHeadForZone('traps')).toBe('traps');
    expect(mod.weakHeadForZone('quads')).toBe('quads');
  });
});

describe('спина: ширина vs толщина', () => {
  it('подтягивания бьют в ширину', () => {
    expect(headsHitOf({ id: 'pullup' })).toContain('back_width');
  });
  it('тяга штанги бьёт в толщину', () => {
    expect(headsHitOf({ id: 'row_bar' })).toContain('back_thickness');
  });
  it('тяга при weakHead=back_width → wrongHead + альтернатива', () => {
    const d = diagnoseStimulusTarget({ id: 'row_bar' }, { weakHead: 'back_width' });
    expect(d.flags).toContain('wrongHead');
    expect(d.issues.join(' ')).toMatch(/Подтягивания|верхнего блока/);
  });
  it('подтягивания при weakHead=back_thickness → wrongHead', () => {
    const d = diagnoseStimulusTarget({ id: 'pulldown' }, { weakHead: 'back_thickness' });
    expect(d.flags).toContain('wrongHead');
  });
  it('тяга за голову → synergistTakeover (шея/плечи)', () => {
    const d = diagnoseStimulusTarget({ id: 'pulldown' }, { setupIssues: ['тяну за голову'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/шея|плеч/i);
  });
  it('раскачка в тяге → stabilityGap', () => {
    const d = diagnoseStimulusTarget({ id: 'row_bar' }, { cheating: true });
    expect(d.flags).toContain('stabilityGap');
  });
});

describe('ноги и ягодицы', () => {
  it('присед бьёт в квадрицепс', () => {
    expect(headsHitOf({ id: 'squat' })).toContain('quads');
  });
  it('разгибания бьют в квадрицепс (пик short)', () => {
    const d = diagnoseStimulusTarget({ id: 'leg_ext' }, { tempoHasPause: false });
    expect(d.flags).toContain('resistanceLineGap');
  });
  it('RDL бьёт в бицепс бедра', () => {
    expect(headsHitOf({ id: 'rdl' })).toContain('hamstrings');
  });
  it('сгибания бьют в бицепс бедра', () => {
    expect(headsHitOf({ id: 'leg_curl' })).toContain('hamstrings');
  });
  it('хип-траст бьёт в ягодицы', () => {
    expect(headsHitOf({ id: 'hip_thrust' })).toContain('glutes');
  });
  it('икры резолвятся и бьют в calves', () => {
    expect(headsHitOf({ id: 'calf_raise' })).toContain('calves');
  });
  it('полуприсед (таp: присед + укороченная) → romShort', () => {
    const d = diagnoseStimulusTarget({ id: 'squat' }, { rangeFull: false });
    expect(d.flags).toContain('romShort');
  });
  it('вальгус в приседе → synergistTakeover (связки)', () => {
    const d = diagnoseStimulusTarget({ id: 'squat' }, { setupIssues: ['колени внутрь'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/вальгус|связк/i);
  });
  it('кругление в RDL → synergistTakeover (диски)', () => {
    const d = diagnoseStimulusTarget({ id: 'rdl' }, { setupIssues: ['круглая поясница, кругление'] });
    expect(d.flags).toContain('synergistTakeover');
  });
  it('переразгибание в трасте → утечка в поясницу', () => {
    const d = diagnoseStimulusTarget({ id: 'hip_thrust' }, { setupIssues: ['переразгибание поясницы'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/поясница/);
  });
  it('пружинки на икрах → stabilityGap? нет — читинг-запись: короткая амплитуда', () => {
    const d = diagnoseStimulusTarget({ id: 'calf_raise' }, { setupIssues: ['короткая амплитуда, пружиню'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/ахилл/);
  });
});

describe('ранжир по головкам грудь/спина', () => {
  it('weakHead=chest_upper топит incline', () => {
    const r = rankCorrectionsForWeak('chest', null, { weakHead: 'chest_upper' } as any);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].headsHit).toContain('chest_upper');
  });
  it('weakHead=back_width топит вертикальную тягу', () => {
    const r = rankCorrectionsForWeak('back', null, { weakHead: 'back_width' } as any);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].headsHit).toContain('back_width');
  });
});

describe('трапеции / предплечья / пресс', () => {
  it('шраги бьют в traps', () => {
    expect(headsHitOf({ id: 'shrug_db' })).toContain('traps');
  });
  it('запястья бьют в forearms', () => {
    expect(headsHitOf({ id: 'wrist_curl' })).toContain('forearms');
  });
  it('скручивания бьют в abs', () => {
    expect(headsHitOf({ id: 'crunch' })).toContain('abs');
  });
  it('подъём ног бьёт в abs', () => {
    expect(headsHitOf({ id: 'hanging_leg' })).toContain('abs');
  });
  it('вращение плечами в шрагах → synergistTakeover', () => {
    const d = diagnoseStimulusTarget({ id: 'shrug_bar' }, { setupIssues: ['вращаю плечами по кругу'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toContain('сустав');
  });
  it('шраги без паузы → resistanceLineGap', () => {
    const d = diagnoseStimulusTarget({ id: 'shrug_db' }, { tempoHasPause: false });
    expect(d.flags).toContain('resistanceLineGap');
  });
  it('подъём корпуса вместо скручивания → сгибатели бедра', () => {
    const d = diagnoseStimulusTarget({ id: 'crunch' }, { setupIssues: ['поднимаю корпус вместо скручивания'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/сгибатели бедра/);
  });
  it('вис без подкручивания таза → сгибатели бедра', () => {
    const d = diagnoseStimulusTarget({ id: 'hanging_leg' }, { setupIssues: ['ноги без подкручивания таза'] });
    expect(d.flags).toContain('synergistTakeover');
  });
  it('предплечья RIR 5 → rirMismatch (недожим)', () => {
    const d = diagnoseStimulusTarget({ id: 'wrist_curl' }, { rirActual: 5 });
    expect(d.flags).toContain('rirMismatch');
  });
  it('weakHeadForZone: traps/forearms/abs/core', async () => {
    const mod = await import('../bb-stimulus-target.engine');
    expect(mod.weakHeadForZone('traps')).toBe('traps');
    expect(mod.weakHeadForZone('forearms')).toBe('forearms');
    expect(mod.weakHeadForZone('abs')).toBe('abs');
    expect(mod.weakHeadForZone('core')).toBe('abs');
  });
  it('ранжир traps топит шраги', () => {
    const r = rankCorrectionsForWeak('traps', null, { weakHead: 'traps' } as any);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].headsHit).toContain('traps');
  });
  it('ранжир abs топит скручивания/вис', () => {
    const r = rankCorrectionsForWeak('abs', null, { weakHead: 'abs' } as any);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].headsHit).toContain('abs');
  });
  it('тапы хаба доходят через diagnoseExercise (читинг+укороченная)', () => {
    const d = diagnoseExercise(
      { id: 'shrug_bar', name: 'Шраги со штангой', muscle: 'traps', rir: 2 } as any,
      { muscle: 'traps', weakHead: 'traps', cheating: true, rangeFull: false } as any,
    );
    expect(d.flags).toContain('stabilityGap');
    expect(d.flags).toContain('romShort');
    expect(d.stimulus?.score).toBeLessThan(100);
  });
  it('PROF traps/forearms/abs: сетап и утечки', () => {
    expect(getProfExecutionProfile('traps')?.leakTo).toMatch(/моментум|сустав/i);
    expect(getProfExecutionProfile('forearms')?.leakTo).toMatch(/бицепс/);
    expect(getProfExecutionProfile('abs')?.leakTo).toMatch(/сгибатели бедра|шея/i);
  });
});

describe('трицепс-база: жим узким и брусья', () => {
  it('жим узким бьёт в латеральную', () => {
    expect(headsHitOf({ id: 'bench_closegrip' })).toContain('triceps_lateral');
    expect(headsHitOf({ name: 'Жим узким хватом' })).toContain('triceps_lateral');
  });
  it('вертикальные брусья бьют в латеральную', () => {
    expect(headsHitOf({ id: 'dips_tricep' })).toContain('triceps_lateral');
    expect(headsHitOf({ name: 'Отжимания на брусьях (трицепсовый стиль)' })).toContain('triceps_lateral');
  });
  it('грудные брусья остались за низом груди', () => {
    expect(headsHitOf({ id: 'dips_chest' })).toContain('chest_lower');
    expect(headsHitOf({ name: 'Отжимания на брусьях (грудной стиль)' })).toContain('chest_lower');
  });
  it('жим узким при weakHead=chest_mid → wrongHead (плохой строитель груди)', () => {
    const d = diagnoseStimulusTarget({ id: 'close_grip_bench' }, { weakHead: 'chest_mid' });
    expect(d.flags).toContain('wrongHead');
  });
  it('наклон вперёд на трицепсовых брусьях → утечка в низ груди', () => {
    const d = diagnoseStimulusTarget({ id: 'dips_tricep' }, { setupIssues: ['наклоняюсь вперёд'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/низ груди/);
  });
  it('локти в стороны в жиме узким → грудь вместо трицепса', () => {
    const d = diagnoseStimulusTarget({ id: 'bench_closegrip' }, { setupIssues: ['локти разъезжаются в стороны'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/середина груди|плечи/);
  });
  it('ранжир трицепса не выкидывает базу фильтром (постранично)', () => {
    const seen = new Set<string>();
    const found = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const page = rankCorrectionsForWeak('triceps', null, { inPlanIds: [...seen] });
      if (!page.length) break;
      for (const c of page) {
        seen.add(c.id);
        if (c.id === 'close_grip_bench' || c.id === 'dips_tricep') found.add(c.id);
      }
    }
    expect(found).toEqual(new Set(['close_grip_bench', 'dips_tricep']));
  });
});

describe('становая и отжимания', () => {
  it('классика бьёт в бицепс бедра', () => {
    expect(headsHitOf({ id: 'deadlift' })).toContain('hamstrings');
    expect(headsHitOf({ name: 'Становая тяга (классика)' })).toContain('hamstrings');
  });
  it('отжимания бьют в середину груди', () => {
    expect(headsHitOf({ id: 'pushup' })).toContain('chest_mid');
    expect(headsHitOf({ name: 'Отжимания от пола' })).toContain('chest_mid');
  });
  it('кругление в становой → диски', () => {
    const d = diagnoseStimulusTarget({ id: 'deadlift' }, { setupIssues: ['круглю поясницу, кругление'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/диски/);
  });
  it('локти 90° в отжиманиях → плечи', () => {
    const d = diagnoseStimulusTarget({ id: 'pushup' }, { setupIssues: ['локти строго 90° в стороны'] });
    expect(d.flags).toContain('synergistTakeover');
    expect(d.issues.join(' ')).toMatch(/плечевой сустав/);
  });
  it('отжимания при weakHead=chest_upper → wrongHead', () => {
    const d = diagnoseStimulusTarget({ id: 'pushup' }, { weakHead: 'chest_upper' });
    expect(d.flags).toContain('wrongHead');
  });
});
