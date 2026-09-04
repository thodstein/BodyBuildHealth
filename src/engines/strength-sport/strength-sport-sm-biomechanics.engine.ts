/**
 * strength-sport-sm-biomechanics.engine.ts — ЧИСЛОВАЯ БИОМЕХАНИКА СТРОНГМЕНА (PRO)
 *
 * 13 фаз: overhead 4 + carry 6 + stone 3 (+ grip/core).
 * Аналог TA_BIOMECH, но для стронга: angleRangeDeg, keyJoint, weakMuscles,
 * biomechanicalReason, corrections, loadCues, intensityPct, rationale, references.
 *
 * Источники:
 *  - Winwood et al. 2014 JSCR 28 — практики стронгменов, taper n=454
 *  - McGill, McDermott et al. 2009 — trunk loads: yoke max, stone anterior load
 *  - Harris et al. 2018 PeerJ PMC8418215 — atlas stone hip extensor moment > deadlift
 *  - Keogh, Winwood 2017 Sports Med 47 — травмы стронгменов
 *  - Legg et al. Sport Med Open 2019 systematic review — carry ROM/GRF, log lift neutral grip
 *  - Hedge, Heazlewood 2025 — biceps distal tear профилактика
 *  - EliteFTS 2025 — log/yoke/farmers/stone weak points
 */

export type SMWeakPoint =
  | 'log_dip'
  | 'log_drive'
  | 'log_lockout'
  | 'log_clean'
  | 'yoke_pickup'
  | 'yoke_walk'
  | 'yoke_turn'
  | 'farmers_pickup'
  | 'farmers_carry'
  | 'farmers_grip'
  | 'stone_off_floor'
  | 'stone_lap'
  | 'stone_load'
  | 'grip_support'
  | 'core_brace'
  | 'conditioning';

export interface SMBiomechInfo {
  weakPoint: SMWeakPoint;
  label: string;
  joint: string;
  angleRangeDeg: [number, number];
  keyJoint: string;
  weakMuscles: string[];
  biomechanicalReason: string;
  corrections: string[];
  loadCues: string;
  intensityPct: number;
  rationale: string;
  references: string[];
}

