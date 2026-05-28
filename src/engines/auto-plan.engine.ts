import { registry } from '../core/data/registry';
import { generateStack } from './stack-builder.engine';
import type { GoalId, LabPoint } from '../core/types';

export interface TimeSlot {
  time: 'morning' | 'day' | 'evening' | 'night';
  substances: Array<{ id: string; name: string; dose: string; notes: string }>;
}

export interface DailyProtocol {
  date: string;
  slots: TimeSlot[];
  warnings: string[];
  adherenceScore: number;
}

export function generateDailyProtocol(
  goalId: GoalId,
  labs: LabPoint[] = [],
  blacklist: string[] = []
): DailyProtocol {
  const db = registry.get();
  const stackResult = generateStack(goalId, 'balanced', blacklist);
  const warnings: string[] = [...stackResult.errors, ...stackResult.warnings];

  // Категоризация по времени приема
  const morning: TimeSlot['substances'] = [];
  const day: TimeSlot['substances'] = [];
  const evening: TimeSlot['substances'] = [];
  const night: TimeSlot['substances'] = [];

  const morningTags = ['stimulants', 'nootropics', 'thyroid_support', 'energy'];
  const dayTags = ['metabolic', 'cardio_support', 'immune_support', 'gi_healing', 'fatty_acids'];
  const eveningTags = ['anti_stress', 'recovery', 'hormone_balance', 'minerals'];
  const nightTags = ['sleep_regulators'];

  stackResult.substances.forEach(sub => {
    const item = { id: sub.id, name: sub.name, dose: 'Standard', notes: '' };
    const cat = sub.category.toLowerCase();
    if (morningTags.some(t => cat.includes(t))) morning.push(item);
    else if (dayTags.some(t => cat.includes(t))) day.push(item);
    else if (eveningTags.some(t => cat.includes(t))) evening.push(item);
    else if (nightTags.some(t => cat.includes(t))) night.push(item);
    else day.push(item); // fallback
  });

  return {
    date: new Date().toISOString().slice(0, 10),
    slots: [
      { time: 'morning', substances: morning },
      { time: 'day', substances: day },
      { time: 'evening', substances: evening },
      { time: 'night', substances: night }
    ],
    warnings,
    adherenceScore: stackResult.score
  };
}