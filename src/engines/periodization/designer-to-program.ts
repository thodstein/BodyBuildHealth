/**
 * designer-to-program.ts — адаптер DesignerPhaseBlock[] → UserWeek[].
 *
 * Дизайнер периодизации (PeriodizationDesignerTab) строит макроцикл как набор
 * DesignerPhaseBlock (startWeek..endWeek, phaseKey). Упражнений в блоках нет —
 * это скелет фаз. Этот модуль конвертирует дизайн в UserWeek[] с корректными
 * phase/deload, готовыми к рендеру в редакторе ручного планировщика.
 *
 * Две стратегии заполнения sessions:
 *  - По умолчанию: sessions: [] — рендерится из microcycleTemplate (скелет сплита).
 *    Пользователь заполняет упражнения позже.
 *  - При opts.fillExercises: вызывается autodraftBBPlan на totalWeeks, его weeks
 *    берутся как источник sessions, а phase/deload переразмечаются из дизайн-блоков.
 */
import type { MacrocycleDesign, DesignerPhaseBlock, PhaseKey } from '../periodization-designer.engine';
import type { UserWeek, UserSession } from '../user-program/user-program.types';
import { newId } from '../user-program/user-program.types';
import { designerPhaseToUserPhase, isDeloadLikePhaseKey } from './phase-bridge';
import { autodraftBBPlan } from '../manual-constructor/manual-draft.engine';
import { createFromBuild } from '../user-program/program-store';
import type { BBTrainingFocus } from '../bb/bb-goal-types';

export interface DesignerToUserWeeksOptions {
  /** Заполнить sessions упражнениями через autodraftBBPlan (иначе пустые). */
  fillExercises?: boolean;
  /** Уровень спортсмена (для autodraftBBPlan при fillExercises). */
  level?: string;
  /** Цель (для autodraftBBPlan при fillExercises). */
  goal?: string;
  /** Дней в неделю (для autodraftBBPlan и для скелета при пустых sessions). */
  daysPerWeek?: number;
  /** Оборудование (для autodraftBBPlan). */
  equipment?: string[];
  /** Слабые группы (для autodraftBBPlan). */
  weakPoints?: string[];
  /** Training focus для RIR/reps/tempo (Schoenfeld 2021, Roberts 2022). */
  trainingFocus?: BBTrainingFocus;
  /** Recovery-метрики → MRV soft-cap (Helms 2022, Plews 2022, Watson 2022). */
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  /** Lab-based MRV multiplier (ALT/CRP/HCT/гормоны). */
  labMrvMultiplier?: number;
  /** Training injuries and safety restrictions forwarded to BB-auto. */
  injuries?: any[];
  avoidAxialLoad?: boolean;
  excludedExercises?: string[];
  favoriteExercises?: string[];
}

/**
 * Конвертировать дизайн макроцикла → UserWeek[].
 * Возвращает массив длиной design.totalWeeks, где каждая неделя помечена
 * канонической Phase и deload-флагом из покрывающего дизайн-блока.
 *
 * @param design — дизайн из periodization-designer.engine (MacrocycleDesign)
 * @param opts — опции заполнения sessions
 */
export function designerToUserWeeks(
  design: MacrocycleDesign,
  opts: DesignerToUserWeeksOptions = {},
): UserWeek[] {
  const total = Math.max(1, design.totalWeeks || 1);
  // Сортируем блоки по startWeek для предсказуемого first-match.
  const blocks = [...design.blocks].sort((a, b) => a.startWeek - b.startWeek);

  // Если требуется заполнение упражнениями — собираем недели через autodraftBBPlan.
  let filledWeeks: UserWeek[] | null = null;
  if (opts.fillExercises) {
    filledWeeks = buildFilledWeeks(total, opts);
  }

  const weeks: UserWeek[] = [];
  for (let w = 1; w <= total; w++) {
    const block = findBlockForWeek(blocks, w);
    const phase = block ? designerPhaseToUserPhase(block.phaseKey) : 'accumulation';
    const deload = block ? isDeloadLikePhaseKey(block.phaseKey) : false;
    // sessions: из заполненного плана (если есть) или пустые.
    const sessions = filledWeeks && filledWeeks[w - 1] ? filledWeeks[w - 1].sessions : [];
    weeks.push({
      week: w,
      phase,
      deload,
      sessions,
    });
  }
  return weeks;
}

