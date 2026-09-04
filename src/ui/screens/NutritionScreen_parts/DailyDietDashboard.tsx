import React, { useMemo } from 'react';
import { FOOD_DB } from '../../../core/nutrition-database';
import { analyzeDailyDiet, getDefaultProfile, type DailyDietReport, type UserDietProfile } from '../../../engines/product-usefulness-v2.engine';
import { calculateMealHGI, type HGIMealInput } from '../../../engines/nutrition-hgi.engine';
import { FOOD_DRUG_INTERACTIONS, type FoodDrugInteraction } from '../../../engines/nutrition-pharma-interactions';
import { usePlanCtx } from './IndividualPlan/IndividualPlanContext';

const BAR_CSS: React.CSSProperties = { height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' };
const FILL = (pct: number, color: string): React.CSSProperties => ({ width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.3s' });

export const DailyDietDashboard: React.FC = () => {
  const ctx = usePlanCtx();
  const dayPlan = ctx.dayPlan;

  const report = useMemo<DailyDietReport | null>(() => {
    if (!dayPlan || !dayPlan.meals) return null;
    try {
      const pharma = ctx.v2Pharma || {};
      const labs = ctx.v2Labs || {};
      const profile: UserDietProfile = {
        ...getDefaultProfile(),
        weightKg: ctx.weight || 80,
        bodyFatPct: ctx.bodyFatPct ?? 15,
        lbm: (ctx.weight || 80) * (100 - (ctx.bodyFatPct ?? 15)) / 100,
        phase: (ctx.v2Phase || 'LEAN_MASS') as any,
        labs: {
          hematocrit: parseFloat(labs.hematocrit) || undefined,
          hemoglobin: parseFloat(labs.hemoglobin) || undefined,
          hdl: parseFloat(labs.hdl) || undefined,
          ldl: parseFloat(labs.ldl) || undefined,
          alt: parseFloat(labs.alt) || undefined,
          ast: parseFloat(labs.ast) || undefined,
          crp: parseFloat(labs.crp) || undefined,
          testosterone: parseFloat(labs.testosterone) || undefined,
        },
        pharma: {
          AAS_ORAL: !!pharma.AAS_ORAL, AAS_INJECTABLE: !!pharma.AAS_INJECTABLE,
          HGH: !!pharma.HGH, DIURETICS: !!pharma.DIURETICS,
          STIMULATORS: !!pharma.STIMULATORS, INSULIN_USE: !!pharma.INSULIN_USE,
          SARMS_PROHORMONES: !!pharma.SARMS, PCT_MEDS: !!pharma.PCT_MEDS,
          LIVER_SUPPORT: !!pharma.LIVER_SUPPORT, GUT_SUPPORT: !!pharma.GUT_SUPPORT,
          DETOX_SUPPORT: !!pharma.DETOX_SUPPORT, FIBER_SUPPLEMENT: !!pharma.FIBER,
          DIGESTIVE_ENZYMES: !!pharma.ENZYMES, VIT_MIN_SUPPLEMENT: !!pharma.VIT_MIN,
          OMEGA3_SUPPLEMENT: !!pharma.OMEGA3,
        },
      };
      const meals = dayPlan.meals.map((m: any) => ({
        timing: undefined as any,
        products: (m.items || []).map((it: any) => ({ foodId: it.id, weightGrams: it.amount || 100 })),
      }));
      return analyzeDailyDiet(meals, profile);
    } catch (e) { console.error('DailyDietDashboard error:', e); return null; }
  }, [dayPlan, ctx.weight, ctx.bodyFatPct, ctx.v2Phase, ctx.v2Labs, ctx.v2Pharma]);

  const hgiResult = useMemo(() => {
    if (!dayPlan || !dayPlan.meals) return null;
    const allFoods = dayPlan.meals.flatMap((m: any) =>
      (m.items || []).map((it: any) => ({
        name: it.name || '',
        kcal: it.kcal || 0,
        protein: it.p || 0,
        fat: it.f || 0,
        carbs: it.c || 0,
        fiber: it.fiber || 0,
        gi: it.gi,
      }))
    );
    if (!allFoods.length) return null;
    return calculateMealHGI({ foods: allFoods });
  }, [dayPlan]);

  const foodDrugWarnings = useMemo(() => {
    const pharma = ctx.v2Pharma || {};
    const activeDrugClasses: string[] = [];
    if (pharma.AAS_ORAL) activeDrugClasses.push('oral_17aa', 'testosterone');
    if (pharma.AAS_INJECTABLE) activeDrugClasses.push('testosterone');
    if (pharma.SARMS) activeDrugClasses.push('sarm');
    if (pharma.PCT_MEDS) activeDrugClasses.push('pct_serm', 'pct_aromatase', 'pct_dopamine');
    if (pharma.HGH) activeDrugClasses.push('hgh');
    if (pharma.INSULIN_USE) activeDrugClasses.push('insulin');
    if (pharma.STIMULATORS) activeDrugClasses.push('stimulants');
    if (activeDrugClasses.length === 0) return [];
    return FOOD_DRUG_INTERACTIONS.filter(
      i => activeDrugClasses.includes(i.drugClass)
    );
  }, [ctx.v2Pharma]);

  if (!report) return null;

  const hgi = hgiResult;
  const bars = [
    { key: 'mtor', label: 'mTOR', pct: report.mtorTriggered ? 100 : Math.min(100, (3000 - report.mtorDeficitMg) / 3000 * 100), color: report.mtorTriggered ? '#22c55e' : '#f59e0b', icon: '🧬' },
    { key: 'gi', label: 'ЖКТ', pct: Math.min(100, report.giLoad / 60 * 100), color: report.giLoadWarning ? '#ef4444' : '#22c55e', icon: '🫁' },
    { key: 'pral', label: 'PRAL', pct: report.pralWarning ? 80 : 30, color: report.pralWarning ? '#f59e0b' : '#22c55e', icon: '⚖' },
    { key: 'ammonia', label: 'Аммиак', pct: report.ammoniaRisk ? 80 : Math.min(100, report.ammoniaScore / 3 * 100), color: report.ammoniaRisk ? '#ef4444' : '#22c55e', icon: '💨' },
    { key: 'omega', label: 'Омега', pct: report.omegaWarning ? 80 : report.omegaRatio < 4 ? 30 : 60, color: report.omegaWarning ? '#f59e0b' : '#22c55e', icon: '🐟' },
    { key: 'electro', label: 'K/Mg', pct: report.electrolyteRisk ? 80 : 40, color: report.electrolyteRisk ? '#ef4444' : '#22c55e', icon: '⚡' },
    { key: 'insulin', label: 'Инсулин', pct: report.insulinRicohet ? 100 : 20, color: report.insulinRicohet ? '#ef4444' : '#22c55e', icon: '💉' },
    { key: 'cortisol', label: 'Кортизол', pct: report.cortisolRisk ? 80 : 20, color: report.cortisolRisk ? '#f59e0b' : '#22c55e', icon: '🧠' },
    { key: 'micro', label: 'Микро', pct: report.microDeficits.length > 0 ? 60 : 20, color: report.microDeficits.length > 0 ? '#f59e0b' : '#22c55e', icon: '💊' },
    ...(hgi ? [{ key: 'hgi', label: 'HGI', pct: hgi.hgiScore, color: hgi.color, icon: '🍚' }] : []),
  ];

  return (
    <div className="nut-dailydiet" style={{ padding: '8px 0', marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>📊 Анализ рациона (v2)</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Ккал: {Math.round(report.totalKcal)} | DIAAS: {report.diaas.toFixed(2)} | PRAL: {report.pralTotal.toFixed(1)} | Омега-6/3: {report.omegaRatio.toFixed(1)} | Гистамин: {report.histamineSensitive ? '⚠️ Чувствителен' : '✅ Норма'}</div>
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
      {report.cortisolRisk && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.12)', fontSize: 7, color: '#f59e0b' }}>
          ⚠️ Кортизоловый риск — недостаточно быстрых углеводов после тренировки
        </div>
      )}
      {report.insulinRicohet && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 7, color: '#ef4444' }}>
          🚨 Риск гипогликемии — замените сахар на амилопектин
        </div>
      )}
      {report.electrolyteRisk && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 7, color: '#ef4444' }}>
          🚨 Электролитный срыв! Калий {report.potassiumMg}мг/Магний {report.magnesiumMg}мг. Добавьте шпинат/курагу
        </div>
      )}
      {report.giLoadWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)', fontSize: 7, color: '#f97316' }}>
          ⚠️ Высокая нагрузка ЖКТ — подключите ферменты
        </div>
      )}
      {report.pralWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)', fontSize: 7, color: '#f59e0b' }}>
          ⚖️ {report.pralWarning} (PRAL {report.pralTotal.toFixed(1)})
        </div>
      )}
      {report.omegaWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)', fontSize: 7, color: '#f59e0b' }}>
          🐟 {report.omegaWarning}
        </div>
      )}
      {report.microDeficits.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>
          ⚠️ Дефицит: {report.microDeficits.join(', ')}
        </div>
      )}
      {report.homaIr !== null && report.homaIr > 2.5 && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', fontSize: 7, color: '#ef4444' }}>
          🚨 HOMA-IR {report.homaIr.toFixed(1)}{' > 2.5 — инсулинорезистентность'}
        </div>
      )}
      {report.ammoniaRisk && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 7, color: '#ef4444' }}>
          💨 Аммиак-риск: {report.ammoniaScore.toFixed(1)} балла. Высокая аммиачная нагрузка — добавьте цитруллин/аргинин, снизьте глютамин
        </div>
      )}
      {report.diaasWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: report.diaas >= 1.0 ? 'rgba(0,230,138,0.06)' : 'rgba(249,115,22,0.06)', border: `1px solid ${report.diaas >= 1.0 ? 'rgba(0,230,138,0.1)' : 'rgba(249,115,22,0.1)'}`, fontSize: 7, color: report.diaas >= 1.0 ? '#00e68a' : '#f59e0b' }}>
          {report.diaasWarning}
        </div>
      )}
      {report.antinutrientWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)', fontSize: 7, color: '#f59e0b' }}>
          {report.antinutrientWarning}
        </div>
      )}
      {report.glutathioneWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)', fontSize: 7, color: '#f59e0b' }}>
          {report.glutathioneWarning}
        </div>
      )}
      {report.histamineWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', fontSize: 7, color: '#ef4444' }}>
          {report.histamineWarning}
        </div>
      )}

      {hgi && hgi.recommendations.length > 0 && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)', fontSize: 7, color: '#f59e0b' }}>
          🍚 HGI {hgi.hgiScore} ({hgi.label}) — {hgi.recommendations[0]}
        </div>
      )}

      {foodDrugWarnings.length > 0 && (
        <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>⚠ Взаимодействие еды и препаратов</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {foodDrugWarnings.slice(0, 4).map((w, i) => (
              <div key={i} style={{ fontSize: 7, padding: '3px 5px', borderRadius: 4, background: w.severity === 'CRITICAL' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)', color: w.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b', lineHeight: 1.3 }}>
                {w.severity === 'CRITICAL' ? '🔴' : w.severity === 'HIGH' ? '🟡' : '🟢'} {w.effect}. {w.recommendation}
              </div>
            ))}
            {foodDrugWarnings.length > 4 && (
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', padding: '2px 4px' }}>
                + ещё {foodDrugWarnings.length - 4} взаимодействий
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic recommendations based on diet report */}
      {(() => {
        const recs: { text: string; priority: 'high' | 'medium' | 'low'; icon: string }[] = [];
        if (report.mtorDeficitMg > 0 && !report.mtorTriggered) recs.push({ priority: 'high', icon: '🧬', text: `Добавьте ${Math.round(report.mtorDeficitMg)} мг лейцина (ещё 1 порция курицы/говядины/яиц)` });
        if (report.giLoadWarning) recs.push({ priority: 'high', icon: '🫃', text: `Нагрузка ЖКТ ${report.giLoad.toFixed(0)} — добавьте ферменты (панкреатин, бромелайн)` });
        if (report.pralWarning) recs.push({ priority: 'medium', icon: '🧂', text: `PRAL ${report.pralTotal.toFixed(1)} — ${report.pralWarning === 'Закисление' ? 'добавьте зелень, лимоны, овощи' : 'уберите избыток воды/соды'}` });
        if (report.ammoniaRisk) recs.push({ priority: 'high', icon: '💨', text: `Аммиак ${report.ammoniaScore.toFixed(1)} — добавьте цитруллин 3-6 г/д или снизьте глютамин, увеличьте клетчатку` });
        if (report.omegaWarning) recs.push({ priority: 'medium', icon: '🐟', text: `Омега-6/3 ${report.omegaRatio.toFixed(1)}:1 — добавьте EPA/DHA 1-2 г/д, снизьте растительные масла` });
        if (report.electrolyteRisk) recs.push({ priority: 'high', icon: '💧', text: `K ${report.potassiumMg}мг/Mg ${report.magnesiumMg}мг — добавьте шпинат 200г/курагу 100г/авокадо` });
        if (report.insulinRicohet) recs.push({ priority: 'high', icon: '💉', text: `Риск гипогликемии — замените сахар/фруктозу на амилопектин/изомальтулозу` });
        if (report.cortisolRisk) recs.push({ priority: 'medium', icon: '🧠', text: `Кортизоловый риск — добавьте 30-40г быстрых углеводов (декстроза/рисовые вафли) после тренировки` });
        if (report.microDeficits.length > 0) recs.push({ priority: 'medium', icon: '💊', text: `Дефициты: ${report.microDeficits.join(', ')} — добавьте соответствующие продукты/добавки` });
        if (report.homaIr !== null && report.homaIr > 2.5) recs.push({ priority: 'high', icon: '🔬', text: `HOMA-IR ${report.homaIr.toFixed(1)} >2.5 — добавьте берберин 500 мг 2x/д, хром 200 мкг, снизьте сахар` });
        if (report.diaas < 0.9) recs.push({ priority: 'high', icon: '💪', text: `DIAAS ${report.diaas.toFixed(2)} — лимитирует ${report.diaasLimitingAA}. Смешайте источники белка (животный+растительный)` });
        if (report.antinutrientWarning) recs.push({ priority: 'low', icon: '🌿', text: `${report.antinutrientWarning} — замачивайте/проращивайте бобовые, термически обрабатывайте` });
        if (report.glutathioneWarning) recs.push({ priority: 'medium', icon: '🧪', text: `${report.glutathioneWarning} — добавьте NAC 600 мг, селен 200 мкг, серу (MSM/крестоцветные)` });
        if (report.histamineWarning) recs.push({ priority: 'medium', icon: '🧪', text: `${report.histamineWarning} — иИсключите ферментированные продукты, добавьте DAO-фермент` });
        if (recs.length === 0) return null;
        const prioColors = { high: '#ef4444', medium: '#f59e0b', low: '#8b5cf6' };
        const prioOrder = { high: 0, medium: 1, low: 2 };
        recs.sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority]);
        return (
          <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>📋 Рекомендации на основе рациона</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {recs.map((r, i) => (
                <div key={i} style={{ fontSize: 7, padding: '4px 6px', borderRadius: 6, background: `${prioColors[r.priority]}08`, border: `1px solid ${prioColors[r.priority]}15`, color: prioColors[r.priority], lineHeight: 1.4 }}>
                  {r.icon} {r.text}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

