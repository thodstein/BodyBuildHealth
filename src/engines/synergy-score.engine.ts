import type { MasterDB, SubstanceEntry } from '../core/types';

export interface SynergyResult { a: string; b: string; score: number; level: string; }

export const SynergyEngine = {
  calculatePair(a: SubstanceEntry, b: SubstanceEntry, db: MasterDB): SynergyResult {
    const sharedMechanisms = a.mechanisms?.filter(m => b.mechanisms?.includes(m)).length || 0;
    const oppositeMechanisms = this.countOpposites(a.mechanisms || [], b.mechanisms || []);
    const sharedTargets = a.risks?.filter(r => b.risks?.includes(r)).length || 0;
    const interactionPenalty = this.getInteractionPenalty(a.id, b.id, db);
    const categoryBonus = a.category === b.category ? 2 : 0;

    const score = sharedMechanisms * 2 + oppositeMechanisms * -3 + sharedTargets * 1 + interactionPenalty + categoryBonus;
    return { a: a.id, b: b.id, score, level: this.getLevel(score) };
  },

  countOpposites(a: string[], b: string[]): number {
    let count = 0;
    a.forEach(m => {
      if (b.includes(`${m}_DOWN`) || b.includes(`${m}_UP`)) count++;
    });
    return count;
  },

  getInteractionPenalty(a: string, b: string, db: MasterDB): number {
    const direct = db.interactions.find(i =>
      (i.substanceA === a && i.substanceB === b) || (i.substanceA === b && i.substanceB === a)
    );
    if (direct) {
      if (direct.type === 'conflict') return -5 * direct.severity;
      if (direct.type === 'danger') return -10;
      if (direct.type === 'synergy') return 3;
    }
    return 0;
  },

  getLevel(score: number): string {
    if (score > 8) return 'STRONG_SYNERGY';
    if (score > 3) return 'GOOD_SYNERGY';
    if (score >= 0) return 'NEUTRAL';
    if (score > -5) return 'WEAK_CONFLICT';
    return 'DANGEROUS_CONFLICT';
  }
};