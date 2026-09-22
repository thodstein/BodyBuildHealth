/**
 * arm-weakpoint-corrections.ts — мёртвая точка → коррекции из каталога (проверено ids).
 * Пара: ARM_BIOMECH (биомеханика) → CORRECTIONS (упражнения + параметры).
 * Все ids существуют в exercise-catalog-arm.ts (validateArmCatalog).
 */
import type { ArmWeakPoint } from './arm-biomechanics.engine';

export interface ArmCorrectionInfo {
  weakPoint: ArmWeakPoint;
  exercises: string[]; // ids, порядок приоритета — первый = топ-1
  intensityPct: number;
  repsRange: [number, number];
  sets: number;
  rir: number;
  holdSeconds?: number;
  tempo?: string;
  substitutionGroup: string; // для dayMap / finalize (не смешивать pron↔sup)
  dayTags: string[]; // предпочтительные sessionTag для инъекции
  /** P6: фазы схватки, которые чинит (мост стол↔снаряды: setup/start/mid/pin). */
  fixesPhase?: string[];
}

export const ARM_CORRECTIONS: Record<ArmWeakPoint, ArmCorrectionInfo> = {
  cup_start: {
    weakPoint: 'cup_start',
    exercises: ['wrist_curl_belt','cup_to_little','wrist_curl_bb','wrist_roller','wrist_curl_db','wrist_curl_behind'],
    intensityPct: 0.65, repsRange: [6,10], sets: 3, rir: 2, tempo: '2-1-1-0',
    substitutionGroup: 'cup_iso', dayTags: ['TableCup','Hammer','FullArm'],
    fixesPhase: ['start'],
  },
  cup_hold: {
    weakPoint: 'cup_hold',
    exercises: ['wrist_curl_belt','wrist_curl_behind','cup_to_thumb','riser_lift','wrist_curl_db','wrist_curl_bb'],
    intensityPct: 0.65, repsRange: [8,12], sets: 3, rir: 2, holdSeconds: 10, tempo: '2-1-2-0',
    substitutionGroup: 'cup_iso', dayTags: ['TableCup','TableTech','Hammer'],
    fixesPhase: ['mid','pin'],
  },
  rising_top: {
    weakPoint: 'rising_top',
    exercises: ['riser_lift','finger_containment_band','plate_pinch_hold','radial_dev_heavy','ulnar_dev_heavy','radial_dev'],
    intensityPct: 0.65, repsRange: [8,12], sets: 3, rir: 2, holdSeconds: 10, tempo: '2-1-1-0',
    substitutionGroup: 'rising', dayTags: ['TableTech','GripHeavy','FullArm'],
    fixesPhase: ['setup','start'],
  },
  pron_open: {
    weakPoint: 'pron_open',
    exercises: ['pronation_cable','pronation_sledge','pronation_strap','indian_clubs','pronation_pulses','lever_top'],
    intensityPct: 0.70, repsRange: [8,12], sets: 3, rir: 2, tempo: '2-1-1-0',
    substitutionGroup: 'pronation', dayTags: ['TablePronation','TableTech','FullArm'],
    fixesPhase: ['setup'],
  },
  pron_lock: {
    weakPoint: 'pron_lock',
    exercises: ['pronation_cable','pron_high_strap','sledge_choke','lever_top','pronation_sledge','pronation_pulses'],
    intensityPct: 0.70, repsRange: [5,8], sets: 3, rir: 2, holdSeconds: 10, tempo: '3-1-1-0',
    substitutionGroup: 'pronation', dayTags: ['TablePronation','TableHeavy','TableTech'],
    fixesPhase: ['start','mid'],
  },
  sup_cup: {
    weakPoint: 'sup_cup',
    exercises: ['supination_cable','supination_hammer','hammer_curl_thick','sup_high_strap','reverse_ez_curl','preacher_hammer'],
    intensityPct: 0.70, repsRange: [8,12], sets: 3, rir: 2, tempo: '2-1-1-0',
    substitutionGroup: 'supination', dayTags: ['TableSupination','Hammer','FullArm'],
    fixesPhase: ['setup','start'],
  },
  sup_drag: {
    weakPoint: 'sup_drag',
    exercises: ['supination_cable','hook_drag_cable','hammer_belt','sup_high_strap','landmine_row_under','reverse_ez_curl'],
    intensityPct: 0.70, repsRange: [6,10], sets: 3, rir: 1, tempo: '2-1-1-0',
    substitutionGroup: 'supination', dayTags: ['TableSupination','Hammer','BackPress'],
    fixesPhase: ['mid'],
  },
  side_mid: {
    weakPoint: 'side_mid',
    exercises: ['side_press_cable','side_belt_table','side_press_table','table_pushdown_iso','internal_rotation_band','external_rotation_band'],
    intensityPct: 0.60, repsRange: [3,6], sets: 3, rir: 2, tempo: '3-1-1-0',
    substitutionGroup: 'side_press', dayTags: ['SidePress','Support','TableHeavy'],
    fixesPhase: ['mid'],
  },
  side_pin: {
    weakPoint: 'side_pin',
    exercises: ['side_belt_table','table_pushdown_iso','side_press_table','internal_rotation_band','side_press_cable','external_rotation_band'],
    intensityPct: 0.60, repsRange: [3,6], sets: 3, rir: 2, holdSeconds: 10, tempo: '3-1-1-0',
    substitutionGroup: 'side_press', dayTags: ['SidePress','Support','TableTech'],
    fixesPhase: ['pin'],
  },
  back_start: {
    weakPoint: 'back_start',
    exercises: ['lat_drag_belt','row_strap_hip','landmine_row_under','hook_drag_cable','towel_pullup','anti_rotation_hold'],
    intensityPct: 0.70, repsRange: [6,10], sets: 3, rir: 2, tempo: '2-1-1-0',
    substitutionGroup: 'back_drag', dayTags: ['BackPress','TableHeavy','TablePronation'],
    fixesPhase: ['start'],
  },
  back_drag: {
    weakPoint: 'back_drag',
    exercises: ['lat_drag_belt','row_strap_hip','hook_drag_cable','anti_rotation_hold','landmine_row_under','towel_pullup'],
    intensityPct: 0.70, repsRange: [6,10], sets: 3, rir: 2, tempo: '2-1-1-0',
    substitutionGroup: 'back_drag', dayTags: ['BackPress','Support','Hammer'],
    fixesPhase: ['mid','pin'],
  },
  contain_fingers: {
    weakPoint: 'contain_fingers',
    exercises: ['hub_pinch','plate_pinch_hold','rolling_thunder','apollon_axle','finger_containment_band','coc_gripper','coc_no1','little_big_horn'],
    intensityPct: 0.60, repsRange: [8,12], sets: 3, rir: 2, holdSeconds: 15, tempo: '2-1-1-0',
    substitutionGroup: 'grip_pinch', dayTags: ['GripHeavy','PinchGrip','HubPinch','FullArm'],
    fixesPhase: ['setup','start','mid','pin'],
  },
};

export function correctionForWeakPoint(wp: ArmWeakPoint): ArmCorrectionInfo | null {
  return ARM_CORRECTIONS[wp] ?? null;
}

export function validateArmCorrections(ids: Set<string>): string[] {
  const errs: string[] = [];
  for (const [wp, info] of Object.entries(ARM_CORRECTIONS) as Array<[ArmWeakPoint, ArmCorrectionInfo]>) {
    for (const exId of info.exercises) {
      if (!ids.has(exId)) errs.push(`${wp}: ${exId} not in catalog`);
    }
  }
  return errs;
}

// Алиасы старых 8 ключей → новые 12 (для миграции WEAK_MAP)
export const LEGACY_TO_DETAILED: Record<string, ArmWeakPoint[]> = {
  cup: ['cup_start','cup_hold'],
  rising: ['rising_top'],
  pronation: ['pron_open','pron_lock'],
  supination: ['sup_cup','sup_drag'],
  side: ['side_mid','side_pin'],
  back: ['back_start','back_drag'],
  pinch: ['contain_fingers'],
  support: ['contain_fingers'],
};
