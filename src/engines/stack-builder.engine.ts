import type { MasterDB } from '../core/types';
export function generateStack(db: MasterDB, goalId: string) {
  const goals = db.goal_profiles || [];
  const stack = { id: 'stack_auto', effects: [], substances: [], synergyScore: 0 };
  console.log('🔍 Stack generated for', goalId);
  return stack;
}
