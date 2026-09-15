/**
 * armlift-failure-modes.engine.ts — точки срыва и фолы техники per-implement (PRO-5 D1).
 * Статика из правил IronMind / Armlifting USA 2026 (см. docs/ARMLIFTING-DIAGNOSTICS-PRO-5.md).
 * Никаких новых нормативов в кг — только проверяемые процедуры и кью.
 * Чистые функции, без стораджа.
 */

export type ArmliftDiagImplement =
  | 'rolling_thunder'
  | 'apollon_axle'
  | 'saxon_bar'
  | 'hub'
  | 'pinch_block'
  | 'coc_gripper'
  | 'silver_bullet'
  | 'excalibur'
  | 'raptor_175'
  | 'country_crush'
  | 'grandfather_clock'
  | 'anvil'
  | 'saxon_medley'
  | 'fat_gripz';

export interface ArmliftFailurePoint {
  id: string;
  label: string;
  hint: string;
}

export interface ArmliftFault {
  id: string;
  label: string;
  cue: string;
  rule: string;
}

const FAIL_OFF_FLOOR: ArmliftFailurePoint = { id: 'off_floor', label: 'Срыв с пола', hint: 'Не оторвал / оторвал и сразу выронив' };
const FAIL_MID: ArmliftFailurePoint = { id: 'mid', label: 'Середина (протяжка)', hint: 'Пошло, но скользит / раскрывается по пути' };
const FAIL_LOCKOUT: ArmliftFailurePoint = { id: 'lockout', label: 'Локаут 1 с', hint: 'Дотянул, но не удержал стойку 1 с / нет down-сигнала' };
const FAIL_HOLD_SHORT: ArmliftFailurePoint = { id: 'hold_short', label: 'Холд 0–3 с', hint: 'Падает сразу — пиковая сила' };
const FAIL_HOLD_LONG: ArmliftFailurePoint = { id: 'hold_long', label: 'Холд 3–10+ с', hint: 'Держит, но плывёт — выносливость' };
const FAIL_CLOSE: ArmliftFailurePoint = { id: 'close_fail', label: 'Не закрыл', hint: 'Гриппер не сошёлся / Silver не удержан' };

const F_CENTER: ArmliftFault = { id: 'not_center', label: 'Хват не по центру', cue: 'Бери строго центр ручки/блока', rule: 'IronMind: хват примерно по центру' };
const F_PARALLEL: ArmliftFault = { id: 'not_parallel', label: 'Снаряд не параллелен земле', cue: 'Держи плоскость — перекос открывает пальцы', rule: 'IronMind: ~параллельно земле' };
const F_WIPE: ArmliftFault = { id: 'no_wipe', label: 'Без протирки / жидкий мел', cue: 'Протри снаряд, только обычный мел', rule: 'IronMind: протирка + только магнезия' };
const F_CALIB: ArmliftFault = { id: 'uncalib', label: 'Некалиброванные диски', cue: 'Взвесь диски на проверенных весах', rule: 'AUSA: калиброванные или взвешенные' };
const F_BODY: ArmliftFault = { id: 'body_drag', label: 'Протяжка по ноге / касание тела', cue: 'Веди без опоры о бедро, стойка прямо', rule: 'IronMind: dragging = no lift' };
const F_THUMBLESS: ArmliftFault = { id: 'thumbless', label: 'Бесключевой/thumbless/hook', cue: 'Полный замок большим — thumbless запрещён', rule: 'IronMind: thumbless запрещён' };
const F_WRIST: ArmliftFault = { id: 'wrist_break', label: 'Запястье ломается', cue: 'Нейтраль запястья, кулак — продолжение предплечья', rule: 'SBS 2024: сгиб запястья укорачивает FDP/FDS' };
const F_BREATH: ArmliftFault = { id: 'rush', label: 'Спешка (нет 60-сек тактики)', cue: 'Одна чистая попытка в минуту, не дерись с весом', rule: 'AUSA 2026: 60 сек, промах = выбыл' };

