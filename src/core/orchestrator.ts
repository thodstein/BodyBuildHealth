import { InputController } from './utils/input-controller';
import { registry } from './data/registry';
import { ReportEngine } from '../engines/report-engine';
import type { RawInput } from './utils/input-controller';

export interface OrchestratorResult {
  score: any; report: any; plan: any;
}

export const Orchestrator = {
  async run(rawInput: RawInput): Promise<OrchestratorResult> {
    const input = InputController.normalize(rawInput);
    const db = registry.getDB();

    // 1. Маппинг веществ → эффекты → механизмы
    const mappedSubstances = input.substances.map(s => {
      const sub = db.substances.find(sub => sub.id === s.id) || { id: s.id, name: s.id, category: 'unknown', route: [], effects: [] };
      const effectList = s.effects.map(eId => db.effects.find(e => e.id === eId)).filter(Boolean);
      const mechanismList = [...new Set(effectList.flatMap(e => (e as any).mechanisms || []))];
      return { ...sub, effects: effectList, mechanisms: mechanismList };
    });

    // 2. Считаем индексы и риски
    const score = {
      total_risk: mappedSubstances.length * 50, // Упрощённо, в реальности подтягивается из risk-calculator
      risk_after_support: Math.max(0, mappedSubstances.length * 30),
      risks: db.risks.slice(0, 5), systems: db.systems.slice(0, 4), organs: db.organs.slice(0, 4), mechanisms: []
    };

    // 3. Генерируем отчёт
    const report = ReportEngine.generateReport({
      total_risk: score.total_risk, risk_after_support: score.risk_after_support,
      risks: score.risks, systems: score.systems, organs: score.organs, mechanisms: [],
      interactions: db.interactions, recommendations: db.recommendations
    });

    // 4. Генерируем план
    const plan = {
      morning: mappedSubstances.filter(s => ['stimulants', 'nootropics'].includes(s.category)).slice(0, 4),
      day: mappedSubstances.filter(s => ['metabolic', 'cardio', 'immune'].includes(s.category)).slice(0, 4),
      evening: mappedSubstances.filter(s => ['anti_stress', 'sleep', 'hormones'].includes(s.category)).slice(0, 4)
    };

    return { score, report, plan };
  }
};