/**
 * strength-sport-barpath.engine.ts — BAR PATH PRO для ТА/стронга
 *
 * 3 типа траектории Vorobyev 1978 / Hiskia 1997:
 *  Type1: пересекает вертикаль дважды
 *  Type2: без пересечения, backward displacement
 *  Type3: пересекает трижды (чаще у женщин)
 *
 * Метрики: xLoop (горизонтальный размах), yMax, vMax, power, xT (у точки transition), xCatch
 * Валидация: Enode/Perch vertical r²=0.99, horizontal bias → correction Intercept+Slope (Chavda 2024)
 *
 * Полевая методика Ang 2023: Kinovea 12Hz Butterworth → дифференцирование → v
 */

export type TrajectoryType = 'type1' | 'type2' | 'type3' | 'unknown';
export type BarPathDeviationPro = 'forward' | 'backward' | 'loop' | 'early_pull' | 'soft_lockout';

export interface BarPathMetrics {
  xMin: number; // см
  xMax: number;
  xLoop: number; // размах
  yMax: number; // см макс высота
  vMax: number; // м/с пик вертикальной скорости
  hMaxDrop?: number; // см потеря высоты при уходе под бар
  powerPeak?: number; // Вт
  trajectoryType?: TrajectoryType;
}

export interface TrajectoryClassification {
  type: TrajectoryType;
  label: string;
  description: string;
  isOptimal: boolean;
  recommendation: string;
  references: string[];
}

export const TRAJECTORY_LABELS: Record<TrajectoryType, string> = {
  type1: 'Тип 1 — S-образная ×2',
  type2: 'Тип 2 — отведённая назад',
  type3: 'Тип 3 — S-образная ×3 (чаще женщины)',
  unknown: 'Не определена',
};

export const BAR_PATH_DEVIATION_LABELS: Record<BarPathDeviationPro, string> = {
  forward: 'Уход вперёд',
  backward: 'Уход назад',
  loop: 'Петля S',
  early_pull: 'Ранний срыв',
  soft_lockout: 'Мягкий замок',
};

/**
 * Классификация траектории по пересечениям вертикали (упрощенная).
 * xs: горизонтальные координаты относительно стартовой вертикали (отрицат = от атлета, положит = к атлету)
 * Возвращает тип по Vorobyev.
 */
export function classifyTrajectoryType(xs: number[]): TrajectoryClassification {
  if (!xs || xs.length < 3) return { type: 'unknown', label: TRAJECTORY_LABELS.unknown, description: 'Нет данных', isOptimal: false, recommendation: 'Запишите видео сбоку', references: [] };
  // Считаем пересечения нуля (смена знака)
  let crossings = 0;
  for (let i = 1; i < xs.length; i++) {
    if ((xs[i-1] < 0 && xs[i] >= 0) || (xs[i-1] > 0 && xs[i] <= 0)) crossings++;
  }
  // По литературе: Type1=2, Type2=0+backward, Type3=3
  // Упростим: если xs все >=0 (backward) → Type2
  const allNonNegative = xs.every(x => x >= -0.5); // допуск 0.5см
  const allNonPositive = xs.every(x => x <= 0.5);
  let type: TrajectoryType = 'unknown';
  let isOptimal = true;
  if (allNonNegative && crossings === 0) type = 'type2';
  else if (crossings === 2) type = 'type1';
  else if (crossings >= 3) type = 'type3';
  else if (crossings === 1) type = 'type1'; // одно пересечение → считаем Type1
  else type = 'type3';

  // По Kipp 2024: Type2/background shift коррелирует с лучшим результатом (backward → оптимально)
  // Hiskia: Type3 чаще у женщин, но не ошибка сама по себе
  if (type === 'type2') {
    return { type, label: TRAJECTORY_LABELS[type], description: 'Обратное смещение без пересечения — чаще у элиты, минимальный горизонтальный дрейф', isOptimal: true, recommendation: 'Сохранять вертикаль, минимизировать горизонталь <4см', references: ['Vorobyev 1978', 'Kipp 2024 bfPCA'] };
  }
  if (type === 'type1') {
    return { type, label: TRAJECTORY_LABELS[type], description: 'Классическая S-образная ×2', isOptimal: true, recommendation: 'Контролировать горизонталь <6см (SRD)', references: ['Vorobyev 1978', 'Ang 2023'] };
  }
  if (type === 'type3') {
    return { type, label: TRAJECTORY_LABELS[type], description: 'Тройное пересечение — часто у женщин, требует контроля ухода вперед при 2й тяге', isOptimal: false, recommendation: 'Усилить широчайшие/балансировку, уменьшить петлю', references: ['Hiskia 1997', 'Musser 2014'] };
  }
  return { type: 'unknown', label: TRAJECTORY_LABELS.unknown, description: 'Не удалось классифицировать', isOptimal: false, recommendation: 'Переснимите с коррекцией ракурса', references: [] };
}

