import React, { useMemo } from 'react';
import { derivePAL } from '../../../core/data-link';
import { calcNutrition } from '../../../engines/nutrition.engine';
import { MICRONUTRIENT_TARGETS } from '../../../core/constants';
import { nutritionMultipliers } from '../../../engines/risk-engine-v7-core';
import type { UserProfile } from '../../../core/types';

const NUTRITION_FACTOR_LABELS: Record<string, { label: string; desc: string; good: boolean }> = {
  renal_protein: { label: '', desc: '', good: false },
  cardio_fiber: { label: 'вќ¤пёЏ РљР»РµС‚С‡Р°С‚РєР° в†’ РЎРµСЂРґС†Рµ', desc: '', good: false },
  cardio_omega3: { label: '', desc: '', good: true },
  neuro_omega3: { label: '', desc: '', good: true },
  cardio_sodium: { label: '', desc: '', good: false },
  cardio_potassium: { label: '', desc: '', good: false },
};

export const NutritionOverview: React.FC<{
  profile: UserProfile | null;
  avgWeeklyKcal: number;
  avgWeeklyProtein: number;
  avgWeeklyFat: number;
  avgWeeklyCarbs: number;
  microsIntake?: Record<string, number>;
}> = ({ profile, avgWeeklyKcal, avgWeeklyProtein, avgWeeklyFat, avgWeeklyCarbs, microsIntake = {} }) => {
  const s = profile?.settings;
  const pal = profile ? derivePAL(s?.workoutsPerWeek, s?.avgWorkoutMinutes) : 1.55;

  const nutritionTargets = useMemo(() => {
    if (!profile) return null;
    return calcNutrition({
      weightKg: s?.weight ?? 80,
      heightCm: s?.height ?? 180,
      age: s?.age ?? 30,
      sex: s?.sex ?? 'male',
      pal,
      goal: s?.primaryGoal ?? s?.goal ?? 'health',
      bodyFatPercent: s?.bodyFat,
    });
  }, [profile, pal]);

  const v7Factors = useMemo(() => {
    if (!profile) return {};
    return nutritionMultipliers({
      proteinGPerKg: s?.proteinPerKg ?? 1.8,
      fiberG: s?.fiberG ?? 25,
      omega3G: s?.omega3G ?? 1.5,
      sodiumG: s?.sodiumG ?? 3.5,
      potassiumG: s?.potassiumG ?? 3.0,
    });
  }, [profile]);

  const pctKcal = nutritionTargets ? Math.min(150, Math.round((avgWeeklyKcal / nutritionTargets.kcal) * 100)) : 0;
  const pctProtein = nutritionTargets ? Math.min(150, Math.round((avgWeeklyProtein / nutritionTargets.protein) * 100)) : 0;
  const pctFat = nutritionTargets ? Math.min(150, Math.round((avgWeeklyFat / nutritionTargets.fats) * 100)) : 0;
  const pctCarbs = nutritionTargets ? Math.min(150, Math.round((avgWeeklyCarbs / nutritionTargets.carbs) * 100)) : 0;

  const goalInfo = s?.primaryGoal ? {
    bulk: '', cut: '', maintenance: '',
    strength: '', hypertrophy: '', recomposition: '',
    health: '', rehab: '', fitness: '',
    endurance: '',
  }[s.primaryGoal] || s.primaryGoal : '';

  return (
    <div className="nutrition-overview">
      {/* Main Macros Card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>рџ“Љ РљР‘Р–РЈ вЂ” {goalInfo}</h3>
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.1)', color: '#00e68a', fontWeight: 600 }}>
            PAL: {pal.toFixed(2)}
          </span>
        </div>

        {nutritionTargets && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
            BMR: {nutritionTargets.bmr} РєРєР°Р» | TDEE: {nutritionTargets.tdee} РєРєР°Р»
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { label: '', val: avgWeeklyKcal, target: nutritionTargets?.kcal ?? 0, unit: '', color: '#22c55e' },
            { label: '', val: avgWeeklyProtein, target: nutritionTargets?.protein ?? 0, unit: '', color: '#3b82f6' },
            { label: '', val: avgWeeklyFat, target: nutritionTargets?.fats ?? 0, unit: '', color: '#f97316' },
            { label: '', val: avgWeeklyCarbs, target: nutritionTargets?.carbs ?? 0, unit: '', color: '#a855f7' },
          ].map(m => {
            const pct = m.target > 0 ? Math.min(200, Math.round((m.val / m.target) * 100)) : 0;
            const status = pct < 80 ? 'в¬‡пёЏ' : pct > 110 ? 'в¬†пёЏ' : 'вњ…';
            return (
              <div key={m.label} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{m.label}</span>
                  <span style={{ fontSize: 10 }}>{status}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>
                  {Math.round(m.val)} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>/ {m.target} {m.unit}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 4, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: m.color, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{pct}% РѕС‚ С†РµР»Рё</div>
              </div>
            );
          })}
        </div>

            {nutritionTargets && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                <div style={{ background: 'rgba(59,130,246,0.08)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Р’РѕРґР°</div>
                  <div style={{ fontWeight: 700 }}>{nutritionTargets.water} Р»/Рґ</div>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.08)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>РљР»РµС‚С‡Р°С‚РєР°</div>
                  <div style={{ fontWeight: 700 }}>{nutritionTargets.fiber} Рі/Рґ</div>
                </div>
                <div style={{ background: 'rgba(249,115,22,0.08)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Mg/Zn/D3/C</div>
                  <div style={{ fontWeight: 600, fontSize: 10 }}>
                    {nutritionTargets.micros.Mg}/{nutritionTargets.micros.Zn}/{nutritionTargets.micros.VitD}/{nutritionTargets.micros.VitC}
                  </div>
                </div>
              </div>
            )}

            {/* Macro targets vs actual (enhanced display) */}
            {nutritionTargets && avgWeeklyKcal > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>рџЋЇ Р¦РµР»Рё vs Р¤Р°РєС‚</div>
                {[
                  { l: '', a: avgWeeklyKcal, t: nutritionTargets.kcal, u: '', c: '#22c55e' },
                  { l: '', a: avgWeeklyProtein, t: nutritionTargets.protein, u: '', c: '#3b82f6' },
                  { l: '', a: avgWeeklyFat, t: nutritionTargets.fats, u: '', c: '#f97316' },
                  { l: '', a: avgWeeklyCarbs, t: nutritionTargets.carbs, u: '', c: '#a855f7' },
                ].map(m => {
                  const pct = m.t > 0 ? Math.min(150, Math.round((m.a / m.t) * 100)) : 0;
                  const color = pct >= 85 && pct <= 115 ? '#22c55e' : pct < 85 ? '#ff9100' : '#ef4444';
                  return (
                    <div key={m.l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 10 }}>
                      <span style={{ minWidth: 55, color: 'var(--text-dim)' }}>{m.l}</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: m.c, borderRadius: 3 }} />
                        <div style={{ position: 'absolute', left: '85%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.3)' }} />
                      </div>
                      <span style={{ color, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{Math.round(m.a)}/{m.t}{m.u}</span>
                      <span style={{ color, fontSize: 9, minWidth: 24, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Micronutrient intake vs targets */}
            {Object.keys(microsIntake).length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>рџ§Є РњРёРєСЂРѕРЅСѓС‚СЂРёРµРЅС‚С‹ (РґРЅРµРІРЅР°СЏ РЅРѕСЂРјР°)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  {Object.entries(MICRONUTRIENT_TARGETS).slice(0, 9).map(([key, target]) => {
                    const microMap: Record<string, string> = {
                      Mg: 'Mg', Zn: 'Zn', VitD: 'VitD', VitC: 'VitC', VitB12: 'VitB12',
                      Omega3_EPA_DHA: 'Omega3', Potassium: 'K', Sodium: 'Na', Iron: 'Fe',
                    };
                    const tag = microMap[key] || key;
                    const intake = microsIntake[tag] || 0;
                    const pct = target.amount > 0 ? Math.min(200, Math.round((intake / target.amount) * 100)) : 0;
                    const color = pct < 50 ? '#ef4444' : pct < 80 ? '#ff9100' : '#22c55e';
                    return (
                      <div key={key} style={{ background: 'var(--bg-secondary)', padding: '4px 6px', borderRadius: 4, fontSize: 9 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>{key === 'Omega3_EPA_DHA' ? 'O3' : key}</span>
                          <span style={{ color }}>{pct}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 2, height: 3, marginTop: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 2 }} />
                        </div>
                        <div style={{ color: 'var(--text-dim)', marginTop: 1 }}>
                          {intake}/{target.amount}{target.unit}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
      </div>

      {/* V7 Nutrition Risk Factors */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>рџ”¬ Р’Р»РёСЏРЅРёРµ РїРёС‚Р°РЅРёСЏ РЅР° СЂРёСЃРєРё (V7)</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
          РљР°Рє РІР°С€Рё РїР°СЂР°РјРµС‚СЂС‹ РїРёС‚Р°РЅРёСЏ РІР»РёСЏСЋС‚ РЅР° СЂРёСЃРє-СЂР°СЃС‡С‘С‚ РІ V7 РґРІРёР¶РєРµ. РљРѕСЌС„С„РёС†РёРµРЅС‚ РІС‹С€Рµ 1.0 = СѓСЃРёР»РµРЅРёРµ СЂРёСЃРєР°, РЅРёР¶Рµ 1.0 = СЃРЅРёР¶РµРЅРёРµ.
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {Object.entries(v7Factors).map(([key, factor]) => {
            const info = NUTRITION_FACTOR_LABELS[key];
            if (!info) return null;
            const pct = Math.round((factor as number) * 100);
            const barColor = (factor as number) < 1 ? '#22c55e' : (factor as number) > 1 ? '#ef4444' : '#6b7280';
            const isGood = info.good;
            const isFactorGood = (factor as number) <= 1.0;
            const statusIcon = isGood ? (isFactorGood ? 'вњ…' : 'вљ пёЏ') : (isFactorGood ? 'вњ…' : '');
            return (
              <div key={key} style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{statusIcon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{info.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{info.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 60, background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(10, Math.abs(pct - 70) * 3 + 10))}%`,
                        height: '100%', background: barColor, borderRadius: 3,
                      }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: barColor, minWidth: 36, textAlign: 'right' }}>
                      Г—{(factor as number).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current nutrition parameters from profile */}
        <div style={{ marginTop: 10, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>РўРµРєСѓС‰РёРµ РїР°СЂР°РјРµС‚СЂС‹ РїРёС‚Р°РЅРёСЏ (РџСЂРѕС„РёР»СЊ в†’ V7 РџР°СЂР°РјРµС‚СЂС‹):</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}>
            {[
              { label: '', val: s?.proteinPerKg ?? 1.8, unit: '' },
              { label: '', val: s?.fiberG ?? 25, unit: '' },
              { label: '', val: s?.omega3G ?? 1.5, unit: '' },
              { label: '', val: s?.sodiumG ?? 3.5, unit: '' },
              { label: '', val: s?.potassiumG ?? 3.0, unit: '' },
              { label: '', val: s?.dailyWaterLiters ?? 2.5, unit: '' },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>{p.label}:</span>
                <span style={{ fontWeight: 600 }}>{p.val} {p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
