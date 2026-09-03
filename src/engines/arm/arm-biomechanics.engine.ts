/**
 * arm-biomechanics.engine.ts — ЧИСЛОВАЯ БИОМЕХАНИКА армрестлинга (PRO)
 *
 * Зеркало strength-sport-biomechanics.engine.ts (TA_BIOMECH).
 * 12 мёртвых точек (ArmWeakPoint) → angleRangeDeg + keyJoint + weakMuscles
 * + biomechanicalReason + corrections + loadCues + intensityPct + references.
 *
 * Источники:
 *  - Кузнецов 2011 (power35.ru) — РУ/РА/РН, статика 40-60% 1-3мин, стресс 100-125% 5-10с, 3/2/1
 *  - StrengthLog Abelsson 2025 — power chain fingers→wrist→rotation→elbow→shoulder
 *  - GoldenGrip 2025 — 15 best exercises, humerus spiral (side slowly)
 *  - Mithril 2026 — cup/pron/rising раздельно+комбо
 *  - TAWF 2026 — hook/toproll/press единственные техники
 *  - Brismar 1975 / Holstein-Lewis — торсия humerus при internal rotation плеча
 *  - Grokipedia — EMG pronator teres/pec major, torque = force×lever
 */

export type ArmWeakPoint =
  | 'cup_start'
  | 'cup_hold'
  | 'rising_top'
  | 'pron_open'
  | 'pron_lock'
  | 'sup_cup'
  | 'sup_drag'
  | 'side_mid'
  | 'side_pin'
  | 'back_start'
  | 'back_drag'
  | 'contain_fingers';

export const ARM_WEAK_POINTS: readonly ArmWeakPoint[] = [
  'cup_start','cup_hold','rising_top','pron_open','pron_lock','sup_cup','sup_drag','side_mid','side_pin','back_start','back_drag','contain_fingers',
] as const;

export function isArmWeakPoint(v: string): v is ArmWeakPoint {
  return (ARM_WEAK_POINTS as readonly string[]).includes(v);
}

export interface ArmBiomechInfo {
  weakPoint: ArmWeakPoint;
  label: string;
  technique: string[]; // hook/toproll/press/all
  joint: string;
  angleRangeDeg: [number, number];
  keyJoint: string;
  /** Каким углом валидировать в хабе: 'wrist'|'elbow'|'forearm'|'none' (side/back — 'none', угол неприменим). */
  angleJoint?: 'wrist' | 'elbow' | 'forearm' | 'none';
  weakMuscles: string[];
  biomechanicalReason: string;
  corrections: string[]; // exercise ids from exercise-catalog-arm.ts
  loadCues: string;
  intensityPct: number; // 0.60-0.75
  rationale: string;
  references: string[];
  workingDirection?: 'to_little' | 'to_middle' | 'to_thumb';
  elbowDeg?: Array<90|110|120>;
}

