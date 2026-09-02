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
  if (outsideSessions >= 5) {
    // P0-2 + Boxing Science 77% aerobic: даже при 5× татами Zone2 30′ обязателен для восстановления между взрывами
    // alactic/lactic — 0 (внешняя покрывает), aerobic — 1× поддержание
    if (phase === 'deload') return [{ id: `cond_aerobic_w${week}_maint`, modality: 'aerobic', durationMin: 18, intervals: '18′ Zone2 (делод ×0.6) — cardiac output 130-145 <ANT', hrZone: 'Zone2 130-145 <ANT', rpe: 5, description: 'Поддержание cardiac output при высокой внезальной (делод) — eccentric hypertrophy', exercises: ['kb_swing', 'farmer_carry'] }];
    if (phase === 'realization' || phase === 'taper') return [{ id: `cond_aerobic_w${week}_maint`, modality: 'aerobic', durationMin: 21, intervals: '21′ Zone2 (тапер ×0.7) 130-145', hrZone: 'Zone2 130-145', rpe: 5, description: 'Тапер: лёгкий Zone2 maintenance', exercises: ['kb_swing'] }];
    return [{ id: `cond_aerobic_w${week}_maint`, modality: 'aerobic', durationMin: 30, intervals: '30′ Zone2 cardiac output 130-150 <ANT', hrZone: 'Zone2 130-145 <ANT', rpe: 6, description: 'Аэробаза 77% (Boxing Science) — cardiac output eccentric hypertrophy — даже при 5× татами 1× Zone2 сохраняем', exercises: ['kb_swing', 'sled_push'] }];
  }
  const mods = modalityForWeek(goal, phase);
  const out: ConditioningSession[] = [];
  const isAccum = phase === 'accumulation' || phase === 'gpp';
  const isTrans = phase === 'transmutation' || phase === 'power';
  for (const mod of mods) {
    if (mod === 'alactic') {
      // Jamieson: power 8×10с/50с (1:5) полный отдых vs capacity 8×10с/30с (1:3)
      if (isTrans) {
        out.push({
          id: `cond_alactic_w${week}_power`,
          modality: 'alactic',
          durationMin: 25,
          intervals: '8×10с hill/bike/sled, 50с отдых (1:5), 95% — power (полный отдых)',
          hrZone: 'peak 85-95% max',
          rpe: 9,
          description: 'Алактат POWER: взрыв 10с + 50с полный отдых — ATP-PCr power. Для тейкдаунов/нокаут-комбинаций',
          exercises: ['sled_push', 'battle_rope', 'box_jump', 'med_ball_slam'],
        });
      } else if (isAccum) {
        out.push({
          id: `cond_alactic_w${week}_capacity`,
          modality: 'alactic',
          durationMin: 22,
          intervals: '8×10с, 30с отдых (1:3) — capacity, короткий отдых',
          hrZone: 'peak 85-95% max',
          rpe: 8,
          description: 'Алактат CAPACITY: 10с/30с — повторяемость взрывов (Jamieson). Короткий отдых приучает к ресинтезу PCr',
          exercises: ['sled_push', 'battle_rope', 'box_jump', 'med_ball_slam'],
        });
      } else {
        out.push({
          id: `cond_alactic_w${week}`,
          modality: 'alactic',
          durationMin: 20,
          intervals: '6×10с hill/bike/sled, 50с отдых (1:5), 90% — maintenance',
          hrZone: 'peak 85-95% max',
          rpe: 8,
          description: 'Алактат maintenance — 6×10с, сохранение',
          exercises: ['sled_push', 'battle_rope', 'box_jump'],
        });
      }
    } else if (mod === 'lactic') {
      if (isTrans) {
        out.push({
          id: `cond_lactic_w${week}_power`,
          modality: 'lactic',
          durationMin: 28,
          intervals: '20-40с max / 8-15мин между сериями, 2-4×3 — lactic POWER (ферменты гликолиза)',
          hrZone: 'Zone4-5 165-180',
          rpe: 9,
          description: 'Лактат POWER: короткие макс-отрезки 20-40с, длинный отдых 8-15мин — ↑гликол. ферменты (Jamieson)',
          exercises: ['battle_rope', 'sledge_hammer', 'sled_pull'],
        });
      } else if (isAccum) {
        out.push({
          id: `cond_lactic_w${week}_capacity`,
          modality: 'lactic',
          durationMin: 32,
          intervals: '90-120с, 60-90с отдых 2-4×3 — lactic CAPACITY (буфер)',
          hrZone: 'Zone4-5 165-180',
          rpe: 8,
          description: 'Лактат CAPACITY: длинные отрезки 90-120с, короткий отдых — буфер H+ (Jamieson). 5×3мин раунд как бой',
          exercises: ['battle_rope', 'sledge_hammer', 'sled_pull', 'med_ball_rot_throw'],
        });
      } else {
        out.push({
          id: `cond_lactic_w${week}`,
          modality: 'lactic',
          durationMin: 24,
          intervals: '5×2мин / 60с отдых — maintenance',
          hrZone: 'Zone4 160-170',
          rpe: 7,
          description: 'Лактат maintenance',
          exercises: ['battle_rope', 'sledge_hammer', 'sled_pull'],
        });
      }
    } else if (mod === 'aerobic') {
      if (isAccum) {
        out.push({
          id: `cond_aerobic_w${week}_base`,
          modality: 'aerobic',
          durationMin: 40,
          intervals: '40′ Zone2 cardiac output 130-150 <ANT непрерывно',
          hrZone: 'Zone2 130-145 <ANT',
          rpe: 6,
          description: 'Cardiac output 130-150 уд <ANT — eccentric hypertrophy левого желудочка, капилляризация (Jamieson). Бег/вело/гребля',
          exercises: ['kb_swing', 'sled_push', 'farmer_carry'],
        });
      } else if (isTrans) {
        out.push({
          id: `cond_aerobic_w${week}`,
          modality: 'aerobic',
          durationMin: 30,
          intervals: '30′ Zone2 130-145',
          hrZone: 'Zone2 130-145',
          rpe: 6,
          description: 'Аэробаза поддержание: Zone2 30′ для восстановления между лаВ-сессиями',
          exercises: ['kb_swing', 'sled_push', 'farmer_carry'],
        });
      } else {
        out.push({
          id: `cond_aerobic_w${week}`,
          modality: 'aerobic',
          durationMin: 28,
          intervals: '28′ Zone2 лёгкий',
          hrZone: 'Zone2 130-145',
          rpe: 5,
          description: 'Аэробаза лёгкая: 28′ Zone2',
          exercises: ['kb_swing', 'sled_push'],
        });
      }
    }
  }
  // deload — сокращаем
  if (phase === 'deload') return out.map(s => ({ ...s, durationMin: Math.round(s.durationMin * 0.6), intervals: s.intervals + ' (делод ×0.6)' }));
  if (phase === 'realization' || phase === 'taper') return out.filter(s => s.modality === 'aerobic').map(s => ({ ...s, durationMin: Math.round(s.durationMin * 0.7) }));
  return out;
}

