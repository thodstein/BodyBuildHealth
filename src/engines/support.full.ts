import { RiskResult } from '../core/types';

export interface SupportItem {
  id: string; name: string; dose: string; category: 'supplement' | 'pharma' | 'peptide';
  covers: string[]; synergy: string; contraindications?: string[];
  mechanisms: Record<string, number>; // mechanismId -> coverage 0..1
}

export interface SupportStack {
  items: SupportItem[];
  coverageMap: Record<string, number>;
  netRisk: Record<string, number>;
  totalCost?: number;
}

// Полная база поддержки (ТЗ §10.1–10.13, фрагмент для демо)
const SUPPORT_DB: SupportItem[] = [
  { id:'telmi', name:'Телмисартан 40-80 мг', dose:'1×40-80 мг утро', category:'pharma',
    covers:['cardio_2','cardio_3','renal_1','renal_2'], synergy:'+Небилет/Таурин: АД/ЧСС контроль',
    mechanisms:{ cardio_2:0.55, cardio_3:0.45, renal_1:0.50, renal_2:0.40 } },
  { id:'nac', name:'NAC 1200 мг', dose:'2×600 мг с едой', category:'supplement',
    covers:['hepatic_3','hepatic_2','hepatic_4'], synergy:'+TUDCA: гепатопротекция',
    mechanisms:{ hepatic_3:0.45, hepatic_2:0.50, hepatic_4:0.35 } },
  { id:'tudeca', name:'TUDCA 1000 мг', dose:'1000 мг/день с едой', category:'supplement',
    covers:['hepatic_1','hepatic_5'], synergy:'+NAC: синергия по фиброзу',
    mechanisms:{ hepatic_1:0.65, hepatic_5:0.50 } },
  { id:'omega3', name:'Омега-3 (EPA/DHA) 3 г', dose:'2 г EPA + 1 г DHA', category:'supplement',
    covers:['cardio_1','cardio_4','cardio_5','neuro_4'], synergy:'+Телмисартан: кардиориск -45%',
    mechanisms:{ cardio_1:0.40, cardio_4:0.35, cardio_5:0.30, neuro_4:0.25 } },
  { id:'magnesium', name:'Магний бисглицинат 400 мг', dose:'400 мг вечер', category:'supplement',
    covers:['neuro_2','neuro_3','neuro_6','cardio_7'], synergy:'+L-теанин: сон/стресс',
    mechanisms:{ neuro_2:0.45, neuro_3:0.50, neuro_6:0.35, cardio_7:0.30 } },
  { id:'berberine', name:'Берберин 1000 мг', dose:'2×500 мг до еды', category:'supplement',
    covers:['endocrine_4','cardio_1'], synergy:'+Ретрутид: чувствительность к инсулину',
    mechanisms:{ endocrine_4:0.50, cardio_1:0.20 } },
  { id:'hcg', name:'HCG 500 МЕ', dose:'2×/нед (3/1)', category:'pharma',
    covers:['repro_1','repro_2'], synergy:'Профилактика атрофии тестикул',
    mechanisms:{ repro_1:0.60, repro_2:0.40 } },
  { id:'udca', name:'УДХК (Урсосан) 1000 мг', dose:'2×500 мг с едой', category:'pharma',
    covers:['hepatic_1','hepatic_2'], synergy:'+NAC/TUDCA: полный цикл гепатопротекции',
    mechanisms:{ hepatic_1:0.60, hepatic_2:0.45 } }
];

export function generateSupportStack(
  rawRisks: Record<string, number>,
  genetics: Record<string, string> = {},
  userDrugs: string[] = []
): SupportStack {
  const selected: SupportItem[] = [];
  const threshold = 35; // raw risk порог для назначения

  // Простое правило: если raw > threshold → добавляем препарат
  if (rawRisks['cardio'] > threshold) selected.push(SUPPORT_DB[0], SUPPORT_DB[3]);
  if (rawRisks['hepatic'] > threshold) selected.push(SUPPORT_DB[1], SUPPORT_DB[2]);
  if (rawRisks['neuro'] > threshold) selected.push(SUPPORT_DB[4]);
  if (rawRisks['endocrine'] > threshold) selected.push(SUPPORT_DB[5]);
  if (rawRisks['reproductive'] > threshold) selected.push(SUPPORT_DB[6]);

  // Убираем дубликаты
  const unique = [...new Map(selected.map(i => [i.id, i])).values()];

  // Рассчитываем покрытие
  const coverage: Record<string, number> = {};
  Object.keys(rawRisks).forEach(sys => {
    for(let m=1; m<=7; m++) {
      const mechId = `${sys}_${m}`;
      coverage[mechId] = unique.reduce((sum, item) => sum + (item.mechanisms[mechId] || 0), 0);
      if(coverage[mechId] > 1) coverage[mechId] = 1;
    }
  });

  // Пересчёт net risk (ТЗ §13.2)
  const netRisk: Record<string, number> = {};
  Object.entries(rawRisks).forEach(([sys, raw]) => {
    let product = 1;
    for(let m=1; m<=7; m++) {
      const mechId = `${sys}_${m}`;
      const cov = coverage[mechId] || 0;
      product *= (1 - cov);
    }
    netRisk[sys] = Math.round(raw * product);
  });

  return { items: unique, coverageMap: coverage, netRisk };
}