export const SM_BIOMECH: Record<SMWeakPoint, SMBiomechInfo> = {
  log_dip: {
    weakPoint: 'log_dip',
    label: 'Лог: дип 8-12 см',
    joint: 'колено',
    angleRangeDeg: [0, 12],
    keyJoint: 'коленный (дип глубина 8-12 см)',
    weakMuscles: ['Квадрицепс', 'Ягодицы'],
    biomechanicalReason: 'Дип — полуприсед под логом (нейтральный хват, лог на груди). Глубокий/медленный дип теряет упругость и переводит штангу вперёд. Пик мощности в drive зависит от жёсткости дипа.',
    corrections: ['Толчковый дип (jerk_dip)', 'Пауза-толчок dip 2с', 'Фронтальный присед'],
    loadCues: 'Контроль 10 см + взрыв, лог высоко на груди, локти вперёд.',
    intensityPct: 0.70,
    rationale: 'Дип — пружина лога; перегрузка паузой.',
    references: ['EliteFTS log dip', 'Garhammer 1985', 'McGill 2009'],
  },
  log_drive: {
    weakPoint: 'log_drive',
    label: 'Лог: драйв (выталкивание)',
    joint: 'таз / плечо',
    angleRangeDeg: [0, 30],
    keyJoint: 'таз + плечо (взрыв)',
    weakMuscles: ['Дельты', 'Трицепс', 'Ноги (drive)'],
    biomechanicalReason: 'Drive — разгибание ног + толчок плеч, лог диаметром 30см смещает ЦМ вперёд vs штанга. Слабый drive = недолёт, дожим руками, потеря люфта диаметра.',
    corrections: ['Толчковый жим (push_press)', 'Жим с пинов (pin_press)', 'Жим стоя (ohp)'],
    loadCues: 'Пуш-пресс с акцентом на ноги, без паузы на груди.',
    intensityPct: 0.70,
    rationale: 'Drive — ноги + плечи, перегрузка пуш-прессом.',
    references: ['Legg 2019 log ROM', 'Garhammer'],
  },
  log_lockout: {
    weakPoint: 'log_lockout',
    label: 'Лог: локаут (фиксация)',
    joint: 'локоть',
    angleRangeDeg: [0, 180],
    keyJoint: 'локтевой + плечевой (оверхед)',
    weakMuscles: ['Трицепс', 'Дельты', 'Кор (стаб)'],
    biomechanicalReason: 'Фиксация над головой с нейтральным хватом — диаметр лога требует большей стабилизации грудного отдела, чем штанга. Lockout чаще ломается у 70% стронгменов (EliteFTS).',
    corrections: ['Жим с пинов над головой', 'Толчок в ножницы (split_jerk)', 'Армейский жим с паузой'],
    loadCues: 'Сидячий локаут 8-12 повт (если reps), 3 повт (если max) — изолирует трицепс.',
    intensityPct: 0.65,
    rationale: 'Локаут — трицепс; сидячий жим без ног.',
    references: ['EliteFTS log lockout', 'McGill overhead'],
  },
  log_clean: {
    weakPoint: 'log_clean',
    label: 'Лог: заброс (clean/lap)',
    joint: 'таз',
    angleRangeDeg: [0, 20],
    keyJoint: 'тазобедренный (тяга + перекат)',
    weakMuscles: ['Бицепс бедра', 'Разгибатели', 'Трапеции', 'Бицепс (риск)'],
    biomechanicalReason: 'Continental clean лога: перекат по животу + подрыв. Сфера/цилиндр смещает нагрузку anterior, требует high-hips старта как у камня. Arms — канаты, не тянут.',
    corrections: ['Тяга лога с дефицита', 'Румынская тяга (rdl)', 'Тяга к подбородку + front_squat'],
    loadCues: 'Руки-канаты, трицепс напряжён, таз высоко как на камне.',
    intensityPct: 0.70,
    rationale: 'Clean — high hips + канаты.',
    references: ['JTS log clean 101', 'Harris stone hips'],
  },
  yoke_pickup: {
    weakPoint: 'yoke_pickup',
    label: 'Йок: съём (пикап)',
    joint: 'таз / колено',
    angleRangeDeg: [0, 90],
    keyJoint: 'тазобедренный + коленный (присед под йок)',
    weakMuscles: ['Квадрицепс', 'Ягодицы', 'Кор (brace)'],
    biomechanicalReason: 'Пикап йока 300-500кг (3-4×BW) — осевая компрессия max среди ивентов (McGill 2009). Требует brace 2с + вертикальный торс, иначе hip abduction insufficiency → вальгус.',
    corrections: ['Пауза-присед (pause_squat)', 'Фронтальный присед', 'Yoke walk частичный (пикап + 5м)'],
    loadCues: 'Brace 2с перед съёмом, короткие шаги, спина нейтраль.',
    intensityPct: 0.80,
    rationale: 'Пикап — изометрия + brace.',
    references: ['McGill yoke max load', 'Winwood 2014'],
  },
  yoke_walk: {
    weakPoint: 'yoke_walk',
    label: 'Йок: ходьба 20м',
    joint: 'голеностоп / торс',
    angleRangeDeg: [0, 5],
    keyJoint: 'голеностоп (шаг 40-60см) + кор (анти-lateral flex)',
    weakMuscles: ['Кор (QL)', 'Ягодицы', 'Квадрицепс'],
    biomechanicalReason: 'Ходьба: stride length ↓ (ES -0.32) rate ↑ (0.37) при нагрузке (Legg systematic). Нестабильность торса + 350кг на плечах → QL перегрузка. Скорость vs стабильность — trade-off.',
    corrections: ['Yoke walk техника 50% ×50ft', 'Чемоданная переноска (sandbag_carry)', 'Планка боковая + suitcase carry'],
    loadCues: 'Короткие шаги, взгляд вперёд, не округлять. Тренируй скорость на 60% отдельно.',
    intensityPct: 0.75,
    rationale: 'Ходьба — скорость на лёгком, стабильность на тяжёлом.',
    references: ['Legg carry spatiotemporal', 'McGill QL'],
  },
  yoke_turn: {
    weakPoint: 'yoke_turn',
    label: 'Йок: разворот 180°',
    joint: 'таз',
    angleRangeDeg: [0, 180],
    keyJoint: 'таз (ротация под нагрузкой)',
    weakMuscles: ['Кор (косые)', 'Ягодицы (ротация)', 'Голеностоп'],
    biomechanicalReason: 'Turn 180° с йоком — пиковая ротационная нагрузка на поясницу при сохранении вертикали. Ошибка — широкий шаг + потеря brace.',
    corrections: ['Yoke turn дрилл 3×180° @70%', 'Тяга саней с разворотом', 'Копенгаген планка'],
    loadCues: 'Малые шаги на развороте, brace не отпускать.',
    intensityPct: 0.70,
    rationale: 'Разворот — малые шаги + brace.',
    references: ['EliteFTS yoke turn'],
  },
  farmers_pickup: {
    weakPoint: 'farmers_pickup',
    label: 'Фермер: съём',
    joint: 'таз',
    angleRangeDeg: [0, 20],
    keyJoint: 'таз (становая позиция)',
    weakMuscles: ['Хват (support)', 'Разгибатели', 'Трапеции'],
    biomechanicalReason: 'Съём фермера 120-180кг/рука — двойная становая. Хват без лямок, спина нейтраль. Пауза внизу убивает.',
    corrections: ['Становая с паузой <колена', 'Фермер пикап + удержание 10с', 'Тяга с плинтов'],
    loadCues: 'Руки-канаты, грудь вверх, без рывка.',
    intensityPct: 0.75,
    rationale: 'Пикап — становая + хват.',
    references: ['FitnessVolt farmers'],
  },
  farmers_carry: {
    weakPoint: 'farmers_carry',
    label: 'Фермер: переноска 40м',
    joint: 'плечо / торс',
    angleRangeDeg: [0, 5],
    keyJoint: 'плечевой пояс + кор (вертикаль)',
    weakMuscles: ['Трапеции', 'Кор', 'Предплечья'],
    biomechanicalReason: 'Переноска: вертикальный торс + каденс постоянный (Holmstrup 63% BW). При стронг-весах 150кг/рука — lateral bend ↑, grip — лимитер. Скорость тренируется отдельно от максимума.',
    corrections: ['Фермер 40м @70% на скорость', 'Fat Gripz фермер', 'Шраги + вис на турнике'],
    loadCues: 'Грудь вверх, шаг 60см, не наклоняться. Лёгкие недели — скорость, тяжёлые — сила.',
    intensityPct: 0.75,
    rationale: 'Скорость/хват — раздельно.',
    references: ['EliteFTS farmers grip', 'Legg farmers'],
  },
  farmers_grip: {
    weakPoint: 'farmers_grip',
    label: 'Фермер: хват (лимитер)',
    joint: 'кисть',
    angleRangeDeg: [0, 30],
    keyJoint: 'кистевой (support grip)',
    weakMuscles: ['Предплечья (флексоры)', 'Разгибатели'],
    biomechanicalReason: 'Support grip 150-180кг/рука — триада support/pinch/crush только в стронге. Предплечья +30-45% vs контроль (athleteprofile). Асимметрия — предиктор distal biceps tear.',
    corrections: ['Щипковый хват блинов (plate_pinch) 2×15', 'Вис на турнике 2×30с', 'Молоток (hammer_curl) 3×12'],
    loadCues: 'Fat Gripz, без лямок, асимметрию меряй двусторонне.',
    intensityPct: 0.60,
    rationale: 'Хват — prehab + Fat Gripz.',
    references: ['AthleteProfile grip', 'Heazlewood 2025'],
  },
  stone_off_floor: {
    weakPoint: 'stone_off_floor',
    label: 'Камень: отрыв от пола',
    joint: 'таз',
    angleRangeDeg: [0, 20],
    keyJoint: 'тазобедренный (high hips)',
    weakMuscles: ['Бицепс бедра', 'Ягодицы', 'Разгибатели', 'Бицепс (риск)'],
    biomechanicalReason: 'Отрыв сферы 120-200кг: high-hips как становая (JTS), руки-крюки, tacky обязателен. Сгибание рук → distal biceps avulsion (11% травм). Anterior load → момент L4-L5 > deadlift.',
    corrections: ['Камень с дефицита (tacky)', 'Становая + pause <колена', 'Румынская тяга'],
    loadCues: 'Таз высоко, пальцы под камень, руки прямые, tacky на предплечья.',
    intensityPct: 0.75,
    rationale: 'High hips + руки-крюки + tacky.',
    references: ['Harris 2018 stone', 'JTS stone hips', 'FitnessPainFree biceps'],
  },
  stone_lap: {
    weakPoint: 'stone_lap',
    label: 'Камень: lap 2с (на колени)',
    joint: 'колено',
    angleRangeDeg: [60, 90],
    keyJoint: 'колено + таз (lap)',
    weakMuscles: ['Квадрицепс', 'Ягодицы', 'Кор'],
    biomechanicalReason: 'Lap — камень на колени 2с перед загрузкой. Требуется эксцентрика + перехват. Пропуск lap → сгибание рук + потеря.',
    corrections: ['Камень lap 2с ×3 @70%', 'Фронтальный присед с паузой', 'Сэндбэг lap'],
    loadCues: '2с на коленях, обхват снизу, взрыв разгибанием.',
    intensityPct: 0.70,
    rationale: 'Lap — эксцентрика + пауза.',
    references: ['Harris lap', 'Forge stone'],
  },
  stone_load: {
    weakPoint: 'stone_load',
    label: 'Камень: загрузка 120-150см',
    joint: 'таз / плечо',
    angleRangeDeg: [70, 180],
    keyJoint: 'таз (разгибание) + плечо (выталкивание)',
    weakMuscles: ['Ягодицы', 'Трапеции', 'Трицепс', 'Кор'],
    biomechanicalReason: 'Загрузка на 1.2-1.5м (выше груди у 190см — ниже, у 178см — выше). Требует triple extension + толчок груди. Высокая платформа — анатомический премиум высоких.',
    corrections: ['Камень через планку 140см', 'Сэндбэг через планку', 'Толчковый жим + hip thrust'],
    loadCues: 'Взрыв бедрами, грудь к камню, не тянуть руками.',
    intensityPct: 0.70,
    rationale: 'Triple extension + платформа.',
    references: ['Forge platform height', 'AthleteProfile tall'],
  },
  grip_support: {
    weakPoint: 'grip_support',
    label: 'Хват: support/pinch/crush',
    joint: 'кисть',
    angleRangeDeg: [0, 45],
    keyJoint: 'кистевой (tri-modal)',
    weakMuscles: ['Предплечья', 'Разгибатели'],
    biomechanicalReason: 'Стронг — единственный вид с 3 паттернами хвата на max в одном старте. Support (фермер), pinch (Hercules), crush (axle). Требует отдельного теста каждого.',
    corrections: ['Pinch block', 'Axle hold', 'Captains of Crush'],
    loadCues: 'Тестируй 3 паттерна раздельно, асимметрия >12% = стоп.',
    intensityPct: 0.60,
    rationale: 'Три хвата — три теста.',
    references: ['AthleteProfile tri-modal'],
  },
  core_brace: {
    weakPoint: 'core_brace',
    label: 'Кор: brace + QL',
    joint: 'поясница',
    angleRangeDeg: [0, 10],
    keyJoint: 'поясничный (нейтраль + lateral)',
    weakMuscles: ['QL', 'Поперечная', 'Косые'],
    biomechanicalReason: 'Carry + stone: осевая 12+ сетов + 300м → компрессия. QL + suitcase carry — защита McGill. Чемодан 2×20м + side plank.',
    corrections: ['Suitcase carry 2×20м', 'Side plank 2×30с', 'Pallof press'],
    loadCues: 'Brace как перед ударом, не дышать на пикапе.',
    intensityPct: 0.60,
    rationale: 'QL — анти-lateral flex.',
    references: ['McGill QL', 'Hindle'],
  },
  conditioning: {
    weakPoint: 'conditioning',
    label: 'Кондиция: medley 30-60с',
    joint: 'сердце',
    angleRangeDeg: [0, 0],
    keyJoint: 'ССС (alactic/lactic)',
    weakMuscles: ['ССС', 'Лактат'],
    biomechanicalReason: 'Medley 30-60с → лактат >14 ммоль/л (AthleteProfile). Требуется alactic 8×10с/50с + lactic 5×60с/90с по фазе.',
    corrections: ['Prowler 10×100ft/60с', 'Tire flip EMOM', 'Sled push sprint 25м'],
    loadCues: 'Спринт, не тяжёлый толчок — скорость.',
    intensityPct: 0.60,
    rationale: 'Alactic → lactic по фазе.',
    references: ['AthleteProfile lactate', 'EliteFTS prowler'],
  },
};

