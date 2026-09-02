/**
 * strength-sport-pool.engine.ts — пулы и фильтрация для ТА/стронга (вынос из builder)
 * Содержит POOL_BY_TAG, OLY/STRONG sets, STRONG_FALLBACK BFS, filterPool, gentleFactor, basePmFor, getExerciseMeta
 * Изолировано — не трогает BB/LMS
 */
import { filterByTier, filterByInjury } from './strength-sport-selection';
import { filterByMobility, isAxialLoadExerciseSS } from './strength-sport-mobility';
import { getExerciseById } from '../../core/exercise-catalog';
import type { StrengthSportInput } from './strength-sport.types';

export const POOL_BY_TAG: Record<string, string[]> = {
  snatch_day: ['snatch', 'hang_snatch', 'power_snatch', 'muscle_snatch', 'high_hang_snatch', 'deficit_snatch', 'block_snatch', 'pause_snatch', 'snatch_pull', 'pause_pull', 'overhead_squat_v2', 'snatch_balance', 'back_squat', 'front_squat'],
  clean_day: ['clean_and_jerk', 'hang_clean', 'power_clean', 'muscle_clean', 'deficit_clean', 'block_clean', 'low_block_clean', 'pause_clean', 'push_jerk', 'split_jerk', 'pause_jerk', 'push_press', 'jerk_recovery', 'behind_neck_jerk', 'front_squat_clean_grip', 'front_squat'],
  strength_day: ['squat', 'front_squat', 'back_squat', 'pause_squat', 'tempo_squat', 'deadlift', 'sumo_dl', 'rdl', 'bench_bar', 'db_press', 'ohp', 'pin_press'],
  technique_day: ['hang_snatch', 'hang_clean', 'high_hang_snatch', 'muscle_snatch', 'muscle_clean', 'snatch_balance', 'jerk_dip', 'overhead_squat_v2', 'pause_snatch', 'pause_clean', 'pause_jerk'],
  pull_day: ['snatch_pull', 'clean_pull', 'pause_pull', 'deficit_pull', 'rdl', 'deadlift', 'row_bar', 'pullup'],
  accessory_day: ['db_press', 'ohp', 'lateral_raise', 'face_pull', 'row_db', 'hip_thrust', 'pause_squat', 'tempo_squat'],
  overhead_day: ['log_press', 'axle_press', 'circus_db_press', 'circus_db_medley', 'viking_press', 'ohp', 'push_press', 'db_press', 'push_jerk', 'pause_jerk', 'jerk_recovery', 'behind_neck_jerk', 'pin_press'],
  deadlift_day: ['deadlift', 'sumo_dl', 'axle_deadlift', 'car_deadlift_18', 'car_deadlift_side', 'deadlift_max', 'rdl', 'deficit_pull', 'farmers_walk_heavy', 'yoke_walk', 'frame_carry', 'conan_wheel'],
  squat_day: ['squat', 'front_squat', 'pause_squat', 'tempo_squat', 'hack_squat', 'leg_press', 'bulgarian_split', 'calf_raise', 'overhead_squat_v2', 'duck_walk'],
  event_day: ['farmers_walk_heavy', 'yoke_walk', 'frame_carry', 'husafell_carry', 'conan_wheel', 'shield_carry', 'duck_walk', 'atlas_stone_load', 'atlas_stone_over_bar', 'natural_stone_shoulder', 'sandbag_load', 'sandbag_over_bar', 'sandbag_shoulder', 'keg_toss', 'keg_over_bar', 'zercher_carry', 'tire_flip', 'sled_push_sprint', 'truck_pull', 'arm_over_arm', 'car_deadlift_18', 'car_deadlift_side', 'axle_press', 'viking_press', 'circus_db_medley'],
  oly_day: ['snatch', 'clean_and_jerk', 'high_hang_snatch', 'snatch_pull', 'clean_pull', 'front_squat', 'pause_snatch', 'pause_clean', 'pause_jerk'],
};

