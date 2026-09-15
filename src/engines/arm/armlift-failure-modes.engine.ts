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
