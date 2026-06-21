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

function mapRiskSystem(riskSystem: string): string { return RISK_SYSTEM_MAP[riskSystem] || riskSystem; }
function getSystemLabel(sys: string): string { return SYSTEM_INFO[sys]?.label || sys; }

const SYSTEM_ICONS: Record<string, string> = {
  cardio:'❤️', hepatic:'🫁', renal:'🫘', neuro:'🧠', endocrine:'⚖️', hematologic:'🩸',
  reproductive:'🧬', musculoskeletal:'💪', metabolic:'⚡', ghigf:'📈', ins_axis:'🍬',
  neuro_toxicity:'⚠️', blood:'🩸', vessels:'🫀', immunity:'🛡️', thyroid:'🦋', prostate:'🔴', skin:'🧴'
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
    recs:true, history:true, thresholds:true,
  });
  const toggle = (k: string) => setShowSections(s => ({ ...s, [k]: !s[k] }));

  const overallStatus = riskResult.overallNet < 20 ? '✅ Низкий' : riskResult.overallNet < 40 ? '⚠️ Умеренный' : riskResult.overallNet < 60 ? '🔶 Повышенный' : riskResult.overallNet < 80 ? '🔴 Высокий' : '💀 Критический';
  const overallColor = getRiskColor(riskResult.overallNet);
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

  const Section: React.FC<{ id: string; icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ id, icon, title, children }) => (
    <div style={{ padding: 0, overflow: 'hidden', marginBottom: 8, borderRadius: 14, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
      <button onClick={() => toggle(id)} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'12px 14px', cursor:'pointer', textAlign:'left', background:'transparent', border:'none', color:'var(--text)', fontSize:13, fontWeight:700 }}>
        <span style={{ fontSize:12, transition:'transform 0.2s', transform: showSections[id] ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        <span style={{ fontSize:18 }}>{icon}</span> {title}
      </button>
      {showSections[id] && <div style={{ padding:'0 14px 14px' }}>{children}</div>}
    </div>
  );

  return (
    <div>
      {/* Overall Risk + Penalty */}
      <Section id="overall" icon="📊" title="Общий риск">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          {[
            { label:'Raw', val:Math.round(riskResult.overallRaw), color:getRiskColor(riskResult.overallRaw) },
            { label:'Net', val:Math.round(riskResult.overallNet), color:overallColor },
            { label:'Статус', val:overallStatus, color:overallColor, small:true },
          ].map((t, i) => (
            <div key={i} style={{ background:'var(--bg-secondary)', padding:'10px 8px', borderRadius:10, textAlign:'center' }}>
              <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:2 }}>{t.label}</div>
              <div style={{ fontSize:t.small?13:22, fontWeight:700, color:t.color }}>{t.val}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:8, background:'var(--bg-secondary)', borderRadius:8, height:18, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${Math.min(100,riskResult.overallRaw)}%`, background:getRiskColor(riskResult.overallRaw), opacity:0.3, borderRadius:8 }} />
          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${Math.min(100,riskResult.overallNet)}%`, background:overallColor, borderRadius:8 }} />
          <div style={{ position:'absolute', top:1, left:'50%', transform:'translateX(-50%)', fontSize:10, fontWeight:700, color:'#fff', textShadow:'0 0 4px rgba(0,0,0,0.5)' }}>{Math.round(riskResult.overallNet)}%</div>
        </div>
        {anyNoLabs && (
          <div style={{ marginTop:6, padding:8, borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontWeight:700, fontSize:11, color:'#ef4444' }}>🚫 Штраф за отсутствие анализов</div>
            <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
              {globalNoLabs ? 'Применён ко всем системам' : `Системы: ${noLabsSystems.map(s => getSystemLabel(s)).join(', ')}`}
            </div>
          </div>
        )}
      </Section>

      {/* Dynamics */}
      {weeklyDynamics && (
        <Section id="dynamics" icon="📈" title="Динамика по неделям">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:9, color:'var(--text-dim)', whiteSpace:'nowrap' }}>
              {chartWeek != null ? `Неделя ${chartWeek+1}` : 'Все недели'}
            </span>
            <input type="range" min={0} max={Math.max(0,(weeklyDynamics.weeks?.length||12)-1)} value={chartWeek??0}
              onChange={e => setChartWeek(parseFloat(e.target.value) || 0)} style={{ flex:1, accentColor:'var(--accent)' }}/>
            <button onClick={() => setChartWeek(null)} style={{
              fontSize:9, color:'var(--accent)', background:'none', border:'1px solid var(--border)', borderRadius:4, padding:'2px 6px', cursor:'pointer', whiteSpace:'nowrap',
            }}>Все</button>
          </div>
          <WeeklyRiskChart dynamics={weeklyDynamics} selectedWeek={chartWeek} onWeekSelect={setChartWeek} mode={chartMode} onModeChange={setChartMode} />
        </Section>
      )}

      {/* System Risks */}
      <Section id="systems" icon="🫀" title="Риски по системам">
        <div style={{ display:'grid', gap:5 }}>
          {ALL_RISK_SYSTEMS.map(sys => {
            const bd = riskResult.systemBreakdown[sys];
            if (!bd || bd.net < 1) return null;
            const netPct = Math.round(bd.net);
            const icon = SYSTEM_ICONS[sys] || '⚠️';
            const label = SYSTEM_LABELS[sys] || sys;
            return (
              <div key={sys} style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg-secondary)', borderRadius:8, padding:'6px 10px' }}>
                <span style={{ fontSize:14, minWidth:22, textAlign:'center' }}>{icon}</span>
                <span style={{ fontSize:11, minWidth:90, color:netPct>25?getRiskColor(bd.net):'var(--text-dim)', fontWeight:netPct>25?600:400 }}>{label}</span>
                <div style={{ flex:1, background:'rgba(255,255,255,0.05)', borderRadius:4, height:8, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100,bd.net)}%`, height:'100%', background:getRiskColor(bd.net), borderRadius:4, transition:'width 0.4s' }} />
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:getRiskColor(bd.net), minWidth:32, textAlign:'right' }}>{netPct}%</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Key Risks */}
      {relevantRisks.length > 0 && (
        <Section id="key" icon="⚡" title="Ключевые риски">
          <div style={{ display:'grid', gap:5 }}>
            {relevantRisks.map((risk: any) => {
              const lc = risk.levels?.includes('HIGH') ? '#ef4444' : risk.levels?.includes('MEDIUM') ? '#eab308' : '#22c55e';
              return (
                <div key={risk.id} style={{ background:'var(--bg-secondary)', padding:'8px 10px', borderRadius:8, borderLeft:`3px solid ${lc}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:600, fontSize:11 }}>{risk.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:lc, background:`${lc}22`, padding:'2px 6px', borderRadius:4 }}>{risk.levels?.[risk.levels.length-1]}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>{risk.description}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Sources */}
      {aggregatedRisk && (
        <Section id="sources" icon="🔍" title="Источники рисков">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
            {[
              { label:'💊 Фарма', val:Math.round(aggregatedRisk.pharma.overallNet) },
              { label:'🧪 Анализы', val:anyNoLabs ? `🚫 ${Math.round(aggregatedRisk.labs.overallNet)}` : Math.round(aggregatedRisk.labs.overallNet) },
              { label:'🏋️ Тренировки', val:Math.round(aggregatedRisk.training.overallNet) },
              { label:'🥗 Питание', val:Math.round(aggregatedRisk.nutrition.overallNet) },
            ].map((s, i) => (
              <div key={i} style={{ background:'var(--bg-secondary)', padding:'10px', borderRadius:10, textAlign:'center' }}>
                <div style={{ fontSize:11, color:'var(--text-dim)', marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:18, fontWeight:700, color:getRiskColor(typeof s.val==='number'?s.val:0) }}>{s.val}%</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Support Coverage — How support reduces risk per system */}
      <Section id="support_coverage" icon="🛡️" title="Покрытие поддержкой">
        <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:6 }}>Насколько препараты поддержки снижают риски по системам</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          {(() => {
            const supportData = riskResult?.coverageMap || {};
            const systems = ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'];
            const sysLabels: Record<string, string> = { cardio:'❤️ Сердце', hepatic:'🫁 Печень', renal:'🫘 Почки', neuro:'🧠 Нервная', endocrine:'⚖️ Эндокринная', hematologic:'🩸 Кровь', reproductive:'🧬 Репрод.', musculoskeletal:'💪 Мышцы' };
            const riskMap = riskResult?.systemBreakdown || {};
            return systems.map(sys => {
              const coverage = supportData[sys] || 0;
              const riskVal = riskMap[sys]?.net || 0;
              const netRisk = Math.max(0, riskVal * (1 - coverage));
              const pct = Math.round(coverage * 100);
              return (
                <div key={sys} style={{ background:'var(--bg-secondary)', padding:'6px 8px', borderRadius:8 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'var(--text-light)', marginBottom:2 }}>{sysLabels[sys] || sys}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ flex:1, height:6, borderRadius:3, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
                      <div style={{ width: pct + '%', height:'100%', borderRadius:3, background: pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444', transition:'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color: pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444' }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>Риск: {Math.round(riskVal)}% → {Math.round(netRisk)}%</div>
                </div>
              );
            });
          })()}
        </div>
      </Section>

      {/* Recommendations */}
      {/* Recommendations */}
      {!hideRecs && (
      <Section id="recs" icon="✅" title="Рекомендации">
        {recommendations.length > 0 ? (
          <div style={{ display:'grid', gap:4 }}>
            {recommendations.map((rec: any, i: number) => (
              <div key={i} style={{ padding:8, borderRadius:8, background:rec.priority==='high'?'rgba(239,68,68,0.1)':rec.priority==='medium'?'rgba(234,179,8,0.1)':'rgba(34,197,94,0.1)', fontSize:11, color:rec.priority==='high'?'#ef4444':rec.priority==='medium'?'#eab308':'#22c55e' }}>
                {rec.text}
              </div>
            ))}
          </div>
        ) : <div style={{ color:'var(--text-dim)', textAlign:'center', padding:12, fontSize:12 }}>Нет специфических рекомендаций</div>}
      </Section>
      )}

      {/* History */}
      {riskHistory && riskHistory.length > 0 && (
        <Section id="history" icon="📜" title="История рисков">
          <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:60, padding:'0 4px' }}>
            {riskHistory.slice(-12).map((h, i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <span style={{ fontSize:8, color:getRiskColor(h.overallNet), fontWeight:700 }}>{Math.round(h.overallNet)}%</span>
                <div style={{ width:'100%', background:getRiskColor(h.overallNet), borderRadius:'2px 2px 0 0', height:`${Math.max(4, h.overallNet/100*50)}px`, opacity:0.7 }} />
                <span style={{ fontSize:6, color:'var(--text-dim)' }}>{h.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Drug Thresholds */}
      <Section id="thresholds" icon="💊" title="Пороги препаратов">
        <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:8 }}>Максимальные дозировки — превышение кратно увеличивает риски</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:10 }}>
          {(() => {
            const seen = new Set<string>();
            const allowed = /testosterone|trenbolone|nandrolone|boldenone|methenolone|oxandrolone|stanozolol|methandienone|oxymetholone|superdrol|halotestin|drostanolone|mesterolone|turinabol|insulin|gh_|igf|mgf|somatropin|cjc|ghrp|ipamorelin|mk677|sermorelin|hgh/i;
            return Object.entries(DRUG_THRESHOLDS)
              .filter(([id]) => { const e = PHARMA_DB[id]; return e && !seen.has(e.name) && (seen.add(e.name) || true) && allowed.test(id); })
              .sort(([,a], [,b]) => b.androgenicity - a.androgenicity)
              .map(([id, thresh]) => {
                const entry = PHARMA_DB[id];
                return (
                  <div key={id} style={{ background:'var(--bg-secondary)', padding:'6px 8px', borderRadius:6 }}>
                    <div style={{ fontWeight:600, fontSize:10 }}>{entry!.name}</div>
                    <div style={{ color:'var(--text-dim)', fontSize:9 }}>{thresh.dosePerWeek} мг/нед · Андр: {thresh.androgenicity.toFixed(1)}</div>
                  </div>
                );
              });
          })()}
        </div>
      </Section>
    </div>
  );
};
