// Stack burden lite — эвристика по AEBM Stack Extension v1.2 (Zenodo 19684131).
// SFY = FY1*1.0 + FY2*0.4 + FY3*0.2 + FYk*0.1 (k>=4), cap 5.0; SBB = Σ(w*ΣBB*K_d); Stack_BYR = SBB/SFY.
// Эвристика, требует калибровки — НЕ диагноз. Сырой линейный Σ оставлен в UI как «сырой».
import { DRUG_THRESHOLDS } from '../core/constants';

export interface StackItem {
  drug: string;
  doseMgWeek: number;
}

// Функциональный выход FY: доза/порог, кап 2.0 (насыщение рецептора).
function fyOf(it: StackItem): number {
  const th = DRUG_THRESHOLDS[it.drug]?.dosePerWeek ?? 300;
  if (!(th > 0)) return 0.5;
  return Math.min(2, Math.max(0, it.doseMgWeek / th));
}

// Нагрузка BB: доза/порог × (андрогенность/100 + 0.5). Без выдумок дозозависимых органов — один скаляр.
function bbOf(it: StackItem): number {
  const dt = DRUG_THRESHOLDS[it.drug];
  const ar = (dt?.androgenicity ?? 50) / 100;
  const th = dt?.dosePerWeek ?? 300;
  const ratio = th > 0 ? it.doseMgWeek / th : 1;
  return Math.max(0, ratio * (ar + 0.5));
}

function isTren(id: string): boolean {
  return /tren/i.test(id || '');
}

export interface StackBurden {
  raw: number;
  sfy: number;
  sbb: number;
  index: number;
  label: string;
  note: string;
}

const W = [1.0, 0.4, 0.2];

export function stackBurdenLite(items: StackItem[]): StackBurden {
  const list = (items || []).filter((x) => x && x.doseMgWeek > 0);
  if (list.length === 0)
    return { raw: 0, sfy: 0, sbb: 0, index: 0, label: 'Пусто', note: 'Эвристика по AEBM v1.2, требует калибровки' };
  const fys = list.map(fyOf).sort((a, b) => b - a);
  let sfy = 0;
  fys.forEach((f, i) => {
    sfy += f * (i < W.length ? W[i] : 0.1);
  });
  sfy = Math.min(5, sfy);
  const hasTren = list.some((x) => isTren(x.drug));
  const kN = hasTren ? 1.4 : 1.0; // канонический доминантный усилитель
  const sbb = list.reduce((s, x) => s + bbOf(x), 0) * kN;
  const raw = list.reduce((s, x) => {
    const dt = DRUG_THRESHOLDS[x.drug];
    const th = dt?.dosePerWeek ?? 300;
    return s + (th > 0 ? x.doseMgWeek / th : 1) * (dt?.androgenicity ?? 0);
  }, 0);
  const index = sfy > 0 ? sbb / sfy : 0;
  const label = index >= 2 ? 'Высокая нагрузка' : index >= 1 ? 'Умеренная — следи за давлением и липидами' : 'Низкая — мягкий курс';
  return {
    raw: Math.round(raw * 100) / 100,
    sfy: Math.round(sfy * 100) / 100,
    sbb: Math.round(sbb * 100) / 100,
    index: Math.round(index * 100) / 100,
    label,
    note: 'Эвристика по AEBM Stack v1.2 (SFY с затуханием + K_N трена 1.40). Требует калибровки, не диагноз.',
  };
}