export const ARM_BIOMECH: Record<ArmWeakPoint, ArmBiomechInfo> = {
  cup_start: {
    weakPoint: 'cup_start',
    label: 'Cup — старт (кисть открывается на ReadyGo)',
    technique: ['hook','toproll'],
    joint: 'лучезапястный (flexion)',
    angleRangeDeg: [0, 20],
    keyJoint: 'лучезапястный flexion (wrist_flexors)',
    weakMuscles: ['wrist_flexors','risers'],
    biomechanicalReason: 'Потеря флексии кисти на старте → leverage -30% (GoldenGrip chain). Wrist уходит в extension, рука открывается — соперник накрывает.',
    corrections: ['wrist_curl_belt','cup_to_little','wrist_curl_bb','wrist_roller'],
    loadCues: 'Ремень через фалангу, локоть ≤120°, кисть к мизинцу (РН). Статика 10с + динамика 6-10.',
    intensityPct: 0.65,
    rationale: 'Перегрузка старта cup — ремень + РН.',
    references: ['Кузнецов I/II РУ/РН','StrengthLog wrist flexion','GoldenGrip cupping'],
    workingDirection: 'to_little',
    elbowDeg: [90,110],
  },
  cup_hold: {
    weakPoint: 'cup_hold',
    label: 'Cup — удержание под тягой (mid)',
    technique: ['hook','toproll','press'],
    joint: 'лучезапястный (flexion под нагрузкой)',
    angleRangeDeg: [10, 30],
    keyJoint: 'лучезапястный + пальцы (risers)',
    weakMuscles: ['wrist_flexors','risers','thumb'],
    biomechanicalReason: 'Удержание cup под внешней тягой соперника — изометрический провал в середине. Слабый rising + thumb → кисть разворачивают.',
    corrections: ['wrist_curl_belt','wrist_curl_behind','cup_to_thumb','riser_lift'],
    loadCues: 'Удержание 10-15с в РУ + тяга ремнём к себе. Не тянуть локтем.',
    intensityPct: 0.65,
    rationale: 'Изометрия удержания cup.',
    references: ['Mithril cupping','StrengthLog','TAWF back pressure'],
    workingDirection: 'to_thumb',
    elbowDeg: [90,110],
  },
  rising_top: {
    weakPoint: 'rising_top',
    label: 'Rising — высота костяшек падает',
    technique: ['toproll','press'],
    joint: 'кисть (radial deviation + пальцы)',
    angleRangeDeg: [15, 40],
    keyJoint: 'разгибатели пальцев/risers (radial deviation)',
    weakMuscles: ['risers','thumb','ulnar_deviators','radial_deviators'],
    biomechanicalReason: 'Высота костяшек (knuckle height) определяет leverage toproll. Падение высоты → соперник уходит выше руки.',
    corrections: ['riser_lift','finger_containment_band','plate_pinch_hold','radial_dev_heavy','ulnar_dev_heavy'],
    loadCues: 'Вертикальная ручка, подъём за счёт пальцев (Devon Larratt), без читинга плечом.',
    intensityPct: 0.65,
    rationale: 'Rising — finger containment + thumb.',
    references: ['GoldenGrip rising','Mithril rising','Grokipedia finger containment'],
    workingDirection: 'to_little',
    elbowDeg: [90,110,120],
  },
  pron_open: {
    weakPoint: 'pron_open',
    label: 'Пронация — вход в toproll не открывается',
    technique: ['toproll'],
    joint: 'предплечье (pronator teres)',
    angleRangeDeg: [90, 120],
    keyJoint: 'пронация (forearm pronated 0-30° от neutral)',
    weakMuscles: ['pronators','brachioradialis'],
    biomechanicalReason: 'Вход в toproll — вращение кисти внутрь через pronator teres. Слабая пронация → рука супинируется назад, теряется накрывание пальцев.',
    corrections: ['pronation_cable','pronation_sledge','pronation_strap','indian_clubs'],
    loadCues: 'Локоть 90° у корпуса, вращение к мизинцу (РН), 5×5 heavy.',
    intensityPct: 0.70,
    rationale: 'Топролл — pronation 5×5 heavy.',
    references: ['GoldenGrip pronation','ImproveYourGrip pron vs sup','Mithril pronation'],
    workingDirection: 'to_little',
    elbowDeg: [90,110],
  },
  pron_lock: {
    weakPoint: 'pron_lock',
    label: 'Пронация — lock не держит под нагрузкой',
    technique: ['toproll'],
    joint: 'предплечье (pronation lock)',
    angleRangeDeg: [130, 160],
    keyJoint: 'пронация lock (forearm 140°+)',
    weakMuscles: ['pronators','brachioradialis','thumb'],
    biomechanicalReason: 'Lock — удержание pron под нагрузкой соперника (12.47% асимметрии элиты — Bezkorovainyi). Слабый endurance → срыв наружу.',
    corrections: ['pronation_cable','pron_high_strap','sledge_choke','lever_top'],
    loadCues: 'High-torque ремень + удержание 10с в lock. Пульсы для tendon.',
    intensityPct: 0.70,
    rationale: 'Pron lock — статика + heavy.',
    references: ['Bezkorovainyi 12.47% asymmetry','GoldenGrip high torque','TAWF pronation'],
    workingDirection: 'to_little',
    elbowDeg: [110,120],
  },
  sup_cup: {
    weakPoint: 'sup_cup',
    label: 'Супинация + cup — хук-старт (вход в крюк)',
    technique: ['hook'],
    joint: 'предплечье (supination 60-90°)',
    angleRangeDeg: [60, 90],
    keyJoint: 'супинация + cup (supinator + biceps)',
    weakMuscles: ['supinators','brachialis','wrist_flexors'],
    biomechanicalReason: 'Хук — супинация + cup одновременно (hook cup). Слабый supinator → хук разворачивают в toproll соперника.',
    corrections: ['supination_cable','supination_hammer','hammer_curl_thick','sup_high_strap'],
    loadCues: 'Тяга локтя к бедру + супинация (drag to hip). Фиксация кисти ремнём.',
    intensityPct: 0.70,
    rationale: 'Hook — supination + brachialis.',
    references: ['StrengthLog hook','GoldenGrip supination drag','ImproveYourGrip supinator'],
    workingDirection: 'to_middle',
    elbowDeg: [90,110],
  },
  sup_drag: {
    weakPoint: 'sup_drag',
    label: 'Супинация — drag середина (тяга хуком)',
    technique: ['hook'],
    joint: 'локоть (flexion 90° + supination)',
    angleRangeDeg: [80, 110],
    keyJoint: 'локоть fleх 90° + supination hold',
    weakMuscles: ['supinators','brachialis','biceps_long','back_pressure'],
    biomechanicalReason: 'Середина хука — тяга на себя с супинацией (back pressure + brachialis). Слабая тяга → не затягивает соперника.',
    corrections: ['supination_cable','hook_drag_cable','hammer_belt','sup_high_strap'],
    loadCues: 'Супинация + тяга к бедру (Strap Grip). Молот через ремень — фиксация кисти (Кузнецов).',
    intensityPct: 0.70,
    rationale: 'Hook drag — supination + back.',
    references: ['TAWF hook','StrengthLog biceps/brachialis','Kuznetsov фиксация кисти'],
    workingDirection: 'to_thumb',
    elbowDeg: [90,110],
  },
  side_mid: {
    weakPoint: 'side_mid',
    label: 'Бок — середина стола (плечо 30°)',
    technique: ['press','hook'],
    joint: 'плечо (adduction 30°)',
    angleRangeDeg: [20, 45],
    keyJoint: 'плечевой (adduction + internal rotation)',
    weakMuscles: ['side_pressure','shoulder_stab','core_anchor'],
    biomechanicalReason: 'Середина стола — боковое давление через pec major + передняя дельта + трицепс. Слабый side → застревание в центре.',
    corrections: ['side_press_cable','side_belt_table','side_press_table','table_pushdown_iso'],
    loadCues: 'Локоть на подушке высота стола, давление перпендикулярно. Медленно! RIR≥2, прогрессия ≤10%/нед.',
    intensityPct: 0.60,
    rationale: 'Side — gated, только с контролем кисти.',
    references: ['Brismar 1975 humerus','Holstein-Lewis','GoldenGrip side slowly','Kuznetsov'],
    workingDirection: 'to_thumb',
    elbowDeg: [110,120],
    angleJoint: 'none',
  },
  side_pin: {
    weakPoint: 'side_pin',
    label: 'Бок — дожимание к подушке (humerus риск)',
    technique: ['press'],
    joint: 'плечо/локоть (pin)',
    angleRangeDeg: [30, 50],
    keyJoint: 'плечевой internal rotation + локоть 90°',
    weakMuscles: ['side_pressure','shoulder_stab','pectoralis'],
    biomechanicalReason: 'Финиш — максимальный torque + изгиб humerus (spiral fracture 90% травм, radial nerve 22% — PMC 10315927). Ранний side без кисти → перелом.',
    corrections: ['side_belt_table','table_pushdown_iso','side_press_table','internal_rotation_band'],
    loadCues: 'Ремень на столе, вектор как в борьбе, не на блоке. Изометрия 10с макс.',
    intensityPct: 0.60,
    rationale: 'Pin — только ремнём, humerus guard.',
    references: ['PMC spiral fracture 90%','SciDirect humerus','Gripzilla humerus prevention'],
    workingDirection: 'to_thumb',
    angleJoint: 'none',
    elbowDeg: [120],
  },
  back_start: {
    weakPoint: 'back_start',
    label: 'Back pressure — старт (тяга на себя, ReadyGo)',
    technique: ['toproll','hook'],
    joint: 'локоть/спина (lat drag)',
    angleRangeDeg: [90, 110],
    keyJoint: 'широчайшие + задняя дельта (back_drag)',
    weakMuscles: ['back_pressure','brachialis','biceps_long'],
    biomechanicalReason: 'Старт — тяга руки на себя (lat drag) чтобы сжать соперника. Слабая — не можешь навязать hook/toproll.',
    corrections: ['lat_drag_belt','row_strap_hip','landmine_row_under','hook_drag_cable'],
    loadCues: 'Ремень вокруг запястья, тяга к себе как toproll старт. Локоть прижат.',
    intensityPct: 0.70,
    rationale: 'Back start — lat drag.',
    references: ['GoldenGrip back_drag','TAWF back pressure','StrengthLog back_pressure'],
    workingDirection: 'to_middle',
    elbowDeg: [90,110],
    angleJoint: 'none',
  },
  back_drag: {
    weakPoint: 'back_drag',
    label: 'Back pressure — середина (drag + control)',
    technique: ['hook','toproll'],
    joint: 'плечо/локоть (drag)',
    angleRangeDeg: [90, 120],
    keyJoint: 'широчайшие + brachialis (mid drag)',
    weakMuscles: ['back_pressure','brachialis','brachioradialis','shoulder_stab'],
    biomechanicalReason: 'Середина — удержание центра + drag под нагрузкой. Слабый → соперник утягивает.',
    corrections: ['lat_drag_belt','row_strap_hip','hook_drag_cable','anti_rotation_hold'],
    loadCues: 'Рука к карману/бедру, локоть прижат, корпус квадрат (антиротация).',
    intensityPct: 0.70,
    rationale: 'Mid drag — back + brachialis + core.',
    references: ['Grokipedia lat/back','StrengthLog shoulder integrity','GoldenGrip anti-rotation'],
    workingDirection: 'to_middle',
    elbowDeg: [110,120],
    angleJoint: 'none',
  },
  contain_fingers: {
    weakPoint: 'contain_fingers',
    label: 'Containment — пальцы/большой (пинч, thumb)',
    technique: ['toproll','hook','press'],
    joint: 'пальцы (pinch) + большой',
    angleRangeDeg: [0, 30],
    keyJoint: 'пальцы + thumb (grip_pinch)',
    weakMuscles: ['grip_pinch','thumb','risers','grip_support'],
    biomechanicalReason: 'Пальцы открываются → теряется hand control. Thumb containment ключ для high hand vs low hand (Levan vs Denis). Support-провал (RT<60) — та же точка: не хватает удержания.',
    corrections: ['hub_pinch','plate_pinch_hold','rolling_thunder','apollon_axle','finger_containment_band','coc_gripper'],
    loadCues: 'Резина вокруг пальцев — не распахивать. Pinch удержание 10-20с. Support: RT/Axle DOH без лямок.',
    intensityPct: 0.60,
    rationale: 'Containment — risers+thumb+palm+support.',
    references: ['Mithril finger containment','ImproveYourGrip finger','Grokipedia thumb','IronMind RT 130.5'],
    workingDirection: 'to_thumb',
    elbowDeg: [90,110],
    angleJoint: 'none',
  },
};

