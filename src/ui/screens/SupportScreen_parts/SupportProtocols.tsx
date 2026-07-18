// @ts-nocheck
/**
 * SupportProtocols.tsx — SHELL: renders menu or selected protocol module
 */
import React from 'react';
import { FertilityPCTScreen } from '../FertilityPCTScreen';
import { InfoErrorBoundary } from './SupportScreenData';
import { SymptomSolverTab } from './SymptomSolverTab';
import { cardBg, pillActive, pillInactive, PROTOCOL_CARDS } from './supportProtocolsShared';
import { SupportProtocolNeuro } from './supportProtocolNeuro';
import { SupportProtocolCardio } from './supportProtocolCardio';
import { SupportProtocolHepatic } from './supportProtocolHepatic';
import { SupportProtocolRenal } from './supportProtocolRenal';
import { SupportProtocolJoints } from './supportProtocolJoints';
import { SupportProtocolAcne } from './supportProtocolAcne';
import { SupportProtocolInjections } from './supportProtocolInjections';
import { SupportProtocolHemato } from './supportProtocolHemato';
import { SupportProtocolMetabolic } from './supportProtocolMetabolic';
import { SupportProtocolGI } from './supportProtocolGI';
import { SupportProtocolHair } from './supportProtocolHair';
import { SupportProtocolThyroid } from './supportProtocolThyroid';
import { SupportProtocolImmune } from './supportProtocolImmune';
import { SupportProtocolE2 } from './supportProtocolE2';
import { SupportProtocolSleep } from './supportProtocolSleep';
import { SupportProtocolDetox } from './supportProtocolDetox';
import { SupportProtocolGH } from './supportProtocolGH';
import { SupportProtocolGLP1 } from './supportProtocolGLP1';
import { SupportProtocolMito } from './supportProtocolMito';
import { SupportProtocolSteatosis } from './supportProtocolSteatosis';
import { SupportProtocolRAAS } from './supportProtocolRAAS';
import { SupportProtocolElectrolytes } from './supportProtocolElectrolytes';
import { SupportProtocolProlactin } from './supportProtocolProlactin';
import { SupportProtocolAdaptogen } from './supportProtocolAdaptogen';
import { SupportProtocolPeptide } from './supportProtocolPeptide';
import { SupportProtocolPostCycle } from './supportProtocolPostCycle';
import { SupportProtocolEmergency } from './supportProtocolEmergency';
import { SupportProtocolInteractions } from './supportProtocolInteractions';
import { SupportProtocolCost } from './supportProtocolCost';
import { SupportProtocolWomen } from './supportProtocolWomen';

