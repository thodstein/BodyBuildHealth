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
    <div style={{ padding:'0 0 24px' }}>
      {protocolView === 'menu' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ padding:'16px', borderRadius:16, background:'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(59,130,246,0.08))', border:'1px solid rgba(139,92,246,0.18)', backdropFilter:'blur(14px)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <span style={{ width:36, height:36, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#8b5cf6,#6366f1)', fontSize:18, boxShadow:'0 4px 16px rgba(139,92,246,0.3)' }}>📋</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:850, color:'#fff', letterSpacing:'-0.3px' }}>Выберите протокол поддержки</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:1 }}>Фазовые модели 1→4 по анализам · справочники по показаниям</div>
              </div>
              <span style={{ fontSize:12, fontWeight:800, color:'#a78bfa', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.20)', padding:'6px 10px', borderRadius:12 }}>{PROTOCOL_CARDS.length}</span>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', lineHeight:1.5 }}>Органные протоколы — по лабораторным порогам. Справочники — по показаниям. Все назначения — только врачом.</div>
          </div>
          <div style={{ borderRadius:14, padding:'12px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.22)', display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:18, flexShrink:0, marginTop:1 }}>⚠️</span>
            <div style={{ fontSize:11, fontWeight:700, color:'#fca5a5', lineHeight:1.5 }}>
              Все протоколы — <b style={{color:'#ef4444'}}>ознакомительные</b>. Назначение препаратов и схемы — <b style={{color:'#ef4444'}}>только врачом</b>. Самолечение опасно для жизни.
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {PROTOCOL_CARDS.map(p => (
              <button key={p.id} onClick={() => { setProtocolTab(p.id); setProtocolView('detail'); }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px rgba(0,0,0,0.35), 0 0 0 1px ${p.color}22 inset`; (e.currentTarget as HTMLButtonElement).style.borderColor = p.color+'66'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)'; (e.currentTarget as HTMLButtonElement).style.borderColor = p.color+'33'; }}
                style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', textAlign:'left', gap:8,
                  padding:'14px', borderRadius:16, cursor:'pointer', border:'1px solid '+p.color+'33',
                  background:'rgba(24,24,27,0.6)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
                  transition:'all 0.2s cubic-bezier(0.25,0.46,0.45,0.94)', boxShadow:'0 4px 20px rgba(0,0,0,0.25)', minHeight:108
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:9, width:'100%' }}>
                  <span style={{ width:36, height:36, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background:`${p.color}14`, border:`1px solid ${p.color}22`, fontSize:18, flexShrink:0 }}>{p.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#fff', letterSpacing:'-0.2px', lineHeight:1.2 }}>{p.label}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.desc}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:'auto' }}>
                  {p.kind === 'reference' && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:20,
                      background:'rgba(100,116,139,0.14)', color:'#94a3b8', border:'1px solid rgba(100,116,139,0.18)' }}>справочник</span>
                  )}
                  {p.tags.slice(0,3).map((t: any, ti: number) => (
                    <span key={ti} style={{ fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:20,
                      background:p.color+'14', color:p.color, border:`1px solid ${p.color}22` }}>{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <button onClick={() => setProtocolView('menu')} style={{ display:'inline-flex', alignItems:'center', gap:6, alignSelf:'flex-start',
            padding:'9px 14px', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer',
            background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(10px)'
          }}>← К списку протоколов</button>

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
