import type { BBPlan } from './bb-builder.engine';
import { syncBBPlanSetShape, validateBBPlan } from './bb-validator.engine';
import { tidySessionExercises, orderSessionExercises } from './bb-session-order.engine';
import { aggregateBBVolume, buildBBVolumeTarget, exerciseVolumeContributions, indirectMuscleContributions, sessionLimitsFor as centralizedSessionLimits } from './bb-volume.engine';
import { estimateBBSessionCost, fitBBSessionToBudget } from './bb-fatigue.engine';
import { analyzeBBRotation } from './bb-rotation.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { trueMuscleOf, derivePattern } from '../movement-pattern';
import { bbExerciseTier } from './bb-exercise-tier.engine';
import { isAxialLoadExercise } from '../exercise-selector.engine';
import { computeVolumeLandmarks, getVolumeLandmarks } from '../volume-landmarks.engine';
import { buildBBPlanReport } from './bb-report.engine';
import { analyzeBBBalance } from './bb-balance.engine';
import { applyTaperToFinalWeeks } from './bb-autocoach.engine';
import { analyzePlanStress } from './bb-injury-prevention.engine';
import { annotateBackExercise, backQualityIssues, verticalPullProfile, classifyLegExercise, annotateArmExercise, armQualityIssues, classifyArmExercise, classifyBackExercise } from './bb-back-quality.engine';
import { WEAK_TO_MUSCLE } from './bb-builder.engine';
import { normalizeWeekMrv } from './bb-builder.engine';
import { isMobilityRestricted } from './bb-mobility.engine';
import { expandDonorMuscles, specResForWeekSchedule, tradeoffForWeek, type SpecializationSchedule } from './bb-specialization.engine';

/** Слабая подгруппа → обязательный функциональный паттерн (специализация:
 *  не просто больше сетов, а целевое упражнение под слабое место). */
const WEAK_PATTERN_REQ: Record<string, RegExp> = {
  chest_upper: /жим.*(наклонн|incline)|(наклонн|incline).*жим/i,
  chest_mid: /жим лёжа|жим.*лёж|bench/i,
  chest_lower: /жим.*(нижн|decline)|decline.*press|брус|dip/i,
  back_width: /подтяг|верхн.*блок|lat.?pull|пуловер|прям.*рук/i,
  back_thickness: /тяга|row/i,
  upper_back: /лиц.*тяга|face.?pull|тяга.*груд|upper.?back/i,
  rear_delts: /обратн|rear|задн.*дельт|лиц.*тяга|face.?pull/i,
  traps: /шраг|shrug/i,
  quads: /присед|жим.*ног|leg.?press|разгибан.*ног/i,
  hamstrings: /сгибан.*ног|румын|rdl|гудморнинг|good.?morning/i,
  glutes: /мост|hip.?thrust|отведен.*бедр|abduction|kick.?back/i,
  calves: /носк|calf/i,
  delt_mid: /мах|lateral|отведен.*рук/i,
  delt_front: /жим.*стоя|жим.*сидя|армейск|front.?raise|перед.*собой/i,
  delt_rear: /обратн|rear|задн.*дельт|лиц.*тяга|face.?pull/i,
  biceps: /сгибан|curl/i,
  triceps: /разгибан|pushdown|француз|french|жим.*узк|close.?grip/i,
  forearms: /запяст|wrist|зоттман/i,
  abs: /скручиван|crunch|подъём.*ног/i,
  lower_back: /гиперэкстенз|back.?extension/i,
};

/** Канонические мышцы-доноры недели по tradeoff-политике расписания.
 *  Additive-проходы финализатора обязаны НЕ возвращать этим мышцам объём. */
function tradeoffDonorsForWeek(options: BBFinalizeOptions, week: number): Set<string> {
  const schedule = options.specializationSchedule;
  if (!schedule) return new Set();
  const policy = tradeoffForWeek(schedule, week);
  if (!policy || policy.mode === 'none' || policy.donorMuscles.length === 0) return new Set();
  return new Set(expandDonorMuscles(policy.donorMuscles).map(m => WEAK_TO_MUSCLE[m] || m));
}

/**
 * Специализация/слабые группы: гарантирует целевой паттерн для каждой слабой
 * подгруппы в релевантной сессии. Не просто больше сетов — конкретное
 * упражнение под слабое место (chest_upper → наклонный жим, back_width →
 * вертикальная тяга и т.д.). Заменяет непрофильную изоляцию; при отсутствии
 * слотов добавляет 3 сета памп (в пределах лимитов сессии).
 */
function ensureWeakPatternCoverage(session: any, options: BBFinalizeOptions): void {
  if (options.preserveSource) return;
  const weakPoints = options.priorityMuscles || [];
  if (!weakPoints.length) return;
      const working = session.exercises.filter((e: any) => !(e as any).warmupActivator);
  for (const wp of weakPoints) {
    const pattern = WEAK_PATTERN_REQ[wp];
    if (!pattern) continue;
    const canonical = WEAK_TO_MUSCLE[wp] || wp;
        const hasAny = working.some((e: any) => (e.muscle || '') === canonical);
    if (!hasAny) continue; // сессия не релевантна слабой группе
    // Паттерн проверяем ТОЛЬКО на упражнениях canonical мышцы (иначе «Тяга
    // штанги в наклоне» или «Подъём на наклонной скамье» ловят чужие regex).
    const canonicalItems = working.filter((e: any) => (e.muscle || '') === canonical);
    if (canonicalItems.some((e: any) => pattern.test(e.name || ''))) continue; // паттерн уже есть
    // Замена: непрофильная изоляция слабой мышцы → целевой паттерн. Если
    // изоляций нет (все жимы primary) — заменяем второй primary (не главный
    // compound), чтобы слабая подгруппа получила целевое движение.
    const slot = canonicalItems.find((e: any) => e.role === 'accessory' && !pattern.test(e.name || ''))
      || canonicalItems.filter((e: any) => e.role === 'primary' && !pattern.test(e.name || '')).slice(1)[0];
        if (slot) {
      const candidate = EXERCISE_CATALOG.find((x: any) => {
        if (trueMuscleOf(x) !== canonical) return false;
        if (!pattern.test(x.name || '')) return false;
        if (working.some((e: any) => e.name === x.name)) return false;
        if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
        if (isMobilityRestricted(x, options.mobilityRestrictions)) return false;
        return true;
      });
      if (candidate) {
        slot.name = candidate.name;
        slot.exerciseName = candidate.name;
        // Целевое движение слабой группы защищено от budget-фита (не удаляется).
        slot.role = 'primary';
        slot.rationale = `Специализация: слабая «${wp}» → ${candidate.name}`;
      }
      continue;
    }
    // Нет слотов — добавляем, если позволяет лимит упражнений сессии.
    const maxEx = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 18 : options.level === 'enhanced' && (options.trainingYears ?? 0) >= 1 ? 14 : 10;
    if (working.length >= maxEx) continue;
    const candidate = EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== canonical) return false;
      if (!pattern.test(x.name || '')) return false;
      if (working.some((e: any) => e.name === x.name)) return false;
      if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
      if (isMobilityRestricted(x, options.mobilityRestrictions)) return false;
      return true;
    });
    if (!candidate) continue;
    const baseWeight = options.workMax?.[canonical] || 50;
    session.exercises.push({
      muscle: canonical, name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: 'памп',
      sets: 3, repsRange: [12, 18], rir: 3, restSeconds: 60, warmupSets: [],
      workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 3, weight: Math.round(baseWeight * 0.35 * 10) / 10, restSeconds: 60 })),
      rationale: `Специализация: слабая «${wp}» → ${candidate.name} (памп 3×12-18)`,
    });
  }
}

const SMALL_MUSCLES = new Set(['biceps', 'triceps', 'forearms', 'calves', 'traps', 'abs', 'shoulders']);

function dedupeAdaptivePatterns(session: { exercises: any[] }, priorityMuscles: string[] = [], optionsHighVolumeBack = false): void {
  const priority = new Set(priorityMuscles);
  const counts = new Map<string, number>();
  const ranked = session.exercises.map((exercise, index) => ({ exercise, index })).sort((a, b) => {
    const primary = (b.exercise.role === 'primary' ? 1 : 0) - (a.exercise.role === 'primary' ? 1 : 0);
    if (primary) return primary;
    const priorityDiff = (priority.has(a.exercise.muscle) ? 1 : 0) - (priority.has(b.exercise.muscle) ? 1 : 0);
    return priorityDiff || a.index - b.index;
  });
  const keep = new Set<any>();
  for (const item of ranked) {
    const muscle = item.exercise.muscle || '';
    const pattern = item.exercise.muscle === 'back'
      ? (annotateBackExercise(item.exercise).movementPattern || derivePattern(item.exercise))
      : derivePattern(item.exercise);
    const key = `${muscle}:${pattern}`;
    const highVolumeBack = muscle === 'back' && optionsHighVolumeBack;
    const cap = highVolumeBack
      ? (pattern === 'vertical_pull' ? 1 : pattern === 'heavy_row' ? 2 : 1)
      : (SMALL_MUSCLES.has(muscle) ? 1 : 2);
    const count = counts.get(key) || 0;
    // Back specialization is not a license for repeated primary rows. Keep
    // the pattern cap even for primary exercises; volume is distributed into
    // distinct patterns/sets instead of duplicating the same row every day.
    if (count >= cap && (item.exercise.role !== 'primary' || (optionsHighVolumeBack && muscle === 'back'))) continue;
    counts.set(key, count + 1);
    keep.add(item.exercise);
  }
  session.exercises = session.exercises.filter(exercise => keep.has(exercise));
  }

/**
 * Финальная раскладка back-бюджета для experienced enhanced.
 * Нельзя оставлять вторую Upper/Pull-сессию с одним движением только из-за
 * freshness/rotation. Добавляются реальные упражнения из каталога, а не
 * переименованные копии; затем бюджет распределяется по ним.
 */
function allocateExperiencedBackSession(session: any, week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  if (tradeoffDonorsForWeek(options, (week as any)?.week ?? 0).has('back')) return;
  // FullBody уже планирует back штатно через buildSession; дополнительный
  // allocation здесь вытесняет ноги/руки/плечи из остальных FullBody-сессий.
  if (!/^(Upper|UpperPower|UpperHyp|Pull|Back|ChestBack|Torso)$/i.test(session.sessionTag || '')) return;
    // Чередование тяж/памп для про: нечётный день — тяж (horizontal rows 4-5×6-10
  // RIR 1-2, механическое напряжение); чётный — памп (vertical + lat-изоляции
  // 3-4×12-18 RIR 3, метаболический стресс).
  const heavyDay = (session.day ?? 1) % 2 === 1;

  let current: any[] = session.exercises.filter((e: any) => e.muscle === 'back' && !(e as any).warmupActivator);
  // Переработка существующих back-упражнений под характер дня (тяж/памп).
  for (const e of current) {
    if (heavyDay) {
      e.character = 'тяж';
      e.rir = Math.min(e.rir ?? 2, 2);
      e.repsRange = [6, 10];
    } else {
      e.character = 'памп';
      e.rir = 3;
      e.repsRange = [12, 18];
      if (e.sets > 4) { e.sets = 4; e.workSets = e.workSets.slice(0, 4); }
    }
  }
  // В adapt библиотечная FullBody-программа может вообще не содержать back
  // после исходной фильтрации. Добавляем back-блок только в каждую вторую
  // подходящую сессию, чтобы не превратить FullBody в ежедневный Pull-день.
  if (!current.length) {
    if (session.day % 2 === 0) return;
    const seed = EXERCISE_CATALOG.find((x: any) => trueMuscleOf(x) === 'back' && /row|тяга/i.test(x.name));
    if (!seed) return;
    const wm = options.workMax?.back || 80;
    const base = {
      muscle: 'back', name: seed.name, exerciseName: seed.name, role: 'primary', character: 'тяж',
      sets: 4, repsRange: [8, 12], rir: 2, exerciseType: seed.type || 'compound', restSeconds: 150,
      workSets: Array.from({ length: 4 }, () => ({ reps: 10, rir: 2, weight: Math.round(wm * 0.65 * 10) / 10, restSeconds: 150 })),
      warmupSets: [], rationale: 'Experienced enhanced adapt: back budget allocation', comment: 'Адаптация: добавлен полноценный блок спины.',
    };
    session.exercises.push(base);
    current = [base];
  }
  const years = options.trainingYears ?? 0;
  // FullBody — не back-день: здесь спина не должна вытеснять ноги/руки/плечи.
  // В FullBody-сессии back-блок ограничен до 3 упражнений / 12 сетов.
  const isFullBody = /FullBody/i.test(session.sessionTag || '');
  const targetExercises = isFullBody ? 3 : (years >= 6 ? 6 : 5);
  const targetSets = isFullBody ? 12 : (years >= 6 ? 22 : 18);
  // Чередование тяж/памп для про: нечётный день — тяж (horizontal rows 4-5×6-10
  // RIR 1-2, механическое напряжение); чётный — памп (vertical + lat-изоляции
  // 3-4×12-18 RIR 3, метаболический стресс). Паттерны в памп-день не тяжёлые.
  const patternOrder = heavyDay
    ? ['heavy_row', 'supported_row', 'unilateral_row', 'vertical_pull', 'lat_isolation', 'upper_back']
    : ['vertical_pull', 'lat_isolation', 'upper_back', 'heavy_row', 'supported_row', 'unilateral_row'];
  const usedNames = new Set(current.map(e => e.name));
  const usedPatterns = new Set(current.map(e => annotateBackExercise(e).movementPattern));
  const template = current[0];
  const allowed = (candidate: any) => {
    if (trueMuscleOf(candidate) !== 'back') return false;
    if (usedNames.has(candidate.name)) return false;
    if (options.avoidAxialLoad && isAxialLoadExercise(candidate)) return false;
    // Bodyweight capability: без подтверждённой способности подтягивания не
    // выбираются как primary — берём pulldown/машину вместо.
    if (/подтяг|pull.?up|chin/i.test(candidate.name || '')) {
      const cap = options.bodyweightCapability;
      const canPullUp = cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0);
      if (!canPullUp) return false;
    }
    if (options.equipment?.length) {
      const eq = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
      if (eq.length && !eq.some((x: string) => options.equipment!.includes(x))) return false;
    }
    return true;
  };

  // Приоритет: закрыть разные функциональные классы, а не набрать ещё один
  // верхний блок. Каталог остаётся источником реального названия упражнения.
  // В памп-день вертикальные тяги/лат-изоляции получают приоритет над тяжёлыми
  // горизонтальными тягами (чередование тяж/памп).
  for (const wantedPattern of patternOrder) {
    if (current.length >= targetExercises) break;
    if (usedPatterns.has(wantedPattern)) continue;
    const candidate = EXERCISE_CATALOG.find((x: any) => allowed(x) && annotateBackExercise({ ...template, name: x.name } as any).movementPattern === wantedPattern);
    if (!candidate) continue;
    const tagged: any = annotateBackExercise({ ...template, name: candidate.name } as any);
    const added: any = structuredClone(template);
    added.name = candidate.name;
    added.exerciseName = candidate.name;
    added.movementPattern = tagged.movementPattern;
    added.backSubgroup = tagged.backSubgroup;
    added.role = 'primary';
    added.sets = Math.max(3, Math.min(5, template.sets || 4));
    // Тяж-день: rows тяжёлые (6-10 reps). Памп-день: vertical/lat лёгкие (12-18).
    if (!heavyDay) {
      added.character = 'памп';
      added.rir = 3;
      added.repsRange = [12, 18];
      const sample = template.workSets?.[template.workSets.length - 1] || { reps: 15, rir: 3, weight: 0 };
      added.workSets = Array.from({ length: added.sets }, () => ({ ...sample, reps: 15, rir: 3 }));
    } else {
      added.character = 'тяж';
      added.rir = Math.min(added.rir ?? 2, 2);
      added.repsRange = [6, 10];
    }
    session.exercises.push(added);
    current.push(added);
    usedNames.add(candidate.name);
    usedPatterns.add(wantedPattern);
  }

  // Если каталог не дал все классы, увеличиваем рабочие подходы в уже
  // выбранных реальных движениях до profile target.
  let total = current.reduce((sum, e) => sum + (e.sets || 0), 0);
  for (const exercise of current) {
    while (total < targetSets && exercise.sets < 5) {
      const sample = exercise.workSets?.[exercise.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
      exercise.sets += 1;
      exercise.workSets.push({ ...sample });
      total += 1;
    }
    if (total >= targetSets) break;
  }
  // Cap 5 сетов/упражнение: если target не достигнут (22-18 сетов), добираем
  // ДОПОЛНИТЕЛЬНЫМ упражнением (а не 6-8 подходами в одном движении).
  if (total < targetSets && current.length < targetExercises) {
    for (const candidate of EXERCISE_CATALOG) {
      if (total >= targetSets || current.length >= targetExercises) break;
      if (!allowed(candidate)) continue;
      if (usedNames.has(candidate.name)) continue;
      const candidatePattern = annotateBackExercise({ ...template, name: candidate.name } as any).movementPattern;
      if (usedPatterns.has(candidatePattern)) continue;
      const added: any = structuredClone(template);
      added.name = candidate.name;
      added.exerciseName = candidate.name;
      added.movementPattern = candidatePattern;
      added.backSubgroup = annotateBackExercise({ ...template, name: candidate.name } as any).backSubgroup;
      added.role = 'primary';
      added.sets = Math.min(5, Math.max(3, targetSets - total));
      if (!heavyDay) {
        added.character = 'памп';
        added.rir = 3;
        added.repsRange = [12, 18];
      } else {
        added.character = 'тяж';
        added.rir = Math.min(added.rir ?? 2, 2);
        added.repsRange = [6, 10];
      }
      const sample = template.workSets?.[template.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
      added.workSets = Array.from({ length: added.sets }, () => ({ ...sample }));
      session.exercises.push(added);
      current.push(added);
      usedNames.add(candidate.name);
      usedPatterns.add(candidatePattern);
      total += added.sets;
    }
  }
  }

/**
 * Баланс спины width/thickness (план D): широчайшие (vertical + lat-изоляции)
 * не должны быть ниже 60% объёма толщины (rows), если не указана слабая
 * подгруппа. Добираем сеты width-упражнений до 5 (cap) или добавляем
 * vertical/lat-упражнение в пределах лимитов сессии.
 */
function ensureBackBalance(session: any, week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource) return;
  if (tradeoffDonorsForWeek(options, (week as any)?.week ?? 0).has('back')) return;
  // Deload: не добираем/не добавляем (объём восстановительный; добавление
  // новых упражнений в deload даёт 1-сетовые после deload-протокола).
  if (week && ((week as any).phase === 'deload' || (week as any).deload)) return;
  const back = session.exercises.filter((e: any) => e.muscle === 'back' && !(e as any).warmupActivator);
  if (!back.length) return;
  const isWidth = (p: string) => p === 'vertical_pull' || p === 'lat_isolation';
  const isThickness = (p: string) => p === 'heavy_row' || p === 'supported_row' || p === 'unilateral_row';
  let width = 0, thickness = 0;
  for (const e of back) {
    const p = annotateBackExercise(e).movementPattern || '';
    if (isWidth(p)) width += e.sets;
    else if (isThickness(p)) thickness += e.sets;
  }
  if (thickness <= 0 || width >= thickness * 0.6) return;
  const target = Math.ceil(thickness * 0.6);
  const usedNames = new Set(back.map((e: any) => e.name));
  const maxEx = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 18 : 10;
  const workingCount = session.exercises.filter((e: any) => !(e as any).warmupActivator).length;
  // Vertical в сессии уже есть (любой профиль) → добираем lat_isolation (пуловер),
  // чтобы не создавать дубль vertical-профиля (repairBackFrequency не успевает).
  const hasVertical = back.some((e: any) => (annotateBackExercise(e).movementPattern || '') === 'vertical_pull');
  const wantedWidth = (p: string) => isWidth(p) && (hasVertical ? p === 'lat_isolation' : true);
  // 1. Добираем сеты существующих width-упражнений до 5.
  for (const e of back) {
    if (width >= target || e.sets >= 5) continue;
    const p = annotateBackExercise(e).movementPattern || '';
    if (!wantedWidth(p)) continue;
    while (e.sets < 5 && width < target) {
      const sample = e.workSets?.[e.workSets.length - 1] || { reps: 12, rir: 2, weight: 0 };
      e.workSets.push({ ...sample });
      e.sets += 1;
      width += 1;
    }
  }
  // 2. Если всё ещё мало — добавляем lat_isolation/vertical (в пределах лимитов).
  if (width < target && workingCount < maxEx) {
    const candidate = EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== 'back') return false;
      if (usedNames.has(x.name)) return false;
      const p = annotateBackExercise({ ...(back[0] as any), name: x.name } as any).movementPattern || '';
      if (!wantedWidth(p)) return false;
      if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
      if (options.equipment?.length) {
        const eq = Array.isArray(x.equipment) ? x.equipment : [String(x.equipment || '')];
        if (eq.length > 0 && !eq.some((e: string) => options.equipment!.includes(e))) return false;
      }
      return true;
    });
    if (candidate) {
      const base = back[0];
      const sample = base.workSets?.[0] || { reps: 12, rir: 2, weight: 0 };
      session.exercises.push({
        muscle: 'back', name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: 'памп',
        sets: Math.min(5, target - width), repsRange: [12, 18], rir: 3, restSeconds: 75, warmupSets: [],
        workSets: Array.from({ length: Math.min(5, target - width) }, () => ({ ...sample, reps: 15, rir: 3, restSeconds: 75 })),
        rationale: 'Баланс спины: добивка широчайших (width) под 60% толщины',
      });
    }
  } else if (width < target && workingCount >= maxEx) {
    // Лимит упражнений исчерпан: заменяем accessory-row (толщина сохраняется
    // в других сессиях недели) на vertical/lat — ширину нельзя терять.
    const slot = back.find((e: any) => e.role === 'accessory' && isThickness(annotateBackExercise(e).movementPattern || ''));
    const candidate = slot ? EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== 'back') return false;
      if (usedNames.has(x.name)) return false;
      const p = annotateBackExercise({ ...slot, name: x.name } as any).movementPattern || '';
      if (!wantedWidth(p)) return false;
      if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
      if (options.equipment?.length) {
        const eq = Array.isArray(x.equipment) ? x.equipment : [String(x.equipment || '')];
        if (eq.length > 0 && !eq.some((e: string) => options.equipment!.includes(e))) return false;
      }
      return true;
    }) : undefined;
    if (slot && candidate) {
      const tagged = annotateBackExercise({ ...slot, name: candidate.name } as any);
      slot.name = candidate.name;
      slot.exerciseName = candidate.name;
      slot.movementPattern = tagged.movementPattern;
      slot.backSubgroup = tagged.backSubgroup;
      slot.rationale = `${slot.rationale || ''} Баланс спины: row заменена на ${tagged.movementPattern} (width под 60% толщины).`;
    }
  }
}