export const OLY_IDS = new Set(['snatch','hang_snatch','power_snatch','high_hang_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','low_block_clean','pause_clean','push_jerk','split_jerk','pause_jerk','snatch_pull','clean_pull','pause_pull','deficit_pull','snatch_balance','overhead_squat_v2','jerk_dip','jerk_recovery','behind_neck_jerk','pause_squat','tempo_squat']);
export const STRONG_IDS = new Set(['log_press','axle_press','viking_press','yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','conan_wheel','shield_carry','duck_walk','atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','sandbag_load','sandbag_over_bar','sandbag_shoulder','keg_toss','keg_over_bar','keg_load','axle_deadlift','car_deadlift_18','car_deadlift_side','deadlift_max','circus_db_press','circus_db_medley','tire_flip','stone_lift','zercher_carry','sled_push_sprint','sandbag_carry','truck_pull','arm_over_arm']);

export function isOly(id: string): boolean { return OLY_IDS.has(id); }
export function isStrong(id: string): boolean { return STRONG_IDS.has(id); }

export const STRONG_FALLBACK: Record<string,string> = {
  log_press:'push_press', axle_press:'push_press', viking_press:'push_press', yoke_walk:'farmers_walk_heavy', frame_carry:'farmers_walk_heavy', husafell_carry:'sandbag_carry', conan_wheel:'sandbag_carry', shield_carry:'sandbag_carry', duck_walk:'farmers_walk_heavy', truck_pull:'sled_drag', arm_over_arm:'sled_drag', farmers_walk_heavy:'deadlift', atlas_stone_load:'sandbag_load', atlas_stone_over_bar:'sandbag_load', natural_stone_shoulder:'sandbag_shoulder', sandbag_load:'deadlift', sandbag_over_bar:'sandbag_load', sandbag_shoulder:'rdl', keg_toss:'sandbag_shoulder', keg_over_bar:'sandbag_shoulder', keg_load:'sandbag_shoulder', axle_deadlift:'deadlift', car_deadlift_18:'deadlift', car_deadlift_side:'deadlift', deadlift_max:'deadlift', circus_db_press:'db_press', circus_db_medley:'db_press', tire_flip:'deadlift', zercher_carry:'farmers_walk_heavy', sandbag_carry:'farmers_walk_heavy', sled_drag:'farmers_walk_heavy', sled_push:'farmers_walk_heavy'
};

export function filterPool(ids: string[], input: StrengthSportInput): string[] {
  let out = [...ids];
  if (input.excludedExercises?.length) {
    const excl = new Set(input.excludedExercises.map(s => s.toLowerCase()));
    out = out.filter(id => !excl.has(id.toLowerCase()));
  }
  const eq = (input.equipment || []).map(s => String(s).toLowerCase());
  const hasOther = eq.includes('other') || eq.includes('specialty') || eq.length === 0;
  const beforeTier = [...out];
  out = filterByTier(out, input.level, input.allowExotic, hasOther);
  if (!hasOther) {
    const strongSet = new Set(Object.keys(STRONG_FALLBACK));
    const isCarryOrig = (id:string) => ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','zercher_carry','sandbag_carry','sled_push_sprint','conan_wheel','shield_carry','duck_walk','truck_pull','arm_over_arm','sled_drag','sled_push'].includes(id);
    const resolveFallback = (id: string, visited = new Set<string>()): string | null => {
      if (isCarryOrig(id)) return 'farmers_walk_heavy';
      let cur = STRONG_FALLBACK[id];
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        if (!strongSet.has(cur)) return cur;
        if (isCarryOrig(cur)) return 'farmers_walk_heavy';
        const nxt = STRONG_FALLBACK[cur];
        if (nxt && !visited.has(nxt)) cur = nxt; else return cur;
      }
      return cur || null;
    };
    const hadCarryBefore = beforeTier.some(isCarryOrig);
    for (const orig of beforeTier) if (!out.includes(orig)) {
      const fb = resolveFallback(orig);
      if (fb && !out.includes(fb)) out.push(fb);
    }
    if (hadCarryBefore && !out.some(isCarryOrig)) {
      if (!out.includes('farmers_walk_heavy')) out.push('farmers_walk_heavy');
    }
    if (out.length===0) out = ['back_squat','deadlift','ohp'].slice(0,3);
  }
  const beforeInjury = [...out];
  out = filterByInjury(out, input.injuries as any);
  if (out.length===0 && (input.injuries||[]).length>0) out = beforeInjury.slice(0,2);
  const mob = (input as any).mobilityRestrictions as string[] | undefined;
  out = filterByMobility(out, mob);
  if (out.length===0 && mob && mob.length>0) out = beforeInjury.slice(0,2);
  if ((input as any).avoidAxialLoad) {
    const beforeAxial = [...out];
    out = out.filter(id => !isAxialLoadExerciseSS(id));
    if (out.length === 0 && beforeAxial.length) out = beforeAxial.slice(0,2);
  }
  return out;
}

