// ============================================================
// TZRiskMatrix.tsx — 49-cell risk matrix display (TZ engine)
// Shows: 7 systems × 7 mechanisms with raw/net risk percentages
// ============================================================

import React, { useMemo, useState } from 'react';
import { useDataLink } from '../../../core/data-link';
import { calculateTZRisk, type TZRiskResult } from '../../../engines/risk-engine-tz';
import { MECHANISM_NAMES, SYSTEM_NAMES_RU, CORE_SYSTEMS_V7 } from '../../../engines/risk-engine-v7-matrix';

const GLASS: React.CSSProperties = {
  background: 'rgba(24,24,27,0.15)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 12,
  padding: 12,
};

export const TZRiskMatrix: React.FC = () => {
  const linked = useDataLink();
  const maxCourseWeeks = useMemo(() => {
    const c = linked.course || [];
    if (!c.length) return 12;
    return Math.max(...c.map(e => (e.endWeek || 12) - (e.startWeek || 0)), 8);
  }, [linked.course]);
  const [sliderWeek, setSliderWeek] = useState(() => Math.round(maxCourseWeeks * 0.5));

  // Load support substance IDs from same source as RiskScreen
  const supportIds = useMemo(() => {
    try {
      const sr = JSON.parse(localStorage.getItem('he_support_risk') || 'null');
      if (sr && Array.isArray(sr.subs)) return sr.subs.map((id: string) => id.toLowerCase());
    } catch {}
    return [];
  }, []);

  const tzResult = useMemo<TZRiskResult | null>(() => {
    if (!linked.profile) return null;
    const s = linked.profile.settings;
    try {
      return calculateTZRisk({
        course: linked.course || [],
        labs: linked.labs || [],
        genetics: {},
        nutrition: {
          proteinPerKg: (s.weight || 80) > 0 ? ((s.nutritionFactor ?? 0.8) * 160) / (s.weight || 80) : 1.8,
          fiberG: 25, omega3G: 1.5, sodiumG: 3, potassiumG: 3, waterL: 2, calories: 2500,
        },
        training: {
          hasHIIT: (s.workoutsPerWeek ?? 3) >= 4,
          weeklyMinutes: (s.workoutsPerWeek ?? 3) * (s.avgWorkoutMinutes ?? 60),
          volumeTonnes: 8000, lissMinutesPerWeek: 60,
        },
        weight: s.weight ?? 80, age: s.age ?? 30,
        sex: (s.sex ?? 'male') as 'male' | 'female',
        supportSubstances: supportIds,
        courseWeek: sliderWeek,
      });
    } catch { return null; }
  }, [linked.profile, linked.course, linked.labs, sliderWeek, supportIds]);

  if (!tzResult) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Загрузка данных профиля и курса...</div>;
  }

  const riskColor = (v: number) => v > 60 ? '#ef4444' : v > 40 ? '#f59e0b' : v > 20 ? '#fbbf24' : '#22c55e';
  const cellBg = (v: number) => v > 60 ? 'rgba(239,68,68,0.12)' : v > 40 ? 'rgba(245,158,11,0.1)' : v > 20 ? 'rgba(251,191,36,0.08)' : 'rgba(34,197,94,0.05)';

  return (
    <div style={{ ...GLASS, marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>🧬 ТЗ Risk — вероятностная модель</div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
            Risk = 1 − ∏(1 − baseRisk × D × G × L × N × T) · геом. среднее
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 12, fontWeight: 800 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Raw</div>
            <span style={{ color: riskColor(tzResult.overallRaw) }}>{tzResult.overallRaw}%</span>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 18 }}>/</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Net</div>
            <span style={{ color: riskColor(tzResult.overallNet) }}>{tzResult.overallNet}%</span>
          </div>
        </div>
      </div>

      {/* Week slider */}
      <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3 }}>📅 Неделя курса: {sliderWeek}</div>
        <input type="range" min={1} max={Math.max(2, maxCourseWeeks)} value={sliderWeek}
          onChange={e => setSliderWeek(parseInt(e.target.value))}
          style={{ width: '100%', height: 4, accentColor: 'var(--accent)', cursor: 'pointer' }} />
      </div>

      {/* Per-system bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {CORE_SYSTEMS_V7.map((sys: string) => {
          const sr = tzResult.systems[sys];
          if (!sr || sr.raw === 0) return null;
          const label = SYSTEM_NAMES_RU[sys] || sys;
          return (
            <div key={sys}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-light)', minWidth: 100 }}>{label}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(100, sr.raw)}%`, background: riskColor(sr.raw), borderRadius: 4, opacity: 0.4, transition: 'width 0.5s' }} />
                  <div style={{ position: 'absolute', top: 2, left: 0, height: 4, width: `${Math.min(100, sr.net)}%`, background: riskColor(sr.net), borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: riskColor(sr.raw), minWidth: 42, textAlign: 'right' }}>{sr.raw}% → {sr.net}%</span>
              </div>
              {/* Mechanism mini-cells */}
              <div style={{ display: 'flex', gap: 2, marginLeft: 106 }}>
                {[1, 2, 3, 4, 5, 6, 7].map(mi => {
                  const cell = sr.mechanisms[mi];
                  const v = cell?.raw ?? 0;
                  return (
                    <div key={mi} title={`${MECHANISM_NAMES[sys]?.[mi] || `M${mi}`}: ${v}% → ${cell?.net ?? v}%\nG:${cell?.geneticMult ?? 1} L:${cell?.labFactor ?? 1} N:${cell?.nutritionFactor ?? 1} T:${cell?.trainingFactor ?? 1}`} style={{
                      flex: 1, height: 6, borderRadius: 2, background: cellBg(v), cursor: 'pointer', position: 'relative',
                    }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.min(100, v)}%`, background: riskColor(v), borderRadius: 2, opacity: 0.7 }} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ fontSize: 7, color: 'var(--text-dim)', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span>D = доза</span><span>G = генетика</span><span>L = лабы</span>
        <span>N = питание</span><span>T = тренировки</span><span>∏ = вероятн. модель</span>
      </div>
    </div>
  );
};

export default TZRiskMatrix;
