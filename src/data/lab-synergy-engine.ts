// ════════════════════════════════════════════════════════════════════════════
//  LAB-SYNERGY-ENGINE — обязательные синергетические пары
//
//  Принцип: если выбран один препарат → второй добавляется автоматически.
//  mandatory = всегда. conditional = по условию (условие в ctx).
// ════════════════════════════════════════════════════════════════════════════

import { canonId } from '../engines/support-plan/shared-constants';

export interface SynergyPair {
  primary: string;
  secondary: string;
  relationship: 'mandatory' | 'strong' | 'conditional';
  reason: string;
  when?: string;  // условие для conditional пар
}

export const SYNERGY_PAIRS: SynergyPair[] = [
  { primary: 'iron_bisglycinate', secondary: 'vitamin_c', relationship: 'mandatory', reason: 'VitC ↑ Fe всасывание ×3 (Fe³→Fe²)' },
  { primary: 'serrapeptase', secondary: 'nattokinase',    relationship: 'mandatory', reason: '2 пути фибринолиза: α2-M + плазминоген' },
  { primary: 'vitamin_d3',   secondary: 'vitamin_k2',    relationship: 'mandatory', reason: 'D3 без K2 = кальцификация сосудов' },
  { primary: 'bergamot',    secondary: 'coq10',          relationship: 'mandatory', reason: 'HMG-CoA редуктаза истощает CoQ10 синтез' },
  { primary: 'curcumin',    secondary: 'piperine',       relationship: 'mandatory', reason: 'Piperine ↑ куркумина ×20 (↓ глюкуронилтрансферазы)' },
  { primary: 'nac',         secondary: 'glycine',         relationship: 'strong',    reason: '2 лимитирующих субстрата глутатиона: Cys + Gly' },
  { primary: 'agmatine',    secondary: 'citrulline',      relationship: 'strong',    reason: '2 пути NO: eNOS-стимуляция + субстрат (citrulline→arginine→NO)' },
  { primary: 'berberine',   secondary: 'omega3',          relationship: 'strong',    reason: 'AMPK + PPAR-α — синергия липиды/глюкоза' },
  { primary: 'tudca',       secondary: 'milk_thistle',    relationship: 'conditional', reason: 'bile flow + мембраны', when: 'oral AAS OR ALT>60' },
  { primary: 'niacin',      secondary: 'garlic',          relationship: 'conditional', reason: 'HDL↑ + LDL↓', when: 'LDL>3.5 OR HDL<0.6' },
  { primary: 'saw_palmetto', secondary: 'tadalafil',      relationship: 'conditional', reason: 'ДГПЖ симптомы', when: 'prostate symptoms' },
  { primary: 'selenium',    secondary: 'iodine',         relationship: 'conditional', reason: '2 кофактора дейодиназы (T4→T3)', when: 'TSH>4' },
];

export interface SynergyResult {
  addedSubs: Array<{ id: string; reason: string; primary: string }>;
}

export function computeSynergy(
  subs: string[],
  ctx: { hasOral?: boolean; hct?: number; plt?: number; ldl?: number; hdl?: number; tsh?: number; prostateSymptoms?: boolean }
): SynergyResult {
  const addedSubs: Array<{ id: string; reason: string; primary: string }> = [];
  const canonSubs = new Set(subs.map(s => canonId(s)));

  const matchesCondition = (when: string | undefined): boolean => {
    if (!when) return true;
    switch (when) {
      case 'oral AAS OR ALT>60': return ctx.hasOral === true;
      case 'PLT>450 AND HCT>52': return (ctx.plt ?? 0) > 450 && (ctx.hct ?? 0) > 52;
      case 'LDL>3.5 OR HDL<0.6': return (ctx.ldl ?? 0) > 3.5 || (ctx.hdl ?? 0) < 0.6;
      case 'TSH>4':               return (ctx.tsh ?? 0) > 4;
      case 'prostate symptoms':   return ctx.prostateSymptoms === true;
      default: return true;
    }
  };

  for (const pair of SYNERGY_PAIRS) {
    const primaryCanon = canonId(pair.primary);
    if (!canonSubs.has(primaryCanon)) continue;
    const secondaryCanon = canonId(pair.secondary);
    if (canonSubs.has(secondaryCanon)) continue;  // уже есть

    if (pair.relationship === 'conditional' && !matchesCondition(pair.when)) continue;
    if (pair.relationship === 'strong') {
      // strong — добавляем с新三板 (но не mandatory) — добавляем только если есть контекст
      // на текущий момент добавляем всегда (как mandatory)
    }

    addedSubs.push({ id: pair.secondary, reason: pair.reason, primary: pair.primary });
    canonSubs.add(secondaryCanon);
  }

  return { addedSubs };
}