/** Гарантирует direct arm-блок после indirect overlap и поздних cap-pass. */
function allocateExperiencedArmSession(session: any, week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  const tag = session.sessionTag || '';
  const targetMuscle = /Pull|Back|Upper|Arms/.test(tag) ? 'biceps' : /Push|Chest|Upper|Arms/.test(tag) ? 'triceps' : '';
  if (!targetMuscle) return;
  // Донорская политика недели: не возвращать объём мышце-донору.
  const donors = tradeoffDonorsForWeek(options, (week as any)?.week ?? 0);
  if (donors.has(targetMuscle)) return;
  const existing = session.exercises.filter((e: any) => e.muscle === targetMuscle);
  const targetSets = (options.trainingYears ?? 0) >= 6 ? 6 : 5;
  let total = existing.reduce((sum: number, e: any) => sum + (e.sets || 0), 0);
  // В Upper одновременно доступны оба бюджета; в Pull/Push — соответствующий.
  if (total < targetSets && existing.length) {
    const exercise = existing[0];
    while (total < targetSets && exercise.sets < 5) {
      const sample = exercise.workSets?.[exercise.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
      exercise.sets += 1;
      exercise.workSets.push({ ...sample });
      total += 1;
    }
  }
  if (total >= targetSets) return;
  const candidates = EXERCISE_CATALOG.filter((candidate: any) => {
    if (trueMuscleOf(candidate) !== targetMuscle) return false;
    if (options.excludedExercises?.includes(candidate.id) || options.excludedExercises?.includes(candidate.name)) return false;
    if (options.equipment?.length) {
      const eq = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
      if (eq.length && !eq.some((e: string) => options.equipment!.includes(e))) return false;
    }
    return true;
  });
  const candidate = candidates.find((e: any) => !session.exercises.some((x: any) => x.name === e.name));
  if (!candidate) return;
  const baseWeight = options.workMax?.[targetMuscle] || 40;
  // Минимум 2 рабочих сета на упражнение (валидатор single_work_set).
  const sets = Math.min(5, Math.max(2, targetSets - total));
  session.exercises.push({
    muscle: targetMuscle,
    name: candidate.name,
    exerciseName: candidate.name,
    role: 'accessory',
    character: 'памп',
    sets,
    repsRange: [10, 15],
    rir: 3,
    workSets: Array.from({ length: sets }, () => ({ reps: 12, rir: 3, weight: Math.round(baseWeight * 0.35 * 10) / 10, restSeconds: 75 })),
    restSeconds: 75,
    warmupSets: [],
    rationale: `Experienced enhanced: ${targetMuscle} direct residual volume after indirect overlap`,
  });
}

/**
 * Ноги 2×/нед (PPL, UL, 8-дневный и др.): день 1 (нечётный) — тяжёлый quads
 * + памповый hamstrings; день 2 (чётный) — тяжёлый hamstrings + памповый quads.
 * Тяжёлый блок: compound 4-5 сетов × 6-10 + второй паттерн (quads → жим ногами
 * предпочтительно, hams → leg curl/RDL) 3-5 сетов; остаток — памп-изоляция.
 * Максимум 5 сетов на одно упражнение (про-объём добивается упражнениями,
 * а не 7-8 подходами в одном движении).
 */
function ensureLegHeavyBlock(session: any, options: BBFinalizeOptions, muscle: string, target: number, heavyQuads: boolean): void {
  let items: any[] = session.exercises.filter((e: any) => e.muscle === muscle && !(e as any).warmupActivator);
  // Тяж-день: все существующие compound-упражнения мышцы становятся тяжёлыми
  // (6-10 reps, RIR ≤2); изоляции не трогаем (они — памп-добивка шага 3).
  if (heavyQuads || true) {
    for (const e of items) {
      const p = classifyLegExercise(e.name).pattern;
      const isCompound = p === 'compound_squat' || p === 'lunge' || p === 'belt_stepup' || p === 'sissy_lengthened' || p === 'rdl_hinge' || /присед|жим.*ног|leg.?press|хак|hack|выпад|lunge|румын|rdl|гудморнинг|мёртв/i.test(e.name);
      if (!isCompound) continue;
      e.character = 'тяж';
      e.rir = Math.min(e.rir ?? 2, 2);
      e.repsRange = [6, 10];
    }
  }
  const used = (c: any) => options.excludedExercises?.includes(c.id) || options.excludedExercises?.includes(c.name);
  const equipmentOk = (c: any) => {
    if (!options.equipment?.length) return true;
    const eq = Array.isArray(c.equipment) ? c.equipment : [String(c.equipment || '')];
    return !eq.length || eq.some((e: string) => options.equipment!.includes(e));
  };
  const findCatalog = (pred: (c: any) => boolean) => EXERCISE_CATALOG.find((c: any) => trueMuscleOf(c) === muscle && !used(c) && equipmentOk(c) && pred(c));

  // 1. Primary compound: присед (quads) / RDL (hamstrings). Тяжёлая нагрузка.
  const compoundKey = muscle === 'quads' ? /присед|squat|хак|hack|гакк|фронт/i : /румын|rdl|гудморнинг|good.?morning|мёртв.*прям/i;
  let compound = items.find((e: any) => classifyLegExercise(e.name).pattern === 'compound_squat' || (muscle === 'hamstrings' && /румын|rdl|гудморнинг/i.test(e.name)));
  if (!compound && muscle === 'hamstrings') compound = items.find((e: any) => /румын|rdl|гудморнинг|мёртв/i.test(e.name));
  if (!compound) {
    const candidate = findCatalog((c: any) => compoundKey.test(c.name || ''));
    if (candidate) {
      const wm = options.workMax?.[muscle] || 80;
      const added: any = {
        muscle, name: candidate.name, exerciseName: candidate.name, role: 'primary', character: 'тяж',
        sets: 5, repsRange: [6, 10], rir: 2, restSeconds: 150, warmupSets: [],
        workSets: Array.from({ length: 5 }, () => ({ reps: 8, rir: 2, weight: Math.round(wm * 0.7 * 10) / 10, restSeconds: 150 })),
        rationale: `Experienced enhanced: тяжёлый ${muscle} compound (день ${heavyQuads ? 'quads' : 'hamstrings'})`,
      };
      session.exercises.push(added); items.push(added);
      compound = added;
    }
  } else if (compound && !compound.warmupActivator) {
    // Уже есть compound — доводим до 5 сетов и ставим тяжёлый характер.
    compound.character = 'тяж';
    compound.rir = Math.min(compound.rir ?? 2, 2);
    compound.repsRange = [6, 10];
    while (compound.sets < 5 && compound.workSets.length < 5) {
      const sample = compound.workSets?.[compound.workSets.length - 1] || { reps: 8, rir: 2, weight: 0 };
      compound.workSets.push({ ...sample }); compound.sets += 1;
    }
  }
  let total = items.reduce((n, e) => n + (e.sets || 0), 0);

  // 2. Второй паттерн: quads → жим ногами (приоритет пользователя); hams → leg curl / RDL.
  const usedPatterns = new Set(items.map((e: any) => classifyLegExercise(e.name).pattern));
  const usedNames = new Set(items.map((e: any) => e.name));
  const hasLegPress = items.some((e: any) => /жим.*ног|leg.?press|хак|hack/i.test(e.name));
  const hasCurl = items.some((e: any) => classifyLegExercise(e.name).pattern === 'leg_curl');
  let second: any = null;
  if (muscle === 'quads' && !hasLegPress && items.length < 4) {
    second = findCatalog((c: any) => /жим.*ног|leg.?press/i.test(c.name || '') && !usedNames.has(c.name));
    if (!second) second = findCatalog((c: any) => /хак|hack/i.test(c.name || '') && !usedNames.has(c.name));
  } else if (muscle === 'hamstrings' && !hasCurl && items.length < 4) {
    second = findCatalog((c: any) => /сгибан.*ног|leg.?curl/i.test(c.name || '') && !usedNames.has(c.name));
  } else if (items.length < 4) {
    second = findCatalog((c: any) => !usedNames.has(c.name) && !usedPatterns.has(classifyLegExercise(c.name).pattern));
  }
  if (second) {
    const base = compound || items[0];
    const added: any = structuredClone(base);
    added.name = second.name; added.exerciseName = second.name; added.role = 'accessory'; added.character = 'тяж';
    added.sets = Math.min(5, Math.max(3, target - total));
    added.repsRange = [8, 12]; added.rir = 2; added.restSeconds = 120;
    const sample = base?.workSets?.[0] || { reps: 10, rir: 2, weight: 0 };
    added.workSets = Array.from({ length: added.sets }, () => ({ ...sample, reps: 10, rir: 2, restSeconds: 120 }));
    added.rationale = `Experienced enhanced: второй паттерн ${muscle} (${second.name})`;
    session.exercises.push(added); items.push(added); usedNames.add(second.name); total += added.sets;
  }

  // 3. Остаток до target — памп-изоляция мышцы (max 5 сетов на упражнение).
  if (total < target) {
    const pumpKey = muscle === 'quads' ? /разгибан.*ног|leg.?extension/i : /сгибан.*ног|leg.?curl/i;
    const pump = findCatalog((c: any) => pumpKey.test(c.name || '') && !usedNames.has(c.name)) || findCatalog((c: any) => !usedNames.has(c.name) && !usedPatterns.has(classifyLegExercise(c.name).pattern));
    if (pump) {
      const base = items[0];
      const added: any = structuredClone(base);
      added.name = pump.name; added.exerciseName = pump.name; added.role = 'accessory'; added.character = 'памп';
      added.sets = Math.min(5, Math.min(4, target - total));
      added.repsRange = [12, 18]; added.rir = 3; added.restSeconds = 60;
      const sample = base?.workSets?.[0] || { reps: 15, rir: 3, weight: 0 };
      added.workSets = Array.from({ length: added.sets }, () => ({ ...sample, reps: 15, rir: 3, restSeconds: 60 }));
      added.rationale = `Experienced enhanced: памп-добивка ${muscle} (растянутая позиция)`;
      session.exercises.push(added); items.push(added); total += added.sets;
    }
  }
  // 4. Только для 6+ лет: ещё одно упражнение, если target большой (16 сетов).
  if (total < target && (options.trainingYears ?? 0) >= 6 && items.length < 5) {
    const extra = findCatalog((c: any) => !usedNames.has(c.name));
    if (extra) {
      const base = items[0];
      const added: any = structuredClone(base);
      added.name = extra.name; added.exerciseName = extra.name; added.role = 'accessory'; added.character = 'памп';
      added.sets = Math.min(5, Math.min(3, target - total));
      added.repsRange = [10, 15]; added.rir = 2; added.restSeconds = 90;
      const sample = base?.workSets?.[0] || { reps: 12, rir: 2, weight: 0 };
      added.workSets = Array.from({ length: added.sets }, () => ({ ...sample, reps: 12, rir: 2, restSeconds: 90 }));
      added.rationale = 'Experienced enhanced 6+: дополнительное leg-упражнение (5-сетовый потолок)';
      session.exercises.push(added); total += added.sets;
    }
  }
}

/** Памп-блок пассивной мышцы ног (hamstrings в quads-день и наоборот): 4×12-15.
 *  Существующие compound-упражнения памп-мышцы перерабатываются в лёгкий памп
 *  (≤3 сета, 12-20 reps, RIR 3) — в памп-день не должно быть тяжёлой работы. */
function ensureLegPumpBlock(session: any, options: BBFinalizeOptions, muscle: string, target: number): void {
  const used = (c: any) => options.excludedExercises?.includes(c.id) || options.excludedExercises?.includes(c.name);
  const equipmentOk = (c: any) => {
    if (!options.equipment?.length) return true;
    const eq = Array.isArray(c.equipment) ? c.equipment : [String(c.equipment || '')];
    return !eq.length || eq.some((e: string) => options.equipment!.includes(e));
  };
  const existing = session.exercises.filter((e: any) => e.muscle === muscle && !(e as any).warmupActivator);
  for (const e of existing) {
    // Памп-мышца: любое упражнение становится лёгким (12-20 reps, RIR 3, ≤4 сета).
    e.character = 'памп';
    e.rir = 3;
    e.repsRange = [12, 20];
    if (e.sets > 4) { e.sets = 4; e.workSets = e.workSets.slice(0, 4); }
    if (e.workSets?.length && e.workSets.length > 4) e.workSets = e.workSets.slice(0, 4);
  }
  if (existing.some((e: any) => classifyLegExercise(e.name).pattern === 'leg_curl' || /сгибан.*ног/i.test(e.name))) return;
  const key = muscle === 'quads' ? /разгибан.*ног|leg.?extension/i : /сгибан.*ног|leg.?curl/i;
  const candidate = EXERCISE_CATALOG.find((c: any) => trueMuscleOf(c) === muscle && !used(c) && equipmentOk(c) && key.test(c.name || ''));
  if (!candidate) return;
  const baseWeight = options.workMax?.[muscle] || 50;
  const sets = Math.min(4, target);
  session.exercises.push({
    muscle, name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: 'памп',
    sets, repsRange: [12, 18], rir: 3, restSeconds: 60, warmupSets: [],
    workSets: Array.from({ length: sets }, () => ({ reps: 15, rir: 3, weight: Math.round(baseWeight * 0.3 * 10) / 10, restSeconds: 60 })),
    rationale: `Experienced enhanced: памповый ${muscle} (день ${muscle === 'quads' ? 'hamstrings' : 'quads'})`,
  });
}

/** Glutes: тяжёлый hip thrust в quads-день, памп-отведение в hamstrings-день. */
function ensureGlutesBlock(session: any, options: BBFinalizeOptions, target: number, heavyQuads: boolean): void {
  const existing = session.exercises.filter((e: any) => e.muscle === 'glutes' && !(e as any).warmupActivator);
  const used = (c: any) => options.excludedExercises?.includes(c.id) || options.excludedExercises?.includes(c.name);
  const equipmentOk = (c: any) => {
    if (!options.equipment?.length) return true;
    const eq = Array.isArray(c.equipment) ? c.equipment : [String(c.equipment || '')];
    return !eq.length || eq.some((e: string) => options.equipment!.includes(e));
  };
  if (existing.some((e: any) => /мост|hip.?thrust|glute.?bridge/i.test(e.name))) {
    // Доводим существующий hip thrust до 5 сетов (тяж).
    const thrust = existing.find((e: any) => /мост|hip.?thrust|glute.?bridge/i.test(e.name));
    if (thrust && heavyQuads) {
      thrust.character = 'тяж';
      while (thrust.sets < 5 && thrust.workSets.length < 5) {
        const sample = thrust.workSets?.[thrust.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
        thrust.workSets.push({ ...sample }); thrust.sets += 1;
      }
    }
    return;
  }
  const pattern = heavyQuads ? /мост|hip.?thrust|glute.?bridge/i : /отведен.*бедр|abduction|kick.?back|ягодичн.*отвед|мах.*ног/i;
  const candidate = EXERCISE_CATALOG.find((c: any) => trueMuscleOf(c) === 'glutes' && !used(c) && equipmentOk(c) && pattern.test(c.name || ''));
  if (!candidate) return;
  const baseWeight = options.workMax?.glutes || 60;
  const sets = heavyQuads ? Math.min(5, target) : Math.min(4, target);
  session.exercises.push({
    muscle: 'glutes', name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: heavyQuads ? 'тяж' : 'памп',
    sets, repsRange: heavyQuads ? [8, 12] : [12, 18], rir: heavyQuads ? 2 : 3, restSeconds: heavyQuads ? 120 : 60, warmupSets: [],
    workSets: Array.from({ length: sets }, () => ({ reps: heavyQuads ? 10 : 15, rir: heavyQuads ? 2 : 3, weight: Math.round(baseWeight * (heavyQuads ? 0.5 : 0.25) * 10) / 10, restSeconds: heavyQuads ? 120 : 60 })),
    rationale: `Experienced enhanced: glutes ${heavyQuads ? 'тяж (hip thrust)' : 'памп (отведение)'}`,
  });
}

function allocateExperiencedLegSession(session: any, week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  const legDonors = tradeoffDonorsForWeek(options, (week as any)?.week ?? 0);
  if (['quads', 'hamstrings', 'glutes', 'calves'].some(m => legDonors.has(m))) return;
  if (!/Legs|Lower|LowerPower|LowerHyp/.test(session.sessionTag || '')) return;
  const years = options.trainingYears ?? 0;
  // Ноги 2×/нед: нечётный день = тяж quads + памп hams; чётный = тяж hams + памп quads.
  const heavyQuads = (session.day ?? 1) % 2 === 1;
  const heavyMuscle = heavyQuads ? 'quads' : 'hamstrings';
  const pumpMuscle = heavyQuads ? 'hamstrings' : 'quads';
  const heavyTarget = years >= 6 ? 16 : 12;
  ensureLegHeavyBlock(session, options, heavyMuscle, heavyTarget, heavyQuads);
  ensureLegPumpBlock(session, options, pumpMuscle, 4);
  ensureGlutesBlock(session, options, years >= 6 ? 12 : 10, heavyQuads);
  // Повторная переработка памп-мышцы: поздние добавления (добивки) тоже
  // становятся лёгкими (12-20 reps, RIR 3) — в памп-день нет тяжёлой работы.
  ensureLegPumpBlock(session, options, pumpMuscle, 4);
}

/** Гарантирует в Push/Chest-дне грудь с разными углами, а не 4 одинаковых жима.
 *  Также не допускает rear delt в Push-днях (rear delt — Pull-работа).
 *  Для enhanced: чередование тяж/памп по дню (нечётный — тяж: жим 4-5×6-10
 *  RIR 1-2; чётный — памп: 3-4×10-15 + fly/кроссовер 3×12-18). */
function diversifyExperiencedChestSession(session: any, week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  const donors = tradeoffDonorsForWeek(options, (week as any)?.week ?? 0);
  if (donors.has('chest') || donors.has('shoulders')) return;
  if (!/^(Push|Chest|ChestBack|Upper|UpperPower|UpperHyp|Torso)$/i.test(session.sessionTag || '')) return;
  // Задняя дельта не работает в Push-дне (rear delt — тяговая мышца, идёт со спиной).
  const rearDelt = session.exercises.find((e: any) => e.muscle === 'shoulders' && /обратн|rear|задн.*дельт|задн.*пуч/i.test(e.name));
  if (rearDelt) {
    const lateral = EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== 'shoulders') return false;
      if (!/мах|lateral|raise|отведен|разведен/i.test(x.name)) return false;
      if (/наклон|задн|rear|обратн/i.test(x.name)) return false;
      if (session.exercises.some((e: any) => e.name === x.name)) return false;
      return true;
    });
    if (lateral) {
      rearDelt.name = lateral.name;
      rearDelt.exerciseName = lateral.name;
      rearDelt.rationale = `${rearDelt.rationale || ''} Адаптация: rear delt заменена на lateral raise в Push-дне (rear delt — со спиной).`;
    }
  }
  const heavyDay = (session.day ?? 1) % 2 === 1;
  const chest = session.exercises.filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator);
  if (!chest.length) return;
  // Чередование тяж/памп для про-уровня (средняя дельта идёт с грудью в Push).
  if (heavyDay) {
    for (const e of chest) {
      if (/жим|press|отжим/i.test(e.name)) { e.character = 'тяж'; e.rir = Math.min(e.rir ?? 2, 2); e.repsRange = [6, 10]; }
    }
  } else {
    for (const e of chest) {
      e.character = 'памп';
      e.rir = 3;
      e.repsRange = [10, 15];
      if (e.sets > 4) { e.sets = 4; e.workSets = e.workSets.slice(0, 4); }
    }
  }
  const isPress = (name: string) => /жим|press|брус|dip|отжим/i.test(name);
  const presses = chest.filter((e: any) => isPress(e.name));
  const fly = chest.find((e: any) => /развод|fly|crossover|кроссовер|сведен|пек.?дек|бабоч|сведение/i.test(e.name));
  // >3 жимов без fly/cable — заменяем последний жим на изоляцию.
  if (presses.length > 3 && !fly) {
    const candidate = EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== 'chest') return false;
      if (!/развод|fly|crossover|кроссовер|сведен|пек.?дек|бабоч|сведение/i.test(x.name)) return false;
      if (session.exercises.some((e: any) => e.name === x.name)) return false;
      if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
      return true;
    });
    if (candidate) {
      const target = presses[presses.length - 1];
      const base: any = target;
      const sample = base.workSets?.[0] || { reps: 12, rir: 3, weight: 0 };
      const added: any = structuredClone(base);
      added.name = candidate.name;
      added.exerciseName = candidate.name;
      added.role = 'accessory';
      added.character = 'памп';
      added.sets = 3;
      added.repsRange = [12, 18];
      added.rir = 3;
      added.workSets = Array.from({ length: 3 }, () => ({ ...sample, reps: 15, rir: 3 }));
      added.rationale = 'Experienced enhanced: chest fly/cable diversity вместо 4-го жима';
      session.exercises.splice(session.exercises.indexOf(target), 1, added);
    }
  }
  // Памп-день: гарантируем fly/кроссовер (растянутая позиция, метаболический стресс).
  if (!heavyDay && !fly) {
    const candidate = EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== 'chest') return false;
      if (!/развод|fly|crossover|кроссовер|сведен|пек.?дек|бабоч|сведение/i.test(x.name)) return false;
      if (session.exercises.some((e: any) => e.name === x.name)) return false;
      if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
      return true;
    });
    if (candidate) {
      const base = chest[0];
      const sample = base.workSets?.[0] || { reps: 15, rir: 3, weight: 0 };
      session.exercises.push({
        muscle: 'chest', name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: 'памп',
        sets: 3, repsRange: [12, 18], rir: 3, restSeconds: 60, warmupSets: [],
        workSets: Array.from({ length: 3 }, () => ({ ...sample, reps: 15, rir: 3, restSeconds: 60 })),
        rationale: 'Experienced enhanced: pump-day chest fly (растянутая позиция)',
      });
    }
  }
  // Средняя дельта идёт с грудью (Push-связка): если mid-delt изоляции нет —
  // гарантируем lateral raise (3×12-18 памп) в пределах лимита сессии.
  const maxEx = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 18 : 10;
  const workingCount = session.exercises.filter((e: any) => !(e as any).warmupActivator).length;
  const hasMidDelt = session.exercises.some((e: any) => e.muscle === 'shoulders' && /мах|lateral|raise|отведен|разведен|жим/i.test(e.name || '') && !/наклон|задн|rear|обратн|лёжа|лёж|жим ногам|жим.*тренаж/i.test(e.name || ''));
  if (!hasMidDelt && workingCount < maxEx) {
    const lateral = EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== 'shoulders') return false;
      if (!/мах|lateral|raise|отведен|разведен/i.test(x.name || '')) return false;
      if (/наклон|задн|rear|обратн/i.test(x.name || '')) return false;
      if (session.exercises.some((e: any) => e.name === x.name)) return false;
      if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
      return true;
    });
    if (lateral) {
      const baseWeight = options.workMax?.shoulders || 50;
      session.exercises.push({
        muscle: 'shoulders', name: lateral.name, exerciseName: lateral.name, role: 'accessory', character: 'памп',
        sets: 3, repsRange: [12, 18], rir: 3, restSeconds: 45, warmupSets: [],
        workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 3, weight: Math.round(baseWeight * 0.25 * 10) / 10, restSeconds: 45 })),
        rationale: 'Experienced enhanced: mid delt с грудью (Push-связка, lateral raise)',
      });
    }
  }
  // Объём-добивка груди: спина в Upper достигает 18-22 сетов через allocateExperiencedBackSession,
  // а грудь оставалась на крохах (3 сета/упр). Добиваем грудь до target (14-18 сетов/сессию,
  // 4-5 упражнений) в Upper/ChestBack/Push — как спина, чтобы грудь была со-главной.
  const years = options.trainingYears ?? 0;
  const chestNow = session.exercises.filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator);
  const chestSets = chestNow.reduce((a: number, e: any) => a + (e.sets || 0), 0);
  const targetSets = years >= 6 ? 18 : 14;
  if (chestSets < targetSets) {
    const usedNames = new Set(chestNow.map((e: any) => e.name));
    const maxEx = options.level === 'enhanced' && years >= 3 ? 18 : 10;
    let addedSets = 0;
    // 1) Добить сеты существующих жимов до 4-5.
    for (const e of chestNow) {
      if (addedSets >= targetSets - chestSets) break;
      const isPress = /жим|press|отжим|брус/.test(e.name);
      if (isPress && e.sets < 4) {
        const add = Math.min(4 - e.sets, targetSets - chestSets - addedSets);
        e.sets += add; addedSets += add;
        const sample = e.workSets?.[e.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
        if (Array.isArray(e.workSets)) for (let k = 0; k < add; k++) e.workSets.push({ ...sample });
      }
    }
    // 2) Если всё ещё мало — добавить ещё одно грудное упражнение (разные углы).
    while (addedSets < targetSets - chestSets && chestNow.length + session.exercises.filter((e:any)=>!(e as any).warmupActivator).length < maxEx) {
      const cand = EXERCISE_CATALOG.find((x: any) => {
        if (trueMuscleOf(x) !== 'chest') return false;
        if (usedNames.has(x.name)) return false;
        if (session.exercises.some((e: any) => e.name === x.name)) return false;
        if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
        return true;
      });
      if (!cand) break;
      const wm = options.workMax?.chest || 100;
      const sets = Math.min(4, targetSets - chestSets - addedSets);
      session.exercises.push({
        muscle: 'chest', name: cand.name, exerciseName: cand.name, role: 'accessory', character: heavyDay ? 'тяж' : 'памп',
        sets, repsRange: heavyDay ? [8, 12] : [12, 15], rir: heavyDay ? 2 : 3, restSeconds: 90, warmupSets: [],
        workSets: Array.from({ length: sets }, () => ({ reps: heavyDay ? 10 : 12, rir: heavyDay ? 2 : 3, weight: Math.round(wm * (heavyDay ? 0.7 : 0.5) * 10) / 10, restSeconds: 90 })),
        rationale: 'Experienced enhanced: chest volume top-up (Upper/Push co-main)',
      });
      usedNames.add(cand.name);
      addedSets += sets;
    }
  }
}

