/**
 * pro-quality-analysis.engine.ts — PRO-диагностика качества программы.
 * Учитывает паттерны, углы, растяжку, технику и привязку к выбранной цели.
 * Дополняет базовый volume-score (computePlanQualityFor) без его дублирования.
 *
 * Разделения:
 *  - ББ (гипертрофия): паттерн-многообразие, углы (верх/низ/центр), stretch-фаза, техники, цель mass/cut.
 *  - ПЛ (сила): паттерны присед/жим/тяга + вариации, углы (пауза/дефицит), техника, цель strength/peak.
 *
 * Чистый движок, без UI/storage.
 */
import type { UserProgram } from '../user-program/user-program.types';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { norm } from '../norm';
import { resolveCatalogId } from '../../data/lms-cycles/exercise-alias-map';

export type ProQualityDivision = 'bb' | 'pl';

export interface ProPatternDetail {
  muscle: string;
  patterns: string[];
  expected: string[];
  distinct: number;
  ok: boolean;
  issue?: string;
}

export interface ProAngleDetail {
  muscle: string;
  angles: string[];
  expected: string[];
  coverage: number; // 0..1
  ok: boolean;
  issue?: string;
}

export interface ProStretchDetail {
  muscle: string;
  hasStretch: boolean;
  stretchExercises: string[];
  ok: boolean;
}

export interface ProTechniqueDetail {
  totalBlocks: number;
  withTechnique: number;
  pct: number;
  distinct: string[];
  ok: boolean;
  issue?: string;
}

export interface ProGoalDetail {
  goal: string;
  volumePctAvg: number;
  techniquePct: number;
  stretchCoverage: number;
  ok: boolean;
  issue?: string;
  recommendation?: string;
}

export interface ProQualityResult {
  division: ProQualityDivision;
  goal: string;
  patterns: ProPatternDetail[];
  angles: ProAngleDetail[];
  stretches: ProStretchDetail[];
  technique: ProTechniqueDetail;
  goalAlignment: ProGoalDetail;
  scoreDelta: number; // -30..+5 корректировка к базовому score
  totalIssues: string[];
  totalRecommendations: string[];
}

// ——— хелперы ———

function findMeta(name: string) {
  const aliasId = resolveCatalogId(name);
  if (aliasId) {
    const byId = EXERCISE_CATALOG.find(e => e.id === aliasId);
    if (byId) return byId;
  }
  const n = norm(name);
  let ex = EXERCISE_CATALOG.find(e => norm(e.name) === n);
  if (ex) return ex;
  ex = EXERCISE_CATALOG.find(e => {
    const en = norm(e.name);
    return en.length > 3 && n.length > 3 && (en.includes(n) || n.includes(en));
  });
  return ex || null;
}

function collectExercises(program: UserProgram, division: ProQualityDivision) {
  const out: Array<{ name: string; muscle: string; pattern: string; stretch: boolean; technique: string; sets: number; reps: string; rir: number }> = [];
  if (division === 'bb' && program.bb) {
    for (const w of program.bb.weeks || []) {
      for (const s of w.sessions || []) {
        for (const b of s.blocks || []) {
          const meta = findMeta(b.exerciseName);
          const pattern = meta?.movementPattern || (meta ? (meta as any).substitutionGroup : '') || b.muscle || '';
          const stretch = !!meta?.stretchPhase;
          // Техника может быть в b.technique / b.techniques[0] / b.sets[0].technique (BBPlan workSets) / lastSetTechnique
          const rawTech = ((b as any).technique && (b as any).technique !== 'none' ? (b as any).technique : '')
            || ((b as any).techniques?.[0] || '')
            || ((b as any).sets?.[0]?.technique && (b as any).sets[0].technique !== 'none' ? (b as any).sets[0].technique : '')
            || ((b as any).workSets?.[0]?.technique && (b as any).workSets[0].technique !== 'none' ? (b as any).workSets[0].technique : '')
            || '';
          const tech = rawTech;
          const reps = b.sets?.[0]?.reps != null ? String(b.sets[0].reps) : '';
          const rir = b.sets?.[0]?.rir ?? 2;
          const sets = b.sets?.reduce((a, st) => a + 1, 0) || 0;
          out.push({ name: b.exerciseName, muscle: (b.muscle || meta?.group || '').toLowerCase(), pattern: String(pattern).toLowerCase(), stretch, technique: String(tech).toLowerCase(), sets, reps, rir });
        }
      }
    }
  }
  if (division === 'pl' && program.pl) {
    const weeks = program.pl.customWeeks || [];
    for (const w of weeks) {
      for (const d of w.days || []) {
        for (const ex of d.exercises || []) {
          const meta = findMeta(ex.name);
          const pattern = meta?.movementPattern || ex.lift || ex.muscle || '';
          const stretch = !!meta?.stretchPhase;
          const sets = ex.sets?.reduce((a, s) => a + (s.sets || 1), 0) || 0;
          const reps = ex.sets?.[0]?.reps != null ? String(ex.sets[0].reps) : '';
          const rir = ex.sets?.[0]?.rir ?? 2;
          out.push({ name: ex.name, muscle: (ex.muscle || ex.lift || meta?.group || '').toLowerCase(), pattern: String(pattern).toLowerCase(), stretch, technique: '', sets, reps, rir });
        }
      }
    }
    // для клонированного ПЛ без customWeeks — синтетика уже собрана в CalcQualityTab, но здесь fallback: пусто
  }
  return out;
}

