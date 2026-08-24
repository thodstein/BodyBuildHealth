import { describe, expect, it } from 'vitest';
import {
  STRICT_EXERCISE_GROUPS,
  strictGroupForExercise,
  strictGroupMembersOf,
  ensureStrictGroupCoverage,
} from '../bb-exercise-selection.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { trueMuscleOf } from '../../movement-pattern';

/* ═══════════════════════════════════════════════════════════════════
 * ЖЁСТКИЕ ГРУППЫ ЗАМЕНЫ (требование пользователя):
 * упражнения внутри группы меняются ТОЛЬКО между собой и обязаны
 * присутствовать в сессии мышцы (если группа доступна в пуле).
 * ═══════════════════════════════════════════════════════════════════ */

describe('STRICT_EXERCISE_GROUPS — состав групп', () => {
  it('грудь: разводка гантелей/пек-дек + жим под углом 30° (гантели/Смит/штанга)', () => {
    expect(STRICT_EXERCISE_GROUPS.chest.map(g => g.key)).toEqual(['chest_fly', 'chest_incline']);
    const fly = strictGroupForExercise({ id: 'fly_db', name: 'Разводка гантелей лёжа' }, 'chest')!;
    expect(fly.key).toBe('chest_fly');
    expect(fly.ids).toEqual(['fly_db', 'pec_deck']);
    const incline = strictGroupForExercise({ id: 'incline_bar', name: 'Жим штанги на наклонной (30°)' }, 'chest')!;
    expect(incline.key).toBe('chest_incline');
    expect(incline.ids).toEqual(['incline_bar', 'incline_db', 'smith_incline']);
  });

  it('спина: верхний блок широкий (прямой/параллельный) + тяга лёжа на скамье + Т-тяга', () => {
    expect(STRICT_EXERCISE_GROUPS.back.map(g => g.key)).toEqual(['back_pulldown', 'back_seal', 'back_tbar']);
    expect(strictGroupForExercise({ id: 'pulldown_wide', name: 'Тяга верхнего блока широким хватом' }, 'back')!.key).toBe('back_pulldown');
    expect(strictGroupForExercise({ id: 'pulldown_vbar', name: 'Тяга верхнего блока V-рукоятью' }, 'back')!.key).toBe('back_pulldown');
    // Обычный/обратный хват — НЕ в группе (только широкий прямой/параллельный)
    expect(strictGroupForExercise({ id: 'pulldown', name: 'Тяга верхнего блока (прямой)' }, 'back')).toBeUndefined();
    expect(strictGroupForExercise({ id: 'row_seal', name: 'Тяга лёжа на скамье (seal row)' }, 'back')!.key).toBe('back_seal');
    expect(strictGroupForExercise({ id: 'row_chest_supported', name: 'Тяга с упором грудью' }, 'back')).toBeUndefined();
    expect(strictGroupForExercise({ id: 'row_tbar', name: 'Тяга Т-грифа' }, 'back')!.key).toBe('back_tbar');
    expect(strictGroupForExercise({ id: 'tbar_row_v2', name: 'Тяга Т-грифа (классическая)' }, 'back')!.key).toBe('back_tbar');
  });

  it('бицепс бедра: сгибания ног + гакк/колодец + румынская тяга', () => {
    expect(STRICT_EXERCISE_GROUPS.hamstrings.map(g => g.key)).toEqual(['ham_curl', 'ham_hack', 'ham_rdl']);
    expect(strictGroupForExercise({ id: 'leg_curl', name: 'Сгибания ног в тренажёре лёжа' }, 'hamstrings')!.key).toBe('ham_curl');
    expect(strictGroupForExercise({ id: 'leg_curl_seated', name: 'Сгибания ног сидя' }, 'hamstrings')!.key).toBe('ham_curl');
    expect(strictGroupForExercise({ id: 'hack_squat_ham', name: 'Гакк-присед на бицепс бедра (стопы высоко)' }, 'hamstrings')!.key).toBe('ham_hack');
    expect(strictGroupForExercise({ id: 'well_squat', name: 'Приседания в колодце' }, 'hamstrings')!.key).toBe('ham_hack');
    expect(strictGroupForExercise({ id: 'rdl', name: 'Румынская тяга' }, 'hamstrings')!.key).toBe('ham_rdl');
    expect(strictGroupForExercise({ id: 'rdl_db', name: 'Румынская тяга с гантелями' }, 'hamstrings')!.key).toBe('ham_rdl');
  });

  it('ham_hack: своп гакк-на-бицепс ↔ колодец (члены одной группы)', () => {
    const members = strictGroupMembersOf({ id: 'hack_squat_ham', name: 'Гакк-присед на бицепс бедра (стопы высоко)' }, 'hamstrings');
    expect(members.some(m => m.id === 'well_squat')).toBe(true);
    for (const m of members) {
      expect(m.id === 'hack_squat_ham' || m.id === 'well_squat').toBe(true);
    }
  });

  it('квадрицепс: присед/гакк + разгибания ног сидя', () => {
    expect(STRICT_EXERCISE_GROUPS.quads.map(g => g.key)).toEqual(['quad_squat', 'quad_ext']);
    expect(strictGroupForExercise({ id: 'squat', name: 'Приседания со штангой' }, 'quads')!.key).toBe('quad_squat');
    expect(strictGroupForExercise({ id: 'hack_squat', name: 'Гакк-приседания' }, 'quads')!.key).toBe('quad_squat');
    expect(strictGroupForExercise({ id: 'hack_squat_v2', name: 'Гакк-присед' }, 'quads')!.key).toBe('quad_squat');
    expect(strictGroupForExercise({ id: 'leg_ext', name: 'Разгибания ног в тренажёре' }, 'quads')!.key).toBe('quad_ext');
    expect(strictGroupForExercise({ id: 'leg_ext_v2', name: 'Разгибание ног сидя' }, 'quads')!.key).toBe('quad_ext');
  });
});

