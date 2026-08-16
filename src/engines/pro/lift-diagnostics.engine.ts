/**
 * lift-diagnostics.engine.ts — P10: диагностика движений и мёртвые точки (проф. уровень).
 * Расширяет weakpoint-pl + biomechanics: sticking points по углам суставов (присед/жим/тяга),
 * биомеханическая причина (момент рычага), bar-path-анализ, слабая мышца → корректирующие.
 */
import { diagnoseWeakPoint, WEAK_POINTS_BY_LIFT } from "../lms/weakpoint-pl";
import type { Lift, WeakPoint } from "../lms/weakpoint-pl";

export interface StickingPointInfo {
  phase: WeakPoint;
  angleRangeDeg: [number, number];     // диапазон угла ключевого сустава
  keyJoint: string;                    // сустав, определяющий фазу
  weakMuscles: string[];
  biomechanicalReason: string;         // почему рычаг/момент тяжёлый
  corrections: string[];              // корректирующие упражнения
  loadCues: string;                    // как нагрузить слабую фазу
}

// Фазы: bench (локоть 0=на груди → 180=дожим), squat (колено 0=глубоко → 180=вверху),
// deadlift (таз/колено: 0=с пола → 180=вверху), ohp/incline_press (локоть 0=старт → 180=дожим),
// row/pulldown (локоть/лопатка: 0=старт → 180=пик сведения).
// Угловая диагностика есть для ВСЕХ 7 движений (ohp/row/pulldown/incline добавлены
// раундом A3); для row/pulldown ключевые суставы — локоть и лопатка.
const STICKING_POINTS: Partial<Record<Lift, Partial<Record<WeakPoint, StickingPointInfo>>>> = {
  bench: {
    off_chest: { phase: "off_chest", angleRangeDeg: [0, 30], keyJoint: "плечо (горизонтальное сгибание)", weakMuscles: ["Большая грудная", "Передняя дельта"], biomechanicalReason: "Максимальный плечевой момент в нижней точке; слабый старт = недостаток стартовой силы груди/дельты.", corrections: ["Жим с паузой 2-3с на груди", "Жим с пола (dead-stop)", "Наклонный жим на верх груди", "Отжимания с глубиной"], loadCues: "Пауза на груди + съём без отбива (dead-stop) — тренирует чистый старт." },
    mid: { phase: "mid", angleRangeDeg: [30, 90], keyJoint: "локоть (переход)", weakMuscles: ["Грудные (концентрический переход)", "Передняя дельта"], biomechanicalReason: "Переход груди→трицепс в середине; «зависание» = слабый переход и скорость.", corrections: ["Жим средним хватом", "Жим с остановками (2-3 паузы в амплитуде)", "Скоростной жим (динамические усилия)"], loadCues: "Остановки в амплитуде тренируют удержание позиции в переходе." },
    lockout: { phase: "lockout", angleRangeDeg: [90, 180], keyJoint: "локоть (разгибание)", weakMuscles: ["Трицепс", "Верх груди"], biomechanicalReason: "Верхняя фаза — работа трицепса; слабый дожим = недостаток трицепса/жёсткости.", corrections: ["Дожимы с досок/плинтов (3/5/8/10 см)", "Жим в раме (дожим)", "Жим узким хватом", "Французский жим"], loadCues: "Дожимы с плинтов разной высоты — изоляция трицепса в верхней фазе." },
    start: { phase: "start", angleRangeDeg: [0, 15], keyJoint: "плечо", weakMuscles: ["Большая грудная (старт)"], biomechanicalReason: "Стартовая сила без отбива.", corrections: ["Жим в раме со старта", "Жим с паузой"], loadCues: "Съём с груди без опоры." },
  },
  squat: {
    bottom: { phase: "bottom", angleRangeDeg: [0, 90], keyJoint: "колено (разгибание из ямы)", weakMuscles: ["Квадрицепсы", "Ягодицы"], biomechanicalReason: "Максимальный тазобедренный и коленный момент в яме; слабый выход = недостаток квадрицепсов/ягодиц.", corrections: ["Присед на груди (акцент квадрицепс)", "Присед с паузой в яме", "Болгарские сплит-приседы", "Жим ногами"], loadCues: "Пауза в нижней точке убирает rebound и тренирует чистую стартовую силу." },
    mid: { phase: "mid", angleRangeDeg: [90, 130], keyJoint: "колено/таз", weakMuscles: ["Квадрицепсы", "Разгибатели"], biomechanicalReason: "Зависание в середине — общий объём квадрицепсов/позициональная сила.", corrections: ["Базовый присед (объём)", "Жим ногами", "Присед с остановками"], loadCues: "Объём + остановки для удержания позиции." },
    lockout: { phase: "lockout", angleRangeDeg: [130, 180], keyJoint: "таз (разгибание)", weakMuscles: ["Ягодицы", "Разгибатели спины"], biomechanicalReason: "Дожим вверх — работа ягодиц/разгибателей; «good morning squat» = слабый задний.", corrections: ["Наклоны (good morning)", "Румынская тяга", "Присед в широкой постановке (ягодицы)", "Тяга-сумо"], loadCues: "Наклоны/RDL укрепляют заднюю цепь для дожима." },
  },
  deadlift: {
    start: { phase: "start", angleRangeDeg: [0, 30], keyJoint: "колено+таз (стартовая позиция)", weakMuscles: ["Квадрицепсы", "Разгибатели спины"], biomechanicalReason: "Срыв с пола — максимальный момент; слабый старт = ноги/спина в стартовой позиции.", corrections: ["Тяга из ямы (дефицит/блины под ноги)", "Тяга с плинтов ниже обычного", "Присед (сила ног в старте)", "Гиперэкстензии"], loadCues: "Тяга из ямы (ниже старта) перегружает срыв." },
    mid: { phase: "mid", angleRangeDeg: [30, 90], keyJoint: "колено (проход коленей)", weakMuscles: ["Разгибатели спины", "Бицепс бедра"], biomechanicalReason: "Зависание на коленях — удержание позиции спиной + переход; слабая спина/переход.", corrections: ["Тяга с остановками (2 паузы)", "Румынская тяга (бицепс бедра)", "Тяга на прямых ногах"], loadCues: "Остановки тренируют удержание позиции; RDL — бицепс бедра/разгибатели." },
    lockout: { phase: "lockout", angleRangeDeg: [90, 180], keyJoint: "таз (дожим)", weakMuscles: ["Ягодицы", "Трапеции", "Разгибатели"], biomechanicalReason: "Дожим локаута — ягодицы/верх спины; слабый дожим = недостаток задней цепи.", corrections: ["Тяга с плинтов (выше колен)", "Румынская тяга", "Шраги", "Тяга-сумо"], loadCues: "Тяга с плинтов — изоляция дожима; шраги/трапеции для жёсткости." },
    sumo_start: { phase: "sumo_start", angleRangeDeg: [0, 20], keyJoint: "таз+колено (срыв сумо)", weakMuscles: ["Ягодицы", "Приводящие бедра"], biomechanicalReason: "В сумо срыв идёт от ягодиц/приводящих при вертикальном корпусе; слабый срыв = недостаток силы бёдер.", corrections: ["Тяга из ямы (широкая постановка)", "Присед в широкой постановке", "Тяга с плинтов"], loadCues: "Дефицит в широкой постановке — перегрузка срыва сумо." },
    sumo_lockout: { phase: "sumo_lockout", angleRangeDeg: [70, 180], keyJoint: "таз (замыкание бёдер)", weakMuscles: ["Ягодицы", "Разгибатели спины"], biomechanicalReason: "Финальная фаза сумо — разгибание таза и замыкание бёдер; слабый дожим = ягодицы/спина.", corrections: ["Тяга с плинтов (выше колен)", "Присед в широкой постановке", "Румынская тяга"], loadCues: "Тяга с плинтов выше колен изолирует замыкание сумо." },
  },
  ohp: {
    ohp_start: { phase: "ohp_start", angleRangeDeg: [0, 30], keyJoint: "плечо (сгибание)", weakMuscles: ["Передняя дельта", "Верх груди"], biomechanicalReason: "Старт с плеч — максимальный плечевой момент; слабый старт = передние дельты.", corrections: ["Армейский жим", "Жим гантелей", "Жим с паузой"], loadCues: "Съём с плеч без читинга; пауза в нижней точке." },
    ohp_mid: { phase: "ohp_mid", angleRangeDeg: [30, 120], keyJoint: "локоть (переход)", weakMuscles: ["Передняя дельта", "Трицепс"], biomechanicalReason: "Переход дельта→трицепс в середине; «зависание» = слабый переход и скорость.", corrections: ["Скоростной жим", "Жим с остановками", "Жим гантелей"], loadCues: "Остановки в амплитуде тренируют удержание позиции в переходе." },
    ohp_lockout: { phase: "ohp_lockout", angleRangeDeg: [120, 180], keyJoint: "локоть (разгибание)", weakMuscles: ["Трицепс", "Верх трапеций"], biomechanicalReason: "Дожим вверху — трицепс и жёсткость плечевого пояса; слабый дожим = трицепс.", corrections: ["Французский жим", "Жим узким хватом", "Жим в раме (дожим)"], loadCues: "Изоляция трицепса в верхней фазе." },
  },
  row: {
    row_start: { phase: "row_start", angleRangeDeg: [0, 30], keyJoint: "плечо (разгибание)", weakMuscles: ["Широчайшие", "Ромбовидные"], biomechanicalReason: "Съём штанги от пола — слабый старт тяги = широчайшие в стартовом положении.", corrections: ["Тяга гантели в наклоне", "Тяга с плинтов (rack pull)", "Гиперэкстензия"], loadCues: "Старт без рывка; удержание наклона корпуса." },
    row_mid: { phase: "row_mid", angleRangeDeg: [30, 90], keyJoint: "локоть (сгибание)", weakMuscles: ["Широчайшие", "Бицепс"], biomechanicalReason: "Концентрика к поясу — слабая середина = недостаток контроля широчайшими.", corrections: ["Тяга горизонтального блока", "Тяга гантели в наклоне", "Тяга верхнего блока обратным хватом"], loadCues: "Контролируемая концентрика, локоть вдоль корпуса." },
    row_squeeze: { phase: "row_squeeze", angleRangeDeg: [90, 180], keyJoint: "лопатка (ретракция)", weakMuscles: ["Ромбовидные", "Средняя трапеция"], biomechanicalReason: "Пиковое сведение лопаток — слабые ромбовидные/трапеция.", corrections: ["Гиперэкстензия", "Тяга горизонтального блока", "Подтягивания (прямой хват)"], loadCues: "Пауза со сведением лопаток в пике." },
  },
  pulldown: {
    pd_top: { phase: "pd_top", angleRangeDeg: [0, 30], keyJoint: "плечо (приведение)", weakMuscles: ["Широчайшие"], biomechanicalReason: "Старт сверху — слабый съём = широчайшие в верхней точке.", corrections: ["Подтягивания (прямой хват)", "Тяга верхнего блока широким хватом", "Тяга верхнего блока обратным хватом"], loadCues: "Съём лопатками вниз, без рывка руками." },
    pd_mid: { phase: "pd_mid", angleRangeDeg: [30, 90], keyJoint: "локоть (сгибание)", weakMuscles: ["Широчайшие", "Большая круглая"], biomechanicalReason: "Переход в средней фазе — слабый контроль концентрики.", corrections: ["Тяга верхнего блока обратным хватом", "Тяга горизонтального блока", "Тяга гантели в наклоне"], loadCues: "Локти к корпусу, контролируемый темп." },
    pd_squeeze: { phase: "pd_squeeze", angleRangeDeg: [90, 180], keyJoint: "лопатка (депрессия+ретракция)", weakMuscles: ["Широчайшие", "Большая круглая"], biomechanicalReason: "Доводка до груди — слабое завершение тяги.", corrections: ["Тяга верхнего блока V-рукоятью", "Подтягивания (прямой хват)", "Тяга гантели в наклоне"], loadCues: "Доводка до груди с полным сведением." },
  },
  incline_press: {
    inc_off: { phase: "inc_off", angleRangeDeg: [0, 30], keyJoint: "плечо (горизонтальное сгибание)", weakMuscles: ["Верх груди (ключичная)", "Передняя дельта"], biomechanicalReason: "Сход с груди на наклонной — слабый старт = верх груди.", corrections: ["Жим гантелей на наклонной", "Жим с паузой", "Армейский жим"], loadCues: "Пауза на груди + чистый съём." },
    inc_mid: { phase: "inc_mid", angleRangeDeg: [30, 90], keyJoint: "локоть (переход)", weakMuscles: ["Верх груди", "Трицепс"], biomechanicalReason: "Переход грудь→трицепс в середине.", corrections: ["Жим с остановками", "Скоростной жим", "Жим гантелей на наклонной"], loadCues: "Остановки в амплитуде." },
    inc_lockout: { phase: "inc_lockout", angleRangeDeg: [90, 180], keyJoint: "локоть (разгибание)", weakMuscles: ["Трицепс"], biomechanicalReason: "Дожим вверху — трицепс.", corrections: ["Французский жим", "Дожим с 3 см", "Жим в раме (дожим)"], loadCues: "Изоляция трицепса в верхней фазе." },
  },
};

