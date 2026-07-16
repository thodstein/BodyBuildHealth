/**
 * lift-diagnostics.engine.ts — P10: диагностика движений и мёртвые точки (проф. уровень).
 * Расширяет weakpoint-pl + biomechanics: sticking points по углам суставов (присед/жим/тяга),
 * биомеханическая причина (момент рычага), bar-path-анализ, слабая мышца → корректирующие.
 */
import { diagnoseWeakPoint } from "../lms/weakpoint-pl";
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
// deadlift (таз/колено: 0=с пола → 180=вверху).
// Partial: детальные биомеханические данные (углы/суставы/коррекции) есть только для
// 3 классических движений (bench/squat/deadlift). ohp/row/pulldown/incline_press покрыты
// в weakpoint-pl (WEAK_POINTS_BY_LIFT), но без угловой диагностики — underspecified здесь.
// diagnoseLift/stickingPhases безопасно возвращают null/[] для неподдержанных движений.
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

export interface BarPathAnalysis {
  lift: Lift;
  issues: BarPathIssue[];
  diagnoses: { issue: BarPathIssue; cause: string; correction: string }[];
}

/** Анализ bar-path отклонений → причины + коррекции. */
export function barPathAnalysis(lift: Lift, issues: BarPathIssue[]): BarPathAnalysis {
  const MAP: Record<BarPathIssue, { cause: string; correction: string }> = {
    forward_drift: { cause: "Штанга уходит вперёд — слабые спина/ягодицы держат позу, или стартовая позиция.", correction: "Усилить заднюю цепь (RDL, наклоны), контролировать стартовую позицию (плечи над грифом)." },
    hips_shoot_up: { cause: "Таз «выстреливает» первым — квадрицепсы слабее разгибателей спины.", correction: "Присед на груди (квадрицепс), пауза в яме, коррекция техники — initiate одновременный подъём." },
    good_morning: { cause: "Good-morning squat — таз поднимается, корпус наклоняется (слабые квадрицепсы/ягодицы).", correction: "Присед на груди, болгарские сплит, пауза в яме; проверить глуботу/старт." },
    bar_loops: { cause: "Траектория «петля» — неконтролируемый путь (скорость/техника).", correction: "Скоростной жим/присед, остановки в амплитуде, запись техники." },
    asymmetric: { cause: "Асимметричная траектория — асимметрия силы/подвижности.", correction: "Унилатеральная работа (выпады, болгарские сплит), мобилизация, коррекция техники." },
  };
  return {
    lift,
    issues,
    diagnoses: issues.map(i => ({ issue: i, cause: MAP[i].cause, correction: MAP[i].correction })),
  };
}

/** Все доступные слабые фазы по движению. */
export function stickingPhases(lift: Lift): WeakPoint[] {
  return Object.keys(STICKING_POINTS[lift] || {}) as WeakPoint[];
}