/** Гарантирует rear delt работу в Pull-дне (задняя дельта — тяговая мышца). */
function ensureRearDeltInPull(session: any, week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  if (tradeoffDonorsForWeek(options, (week as any)?.week ?? 0).has('shoulders')) return;
  if (!/^(Pull|Back|Upper|UpperPower|UpperHyp|Torso)$/i.test(session.sessionTag || '')) return;
  const hasRear = session.exercises.some((e: any) => e.muscle === 'shoulders' && /обратн|rear|задн.*дельт|задн.*пуч|лиц.*тяга|face.?pull/i.test(e.name));
  if (hasRear) return;
  const candidate = EXERCISE_CATALOG.find((x: any) => {
    if (trueMuscleOf(x) !== 'shoulders') return false;
    if (!/обратн|rear|задн.*дельт|задн.*пуч|лиц.*тяга|face.?pull/i.test(x.name)) return false;
    if (session.exercises.some((e: any) => e.name === x.name)) return false;
    if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
    return true;
  });
  if (!candidate) return;
  const baseWeight = options.workMax?.shoulders || 60;
  session.exercises.push({
    muscle: 'shoulders',
    name: candidate.name,
    exerciseName: candidate.name,
    role: 'accessory',
    character: 'памп',
    sets: 3,
    repsRange: [12, 18],
    rir: 3,
    workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 3, weight: Math.round(baseWeight * 0.35 * 10) / 10, restSeconds: 60 })),
    restSeconds: 60,
    warmupSets: [],
    rationale: 'Experienced enhanced: rear delt (Pull-работа)',
  });
}

/**
 * Головки рук (Этап 2/4): biceps обязан иметь растянутую позицию (длинная
 * головка), triceps — overhead (длинная головка). Не добавляем слоты —
 * заменяем одну изоляцию того же слота (лимиты не меняются).
 *
 * Планирование объёма по головкам (остаток Раунда 4): при бюджете ≥5 сетов
 * длинная головка получает ≥3 сета (перераспределение между упражнениями той
 * же мышцы, без изменения лимитов); при ≥6 сетов и дубле паттерна — дубль
 * заменяется на brachialis (hammer) / pushdown (lateral+medial головки).
 */
function ensureArmHeadCoverage(session: any, week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource) return;
  const donors = tradeoffDonorsForWeek(options, (week as any)?.week ?? 0);
  if (donors.has('biceps') && donors.has('triceps')) return;
  const tag = session.sessionTag || '';
  if (!/Upper|Pull|Push|Arms|Back/.test(tag) && tag !== '') return;
  const arms = () => session.exercises.filter((e: any) => ['biceps', 'triceps'].includes(e.muscle) && !(e as any).warmupActivator && !donors.has(e.muscle));
  const trimSets = (e: any, sets: number): void => {
    e.sets = sets;
    if (Array.isArray(e.workSets) && e.workSets.length > sets) e.workSets = e.workSets.slice(0, sets);
  };
  const findCatalog = (muscle: string, pattern: RegExp): any => {
    return EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== muscle) return false;
      if (!pattern.test(x.name || '')) return false;
      if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
      if (isMobilityRestricted(x, options.mobilityRestrictions)) return false;
      if (options.equipment?.length) {
        const eq = Array.isArray(x.equipment) ? x.equipment : [String(x.equipment || '')];
        if (eq.length > 0 && !eq.some((e: string) => options.equipment!.includes(e))) return false;
      }
      return true;
    });
  };
  /** Баланс головок мышцы: mustHead ≥ 3 при total ≥ 5; altHead — замена дубля
   * паттерна (total ≥ 5) или разгружение перегруженной mustHead (≥4 сетов,
   * total ≥ 6) в пользу altHead (brachialis/lateral+medial). */
  const balanceHeads = (muscle: 'biceps' | 'triceps', mustHead: string, altHead: string, altPattern: RegExp, altNote: string): void => {
    const exs = arms().filter((e: any) => e.muscle === muscle);
    if (exs.length < 2) return;
    const total = exs.reduce((a: number, e: any) => a + (e.sets || 0), 0);
    const must = exs.find((e: any) => classifyArmExercise(e.name).pattern === mustHead);
    if (must) {
      // 1) Длинная головка получает ≥3 сетов за счёт остальных (не ниже 2).
      if (must.sets < 3 && total >= 5) {
        const donors = exs.filter((e: any) => e !== must && (e.sets || 0) > 2).sort((a: any, b: any) => (b.sets || 0) - (a.sets || 0));
        for (const d of donors) {
          while (must.sets < 3 && d.sets > 2) {
            d.sets -= 1;
            if (Array.isArray(d.workSets) && d.workSets.length > d.sets) d.workSets = d.workSets.slice(0, d.sets);
            must.sets += 1;
            if (Array.isArray(must.workSets)) must.workSets.push({ ...must.workSets[must.workSets.length - 1] });
          }
        }
      }
    }
    if (exs.some((e: any) => classifyArmExercise(e.name).pattern === altHead)) return;
    // 2) Нет altHead при бюджете ≥5: сначала дубль паттерна, иначе — любое
    // не-must упражнение (brachialis приоритетнее стандартного curl, pushdown
    // приоритетнее close-grip compound — Этап 4 плана).
    if (total >= 5) {
      const counts = new Map<string, number>();
      for (const e of exs) {
        const p = classifyArmExercise(e.name).pattern;
        counts.set(p, (counts.get(p) || 0) + 1);
      }
      const dup = exs.find((e: any) => (counts.get(classifyArmExercise(e.name).pattern) || 0) > 1 && e !== must);
      const slot = dup || exs.find((e: any) => e !== must);
      if (slot) {
        const candidate = findCatalog(muscle, altPattern);
        if (candidate) {
          slot.name = candidate.name;
          slot.exerciseName = candidate.name;
          slot.rationale = altNote;
        }
        return;
      }
    }
    // 3) Перегруженная mustHead (≥5 сетов) при бюджете ≥5: часть сетов
    // уходит в altHead (новый слот, сумма сессии не меняется).
    if (total >= 5 && must && must.sets >= 5) {
      const working = session.exercises.filter((e: any) => !(e as any).warmupActivator);
      const maxEx = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 18 : options.level === 'enhanced' && (options.trainingYears ?? 0) >= 1 ? 14 : 10;
      if (working.length < maxEx) {
        const candidate = findCatalog(muscle, altPattern);
        if (candidate) {
          const take = Math.min(must.sets - 3, 2);
          must.sets -= take;
          if (Array.isArray(must.workSets) && must.workSets.length > must.sets) must.workSets = must.workSets.slice(0, must.sets);
          const template = session.exercises[0];
          const sample = must.workSets?.[0] || { reps: 12, rir: 3, weight: 0, restSeconds: 60 };
          session.exercises.push({
            ...template,
            muscle,
            name: candidate.name,
            exerciseName: candidate.name,
            role: 'accessory',
            character: 'памп',
            sets: take,
            repsRange: [12, 18],
            rir: 3,
            restSeconds: 60,
            workSets: Array.from({ length: take }, () => ({ ...sample })),
            rationale: altNote,
          });
        }
      }
    }
  };
  // Biceps: растянутая позиция (incline curl).
  const biceps = session.exercises.filter((e: any) => e.muscle === 'biceps' && !(e as any).warmupActivator);
  if (!donors.has('biceps') && biceps.length > 0 && !biceps.some((e: any) => classifyArmExercise(e.name).pattern === 'biceps_lengthened')) {
    const slot = biceps.find((e: any) => classifyArmExercise(e.name).pattern === 'biceps_shortened' || classifyArmExercise(e.name).pattern === 'other');
    if (slot) {
      const candidate = findCatalog('biceps', /наклон.*скам|incline/i);
      if (candidate) {
        slot.name = candidate.name;
        slot.exerciseName = candidate.name;
        slot.rationale = 'Покрытие длинной головки бицепса (растянутая позиция)';
      }
    }
  }
  if (!donors.has('biceps')) balanceHeads('biceps', 'biceps_lengthened', 'biceps_hammer', /молот|hammer/i, 'Brachialis (hammer): распределение объёма по головкам');
  // Triceps: overhead (длинная головка).
  const triceps = session.exercises.filter((e: any) => e.muscle === 'triceps' && !(e as any).warmupActivator);
  if (!donors.has('triceps') && triceps.length > 0 && !triceps.some((e: any) => classifyArmExercise(e.name).pattern === 'triceps_overhead')) {
    const slot = triceps.find((e: any) => classifyArmExercise(e.name).pattern === 'triceps_pushdown' || classifyArmExercise(e.name).pattern === 'triceps_compound' || classifyArmExercise(e.name).pattern === 'other');
    if (slot) {
      const candidate = findCatalog('triceps', /француз|french|из.?за.*голов|overhead/i);
      if (candidate) {
        slot.name = candidate.name;
        slot.exerciseName = candidate.name;
        slot.rationale = 'Покрытие длинной головки трицепса (overhead)';
      }
    }
  }
  if (!donors.has('triceps')) balanceHeads('triceps', 'triceps_overhead', 'triceps_pushdown', /разгибан.*блок|pushdown|канат.*рукоят|трицепс.*блок/i, 'Lateral/medial головки трицепса (pushdown): распределение объёма по головкам');
}

/**
 * Качество малых групп (Этап E): икры получают stretch-паттерны (стоя —
 * икроножная в растянутой позиции + сидя — камбаловидная), предплечья идут
 * с тягами (хват), шраги доводятся до 4-5 сетов с задержкой. Объёмы не
 * сокращаются — добирается качество (stretch + памп).
 */
