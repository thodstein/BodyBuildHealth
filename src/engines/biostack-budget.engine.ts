import { findSupplements, buildStack, type FinderQuery } from './supplement-finder.engine';
import type { FinderProfile } from './supplement-finder.engine';
import { SUPPORT_CATALOG_DATA } from '../data/support-database';
import { PRICE_RUB, estCost } from '../ui/components/BioStackAIConstants';

/* ─── Cost per substance ─── */
function getCost(id: string): number {
  return PRICE_RUB[id] || estCost(id);
}

/* ─── Build budget-optimized stack ─── */
export interface BudgetStackResult {
  stack: string[];
  totalCost: number;
  mechanismCoverage: number;
  organCoverage: string[];
  savings: Array<{ original: string; replaced: string; saved: number }>;
  message: string;
}

export function buildBudgetStack(
  profile: FinderProfile,
  maxBudget: number,
  goalSystems?: string[],
  preExisting?: string[]
): BudgetStackResult {
  // Get all recommended substances
  const allSubs = findSupplements({ profile, maxResults: 100 });
  if (allSubs.length === 0) {
    return { stack: [], totalCost: 0, mechanismCoverage: 0, organCoverage: [], savings: [], message: 'Не найдено подходящих БАДов' };
  }

  // Score each substance: coverageScore / cost = "value per ruble"
  type Scored = { id: string; name: string; cost: number; mechanisms: string[]; organs: string[]; valueScore: number };
  const scored: Scored[] = [];

  for (const match of allSubs) {
    const cat = SUPPORT_CATALOG_DATA[match.id];
    if (!cat) continue;
    const cost = getCost(match.id);
    if (cost <= 0) continue;
    const mechs = (cat.mechanisms || []).length;
    const organs = (cat.organs || []).length;
    const valueScore = (mechs * 3 + organs * 2 + match.relevanceScore) / cost;
    scored.push({
      id: match.id, name: cat.nameRu || cat.name || match.id, cost,
      mechanisms: cat.mechanisms || [], organs: cat.organs || [],
      valueScore,
    });
  }

  // Sort by value per ruble (descending)
  scored.sort((a, b) => b.valueScore - a.valueScore);

  // Greedy selection: pick highest-value items until budget exhausted
  const selected: Scored[] = [];
  const preIds = new Set(preExisting || []);
  let totalCost = 0;
  const coveredMechs = new Set<string>();
  const coveredOrgans = new Set<string>();

  for (const item of scored) {
    if (preIds.has(item.id)) {
      selected.push(item);
      item.mechanisms.forEach(m => coveredMechs.add(m));
      item.organs.forEach(o => coveredOrgans.add(o));
      continue;
    }
    if (totalCost + item.cost > maxBudget) continue;
    // Avoid duplicates by mechanism overlap > 60%
    const newMechs = item.mechanisms.filter(m => !coveredMechs.has(m));
    if (newMechs.length === 0 && item.mechanisms.length > 0) continue;

    selected.push(item);
    totalCost += item.cost;
    item.mechanisms.forEach(m => coveredMechs.add(m));
    item.organs.forEach(o => coveredOrgans.add(o));
  }

  // If budget remains, try to add substances covering goal systems
  if (goalSystems?.length) {
    for (const item of scored) {
      if (selected.find(s => s.id === item.id)) continue;
      if (totalCost + item.cost > maxBudget) continue;
      const hitsGoal = item.organs.some(o => goalSystems.includes(o));
      if (!hitsGoal) continue;
      selected.push(item);
      totalCost += item.cost;
      item.mechanisms.forEach(m => coveredMechs.add(m));
      item.organs.forEach(o => coveredOrgans.add(o));
    }
  }

  // Build savings report: compare to "premium" stack
  const fullStack = buildStack({ baseIds: preExisting || [], targetSize: selected.length, autoFill: true, profile });
  const fullCost = fullStack.stack.reduce((s, id) => s + getCost(id), 0);
  const savings: BudgetStackResult['savings'] = [];

  const budgetIds = new Set(selected.map(s => s.id));
  for (const premiumId of fullStack.stack) {
    if (budgetIds.has(premiumId)) continue;
    const pc = getCost(premiumId);
    const pn = SUPPORT_CATALOG_DATA[premiumId]?.nameRu || SUPPORT_CATALOG_DATA[premiumId]?.name || premiumId;
    if (pc > 500) {
      savings.push({ original: pn, replaced: 'исключено', saved: pc });
    }
  }

  return {
    stack: selected.map(s => s.id),
    totalCost: Math.round(totalCost),
    mechanismCoverage: coveredMechs.size,
    organCoverage: [...coveredOrgans],
    savings,
    message: totalCost > maxBudget
      ? `⚠ Превышение бюджета: ${Math.round(totalCost)}₽ из ${maxBudget}₽`
      : `✅ Стек уложен в бюджет: ${Math.round(totalCost)}₽ из ${maxBudget}₽ (экономия ~${Math.round(fullCost - totalCost)}₽)`,
  };
}

/* ─── Quick cost analysis of existing stack ─── */
export interface CostBreakdown {
  substanceId: string;
  name: string;
  costPerMonth: number;
  tier: string;
  cheaperAlternative?: { id: string; name: string; cost: number; saving: number };
}

export function getStackCostBreakdown(stackIds: string[]): CostBreakdown[] {
  return stackIds.map(id => {
    const cat = SUPPORT_CATALOG_DATA[id];
    const name = cat?.nameRu || cat?.name || id;
    const cost = getCost(id);
    const tier = cat?.tier || 'standard';
    return { substanceId: id, name, costPerMonth: cost, tier };
  });
}
