// src/core/master-database.ts
export interface MasterDB {
  substances: Substance[];
  effects: Effect[];
  interactions: Interaction[];
  stacks: Stack[];
  hormones: Hormone[];
  peptides: Peptide[];
  pharma: PharmaItem[];
}

export interface Substance { id: string; name: string; category: string; route: string[]; shortName: string; }
export interface Effect { effect: string; class: string; group: string; strengthBase: number; strengthMax: number; }
export interface Interaction { substanceA: string; substanceB: string; type: 'synergy' | 'conflict' | 'danger' | 'caution'; severity: number; description: string; }
export interface Stack { id: string; effects: string[]; substances: string[]; synergyScore: number; }
export interface Hormone { id: string; name: string; class: string; route: string[]; shortName: string; }
export interface Peptide { id: string; name: string; amountMg: number; bioavailability: Record<string, { min: number; max: number; avg: number }>; tHalfHours: number; mechanisms: string[]; }
export interface PharmaItem { id: string; name: string; class: string; route: string[]; shortName: string; }

export const MASTER_DB: MasterDB = {
  substances: [
    { id: 'caffeine', name: 'Caffeine', category: 'stimulants', route: ['oral'], shortName: 'CAF' },
    { id: 'l_theanine', name: 'L-Theanine', category: 'calming', route: ['oral'], shortName: 'THA' },
    { id: 'rhodiola', name: 'Rhodiola Rosea', category: 'adaptogens', route: ['oral'], shortName: 'RHO' },
    { id: 'ashwagandha', name: 'Ashwagandha', category: 'adaptogens', route: ['oral'], shortName: 'ASH' },
    { id: 'magnesium', name: 'Magnesium', category: 'minerals', route: ['oral'], shortName: 'MG' },
    { id: 'vitamin_d', name: 'Vitamin D3', category: 'vitamins', route: ['oral'], shortName: 'VD3' },
    { id: 'omega3', name: 'Omega-3', category: 'fatty_acids', route: ['oral'], shortName: 'O3' },
    { id: 'berberine', name: 'Berberine', category: 'metabolic', route: ['oral'], shortName: 'BER' },
    { id: 'metformin', name: 'Metformin', category: 'pharma', route: ['oral'], shortName: 'MET' },
    { id: 'mots_c', name: 'MOTS-c', category: 'peptides', route: ['sc'], shortName: 'MOTS' }
  ],
  effects: [
    { effect: 'ENERGY', class: 'CNS', group: 'METABOLIC', strengthBase: 1, strengthMax: 5 },
    { effect: 'FOCUS', class: 'CNS', group: 'COGNITIVE', strengthBase: 1, strengthMax: 5 },
    { effect: 'SLEEP', class: 'CNS', group: 'SEDATION', strengthBase: 1, strengthMax: 5 },
    { effect: 'ANTI_STRESS', class: 'CNS', group: 'HPA_AXIS', strengthBase: 1, strengthMax: 5 },
    { effect: 'MOOD', class: 'CNS', group: 'AFFECTIVE', strengthBase: 1, strengthMax: 5 },
    { effect: 'GH_IGF_AXIS', class: 'HORMONAL', group: 'ANABOLIC', strengthBase: 1, strengthMax: 5 },
    { effect: 'FAT_LOSS', class: 'METABOLIC', group: 'AMPK', strengthBase: 1, strengthMax: 5 },
    { effect: 'RECOVERY', class: 'SYSTEMIC', group: 'REPAIR', strengthBase: 1, strengthMax: 5 },
    { effect: 'ANTI_INFLAMMATION', class: 'SYSTEMIC', group: 'CYTOKINE', strengthBase: 1, strengthMax: 5 },
    { effect: 'IMMUNE_BOOST', class: 'SYSTEMIC', group: 'IMMUNE', strengthBase: 1, strengthMax: 5 }
  ],
  interactions: [
    { substanceA: 'caffeine', substanceB: 'l_theanine', type: 'synergy', severity: 1, description: 'Сглаживание стимуляции, снижение тревоги' },
    { substanceA: 'caffeine', substanceB: 'rhodiola', type: 'caution', severity: 1, description: 'Возможна гиперстимуляция' },
    { substanceA: 'ashwagandha', substanceB: 'magnesium', type: 'synergy', severity: 1, description: 'Усиление расслабления и сна' },
    { substanceA: 'metformin', substanceB: 'vitamin_b12', type: 'conflict', severity: 2, description: 'Снижение всасывания B12' },
    { substanceA: 'omega3', substanceB: 'anticoagulants', type: 'danger', severity: 3, description: 'Повышение риска кровотечений' }
  ],
  stacks: [
    { id: 'stack_001', effects: ['energy', 'focus', 'anti_stress'], substances: ['caffeine', 'l_theanine', 'rhodiola'], synergyScore: 7.8 },
    { id: 'stack_002', effects: ['sleep', 'anti_stress', 'mood'], substances: ['glycine', 'taurine', 'magnesium'], synergyScore: 6.9 },
    { id: 'stack_003', effects: ['fat_loss', 'energy', 'mitochondria'], substances: ['mots_c', 'l_carnitine', 'coq10'], synergyScore: 8.4 }
  ],
  hormones: [],
  peptides: [
    { id: 'CJC1295', name: 'CJC-1295 (без DAC)', amountMg: 2, bioavailability: { sc: { min: 70, max: 90, avg: 80 } }, tHalfHours: 6, mechanisms: ['GH_UP', 'IGF1_UP'] },
    { id: 'IPAMORELIN', name: 'Ipamorelin', amountMg: 2, bioavailability: { sc: { min: 75, max: 95, avg: 85 } }, tHalfHours: 2, mechanisms: ['GH_UP'] }
  ],
  pharma: [
    { id: 'metformin', name: 'Metformin', class: 'biguanide', route: ['oral'], shortName: 'MET' },
    { id: 'atorvastatin', name: 'Atorvastatin', class: 'statin', route: ['oral'], shortName: 'ATV' }
  ]
};

export function getSubstance(id: string) { return MASTER_DB.substances.find(s => s.id === id); }
export function getStack(id: string) { return MASTER_DB.stacks.find(s => s.id === id); }
export function getInteractions(a: string, b: string) { return MASTER_DB.interactions.filter(i => (i.substanceA === a && i.substanceB === b) || (i.substanceA === b && i.substanceB === a)); }
