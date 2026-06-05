import { LabPoint, CourseEntry } from '../core/types';
import { calculateMultiSubstancePKPD } from './pkpd-superposition.engine';
import { calculateIndices } from './clinical-indices.engine';
import { calcAdherence } from './nutrition-tracker.engine';

export interface HealthScoreResult {
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  vector: string;
  breakdown: { pharma: number; labs: number; nutrition: number };
  recommendations: string[];
}

function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }

export function calculateHealthScore(
  labs: LabPoint[],
  course: CourseEntry[],
  nutritionLog: Array<{ date: string; total: { kcal: number; p: number; f: number; c: number; fiber: number; water: number; steps: number } }>,
  targetKcal: number,
  targetProtein: number
): HealthScoreResult {
  // 1. Р¤Р°СЂРјР°-РЅР°РіСЂСѓР·РєР° (РѕР±СЂР°С‚РЅРѕ РїСЂРѕРїРѕСЂС†РёРѕРЅР°Р»СЊРЅР°: РјРµРЅСЊС€Рµ С‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ = РІС‹С€Рµ СЃРєРѕСЂ)
  const pkpd = calculateMultiSubstancePKPD(course, 4);
  const avgCp = pkpd.length ? pkpd.reduce((s, w) => s + w.cp, 0) / pkpd.length : 0;
  const avgTol = pkpd.length ? pkpd.reduce((s, w) => s + w.tol, 0) / pkpd.length : 0;
  const pharmaScore = pkpd.length ? clamp(100 - (avgCp / 500 * 60) - (avgTol * 40)) : 50;

  // 2. Р›Р°Р±РѕСЂР°С‚РѕСЂРЅС‹Р№ СЃС‚Р°С‚СѓСЃ (РЅР° Р±Р°Р·Рµ РёРЅРґРµРєСЃРѕРІ Рё РѕС‚РєР»РѕРЅРµРЅРёР№)
  const indices = calculateIndices(labs);
  let labDeviations = 0;
  Object.values(indices).forEach(idx => {
    if ('status' in idx && idx.status !== 'normal' && idx.status !== 'optimal') labDeviations++;
  });
  const labsScore = clamp(100 - (labDeviations * 15));

  // 3. РќСѓС‚СЂРёС‚РёРІРЅС‹Р№ adherence (СЃСЂРµРґРЅРµРµ Р·Р° РїРѕСЃР»РµРґРЅРёРµ 7 РґРЅРµР№)
  const recentLogs = nutritionLog.slice(-7);
  const adherenceScores = recentLogs.map(l => {
    const target = { bmr: 0, tdee: 0, kcal: targetKcal, protein: targetProtein, fats: 0, carbs: 0, water: 0, fiber: 0, micros: {} };
    return calcAdherence(l.total, target).score;
  });
  const nutritionScore = recentLogs.length ? clamp(Math.round(adherenceScores.reduce((a,b)=>a+b,0)/recentLogs.length)) : 50;

  // РС‚РѕРі
  const score = Math.round(pharmaScore * 0.35 + labsScore * 0.45 + nutritionScore * 0.20);
  const trend = score > 65 ? 'improving' : score > 45 ? 'stable' : 'declining';
  const vector = trend === 'improving' ? 'рџџў РљСѓСЂСЃ РїРµСЂРµРЅРѕСЃРёС‚СЃСЏ С…РѕСЂРѕС€Рѕ. РџСЂРѕРґРѕР»Р¶Р°С‚СЊ РјРѕРЅРёС‚РѕСЂРёРЅРі.' : trend === 'stable' ? 'рџџЎ РЎС‚Р°Р±РёР»СЊРЅС‹Р№ РїСЂРѕС„РёР»СЊ. РЈСЃРёР»РёС‚СЊ РїРѕРґРґРµСЂР¶РєСѓ РїРµС‡РµРЅРё/Р»РёРїРёРґРѕРІ.' : 'рџ”ґ РџСЂРѕРіСЂРµСЃСЃРёСЂСѓСЋС‰Р°СЏ РЅР°РіСЂСѓР·РєР°. Р Р°СЃСЃРјРѕС‚СЂРµС‚СЊ СЃРЅРёР¶РµРЅРёРµ РґРѕР· РёР»Рё РїР°СѓР·Сѓ.';

  const recommendations: string[] = [];
  if (pharmaScore < 60) recommendations.push('вљ пёЏ Р’С‹СЃРѕРєР°СЏ РєРѕРЅС†РµРЅС‚СЂР°С†РёСЏ/С‚РѕР»РµСЂР°РЅС‚РЅРѕСЃС‚СЊ. Р Р°СЃСЃРјРѕС‚СЂРµС‚СЊ РґРµР»РѕРґ РёР»Рё СЃРЅРёР¶РµРЅРёРµ РґРѕР·С‹.');
  if (labsScore < 70) recommendations.push('рџ©ё РћС‚РєР»РѕРЅРµРЅРёСЏ РІ РјР°СЂРєРµСЂР°С…. РЎРІРµСЂСЊС‚РµСЃСЊ СЃ РєР»РёРЅРёС‡РµСЃРєРёРјРё РёРЅРґРµРєСЃР°РјРё РІРѕ РІРєР»Р°РґРєРµ "Р›Р°Р±С‹".');
  if (nutritionScore < 60) recommendations.push('рџҐ— РќРёР·РєРёР№ adherence. РЎРєРѕСЂСЂРµРєС‚РёСЂСѓР№С‚Рµ Р‘Р–РЈ Рё РІРѕРґРЅС‹Р№ Р±Р°Р»Р°РЅСЃ РїРѕ РїР»Р°РЅРёСЂРѕРІС‰РёРєСѓ.');
  if (recommendations.length === 0) recommendations.push('вњ… Р’СЃРµ СЃРёСЃС‚РµРјС‹ РІ РїСЂРµРґРµР»Р°С… С†РµР»РµРІС‹С… РґРёР°РїР°Р·РѕРЅРѕРІ.');

  return { score, trend, vector, breakdown: { pharma: Math.round(pharmaScore), labs: Math.round(labsScore), nutrition: Math.round(nutritionScore) }, recommendations };
}