export function diagnoseSMWeakPoint(wp: SMWeakPoint): SMBiomechInfo | null {
  return SM_BIOMECH[wp] ?? null;
}
export function allSMBiomech(): SMBiomechInfo[] {
  return Object.values(SM_BIOMECH);
}
export function smWeakPointsByJoint(joint: string): SMWeakPoint[] {
  const low = joint.toLowerCase();
  return (Object.values(SM_BIOMECH) as SMBiomechInfo[])
    .filter(b => b.joint.toLowerCase().includes(low) || b.keyJoint.toLowerCase().includes(low))
    .map(b => b.weakPoint);
}
export function isValidAngleForSMWeakPoint(wp: SMWeakPoint, angleDeg: number): boolean {
  const b = SM_BIOMECH[wp];
  if (!b) return false;
  const [lo, hi] = b.angleRangeDeg;
  if (lo === 0 && hi === 0) return true;
  return angleDeg >= lo && angleDeg <= hi;
}
export const SM_WEAKPOINT_LABELS: Record<SMWeakPoint, string> = Object.fromEntries(
  Object.entries(SM_BIOMECH).map(([k, v]) => [k, v.label])
) as Record<SMWeakPoint, string>;

export const SM_WEAKPOINT_CORRECTION: Record<SMWeakPoint, string[]> = Object.fromEntries(
  Object.entries(SM_BIOMECH).map(([k, v]) => [k, v.corrections])
) as Record<SMWeakPoint, string[]>;

