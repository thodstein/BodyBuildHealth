import React, { useState } from 'react';
import { ALL_RISK_SYSTEMS, DRUG_THRESHOLDS } from '../../../core/constants';
import { PHARMA_DB } from '../../../core/pharma-database';
import { SYSTEM_INFO } from '../../../core/risk-info';
import { RISKS_DB, RISK_SYSTEM_MAP } from '../../../data/support-database';
import { RECOMMENDATIONS_DB } from '../../../data/support-database';
import type { RiskResult } from '../../../core/types';
import { getRiskColor } from '../../../core/utils/risk-colors';
import type { AggregatedRisk } from '../../../engines/risk.engine';
import type { WeeklyRiskDynamics } from '../../../engines/weekly-risk-dynamics.engine';
import { WeeklyRiskChart } from './WeeklyRiskChart';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';

function mapRiskSystem(riskSystem: string): string { return RISK_SYSTEM_MAP[riskSystem] || riskSystem; }
function getSystemLabel(sys: string): string { return SYSTEM_INFO[sys]?.label || sys; }

const SYSTEM_ICONS: Record<string, NativeIconName> = {
  cardio:'heart', hepatic:'lungs', renal:'kidney', neuro:'cpu', endocrine:'layers', hematologic:'droplet',
  reproductive:'dot', musculoskeletal:'move', metabolic:'zap', ghigf:'flask', ins_axis:'syringe',
  neuro_toxicity:'alertTriangle', blood:'droplet', vessels:'activity', immunity:'shield', thyroid:'butterfly', prostate:'search', skin:'star'
};

const SYSTEM_LABELS: Record<string, string> = {
  cardio: 'Сердце', hepatic: 'Печень', renal: 'Почки', neuro: 'Нервная',
  endocrine: 'Эндокринная', hematologic: 'Кровь', reproductive: 'Репрод.',
  musculoskeletal: 'Мышцы', metabolic: 'Метаболизм', ghigf: 'GH/IGF',
  ins_axis: 'Инсулин', neuro_toxicity: 'Нейротокс.', blood: 'Кровь',
  vessels: 'Сосуды', immunity: 'Иммунитет', thyroid: 'Щитовидная',
  prostate: 'Простата', skin: 'Кожа'
};

interface LabRiskContribution { systemContributions: Record<string, number>; totalRisk: number; }