export function diagnoseArmWeakPointDetailed(weakPoint: ArmWeakPoint): ArmBiomechInfo | null {
  return ARM_BIOMECH[weakPoint] ?? null;
}

export function allArmBiomech(): ArmBiomechInfo[] {
  return Object.values(ARM_BIOMECH);
}

export function weakPointsForTechnique(technique: string): ArmWeakPoint[] {
  const t = technique.toLowerCase();
  return (Object.values(ARM_BIOMECH) as ArmBiomechInfo[])
    .filter(b => b.technique.includes(t) || b.technique.includes('all'))
    .map(b => b.weakPoint);
}

export function isValidAngleForArmWeakPoint(wp: ArmWeakPoint, angleDeg: number): boolean {
  const b = ARM_BIOMECH[wp];
  if (!b) return false;
  const [lo, hi] = b.angleRangeDeg;
  return angleDeg >= lo && angleDeg <= hi;
}

/** Каким слайдером валидировать точку. Side/back/contain — 'none' (угол неприменим, контроль по технике/нагрузке). */
export function angleJointForWeakPoint(wp: ArmWeakPoint): 'wrist' | 'elbow' | 'forearm' | 'none' {
  const b = ARM_BIOMECH[wp];
  if (b?.angleJoint) return b.angleJoint;
  if (wp === 'side_mid' || wp === 'side_pin' || wp === 'back_start' || wp === 'back_drag' || wp === 'contain_fingers') return 'none';
  if (wp === 'sup_drag') return 'elbow';
  if (wp === 'cup_start' || wp === 'cup_hold' || wp === 'rising_top') return 'wrist';
  return 'forearm';
}