function ensureSmallMuscleQuality(session: any, week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource) return;
  const donors = tradeoffDonorsForWeek(options, (week as any)?.week ?? 0);
  const tag = session.sessionTag || '';
  // BUG-FIX: проход не должен добавлять упражнения для мышц, исключённых
  // травмами (exclude=true) или в щадящем режиме (graded) — иначе «legs
  // exclude» возвращало икры/ягодицы, а щадящий режим раздувался до MEV.
  const excludedMuscles = new Set(options.excludedMuscles || []);
  const gradedMuscles = new Set(options.gradedMuscles || []);
  const muscleExcluded = (m: string) => excludedMuscles.has(m) || gradedMuscles.has(m) || donors.has(m);
  const weekCountOf = (m: string) => week.sessions.filter((s: any) => s.exercises.some((e: any) => e.muscle === m && !(e as any).warmupActivator)).length;
  const used = (c: any) => options.excludedExercises?.includes(c.id) || options.excludedExercises?.includes(c.name);
  const equipmentOk = (c: any) => {
    if (!options.equipment?.length) return true;
    const eq = Array.isArray(c.equipment) ? c.equipment : [String(c.equipment || '')];
    return !eq.length || eq.some((e: string) => options.equipment!.includes(e));
  };
  const working = session.exercises.filter((e: any) => !(e as any).warmupActivator);
  const maxEx = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 18 : options.level === 'enhanced' && (options.trainingYears ?? 0) >= 1 ? 14 : 10;
  const isEnhanced = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3;
  const addEx = (muscle: string, pattern: RegExp, sets: number, reps: [number, number], note: string): void => {
    const candidate = EXERCISE_CATALOG.find((c: any) => trueMuscleOf(c) === muscle && !used(c) && equipmentOk(c) && pattern.test(c.name || '') && !working.some((e: any) => e.name === c.name) && !isMobilityRestricted(c, options.mobilityRestrictions));
    if (!candidate) return;
    const baseWeight = options.workMax?.[muscle] || 40;
    if (working.length < maxEx) {
      session.exercises.push({
        muscle, name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: 'памп',
        sets, repsRange: reps, rir: 3, restSeconds: 45, warmupSets: [],
        workSets: Array.from({ length: sets }, () => ({ reps: reps[1], rir: 3, weight: Math.round(baseWeight * 0.3 * 10) / 10, restSeconds: 45 })),
        rationale: note,
      });
    } else {
      // Сессия на лимите упражнений: заменяем accessory другой мышцы с дублем
      // (стимул той мышцы сохраняется), чтобы малая группа получила работу —
      // иначе fullbody-сплиты теряют calves/traps/abs (их нет в musclePlans).
      const slot = working.find((e: any) =>
        e.role === 'accessory' &&
        !['calves', 'traps', 'forearms', 'abs'].includes(e.muscle) &&
        !/(шраг|скручив|подъём.*носк|подъем.*носк|calf|запяст|wrist|зоттман)/i.test(e.name || '') &&
        working.filter((x: any) => x.muscle === e.muscle).length > 1,
      );
      if (slot) {
        // Замена не должна повышать сеты сверх лимита сессии (24/40/60).
        const sessionSets = session.exercises.reduce((sum: number, x: any) => sum + (x.sets || 0), 0);
        const maxSessionSets = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 60 : options.level === 'enhanced' && (options.trainingYears ?? 0) >= 1 ? 40 : 24;
        const room = maxSessionSets - sessionSets;
        const targetSets = Math.min(sets, Math.max(2, room));
        slot.muscle = muscle;
        slot.name = candidate.name;
        slot.exerciseName = candidate.name;
        slot.character = 'памп';
        slot.sets = targetSets;
        slot.repsRange = reps;
        slot.rir = 3;
        slot.restSeconds = 45;
        slot.workSets = Array.from({ length: targetSets }, () => ({ reps: reps[1], rir: 3, weight: Math.round(baseWeight * 0.3 * 10) / 10, restSeconds: 45 }));
        slot.rationale = note;
      }
    }
  };
  // Икры: в Legs-сессиях стоя (растянутая икроножная) + сидя (камбаловидная).
  if (/Legs|Lower|LowerPower|LowerHyp|FullBody/.test(tag) && !muscleExcluded('calves')) {
    const calves = working.filter((e: any) => e.muscle === 'calves');
    const calvesSessions = weekCountOf('calves');
    const standing = calves.find((e: any) => /носк|calf/i.test(e.name || '') && !/сидя|sitting|seated/i.test(e.name || ''));
    if (standing) {
      // Доводим стоячие до 5-6 сетов (stretch-позиция, задержка): 6 при единственной
      // calves-сессии в неделю (MEV enhanced 10 = 6 стоя + 4 сидя), 5 при двух.
      const targetSets = isEnhanced ? (calvesSessions <= 1 ? 6 : 5) : 4;
      if (standing.sets < targetSets) {
        const sample = standing.workSets?.[standing.workSets.length - 1] || { reps: 15, rir: 3, weight: 0 };
        while (standing.sets < targetSets) { standing.workSets.push({ ...sample }); standing.sets += 1; }
      }
    } else {
      addEx('calves', /подъём.*носк|подъем.*носк|calf.*raise/i, isEnhanced ? 5 : 4, [12, 20], 'Малые группы: икры стоя (растянутая позиция)');
    }
    // Сидячие (камбаловидная): добираются, если нет ни одного сидячего
    // (вторая сессия не обязательна — MEV enhanced 10 требует 6+4 в одной).
    const seated = calves.find((e: any) => /сидя|sitting|seated/i.test(e.name || ''));
    if (!seated && !calves.some((e: any) => /сидя/i.test(e.name || ''))) {
      addEx('calves', /подъём.*носк.*сидя|подъем.*носк.*сидя|seated.*calf/i, isEnhanced ? 4 : 3, [15, 25], 'Малые группы: икры сидя (камбаловидная, stretch)');
    }
  }
  // Пресс: скручивания/подъёмы ног добираются до MEV (5 сетов) в Upper/FullBody.
  if (/Upper|Pull|Push|Torso|FullBody/.test(tag) && !muscleExcluded('abs')) {
    const absEx = working.find((e: any) => e.muscle === 'abs');
    if (absEx) {
      const targetSets = isEnhanced ? 5 : 4;
      if (absEx.sets < targetSets) {
        const sample = absEx.workSets?.[absEx.workSets.length - 1] || { reps: 15, rir: 3, weight: 0 };
        while (absEx.sets < targetSets) { absEx.workSets.push({ ...sample }); absEx.sets += 1; }
      }
    } else if (weekCountOf('abs') < 2) {
      addEx('abs', /скручиван|crunch|подъём.*ног|подъем.*ног|велосипед/i, isEnhanced ? 5 : 4, [15, 25], 'Малые группы: пресс (скручивания)');
    }
  }
  // Предплечья — с тягами (Pull/Back/Upper/FullBody): хватовая работа.
  // Не дублируем: максимум 2 источника в неделю (иначе > MRV).
  if (/Pull|Back|Upper|Torso|FullBody/.test(tag) && !muscleExcluded('forearms')) {
    const hasForearms = working.some((e: any) => e.muscle === 'forearms');
    if (!hasForearms && weekCountOf('forearms') < 2) {
      addEx('forearms', /запяст|wrist|зоттман/i, isEnhanced ? 4 : 3, [12, 20], 'Малые группы: предплечья с тягами (хват)');
    }
  }
  // Трапеции: шраги доводятся до MEV (natural 5 / enhanced 6) сетов — stretch
  // + задержка вверху; если шрагов в сессии нет — добавляем (до 2 источников).
  if (/Pull|Back|Upper|Torso|FullBody/.test(tag) && !muscleExcluded('traps')) {
    const shrug = working.find((e: any) => e.muscle === 'traps' && /шраг|shrug/i.test(e.name || ''));
    if (shrug) {
      const targetSets = isEnhanced ? 6 : 5;
      if (shrug.sets < targetSets) {
        const sample = shrug.workSets?.[shrug.workSets.length - 1] || { reps: 12, rir: 3, weight: 0 };
        while (shrug.sets < targetSets) { shrug.workSets.push({ ...sample }); shrug.sets += 1; }
      }
    } else if (weekCountOf('traps') < 2) {
      addEx('traps', /шраг|shrug/i, isEnhanced ? 6 : 5, [12, 18], 'Малые группы: шраги (stretch, задержка вверху)');
    }
  }
  // Ягодицы: hip thrust/отведение в Legs/FullBody — natural-сплиты теряют их
  // полностью (0 direct) из-за лимита упражнений и отсутствия в musclePlans.
  if (/Legs|Lower|LowerPower|LowerHyp|FullBody/.test(tag) && !muscleExcluded('glutes')) {
    const gl = working.filter((e: any) => e.muscle === 'glutes');
    if (!gl.length && weekCountOf('glutes') < 2) {
      addEx('glutes', /мост|hip.?thrust|отведен.*бедр|abduction|kick.?back/i, isEnhanced ? 5 : 4, [12, 18], 'Ягодицы: hip thrust/отведение (покрытие группы)');
    }
  }
}

/** Маппинг целевой группы сессии → разминочное лёгкое изолирующее движение. */
const WARMUP_ACTIVATOR: Record<string, RegExp> = {  back: /пуловер.*(блок|канат|cable)|тяга.*прям.*рук|straight.?arm/i,
  chest: /сведен.*(кроссовер|блок)|кроссовер|crossover|сведен.*тренаж/i,
  quads: /разгибан.*ног|leg.?extension/i,
  hamstrings: /сгибан.*ног|leg.?curl/i,
  glutes: /отведен.*бедр|abduction|kick.?back|ягодичн.*отвед/i,
  calves: /подъём.*носк|подъем.*носк|calf.?raise/i,
  shoulders: /мах|raise|lateral|отведен.*рук/i,
  biceps: /сгибан.*(блок|кабель|cable)|сгибан.*рук.*блок/i,
  triceps: /разгибан.*блок|pushdown/i,
  abs: /скручиван|crunch/i,
  forearms: /сгибан.*запяст|wrist.?curl/i,
};

/** Разминочное упражнение на целевую группу: 3×10-15 лёгких повторений (~25% workMax).
 *  Добавляется в начало сессии ПОСЛЕ всех проходов, чтобы его не удалил budget/dedupe.
 *  Не входит в объём (warmupActivator отсекается в bb-volume). */
function addWarmupActivator(session: any, options: BBFinalizeOptions): void {
  if (options.preserveSource) return;
  if (session.exercises.some((e: any) => e.warmupActivator)) return;
  const lead = WARMUP_LEAD[session.sessionTag || ''] || session.exercises.find((e: any) => e.role === 'primary')?.muscle;
  // BUG-FIX: не добавлять разминку для мышцы, исключённой травмой (exclude=true).
  const excludedMuscles = new Set(options.excludedMuscles || []);
  if (!lead || excludedMuscles.has(lead)) return;
  const pattern = WARMUP_ACTIVATOR[lead];
  if (!pattern) return;
  const candidate = EXERCISE_CATALOG.find((x: any) => {
    const tm = trueMuscleOf(x);
    if (tm === null || tm !== lead) return false;
    if (!pattern.test(x.name || '')) return false;
    // Уважаем equipment-ограничения пользователя.
    if (options.equipment?.length) {
      const eq = Array.isArray(x.equipment) ? x.equipment : [String(x.equipment || '')];
      if (eq.length > 0 && !eq.some((e: string) => options.equipment!.includes(e))) return false;
    }
    if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
    return true;
  });
  if (!candidate) return;
  const base = options.workMax?.[lead] || 50;
  const weight = Math.max(5, Math.round(base * 0.25 * 10) / 10);
  session.exercises.unshift({
    muscle: lead,
    name: candidate.name,
    exerciseName: candidate.name,
    role: 'accessory',
    character: 'памп',
    sets: 3,
    repsRange: [10, 15],
    rir: 4,
    workSets: Array.from({ length: 3 }, () => ({ reps: 12, rir: 4, weight, tempo: '3-0-1-0', restSeconds: 45 })),
    tempoSpec: '3-0-1-0',
    restSeconds: 45,
    warmupActivator: true,
    warmupSets: [],
    comment: `🌡 Разминка целевой группы ${lead}: ${candidate.name}, 3×12 @ ${weight} кг RIR 4 — активация перед рабочими подходами (не входит в объём).`,
    rationale: 'Warmup activator: лёгкая активация целевой мышцы перед основным объёмом',
  });
}

/** Целевая группа дня (по sessionTag). */
const WARMUP_LEAD: Record<string, string> = {
  Chest: 'chest', Back: 'back', Shoulders: 'shoulders', Arms: 'biceps',
  Push: 'chest', Pull: 'back', ChestBack: 'chest', ShouldersArms: 'shoulders',
  Upper: 'chest', UpperPower: 'chest', UpperHyp: 'chest',
  Torso: 'chest', Legs: 'quads', Lower: 'quads', LowerPower: 'quads', LowerHyp: 'quads',
  Glutes: 'glutes', GlutesHams: 'glutes', LegsBiceps: 'quads', Limbs: 'quads',
};

/**
 * Weekly back-pattern repair for adaptive/generic plans.
 * Volume specialization must not mean repeating pull-ups/vertical pulls in
 * every session. Keep a limited number of vertical slots and replace excess
 * slots with real catalog rows/lat work, preserving the prescribed sets.
 */
function repairBackFrequency(week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource) return;
  const backSessionCount = week.sessions.filter((session: any) => session.exercises.some((e: any) => e.muscle === 'back')).length;
  const keptProfiles = new Set<string>();
  let verticalSessionsSeen = 0;
  const sessions = [...week.sessions].sort((a: any, b: any) => a.day - b.day);
  for (const session of sessions) {
    let sessionHasKeptVertical = false;
    for (const exercise of session.exercises) {
      if (exercise.muscle !== 'back') continue;
      const tagged = annotateBackExercise(exercise);
      if (tagged.movementPattern !== 'vertical_pull') continue;
      const profile = verticalPullProfile(exercise.name) || 'cable_vertical';
      // Один профиль — максимум одна сессия. Вторая встреча того же профиля
      // (pullup в 2-й и 3-й FullBody-сессиях) заменяется на другой профиль
      // или row/lat работу, чтобы специализация не превращалась в ежедневные
      // одинаковые подтягивания.
      const shouldKeep = !sessionHasKeptVertical && !keptProfiles.has(profile);
      if (shouldKeep) {
        sessionHasKeptVertical = true;
        keptProfiles.add(profile);
        verticalSessionsSeen += 1;
        continue;
      }
      // Сначала ищем другой вертикальный профиль (wide ↔ hammer/neutral ↔
      // underhand). Хорошая вертикальная тяга не должна исчезать только
      // потому, что она вертикальная.
      const capAllowed = (candidate: any) => {
        if (!/подтяг|pull.?up|chin/i.test(candidate.name || '')) return true;
        const cap = options.bodyweightCapability;
        return !!(cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0));
      };
      const replacement = EXERCISE_CATALOG.find((candidate: any) => {
        if (trueMuscleOf(candidate) !== 'back') return false;
        if (!capAllowed(candidate)) return false;
        if (isAxialLoadExercise(candidate) && options.avoidAxialLoad) return false;
        if (options.excludedExercises?.includes(candidate.id) || options.excludedExercises?.includes(candidate.name)) return false;
        const next = annotateBackExercise({ ...exercise, name: candidate.name, exerciseName: candidate.name } as any);
        if (next.movementPattern !== 'vertical_pull') return false;
        const candidateProfile = verticalPullProfile(candidate.name);
        return candidateProfile !== null && candidateProfile !== profile && !keptProfiles.has(candidateProfile);
      }) || EXERCISE_CATALOG.find((candidate: any) => {
        if (trueMuscleOf(candidate) !== 'back') return false;
        if (!capAllowed(candidate)) return false;
        if (isAxialLoadExercise(candidate) && options.avoidAxialLoad) return false;
        if (options.excludedExercises?.includes(candidate.id) || options.excludedExercises?.includes(candidate.name)) return false;
        const next = annotateBackExercise({ ...exercise, name: candidate.name, exerciseName: candidate.name } as any);
        return next.movementPattern !== 'vertical_pull';
      });
      if (!replacement) continue;
      const next = annotateBackExercise({ ...exercise, name: replacement.name, exerciseName: replacement.name } as any);
      exercise.name = replacement.name;
      exercise.exerciseName = replacement.name;
      exercise.movementPattern = next.movementPattern;
      exercise.backSubgroup = next.backSubgroup;
      exercise.rationale = `${exercise.rationale || ''} Адаптация частоты: избыток vertical pull заменён на ${next.movementPattern}.`;
      const replacedProfile = verticalPullProfile(replacement.name);
      if (replacedProfile) keptProfiles.add(replacedProfile);
    }
  }
}

/** Ограничивает specialization/weak-point additions по частоте. */
function capAdaptiveSpecializationFrequency(week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || !options.priorityMuscles?.length) return;
  const priorities = new Set(options.priorityMuscles.map(m => String(m)));
  const maxSessions = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 3 : 2;
  const sessionsByMuscle = new Map<string, any[]>();
  for (const session of week.sessions) {
    for (const exercise of session.exercises) {
      const marked = /Weak pump-finisher|Фидер-сет|Auto-MEV-feeder|specialization|специализац|отстающ/i.test(`${exercise.comment || ''} ${exercise.rationale || ''}`);
      if (!marked || !priorities.has(exercise.muscle)) continue;
      const list = sessionsByMuscle.get(exercise.muscle) || [];
      if (!list.includes(session)) list.push(session);
      sessionsByMuscle.set(exercise.muscle, list);
    }
  }
  for (const [muscle, sessions] of sessionsByMuscle) {
    if (sessions.length <= maxSessions) continue;
    for (const session of sessions.slice(maxSessions)) {
      session.exercises = session.exercises.filter((exercise: any) => {
        const marked = /Weak pump-finisher|Фидер-сет|Auto-MEV-feeder|specialization|специализац|отстающ/i.test(`${exercise.comment || ''} ${exercise.rationale || ''}`);
        return !(marked && exercise.muscle === muscle);
      });
    }
  }
}



export interface BBFinalizeOptions {
  reorder?: boolean;
  methodology?: 'compound_first' | 'pre_exhaust' | 'post_exhaust';
  priorityMuscles?: string[];
  /** Расписание блоков специализации — per-week цели для спец-проходов
   *  (RIR 0-1, спец-частота, икры). Без него — старый режим: priorityMuscles
   *  на весь план. */
  specializationSchedule?: SpecializationSchedule;
  level?: string;
  volumeGoal?: 'mev' | 'mav' | 'mrv';
  phaseSafety?: boolean;
  controlledRotation?: boolean;
  equipment?: string[];
  excludedExercises?: string[];
  avoidAxialLoad?: boolean;
  excludedMuscles?: string[];
  /** Мышцы с ГРАДИРОВАННОЙ травмой (щадящий режим, exclude=false):
   *  остаются в плане со сниженным весом/объёмом/повторами. Добивочные
   *  проходы (MEV-feeders/fill/малые группы) НЕ должны добивать их до MEV —
   *  иначе щадящий режим раздувается обратно. */
  gradedMuscles?: string[];
  /** Ограничения мобильности (биомеханика): shoulder/hip/ankle/lower_back/wrist.
   *  Добавляемые финализатором упражнения тоже фильтруются. */
  mobilityRestrictions?: string[];
  ensureMinimumVolume?: boolean;
  workMax?: Record<string, number>;
  mrvMultiplier?: number;
  checkOrder?: boolean;
  preserveSource?: boolean;
  /** Высокообъёмный профиль: лимит всей сессии, а не одной мышцы. */
  maxWorkingSets?: number;
  maxExercises?: number;
  trainingYears?: number;
  /** Способность к bodyweight-упражнениям — фильтр подтягиваний при allocation. */
  bodyweightCapability?: {
    pullUpsStrict?: number;
    chinUpsStrict?: number;
    dipsStrict?: number;
    pushUpsStrict?: number;
    weightedPullUpLoad?: number;
    assistedPullUpLoad?: number;
  };
  /** Суперсеты-антагонисты (грудь↔спина, бицепс↔трицепс, квадры↔хамсы). */
  supersetMode?: 'none' | 'antagonist';
  /** Схема объёма памп-изоляций: GVT 10×10 / FST-7 / 8×8 Gironda. */
  volumeScheme?: 'standard' | 'gvt' | 'fst7' | 'gironda';
}

/** Специализация (методики Библиотеки): RIR-профиль (изоляции целевой мышцы
 *  добиваются до RIR 0-1), икры-спец (темп 2-2-1-0, сеты ≥4), спец-частота
 *  (целевая мышца ≥2×/нед — добавляем изоляции во вторую подходящую сессию). */