export const SM_WEAKPOINT_BY_EVENT: Record<string, SMWeakPoint[]> = {
  log_press: ['log_dip', 'log_drive', 'log_lockout', 'log_clean'],
  axle_press: ['log_dip', 'log_drive', 'log_lockout', 'log_clean'],
  viking_press: ['log_dip', 'log_drive', 'log_lockout'],
  circus_db_press: ['log_dip', 'log_drive', 'log_lockout'],
  circus_db_medley: ['log_dip', 'log_drive', 'conditioning'],
  yoke_walk: ['yoke_pickup', 'yoke_walk', 'yoke_turn', 'core_brace'],
  farmers_walk_heavy: ['farmers_pickup', 'farmers_carry', 'farmers_grip', 'grip_support', 'core_brace'],
  frame_carry: ['yoke_walk', 'farmers_carry', 'core_brace'],
  husafell_carry: ['yoke_walk', 'farmers_carry', 'core_brace'],
  conan_wheel: ['yoke_walk', 'core_brace', 'conditioning'],
  shield_carry: ['yoke_walk', 'core_brace'],
  duck_walk: ['yoke_pickup', 'core_brace'],
  zercher_carry: ['farmers_carry', 'core_brace'],
  sandbag_carry: ['farmers_carry', 'core_brace'],
  truck_pull: ['yoke_walk', 'core_brace', 'conditioning'],
  arm_over_arm: ['farmers_grip', 'core_brace', 'conditioning'],
  atlas_stone_load: ['stone_off_floor', 'stone_lap', 'stone_load', 'core_brace'],
  atlas_stone_over_bar: ['stone_off_floor', 'stone_lap', 'stone_load'],
  natural_stone_shoulder: ['stone_off_floor', 'stone_lap', 'stone_load'],
  stone_lift: ['stone_off_floor', 'stone_lap', 'stone_load'],
  sandbag_load: ['stone_off_floor', 'stone_lap', 'stone_load'],
  sandbag_over_bar: ['stone_off_floor', 'stone_load'],
  sandbag_shoulder: ['stone_off_floor', 'stone_lap'],
  sandbag_toss: ['stone_load', 'conditioning'],
  keg_toss: ['stone_load', 'conditioning'],
  keg_over_bar: ['stone_load'],
  keg_load: ['stone_off_floor', 'stone_load'],
  tire_flip: ['stone_off_floor', 'core_brace', 'conditioning'],
  sled_push_sprint: ['farmers_carry', 'conditioning'],
  sled_drag: ['farmers_carry', 'conditioning'],
  sled_push: ['farmers_carry', 'conditioning'],
  axle_deadlift: ['stone_off_floor', 'farmers_grip'],
  car_deadlift_18: ['stone_off_floor', 'core_brace'],
  car_deadlift_side: ['stone_off_floor', 'core_brace'],
  deadlift_max: ['stone_off_floor', 'core_brace'],
  conditioning: ['conditioning'],
  grip: ['grip_support', 'farmers_grip', 'core_brace'],
  core: ['core_brace'],
};