/** VBT-пороги для арм-точки (план §6.3 решён): мелкие сухожильные группы — чувствительнее, чем TA 10%/carry 15%.
 *  cup/rising 12/20, pron/sup 15/25, side 10/20, back 15/25, contain(grip) 15/25. Не меняет arm-vbt-capture.engine (чужой) — только хинт для хаба. */
export function vbtThresholdForWeakPoint(wp: ArmWeakPoint): { warnPct: number; stopPct: number } {
  if (wp === 'cup_start' || wp === 'cup_hold' || wp === 'rising_top') return { warnPct: 12, stopPct: 20 };
  if (wp === 'pron_open' || wp === 'pron_lock' || wp === 'sup_cup' || wp === 'sup_drag') return { warnPct: 15, stopPct: 25 };
  if (wp === 'side_mid' || wp === 'side_pin') return { warnPct: 10, stopPct: 20 };
  if (wp === 'back_start' || wp === 'back_drag') return { warnPct: 15, stopPct: 25 };
  return { warnPct: 15, stopPct: 25 };
}

export interface JointAnglesInput { elbow?: number; wrist?: number; forearm?: number; shoulder?: number; }

export function autoValidateArmAngles(angles: JointAnglesInput, weakPoints?: ArmWeakPoint[]): Array<{ weakPoint: ArmWeakPoint; angle: number; valid: boolean; recommendation: string }> {
  const out: Array<{ weakPoint: ArmWeakPoint; angle: number; valid: boolean; recommendation: string }> = [];
  const wps = weakPoints && weakPoints.length ? weakPoints : (Object.keys(ARM_BIOMECH) as ArmWeakPoint[]);
  for (const wp of wps) {
    const bio = ARM_BIOMECH[wp];
    if (!bio) continue;
    if (angleJointForWeakPoint(wp) === 'none') continue;
    const key = bio.keyJoint.toLowerCase();
    let angleVal: number | undefined;
    if (key.includes('лучезапяст') || key.includes('кист') || key.includes('wrist') || key.includes('flexion')) angleVal = angles.wrist;
    else if (key.includes('локт') || key.includes('локоть') || key.includes('elbow') || key.includes('flex')) angleVal = angles.elbow;
    else if (key.includes('предплечье') || key.includes('прона') || key.includes('супи') || key.includes('forearm') || key.includes('pron') || key.includes('sup')) angleVal = angles.forearm;
    else if (key.includes('плеч') || key.includes('shoulder') || key.includes('adduction') || key.includes('internal')) angleVal = angles.shoulder;
    else angleVal = angles.elbow ?? angles.wrist ?? angles.forearm;
    if (angleVal == null || !Number.isFinite(angleVal)) continue;
    const valid = isValidAngleForArmWeakPoint(wp, angleVal);
    out.push({ weakPoint: wp, angle: angleVal, valid, recommendation: valid ? `${bio.label}: угол ${angleVal}° в диапазоне ${bio.angleRangeDeg[0]}-${bio.angleRangeDeg[1]}° ✅` : `${bio.label}: ${angleVal}° вне ${bio.angleRangeDeg[0]}-${bio.angleRangeDeg[1]}° → ${bio.loadCues}` });
  }
  return out;
}

// Связь dead-point → мертвая точка стола (для UI карточки)
// phaseForArmAngle — как phaseForReps в PL: по углу определяет мертвую зону
export function phaseForArmAngle(input: { elbowDeg: number; wristDeg: number; forearmDeg: number; technique?: string }): ArmWeakPoint | null {
  const { elbowDeg, wristDeg, forearmDeg, technique } = input;
  // эвристика: по доминирующему отклонению
  if (wristDeg < -5 || wristDeg > 30) return wristDeg < 0 ? 'cup_start' : 'cup_hold';
  if (forearmDeg > 130) return 'pron_lock';
  if (forearmDeg < 60) return 'sup_cup';
  if (technique === 'press' && elbowDeg >= 120) return 'side_pin';
  if (technique === 'toproll' && forearmDeg >= 110) return 'pron_open';
  if (technique === 'hook' && forearmDeg <= 80) return 'sup_drag';
  return null;
}