// Ожидаемые паттерны по мышцам (ББ)
const BB_PATTERN_EXPECT: Record<string, string[]> = {
  chest: ['horizontal_push', 'incline_push', 'dip_push', 'decline_push', 'isolation_chest'],
  back: ['vertical_pull', 'horizontal_pull', 'isolation_back', 'hinge'],
  legs: ['squat', 'hinge', 'lunge', 'isolation_legs_quad', 'isolation_legs_ham', 'glute_squat'],
  shoulders: ['vertical_push', 'isolation_shoulders'],
  arms: ['isolation_arms'],
  core: ['core', 'rotation', 'anti_rotation'],
  quads: ['squat', 'isolation_legs_quad', 'lunge'],
  hamstrings: ['hinge', 'isolation_legs_ham'],
  glutes: ['glute_squat', 'hinge', 'squat'],
  calves: ['isolation_calves'],
  biceps: ['isolation_arms'],
  triceps: ['isolation_arms'],
};

const BB_ANGLE_EXPECT: Record<string, string[]> = {
  chest: ['flat', 'upper', 'lower', 'isolation'],
  back: ['vertical', 'horizontal'],
  legs: ['quad-dominant', 'hip-dominant', 'unilateral'],
  shoulders: ['press', 'isolation'],
};

// Маппинг паттерна → угол (упрощенный)
function patternToAngle(pattern: string, muscle: string): string | null {
  const p = pattern.toLowerCase();
  if (muscle === 'chest' || muscle === 'chest') {
    if (p === 'horizontal_push') return 'flat';
    if (p === 'incline_push') return 'upper';
    if (p === 'dip_push' || p === 'decline_push') return 'lower';
    if (p.includes('isolation')) return 'isolation';
  }
  if (muscle === 'back') {
    if (p === 'vertical_pull') return 'vertical';
    if (p === 'horizontal_pull') return 'horizontal';
  }
  if (muscle === 'legs' || muscle === 'quads' || muscle === 'hamstrings' || muscle === 'glutes') {
    if (p === 'squat' || p === 'isolation_legs_quad') return 'quad-dominant';
    if (p === 'hinge' || p === 'isolation_legs_ham' || p === 'glute_squat') return 'hip-dominant';
    if (p === 'lunge') return 'unilateral';
  }
  if (muscle === 'shoulders') {
    if (p === 'vertical_push') return 'press';
    if (p.includes('isolation')) return 'isolation';
  }
  return null;
}

function goalExpectations(goal: string) {
  const g = (goal || '').toLowerCase();
  if (g.includes('strength') || g.includes('сила') || g.includes('powerlifting') || g === 'strength') {
    return { volumePct: [45, 75], rir: [0, 2], techniqueMaxPct: 15, stretchMin: 0.3, label: 'Сила' };
  }
  if (g.includes('cut') || g.includes('сушка')) {
    return { volumePct: [40, 65], rir: [2, 4], techniqueMaxPct: 20, stretchMin: 0.4, label: 'Сушка' };
  }
  if (g.includes('maintenance') || g.includes('поддерж')) {
    return { volumePct: [50, 80], rir: [2, 3], techniqueMaxPct: 20, stretchMin: 0.4, label: 'Поддержание' };
  }
  if (g.includes('recomp') || g.includes('рекомп')) {
    return { volumePct: [60, 85], rir: [1, 3], techniqueMaxPct: 25, stretchMin: 0.5, label: 'Рекомпозиция' };
  }
  // дефолт — масса
  return { volumePct: [75, 95], rir: [1, 3], techniqueMaxPct: 30, stretchMin: 0.6, label: 'Масса' };
}