export function buildConditioningRationale(goal: string, outsideSessions: number, weeks: number): string[] {
  const lines: string[] = [];
  if (outsideSessions >= 5) {
    lines.push(`Кондиция: цель ${goal} · вне зала ${outsideSessions}× → 1× Zone2 30′ поддержание (77% aerobic — Boxing Science)`);
  } else {
    lines.push(`Кондиция: цель ${goal} · вне зала ${outsideSessions}× → ${modalityForWeek(goal, 'accumulation').join(' + ')}`);
  }
  lines.push('Системы: alactic 10с/50с (ATP-PCr) + lactic 3мин/90с (глюколиз) + aerobic Zone2 40′ (130-150 уд, cardiac output)');
  if (weeks >= 8) lines.push('Периодизация кондиции: Off аэробаза → Pre alactic+lac → Camp поддержание + тапер (Jamieson)');
  if (outsideSessions >= 5) lines.push('При 5× татами: alactic/lactic покрыты спаррингом — сохраняем 1× Zone2 для восстановления между раундами');
  return lines;
}

export function conditioningBudgetCost(sessions: ConditioningSession[]): number {
  // 12мин Zone2 ≈1 сет зала (Helms interference) — используется в builder для budget enforcement
  return Math.round(sessions.reduce((a, c) => a + (c.durationMin || 0), 0) * 0.08);
}

export function conditioningNeedsAerobicMaintenance(outsideSessions: number): boolean {
  return outsideSessions >= 5;
}