const SPEC_FREQ_TAGS: Record<string, string[]> = {
  chest: ['Push', 'Upper'], back: ['Pull', 'Upper', 'FullBody'],
  shoulders: ['Push', 'Upper', 'Arms'], quads: ['Legs', 'Lower', 'FullBody'],
  hamstrings: ['Legs', 'Lower', 'FullBody'], glutes: ['Legs', 'Lower', 'FullBody'],
  biceps: ['Pull', 'Arms', 'FullBody'], triceps: ['Push', 'Arms', 'FullBody'],
  calves: ['Legs', 'Lower', 'FullBody'], abs: ['FullBody', 'Torso'], traps: ['Pull', 'Upper'],
};
export function applySpecializationPass(plan: BBPlan, options: BBFinalizeOptions): void {
  const priority = options.priorityMuscles || [];
  const schedule = options.specializationSchedule;
  if (!priority.length && !schedule) return;
  const collapse = (k: string) => WEAK_TO_MUSCLE[k] || k;
  const equipmentOk = (c: any) => {
    if (!options.equipment?.length) return true;
    const eq = Array.isArray(c.equipment) ? c.equipment : [String(c.equipment || '')];
    return !eq.length || eq.some((e: string) => options.equipment!.includes(e));
  };

  for (const week of plan.weeks) {
    if (week.phase === 'deload') continue;
    // Цели НЕДЕЛИ: по активному расписанию блоков специализации или весь
    // priorityMuscles (legacy/неактивное расписание).
    const weekTargets = (schedule && schedule.active)
      ? specResForWeekSchedule(schedule, week.week).targets
      : priority.map(collapse);
    if (!weekTargets.length) continue;
    // Движок хранит упражнения по канонической мышце, а выбор пользователя
    // может быть гранулярным (delt_mid/delt_rear). Схлопываем только для
    // поиска упражнений, сохраняя сами зоны в priority/рационале.
    const targetMuscles = new Set(weekTargets.map(collapse));
    // Спец-частота ≥2×/нед: КАЖДАЯ целевая каноническая мышца получает
    // изоляцию во второй сессии. Раньше обрабатывалась только последняя
    // цель массива (для chest+back грудь могла остаться 1×/нед).
    for (const focusMuscle of targetMuscles) {
      const freq = week.sessions.filter(s => s.exercises.some((e: any) => e.muscle === focusMuscle && !(e as any).warmupActivator)).length;
      if (freq < 2) {
        const tags = SPEC_FREQ_TAGS[focusMuscle];
        if (tags) {
          const target = week.sessions.find(s =>
            !s.exercises.some((e: any) => e.muscle === focusMuscle && !(e as any).warmupActivator) &&
            tags.some(t => (s.sessionTag || '').includes(t)),
          );
          if (target) {
            const working = target.exercises.filter((e: any) => !(e as any).warmupActivator);
            const centralizedLimits = centralizedSessionLimits({ level: options.level, trainingYears: options.trainingYears });
            const maxEx = options.maxExercises ?? centralizedLimits.maxExercises;
            const maxSessionSets = options.maxWorkingSets ?? centralizedLimits.maxWorkingSets;
            const sessionSets = working.reduce((a: number, e: any) => a + (e.sets || 0), 0);
            const cap = (plan as any).mrvByMuscle?.[focusMuscle];
            const weekDirect = week.sessions.flatMap(s => s.exercises).filter((e: any) => e.muscle === focusMuscle && !(e as any).warmupActivator).reduce((a: number, e: any) => a + (e.sets || 0), 0);
            const template = target.exercises[0];
            if (template && working.length < maxEx && sessionSets + 3 <= maxSessionSets && (!cap || weekDirect + 3 <= cap)) {
              const candMuscle = (c: any) => trueMuscleOf(c)
                || (/отведен.*бедр|abduction/i.test(c.name || '') ? 'glutes' : null)
                || (/подъём.*носк|подъем.*носк|calf/i.test(c.name || '') ? 'calves' : null);
              const candidate = EXERCISE_CATALOG.find((c: any) => candMuscle(c) === focusMuscle && c.type === 'isolation' && equipmentOk(c) && !working.some((e: any) => e.name === c.name));
              if (candidate) {
                const baseWeight = options.workMax?.[focusMuscle] || 40;
                target.exercises.push({
                  ...template,
                  muscle: focusMuscle,
                  name: candidate.name,
                  exerciseName: candidate.name,
                  role: 'accessory',
                  character: 'памп',
                  sets: 3,
                  repsRange: [12, 15],
                  rir: 1,
                  restSeconds: 60,
                  workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 1, weight: Math.round(baseWeight * 0.3 * 10) / 10, restSeconds: 60 })),
                  comment: `Спец-частота 2×/нед: ${candidate.name} (вторая сессия целевой мышцы)`,
                });
              }
            }
          }
        }
      }
    }
    for (const session of week.sessions) {
      for (const ex of session.exercises) {
        if ((ex as any).warmupActivator) continue;
        const m = collapse(ex.muscle);
        if (!targetMuscles.has(m)) continue;
        // RIR-профиль специализации: изоляции целевой мышцы — RIR 0-1
        // (добивка до отказа, как в методиках массонабора). Определяем по
        // названию, а не по role: при специализации изоляции становятся
        // primary (сведение/махи/разгибания и т.д.), но всё равно добиваются.
        const isIso = /разгибан|сгибан|curl|raise|fly|мах|развод|шраг|pushdown|скручив|сведен|отведен|подъём.*бицепс|подъем.*бицепс/i.test(ex.name || '');
        if (isIso && (ex.rir ?? 2) > 0) {
          // Добивка до RIR 0-1 (методика: изоляции — до отказа).
          const newRir = Math.min(1, Math.max(0, ex.rir ?? 2));
          ex.rir = newRir;
          if (Array.isArray(ex.workSets)) for (const ws of ex.workSets) ws.rir = Math.max(0, newRir);
          if (!ex.comment || !ex.comment.includes('Спец-добивка')) {
            ex.comment = (ex.comment || '') + (ex.comment ? ' · ' : '') + 'Спец-добивка: RIR 0-1';
          }
        }
        // Икры-спец: пауза 2с внизу + 2с вверху, сеты ≥4 (12-20 подходов/нед).
        if (ex.muscle === 'calves' && (ex.sets ?? 0) < 4) {
          const cap = (plan as any).mrvByMuscle?.calves;
          const weekDirect = week.sessions.flatMap(s => s.exercises).filter((e: any) => e.muscle === 'calves' && !(e as any).warmupActivator).reduce((a: number, e: any) => a + (e.sets || 0), 0);
          if (!cap || weekDirect + (4 - (ex.sets ?? 0)) <= cap) {
            ex.sets = 4;
            if (Array.isArray(ex.workSets)) {
              const sample = ex.workSets[ex.workSets.length - 1] || { reps: 12, rir: 1, weight: 0, restSeconds: 60 };
              ex.workSets = Array.from({ length: 4 }, () => ({ ...sample, tempo: '2-2-1-0' }));
            }
            if (!ex.comment || !ex.comment.includes('Икры-спец')) {
              ex.comment = (ex.comment || '') + (ex.comment ? ' · ' : '') + 'Икры-спец: пауза 2с внизу + 2с вверху';
            }
          }
        }
        if (ex.muscle === 'calves') {
          for (const ws of ex.workSets || []) ws.tempo = '2-2-1-0';
        }
      }
    }
  }
}

/** Лимит упражнений сессии (10/14/18) применяется пост-фактум: слабые
 *  группы могут привести к перебору в buildSession (спец-слоты), а проходы
 *  только не дают ДОБАВЛЯТЬ сверх лимита. Удаляем лишние: изоляции-дубли
 *  сначала, затем accessory, сохраняя минимум 1 упражнение мышцы. */
function enforceSessionExerciseLimit(plan: BBPlan, options: BBFinalizeOptions): void {
  const iso = (n: string) => /разгибан|сгибан|curl|raise|fly|мах|развод|шраг|pushdown|скручив|отведен|сведен|face.?pull|тяга.*лиц|подъём.*бицепс|подъем.*бицепс|подъём гантел|подъем гантел|наклонн.*скам|incline.*curl|молот|hammer|француз|french|из.?за.*голов|overhead/i.test(n);
  const maxEx = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 18 : options.level === 'enhanced' && (options.trainingYears ?? 0) >= 1 ? 14 : 10;
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      const working = () => session.exercises.filter((e: any) => !(e as any).warmupActivator);
      if (working().length <= maxEx) continue;
      // Изоляции по имени (в спец-планах они primary — но дубли паттернов
      // всё равно лишние), затем accessory-не-изоляции; compound не трогаем.
      const isoRemovable = (ex: any) => iso(ex.name || '');
      let candidates = working().filter(isoRemovable).sort((a: any, b: any) => (a.sets || 0) - (b.sets || 0));
      for (const ex of candidates) {
        if (working().length <= maxEx) break;
        const count = working().filter((x: any) => x.muscle === ex.muscle).length;
        if (count <= 1) continue;
        session.exercises = session.exercises.filter((x: any) => x !== ex);
      }
      if (working().length > maxEx) {
        // Изоляции с дублем мышцы исчерпаны — удаляем любые изоляции,
        // кроме мелких мышц (calves/abs/forearms/traps — у них нет compound).
        candidates = working().filter((ex: any) => iso(ex.name || '') && !/calves|abs|forearms|traps/.test(ex.muscle)).sort((a: any, b: any) => (a.sets || 0) - (b.sets || 0));
        for (const ex of candidates) {
          if (working().length <= maxEx) break;
          session.exercises = session.exercises.filter((x: any) => x !== ex);
        }
      }
      if (working().length > maxEx) {
        candidates = working().filter((e: any) => e.role === 'accessory').sort((a: any, b: any) => (a.sets || 0) - (b.sets || 0));
        for (const ex of candidates) {
          if (working().length <= maxEx) break;
          const count = working().filter((x: any) => x.muscle === ex.muscle).length;
          if (count <= 1) continue;
          session.exercises = session.exercises.filter((x: any) => x !== ex);
        }
      }
    }
  }
}

/** Суперсеты-антагонисты: пары грудь↔спина, бицепс↔трицепс, квадры↔хамсы.
 *  Помечаем supersetWith + comment (лимиты не меняются), максимум 3 пары/сессию. */
const ANTAGONIST_PAIRS: Array<[string, string]> = [
  ['chest', 'back'], ['back', 'chest'],
  ['biceps', 'triceps'], ['triceps', 'biceps'],
  ['quads', 'hamstrings'], ['hamstrings', 'quads'],
];
export function markAntagonistSupersets(plan: BBPlan): void {
  for (const week of plan.weeks) {
    if (week.phase === 'deload') continue;
    for (const session of week.sessions) {
      const working = session.exercises.filter((e: any) => !(e as any).warmupActivator);
      const paired = new Set<any>();
      let pairs = 0;
      for (const ex of working) {
        if (paired.has(ex)) continue;
        const mate = working.find((o: any) => !paired.has(o) && o !== ex && ANTAGONIST_PAIRS.some(([a, b]) => a === ex.muscle && b === o.muscle));
        if (!mate) continue;
        ex.supersetWith = mate.name;
        mate.supersetWith = ex.name;
        ex.comment = (ex.comment || '') + (ex.comment ? ' · ' : '') + `🔗 Суперсет с «${mate.name}» (антагонист)`;
        mate.comment = (mate.comment || '') + (mate.comment ? ' · ' : '') + `🔗 Суперсет с «${ex.name}» (антагонист)`;
        paired.add(ex); paired.add(mate);
        pairs++;
        if (pairs >= 3) break;
      }
    }
  }
}

/** Схемы объёма памп-дней: суммарный target на мышцу распределяется по
 *  памп-изоляциям сессии (cap 5 сетов/упражнение сохраняется). */
const VOLUME_SCHEMES: Record<string, { target: number; reps: [number, number]; rest: number; label: string }> = {
  gvt: { target: 10, reps: [10, 12], rest: 75, label: 'GVT 10×10' },
  fst7: { target: 7, reps: [8, 12], rest: 40, label: 'FST-7' },
  gironda: { target: 8, reps: [8, 10], rest: 60, label: '8×8 Gironda' },
};
export function applyVolumeScheme(plan: BBPlan, scheme: string): void {
  const cfg = VOLUME_SCHEMES[scheme];
  if (!cfg) return;
  const caps = (plan as any).mrvByMuscle || {};
  for (const week of plan.weeks) {
    if (week.phase === 'deload') continue;
    // Недельный прямой объём по мышцам (до схемы) — схема не должна
    // выталкивать мышцу за её адаптированный MRV-кап.
    const weekDirect: Record<string, number> = {};
    for (const s of week.sessions) for (const e of s.exercises) {
      if ((e as any).warmupActivator) continue;
      weekDirect[e.muscle] = (weekDirect[e.muscle] || 0) + (e.sets || 0);
    }
    const schemeApplied = new Set<string>();
    for (const session of week.sessions) {
      const byMuscle: Record<string, any[]> = {};
      for (const ex of session.exercises) {
        if ((ex as any).warmupActivator) continue;
        if (ex.role !== 'accessory' || ex.character !== 'памп') continue;
        // Схемы объёма — для крупных мышц: мелкие (икры/предплечья/пресс/трапеции)
        // имеют малые капы MRV, и 7-10 сетов изоляций туда не влезают.
        if (['forearms', 'abs', 'calves', 'traps'].includes(ex.muscle)) continue;
        (byMuscle[ex.muscle] ||= []).push(ex);
      }
      for (const exs of Object.values(byMuscle)) {
        const muscle = exs[0].muscle;
        if (schemeApplied.has(muscle)) continue;
        const cap = caps[muscle];
        if (cap) {
          const oldIsolation = exs.reduce((a: number, e: any) => a + (e.sets || 0), 0);
          const newTotal = (weekDirect[muscle] || 0) - oldIsolation + cfg.target;
          if (newTotal > cap) continue; // не влезает в MRV — схему не применяем
        }
        schemeApplied.add(muscle);
        let remaining = cfg.target;
        for (const ex of exs) {
          if (remaining <= 0) break;
          // FST-7/GVT/8×8 дают target сетов на мышцу, распределяя по упражнениям
          // с капом 5 сетов/упражнение (инвариант). FST-7: 5+2, GVT: 5+5.
          const sets = Math.min(5, remaining);
          if (sets < 2) break;
          if (sets !== ex.sets || (ex.repsRange && ex.repsRange[0] !== cfg.reps[0])) {
            ex.sets = sets;
            ex.repsRange = cfg.reps;
            ex.restSeconds = cfg.rest;
            if (Array.isArray(ex.workSets) && ex.workSets.length > 0) {
              const sample = ex.workSets[ex.workSets.length - 1];
              ex.workSets = Array.from({ length: sets }, () => ({ ...sample, reps: cfg.reps[1], restSeconds: cfg.rest }));
            }
            ex.comment = (ex.comment || '') + (ex.comment ? ' · ' : '') + `${cfg.label} (${sets}×${cfg.reps[0]}-${cfg.reps[1]}, отдых ${cfg.rest}с)`;
          }
          remaining -= sets;
        }
      }
    }
  }
}

function addAdaptiveMEVFeeders(plan: BBPlan, options: BBFinalizeOptions): void {
  if (!options.level) return;
  const excluded = new Set(options.excludedExercises || []);
  const excludedMuscles = new Set(options.excludedMuscles || []);
  const gradedMuscles = new Set(options.gradedMuscles || []);
  const equipment = options.equipment || [];
  const candidates = EXERCISE_CATALOG.filter(candidate => {
    if (candidate.type !== 'isolation' && (candidate as any).exerciseType !== 'isolation' || bbExerciseTier(candidate) > 2) return false;
    if (excluded.has(candidate.id) || excluded.has(candidate.name)) return false;
    if (excludedMuscles.has(candidate.group) || excludedMuscles.has(trueMuscleOf(candidate) || '')) return false;
    if (options.avoidAxialLoad && isAxialLoadExercise(candidate as any)) return false;
    if (isMobilityRestricted(candidate, options.mobilityRestrictions)) return false;
    if (equipment.length > 0) {
      const candidateEquipment = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
      if (candidateEquipment.length > 0 && !candidateEquipment.some(item => equipment.includes(item))) return false;
    }
    return trueMuscleOf(candidate) !== null;
  });
  const muscles = [...new Set(candidates.map(candidate => trueMuscleOf(candidate) || ''))].filter(Boolean);
  for (const week of plan.weeks) {
    const phase = String((week as any).phase || '').toLowerCase();
    if (phase === 'deload' || week.sessions.some(session => session.exercises.some(exercise => /разгруз|deload/i.test(exercise.comment || '')))) continue;
    const donors = tradeoffDonorsForWeek(options, week.week);
    const weekVolume = aggregateBBVolume(week.sessions);
    // Prioritize muscles by target-volume deficit (target vs effective), not just MEV.
    const deficitByMuscle = muscles
      .filter(muscle => !donors.has(muscle))
      .map((muscle: string) => {
      const landmarks = getVolumeLandmarks(options.level!, muscle);
      const effectiveSets = weekVolume[muscle]?.effectiveSets || 0;
      const target = plan.volumeTargets?.[muscle];
      const targetSets = target?.targetSets ?? landmarks?.mav ?? 0;
      const mev = landmarks?.mev ?? 0;
      const deficit = Math.max(0, targetSets - effectiveSets);
      const mevDeficit = Math.max(0, mev - effectiveSets);
      return { muscle, landmarks, effectiveSets, target, targetSets, deficit, mevDeficit };
    }).filter(item => item.landmarks && item.mevDeficit > 0)
      .sort((a, b) => b.deficit - a.deficit || b.mevDeficit - a.mevDeficit);

    for (const { muscle, landmarks, effectiveSets, target } of deficitByMuscle) {
      if (!landmarks || effectiveSets >= landmarks.mev) continue;
      // Щадящий режим: градированная травма намеренно снижает объём —
      // feeder-добивка до MEV отменяет снижение, пропускаем.
      if (gradedMuscles.has(muscle)) continue;
      // Интеграция с builder-feeder: если мышца уже получила MEV coverage
      // (builder-путь, до normalize) — finalize не дублирует свою добивку.
      const weekHasBuilderFeeder = week.sessions.some(s => s.exercises.some(e => e.muscle === muscle && /MEV coverage/.test(e.rationale || '')));
      if (weekHasBuilderFeeder) continue;
      const session = week.sessions.find(item => item.exercises.some(exercise => (trueMuscleOf({ name: exercise.name, muscle: exercise.muscle } as any) || exercise.muscle) === muscle));
      if (!session || session.exercises.length >= 10) continue;
      // Feeder volume is capped by MEV deficit, not full target deficit,
      // to avoid overloading the session with isolation feeders.
      let remaining = Math.max(0, landmarks.mev - effectiveSets);
      const sessionVolume = aggregateBBVolume([session])[muscle]?.directSets || 0;
      const maxSetsPerSession = target?.maxSetsPerSession ?? Math.max(2, Math.ceil(landmarks.mrv / Math.max(1, target?.frequency || 1)));
      remaining = Math.min(remaining, Math.max(0, maxSetsPerSession - sessionVolume));
      if (remaining <= 0) continue;
      const used = new Set(session.exercises.map(exercise => exercise.name));
      const baseWeight = options.workMax?.[muscle] || 50;
      const weight = Math.max(5, Math.round(baseWeight * 0.3 * 10) / 10);
      // Интеграция с allocation: максимум 2 feeder-слота на мышцу (3+ одинаковых
      // изоляций = мусор); deficit разбивается: первый слот до 5 сетов (cap),
      // второй — остаток (макс. 3).
      let feederSlots = 0;
      for (const candidate of candidates.filter(item => trueMuscleOf(item) === muscle && !used.has(item.name))) {
        if (remaining <= 0 || session.exercises.length >= 10 || feederSlots >= 2) break;
        const sets = feederSlots === 0
          ? Math.min(5, Math.max(2, Math.ceil(remaining / 2)))
          : Math.min(3, Math.max(2, remaining));
        if (sets < 2) break;
        const workSets = Array.from({ length: sets }, () => ({ reps: 15, rir: 3, weight, tempo: '3-0-1-0', restSeconds: 45 }));
        session.exercises.push({
          muscle, name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: 'памп', sets,
          repsRange: [12, 20], rir: 3, workSets, tempoSpec: '3-0-1-0', restSeconds: 45,
          comment: `MEV feeder: ${sets}×15-20 для покрытия effective MEV ${landmarks.mev} сетов @${weight} кг; session cap ${maxSetsPerSession}. Target deficit: ${target ? target.targetSets - effectiveSets : 0} sets.`,
          rationale: 'Adaptive MEV coverage feeder', warmupSets: [],
        });
        used.add(candidate.name);
        remaining -= sets;
        feederSlots += 1;
      }
    }
  }
}