describe('strictGroupMembersOf — своп только внутри группы', () => {
  it('разводка гантелей предлагает только разводки/пек-дек (не жимы)', () => {
    const members = strictGroupMembersOf({ id: 'fly_db', name: 'Разводка гантелей лёжа' }, 'chest');
    expect(members.length).toBeGreaterThan(0);
    expect(members.some(m => m.id === 'pec_deck')).toBe(true);
    for (const m of members) {
      expect(/жим|bench|press/i.test(m.name || '')).toBe(false);
    }
  });

  it('жим на наклонной предлагает только наклонные жимы (гантели/Смит/штанга)', () => {
    const members = strictGroupMembersOf({ id: 'incline_bar', name: 'Жим штанги на наклонной (30°)' }, 'chest');
    const ids = members.map(m => m.id);
    expect(ids).toContain('incline_db');
    expect(ids).toContain('smith_incline');
    expect(ids).not.toContain('bench_bar');
    expect(ids).not.toContain('fly_db');
  });

  it('тяга верхнего блока широким хватом предлагает параллельный хват (V)', () => {
    const members = strictGroupMembersOf({ id: 'pulldown_wide', name: 'Тяга верхнего блока широким хватом' }, 'back');
    expect(members.some(m => m.id === 'pulldown_vbar')).toBe(true);
    expect(members.some(m => m.id === 'row_tbar')).toBe(false);
  });

  it('сгибания ног лёжа предлагают сгибания сидя, но не румынскую', () => {
    const members = strictGroupMembersOf({ id: 'leg_curl', name: 'Сгибания ног в тренажёре лёжа' }, 'hamstrings');
    expect(members.some(m => m.id === 'leg_curl_seated')).toBe(true);
    expect(members.some(m => /румын|rdl/i.test(m.name || ''))).toBe(false);
  });

  it('присед со штангой предлагает гакк, но не разгибания ног', () => {
    const members = strictGroupMembersOf({ id: 'squat', name: 'Приседания со штангой' }, 'quads');
    expect(members.some(m => m.id === 'hack_squat')).toBe(true);
    expect(members.some(m => /разгибан.*ног|leg.?extension/i.test(m.name || ''))).toBe(false);
  });

  it('упражнение вне групп (например, брусья) → пустой список (fallback на группу каталога)', () => {
    expect(strictGroupMembersOf({ id: 'dips_chest', name: 'Отжимания на брусьях (грудной стиль)' }, 'chest')).toHaveLength(0);
  });
});