export function gentleFactor(id: string, injuries: any[]|undefined): number {
  if (!injuries||injuries.length===0) return 1;
  const txt = JSON.stringify(injuries).toLowerCase();
  const knee = txt.includes('knee')||txt.includes('колен');
  const back = txt.includes('back')||txt.includes('спин')||txt.includes('поясн');
  const shoulder = txt.includes('shoulder')||txt.includes('плеч');
  const wrist = txt.includes('wrist')||txt.includes('запяст');
  if (knee && ['back_squat','front_squat','hack_squat','bulgarian_split','squat','overhead_squat_v2','snatch_balance','car_deadlift_18','car_deadlift_side','conan_wheel','shield_carry','duck_walk','truck_pull'].includes(id)) return 0.6;
  if (back && ['deadlift','sumo_dl','axle_deadlift','car_deadlift_18','car_deadlift_side','deadlift_max','yoke_walk','frame_carry','husafell_carry','conan_wheel','shield_carry','truck_pull','arm_over_arm','atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','sandbag_load','sandbag_over_bar','sandbag_shoulder','keg_toss','keg_over_bar','snatch_pull','clean_pull'].includes(id)) return 0.6;
  if (shoulder && ['snatch','log_press','axle_press','viking_press','push_jerk','split_jerk','overhead_squat_v2','ohp','push_press','circus_db_press','circus_db_medley','keg_toss','conan_wheel'].includes(id)) return 0.65;
  if (wrist && ['clean_and_jerk','front_squat_clean_grip','hang_clean','truck_pull','arm_over_arm'].includes(id)) return 0.7;
  return 1;
}

export function basePmFor(id: string, wm: StrengthSportInput['workMax']): number {
  if (['snatch_pull','pause_pull','deficit_pull','clean_pull'].includes(id)) return wm.deadlift || 120;
  if (id.includes('pull') && (id.includes('snatch') || id.includes('clean') || id.includes('deficit') || id.includes('pause'))) return wm.deadlift || 120;
  if (['snatch','hang_snatch','power_snatch','high_hang_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','snatch_balance','overhead_squat_v2'].includes(id) || id.includes('snatch')) return wm.snatch || 60;
  if (['clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','low_block_clean','pause_clean','push_jerk','split_jerk','pause_jerk','front_squat_clean_grip','jerk_dip','jerk_recovery','behind_neck_jerk'].includes(id) || id.includes('clean') || id.includes('jerk')) return wm.cleanJerk || wm.clean || wm.frontSquat || 80;
  if (['squat','back_squat','front_squat','hack_squat','front_squat_clean_grip','pause_squat','tempo_squat','overhead_squat_v2'].includes(id) || id.includes('squat')) return wm.backSquat || wm.frontSquat || 100;
  if (['deadlift','sumo_dl','axle_deadlift','rdl','deficit_pull','pause_pull'].includes(id) || id.includes('deadlift')) return wm.deadlift || 120;
  if (id === 'yoke_walk') return (wm as any).yokeWalk || wm.deadlift || 180;
  if (id === 'farmers_walk_heavy' || id === 'zercher_carry' || id === 'frame_carry' || id === 'husafell_carry' || id === 'sandbag_carry' || id === 'conan_wheel' || id === 'shield_carry' || id === 'duck_walk') return (wm as any).farmersWalk || (wm as any).frameCarry || wm.deadlift || 140;
  if (id === 'atlas_stone_load' || id === 'atlas_stone_over_bar' || id === 'natural_stone_shoulder' || id === 'stone_lift' || id === 'sandbag_shoulder' || id === 'sandbag_load' || id === 'sandbag_over_bar' || id === 'keg_over_bar' || id === 'keg_load') return (wm as any).atlasStone || (wm as any).sandbagLoad || wm.deadlift || 100;
  if (id === 'axle_deadlift' || id === 'car_deadlift_18' || id === 'car_deadlift_side' || id === 'deadlift_max') return (wm as any).axleDeadlift || (wm as any).carDeadlift || wm.deadlift || 120;
  if (id === 'keg_toss' || id === 'sandbag_toss') return (wm as any).kegToss || (wm as any).atlasStone || 80;
  if (id === 'axle_press') return (wm as any).axlePress || wm.logPress || wm.overheadPress || 60;
  if (id === 'circus_db_press' || id === 'circus_db_medley') return (wm as any).circusDbPress || wm.logPress || wm.overheadPress || 60;
  if (id === 'viking_press') return (wm as any).axlePress || wm.logPress || wm.overheadPress || 60;
  if (id === 'truck_pull' || id === 'arm_over_arm') return wm.deadlift || 140;
  if (['ohp','push_press','log_press','circus_db_press','bench_bar','pin_press','jerk_recovery','behind_neck_jerk','pause_jerk'].includes(id) || id.includes('press') || id.includes('jerk')) return wm.overheadPress || wm.bench || wm.logPress || 60;
  return wm.backSquat || 80;
}

