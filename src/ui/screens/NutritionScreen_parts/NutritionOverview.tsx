import React, { useMemo } from 'react';
import { derivePAL } from '../../../core/data-link';
import { calcNutrition } from '../../../engines/nutrition.engine';
import { MICRONUTRIENT_TARGETS } from '../../../core/constants';
import { nutritionMultipliers } from '../../../engines/risk-engine-v7-core';
import type { UserProfile } from '../../../core/types';

const NUTRITION_FACTOR_LABELS: Record<string, { label: string; desc: string; good: boolean }> = {
  renal_protein: { label: '🫘 Белок → Почки', desc: 'Высокое потребление белка (более 2.2 г/кг) увеличивает нагрузку на почки', good: false },
  cardio_fiber: { label: '❤️ Клетчатка → Сердце', desc: 'Низкое потребление клетчатки (менее 20 г/д) увеличивает риск дислипидемии', good: false },
  cardio_omega3: { label: '🫀 Омега-3 → Сердце', desc: 'Достаточное потребление омега-3 (от 2 г/д) снижает кардиориск на 25%', good: true },
  neuro_omega3: { label: '🧠 Омега-3 → Нейро', desc: 'Омега-3 ≥2 г/д снижает нейровоспаление на 20%', good: true },
  cardio_sodium: { label: '🧂 Натрий → Сердце', desc: 'Избыток натрия (более 5 г/д) повышает АД и кардиориск', good: false },
  cardio_potassium: { label: '🍌 Калий → Сердце', desc: 'Дефицит калия (менее 2 г/д) повышает риск аритмий', good: false },
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
    bulk: 'Набор массы', cut: 'Сушка', maintenance: 'Поддержание',
    strength: 'Сила', hypertrophy: 'Гипертрофия', recomposition: 'Рекомпозиция',
    health: 'Здоровье', rehab: 'Восстановление', fitness: 'Фитнес',
    endurance: 'Выносливость',
  }[s.primaryGoal] || s.primaryGoal : 'Не указана';

  return (
    <div className="nutrition-overview">
      {/* Main Macros Card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>📊 КБЖУ — {goalInfo}</h3>
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.1)', color: '#00e68a', fontWeight: 600 }}>
            PAL: {pal.toFixed(2)}
          </span>
        </div>

        {nutritionTargets && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
            BMR: {nutritionTargets.bmr} ккал | TDEE: {nutritionTargets.tdee} ккал
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Калории', val: avgWeeklyKcal, target: nutritionTargets?.kcal ?? 0, unit: 'ккал', color: '#22c55e' },
            { label: 'Белки', val: avgWeeklyProtein, target: nutritionTargets?.protein ?? 0, unit: 'г', color: '#3b82f6' },
            { label: 'Жиры', val: avgWeeklyFat, target: nutritionTargets?.fats ?? 0, unit: 'г', color: '#f97316' },
            { label: 'Углеводы', val: avgWeeklyCarbs, target: nutritionTargets?.carbs ?? 0, unit: 'г', color: '#a855f7' },
          ].map(m => {
            const pct = m.target > 0 ? Math.min(200, Math.round((m.val / m.target) * 100)) : 0;
            const status = pct < 80 ? '⬇️' : pct > 110 ? '⬆️' : '✅';
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
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{pct}% от цели</div>
              </div>
            );
          })}
        </div>

            {nutritionTargets && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
                <div style={{ background: 'rgba(59,130,246,0.08)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Вода</div>
                  <div style={{ fontWeight: 700 }}>{nutritionTargets.water} л/д</div>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.08)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Клетчатка</div>
                  <div style={{ fontWeight: 700 }}>{nutritionTargets.fiber} г/д</div>
                </div>
                <div style={{ background: 'rgba(249,115,22,0.08)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Mg/Zn/D3/C</div>
                  <div style={{ fontWeight: 600, fontSize: 10 }}>
                    {nutritionTargets.micros.Mg}/{nutritionTargets.micros.Zn}/{nutritionTargets.micros.VitD}/{nutritionTargets.micros.VitC}
                  </div>
                </div>
              </div>
            )}

            {/* Micronutrient intake vs targets */}
            {Object.keys(microsIntake).length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>🧪 Микронутриенты (дневная норма)</div>
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
        <h3 style={{ margin: '0 0 8px 0' }}>🔬 Влияние питания на риски (V7)</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
          Как ваши параметры питания влияют на риск-расчёт в V7 движке. Коэффициент выше 1.0 = усиление риска, ниже 1.0 = снижение.
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {Object.entries(v7Factors).map(([key, factor]) => {
            const info = NUTRITION_FACTOR_LABELS[key];
            if (!info) return null;
            const pct = Math.round((factor as number) * 100);
            const barColor = (factor as number) < 1 ? '#22c55e' : (factor as number) > 1 ? '#ef4444' : '#6b7280';
            const isGood = info.good;
            const isFactorGood = (factor as number) <= 1.0;
            const statusIcon = isGood ? (isFactorGood ? '✅' : '⚠️') : (isFactorGood ? '✅' : '🔴');
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
                      ×{(factor as number).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current nutrition parameters from profile */}
        <div style={{ marginTop: 10, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Текущие параметры питания (Профиль → V7 Параметры):</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}>
            {[
              { label: 'Белок', val: s?.proteinPerKg ?? 1.8, unit: 'г/кг' },
              { label: 'Клетчатка', val: s?.fiberG ?? 25, unit: 'г/д' },
              { label: 'Омега-3', val: s?.omega3G ?? 1.5, unit: 'г/д' },
              { label: 'Натрий', val: s?.sodiumG ?? 3.5, unit: 'г/д' },
              { label: 'Калий', val: s?.potassiumG ?? 3.0, unit: 'г/д' },
              { label: 'Вода', val: s?.dailyWaterLiters ?? 2.5, unit: 'л/д' },
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