function applyControlledAccessoryRotation(plan: BBPlan, options: Pick<BBFinalizeOptions, 'equipment' | 'excludedExercises' | 'avoidAxialLoad' | 'excludedMuscles' | 'mobilityRestrictions'> = {}): void {
  const optionsEquipment = options.equipment || [];
  const excluded = new Set(options.excludedExercises || []);
  const excludedMuscles = new Set(options.excludedMuscles || []);
  const usedNames = new Set<string>();
  const previousPatternByMuscle = new Map<string, string>();
  for (const week of plan.weeks) {
    const phase = String((week as any).phase || '').toLowerCase();
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        if (exercise.role === 'primary') continue;
        const pattern = derivePattern(exercise);
        const previousPattern = previousPatternByMuscle.get(exercise.muscle);
        if (previousPattern && previousPattern === pattern) {
          const equipmentOf = (name: string): string => {
            const value = name.toLowerCase();
            if (/кроссовер|блок|кабел|трос/.test(value)) return 'cable';
            if (/гантел/.test(value)) return 'dumbbell';
            if (/штанг/.test(value)) return 'barbell';
            if (/тренажёр|тренажер|машин/.test(value)) return 'machine';
            return 'other';
          };
          const phaseEquipment = phase === 'accumulation'
            ? ['machine', 'cable', 'dumbbell']
            : phase === 'deload'
              ? ['machine', 'cable', 'bodyweight']
              : ['barbell', 'smith', 'machine', 'dumbbell'];
          const replacementScore = (candidate: typeof EXERCISE_CATALOG[number]): number => {
            const eq = String(candidate.equipment || '').toLowerCase();
            const phaseIndex = phaseEquipment.findIndex(preferred => eq.includes(preferred));
            const sameEquipment = eq === equipmentOf(exercise.name) ? 1 : 0;
            const canonical = bbExerciseTier(candidate) === 1 ? 2 : 0;
            const phaseBonus = phaseIndex < 0 ? 0 : (phaseEquipment.length - phaseIndex) * 3;
            return phaseBonus + sameEquipment + canonical;
          };
          const replacement = EXERCISE_CATALOG
            .filter(candidate => {
            if (excluded.has(candidate.id) || excluded.has(candidate.name)) return false;
            if (excludedMuscles.has(candidate.group) || excludedMuscles.has(trueMuscleOf(candidate) || '')) return false;
            if (options.avoidAxialLoad && isAxialLoadExercise(candidate as any)) return false;
            if (isMobilityRestricted(candidate, options.mobilityRestrictions)) return false;
            if (usedNames.has(candidate.name) || bbExerciseTier(candidate) > 2) return false;
            if (trueMuscleOf(candidate) !== exercise.muscle) return false;
            if (optionsEquipment.length > 0) {
              const candidateEquipment = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
              if (candidateEquipment.length > 0 && !candidateEquipment.some(item => optionsEquipment.includes(item))) return false;
            }
            if (derivePattern(candidate) === pattern && equipmentOf(candidate.name) === equipmentOf(exercise.name)) return false;
            return candidate.type === 'isolation' || (exercise as any).type === 'compound' || (exercise as any).exerciseType === 'compound';
            })
            .sort((a, b) => replacementScore(b) - replacementScore(a))[0];
          if (replacement) {
            const oldName = exercise.name;
            const oldEquipment = equipmentOf(oldName);
            const newEquipment = equipmentOf(replacement.name);
            const equipmentLoadRatio: Record<string, number> = {
              barbell: 1,
              smith: 0.9,
              dumbbell: 0.8,
              machine: 0.85,
              cable: 0.8,
              bodyweight: 0.7,
              other: 1,
            };
            const oldRatio = equipmentLoadRatio[oldEquipment] || 1;
            const newRatio = equipmentLoadRatio[newEquipment] || 1;
            const loadRatio = newRatio / oldRatio;
            exercise.name = replacement.name;
            exercise.exerciseName = replacement.name;
            exercise.workSets = (exercise.workSets || []).map(set => ({
              ...set,
              weight: Math.round(set.weight * loadRatio * 10) / 10,
            }));
            exercise.comment = [exercise.comment, `Оборудование ротации: ${oldEquipment} → ${newEquipment}; вес скорректирован ×${loadRatio.toFixed(2)}`].filter(Boolean).join('. ');
            exercise.rationale = [exercise.rationale, `Controlled rotation: ${oldName} -> ${replacement.name}`].filter(Boolean).join(' | ');
            usedNames.add(replacement.name);
            previousPatternByMuscle.set(exercise.muscle, derivePattern(replacement));
            continue;
          }
        }
        previousPatternByMuscle.set(exercise.muscle, pattern);
        usedNames.add(exercise.name);
      }
    }
  }
}

function repairAdaptiveSafety(plan: BBPlan, options: BBFinalizeOptions): void {
  const equipment = options.equipment || [];
  const excludedExercises = new Set(options.excludedExercises || []);
  const excludedMuscles = new Set(options.excludedMuscles || []);
  for (const week of plan.weeks) for (const session of week.sessions) for (const exercise of session.exercises) {
    const equipmentAllowed = (candidate: typeof EXERCISE_CATALOG[number]) => {
      if (!candidate || !candidate.name) return false;
      const raw = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
      return !equipment.length || raw.length === 0 || raw.some(item => equipment.includes(item));
    };
    const catalogExercise = EXERCISE_CATALOG.find(item => item.name === exercise.name || item.id === exercise.exerciseName);
    const unknownWithEquipmentRestriction = equipment.length > 0 && !catalogExercise;
    const unsafe = excludedExercises.has(exercise.name) || excludedExercises.has(exercise.exerciseName || '') || excludedMuscles.has(exercise.muscle) || (options.avoidAxialLoad && isAxialLoadExercise({ name: exercise.name, id: exercise.exerciseName } as any)) || isMobilityRestricted(exercise, options.mobilityRestrictions) || unknownWithEquipmentRestriction || !equipmentAllowed(catalogExercise as any);
    if (excludedMuscles.has(exercise.muscle)) continue;
    if (!unsafe) continue;
    const replacement = EXERCISE_CATALOG
      .filter(candidate => bbExerciseTier(candidate) <= 2 && trueMuscleOf(candidate) === exercise.muscle && !excludedExercises.has(candidate.id) && !excludedExercises.has(candidate.name) && !excludedMuscles.has(candidate.group) && !isAxialLoadExercise(candidate as any) && !isMobilityRestricted(candidate, options.mobilityRestrictions) && equipmentAllowed(candidate))
      .sort((a, b) => (exercise.role === 'primary' ? (bbExerciseTier(a) - bbExerciseTier(b)) : ((a.type === 'isolation' ? 0 : 1) - (b.type === 'isolation' ? 0 : 1))))[0];
    if (!replacement) continue;
    const oldName = exercise.name;
    exercise.name = replacement.name;
    exercise.exerciseName = replacement.name;
    const loadRatio: Record<string, number> = { barbell: 1, smith: 0.9, machine: 0.85, dumbbell: 0.8, cable: 0.8, bodyweight: 0.7 };
    const equipmentOfName = (name: string): string => {
      const value = name.toLowerCase();
      if (/гантел|dumbbell/.test(value)) return 'dumbbell';
      if (/штанг|barbell|гриф/.test(value)) return 'barbell';
      if (/тренаж|машин|smith|смит/.test(value)) return 'machine';
      if (/блок|кроссовер|кабел|трос|cable/.test(value)) return 'cable';
      if (/свой вес|собственн|bodyweight|подтяг|отжим/.test(value)) return 'bodyweight';
      return 'other';
    };
    const replacementEquipment = Array.isArray(replacement.equipment)
      ? replacement.equipment.find(item => loadRatio[String(item)] != null)
      : replacement.equipment;
    const ratio = (loadRatio[String(replacementEquipment)] || 1) / (loadRatio[equipmentOfName(oldName)] || 1);
    exercise.workSets = exercise.workSets.map(set => ({ ...set, weight: Math.round(set.weight * ratio * 10) / 10 }));
    exercise.comment = [exercise.comment, `Safety repair: ${oldName} → ${replacement.name}; вес скорректирован ×${ratio.toFixed(2)}`].filter(Boolean).join('. ');
    exercise.rationale = [exercise.rationale, 'Adaptive safety replacement'].filter(Boolean).join(' | ');
  }
}

function applyAdaptivePhaseSafety(plan: BBPlan): void {
  for (let index = 1; index < plan.weeks.length; index++) {
    const week = plan.weeks[index];
    const weekPhase = String((week as any).phase || '').toLowerCase();
    const isDeloadWeek = Boolean((week as any).deload) || weekPhase === 'deload' || weekPhase === 'transition';
    if (!isDeloadWeek && !week.sessions.some(session => session.exercises.some(exercise => exercise.character === 'лёг' || /разгруз|deload/i.test(exercise.comment || '')))) continue;
    const previous = plan.weeks[index - 1];
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        const previousExercise = previous.sessions.flatMap(item => item.exercises).find(item => item.name === exercise.name && item.muscle === exercise.muscle);
        const previousSets = previousExercise?.sets ?? exercise.sets;
        const targetSets = Math.max(1, Math.ceil(previousSets * 0.6));
        if (exercise.sets > targetSets) exercise.sets = targetSets;
        exercise.rir = Math.max(3, exercise.rir ?? 2);
        exercise.workSets = (exercise.workSets || []).slice(0, exercise.sets).map(set => ({ ...set, rir: Math.max(3, set.rir ?? 2) }));
      }
    }
  }
}

function enrichExerciseRationale(plan: BBPlan): void {
  for (const week of plan.weeks) for (const session of week.sessions) for (const [index, exercise] of session.exercises.entries()) {
    const contributions = exerciseVolumeContributions(exercise);
    const direct = contributions.find(item => item.source === 'direct');
    const indirect = contributions.filter(item => item.source === 'indirect').map(item => `${item.muscle} +${item.effectiveSets.toFixed(1)}`).join(', ');
    const tags = [exercise.role === 'primary' ? 'primary' : 'accessory', `direct ${direct?.directSets ?? exercise.sets} sets`];
    if (indirect) tags.push(`effective overlap: ${indirect}`);
    if ((exercise as any).substituted) tags.push(`замена: ${(exercise as any).originalName || 'исходное упражнение'}`);
    const position = index === 0 ? 'primary/lead' : exercise.role === 'primary' ? 'secondary compound' : exercise.character === 'памп' ? 'pump finisher' : 'accessory';
    exercise.rationale = [exercise.rationale, tags.join('; '), `final position: ${position} (#${index + 1})`].filter(Boolean).join(' | ');
  }
}

/**
 * Общий последний проход для generic, проф-циклов и библиотечных программ.
 * Не меняет объём и не добавляет упражнения: только приводит форму результата
 * к единому BBPlan-контракту и восстанавливает тренерский порядок там, где
 * выбран adapt-путь.
 */