export const SS_EX_META: Record<string, { name: string; group: string; pattern: string }> = {
  snatch: { name: 'Рывок классический', group: 'legs', pattern: 'hinge' },
  hang_snatch: { name: 'Рывок с виса', group: 'legs', pattern: 'hinge' },
  power_snatch: { name: 'Рывок силовой', group: 'legs', pattern: 'hinge' },
  muscle_snatch: { name: 'Масл-рывок', group: 'shoulders', pattern: 'vertical_push' },
  snatch_pull: { name: 'Рывковая тяга', group: 'back', pattern: 'hinge' },
  snatch_balance: { name: 'Рывковый баланс', group: 'legs', pattern: 'squat' },
  overhead_squat_v2: { name: 'Присед оверхед', group: 'legs', pattern: 'squat' },
  back_squat: { name: 'Присед со штангой', group: 'legs', pattern: 'squat' },
  front_squat: { name: 'Фронтальный присед', group: 'legs', pattern: 'squat' },
  front_squat_clean_grip: { name: 'Фронт-присед чистый хват', group: 'legs', pattern: 'squat' },
  clean_and_jerk: { name: 'Толчок классический', group: 'legs', pattern: 'hinge' },
  hang_clean: { name: 'Взятие с виса', group: 'legs', pattern: 'hinge' },
  power_clean: { name: 'Взятие силовое', group: 'legs', pattern: 'hinge' },
  muscle_clean: { name: 'Масл-взятие', group: 'back', pattern: 'hinge' },
  push_jerk: { name: 'Толчковый швунг', group: 'shoulders', pattern: 'vertical_push' },
  split_jerk: { name: 'Толчок в ножницы', group: 'shoulders', pattern: 'vertical_push' },
  push_press: { name: 'Жимовой швунг', group: 'shoulders', pattern: 'vertical_push' },
  clean_pull: { name: 'Толчковая тяга', group: 'back', pattern: 'hinge' },
  jerk_dip: { name: 'Подсед для толчка', group: 'legs', pattern: 'squat' },
  squat: { name: 'Присед', group: 'legs', pattern: 'squat' },
  deadlift: { name: 'Становая', group: 'back', pattern: 'hinge' },
  sumo_dl: { name: 'Сумо тяга', group: 'back', pattern: 'hinge' },
  rdl: { name: 'Румынская тяга', group: 'legs', pattern: 'hinge' },
  bench_bar: { name: 'Жим лёжа', group: 'chest', pattern: 'horizontal_push' },
  ohp: { name: 'Жим стоя', group: 'shoulders', pattern: 'vertical_push' },
  db_press: { name: 'Жим гантелей', group: 'shoulders', pattern: 'vertical_push' },
  row_bar: { name: 'Тяга штанги', group: 'back', pattern: 'horizontal_pull' },
  row_db: { name: 'Тяга гантели', group: 'back', pattern: 'horizontal_pull' },
  pullup: { name: 'Подтягивания', group: 'back', pattern: 'vertical_pull' },
  lateral_raise: { name: 'Махи в стороны', group: 'shoulders', pattern: 'isolation' },
  face_pull: { name: 'Тяга к лицу', group: 'shoulders', pattern: 'isolation' },
  hip_thrust: { name: 'Ягодичный мост', group: 'legs', pattern: 'squat' },
  hack_squat: { name: 'Гакк-присед', group: 'legs', pattern: 'squat' },
  leg_press: { name: 'Жим ногами', group: 'legs', pattern: 'squat' },
  bulgarian_split: { name: 'Болгарский сплит', group: 'legs', pattern: 'lunge' },
  calf_raise: { name: 'Подъёмы на носки', group: 'legs', pattern: 'isolation' },
  log_press: { name: 'Лог-пресс', group: 'shoulders', pattern: 'vertical_push' },
  axle_press: { name: 'Аксель-пресс', group: 'shoulders', pattern: 'vertical_push' },
  viking_press: { name: 'Викинг-пресс', group: 'shoulders', pattern: 'vertical_push' },
  circus_db_press: { name: 'Цирковой жим', group: 'shoulders', pattern: 'vertical_push' },
  circus_db_medley: { name: 'Гантели-лестница', group: 'shoulders', pattern: 'vertical_push' },
  axle_deadlift: { name: 'Становая аксель', group: 'back', pattern: 'hinge' },
  car_deadlift_18: { name: 'Автодедлифт 18″', group: 'back', pattern: 'hinge' },
  car_deadlift_side: { name: 'Автодедлифт боковой', group: 'back', pattern: 'hinge' },
  deadlift_max: { name: 'Тяга макс', group: 'back', pattern: 'hinge' },
  farmers_walk_heavy: { name: 'Фермер тяжёлый', group: 'back', pattern: 'carry' },
  frame_carry: { name: 'Рама', group: 'back', pattern: 'carry' },
  husafell_carry: { name: 'Хусафелл', group: 'back', pattern: 'carry' },
  conan_wheel: { name: 'Колесо Конана', group: 'legs', pattern: 'carry' },
  shield_carry: { name: 'Щит', group: 'legs', pattern: 'carry' },
  duck_walk: { name: 'Утиная походка', group: 'legs', pattern: 'carry' },
  truck_pull: { name: 'Тяга грузовика', group: 'back', pattern: 'carry' },
  arm_over_arm: { name: 'Канат к себе', group: 'back', pattern: 'carry' },
  yoke_walk: { name: 'Йок', group: 'legs', pattern: 'carry' },
  atlas_stone_load: { name: 'Атлас-камень', group: 'legs', pattern: 'hinge' },
  atlas_stone_over_bar: { name: 'Камень через планку', group: 'legs', pattern: 'hinge' },
  natural_stone_shoulder: { name: 'Натуральный камень', group: 'legs', pattern: 'hinge' },
  stone_lift: { name: 'Камень', group: 'legs', pattern: 'hinge' },
  sandbag_shoulder: { name: 'Мешок на плечо', group: 'legs', pattern: 'hinge' },
  sandbag_load: { name: 'Загрузка мешка', group: 'legs', pattern: 'hinge' },
  sandbag_over_bar: { name: 'Мешок через планку', group: 'legs', pattern: 'hinge' },
  sandbag_carry: { name: 'Перенос мешка', group: 'back', pattern: 'carry' },
  keg_toss: { name: 'Бросок бочки', group: 'legs', pattern: 'hinge' },
  keg_over_bar: { name: 'Бочка через планку', group: 'legs', pattern: 'hinge' },
  keg_load: { name: 'Бочка на платформу', group: 'legs', pattern: 'hinge' },
  sandbag_toss: { name: 'Бросок мешка', group: 'legs', pattern: 'hinge' },
  zercher_carry: { name: 'Зерчер', group: 'back', pattern: 'carry' },
  tire_flip: { name: 'Покрышка', group: 'legs', pattern: 'hinge' },
  sled_push_sprint: { name: 'Сани спринт', group: 'legs', pattern: 'carry' },
  sled_drag: { name: 'Тяга саней', group: 'back', pattern: 'carry' },
  sled_push: { name: 'Толкание саней', group: 'legs', pattern: 'carry' },
  deficit_snatch: { name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge' },
  block_snatch: { name: 'Рывок с блоков', group: 'legs', pattern: 'hinge' },
  pause_snatch: { name: 'Рывок с паузой', group: 'legs', pattern: 'hinge' },
  high_hang_snatch: { name: 'Рывок с высокого виса', group: 'legs', pattern: 'hinge' },
  deficit_clean: { name: 'Взятие с дефицита', group: 'legs', pattern: 'hinge' },
  block_clean: { name: 'Взятие с блоков', group: 'legs', pattern: 'hinge' },
  low_block_clean: { name: 'Взятие с низких блоков', group: 'legs', pattern: 'hinge' },
  pause_clean: { name: 'Взятие с паузой', group: 'legs', pattern: 'hinge' },
  pause_squat: { name: 'Присед с паузой', group: 'legs', pattern: 'squat' },
  tempo_squat: { name: 'Присед темповый 3-0-1', group: 'legs', pattern: 'squat' },
  jerk_recovery: { name: 'Восстановление после толчка', group: 'legs', pattern: 'squat' },
  behind_neck_jerk: { name: 'Толчок из-за головы', group: 'shoulders', pattern: 'vertical_push' },
  pause_jerk: { name: 'Толчок с паузой', group: 'shoulders', pattern: 'vertical_push' },
  pause_pull: { name: 'Тяга с паузой', group: 'back', pattern: 'hinge' },
  deficit_pull: { name: 'Тяга с дефицита', group: 'back', pattern: 'hinge' },
  pin_press: { name: 'Жим с пинов', group: 'chest', pattern: 'horizontal_push' },
};

export const SS_TECHNIQUE: Record<string,string> = {
  snatch:'Рывок: широкий хват, тяга + подрыв + уход в сед, фиксация над головой',
  hang_snatch:'С виса: контроль спины, взрыв бёдрами',
  power_snatch:'Без полного седа, скорость',
  muscle_snatch:'Силой без подседа, малый вес',
  snatch_pull:'Тяга до груди, без ухода, 90-110% рывка',
  snatch_balance:'Подсед + жим в сед, баланс',
  overhead_squat_v2:'Оверхед: штанга над головой, глубокий сед',
  back_squat:'Гриф на трапециях, глубина ниже параллели',
  front_squat:'Гриф на груди, вертикальный корпус',
  front_squat_clean_grip:'Фронт хватом чистого, локти высоко',
  clean_and_jerk:'Толчок: взятие + толчок в ножницы',
  hang_clean:'С виса, локти высоко',
  power_clean:'Силой, без полного седа',
  muscle_clean:'Силой без подседа, тяга',
  push_jerk:'Подсед + выталкивание, полуприсед',
  split_jerk:'Ножницы, фиксация',
  push_press:'Толчок ногами + жим',
  clean_pull:'Узкий хват, тяга до груди, 90-110% взятия',
  jerk_dip:'Подсед 8-12см, вертикально',
  hack_squat:'Спина прижата, колени по носкам',
  leg_press:'Стопы на ширине плеч, не блокировать колени',
  bulgarian_split:'Задняя нога на скамье, корпус вертикально',
  calf_raise:'Полная амплитуда, пауза вверху',
  log_press:'Бревно на груди, локти высоко, толчок',
  axle_press:'Аксель: толстый гриф 50мм, заброс + толчок, без вращения',
  viking_press:'Викинг: вертикальная машина/рама, жим от груди, кор напряжён',
  circus_db_press:'Толстая гантель, заброс + толчок одной',
  circus_db_medley:'Гантели-лестница: 3 веса по 2 повт, быстрый clean',
  axle_deadlift:'Толстый гриф, двойной хват без лямок',
  car_deadlift_18:'Автодедлифт 18″: рама-рычаг, квад-доминант, спина вертикально',
  car_deadlift_side:'Боковой автодедлифт: ручки сбоку, тяга вертикально',
  yoke_walk:'Кор напряжён, короткие шаги, не округлять. Brace 2с перед стартом',
  farmers_walk_heavy:'Хват без лямок, грудь вверх. 40м за 60с — темп',
  frame_carry:'Рама: как фермер тяжёлый, ручки сбоку, стабильность',
  husafell_carry:'Хусафелл на груди, обхват снизу, ходьба 40м, грудь к снаряду',
  conan_wheel:'Колесо Конана: обхват на груди, ход по кругу, дыхание',
  shield_carry:'Щит: прижать к груди, ход 20м, не ронять',
  duck_walk:'Утиная походка: низкий присед, гуськом 20м, кор напряжён',
  truck_pull:'Тяга грузовика: канат к себе/упряжь, ноги коротко, 20м/90с',
  arm_over_arm:'Канат: сидя, перехват к себе, ноги в упор',
  atlas_stone_load:'Обхват, через колени, мощное разгибание. Lap 2с',
  atlas_stone_over_bar:'Через планку 140см: lap + взрыв через высоту, подхват',
  natural_stone_shoulder:'Натуральный камень: неровный хват, на плечо, мощно',
  stone_lift:'Камень: обхват, подъём через колени',
  sandbag_shoulder:'Мешок: взрыв на плечо',
  sandbag_load:'Мешок: через колени на платформу 120-140см, взрыв разгибанием',
  sandbag_over_bar:'Мешок через планку: ниже чем камень, быстрый lap',
  sandbag_carry:'Мешок на груди, ходьба 30м, кор напряжён',
  keg_toss:'Бочка: взрыв бёдрами за спину через 3-4м планку',
  keg_over_bar:'Бочка через планку 140см: как sandbag_over_bar, легче',
  keg_load:'Бочка на платформу 100см: обхват, lap + нагрузка',
  zercher_carry:'Зерчер: штанга в сгибах локтей, кор напряжён',
  tire_flip:'Покрышка: присед + взрыв + толчок коленом. 60с AMRAP при тапере',
  sled_push_sprint:'Сани: лёгкий вес, спринт 25м, cap 30с',
  sled_drag:'Тяга саней: канат, спина прямая, короткие шаги',
  sled_push:'Толкание саней: упереться, толкать 20м',
  deficit_snatch:'С дефицита (2-4см): тяга длиннее, контроль спины',
  block_snatch:'С блоков: старт выше колен, акцент на подрыв',
  pause_snatch:'Пауза 2с у колен + взрыв, без потери позиции',
  high_hang_snatch:'Высокий вис 10см выше колен, короткий разгон, скорость',
  deficit_clean:'С дефицита: глубокая тяга, пятки прижаты',
  block_clean:'С блоков: мощный подрыв, быстрый уход',
  low_block_clean:'Низкие блоки 15см: старт с паузой, тяга длиннее',
  pause_clean:'Пауза у колен 2с, затем взятие',
  pause_squat:'Пауза 2-3с внизу, без отбива',
  tempo_squat:'Темп 3-0-1: медленно вниз, без паузы, мощно вверх',
  jerk_recovery:'Вставание из ножниц с весом над головой',
  behind_neck_jerk:'Из-за головы: вертикальный толчок, баланс',
  pause_jerk:'Пауза 2с в подседе перед толчком, синхрон',
  pause_pull:'Пауза 2с у колен, тяга до груди',
  deficit_pull:'С дефицита 3-5см, длинная амплитуда',
  pin_press:'Жим с пинов: старт с груди без импульса, сила',
  deadlift:'Нейтральная спина, гриф по ногам',
  sumo_dl:'Сумо: ноги широко, носки наружу',
  rdl:'Таз назад, гриф по ногам, растяжение бицепса бедра',
  squat:'Глубина, колени по носкам',
  bench_bar:'Лопатки сведены, грудь вверх',
  ohp:'Кор напряжён, без прогиба',
  db_press:'Гантели на уровне ушей, сведение вверху',
  row_bar:'Тяга к низу живота, сведение лопаток',
  row_db:'Упор, тяга к поясу, разворот',
  pullup:'Тяга грудью к перекладине, без раскачки',
  lateral_raise:'Махи до уровня плеч, мизинец вверх',
  face_pull:'Трос к лицу, разворот кистей',
  hip_thrust:'Таз вверх, пауза 2с, без переразгиба',
};

export function getExerciseMeta(id: string): { name: string; group: string; pattern: string; equipment: string; technique?: string } | null {
  try{
    const main: any = (getExerciseById as any)(id);
    if (main) {
      return {
        name: main.name || SS_EX_META[id]?.name || id,
        group: main.group || SS_EX_META[id]?.group || 'legs',
        pattern: main.movementPattern || (main as any).pattern || SS_EX_META[id]?.pattern || 'unknown',
        equipment: main.equipment || 'barbell',
        technique: SS_TECHNIQUE[id] || main.technique,
      };
    }
  }catch{}
  const m = SS_EX_META[id];
  if (!m) return { name: id, group: 'legs', pattern: 'unknown', equipment: 'barbell', technique: SS_TECHNIQUE[id] };
  return { name: m.name, group: m.group, pattern: m.pattern, equipment: 'barbell', technique: SS_TECHNIQUE[id] };
}