export function getSMWeakPointsForEvent(eventId: string): SMWeakPoint[] {
  return SM_WEAKPOINT_BY_EVENT[eventId] || [];
}

export function isValidSMWeakPoint(v: string): v is SMWeakPoint {
  return (Object.keys(SM_BIOMECH) as string[]).includes(v);
}
export function normalizeSMWeakPoints(input: string[]): SMWeakPoint[] {
  return input.map(s=> String(s).trim()).filter(isValidSMWeakPoint).slice(0,4) as SMWeakPoint[];
}

/** Нормы лога-дипа (SM PRO): глубина 8-12см, время дипа ~0.20с (Zhang jerk-dip). */
export const SM_LOG_DIP_NORMS = { depthMinCm: 8, depthMaxCm: 12, dipTimeS: 0.2 };

export interface SMLogDipResult {
  depthCm: number;
  dipTimeS: number | null;
  drivePowerW: number | null;
  verdict: 'ok' | 'warn' | 'critical';
  text: string;
}

/**
 * Диагностика дипа лога по глубине + времени (Renals braking/propulsion:
 * глубокий/медленный дип теряет упругость и уводит лог вперёд).
 */
export function diagnoseLogDip(depthCm: number, dipTimeS?: number | null, bodyweightKg?: number | null, logKg?: number | null): SMLogDipResult | null {
  if (!Number.isFinite(depthCm) || depthCm <= 0) return null;
  const t = dipTimeS != null && Number.isFinite(dipTimeS) && dipTimeS > 0 ? dipTimeS : null;
  let drivePowerW: number | null = null;
  if (t != null && bodyweightKg != null && logKg != null && bodyweightKg > 0 && logKg > 0) {
    // Грубая оценка мощности драйва: m*g*h/t (h = глубина дипа)
    const m = bodyweightKg * 0.7 + logKg;
    drivePowerW = Math.round((m * 9.81 * (depthCm / 100)) / t);
  }
  let verdict: SMLogDipResult['verdict'] = 'ok';
  if (depthCm < SM_LOG_DIP_NORMS.depthMinCm || depthCm > SM_LOG_DIP_NORMS.depthMaxCm) verdict = 'warn';
  if (depthCm < 5 || depthCm >= 16) verdict = 'critical';
  if (t != null && t > 0.35) verdict = verdict === 'ok' ? 'warn' : verdict;
  const text =
    verdict === 'ok'
      ? `Дип ${depthCm}см в норме 8-12см${t != null ? `, время ${t}с (≈0.20с)` : ''} — пружина жёсткая`
      : `Дип ${depthCm}см вне 8-12см${t != null ? `, время ${t}с (норма ~0.20с)` : ''} — пауза-дип 2с + фронт-присед`;
  return { depthCm, dipTimeS: t, drivePowerW, verdict, text };
}