export function computeBarPathMetrics(points: Array<{ x: number; y: number; t?: number }>): BarPathMetrics | null {
  if (!points || points.length < 2) return null;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xLoop = Math.round((xMax - xMin) * 10) / 10;
  const yMax = Math.round(Math.max(...ys) * 10) / 10;
  // vMax: дифференцирование если есть t, иначе по y разности
  let vMax = 0;
  if (points[0].t != null) {
    for (let i = 1; i < points.length; i++) {
      const dt = (points[i].t! - points[i - 1].t!) || 0.02;
      if (dt > 0) {
        const v = Math.abs(points[i].y - points[i - 1].y) / dt; // см/с → м/с
        const vMs = v / 100;
        if (vMs > vMax) vMax = vMs;
      }
    }
    vMax = Math.round(vMax * 100) / 100;
  } else {
    // fallback: разница y как прокси
    vMax = 0;
  }
  const traj = classifyTrajectoryType(xs);
  return { xMin, xMax, xLoop, yMax, vMax, trajectoryType: traj.type };
}

/**
 * Коррекция горизонтальных метрик Enode по Chavda 2024 Table1.
 * Enode_corrected = Intercept + Slope * Enode
 * Для вертикали r²=0.99 — коррекция не нужна.
 */
export function correctEnodeHorizontal(value: number, slope = 1.02, intercept = -0.3): number {
  return Math.round((intercept + slope * value) * 10) / 10;
}

/**
 * Диагностика отклонения по метрикам.
 * Использует SRD из Frontiers 2023: SRD горизонтали 4см turnover /6cm catch.
 */
export function diagnoseBarPathFromMetrics(metrics: BarPathMetrics | null, lift: string): { deviation: BarPathDeviationPro | null; severity: 'ok' | 'warn' | 'critical'; text: string } {
  if (!metrics) return { deviation: null, severity: 'ok', text: 'Нет данных тяги' };
  const liftLow = lift.toLowerCase();
  const isOverhead = liftLow.includes('snatch') || liftLow.includes('jerk');
  // Порог SRD 4-6см (Frontiers)
  if (metrics.xLoop > 6) return { deviation: 'loop', severity: 'critical', text: `Петля ${metrics.xLoop}см >6см SRD — критично` };
  if (metrics.xLoop > 4) return { deviation: 'loop', severity: 'warn', text: `Петля ${metrics.xLoop}см >4см — требует внимания` };
  if (metrics.vMax > 0 && metrics.vMax < 1.5 && isOverhead) return { deviation: 'early_pull', severity: 'warn', text: `Низкая пиковая скорость ${metrics.vMax} м/с — ранний срыв или недовзрыв` };
  if (metrics.yMax > 0 && metrics.yMax < 5) return { deviation: 'soft_lockout', severity: 'warn', text: 'Низкая высота бара — риск недокрута' };
  return { deviation: null, severity: 'ok', text: `Траектория ${metrics.trajectoryType} в допуске (${metrics.xLoop}см)` };
}

/**
 * Расширенная диагностика bar path для WLDiagnosticsHub: связывает deviation → weakPoint
 * (совместимо со старым diagnoseBarPath, но с метриками)
 */
export function diagnoseBarPathPro(lift: string, deviation: BarPathDeviationPro, metrics?: BarPathMetrics | null): { weak: string | null; corrections: string[]; metrics?: BarPathMetrics | null; trajectory?: TrajectoryClassification | null } {
  const map: Record<string, Record<BarPathDeviationPro, string>> = {
    snatch: { forward: 'snatch_mid', backward: 'snatch_off_floor', loop: 'snatch_pull_under', early_pull: 'snatch_mid', soft_lockout: 'snatch_catch' },
    clean: { forward: 'clean_mid', backward: 'clean_off_floor', loop: 'clean_catch', early_pull: 'clean_mid', soft_lockout: 'clean_catch' },
    jerk: { forward: 'jerk_drive', backward: 'jerk_dip', loop: 'jerk_lockout', early_pull: 'jerk_dip', soft_lockout: 'jerk_lockout' },
    squat: { forward: 'squat_mid', backward: 'squat_bottom', loop: 'squat_mid', early_pull: 'squat_bottom', soft_lockout: 'squat_mid' },
  };
  const key = lift.toLowerCase().includes('snatch') ? 'snatch' : lift.toLowerCase().includes('clean') ? 'clean' : lift.toLowerCase().includes('jerk') ? 'jerk' : lift.toLowerCase().includes('squat') ? 'squat' : 'snatch';
  const table = map[key];
  const weak = table ? table[deviation] : null;
  const corrMap: Record<BarPathDeviationPro, string[]> = {
    forward: ['pause_snatch', 'snatch_balance', 'overhead_squat_v2'],
    backward: ['deficit_snatch', 'snatch_pull', 'high_hang_snatch'],
    loop: ['muscle_snatch', 'hang_snatch', 'tempo_squat'],
    early_pull: ['pause_pull', 'deficit_pull', 'clean_pull'],
    soft_lockout: ['push_jerk', 'split_jerk', 'jerk_recovery'],
  };
  return { weak, corrections: corrMap[deviation] || [], metrics: metrics ?? null, trajectory: metrics?.trajectoryType ? classifyTrajectoryType([]) : null };
}

/**
 * Field-based reliability: SEM/SRD reference из Frontiers 2023
 * Возвращает, является ли изменение реальным ( > SRD )
 */
export function isRealChange(deltaCm: number, phase: 'turnover' | 'catch' | 'first_pull' | 'second_pull' = 'catch'): boolean {
  const srd = phase === 'turnover' ? 4 : phase === 'catch' ? 6 : 3;
  return Math.abs(deltaCm) > srd;
}
