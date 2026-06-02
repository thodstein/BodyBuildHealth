import { MASTER_DB, initMasterDB } from '../master-db';
import type { MasterDB as IMasterDB, SubstanceEntry, InteractionEntry, GoalProfile, AnalysisEntry } from '../types';

class DataRegistry {
  private static instance: DataRegistry;
  private initialized = false;

  static getInstance(): DataRegistry {
    if (!DataRegistry.instance) DataRegistry.instance = new DataRegistry();
    return DataRegistry.instance;
  }

  async init(dataDir: string = './data') {
    if (this.initialized) return;
    await initMasterDB(dataDir);
    this.initialized = true;
  }

  getDB(): IMasterDB {
    if (!this.initialized) throw new Error('Registry not initialized. Call init() first.');
    return MASTER_DB;
  }

  getSubstance(id: string): SubstanceEntry | undefined {
    return MASTER_DB.substances.find((s: SubstanceEntry) => s.id === id || s.name.toLowerCase().includes(id.toLowerCase()));
  }

  getInteraction(a: string, b: string): InteractionEntry | undefined {
    return MASTER_DB.interactions.find((i: InteractionEntry) => 
      (i.substanceA === a && i.substanceB === b) || (i.substanceA === b && i.substanceB === a)
    );
  }

  getGoal(id: string): GoalProfile | undefined {
    return MASTER_DB.goals.find((g: GoalProfile) => g.id === id);
  }

  getAnalysis(id: string): AnalysisEntry | undefined {
    return MASTER_DB.analyses.find((a: AnalysisEntry) => a.id.toUpperCase() === id.toUpperCase());
  }
}

export const registry = DataRegistry.getInstance();
