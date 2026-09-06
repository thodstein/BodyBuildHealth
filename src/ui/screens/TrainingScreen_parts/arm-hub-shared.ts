/**
 * arm-hub-shared.ts — общие константы хаба диагностики (табы, группы точек).
 * Вынесены из ArmDiagnosticsHub для переиспользования в arm-hub-tabs/panels
 * без циклических импортов. Значения 1-в-1.
 */
import type { ArmWeakPoint } from '../../../engines/arm/arm-biomechanics.engine';

export type HubTab = 'grip' | 'wrist' | 'pressure' | 'strength' | 'recovery';

export interface TiqBout {
  fouls?: number;
  slip?: boolean;
  strap?: boolean;
  centerHoldSec?: number;
  win?: boolean;
  finishSec?: number;
  dateIso?: string;
}

export const LEVEL_OPTS = [
  { id: 'beginner', label: 'Новичок' },
  { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' },
  { id: 'enhanced', label: 'Enhanced' },
];

export const TAB_DEFS: Array<{ id: HubTab; label: string; icon: string; desc: string }> = [
  { id: 'grip', label: 'Хват', icon: '✊', desc: 'RT/Axle/Pinch + WR 130.5/77.2' },
  { id: 'wrist', label: 'Кисть/Ротация', icon: '🤚', desc: '12 мёртвых точек + РУ/РА + VBT' },
  { id: 'pressure', label: 'Давление', icon: '💥', desc: 'Side/Back + humerus + table 3/2/1' },
  { id: 'strength', label: 'Сила', icon: '⚡', desc: 'F/t F100/F500 + асимметрия + бенчмарки' },
  { id: 'recovery', label: 'Сухожилие/Восстановление', icon: '🛡️', desc: 'Tendon + ACWR + fatigue' },
];

export const WEAK_GROUPS: Array<{ title: string; points: ArmWeakPoint[] }> = [
  { title: 'Кисть', points: ['cup_start','cup_hold','rising_top','contain_fingers'] },
  { title: 'Ротация', points: ['pron_open','pron_lock','sup_cup','sup_drag'] },
  { title: 'Давление', points: ['side_mid','side_pin','back_start','back_drag'] },
];

export const WP_LABEL_SHORT: Record<ArmWeakPoint,string> = {
  cup_start: 'Cup старт', cup_hold: 'Cup hold', rising_top: 'Rising', pron_open: 'Pron откр', pron_lock: 'Pron lock',
  sup_cup: 'Sup cup', sup_drag: 'Sup drag', side_mid: 'Side mid', side_pin: 'Side pin', back_start: 'Back старт', back_drag: 'Back drag', contain_fingers: 'Пальцы',
};