export const SupportProtocols: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const { protocolTab, setProtocolTab, protocolView, setProtocolView } = s;
  const activeCard = PROTOCOL_CARDS.find((p:any)=>p.id===protocolTab);
  const isReferenceModule = activeCard?.kind === 'reference';

  return (
    <div style={{ padding:'0 0 70px' }}>
      {protocolView === 'menu' ? (
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text-light)', marginBottom:2 }}>📋 Выберите протокол поддержки</div>
          <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.3 }}>Доступно протоколов: <b style={{color:'#22c55e'}}>{PROTOCOL_CARDS.length}</b> систем органов. Органные протоколы — фазовая модель (1→4) по лабораторным порогам; справочники (пептиды, инъекции, симптомы) — по показаниям.</div>
          <div style={{ borderRadius:10, padding:'10px 12px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.25)', marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#ef4444', lineHeight:1.4 }}>
              ⚠️ Все протоколы носят ПРИМЕРНЫЙ (ознакомительный) характер. Назначение препаратов, выбор схемы и метода лечения/коррекции — <b>ТОЛЬКО ВРАЧОМ</b>. Самолечение опасно для жизни.
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {PROTOCOL_CARDS.map(p => (
              <button key={p.id} onClick={() => { setProtocolTab(p.id); setProtocolView('detail'); }}
                style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', textAlign:'left', gap:4,
                  padding:'10px', borderRadius:10, cursor:'pointer', border:'1px solid '+p.color+'44',
                  background:'rgba(24,24,27,0.8)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
                  transition:'all 0.15s'
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, width:'100%' }}>
                  <span style={{ fontSize:20 }}>{p.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text-light)' }}>{p.label}</div>
                    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.2, marginTop:1 }}>{p.desc}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:3 }}>
                  {p.kind === 'reference' && (
                    <span style={{ fontSize:6, fontWeight:600, padding:'1px 5px', borderRadius:4,
                      background:'#64748b22', color:'#94a3b8' }}>справочник</span>
                  )}
                  {p.tags.map((t: any, ti: number) => (
                    <span key={ti} style={{ fontSize:6, fontWeight:600, padding:'1px 5px', borderRadius:4,
                      background:p.color+'18', color:p.color }}>{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setProtocolView('menu')} style={{ display:'flex', alignItems:'center', gap:4,
            padding:'6px 12px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', marginBottom:8,
            background:'var(--bg-secondary)', color:'var(--text-light)', border:'1px solid var(--border)'
          }}>← Назад к списку</button>

          {/* ── ГЛОБАЛЬНЫЙ БАННЕР: ПРИМЕРНЫЕ ПРОТОКОЛЫ, ТОЛЬКО ВРАЧ ── */}
          <div style={{ borderRadius:12, padding:'14px 16px', background:'rgba(239,68,68,0.08)', border:'2px solid rgba(239,68,68,0.35)', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
              <span style={{ fontSize:22, lineHeight:1, flexShrink:0 }}>⚠️</span>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:'#ef4444', marginBottom:4, lineHeight:1.3 }}>
                  ВНИМАНИЕ: ПРОТОКОЛЫ НОСЯТ ИСКЛЮЧИТЕЛЬНО ОЗНАКОМИТЕЛЬНЫЙ (ПРИМЕРНЫЙ) ХАРАКТЕР
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'#fca5a5', marginBottom:6, lineHeight:1.4 }}>
                  Назначение препаратов, выбор схемы и метода лечения/коррекции осуществляется <b style={{color:'#ef4444'}}>ТОЛЬКО ВРАЧОМ</b> на основании очного осмотра, сбора анамнеза и лабораторных данных.
                </div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4, marginBottom:6, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                  💊 = рецептурный препарат (отпускается по рецепту врача). 🛑 = критические пороги (требуют немедленной коррекции). Без лабораторных данных — расчёт на среднестатистические риски, индивидуальные значения могут отличаться. <b>Самолечение опасно для жизни.</b>
                </div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>
                  {isReferenceModule ? (
                    <>Справочник: <b style={{color:'#22c55e'}}>{activeCard?.label ?? protocolTab}</b> · информация по показаниям, не является фазовым протоколом.</>
                  ) : (
                    <>Активный протокол: <b style={{color:'#22c55e'}}>{activeCard?.label ?? protocolTab}</b> · фазовая модель 1→4. Назначайте по лабораторным порогам из карточек выше.</>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(['pct','fertility','hrt'] as string[]).includes(protocolTab) && (
            <InfoErrorBoundary label="Протоколы ПКТ/Фертильность/HRT">
              <FertilityPCTScreen initialTab={protocolTab === 'pct' ? 'pct-plan' : protocolTab === 'hrt' ? 'hrt' : undefined} restrictToMode={protocolTab as 'pct' | 'fertility' | 'hrt'} />
            </InfoErrorBoundary>
          )}

          {protocolTab === 'neuro' && <SupportProtocolNeuro s={s} />}
          {protocolTab === 'cardio' && <SupportProtocolCardio s={s} />}
          {protocolTab === 'hepatic' && <SupportProtocolHepatic s={s} />}
          {protocolTab === 'renal' && <SupportProtocolRenal s={s} />}
          {protocolTab === 'joints' && <SupportProtocolJoints s={s} />}
          {protocolTab === 'acne' && <SupportProtocolAcne s={s} />}
          {protocolTab === 'injections' && <SupportProtocolInjections s={s} />}
          {protocolTab === 'hemato' && <SupportProtocolHemato s={s} />}
          {protocolTab === 'metabolic' && <SupportProtocolMetabolic s={s} />}
          {protocolTab === 'gi' && <SupportProtocolGI s={s} />}
          {protocolTab === 'hair' && <SupportProtocolHair s={s} />}
          {protocolTab === 'thyroid' && <SupportProtocolThyroid s={s} />}
          {protocolTab === 'immune' && <SupportProtocolImmune s={s} />}
          {protocolTab === 'e2' && <SupportProtocolE2 s={s} />}
          {protocolTab === 'sleep' && <SupportProtocolSleep s={s} />}
          {protocolTab === 'detox' && <SupportProtocolDetox s={s} />}
          {protocolTab === 'gh' && <SupportProtocolGH s={s} />}
          {protocolTab === 'glp1' && <SupportProtocolGLP1 s={s} />}
          {protocolTab === 'mito' && <SupportProtocolMito s={s} />}
          {protocolTab === 'steatosis' && <SupportProtocolSteatosis s={s} />}
          {protocolTab === 'raas' && <SupportProtocolRAAS s={s} />}
          {protocolTab === 'electrolytes' && <SupportProtocolElectrolytes s={s} />}
          {protocolTab === 'prolactin' && <SupportProtocolProlactin s={s} />}
          {protocolTab === 'adaptogen' && <SupportProtocolAdaptogen s={s} />}
          {protocolTab === 'peptide' && <SupportProtocolPeptide s={s} />}
          {protocolTab === 'postcycle' && <SupportProtocolPostCycle s={s} />}
          {protocolTab === 'emergency' && <SupportProtocolEmergency s={s} />}
          {protocolTab === 'interactions' && <SupportProtocolInteractions s={s} />}
          {protocolTab === 'cost' && <SupportProtocolCost s={s} />}
          {protocolTab === 'women' && <SupportProtocolWomen s={s} />}


          {protocolTab === 'symptoms' && (
            <div style={{ padding: '0 0 0' }}>
              <SymptomSolverTab s={s} />
            </div>
          )}

        </div>
      )}
    </div>
  );
};
