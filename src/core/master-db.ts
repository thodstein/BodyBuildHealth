import { EFFECTS_DB } from '../data/effects';
import { MECHANISMS_DB } from '../data/mechanisms';
import { RECOMMENDATIONS_DB } from '../data/recommendations';
import { RISKS_DB } from '../data/risks';
import { AXES_DB } from './data/axes';
import { BANDS_DB } from './data/bands';
import { CATEGORIES_DB } from './data/categories';
import { HORMONAL_AXES_DB } from './data/hormonal-axes';
import { INTERACTION_LINKS_DB } from './data/interaction-links';
import { INTERACTIONS_DB } from '../data/interactions';
import substancesJson from '../substances.json';
import interactionsJson from '../interactions.json';
import type { 
  EffectEntry, SubstanceEntry, InteractionEntry, GoalProfile, StackTemplate, StackEntry,
  AnalysisEntry, OrganEntry, SystemEntry, MechanismEntry, AxisEntry, RiskEntry,
  RecommendationEntry, TagEntry, BrandEntry, BandEntry, AliasMap, GroupMap,
  InteractionType, Severity
} from './types';

// Define the types from the data files
interface EffectData {
  id: string;
  type: string;
  description: string;
  riskId: string;
}

interface MechanismData {
  id: string;
  name: string;
  systemsUp: string[];
  systemsDown: string[];
}

interface RiskData {
  id: string;
  name: string;
  organs: string[];
  symptoms: string[];
  levels: string[];
  description: string;
}

interface AxisData {
  id: string;
  name: string;
  organs: string[];
  description: string;
}

interface BrandData {
  id: string;
  name: string;
  type: string;
  country: string;
}

interface CategoryData {
  id: string;
  name: string;
  parent?: string;
}

interface HormonalAxisData {
  id: string;
  name: string;
  glands: string[];
  hormones: string[];
  description: string;
}

interface InteractionLinkData {
  id: string;
  substanceA: string;
  substanceB: string;
  type: string;
  description: string;
}

interface InteractionData {
  substanceA: string;
  substanceB: string;
  type: string;
  severity: string;
  effect: string;
  mechanisms: string[];
}

interface BandData {
  id: string;
  name: string;
  country: string;
  type: string;
}

// Mapping functions
function mapEffect(e: EffectData): EffectEntry {
  return {
    id: e.id,
    effect: e.description,
    class: e.type,
    group: '',
    strengthBase: 0,
    strengthMax: 0,
    mechanisms: [],
    organs: [],
    risks: [],
    synergy: [],
    antagonists: [],
    duration: { onset: 'fast', peak: '', halfLife: '', decay: 'fast' },
    pkpd: { emax: 0, ec50: 0, doseResponse: 'linear', tissueDistribution: {}, receptorAffinity: {}, metabolism: [], elimination: [] },
    coverage: {},
    coverageScore: 0,
    riskScore: 0,
  };
}

function mapMechanism(m: MechanismData): MechanismEntry {
  return {
    id: m.id,
    name: m.name,
    level: 0,
    category: '',
    description: '',
    organs: [],
    systems: [],
    biomarkers: [],
    effectsPositive: [],
    effectsNegative: [],
    riskWeight: 0,
  };
}

function mapRecommendation(r: { recId: string; type: string; riskId: string; level: string; title: string; text: string }): RecommendationEntry {
  return {
    recId: r.recId,
    type: r.type,
    riskId: r.riskId,
    level: r.level as Severity,
    title: r.title,
    text: r.text,
  };
}

function mapRisk(r: RiskData): RiskEntry {
  const levelStr = r.levels[0] ?? 'LOW';
  let level: Severity;
  switch (levelStr) {
    case 'LOW': level = 'LOW'; break;
    case 'MEDIUM': level = 'MEDIUM'; break;
    case 'HIGH': level = 'HIGH'; break;
    case 'CRITICAL': level = 'CRITICAL'; break;
    default: level = 'LOW';
  }
  return {
    id: r.id,
    title: r.name,
    text: r.description,
    level: level,
    triggerType: '',
    recId: undefined,
  };
}

function mapAxis(a: AxisData): AxisEntry {
  return {
    id: a.id,
    name: a.name,
    organs: a.organs,
    description: a.description,
    mechanismUp: '',
    mechanismDown: '',
    riskUp: '',
    riskDown: '',
    pathway: undefined,
    tags: undefined,
    type: undefined,
  };
}

function mapBand(b: BandData): BandEntry {
  return {
    id: b.id,
    name: b.name,
    country: b.country,
    description: '',
    tag: b.type,
  };
}

function mapInteraction(i: InteractionData): InteractionEntry {
  const severityMap: { [key: string]: number } = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };
  const interactionTypeMap: { [key: string]: InteractionType } = {
    SYNERGY: 'synergy',
    CONFLICT: 'conflict',
    DANGER: 'danger',
    CAUTION: 'caution',
  };
  return {
    substanceA: i.substanceA,
    substanceB: i.substanceB,
    type: interactionTypeMap[i.type.toUpperCase()] ?? 'synergy',
    severity: severityMap[i.severity.toUpperCase()] ?? 1,
    mechanisms: i.mechanisms,
    description: i.effect,
  };
}

// Map substances from JSON
const substances: SubstanceEntry[] = (substancesJson as any[]).map((s: any) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  route: s.route ?? [],
  effects: s.effects ?? [],
  tHalfHours: s.tHalfHours,
  bioavailability: s.bioavailability,
  mechanisms: s.mechanisms ?? [],
  risks: s.risks ?? [],
  description: s.description ?? '',
}));

// Map interactions from JSON
const interactions: InteractionEntry[] = (interactionsJson as any[]).map(mapInteraction);

// Map other data
const effects: EffectEntry[] = EFFECTS_DB.map(mapEffect);
const mechanisms: MechanismEntry[] = MECHANISMS_DB.map(mapMechanism);
const recommendations: RecommendationEntry[] = RECOMMENDATIONS_DB.map(mapRecommendation);
const risks: RiskEntry[] = RISKS_DB.map(mapRisk);
const axes: AxisEntry[] = AXES_DB.map(mapAxis);
const bands: BandEntry[] = BANDS_DB.map(mapBand);

// For categories, hormonal axes, interaction links: we don't have a place in MasterDB, but we might need to store them elsewhere? We'll ignore for now.

// Initialize the rest with empty arrays
const goals: GoalProfile[] = [];
const stackTemplates: StackTemplate[] = [];
const stacks: StackEntry[] = [];
const analyses: AnalysisEntry[] = [];
const organs: OrganEntry[] = [];
const systems: SystemEntry[] = [];
const tags: TagEntry[] = [];
const brands: BrandEntry[] = [];

// Alias maps and groups
const aliasMap: AliasMap = {};
const substanceGroups: GroupMap = {};
const effectGroups: GroupMap = {};
const synergyMatrix: Record<string, Record<string, number>> = {};
const conflictMatrix: Record<string, Record<string, number>> = {};

// Assemble the MASTER_DB object
export const MASTER_DB = {
  effects,
  substances,
  interactions,
  goals,
  stackTemplates,
  stacks,
  analyses,
  organs,
  systems,
  mechanisms,
  axes,
  risks,
  recommendations,
  tags,
  bands,
  brands,
  aliases: aliasMap,
  substanceGroups,
  effectGroups,
  synergyMatrix,
  conflictMatrix,
};

export async function initMasterDB(dataDir: string = './data'): Promise<void> {
  // Placeholder for async initialization
  return Promise.resolve();
}