/** Найти первый блок, покрывающий неделю w (1-based). */
function findBlockForWeek(blocks: DesignerPhaseBlock[], w: number): DesignerPhaseBlock | undefined {
  return blocks.find(b => w >= b.startWeek && w <= b.endWeek);
}

/**
 * Собрать UserWeek[] с упражнениями через autodraftBBPlan → createFromBuild.
 * Возвращает массив недель с заполненными sessions (упражнения/блоки/сеты).
 * При ошибке сборки возвращает null — вызывающий код fallback на пустые sessions.
 */
function buildFilledWeeks(total: number, opts: DesignerToUserWeeksOptions): UserWeek[] | null {
  try {
    const days = Math.max(2, Math.min(6, opts.daysPerWeek ?? 4));
    const bbPlan = autodraftBBPlan({
      level: opts.level ?? 'intermediate',
      goal: opts.goal ?? 'hypertrophy',
      daysPerWeek: days,
      weeks: Math.min(total, 16), // bb-builder ограничивает 16 неделями
      equipment: opts.equipment ?? [],
      weakPoints: opts.weakPoints ?? [],
      trainingFocus: opts.trainingFocus,
      bodyFat: opts.bodyFat,
      leanMass: opts.leanMass,
      hrvMs: opts.hrvMs,
      sleepHours: opts.sleepHours,
      stressLevel: opts.stressLevel,
      labMrvMultiplier: opts.labMrvMultiplier,
      injuries: opts.injuries,
      avoidAxialLoad: opts.avoidAxialLoad,
      excludedExercises: opts.excludedExercises,
      favoriteExercises: opts.favoriteExercises,
    });
    const userProg = createFromBuild(bbPlan, {
      goal: opts.goal,
      level: opts.level,
      equipment: opts.equipment,
    });
    const src = userProg?.bb?.weeks ?? [];
    // Если plan < total — зациклить (повторить цикл плана).
    const out: UserWeek[] = [];
    for (let w = 1; w <= total; w++) {
      const srcWeek = src[(w - 1) % Math.max(1, src.length)];
      if (srcWeek) {
        const blockIndex = Math.floor((w - 1) / Math.max(1, src.length));
        const progressionFactor = Math.pow(1.005, blockIndex * Math.max(1, src.length));
        out.push({
          ...srcWeek,
          week: w,
          sessions: srcWeek.sessions.map(session => ({
            ...session,
            id: newId('ses'),
            blocks: session.blocks.map(block => ({
              ...block,
              id: newId('blk'),
              sets: block.sets.map(set => ({
                ...set,
                weight: typeof set.weight === 'number'
                  ? Math.round(set.weight * progressionFactor * 10) / 10
                  : set.weight,
              })),
            })),
          })),
        });
      } else {
        out.push({ week: w, phase: 'accumulation' as const, deload: false, sessions: [] });
      }
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Применить фазы дизайн-блоков к СУЩЕСТВУЮЩИМ неделям UserProgram.
 * Переразмечает phase/deload, сохраняя все упражнения/блоки/сеты.
 * Недели вне блоков получают accumulation/deload=false.
 *
 * @param weeks — существующие UserWeek[] программы (длина = totalWeeks)
 * @param design — дизайн макроцикла
 */
export function applyDesignPhasesToWeeks(
  weeks: UserWeek[],
  design: MacrocycleDesign,
): UserWeek[] {
  const blocks = [...design.blocks].sort((a, b) => a.startWeek - b.startWeek);
  return weeks.map(w => {
    const block = findBlockForWeek(blocks, w.week);
    if (!block) {
      // Неделя вне блоков — не трогаем (сохраняем текущую phase).
      return w;
    }
    return {
      ...w,
      phase: designerPhaseToUserPhase(block.phaseKey),
      deload: isDeloadLikePhaseKey(block.phaseKey),
    };
  });
}

/**
 * Создать пустой скелет sessions для недели (N дней с пустыми блоками).
 * Используется когда sessions: [] не подходит (например для гибрид-интеграции).
 */
export function makeEmptySessionsForWeek(daysPerWeek: number): UserSession[] {
  const days = Math.max(1, Math.min(7, daysPerWeek));
  // Типичное расписание 4д: Пн/Вт/Чт/Пт
  const dowPattern = [0, 1, 3, 4, 2, 5, 6];
  return Array.from({ length: days }, (_, i) => ({
    id: newId('ses'),
    name: `День ${i + 1}`,
    focus: '',
    dayOfWeek: dowPattern[i] ?? i,
    blocks: [],
  }));
}