describe('ensureStrictGroupCoverage — обязательное присутствие групп', () => {
  const mkPool = (ids: string[]) => ids.map(id => ({ ...EXERCISE_CATALOG.find(c => c.id === id)!, _score: 0 }));

  it('заменяет упражнение в том же угловом классе, сохраняя количество слотов', () => {
    // Спина: heavy_row-класс (row_bar/row_tbar/row_seal) — seal заменяет row_bar
    const pool = mkPool(['row_bar', 'pulldown', 'row_seal']);
    const exDatas: any[] = [pool[1], pool[0]];
    ensureStrictGroupCoverage(exDatas, pool, 'back', 4, [], [], { isPrimary: true });
    expect(exDatas.length).toBe(2);
    // back_pulldown уже есть (lead), back_seal добирается заменой row_bar → row_seal
    expect(exDatas[0].id).toBe('pulldown');
    expect(exDatas.some(e => e.id === 'row_seal')).toBe(true);
    // back_tbar недоступен в пуле — не добавляется
    expect(exDatas.some(e => e.id === 'row_tbar' || e.id === 'tbar_row_v2')).toBe(false);
  });

  it('при полном слоте не трогает lead и единственных представителей групп', () => {
    const pool = mkPool(['row_bar', 'row_tbar', 'row_seal', 'pulldown']);
    const exDatas: any[] = [pool[3], pool[1]];
    ensureStrictGroupCoverage(exDatas, pool, 'back', 2, [], [], { isPrimary: true });
    expect(exDatas.length).toBe(2);
    // pulldown (lead) не тронут; row_tbar — единственный представитель back_tbar →
    // back_seal не форсируется в этой сессии (появится при ротации heavy_row)
    expect(exDatas[0].id).toBe('pulldown');
    expect(exDatas[1].id).toBe('row_tbar');
  });

  it('группа без членов в пуле или в другом классе пропускается (гакк на бицепс бедра, RDL-класс)', () => {
    const pool = mkPool(['leg_curl', 'leg_curl_seated']);
    const exDatas: any[] = [pool[0], pool[1]];
    const selectedIds: string[] = [];
    const selectedNames: string[] = [];
    ensureStrictGroupCoverage(exDatas, pool, 'hamstrings', 4, selectedIds, selectedNames, { isPrimary: true });
    // ham_hack: члены есть в каталоге, но НЕ в этом пуле → не добавляется
    expect(exDatas.some(e => /гакк|hack|колодец/i.test(e.name || ''))).toBe(false);
    // rdl — другой угловой класс (rdl_bridge vs curl): заменять сгибание нельзя →
    // группа не форсируется в этой сессии (ротация недель принесёт RDL)
    expect(exDatas.some(e => e.id === 'rdl')).toBe(false);
    expect(exDatas.length).toBe(2);
  });
});

describe('buildBBPlan — жёсткие группы присутствуют в программе', () => {
  it('upper/lower 8 нед: грудь всегда с разводкой И жимом 30°; спина с верхним блоком/Т-тягой; ноги с приседом/гакк и разгибаниями', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 8,
      workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
      equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
      volumeGoal: 'mav',
    });
    const g = STRICT_EXERCISE_GROUPS;
    const inGroup = (ex: any, group: any) => group.ids.includes(ex.id) || (group.re && group.re.test(ex.name || ''));
    // ОБЯЗАНЫ БЫТЬ в программе: каждая группа мышцы (доступная в каталоге и
    // покрываемая угловым классом) представлена хотя бы в одной сессии плана.
    // Спина: верхний блок всегда + одна из тяжёлых горизонтальных (seal/Т-тяга)
    // — heavy_row-слот один, и он фиксирован diversity-ротацией.
    const programCoverage = (muscle: string, groups: any[]) => {
      const allExs = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter(e => e.muscle === muscle);
      for (const gr of groups) {
        // Группа доступна, только если в каталоге есть её члены с ИСТИННОЙ мышцей = muscle
        // (гакк-присед — мышца quads, поэтому ham_hack для бицепса бедра недоступен).
        const available = EXERCISE_CATALOG.some(c => trueMuscleOf(c) === muscle
          && (gr.ids.includes(c.id) || (gr.re && gr.re.test(c.name || ''))));
        if (!available) continue;
        expect(allExs.some(e => inGroup(e, gr)), `${muscle}/${gr.key}: ${[...new Set(allExs.map(e => e.name))].join(', ')}`).toBe(true);
      }
    };
    programCoverage('chest', g.chest);
    // Спина: верхний блок обязателен + хотя бы одна тяжёлая горизонтальная тяга (seal ИЛИ Т-тяга)
    {
      const backExs = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter(e => e.muscle === 'back');
      expect(backExs.some(e => inGroup(e, g.back[0])), 'back_pulldown').toBe(true);
      expect(backExs.some(e => inGroup(e, g.back[1]) || inGroup(e, g.back[2])), 'back_seal||back_tbar').toBe(true);
    }
    programCoverage('quads', g.quads);
    programCoverage('hamstrings', g.hamstrings);
    // Счётчики сессий — sanity (upper/lower 8 нед даёт несколько сессий каждой мышцы)
    let chestSessions = 0, backSessions = 0, quadSessions = 0, hamSessions = 0;
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        chestSessions += s.exercises.filter(e => e.muscle === 'chest').length > 0 ? 1 : 0;
        backSessions += s.exercises.filter(e => e.muscle === 'back').length > 0 ? 1 : 0;
        quadSessions += s.exercises.filter(e => e.muscle === 'quads').length > 0 ? 1 : 0;
        hamSessions += s.exercises.filter(e => e.muscle === 'hamstrings').length > 0 ? 1 : 0;
      }
    }
    expect(chestSessions).toBeGreaterThan(0);
    expect(backSessions).toBeGreaterThan(0);
    expect(quadSessions).toBeGreaterThan(0);
    expect(hamSessions).toBeGreaterThan(0);
  });
});