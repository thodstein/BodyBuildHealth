/**
 * BioStackAIClinicalBuild.tsx
 *
 * Вкладка «🔬 Клинический подбор» BioStack AI.
 *
 * НЕ гадает дозы и состав — вызывает buildClinicalStack (biostack-clinical-recommender),
 * который переиспользует движок калькулятора поддержки (runSupportUnified) как источник
 * истины, берёт канонические дозировки и пропускает кандидатов через клинический шлюз
 * безопасности selectStack. Отображает состав, дозы, механизмы ТЗ, риск до/после,
 * отсеянные (с причиной) и лаб-коррекции.
 */

import React, { useState } from 'react';
import { GlassCard, PillBtn, inputS } from './BioStackAIConstants';
import type { BioStackProfile } from '../../engines/biostack-ai.engine';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import { buildClinicalStack, type ClinicalStackResult } from '../../engines/biostack-clinical-recommender';
import type { StackStrategy } from '../../engines/biostack-clinical-v2.engine';
import { showToast, initBioToast } from './BioStackAIConstants';

interface Props {
  profile: BioStackProfile;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
  labAnalysis?: LabCompositeResult | null;
  linked?: any;
}

const STRATEGIES: { id: StackStrategy; label: string }[] = [
  { id: 'comprehensive', label: 'Полный' },
  { id: 'safe', label: 'Безопасный' },
  { id: 'budget', label: 'Бюджет' },
];