export interface LiftDiagnosis {
  lift: Lift;
  weakPoint: WeakPoint;
  phaseLabel: string;
  angleRangeDeg: [number, number];
  keyJoint: string;
  weakMuscles: string[];
  biomechanicalReason: string;
  corrections: string[];
  loadCues: string;
  assistance: string[];   // из weakpoint-pl
  assistanceIntensityPct: number;
}

/** Полная диагностика по движению + слабой фазе. */
export function diagnoseLift(lift: Lift, weakPoint: WeakPoint): LiftDiagnosis | null {
  const sp = STICKING_POINTS[lift]?.[weakPoint];
  if (!sp) return null;
  const base = diagnoseWeakPoint(lift, weakPoint);
  return {
    lift, weakPoint,
    phaseLabel: base.label,
    angleRangeDeg: sp.angleRangeDeg,
    keyJoint: sp.keyJoint,
    weakMuscles: sp.weakMuscles,
    biomechanicalReason: sp.biomechanicalReason,
    corrections: sp.corrections,
    loadCues: sp.loadCues,
    assistance: base.assistance,
    assistanceIntensityPct: base.intensityPct,
  };
}

export type BarPathIssue = "forward_drift" | "hips_shoot_up" | "good_morning" | "bar_loops" | "asymmetric";

