import { MASTER_DB } from '../core/master-db';
import type { RiskEntry, RecommendationEntry, LabPoint } from '../core/types';

export interface RiskAssessment {
  totalScore: number; // 0-100 (чем меньше, тем лучше)
  activeRisks: RiskEntry[];
  recommendations: RecommendationEntry[];
}

/**
 * Оценивает риски стека + пользователя.
 */
export function assessRisk(
  substanceIds: string[], 
  userLabs: LabPoint[] = []
): RiskAssessment {
  const activeRisks: RiskEntry[] = [];
  const recommendations: RecommendationEntry[] = [];
  let score = 0;

  // 1. Риски от веществ (берем из tags или прямых связей, если они есть в substances.csv)
  // В текущей базе риски связаны через interpretations и risks.csv
  // Упрощенно: добавляем базовый риск за каждое вещество
  substanceIds.forEach(id => {
    const sub = MASTER_DB.substances.find(s => s.id === id);
    if (sub?.risk_tags) {
       // Ищем риски по тегам
       const relatedRisks = MASTER_DB.risks.filter(r => 
         sub.risk_tags?.includes(r.risk_id || r.id) || 
         r.risk_tags?.includes(sub.category || '')
       );
       activeRisks.push(...relatedRisks);
       score += relatedRisks.length * 5;
    }
  });

  // 2. Анализ лабораторных данных
  userLabs.forEach(lab => {
    const analysisRef = MASTER_DB.analyses.find(a => a.id === lab.code);
    if (analysisRef) {
      const [min, max] = analysisRef.normalRange;
      if (lab.value > max || lab.value < min) {
        // Лабораторное отклонение -> добавляем риск
        const risk = MASTER_DB.risks.find(r => r.id === `LAB_${lab.code}_ABNORMAL`);
        if (risk) activeRisks.push(risk);
        
        // Ищем рекомендации для этого отклонения
        const recs = MASTER_DB.recommendations.filter(rec => 
          rec.trigger_type === lab.code || rec.title.includes(lab.code)
        );
        recommendations.push(...recs);
        
        score += 15;
      }
    }
  });

  // 3. Дедупликация рисков и рекомендаций
  const uniqueRisks = Array.from(new Set(activeRisks.map(r => r.id)))
    .map(id => activeRisks.find(r => r.id === id)!);
  
  const uniqueRecs = Array.from(new Set(recommendations.map(r => r.recId)))
    .map(id => recommendations.find(r => r.recId === id)!);

  return {
    totalScore: Math.min(100, score),
    activeRisks: uniqueRisks,
    recommendations: uniqueRecs
  };
}