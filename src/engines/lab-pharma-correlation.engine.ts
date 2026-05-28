import { LabPoint, CourseEntry } from '../core/types';
import { UCUM_MAP } from '../core/constants';

export interface LabDrugAlert {
  marker: string;
  value: number;
  unit: string;
  expectedRange: [number, number];
  actualStatus: 'high' | 'low' | 'normal';
  drugCause: string[];
  severity: 'low' | 'med' | 'high' | 'critical';
  recommendation: string;
}

// Клинически подтверждённые влияния препаратов на маркеры
const DRUG_MARKER_IMPACT: Record<string, Record<string, { effect: 'up' | 'down'; severity: number }>> = {
  'testosterone_enanthate': { 'HCT': { effect: 'up', severity: 0.7 }, 'E2': { effect: 'up', severity: 0.6 }, 'TT': { effect: 'up', severity: 1.0 }, 'LH': { effect: 'down', severity: 0.9 } },
  'trenbolone_acetate': { 'LDL': { effect: 'up', severity: 0.8 }, 'HDL': { effect: 'down', severity: 0.8 }, 'PRL': { effect: 'up', severity: 0.6 }, 'ALT': { effect: 'up', severity: 0.4 }, 'LH': { effect: 'down', severity: 0.95 } },
  'oxan': { 'LDL': { effect: 'up', severity: 0.9 }, 'HDL': { effect: 'down', severity: 0.9 }, 'ALT': { effect: 'up', severity: 0.8 } },
  'anastro': { 'E2': { effect: 'down', severity: 0.95 }, 'TT': { effect: 'up', severity: 0.3 }, 'LH': { effect: 'up', severity: 0.4 } },
  'caberg': { 'PRL': { effect: 'down', severity: 0.98 } },
  'nac': { 'ALT': { effect: 'down', severity: 0.6 }, 'AST': { effect: 'down', severity: 0.5 } },
  'telmi': { 'K': { effect: 'up', severity: 0.5 } },
  'clomi': { 'LH': { effect: 'up', severity: 0.9 }, 'FSH': { effect: 'up', severity: 0.9 }, 'TT': { effect: 'up', severity: 0.8 } }
};

export function analyzeLabDrugCorrelation(
  labs: LabPoint[],
  course: CourseEntry[],
  currentPhase: string
): LabDrugAlert[] {
  const alerts: LabDrugAlert[] = [];
  const activeDrugs = course.filter(c => c.endWeek >= 0);

  Object.entries(UCUM_MAP).forEach(([marker, meta]) => {
    const markerLabs = labs.filter(l => l.code.toUpperCase() === marker).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!markerLabs.length) return;

    const latest = markerLabs[0].value;
    const uln = meta.uln * (currentPhase === 'on_cycle' ? 1.25 : 1);
    const lln = meta.lln * (currentPhase === 'pct' ? 0.8 : 1);

    const impactingDrugs: string[] = [];
    let maxSeverity = 0;
    activeDrugs.forEach(d => {
      const impact = DRUG_MARKER_IMPACT[d.substanceId]?.[marker];
      if (impact) {
        impactingDrugs.push(d.substanceId);
        maxSeverity = Math.max(maxSeverity, impact.severity);
      }
    });

    const isHigh = latest > uln;
    const isLow = latest < lln;
    const status = isHigh ? 'high' : isLow ? 'low' : 'normal';

    if (status !== 'normal' && impactingDrugs.length > 0) {
      const dir = isHigh ? 'повышен' : 'понижен';
      let rec = 'Мониторинг и контроль динамики.';
      if (isHigh && impactingDrugs.some(id => id.includes('tren') || id.includes('oral'))) rec = 'Рассмотреть снижение доз или усилить гепато-/кардиопротекцию.';
      if (isLow && impactingDrugs.some(id => id.includes('anastro') || id.includes('caberg'))) rec = 'Пересмотреть дозировку ИА/агонистов дофамина. Возможен rebound-эффект.';
      if (marker === 'HCT' && isHigh) rec = 'Гидратация + контроль АД. При >54% – рассмотреть эксфузию.';

      alerts.push({
        marker,
        value: latest,
        unit: meta.prefUnit,
        expectedRange: [lln, uln],
        actualStatus: status,
        drugCause: impactingDrugs,
        severity: maxSeverity > 0.85 ? 'critical' : maxSeverity > 0.65 ? 'high' : maxSeverity > 0.45 ? 'med' : 'low',
        recommendation: rec
      });
    }
  });

  return alerts.sort((a, b) => b.severity.localeCompare(a.severity));
}