export const ARMLIFT_FAILURES: Record<ArmliftDiagImplement, ArmliftFailurePoint[]> = {
  rolling_thunder: [FAIL_OFF_FLOOR, FAIL_MID, FAIL_LOCKOUT],
  apollon_axle: [FAIL_OFF_FLOOR, FAIL_MID, FAIL_LOCKOUT],
  saxon_bar: [FAIL_OFF_FLOOR, FAIL_MID, FAIL_LOCKOUT],
  hub: [FAIL_OFF_FLOOR, FAIL_HOLD_SHORT, FAIL_LOCKOUT],
  pinch_block: [FAIL_OFF_FLOOR, FAIL_HOLD_SHORT, FAIL_HOLD_LONG],
  coc_gripper: [FAIL_CLOSE, FAIL_HOLD_SHORT],
  silver_bullet: [FAIL_HOLD_SHORT, FAIL_HOLD_LONG],
  excalibur: [FAIL_OFF_FLOOR, FAIL_MID, FAIL_LOCKOUT],
  raptor_175: [FAIL_OFF_FLOOR, FAIL_MID, FAIL_LOCKOUT],
  country_crush: [FAIL_OFF_FLOOR, FAIL_MID, FAIL_LOCKOUT],
  grandfather_clock: [FAIL_OFF_FLOOR, FAIL_HOLD_SHORT, FAIL_LOCKOUT],
  anvil: [FAIL_OFF_FLOOR, FAIL_HOLD_SHORT, FAIL_LOCKOUT],
  saxon_medley: [FAIL_MID, FAIL_HOLD_LONG, FAIL_LOCKOUT],
  fat_gripz: [FAIL_MID, FAIL_HOLD_LONG, FAIL_LOCKOUT],
};

export const ARMLIFT_FAULTS: Record<ArmliftDiagImplement, ArmliftFault[]> = {
  rolling_thunder: [
    F_CENTER, F_THUMBLESS, F_PARALLEL, F_WIPE, F_CALIB, F_BODY, F_BREATH,
    { id: 'touch_frame', label: 'Касание невращающейся части', cue: 'Только вращающаяся ручка в ладони', rule: 'IronMind RT: касание рамки = no lift' },
  ],
  apollon_axle: [
    { id: 'not_doh', label: 'Не DOH / разнохват', cue: 'Двойной пронированный, костяшки вперёд', rule: 'IronMind Axle: только DOH' },
    F_THUMBLESS, F_WIPE, F_CALIB, F_BODY, F_BREATH,
    { id: 'hip_shelf', label: 'Полка на бёдра / движение вниз', cue: 'Тяни в одно движение, без полки', rule: 'Axle IPF-правила: полка/вниз = нет' },
  ],
  saxon_bar: [
    { id: 'thumb_weak', label: 'Большой пассивен', cue: 'Дави большим в плоскость, не пальцами', rule: 'NSCA: pinch = fingers-to-thumb, большой решает' },
    F_WRIST, F_WIPE, F_BODY, F_BREATH,
  ],
  hub: [
    { id: 'no_fingertips', label: 'Не все 5 подушечек на базе', cue: 'Старт: 5 подушечек касаются плиты', rule: 'IronMind Hub: 5 fingertips + no doorknob' },
    { id: 'doorknob', label: 'Хват «дверной ручкой»', cue: 'Щипок сверху, не обхват', rule: 'IronMind Hub: doorknob запрещён' },
    F_PARALLEL, F_WIPE, F_BODY, F_BREATH,
  ],
  pinch_block: [
    F_CENTER, F_THUMBLESS, F_PARALLEL, F_WIPE, F_BODY, F_BREATH,
  ],
  coc_gripper: [
    { id: 'bad_set', label: 'Глубокий/кривой сет', cue: 'Сет не глубже кромки, 4 пальца на ручке', rule: 'Silver/CoC: пуговица не глубже кромки' },
    { id: 'off_vertical', label: 'Гриппер не вертикально', cue: 'Держи вертикаль, мизинец не трогает пулю', rule: 'Silver: касание мизинцем = стоп' },
    { id: 'old_gripper', label: 'Притёртый/чужой гриппер', cue: 'Тест на новом из пакета', rule: 'Silver: гриппер новый из пакета' },
  ],
  silver_bullet: [
    { id: 'bad_set', label: 'Глубокий/кривой сет', cue: 'Сет не глубже кромки, 4 пальца на ручке', rule: 'Silver/CoC: пуговица не глубже кромки' },
    { id: 'off_vertical', label: 'Гриппер не вертикально', cue: 'Держи вертикаль, мизинец не трогает пулю', rule: 'Silver: касание мизинцем = стоп' },
    F_BREATH,
  ],
  excalibur: [F_CENTER, F_WIPE, F_CALIB, F_BODY, F_BREATH],
  raptor_175: [F_CENTER, F_THUMBLESS, F_WIPE, F_BODY, F_BREATH, F_WRIST],
  country_crush: [F_CENTER, F_WIPE, F_BODY, F_BREATH, F_WRIST],
  grandfather_clock: [F_CENTER, F_WIPE, F_BODY, F_BREATH, F_WRIST],
  anvil: [F_CENTER, F_WIPE, F_BODY, F_BREATH, F_WRIST],
  saxon_medley: [F_WRIST, F_WIPE, F_BODY, F_BREATH, { id: 'no_rotate', label: 'Нет ротации support→pinch', cue: 'Чередуй толстый гриф и щипок по неделям', rule: 'Практика AUSA: support/pinch/crush ротация' }],
  fat_gripz: [F_WRIST, F_BREATH, { id: 'straps', label: 'Лямки на толстом грифе', cue: 'DOH без лямок — иначе хват не работает', rule: 'AUSA Beginners: Fat Gripz DOH без лямок' }],
};

