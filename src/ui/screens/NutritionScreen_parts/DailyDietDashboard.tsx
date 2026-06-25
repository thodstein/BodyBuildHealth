import React, { useMemo } from 'react';
import { FOOD_DB } from '../../../core/nutrition-database';
import { analyzeDailyDiet, getDefaultProfile, type DailyDietReport, type UserDietProfile } from '../../../engines/product-usefulness-v2.engine';
import { usePlanCtx } from './IndividualPlan/IndividualPlanContext';

const BAR_CSS: React.CSSProperties = { height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' };
const FILL = (pct: number, color: string): React.CSSProperties => ({ width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.3s' });

export const DailyDietDashboard: React.FC = () => {
  const ctx = usePlanCtx();
  const dayPlan = ctx.dayPlan;

  const report = useMemo<DailyDietReport | null>(() => {
    if (!dayPlan || !dayPlan.meals) return null;
    try {
      const profile: UserDietProfile = {
        ...getDefaultProfile(),
        weightKg: ctx.weight || 80,
        bodyFatPct: 15,
        lbm: (ctx.weight || 80) * 85 / 100,
        phase: 'LEAN_MASS',
        labs: {},
        pharma: {
          AAS_ORAL: false, AAS_INJECTABLE: false, HGH: false, DIURETICS: false,
          STIMULATORS: false, INSULIN_USE: false, SARMS_PROHORMONES: false, PCT_MEDS: false,
          LIVER_SUPPORT: false, GUT_SUPPORT: false, DETOX_SUPPORT: false,
          FIBER_SUPPLEMENT: false, DIGESTIVE_ENZYMES: false,
          VIT_MIN_SUPPLEMENT: false, OMEGA3_SUPPLEMENT: false,
        },
      };
      const meals = dayPlan.meals.map((m: any) => ({
        timing: undefined as any,
        products: (m.items || []).map((it: any) => ({ foodId: it.id, weightGrams: it.amount || 100 })),
      }));
      return analyzeDailyDiet(meals, profile);
    } catch { return null; }
  }, [dayPlan, ctx.weight]);

  if (!report) return null;

  const bars = [
    { key: 'mtor', label: 'mTOR', pct: report.mtorTriggered ? 100 : Math.min(100, (3000 - report.mtorDeficitMg) / 3000 * 100), color: report.mtorTriggered ? '#22c55e' : '#f59e0b', icon: '🧬' },
    { key: 'gi', label: 'ЖКТ', pct: Math.min(100, report.giLoad / 60 * 100), color: report.giLoadWarning ? '#ef4444' : '#22c55e', icon: '🫁' },
    { key: 'pral', label: 'PRAL', pct: report.pralWarning ? 80 : 30, color: report.pralWarning ? '#f59e0b' : '#22c55e', icon: '⚖' },
    { key: 'ammonia', label: 'Аммиак', pct: report.ammoniaRisk ? 80 : Math.min(100, report.ammoniaScore / 3 * 100), color: report.ammoniaRisk ? '#ef4444' : '#22c55e', icon: '💨' },
    { key: 'omega', label: 'Омега', pct: report.omegaWarning ? 80 : report.omegaRatio < 4 ? 30 : 60, color: report.omegaWarning ? '#f59e0b' : '#22c55e', icon: '🐟' },
    { key: 'electro', label: 'Электролиты', pct: report.electrolyteRisk ? 80 : 40, color: report.electrolyteRisk ? '#ef4444' : '#22c55e', icon: '⚡' },
    { key: 'insulin', label: 'Инсулин-Риск', pct: report.insulinRicohet ? 100 : 20, color: report.insulinRicohet ? '#ef4444' : '#22c55e', icon: '💉' },
  ];

  return (
    <div style={{ padding: '8px 0', marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>📊 Анализ рациона (v2)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        {bars.map(b => (
          <div key={b.key} style={{ padding: '4px 6px', borderRadius: 8, background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: b.color, marginBottom: 2 }}>
              <span>{b.icon} {b.label}</span>
              <span style={{ fontWeight: 700 }}>{Math.round(b.pct)}%</span>
            </div>
            <div style={BAR_CSS}><div style={FILL(b.pct, b.color)} /></div>
          </div>
        ))}
      </div>
      {report.mtorDeficitMg > 0 && !report.mtorTriggered && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.12)', fontSize: 7, color: '#f97316' }}>
          ⚠️ Не хватает {Math.round(report.mtorDeficitMg)} мг лейцина для mTOR
        </div>
      )}
      {report.insulinRicohet && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 7, color: '#ef4444' }}>
          🚨 Риск гипогликемии — замените сахар на амилопектин
        </div>
      )}
      {report.microDeficits.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
          ⚠️ Дефицит: {report.microDeficits.join(', ')}
        </div>
      )}
    </div>
  );
};
