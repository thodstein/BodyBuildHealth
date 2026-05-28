export interface ReportInput {
  total_risk: number; risk_after_support: number; risks: any[]; systems: any[];
  organs: any[]; mechanisms: any[]; interactions: any[]; recommendations: any[];
}

export const ReportEngine = {
  generateReport(input: ReportInput) {
    const { total_risk, risk_after_support, risks, systems, organs, mechanisms, interactions, recommendations } = input;
    return {
      summary: {
        total_risk, risk_after_support, risk_level: this.getRiskLevel(total_risk),
        top_systems: this.top(systems, 2), top_organs: this.top(organs, 2), top_mechanisms: this.top(mechanisms, 2)
      },
      risks: this.top(risks, 5),
      systems: this.sort(systems),
      organs: this.sort(organs),
      mechanisms: this.sort(mechanisms),
      interactions: this.sort(interactions),
      recommendations: this.unique(recommendations)
    };
  },

  getRiskLevel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 600) return 'HIGH';
    if (score >= 300) return 'MEDIUM';
    return 'LOW';
  },

  top(arr: any[], n: number) {
    return arr.sort((a: any, b: any) => b.score - a.score).slice(0, n);
  },

  sort(arr: any[]) {
    return arr.sort((a: any, b: any) => b.score - a.score);
  },

  unique(arr: any[]) {
    const map: Record<string, boolean> = {};
    return arr.filter((item: any) => {
      const key = item.rec_id || item.id || item.title;
      if (map[key]) return false;
      map[key] = true;
      return true;
    });
  }
};