export function failuresFor(implement: string): ArmliftFailurePoint[] {
  return ARMLIFT_FAILURES[implement as ArmliftDiagImplement] || [FAIL_OFF_FLOOR, FAIL_MID, FAIL_LOCKOUT];
}

export function faultsFor(implement: string): ArmliftFault[] {
  return ARMLIFT_FAULTS[implement as ArmliftDiagImplement] || [F_CENTER, F_WIPE, F_BODY, F_BREATH];
}

/**
 * D8: карта движения — фазы per-implement (PRO-5, real).
 * Каждая фаза: что правильно (good) + какие фолы её ломают (только id из faultsFor!).
 * id фазы 'setup' — подготовка (не срыв), остальные = id точек срыва.
 */
export interface ArmliftMovePhase {
  id: string;
  label: string;
  good: string;
  faultIds: string[];
}

const SETUP: Omit<ArmliftMovePhase, 'faultIds'> = { id: 'setup', label: 'Подход', good: 'Центр, мел, спокойная минута' };

export const ARMLIFT_MOVEMENT: Record<ArmliftDiagImplement, ArmliftMovePhase[]> = {
  rolling_thunder: [
    { ...SETUP, faultIds: ['not_center', 'no_wipe', 'uncalib', 'rush'] },
    { id: 'off_floor', label: 'Отрыв', good: 'Полный замок большим, ручка параллельна', faultIds: ['thumbless', 'not_parallel'] },
    { id: 'mid', label: 'Протяжка', good: 'Ручка крутится свободно, без опоры о бедро', faultIds: ['touch_frame', 'body_drag'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'В рост, плоскость держится, down-сигнал', faultIds: ['not_parallel', 'body_drag'] },
  ],
  apollon_axle: [
    { ...SETUP, faultIds: ['no_wipe', 'uncalib', 'rush'] },
    { id: 'off_floor', label: 'Отрыв', good: 'DOH, костяшки вперёд, полный замок', faultIds: ['not_doh', 'thumbless'] },
    { id: 'mid', label: 'Тяга', good: 'Одним движением, без полки на бёдра', faultIds: ['hip_shelf', 'body_drag'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'В рост, без движения вниз', faultIds: ['hip_shelf', 'body_drag'] },
  ],
  saxon_bar: [
    { ...SETUP, faultIds: ['no_wipe', 'rush'] },
    { id: 'off_floor', label: 'Отрыв', good: 'Большой давит в плоскость', faultIds: ['thumb_weak', 'wrist_break'] },
    { id: 'mid', label: 'Тяга', good: 'Запястье нейтрально до верха', faultIds: ['thumb_weak', 'wrist_break'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'Плоскость не раскрылась', faultIds: ['body_drag', 'wrist_break'] },
  ],
  hub: [
    { ...SETUP, faultIds: ['no_fingertips', 'doorknob', 'no_wipe'] },
    { id: 'off_floor', label: 'Подъём', good: 'Щипок сверху, 5 подушечек на базе', faultIds: ['doorknob'] },
    { id: 'hold_short', label: 'Удержание', good: 'Хаб параллелен земле', faultIds: ['no_fingertips', 'not_parallel'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'Без протяжки по ноге', faultIds: ['not_parallel', 'body_drag'] },
  ],
  pinch_block: [
    { ...SETUP, faultIds: ['not_center', 'no_wipe'] },
    { id: 'off_floor', label: 'Отрыв', good: 'Центр блока, полный замок', faultIds: ['thumbless'] },
    { id: 'hold_short', label: 'Холд 0–3с', good: 'Блок параллелен земле', faultIds: ['thumbless', 'not_parallel'] },
    { id: 'hold_long', label: 'Холд 3с+', good: 'Дыхание ровное, без опоры о тело', faultIds: ['not_parallel', 'body_drag'] },
  ],
  coc_gripper: [
    { ...SETUP, faultIds: ['bad_set', 'old_gripper'] },
    { id: 'close_fail', label: 'Закрытие', good: 'Сет не глубже кромки, дожим', faultIds: ['bad_set'] },
    { id: 'hold_short', label: 'Дожим', good: 'Вертикаль, мизинец не касается', faultIds: ['off_vertical'] },
  ],
  silver_bullet: [
    { ...SETUP, faultIds: ['bad_set'] },
    { id: 'hold_short', label: 'Старт холда', good: 'Вертикаль, 4 пальца на ручке', faultIds: ['off_vertical', 'bad_set'] },
    { id: 'hold_long', label: 'Холд на время', good: 'Без спешки, патрон не плывёт', faultIds: ['off_vertical', 'rush'] },
  ],
  excalibur: [
    { ...SETUP, faultIds: ['not_center', 'no_wipe', 'uncalib'] },
    { id: 'off_floor', label: 'Отрыв', good: 'Центр ручки 50мм', faultIds: ['not_center'] },
    { id: 'mid', label: 'Тяга', good: 'Без опоры о бедро', faultIds: ['body_drag'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'Контроль до пола', faultIds: ['body_drag'] },
  ],
  raptor_175: [
    { ...SETUP, faultIds: ['not_center', 'no_wipe', 'rush'] },
    { id: 'off_floor', label: 'Отрыв', good: 'Полный замок, запястье нейтрально', faultIds: ['thumbless', 'wrist_break'] },
    { id: 'mid', label: 'Тяга', good: 'Кулак — продолжение предплечья', faultIds: ['wrist_break', 'body_drag'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'Без протяжки', faultIds: ['body_drag'] },
  ],
  country_crush: [
    { ...SETUP, faultIds: ['not_center', 'no_wipe'] },
    { id: 'off_floor', label: 'Отрыв', good: 'Щипок 2″ блока двумя руками', faultIds: [] },
    { id: 'mid', label: 'Тяга', good: 'Запястье не ломается', faultIds: ['wrist_break'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'Без опоры о бедро', faultIds: ['body_drag'] },
  ],
  grandfather_clock: [
    { ...SETUP, faultIds: ['not_center', 'no_wipe'] },
    { id: 'off_floor', label: 'Отрыв', good: 'Вертикальная труба, DOH', faultIds: ['wrist_break'] },
    { id: 'hold_short', label: 'Удержание', good: 'Труба не кренится', faultIds: ['wrist_break'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'Без протяжки', faultIds: ['body_drag'] },
  ],
  anvil: [
    { ...SETUP, faultIds: ['not_center', 'no_wipe'] },
    { id: 'off_floor', label: 'Отрыв', good: 'Щипок наковальни', faultIds: ['wrist_break'] },
    { id: 'hold_short', label: 'Удержание', good: 'Нейтраль запястья', faultIds: ['wrist_break'] },
    { id: 'lockout', label: 'Стойка 1с', good: 'Без опоры о тело', faultIds: ['body_drag'] },
  ],
  saxon_medley: [
    { ...SETUP, faultIds: ['no_wipe', 'no_rotate'] },
    { id: 'mid', label: 'Серия', good: 'Ротация support→pinch по событиям', faultIds: ['no_rotate', 'wrist_break'] },
    { id: 'hold_long', label: 'Длинная серия', good: 'Темп ровный, без спешки', faultIds: ['wrist_break', 'rush'] },
    { id: 'lockout', label: 'Финиш', good: 'Каждое событие со стойкой', faultIds: ['body_drag'] },
  ],
  fat_gripz: [
    { ...SETUP, faultIds: ['straps'] },
    { id: 'mid', label: 'Движение', good: 'DOH без лямок', faultIds: ['straps', 'wrist_break'] },
    { id: 'hold_long', label: 'Под нагрузкой', good: 'Запястье нейтрально', faultIds: ['wrist_break'] },
    { id: 'lockout', label: 'Финиш', good: 'Без спешки', faultIds: ['rush'] },
  ],
};

export function movementFor(implement: string): ArmliftMovePhase[] {
  return ARMLIFT_MOVEMENT[implement as ArmliftDiagImplement] || ARMLIFT_MOVEMENT.rolling_thunder;
}

/**
 * D15: слабейший снаряд вердикта → снаряд диагностики.
 * L/R-суффиксы режем (рука — в асимметрии, не в снаряде); чужое — null.
 */
export function diagImplementForReportWeakest(weakest: string | null): ArmliftDiagImplement | null {
  if (!weakest) return null;
  const base = String(weakest).replace(/_[LR]$/, '') as ArmliftDiagImplement;
  return (ARMLIFT_MOVEMENT[base] ? base : null);
}

export const ARMLIFT_DIAG_IMPLEMENT_OPTS: Array<{ id: ArmliftDiagImplement; label: string }> = [
  { id: 'rolling_thunder', label: 'RT' },
  { id: 'apollon_axle', label: 'Axle' },
  { id: 'saxon_bar', label: 'Saxon' },
  { id: 'hub', label: 'Hub' },
  { id: 'pinch_block', label: 'Pinch' },
  { id: 'coc_gripper', label: 'CoC' },
  { id: 'silver_bullet', label: 'Silver' },
  { id: 'excalibur', label: 'Excal' },
  { id: 'raptor_175', label: 'Raptor' },
  { id: 'country_crush', label: 'Crush' },
  { id: 'grandfather_clock', label: 'Clock' },
  { id: 'anvil', label: 'Anvil' },
  { id: 'saxon_medley', label: 'Medley' },
  { id: 'fat_gripz', label: 'FatGripz' },
];