export function finalizeBBPlan(plan: BBPlan, options: BBFinalizeOptions = {}): BBPlan {
  options = {
    ...options,
    equipment: options.equipment ?? plan.safetyConstraints?.equipment,
    excludedExercises: options.excludedExercises ?? plan.safetyConstraints?.excludedExercises,
    excludedMuscles: options.excludedMuscles ?? plan.safetyConstraints?.excludedMuscles,
    avoidAxialLoad: options.avoidAxialLoad ?? plan.safetyConstraints?.avoidAxialLoad,
  };
  const next: BBPlan = {
    ...plan,
    safetyConstraints: {
      ...plan.safetyConstraints,
      ...(options.equipment !== undefined ? { equipment: options.equipment } : {}),
      ...(options.excludedExercises !== undefined ? { excludedExercises: options.excludedExercises } : {}),
      ...(options.excludedMuscles !== undefined ? { excludedMuscles: options.excludedMuscles } : {}),
      ...(options.avoidAxialLoad !== undefined ? { avoidAxialLoad: options.avoidAxialLoad } : {}),
    },
    weeks: plan.weeks.map(week => ({
      ...week,
      sessions: week.sessions.map(session => ({ ...session, exercises: [...session.exercises] })),
    })),
  };
  for (const week of next.weeks) for (const session of week.sessions) {
    session.exercises = session.exercises.map(ex => ex.muscle === 'back' ? annotateBackExercise(ex) : ex);
  }
  syncBBPlanSetShape(next);
  // 🏁 Contest prep guard: план сконфигурирован каноническим prep-движком
  // (contestPhase/peakWeek/prepProtocol) — его недели уже сформированы:
  // подготовка (режим RIR 1–3/объём), финальная (×0.9), taper (кривая),
  // пик-неделя (памп). Повторная финализация (revalidate после ручных правок
  // в «Коррекции») НЕ должна перестраивать состав/объём — только форма.
  // Ручные правки пользователя применяются ДО revalidate (exerciseEdits →
  // applyEditsToPlan), поэтому ранний return их не теряет.
  if (next.weeks.some((w: any) => w.peakWeek === true || w.contestPhase === 'taper' || w.contestPhase === 'peak_week' || (typeof w.prepProtocol === 'string' && !String(w.prepProtocol).startsWith('Пропущена')))) {
    syncBBPlanSetShape(next);
    return next;
  }
  // 🏁 Contest prep guard: недели, управляемые каноническим prep-движком
  // (taper/пик-неделя с prepProtocol/contestPhase), НЕ должны получать объём
  // от финализатора при повторной финализации (revalidate после ручных правок):
  // иначе leg-target/feeders/back-аллокации «раздувают» taper обратно.
  const isPrepControlled = (w: any): boolean =>
    w.contestPhase === 'taper' || w.contestPhase === 'peak_week'
    || (typeof w.prepProtocol === 'string' && !String(w.prepProtocol).startsWith('Пропущена')) || w.peakWeek === true;
  const planHasPrep = next.weeks.some(isPrepControlled);
  // Final hard invariant for adaptive high-volume leg sessions. This is kept
  // after every other pass so fatigue/rotation cannot silently turn a major
  // leg group into one 3-4 set exercise.
  if (!options.preserveSource && options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3) {
    for (const week of next.weeks) {
      if (isPrepControlled(week)) continue; // prep-недели не раздуваем
      for (const session of week.sessions) {
      if (!/Legs|Lower|LowerPower|LowerHyp/.test(session.sessionTag || '')) continue;
      const target = (options.trainingYears ?? 0) >= 6 ? 12 : 10;
      for (const muscle of ['quads', 'hamstrings', 'glutes']) {
        const items = session.exercises.filter((e: any) => e.muscle === muscle);
        if (!items.length) continue;
        let total = items.reduce((n: number, e: any) => n + e.sets, 0);
        for (const e of items) {
          while (total < target && e.sets < 5) {
            const sample = e.workSets?.[e.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
            e.sets += 1; e.workSets.push({ ...sample }); total += 1;
          }
          if (total >= target) break;
        }
        if (total < target) {
          const used = new Set(items.map((e: any) => e.name));
          const candidate = EXERCISE_CATALOG.find((x: any) => trueMuscleOf(x) === muscle && !used.has(x.name));
          if (candidate) {
            const base: any = items[0];
            const added: any = structuredClone(base);
            added.name = candidate.name;
            added.exerciseName = candidate.name;
            added.role = 'accessory';
            added.sets = Math.min(4, target - total);
            const sample = base.workSets?.[0] || { reps: 10, rir: 2, weight: 0 };
            added.workSets = Array.from({ length: added.sets }, () => ({ ...sample }));
            session.exercises.push(added);
          }
        }
      }
    }
  }
  }
  syncBBPlanSetShape(next);
  if (!options.preserveSource && options.phaseSafety) applyAdaptivePhaseSafety(next);
  if (!options.preserveSource && options.reorder !== false) repairAdaptiveSafety(next, options);
  // 🏁 Prep guard: feeders/ротация добавляют или заменяют упражнения — для taper/пик
  // недель это нарушает «без новых упражнений и без роста объёма».
  if (!options.preserveSource && options.ensureMinimumVolume && !planHasPrep) addAdaptiveMEVFeeders(next, options);
  if (!options.preserveSource && options.controlledRotation && !planHasPrep) applyControlledAccessoryRotation(next, options);
    // Последний back allocation после rotation/fatigue/taper: именно здесь
  // проверяем фактические финальные сеты, а не промежуточный план.
  for (const week of next.weeks) {
    if (isPrepControlled(week)) continue; // prep-недели: объём и состав фиксированы
    for (const session of week.sessions) {
    allocateExperiencedBackSession(session, week, options);
    ensureBackBalance(session, week, options);
    allocateExperiencedArmSession(session, week, options);
    allocateExperiencedLegSession(session, week, options);
    diversifyExperiencedChestSession(session, week, options);
    ensureRearDeltInPull(session, week, options);
    ensureArmHeadCoverage(session, week, options);
    // Специализация/малые группы — только для генераторных планов (pattern.id):
    // произвольные/faithful входы сохраняют исходный набор упражнений.
    if ((next as any).pattern?.id) {
      const weekOptions = options.specializationSchedule?.active
        ? {
            ...options,
            priorityMuscles: specResForWeekSchedule(options.specializationSchedule, week.week).targets,
          }
        : options;
      ensureWeakPatternCoverage(session, weekOptions);
      ensureSmallMuscleQuality(session, week, options);
    }
    }
  }
for (const week of next.weeks) {
    // 🏁 Prep guard: недели, управляемые contest prep, не проходят MEV-guard/
    // tidy/fit/repair/back-баланс — повторная финализация (revalidate после ручных
    // правок) НЕ должна менять их упражнения/объём (пользовательские правки и
    // prep-кривая сохраняются).
    if (isPrepControlled(week)) continue;
    // MEV-guard карта недели: бюджет не режет сеты ниже ceil(MEV/частота) —
    // иначе natural-планы получают deficit, а fill не может добавить (сессии
    // на лимите). Только для генераторных планов (pattern.id): произвольные/
    // faithful входы сохраняют исходный объём (контракт финализатора).
    const guardMap: Record<string, number> = {};
    if (options.level && !options.preserveSource && (next as any).pattern?.id) {
      const w: any = week;
      if (w.phase !== 'deload' && !week.sessions.some(s => s.exercises.some(e => /разгруз|deload/i.test(e.comment || '')))) {
        const sessionsWith = new Map<string, number>();
        for (const s of week.sessions) {
          const seenInSession = new Set<string>();
          for (const e of s.exercises) {
            if ((e as any).warmupActivator) continue;
            seenInSession.add(e.muscle);
          }
          for (const m of seenInSession) sessionsWith.set(m, (sessionsWith.get(m) || 0) + 1);
        }
        for (const [muscle, freq] of sessionsWith) {
          const lm = getVolumeLandmarks(options.level, muscle);
          if (!lm) continue;
          // Малые группы — константный минимум (freq может раздуваться
          // промежуточными проходами, ломая guard): calves 5, traps 6 (MEV
          // enhanced), forearms/abs 5, glutes 4 (natural-сплиты теряют их).
          guardMap[muscle] = muscle === 'traps' ? 6 : ['calves', 'forearms', 'abs'].includes(muscle) ? 5 : muscle === 'glutes' ? 4 : Math.max(2, Math.ceil(lm.mev / freq));
        }
      }
    }
    for (const session of week.sessions) {
      // Если суммарный MEV-guard сессии превышает лимит — масштабируем guard'ы
      // пропорционально (минимум 2), иначе бюджет не сможет уложиться в лимит.
      const maxWorkingSets = options.maxWorkingSets ?? 24;
      let sessionGuard = guardMap;
      if (Object.keys(guardMap).length) {
        let totalGuard = 0;
        const sesGuard: Record<string, number> = {};
        for (const e of session.exercises) {
          const g = guardMap[e.muscle];
          if (g) { sesGuard[e.muscle] = g; totalGuard += g; }
        }
        if (totalGuard > maxWorkingSets) {
          const scale = maxWorkingSets / totalGuard;
          for (const m of Object.keys(sesGuard)) sesGuard[m] = Math.max(2, Math.floor(sesGuard[m] * scale));
        }
        sessionGuard = sesGuard;
      }
      if (!options.preserveSource && options.reorder !== false) {
        session.exercises = tidySessionExercises(
          session.exercises,
          undefined,
          session.sessionTag,
          options.priorityMuscles,
          options.methodology,
          // Про-объём спины (6+ лет) — до 6 back-паттернов; cap 4 срезал бы
          // vertical/lat после allocation (паттерны, а не сеты).
          options.level === 'enhanced' && (options.trainingYears ?? 0) >= 6 ? 6 : 4,
        );
        dedupeAdaptivePatterns(session, options.priorityMuscles, options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3);
      }
      // Faithful сохраняет исходный набор и порядок, но safety-budget
      // обязателен для каждого режима и источника BB-auto.
      const fitted = options.preserveSource ? { removed: [], cost: estimateBBSessionCost(session) } : fitBBSessionToBudget(session, {
        maxExercises: options.maxExercises ?? 10,
        maxWorkingSets,
        minSetsByMuscle: sessionGuard,
      });
      if (fitted.removed.length > 0) {
        next.rationale.push(`Fatigue budget: ${session.sessionTag || `день ${session.day}`} — удалено ${fitted.removed.length} вторичных упражнений, расчётная длительность ${Math.round(fitted.cost.timeSeconds / 60)} мин.`);
      }
    }
  }
  // Финальный инвариант груди (после fit): грудь в Upper/ChestBack/Push — со-главная
  // со спиной, как и ноги/спина защищены от fit-резки. Добиваем грудь до target
  // (14-18 сетов/сессию), иначе fit урезал её после diversify (спина 22, грудь 9).
  if (!options.preserveSource && options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3) {
    for (const week of next.weeks) {
      if (isPrepControlled(week)) continue;
      for (const session of week.sessions) {
        if (!/^(Push|Chest|ChestBack|Upper|UpperPower|UpperHyp|Torso)$/i.test(session.sessionTag || '')) continue;
        const donorSet = tradeoffDonorsForWeek(options, (week as any)?.week ?? 0);
        if (donorSet.has('chest') || donorSet.has('shoulders')) continue;
        const chest = session.exercises.filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator);
        if (!chest.length) continue;
        const targetSets = (options.trainingYears ?? 0) >= 6 ? 18 : 14;
        const current = chest.reduce((a: number, e: any) => a + (e.sets || 0), 0);
        if (current >= targetSets) continue;
        const usedNames = new Set(chest.map((e: any) => e.name));
        // 1) Добить сеты существующих жимов до 4.
        let added = 0;
        for (const e of chest) {
          if (added >= targetSets - current) break;
          if (/жим|press|отжим|брус/.test(e.name) && e.sets < 4) {
            const add = Math.min(4 - e.sets, targetSets - current - added);
            e.sets += add; added += add;
            const sample = e.workSets?.[e.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
            if (Array.isArray(e.workSets)) for (let k = 0; k < add; k++) e.workSets.push({ ...sample });
          }
        }
        // 2) Если всё ещё мало — добавить одно грудное упражнение.
        if (added < targetSets - current) {
          const cand = EXERCISE_CATALOG.find((x: any) => trueMuscleOf(x) === 'chest' && !usedNames.has(x.name) && !session.exercises.some((e: any) => e.name === x.name) && !options.excludedExercises?.includes(x.id) && !options.excludedExercises?.includes(x.name));
          if (cand) {
            const wm = options.workMax?.chest || 100;
            const sets = Math.min(4, targetSets - current - added);
            session.exercises.push({
              muscle: 'chest', name: cand.name, exerciseName: cand.name, role: 'accessory', character: 'памп',
              sets, repsRange: [10, 15], rir: 3, restSeconds: 90, warmupSets: [],
              workSets: Array.from({ length: sets }, () => ({ reps: 12, rir: 3, weight: Math.round(wm * 0.5 * 10) / 10, restSeconds: 90 })),
              rationale: 'Experienced enhanced: chest co-main invariant (Upper/Push)',
            });
          }
        }
      }
    }
  }
  syncBBPlanSetShape(next);
  // Глобальный кап: максимум 5 рабочих сетов на упражнение (про-правило) —
  // source-планы (program/cycle) могут нести 8+ сетов из исходника; объём
  // добивается дополнительными упражнениями, а не 6-8 подходами в одном.
  if (!options.preserveSource) {
    for (const week of next.weeks) for (const session of week.sessions) {
      for (const e of session.exercises) {
        if ((e as any).warmupActivator) continue;
        if (e.sets > 5) {
          e.sets = 5;
          if (Array.isArray(e.workSets) && e.workSets.length > 5) e.workSets = e.workSets.slice(0, 5);
        }
      }
    }
  }
  // MEV-repair по ФАКТУ (после фита/fill/нормализации): мышцы с direct < MEV
  // получают подъём сетов до ceil(MEV/частота) в пределах cap 5 и лимита
  // сессии. Финал budget-фита резал всё до 2 сетов в переполненных natural-
  // сессиях (deep-дефициты), а MEV-guard в buildSession не переживал фит.
  if (options.level && !options.preserveSource && (next as any).pattern?.id) {
    // Артефакт 'arms' (синтетическая группа FullBody): разворачиваем по факту
    // упражнения (жим узким хватом → triceps, сгибания → biceps).
    for (const week of next.weeks) for (const session of week.sessions) {
      for (const e of session.exercises) {
        if (e.muscle === 'arms') {
          const tm = trueMuscleOf({ name: e.name } as any);
          if (tm === 'biceps' || tm === 'triceps') e.muscle = tm;
        }
      }
    }
    for (const week of next.weeks) {
      // 🏁 Prep guard: MEV-repair/back-баланс не трогает недели contest prep.
      if (isPrepControlled(week)) continue;
      const w: any = week;
      if (w.phase === 'deload' || week.sessions.some(s => s.exercises.some(e => /разгруз|deload/i.test(e.comment || '')))) continue;
      const weekVolume = aggregateBBVolume(week.sessions);
      const freq = new Map<string, number>();
      for (const s of week.sessions) {
        const seen = new Set<string>();
        for (const e of s.exercises) if (!(e as any).warmupActivator) seen.add(e.muscle);
        for (const m of seen) freq.set(m, (freq.get(m) || 0) + 1);
      }
      const maxSessionSets = options.maxWorkingSets ?? 24;
      const raisedByMuscle = new Map<string, number>();
      const donors = tradeoffDonorsForWeek(options, week.week);
      for (const s of week.sessions) {
        // Лимит сессии считает рабочие сеты (без warmup).
        const working = s.exercises.filter((x: any) => !(x as any).warmupActivator);
        let sesSets = working.reduce((sum: number, e: any) => sum + (e.sets || 0), 0);
        // Сессионная direct-сумма по мышцам: repair работает per-session
        // (неделя может быть покрыта, а день — нет — распределение перекашено).
        const sessDirect: Record<string, number> = {};
        for (const x of working) sessDirect[x.muscle] = (sessDirect[x.muscle] || 0) + (x.sets || 0);
        for (const e of s.exercises) {
          if ((e as any).warmupActivator) continue;
          // Донорская политика: не возвращать объём мышце-донору.
          if (donors.has(e.muscle)) continue;
          // Repair поднимает только ИЗОЛЯЦИИ и тяги: push-compound (жимы/
          // приседы) создают косвенный объём на triceps/shoulders, выталкивая
          // их effective за кап. Руки (biceps/triceps/forearms) тоже исключены
          // — их прямой объём регулируется редукцией по indirect.
          if (['biceps', 'triceps', 'forearms'].includes(e.muscle)) continue;
          if (/жим|press|присед|squat|выпад|lunge|мост|hip.?thrust|разгибан.*ног|leg.?extension/i.test(e.name || '')) continue;
          const lm = getVolumeLandmarks(options.level, e.muscle);
          if (!lm) continue;
          const weekDirect = weekVolume[e.muscle]?.directSets || 0;
          const f = freq.get(e.muscle) || 1;
          const mrvCap = (next as any).mrvByMuscle?.[e.muscle];
          // Мышца на 80%+ капа: repair не поднимает (косвенный объём от
          // compound уже близок к потолку — подъём выталкивает за кап).
          if (mrvCap && weekDirect >= mrvCap * 0.8) continue;
          // Цель: target-объём плана (MAV/MAV×1.05 и т.д.), не только MEV.
          const targetSets = plan.volumeTargets?.[e.muscle]?.targetSets;
          const goal = targetSets && targetSets > lm.mev ? targetSets : lm.mev;
          let perSessionGoal = Math.max(2, Math.ceil(goal / f));
          // Back для enhanced 3+: allocation-стандарт на сессию (18/22),
          // а не недельный target ÷ сессии (32/2=16) — иначе день недобирает.
          if (e.muscle === 'back' && options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 && !/FullBody/i.test(s.sessionTag || '')) {
            perSessionGoal = (options.trainingYears ?? 0) >= 6 ? 22 : 18;
          }
          if ((sessDirect[e.muscle] || 0) >= perSessionGoal) continue;
          let guard = Math.max(2, Math.min(5, perSessionGoal));
          // Кап-запас: подъём не должен выталкивать недельный effective
          // (direct + indirect от compound) выше MRV×1.15.
          if (mrvCap) {
            const indirect = Math.max(0, (weekVolume[e.muscle]?.effectiveSets || 0) - weekDirect);
            // ×1.0: direct не превышает MRV — подъём одной мышцы не должен
            // выталкивать indirect (жимы→shoulders/triceps) за кап связанных.
            // (старый комментарий: ×1.05 против safety-порога ×1.1)
            const maxDirect = Math.floor(mrvCap - indirect);
            const raised = raisedByMuscle.get(e.muscle) || 0;
            const weekRoom = Math.max(0, maxDirect - weekDirect - raised);
            guard = Math.max(2, Math.min(guard, e.sets + weekRoom));
          }
          if (e.sets < guard && sesSets < maxSessionSets) {
            const sample = e.workSets?.[e.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
            while (e.sets < guard && sesSets < maxSessionSets) {
              e.workSets.push({ ...sample });
              e.sets += 1;
              sesSets += 1;
              raisedByMuscle.set(e.muscle, (raisedByMuscle.get(e.muscle) || 0) + 1);
            }
          }
        }
        // Страховка лимита: поздние подъёмы не должны превышать maxSessionSets
        // (вторичные accessory сеты срезаются до лимита, минимум 2).
        if (sesSets > maxSessionSets) {
          const reducible = s.exercises.filter((x: any) => !(x as any).warmupActivator && x.role === 'accessory' && x.sets > 2);
          for (const e of reducible) {
            while (sesSets > maxSessionSets && e.sets > 2) {
              e.sets -= 1;
              if (Array.isArray(e.workSets) && e.workSets.length > e.sets) e.workSets = e.workSets.slice(0, e.sets);
              sesSets -= 1;
            }
          }
        }
        // Баланс ширины/толщины спины в сессии: вертикальные тяги (ширина) не
        // должны отставать от горизонтальных (толщина) больше чем 0.6×.
        // FullBody-сессия без back получает вертикальную тягу. Если сессия на
        // лимите — освобождаем место за счёт мелких изоляций (calves/forearms/
        // abs/traps), не трогая primary.
        const backExs = s.exercises.filter((x: any) => !(x as any).warmupActivator && x.muscle === 'back');
        const tag = s.sessionTag || '';
        if (/Pull|FullBody|Torso|Upper|Back/i.test(tag)) {
          let w = 0, t = 0;
          for (const e of backExs) {
            const c = classifyBackExercise(e.name);
            if (c.subgroup === 'back_width') w += e.sets;
            else if (c.subgroup === 'back_thickness') t += e.sets;
          }
          const wantVertical = backExs.length === 0 || (t > 0 && w < t * 0.6);
          if (wantVertical) {
            const targetW = backExs.length === 0 ? 3 : Math.ceil(t * 0.65);
            const verts = backExs.filter(e => classifyBackExercise(e.name).subgroup === 'back_width');
            const deficit = Math.min(targetW - w, 3);
            if (deficit > 0 && sesSets + deficit > maxSessionSets) {
              // Освобождаем место: сет с самой большой горизонтальной тяги
              // (пока держим баланс t >= 0.6*w и back-стандарт 18/22),
              // затем с мелких изоляций.
              let sessBack = backExs.reduce((sum: number, e: any) => sum + (e.sets || 0), 0);
              const backFloor = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 && !/FullBody/i.test(tag)
                ? ((options.trainingYears ?? 0) >= 6 ? 22 : 18) : 0;
              const heavies = backExs.filter(e => classifyBackExercise(e.name).subgroup === 'back_thickness').sort((a: any, b: any) => (b.sets || 0) - (a.sets || 0));
              for (const e of heavies) {
                while (sesSets + deficit > maxSessionSets && e.sets > 2) {
                  const after = t - 1;
                  if (w + deficit > 0 && after < (w + deficit) * 0.6) break;
                  if (sessBack - 1 < backFloor) break;
                  e.sets -= 1;
                  if (Array.isArray(e.workSets) && e.workSets.length > e.sets) e.workSets = e.workSets.slice(0, e.sets);
                  sesSets -= 1;
                  t -= 1;
                  sessBack -= 1;
                }
              }
              const cuttable = s.exercises.filter((x: any) => !(x as any).warmupActivator && x.sets > 2 && (/calves|forearms|abs|traps/.test(x.muscle) || (x.role === 'accessory' && /shoulders|biceps|triceps/.test(x.muscle))));
              for (const e of cuttable) {
                while (sesSets + deficit > maxSessionSets && e.sets > 2) {
                  e.sets -= 1;
                  if (Array.isArray(e.workSets) && e.workSets.length > e.sets) e.workSets = e.workSets.slice(0, e.sets);
                  sesSets -= 1;
                }
              }
            }
            if (verts.length > 0) {
              // Поднимаем существующую вертикальную тягу (максимум 1 на сессию).
              const e = verts[0];
              while (w < targetW && e.sets < 5 && sesSets < maxSessionSets) {
                e.sets += 1;
                if (Array.isArray(e.workSets)) e.workSets.push({ ...e.workSets[e.workSets.length - 1] });
                sesSets += 1;
                w += 1;
              }
            } else {
              // Вертикальной тяги нет вообще — добавляем (с учётом оборудования
              // и bodyweight-капабилити), но не более одной на сессию.
              const template = s.exercises[0];
              const maxEx = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 18 : options.level === 'enhanced' && (options.trainingYears ?? 0) >= 1 ? 14 : 10;
              const equipmentOk = (c: any) => {
                if (!options.equipment?.length) return true;
                const eq = Array.isArray(c.equipment) ? c.equipment : [String(c.equipment || '')];
                return !eq.length || eq.some((e: string) => options.equipment!.includes(e));
              };
              const cap = options.bodyweightCapability;
              const canPullUp = !!(cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0));
              const pool = EXERCISE_CATALOG.filter((x: any) => /подтяг|pull.?up/i.test(x.name || ''));
              const pool2 = EXERCISE_CATALOG.filter((x: any) => /тяга верхн|lat.?pull/i.test(x.name || ''));
              const pull = (canPullUp
                ? pool.find((x: any) => equipmentOk(x) && !/с подхватом|широким хватом|узким/i.test(x.name || '')) || pool.find((x: any) => equipmentOk(x))
                : null)
                || pool2.find((x: any) => equipmentOk(x));
              if (template && pull) {
                let placed = false;
                if (working.length >= maxEx) {
                  // Лимит упражнений исчерпан: заменяем мелкую изоляцию
                  // (calves/forearms/abs/traps до 3 сетов) на vertical pull.
                  const repIdx = s.exercises.findIndex((x: any) => !(x as any).warmupActivator && /calves|forearms|abs|traps/.test(x.muscle) && (x.sets || 0) <= 3 && x !== template);
                  if (repIdx >= 0) {
                    const old = s.exercises[repIdx];
                    const oldSets = old.sets || 0;
                    const newSets = Math.max(deficit, oldSets);
                    Object.assign(old, {
                      ...template, name: (pull as any).name, exerciseName: (pull as any).name,
                      muscle: 'back', role: 'accessory', character: 'памп', sets: newSets,
                      comment: 'Баланс ширины спины: замена мелкой изоляции на vertical pull',
                    });
                    sesSets += newSets - oldSets;
                    placed = true;
                  }
                }
                if (!placed && working.length < maxEx && sesSets + deficit <= maxSessionSets) {
                  s.exercises.push({
                    ...template, name: (pull as any).name || 'Подтягивания', exerciseName: (pull as any).name || 'Подтягивания',
                    muscle: 'back', role: 'accessory', character: 'памп', sets: deficit,
                    comment: 'Баланс ширины спины: vertical pull (подтягивания/верхний блок)',
                  } as any);
                  sesSets += deficit;
                  placed = true;
                }
              }
            }
          }
        }
      }
    }

    syncBBPlanSetShape(next);    syncBBPlanSetShape(next);
  }
  // Taper is a source-independent final phase pass. It is deliberately here
  // rather than in the generic builder so cycle/program outputs get it too.
  if (!options.preserveSource) {
    const tapered = applyTaperToFinalWeeks(next, next.weeks.length);
    next.weeks = tapered.weeks;
    syncBBPlanSetShape(next);
  }
  // FullBody/Lower/Upper: после всех проходов добираем отсутствующие группы
  // (fbUsedIds может вытеснить мышцы между сессиями; enhanced-бюджеты
  // вытесняют calves/traps/abs из Lower/Upper). Для natural — 3 сета,
  // для enhanced 3+ — 4 (крупные) / 3 (малые).
  if (!options.preserveSource) {
    const excludedMusclesFinal = new Set(options.excludedMuscles || []);
    const gradedMusclesFinal = new Set(options.gradedMuscles || []);
    const fillSets = (muscle: string) => ['calves', 'abs', 'traps', 'forearms'].includes(muscle) ? 3 : (options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 4 : 3);
    for (const week of next.weeks) {
      if (isPrepControlled(week)) continue; // prep-недели не добираем
      const donors = tradeoffDonorsForWeek(options, week.week);
      // Natural: малые группы (abs/traps) добираем ТОЛЬКО если их нет во всей
      // неделе — иначе fill дублирует пресс в каждой сессии (> MRV).
      const weekMuscles = new Set(week.sessions.flatMap(s => s.exercises.map((e: any) => e.muscle)));
      const weekHas = (m: string) => weekMuscles.has(m);
      // Сколько сессий недели уже содержат мышцу (для natural-лимитов дублей).
      const weekCount = (m: string) => week.sessions.filter(s => s.exercises.some((e: any) => e.muscle === m)).length;
      for (const session of week.sessions) {
      const tag = session.sessionTag || '';
      if (!/Legs|Lower|LowerPower|LowerHyp/.test(tag) && !/FullBody/.test(tag) && !/Upper|Push|Pull/.test(tag) && !/Torso|Limbs/.test(tag)) continue;
      const present = new Set(session.exercises.map((e: any) => e.muscle));
      const template = session.exercises[0];
      if (!template) continue;
      // Не превышаем level-aware лимит упражнений в сессии (10 natural / 18 enhanced).
      const maxEx = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 18 : options.level === 'enhanced' && (options.trainingYears ?? 0) >= 1 ? 14 : 10;
      const workingCount = () => session.exercises.filter((e: any) => !(e as any).warmupActivator).length;
      if (workingCount() >= maxEx) continue;
      // Сетовой лимит сессии (60 enhanced 3+ / 24 natural) не превышаем.
      const maxSessionSets = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 60 : options.level === 'enhanced' && (options.trainingYears ?? 0) >= 1 ? 40 : 24;
      const sessionSets = () => session.exercises.reduce((sum: number, e: any) => sum + (e.sets || 0), 0);
      const needMuscles = /FullBody/.test(tag)
        ? ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'forearms', 'abs', 'traps']
        : /Upper|Push|Pull/.test(tag)
          ? ['traps', 'abs']
          : ['glutes', 'quads', 'hamstrings', 'calves', 'abs'];
      for (const muscle of needMuscles) {
        // BUG-FIX: fill не должен добирать мышцы, исключённые травмами (exclude=true)
        // или находящиеся в щадящем режиме (graded — объём снижен намеренно).
        if (excludedMusclesFinal.has(muscle) || gradedMusclesFinal.has(muscle) || donors.has(muscle)) continue;
        if (present.has(muscle)) continue;
        // Дубли малых групп по сессиям: abs до 2 источников (natural) / 3
        // (enhanced 1-3, MEV выше); traps/calves до 2 (обе Pull/Lower сессии).
        const isFullEnhanced = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3;
        if (!isFullEnhanced) {
          const absCap = options.level === 'enhanced' ? 3 : 2;
          if (['abs'].includes(muscle) && weekCount(muscle) >= absCap) continue;
          if (['traps', 'calves'].includes(muscle) && weekCount(muscle) >= 2) continue;
        }
        if (workingCount() >= maxEx) break;
        // Строгий сетовой лимит сессии: если добавление не влезает — не добавляем
        // (иначе 24/60 нарушается; MEV покрывается guardMap в budget-фите).
        const addSets = fillSets(muscle);
        if (sessionSets() + addSets > maxSessionSets) continue;
        const candidate = EXERCISE_CATALOG.find((x: any) => {
          if (trueMuscleOf(x) !== muscle) return false;
          if (options.avoidAxialLoad && isAxialLoadExercise(x)) return false;
          if (isMobilityRestricted(x, options.mobilityRestrictions)) return false;
          if (options.equipment?.length) {
            const eq = Array.isArray(x.equipment) ? x.equipment : [String(x.equipment || '')];
            if (eq.length && !eq.some((e: string) => options.equipment!.includes(e))) return false;
          }
          return true;
        });
        if (!candidate) continue;
        const added: any = structuredClone(template);
        added.muscle = muscle;
        added.name = candidate.name;
        added.exerciseName = candidate.name;
        added.role = 'accessory';
        added.sets = addSets;
        const sample = template.workSets?.[0] || { reps: 10, rir: 2, weight: 0 };
        added.workSets = Array.from({ length: added.sets }, () => ({ ...sample }));
        session.exercises.push(added);
        present.add(muscle);
      }
      }
    }
  }
  // Повторный MRV-кап ПОСЛЕ fill/ensureSmall/alloc: builder-кап был до
  // finalize, а поздние проходы могли добавить сверх (overflow-контроль).
  if ((next as any).mrvByMuscle) {
    for (const week of next.weeks) normalizeWeekMrv(week.sessions, (next as any).mrvByMuscle, !!(week as any).deload);
    syncBBPlanSetShape(next);
  }
    // Повторный tidy ПОСЛЕ allocation/дозаполнения: добавленные упражнения
  // должны встать в правильные группы (иначе quads → hamstrings → quads).
  // Только сортировка — НЕ capExercisesPerMuscle (это срезало бы добавленный
  // allocation back-объём до 4 упражнений).
  if (!options.preserveSource) {
    for (const week of next.weeks) for (const session of week.sessions) {
      session.exercises = orderSessionExercises(
        session.exercises,
        {
          sessionTag: session.sessionTag,
          methodology: options.methodology,
          priorityMuscles: options.priorityMuscles,
        },
      );
    }
    syncBBPlanSetShape(next);
  }
  // Последний adaptive-проход: после дозаполнения и всех поздних проходов
  // ремонтируем weekly back frequency (повтор одного vertical профиля).
  for (const week of next.weeks) repairBackFrequency(week, options);
  for (const week of next.weeks) capAdaptiveSpecializationFrequency(week, options);
  syncBBPlanSetShape(next);
  if (options.level) {
    const peakWeek = next.weeks.reduce((best, week) => {
      const total = week.sessions.reduce((sum, session) => sum + session.exercises.reduce((s, exercise) => s + exercise.sets, 0), 0);
      return total > best.total ? { total, week } : best;
    }, { total: -1, week: next.weeks[0] });
    const peakSessions = peakWeek.week?.sessions || [];
    const peakVolume = aggregateBBVolume(peakSessions);
    const frequency: Record<string, number> = {};
    for (const week of next.weeks) for (const session of week.sessions) {
      const seen = new Set(session.exercises.map(exercise => exercise.muscle));
      for (const muscle of seen) frequency[muscle] = (frequency[muscle] || 0) + 1 / Math.max(1, next.weeks.length);
    }
    const targets: NonNullable<BBPlan['volumeTargets']> = {};
    for (const [muscle, volume] of Object.entries(peakVolume)) {
      const landmarks = getVolumeLandmarks(options.level, muscle);
      if (!landmarks) continue;
      targets[muscle] = buildBBVolumeTarget({
        muscle,
        frequency: Math.max(1, Math.round(frequency[muscle] || 1)),
        landmarks,
        rotationSets: Math.round(volume.directSets),
        volumeGoal: options.volumeGoal || 'mav',
      });
    }
    next.volumeTargets = targets;
  }
  enrichExerciseRationale(next);
  // FIX-B3: autoAssignIntensityTechniques — автоматическое назначение
  // техник интенсивности (dropset/rest_pause/myo_rep) для ≥intermediate.
  // Проф-тренер назначает: cable fly → dropset, leg extension → myo_rep,
  // curl → rest_pause. Без этого 0% планов имеют intensity techniques.
  if (!options.preserveSource) {
    autoAssignIntensityTechniques(next, options.level || 'intermediate', options.priorityMuscles, options.specializationSchedule);
  }
  const rotation = analyzeBBRotation(next);
  next.rotationReport = rotation;
  const rotationWarnings = rotation.issues
    .filter(issue => issue.code !== 'primary_changed' || options.reorder === false)
    .slice(0, 20)
    .map(issue => `⚠ Ротация: ${issue.message}`);
  if (rotationWarnings.length) next.rationale = [...next.rationale, ...rotationWarnings];
  // Финальная страховка лимита сессии (после всех проходов): ни одна сессия
  // не превышает maxWorkingSets (вторичные accessory сеты срезаются, мин. 2).
  const finMaxSets = options.maxWorkingSets ?? 24;
  for (const week of next.weeks) {
    for (const session of week.sessions) {
      const workingEx = session.exercises.filter((e: any) => !(e as any).warmupActivator);
      let total = workingEx.reduce((a: number, e: any) => a + (e.sets || 0), 0);
      if (total <= finMaxSets) continue;
      for (const e of workingEx.filter((x: any) => x.role === 'accessory' && x.sets > 2)) {
        while (total > finMaxSets && e.sets > 2) {
          e.sets -= 1;
          if (Array.isArray(e.workSets) && e.workSets.length > e.sets) e.workSets = e.workSets.slice(0, e.sets);
          total -= 1;
        }
        if (total <= finMaxSets) break;
      }
    }
  }
  // Проф-методики (по выбору пользователя): суперсеты-антагонисты и схемы
  // объёма памп-дней (GVT 10×10 / FST-7 / 8×8). Применяются ПОСЛЕ всех
  // проходов — cap 5 и лимиты сессий сохраняются.
  // Специализация (RIR/икры/частота) ДО cap-adjust: спец-частота добавляет
  // изоляции, cap-adjust затем режет по фактическому effective (иначе
  // спец-частота возвращала бы удалённое капом).
  if (!options.preserveSource && (next as any).pattern?.id) {
    applySpecializationPass(next, options);
  }

  if (!options.preserveSource && (next as any).pattern?.id) {
    if (options.supersetMode === 'antagonist') markAntagonistSupersets(next);
    if (options.volumeScheme && options.volumeScheme !== 'standard') applyVolumeScheme(next, options.volumeScheme);
  }
  if (!options.preserveSource && (next as any).pattern?.id) {
    // Post-hoc cap-adjust для ВСЕХ мышц: фактический effective = direct +
    // indirect от compound может превысить адаптированный MRV (GVT-изоляции
    // + жимы/тяги/приседы). Раньше — только triceps/shoulders/biceps.
    const CAP_MUSCLES = ['triceps', 'shoulders', 'biceps', 'quads', 'hamstrings', 'glutes', 'chest', 'back', 'calves', 'forearms', 'traps', 'abs'] as const;
    const isIsolationName = (n: string) => /разгибан|сгибан|curl|raise|fly|мах|развод|шраг|pushdown|скручив|отведен|сведен|face.?pull|тяга.*лиц|подъём.*бицепс|подъем.*бицепс|подъём гантел|подъем гантел|наклонн.*скам|incline.*curl|молот|hammer|француз|french|из.?за.*голов|overhead/i.test(n);
    for (const week of next.weeks) {
      const w: any = week;
      if (w.phase === 'deload') continue;
      const caps = (next as any).mrvByMuscle || {};
      const volume = aggregateBBVolume(week.sessions);
      for (const muscle of CAP_MUSCLES) {
        const cap = caps[muscle];
        if (!cap) continue;
        const eff = volume[muscle]?.effectiveSets || 0;
        if (eff <= cap * 1.05) continue;
        let indirectTotal = 0;
        for (const s of week.sessions) for (const e of s.exercises) {
          if ((e as any).warmupActivator) continue;
          for (const c of indirectMuscleContributions(e)) if (c.muscle === muscle) indirectTotal += (e.sets || 0) * c.coefficient;
        }
        const directTotal = volume[muscle]?.directSets || 0;
        const targetDirect = Math.max(0, Math.floor(cap - indirectTotal));
        let need = Math.max(0, directTotal - targetDirect);
        if (need <= 0) continue;
        // Изоляции в первую очередь (памп-сеты ценности ниже), по всем сессиям.
        const candidates = week.sessions.flatMap(s => s.exercises.filter((e: any) => !(e as any).warmupActivator && e.muscle === muscle && e.sets > 2));
        const isolations = candidates.filter(e => isIsolationName(e.name || '')).sort((a, b) => (a.sets || 0) - (b.sets || 0));
        const others = candidates.filter(e => !isIsolationName(e.name || '')).sort((a, b) => (a.sets || 0) - (b.sets || 0));
        for (const e of [...isolations, ...others]) {
          if (need <= 0) break;
          while (need > 0 && e.sets > 2) {
            e.sets -= 1;
            if (Array.isArray(e.workSets) && e.workSets.length > e.sets) e.workSets = e.workSets.slice(0, e.sets);
            need -= 1;
          }
        }
        // Если срез до 2 не хватил: удаляем лишние изоляции мышцы
        // (дубли паттернов по сессиям), оставляя минимум 1 упражнение
        // мышцы на неделю (indirect от compound уже покрывает стимул).
        if (need > 0) {
          let weekCount = week.sessions.flatMap(s => s.exercises).filter((x: any) => x.muscle === muscle && !(x as any).warmupActivator).length;
          for (const s2 of week.sessions) {
            for (const e of [...s2.exercises]) {
              if (need <= 0) break;
              if ((e as any).warmupActivator) continue;
              if (e.muscle !== muscle) continue;
              // Удаляем только изоляции (дубли паттернов: сгибания сидя +
              // сгибания в тренажёре и т.п.); compound-движения не трогаем.
              if (!isIsolationName(e.name || '')) continue;
              // Минимум 1 изоляция на неделю — НО если косвенный объём уже
              // покрывает почти весь кап (indirect >= 0.9×cap), последнюю
              // изоляцию можно убрать (direct 0 — стимул даёт indirect).
              if (weekCount <= 1 && indirectTotal < cap * 0.9) break;
              need -= e.sets || 0;
              weekCount -= 1;
              s2.exercises = s2.exercises.filter((x: any) => x !== e);
            }
            if (need <= 0) break;
          }
        }
        // Экстремальные капы (лаб-коррекция/дефицит/плохое восстановление):
        // indirect от compound физически не влезает — итеративно режем
        // compound-сеты (жимы/тяги, дающие indirect на эту мышцу) до 1,
        // пересчитывая effective после каждого прохода.
        for (let iter = 0; iter < 20; iter++) {
          let indirect2 = 0;
          let direct2 = 0;
          for (const s of week.sessions) for (const e of s.exercises) {
            if ((e as any).warmupActivator) continue;
            if (e.muscle === muscle) direct2 += e.sets || 0;
            for (const c of indirectMuscleContributions(e)) if (c.muscle === muscle) indirect2 += (e.sets || 0) * c.coefficient;
          }
          const eff2 = direct2 + indirect2;
          if (eff2 <= cap * 1.15) break;
          const target2 = Math.max(0, Math.floor(cap - indirect2));
          const need2 = Math.max(0, direct2 - target2);
          if (need2 <= 0) break;
          const comps = week.sessions.flatMap(s => s.exercises).filter((e: any) => !(e as any).warmupActivator && (e.sets || 0) > 1 && !isIsolationName(e.name || '') && indirectMuscleContributions(e).some((c: any) => c.muscle === muscle));
          if (!comps.length) break;
          const e2 = comps[0];
          e2.sets -= 1;
          if (Array.isArray(e2.workSets) && e2.workSets.length > e2.sets) e2.workSets = e2.workSets.slice(0, e2.sets);
        }
      }
    }


  }
  // Лимит упражнений сессии пост-фактум (слабые группы могут дать перебор в buildSession).
  if (!options.preserveSource && (next as any).pattern?.id) {
    enforceSessionExerciseLimit(next, options);
  }

  // weeklyVolume нужен ДО validateBBPlan: target_volume_deficit проверяет
  // фактический объём, а не пустой/устаревший объект.
  next.weeklyVolume = Object.fromEntries(next.weeks.map(week => [
    week.week,
    aggregateBBVolume(week.sessions),
  ]));
  const validation = validateBBPlan(next, {
    level: options.level,
    trainingYears: options.trainingYears,
    equipment: options.equipment,
    excludedExercises: options.excludedExercises,
    excludedMuscles: options.excludedMuscles,
    avoidAxialLoad: options.avoidAxialLoad,
    checkOrder: options.checkOrder,
    methodology: options.methodology,
  });
  next.validation = validation;
  next.fatigueReport = next.weeks.map(week => ({
    week: week.week,
    sessions: week.sessions.map(session => estimateBBSessionCost(session)),
  }));
  if (options.level && next.weeks.length > 0) {
    const peak = next.weeks.reduce((best, week) => {
      const total = week.sessions.reduce((sum, session) => sum + session.exercises.reduce((s, exercise) => s + exercise.sets, 0), 0);
      return total > best.total ? { total, week } : best;
    }, { total: -1, week: next.weeks[0] }).week;
    const directPeak: Record<string, number> = {};
    for (const session of peak.sessions) for (const exercise of session.exercises) {
      directPeak[exercise.muscle] = (directPeak[exercise.muscle] || 0) + exercise.sets;
    }
    next.volumeLandmarks = computeVolumeLandmarks(directPeak, options.level, { labMult: options.mrvMultiplier, peakWeek: peak.week });
  }
  const warnings = validation.issues
    .filter(issue => issue.level === 'warning')
    .slice(0, 20)
    .map(issue => `⚠ Валидация: ${issue.message}`);
  if (warnings.length) {
    const seen = new Set(next.rationale);
    for (const w of warnings) if (!seen.has(w)) { seen.add(w); next.rationale.push(w); }
  }
  // Пересчитываем функциональную разметку спины после всех поздних проходов
  // (rotation/dedupe/taper/fill могут клонировать упражнения без полей).
  for (const week of next.weeks) for (const session of week.sessions) {
    session.exercises = session.exercises.map(ex => ex.muscle === 'back' ? annotateBackExercise(ex) : (['biceps', 'triceps', 'forearms'].includes(ex.muscle) ? annotateArmExercise(ex) : ex));
  }
  // День-гард малых мышц: трапеции/предплечья — только в тяговых/верхних днях
  // (Pull/Back/Upper/FullBody), икры — в ножных. В Push/Chest/Shoulders-only их НЕТ.
  // Устраняет «шраги в день груди» (и stale-комментарии от slot-замены малой группы).
  for (const week of next.weeks) {
    for (const session of week.sessions) {
      const tag = session.sessionTag || '';
      const isUpperPull = /Pull|Back|Upper|FullBody|Torso/.test(tag);
      const isLegsDay = /Legs|Lower/.test(tag);
      session.exercises = session.exercises.filter(ex => {
        if ((ex as any).warmupActivator) return true;
        if (ex.muscle === 'traps' || ex.muscle === 'forearms') return isUpperPull;
        if (ex.muscle === 'calves') return isLegsDay || /FullBody|Lower/.test(tag);
        return true;
      });
      // Убрать stale-комментарий/инструкцию, если остался от чужой мышцы (slot-замена).
      for (const ex of session.exercises) {
        if (ex.comment && /Основное: (chest|back|quads|shoulders)/.test(ex.comment) && ex.muscle !== 'chest' && ex.muscle !== 'back' && ex.muscle !== 'quads' && ex.muscle !== 'shoulders') {
          ex.comment = `⚡ ${ex.name} — вспомогательная работа (${ex.muscle}). См. паттерн/хват выше.`;
          ex.executionProfile = undefined;
        }
      }
    }
  }
  const backQuality = next.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises.filter(e => e.muscle === 'back')).reduce((acc, e) => {
    const pattern = e.movementPattern || 'other';
    acc[pattern] = (acc[pattern] || 0) + e.sets;
    return acc;
  }, {} as Record<string, number>);
  next.rationale.push(`🧩 Спина по паттернам: ${Object.entries(backQuality).map(([k, v]) => `${k}=${v}`).join(', ') || 'нет прямой работы'}`);
  next.rationale.push(...backQualityIssues(next.weeks).map(issue => `⚠ Качество спины: ${issue}`));
  // Руки по головкам (Этап 2/4): длинная/короткая/brachialis, overhead/pushdown.
  const armQuality = next.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises.filter(e => ['biceps', 'triceps', 'forearms'].includes(e.muscle))).reduce((acc, e) => {
    const pattern = e.movementPattern || 'other';
    acc[pattern] = (acc[pattern] || 0) + e.sets;
    return acc;
  }, {} as Record<string, number>);
  const armSummary = Object.entries(armQuality).map(([k, v]) => `${k}=${v}`).join(', ') || 'нет прямой работы';
  next.rationale.push(`💪 Руки по паттернам: ${armSummary}`);
  next.rationale.push(...armQualityIssues(next.weeks).map(issue => `⚠ Качество рук: ${issue}`));
  // Суставной стресс (объём × вес × RIR-проксимити + PED-интенсификация):
  // предупреждения по суставам попадают в rationale плана.
  const jointIssues = analyzePlanStress(next).issues;
  if (jointIssues.length) next.rationale.push(`🦿 Суставы: ${jointIssues.join(' ')}`);
  const errors = validation.issues
    .filter(issue => issue.level === 'error')
    .slice(0, 20)
    .map(issue => `🚫 Валидация: ${issue.message}`);
  if (errors.length) next.rationale = [...next.rationale, ...errors];
  // Повторная гарантия головок рук ПОСЛЕ всех проходов (фит/тапер/филл могли
  // вернуть pushdown-изоляцию; замена — не добавление, лимиты не нарушаются).
  if (!options.preserveSource && (next as any).pattern?.id) {
    for (const week of next.weeks) for (const session of week.sessions) {
      ensureArmHeadCoverage(session, week, options);
    }
  }
  // Разминочное упражнение на целевую группу — в самом конце, после всех
  // проходов (budget/dedupe/taper не могут его удалить). Не входит в объём.
  // Только для реальных генераторных планов (pattern.id задан) и не-faithful.
  if (!options.preserveSource && (next as any).pattern?.id) {
    for (const week of next.weeks) for (const session of week.sessions) {
      addWarmupActivator(session, options);
    }
  }
  syncBBPlanSetShape(next);
  next.balanceReport = analyzeBBBalance(next);
  next.report = buildBBPlanReport(next);
  return next;
}