export interface BarPathIssueMeta {
  /** Для каких движений применимо отклонение траектории. */
  lifts: Lift[];
  /** С какой слабой фазой связано (по движению). null — универсальное отклонение. */
  relatedWeakPoint: Partial<Record<Lift, WeakPoint>>;
  /** Ассистентные упражнения (PL-пул коррекции отклонения) — fallback. */
  assistance: string[];
  /** Per-lift пулы коррекций: для каждого движения свой набор (жим ≠ присед ≠ тяга). */
  assistanceByLift?: Partial<Record<Lift, string[]>>;
}

export const BAR_PATH_ISSUES: Record<BarPathIssue, BarPathIssueMeta> = {
  forward_drift: {
    lifts: ['squat', 'deadlift', 'bench', 'ohp', 'incline_press'],
    relatedWeakPoint: { squat: 'bottom', deadlift: 'start', bench: 'off_chest', ohp: 'ohp_mid', incline_press: 'inc_mid' },
    assistance: ['Румынская тяга', 'Наклоны', 'Гиперэкстензия'],
    assistanceByLift: {
      bench: ['Жим с паузой', 'Жим с остановками', 'Отжимания с дефицитом'],
      ohp: ['Армейский жим', 'Жим гантелей', 'Жим с остановками'],
      incline_press: ['Жим с паузой', 'Жим гантелей на наклонной', 'Жим с остановками'],
    },
  },
  hips_shoot_up: {
    lifts: ['squat'],
    relatedWeakPoint: { squat: 'bottom' },
    assistance: ['Присед на груди', 'Присед с паузой', 'Болгарские сплит-приседы'],
  },
  good_morning: {
    lifts: ['squat'],
    relatedWeakPoint: { squat: 'lockout' },
    assistance: ['Присед на груди', 'Болгарские сплит-приседы', 'Наклоны'],
  },
  bar_loops: {
    lifts: ['squat', 'bench', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'],
    relatedWeakPoint: { squat: 'mid', bench: 'mid', deadlift: 'mid', ohp: 'ohp_mid', row: 'row_mid', pulldown: 'pd_mid', incline_press: 'inc_mid' },
    assistance: ['Скоростной жим', 'Жим с остановками', 'Становая тяга с остановками', 'Присед с паузой'],
    assistanceByLift: {
      squat: ['Присед с паузой', 'Присед с остановками', 'Присед на груди'],
      bench: ['Скоростной жим', 'Жим с остановками', 'Жим с паузой'],
      deadlift: ['Становая тяга с остановками', 'Становая тяга с паузой ниже колен', 'Тяга с плинтов (rack pull)'],
      ohp: ['Скоростной жим', 'Армейский жим', 'Жим с остановками'],
      row: ['Тяга гантели в наклоне', 'Тяга горизонтального блока', 'Становая тяга с остановками'],
      pulldown: ['Тяга верхнего блока широким хватом', 'Подтягивания (прямой хват)', 'Тяга верхнего блока одной рукой'],
      incline_press: ['Жим с остановками', 'Жим с паузой', 'Жим гантелей на наклонной'],
    },
  },
  asymmetric: {
    lifts: ['squat', 'bench', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'],
    relatedWeakPoint: {},
    assistance: ['Выпады', 'Болгарские сплит-приседы', 'Тяга гантели одной рукой'],
    assistanceByLift: {
      bench: ['Жим гантелей лёжа', 'Отжимания с дефицитом', 'Жим гантелей на наклонной'],
      deadlift: ['Тяга гантели в наклоне', 'Выпады', 'Болгарские сплит-приседы'],
      ohp: ['Жим гантелей', 'Армейский жим', 'Махи гантелями в стороны'],
      row: ['Тяга гантели в наклоне', 'Тяга гантели одной рукой', 'Тяга горизонтального блока'],
      pulldown: ['Тяга верхнего блока одной рукой', 'Подтягивания (прямой хват)', 'Тяга гантели в наклоне'],
      incline_press: ['Жим гантелей на наклонной', 'Жим гантелей лёжа', 'Армейский жим'],
    },
  },
};

export interface BarPathAnalysis {
  lift: Lift;
  issues: BarPathIssue[];
  diagnoses: { issue: BarPathIssue; cause: string; correction: string; assistance: string[]; relatedPhase: WeakPoint | null }[];
}

/** Анализ bar-path отклонений → причины + коррекции + ассистенты (с фильтром по движению). */
export function barPathAnalysis(lift: Lift, issues: BarPathIssue[]): BarPathAnalysis {
  const MAP: Record<BarPathIssue, { cause: string; correction: string }> = {
    forward_drift: { cause: "Штанга уходит вперёд — слабые спина/ягодицы держат позу, или стартовая позиция.", correction: "Усилить заднюю цепь (RDL, наклоны), контролировать стартовую позицию (плечи над грифом)." },
    hips_shoot_up: { cause: "Таз «выстреливает» первым — квадрицепсы слабее разгибателей спины.", correction: "Присед на груди (квадрицепс), пауза в яме, коррекция техники — одновременный подъём." },
    good_morning: { cause: "Good-morning squat — таз поднимается, корпус наклоняется (слабые квадрицепсы/ягодицы).", correction: "Присед на груди, болгарские сплит, пауза в яме; проверить глубину/старт." },
    bar_loops: { cause: "Траектория «петля» — неконтролируемый путь (скорость/техника).", correction: "Скоростной жим/присед, остановки в амплитуде, запись техники." },
    asymmetric: { cause: "Асимметричная траектория — асимметрия силы/подвижности.", correction: "Унилатеральная работа (выпады, болгарские сплит), мобилизация, коррекция техники." },
  };
  const applicable = issues.filter(issue => BAR_PATH_ISSUES[issue].lifts.includes(lift));
  return {
    lift,
    issues: applicable,
    diagnoses: applicable.map(issue => ({
      issue,
      cause: MAP[issue].cause,
      correction: MAP[issue].correction,
      assistance: BAR_PATH_ISSUES[issue].assistance,
      relatedPhase: BAR_PATH_ISSUES[issue].relatedWeakPoint[lift] ?? null,
    })),
  };
}

/** Отклонения, применимые к движению. */
export function barPathIssuesForLift(lift: Lift): BarPathIssue[] {
  return (Object.keys(BAR_PATH_ISSUES) as BarPathIssue[]).filter(issue => BAR_PATH_ISSUES[issue].lifts.includes(lift));
}

/** Отклонения, связанные с конкретной фазой движения (для синхронизации секций). */
export function barPathIssuesForPhase(lift: Lift, phase: WeakPoint): BarPathIssue[] {
  return barPathIssuesForLift(lift).filter(issue => BAR_PATH_ISSUES[issue].relatedWeakPoint[lift] === phase);
}

/** Единый bundle диагностики движения: слабая точка + мёртвая точка + связанные bar-path отклонения. */
export interface MovementDiagnosis {
  lift: Lift;
  phase: WeakPoint;
  weakPoint: ReturnType<typeof diagnoseWeakPoint>;
  sticking: LiftDiagnosis | null;
  barPathAll: BarPathIssue[];
  barPathRelated: BarPathIssue[];
}

export function diagnoseMovement(lift: Lift, phase: WeakPoint): MovementDiagnosis {
  return {
    lift,
    phase,
    weakPoint: diagnoseWeakPoint(lift, phase),
    sticking: diagnoseLift(lift, phase),
    barPathAll: barPathIssuesForLift(lift),
    barPathRelated: barPathIssuesForPhase(lift, phase),
  };
}

/** Все доступные слабые фазы по движению. */
export function stickingPhases(lift: Lift): WeakPoint[] {
  return Object.keys(STICKING_POINTS[lift] || {}) as WeakPoint[];
}

/**
 * Каноническая эвристика «фаза срыва по числу повторений» — ЕДИНЫЙ источник
 * для всех карточек диагностики (был разнобой: PlDeadpointsBarPathCard и
 * StickingPointAnalysisCard маппили одни и те же повторы в разные фазы).
 *
 * Низкая достоверность: по числу повторений фаза определяется только
 * предположительно. Правило:
 *  - reps ≤ 2 → фаза максимального момента силы (низ/старт/сход с груди);
 *  - reps 3–5 → середина амплитуды (mid), если у движения она есть;
 *  - reps ≥ 6 → null (неопределено — подсказку по фазе не показывать).
 *
 * Возвращает null, если повторы некорректны или у движения нет подходящей фазы.
 */
export function phaseForReps(reps: number, lift: Lift): WeakPoint | null {
  if (!Number.isFinite(reps) || reps <= 0) return null;
  const phases = WEAK_POINTS_BY_LIFT[lift] ?? [];
  if (phases.length === 0) return null;
  const MAX_MOMENT_PHASE: Partial<Record<Lift, WeakPoint>> = {
    bench: 'off_chest', squat: 'bottom', deadlift: 'start',
    ohp: 'ohp_start', row: 'row_start', pulldown: 'pd_top', incline_press: 'inc_off',
  };
  let candidate: WeakPoint | null = null;
  if (reps <= 2) candidate = MAX_MOMENT_PHASE[lift] ?? null;
  else if (reps <= 5) {
    if (phases.includes('mid')) candidate = 'mid';
    else candidate = phases.find(p => p.endsWith('_mid')) ?? null;
  }
  return candidate && phases.includes(candidate) ? candidate : null;
}
