/**
 * combat-conditioning.engine.ts — кондиционный слой для единоборств.
 * 3 системы: alactic (ATP-PCr 5-10с/50с), lactic (30с-3мин/пауза 1:1), aerobic (Zone2 30-45′).
 * Источники: Vitruve Off/Pre/Camp, Phil Daru Block, ISSN.
 * Изолировано.
 */
export type ConditioningModality = 'alactic' | 'lactic' | 'aerobic' | 'mixed' | 'off';
export type ConditioningPhase = 'accumulation' | 'transmutation' | 'realization' | 'gpp' | 'power' | 'taper' | 'deload' | 'conjugate';

export interface ConditioningSession {
  id: string;
  modality: ConditioningModality;
  durationMin: number;
  intervals?: string; // "8×10с/50с" etc
  hrZone?: string; // "Zone2 130-145"
  rpe?: number; // 6-9
  description: string;
  exercises: string[]; // ids
}

export interface ConditioningPlan {
  weeks: number;
  sessions: ConditioningSession[][];
}

const MODALITY_BY_GOAL: Record<string, ConditioningModality[]> = {
  power: ['alactic', 'aerobic'],
  endurance: ['lactic', 'aerobic'],
  camp: ['alactic', 'lactic'],
  weight_cut: ['aerobic'],
  maintenance: ['aerobic'],
  general: ['alactic', 'aerobic'],
};

export function modalityForWeek(goal: string, phase: ConditioningPhase): ConditioningModality[] {
  const base = MODALITY_BY_GOAL[goal] || MODALITY_BY_GOAL.general;
  if (phase === 'deload' || phase === 'taper' || phase === 'realization') return base.includes('aerobic') ? ['aerobic'] : base.slice(0, 1);
  // accumulation (ATR) и gpp — база: оставляем полную базу (alactic+aerobic для power), чтобы Off-season имел обе системы
  if (phase === 'accumulation' || phase === 'gpp') return base;
  if (phase === 'transmutation' || phase === 'power') return base;
  if (phase === 'conjugate') return ['alactic', 'aerobic'];
  return base;
}

export function conditioningSessionsForWeek(
  week: number,
  phase: ConditioningPhase,
  goal: string,
  outsideSessions: number
): ConditioningSession[] {
  if (outsideSessions >= 5) return []; // внешняя уже высокая — не добавляем
  const mods = modalityForWeek(goal, phase);
  const out: ConditioningSession[] = [];
  for (const mod of mods) {
    if (mod === 'alactic') {
      out.push({
        id: `cond_alactic_w${week}`,
        modality: 'alactic',
        durationMin: 25,
        intervals: '8×10с hill/bike/sled, 50с отдых (1:5), 95% усилие',
        hrZone: 'peak 85-95% max',
        rpe: 9,
        description: 'Алактат: взрыв 10с + полный отдых — ATP-PCr. Для тейкдаунов/комбинаций',
        exercises: ['sled_push', 'battle_rope', 'box_jump', 'med_ball_slam'],
      });
    } else if (mod === 'lactic') {
      out.push({
        id: `cond_lactic_w${week}`,
        modality: 'lactic',
        durationMin: 30,
        intervals: '5×3мин раунд / 60-90с отдых, 85% HRmax',
        hrZone: 'Zone4-5 165-180',
        rpe: 8,
        description: 'Лактат: раунды 5мин/1мин как бой — гликолиз. Heavy bag + battle rope + shuttle',
        exercises: ['battle_rope', 'sledge_hammer', 'sled_pull', 'med_ball_rot_throw'],
      });
    } else if (mod === 'aerobic') {
      out.push({
        id: `cond_aerobic_w${week}`,
        modality: 'aerobic',
        durationMin: 40,
        intervals: '40′ Zone2 непрерывно',
        hrZone: 'Zone2 130-145 уд/мин',
        rpe: 6,
        description: 'Аэробаза: Zone2 30-45′ для восстановления между взрывами. Бег/вело/гребля',
        exercises: ['kb_swing', 'sled_push', 'farmer_carry'],
      });
    }
  }
  // deload — сокращаем
  if (phase === 'deload') return out.map(s => ({ ...s, durationMin: Math.round(s.durationMin * 0.6), intervals: s.intervals + ' (делод ×0.6)' }));
  if (phase === 'realization' || phase === 'taper') return out.filter(s => s.modality === 'aerobic').map(s => ({ ...s, durationMin: Math.round(s.durationMin * 0.7) }));
  return out;
}

export function buildConditioningRationale(goal: string, outsideSessions: number, weeks: number): string[] {
  const lines: string[] = [];
  lines.push(`Кондиция: цель ${goal} · вне зала ${outsideSessions}× → ${outsideSessions >= 5 ? 'добавки не нужны (внешняя покрывает)' : modalityForWeek(goal, 'accumulation').join(' + ')}`);
  lines.push('Системы: alactic 10с/50с (ATP-PCr) + lactic 3мин/90с (глюколиз) + aerobic Zone2 40′');
  if (weeks >= 8) lines.push('Периодизация кондиции: Off аэробаза → Pre alactic+lac → Camp поддержание + тапер');
  return lines;
}
