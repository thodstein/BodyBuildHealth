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

  if (!report) return null;

  const bars = [
    { key: 'mtor', label: 'mTOR', pct: report.mtorTriggered ? 100 : Math.min(100, (3000 - report.mtorDeficitMg) / 3000 * 100), color: report.mtorTriggered ? '#22c55e' : '#f59e0b', icon: 'рџ§¬' },
    { key: 'gi', label: 'Р–РљРў', pct: Math.min(100, report.giLoad / 60 * 100), color: report.giLoadWarning ? '#ef4444' : '#22c55e', icon: 'рџ«Ѓ' },
    { key: 'pral', label: 'PRAL', pct: report.pralWarning ? 80 : 30, color: report.pralWarning ? '#f59e0b' : '#22c55e', icon: 'вљ–' },
    { key: 'ammonia', label: 'РђРјРјРёР°Рє', pct: report.ammoniaRisk ? 80 : Math.min(100, report.ammoniaScore / 3 * 100), color: report.ammoniaRisk ? '#ef4444' : '#22c55e', icon: 'рџ’Ё' },
    { key: 'omega', label: 'РћРјРµРіР°', pct: report.omegaWarning ? 80 : report.omegaRatio < 4 ? 30 : 60, color: report.omegaWarning ? '#f59e0b' : '#22c55e', icon: 'рџђџ' },
    { key: 'electro', label: 'K/Mg', pct: report.electrolyteRisk ? 80 : 40, color: report.electrolyteRisk ? '#ef4444' : '#22c55e', icon: 'вљЎ' },
    { key: 'insulin', label: 'РРЅСЃСѓР»РёРЅ', pct: report.insulinRicohet ? 100 : 20, color: report.insulinRicohet ? '#ef4444' : '#22c55e', icon: 'рџ’‰' },
    { key: 'cortisol', label: 'РљРѕСЂС‚РёР·РѕР»', pct: report.cortisolRisk ? 80 : 20, color: report.cortisolRisk ? '#f59e0b' : '#22c55e', icon: 'рџ§ ' },
    { key: 'micro', label: 'РњРёРєСЂРѕ', pct: report.microDeficits.length > 0 ? 60 : 20, color: report.microDeficits.length > 0 ? '#f59e0b' : '#22c55e', icon: 'рџ’Љ' },
  ];

  return (
    <div style={{ padding: '8px 0', marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>рџ“Љ РђРЅР°Р»РёР· СЂР°С†РёРѕРЅР° (v2)</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>РљРєР°Р»: {Math.round(report.totalKcal)} | DIAAS: {report.diaas.toFixed(2)} | PRAL: {report.pralTotal.toFixed(1)} | РћРјРµРіР°-6/3: {report.omegaRatio.toFixed(1)} | Р“РёСЃС‚Р°РјРёРЅ: {report.histamineSensitive ? 'вљ пёЏ Р§СѓРІСЃС‚РІРёС‚РµР»РµРЅ' : 'вњ… РќРѕСЂРјР°'}</div>
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
          вљ пёЏ РќРµ С…РІР°С‚Р°РµС‚ {Math.round(report.mtorDeficitMg)} РјРі Р»РµР№С†РёРЅР° РґР»СЏ mTOR
        </div>
      )}
      {report.cortisolRisk && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.12)', fontSize: 7, color: '#f59e0b' }}>
          вљ пёЏ РљРѕСЂС‚РёР·РѕР»РѕРІС‹Р№ СЂРёСЃРє вЂ” РЅРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ Р±С‹СЃС‚СЂС‹С… СѓРіР»РµРІРѕРґРѕРІ РїРѕСЃР»Рµ С‚СЂРµРЅРёСЂРѕРІРєРё
        </div>
      )}
      {report.insulinRicohet && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 7, color: '#ef4444' }}>
          рџљЁ Р РёСЃРє РіРёРїРѕРіР»РёРєРµРјРёРё вЂ” Р·Р°РјРµРЅРёС‚Рµ СЃР°С…Р°СЂ РЅР° Р°РјРёР»РѕРїРµРєС‚РёРЅ
        </div>
      )}
      {report.electrolyteRisk && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 7, color: '#ef4444' }}>
          рџљЁ Р­Р»РµРєС‚СЂРѕР»РёС‚РЅС‹Р№ СЃСЂС‹РІ! РљР°Р»РёР№ {report.potassiumMg}РјРі/РњР°РіРЅРёР№ {report.magnesiumMg}РјРі. Р”РѕР±Р°РІСЊС‚Рµ С€РїРёРЅР°С‚/РєСѓСЂР°РіСѓ
        </div>
      )}
      {report.giLoadWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)', fontSize: 7, color: '#f97316' }}>
          вљ пёЏ Р’С‹СЃРѕРєР°СЏ РЅР°РіСЂСѓР·РєР° Р–РљРў вЂ” РїРѕРґРєР»СЋС‡РёС‚Рµ С„РµСЂРјРµРЅС‚С‹
        </div>
      )}
      {report.pralWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)', fontSize: 7, color: '#f59e0b' }}>
          вљ–пёЏ {report.pralWarning} (PRAL {report.pralTotal.toFixed(1)})
        </div>
      )}
      {report.omegaWarning && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)', fontSize: 7, color: '#f59e0b' }}>
          рџђџ {report.omegaWarning}
        </div>
      )}
      {report.microDeficits.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>
          вљ пёЏ Р”РµС„РёС†РёС‚: {report.microDeficits.join(', ')}
        </div>
      )}
      {report.homaIr !== null && report.homaIr > 2.5 && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', fontSize: 7, color: '#ef4444' }}>
          рџљЁ HOMA-IR {report.homaIr.toFixed(1)}{' > 2.5 вЂ” РёРЅСЃСѓР»РёРЅРѕСЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ'}
        </div>
      )}
      {report.ammoniaRisk && (
        <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', fontSize: 7, color: '#ef4444' }}>
          рџ’Ё РђРјРјРёР°Рє-СЂРёСЃРє: {report.ammoniaScore.toFixed(1)} Р±Р°Р»Р»Р°. Р’С‹СЃРѕРєР°СЏ Р°РјРјРёР°С‡РЅР°СЏ РЅР°РіСЂСѓР·РєР° вЂ” РґРѕР±Р°РІСЊС‚Рµ С†РёС‚СЂСѓР»Р»РёРЅ/Р°СЂРіРёРЅРёРЅ, СЃРЅРёР·СЊС‚Рµ РіР»СЋС‚Р°РјРёРЅ
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

      {/* Dynamic recommendations based on diet report */}
      {(() => {
        const recs: { text: string; priority: 'high' | 'medium' | 'low'; icon: string }[] = [];
        if (report.mtorDeficitMg > 0 && !report.mtorTriggered) recs.push({ priority: 'high', icon: 'рџ§¬', text: `Р”РѕР±Р°РІСЊС‚Рµ ${Math.round(report.mtorDeficitMg)} РјРі Р»РµР№С†РёРЅР° (РµС‰С‘ 1 РїРѕСЂС†РёСЏ РєСѓСЂРёС†С‹/РіРѕРІСЏРґРёРЅС‹/СЏРёС†)` });
        if (report.giLoadWarning) recs.push({ priority: 'high', icon: 'рџ«ѓ', text: `РќР°РіСЂСѓР·РєР° Р–РљРў ${report.giLoad.toFixed(0)} вЂ” РґРѕР±Р°РІСЊС‚Рµ С„РµСЂРјРµРЅС‚С‹ (РїР°РЅРєСЂРµР°С‚РёРЅ, Р±СЂРѕРјРµР»Р°Р№РЅ)` });
        if (report.pralWarning) recs.push({ priority: 'medium', icon: 'рџ§‚', text: `PRAL ${report.pralTotal.toFixed(1)} вЂ” ${report.pralWarning === 'Р—Р°РєРёСЃР»РµРЅРёРµ' ? 'РґРѕР±Р°РІСЊС‚Рµ Р·РµР»РµРЅСЊ, Р»РёРјРѕРЅС‹, РѕРІРѕС‰Рё' : 'СѓР±РµСЂРёС‚Рµ РёР·Р±С‹С‚РѕРє РІРѕРґС‹/СЃРѕРґС‹'}` });
        if (report.ammoniaRisk) recs.push({ priority: 'high', icon: 'рџ’Ё', text: `РђРјРјРёР°Рє ${report.ammoniaScore.toFixed(1)} вЂ” РґРѕР±Р°РІСЊС‚Рµ С†РёС‚СЂСѓР»Р»РёРЅ 3-6 Рі/Рґ РёР»Рё СЃРЅРёР·СЊС‚Рµ РіР»СЋС‚Р°РјРёРЅ, СѓРІРµР»РёС‡СЊС‚Рµ РєР»РµС‚С‡Р°С‚РєСѓ` });
        if (report.omegaWarning) recs.push({ priority: 'medium', icon: 'рџђџ', text: `РћРјРµРіР°-6/3 ${report.omegaRatio.toFixed(1)}:1 вЂ” РґРѕР±Р°РІСЊС‚Рµ EPA/DHA 1-2 Рі/Рґ, СЃРЅРёР·СЊС‚Рµ СЂР°СЃС‚РёС‚РµР»СЊРЅС‹Рµ РјР°СЃР»Р°` });
        if (report.electrolyteRisk) recs.push({ priority: 'high', icon: 'рџ’§', text: `K ${report.potassiumMg}РјРі/Mg ${report.magnesiumMg}РјРі вЂ” РґРѕР±Р°РІСЊС‚Рµ С€РїРёРЅР°С‚ 200Рі/РєСѓСЂР°РіСѓ 100Рі/Р°РІРѕРєР°РґРѕ` });
        if (report.insulinRicohet) recs.push({ priority: 'high', icon: 'рџ’‰', text: `Р РёСЃРє РіРёРїРѕРіР»РёРєРµРјРёРё вЂ” Р·Р°РјРµРЅРёС‚Рµ СЃР°С…Р°СЂ/С„СЂСѓРєС‚РѕР·Сѓ РЅР° Р°РјРёР»РѕРїРµРєС‚РёРЅ/РёР·РѕРјР°Р»СЊС‚СѓР»РѕР·Сѓ` });
        if (report.cortisolRisk) recs.push({ priority: 'medium', icon: 'рџ§ ', text: `РљРѕСЂС‚РёР·РѕР»РѕРІС‹Р№ СЂРёСЃРє вЂ” РґРѕР±Р°РІСЊС‚Рµ 30-40Рі Р±С‹СЃС‚СЂС‹С… СѓРіР»РµРІРѕРґРѕРІ (РґРµРєСЃС‚СЂРѕР·Р°/СЂРёСЃРѕРІС‹Рµ РІР°С„Р»Рё) РїРѕСЃР»Рµ С‚СЂРµРЅРёСЂРѕРІРєРё` });
        if (report.microDeficits.length > 0) recs.push({ priority: 'medium', icon: 'рџ’Љ', text: `Р”РµС„РёС†РёС‚С‹: ${report.microDeficits.join(', ')} вЂ” РґРѕР±Р°РІСЊС‚Рµ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РёРµ РїСЂРѕРґСѓРєС‚С‹/РґРѕР±Р°РІРєРё` });
        if (report.homaIr !== null && report.homaIr > 2.5) recs.push({ priority: 'high', icon: 'рџ”¬', text: `HOMA-IR ${report.homaIr.toFixed(1)} >2.5 вЂ” РґРѕР±Р°РІСЊС‚Рµ Р±РµСЂР±РµСЂРёРЅ 500 РјРі 2x/Рґ, С…СЂРѕРј 200 РјРєРі, СЃРЅРёР·СЊС‚Рµ СЃР°С…Р°СЂ` });
        if (report.diaas < 0.9) recs.push({ priority: 'high', icon: 'рџ’Є', text: `DIAAS ${report.diaas.toFixed(2)} вЂ” Р»РёРјРёС‚РёСЂСѓРµС‚ ${report.diaasLimitingAA}. РЎРјРµС€Р°Р№С‚Рµ РёСЃС‚РѕС‡РЅРёРєРё Р±РµР»РєР° (Р¶РёРІРѕС‚РЅС‹Р№+СЂР°СЃС‚РёС‚РµР»СЊРЅС‹Р№)` });
        if (report.antinutrientWarning) recs.push({ priority: 'low', icon: 'рџЊї', text: `${report.antinutrientWarning} вЂ” Р·Р°РјР°С‡РёРІР°Р№С‚Рµ/РїСЂРѕСЂР°С‰РёРІР°Р№С‚Рµ Р±РѕР±РѕРІС‹Рµ, С‚РµСЂРјРёС‡РµСЃРєРё РѕР±СЂР°Р±Р°С‚С‹РІР°Р№С‚Рµ` });
        if (report.glutathioneWarning) recs.push({ priority: 'medium', icon: 'рџ§Є', text: `${report.glutathioneWarning} вЂ” РґРѕР±Р°РІСЊС‚Рµ NAC 600 РјРі, СЃРµР»РµРЅ 200 РјРєРі, СЃРµСЂСѓ (MSM/РєСЂРµСЃС‚РѕС†РІРµС‚РЅС‹Рµ)` });
        if (report.histamineWarning) recs.push({ priority: 'medium', icon: 'рџ§Є', text: `${report.histamineWarning} вЂ” РёСЃРєР»СЋС‡РёС‚Рµ С„РµСЂРјРµРЅС‚РёСЂРѕРІР°РЅРЅС‹Рµ РїСЂРѕРґСѓРєС‚С‹, РґРѕР±Р°РІСЊС‚Рµ DAO-С„РµСЂРјРµРЅС‚` });
        if (recs.length === 0) return null;
        const prioColors = { high: '#ef4444', medium: '#f59e0b', low: '#8b5cf6' };
        const prioOrder = { high: 0, medium: 1, low: 2 };
        recs.sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority]);
        return (
          <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>рџ“‹ Р РµРєРѕРјРµРЅРґР°С†РёРё РЅР° РѕСЃРЅРѕРІРµ СЂР°С†РёРѕРЅР°</div>
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

