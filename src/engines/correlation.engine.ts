export interface CorrelationInsight {
  id: string;
  title: string;
  impact: 'low' | 'med' | 'high';
  effort: 'low' | 'med' | 'high';
  reason: string;
}

export function analyzeCorrelations(data: any[]): CorrelationInsight[] {
  const insights: CorrelationInsight[] = [];
  
  // Простая заглушка для демонстрации
  insights.push({
    id: 'corr_1',
    title: 'Lab Trend Analysis',
    impact: 'med',
    effort: 'low',
    reason: 'Basic correlation detected between markers'
  });
  
  return insights;
}