/**
 * FIX-B3: autoAssignIntensityTechniques — автоматическое назначение
 * техник интенсивности для упражнений в памп-днях (≥intermediate).
 *
 * Проф-тренер назначает intensity techniques не всем упражнениям, а выборочно:
 *  - Cable fly / сведение → dropset (метаболический стресс)
 *  - Leg extension / разгибание ног → myo_rep (высокая эффективность изоляции)
 *  - Curl / сгибание на бицепс → rest_pause (добивка до отказа)
 *  - Triceps pushdown / разгибание на блоке → dropset
 *  - Lateral raise / махи → rest_pause
 *
 * Только для level >= intermediate. Только для accessory/памп упражнений.
 * Не более 1 техники на упражнение, не более 2-3 на сессию.
 */
export function autoAssignIntensityTechniques(plan: BBPlan, level: string, priorityMuscles?: string[], schedule?: SpecializationSchedule): void {
  if (level === 'beginner') return; // новички не используют intensity techniques
  for (const week of plan.weeks) {
    if (week.phase === 'deload') continue; // deload — без intensity techniques
    const weekPriority = schedule?.active
      ? specResForWeekSchedule(schedule, week.week).targets
      : (priorityMuscles || []);
    const bicepsPriority = weekPriority.some(m => (WEAK_TO_MUSCLE[m] || m) === 'biceps');
    for (const session of week.sessions) {
      let techniquesInSession = 0;
      const maxPerSession = level === 'enhanced' ? 3 : level === 'advanced' ? 3 : 2;
      for (const ex of session.exercises) {
        if (techniquesInSession >= maxPerSession) break;
        // Только accessory/памп упражнения получают intensity technique
        if (ex.role !== 'accessory') continue;
        if (ex.character !== 'памп') continue;
        // Не перезаписывать если уже есть technique
        if (ex.workSets?.some(ws => ws.technique)) continue;
        const name = (ex.exerciseName || ex.name || '').toLowerCase();
        let technique: string | undefined;
        // Cable fly / сведение → dropset
        if (/кроссовер|crossover|сведение|fly|пек.?дек|бабоч/i.test(name)) {
          technique = 'dropset';
        }
        // Leg extension → myo_rep
        else if (/разгибан.*ног|leg.?extension/i.test(name)) {
          technique = 'myo_rep';
        }
        // Biceps curl → rest_pause (или 21s при специализации бицепса)
        else if (/сгибан.*бицепс|curl|подъём.*бицепс|подъем.*бицепс/i.test(name) && !/молот|hammer/i.test(name)) {
          technique = bicepsPriority ? 'twenty_ones' : 'rest_pause';
        }
        // Triceps pushdown → dropset
        else if (/разгибан.*рук|разгибан.*блок|pushdown|трицепс.*блок/i.test(name)) {
          technique = 'dropset';
        }
        // Lateral raise → rest_pause
        else if (/махи|lateral.?raise|отведен.*рук/i.test(name)) {
          technique = 'rest_pause';
        }
        // Leg curl → dropset
        else if (/сгибан.*ног|leg.?curl/i.test(name)) {
          technique = 'dropset';
        }
        if (technique && ex.workSets && ex.workSets.length > 0) {
          // Назначить технику на последний сет
          const lastSet = ex.workSets[ex.workSets.length - 1];
          lastSet.technique = technique;
          techniquesInSession++;
          // Добавить комментарий
          const techNames: Record<string, string> = {
            dropset: 'Дроп-сет', rest_pause: 'Rest-pause', myo_rep: 'Myo-reps', twenty_ones: '21s (7-7-7)',
          };
          ex.comment = (ex.comment || '') + ` | 💥 ${techNames[technique] || technique} на последнем подходе.`;
        }
      }
    }
  }
}