export const BioStackAIClinicalBuild: React.FC<Props> = ({
  profile,
  setStackIds,
  labAnalysis,
  linked,
}) => {
  const [strategy, setStrategy] = useState<StackStrategy>('comprehensive');
  const [result, setResult] = useState<ClinicalStackResult | null>(null);
  const [building, setBuilding] = useState(false);
  initBioToast();

  // неделя курса из linked (если есть данные фармы)
  const courseWeek = linked?.pharma?.week ?? linked?.courseWeek ?? 1;

  const onBuild = () => {
    setBuilding(true);
    // даём UI перерисоваться
    setTimeout(() => {
      try {
        const r = buildClinicalStack(profile, {
          strategy,
          lab: labAnalysis ?? null,
          courseWeek: typeof courseWeek === 'number' ? courseWeek : 1,
        });
        setResult(r);
      } catch (e: any) {
        showToast('Ошибка подбора: ' + (e?.message || e), 'error');
      } finally {
        setBuilding(false);
      }
    }, 10);
  };

  const onToPlan = () => {
    if (!result) return;
    const ids = result.substances.map((s) => s.id);
    localStorage.setItem(
      'he_biostack_to_plan',
      JSON.stringify({ stackIds: ids, name: 'Клинический подбор (BioStack)' }),
    );
    setStackIds(ids);
    showToast(`Клинический стек (${ids.length}) отправлен в план поддержки`, 'success');
  };

  return (
    <div style={{ padding: 12 }}>
      <GlassCard title="🔬 Клинический подбор" icon="🧬" color="#00e68a">
        {/* ── Clinical header bar ── */}
        <div style={{
          display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,marginBottom:10,
          background:'rgba(0,230,138,0.06)',border:'1px solid rgba(0,230,138,0.1)',
        }}>
          <span style={{ fontSize:28 }}>⚕️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14,fontWeight:800,color:'#00e68a' }}>Стек строится движком поддержки</div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',lineHeight:1.4,marginTop:2 }}>
              Единый источник истины — калькулятор поддержки. Канонические дозы, механизмы ТЗ (28 кодов),
              клинический шлюз безопасности: противопоказания, ЛС-конфликты, UL, лаб-коррекции.
            </div>
          </div>
        </div>

        <div style={{ marginTop:10,display:'flex',gap:8,flexWrap:'wrap' }}>
          {STRATEGIES.map((s) => (
            <PillBtn key={s.id} active={strategy===s.id} onClick={()=>setStrategy(s.id)} color="#00e68a" small>
              {s.label}
            </PillBtn>
          ))}
        </div>

        <button onClick={onBuild} disabled={building} style={{
          marginTop:12,width:'100%',padding:'14px 0',borderRadius:14,border:'none',
          background:building?'rgba(0,230,138,0.4)':'linear-gradient(135deg,#00e68a,#00b4d8)',
          color:'#00120c',fontWeight:800,fontSize:15,cursor:'pointer',
          boxShadow:building?'none':'0 6px 20px rgba(0,230,138,0.2)',
        }}>
          {building?'⚙️ Собираю…':'⚕️ Собрать клинический стек'}
        </button>
      </GlassCard>

      {result && (
        <>
          {/* Риск до/после — прогноз (не влияет на расчёт рисков) */}
          <GlassCard title="📊 Возможное изменение риска" icon="📈" color="#60a5fa" style={{ marginTop: 12 }}>
            {(() => {
              const delta = Math.round((result.riskBefore - result.riskAfter) * 10) / 10;
              const improved = delta > 0;
              return (
                <>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:8,alignItems:'center' }}>
                    <div style={{ padding:'12px',borderRadius:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',textAlign:'center' }}>
                      <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4 }}>Риск сейчас</div>
                      <div style={{ fontSize:32,fontWeight:800,color:'#fff' }}>{result.riskBefore}</div>
                    </div>
                    <div style={{ fontSize:24,color:'rgba(255,255,255,0.3)',fontWeight:300 }}>→</div>
                    <div style={{ padding:'12px',borderRadius:12,background:improved?'rgba(34,197,94,0.06)':'rgba(245,158,11,0.06)',border:`1px solid ${improved?'rgba(34,197,94,0.15)':'rgba(245,158,11,0.15)'}`,textAlign:'center' }}>
                      <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:4 }}>Прогноз</div>
                      <div style={{ fontSize:32,fontWeight:800,color:improved?'#22c55e':'#fbbf24' }}>{result.riskAfter}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:8,marginTop:10 }}>
                    <div style={{ flex:1,padding:'8px 12px',borderRadius:10,background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.1)',textAlign:'center' }}>
                      <div style={{ fontSize:20,fontWeight:800,color:improved?'#22c55e':'#f59e0b' }}>{improved?`−${delta}`:`+${Math.abs(delta)}`}</div>
                      <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>Δ прогноз</div>
                    </div>
                    <div style={{ flex:1,padding:'8px 12px',borderRadius:10,background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.1)',textAlign:'center' }}>
                      <div style={{ fontSize:20,fontWeight:800,color:'#60a5fa' }}>{result.coveragePercent}%</div>
                      <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>Покрытие</div>
                    </div>
                  </div>
                  <div style={{ marginTop:8,padding:'6px 10px',borderRadius:8,background:'rgba(96,165,250,0.08)',fontSize:10,color:'rgba(255,255,255,0.45)',lineHeight:1.4 }}>
                    ⓘ Прогноз изменения риска. BioStack не влияет на расчёт — только оценка эффекта поддержки.
                  </div>
                </>
              );
            })()}
            <div style={{ marginTop:8,fontSize:10,color:'rgba(255,255,255,0.3)' }}>
              Источник: {result.sourceOfTruth} · неделя {result.courseWeek}
            </div>
          </GlassCard>

          {/* Состав */}
          <GlassCard title={`💊 Состав (${result.substances.length})`} icon="💊" color="#a78bfa" style={{ marginTop: 12 }}>
            {result.substances.map((s) => (
              <div key={s.id} style={{
                padding:'12px 14px',marginBottom:4,borderRadius:12,
                background:'rgba(167,139,250,0.04)',border:'1px solid rgba(167,139,250,0.08)',
              }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8 }}>
                  <div>
                    <span style={{ fontWeight:700,fontSize:14,color:'#fff' }}>{s.name}</span>
                    <span style={{ marginLeft:6,fontSize:9,padding:'2px 6px',borderRadius:4,
                      background: s.tier==='core'?'rgba(34,197,94,0.15)':s.tier==='standard'?'rgba(96,165,250,0.15)':'rgba(167,139,250,0.1)',
                      color: s.tier==='core'?'#22c55e':s.tier==='standard'?'#60a5fa':'#a78bfa' }}>{s.tier}</span>
                  </div>
                  <div style={{ fontSize:14,fontWeight:700,color:'#00e68a' }}>
                    {s.doseDisplay || `${s.doseMg} мг`}
                  </div>
                </div>
                <div style={{ fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2 }}>
                  {s.timing}
                </div>
                {s.tzMechanisms.length>0 && (
                  <div style={{ marginTop:6,display:'flex',gap:4,flexWrap:'wrap' }}>
                    {s.tzMechanisms.slice(0,5).map((m) => (
                      <span key={m.mechId} style={{
                        fontSize:9,padding:'3px 8px',borderRadius:6,
                        background:'rgba(96,165,250,0.15)',color:'#93c5fd',fontWeight:600,
                      }}>{m.label}</span>
                    ))}
                  </div>
                )}
                {s.mechanismReason && (
                  <div style={{ marginTop:4,fontSize:10,color:'rgba(255,255,255,0.35)',lineHeight:1.3 }}>
                    {s.mechanismReason}
                  </div>
                )}
              </div>
            ))}
          </GlassCard>

          {/* Отсеянные — сгруппированы по клинической тяжести */}
          {result.excluded.length > 0 && (() => {
            const SEV_META: Record<string, { title: string; icon: string; color: string; note: string }> = {
              hard: { title: 'Абсолютные противопоказания', icon: '🛑', color: '#f87171', note: 'Удалены полностью — приём недопустим' },
              drug: { title: 'Конфликты с лекарствами', icon: '💊', color: '#fb7185', note: 'Удалены из-за взаимодействия с текущими ЛС' },
              ul: { title: 'Превышен верхний предел (UL)', icon: '⚠️', color: '#f59e0b', note: 'Удалены во избежание передозировки' },
              titration: { title: 'Требуется титрация дозы', icon: '🔧', color: '#fbbf24', note: 'Не удаление — снизьте/подберите дозу под контролем' },
              redundant: { title: 'Дублирование (избыточно)', icon: '🔁', color: '#9ca3af', note: 'Убраны как дубли уже покрытых механизмов' },
            };
            const order: Array<keyof typeof SEV_META> = ['hard', 'drug', 'ul', 'titration', 'redundant'];
            const groups = order
              .map((sev) => ({ sev, meta: SEV_META[sev], items: result.excluded.filter((x) => x.severity === sev) }))
              .filter((g) => g.items.length > 0);
            return groups.map((g) => (
              <GlassCard
                key={g.sev}
                title={`${g.meta.title} (${g.items.length})`}
                icon={g.meta.icon}
                color={g.meta.color}
                style={{ marginTop: 12 }}
              >
                <div style={{ fontSize: 10, color: g.meta.color, marginBottom: 6, fontWeight: 600 }}>
                  {g.meta.note}
                </div>
                {g.items.map((x, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{x.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.6)' }}>{x.reason}</div>
                  </div>
                ))}
              </GlassCard>
            ));
          })()}

          {/* Титрация доз — веществ, которые ОСТАЛИСЬ в стеке, но требуют коррекции дозы */}
          {result.safety.drugTitrations.length > 0 && (
            <GlassCard title={`🔧 Титрация доз (${result.safety.drugTitrations.length})`} icon="🔧" color="#fbbf24" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: '#fbbf24', marginBottom: 6, fontWeight: 600 }}>
                Вещество остаётся в стеке, но дозу нужно подобрать под контролем (взаимодействие с текущими ЛС)
              </div>
              {result.safety.drugTitrations.map((t: any, i: number) => {
                const kept = result.substances.some((s) => s.id === t.substanceId);
                return (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{t.substanceName}</div>
                      <span
                        style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: kept ? 'rgba(0,230,138,0.18)' : 'rgba(156,163,175,0.18)',
                          color: kept ? '#00e68a' : '#9ca3af',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {kept ? 'в стеке' : 'отсеяно'}
                      </span>
                    </div>
                    {t.drug && (
                      <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.6)', marginTop: 2 }}>
                        ЛС: {t.drug}
                        {t.effect ? ` · ${t.effect}` : ''}
                      </div>
                    )}
                    {t.recommendation && (
                      <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 3 }}>
                        → {t.recommendation}
                      </div>
                    )}
                    {t.mechanism && (
                      <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.5)', marginTop: 2 }}>
                        {t.mechanism}
                      </div>
                    )}
                  </div>
                );
              })}
            </GlassCard>
          )}

          {/* Лаб-коррекции */}
          {result.safety.labAdjustments.length > 0 && (
            <GlassCard title="🔬 Лабораторные коррекции" icon="🧪" color="#f59e0b" style={{ marginTop: 12 }}>
              {result.safety.labAdjustments.map((a: any, i: number) => (
                <div key={i} style={{ padding: '6px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {a.message || a.reason || JSON.stringify(a)}
                </div>
              ))}
            </GlassCard>
          )}

          {/* Мониторинг + инструкции */}
          {result.monitoring.length > 0 && (
            <GlassCard title="🩺 Мониторинг" icon="📋" color="#34d399" style={{ marginTop: 12 }}>
              {result.monitoring.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {m}
                </div>
              ))}
            </GlassCard>
          )}
          {result.specialInstructions.length > 0 && (
            <GlassCard title="📌 Особые указания" icon="⚠️" color="#fbbf24" style={{ marginTop: 12 }}>
              {result.specialInstructions.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {m}
                </div>
              ))}
            </GlassCard>
          )}

          {/* Конфликты */}
          {result.conflicts.length > 0 && (
            <GlassCard title="🔗 Конфликты" icon="⚡" color="#c084fc" style={{ marginTop: 12 }}>
              {result.conflicts.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {m}
                </div>
              ))}
            </GlassCard>
          )}

          <button
            onClick={onToPlan}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#00e68a,#00b4d8)',
              color: '#00120c',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ➕ Отправить в план поддержки ({result.substances.length})
          </button>
        </>
      )}
    </div>
  );
};

export default BioStackAIClinicalBuild;
