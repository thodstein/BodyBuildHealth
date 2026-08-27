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
import type { UserWeek, UserSession, UserProgram, Phase, PLWeek } from '../user-program/user-program.types';
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
  /**
   * Шаблон дней недели для скелета sessions (0=Пн … 6=Вс).
   * По умолчанию берётся из design (если есть) или [0,1,2,3,4,5,6].
   * Позволяет задать реальное расписание тренировок (например [1,3,5] — Вт,Чт,Сб).
   */
  dowPattern?: number[];
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
  /** Пол (BB: glute-приоритет). */
  sex?: 'male' | 'female';
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
      sex: opts.sex,
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
        // Treat each repeated block as a mesocycle: progress by 0.5% weekly,
        // not only once per repeated block.
        // Не прогрессируем вес в deload-неделю: исходный deload уже снижает нагрузку.
        const progressionFactor = srcWeek.deload ? 1 : Math.pow(1.005, w - 1);
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
 * Применить фазы дизайн-блоков к СУЩЕСТВУЮЩИМ неделям.
 * Переразмечает phase/deload, сохраняя все упражнения/блоки/сеты.
 * Недели вне блоков не трогаются.
 *
 * @param weeks — существующие недели программы (длина = totalWeeks)
 * @param design — дизайн макроцикла
 */
export function rephaseWeeks<T extends { week: number; phase: Phase; deload: boolean }>(
  weeks: T[],
  design: MacrocycleDesign,
): T[] {
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
 * Применить фазы дизайн-блоков к СУЩЕСТВУЮЩИМ неделям UserProgram (BB-ветка).
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
  return rephaseWeeks(weeks, design);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Связь «программа ↔ дизайн периодизации» (P0-1):
 *  - designFingerprint — хэш содержимого дизайна (сортировка блоков + notes);
 *  - linkDesignToProgram / unlinkDesignFromProgram — мета-связь в ProgramMeta.designRef;
 *  - reapplyDesignToProgram — переразметка фаз недель из актуального дизайна;
 *  - isProgramDesignStale — «дизайн изменён после привязки» (UI-бейдж).
 * ═══════════════════════════════════════════════════════════════════════════ */

/** FNV-1a хэш содержимого дизайна. Меняется при любой правке блоков/заметок (overlapping игнорируется, легаси [OVERLAP] чистится). */
export function designFingerprint(design: MacrocycleDesign): string {
  const parts = [...design.blocks]
    .sort((a, b) => a.startWeek - b.startWeek || a.endWeek - b.endWeek || (a.id < b.id ? -1 : 1))
    .map(b => {
      const cleanNotes = (b.notes || '').replace(/\s*\[OVERLAP:[^\]]*\]/g, '').trim();
      return `${b.id}|${b.phaseKey}|${b.startWeek}|${b.endWeek}|${cleanNotes}`;
    });
  const s = `v1:${design.totalWeeks}:${parts.join(';')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** Привязать программу к дизайну периодизации (ставит meta.designRef). */
export function linkDesignToProgram(program: UserProgram, design: MacrocycleDesign): UserProgram {
  return {
    ...program,
    meta: {
      ...program.meta,
      designRef: { id: design.id, name: design.name, hash: designFingerprint(design) },
    },
  };
}

/** Отвязать программу от дизайна периодизации. */
export function unlinkDesignFromProgram(program: UserProgram): UserProgram {
  if (!program.meta.designRef) return program;
  const meta = { ...program.meta };
  delete meta.designRef;
  return { ...program, meta };
}

/** Дизайн изменён после привязки (хэш содержимого не совпадает). */
export function isProgramDesignStale(program: UserProgram, design: MacrocycleDesign): boolean {
  const ref = program.meta.designRef;
  if (!ref) return false;
  return ref.hash !== designFingerprint(design);
}

/**
 * Переразметить фазы недель программы из актуального дизайна (все 3 ветки).
 * Сохраняет упражнения; при отсутствии designRef — no-op.
 * Обновляет meta.designRef.hash на актуальный.
 */
export function reapplyDesignToProgram(program: UserProgram, design: MacrocycleDesign): UserProgram {
  if (!program.meta.designRef) return program;
  let next: UserProgram = program;
  if (program.bb?.weeks) {
    next = { ...next, bb: { ...next.bb!, weeks: rephaseWeeks(next.bb!.weeks, design) } };
  }
  if (program.pl?.customWeeks) {
    next = { ...next, pl: { ...next.pl!, customWeeks: rephaseWeeks(next.pl!.customWeeks as PLWeek[], design) } };
  }
  if (program.hybrid?.bbWeeks) {
    next = { ...next, hybrid: { ...next.hybrid!, bbWeeks: rephaseWeeks(next.hybrid!.bbWeeks, design) } };
  }
  return {
    ...next,
    meta: {
      ...next.meta,
      designRef: { id: design.id, name: design.name, hash: designFingerprint(design) },
    },
  };
}

/**
 * Создать пустой скелет sessions для недели (N дней с пустыми блоками).
 * Используется когда sessions: [] не подходит (например для гибрид-интеграции).
 *
 * @param daysPerWeek — количество тренировочных дней в неделю (1-7)
 * @param dowPattern — шаблон дней недели (0=Пн … 6=Вс). По умолчанию [0,1,2,3,4,5,6].
 *                     Позволяет задать реальное расписание (например [1,3,5] — Вт,Чт,Сб).
 */
export function makeEmptySessionsForWeek(daysPerWeek: number, dowPattern?: number[]): UserSession[] {
  const days = Math.max(1, Math.min(7, daysPerWeek));
  const pattern = (dowPattern && dowPattern.length >= days)
    ? dowPattern
    : [0, 1, 2, 3, 4, 5, 6];
  return Array.from({ length: days }, (_, i) => ({
    id: newId('ses'),
    name: `День ${i + 1}`,
    focus: '',
    dayOfWeek: pattern[i] ?? i,
    blocks: [],
  }));
}