export const RiskOverview: React.FC<{
  riskResult: RiskResult;
  globalNoLabs: boolean;
  noLabsSystems: string[];
  riskHistory?: { date: string; overallRaw: number; overallNet: number }[];
  labRiskContributions: LabRiskContribution | null;
  aggregatedRisk?: AggregatedRisk | null;
  weeklyDynamics?: WeeklyRiskDynamics | null;
  hideRecs?: boolean;
}> = ({ riskResult, globalNoLabs, noLabsSystems, riskHistory, labRiskContributions, aggregatedRisk, weeklyDynamics, hideRecs }) => {
  const [chartWeek, setChartWeek] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'week' | 'average'>('average');
  const [showSections, setShowSections] = useState<Record<string, boolean>>({
    overall:true, dynamics:!!weeklyDynamics, systems:true, key:true, sources:true,
    recs:true, history:true, thresholds:true, support_coverage:true,
  });
  const toggle = (k: string) => setShowSections(s => ({ ...s, [k]: !s[k] }));

  const overallRaw = riskResult.overallRaw ?? 0;
  const overallNet = riskResult.overallNet ?? 0;
  const overallStatus = overallNet < 20 ? '✅ Низкий' : overallNet < 40 ? '⚠️ Умеренный' : overallNet < 60 ? '🔶 Повышенный' : overallNet < 80 ? '🔴 Высокий' : '💀 Критический';
  const overallColor = getRiskColor(overallNet);
  const anyNoLabs = globalNoLabs || noLabsSystems.length > 0;

  const relevantRisks = React.useMemo(() => {
    const seen = new Set<string>();
    return (RISKS_DB || []).filter((r: any) => {
      const sys = mapRiskSystem((r.system || '').toLowerCase());
      if (seen.has(sys)) return false;
      const bd = riskResult.systemBreakdown[sys];
      if (!bd || bd.net <= 20) return false;
      seen.add(sys);
      return true;
    }).slice(0, 6);
  }, [riskResult.systemBreakdown]);

  const recommendations = React.useMemo(() => {
    const sysMap: Record<string, string> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      const bd = riskResult.systemBreakdown[sys];
      if (!bd || bd.net <= 20) continue;
      const level = bd.net > 70 ? 'HIGH' : bd.net > 50 ? 'MEDIUM' : 'LOW';
      const ms = mapRiskSystem(sys.toLowerCase());
      const match = RECOMMENDATIONS_DB.find(r => r.type === 'RISK' && mapRiskSystem((r.riskId || '').split('_')[0].toLowerCase()) === ms && r.level === level);
      if (match) sysMap[sys] = match.recId;
    }
    return RECOMMENDATIONS_DB.filter(r => Object.values(sysMap).includes(r.recId)).slice(0, 6);
  }, [riskResult.systemBreakdown]);

  const Section: React.FC<{ id: string; icon: NativeIconName; title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ id, icon, title, children }) => (
    <div style={{ padding:0, overflow:'hidden', marginBottom:12, borderRadius:18, background:'rgba(20,22,30,0.55)', border:'1px solid rgba(255,255,255,0.09)', backdropFilter:'blur(12px)', boxShadow:'0 12px 30px rgba(0,0,0,0.20)' }}>
      <button onClick={() => toggle(id)} aria-expanded={!!showSections[id]} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', minHeight:56, padding:'13px 14px', cursor:'pointer', textAlign:'left', background: showSections[id]?'rgba(255,255,255,0.04)':'transparent', border:'none', color:'#fff', fontSize:14, fontWeight:800, borderBottom: showSections[id]?'1px solid rgba(255,255,255,0.07)':'none' }}>
        <span style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', transition:'transform 0.2s', transform: showSections[id]?'rotate(90deg)':'rotate(0deg)', flexShrink:0 }}><NativeIcon name="chevronRight" size={13} /></span>
        <span style={{ display:'inline-flex', color:'#fff' }}><NativeIcon name={icon} size={17} /></span> {title}
        <span style={{ marginLeft:'auto', fontSize:13, minWidth:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 10px', borderRadius:999, background: showSections[id]?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', fontWeight:800 }}>{showSections[id]?'−':'+'}</span>
      </button>
      {showSections[id] && <div style={{ padding:'14px 12px 14px' }}>{children}</div>}
    </div>
  );

  return (
    <div className="risk-overview">
      {/* Overall Risk + Penalty — APK PRO */}
      <Section id="overall" icon="chart" title="Общий риск">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))', gap:8 }}>
          {[
            { label:'Raw', val:Math.round(overallRaw), color:getRiskColor(overallRaw) },
            { label:'Net', val:Math.round(overallNet), color:overallColor },
            { label:'Статус', val:overallStatus, color:overallColor, small:true },
          ].map((t, i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding:'12px 8px', borderRadius:14, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'#fff', fontWeight:700, marginBottom:4 }}>{t.label}</div>
              <div style={{ fontSize:t.small?14:26, fontWeight:800, color:t.color, lineHeight:1.1 }}>{t.val}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, background:'rgba(255,255,255,0.06)', borderRadius:999, height:22, position:'relative', overflow:'hidden', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${Math.min(100,overallRaw)}%`, background:getRiskColor(overallRaw), opacity:0.3, borderRadius:999 }} />
          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${Math.min(100,overallNet)}%`, background:overallColor, borderRadius:999 }} />
          <div style={{ position:'absolute', top:2, left:'50%', transform:'translateX(-50%)', fontSize:12, fontWeight:800, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.6)' }}>{Math.round(overallNet)}%</div>
        </div>
        {anyNoLabs && (
          <div style={{ marginTop:8, padding:10, borderRadius:12, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.24)' }}>
            <div style={{ fontWeight:800, fontSize:13, color:'#fff' }}>🚫 Штраф за отсутствие анализов</div>
            <div style={{ fontSize:12, color:'#fff', marginTop:4, lineHeight:1.45 }}>
              {globalNoLabs ? 'Применён ко всем системам' : `Системы: ${noLabsSystems.map(s => getSystemLabel(s)).join(', ')}`}
            </div>
          </div>
        )}
      </Section>

      {/* Dynamics */}
      {weeklyDynamics && (
        <Section id="dynamics" icon="trendingDown" title="Динамика по неделям">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>
              {chartWeek != null ? `Неделя ${chartWeek+1}` : 'Все недели'}
            </span>
            <input type="range" min={0} max={Math.max(0,(weeklyDynamics.weeks?.length||12)-1)} value={chartWeek??0}
              onChange={e => setChartWeek(parseFloat(e.target.value) || 0)} style={{ flex:1, accentColor:'var(--accent)', height:28 }}/>
            <button onClick={() => setChartWeek(null)} style={{
              minHeight:44, fontSize:13, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:999, padding:'8px 16px', cursor:'pointer', whiteSpace:'nowrap',
            }}>Все</button>
          </div>
          <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={chartWeek} onWeekSelect={setChartWeek} mode={chartMode} onModeChange={setChartMode} />
        </Section>
      )}

      {/* System Risks */}
      <Section id="systems" icon="heart" title="Риски по системам">
        <div style={{ display:'grid', gap:8 }}>
          {ALL_RISK_SYSTEMS.map(sys => {
            const bd = riskResult.systemBreakdown[sys];
            if (!bd || bd.net < 1) return null;
            const netPct = Math.round(bd.net);
            const icon: NativeIconName = SYSTEM_ICONS[sys] || 'alertTriangle';
            const label = SYSTEM_LABELS[sys] || sys;
            return (
              <div key={sys} style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'10px 12px', minHeight:52 }}>
                <span style={{ display: 'inline-flex', color: '#fff' }}><NativeIcon name={icon} size={17} /></span>
                <span style={{ fontSize:13, minWidth:92, flexShrink:0, color:'#fff', fontWeight:700 }}>{label}</span>
                <div style={{ flex:1, minWidth:0, background:'rgba(255,255,255,0.08)', borderRadius:999, height:10, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100,bd.net)}%`, height:'100%', background:getRiskColor(bd.net), borderRadius:999, transition:'width 0.4s' }} />
                </div>
                <span style={{ fontSize:14, fontWeight:800, color:getRiskColor(bd.net), minWidth:44, flexShrink:0, textAlign:'right' }}>{netPct}%</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Key Risks */}
      {relevantRisks.length > 0 && (
        <Section id="key" icon="zap" title="Ключевые риски">
          <div style={{ display:'grid', gap:8 }}>
            {relevantRisks.map((risk: any) => {
              const lc = risk.levels?.includes('HIGH') ? '#ef4444' : risk.levels?.includes('MEDIUM') ? '#eab308' : '#22c55e';
              return (
                <div key={risk.id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding:'12px', borderRadius:14, borderLeft:`4px solid ${lc}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <span style={{ fontWeight:800, fontSize:13, color:'#fff' }}>{risk.name}</span>
                    <span style={{ fontSize:11, fontWeight:800, color:'#fff', background:`${lc}30`, padding:'4px 10px', borderRadius:999, border:`1px solid ${lc}44` }}>{risk.levels?.[risk.levels.length-1]}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#fff', marginTop:6, lineHeight:1.5 }}>{risk.description}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Sources */}
      {aggregatedRisk && (
        <Section id="sources" icon="search" title="Источники рисков">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
            {[
              { label:'💊 Фарма', val:Math.round(aggregatedRisk.pharma.overallNet) },
              { label:'🧪 Анализы', val:anyNoLabs ? `🚫 ${Math.round(aggregatedRisk.labs.overallNet)}` : Math.round(aggregatedRisk.labs.overallNet) },
              { label:'🏋️ Тренировки', val:Math.round(aggregatedRisk.training.overallNet) },
              { label:'🥗 Питание', val:Math.round(aggregatedRisk.nutrition.overallNet) },
            ].map((s, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding:'14px 10px', borderRadius:14, textAlign:'center' }}>
                <div style={{ fontSize:13, color:'#fff', fontWeight:700, marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:getRiskColor(typeof s.val==='number'?s.val:0) }}>{s.val}%</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Support Coverage — How support reduces risk per system */}
      <Section id="support_coverage" icon="shield" title="Покрытие поддержкой">
        <div style={{ fontSize:12, color:'#fff', marginBottom:8, lineHeight:1.5 }}>Насколько препараты поддержки снижают риски по системам</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {(() => {
            const supportData = riskResult?.coverageMap || {};
            const systems = ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'];
            const sysLabels: Record<string, string> = { cardio:'❤️ Сердце', hepatic:'🫁 Печень', renal:'🫘 Почки', neuro:'🧠 Нервная', endocrine:'⚖️ Эндокринная', hematologic:'🩸 Кровь', reproductive:'🧬 Репрод.', musculoskeletal:'💪 Мышцы' };
            const riskMap = riskResult?.systemBreakdown || {};
            return systems.map(sys => {
              // P0 fix: riskMap[].net уже после поддержки, не умножаем повторно
              const coverage = supportData[sys] || 0;
              const raw = riskMap[sys]?.raw ?? 0;
              const net = riskMap[sys]?.net ?? Math.max(0, raw * (1 - coverage));
              const pct = Math.round(coverage * 100);
              return (
                <div key={sys} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding:'10px', borderRadius:12 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:6 }}>{sysLabels[sys] || sys}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ flex:1, height:8, borderRadius:999, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                      <div style={{ width: pct + '%', height:'100%', borderRadius:999, background: pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444', transition:'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize:11, color:'#fff', marginTop:4 }}>Риск: {Math.round(raw)}% → {Math.round(net)}%</div>
                </div>
              );
            });
          })()}
        </div>
      </Section>

      {/* Recommendations */}
      {!hideRecs && (
      <Section id="recs" icon="check" title="Рекомендации">
        {recommendations.length > 0 ? (
          <div style={{ display:'grid', gap:8 }}>
            {recommendations.map((rec: any, i: number) => (
              <div key={i} style={{ padding:'12px', borderRadius:12, background:rec.priority==='high'?'rgba(239,68,68,0.10)':rec.priority==='medium'?'rgba(234,179,8,0.10)':'rgba(34,197,94,0.10)', border:'1px solid rgba(255,255,255,0.07)', fontSize:12, fontWeight:600, color:'#fff', lineHeight:1.5 }}>
                {rec.text}
              </div>
            ))}
          </div>
        ) : <div style={{ color:'#fff', textAlign:'center', padding:14, fontSize:13 }}>Нет специфических рекомендаций</div>}
      </Section>
      )}

      {/* History */}
      {riskHistory && riskHistory.length > 0 && (
        <Section id="history" icon="clock" title="История рисков">
          <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:80, padding:'0 4px' }}>
            {(() => { const arr = riskHistory.slice(-12); return arr.map((h, i) => (
              <div key={i} style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <span style={{ fontSize:10, color:'#fff', fontWeight:800 }}>{Math.round(h.overallNet)}%</span>
                <div style={{ width:'100%', background:getRiskColor(h.overallNet), borderRadius:'3px 3px 0 0', height:`${Math.max(6, h.overallNet/100*60)}px`, opacity:0.85 }} />
                <span style={{ fontSize:10, color:'#fff' }}>{(i % 3 === 0 || i === arr.length - 1) ? h.date.slice(5) : ' '}</span>
              </div>
            )); })()}
          </div>
        </Section>
      )}

      {/* Drug Thresholds */}
      <Section id="thresholds" icon="pill" title="Пороги препаратов">
        <div style={{ fontSize:12, color:'#fff', marginBottom:10, lineHeight:1.5 }}>Максимальные дозировки — превышение кратно увеличивает риски</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8, fontSize:12 }}>
          {(() => {
            const seen = new Set<string>();
            const allowed = /testosterone|trenbolone|nandrolone|boldenone|methenolone|oxandrolone|stanozolol|methandienone|oxymetholone|superdrol|halotestin|drostanolone|mesterolone|turinabol|insulin|gh_|igf|mgf|somatropin|cjc|ghrp|ipamorelin|mk677|sermorelin|hgh/i;
            return Object.entries(DRUG_THRESHOLDS)
              .filter(([id]) => { const e = PHARMA_DB[id]; return e && !seen.has(e.name) && (seen.add(e.name) || true) && allowed.test(id); })
              .sort(([,a], [,b]) => b.androgenicity - a.androgenicity)
              .map(([id, thresh]) => {
                const entry = PHARMA_DB[id];
                return (
                  <div key={id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding:'10px', borderRadius:12 }}>
                    <div style={{ fontWeight:800, fontSize:12, color:'#fff' }}>{entry!.name}</div>
                    <div style={{ color:'#fff', fontSize:11, marginTop:2 }}>{thresh.dosePerWeek} мг/нед · Андр: {thresh.androgenicity.toFixed(1)}</div>
                  </div>
                );
              });
          })()}
        </div>
      </Section>
    </div>
  );
};