export function analyzeProQuality(program: UserProgram, division: ProQualityDivision, level: string, goal: string, basePerMuscle?: Array<{ muscle: string; peakSets: number; mrv: number }>): ProQualityResult {
  const exercises = collectExercises(program, division);
  const totalBlocks = exercises.length;
  const issues: string[] = [];
  const recs: string[] = [];
  let delta = 0;

  // ——— Паттерны ———
  const patternDetails: ProPatternDetail[] = [];
  const musclesForPattern = division === 'bb'
    ? ['chest', 'back', 'legs', 'shoulders', 'arms']
    : ['chest', 'back', 'legs']; // ПЛ — ключевые 3

  for (const mu of musclesForPattern) {
    const pats = exercises.filter(e => {
      const m = e.muscle.toLowerCase();
      if (mu === 'legs') return ['legs', 'quads', 'hamstrings', 'glutes', 'calves'].includes(m) || m.includes('quad') || m.includes('ham') || m.includes('glute');
      if (mu === 'arms') return ['arms', 'biceps', 'triceps'].includes(m);
      if (mu === 'shoulders') return m.includes('shoulder') || m.includes('delt');
      return m === mu;
    }).map(e => e.pattern).filter(Boolean);
    const distinct = Array.from(new Set(pats));
    const expected = BB_PATTERN_EXPECT[mu] || [];
    // идеал: для ББ — минимум 2 паттерна для крупных, 1 для малых; для ПЛ — минимум 1
    const need = division === 'bb' ? (mu === 'chest' || mu === 'back' || mu === 'legs' ? 2 : 1) : 1;
    const ok = distinct.length >= need;
    let issue: string | undefined;
    if (!ok && distinct.length > 0) {
      issue = `${mu}: паттернов ${distinct.length} < ${need} — добавьте ${expected.slice(distinct.length).join(', ') || 'вариацию'}`;
      issues.push(`🔀 Паттерн ${mu}: ${distinct.length} < ${need}`);
      recs.push(`➕ ${mu}: добавьте паттерн ${expected.find(p => !distinct.includes(p)) || 'вариацию'} (${expected.join(' / ')})`);
      delta -= 3;
    } else if (distinct.length === 0) {
      // нет упражнений этой группы — не штрафуем как паттерн, это уже объем
    }
    patternDetails.push({ muscle: mu, patterns: distinct, expected, distinct: distinct.length, ok, issue });
  }

  // ——— Углы ———
  const angleDetails: ProAngleDetail[] = [];
  const musclesForAngle = division === 'bb' ? ['chest', 'back', 'legs', 'shoulders'] : ['chest', 'back'];
  for (const mu of musclesForAngle) {
    const expected = BB_ANGLE_EXPECT[mu] || [];
    const angles = exercises.filter(e => {
      const m = e.muscle.toLowerCase();
      if (mu === 'chest') return m === 'chest';
      if (mu === 'back') return m === 'back' || m.includes('lats');
      if (mu === 'legs') return ['legs', 'quads', 'hamstrings', 'glutes'].includes(m);
      if (mu === 'shoulders') return m.includes('shoulder') || m.includes('delt');
      return m === mu;
    }).map(e => patternToAngle(e.pattern, mu)).filter(Boolean) as string[];
    const distinctAngles = Array.from(new Set(angles));
    const coverage = expected.length ? distinctAngles.length / expected.length : 1;
    const ok = coverage >= 0.5; // минимум 50% углов
    let issue: string | undefined;
    if (!ok && distinctAngles.length > 0) {
      issue = `${mu}: углов ${distinctAngles.length}/${expected.length} — добавьте ${expected.filter(a => !distinctAngles.includes(a)).join(', ')}`;
      issues.push(`📐 Углы ${mu}: ${distinctAngles.length}/${expected.length}`);
      recs.push(`➕ ${mu}: добавьте угол ${expected.find(a => !distinctAngles.includes(a))} (есть: ${distinctAngles.join(', ') || 'нет'})`);
      delta -= 4;
    }
    angleDetails.push({ muscle: mu, angles: distinctAngles, expected, coverage, ok, issue });
  }

  // ——— Растяжка ———
  const stretchDetails: ProStretchDetail[] = [];
  const musclesForStretch = division === 'bb' ? ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps'] : ['chest', 'back', 'legs'];
  for (const mu of musclesForStretch) {
    const groupEx = exercises.filter(e => {
      const m = e.muscle.toLowerCase();
      if (mu === 'quads') return m === 'quads' || m === 'legs';
      if (mu === 'hamstrings' || mu === 'glutes') return ['hamstrings', 'glutes', 'legs'].includes(m);
      return m === mu || (mu === 'chest' && m === 'chest') || (mu === 'back' && m === 'back');
    });
    if (groupEx.length === 0) continue;
    const stretchEx = groupEx.filter(e => e.stretch).map(e => e.name);
    const hasStretch = stretchEx.length > 0;
    const ok = hasStretch;
    if (!ok) {
      issues.push(`🧘 Растяжка ${mu}: нет упражнений с stretch-фазой`);
      recs.push(`➕ ${mu}: добавьте упражнение с растяжением (stretchPhase) — напр. ${mu === 'chest' ? 'разводка/жим гантелей' : mu === 'hamstrings' ? 'RDL/румынская' : mu === 'biceps' ? 'наклонная скамья' : 'глубокая амплитуда'}`);
      delta -= 3;
    }
    stretchDetails.push({ muscle: mu, hasStretch, stretchExercises: stretchEx, ok });
  }

  // ——— Техника ———
  const withTech = exercises.filter(e => e.technique && e.technique !== 'none' && e.technique !== '').length;
  const pct = totalBlocks ? Math.round((withTech / totalBlocks) * 100) : 0;
  const distinctTech = Array.from(new Set(exercises.map(e => e.technique).filter(Boolean)));
  let techOk = true;
  let techIssue: string | undefined;
  const lvl = (level || '').toLowerCase();
  const isAdvanced = lvl === 'advanced' || lvl === 'enhanced';
  if (isAdvanced && pct === 0) {
    techOk = false;
    techIssue = 'Нет техник интенсификации для продвинутого — добавьте 10-20% myo/dropset/pause';
    issues.push('⚡ Техника: 0% для продвинутого');
    recs.push('➕ Добавьте техники: myo_reps / drop_set / rest_pause (10-20% блоков)');
    delta -= 5;
  } else if (pct > 40) {
    techOk = false;
    techIssue = `Перебор техник ${pct}% (>40%) — риск недовосстановления`;
    issues.push(`⚡ Техника: ${pct}% — перебор`);
    recs.push('➖ Снизьте долю техник до 15-30%');
    delta -= 5;
  } else if (pct > 30) {
    techOk = false;
    techIssue = `Много техник ${pct}% — на грани`;
    issues.push(`⚡ Техника: ${pct}% — много`);
    delta -= 2;
  }
  const technique: ProTechniqueDetail = { totalBlocks, withTechnique: withTech, pct, distinct: distinctTech, ok: techOk, issue: techIssue };

  // ——— Цель ———
  const exp = goalExpectations(goal);
  let volAvg = 0;
  if (basePerMuscle && basePerMuscle.length) {
    const pcts = basePerMuscle.filter(p => p.mrv > 0).map(p => (p.peakSets / p.mrv) * 100);
    volAvg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  }
  const techPct = pct;
  const stretchCoverage = stretchDetails.length ? stretchDetails.filter(s => s.ok).length / stretchDetails.length : 1;
  let goalOk = true;
  let goalIssue: string | undefined;
  let goalRec: string | undefined;
  if (volAvg > 0) {
    const [low, high] = exp.volumePct;
    if (volAvg < low - 5) {
      goalOk = false;
      goalIssue = `Объём ${volAvg}% < ${low}% для цели «${exp.label}» — недогруз`;
      goalRec = `Увеличьте объём до ${low}-${high}% MRV для ${exp.label}`;
      delta -= 4;
    } else if (volAvg > high + 10) {
      goalOk = false;
      goalIssue = `Объём ${volAvg}% > ${high}% для «${exp.label}» — перегруз`;
      goalRec = `Снизьте объём к ${low}-${high}% MRV`;
      delta -= 4;
    }
  }
  // техника vs цель
  if (exp.techniqueMaxPct != null && techPct > exp.techniqueMaxPct + 10) {
    goalOk = false;
    const msg = `Техники ${techPct}% > ${exp.techniqueMaxPct}% для «${exp.label}»`;
    goalIssue = goalIssue ? goalIssue + '; ' + msg : msg;
    delta -= 2;
  }
  if (stretchCoverage < exp.stretchMin) {
    goalOk = false;
    const msg = `Растяжка ${Math.round(stretchCoverage * 100)}% < ${Math.round(exp.stretchMin * 100)}% для «${exp.label}»`;
    goalIssue = goalIssue ? goalIssue + '; ' + msg : msg;
    delta -= 2;
  }
  if (goalOk && !goalIssue) {
    goalRec = `Цель «${exp.label}» и факт совпадают: объём ${volAvg}% MRV, техники ${techPct}%, растяжка ${Math.round(stretchCoverage * 100)}%`;
  }
  const goalAlignment: ProGoalDetail = { goal: exp.label, volumePctAvg: volAvg, techniquePct: techPct, stretchCoverage, ok: goalOk, issue: goalIssue, recommendation: goalRec };

  // Бонус за идеальное покрытие (если все ок)
  if (patternDetails.every(p => p.ok) && angleDetails.every(a => a.ok) && stretchDetails.every(s => s.ok) && technique.ok && goalOk) {
    delta += 3;
  }

  delta = Math.max(-30, Math.min(5, delta));

  return {
    division,
    goal: exp.label,
    patterns: patternDetails,
    angles: angleDetails,
    stretches: stretchDetails,
    technique,
    goalAlignment,
    scoreDelta: delta,
    totalIssues: issues,
    totalRecommendations: recs,
  };
}
