// @ts-nocheck
/**
 * SupportProtocols.tsx — ПОЛНОЕ НАПОЛНЕНИЕ: фазы, тайминг, дневники, мониторинг
 * Секция: protocols
 * Расширено: Кардио, Печень, Почки, развёрнутые подвкладки для Суставов и Акне
 */
import React, { useState } from 'react';
import { FertilityPCTScreen } from '../FertilityPCTScreen';
import { InfoErrorBoundary } from './SupportScreenData';
import { SymptomSolverTab } from './SymptomSolverTab';

const cardBg = { background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' };
const pillActive = (c: string) => ({ padding:'5px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap' as const, cursor:'pointer', background:c, color:'#000', border:'1px solid '+c });
const pillInactive = () => ({ padding:'5px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap' as const, cursor:'pointer', background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' });

const PhaseLabel: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{ fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:4, background:color+'22', color }}>{label}</span>
);

const ItemRow: React.FC<{ name: string; dose: string; timing: string; note: string; color: string }> = ({ name, dose, timing, note, color }) => (
  <div style={{ padding:'5px 8px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{name}</span>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <span style={{ fontSize:8, fontWeight:700, color }}>{dose}</span>
        <span style={{ fontSize:7, color:'var(--text-dim)', padding:'1px 5px', borderRadius:4, background:'rgba(255,255,255,0.04)' }}>{timing}</span>
      </div>
    </div>
    <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3, marginTop:1 }}>{note}</div>
  </div>
);

export const SupportProtocols: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    protocolTab,
    setProtocolTab,
    protocolView,
    setProtocolView,
    neuroTab,
    setNeuroTab,
    jointPain,
    setJointPain,
    injuryHistory,
    setInjuryHistory,
    trainLoad,
    setTrainLoad,
  } = s;

  const jointScore = Math.min(100, Math.round(jointPain * 10 + injuryHistory * 5 + trainLoad * 3));

  // Protocol card definitions for the menu grid
  const PROTOCOL_CARDS = [
    { id:'symptoms', icon:'🩺', label:'Симптомы', desc:'Поиск и коррекция симптомов: база решений, дневник, приверженность', color:'#ef4444', system:'Общее', tags:['Симптомы','Решения','Дневник','Лабы'] },
    { id:'neuro', icon:'🧠', label:'Нейропротекция', desc:'Нейротоксичность ААС: механизмы, калькулятор риска, протокол', color:'#06b6d4', system:'ЦНС', tags:['Нейротоксичность','BDNF','ГАМК','Глутамат'] },
    { id:'cardio', icon:'❤️', label:'Кардио', desc:'СС-защита: АД, липиды, фиброз, аритмии на ААС', color:'#ef4444', system:'ССС', tags:['АД','Липиды','Аритмия','Фиброз'] },
    { id:'hepatic', icon:'🫁', label:'Печень', desc:'Гепатопротекция: 17α-алкилированные, ферменты, стеатоз', color:'#84cc16', system:'Печень', tags:['АЛТ/АСТ','Холестаз','Стеатоз'] },
    { id:'renal', icon:'💧', label:'Почки', desc:'Нефропротекция: RAAS, протеинурия, СКФ, электролиты', color:'#3b82f6', system:'Почки', tags:['СКФ','Протеинурия','RAAS'] },
    { id:'joints', icon:'🦴', label:'Суставы', desc:'Здоровье суставов: коллаген, гиалуронан, сухожилия', color:'#22c55e', system:'ОДА', tags:['Коллаген','Сухожилия','Воспаление'] },
    { id:'acne', icon:'🔴', label:'Акне', desc:'Андроген-индуцированное акне: топика, системная, рубцы', color:'#f97316', system:'Кожа', tags:['Андрогены','Себум','Рубцы'] },
    { id:'injections', icon:'💉', label:'Инъекции', desc:'Техника, осложнения, постинъекционные абсцессы', color:'#14b8a6', system:'Общее', tags:['Техника','Абсцесс','Стерильность'] },
    { id:'thyroid', icon:'🦋', label:'Тиреоидный', desc:'Щитовидная железа: T3/T4/ТТГ на ААС, GH, диете', color:'#ec4899', system:'Эндокринная', tags:['ТТГ','T3/T4','GH','Гипотиреоз'] },
    { id:'immune', icon:'🛡️', label:'Иммунитет', desc:'Иммунная модуляция: SHBG, микроорганизмы, вакцинация', color:'#6366f1', system:'Иммунная', tags:['Инфекции','Вакцинация','SHBG'] },
    { id:'e2', icon:'🔬', label:'Эстрадиол', desc:'Контроль E2: AI, SERM, гинекомастия, стероидный баланс', color:'#f472b6', system:'Гормоны', tags:['Ароматаза','AI','SERM','Гинекомастия'] },
    { id:'sleep', icon:'💤', label:'Сон', desc:'Качество сна: мелатонин, GABA, кортизол, HPA-ось', color:'#8b5cf6', system:'Нервная', tags:['Мелатонин','ГАМК','Кортизол'] },
    { id:'detox', icon:'🧬', label:'Детокс', desc:'Фаза II детокса: метилирование, глутатион, Nrf2', color:'#22d3ee', system:'Печень', tags:['Глутатион','Метилирование','Nrf2'] },
    { id:'gh', icon:'🫀', label:'GH/IGF-1', desc:'Гормон роста: соматопауза, IGF-1, метаболические эффекты', color:'#2dd4bf', system:'Эндокринная', tags:['GH','IGF-1','Соматопауза'] },
    { id:'glp1', icon:'🍪', label:'GLP-1', desc:'Инкретины: GLP-1, вес, глюкоза, липиды, вискеральный жир', color:'#f59e0b', system:'Метаболизм', tags:['GLP-1','Вес','Глюкоза','Липиды'] },
    { id:'hemato', icon:'🩸', label:'Гематология', desc:'Гематокрит, вязкость крови, тромбоциты, эритроцитоз', color:'#ef4444', system:'Кровь', tags:['HCT','Тромбоциты','Вязкость'] },
    { id:'metabolic', icon:'⚖️', label:'Метаболизм', desc:'Инсулин, липиды, глюкоза, мочевая кислота, гомоцистеин', color:'#f59e0b', system:'Метаболизм', tags:['ИР','Липиды','Глюкоза','Гомоцистеин'] },
    { id:'gi', icon:'🫀', label:'ЖКТ', desc:'Желудочно-кишечный тракт: кишечник, всасывание, микробиом', color:'#84cc16', system:'ЖКТ', tags:['Микробиом','Всасывание','Проницаемость'] },
    { id:'hair', icon:'💇', label:'Кожа/Волосы', desc:'Андрогенетическая алопеция, кожа, себум, акне', color:'#f97316', system:'Кожа', tags:['Алопеция','DHT','Андрогены'] },
    { id:'electrolytes', icon:'⚡', label:'Электролиты', desc:'K⁺/Na⁺/Mg²⁺/Ca²⁺: коррекция, экстренная помощь', color:'#ef4444', system:'Общее', tags:['K⁺','Mg²⁺','Экстренная'] },
    { id:'prolactin', icon:'🤱', label:'Пролактин', desc:'Гиперпролактинемия: каберголин, B6, фазы по PRL', color:'#ec4899', system:'Гормоны', tags:['PRL','Каберголин','D2-агонист'] },
    { id:'adaptogen', icon:'🌿', label:'Адаптогены/HPA', desc:'Кортизол: фазы, HPA-ось, аддисонический криз', color:'#22c55e', system:'Нервная', tags:['Кортизол','HPA','Адаптогены'] },
    { id:'mito', icon:'⚡', label:'Митохондрии', desc:'NAD⁺/CoQ10/PQQ: митохондриальный биогенез, энергия', color:'#06b6d4', system:'Метаболизм', tags:['NAD⁺','CoQ10','Митохондрии'] },
    { id:'steatosis', icon:'🫁', label:'Стеатоз', desc:'НАЖБП: берберин, TUDCA, омега-3 EPA, HБП', color:'#84cc16', system:'Печень', tags:['НАЖБП','Стеатоз','Фиброз'] },
    { id:'raas', icon:'🫀', label:'RAAS (АД/Почки)', desc:'Ренин-ангиотензин: АД, протеинурия, ХБП, фиброз', color:'#3b82f6', system:'ССС', tags:['АД','RAAS','Протеинурия'] },
    { id:'peptide', icon:'🧬', label:'Пептиды', desc:'GHRP, BPC-157, ноотропы, иммунные — справочник', color:'#2dd4bf', system:'Общее', tags:['GHRP','BPC-157','Ноотропы'] },
    { id:'postcycle', icon:'🔄', label:'Постцикл', desc:'Реабилитация после курса: липиды, HCT, HPTA, нейро', color:'#8b5cf6', system:'Общее', tags:['HPTA','ПКТ','Липиды','Гематокрит'] },
    { id:'pct', icon:'💊', label:'ПКТ', desc:'Послекурсовая терапия: SERM, hCG, HPTA-восстановление', color:'#22c55e', system:'Гормоны', tags:['ПКТ','SERM','hCG','HPTA'] },
    { id:'fertility', icon:'👶', label:'Фертильность', desc:'Репродуктивное здоровье: спермограмма, гормоны, DFI', color:'#ec4899', system:'Репродуктивная', tags:['Сперма','Гормоны','DFI','ЭКО'] },
    { id:'hrt', icon:'🔄', label:'ГЗТ (HRT)', desc:'Заместительная гормональная терапия: протоколы, мониторинг', color:'#f59e0b', system:'Гормоны', tags:['ГЗТ','TRT','Замещение'] },
  ];

  // Local sub-tabs for expanded protocols
  const [jointTab, setJointTab] = useState('protocol');
  const [acneTab, setAcneTab] = useState('protocol');
  const [cardioTab, setCardioTab] = useState('protocol');
  const [hepaticTab, setHepaticTab] = useState('protocol');
  const [renalTab, setRenalTab] = useState('protocol');
  const [injectionTab, setInjectionTab] = useState('map');
  const [hematoTab, setHematoTab] = useState('protocol');
  const [metabolicTab, setMetabolicTab] = useState('protocol');
  const [giTab, setGiTab] = useState('protocol');
  const [hairTab, setHairTab] = useState('protocol');
  const [thyroidTab, setThyroidTab] = useState('protocol');
  const [immuneTab, setImmuneTab] = useState('protocol');
  const [e2Tab, setE2Tab] = useState('protocol');
  const [sleepTab, setSleepTab] = useState('protocol');
  const [detoxTab, setDetoxTab] = useState('protocol');
  const [ghTab, setGhTab] = useState('protocol');
  const [glp1Tab, setGlp1Tab] = useState('protocol');

  // NEW PROTOCOLS (Jul 09)
  const [electrolytesTab, setElectrolytesTab] = useState('protocol');
  const [prolactinTab, setProlactinTab] = useState('protocol');
  const [adaptogenTab, setAdaptogenTab] = useState('protocol');
  const [mitoTab, setMitoTab] = useState('protocol');
  const [steatosisTab, setSteatosisTab] = useState('protocol');
  const [raasTab, setRaasTab] = useState('protocol');
  const [peptideTab, setPeptideTab] = useState('protocol');
  const [postCycleTab, setPostCycleTab] = useState('protocol');

  // Определение уровня риска/триажа для item
  const triageBadge = (tier: 'ess' | 'rec' | 'opt') => {
    const cfg: Record<string, { label: string; color: string; bg: string }> = {
      ess: { label: '🔴 Обязательно', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
      rec: { label: '🟡 Рекомендовано', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
      opt: { label: '🟢 Опционально', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    };
    const c = cfg[tier];
    return <span style={{ fontSize:6, fontWeight:700, padding:'1px 5px', borderRadius:3, background:c.bg, color:c.color, marginLeft:4 }}>{c.label}</span>;
  };

  // Бейдж фазы цикла
  const phaseBadge = (phase: string) => {
    const colors: Record<string, string> = { blast:'#ef4444', cruise:'#f59e0b', pct:'#22c55e', bridge:'#6366f1', trt:'#3b82f6' };
    return <span style={{ fontSize:6, fontWeight:700, padding:'1px 4px', borderRadius:3, background:(colors[phase]||'#888')+'22', color:colors[phase]||'#888', marginLeft:4 }}>{phase === 'blast' ? 'Курс' : phase === 'cruise' ? 'Крейсер' : phase === 'pct' ? 'ПКТ' : phase === 'bridge' ? 'Мост' : phase === 'trt' ? 'TRT' : phase}</span>;
  };

  // Полипрагмазия-чек
  const [activeProtocolCount, setActiveProtocolCount] = useState(0);
  const polypharmNote = activeProtocolCount > 3
    ? <div style={{ borderRadius:8, padding:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', marginBottom:8 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'#ef4444', marginBottom:2 }}>⚠️ Полипрагмазия: активных протоколов {'>'}3 ({activeProtocolCount})</div>
        <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>• CYP450-конкуренция: NAC + TUDCA (UGT2B7), берберин + статины (CYP3A4), омега-3 + аспирин (риск кровотечения)<br/>• Разделите NAC и TUDCA на 2 ч, берберин и статины — на 4 ч<br/>• При ≥15 препаратов — риск полипрагмазии: ↓ до 7-10 core</div>
      </div>
    : null;

  // ── Единый ItemRow с триажем, фазой и отметкой обязательности ──
  const ItemRowTriage: React.FC<{ name: string; dose: string; timing: string; note: string; color: string; tier?: 'ess' | 'rec' | 'opt'; phase?: string }> = ({ name, dose, timing, note, color, tier, phase }) => (
    <div style={{ padding:'5px 8px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:2 }}>
        <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{name}{tier ? triageBadge(tier) : null}{phase ? phaseBadge(phase) : null}</span>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:8, fontWeight:700, color }}>{dose}</span>
          <span style={{ fontSize:7, color:'var(--text-dim)', padding:'1px 5px', borderRadius:4, background:'rgba(255,255,255,0.04)' }}>{timing}</span>
        </div>
      </div>
      <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3, marginTop:1 }}>{note}</div>
    </div>
  );

  // ── Render phase card (единый для всех протоколов) ──
  // ── Compact row for simple items ──
  const renderRow = (x: any, i: number, color: string) => (
    <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
      <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.n}</span>
      {x.d ? <span style={{ fontSize:7, color, marginLeft:4 }}>{x.d}</span> : null}
      <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.t}</span>
      {x.o ? <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.o}</div> : null}
    </div>
  );

  // ── Render phase card (единый для всех протоколов) ──
  const renderPhase = (p: any, i: number) => (
    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
      {p.items.map((x: any, xi: number) => (
        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>{x.note}</div>
        </div>
      ))}
    </div>
  );

  // ── Render timing card ──
  const timingBlock = (protocol: string, slots: Array<{time:string;items:Array<{n:string;why:string}>}>) => (
    <div style={cardBg}>
      <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Тайминг приёма</div>
      {slots.map((slot: any, si: number) => (
        <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>{slot.time}</div>
          {slot.items.map((x: any, xi: number) => (
            <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
              <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // ── Render monitoring card ──
  const monitoringBlock = (markers: Array<{marker:string;target:string;when:string;action:string}>) => (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={cardBg}>
        <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг</div>
        {markers.map((m: any, i: number) => (
          <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#60a5fa' }}>{m.marker}</span>
              <span style={{ fontSize:8, fontWeight:600, color:'#3b82f6' }}>{m.when}</span>
            </div>
            <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#60a5fa'}}>Цель: {m.target}</b></div>
            <div style={{ fontSize:7, color:'#60a5fa', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(59,130,246,0.06)' }}>💡 {m.action}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
        <div style={{ padding:'0 0 70px' }}>
          {protocolView === 'menu' ? (
            /* ── MENU: карточки-кнопки всех протоколов ── */
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--text-light)', marginBottom:8 }}>📋 Выберите протокол поддержки</div>
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
            /* ── DETAIL: выбранный протокол ── */
            <div>
              {/* Back button */}
              <button onClick={() => setProtocolView('menu')} style={{ display:'flex', alignItems:'center', gap:4,
                padding:'6px 12px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', marginBottom:8,
                background:'var(--bg-secondary)', color:'var(--text-light)', border:'1px solid var(--border)'
              }}>← Назад к списку</button>

              {/* Warning card (minimized) */}
              <div style={{ borderRadius:10, padding:10, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', marginBottom:8 }}>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}>
                  <b style={{color:'#f59e0b'}}>⚠️ Информация ознакомительная.</b> Подбор — врачом. Без лаборатории — среднестатистические риски. 💊 = рецептурный, требует врача.
                </div>
              </div>

          {/* Content: PCT / Fertility / HRT */}
          {(['pct','fertility','hrt'] as string[]).includes(protocolTab) && (
            <InfoErrorBoundary label="Протоколы ПКТ/Фертильность/HRT">
              <FertilityPCTScreen initialTab={protocolTab === 'pct' ? 'pct-plan' : protocolTab === 'hrt' ? 'hrt' : undefined} restrictToMode={protocolTab as 'pct' | 'fertility' | 'hrt'} />
            </InfoErrorBoundary>
          )}

{/* ══════════ NEURO ══════════ */}
          {protocolTab === 'neuro' && (<InfoErrorBoundary label="Нейропротекция">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              {/* Header */}
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#06b6d4', marginBottom:2 }}>🧠 Нейротоксичность ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Механизмы нейротоксичности, калькулятор риска и фазовый протокол нейропротекции.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'calculator', label:'📊 Калькулятор риска' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг приёма' },
                  { id:'diary', label:'📓 Дневник симптомов' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setNeuroTab(t.id)}
                    style={neuroTab === t.id ? pillActive('#06b6d4') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {neuroTab === 'mechanisms' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:6 }}>🧠 Фундаментальные механизмы</div>
                    {[
                      { title:'Гематоэнцефалический барьер (ГЭБ)', desc:'Стероиды свободно проникают через ГЭБ. При супрафизиологических дозах ААС — нейротоксический каскад через повышение проницаемости (подавление клаудинов-5). Тренболон накапливается в гиппокампе, повышая проницаемость ГЭБ.', evidence:'A' },
                      { title:'Андрогенные и эстрогенные рецепторы мозга', desc:'AR-гиперстимуляция → окислительный стресс нейронов. ER-опосредованная нейропротекция утрачена при подавлении ароматазы. При низком E2 нейроны теряют ключевой механизм защиты.', evidence:'B' },
                      { title:'Негормональные механизмы', desc:'ГАМК-подавление, NMDA-эксайтотоксичность, митохондриальная дисфункция, BDNF-подавление, ионные каналы Ca²⁺, активация микроглии через TLR4.', evidence:'B' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(6,182,212,0.04)', border:'1px solid rgba(6,182,212,0.12)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#22d3ee' }}>{m.title}</span>
                          <span style={{ fontSize:7, fontWeight:700, padding:'1px 5px', borderRadius:3, background:m.evidence==='A'?'rgba(34,197,94,0.15)':'rgba(245,158,11,0.15)', color:m.evidence==='A'?'#22c55e':'#f59e0b' }}>Уровень {m.evidence}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:6 }}>🔬 Детальные механизмы (8 путей токсичности)</div>
                    {[
                      { title:'ГАМК-ергическая дисфункция', desc:'ААС повышают ГАМК-ергический тормозной тон через нейростероиды → подавление ГнРГ. Дисрегуляция GABA-A вызывает тревожность, депрессию при отмене. При хроническом воздействии — downregulation GABA-A рецепторов.' },
                      { title:'Окислительный стресс', desc:'Истощение глутатиона в гиппокампе, перекисное окисление липидов. Супероксид-дисмутаза снижена при нандролоне и станозололе. NADPH-оксидаза активирована.' },
                      { title:'Нейровоспаление', desc:'Активация микроглии через TLR4 → TNF-α, IL-1β, IL-6. NF-κB путь активирован. Хроническое воспаление в гиппокампе. Цитокиновый шторм при высоких дозах.' },
                      { title:'BDNF подавление', desc:'Нандролон и станозолол снижают BDNF на 30-50%. Нарушение CREB-BDNF-TrkB каскада → атрофия дендритных шипиков. Гиппокампальная нейропластичность нарушена.' },
                      { title:'Глутаматная эксайтотоксичность', desc:'ААС повышают глутамат → NMDA-рецепторы → Ca²⁺ influx → митохондриальная дисфункция → апоптоз. Кальпаин-опосредованная протеолиз → гибель нейронов.' },
                      { title:'Нарушение ГЭБ', desc:'Повышение проницаемости ГЭБ через подавление окклюдина, клаудина-5, ZO-1. Проникновение периферических цитокинов и токсинов в мозг.' },
                      { title:'Апоптоз нейронов', desc:'Каспаза-3 в CA1/CA3 гиппокампа. Фрагментация ДНК. Сдвиг Bax/Bcl-2 в проапоптотический путь. Апоптоз дофаминергических нейронов.' },
                      { title:'Дофаминовая система', desc:'Изменение D2-рецепторов в стриатуме → ангедония, агрессия. Мезокортикальный путь нарушен. DAT-транспортёр (дофамин) подавлен при нандролоне.' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.08)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#22d3ee', marginBottom:2 }}>{m.title}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calculator */}
              {neuroTab === 'calculator' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:6 }}>⚠️ Классификация нейротоксичности ААС (шкала 1–10)</div>
                    {[
                      { name:'Тренболон', score:10, color:'#ef4444', desc:'Максимальная: ГЭБ + окислит. стресс + глутамат + апоптоз', ref:'Tucci 2010, Bertozzi 2017' },
                      { name:'Нандролон', score:8, color:'#ef4444', desc:'BDNF подавление, нейровоспаление, дофаминовая дисфункция', ref:'Kaufman 2019, Ricci 2012' },
                      { name:'Станозолол', score:7, color:'#f97316', desc:'ГАМК-дисфункция, BDNF ↓, выраженный оксидативный стресс', ref:'Turillazzi 2011' },
                      { name:'Метандиенон', score:6, color:'#f97316', desc:'Эстрогеновая активность + 17α-алкил → печёночный метаболит', ref:'Maravelias 2004' },
                      { name:'Болденон', score:5, color:'#f59e0b', desc:'Гематокрит (>52%) → гипоксия мозга, снижение кровотока', ref:'Hartgens 2004' },
                      { name:'Тестостерон >500 мг', score:4, color:'#f59e0b', desc:'AR-гиперстимуляция, нейростероидный дисбаланс', ref:'Kanayama 2010' },
                      { name:'Оксандролон', score:3, color:'#22c55e', desc:'Низкая андрогенность, минимальная нейротоксичность', ref:'Orr 2011' },
                      { name:'Мастерон', score:3, color:'#22c55e', desc:'DHT-производное, нейростероидный профиль', ref:'-' },
                      { name:'Примоболан', score:2, color:'#22c55e', desc:'Минимальная нейротоксичность, низкая андрогенность', ref:'-' },
                    ].map((drug: any, i: any) =>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ flex:1, fontSize:8, color:'var(--text-light)' }}>{drug.name}</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)', maxWidth:120, textAlign:'right', lineHeight:1.1 }}>{drug.desc}</span>
                        <span style={{ fontSize:9, fontWeight:800, color:drug.color, width:24, textAlign:'center' }}>{drug.score}</span>
                        <div style={{ width:50, height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                          <div style={{ width:drug.score*10+'%', height:'100%', borderRadius:2, background:drug.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🩺 Симптомы нейротоксичности — шкала тяжести</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 6px', lineHeight:1.3 }}>При появлении любых симптомов — подключите нейропротекцию. При ≥3 симптомах — рассмотрите снижение доз.</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                      {[
                        { s:'Депрессия', sev:'ТЯЖ', c:'#ef4444' },{ s:'Тревожность', sev:'СРЕД', c:'#f97316' },{ s:'Агрессия', sev:'ТЯЖ', c:'#ef4444' },
                        { s:'Нарушение сна', sev:'СРЕД', c:'#f97316' },{ s:'Когнитивное снижение', sev:'ТЯЖ', c:'#ef4444' },
                        { s:'Потеря памяти', sev:'ТЯЖ', c:'#ef4444' },{ s:'Ангедония', sev:'СРЕД', c:'#f97316' },
                        { s:'Импульсивность', sev:'ЛЁГК', c:'#f59e0b' },{ s:'Спутанность сознания', sev:'ТЯЖ', c:'#ef4444' },
                        { s:'Эмоц. нестабильность', sev:'ЛЁГК', c:'#f59e0b' },{ s:'Тремор', sev:'ЛЁГК', c:'#f59e0b' },{ s:'Головные боли', sev:'СРЕД', c:'#f97316' },
                      ].map((x: any, i: any) =>(
                        <span key={i} style={{ fontSize:8, padding:'4px 8px', borderRadius:10, background:x.c+'14', color:x.c, border:'1px solid '+x.c+'33' }}>{x.sev} {x.s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Protocol phases */}
              {neuroTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {
                      phase:'ФАЗА 1 · ЯДРО', label:'Обязательно всем на курсе ААС (любая доза)', color:'#22c55e',
                      condition:'Условие: курс ААС любой интенсивности',
                      desc:'Начинайте за 1 неделю ДО курса. Базовая нейропротекция закрывает окислительный стресс и ГАМК-дисбаланс. Эти вещества составляют фундамент — без них нейротоксичность неизбежна.',
                      items:[
                        { name:'NAC', dose:'1200-2400 мг', timing:'Утро + Вечер', note:'Предшественник глутатиона. Только NAC проникает в мозг и восстанавливает нейрональный GSH' },
                        { name:'Omega-3 (EPA+DHA)', dose:'3-5 г', timing:'С едой', note:'DHA — структурный компонент мембран нейронов. EPA → резолвины → разрешение нейровоспаления' },
                        { name:'Mg L-Threonate', dose:'1000-2000 мг', timing:'Вечер', note:'Единственная форма Mg через ГЭБ. Модуляция NMDA-рецепторов, снижение эксайтотоксичности' },
                        { name:'Таурин', dose:'2-3 г', timing:'Утро + Вечер', note:'ГАМК-агонист, осморегуляция нейронов, блокада Ca²⁺-каналов' },
                        { name:'Глицин', dose:'3 г', timing:'На ночь', note:'Ко-агонист NMDA (защитный), улучшение сна, снижение кортизола' },
                      ]
                    },
                    {
                      phase:'ФАЗА 2 · БАЗА', label:'При дозах ААС >500 мг/нед или стаж >2 лет', color:'#f59e0b',
                      condition:'Условие: кумулятивная доза >500 мг/нед ИЛИ длительный стаж',
                      desc:'Добавляется при повышении дозировок. Митохондриальная поддержка и холинергическая защита. Ключевой рубеж — переход от профилактики к активной защите.',
                      items:[
                        { name:'Alpha-Lipoic Acid', dose:'600 мг', timing:'Утро натощак', note:'Митохондриальный антиоксидант, регенерирует GSH и вит.C/E. Проникает через ГЭБ' },
                        { name:'CoQ10 (убихинол)', dose:'200-400 мг', timing:'С жирной едой', note:'ЭТЦ митохондрий, снижение перекисного окисления. Убихинол > убихинон' },
                        { name:'Pregnenolone', dose:'10-30 мг', timing:'Утро', note:'Нейростероид — «материнский гормон». Восполняет подавленный синтез, модулирует GABA-A' },
                        { name:'Агмантин', dose:'1-2 г', timing:'Утро натощак', note:'Модулятор NMDA (блокирует при избытке, активирует при дефиците). NO-донатор' },
                        { name:'Альфа-GPC', dose:'300-600 мг', timing:'Утро', note:'40% холина по весу (vs 14% в CDP-холине). Синтез ацетилхолина → когниции' },
                      ]
                    },
                    {
                      phase:'ФАЗА 3 · УСИЛЕНИЕ', label:'При тренболоне / нандролоне / станозололе', color:'#f97316',
                      condition:'Условие: в курсе присутствуют высоко-нейротоксичные ААС',
                      desc:'Специфическая защита от наиболее нейротоксичных соединений. Восстановление нейрогенеза и миелинизации.',
                      items:[
                        { name:'Lion\'s Mane (ежовик)', dose:'1-3 г', timing:'Утро', note:'Стимуляция NGF (фактор роста нервов). Нейрогенез в гиппокампе. Миелинизация' },
                        { name:'DHEA', dose:'25-50 мг', timing:'Утро', note:'Нейростероид. Восстановление GABA-A, снижение депрессии, повышение нейропластичности' },
                        { name:'Phosphatidylserine', dose:'300-600 мг', timing:'Вечер', note:'Фосфолипид мембран нейронов. Снижение кортизола, поддержка текучести мембран' },
                        { name:'Ginkgo Biloba', dose:'120-240 мг', timing:'Утро', note:'Церебральный кровоток +25%, антиоксидант, ингибитор PAF. Стандартизация 24% гликозидов' },
                        { name:'Бромантан', dose:'50-100 мг', timing:'Утро', note:'Актопротектор. Повышение тирозина и серотонина в гипоталамусе. Нейропротекция' },
                        { name:'Фасорацетам', dose:'100-200 мг', timing:'Утро', note:'AMPA-позитивный модулятор, регуляция глутамата. Улучшение памяти +30% в тестах' },
                        { name:'Гуперзин А', dose:'50-100 мкг', timing:'Утро', note:'Ингибитор AChE. Повышение ацетилхолина на 40-60%. Нейропротективный эффект' },
                      ]
                    },
                    {
                      phase:'ФАЗА 4 · МАКСИМУМ', label:'При нейросимптомах любой тяжести', color:'#ef4444',
                      condition:'Условие: появление ≥1 симптома нейротоксичности',
                      desc:'Максимальный уровень защиты при появлении симптомов. Ноотропный компонент для восстановления когнитивных функций.',
                      items:[
                        { name:'Bacopa Monnieri', dose:'300-600 мг', timing:'Утро', note:'Улучшение памяти, дендритное ветвление. Стандартизация 20% бакозидов. Эффект через 4-6 нед' },
                        { name:'L-Theanine', dose:'200-400 мг', timing:'Утро + Вечер', note:'ГАМК-модуляция. Повышение альфа-волн мозга. Снижение тревоги без седации' },
                        { name:'Citicoline', dose:'500-1000 мг', timing:'Утро', note:'Цитидин + холин. Синтез фосфатидилхолина мембран. Восстановление после ишемии' },
                        { name:'Noopept', dose:'10-30 мг', timing:'Утро + День', note:'Циклопролилглицин. Повышение BDNF и NGF. Улучшение памяти и когниций. Биодоступность ~99%' },
                        { name:'Семакс', dose:'1-3 мг', timing:'Утро интраназально', note:'Пептид ACTH(4-7)-Pro-Gly-Pro. Повышение BDNF +30%. Нейрогенез. Ноотропный эффект' },
                        { name:'Кортексин', dose:'10 мг/день', timing:'Утро в/м', note:'Полипептиды коры мозга телят. Нейропротекция + нейрорепарация. Курс 10 дней' },
                      ]
                    },
                  ].map((phase: any, pi: any) =>(
                    <div key={pi} style={{ ...cardBg, background:phase.color+'08', border:'1px solid '+phase.color+'22' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:4, background:phase.color+'22', color:phase.color }}>{phase.phase}</span>
                        <span style={{ fontSize:10, fontWeight:600, color:phase.color, flex:1 }}>{phase.label}</span>
                      </div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                        <b style={{color:phase.color}}>{phase.condition}</b> — {phase.desc}
                      </div>
                      {phase.items.map((item: any, ii: any) =>(
                        <ItemRow key={ii} name={item.name} dose={item.dose} timing={item.timing} note={item.note} color={phase.color} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Timing */}
              {neuroTab === 'timing' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:6 }}>⏰ Суточный тайминг нейропротекции</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Распределение по времени суток критично: одни вещества работают утром, другие — на ночь.</p>
                    {[
                      { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                        { n:'NAC (600 мг)', why:'Пик оксидативного стресса — сразу после пробуждения. Натощак → быстрая абсорбция' },
                        { n:'Альфа-GPC (300 мг)', why:'Стимуляция ацетилхолина. Улучшение фокуса и внимания на тренировке' },
                        { n:'Lion\'s Mane (1 г)', why:'NGF стимуляция. Пик когнитивной активности утром' },
                        { n:'Pregnenolone (10-30 мг)', why:'Восполнение нейростероидов. Не принимать на ночь — может нарушить сон' },
                        { n:'DHEA (25-50 мг)', why:'Кортизол-противодействие. Пик кортизола — утренний' },
                        { n:'Bacopa (300 мг)', why:'Адаптоген, улучшение памяти. С едой для снижения ЖКТ-эффектов' },
                      ]},
                      { time:'☀️ День (12:00–14:00)', color:'#f97316', items:[
                        { n:'CoQ10 (200 мг)', why:'С жирной пищей (обед). Биодоступность +300% с жирами' },
                        { n:'Агмантин (1 г)', why:'Перед тренировкой. NO-донатор + NMDA-модулятор. Пампинг + нейропротекция' },
                        { n:'Noopept (10 мг)', why:'Пик умственной активности. Не после 16:00 — может мешать сну' },
                        { n:'Таурин (1 г)', why:'Осморегуляция, анти-эксайтотоксичность. За 30 мин до тренировки' },
                      ]},
                      { time:'🌆 Вечер (17:00–19:00)', color:'#8b5cf6', items:[
                        { n:'Omega-3 (3 г)', why:'С ужином. Жиры улучшают усвоение. EPA/DHA — структурная интеграция в мембраны' },
                        { n:'Фасорацетам (100 мг)', why:'AMPA-модуляция. Не позже 18:00 — стимулирует глутамат' },
                        { n:'Phosphatidylserine (300 мг)', why:'Снижение вечернего кортизола. Подготовка ко сну' },
                      ]},
                      { time:'🌙 Ночь (21:00–23:00)', color:'#6366f1', items:[
                        { n:'Mg L-Threonate (1000 мг)', why:'Пик абсорбции магния. NMDA-блокада. Глубокий сон' },
                        { n:'Глицин (3 г)', why:'Тормозной нейромедиатор. Снижение температуры тела → засыпание. NMDA-коагонист' },
                        { n:'L-Theanine (200 мг)', why:'Альфа-волны мозга. Снижение тревоги без седации. Качество сна' },
                        { n:'NAC (600 мг)', why:'Ночной пик окислительного стресса. Медленное высвобождение глутатиона' },
                        { n:'Гуперзин А (50 мкг)', why:'REM-сон консолидация памяти. Не превышать дозу — иначе бессонница' },
                      ]},
                    ].map((slot: any, si: any) =>(
                      <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                        {slot.items.map((x: any, xi: any) =>(
                          <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                            <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                            <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Symptom diary */}
              {neuroTab === 'diary' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>📓 Дневник нейросимптомов (еженедельный чек-лист)</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Заполняйте раз в неделю. При ≥5 баллов — переходите на ФАЗУ 4 протокола. При ≥10 баллов — рассмотрите снижение доз ААС.</p>
                    {[
                      { s:'Депрессия / подавленность', w:2 },{ s:'Тревожность / панические атаки', w:2 },
                      { s:'Агрессия / раздражительность', w:2 },{ s:'Бессонница / нарушение сна', w:2 },
                      { s:'Снижение концентрации', w:1 },{ s:'Провалы в памяти', w:2 },
                      { s:'Ангедония (ничего не радует)', w:2 },{ s:'Импульсивные решения', w:1 },
                      { s:'Головные боли', w:1 },{ s:'Эмоциональная нестабильность', w:1 },
                      { s:'Тремор / подёргивания', w:1 },{ s:'Спутанность сознания', w:2 },
                    ].map((x: any, i: any) =>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ flex:1, fontSize:9, color:'var(--text-light)' }}>{x.s}</span>
                        <span style={{ fontSize:7, color:'var(--text-dim)', width:20, textAlign:'center' }}>×{x.w}</span>
                        {[0,1,2,3].map((v: any) =>(
                          <span key={v} style={{ width:24, height:24, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, cursor:'pointer',
                            background: v===0?'rgba(34,197,94,0.15)':v===1?'rgba(245,158,11,0.15)':v===2?'rgba(249,115,22,0.15)':'rgba(239,68,68,0.15)',
                            color: v===0?'#22c55e':v===1?'#f59e0b':v===2?'#f97316':'#ef4444',
                            border:'1px solid '+(v===0?'rgba(34,197,94,0.3)':v===1?'rgba(245,158,11,0.3)':v===2?'rgba(249,115,22,0.3)':'rgba(239,68,68,0.3)')
                          }}>{v}</span>
                        ))}
                      </div>
                    ))}
                    <div style={{ marginTop:8, padding:'8px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                        <b style={{color:'#fca5a5'}}>Интерпретация баллов:</b><br/>
                        🟢 0-4 — норма, продолжайте ФАЗУ 1<br/>
                        🟡 5-9 — умеренные симптомы, подключите ФАЗУ 3<br/>
                        🔴 10+ — выраженные симптомы, ФАЗА 4 + консультация невролога
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Monitoring */}
              {neuroTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг нейротоксичности</div>
                    {[
                      { marker:'BDNF', what:'Нейротрофический фактор мозга', when:'Каждые 6-12 нед', target:'> 20 нг/мл', action:'При <15 нг/мл — Lion\'s Mane + Noopept + Семакс' },
                      { marker:'Кортизол (утренний)', what:'Гиперкортизолемия → нейротоксичность', when:'Каждые 4 нед', target:'10-20 мкг/дл', action:'При >25 — Phosphatidylserine + Ashwagandha + DHEA' },
                      { marker:'Пролактин', what:'Гиперпролактинемия → депрессия', when:'Каждые 4 нед', target:'< 15 нг/мл', action:'При >20 — P5P (B6) 100-200 мг + каберголин' },
                      { marker:'DHEA-S', what:'Резерв нейростероидов', when:'Каждые 8 нед', target:'200-500 мкг/дл', action:'При <150 — DHEA 25-50 мг + Pregnenolone 30 мг' },
                      { marker:'Гомоцистеин', what:'Нейротоксическая аминокислота', when:'Каждые 8 нед', target:'< 10 мкмоль/л', action:'При >12 — метилфолат + B12 + TMG' },
                      { marker:'Витамин B12', what:'Миелинизация нейронов', when:'Каждые 12 нед', target:'> 400 пг/мл', action:'При <300 — метилкобаламин 1000-5000 мкг/день' },
                      { marker:'Ферритин', what:'Накопление железа → оксидативный стресс', when:'Каждые 8 нед', target:'50-150 нг/мл', action:'При >300 — донация крови + IP6' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#60a5fa' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#3b82f6' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}>{m.what} — <b style={{color:'#60a5fa'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#93c5fd', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(59,130,246,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🔬 Инструментальные методы</div>
                    {[
                      { name:'Нейропсихологическое тестирование', freq:'Каждые 3-6 мес', note:'Батарея тестов: память, внимание, скорость реакции, исполнительные функции' },
                      { name:'ЭЭГ (электроэнцефалография)', freq:'При симптомах', note:'Выявление эпилептиформной активности, нарушений ритмов (альфа/бета/дельта)' },
                      { name:'МРТ головного мозга', freq:'При стойких симптомах >8 нед', note:'Оценка объёма гиппокампа, признаков атрофии, микрокровоизлияний' },
                      { name:'Полисомнография', freq:'При нарушениях сна', note:'Архитектура сна, REM-латентность, апноэ (часто при ААС)' },
                    ].map((x: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)', fontSize:8 }}>
                        <div style={{ fontWeight:600, color:'#c084fc' }}>{x.name} — {x.freq}</div>
                        <div style={{ color:'var(--text-dim)', marginTop:2 }}>{x.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InfoErrorBoundary>)}

          
          {/* ================ CARDIO ================ */}
          {protocolTab === 'cardio' && (<InfoErrorBoundary label="Кардио">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:2 }}>❤️ Кардиопротекция на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Протокол защиты сердечно-сосудистой системы: АД, липидный профиль, ремоделирование миокарда, тромбоз. Фазовый подход.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг приёма' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setCardioTab(t.id)}
                    style={cardioTab === t.id ? pillActive('#ef4444') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {cardioTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🫀 Кардиотоксичность ААС — ключевые пути (6 механизмов)</div>
                  {[
                    { title:'Дислипидемия', desc:'ААС (особенно оральные 17α-алкилированные) снижают ЛПВП на 40-70% через активацию печёночной липазы (HL) и подавление apoA-I. ЛПНП может расти. Атерогенный индекс резко ухудшается.' },
                    { title:'Артериальная гипертензия', desc:'Задержка Na⁺/H₂O (минералокортикоидный эффект), активация РААС, повышение эндотелина-1, эритроцитоз → ↑ вязкости → ↑ ОПСС.' },
                    { title:'Ремоделирование миокарда', desc:'Гипертрофия ЛЖ — прямая AR-стимуляция кардиомиоцитов + гемодинамическая перегрузка. Фиброз через TGF-β. Диастолическая дисфункция.' },
                    { title:'Протромботическое состояние', desc:'↑ гематокрита, ↑ фибриногена, ↑ фактора VII, ↓ антитромбина III, ↑ агрегации тромбоцитов через тромбоксан A2.' },
                    { title:'Эндотелиальная дисфункция', desc:'↓ eNOS → ↓ NO, ↓ FMD (поток-зависимой вазодилатации). Окислительный стресс эндотелия. Ускоренное старение сосудов.' },
                    { title:'Аритмогенный потенциал', desc:'Удлинение QT, гипертрофия → re-entry. Электролитные сдвиги (↓ K⁺, ↓ Mg). Изменение экспрессии ионных каналов (Kv4.3, Cav1.2).' },
                  ].map((m: any, i: any) =>(
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#fca5a5', marginBottom:2 }}>{m.title}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {cardioTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {
                      phase:'ФАЗА 1 · ЯДРО', label:'Обязательный минимум (любой курс)', color:'#22c55e',
                      condition:'Условие: любой курс ААС',
                      desc:'Фундамент кардиопротекции. Защита эндотелия и нормализация липидного профиля. Начинайте за 2 недели ДО курса.',
                      items:[
                        { name:'Omega-3 (EPA+DHA)', dose:'3-5 г', timing:'С едой 2×/день', note:'EPA >2 г: ↓ ТГ на 25-30%, ↓ агрегации тромбоцитов, ↑ ЛПВП на 5-10%. Доказано в JELIS, REDUCE-IT' },
                        { name:'CoQ10 (убихинол)', dose:'200-400 мг', timing:'С жирной едой', note:'Митохондриальная защита кардиомиоцитов. Антиоксидант ЛПНП. Особенно важно при статинах' },
                        { name:'Магний (глицинат/L-треонат)', dose:'400-600 мг', timing:'Вечер', note:'Вазодилатация (антагонист Ca²⁺), ↓ АД на 2-5 мм рт.ст., антиаритмический. L-треонат — ЦНС-пенетрация. Глицинат — без слабительного эффекта. 80% населения в дефиците' },
                        { name:'Таурин', dose:'2-3 г', timing:'Утро + Вечер', note:'Осморегуляция миокарда, ↓ АД через ↓ ангиотензина II, ↑ NO. Антиаритмический эффект' },
                        { name:'Витамин D3 + K2', dose:'5000 МЕ + 100 мкг', timing:'С жирной едой', note:'K2 → MGP-активация → предотвращение кальцификации сосудов. D3 → ↓ РААС, ↓ АД' },
                      ]
                    },
                    {
                      phase:'ФАЗА 2 · БАЗА', label:'При АД >130/85 или курсе >500 мг/нед', color:'#f59e0b',
                      condition:'Условие: АД 130-140/85-90 ИЛИ кумулятивная доза >500 мг/нед',
                      desc:'Медикаментозная коррекция АД и липидов. Подключается при повышении давления или высоких дозировках.',
                      items:[
                        { name:'Телмисартан 💊', dose:'40 мг → 80 мг', timing:'Утро', note:'Старт 40 мг. Титровать до 80 мг через 2 нед при АД >130/80. ARB. По назначению врача. Альтернатива: периндоприл' },
                        { name:'Небиволол 💊', dose:'2.5-5 мг', timing:'Утро', note:'β1-блокатор + NO-модулятор. ↓ ЧСС + вазодилатация. По назначению врача' },
                        { name:'Красный дрожжевой рис (монаколин К)', dose:'1200-2400 мг', timing:'Вечер', note:'Природный статин (монаколин К = ловастатин). ↓ ЛПНП на 20-30%. Контроль АЛТ/АСТ и КФК' },
                        { name:'Бергамот (цитрусовый экстракт)', dose:'500-1000 мг', timing:'Утро + Вечер', note:'↓ ЛПНП через HMG-CoA-редуктазу + ↑ ЛПВП. Полифенолы — двойной механизм. Синергия со статинами' },
                        { name:'Чеснок экстракт (аллицин ст.)', dose:'600-1200 мг', timing:'С едой', note:'↓ АД на 5-10 мм рт.ст., ↓ агрегации тромбоцитов, ↑ NO. Мета-анализ Ried 2013 — доказанный эффект' },
                      ]
                    },
                    {
                      phase:'ФАЗА 3 · УСИЛЕНИЕ', label:'При АД >140/90 или ЛПВП <30 мг/дл', color:'#f97316',
                      condition:'Условие: АД >140/90 ИЛИ ЛПВП <30 мг/дл на фоне курса',
                      desc:'Активная кардиопротекция. Подключение рецептурных препаратов. Регулярный самоконтроль АД обязателен.',
                      items:[
                        { name:'Амлодипин 💊', dose:'5-10 мг', timing:'Утро (добавить к сартану)', note:'⚠ Контроль АД на 3-5 день после добавления — риск ортостатической гипотензии. БКК + телмисартан. По назначению врача' },
                        { name:'Эзетимиб 💊', dose:'10 мг', timing:'Вечер', note:'Ингибитор NPC1L1 → ↓ всасывания холестерина. Эффективен в комбинации с розувастатином 5-10 мг (синергия +20%). Монотерапия — лишь −15-18% ЛПНП. По назначению врача' },
                        { name:'NAC', dose:'1200-2400 мг', timing:'Утро + Вечер', note:'Антиоксидант эндотелия. ↑ NO биодоступность. ↓ окисленных ЛПНП. ↓ гомоцистеина' },
                        { name:'L-Карнитин', dose:'2-3 г', timing:'Утро натощак', note:'Энергия миокарда (β-окисление ЖК). Перорально — общеукрепляющее, поддержка метаболизма. В/в форма изучалась при ИМ (CEDIM), перорально — доказательная база ниже' },
                        { name:'Ресвератрол', dose:'250-500 мг', timing:'Утро', note:'SIRT1-активатор. ↓ окисленных ЛПНП. ↑ NO. При приёме >3 мес — контроль креатинина (риск нефротоксичности при >500 мг/сут)' },
                      ]
                    },
                    {
                      phase:'ФАЗА 4 · МАКСИМУМ', label:'При АД >160/100 или ЛПВП <20', color:'#ef4444',
                      condition:'Условие: АД >160/100 ИЛИ ЛПВП <20 ИЛИ гематокрит >54%',
                      desc:'КРИТИЧЕСКАЯ кардиопротекция. Выход за эти пороги — прямое показание к прекращению курса ААС.',
                      items:[
                        { name:'Аспирин кардио', dose:'100 мг', timing:'После еды', note:'↓ тромбоксана A2 → ↓ агрегации тромбоцитов. Только при наличии ≥2 факторов тромбориска: Hct >50%, курение, ожирение, возраст >40, тромбоанамнез. Обязательно + ИПП для защиты ЖКТ' },
                        { name:'Кудесан (CoQ10 + вит.E)', dose:'1 мерная ложка', timing:'Утро с едой', note:'Водорастворимая форма CoQ10 + вит.E = двойная антиоксидантная защита сосудистой стенки' },
                        { name:'Пентоксифиллин 💊', dose:'400 мг 2-3×/день', timing:'С едой', note:'↓ вязкости крови, ↑ эластичности эритроцитов, ↓ фибриногена. По назначению врача' },
                        { name:'Донация крови', dose:'450 мл', timing:'1×/2-3 мес', note:'Снижение Hct на 3-5%. При Hct >54% — обязательно. Риск тромбоза растёт экспоненциально с Hct >52%' },
                        { name:'Икозапент (рецепт. омега-3) 💊', dose:'4 г/день', timing:'С едой', note:'Высокоочищенный EPA-этил. ↓ ТГ на 30-40%. REDUCE-IT: ↓ MACE на 25%. По назначению врача' },
                      ]
                    },
                  ].map((phase: any, pi: any) =>(
                    <div key={pi} style={{ ...cardBg, background:phase.color+'08', border:'1px solid '+phase.color+'22' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:4, background:phase.color+'22', color:phase.color }}>{phase.phase}</span>
                        <span style={{ fontSize:10, fontWeight:600, color:phase.color, flex:1 }}>{phase.label}</span>
                      </div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                        <b style={{color:phase.color}}>{phase.condition}</b> — {phase.desc}
                      </div>
                      {phase.items.map((item: any, ii: any) =>(
                        <ItemRow key={ii} name={item.name} dose={item.dose} timing={item.timing} note={item.note} color={phase.color} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Timing */}
              {cardioTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>⏰ Суточный тайминг кардиопротекции</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Ключевое правило: гипотензивные утром, липид-снижающие на ночь, антиоксиданты утром.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Телмисартан 40-80 мг', why:'Утренний пик АД (циркадный ритм кортизола). Натощак — быстрая абсорбция' },
                      { n:'Небиволол 2.5-5 мг', why:'Синхронизация с циркадным подъёмом АД и ЧСС. Не на ночь — брадикардия во сне' },
                      { n:'CoQ10 200 мг', why:'С жирным завтраком. Убихинол — активная форма. Биодоступность +3x с жирами' },
                      { n:'L-Карнитин 2 г', why:'Натощак за 30 мин до еды. Пик концентрации через 3-4 ч. Энергия миокарда на день' },
                    ]},
                    { time:'☀️ День (12:00–14:00)', color:'#f97316', items:[
                      { n:'Чеснок экстракт 600 мг', why:'С обедом (снижение раздражения ЖКТ). Пик аллицина через 2-4 ч. Не натощак!' },
                      { n:'Ресвератрол 250 мг', why:'С жирной пищей (жирорастворимый). SIRT1-активация в дневной метаболизм' },
                      { n:'Таурин 1 г', why:'До/после тренировки. Осморегуляция → снижение постнагрузочного подъёма АД' },
                    ]},
                    { time:'🌙 Вечер/Ночь (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Красный дрожжевой рис 1200 мг', why:'Синтез холестерина — ночью (пик ГМГ-КоА-редуктазы в 24:00-02:00)' },
                      { n:'Бергамот 500 мг', why:'Вечерний приём синхронизирован с суточным ритмом липидного обмена' },
                      { n:'Эзетимиб 10 мг', why:'Вечером — совпадает с максимумом всасывания холестерина из пищи (ужин)' },
                      { n:'Аспирин 100 мг', why:'После ужина. Снижение ночного тромбообразования. Не натощак!' },
                      { n:'Магний 400-600 мг', why:'Вазодилатация, снижение ночного АД. NMDA-блокада → глубокий сон. L-треонат/глицинат — предпочтительные формы' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Monitoring */}
              {cardioTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🧪 Лабораторный мониторинг ССС</div>
                    {[
                      { marker:'Липидограмма', target:'ЛПВП >40, ЛПНП <100, ТГ <150', when:'Каждые 4-6 нед', action:'При ЛПВП <30 — фаза 3. При ЛПВП <20 — немедленная остановка курса' },
                      { marker:'АД (самоконтроль)', target:'<130/85 мм рт.ст.', when:'Ежедневно утром и вечером', action:'При >140/90 на телмисартане 80 мг — фаза 3. При >160/100 — остановка курса' },
                      { marker:'Гематокрит (Hct)', target:'42-50%', when:'Каждые 4 нед', action:'При >52% — донация. При >54% — экстренное кровопускание (риск тромбоза)' },
                      { marker:'hs-CRP', target:'<1 мг/л', when:'Каждые 8 нед', action:'При >3 — повышение кардиориска в 2x. Усиление противовоспалительной терапии' },
                      { marker:'Гомоцистеин', target:'<10 мкмоль/л', when:'Каждые 8 нед', action:'При >12 — метилфолат 400-800 мкг + B12 + TMG 2-3 г' },
                      { marker:'Фибриноген', target:'2-4 г/л', when:'Каждые 12 нед', action:'При >4.5 — повышение риска тромбоза. Рассмотреть аспирин + омега-3 высокодозно' },
                      { marker:'ЭКГ (12 отведений)', target:'QTc <450 мс (м) / <460 мс (ж)', when:'До курса + каждые 12 нед', action:'При QTc >450 — ЭХО-КГ + консультация кардиолога' },
                      { marker:'ЭХО-КГ', target:'ФВ >55%, ГЛЖ <12 мм', when:'До курса + каждые 6-12 мес', action:'При ГЛЖ >12 мм или ФВ <50% — прекращение курса, кардиолог' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#fca5a5' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#ef4444' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#fca5a5'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#fda4af', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(239,68,68,0.06)' }}>⚠ {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InfoErrorBoundary>)}

          {/* ================ HEPATIC ================ */}
          {protocolTab === 'hepatic' && (<InfoErrorBoundary label="Печень">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#84cc16', marginBottom:2 }}>🫁 Гепатопротекция на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Защита печени от токсического повреждения, холестаза и стеатоза. Особенно важно для оральных (17α-алкилированных) ААС.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг приёма' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setHepaticTab(t.id)}
                    style={hepaticTab === t.id ? pillActive('#84cc16') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {hepaticTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#84cc16', marginBottom:6 }}>🫁 Гепатотоксичность ААС — ключевые пути (6 механизмов)</div>
                  {[
                    { title:'Прямая гепатоцеллюлярная токсичность', desc:'17α-алкилированные ААС нарушают BSEP-транспортёр → внутриклеточное накопление желчных кислот → митохондриальный стресс → некроз/апоптоз гепатоцитов. Повышение АЛТ/АСТ — прямой маркер.' },
                    { title:'Холестаз', desc:'Подавление BSEP, MDR3, MRP2 → нарушение оттока желчи. ЩФ, ГГТ повышаются. TUDCA — единственный доказанный антихолестатик для ААС-индуцированного холестаза.' },
                    { title:'Окислительный стресс гепатоцитов', desc:'Истощение глутатиона (GSH). CYP3A4-опосредованное образование реактивных метаболитов. Особенно выражено для метандиенона и станозолола.' },
                    { title:'Стеатоз печени', desc:'Повышение липогенеза de novo через SREBP-1c. Подавление β-окисления ЖК. Инсулинорезистентность → жировая инфильтрация гепатоцитов.' },
                    { title:'Фиброгенез', desc:'Активация звёздчатых клеток (HSC) → коллаген I/III. TGF-β — ключевой профибротический фактор. Длительные курсы → риск фиброза даже при нормальных трансаминазах.' },
                    { title:'Гепатоцеллюлярная аденома / ГЦК', desc:'ААС — подтверждённый фактор риска аденомы с риском малигнизации. Риск ГЦК повышен при длительном применении 17α-алкилов. УЗИ-контроль обязателен.' },
                  ].map((m: any, i: any) =>(
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(132,204,22,0.04)', border:'1px solid rgba(132,204,22,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#a3e635', marginBottom:2 }}>{m.title}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {hepaticTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {
                      phase:'ФАЗА 1 · ЯДРО', label:'Обязательный минимум (любой курс)', color:'#22c55e',
                      condition:'Условие: любой курс ААС (особенно с оральными препаратами)',
                      desc:'Фундамент защиты печени. Субстраты глутатиона и стабилизация мембран гепатоцитов. Начинайте за 1-2 недели ДО первого орального препарата.',
                      items:[
                        { name:'NAC', dose:'1200-2400 мг', timing:'Утро + Вечер натощак', note:'Предшественник глутатиона. При совместном приёме с парацетамолом — интервал между NAC и парацетамолом не более 2-4 ч для оптимальной протекции' },
                        { name:'Силимарин (расторопша)', dose:'280-560 мг', timing:'С едой', note:'Силибинин. Стабилизация мембран гепатоцитов, снижение перекисного окисления, стимуляция РНК-полимеразы I' },
                        { name:'TUDCA', dose:'500-1000 мг', timing:'Вечер натощак', note:'Гидрофильная желчная кислота. Снижение ER-стресса, стимуляция BSEP → желчеотток. Антиапоптотическое' },
                        { name:'Альфа-липоевая кислота', dose:'300-600 мг', timing:'Утро натощак', note:'Активатор Nrf2/ARE → повышение ферментов фазы II. Регенерирует GSH, вит.C/E. Хелатор металлов' },
                      ]
                    },
                    {
                      phase:'ФАЗА 2 · БАЗА', label:'При оральных ААС любой дозировки', color:'#f59e0b',
                      condition:'Условие: в курсе есть 17α-алкилированные ААС (метандиенон, станозолол, оксандролон, оксиметолон и др.)',
                      desc:'Оральные ААС проходят первый печёночный пассаж → концентрация в печени в 5-10x выше, чем в крови. Требуется усиленная защита.',
                      items:[
                        { name:'Глицирризиновая кислота (Глицирам/Глидекс) 💊', dose:'50-100 мг', timing:'С едой', note:'Противовоспалительная, антифибротическая. Снижение АЛТ/АСТ. По назначению врача' },
                        { name:'Фосфатидилхолин (эссенциале)', dose:'1800-3600 мг', timing:'С едой', note:'Структурный фосфолипид мембран. Восстанавливает текучесть мембран, повреждённых ААС. В/в форма эффективнее' },
                        { name:'Бетаин (TMG)', dose:'2-3 г', timing:'С едой', note:'Донор метильных групп. Снижает стеатоз через повышение VLDL-экспорта ТГ из печени. Осмолит' },
                        { name:'Цинк (пиколинат/глицинат)', dose:'30-50 мг', timing:'На ночь', note:'Кофактор SOD. Снижение перекисного окисления. Дефицит Zn = замедленная регенерация печени' },
                        { name:'Берберин', dose:'500 мг 2-3×/день', timing:'С едой', note:'AMPK-активатор → снижение липогенеза и стеатоза. ⚠ С осторожностью при камнях в желчном пузыре или билиарном сладже — возможна желчная колика' },
                      ]
                    },
                    {
                      phase:'ФАЗА 3 · УСИЛЕНИЕ', label:'При АЛТ >2x ВГН или курсе >8 нед', color:'#f97316',
                      condition:'Условие: АЛТ/АСТ >2x верхней границы нормы ИЛИ длительность курса >8 нед',
                      desc:'Активная гепатопротекция. Трансаминазы >2x ВГН — признак повреждения гепатоцитов.',
                      items:[
                        { name:'SAMe (S-аденозилметионин)', dose:'400-800 мг', timing:'Утро натощак', note:'Универсальный донор метильных групп. Синтез глутатиона и фосфатидилхолина. Доказанная эффективность' },
                        { name:'Куркумин + пиперин', dose:'500-1000 мг', timing:'С едой', note:'Снижение NF-κB и TNF-α в печени. Антифибротический (TGF-β). Повышение GSH. Пиперин +2000% биодоступности' },
                        { name:'Артишок экстракт', dose:'500-1000 мг', timing:'С едой', note:'Цинарин → желчегонное (холеретик). Повышение желчеоттока на 30-60%. Снижение холестерина' },
                        { name:'Глицин', dose:'3-5 г', timing:'На ночь', note:'Субстрат для синтеза GSH (вместе с NAC и глутаматом). Конъюгация желчных кислот' },
                        { name:'Астрагал', dose:'500-1000 мг', timing:'С едой', note:'Адаптоген. Снижение АЛТ/АСТ и TGF-β. Повышение SOD и GSH-Px. Иммуномодулятор' },
                      ]
                    },
                    {
                      phase:'ФАЗА 4 · МАКСИМУМ', label:'При АЛТ >5x ВГН или желтухе', color:'#ef4444',
                      condition:'Условие: АЛТ >5x ВГН ИЛИ билирубин >2x ВГН ИЛИ боль в правом подреберье',
                      desc:'КРИТИЧЕСКАЯ гепатопротекция. При АЛТ >5x ВГН — немедленное прекращение всех оральных ААС. Консультация гепатолога ОБЯЗАТЕЛЬНА.',
                      items:[
                        { name:'Урсодезоксихолевая кислота (УДХК) 💊', dose:'10-15 мг/кг/день', timing:'На ночь', note:'Рецептурный аналог TUDCA. Мощный антихолестатик. Дозу рассчитывать по массе тела (10-15 мг/кг). По назначению врача' },
                        { name:'Эссенциале в/в (фосфатидилхолин) 💊', dose:'5-10 мл/день в/в', timing:'Курс 10-14 дней', note:'Внутривенная форма — макс. биодоступность. Прямое встраивание в мембраны. Под наблюдением врача' },
                        { name:'Гептрал (адеметионин) в/в 💊', dose:'400-800 мг/день в/в', timing:'Курс 14-21 день', note:'В/в форма SAMe. Наиболее мощная гепатопротекция. При холестазе и цитолизе. По назначению' },
                        { name:'Метионин (с осторожностью!)', dose:'500-1000 мг', timing:'Утро натощак', note:'⚠ ТОЛЬКО при АЛТ <3×ВГН. При холестазе и цитолизе >3×ВГН — противопоказан (усиление повреждения). Предпочесть SAMe' },
                        { name:'Полный отказ от алкоголя', dose:'100% исключение', timing:'Весь курс + 4 нед после', note:'Алкоголь + 17α-алкил ААС = экспоненциальное усиление гепатотоксичности. Конкуренция за CYP2E1' },
                      ]
                    },
                  ].map((phase: any, pi: any) =>(
                    <div key={pi} style={{ ...cardBg, background:phase.color+'08', border:'1px solid '+phase.color+'22' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:4, background:phase.color+'22', color:phase.color }}>{phase.phase}</span>
                        <span style={{ fontSize:10, fontWeight:600, color:phase.color, flex:1 }}>{phase.label}</span>
                      </div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                        <b style={{color:phase.color}}>{phase.condition}</b> — {phase.desc}
                      </div>
                      {phase.items.map((item: any, ii: any) =>(
                        <ItemRow key={ii} name={item.name} dose={item.dose} timing={item.timing} note={item.note} color={phase.color} />
                      ))}
                    </div>
                  ))}
                  <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>⚠️ Классификация оральных ААС по гепатотоксичности</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                      🔴 <b style={{color:'#ef4444'}}>Максимальная (10/10):</b> Оксиметолон (Анадрол), Метилтриенолон<br/>
                      🟠 <b style={{color:'#f97316'}}>Высокая (7-9/10):</b> Метандиенон (Дианабол), Станозолол<br/>
                      🟡 <b style={{color:'#f59e0b'}}>Умеренная (4-6/10):</b> Оксандролон, Флуоксиместерон, Метилтестостерон<br/>
                      🟢 <b style={{color:'#22c55e'}}>Низкая (1-3/10):</b> Инъекционные ААС (без 17α-алкила)<br/>
                      ⚠ Комбинация 2+ оральных препаратов мультиплицирует гепатотоксичность (x3-5)
                    </div>
                  </div>
                </div>
              )}

              {/* Timing */}
              {hepaticTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#84cc16', marginBottom:6 }}>⏰ Суточный тайминг гепатопротекции</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Гепатопротекторы распределяются на весь день. NAC и АЛК натощак, фосфолипиды с едой, TUDCA на ночь.</p>
                  {[
                    { time:'🌅 Утро натощак (06:00–08:00)', color:'#22c55e', items:[
                      { n:'NAC 600-1200 мг', why:'Быстрая абсорбция натощак. Пик через 1-2 ч. Обеспечивает дневной пул глутатиона' },
                      { n:'АЛК 300-600 мг', why:'Натощак за 30 мин до еды — макс. биодоступность. Не с минералами (хелатирует)' },
                      { n:'SAMe 400 мг', why:'Натощак — макс. абсорбция. При проблемах с ЖКТ — с едой' },
                    ]},
                    { time:'☀️ День (12:00–14:00)', color:'#f59e0b', items:[
                      { n:'Силимарин 280 мг с обедом', why:'Жирорастворимый — с жирной пищей биодоступность +50%. Стабилизация мембран на день' },
                      { n:'Глицирризиновая кислота (Глицирам) 50-100 мг с едой', why:'С едой. Противовоспалительная, антифибротическая защита печени' },
                      { n:'Берберин 500 мг с едой', why:'AMPK-активация синхронизирована с приёмом пищи. Снижение постпрандиальной гипергликемии' },
                    ]},
                    { time:'🌙 Вечер/Ночь (19:00–22:00)', color:'#6366f1', items:[
                      { n:'TUDCA 500-1000 мг на ночь натощак', why:'Пик синтеза желчных кислот — ночью. TUDCA → BSEP-стимуляция → желчеотток. Натощак!' },
                      { n:'NAC 600-1200 мг', why:'Ночной пул глутатиона. Медленное высвобождение. Минимум за 1 ч до сна' },
                      { n:'Фосфатидилхолин 1800 мг', why:'Встраивание в мембраны во время ночной регенерации (пик синтеза белка 22:00-02:00)' },
                      { n:'Глицин 3-5 г', why:'Ночной синтез GSH + улучшение сна. Снижение температуры тела → засыпание' },
                      { n:'Цинк 30-50 мг натощак', why:'Ночная регенерация. Не с кальцием/железом. Отдельно от других минералов' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Monitoring */}
              {hepaticTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#84cc16', marginBottom:6 }}>🧪 Лабораторный мониторинг печени</div>
                    {[
                      { marker:'АЛТ (аланинаминотрансфераза)', target:'<40 Ед/л', when:'Каждые 2-4 нед (оральные ААС)', action:'>2xВГН — фаза 3. >5xВГН — немедленная отмена оральных, фаза 4, гепатолог' },
                      { marker:'АСТ (аспартатаминотрансфераза)', target:'<40 Ед/л', when:'Каждые 2-4 нед', action:'АСТ/АЛТ >2 (De Ritis) — алкогольное или митохондриальное повреждение. Тревожный признак' },
                      { marker:'ГГТ (гамма-глутамилтрансфераза)', target:'<55 Ед/л', when:'Каждые 4 нед', action:'Маркер холестаза. Повышается раньше ЩФ при холестатическом повреждении' },
                      { marker:'Щелочная фосфатаза (ЩФ)', target:'<150 Ед/л', when:'Каждые 4 нед', action:'Маркер внутрипечёночного холестаза. ЩФ + ГГТ = холестатическая картина → TUDCA/УДХК' },
                      { marker:'Билирубин общий/прямой', target:'<21 / <5 мкмоль/л', when:'Каждые 4 нед', action:'Повышение прямого = холестаз. Непрямой + норма АЛТ = синдром Жильбера (доброкачественный)' },
                      { marker:'Альбумин / ПТИ', target:'35-50 г/л / 80-100%', when:'Каждые 8-12 нед', action:'Снижение = нарушение синтетической функции печени. Поздний признак, тревожный сигнал' },
                      { marker:'Ферритин', target:'50-150 нг/мл', when:'Каждые 8 нед', action:'>300 — риск перегрузки железом → оксидативный стресс. Контроль на курсе' },
                      { marker:'УЗИ печени + допплер', target:'Нормальная эхоструктура', when:'До курса + каждые 6 мес', action:'Стеатоз, аденомы, очаговые образования. Обязательно при длительных курсах' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(132,204,22,0.04)', border:'1px solid rgba(132,204,22,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#a3e635' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#84cc16' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#a3e635'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#bef264', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(132,204,22,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InfoErrorBoundary>)}

          {/* ================ RENAL ================ */}
          {protocolTab === 'renal' && (<InfoErrorBoundary label="Почки">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#3b82f6', marginBottom:2 }}>💧 Нефропротекция на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Защита почек: гемодинамика, гиперфильтрация, протеинурия, электролитный баланс. Фазовый подход.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг приёма' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setRenalTab(t.id)}
                    style={renalTab === t.id ? pillActive('#3b82f6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {renalTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>💧 Нефротоксичность ААС — ключевые пути (6 механизмов)</div>
                  {[
                    { title:'Гемодинамические нарушения', desc:'ААС → задержка Na⁺/H₂O → повышение ОЦК → повышение АД → гипертензивная нефропатия. Повышенное внутриклубочковое давление → гиперфильтрация → повреждение подоцитов.' },
                    { title:'Гиперфильтрация', desc:'Увеличение СКФ на 10-20% на фоне высокобелковой диеты и ААС. Хроническая гиперфильтрация → гломерулосклероз (фокально-сегментарный — ФСГС).' },
                    { title:'Протеинурия', desc:'Повреждение подоцитов → нарушение фильтрационного барьера → потеря белка с мочой. Микроальбуминурия — ранний маркер. При ААС может появляться через 8-12 нед.' },
                    { title:'Водно-электролитный дисбаланс', desc:'Задержка Na⁺ → отёки. Повышение K⁺ при подавлении альдостерона. Снижение Mg при гиперфильтрации. Нарушение Ca²⁺/PO₄³⁻ → риск нефролитиаза.' },
                    { title:'Рабдомиолиз-ассоциированное ОПП', desc:'Интенсивные тренировки + дегидратация → рабдомиолиз → миоглобин → острое повреждение почек. Миоглобин — прямой нефротоксин. Редкое, но жизнеугрожающее.' },
                    { title:'Тубулоинтерстициальное повреждение', desc:'Оксидативный стресс в канальцах. Апоптоз тубулярных клеток. Хроническое воспаление интерстиция. Нарушение концентрационной функции.' },
                  ].map((m: any, i: any) =>(
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#60a5fa', marginBottom:2 }}>{m.title}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{m.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {renalTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {
                      phase:'ФАЗА 1 · ЯДРО', label:'Обязательный минимум (любой курс)', color:'#22c55e',
                      condition:'Условие: любой курс ААС',
                      desc:'Фундамент защиты почек. Гидратация, электролитный баланс, антиоксидантная защита канальцев.',
                      items:[
                        { name:'Вода (гидратация)', dose:'35-40 мл/кг/день', timing:'Равномерно в течение дня', note:'Основа нефропротекции. Контроль по цвету мочи: светло-соломенный. При белке >2 г/кг → +500 мл' },
                        { name:'Магний (L-треонат/глицинат)', dose:'400-600 мг', timing:'Вечер', note:'Снижение оксалатных камней. Вазодилатация почечных артериол. L-треонат — лучшая пенетрация ЦНС. Глицинат — минимальный слабительный эффект' },
                        { name:'Omega-3 (EPA+DHA)', dose:'3-5 г', timing:'С едой', note:'Снижение почечного воспаления и протеинурии. EPA → резолвины → защита подоцитов. Доказано при IgA-нефропатии' },
                        { name:'Витамин D3', dose:'5000-10000 МЕ', timing:'С жирной едой', note:'VDR в подоцитах → защита фильтрационного барьера. Снижение протеинурии и РААС' },
                        { name:'Калий (из пищи)', dose:'3500-4700 мг/день', timing:'С едой', note:'Из картофеля, бананов, авокадо. ⚠ Только при контроле K⁺ сыворотки (3.5-5.0 ммоль/л). Запрещено при ХБП 3+ или приёме АПФ/сартанов + K⁺-сберегающих диуретиков' },
                      ]
                    },
                    {
                      phase:'ФАЗА 2 · БАЗА', label:'При АД >130/85 или высоком белке (>2.5 г/кг)', color:'#f59e0b',
                      condition:'Условие: АД >130/85 ИЛИ белок в диете >2.5 г/кг/день',
                      desc:'Контроль внутриклубочкового давления и гиперфильтрации. Антипротеинурическая терапия.',
                      items:[
                        { name:'Телмисартан (или периндоприл) 💊', dose:'40-80 мг', timing:'Утро', note:'ARB/иАПФ → снижение внутриклубочкового давления. Снижение протеинурии на 40-60%. Старт 40 мг, титрация до 80 мг через 2 нед. По назначению врача' },
                        { name:'Астрагал', dose:'1-3 г', timing:'С едой', note:'Снижение протеинурии и креатинина (мета-анализ Zhang 2014). Снижение TGF-β → антифибротический' },
                        { name:'NAC', dose:'1200-2400 мг', timing:'Утро + Вечер', note:'Антиоксидант почечных канальцев. Защита от контраст-индуцированной нефропатии (доказано)' },
                        { name:'CoQ10', dose:'200-400 мг', timing:'С жирной едой', note:'Митохондриальная защита тубулярных клеток. Повышение СКФ. Снижение перекисного окисления в почках' },
                      ]
                    },
                    {
                      phase:'ФАЗА 3 · УСИЛЕНИЕ', label:'При микроальбуминурии или СКФ <90', color:'#f97316',
                      condition:'Условие: микроальбуминурия >30 мг/сут ИЛИ СКФ <90 мл/мин (CKD-EPI)',
                      desc:'Активная ренопротекция при первых признаках повреждения. Замедление прогрессирования.',
                      items:[
                        { name:'Кордицепс', dose:'1-3 г', timing:'Утро', note:'Снижение креатинина и мочевины. Повышение СКФ на 10-15%. Антифибротический. Иммуномодуляция' },
                        { name:'Куркумин + пиперин', dose:'500-1000 мг', timing:'С едой', note:'Снижение NF-κB в мезангии. Антифибротический (TGF-β). Снижение протеинурии' },
                        { name:'Пикногенол (кора сосны)', dose:'100-200 мг', timing:'Утро', note:'Снижение протеинурии и АД. Антивоспалительное. Улучшение эндотелиальной функции почечных сосудов' },
                        { name:'Ресвератрол', dose:'250-500 мг', timing:'Утро', note:'SIRT1-активация → снижение апоптоза подоцитов. Антиоксидант. Снижение фиброза интерстиция' },
                      ]
                    },
                    {
                      phase:'ФАЗА 4 · МАКСИМУМ', label:'При протеинурии >0.5 г/сут или креатинине >1.3x ВГН', color:'#ef4444',
                      condition:'Условие: протеинурия >0.5 г/сут ИЛИ креатинин >1.3x ВГН',
                      desc:'КРИТИЧЕСКАЯ ренопротекция. Требуется консультация нефролога и решение о продолжении курса.',
                      items:[
                        { name:'Кетостерил (кетоаналоги АК) 💊', dose:'1 таб/5 кг/день', timing:'С едой', note:'Снижение азотистой нагрузки. Замедление прогрессирования ХБП. По назначению нефролога' },
                        { name:'Бикарбонат натрия', dose:'0.5-1 г 2-3×/день', timing:'С едой', note:'Коррекция метаболического ацидоза. Замедляет прогрессирование ХБП. Контроль pH' },
                        { name:'Гипонатриевая диета', dose:'<2 г Na⁺/день', timing:'—', note:'Ограничение соли. Снижение АД и протеинурии. Отказ от переработанных продуктов' },
                        { name:'Ограничение белка', dose:'<1 г/кг/день', timing:'При ХБП 3+ стадии', note:'Снижение гиперфильтрации. Кетоаналоги + низкобелковая диета = стандарт нефропротекции' },
                        { name:'Нефролог + биопсия', dose:'По назначению', timing:'При протеинурии >1 г/сут', note:'Исключение гломерулонефрита, ФСГС. Морфологический диагноз обязателен' },
                      ]
                    },
                  ].map((phase: any, pi: any) =>(
                    <div key={pi} style={{ ...cardBg, background:phase.color+'08', border:'1px solid '+phase.color+'22' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:4, background:phase.color+'22', color:phase.color }}>{phase.phase}</span>
                        <span style={{ fontSize:10, fontWeight:600, color:phase.color, flex:1 }}>{phase.label}</span>
                      </div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                        <b style={{color:phase.color}}>{phase.condition}</b> — {phase.desc}
                      </div>
                      {phase.items.map((item: any, ii: any) =>(
                        <ItemRow key={ii} name={item.name} dose={item.dose} timing={item.timing} note={item.note} color={phase.color} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Timing */}
              {renalTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг нефропротекции</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Равномерная гидратация в течение дня — ключевой принцип. Антигипертензивные утром.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Телмисартан 40-80 мг', why:'Утренний приём — подавление пика АД. Cardio-renal protection. Натощак' },
                      { n:'NAC 600-1200 мг', why:'Антиоксидант канальцев на весь день. Натощак → быстрая абсорбция' },
                      { n:'Кордицепс 1 г', why:'Утренний приём. Адаптоген + ренопротектор. Повышение энергии и СКФ' },
                      { n:'Вода 500 мл', why:'Утренний болюс → запуск диуреза. Компенсация ночной дегидратации' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'CoQ10 200 мг с обедом', why:'С жирной пищей. Митохондриальная защита тубулярных клеток' },
                      { n:'Астрагал 1-2 г с едой', why:'С едой. Снижение протеинурии. Вода 300-500 мл' },
                      { n:'Куркумин 500 мг с едой', why:'Противовоспалительное. С жирами и пиперином для биодоступности' },
                      { n:'Вода 500-750 мл', why:'Поддержание гидратации. При тренировке — дополнительно 500-1000 мл' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Магний 400-600 мг', why:'Ночная вазодилатация почечных артериол. Снижение ночного АД. L-треонат/глицинат' },
                      { n:'Ресвератрол 250 мг', why:'SIRT1-активация → защита подоцитов. Вечерний приём улучшает циркадный ритм' },
                      { n:'Пикногенол 100 мг', why:'Вечерний приём. Антиоксидант + снижение АД. Улучшение микроциркуляции' },
                      { n:'Вода 300-500 мл', why:'Умеренная гидратация. Не переусердствовать (никтурия нарушает сон)' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Monitoring */}
              {renalTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг почек</div>
                    {[
                      { marker:'Креатинин + СКФ (CKD-EPI)', target:'СКФ >90 мл/мин', when:'Каждые 4 нед', action:'СКФ <90 → фаза 3. СКФ <60 → ХБП 3 ст., нефролог. Использовать CKD-EPI, не только креатинин' },
                      { marker:'Микроальбуминурия (утр. порция)', target:'<30 мг/г креатинина', when:'Каждые 4-8 нед', action:'30-300 — фаза 3 (раннее). >300 — фаза 4 (явная протеинурия, нефролог)' },
                      { marker:'Общий белок мочи (суточный)', target:'<150 мг/сут', when:'При альбуминурии >100', action:'>500 мг/сут — нефротический уровень. Рассмотреть биопсию' },
                      { marker:'Мочевина', target:'2.5-8.3 ммоль/л', when:'Каждые 4 нед', action:'Повышение при высокобелковой диете (до 10-12 нормально). >15 — снижать белок' },
                      { marker:'K⁺, Na⁺ (электролиты)', target:'K⁺ 3.5-5.1, Na⁺ 135-145', when:'Каждые 4 нед', action:'K⁺ >5.5 — опасно (аритмия). Исключить добавки калия. Na⁺ — при гипергидратации' },
                      { marker:'Мочевая кислота', target:'<420 мкмоль/л', when:'Каждые 4-8 нед', action:'>480 — риск уратного нефролитиаза. Аллопуринол при повторных камнях' },
                      { marker:'УЗИ почек + допплер', target:'Норм. размеры, RI <0.70', when:'До курса + каждые 6-12 мес', action:'RI >0.70 — нарушение внутрипочечной гемодинамики. Консультация нефролога' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#60a5fa' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#3b82f6' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#60a5fa'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#93c5fd', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(59,130,246,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Телмисартан + НПВС = {'\u2193'} эффекта + риск ОПП. НПВС — с осторожностью при АД {'>'}140/90<br/>
                • 🫁 <b>Печень:</b> НПВС (диклофенак, ибупрофен) + 17α-алкилы = аддитивная гепатотоксичность. Парацетамол ≤2 г/день<br/>
                • 💧 <b>Почки:</b> НПВС → {'\u2193'} простагландинов → {'\u2193'} почечного кровотока. Риск ОПП при дегидратации + НПВС<br/>
                • 🫀 <b>ЖКТ:</b> НПВС + оральные ААС = гастропатия. Цинк-карнозин + DGL — гастропротекция<br/>
                • 🩸 <b>Гематология:</b> НПВС + антикоагулянты/аспирин = риск ЖКТ-кровотечения. Контроль свёртываемости
              </div>
            </div>

            </div>
          </InfoErrorBoundary>)}

          {/* ================ JOINTS ================ */}
          {protocolTab === 'joints' && (<InfoErrorBoundary label="Суставы">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#22c55e', marginBottom:2 }}>🦴 Калькулятор суставов и связок</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Оценка риска суставной патологии и фазовый протокол поддержки хрящевой и соединительной ткани.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'calculator', label:'📊 Калькулятор' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг приёма' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                  { id:'diary', label:'📓 Дневник боли' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setJointTab(t.id)}
                    style={jointTab === t.id ? pillActive('#22c55e') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Calculator */}
              {jointTab === 'calculator' && (
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>📊 Параметры риска</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                  {[
                    { label:'🦵 Боль в суставах', val:jointPain, max:10, set:setJointPain, labels:['Нет боли','Умеренная','Сильная'] },
                    { label:'🏥 Травмы в анамнезе', val:injuryHistory, max:5, set:setInjuryHistory, labels:['Нет','Растяжения','Разрывы'] },
                    { label:'🏋️ Тренировочная нагрузка', val:trainLoad, max:5, set:setTrainLoad, labels:['Лёгкая','Умеренная','Тяжёлые веса'] },
                  ].map((r: any, i: any) =>(
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:9, color:'var(--text-dim)' }}>{r.label}</span>
                        <span style={{ fontSize:9, fontWeight:700, color: jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }}>{r.val}/{r.max}</span>
                      </div>
                      <input type="range" min="0" max={r.max} value={r.val} onChange={e => r.set(Number(e.target.value))} style={{ width:'100%', accentColor:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444' }} />
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, color:'var(--text-dim)' }}>{r.labels.map((l:any,li:any)=><span key={li}>{l}</span>)}</div>
                    </div>
                  ))}
                </div>
                {/* Score */}
                <div style={{ background: (jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'18', borderRadius:14, padding:14, border:'2px solid '+(jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444')+'44', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:4 }}>Индекс риска суставов</div>
                  <div style={{ fontSize:36, fontWeight:800, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', lineHeight:1 }}>{jointScore}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:jointScore<20?'#22c55e':jointScore<40?'#f59e0b':jointScore<60?'#f97316':'#ef4444', marginTop:4 }}>
                    {jointScore<20?'🟢 Норма — профилактика':jointScore<40?'🟡 Умеренный — базовая поддержка':jointScore<60?'🟠 Высокий — усиленная защита':'🔴 Критический — максимальная защита'}
                  </div>
                  <div style={{ marginTop:6, height:5, borderRadius:3, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
                    <div style={{ width:jointScore+'%', height:'100%', borderRadius:3, background:'linear-gradient(90deg, #22c55e, #f59e0b 40%, #f97316 60%, #ef4444)', transition:'width 0.5s' }} />
                  </div>
                </div>
              </div>
              )}

              {/* Protocol phases */}
              {jointTab === 'protocol' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  {
                    phase:'ФАЗА 1 · ЯДРО', label:'Обязательный минимум (профилактика)', color:'#22c55e',
                    condition:'Условие: любой уровень физической нагрузки',
                    desc:'Структурная основа хряща и кости. Без этого уровня восстановление хрящевой ткани невозможно.',
                    items:[
                      { name:'Коллаген II типа (UC-II)', dose:'40 мг', timing:'Утро натощак', note:'Нативный неденатурированный коллаген. Оральная толерантность. Доказанное снижение боли на 33%' },
                      { name:'Витамин C', dose:'500-1000 мг', timing:'С едой', note:'Кофактор пролил- и лизил-гидроксилазы. Без вит.C синтез коллагена останавливается. Буферный приём 2×/день' },
                      { name:'Витамин D3 + K2', dose:'5000 МЕ + 100 мкг', timing:'С жирной едой', note:'Кальциевый обмен. D3 → абсорбция Ca²⁺. K2 → активация остеокальцина → Ca²⁺ в кости, не в сосуды' },
                      { name:'Желатин гидролизованный', dose:'10-15 г', timing:'Натощак / за 1 ч до тренировки', note:'Субстрат коллагена: глицин + пролин + гидроксипролин. + вит.C за 1 ч до нагрузки → синтез коллагена x2' },
                    ]
                  },
                  {
                    phase:'ФАЗА 2 · БАЗА', label:'При умеренном риске (JointScore 20-40)', color:'#f59e0b',
                    condition:'Условие: JointScore ≥20 ИЛИ возраст >30 лет',
                    desc:'Субстраты для синтеза хрящевого матрикса. Противовоспалительный компонент.',
                    items:[
                      { name:'Глюкозамин сульфат', dose:'1500 мг', timing:'С едой', note:'Субстрат гликозаминогликанов. Стимуляция протеогликанов хондроцитами. Только сульфатная форма работает' },
                      { name:'Хондроитин сульфат', dose:'800-1200 мг', timing:'С едой', note:'Ингибирование MMP-3/MMP-13. Удержание воды в матриксе хряща. Мол. масса 14-20 кДа' },
                      { name:'MSM', dose:'2000-3000 мг', timing:'Утро', note:'Органическая сера (34%). Дисульфидные мостики коллагена. Снижение боли на 25-40%' },
                      { name:'Omega-3 (EPA+DHA)', dose:'3-5 г', timing:'С едой', note:'Резолвины и протектины → разрешение воспаления в синовиальной жидкости. EPA >2 г' },
                      { name:'Марганец', dose:'5-10 мг', timing:'С едой (отдельно от Ca/Fe)', note:'Кофактор гликозилтрансфераз → синтез ГАГ. Необходим для сшивки коллагеновых волокон' },
                    ]
                  },
                  {
                    phase:'ФАЗА 3 · УСИЛЕНИЕ', label:'При высоком риске (JointScore 40-60)', color:'#f97316',
                    condition:'Условие: JointScore ≥40 ИЛИ боли ≥4/10',
                    desc:'Таргетная противовоспалительная терапия. Синовиальная защита.',
                    items:[
                      { name:'Гиалуроновая кислота', dose:'200-300 мг', timing:'Утро натощак', note:'Компонент синовиальной жидкости. Вязкоэластичность сустава. Пероральная форма — системный эффект' },
                      { name:'Куркумин + пиперин', dose:'500-1000 мг', timing:'С едой', note:'Ингибирование COX-2 = ибупрофену. NF-kB подавление. IL-1β снижение. Пиперин +2000%' },
                      { name:'Босвеллия (AKBA ≥30%)', dose:'300-500 мг', timing:'С едой', note:'Ингибирование 5-LOX → снижение лейкотриенов. Стандартизованный экстракт AKBA 10-20% — 100-200 мг (нестандарт — 500 мг). Боль на 40-50% при ОА' },
                      { name:'Кремний (монометанол-силанол)', dose:'10-20 мг', timing:'Утро', note:'Сшивка коллагена и эластина. Стабилизация ГАГ. Необходим для прочности соединительной ткани' },
                    ]
                  },
                  {
                    phase:'ФАЗА 4 · МАКСИМУМ', label:'При критическом риске (JointScore ≥60)', color:'#ef4444',
                    condition:'Условие: JointScore ≥60 ИЛИ боли ≥7/10',
                    desc:'Пептидная регенерация. Реальный ремонт повреждённых тканей (не только симптоматика).',
                    items:[
                      { name:'BPC-157', dose:'250-500 мкг', timing:'Утро + Вечер', note:'Пентадекапептид. Заживление сухожилий и связок. ⚠ Хранить при 2-8°C (холодовая цепь). После разведения — не более 7-14 дней. Не встряхивать — пузырьки денатурируют пептид' },
                      { name:'TB-500 (Thymosin β4)', dose:'2.5-5 мг', timing:'2×/нед', note:'Полимеризация G-актина. ⚠ Хранить при 2-8°C. После разведения — не более 7-14 дней. Регенерация тканей, антивоспалительное' },
                      { name:'Секретагоги ГР', dose:'100-300 мкг', timing:'На ночь натощак', note:'Грелин-миметики. Пульсирующая секреция ГР → IGF-1 → синтез коллагена хондроцитами' },
                      { name:'Кальций + Бор', dose:'500 мг + 3 мг', timing:'Вечер', note:'Ca — минерализация кости. Бор — удлиняет t½ витамина D и E2 (меньше боли)' },
                    ]
                  },
                ].map((phase: any, pi: any) =>(
                  <div key={pi} style={{ ...cardBg, background:phase.color+'08', border:'1px solid '+phase.color+'22' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:4, background:phase.color+'22', color:phase.color }}>{phase.phase}</span>
                      <span style={{ fontSize:10, fontWeight:600, color:phase.color, flex:1 }}>{phase.label}</span>
                    </div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                      <b style={{color:phase.color}}>{phase.condition}</b> — {phase.desc}
                    </div>
                    {phase.items.map((item: any, ii: any) =>(
                      <ItemRow key={ii} name={item.name} dose={item.dose} timing={item.timing} note={item.note} color={phase.color} />
                    ))}
                  </div>
                ))}
              </div>
              )}

              {/* Timing */}
              {jointTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>⏰ Суточный тайминг поддержки суставов</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Коллагеновые субстраты — натощак (нет конкуренции с белком). Противовоспалительные — с едой.</p>
                  {[
                    { time:'🌅 Утро натощак (06:00–08:00)', color:'#22c55e', items:[
                      { n:'UC-II 40 мг + Желатин 10-15 г + вит.C 500 мг', why:'За 30-60 мин ДО завтрака (или за 1 ч до тренировки). Коллагеновые субстраты не конкурируют с пищевым белком' },
                      { n:'Гиалуроновая кислота 200 мг', why:'Натощак — лучшая абсорбция. Высокомолекулярная ГК — системный эффект' },
                      { n:'MSM 2000-3000 мг', why:'Натощак — сера быстро всасывается. Делить дозу при ЖКТ-дискомфорте' },
                    ]},
                    { time:'☀️ День (12:00–15:00)', color:'#f59e0b', items:[
                      { n:'Глюкозамин 1500 мг + Хондроитин 800 мг с обедом', why:'С обедом, содержащим жиры. Абсорбция глюкозамина высокая (90%). Делить при ЖКТ-дискомфорте' },
                      { n:'Куркумин 500 мг + Босвеллия 300 мг', why:'С жирной пищей. Жирорастворимые. Пиперин для куркумина. Пик действия через 2-4 ч' },
                      { n:'Omega-3 3 г', why:'С обедом/ужином (жиры). EPA/DHA — макс. абсорбция с жирами. Резолвины в синовиальной жидкости' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Кальций 500 мг + Бор 3 мг + K2 100 мкг', why:'Ночная минерализация костной ткани. Остеобласты наиболее активны ночью' },
                      { n:'BPC-157 250 мкг', why:'На ночь натощак. Пик регенерации тканей — ночью. Пептидная стимуляция ангиогенеза' },
                      { n:'Марганец 5-10 мг', why:'Ночной синтез ГАГ. Отдельно от кальция (конкуренция за всасывание)' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Lab monitoring */}
              {jointTab === 'monitoring' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🧪 Лабораторный мониторинг суставов</div>
                  {[
                    { m:'Ревматоидный фактор (RF)', t:'< 14 МЕ/мл', w:'Каждые 12 нед' },
                    { m:'С-реактивный белок (hs-CRP)', t:'< 1 мг/л', w:'Каждые 4-8 нед' },
                    { m:'Мочевая кислота', t:'200-420 мкмоль/л', w:'Каждые 8 нед' },
                    { m:'25-OH Витамин D', t:'50-80 нг/мл', w:'Каждые 12 нед' },
                    { m:'Кальций общий + ионизированный', t:'2.15-2.55 ммоль/л', w:'Каждые 12 нед' },
                    { m:'Антитела к коллагену II типа', t:'< 20 ЕД/мл', w:'При подозрении на РА' },
                    { m:'СОЭ', t:'< 15 мм/ч', w:'Каждые 8 нед' },
                  ].map((a: any, i: any) =>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', borderRadius:4, marginBottom:3, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)', fontSize:8 }}>
                      <span style={{ color:'var(--text-light)' }}>{a.m}</span>
                      <span style={{ fontWeight:600, color:'#60a5fa' }}>{a.t} · {a.w}</span>
                    </div>
                  ))}
                </div>

                {/* Imaging */}
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🔬 Инструментальная диагностика</div>
                  {[
                    { name:'УЗИ суставов (B-режим + допплер)', purpose:'Выпот, синовит, эрозии, гиперваскуляризация', when:'Боль/отёк ≥2 нед' },
                    { name:'МРТ сустава (1.5/3 Тесла)', purpose:'Хрящ (T2-mapping), мениски, связки, субхондральная кость', when:'Боль >4 нед или подозрение на разрыв' },
                    { name:'Рентгенография', purpose:'Суставная щель (JSN), остеофиты, субхондральный склероз', when:'Подозрение на ОА, перелом' },
                    { name:'Артроскопия', purpose:'Прямая визуализация хряща, биопсия', when:'Неясный диагноз, неэффективность 6 мес терапии' },
                  ].map((e: any, i: any) =>(
                    <div key={i} style={{ padding:'6px 8px', borderRadius:4, marginBottom:4, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)', fontSize:8 }}>
                      <div style={{ fontWeight:600, color:'#c084fc' }}>{e.name}</div>
                      <div style={{ color:'var(--text-dim)' }}>{e.purpose}</div>
                      <div style={{ fontSize:7, color:'#a855f7', opacity:0.7 }}>Показание: {e.when}</div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Pain diary */}
              {jointTab === 'diary' && (
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>📓 Дневник боли (визуально-аналоговая шкала)</div>
                <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Заполняйте ежедневно. Отмечайте локализацию и интенсивность. При боли ≥6/10 — не тренируйте эту область.</p>
                {['Плечи','Локти','Запястья','Поясница','ТБС','Колени','Голеностоп'].map((zone: any, i: any) =>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)', width:90 }}>{zone}</span>
                    <div style={{ flex:1, display:'flex', gap:3 }}>
                      {[0,1,2,3,4,5,6,7,8,9,10].map((v: any) =>(
                        <span key={v} style={{ width:18, height:18, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, fontWeight:v===0?400:700, cursor:'pointer',
                          background: v<=2?'rgba(34,197,94,0.15)':v<=4?'rgba(245,158,11,0.15)':v<=7?'rgba(249,115,22,0.15)':'rgba(239,68,68,0.15)',
                          color: v<=2?'#22c55e':v<=4?'#f59e0b':v<=7?'#f97316':'#ef4444', border:'1px solid rgba(255,255,255,0.06)'
                        }}>{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </InfoErrorBoundary>)}

          {/* ================ ACNE ================ */}
          {protocolTab === 'acne' && (<InfoErrorBoundary label="Акне">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:2 }}>🔴 Анти-акне протокол (ААС-индуцированное акне)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Системная, локальная и гигиеническая терапия. Фазовый подход по тяжести акне.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг ухода' },
                  { id:'lab', label:'🧪 Анализы' },
                  { id:'diary', label:'📓 Дневник' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setAcneTab(t.id)}
                    style={acneTab === t.id ? pillActive('#f97316') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Phases */}
              {acneTab === 'protocol' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  {
                    phase:'ФАЗА 1 · БАЗОВАЯ ГИГИЕНА', label:'Профилактика (обязательно на курсе)', color:'#22c55e',
                    condition:'Условие: любой курс ААС',
                    desc:'Основа борьбы с акне — ежедневная гигиена. Без этого никакая терапия не будет эффективной.',
                    items:[
                      { name:'Умывание 2×/день', dose:'Утро + Вечер', timing:'Утро и вечер', note:'Средство с салициловой кислотой 0.5-2% или бензоил пероксидом 2.5-5%. Не использовать обычное мыло!' },
                      { name:'Смена наволочки', dose:'Каждые 2-3 дня', timing:'—', note:'Наволочка накапливает себум и бактерии. Частая смена снижает контаминацию кожи на 40%' },
                      { name:'Не трогать лицо руками', dose:'Всегда', timing:'—', note:'Руки — источник бактерий. Каждое прикосновение переносит C. acnes и стафилококки на лицо' },
                      { name:'Увлажнение', dose:'Утро и вечер', timing:'Утро и вечер', note:'Нежирный крем (non-comedogenic). Пересушенная кожа вырабатывает ЕЩЁ БОЛЬШЕ себума' },
                    ]
                  },
                  {
                    phase:'ФАЗА 2 · НУТРИЦЕВТИКИ', label:'При первых признаках акне (лёгкая форма)', color:'#f59e0b',
                    condition:'Условие: единичные папулы/пустулы (<10 элементов)',
                    desc:'Системные нутрицевтики, регулирующие себум и воспаление изнутри.',
                    items:[
                      { name:'Цинк (пиколинат)', dose:'50 мг', timing:'На ночь', note:'Ингибирует 5α-редуктазу → снижение DHT в коже. Антивоспалительное. Антибактериальное (биоплёнки C. acnes)' },
                      { name:'Ниацинамид (B3)', dose:'500-1000 мг', timing:'Утро', note:'Регулирует себум. Антивоспалительное через снижение IL-8. Уменьшает покраснения' },
                      { name:'Медь', dose:'1-2 мг', timing:'Утро (отдельно от Zn!)', note:'Кофактор лизил-оксидазы → сшивка коллагена → заживление. НЕ одновременно с цинком (антагонизм)' },
                      { name:'Витамин А (ретинол)', dose:'5000-10000 МЕ', timing:'С жирной едой', note:'Регулирует кератинизацию. Снижает гиперкератоз фолликулов. При беременности — НЕЛЬЗЯ' },
                    ]
                  },
                  {
                    phase:'ФАЗА 3 · ЛОКАЛЬНАЯ ТЕРАПИЯ', label:'При умеренном акне (10-30 элементов)', color:'#f97316',
                    condition:'Условие: папулы/пустулы 10-30 элементов, есть комедоны',
                    desc:'Топические ретиноиды и антибиотики. Локально на зоны поражения.',
                    items:[
                      { name:'Клензит-С гель 💊', dose:'Тонкий слой', timing:'На ночь локально', note:'Адапален 0.1% (ретиноид) + клиндамицин 1% (антибиотик). Не более 8 нед непрерывно (риск резистентности C. acnes). По назначению врача' },
                      { name:'Клендовит гель 💊', dose:'Тонкий слой', timing:'Утро локально', note:'Клиндамицин 1% + адапален 0.05%. Меньшая концентрация ретиноида. ⚠ То же действующее вещество, что в Клензит-С — не дублировать. По назначению врача' },
                      { name:'Бензоил пероксид 5%', dose:'Тонкий слой', timing:'Утро локально', note:'Окислитель → уничтожает C. acnes. Не вызывает резистентности. Может сушить кожу' },
                      { name:'Салициловая кислота 2%', dose:'Точечно', timing:'Вечер', note:'Кератолитик. Открывает поры. Для жирной кожи. Чередовать: утро БПО, вечер салициловая' },
                    ]
                  },
                  {
                    phase:'ФАЗА 4 · СИСТЕМНАЯ ТЕРАПИЯ', label:'При тяжёлом акне (≥30 элементов / узлы / кисты)', color:'#ef4444',
                    condition:'Условие: обильные папулы/пустулы, узлы, кисты, рубцевание',
                    desc:'Системные препараты + дерматолог. Самолечение на этой стадии опасно.',
                    items:[
                      { name:'Верошпирон 50 мг ⚠ ТОЛЬКО ДЛЯ ЖЕНЩИН', dose:'50 мг', timing:'Утро', note:'Антагонист альдостерона, ингибитор 5α-редуктазы и CYP17 (НЕ блокатор AR). При гормональном акне. Контроль K+ каждые 2 нед! Мужчинам противопоказан' },
                      { name:'−', dose:'−', timing:'−', note:'Исключён (устаревшая практика). УФ-терапия не рекомендуется для лечения акне (AAD/EDF). См. дневной уход ниже' },
                      { name:'Изотретиноин (Роаккутан) 💊', dose:'0.5-1 мг/кг/день', timing:'С жирной едой', note:'⚠ ТОЛЬКО по назначению дерматолога. Контроль АЛТ/АСТ, липидов. Тератогенность!' },
                      { name:'Системные антибиотики 💊', dose:'По назначению врача', timing:'—', note:'Доксициклин 100 мг/день или Миноциклин. Не >3 мес (резистентность). По рецепту' },
                      { name:'Кортикостероиды (инъекции)', dose:'—', timing:'—', note:'Триамцинолон в кисты/узлы. Только дерматолог. Быстрый эффект (48-72 ч)' },
                    ]
                  },
                ].map((phase: any, pi: any) =>(
                  <div key={pi} style={{ ...cardBg, background:phase.color+'08', border:'1px solid '+phase.color+'22' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:4, background:phase.color+'22', color:phase.color }}>{phase.phase}</span>
                      <span style={{ fontSize:10, fontWeight:600, color:phase.color, flex:1 }}>{phase.label}</span>
                    </div>
                    <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.2)' }}>
                      <b style={{color:phase.color}}>{phase.condition}</b> — {phase.desc}
                    </div>
                    {phase.items.map((item: any, ii: any) =>(
                      <ItemRow key={ii} name={item.name} dose={item.dose} timing={item.timing} note={item.note} color={phase.color} />
                    ))}
                  </div>
                ))}
              </div>
              )}

              {/* Timing */}
              {acneTab === 'timing' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🧼 Суточный гигиенический протокол при акне</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Систематический уход — ключ к контролю акне. Каждый этап дня имеет свои задачи.</p>
                    {[
                      { time:'🌅 Утро (06:00–08:00)', color:'#f59e0b', items:[
                        { n:'Умывание (салициловая кислота 0.5-2%)', why:'Тёплая вода. Смыть ночной себум + бактерии. Промокнуть чистым полотенцем (не тереть!)' },
                        { n:'Клендовит гель (клиндамицин + адапален)', why:'Локально на элементы. Меньшая концентрация ретиноида — дневная поддержка' },
                        { n:'Увлажняющий крем (non-comedogenic)', why:'Пересушенная кожа = больше себума. Нежирная текстура обязательна' },
                        { n:'SPF 30+ (при ретиноидах)', why:'Ретиноиды повышают фоточувствительность. Солнцезащита обязательна ежедневно' },
                      ]},
                      { time:'☀️ День (12:00–14:00)', color:'#f97316', items:[
                        { n:'Не трогать лицо руками', why:'Руки — источник бактерий. Каждое прикосновение = перенос C. acnes' },
                        { n:'Матирующие салфетки (при жирной коже)', why:'Убрать избыток себума без умывания. Промокнуть, не тереть' },
                        { n:'Обильное питьё (вода)', why:'Гидратация кожи изнутри. Снижение концентрации себума' },
                      ]},
                      { time:'🌆 Вечер (18:00–20:00)', color:'#ef4444', items:[
                        { n:'Умывание (салициловая кислота / пенка)', why:'Смыть дневной себум, пот, загрязнения. Тщательно, но без трения' },
                        { n:'Клензит-С гель (адапален + клиндамицин)', why:'Локально на ночь. Ретиноид — ТОЛЬКО на ночь (фоточувствительность!)' },
                        { n:'Бензоил пероксид 5% (при необх.)', why:'Точечно. Утром — БПО, вечером — ретиноид (интервал). Не наносить одновременно — риск раздражения' },
                      ]},
                      { time:'🏋️ После тренировки', color:'#6366f1', items:[
                        { n:'Немедленное умывание', why:'Пот + себум + бактерии = идеальная среда для акне. Не ждать ни минуты' },
                        { n:'Чистая одежда', why:'Синтетика накапливает бактерии. Хлопок для тренировки. Стирка после каждой' },
                        { n:'Душ с антибактериальным средством', why:'Спина и плечи — частая зона гормонального акне. Тщательное мытьё' },
                      ]},
                    ].map((slot: any, si: any) =>(
                      <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                        {slot.items.map((x: any, xi: any) =>(
                          <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                            <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                            <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab */}
              {acneTab === 'lab' && (
              <div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>🧪 Необходимые анализы крови</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
                  {['Тестостерон общий/свободный','DHT','Эстрадиол (E2)','ЛГ/ФСГ','Пролактин','DHEA-S','Кортизол','SHBG','Калий (K+)','Глюкоза/Инсулин/HOMA-IR','АЛТ/АСТ','Липидограмма'].map((a: any, i: any) =>(
                    <span key={i} style={{ fontSize:7, padding:'3px 8px', borderRadius:4, background:'rgba(236,72,153,0.06)', color:'#f472b6', border:'1px solid rgba(236,72,153,0.12)' }}>{a}</span>
                  ))}
                </div>
                <div style={{ fontSize:9, fontWeight:700, color:'#a855f7', marginBottom:4 }}>🔬 Инструментальные исследования</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {['УЗИ кожи (20-50 МГц)','Себуметрия','Дерматоскопия','Микробиология (C. acnes)','Биопсия (при атипии)'].map((e: any, i: any) =>(
                    <span key={i} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.06)', color:'#c084fc', border:'1px solid rgba(168,85,247,0.12)' }}>{e}</span>
                  ))}
                </div>
              </div>
              )}

              {/* Diary */}
              {acneTab === 'diary' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>📓 Дневник обострений акне (еженедельный трекинг)</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Отслеживайте динамику. Связывайте обострения с препаратами и дозами.</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {[
                      { q:'Количество новых элементов за неделю', m:'<3 — норма, 3-10 — ФАЗА 3, >10 — ФАЗА 4' },
                      { q:'Тип элементов (комедоны / папулы / пустулы / узлы)', m:'Узлы и кисты → ФАЗА 4 немедленно' },
                      { q:'Зоны поражения (лицо / спина / плечи / грудь)', m:'Спина — часто гормональное (DHT). Лицо — гигиена + локально' },
                      { q:'Зуд / болезненность элементов', m:'Зуд = воспаление. Боль = глубокие узлы → дерматолог' },
                      { q:'Связь с препаратом / дозой ААС', m:'Записывайте. Поможет выявить триггерный ААС' },
                      { q:'Рубцевание / гиперпигментация', m:'Рубцы = немедленно к дерматологу. Атрофические рубцы необратимы' },
                    ].map((x: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)', fontSize:8 }}>
                        <div style={{ fontWeight:600, color:'#fca5a5' }}>{x.q}</div>
                        <div style={{ color:'var(--text-dim)', marginTop:2 }}>{x.m}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hygiene detailed */}
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧼 Детальный гигиенический протокол</div>
                  {[
                    { step:'Утро', action:'Умывание средством с салициловой кислотой 0.5-2%. Тёплая вода (не горячая!). Промокнуть чистым полотенцем. Клендовит гель локально. Увлажняющий крем.' },
                    { step:'День', action:'Не трогать лицо. Матирующие салфетки при жирной коже. Обильное питьё (вода).' },
                    { step:'Вечер', action:'Умывание. Клензит-С гель локально на ночь. Смена наволочки каждые 2-3 дня.' },
                    { step:'После тренировки', action:'Немедленное умывание. Пот + себум + бактерии = идеальная среда. Чистая одежда.' },
                  ].map((x: any, i: any) =>(
                    <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.08)', fontSize:8 }}>
                      <div style={{ fontWeight:700, color:'#60a5fa' }}>{x.step}</div>
                      <div style={{ color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{x.action}</div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Warnings (always visible) */}
              <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>⚠️ Критические предупреждения</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                  • <b style={{color:'#ef4444'}}>Верошпирон + добавки калия = ОПАСНО</b> (риск гиперкалиемии и остановки сердца)<br/>
                  • <b style={{color:'#ef4444'}}>Изотретиноин + беременность = ЗАПРЕЩЕНО</b> (тяжёлые пороки развития плода)<br/>
                  • Солярий НЕ рекомендуется для лечения акне (риск меланомы превышает пользу). Использовать топические средства<br/>
                  • Цинк + медь — РАЗДЕЛЬНО (цинк на ночь, медь утром, интервал ≥4 часа)<br/>
                  • При неэффективности терапии 4-6 нед — консультация дерматолога<br/>
                  • Не выдавливать элементы! Выдавливание → рубцы и распространение инфекции<br/>
                  • Системные антибиотики ≤ 3 мес (развитие резистентности C. acnes)
                </div>
              </div>
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ ИНЪЕКЦИИ ══════════ */}
          {protocolTab === 'injections' && (<InfoErrorBoundary label="Инъекции">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#14b8a6', marginBottom:2 }}>💉 Карта инъекций · Техника · Ошибки и правила</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Карта ротации зон для локальных и общих инъекций. Техника безопасности. Частые ошибки и их предотвращение.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'map', label:'🗺 Карта зон' },
                  { id:'general', label:'💉 Техника' },
                  { id:'sterility', label:'🧪 Стерильность' },
                  { id:'needles', label:'📏 Иглы/шприцы' },
                  { id:'complications', label:'🩺 Осложнения' },
                  { id:'errors', label:'⚠ Ошибки' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setInjectionTab(t.id)}
                    style={injectionTab === t.id ? pillActive('#14b8a6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* ══════ КАРТА ЗОН ══════ */}
              {injectionTab === 'map' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Header */}
                  <div style={cardBg}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#14b8a6', marginBottom:4 }}>🗺 Карта зон инъекций: полный анатомический атлас</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Подробное описание каждой зоны с анатомическими ориентирами, техникой поиска, допустимыми объёмами и комментариями по безопасности. Ротация критична: <b>минимум 7 дней отдыха</b> на каждую зону.</p>
                  </div>

                  {/* ═══ Zone 1: Glutes ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#14b8a6', marginBottom:2 }}>🍑 1. ЯГОДИЦЫ (дорсальная) — верхне-наружный квадрант</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#2dd4bf', marginBottom:6 }}>Gluteus Maximus · Dorsogluteal Site</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#5eead4' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Разделите ягодицу на 4 квадранта крестом (вертикаль через центр, горизонталь через гребень подвздошной кости). <b>ТОЛЬКО верхне-наружный квадрант.</b> Остальные 3 — ОПАСНО (седалищный нерв проходит через нижние квадранты).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#5eead4' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Положите ладонь на большой вертел бедренной кости (костный выступ сбоку бедра). Большой палец направьте к паху. Указательный — к гребню подвздошной кости. Зона между пальцами — безопасное окно.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#5eead4' }}>📐 Подзоны (4):</span>
                        <span style={{ color:'var(--text-dim)' }}> Верхне-наружная / Верхне-внутренняя / Нижне-наружная / Нижне-внутренняя. Ротируйте подзоны каждые 2 инъекции для максимального отдыха ткани.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#5eead4' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>21-23G × 1.5" (40 мм)</b>. Угол <b>90°</b>. Макс. объём <b>5 мл</b>. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Самая безопасная и вместительная зона. Идеальна для масляных растворов и больших объёмов (до 5 мл). При самостоятельной инъекции — лягте на бок, верхнюю ногу согните. Это расслабляет ягодичную мышцу и снижает боль. Если объём превышает 3 мл — рассмотрите разделение на 2 инъекции (разные подзоны).</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 2: Ventrogluteal ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:2 }}>🍑 2. ВЕНТРО-ЯГОДИЧНАЯ ОБЛАСТЬ</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#c084fc', marginBottom:6 }}>Ventrogluteal Site · Gluteus Medius & Minimus</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(168,85,247,0.03)', border:'1px solid rgba(168,85,247,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c084fc' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Боковая поверхность таза. Не путать с дорсальной ягодицей! Зона находится <b>спереди-сбоку</b> от бедра, а не сзади.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(168,85,247,0.03)', border:'1px solid rgba(168,85,247,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c084fc' }}>🔍 V-метод (как найти):</span>
                        <span style={{ color:'var(--text-dim)' }}> Положите ладонь ПРАВОЙ руки на ЛЕВЫЙ большой вертел (для левой стороны). Указательный палец — на переднюю верхнюю подвздошную ость (ASIS). Средний палец разведите максимально в сторону — он укажет на гребень подвздошной кости. <b>Треугольник между указательным и средним пальцами</b> — безопасная зона инъекции.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(168,85,247,0.03)', border:'1px solid rgba(168,85,247,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c084fc' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>21-23G × 1.5" (40 мм)</b>. Угол <b>90°</b>. Макс. объём <b>4 мл</b>. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> ПРЕДПОЧТИТЕЛЬНАЯ альтернатива дорсальной ягодице. Меньше жировой прослойки — игла гарантированно доходит до мышцы. Седалищный нерв проходит ЗНАЧИТЕЛЬНО дальше — риск его повреждения практически нулевой. Рекомендована ВОЗ как зона первого выбора для в/м инъекций. Единственный минус: сложнее колоть самому себе (нужна практика V-метода).</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 3: Quads ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:2 }}>🦵 3. КВАДРИЦЕПСЫ — латеральная головка</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#60a5fa', marginBottom:6 }}>Vastus Lateralis · Lateral Thigh</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(59,130,246,0.03)', border:'1px solid rgba(59,130,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#93c5fd' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> <b>ТОЛЬКО наружная (латеральная) поверхность бедра.</b> Границы: от ладони ниже тазобедренного сустава до ладони выше колена. Ширина: от средней линии бедра до наружного края.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(59,130,246,0.03)', border:'1px solid rgba(59,130,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#93c5fd' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Сядьте, вытяните ногу. Разделите бедро мысленно на 3 трети по длине. <b>Средняя треть</b> — оптимальная зона. Верхняя — риск тазобедренного сустава. Нижняя — близко к коленному суставу. Отступайте на 2 пальца от средней линии бедра кнаружи.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(59,130,246,0.03)', border:'1px solid rgba(59,130,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#93c5fd' }}>⚠️ ОПАСНЫЕ ЗОНЫ:</span>
                        <span style={{ color:'#ff6b6b' }}> ❌ Передняя поверхность — бедренный нерв и артерия. ❌ Внутренняя (медиальная) — бедренная артерия и вена. ❌ Задняя — седалищный нерв. Только латеральная поверхность!</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(59,130,246,0.03)', border:'1px solid rgba(59,130,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#93c5fd' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>23-25G × 1" (25 мм)</b>. Угол <b>90°</b> для в/м, <b>45°</b> для п/к. Макс. объём <b>3 мл</b>. Тонкие иглы (25G) предпочтительны — меньше травма.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Самая удобная зона для самостоятельных инъекций — сидя, нога расслаблена. Новичкам лучше начинать именно с бедра. Масляные растворы могут давать PIP (post-injection pain) на 1-2 дня — это нормально. Если боль не проходит через 3 дня или усиливается — проверьте на инфекцию. Не колоть в день тренировки ног (усиливает боль и воспаление).</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 4: Delts ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:2 }}>💪 4. ДЕЛЬТОВИДНАЯ МЫШЦА</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#4ade80', marginBottom:6 }}>Deltoid · Intramuscular Shoulder</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#86efac' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> <b>Центр мышечного брюшка дельты.</b> Границы: акромион (костный выступ плеча) сверху, дельтовидная бугристость плечевой кости снизу. Боковая поверхность плеча.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#86efac' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Опустите руку свободно вниз. Найдите акромион (самую верхнюю точку плеча). Опуститесь на <b>2-3 пальца (3-5 см) ниже</b>. Центр образовавшегося мышечного брюшка — точка вкола. Слишком высоко = риск субакромиального бурсита и повреждения сустава. Слишком низко = лучевой нерв (в средней трети плеча).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#86efac' }}>⚠️ Важно:</span>
                        <span style={{ color:'var(--text-dim)' }}> При перекачанных дельтах мышца уплотняется — может потребоваться игла 1" вместо 5/8". Если чувствуете кость — игла слишком короткая/неправильный угол. У худощавых людей дельта может быть тонкой — используйте иглу 5/8" и угол 90°.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#86efac' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8"-1" (16-25 мм)</b>. Угол <b>90°</b>. Макс. объём <b>2 мл</b>. В/м. Тонкая игла обязательна.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Зона МАЛОГО объёма. Не пытайтесь ввести &gt;2 мл — боль, отёк, риск повреждения сустава и нерва. Для масляных растворов объёмом &gt;1 мл лучше выбрать бедро или ягодицу. Самостоятельная инъекция в дельту не очень удобна (одна рука держит шприц, вторая расслаблена). Можно выполнять стоя перед зеркалом или сидя, опираясь локтем на стол. Не колоть в день тренировки плеч.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 5: Lats ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:2 }}>🔙 5. ШИРОЧАЙШАЯ МЫШЦА СПИНЫ</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#fb923c', marginBottom:6 }}>Latissimus Dorsi · Subaxillary Site</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(249,115,22,0.03)', border:'1px solid rgba(249,115,22,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fdba74' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Задняя стенка подмышечной впадины. Широкая мышца, идущая от поясницы к плечу. Подмышечная складка — задняя её часть образована широчайшей мышцей.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(249,115,22,0.03)', border:'1px solid rgba(249,115,22,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fdba74' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Заведите руку за голову — широчайшая напрягается. Точка вкола: подмышечная складка сзади, в верхней трети мышцы. Ближе к подмышке = толще мышца = безопаснее. Ниже середины спины = тоньше мышца = риск пневмоторакса.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ КРИТИЧЕСКИ:</span>
                        <span style={{ color:'#ff6b6b' }}> ТОЛЬКО верхняя треть мышцы. Ниже — плевра и лёгкое. Слишком глубокий вкол = пневмоторакс (прокол лёгкого). При резкой боли в груди + одышке после инъекции — немедленно в больницу!</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(249,115,22,0.03)', border:'1px solid rgba(249,115,22,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fdba74' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8" (16 мм)</b>. Угол <b>90°</b>. Макс. объём <b>2 мл</b>. Только тонкие иглы. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Зона для ОПЫТНЫХ. Хорошая ротационная альтернатива, когда ягодицы/бёдра/дельты перегружены. Самостоятельно колоть сложно — нужна помощь. Если нет опыта — лучше использовать другие зоны. Не рекомендуется для масляных растворов объёмом более 1 мл — риск образования кисты в труднодоступном месте.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 6: Pecs ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:2 }}>🏋️ 6. БОЛЬШАЯ ГРУДНАЯ МЫШЦА (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#f472b6', marginBottom:6 }}>Pectoralis Major · Chest Site · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#f9a8d4' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Верхне-наружная часть грудной мышцы. Точка: на 2 пальца ниже ключицы и на 3 пальца кнутри от плечевого сустава (дельтовидно-грудная борозда). Самая мясистая часть.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#f9a8d4' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Поднимите руку на 90° и напрягите грудную. Точка вкола — между верхней и средней третью мышцы по горизонтали и на 2-3 пальца отступив от подмышки к центру груди.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ ОПАСНО:</span>
                        <span style={{ color:'#ff6b6b' }}> Не колоть в нижнюю треть (молочная железа у мужчин — гинекомастия). Не колоть в среднюю линию груди (грудина, сердце). Не заходить глубже 1.5 см (плевра и лёгкое). При появлении кашля/одышки после инъекции — срочно к врачу.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#f9a8d4' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8" (16 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1.5 мл</b>. ТОЛЬКО водные растворы и тонкие масла. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Локальная инъекция для site-enhancement. НЕ для системного курса (масляные депо слишком близко к жизненно важным структурам). Часто используется с водными препаратами (водная суспензия тестостерона, Winstrol водный) для локального эффекта. Самостоятельная инъекция возможна, но требует осторожности. Высокий риск гематом (грудная мышца хорошо кровоснабжается).</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 7: Traps ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:2 }}>🏔 7. ТРАПЕЦИЕВИДНАЯ МЫШЦА (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#fbbf24', marginBottom:6 }}>Trapezius · Upper Back · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fcd34d' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Верхняя порция трапеции. Точка вкола: центр мышечного брюшка между шеей и плечевым суставом. Мысленная линия от затылка до акромиона — на середине этой линии.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fcd34d' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Пожмите плечами — трапеция напрягается и становится заметной. Выберите самую толстую часть мышцы. Отступите 2 пальца от позвоночника (остистые отростки) и 2 пальца от шеи.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ ОПАСНО:</span>
                        <span style={{ color:'#ff6b6b' }}> Не колоть близко к шее (шейное сплетение, сонная артерия). Не колоть близко к позвоночнику. Глубина не более 1.5 см (под трапецией — рёбра и лёгкое). Объём не более 1 мл.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fcd34d' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>27-29G × 1/2" (13 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1 мл</b>. ТОЛЬКО водные. П/к или поверхностный в/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Высокорисковая локальная зона. Только для водных препаратов малого объёма (0.5-1 мл). Самостоятельно — через зеркало или с помощником. При попадании в нервное сплетение — острая боль в руку. При боли — немедленно извлечь. Начинающим НЕ рекомендуется.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 8: Triceps ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#06b6d4', marginBottom:2 }}>💪 8. ТРИЦЕПС (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#22d3ee', marginBottom:6 }}>Triceps Brachii · Lateral Head · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#67e8f9' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Латеральная (наружная) головка трицепса. Задняя поверхность плеча, наружная часть. Точка: середина между локтём и плечевым суставом по наружному краю.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#67e8f9' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Согните руку в локте на 90° и напрягите трицепс (как при разгибании). Визуально определяется подковообразная мышца. Латеральная головка — наружная часть этой подковы. Точка вкола — середина по высоте.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#67e8f9' }}>⚠️ Важно:</span>
                        <span style={{ color:'var(--text-dim)' }}> На внутренней поверхности плеча проходит лучевой нерв (в спиральном канале). Держитесь строго наружной поверхности. Средняя и нижняя треть безопаснее верхней (близко к подмышечному нерву).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(6,182,212,0.03)', border:'1px solid rgba(6,182,212,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#67e8f9' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8" (16 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1.5 мл</b>. Водные + лёгкие масляные. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Удобная локальная зона. Самостоятельная инъекция возможна: согните руку и упритесь локтем в колено (поза «задумчивый»). Масляные растворы — осторожно, склонность к PIP и затяжным болям. Чередуйте левую и правую руку.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 9: Biceps ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:2 }}>💪 9. БИЦЕПС (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#f87171', marginBottom:6 }}>Biceps Brachii · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Двуглавая мышца плеча. Передняя поверхность плеча. Точка: центр мышечного брюшка (средняя треть по высоте). При напряжении — заметное утолщение.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Согните руку на 90° и напрягите бицепс. Определите центр брюшка. Точка — наружная сторона бицепса (ближе к плечевой кости, а не к внутренней стороне, где проходит сосудисто-нервный пучок).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ ОЧЕНЬ ОПАСНО:</span>
                        <span style={{ color:'#ff6b6b' }}> Самая рисковая локальная зона. Маленький объём мышцы, много нервов и сосудов. НЕ ДЛЯ НАЧИНАЮЩИХ. Попадание в срединный нерв = паралич сгибания пальцев.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>27-29G × 1/2" (13 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1 мл</b>. ТОЛЬКО водные препараты. Поверхностный в/м или глубокая п/к.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Экстремально рисковая зона. Оправдана ТОЛЬКО при необходимости site-enhancement (предсоревновательная подготовка). Не используйте для системных курсов. Самостоятельная инъекция — через зеркало, рука согнута. При малейшем онемении или простреле в пальцы — немедленно извлечь иглу. Повреждение нерва может быть необратимым.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Zone 10: Calves ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:2 }}>🦵 10. ИКРОНОЖНЫЕ МЫШЦЫ (ЛОКАЛЬНАЯ)</div>
                    <div style={{ fontSize:7, fontWeight:600, color:'#a78bfa', marginBottom:6 }}>Gastrocnemius · Calves · Spot Injection</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c4b5fd' }}>📍 Анатомические ориентиры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Икроножная мышца. Задняя поверхность голени. Точка вкола: верхняя треть медиальной (внутренней) головки. Мышца здесь наиболее толстая.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c4b5fd' }}>🔍 Как найти:</span>
                        <span style={{ color:'var(--text-dim)' }}> Встаньте на носок — икроножная напрягается. Точка: внутренняя головка (медиальная), верхняя треть, самый толстый участок. Отступайте 1-2 см от средней линии голени кнутри.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fca5a5' }}>⚠ ОЧЕНЬ БОЛЬНО:</span>
                        <span style={{ color:'#ff6b6b' }}> Самая болезненная зона. Плотная фасция + мало места = сильный PIP. Масляные растворы ВЫЗЫВАЮТ СИЛЬНУЮ БОЛЬ. Риск компартмент-синдрома (сдавление сосудов и нервов в фасциальном футляре).</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(139,92,246,0.03)', border:'1px solid rgba(139,92,246,0.06)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#c4b5fd' }}>💉 Параметры:</span>
                        <span style={{ color:'var(--text-dim)' }}> Игла <b>25-27G × 5/8" (16 мм)</b>. Угол <b>90°</b>. Макс. объём <b>1 мл</b>. ТОЛЬКО водные препараты. В/м.</span>
                      </div>
                      <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <span style={{ fontWeight:700, color:'#fbbf24' }}>💬 Комментарий:</span>
                        <span style={{ color:'var(--text-dim)' }}> Только для опытных и только водные растворы. Никогда не используйте масляные препараты в икры — боль может быть настолько сильной, что вы не сможете ходить 3-5 дней. Компартмент-синдром — редкое, но серьёзное осложнение (требует хирургической фасциотомии). При нарастающей распирающей боли в икре после инъекции — немедленно к врачу.</span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ 8-week rotation schedule (expanded) ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>📅 Полный график ротации (8-недельный цикл, 2 инъекции/нед)</div>
                    <p style={{ fontSize:7, color:'var(--text-dim)', margin:'0 0 6px', lineHeight:1.3 }}>Каждая зона получает минимум 7 дней отдыха. При 3+ инъекциях в неделю — добавьте локальные зоны (грудь, трицепс) в ротацию для расширения цикла.</p>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left', fontWeight:600 }}>Неделя</th>
                            <th style={{ padding:4, color:'#60a5fa', textAlign:'left', fontWeight:600 }}>Инъекция 1</th>
                            <th style={{ padding:4, color:'#f472b6', textAlign:'left', fontWeight:600 }}>Инъекция 2</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Нед 1','Правая ягодица (в/н квадрант)','Левое бедро (латеральная, середина)'],
                            ['Нед 2','Левая ягодица (в/н квадрант)','Правое бедро (латеральная, середина)'],
                            ['Нед 3','Правая дельта','Левая вентро-ягодичная'],
                            ['Нед 4','Левая дельта','Правая вентро-ягодичная'],
                            ['Нед 5','Правая ягодица (в/вн квадрант)','Левое бедро (латеральная, верх)'],
                            ['Нед 6','Левая ягодица (в/вн квадрант)','Правое бедро (латеральная, верх)'],
                            ['Нед 7','Правая грудь (верхне-наружная)','Левый трицепс (латеральная)'],
                            ['Нед 8','Левая грудь (верхне-наружная)','Правый трицепс (латеральная)'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding:5, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:5, color:'#93c5fd' }}>{r[1]}</td>
                              <td style={{ padding:5, color:'#f9a8d4' }}>{r[2]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ═══ Zone status tracking (expanded) ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>📊 Дневник состояния зон инъекций</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>При появлении любых отклонений — исключайте зону из ротации на 2-4 недели. <b>Никогда не колите в зону с признаками воспаления.</b></p>
                    {[
                      { zone:'Ягодицы (дорсальные)', freq:'Каждые 7-10 дн', indicators:['OK','Уплотнение','Боль','Гематома','Инфильтрат','Абсцесс'],
                        actions:'Тёплый компресс 15 мин × 3 р/день. Гепариновая мазь. При уплотнении >5 дней без признаков инфекции — лёгкий массаж.' },
                      { zone:'Вентро-ягодичные', freq:'Каждые 7-10 дн', indicators:['OK','Уплотнение','Боль','Гематома'],
                        actions:'При боли >2 дней: проверьте технику V-метода. Возможно, попали в надкостницу или слишком глубоко.' },
                      { zone:'Квадрицепсы (латеральные)', freq:'Каждые 7-10 дн', indicators:['OK','Уплотнение','Боль','Гематома','Инфильтрат','Онемение'],
                        actions:'При онемении: НЕМЕДЛЕННО исключить. Возможно задели ветвь бедренного нерва. Проверьте, не ушли ли на переднюю поверхность.' },
                      { zone:'Дельты', freq:'Каждые 7-10 дн', indicators:['OK','Уплотнение','Боль','Гематома','Отёк','Ограничение движения'],
                        actions:'При ограничении: исключить на 3-4 нед. НПВС местно. Проверить объём инъекции (не >2 мл).' },
                      { zone:'Грудные (локальные)', freq:'Каждые 14 дн', indicators:['OK','Уплотнение','Боль','Гематома','Шишка'],
                        actions:'Высокий риск гематом. При «шишке» >3 дней — исключить зону на 4 нед. Тёплый компресс. Проверить на инфекцию.' },
                      { zone:'Трицепсы (локальные)', freq:'Каждые 10-14 дн', indicators:['OK','Уплотнение','Боль','Гематома'],
                        actions:'При простреле в пальцы — повреждение лучевого нерва. Немедленно исключить зону на 6-8 нед.' },
                    ].map((z: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#4ade80' }}>{z.zone}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', padding:'2px 6px', borderRadius:4, background:'rgba(255,255,255,0.04)' }}>Ротация: {z.freq}</span>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:4 }}>
                          {z.indicators.map((ind: any, ii: any) =>(
                            <span key={ii} style={{ fontSize:7, padding:'2px 6px', borderRadius:4, cursor:'pointer',
                              background:ind==='OK'?'rgba(34,197,94,0.12)':ind==='Абсцесс'?'rgba(239,68,68,0.12)':ind==='Онемение'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.08)',
                              color:ind==='OK'?'#22c55e':ind==='Абсцесс'?'#ef4444':ind==='Онемение'?'#ef4444':'#f59e0b',
                              border:'1px solid rgba(255,255,255,0.06)' }}>{ind}</span>
                          ))}
                        </div>
                        <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{z.actions}</div>
                      </div>
                    ))}
                  </div>

                  {/* ═══ Summary: all zones at a glance ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', marginBottom:6 }}>📋 Сводная таблица: все зоны инъекций</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:7, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Зона</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Тип</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Игла</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Макс. мл</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Раствор</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Сложность</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Риск</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Ягодицы (дорс.)','Общая','21-23G × 1.5"','5 мл','Любой','⭐','Низкий'],
                            ['Вентро-ягодичная','Общая','21-23G × 1.5"','4 мл','Любой','⭐⭐','Низкий'],
                            ['Квадрицепсы (лат.)','Общая','23-25G × 1"','3 мл','Любой','⭐','Средний'],
                            ['Дельты','Общая','25-27G × 5/8-1"','2 мл','Любой','⭐','Средний'],
                            ['Широчайшая','Общая','25-27G × 5/8"','2 мл','Водный','⭐⭐⭐','Высокий'],
                            ['Грудные','Локальная','25-27G × 5/8"','1.5 мл','Водный','⭐⭐','Высокий'],
                            ['Трапеции','Локальная','27-29G × 1/2"','1 мл','Водный','⭐⭐⭐','Оч. высокий'],
                            ['Трицепс','Локальная','25-27G × 5/8"','1.5 мл','Водный','⭐⭐','Средний'],
                            ['Бицепс','Локальная','27-29G × 1/2"','1 мл','Водный','⭐⭐⭐','Оч. высокий'],
                            ['Икры','Локальная','25-27G × 5/8"','1 мл','Водный','⭐⭐⭐','Оч. высокий'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:3, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:3, color:r[1]==='Общая'?'#60a5fa':'#f472b6' }}>{r[1]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[2]}</td>
                              <td style={{ padding:3, color:'#fbbf24', fontWeight:600 }}>{r[3]}</td>
                              <td style={{ padding:3, color:r[4]==='Любой'?'#4ade80':'#fbbf24' }}>{r[4]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[5]}</td>
                              <td style={{ padding:3, color:r[6]==='Низкий'?'#4ade80':r[6]==='Средний'?'#fbbf24':r[6]==='Высокий'?'#f97316':'#ef4444', fontWeight:600 }}>{r[6]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ ТЕХНИКА ИНЪЕКЦИЙ ══════ */}
              {injectionTab === 'general' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Header */}
                  <div style={cardBg}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#14b8a6', marginBottom:4 }}>💉 Полное руководство по технике инъекций</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Внутримышечные (в/м), подкожные (п/к), набор из ампул и флаконов, самостоятельные инъекции, уменьшение боли. Пошаговые протоколы для каждого типа.</p>
                  </div>

                  {/* ═══ В/М ИНЪЕКЦИЯ: ПОШАГОВО ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#14b8a6', marginBottom:6 }}>💪 Внутримышечная инъекция: 10 шагов</div>
                    {[
                      { step:'1. Подготовка рабочего места', detail:'Чистая горизонтальная поверхность. Спирт 70% + стерильные салфетки + шприцы + иглы + препарат + контейнер для утилизации. Вымойте руки 30 сек с мылом. Наденьте перчатки (опционально, но рекомендовано).' },
                      { step:'2. Вскрытие и набор', detail:'<b>Ампула:</b> постучите по шейке, подпилите (если без точки надлома), оберните салфеткой, надломите «от себя». <b>Флакон:</b> снимите крышку, обработайте пробку спиртом. Наберите воздух в шприц = объёму препарата. Вколите иглу для набора (18-21G) в пробку, введите воздух, переверните флакон, наберите препарат. Извлеките иглу. <b>СМЕНИТЕ ИГЛУ</b> на новую для инъекции (игла затупилась о стекло/резину).' },
                      { step:'3. Удаление пузырьков воздуха', detail:'Держите шприц иглой вверх. Постучите по цилиндру. Медленно нажмите на поршень чтобы вытолкнуть воздух до появления капли на кончике иглы. Эта капля — смазка. НЕ вытирайте иглу (риск инфекции + ворсинки).' },
                      { step:'4. Выбор зоны и пальпация', detail:'Определите зону по карте. Пропальпируйте пальцами — нет ли уплотнений, болезненности, гематом. <b>При ЛЮБЫХ отклонениях — другая зона.</b> Ягодица: разделите на 4 квадранта, ТОЛЬКО верхне-наружный. Бедро: средняя треть латеральной поверхности. Дельта: 2-3 пальца ниже акромиона.' },
                      { step:'5. Обработка кожи', detail:'Спиртовая салфетка 70% (НЕ 96% — он испаряется слишком быстро и слабее убивает бактерии). Круговыми движениями от центра к периферии, диаметр ~5 см. <b>Дайте ВЫСОХНУТЬ 15-30 сек</b>. Мокрая кожа = жжение + неполная антисептика + занос бактерий с поверхности.' },
                      { step:'6. Z-тракт метод (обязательно!)', detail:'Свободной рукой сместите кожу на 1-2 см в сторону. Удерживайте до конца процедуры. После извлечения иглы — отпустите. <b>Зачем:</b> создаётся зигзагообразный канал. Препарат не вытекает обратно по каналу иглы. Снижает боль, раздражение и риск инфильтрата.' },
                      { step:'7. Вкол', detail:'Быстрое, уверенное, хлёсткое движение под углом <b>90°</b> (строго перпендикулярно поверхности). Игла входит на 2/3-3/4 длины (часть остаётся снаружи для экстренного извлечения при поломке). <b>Держите шприц как дротик</b> — между большим и указательным/средним пальцем. Медленный вкол = БОЛЬШЕ боли (игла растягивает, а не прокалывает ткани).' },
                      { step:'8. Аспирационная проба', detail:'Потяните поршень НАЗАД на 2-3 сек (создайте разрежение). <b>Кровь в шприце</b> = игла в кровеносном сосуде → извлеките иглу, смените иглу и зону, начните заново. <b>Пузырьки воздуха</b> (пена) = игла в мышце — всё правильно, можно вводить. <b>Ничего не тянется</b> = плотная ткань/фасция — продвиньте иглу чуть глубже или чуть оттяните.' },
                      { step:'9. Введение препарата', detail:'<b>МЕДЛЕННО.</b> Водные растворы: 1 мл за 10-15 сек. Масляные растворы: 1 мл за 20-30 сек. Быстрое введение масла = масляная эмболия. Не двигайте иглу во время введения (микротравмы). При появлении резкой боли — НЕМЕДЛЕННО остановитесь и извлеките иглу (возможно, попали в нерв или сосуд).' },
                      { step:'10. Извлечение и пост-уход', detail:'Быстро извлеките иглу под тем же углом (90°). Отпустите Z-тракт. Сразу прижмите СУХУЮ стерильную салфетку на 30-60 сек (без смещения). НЕ массируйте масляные инъекции (разрушение депо + PIP). Двигайтесь 5-10 мин для улучшения кровотока. Утилизируйте иглу в непрокалываемый контейнер (надевайте колпачок одной рукой методом «зачерпывания»).' },
                    ].map((s: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(20,184,166,0.03)', border:'1px solid rgba(20,184,166,0.08)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', marginBottom:3 }}>{s.step}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }} dangerouslySetInnerHTML={{ __html: s.detail }} />
                      </div>
                    ))}
                  </div>

                  {/* ═══ П/К ИНЪЕКЦИЯ ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ec4899', marginBottom:6 }}>💉 Подкожная инъекция (п/к): полный протокол</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Для пептидов, HCG, HGH, инсулина, некоторых водных препаратов. Техника отличается от в/м по углу, длине иглы и зонам.</p>
                    {[
                      { step:'📐 Угол и техника', detail:'Угол <b>45°</b> (в кожную складку) или <b>90°</b> (короткая игла 5-8 мм). Соберите кожу в складку большим и указательным пальцами. Не захватывайте мышцу (приподнимайте только кожу и жир). Иглу вводите в ОСНОВАНИЕ складки (не в вершину).' },
                      { step:'📍 Зоны для п/к', detail:'<b>Живот:</b> 5 см от пупка, по полукругу. Самая удобная зона для самостоятельных инъекций. Чередуйте левую/правую сторону. <b>Бедро:</b> передняя или латеральная поверхность, верхняя треть. <b>Плечо:</b> задняя поверхность (трицепс), верхняя половина. <b>Ягодица:</b> любая точка (жировая прослойка толстая). <b>Ротация п/к зон:</b> минимум 4 зоны, расстояние между точками &gt;2 см.' },
                      { step:'💉 Иглы для п/к', detail:'Инсулиновые шприцы 29-31G × 5/16"-1/2" (8-13 мм) — идеальны для пептидов и HCG. Обычные шприцы 25-27G × 5/8" — для водных растворов. <b>Объём:</b> не &gt;1.5 мл в одну зону. При объёмах &gt;1 мл — разделяйте на 2 инъекции в разные зоны.' },
                      { step:'⚠️ Риски п/к инъекций', detail:'<b>Липодистрофия:</b> истончение или уплотнение жировой ткани при частых инъекциях в одну зону. <b>Липогипертрофия:</b> разрастание жировой ткани (шишки). В эти зоны НЕ колоть — всасывание нарушено. <b>Инфекция:</b> реже чем в/м, но возможна. <b>Гематома:</b> чаще чем в/м (подкожные капилляры). Прижимать дольше — до 2 мин.' },
                      { step:'🔍 Как проверить, что вы в п/к, а не в/м', detail:'1. Кожная складка должна быть мягкой и подвижной. 2. При уколе ощущение «провала» меньше чем при в/м. 3. Аспирационная проба (да, даже для п/к) — крови быть НЕ должно. 4. После введения — небольшой волдырь под кожей (нормально для объёмов &gt;0.5 мл).' },
                    ].map((s: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(236,72,153,0.03)', border:'1px solid rgba(236,72,153,0.08)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#f472b6', marginBottom:3 }}>{s.step}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }} dangerouslySetInnerHTML={{ __html: s.detail }} />
                      </div>
                    ))}
                  </div>

                  {/* ═══ DRAWING UP ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>🔬 Набор препарата: ампула vs флакон</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#fbbf24', marginBottom:4 }}>🧪 Из стеклянной ампулы</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                          <b>1.</b> Постучите ногтем по шейке — раствор стечёт вниз.<br/>
                          <b>2.</b> При отсутствии точки/кольца надлома — подпилите шейку пилочкой (идут в упаковке).<br/>
                          <b>3.</b> Оберните шейку спиртовой салфеткой — защита от порезов.<br/>
                          <b>4.</b> Надломите шейку <b>ОТ СЕБЯ</b> (осколки летят наружу).<br/>
                          <b>5.</b> Вскрытую ампулу поставьте на стол (она устойчива).<br/>
                          <b>6.</b> Используйте <b>ФИЛЬТР-ИГЛУ</b> (blunt fill needle, обычно зелёная 18-19G с фильтром 5 мкм) или обычную 18-21G. Фильтр-игла задерживает осколки стекла (бывают микроскопические).<br/>
                          <b>7.</b> Наклоните ампулу. Наберите раствор, не касаясь иглой краёв (стеклянная пыль, бактерии).<br/>
                          <b>8.</b> СМЕНИТЕ ИГЛУ на новую для инъекции.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.1)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>💊 Из резинового флакона (виалы)</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                          <b>1.</b> Снимите пластиковую крышку (flip-off cap).<br/>
                          <b>2.</b> Обработайте резиновую пробку спиртовой салфеткой. Дайте высохнуть.<br/>
                          <b>3.</b> Наберите в шприц ВОЗДУХ, равный объёму препарата.<br/>
                          <b>4.</b> Вколите иглу в ЦЕНТР пробки под углом 90°.<br/>
                          <b>5.</b> ВВЕДИТЕ ВОЗДУХ во флакон (создаёт давление → легче набирать).<br/>
                          <b>6.</b> Переверните флакон вверх дном. Кончик иглы должен быть ПОГРУЖЁН в жидкость.<br/>
                          <b>7.</b> Медленно набирайте препарат. При «присасывании» поршня — добавьте ещё воздуха.<br/>
                          <b>8.</b> Извлеките иглу. СМЕНИТЕ ИГЛУ на новую для инъекции.<br/>
                          <b>9.</b> Многодозовые флаконы: храните в холодильнике (если указано), НЕ используйте &gt;28 дней после вскрытия. Записывайте дату вскрытия на флаконе.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ═══ PAIN REDUCTION ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>🟢 12 способов уменьшить боль при инъекции</div>
                    {[
                      { tip:'Согрейте препарат', detail:'Масляный раствор — в руке 1-2 мин или под тёплой (не горячей!) водой. Холодное масло = кристаллизация в тканях = боль.' },
                      { tip:'Используйте тонкую иглу', detail:'25G вместо 21G = субъективно на 60% меньше боли. Тоньше — медленнее введение, но комфортнее.' },
                      { tip:'Меняйте иглу после набора', detail:'Затупленная о резину/стекло игла = микроразрывы ткани при вколе. Новая острая игла = минимум травмы.' },
                      { tip:'Быстрый вкол', detail:'Хлёсткое движение как дротик. Медленный вкол = игла «расталкивает» ткани вместо прокола.' },
                      { tip:'Расслабьте мышцу', detail:'Напряжённая мышца = плотная ткань = больше сопротивление = больше боли. Лягте/сядьте, глубоко дышите.' },
                      { tip:'Медленное введение', detail:'1 мл / 20-30 сек для масла. Быстрое введение = гидравлический разрыв тканей + воспаление.' },
                      { tip:'Z-тракт метод', detail:'Смещение кожи на 1-2 см. Препарат остаётся в мышце, не раздражает п/к клетчатку.' },
                      { tip:'Лёд перед инъекцией', detail:'Кубик льда на 30 сек на зону перед обработкой спиртом. Снижает чувствительность поверхностных нервов. НЕ переохлаждать.' },
                      { tip:'Растяните кожу', detail:'Свободной рукой натяните кожу в зоне вкола. Натянутая кожа = меньше сопротивление = меньше боли.' },
                      { tip:'Лидокаин (опционально)', detail:'Добавление 0.1-0.2 мл 2% лидокаина в шприц (при совместимости). Местная анестезия. НЕ для тех, у кого аллергия на лидокаин.' },
                      { tip:'Движение после', detail:'5-10 мин ходьбы. Улучшает кровоток, распределяет препарат, снижает PIP.' },
                      { tip:'Массаж (только водные!)', detail:'Лёгкий массаж зоны через 30 мин после в/м инъекции водных растворов. Масляные — НЕЛЬЗЯ (разрушение депо).' },
                    ].map((t: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(34,197,94,0.03)', border:'1px solid rgba(34,197,94,0.06)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#4ade80', marginBottom:2 }}>✅ {t.tip}</div>
                        <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.4 }}>{t.detail}</div>
                      </div>
                    ))}
                  </div>

                  {/* ═══ SELF-INJECTION ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', marginBottom:6 }}>🪞 Самостоятельные инъекции: стратегии для труднодоступных зон</div>
                    {[
                      { zone:'Ягодица', method:'Лягте на бок. Нижняя нога прямая, верхняя согнута в колене. Свободной рукой найдите верхне-наружный квадрант. Шприц держите как дротик в доминантной руке. Зеркало на полу/низко — помогает контролировать угол.' },
                      { zone:'Вентро-ягодичная', method:'Стоя, перенесите вес на противоположную ногу. V-метод: ладонь на большой вертел, указательный на ASIS, средний развести — треугольник между пальцами. Колите доминантной рукой. Зеркало сбоку.' },
                      { zone:'Бедро (латеральное)', method:'Сядьте на стул. Нога прямая, расслаблена. Разверните бедро кнаружи. Доминантная рука держит шприц. Свободная — стабилизирует бедро. Самая простая зона для самостоятельной инъекции.' },
                      { zone:'Дельта', method:'Сядьте, обопритесь локтем на стол (рука свисает расслабленно). Или стойте перед зеркалом, рука свободно опущена. Доминантная рука через грудь к противоположному плечу. Можно колоть стоя боком к зеркалу.' },
                      { zone:'Грудь (локальная)', method:'Стоя перед зеркалом. Рука со стороны инъекции за головой (расширяет грудную). Точка: верхне-наружная часть. Доминантная рука через грудь. Медленно. Не дышите глубоко (движение грудной клетки).' },
                      { zone:'Трицепс', method:'Сядьте, рука согнута в локте, кисть касается противоположного плеча («поза задумчивый»). Латеральная головка трицепса доступна. Колите доминантной рукой. Или: положите руку на стол перед собой и колите сверху.' },
                    ].map((z: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(99,102,241,0.03)', border:'1px solid rgba(99,102,241,0.08)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#a5b4fc', marginBottom:2 }}>{z.zone}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{z.method}</div>
                      </div>
                    ))}
                  </div>

                  {/* ═══ COMPARISON TABLE ═══ */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📐 Сравнение: в/м vs п/к vs в/в</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Параметр</th>
                            <th style={{ padding:4, color:'#60a5fa', textAlign:'left' }}>В/м (внутримышечно)</th>
                            <th style={{ padding:4, color:'#f472b6', textAlign:'left' }}>П/к (подкожно)</th>
                            <th style={{ padding:4, color:'#ef4444', textAlign:'left' }}>В/в (внутривенно)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Угол','90°','45° (в складку) или 90° (короткая игла)','15-30°'],
                            ['Глубина','2.5-4 см','0.5-1.5 см','В просвет вены'],
                            ['Игла','21-23G × 1-1.5"','27-31G × 5/16-5/8"','21-25G'],
                            ['Макс. объём','5 мл (ягодица) / 2-3 мл (дельты/бедро)','1-1.5 мл','Любой (капельно)'],
                            ['Скорость введения','1 мл/10-30 сек','1 мл/5-10 сек','Капельно / медленно'],
                            ['Всасывание','Депо-эффект (медленное, ровное)','Медленное (через жир)','Мгновенное 100%'],
                            ['Пик в крови','24-72 ч (масло) / 1-4 ч (вода)','2-8 ч','Немедленно'],
                            ['Для чего','Масляные ААС, антибиотики','Пептиды, инсулин, HCG, HGH, вакцины','Только врач!'],
                            ['Риски','Абсцесс, нерв, сосуд, гематома','Липодистрофия, инфекция, гематома','Флебит, сепсис, эмболия, анафилаксия'],
                            ['Аспирация','ОБЯЗАТЕЛЬНА','Рекомендована','Не нужна (уже в вене)'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:4, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:4, color:'#93c5fd' }}>{r[1]}</td>
                              <td style={{ padding:4, color:'#f9a8d4' }}>{r[2]}</td>
                              <td style={{ padding:4, color:'#fca5a5' }}>{r[3]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pre-injection checklist */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>✅ Полный чек-лист перед инъекцией</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {[
                        'Чистые руки (30 сек)',
                        'Спирт 70%',
                        'Стерильные салфетки',
                        'Новая игла для набора (18-21G)',
                        'Новая игла для инъекции (23-27G)',
                        'Шприц нужного объёма',
                        'Срок годности препарата',
                        'Проверить раствор (цвет, осадок)',
                        'Согреть масляный р-р в руке',
                        'Контейнер для утилизации',
                        'Зона без уплотнений',
                        'Зона обработана и сухая',
                        'Z-тракт смещение кожи',
                        'Аспирационная проба',
                        'Пластырь (при необходимости)',
                      ].map((c: any, i: any) =>(
                        <span key={i} style={{ fontSize:7, padding:'3px 8px', borderRadius:6, background:'rgba(34,197,94,0.08)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.15)' }}>☑ {c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ СТЕРИЛЬНОСТЬ ══════ */}
              {injectionTab === 'sterility' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#6366f1', marginBottom:4 }}>🧪 Стерильность и асептика: полный протокол</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Нарушение стерильности — причина №1 постинъекционных осложнений. Абсцесс, флегмона, сепсис развиваются из-за бактерий, занесённых при инъекции. <b>Асептика — это НЕ опция, это ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ.</b></p>
                  </div>

                  {/* Workspace preparation */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', marginBottom:6 }}>🏠 Подготовка рабочего места</div>
                    {[
                      { step:'1. Выбор поверхности', detail:'Чистый стол/тумба без лишних предметов. Протрите поверхность спиртом 70% или хлоргексидином. Постелите чистую бумажную салфетку или одноразовую пелёнку. <b>НИКОГДА не делайте инъекции в ванной</b> (влажность = бактерии + плесень).' },
                      { step:'2. Организация инструментов', detail:'Разложите всё ЗАРАНЕЕ. Слева направо: спиртовые салфетки → шприцы → иглы для набора → иглы для инъекции → препарат → стерильные салфетки → контейнер для утилизации. Вскрывайте упаковки непосредственно перед использованием, а не заранее.' },
                      { step:'3. Гигиена рук', detail:'<b>Полное мытьё 30 сек:</b> ладони → тыльная сторона → между пальцами → кончики пальцев → большие пальцы → запястья. Вытрите чистым одноразовым полотенцем. Обработайте антисептиком (спирт 70% или хлоргексидин). Дайте высохнуть. Наденьте перчатки (рекомендовано).' },
                      { step:'4. Освещение и вентиляция', detail:'Хороший свет (видно зону инъекции). Закрытые окна (сквозняк несёт пыль и бактерии). Выключенный вентилятор/кондиционер. Никаких домашних животных в помещении (шерсть = источник бактерий).' },
                    ].map((s: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(99,102,241,0.03)', border:'1px solid rgba(99,102,241,0.08)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#a5b4fc', marginBottom:3 }}>{s.step}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{s.detail}</div>
                      </div>
                    ))}
                  </div>

                  {/* Multi-dose vial safety */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>💊 Безопасность многодозовых флаконов</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:3 }}>📅 Правило 28 дней</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          После первого прокола резиновой пробки многодозовый флакон пригоден <b>не более 28 дней</b> (по стандартам USP &lt;797&gt;). Даже если препарат выглядит нормально — бактерии могли попасть через проколы и размножиться до опасного уровня. <b>Записывайте дату вскрытия маркером на флаконе.</b>
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:3 }}>🧊 Хранение</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Большинство препаратов — сухое тёмное место, 15-25°C.<br/>
                          • Пептиды (HCG, HGH после разведения) — холодильник 2-8°C.<br/>
                          • НЕ замораживать (если не указано производителем). Кристаллы льда разрушают молекулы.<br/>
                          • Всегда проверяйте инструкцию. Условия хранения различаются.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:3 }}>🔍 Проверка перед каждым использованием</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Мутность</b> (у изначально прозрачных растворов) = бактериальный рост.<br/>
                          • <b>Осадок / хлопья</b> (у изначально однородных) = выпадение действующего вещества или контаминация.<br/>
                          • <b>Изменение цвета</b> (потемнение, пожелтение) = окисление / деградация.<br/>
                          • <b>Резиновая пробка</b> с кусочками (фрагментация) = частицы резины попали в раствор.<br/>
                          • <b>ЛЮБОЕ из перечисленного</b> = УТИЛИЗИРУЙТЕ флакон. Не рискуйте.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:3 }}>⚠ Правила прокола пробки</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Всегда обрабатывайте пробку спиртом 70% ПЕРЕД КАЖДЫМ проколом.<br/>
                          • Дайте спирту высохнуть (15-30 сек).<br/>
                          • Прокалывайте в РАЗНЫХ точках пробки (не в одно и то же место).<br/>
                          • Используйте иглу 18-21G (тонкие иглы 25G+ могут вырезать кусочек резины).<br/>
                          • НЕ храните флакон с воткнутой иглой («для удобства») — прямой доступ бактерий.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Antiseptic comparison */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>🧴 Антисептики для инъекций: сравнение</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Средство</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Концентрация</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Время экспозиции</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Спектр</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Примечание</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Спирт этиловый','70%','15-30 сек','Бактерии, вирусы, грибы','⭐ Золотой стандарт. 96% слабее — быстро испаряется.'],
                            ['Хлоргексидин','0.5-2%','30-60 сек','Бактерии (лучше грам+), вирусы','Остаточное действие до 6 ч. Лучше для операций.'],
                            ['Повидон-йод','10%','2-3 мин','Бактерии, вирусы, грибы, споры','Медленный. Окрашивает. Аллергия на йод.'],
                            ['Перекись водорода','3%','1-5 мин','Бактерии, споры (слабо)','НЕ для обработки кожи перед инъекцией. Для ран.'],
                            ['Мирамистин','0.01%','1-2 мин','Широкий спектр + биоплёнки','Можно для аллергиков на спирт. ⚠ Не инактивирует HBV/HCV — для инъекций предпочтителен 70% спирт. Дороже спирта.'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:3, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[1]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[2]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[3]}</td>
                              <td style={{ padding:3, color:'#5eead4' }}>{r[4]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Item sterility */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📦 Стерильность расходных материалов</div>
                    {[
                      { item:'Шприцы и иглы', rule:'Все современные шприцы и иглы — стерильные в заводской упаковке. <b>Вскрывайте непосредственно перед использованием.</b> Не касайтесь иглы, поршня и внутренней части цилиндра. Упаковка с повреждением = не использовать.' },
                      { item:'Спиртовые салфетки', rule:'Индивидуальная упаковка каждой салфетки. После вскрытия используйте сразу. Не храните вскрытые салфетки — спирт испаряется, бактерии проникают.' },
                      { item:'Стерильные салфетки', rule:'Для прижатия после инъекции. Упаковка вскрывается непосредственно перед применением. Не используйте вату (ворсинки!) и туалетную бумагу (нестерильна!).' },
                      { item:'Перчатки', rule:'Нестерильные смотровые — для ЗАЩИТЫ ВАС, не для стерильности процедуры. Если касаетесь иглы — то же самое что без перчаток. Стерильные перчатки — другой уровень, но избыточны для самому себе.' },
                      { item:'Контейнер для утилизации', rule:'Специальный непрокалываемый пластиковый контейнер (оранжевый/жёлтый). Или плотная пластиковая бутылка с крышкой. НЕ выбрасывать иглы в обычный мусор.' },
                    ].map((x: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(168,85,247,0.03)', border:'1px solid rgba(168,85,247,0.06)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#c084fc', marginBottom:2 }}>{x.item}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{x.rule}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ══════ ОШИБКИ И ПРАВИЛА ══════ */}
              {injectionTab === 'errors' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Critical errors */}
                  <div style={{ borderRadius:12, padding:12, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:8 }}>🚫 ТОП-15 критических ошибок при инъекциях</div>
                    {[
                      { err:'1. Повторное использование иглы', cons:'Затупленная игла → микротравмы ткани → воспаление + фиброз. Инфекция.', fix:'Всегда новая игла. Цена иглы 5-10₽, лечение абсцесса — 5000-50000₽.' },
                      { err:'2. Инъекция в одну и ту же зону', cons:'Липодистрофия, фиброз, образование масляных кист. Ткань перестаёт всасывать препарат.', fix:'Ротация минимум 8 зон. Карта ротации выше. Каждая зона — 7 дней отдыха.' },
                      { err:'3. Слишком быстрый вкол/введение', cons:'Разрыв мышечных волокон, гематома, боль. Быстрое введение масла → масляная эмболия (редко).', fix:'Вкол быстро, но введение медленно: 1 мл за 10-15 сек (водный) или 20-30 сек (масляный).' },
                      { err:'4. Пропуск аспирационной пробы', cons:'Попадание в сосуд → масляная эмболия лёгких (кашель, одышка, боль в груди — через 2-5 мин).', fix:'Всегда аспирируйте 2-3 сек. Кровь → извлечь, сменить иглу, новое место.' },
                      { err:'5. Неправильный угол или глубина', cons:'П/к вместо в/м → медленное всасывание + воспаление. В/м слишком глубоко → надкостница.', fix:'Угол строго 90° для в/м. Длина иглы по зоне: ягодица 1.5", бедро 1", дельта 5/8-1".' },
                      { err:'6. Попадание в седалищный нерв', cons:'Мгновенная острая боль → онемение ноги → парез стопы (временный или постоянный).', fix:'Только верхне-наружный квадрант ягодицы. V-метод. При боли — немедленно извлечь.' },
                      { err:'7. Введение холодного масляного раствора', cons:'Кристаллизация в тканях → боль, воспаление, замедленное всасывание, PIP (post-injection pain).', fix:'Согрейте ампулу/шприц в руке 1-2 мин или под тёплой водой (не кипяток!).' },
                      { err:'8. Смешивание несовместимых препаратов', cons:'Выпадение осадка, химическая реакция, эмболия кристаллами. Разные масла-носители могут расслаиваться.', fix:'Не смешивайте в одном шприце без точных данных о совместимости. Разные шприцы, разные зоны.' },
                      { err:'9. Грязные руки / нестерильная техника', cons:'Staphylococcus aureus → абсцесс за 2-5 дней. Требуется хирургическое дренирование.', fix:'Мытьё рук 30 сек с мылом. Спирт 70% на зону инъекции. Новая игла. Не касаться иглы.' },
                      { err:'10. Инъекция при ОРВИ / температуре', cons:'Иммунитет ослаблен → повышенный риск инфекции. Воспалительный ответ усилен.', fix:'Отложите инъекцию на 1-2 дня после нормализации температуры. Исключение: ЗГТ (пропуск некритичен).' },
                      { err:'11. Избыточный объём в одну зону', cons:'>5 мл → разрыв фасции, компартмент-синдром, некроз. >3 мл в дельту → повреждение сустава.', fix:'Ягодица ≤5 мл, бедро ≤3 мл, дельта ≤2 мл. Разделите большую дозу на 2 инъекции в разные зоны.' },
                      { err:'12. Не менять иглу после набора из ампулы', cons:'Игла затупляется о стекло/резину → боль + микротравмы. Резиновая крошка в мышце → гранулёма.', fix:'Всегда: 1 игла для набора (18-21G), 1 новая игла для инъекции (23-25G). 2 иглы на 1 укол.' },
                      { err:'13. Массаж места инъекции (масляные)', cons:'Разрыв масляного депо → неравномерное всасывание + PIP. Микротравма капилляров → гематома.', fix:'Прижать салфеткой на 30-60 сек без смещения. Лёгкое давление, без массажа. Двигайтесь 5-10 мин после.' },
                      { err:'14. Хранение препаратов неправильно', cons:'Свет, тепло, заморозка → деградация. Бактериальный рост в многодозовых флаконах.', fix:'Сухое, тёмное место, t° 15-25°C (если не указано иное). Многодозовые — не >28 дней после вскрытия.' },
                      { err:'15. Игнорирование признаков инфекции', cons:'Покраснение + отёк + боль + тепло = абсцесс. Без лечения → сепсис, некроз, госпитализация.', fix:'Признаки инфекции → НЕМЕДЛЕННО к врачу. Не пытайтесь «переждать». Антибиотики на ранней стадии.' },
                    ].map((e: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#fca5a5', marginBottom:3 }}>{e.err}</div>
                        <div style={{ fontSize:8, color:'#fbbf24', marginBottom:3, lineHeight:1.3 }}>❌ Последствия: {e.cons}</div>
                        <div style={{ fontSize:8, color:'#4ade80', lineHeight:1.3 }}>✅ Как избежать: {e.fix}</div>
                      </div>
                    ))}
                  </div>

                  {/* Golden rules */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>⭐ Золотые правила безопасности инъекций</div>
                    {[
                      '1 игла = 1 прокол. Никаких исключений. Цена новой иглы — копейки.',
                      'Всегда аспирационная проба. 2-3 секунды спасают от масляной эмболии.',
                      'Ротация зон — не рекомендация, а ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ. Минимум 8 зон в цикле ротации.',
                      'Спирт 70% (не 96% — слабее антисептика). Дать высохнуть 15-30 сек.',
                      'Медленное введение: масляные растворы — 1 мл за 20-30 сек, водные — 1 мл за 10-15 сек.',
                      'После инъекции — сухая стерильная салфетка на 30-60 сек, без массажа.',
                      'При малейших признаках инфекции (боль, краснота, отёк, тепло) — врач, не затягивать.',
                      'Многодозовые флаконы: не использовать >28 дней после вскрытия. Хранить в холодильнике.',
                      'Не смешивать препараты в одном шприце без 100% уверенности в совместимости.',
                      'Не колоть при ОРВИ, температуре, в состоянии алкогольного опьянения.',
                      'Контейнер для острых предметов. Не выбрасывать иглы в обычное мусорное ведро.',
                      'Масляные растворы перед инъекцией — согреть в руке 1-2 минуты.',
                    ].map((r: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)', fontSize:8, color:'var(--text-light)', lineHeight:1.4 }}>
                        <span style={{ color:'#fbbf24', fontWeight:700, marginRight:4 }}>◆</span> {r}
                      </div>
                    ))}
                  </div>

                  {/* Emergency signs */}
                  <div style={{ borderRadius:12, padding:12, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🚨 Экстренные признаки: когда НЕМЕДЛЕННО к врачу</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {[
                        { s:'Одышка / кашель через 2-5 мин после инъекции', why:'Масляная эмболия лёгких' },
                        { s:'Онемение / паралич конечности', why:'Повреждение нерва (седалищный, бедренный)' },
                        { s:'Краснота + отёк + боль + температура >38°C', why:'Абсцесс / целлюлит / сепсис' },
                        { s:'Гнойное отделяемое из места укола', why:'Инфекция, требуется дренирование' },
                        { s:'Анафилаксия: сыпь, отёк лица, затруднение дыхания', why:'Аллергия на препарат / масло-носитель' },
                        { s:'Боль в груди + тахикардия', why:'Масляная эмболия / инфаркт' },
                        { s:'Острая боль по ходу вены + покраснение', why:'Флебит / тромбофлебит' },
                        { s:'Головная боль + рвота + светобоязнь', why:'Асептический менингит (редко)' },
                      ].map((x: any, i: any) =>(
                        <div key={i} style={{ width:'100%', padding:'6px 8px', borderRadius:6, marginBottom:3, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', fontSize:8 }}>
                          <div style={{ color:'#fca5a5', fontWeight:700 }}>⚠ {x.s}</div>
                          <div style={{ color:'var(--text-dim)', marginTop:2 }}>Возможная причина: {x.why}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ ИГЛЫ И ШПРИЦЫ ══════ */}
              {injectionTab === 'needles' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Needle table */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#14b8a6', marginBottom:6 }}>📏 Таблица игл: Gauge × Длина × Назначение</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Gauge (G)</th>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Цвет</th>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Диаметр</th>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Длина</th>
                            <th style={{ padding:4, color:'var(--text-dim)', textAlign:'left' }}>Назначение</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['18G','Розовый','1.2 мм','1.5" (40 мм)','Набор масляных растворов из ампул/флаконов. Быстрый набор.'],
                            ['19-20G','Кремовый/Жёлтый','1.0-0.9 мм','1-1.5"','Фильтр-иглы (blunt fill) для набора из ампул. Защита от стекла.'],
                            ['21G','Зелёный','0.8 мм','1.5" (40 мм)','В/м инъекции (ягодица). Масляные р-ры. Быстрый ввод.'],
                            ['22G','Серый','0.7 мм','1.5" (40 мм)','В/м инъекции (ягодица/бедро). Компромисс скорость/комфорт.'],
                            ['23G','Голубой','0.6 мм','1" / 1.25"','⭐ Стандарт в/м (дельты, бедро, ягодица). Минимум дискомфорта.'],
                            ['25G','Оранжевый','0.5 мм','5/8" / 1"','Дельты, п/к инъекции. Тонкая. Водные р-ры и пептиды.'],
                            ['27G','Серый','0.4 мм','1/2"','П/к инъекции (HCG, HGH, инсулин). Минимальная травма.'],
                            ['29G','Коричневый','0.33 мм','1/2"','Инсулиновые шприцы. Безболезненно.'],
                            ['30-31G','Бесцветный','0.3-0.25 мм','5/16" (8 мм)','Инсулиновые шприцы ultra-fine. П/к без ощущений.'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:4, color:'var(--text-light)', fontWeight:700 }}>{r[0]}</td>
                              <td style={{ padding:4, color:'var(--text-dim)' }}>{r[1]}</td>
                              <td style={{ padding:4, color:'var(--text-dim)' }}>{r[2]}</td>
                              <td style={{ padding:4, color:'var(--text-dim)' }}>{r[3]}</td>
                              <td style={{ padding:4, color:'#5eead4' }}>{r[4]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Syringe types */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>💉 Типы шприцев: как выбрать</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Тип</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Объём</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Крепление</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Мёртвый объём</th>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Для чего</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['2-секционный','2 / 3 / 5 / 10 мл','Luer-Lock (резьба)','0.05-0.1 мл','В/м инъекции. Игла НЕ интегрирована. Стандарт.'],
                            ['3-секционный','2 / 3 / 5 / 10 мл','Luer-Lock (резьба)','0.02-0.05 мл','В/м инъекции. Резиновый поршень плотнее. Меньше мёртвый объём.'],
                            ['Luer-Slip','2 / 3 / 5 мл','Luer-Slip (трение)','0.05-0.1 мл','Проще надеть иглу. Риск соскока при высоком давлении (масло). Лучше Luer-Lock.'],
                            ['Инсулиновый','0.3 / 0.5 / 1 мл','Интегрированная игла','0 (нет мёртвого)','Пептиды, HCG, HGH, инсулин. Шкала в единицах (U-100). Игла несъёмная.'],
                            ['Туберкулиновый','1 мл','Luer-Slip / Luer-Lock','0.02-0.05 мл','Малые дозы (≤1 мл). Тонкая шкала (0.01 мл). Можно менять иглу.'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:3, color:'var(--text-light)', fontWeight:700 }}>{r[0]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[1]}</td>
                              <td style={{ padding:3, color:'#c084fc' }}>{r[2]}</td>
                              <td style={{ padding:3, color:r[3].includes('0')?'#4ade80':'#fbbf24' }}>{r[3]}</td>
                              <td style={{ padding:3, color:'var(--text-dim)' }}>{r[4]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dead space */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>⚙️ Мёртвый объём (dead space): почему это важно</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>📐 Что такое мёртвый объём?</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Объём препарата, который остаётся в игле и конусе шприца после полного нажатия поршня. Стандартно 0.05-0.1 мл. При 2 инъекциях в неделю × 20 недель курса это <b>2-4 мл потерянного препарата</b> (до $50-100 потерянной стоимости).
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>💡 Как снизить потери</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Метод воздушной пробки (air-lock):</b> после набора препарата наберите 0.1-0.2 мл воздуха. При инъекции воздух выталкивает препарат из иглы в мышцу. Безопасно (малые объёмы воздуха в мышце рассасываются).<br/>
                          • <b>Инсулиновые шприцы:</b> нулевой мёртвый объём (игла интегрирована). Для малых доз (≤1 мл).<br/>
                          • <b>Шприцы low-dead-space:</b> специальная конструкция поршня. Снижают потери до 0.01 мл.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Volume limits */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>💧 Предельные объёмы по зонам</div>
                    {[
                      { zone:'Ягодица (дорсальная)', maxVol:'5 мл', needle:'21-23G × 1.5"', note:'Крупнейшая мышца. Масляные и водные.' },
                      { zone:'Ягодица (вентральная)', maxVol:'4 мл', needle:'21-23G × 1.5"', note:'Меньше риск нерва. Предпочтительная зона.' },
                      { zone:'Бедро (латеральное)', maxVol:'3 мл', needle:'23-25G × 1"', note:'Не &gt;3 мл — риск компартмент-синдрома.' },
                      { zone:'Дельта', maxVol:'2 мл', needle:'25-27G × 5/8-1"', note:'Маленькая мышца. &gt;2 мл — боль и риск сустава.' },
                      { zone:'Широчайшая', maxVol:'2 мл', needle:'25-27G × 5/8"', note:'Опытные. Риск пневмоторакса.' },
                      { zone:'Грудные (локальные)', maxVol:'1.5 мл', needle:'25-27G × 5/8"', note:'Только водные. Высокий риск гематом.' },
                      { zone:'Трицепс (локальная)', maxVol:'1.5 мл', needle:'25-27G × 5/8"', note:'Водные + лёгкие масляные.' },
                      { zone:'Бицепс/Трапеции/Икры', maxVol:'1 мл', needle:'27-29G × 1/2"', note:'Только водные! Экстремальный риск.' },
                    ].map((z: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#fca5a5' }}>{z.zone}</span>
                          <span style={{ fontSize:9, fontWeight:800, color:'#fbbf24' }}>≤ {z.maxVol}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>Игла: {z.needle} · {z.note}</div>
                      </div>
                    ))}
                  </div>

                  {/* Needle selection guide */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>🎯 Выбор иглы: правила толщины и длины</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>📐 Длина — глубина залегания мышцы</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Худощавые (жир &lt;10%) → 1" (25 мм) для ягодицы, 5/8" (16 мм) для дельты<br/>
                          • Среднее телосложение → 1.25-1.5" (30-40 мм) для ягодицы, 1" для бедра/дельты<br/>
                          • Полные (жир &gt;20%) → 1.5" (40 мм) для ягодицы, 1.25" для бедра<br/>
                          • Правило: 1/3 иглы снаружи для экстренного извлечения
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#60a5fa', marginBottom:2 }}>📏 Толщина (Gauge) — вязкость раствора</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Меньше G = толще игла = быстрее введение = больше травма<br/>
                          • Масляные → 21-23G · Водные → 23-25G · Пептиды/HCG/HGH → 27-31G<br/>
                          • 23G — золотая середина для большинства ААС
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>🔧 Практические правила</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • 18G для набора → сменить на 23G для инъекции<br/>
                          • Фильтр-игла (blunt fill) для ампул — задерживает осколки стекла<br/>
                          • Никогда не колоть иглой после набора (затуплена!)<br/>
                          • Luer-Lock надёжнее Luer-Slip для масляных растворов<br/>
                          • Инсулиновые шприцы для малых доз пептидов (нет мёртвого объёма)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Post-injection care */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>🩹 Уход после инъекции</div>
                    {[
                      { action:'Прижать салфеткой', detail:'Сухая стерильная салфетка. 30-60 сек без смещения. НЕ тереть, НЕ массировать (масляные). Остановить капиллярное кровотечение.' },
                      { action:'Двигаться 5-10 мин', detail:'Лёгкая ходьба или движение конечностью. Улучшает кровоток и распределение препарата. Снижает PIP.' },
                      { action:'Тёплый компресс (при боли)', detail:'Если боль через 2-4 ч — тёплый (не горячий!) компресс 15 мин. Ускоряет всасывание. НЕ при подозрении на инфекцию!' },
                      { action:'Холод (при гематоме)', detail:'Лёд через ткань на 10-15 мин в первые 2 ч. Сужает сосуды → меньше синяк.' },
                      { action:'Гепариновая мазь', detail:'При уплотнениях без инфекции. Микроциркуляция. 2-3 р/день тонким слоем.' },
                      { action:'НПВС местно', detail:'Диклофенак / кетопрофен при PIP &gt;24 ч. Не сразу после инъекции (спирт + гель = раздражение).' },
                    ].map((a: any, i: any) =>(
                      <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>{a.action}</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>{a.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ══════ ОСЛОЖНЕНИЯ ══════ */}
              {injectionTab === 'complications' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:4 }}>🩺 Постинъекционные осложнения: распознавание и действия</div>
                    <p style={{ fontSize:8, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Полное руководство по PIP (постинъекционная боль), гематомам, абсцессам, масляной эмболии, повреждению нервов и стерильному воспалению. Знание того, что нормально, а что требует врача — спасает здоровье.</p>
                  </div>

                  {/* PIP */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>🔥 PIP (Post-Injection Pain) — постинъекционная боль</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>📋 Что такое PIP и почему возникает</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Боль, отёк и дискомфорт в месте инъекции через 4-48 часов после укола. <b>Это НОРМАЛЬНАЯ реакция</b> на механическое повреждение ткани + химическое раздражение препаратом. Возникает из-за: кристаллизации масла в холодной мышце, реакции на растворитель (бензиловый спирт, бензилбензоат), объёма инъекции, травмы иглой, индивидуальной чувствительности к эфиру/носителю.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fbbf24', marginBottom:2 }}>🟢 PIP vs 🟡 Начинающийся абсцесс vs 🔴 Абсцесс</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          <b>🟢 PIP (норма):</b> Боль тянущая/ноющая, появляется через 4-24 ч, максимум на 2-3 день, проходит к 5-7 дню. Кожа не горячая, нет системной температуры. Зона может быть чуть уплотнена.<br/>
                          <b>🟡 Начинающийся абсцесс (внимание!):</b> Боль нарастает, а не убывает, после 3 дня. Кожа КРАСНАЯ и ГОРЯЧАЯ на ощупь в сравнении с соседней зоной.<br/>
                          <b>🔴 Абсцесс (срочно к врачу!):</b> Температура тела &gt;38°C, озноб. Зона Горячая, красная, отёк увеличивается. Может определяться флюктуация (зыбление) при пальпации. Требуется разрез и дренирование.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>🟢 Лечение PIP (домашнее)</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Тёплый компресс 15 мин × 3 р/день. Расширяет сосуды, ускоряет всасывание.<br/>
                          • НПВС (ибупрофен 400-600 мг) внутрь — снижает воспаление и боль.<br/>
                          • Диклофенак-гель 1-2% местно 2-3 р/день.<br/>
                          • Лёгкое движение (ходьба, растяжка) — улучшает кровоток.<br/>
                          • НЕ массировать (масляные) — разрыв депо.<br/>
                          • НЕ греть горячим (ванна, сауна) — риск распространения инфекции если она есть.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hematoma */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6366f1', marginBottom:6 }}>🩸 Гематома (синяк) в месте инъекции</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#a5b4fc', marginBottom:2 }}>📋 Причины</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Повреждение капилляра/мелкого сосуда иглой. Чаще при: использовании толстых игл, нарушении свёртываемости, приёме антикоагулянтов/аспирина/рыбьего жира, тонкой коже, варикозе, неправильной технике.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#a5b4fc', marginBottom:2 }}>🩹 Лечение</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Первые 2 часа:</b> ХОЛОД (лёд через ткань) 10-15 мин. Сужает сосуды → меньше объём гематомы.<br/>
                          • <b>После 24 часов:</b> ТЕПЛО (тёплый компресс). Расширяет сосуды → ускоряет рассасывание.<br/>
                          • Гепариновая мазь / Троксевазин 2-3 р/день — ускоряет рассасывание синяка.<br/>
                          • Синяк проходит за 7-14 дней. Меняет цвет: синий → зелёный → жёлтый → исчезает.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Abscess */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🔴 Абсцесс: стадии, распознавание, действия</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🦠 Как развивается абсцесс</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Бактерии (чаще Staphylococcus aureus со своей кожи) попадают в мышцу через прокол → начинают размножаться → иммунная система формирует гнойную полость (абсцесс). Инкубационный период: 2-7 дней после инъекции.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🔍 4 стадии распознавания</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          <b>Стадия 1 (1-2 день):</b> Лёгкое покраснение, незначительное повышение температуры кожи. От PIP отличается НАРАСТАНИЕМ симптомов.<br/>
                          <b>Стадия 2 (2-4 день):</b> Яркое покраснение, зона ГОРЯЧАЯ, болезненность усиливается. Отёк. Может быть субфебрильная температура (37.2-37.8).<br/>
                          <b>Стадия 3 (4-7 день):</b> Сильная боль пульсирующего характера. Кожа багрово-красная. Температура &gt;38°C, озноб. Зона отёка плотная. Может определяться флюктуация (зыбление гноя под кожей).<br/>
                          <b>Стадия 4 (&gt;7 дней):</b> Самопроизвольное вскрытие с выделением гноя (если повезло) или распространение: флегмона (разлитое гнойное воспаление) → сепсис (заражение крови). ОПАСНО ДЛЯ ЖИЗНИ.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>✅ Что делать</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Стадия 1:</b> Наблюдение. Возможно саморазрешение. Тёплые компрессы. При нарастании — к врачу.<br/>
                          • <b>Стадия 2+:</b> НЕМЕДЛЕННО к хирургу. Антибиотики (внутрь или в/м). Возможно, потребуется разрез и дренирование.<br/>
                          • <b>НИКОГДА:</b> не пытайтесь выдавить абсцесс самостоятельно (разрыв капсулы внутрь → распространение инфекции).<br/>
                          • <b>НИКОГДА:</b> не грейте на стадии 2+ (ускоряет размножение бактерий).<br/>
                          • Лечение абсцесса: разрез → удаление гноя → дренаж → перевязки → антибиотики. Заживление: 2-4 недели.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Oil embolism */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🫁 Масляная эмболия лёгких (МЭЛА)</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>📋 Что это и почему опасно</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          Попадание масляного раствора в кровеносный сосуд → масло доходит до лёгочных капилляров → закупорка → нарушение газообмена. <b>Редкое (1:5000 — 1:10000 инъекций), но ПОТЕНЦИАЛЬНО СМЕРТЕЛЬНОЕ</b> осложнение. Чаще при самостоятельных инъекциях без аспирации.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🚨 Симптомы (появляются через 2-10 мин после инъекции)</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Внезапный кашель</b> (сухой, навязчивый, неконтролируемый)<br/>
                          • <b>Одышка / затруднение дыхания</b><br/>
                          • <b>Боль в груди</b> (острая, давящая)<br/>
                          • <b>Тахикардия</b> (пульс &gt;100)<br/>
                          • <b>Чувство страха / паники</b><br/>
                          • При тяжёлой эмболии: цианоз (синеют губы), потеря сознания.
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>✅ Действия при подозрении на МЭЛА</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>НЕМЕДЛЕННО вызывайте скорую (112/103).</b><br/>
                          • Положение: сидя или полусидя (облегчает дыхание).<br/>
                          • Расстегните одежду. Обеспечьте доступ воздуха.<br/>
                          • Кислород через маску (если есть).<br/>
                          • Сообщите врачу: какой препарат, какой объём, когда была инъекция.<br/>
                          • Лёгкие случаи разрешаются самостоятельно через 30-60 мин (кашель + одышка проходят). Тяжёлые требуют госпитализации.<br/>
                          • <b>Профилактика:</b> ВСЕГДА аспирационная проба. Медленное введение. Правильный угол.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nerve injury */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:6 }}>⚡ Повреждение нерва</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(249,115,22,0.04)', border:'1px solid rgba(249,115,22,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fdba74', marginBottom:2 }}>📋 Причины и признаки</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • <b>Прямая травма иглой:</b> МГНОВЕННАЯ острая боль («прострел») по ходу нерва. Онемение, покалывание в зоне иннервации.<br/>
                          • <b>Химическое повреждение:</b> препарат введён РЯДОМ с нервом → воспаление → сдавление нерва. Симптомы появляются через часы/дни.<br/>
                          • <b>Самые частые зоны повреждения:</b> седалищный нерв (ягодица), бедренный нерв (передняя поверхность бедра), лучевой нерв (средняя треть плеча).
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(249,115,22,0.04)', border:'1px solid rgba(249,115,22,0.1)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#fdba74', marginBottom:2 }}>🚨 Симптомы, требующие врача</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • Онемение конечности (не проходит через 30 мин)<br/>
                          • Слабость / парез («стопа шлёпает», «рука не поднимается»)<br/>
                          • Жгучая боль по ходу нерва<br/>
                          • Потеря чувствительности в зоне иннервации<br/>
                          • <b>Большинство нейропатий ВРЕМЕННЫЕ</b> (проходят за 2-6 недель). Постоянное повреждение — редкость (прямая инъекция в нерв).
                        </div>
                      </div>
                      <div style={{ padding:'8px 10px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', fontSize:8 }}>
                        <div style={{ fontWeight:700, color:'#4ade80', marginBottom:2 }}>✅ Действия</div>
                        <div style={{ color:'var(--text-dim)', lineHeight:1.4 }}>
                          • При «простреле» во время вкола — немедленно извлеките иглу (не вводите препарат!).<br/>
                          • Консультация невролога. Возможно: ЭМГ (электромиография) для оценки проводимости.<br/>
                          • Витамины группы B (B1, B6, B12) — поддержка регенерации нерва.<br/>
                          • Физиотерапия (после острой фазы).<br/>
                          • Время восстановления: от 2 недель (лёгкое) до 6 месяцев (тяжёлое).
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sterile inflammation vs infection */}
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🔬 Стерильное воспаление vs Инфекция: дифференциальная диагностика</div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:8, borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            <th style={{ padding:3, color:'var(--text-dim)', textAlign:'left' }}>Признак</th>
                            <th style={{ padding:3, color:'#22c55e', textAlign:'left' }}>Стерильное воспаление (PIP)</th>
                            <th style={{ padding:3, color:'#ef4444', textAlign:'left' }}>Инфекция (абсцесс)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Начало','Через 4-24 ч','Через 24-72 ч'],
                            ['Динамика','Пик на 2-3 день, затем ↓','Нарастает с каждым днём'],
                            ['Покраснение','Лёгкое или отсутствует','Яркое, распространяется'],
                            ['Температура кожи','Чуть теплее (локально)','ГОРЯЧАЯ (значительно теплее)'],
                            ['Температура тела','Нормальная (&lt;37.2)','&gt;38°C, озноб'],
                            ['Боль','Тянущая, ноющая','Пульсирующая, острая'],
                            ['Отёк','Умеренный, мягкий','Плотный, нарастающий'],
                            ['Флюктуация','Нет','Есть (зыбление гноя)'],
                            ['Анализ крови','Норма','Лейкоцитоз, ↑ СОЭ, ↑ CRP'],
                            ['Лечение','НПВС + тёплые компрессы','Разрез + дренаж + антибиотики'],
                          ].map((r: any, i: any) =>(
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding:3, color:'var(--text-light)', fontWeight:600 }}>{r[0]}</td>
                              <td style={{ padding:3, color:'#86efac' }}>{r[1]}</td>
                              <td style={{ padding:3, color:'#fca5a5' }}>{r[2]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning banner (always visible) */}
              <div style={{ borderRadius:12, padding:12, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠️ Критические предупреждения</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                  • <b style={{color:'#ef4444'}}>Никогда не используйте одну иглу дважды.</b> Затупленная игла = микротравмы + инфекция.<br/>
                  • <b style={{color:'#ef4444'}}>Всегда аспирационная проба.</b> Попадание масла в сосуд = масляная эмболия лёгких (угроза жизни).<br/>
                  • <b style={{color:'#ef4444'}}>При онемении / острой боли во время вкола — немедленно извлеките иглу.</b> Вы попали в нерв.<br/>
                  • <b style={{color:'#ef4444'}}>Спирт ТОЛЬКО 70%.</b> 96% спирт — слабее антисептик (быстро испаряется, не успевает убить бактерии).<br/>
                  • Ротация зон — не опция, а ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ безопасности. Минимум 8 зон в цикле.<br/>
                  • Медленное введение масляных растворов: 1 мл = 20-30 сек. Быстрое = боль + риск осложнений.<br/>
                  • Не грейте масляный раствор выше температуры тела (разрушение эфиров, потеря стерильности).<br/>
                  • Храните препараты в тёмном, сухом месте при 15-25°C. Многодозовые флаконы — не &gt;28 дней после вскрытия.<br/>
                  • При малейших признаках инфекции (покраснение, отёк, боль, тепло) — НЕМЕДЛЕННО к врачу.<br/>
                  • Утилизируйте иглы ТОЛЬКО в непрокалываемый контейнер. Не в обычное мусорное ведро.<br/>
                  • Не занимайтесь самолечением осложнений. Абсцесс требует хирургического вмешательства, а не «народных средств».
                </div>
              </div>
            </div>
          {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Эритропоэтин + ААС = риск тромбоза (Hct {'>'}50%). Контроль Hct каждые 2 нед. Флеботомия при Hct {'>'}54%<br/>
                • 🫁 <b>Печень:</b> Метформин + 17α-алкилы = риск лактат-ацидоза (редиайшие, но при нарушении функции печени). Контроль АЛТ/АСТ<br/>
                • 💧 <b>Почки:</b> Растворение тромбов — аспирин + гидратация. Риск ОПП при дегидратации + НПВС<br/>
                • 🦴 <b>Суставы:</b> Витамин C + коллаген — синергия. Витамин C улучшает абсорбцию негемового железа (осторожно при гемохроматозе)
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ ГЕМАТОЛОГИЯ ══════════ */}
          {protocolTab === 'hemato' && (<InfoErrorBoundary label="Гематология">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:2 }}>🩸 Гематологическая поддержка на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Контроль полицитемии, коагуляции и анемии. Профилактика тромбозов при высоком Hct.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                  { id:'diary', label:'📓 Дневник' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setHematoTab(t.id)}
                    style={hematoTab === t.id ? pillActive('#ef4444') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {hematoTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы: почему кровь требует контроля на курсе</div>
                  {[
                    { m:'Эритроцитоз (Hct ↑)', e:'ААС стимулируют ЭПО-независимый эритропоэз (через ↑ HIF-1α + ↑ чувствительность предшественников к ЭПО). Hct растёт на 5-10% в первые 4-6 нед.', a:'Флеботомия при Hct {'>'}54%. Аспирин — только при ≥2 факторах тромбориска (Hct >50%, курение, возраст >40, ожирение, тромбоанамнез)' },
                    { m:'Тромбоцитоз (PLT ↑)', e:'Андрогены ↑ TPO (тромбопоэтин) → ↑ продукция тромбоцитов на 20-40%', a:'Контроль числа тромбоцитов при Hct {'>'}50%' },
                    { m:'Гиперкоагуляция (факторы свёртывания)', e:'ААС ↑ факторы II, VII, X, ↓ антитромбин III, ↑ ингибитор активатора плазминогена PAI-1', a:'D-димер, фибриноген, АЧТВ. Аспирин — после оценки соотношения риск/польза' },
                    { m:'Вязкость крови (гемореология)', e:'Hct ↑ + фибриноген ↑ + ↓ деформируемость эритроцитов = ↑ вязкости в 1.5-2× относительно нормы', a:'Гидратация 3+ л/день. Пентоксифиллин при симптомах' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#fca5a5', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:2 }}>{x.e}</div>
                      <div style={{ fontSize:7, color:'#fca5a5', padding:'3px 5px', borderRadius:4, background:'rgba(239,68,68,0.06)' }}>🩺 Действие: {x.a}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {hematoTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'Базовый курс (Hct {'<'}48%)', color:'#22c55e', condition:'Hct {'<'}48%, PLT в норме', desc:'Профилактика гиперкоагуляции на любом курсе ААС',
                      items:[
                        { name:'Аспирин кардио 100 мг', dose:'100 мг', timing:'Утро после еды', note:'Антиагрегант. ТОЛЬКО при ≥2 факторах тромбориска (Hct >50%, курение, возраст >40, ожирение, тромбоанамнез). Снижает риск тромбоза на 30-40%. Обязательно + ИПП' },
                        { name:'Гидратация', dose:'3+ л/день', timing:'Равномерно', note:'Снижение вязкости крови. Особенно важно при высоких дозах ААС и летом' },
                        { name:'Омега-3 (EPA+DHA)', dose:'2-4 г/день', timing:'С едой', note:'↓ вязкости, ↓ фибриногена, ↑ NO. Двойная кардио+гемато защита' },
                        { name:'Рыбий жир', dose:'EPA 1000 мг', timing:'С едой', note:'Дополнительный источник омега-3 при недостатке в пище' },
                      ]},
                    { phase:'ФАЗА 2 · РАННЯЯ КОРРЕКЦИЯ', label:'Hct 48-52%', color:'#f59e0b', condition:'Hct 48-52%, без симптомов', desc:'Усиление антикоагуляции',
                      items:[
                        { name:'Аспирин кардио 100 мг', dose:'100 мг', timing:'Утро после еды', note:'Продолжить. Обязательно с ИПП (омепразол 20 мг) для защиты ЖКТ' },
                        { name:'Пентоксифиллин 400 мг', dose:'400 мг', timing:'2×/день с едой', note:'Улучшает деформируемость эритроцитов, ↓ вязкость. Курс 4-6 нед' },
                        { name:'NAC 600-1200 мг', dose:'600 мг', timing:'2×/день', note:'Антиоксидант ↓ вязкости через ↑ глутатиона в эритроцитах. Защита от окислительного стресса' },
                        { name:'Плазмаферез (опционально)', dose:'—', timing:'По показаниям', note:'При Hct {'>'}54% или симптомах гипервязкости. 1-2 сеанса до нормализации' },
                      ]},
                    { phase:'ФАЗА 3 · ТЕРАПИЯ', label:'Hct 52-54%', color:'#f97316', condition:'Hct 52-54% или симптомы', desc:'Медицинское вмешательство. Флеботомия при необходимости',
                      items:[
                        { name:'Флеботомия (кровопускание)', dose:'300-400 мл', timing:'1-2 раза/нед', note:'До Hct {'<'}48%. Восполнение жидкости — физраствор или вода 1 л после процедуры' },
                        { name:'Аспирин 100 мг', dose:'100 мг', timing:'Утро', note:'Обязательно + ИПП. При высоком риске тромбоза — рассмотреть клопидогрель' },
                        { name:'Дипиридамол 75 мг', dose:'75 мг', timing:'3×/день', note:'Антиагрегант + вазодилататор. Улучшает микроциркуляцию' },
                        { name:'Гидратация', dose:'4+ л/день', timing:'Равномерно', note:'Принудительная гидратация для ↓ гематокрита' },
                      ]},
                    { phase:'ФАЗА 4 · УРГЕНТНАЯ', label:'Hct {'>'}54% / Hct {'>'}60%', color:'#ef4444', condition:'Hct {'>'}54% и/или симптомы гипервязкости', desc:'Неотложное вмешательство',
                      items:[
                        { name:'Флеботомия', dose:'400-500 мл', timing:'Ежедневно до Hct {'<'}48%', note:'Под контролем АД и пульса' },
                        { name:'Низкомол. гепарин (НМГ) 💊', dose:'По весу', timing:'П/к 1-2×/день', note:'Эноксапарин 40 мг 1×/день при D-димер {'>'}500. Переход на варфарин при тромбозе. По назначению врача' },
                        { name:'Консультация гематолога', dose:'—', timing:'Срочно', note:'Экстренная при симптомах ТЭЛА/ТГВ. Не откладывать' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Timing */}
              {hematoTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг гематологической поддержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Основной принцип: антиагреганты утром, гидратация в течение дня, контроль вечером.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Аспирин 100 мг + ИПП', why:'После еды. Защита ЖКТ + антиагрегантный эффект на весь день' },
                      { n:'Омега-3 2-4 г с едой', why:'С завтраком. EPA/DHA снижают вязкость, ↑ NO' },
                      { n:'Вода 500 мл', why:'После пробуждения. Компенсация ночной дегидратации' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Пентоксифиллин 400 мг (если фаза 2+)', why:'С обедом. Улучшение реологии эритроцитов' },
                      { n:'Гидратация 1-1.5 л', why:'Равномерно. Особенно при физ. нагрузке + дополнительно 500-1000 мл' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'NAC 600-1200 мг', why:'Антиоксидант. Лучше вс }}}}}}}}}}}}вечером перед сном для детоксикации' },
                      { n:'Вода 500 мл', why:'Умеренная гидратация. Не перед сном' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Monitoring */}
              {hematoTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг крови</div>
                    {[{ marker:'Гематокрит (Hct)', target:'42-50%', when:'Каждые 2-4 нед', action:'50-52% — фаза 2. 52-54% — фаза 3. {'>'}54% — фаза 4 (ургентная). {'>'}60% — риск спонтанного тромбоза' },
                      { marker:'Гемоглобин (Hb)', target:'13.5-17.5 г/дл', when:'Каждые 2-4 нед', action:'Hb {'>'}17.5 — коррелирует с Hct. Hb {'<'}12.5 — возможна анемия при длительных курсах' },
                      { marker:'Тромбоциты (PLT)', target:'150-350 ×10⁹/л', when:'Каждые 4 нед', action:'PLT {'>'}400 — риск тромбоза. Рассмотреть аспирин 100 мг' },
                      { marker:'D-димер', target:'{'<'}500 нг/мл', when:'При симптомах', action:'{'>'}500 — активный тромбоз/фибринолиз. УЗИ вен + консультация гематолога' },
                      { marker:'Фибриноген', target:'2-4 г/л', when:'Каждые 8 нед', action:'{'>'}4.5 — гиперкоагуляция. Коррекция гидратацией + омега-3' },
                      { marker:'АЧТВ / ПВ / МНО', target:'АЧТВ 25-35 с, МНО 0.8-1.2', when:'При терапии антикоагулянтами', action:'МНО {'>'}1.5 — риск кровотечения при НМГ/варфарине' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#fca5a5' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#ef4444' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#fca5a5'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#fca5a5', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(239,68,68,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diary */}
              {hematoTab === 'diary' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>📓 Дневник гематологических симптомов</div>
                  {[{ s:'Головная боль (пульсирующая)', hint:'Маркёр гипервязкости. Проверить Hct + АД. Флеботомия при Hct {'>'}54%' },
                    { s:'Покраснение лица/кожи', hint:'Плетора. При Hct {'>'}50%. Гидратация + аспирин' },
                    { s:'Звон в ушах (тиннитус)', hint:'Нарушение микроциркуляции. Пентоксифиллин. Проверить АД' },
                    { s:'Одышка при нагрузке', hint:'Снижение кислородной ёмкости. Проверить Hct {'>'}52%' },
                    { s:'Гематомы без причины', hint:'Избыток антикоагуляции. МНО >1.5 при аспирине. Проверить свёртываемость' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(239,68,68,0.03)', border:'1px solid rgba(239,68,68,0.08)' }}>
                      <span style={{ fontSize:9, color:'var(--text-light)' }}>{x.s}</span>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>💡 {x.hint}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Hct {'>'}50% + ААС = риск тромбоза. Аспирин — после оценки тромбориска (≥2 факторов). Флеботомия при {'>'}54%<br/>
                • 🫁 <b>Печень:</b> Hct {'>'}50% + 17α-алкилы = риск веноокклюзионной болезни печени (редиайше)<br/>
                • ⚖️ <b>Метаболизм:</b> Hct ↑ → нагрузка на миокард. Контроль липидов (ААС ↓ ЛПВП)
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ МЕТАБОЛИЗМ ══════════ */}
          {protocolTab === 'metabolic' && (<InfoErrorBoundary label="Метаболизм">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#a855f7', marginBottom:2 }}>⚖️ Метаболическая поддержка</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Контроль дислипидемии, инсулинорезистентности, электролитных нарушений. ААС-индуцированные метаболические изменения.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setMetabolicTab(t.id)}
                    style={metabolicTab === t.id ? pillActive('#a855f7') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {metabolicTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Метаболические механизмы ААС</div>
                  {[{ m:'Дислипидемия', e:'ААС снижают ЛПВП на 20-50% (особенно оральные 17α-алкилы), повышают ЛПНП на 10-20%, ↑ ЛП(а). Основной драйвер атеросклероза на курсе' },
                    { m:'Инсулинорезистентность', e:'ААС ↓ чувствительность тканей к инсулину (особенно оксандролон, метандростенолон). ↑ риск СД 2 типа при длительных курсах' },
                    { m:'Электролитные нарушения', e:'Задержка Na⁺ (ароматизируемые ААС → эстрадиол → ↑ альдостерон), потеря K⁺, Mg²⁺. Риск гипокалиемии и аритмий' },
                    { m:'Липогенез и ожирение', e:'ААС ↑ липолиз в жировой ткани (через β-адренорецепторы), но ↓ чувствительность к инсулину в жировой ткани → ↑ свободных жирных кислот' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#d8b4fe', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {metabolicTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'Липиды + глюкоза — норма', color:'#22c55e', condition:'ЛПНП {'<'}130, ЛПВП {'>'}40, глюкоза {'<'}5.6', desc:'Поддержка метаболического здоровья на курсе',
                      items:[
                        { name:'Омега-3 (EPA+DHA)', dose:'2-4 г/день', timing:'С едой', note:'↓ ЛПНП, ↓ триглицеридов, ↑ ЛПВП. Базовая метаболическая поддержка' },
                        { name:'Берберин 500 мг', dose:'500 мг', timing:'2×/день до еды', note:'Активатор AMPK → ↓ инсулинорезистентности, ↓ глюкозы, ↓ липидов' },
                        { name:'Магний (цитрат/глицинат)', dose:'400-600 мг', timing:'Вечер', note:'↓ АД, ↓ риск аритмий, улучшение чувствительности к инсулину' },
                        { name:'Калий (калия цитрат)', dose:'500-1000 мг', timing:'С едой', note:'Восполнение потерь K⁺. Контроль K⁺ при терапии спиронолактоном/эплереноном' },
                      ]},
                    { phase:'ФАЗА 2 · КОРРЕКЦИЯ ДИСЛИПИДЕМИИ', label:'ЛПНП 130-160 / ЛПВП {'<'}35', color:'#f59e0b', condition:'ЛПНП 130-160, ЛПВП {'<'}35', desc:'Целенаправленная коррекция липидного профиля',
                      items:[
                        { name:'Эзетимиб 10 мг', dose:'10 мг', timing:'Утро', note:'Ингибитор всасывания холестерина в тонком кишечнике. ↓ ЛПНП на 15-20%. Не влияет на ЛПВП' },
                        { name:'Красный рис (монаколин K) 10 мг', dose:'10 мг', timing:'Вечер', note:'Ингибитор HMG-CoA редуктазы (природный статин). ↓ ЛПНП на 20-30%. Контроль АЛТ/АСТ' },
                        { name:'Берберин 500 мг', dose:'500 мг', timing:'2×/день', note:'↓ ЛПНП ещё на 15-20% дополнительно к эзетимибу' },
                      ]},
                    { phase:'ФАЗА 3 · КОРРЕКЦИЯ ИР/ГЛЮКОЗЫ', label:'Глюкоза 5.6-7.0 / HOMA-IR {'>'}2.5', color:'#f97316', condition:'Глюкоза {'>'}5.6 или HOMA-IR {'>'}2.5', desc:'Снижение инсулинорезистентности (особенно на оксандролоне/метандростенолоне)',
                      items:[
                        { name:'Метформин 500-1000 мг', dose:'500 мг', timing:'2×/день с едой', note:'Снижает продукцию глюкозы печенью. ↑ чувствительность к инсулину. ↓ риска СД 2 типа' },
                        { name:'Берберин 500 мг', dose:'500 мг', timing:'2×/день', note:'Синергия с метформином через AMPK. ↓ гликированного гемоглобина на 0.5-1%' },
                        { name:'Хром (пиколинат)', dose:'200-400 мкг', timing:'Утро', note:'Усиливает действие инсулина. ↓ тягу к углеводам' },
                        { name:'Магний 400 мг', dose:'400 мг', timing:'Вечер', note:'Дефицит Mg²⁺ — независимый фактор ИР. Восполнение улучшает гликемию' },
                      ]},
                    { phase:'ФАЗА 4 · КОРРЕКЦИЯ ЭЛЕКТРОЛИТОВ', label:'K⁺/Mg²⁺ низкие / отёки', color:'#ef4444', condition:'K⁺ {'<'}3.5 / Mg²⁺ {'<'}0.75 / отёки 2+', desc:'Восстановление водно-электролитного баланса',
                      items:[
                        { name:'Калия цитрат 500-1500 мг', dose:'500-1500 мг', timing:'2-3×/день с едой', note:'Целевой K⁺ 4.0-5.0. Контроль K⁺ каждые 1-2 нед при терапии' },
                        { name:'Магния цитрат 400-600 мг', dose:'400-600 мг', timing:'Вечер', note:'Целевой Mg²⁺ {'>'}0.85. Магний ↓ риск аритмий' },
                        { name:'Калий + магний (аспарагинат)', dose:'1-2 таб', timing:'2×/день', note:'Комбинированный препарат. Лучшая биодоступность' },
                        { name:'Верошпирон (спиронолактон) 25-50 мг', dose:'25-50 мг', timing:'Утро', note:'Антагонист альдостерона. Снижает задержку Na⁺/H₂O. Сохраняет K⁺. Контроль K⁺!' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Timing */}
              {metabolicTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг метаболической поддержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Антигипертензивные утром, метформин с едой, вечером — восстановление электролитов.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Эзетимиб 10 мг (фаза 2)', why:'Утром. Ингибитор всасывания холестерина' },
                      { n:'Хром 200-400 мкг', why:'Утром натощак. Усиление действия инсулина' },
                      { n:'Омега-3 2-4 г', why:'С завтраком. Липидная поддержка' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Метформин 500 мг с обедом', why:'С едой. Снижение постпрандиальной глюкозы' },
                      { n:'Берберин 500 мг до обеда', why:'За 30 мин до еды. AMPK-активация. ↓ глюкозы на 20-30%' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Метформин 500 мг с ужином', why:'С едой. Вторая доза' },
                      { n:'Магний 400-600 мг', why:'Вечером. Расслабление, ↓ АД, антиаритмический. L-треонат/глицинат — предпочтительные формы' },
                      { n:'Калия цитрат 500-1000 мг', why:'С ужином. Восполнение потерь K⁺' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Monitoring */}
              {metabolicTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг метаболизма</div>
                    {[{ marker:'Липидный профиль (ЛПНП, ЛПВП, ТГ, ЛП(а))', target:'ЛПНП {'<'}130', when:'Каждые 4-8 нед', action:'ЛПНП {'>'}160 — фаза 2. ТГ {'>'}2.3 — рассмотреть фенофибрат' },
                      { marker:'Глюкоза + HOMA-IR', target:'Глюкоза {'<'}5.6', when:'Каждые 4 нед', action:'{'>'}5.6 — фаза 3. HOMA-IR {'>'}2.5 — метформин' },
                      { marker:'Калий (K⁺)', target:'3.5-5.0 ммоль/л', when:'Каждые 2-4 нед', action:'{'<'}3.5 — калий. {'>'}5.5 — риск гиперкалиемии при верошпироне/эплереноне' },
                      { marker:'Магний (Mg²⁺)', target:'{'>'}0.85 ммоль/л', when:'Каждые 4-8 нед', action:'{'<'}0.75 — фаза 4. Mg риск аритмий' },
                      { marker:'Мочевая кислота', target:'{'<'}420 мкмоль/л', when:'Каждые 8 нед', action:'{'>'}420 — риск подагры. Аллопуринол/фебуксостат' },
                      { marker:'HbA1c (гликированный)', target:'{'<'}6.0%', when:'Каждые 12 нед', action:'{'>'}6.5% — СД 2 типа. Эндокринолог' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#d8b4fe' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#a855f7' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#d8b4fe'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#d8b4fe', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(168,85,247,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Эзетимиб + статины = синергия ↓ ЛПНП. Статины увеличивают риск СД — контроль глюкозы<br/>
                • 🫁 <b>Печень:</b> Метформин + 17α-алкилы = риск лактат-ацидоза (очень редко, исключить при АЛТ {'>'}3×). Берберин — безопасная альтернатива<br/>
                • 💧 <b>Почки:</b> Метформин отменить при СКФ {'<'}30. Снизить при {'<'}45<br/>
                • 🩸 <b>Гематология:</b> Метформин {'>'}2 г/день → риск дефицита B12. Контроль B12 каждые 6-12 мес
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ ЖКТ ══════════ */}
          {protocolTab === 'gi' && (<InfoErrorBoundary label="ЖКТ">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#a3e635', marginBottom:2 }}>🫀 ЖКТ — защита слизистой и микробиома</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Профилактика гастропатии, дисбактериоза и синдрома дырявого кишечника на курсе ААС.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setGiTab(t.id)}
                    style={giTab === t.id ? pillActive('#a3e635') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {giTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы поражения ЖКТ на ААС</div>
                  {[{ m:'Гастропатия от НПВС', e:'НПВС (диклофенак, ибупрофен) ингибируют ЦОГ-1 → ↓ простагландинов → ↓ защитной слизи → язва/эрозии' },
                    { m:'Нарушение микробиома', e:'Оральные ААС (метандростенолон, станозолол) → дисбактериоз → ↓ diversity → ↑ проницаемость кишечника' },
                    { m:'Холестаз / застой желчи', e:'17α-алкилы → ↓ секреции желчи → ↓ эмульгации жиров → стеаторея → дефицит жирорастворимых витаминов' },
                    { m:'Синдром дырявого кишечника (leaky gut)', e:'ААС → ↑ зонулина → ↑ проницаемость → ЛПС → системное воспаление → цитокиновый шторм' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(163,230,53,0.04)', border:'1px solid rgba(163,230,53,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#bef264', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {giTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'Нет симптомов', color:'#22c55e', condition:'Нет диспепсии, стул нормальный', desc:'Поддержка ЖКТ на курсе',
                      items:[
                        { name:'Пробиотики (Lacto+Bifido+пребиотик)', dose:'1 капс', timing:'Утро натощак', note:'Поддержка diversity микробиома. Не менее 10⁹ КОЕ. 8+ штаммов' },
                        { name:'Цинк-карнозин', dose:'75 мг', timing:'2×/день за 20-30 мин до еды', note:'Защита слизистой желудка. Фиксация на язвах. Принимать ДО еды (не между)' },
                        { name:'DGL (деглицирризированный лакричник)', dose:'1-2 таб', timing:'До еды', note:'Увеличивает защитную слизь желудка. Без глицирризина (↓ АД)' },
                      ]},
                    { phase:'ФАЗА 2 · ДИСПЕПСИЯ', label:'Тяжесть, изжога, вздутие', color:'#f59e0b', condition:'Эпизодическая изжога, тяжесть', desc:'Симптоматическая терапия',
                      items:[
                        { name:'ИПП (омепразол 20 мг / пантопразол 40 мг)', dose:'20-40 мг', timing:'Утро за 30 мин до еды', note:'Блокада протонной помпы. Курс 4-8 нед. ⚠ >8 нед — контроль B12, Mg²⁺, Fe сыворотки (риск дефицитов)' },
                        { name:'Алгедрат+Магния гидроксид (Маалокс)', dose:'1-2 таб', timing:'После еды и на ночь', note:'Антацид. Быстрое снятие изжоги. НЕ одновременно с ИПП — интервал 2 ч' },
                        { name:'Урсодезоксихолевая кислота (УДХК) 500 мг', dose:'500 мг', timing:'На ночь', note:'При холестазе (оральные ААС). Защита гепатоцитов + ↓ стеатореи' },
                      ]},
                    { phase:'ФАЗА 3 · ДИСБАКТЕРИОЗ', label:'Диарея/запор / вздутие ≥2 нед', color:'#f97316', condition:'Диарея/запор, метеоризм', desc:'Коррекция микробиома',
                      items:[
                        { name:'Пробиотики (усиленная формула)', dose:'2 капс', timing:'Утро натощак + вечер', note:'20+ штаммов, 10⁹ КОЕ. Saccharomyces boulardii для профилактики диареи' },
                        { name:'Бутират (масляная кислота)', dose:'300-600 мг', timing:'2×/день с едой', note:'Пища для колоноцитов. Восстановление барьерной функции кишечника' },
                        { name:'Энтеросгель / Полисорб', dose:'1 ст.л.', timing:'За 1-2 ч до еды', note:'Сорбент. При диарее — 3-5 дней. НЕ вместе с едой/лекарствами' },
                        { name:'Глютамин 5-10 г', dose:'5 г', timing:'2×/день между едой', note:'Аминокислота для энтероцитов. Восстанавливает tight junctions → ↓ leaky gut' },
                      ]},
                    { phase:'ФАЗА 4 · ЛЕЧЕБНАЯ (синдром Мэлори-Вейса / язва)', label:'Кровь/мелена / сильная боль', color:'#ef4444', condition:'Мелена, рвота кофейной гущей', desc:'Неотложная. Исключить алкоголь, НПВС, оральные 17α-алкилы до заживления',
                      items:[
                        { name:'ИПП в/в (омепрозол 40 мг)', dose:'40-80 мг', timing:'В/в болюс', note:'Неотложно. Только в стационаре под контролем ФГДС' },
                        { name:'ФГДС с гемостазом', dose:'—', timing:'Срочно', note:'Эндоскопический гемостаз (клипирование/коагуляция). При активном кровотечении' },
                        { name:'Суктральфат (алсукрал)', dose:'1 г', timing:'За 30 мин до еды', note:'Гастропротектор. Образует плёнку на язве. НЕ одновременно с едой/препаратами' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Timing */}
              {giTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг поддержки ЖКТ</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Пробиотики утром натощак, ИПП за 30 мин до завтрака, вечером — сорбенты отдельно.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'ИПП (омепразол 20 мг)', why:'За 30-60 мин до завтрака. Макс. ингибирование протонной помпы на целый день' },
                      { n:'Пробиотики 1-2 капс', why:'Натощак. Без контакта с едой — лучшая выживаемость бактерий' },
                      { n:'Цинк-карнозин 75 мг', why:'За 20-30 мин до еды. Защитная плёнка на слизистой' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Бутират 300 мг с обедом', why:'С едой. Масляная кислота для колоноцитов' },
                      { n:'DGL 1-2 таб до еды', why:'Защитная слизь. Безопасен при длительном приёме' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'УДХК 500 мг на ночь', why:'Натощак перед сном. Макс. холеретический эффект' },
                      { n:'Глютамин 5-10 г', why:'Между едой. Восстановление энтероцитов' },
                      { n:'Сорбенты (при диарее)', why:'За 1-2 ч до/после еды. Отдельно от лекарств' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Monitoring */}
              {giTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг ЖКТ</div>
                    {[{ marker:'ФГДС (гастроскопия)', target:'Норма', when:'До курса + при симптомах', action:'Эрозии/язва — фаза 4. Helicobacter pylori — эрадикация' },
                      { marker:'Кальпротектин фекальный', target:'{'<'}50 мкг/г', when:'При подозрении на ВЗК', action:'{'>'}50 — воспаление кишечника. Колоноскопия' },
                      { marker:'Зонулин фекальный', target:'{'<'}50 нг/мг', when:'При leaky gut', action:'{'>'}50 — повышенная проницаемость. Глютамин + бутират' },
                      { marker:'Витамин B12', target:'200-900 пг/мл', when:'Ежегодно при длительном ИПП', action:'ИПП {'>'}6 мес → контроль B12. При дефиците — метилкобаламин' },
                      { marker:'Магний (Mg²⁺)', target:'0.85-1.2 ммоль/л', when:'Ежегодно при длительном ИПП', action:'ИПП {'>'}1 год → риск гипомагниемии. Магния цитрат' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(163,230,53,0.04)', border:'1px solid rgba(163,230,53,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#bef264' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#a3e635' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#bef264'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#bef264', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(163,230,53,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> ИПП + клопидогрель = ↓ эффекта клопидогреля (CYP2C19). Рассмотреть пантопразол вместо омепразола<br/>
                • 🫁 <b>Печень:</b> УДХК + 17α-алкилы = синергия. УДХК снижает холестаз от токсичных метаболитов<br/>
                • 💧 <b>Почки:</b> ИПП {'>'}3 года → риск ХБП. Контроль креатинина каждые 6-12 мес<br/>
                • 🩸 <b>Гематология:</b> Пробиотики + иммуносупрессия = риск бактериемии (редко). Не для пациентов с ЦВК
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ КОЖА/ВОЛОСЫ ══════════ */}
          {protocolTab === 'hair' && (<InfoErrorBoundary label="Кожа/Волосы">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#f472b6', marginBottom:2 }}>💇 Защита кожи и волос на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Профилактика андрогенетической алопеции, акне, стрий, ухудшения качества кожи.</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setHairTab(t.id)}
                    style={hairTab === t.id ? pillActive('#f472b6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {/* Mechanisms */}
              {hairTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы поражения кожи/волос на ААС</div>
                  {[{ m:'DHT → миниатюризация фолликулов', e:'DHT (5α-дигидротестостерон) — основной андроген кожи. Связывается с AR в фолликулах → миниатюризация → андрогенетическая алопеция' },
                    { m:'Себум → акне', e:'Андрогены стимулируют сальные железы → гиперсекреция себума → закупорка пор → C. acnes → воспаление → акне' },
                    { m:'Коллаген → стрии', e:'ААС ↑ mTOR → гипертрофия мышц быстрее, чем адаптация коллагена. Перерастяжение дермы → стрии (растяжки)' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Protocol phases */}
              {hairTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'Нет симптомов', color:'#22c55e', condition:'Нет выпадения, нет акне', desc:'Базовая поддержка кожи/волос на курсе',
                      items:[
                        { name:'Цинк (пиколинат)', dose:'30-50 мг', timing:'Вечер', note:'Ингибирует 5α-редуктазу → ↓ DHT в коже. Противовоспалительное' },
                        { name:'Витамин D3', dose:'2000-5000 МЕ', timing:'С жирной едой', note:'Участвует в цикле волосяного фолликула. Дефицит D3 — выпадение' },
                        { name:'Биотин (B7)', dose:'5000-10000 мкг', timing:'Утро', note:'Синтез кератина. Укрепление волос и ногтей' },
                        { name:'Коллаген (гидролизованный)', dose:'10-15 г', timing:'С витамином C', note:'Субстрат для синтеза коллагена кожи. Профилактика стрий' },
                      ]},
                    { phase:'ФАЗА 2 · ВЫПАДЕНИЕ ВОЛОС', label:'{'>'}100 волос/день', color:'#f59e0b', condition:'Заметное выпадение', desc:'Анти-DHT и рост-стимулирующая терапия',
                      items:[
                        { name:'Финастерид 0.5-1 мг (только при АГА)', dose:'0.5-1 мг', timing:'Утро', note:'Ингибитор 5α-редуктазы 2 типа. ↓ DHT в коже на 60-70%. Эффект через 3-6 мес' },
                        { name:'Дутастерид 0.5 мг (резистентность к финастериду)', dose:'0.5 мг', timing:'Утро', note:'Ингибитор 5α-редуктазы 1+2 типа. ↓ DHT на 90%. Сильнее, но больше побочек' },
                        { name:'Миноксидил 5% топический', dose:'1 мл', timing:'2×/день', note:'Вазодилататор фолликулов. Продлевает фазу анагена. Эффект через 4-6 мес' },
                        { name:'Кетоконазол 2% шампунь', dose:'Как шампунь', timing:'2-3×/нед', note:'Слабая антиандрогенная активность. Противогрибковое. ↓ шелушения' },
                      ]},
                    { phase:'ФАЗА 3 · АКНЕ (AAS-ИНДУЦИРОВАННОЕ)', label:'Папулы/пустулы', color:'#f97316', condition:'Акне на спине/плечах/лице', desc:'См. отдельный протокол Акне',
                      items:[
                        { name:'Салициловая кислота 2% скраб', dose:'1-2×/день', timing:'Утро', note:'Кератолитик. Открывает поры. Использовать на спину/плечи' },
                        { name:'Бензоил пероксид 5% гель', dose:'Локально', timing:'Вечер', note:'Уничтожает C. acnes. Не вызывает резистентности' },
                        { name:'Цинк (пиколинат) 50 мг', dose:'50 мг', timing:'Вечер', note:'Ингибирует 5α-редуктазу. Антивоспалительный. Продолжить из фазы 1' },
                      ]},
                    { phase:'ФАЗА 4 · СТРИИ (РАСТЯЖКИ)', label:'Появляющиеся стрии', color:'#ef4444', condition:'Стрии на груди/плечах/бёдрах', desc:'Профилактика и лечение стрий',
                      items:[
                        { name:'Третиноин 0.05% крем', dose:'Тонкий слой', timing:'На ночь локально', note:'Ретиноид. Стимулирует синтез коллагена. Фотосенсибилизация — SPF 50+' },
                        { name:'Гиалуроновая кислота + витамин C сыворотка', dose:'Несколько капель', timing:'Утро', note:'Гидратация + антиоксидант + стимуляция коллагена' },
                        { name:'Микронидлинг (дермапен)', dose:'0.5-1 мм', timing:'1×/2-4 нед', note:'Стимуляция неоколлагенеза. Только в кабинете косметолога' },
                        { name:'Масло ши + витамин E', dose:'Массаж', timing:'Вечер', note:'Увлажнение и питание рубцовой ткани' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Timing */}
              {hairTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг поддержки кожи/волос</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Утром — анти-DHT и витамины. Вечером — топические средства.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Финастерид/дутастерид (если назначен)', why:'Один раз в день. ↓ DHT на 60-90%' },
                      { n:'Биотин 5000-10000 мкг', why:'Синтез кератина. С завтраком' },
                      { n:'Миноксидил 5% топический', why:'На сухую кожу головы. Массаж 2-3 мин' },
                      { n:'Сыворотка с гиалуроновой кислотой + C', why:'На лицо/шею. Увлажнение + коллаген' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'D3 2000-5000 МЕ с обедом', why:'С жирной едой. Цикл волосяного фолликула' },
                      { n:'Коллаген 10-15 г', why:'С витамином C (апельсиновый сок). Синтез коллагена' },
                      { n:'Коллагенарий/скраб с салициловой к-той (спина)', why:'При акне на спине. После душа' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Цинк 30-50 мг', why:'На ночь. Ингибитор 5α-редуктазы' },
                      { n:'Третиноин 0.05% крем (локально)', why:'На стрии/акне. SPF на утро обязательно!' },
                      { n:'Масло ши + витамин E', why:'Массаж зон стрий. Увлажнение ' },
                      { n:'Миноксидил 5% топический', why:'На сухую кожу головы. Второй приём' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Monitoring */}
              {hairTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Мониторинг кожи/волос</div>
                    {[{ marker:'Фототрихограмма', target:'Анаген {'>'}80%', when:'Каждые 6 мес', action:'Анаген {'<'}80% — прогрессия алопеции. Рассмотреть финастерид/дутастерид' },
                      { marker:'DHT (сывороточный)', target:'{'<'}250 пг/мл', when:'Через 3 мес терапии финастеридом', action:'{'>'}250 — резистентность к финастериду. Перейти на дутастерид' },
                      { marker:'Цинк в сыворотке', target:'0.75-1.5 мкг/мл', when:'Каждые 12 нед', action:'{'<'}0.75 — дефицит цинка. Увеличить дозу до 50 мг' },
                      { marker:'Ферритин', target:'{'>'}70 нг/мл', when:'Каждые 12 нед', action:'{'<'}70 — дефицит железа. Ассоциирован с выпадением' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#f472b6' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#f9a8d4'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#f9a8d4', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(244,114,182,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cross-protocol warnings */}
            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Финастерид/дутастерид снижают DHT на 60-90% → возможна гипотензия. Контроль АД первые 2 нед<br/>
                • 🫁 <b>Печень:</b> Финастерид метаболизируется в печени. Контроль АЛТ/АСТ при длительном приёме {'>'}1 года<br/>
                • 🔴 <b>Акне:</b> См. отдельный протокол акне. Комплексная терапия — топики + системные антибиотики + БПО
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ ТИРЕОИДНЫЙ ══════════ */}
          {protocolTab === 'thyroid' && (<InfoErrorBoundary label="Тиреоидный">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ec4899', marginBottom:2 }}>🦋 Тиреоидная поддержка на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Контроль функции щитовидной железы: T3, T4, ТТГ. ААС могут подавлять ось HPTA и влиять на метаболизм тиреоидных гормонов.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setThyroidTab(t.id)}
                    style={thyroidTab === t.id ? pillActive('#ec4899') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {thyroidTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы влияния ААС на щитовидную железу</div>
                  {[{ m:'Снижение ТТГ', e:'Экзогенные андрогены подавляют гипоталамо-гипофизарную ось → ↓ ТТГ → ↓ T4 → ↓ T3. Аналогично центральному гипотиреозу' },
                    { m:'Конверсия T4→T3', e:'ААС модулируют дейодиназу D1/D2: ↑ активность → относительный избыток T3 на фоне низкого T4' },
                    { m:'Транспорт (TBG)', e:'Андрогены снижают тироксин-связывающий глобулин (TBG) в печени → ↓ общего T4/T3 при нормальном свободном' },
                    { m:'Прямая токсичность', e:'Высокие дозы ААС (особенно тренболон) могут вызывать тиреоидит → ↑ обратного T3 (rT3) → тканевой гипотиреоз' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {thyroidTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'ТТГ/Т3/Т4 в норме', color:'#22c55e', condition:'ТТГ 0.5-2.5, T4 св 10-22, T3 св 3.5-6.5', desc:'Мониторинг + нутритивная поддержка',
                      items:[
                        { name:'Селен (L-селенометионин)', dose:'200 мкг', timing:'Утро с едой', note:'Кофактор дейодиназ (↓ rT3, ↑ активность конверсии T4→T3). Снижает риск тиреоидита' },
                        { name:'Цинк (пиколинат)', dose:'30 мг', timing:'Вечер', note:'Кофактор синтеза ТТГ. Дефицит цинка → ↓ ТТГ и T3' },
                        { name:'Йод (калия йодид)', dose:'150 мкг', timing:'Утро', note:'Субстрат для синтеза T4/T3. Только при отсутствии аутоиммунного тиреоидита' },
                        { name:'L-тирозин', dose:'500 мг', timing:'Утро натощак', note:'Аминокислота-предшественник тиреоидных гормонов' },
                      ]},
                    { phase:'ФАЗА 2 · СУБКЛИНИЧЕСКИЙ ГИПОТИРЕОЗ', label:'ТТГ 2.5-4.5 / T4 низкий', color:'#f59e0b', condition:'ТТГ {'>'}2.5, T4 св {'<'}10', desc:'Мягкая коррекция',
                      items:[
                        { name:'L-T4 (левотироксин) 25-50 мкг 💊', dose:'25-50 мкг', timing:'Утро натощак за 30-60 мин до еды', note:'Старт с 25 мкг. Титрация каждые 4-6 нед по ТТГ. Цель ТТГ 0.5-2.0' },
                        { name:'Селен 200 мкг', dose:'200 мкг', timing:'Утро', note:'Продолжить. Оптимизация конверсии T4→T3' },
                        { name:'Ашваганда (Withania)', dose:'300-600 мг', timing:'2×/день', note:'Адаптоген. Повышает ТТГ, T4 и T3 у субклинического гипотиреоза. Курс 8-12 нед' },
                      ]},
                    { phase:'ФАЗА 3 · МАНИФЕСТНЫЙ ГИПОТИРЕОЗ', label:'ТТГ {'>'}4.5 / T4 низкий', color:'#f97316', condition:'ТТГ {'>'}4.5, T4 св {'<'}9, симптомы', desc:'Заместительная терапия',
                      items:[
                        { name:'L-T4 (левотироксин) 50-100 мкг 💊', dose:'50-100 мкг', timing:'Утро натощак', note:'Доза по весу: 1.6 мкг/кг. Титрация каждые 4-6 нед' },
                        { name:'L-T4 + L-T3 (комбинированная терапия) 💊', dose:'T4 50-75 мкг + T3 5-10 мкг', timing:'T4 утром, T3 дробно', note:'При недостаточном ответе на моно-T4. Контроль T3 св. Не превышать T3 {'>'}15 мкг/сут' },
                        { name:'Исключить дефицит Fe, Se, Zn', dose:'По анализам', timing:'Коррекция до нормализации', note:'Дефицит железа → ↓ активности ТПО. Ферритин {'>'}70, Se {'>'}1.2 мкмоль/л' },
                      ]},
                    { phase:'ФАЗА 4 · ТИРЕОТОКСИКОЗ / ГИПЕРТИРЕОЗ', label:'ТТГ {'<'}0.1 / T3/T4 высокий', color:'#ef4444', condition:'ТТГ {'<'}0.1, T3 св {'>'}6.5, пульс {'>'}100', desc:'Неотложно. Исключить тиреоидит/тиреотоксикоз от ААС',
                      items:[
                        { name:'β-блокатор (пропранолол 20-40 мг)', dose:'20-40 мг', timing:'2-3×/день', note:'Контроль пульса {'<'}90. Симптоматическая терапия до нормализации T3' },
                        { name:'Тионамиды (тиамазол 5-20 мг) 💊', dose:'5-20 мг', timing:'1-2×/день', note:'Ингибитор синтеза T3/T4. Только по назначению эндокринолога' },
                        { name:'Отмена тиреоидных препаратов', dose:'—', timing:'Немедленно', note:'Отменить L-T4. Контроль T3/T4/ТТГ каждые 3-5 дней' },
                        { name:'Консультация эндокринолога', dose:'—', timing:'Срочно', note:'При тиреотоксикозе — госпитализация при пульсе {'>'}120, аритмии' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {thyroidTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг тиреоидной поддержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Левотироксин строго натощак за 30-60 мин до еды. Селен и цинк — в разное время суток.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'L-T4 25-100 мкг (если назначен)', why:'Натощак за 30-60 мин до еды. Не запивать кальцием/железом — интервал 4 ч' },
                      { n:'L-тирозин 500 мг', why:'Натощак. Предшественник тиреоидных гормонов' },
                      { n:'Селен 200 мкг', why:'С завтраком. Кофактор дейодиназ' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Ашваганда 300-600 мг', why:'С обедом. Адаптоген, ↑ ТТГ при субклиническом гипотиреозе' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Цинк 30 мг', why:'На ночь. Кофактор синтеза ТТГ' },
                      { n:'Избегать кальция/железа в течение 4 ч после L-T4', why:'Снижают всасывание левотироксина на 20-40%' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {thyroidTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг щитовидной железы</div>
                    {[{ marker:'ТТГ', target:'0.5-2.5 мМЕ/л', when:'Каждые 4-6 нед при терапии', action:'{'<'}0.1 — тиреотоксикоз. {'>'}4.5 — манифестный гипотиреоз. Цель на терапии 0.5-2.0' },
                      { marker:'T4 свободный', target:'10-22 пмоль/л', when:'Каждые 4-6 нед', action:'{'<'}10 — гипотиреоз. {'>'}22 — гипертиреоз/передозировка L-T4' },
                      { marker:'T3 свободный', target:'3.5-6.5 пмоль/л', when:'Каждые 4-6 нед', action:'T3 {'>'}6.5 + ТТГ {'<'}0.1 — тиреотоксикоз. T3 {'<'}3.0 + rT3 ↑ — тканевой гипотиреоз' },
                      { marker:'Анти-ТПО / Анти-ТГ', target:'{'<'}30 МЕ/мл / {'<'}40 МЕ/мл', when:'1 раз до курса', action:'{'>'}нормы — аутоиммунный тиреоидит. Исключить избыток йода. Контроль ТТГ каждые 8 нед' },
                      { marker:'Ферритин', target:'{'>'}70 нг/мл', when:'Каждые 12 нед', action:'{'<'}70 — дефицит железа → ↓ активности ТПО → ↓ синтеза T4' },
                      { marker:'Селен в сыворотке', target:'1.2-2.0 мкмоль/л', when:'Каждые 12 нед', action:'{'<'}1.0 — дефицит → ↓ конверсии T4→T3. Коррекция 200 мкг/день' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#ec4899' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#f9a8d4'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#f9a8d4', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(236,72,153,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> L-T4 повышает потребность миокарда в O₂. Контроль пульса. При тиреотоксикозе — β-блокаторы<br/>
                • ⚖️ <b>Метаболизм:</b> Тиреоидные гормоны ↑ метаболизм → ↓ веса, ↑ теплопродукции. Контроль калорийности питания<br/>
                • 🧠 <b>Нейро:</b> Гипотиреоз → депрессия, ↓ когниции. Тиреотоксикоз → тревога, тремор, инсомния<br/>
                • 🩸 <b>Гематология:</b> L-T4 ↑ антикоагулянтный эффект варфарина. МНО контроль при комбинации
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ ИММУНИТЕТ ══════════ */}
          {protocolTab === 'immune' && (<InfoErrorBoundary label="Иммунитет">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#6366f1', marginBottom:2 }}>🛡️ Иммунная поддержка на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Укрепление иммунитета, профилактика инфекций на фоне иммуносупрессии от высоких доз ААС, коррекция микробиома и L-глутаминового статуса.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setImmuneTab(t.id)}
                    style={immuneTab === t.id ? pillActive('#6366f1') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {immuneTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы иммуносупрессии на ААС</div>
                  {[{ m:'↓ IgA/IgG', e:'Андрогены подавляют продукцию иммуноглобулинов B-клетками. Снижение IgA в слизистых → ↑ риск респираторных инфекций' },
                    { m:'↓ NK-клеток', e:'Тестостерон ↓ активность и число натуральных киллеров (NK). Противоопухолевый и антивирусный иммунитет снижен' },
                    { m:'↓ Т-клеточного ответа', e:'ААС ↑ IL-10 (противовоспалительный) и ↓ IL-2, IFN-γ → ↓ цитотоксических T-лимфоцитов' },
                    { m:'↑ Окислительный стресс', e:'Высокий метаболизм на курсе → ↑ активных форм кислорода → ↓ функции нейтрофилов и макрофагов' },
                    { m:'Дисбиоз кишечника', e:'Оральные 17α-алкилы нарушают микробиом → ↓ diversity → ↑ проницаемость → системное воспаление' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#a5b4fc', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {immuneTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · БАЗОВАЯ', label:'Профилактика', color:'#22c55e', condition:'Нет симптомов, инфекции {'<'}2/год', desc:'Базовая иммуноподдержка на любом курсе',
                      items:[
                        { name:'Витамин D3', dose:'2000-5000 МЕ', timing:'С жирной едой', note:'Модулятор врождённого и адаптивного иммунитета. ↓ риск респираторных инфекций на 40-70%' },
                        { name:'Цинк (пиколинат)', dose:'30-50 мг', timing:'Вечер', note:'Кофактор тимулина. Дефицит → атрофия тимуса → ↓ T-клеток' },
                        { name:'Витамин C (аскорбат натрия)', dose:'1-2 г', timing:'2×/день', note:'Антиоксидант. ↑ хемотаксис нейтрофилов. ↓ длительности простуд на 8-14%' },
                        { name:'Пробиотики (Lacto+Bifido)', dose:'1 капс', timing:'Утро натощак', note:'Поддержка иммунитета через микробиом. 8+ штаммов, 10⁹ КОЕ' },
                      ]},
                    { phase:'ФАЗА 2 · УСИЛЕННАЯ', label:'Частые инфекции', color:'#f59e0b', condition:'Инфекции {'>'}2/год / вялое заживление', desc:'Целенаправленная иммуномодуляция',
                      items:[
                        { name:'Бета-глюканы (грибные 1,3/1,6)', dose:'250-500 мг', timing:'Утро натощак', note:'Активация макрофагов и NK-клеток через дектин-1. ↑ IgA в слюне' },
                        { name:'Кверцетин', dose:'500 мг', timing:'2×/день', note:'Ингибитор TLR4/NF-kB. ↑ Nrf2. Противовоспалительный + антиоксидантный' },
                        { name:'Лактоферрин', dose:'200-300 мг', timing:'Утро натощак', note:'Хелатор Fe → бактериостатический эффект. ↑ NK-активности' },
                        { name:'Эхинацея пурпурная (Echinacea)', dose:'300-500 мг', timing:'2×/день', note:'↑ фагоцитоз макрофагов. Курс 8-12 нед с перерывом 1 нед' },
                      ]},
                    { phase:'ФАЗА 3 · ТЕРАПЕВТИЧЕСКАЯ', label:'Острая инфекция + курс', color:'#f97316', condition:'ОРВИ/ангина на курсе', desc:'Иммунотерапия + симптоматическая поддержка',
                      items:[
                        { name:'NAC 600 мг', dose:'600 мг', timing:'3×/день на 5-7 дней', note:'Муколитик + антиоксидант. ↓ репликации вирусов in vitro. Разжижает мокроту' },
                        { name:'Витамин C в/в (аскорбат Na) 10-15 г', dose:'10-15 г', timing:'В/в капельно', note:'При пневмонии/тяжёлой инфекции. Противовирусный + антиоксидантный эффект' },
                        { name:'Андрографис (Andrographis paniculata)', dose:'200-400 мг', timing:'3×/день', note:'Растительный иммуномодулятор. ↓ длительности ОРВИ на 3-5 дней. ↓ IL-6' },
                        { name:'Цинк 50 мг + лозенги с цинком (25 мг)', dose:'75-100 мг/сут', timing:'Каждые 3-4 ч', note:'Лозенги — при боли в горле. ↓ длительности симптомов на 33%' },
                      ]},
                    { phase:'ФАЗА 4 · ПОСТ-ИНФЕКЦИОННАЯ', label:'Восстановление', color:'#ef4444', condition:'После инфекции / затяжной COVID', desc:'Восстановление иммунного ответа и энергии',
                      items:[
                        { name:'Креатин + D-рибоза', dose:'Креатин 5 г + рибоза 5 г', timing:'После тренировки', note:'Восстановление энергетического пула клеток. ↓ утомляемости' },
                        { name:'КоА Q10 (убихинон)', dose:'200-400 мг', timing:'Утро с жирной едой', note:'Митохондриальная поддержка. ↑ энергии. Антиоксидант' },
                        { name:'Адаптогены (родиола/элеутерококк)', dose:'Родиола 200-400 мг', timing:'Утро', note:'Адаптогены. ↑ сопротивляемости стрессу. ↓ усталости' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {immuneTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг иммуноподдержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Пробиотики натощак, витамин D с жирной едой, цинк на ночь. Адаптогены утром.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Пробиотики 1 капс', why:'Натощак. Макс. выживаемость бактерий' },
                      { n:'Бета-глюканы 250-500 мг (фаза 2)', why:'Натощак. Активация макрофагов' },
                      { n:'Витамин C 1-2 г', why:'С завтраком. Антиоксидант + иммуномодулятор' },
                      { n:'Адаптоген (родиола 200-400 мг)', why:'Утром. Энергия + стресс-устойчивость' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Кверцетин 500 мг', why:'С обедом. Ингибитор TLR4/NF-kB' },
                      { n:'Витамин D3 2000-5000 МЕ', why:'С жирной едой. Макс. абсорбция' },
                      { n:'Эхинацея 300-500 мг (фаза 2+)', why:'С едой. ↑ фагоцитоз' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Цинк 30-50 мг', why:'На ночь. Иммуномодулятор + антиоксидант' },
                      { n:'NAC 600 мг (при инфекции)', why:'Вечером. Муколитик + антиоксидант' },
                      { n:'Андрографис 200-400 мг (при инфекции)', why:'С ужином. ↓ IL-6, ↓ длительности ОРВИ' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {immuneTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг иммунитета</div>
                    {[{ marker:'IgA, IgG, IgM', target:'IgA 0.7-4.0, IgG 7-16, IgM 0.4-2.3 г/л', when:'Каждые 12-24 нед', action:'IgA {'<'}0.7 — риск инфекций слизистых. IgG {'<'}7 — гипогаммаглобулинемия' },
                      { marker:'Лейкоциты + лимфоциты', target:'Лейк. 4-9 ×10⁹, лимф. 1.0-4.0', when:'Каждые 4-8 нед', action:'Лимф. {'<'}1.0 — лимфопения на фоне ААС. Поддержка иммунитета' },
                      { marker:'СРБ (CRP высокочувствительный)', target:'{'<'}1 мг/л', when:'Каждые 8-12 нед', action:'СРБ {'>'}3 — системное воспаление. Кверцетин, куркумин, NAC' },
                      { marker:'Витамин D (25-OH)', target:'75-150 нмоль/л', when:'Каждые 12-24 нед', action:'{'<'}50 — дефицит. Коррекция D3 5000-10000 МЕ/день 4-8 нед' },
                      { marker:'Цинк в сыворотке', target:'0.75-1.5 мкг/мл', when:'Каждые 12 нед', action:'{'<'}0.75 — дефицит → ↓ функции тимуса. Цинк 50 мг/день' },
                      { marker:'Ферритин', target:'30-150 нг/мл', when:'Каждые 12 нед', action:'{'<'}30 — дефицит Fe → ↓ T-клеточного ответа. Коррекция железа' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#a5b4fc' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#6366f1' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#a5b4fc'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#a5b4fc', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(99,102,241,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • 🫁 <b>Печень:</b> Высокие дозы витамина D3 — контроль АЛТ/АСТ при жировом гепатозе<br/>
                • 💧 <b>Почки:</b> Эхинацея противопоказана при аутоиммунных заболеваниях (СКВ, ревматоидный артрит)<br/>
                • 🫀 <b>ЖКТ:</b> Пробиотики + иммуносупрессия (кортикостероиды) — редкий риск бактериемии. Не для пациентов с ЦВК<br/>
                • 🧠 <b>Нейро:</b> NAC {'>'}2400 мг/сут → головная боль, тошнота
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ ЭСТРАДИОЛ ══════════ */}
          {protocolTab === 'e2' && (<InfoErrorBoundary label="Эстрадиол">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#f472b6', marginBottom:2 }}>🔬 Контроль эстрадиола на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Поддержание оптимального уровня эстрадиола (E2). Профилактика гинекомастии, контроль ароматизации, управление эстроген-зависимыми побочными эффектами.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setE2Tab(t.id)}
                    style={e2Tab === t.id ? pillActive('#f472b6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {e2Tab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы эстрогенного контроля</div>
                  {[{ m:'Ароматизация андрогенов', e:'Ароматаза (CYP19A1) конвертирует тестостерон в эстрадиол в жировой ткани, печени, молочных железах. Чем выше T → тем выше E2' },
                    { m:'Гинекомастия', e:'Эстрадиол стимулирует пролиферацию протоков молочных желёз через ERα. Риск при E2 {'>'}150 пг/мл у мужчин' },
                    { m:'Задержка жидкости', e:'E2 ↑ альдостерон → ↑ реабсорбции Na⁺ → задержка воды, отёки, ↑ АД' },
                    { m:'Либидо и настроение', e:'E2 необходим для либидо и когнитивной функции. Слишком низкий E2 ({'<'}20) = ↓ либидо, депрессия, упадок энергии' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#f9a8d4', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {e2Tab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ПРОФИЛАКТИКА', label:'E2 в норме', color:'#22c55e', condition:'E2 20-60 пг/мл', desc:'Мониторинг + превентивные меры',
                      items:[
                        { name:'DIM (дииндолилметан)', dose:'200-400 мг', timing:'2×/день', note:'Модулятор метаболизма E2: ↑ 2-OH (антипролиферативный), ↓ 16α-OH (пролиферативный). Профилактика гинекомастии' },
                        { name:'Цинк (пиколинат)', dose:'30-50 мг', timing:'Вечер', note:'Слабая ингибиция ароматазы. Здоровый уровень E2' },
                        { name:'Кальций-D-глюкарат', dose:'1-2 г', timing:'2×/день', note:'Связывает конъюгированные эстрогены в кишечнике → ↓ рециркуляции E2' },
                        { name:'Ингибиторы ароматазы (только при симптомах)', dose:'—', timing:'—', note:'Анастрозол 0.5-1 мг/нед. ТОЛЬКО при E2 {'>'}80 и симптомах. Не для профилактики!' },
                      ]},
                    { phase:'ФАЗА 2 · ПОВЫШЕННЫЙ E2', label:'E2 60-120 пг/мл', color:'#f59e0b', condition:'E2 {'>'}60, лёгкие симптомы', desc:'Коррекция ароматизации',
                      items:[
                        { name:'Анастрозол 0.5-1 мг 💊', dose:'0.5-1 мг', timing:'1-2×/нед', note:'Ингибитор ароматазы. ↓ E2 на 50-80%. Старт с 0.5 мг × 1/нед. Титрация по E2. ⚠ ↓ ЛПВП, ↑ риск атеросклероза' },
                        { name:'Тамоксифен 10-20 мг 💊', dose:'10-20 мг', timing:'Ежедневно', note:'Селективный модулятор ER. Блокирует ERα в груди → профилактика гинекомастии. Не снижает E2 — только блокирует рецепторы' },
                        { name:'DIM 400 мг', dose:'400 мг', timing:'2×/день', note:'Продолжить. ↓ 16α-OH метаболита' },
                        { name:'Контроль E2', dose:'—', timing:'Каждые 2-4 нед', note:'Целевой E2 20-40 пг/мл на терапии. Не снижать {'<'}20!' },
                      ]},
                    { phase:'ФАЗА 3 · ВЫСОКИЙ E2', label:'E2 {'>'}120 пг/мл', color:'#f97316', condition:'E2 {'>'}120, симптомы (отёки, чувствительность груди)', desc:'Активная терапия',
                      items:[
                        { name:'Анастрозол 1 мг', dose:'1 мг', timing:'2×/нед', note:'Увеличение дозы. Контроль E2 через 2 нед. Цель E2 {'<'}60' },
                        { name:'Тамоксифен 20 мг', dose:'20 мг', timing:'Ежедневно', note:'Продолжить. При уже имеющейся sensitive груди' },
                        { name:'Кальций-D-глюкарат 2 г', dose:'2 г', timing:'2×/день', note:'Усиление экскреции эстрогенов через ЖКТ' },
                        { name:'Рассмотреть снижение дозы T', dose:'—', timing:'—', note:'При невозможности контролировать E2 анастрозолом — снизить дозу тестостерона' },
                      ]},
                    { phase:'ФАЗА 4 · НИЗКИЙ E2 (перелечили)', label:'E2 {'<'}20 пг/мл', color:'#ef4444', condition:'E2 {'<'}20, симптомы (суставы, либидо, настроение)', desc:'Восстановление E2',
                      items:[
                        { name:'Отменить/снизить анастрозол', dose:'—', timing:'Немедленно', note:'Снизить дозу АИ вдвое или отменить на 1-2 нед до восстановления E2' },
                        { name:'D-аспарагиновая кислота (DAA)', dose:'3 г', timing:'2×/день', note:'↑ ароматазу → ↑ E2. Мягкое восстановление' },
                        { name:'Хорионический гонадотропин (hCG)', dose:'500 МЕ', timing:'2×/нед', note:'Стимулирует эндогенный тестостерон → ароматизация → ↑ E2' },
                        { name:'Контроль E2', dose:'—', timing:'Каждые 1-2 нед', note:'Целевое восстановление E2 до 20-40 пг/мл. Симптомы проходят при {'>'}20' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {e2Tab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг контроля E2</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Анастрозол 1-2×/нед в одно и то же время. Тамоксифен ежедневно. DIM 2×/день.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'Анастрозол 0.5-1 мг (1-2×/нед)', why:'Фиксированный день (напр. ср/сб). После еды' },
                      { n:'Тамоксифен 10-20 мг', why:'Ежедневно утром. Селективный модулятор ER' },
                      { n:'DIM 200 мг', why:'С завтраком. Метаболизм E2' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Кальций-D-глюкарат 1-2 г', why:'С обедом. Связывание эстрогенов в кишечнике' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'DIM 200 мг (вторая доза)', why:'С ужином. Равномерное подавление 16α-OH' },
                      { n:'Цинк 30-50 мг', why:'На ночь. Слабая ингибиция ароматазы' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {e2Tab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг E2</div>
                    {[{ marker:'Эстрадиол (E2, ECLIA/MS)', target:'20-60 пг/мл (мужчины)', when:'Каждые 2-4 нед при терапии АИ', action:'{'<'}20 — низкий (суставы, либидо). {'>'}60 — повышен. {'>'}120 — высокая ароматизация' },
                      { marker:'Тестостерон общий', target:'{'>'}500 нг/дл (на терапии)', when:'Каждые 4-8 нед', action:'Коррелирует с E2. Высокий T → высокая ароматизация' },
                      { marker:'Глобулин связывающий половые гормоны (ГСПГ/SHBG)', target:'10-50 нмоль/л', when:'Каждые 8-12 нед', action:'Низкий SHBG → ↑ свободного T → ↑ ароматизации. Высокий SHBG → ↓ свободного T' },
                      { marker:'Пролактин', target:'{'<'}20 нг/мл', when:'Каждые 8-12 нед', action:'{'>'}20 — ↑ пролактина на 19-нор андрогенах (тренболон). Возможна галакторея' },
                      { marker:'ЛПВП (HDL)', target:'{'>'}1.0 ммоль/л', when:'Каждые 4-8 нед', action:'Анастрозол ↓ ЛПВП на 15-30%. При {'<'}1.0 — рассмотреть тамоксифен вместо АИ' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(244,114,182,0.04)', border:'1px solid rgba(244,114,182,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#f9a8d4' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#f472b6' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#f9a8d4'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#f9a8d4', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(244,114,182,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Анастрозол ↓ ЛПВП на 15-30% + ↑ ЛПНП на 10% — ухудшение липидного профиля. Тамоксифен — более безопасный профиль<br/>
                • 🦴 <b>Суставы:</b> Низкий E2 ({'<'}20) → суставные боли, крепитация. Отмена/снижение АИ. Добавить хондропротекторы<br/>
                • 🧠 <b>Нейро:</b> Низкий E2 → депрессия, ангедония, ↓ либидо. Восстановить E2 до {'>'}20 пг/мл<br/>
                • 🩸 <b>Гематология:</b> Тамоксифен ↑ риск тромбоза (редко, {'<'}1%). Контроль D-димера
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ СОН ══════════ */}
          {protocolTab === 'sleep' && (<InfoErrorBoundary label="Сон">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#8b5cf6', marginBottom:2 }}>💤 Коррекция сна на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Нормализация циркадных ритмов, борьба с бессонницей от стимулирующих ААС и нейротоксичности. Мелатонин, адаптогены, терморегуляция.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setSleepTab(t.id)}
                    style={sleepTab === t.id ? pillActive('#8b5cf6') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {sleepTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы нарушений сна на ААС</div>
                  {[{ m:'↑ Симпатической активности', e:'ААС стимулируют ЦНС через β-адренорецепторы → ↑ норадреналина → ↑ бодрствования, ↓ медленноволнового сна' },
                    { m:'↓ Мелатонина', e:'Высокий кортизол от тренировок + ААС → ↓ пика мелатонина. Нарушение циркадного ритма' },
                    { m:'Термогенез', e:'ААС ↑ базальный метаболизм и термогенез → ↑ температура тела → ↓ качества сна. Оптимум {'<'}18°C' },
                    { m:'Апноэ сна', e:'ААС ↑ мышечную массу шеи → ↑ риск обструктивного апноэ. Высокие дозы AAS + избыточный вес = риск' },
                    { m:'НОР-19 (тренболон)', e:'Тренболон — мощный нейротоксин. ↑ глутаматную эксайтотоксичность → бессонница + кошмары (т.н. трен-сон)' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#c4b5fd', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {sleepTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ГИГИЕНА СНА', label:'Базовая поддержка', color:'#22c55e', condition:'Лёгкие нарушения, {'<'}30 мин засыпания', desc:'Гигиена сна + базовые добавки',
                      items:[
                        { name:'Мелатонин (пролонгированный)', dose:'2-5 мг', timing:'За 30-60 мин до сна', note:'↓ времени засыпания на 15-30 мин. ↑ REM-фазы. Не применять {'>'}6 мес непрерывно' },
                        { name:'Магний L-треонат / глицинат', dose:'200-400 мг', timing:'За 1 ч до сна', note:'Магний L-треонат проникает через ГЭБ — улучшает качество сна. ↓ кортизола' },
                        { name:'Температура спальни', dose:'18-20°C', timing:'Постоянно', note:'Оптимальная для медленноволнового сна. Использовать кондиционер/вентилятор' },
                        { name:'Экранный детокс', dose:'—', timing:'За 1-2 ч до сна', note:'Синий свет ↓ мелатонин. Использовать режим «тёплый свет» или очки с блокировкой синего' },
                      ]},
                    { phase:'ФАЗА 2 · УМЕРЕННАЯ БЕССОННИЦА', label:'30-60 мин засыпания', color:'#f59e0b', condition:'30-60 мин засыпания, 1-2 пробуждения', desc:'Фармакологическая поддержка',
                      items:[
                        { name:'Апигенин (экстракт ромашки)', dose:'50 мг', timing:'За 30-60 мин до сна', note:'Модулятор ГАМК-A (бензодиазепиновый сайт). Без привыкания. ↓ тревоги' },
                        { name:'Глицин', dose:'3 г', timing:'Под язык за 20-30 мин до сна', note:'Тормозный нейромедиатор. Улучшает качество сна. ↓ времени засыпания' },
                        { name:'L-теанин', dose:'200-400 мг', timing:'За 30-60 мин до сна', note:'↑ альфа-волн (расслабление). ↓ норадреналина. Мягкая седация' },
                        { name:'ГАМК (GABA)', dose:'500-1000 мг', timing:'За 30 мин до сна', note:'Внешняя ГАМК ↓ тревоги. Слабая проницаемость ГЭБ, но эффект через блуждающий нерв' },
                      ]},
                    { phase:'ФАЗА 3 · ТЯЖЁЛАЯ БЕССОННИЦА', label:'{'>'}60 мин засыпания', color:'#f97316', condition:'{'>'}60 мин засыпания, {'>'}3 пробуждения/ночь', desc:'Интенсивная терапия сна',
                      items:[
                        { name:'Мелатонин 10 мг пролонг', dose:'5-10 мг', timing:'За 1-2 ч до сна', note:'Высокая доза для тяжёлых случаев. Контроль уровня кортизола!' },
                        { name:'Глицин + L-теанин + магний (комплекс)', dose:'Глицин 3 г + L-теанин 400 мг + Mg 400 мг', timing:'За 30-60 мин до сна', note:'Комбинация трёх седативных. Синергия через разные нейромедиаторные системы' },
                        { name:'Ашваганда (экстракт KSM-66)', dose:'600 мг', timing:'За 30 мин до сна', note:'Адаптоген. ↓ кортизола на 20-30%. Улучшает качество и продолжительность сна' },
                        { name:'Травяной сбор (хмель+валериана+мелисса)', dose:'1 чашка', timing:'За 30 мин до сна', note:'Седативные травы. Не применять {'>'}4 нед — риск привыкания к валериане' },
                      ]},
                    { phase:'ФАЗА 4 · ТРЕБОЛОН/АПНОЭ', label:'Трен-сон / храп', color:'#ef4444', condition:'Кошмары (тренболон) / остановки дыхания', desc:'Специфическая терапия',
                      items:[
                        { name:'Празиозин 2-5 мг 💊', dose:'2-5 мг', timing:'На ночь', note:'α1-блокатор. ↓ кошмаров и ночных пробуждений (особенно на тренболоне). По назначению врача' },
                        { name:'CPAP-терапия (при апноэ)', dose:'По настройкам', timing:'Всю ночь', note:'При апноэ сна (подтверждённом полисомнографией). Снижает сердечно-сосудистый риск' },
                        { name:'Снижение дозы/отмена тренболона', dose:'—', timing:'—', note:'Самая эффективная мера при трен-сне. Замена на нандролон/примоболан' },
                        { name:'Консультация сомнолога', dose:'—', timing:'—', note:'При неэффективности {'>'}4 нед. Полисомнография' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {sleepTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Вечерний тайминг подготовки ко сну</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Соблюдение интервалов: магний за 60 мин, мелатонин за 30-60 мин, экранный детокс за 60-120 мин.</p>
                  {[
                    { time:'🌆 За 2-3 ч до сна', color:'#f59e0b', items:[
                      { n:'Экранный детокс', why:'Синий свет ↓ мелатонин. Чтение книги/аудиокнига' },
                      { n:'Магний L-треонат 200-400 мг', why:'За 2 ч. Проникает через ГЭБ. ↓ кортизола' },
                      { n:'Температура спальни 18-20°C', why:'Кондиционер/вентилятор. Оптимум для сна' },
                    ]},
                    { time:'🌃 За 30-60 мин до сна', color:'#f97316', items:[
                      { n:'Мелатонин 2-10 мг', why:'За 30-60 мин. Пролонг — за 2 ч' },
                      { n:'L-теанин 200-400 мг', why:'↑ альфа-волн расслабления' },
                      { n:'Апигенин 50 мг/Глицин 3 г', why:'ГАМК-эргическая седация. Под язык' },
                      { n:'Ашваганда 600 мг', why:'↓ кортизола на 20-30%' },
                    ]},
                    { time:'🌜 Непосредственно перед сном', color:'#6366f1', items:[
                      { n:'Празиозин 2-5 мг (при трен-сне)', why:'α1-блокатор. ↓ кошмаров' },
                      { n:'Травяной сбор (хмель+валериана)', why:'Мягкая седация. Чай без кофеина' },
                      { n:'CPAP-маска (при апноэ)', why:'На всю ночь. Проверить герметичность' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {sleepTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Мониторинг сна</div>
                    {[{ marker:'Дневник сна', target:'{'>'}7 ч/ночь, {'<'}30 мин засыпания', when:'Ежедневно', action:'Записывать время засыпания, пробуждения, качество (1-5). Выявлять триггеры' },
                      { marker:'Кортизол (вечерняя слюна)', target:'{'<'}3.0 нмоль/л', when:'При хронической бессоннице', action:'{'>'}3.0 — гиперкортизолемия. Ашваганда, фосфатидилсерин. Снизить объём тренировок' },
                      { marker:'Мелатонин (6-SMT в моче)', target:'{'>'}10 нг/мг креатинина', when:'При подозрении на дефицит', action:'{'<'}10 — дефицит. Мелатонин 2-5 мг за 1 ч до сна' },
                      { marker:'Полисомнография', target:'N3 {'>'}20%, REM {'>'}20%', when:'При подозрении на апноэ', action:'Апноэ {'>'}5/ч — CPAP-терапия. N3/REM {'<'}нормы — депривация сна' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#c4b5fd' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#8b5cf6' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#c4b5fd'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#c4b5fd', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(139,92,246,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> Хроническая бессонница → ↑ АД, ↑ риск ССЗ. Коррекция сна — часть кардиопротекции<br/>
                • 🧠 <b>Нейро:</b> Дефицит сна → ↓ когнитивной функции, ↑ нейротоксичности. См. протокол нейропротекции<br/>
                • ⚖️ <b>Метаболизм:</b> Недосып → ↓ лептина, ↑ грелина → ↑ аппетита. Контроль калорий<br/>
                • 💪 <b>Тренировки:</b> {'<'}6 ч сна → ↓ восстановления на 30-50%. Приоритет сна = приоритет прогресса
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ ДЕТОКС ══════════ */}
          {protocolTab === 'detox' && (<InfoErrorBoundary label="Детокс">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#22d3ee', marginBottom:2 }}>🧬 Детоксикация на курсе ААС</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Поддержка фаз I/II детоксикации печени, элиминация ксенобиотиков и токсичных метаболитов ААС, хелатирование тяжёлых металлов.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setDetoxTab(t.id)}
                    style={detoxTab === t.id ? pillActive('#22d3ee') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {detoxTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Пути детоксикации</div>
                  {[{ m:'Фаза I (CYP450)', e:'CYP3A4 метаболизирует большинство ААС (особенно 17α-алкилы). ↑ нагрузки на CYP → ↑ свободных радикалов — требуется антиоксидантная защита' },
                    { m:'Фаза II (конъюгация)', e:'Глутатион-S-трансферазы (GST), UDP-глюкуронилтрансферазы (UGT) конъюгируют токсичные метаболиты → экскреция. Требуются кофакторы: глицин, глюкуроновая к-та, сульфат' },
                    { m:'Метилирование', e:'COMT метилирует катехол-эстрогены (2-OH, 4-OH → нетоксичные метокси). Дефицит МТНFR → ↑ риск токсичности эстрогенов' },
                    { m:'Антиоксидантная сеть', e:'Глутатион (GSH) — главный антиоксидант. NAC — лимитирующий субстрат синтеза GSH. АЛК регенерирует GSH из окисленной формы' },
                    { m:'Экскреция (желчь/моча)', e:'Конъюгированные метаболиты экскретируются через желчь (энтерогепатическая рециркуляция) и мочу. Стимуляция желчеоттока — TUDCA, УДХК' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(34,211,238,0.04)', border:'1px solid rgba(34,211,238,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#67e8f9', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {detoxTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · БАЗОВАЯ ДЕТОКСИКАЦИЯ', label:'NAC + АЛК + TUDCA', color:'#22c55e', condition:'Нормальные АЛТ/АСТ, нет оральных 17α-алкилов', desc:'Базовая поддержка детоксикации на любом курсе',
                      items:[
                        { name:'NAC (N-ацетилцистеин)', dose:'600-1200 мг', timing:'2×/день (утро/вечер)', note:'Предшественник глутатиона. Лимитирующий субстрат синтеза GSH. Связывает активные метаболиты токсинов' },
                        { name:'Альфа-липоевая кислота (АЛК)', dose:'300-600 мг', timing:'Утро', note:'Активатор Nrf2/ARE. ↑ фазу II детоксикации. Регенерирует GSH и витамины C/E. Хелатор тяжёлых металлов' },
                        { name:'TUDCA (тауроурсодезоксихолевая)', dose:'500-1000 мг', timing:'На ночь', note:'Снижает ER-стресс, улучшает желчеотток, защищает гепатоциты от токсических метаболитов' },
                        { name:'Гидратация', dose:'2.5-3.5 л/день', timing:'Равномерно', note:'Поддержка почечной экскреции конъюгированных метаболитов' },
                      ]},
                    { phase:'ФАЗА 2 · УСИЛЕННАЯ (17α-алкилы)', label:'NAC ×2 + TUDCA + силимарин', color:'#f59e0b', condition:'Оральные 17α-алкилы (метандростенолон, станозолол, оксиметолон)', desc:'Усиленная детоксикация при токсичных ААС',
                      items:[
                        { name:'NAC 1200 мг', dose:'1200 мг', timing:'2×/день (2400 мг/сут)', note:'Удвоенная доза для связывания токсичных метаболитов 17α-алкилов. Макс. 3000 мг/сут' },
                        { name:'Силимарин (экстракт расторопши)', dose:'280-560 мг', timing:'2×/день', note:'Стабилизирует мембраны гепатоцитов. ↑ РНК-полимеразу I. ↓ перекисного окисления липидов' },
                        { name:'TUDCA 1000 мг', dose:'1000 мг', timing:'На ночь', note:'Полная доза. Защита от ER-стресса, индуцированного 17α-алкилами' },
                        { name:'АЛК 600 мг', dose:'600 мг', timing:'2×/день', note:'Удвоенная доза для активации Nrf2. ↑ GST, NQO1 (фаза II)' },
                        { name:'Силимарин + TUDCA', dose:'Синергия', timing:'—', note:'Два независимых механизма: мембранная стабилизация + ↓ ER-стресса. Аддитивная защита' },
                      ]},
                    { phase:'ФАЗА 3 · МЕТИЛИРОВАНИЕ', label:'COMT + MTHFR', color:'#f97316', condition:'MTHFR C677T / дефицит метилирования', desc:'Поддержка метилирования (COMT, MTHFR)',
                      items:[
                        { name:'S-аденозилметионин (SAM-e)', dose:'400-800 мг', timing:'Утро натощак', note:'Главный донор метильных групп. Поддержка COMT. ↑ настроения, ↓ токсичности катехол-эстрогенов' },
                        { name:'ТМГ (триметилглицин, бетаин)', dose:'500-1000 мг', timing:'С едой', note:'Донор метильных групп для реметилирования гомоцистеина. Альтернатива SAM-e' },
                        { name:'Метилфолат (5-МТГФ) 400-800 мкг', dose:'400-800 мкг', timing:'Утро', note:'Активная форма фолата. Для MTHFR-мутантов. Поддержка синтеза SAM-e' },
                        { name:'Метилкобаламин (B12) 1000-5000 мкг', dose:'1000-5000 мкг', timing:'Под язык', note:'Кофактор метионин-синтазы. Синергия с метилфолатом' },
                      ]},
                    { phase:'ФАЗА 4 · ХЕЛАТИРОВАНИЕ', label:'Тяжёлые металлы', color:'#ef4444', condition:'Высокий уровень Hg/Pb/Cd / перегрузка Fe', desc:'Хелатирование и элиминация тяжёлых металлов',
                      items:[
                        { name:'Хлорелла (Chlorella vulgaris)', dose:'3-5 г', timing:'2×/день до еды', note:'Связывает Hg, Pb, Cd в кишечнике. ↓ реабсорбции. Курс 4-8 нед' },
                        { name:'NAC 1200 мг', dose:'1200 мг', timing:'2×/день', note:'Хелатор переходных металлов (Cu, Hg, Pb). ↑ экскреции с мочой' },
                        { name:'АЛК 600 мг', dose:'600 мг', timing:'2×/день', note:'Хелатор переходных металлов (Fe, Cu). Проходит ГЭБ — хелатирует Hg в мозге' },
                        { name:'Кордицепс (Cordyceps sinensis)', dose:'1-3 г', timing:'Утро', note:'↑ экскреции токсинов через почки. Адаптоген + иммуномодулятор' },
                        { name:'Кинза (cilantro) — экстракт', dose:'30-50 капель', timing:'2×/день', note:'Связывает Hg в межклеточном пространстве — мобилизует из депо' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {detoxTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг детокса</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>NAC и АЛК натощак или с едой (при чувствительном ЖКТ). TUDCA строго натощак перед сном. Силимарин с едой.</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'NAC 600-1200 мг', why:'Натощак за 1 ч до еды. Макс. абсорбция' },
                      { n:'АЛК 300-600 мг', why:'С завтраком. Активатор Nrf2' },
                      { n:'SAM-e 400-800 мг', why:'Натощак. Донор метильных групп' },
                      { n:'Метилфолат + метилкобаламин', why:'С завтраком. Поддержка метилирования' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'Силимарин 280 мг', why:'С обедом. Стабилизация мембран гепатоцитов' },
                      { n:'Хлорелла 3-5 г', why:'До еды. Связывание токсинов в кишечнике' },
                      { n:'ТМГ 500-1000 мг', why:'С едой. Дополнительный донор метильных групп' },
                      { n:'Гидратация 1-1.5 л', why:'Равномерно. Поддержка почечной экскреции' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'NAC 600-1200 мг (вторая доза)', why:'Вечером перед сном. Детоксикация во сне' },
                      { n:'TUDCA 500-1000 мг', why:'Строго натощак (2-3 ч после еды). Макс. холеретический эффект' },
                      { n:'АЛК 300 мг (вторая доза)', why:'С ужином. Продолжение Nrf2-активации' },
                      { n:'Кинза (экстракт) 30-50 капель', why:'С водой. Мобилизация Hg из депо' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {detoxTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг детоксикации</div>
                    {[{ marker:'АЛТ/АСТ/ГГТ/ЩФ', target:'АЛТ/АСТ {'<'}40, ГГТ {'<'}55', when:'Каждые 4 нед', action:'АЛТ {'>'}80 (2×ВГН) — усилить фазу 2 детокса. ГГТ {'>'}55 — холестаз, TUDCA 1000 мг' },
                      { marker:'Глутатион (GSH) в крови', target:'{'>'}600 мкмоль/л', when:'Каждые 8-12 нед', action:'{'<'}600 — истощение GSH. NAC 2400 мг/сут + АЛК 600 мг/сут + селен 200 мкг' },
                      { marker:'8-OHdG (оксидативный стресс ДНК)', target:'{'<'}2.5 нг/мл', when:'Каждые 12-24 нед', action:'{'>'}2.5 — высокий окислительный стресс. АЛК 600 мг, NAC 2400 мг, куркумин' },
                      { marker:'Гомоцистеин', target:'{'<'}10 мкмоль/л', when:'Каждые 12 нед', action:'{'>'}12 — дефицит метилирования. SAM-e, ТМГ, метилфолат, B12' },
                      { marker:'Тяжёлые металлы (Hg, Pb, Cd)', target:'{'<'}5 мкг/л', when:'При симптомах', action:'{'>'}5 — хелатирование. Хлорелла + NAC + АЛК + кинза' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(34,211,238,0.04)', border:'1px solid rgba(34,211,238,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#67e8f9' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#22d3ee' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#67e8f9'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#67e8f9', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(34,211,238,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> NAC {'>'}2400 мг/сут → ↑ АД (редко). Контроль АД на высоких дозах NAC<br/>
                • 🫁 <b>Печень:</b> TUDCA не применять при полной обструкции желчевыводящих путей. NAC с антибиотиками — интервал 2 ч<br/>
                • 🧠 <b>Нейро:</b> SAM-e может вызывать тревогу при {'>'}1200 мг/сут. Начинать с 400 мг<br/>
                • 🩸 <b>Гематология:</b> Хлорелла — богата витамином K. Контроль МНО при варфарине. Отменить за 2 нед до операции
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ GH/IGF-1 ══════════ */}
          {protocolTab === 'gh' && (<InfoErrorBoundary label="GH/IGF-1">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2dd4bf', marginBottom:2 }}>🫀 Поддержка оси GH/IGF-1</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Оптимизация секреции гормона роста, IGF-1 и их метаболических эффектов. Протокол для курсов с соматотропином, GHRP/GHRH и природной стимуляции.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setGhTab(t.id)}
                    style={ghTab === t.id ? pillActive('#2dd4bf') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {ghTab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Ось GH/IGF-1 и ААС</div>
                  {[{ m:'Соматопауза (↓ GH с возрастом)', e:'После 30 лет секреция GH ↓ на 10-15% за десятилетие. ААС могут дополнительно подавлять эндогенную ось через ↑ соматостатина' },
                    { m:'IGF-1 — медиатор анаболизма', e:'IGF-1 — главный медиатор анаболических эффектов GH. Стимулирует сателлитные клетки, синтез коллагена, гипертрофию' },
                    { m:'GH + ААС = синергия', e:'GH ↑ IGF-1 → ↑ мышечной гипертрофии через mTOR. ААС ↑ AR-экспрессию → ↑ чувствительность к IGF-1. Комбинация = аддитивный анаболизм' },
                    { m:'Инсулин-модуляция', e:'GH ↓ чувствительность к инсулину (↑ глюкозы). ААС ↑ ИР. Комбинация GH+ААС без метформина/берберина → риск гипергликемии' },
                    { m:'Акромегалия/пролапс', e:'Супрафизиологический GH (10+ МЕ/день) → акромегалия (↓ 10 лет жизни). Контроль IGF-1 — абсолютный императив' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(45,212,191,0.04)', border:'1px solid rgba(45,212,191,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#5eead4', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {ghTab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · ЭНДОГЕННАЯ СТИМУЛЯЦИЯ', label:'GHRP/GHRH/секретагоги', color:'#22c55e', condition:'Возраст 30-50, IGF-1 {'<'}200 нг/мл, нет GH в курсе', desc:'Природное повышение GH без экзогенного гормона',
                      items:[
                        { name:'GHRP-6/CJC-1295 (Ipamorelin)', dose:'100-200 мкг', timing:'1-3×/день п/к', note:'GHRP-6 стимулирует пульсирующую секрецию GH. CJC-1295 пролонгирует GHRH. Ipamorelin — селективен к GH (не ↑ пролактина/кортизола)' },
                        { name:'Глицин + L-аргинин + L-орнитин', dose:'Глицин 3 г + аргинин 5 г + орнитин 2 г', timing:'Натощак за 30-60 мин до сна/тренировки', note:'Аминокислотный секретагог. ↑ GH на 50-150% на час. ⚠ Не с едой (инсулин ↓ секрецию GH)' },
                        { name:'Глютамин', dose:'5-10 г', timing:'Натощак', note:'↑ GH через ↑ орнитина. Усиливает эффект секретагогов' },
                        { name:'Максимальное качество сна', dose:'7-9 ч', timing:'Ежедневно', note:'Основной пульс GH — во 2-3 цикле медленноволнового сна. Без качественного сна — стимуляция бесполезна' },
                      ]},
                    { phase:'ФАЗА 2 · НИЗКИЕ ДОЗЫ GH', label:'GH 2-4 МЕ/день', color:'#f59e0b', condition:'IGF-1 200-350 нг/мл, контроль глюкозы', desc:'Метаболическая доза. Анаболизм + жиросжигание',
                      items:[
                        { name:'Соматотропин (GH) 2-4 МЕ/день', dose:'2-4 МЕ', timing:'Утро натощак (или п/к)', note:'Разделить на 2 инъекции при {'>'}3 МЕ. Контроль IGF-1 через 2-4 нед. Цель IGF-1 {'<'}350' },
                        { name:'Метформин 500 мг', dose:'500 мг', timing:'2×/день с едой', note:'Обязательно на GH! ↓ риска гипергликемии. Контроль глюкозы натощак через 2 нед' },
                        { name:'Калий + магний', dose:'K⁺ 500-1000 мг + Mg 400 мг', timing:'Вечер', note:'GH ↑ задержки Na⁺ → ↓ K⁺, Mg²⁺. Восполнение потерь' },
                        { name:'Контроль глюкозы', dose:'—', timing:'Еженедельно', note:'Глюкоза натощак {'>'}5.6 — ↑ метформин до 1000 мг × 2/день или добавить берберин' },
                      ]},
                    { phase:'ФАЗА 3 · СРЕДНИЕ ДОЗЫ GH', label:'GH 4-8 МЕ/день', color:'#f97316', condition:'IGF-1 350-500 нг/мл', desc:'Анаболическая доза. Только для опытных',
                      items:[
                        { name:'Соматотропин (GH) 4-8 МЕ/день', dose:'4-8 МЕ', timing:'Утро + предтренировочно', note:'Разделить на 2-3 инъекции. IGF-1 не выше 500 нг/мл! Акромегалия при {'>'}600' },
                        { name:'Метформин 1000 мг', dose:'1000 мг', timing:'2×/день с едой', note:'Максимальная доза. Контроль глюкозы + HbA1c каждые 8-12 нед' },
                        { name:'Инсулин (при гипергликемии) 💊', dose:'По глюкозе', timing:'Предтренировочно или базальный', note:'Только при глюкозе {'>'}7.0 на метформине. Risky — ↑ гипогликемии' },
                        { name:'L-карнитин (ацетил/тартрат)', dose:'1-3 г', timing:'Утро/предтренировочно', note:'↓ ИР от GH. ↑ окисления жиров. Митохондриальная поддержка' },
                      ]},
                    { phase:'ФАЗА 4 · ВЫСОКИЕ ДОЗЫ / ТОКСИЧНОСТЬ', label:'GH {'>'}8 МЕ/день', color:'#ef4444', condition:'IGF-1 {'>'}500, симптомы акромегалии', desc:'Неотложная коррекция',
                      items:[
                        { name:'Снижение/отмена GH', dose:'—', timing:'Немедленно', note:'IGF-1 {'>'}500 → ↓ дозу на 50%. {'>'}600 → отмена. Риск акромегалии + ↓ 10 лет жизни' },
                        { name:'Агонисты дофамина (каберголин 💊)', dose:'0.25-0.5 мг', timing:'2×/нед', note:'↓ секреции GH через D2-рецепторы гипофиза. При IGF-1 {'>'}500' },
                        { name:'Аналоги соматостатина (октреотид 💊)', dose:'По назначению', timing:'П/к', note:'Ингибитор секреции GH. Только при акромегалии. По назначению эндокринолога' },
                        { name:'Контроль IGF-1', dose:'—', timing:'Каждые 2 нед', note:'Цель — нормализация IGF-1 ({'<'}350). Не возобновлять {'>'}4 МЕ/день после коррекции' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {ghTab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Суточный тайминг GH-поддержки</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>GH утром натощак (имитация пульса). Секретагоги — перед сном. Еда — через 30-60 мин после GH (чтобы ↓ инсулинового ответа).</p>
                  {[
                    { time:'🌅 Утро (06:00–09:00)', color:'#f59e0b', items:[
                      { n:'GH 2-4 МЕ (утренняя доза)', why:'Натощак. П/к. Без еды 30-60 мин' },
                      { n:'L-карнитин 1-3 г', why:'Натощак. Транспорт жиров в митохондрии' },
                      { n:'Метформин 500 мг', why:'С завтраком. Профилактика гипергликемии' },
                    ]},
                    { time:'☀️ День (12:00–16:00)', color:'#f97316', items:[
                      { n:'GH 2-4 МЕ (предтренировочная доза)', why:'За 30-60 мин до тренировки. П/к. Плюс аргинин/орнитин' },
                      { n:'Калий + магний', why:'С обедом. Восполнение электролитов' },
                      { n:'Метформин 500 мг (вторая доза)', why:'С ужином. Контроль глюкозы' },
                    ]},
                    { time:'🌙 Вечер (19:00–22:00)', color:'#6366f1', items:[
                      { n:'Секретагоги (GHRP-6/ипаморелин 100-200 мкг)', why:'Перед сном п/к. Пик GH во сне' },
                      { n:'Глицин+аргинин+орнитин (при секретагогах)', why:'Натощак. Натуральный ↑ GH' },
                      { n:'Глютамин 5-10 г', why:'На ночь. ↑ GH + восстановление ЖКТ' },
                      { n:'Без еды за 1-2 ч до сна', why:'Инсулин блокирует секрецию GH. Сон натощак = макс. GH' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {ghTab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг GH/IGF-1</div>
                    {[{ marker:'IGF-1 (соматомедин C)', target:'150-350 нг/мл (возраст-зависимо)', when:'Каждые 4-8 нед на GH', action:'{'<'}150 — ↓ дозу GH/секретагога. {'>'}500 — ↓ дозу GH на 50%. {'>'}600 — отмена GH. Акромегалия!' },
                      { marker:'Глюкоза натощак', target:'{'<'}5.6 ммоль/л', when:'Еженедельно на GH', action:'5.6-7.0 — метформин 1000 мг. {'>'}7.0 — инсулин. {'>'}11.1 — диабет. Эндокринолог' },
                      { marker:'HbA1c', target:'{'<'}6.0%', when:'Каждые 12 нед на GH', action:'{'>'}6.5% — преддиабет. Снизить/отменить GH, метформин 2 г/день' },
                      { marker:'T4/T3/ТТГ', target:'ТТГ 0.5-2.5, T4 10-22', when:'Каждые 8-12 нед', action:'GH ↓ T4→T3 конверсию → возможен гипотиреоз. Контроль щитовидной железы' },
                      { marker:'Калий (K⁺)', target:'3.5-5.0 ммоль/л', when:'Каждые 4-8 нед', action:'{'<'}3.5 — задержка Na⁺ от GH. Коррекция калия' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(45,212,191,0.04)', border:'1px solid rgba(45,212,191,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#5eead4' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#2dd4bf' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#5eead4'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#5eead4', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(45,212,191,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • ❤️ <b>Кардио:</b> GH ↑ задержку Na⁺ → ↑ АД + ↑ риск гипертрофии миокарда. Контроль АД каждую неделю<br/>
                • ⚖️ <b>Метаболизм:</b> GH ↓ чувствительность к инсулину → гипергликемия. Метформин — обязательно на GH {'>'}2 МЕ/день<br/>
                • 🫁 <b>Печень:</b> IGF-1 синтезируется печенью. При нарушении функции печени — ↓ IGF-1 даже при высоком GH<br/>
                • 🦴 <b>Суставы:</b> GH ↑ синтез коллагена → ↓ риска травм. Но высокие дозы → акромегалия → остеоартрит. IGF-1 {'<'}350!
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ GLP-1 ══════════ */}
          {protocolTab === 'glp1' && (<InfoErrorBoundary label="GLP-1">
            <div style={{ paddingBottom: 30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#f59e0b', marginBottom:2 }}>🍪 GLP-1 и метаболическая поддержка</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Управление аппетитом, гликемией и весом через GLP-1 агонисты (семаглутид, лираглутид) и природные GLP-1 секретагоги. Контроль побочных эффектов.</p>
              </div>

              <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                {[
                  { id:'mechanisms', label:'🔬 Механизмы' },
                  { id:'protocol', label:'💊 Фазы протокола' },
                  { id:'timing', label:'⏰ Тайминг' },
                  { id:'monitoring', label:'🧪 Мониторинг' },
                ].map((t: any) => (
                  <button key={t.id} onClick={() => setGlp1Tab(t.id)}
                    style={glp1Tab === t.id ? pillActive('#f59e0b') : pillInactive()}>{t.label}</button>
                ))}
              </div>

              {glp1Tab === 'mechanisms' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🔬 Механизмы GLP-1 и метаболической регуляции</div>
                  {[{ m:'GLP-1 — инкретиновый гормон', e:'GLP-1 (глюкагоноподобный пептид-1) секретируется L-клетками кишечника в ответ на еду. ↑ секрецию инсулина, ↓ глюкагона, замедляет опорожнение желудка' },
                    { m:'Подавление аппетита', e:'GLP-1 действует на гипоталамус (ARC/обходной тракт) — ↑ чувства сытости, ↓ грелина. Центральное подавление аппетита' },
                    { m:'GLP-1 и ААС', e:'ААС (особенно оральные 17α-алкилы) ↑ инсулинорезистентность + ↑ аппетит через ↑ грелина. GLP-1 агонисты — патогенетическая терапия' },
                    { m:'Метаболические эффекты', e:'↓ глюкозы (гипогликемический), ↓ веса, ↓ АД, ↑ липолиза, ↓ воспаления (через ↓ IL-6, TNF-α). Защита β-клеток поджелудочной' },
                  ].map((x, i) => (
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#fcd34d', marginBottom:2 }}>{x.m}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{x.e}</div>
                    </div>
                  ))}
                </div>
              )}

              {glp1Tab === 'protocol' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { phase:'ФАЗА 1 · НАТУРАЛЬНАЯ МОДУЛЯЦИЯ', label:'Природные GLP-1 секретагоги', color:'#22c55e', condition:'Преддиабет/ожирение (ИМТ {'>'}27)', desc:'Повышение эндогенного GLP-1 без инъекционных препаратов',
                      items:[
                        { name:'Берберин 500 мг', dose:'500 мг', timing:'2-3×/день до еды', note:'↑ GLP-1 через ↑ активности L-клеток. ↓ глюкозы на 20-30%. AMPK-активатор' },
                        { name:'Клетчатка (гуаровая камедь/пектин/инулин)', dose:'10-20 г', timing:'Перед едой с водой', note:'↑ GLP-1 через ферментацию в толстой кишке → ↑ короткоцепочечных жирных кислот. ↓ аппетита' },
                        { name:'L-глютамин', dose:'5-10 г', timing:'За 30-60 мин до еды', note:'Мощный стимулятор GLP-1 через CaSR-рецепторы L-клеток. ↑ GLP-1 на 2-3× в течение часа' },
                        { name:'Омега-3 (EPA/DHA)', dose:'2-4 г', timing:'С едой', note:'↑ GLP-1 через GPR120 на L-клетках. Системный противовоспалительный эффект' },
                      ]},
                    { phase:'ФАЗА 2 · НИЗКИЕ ДОЗЫ АГОНИСТОВ', label:'Семаглутид/лираглутид', color:'#f59e0b', condition:'ИМТ {'>'}30 / глюкоза {'>'}6.0 / ИР', desc:'Старт GLP-1 агонистов',
                      items:[
                        { name:'Семаглутид (Оземпик/Вегови) 💊', dose:'0.25-0.5 мг', timing:'1×/нед п/к', note:'Старт 0.25 мг × 4 нед. Титрация → 0.5 мг. ↓ веса на 5-10% за 6 мес. Контроль глюкозы' },
                        { name:'Лираглутид (Саксенда/Виктоза) 💊', dose:'0.6-1.8 мг', timing:'Ежедневно п/к', note:'Старт 0.6 мг × 1 нед. Титрация +0.6 мг/нед до 1.8 мг. ↓ веса на 5-8% за 3-6 мес' },
                        { name:'Метформин 500 мг', dose:'500 mg', timing:'2×/день с едой', note:'Синергия с GLP-1. ↓ глюкозы дополнительно на 15-20%. Профилактика гипогликемии' },
                        { name:'Ингибиторы ДПП-4 (ситаглиптин) 💊', dose:'100 мг', timing:'Утро', note:'Блокирует DPP-4 — ↑ уровень эндогенного GLP-1. Мягче, чем инъекции. Альтернатива при страхе инъекций' },
                      ]},
                    { phase:'ФАЗА 3 · ТИТРАЦИЯ/ПОДДЕРЖАНИЕ', label:'Средние дозы', color:'#f97316', condition:'ИМТ {'>'}35 / глюкоза {'>'}7.0', desc:'Увеличение дозы для клинического эффекта',
                      items:[
                        { name:'Семаглутид 1.0-2.4 мг', dose:'1.0-2.4 мг', timing:'1×/нед п/к', note:'Максимальная доза. ↓ веса до 15% за 12 мес. Контроль HbA1c, глюкозы, АЛТ/АСТ' },
                        { name:'Титрация', dose:'+0.5 мг каждые 4 нед', timing:'—', note:'Не титровать быстрее — ↑ риска тошноты/рвоты. При непереносимости — ↓ дозу и задержаться на 4 нед' },
                        { name:'Контроль тошноты (ондансетрон)', dose:'4-8 мг', timing:'При тошноте', note:'Антагонист 5-HT3. При тошноте от GLP-1. Не более 32 мг/сут' },
                        { name:'Пищевая дисциплина', dose:'—', timing:'Постоянно', note:'GLP-1 ↓ объём желудка → ↑ риска рефлюкса. Малые порции. Без жирного/жареного' },
                      ]},
                    { phase:'ФАЗА 4 · ПОБОЧНЫЕ ЭФФЕКТЫ/ОСЛОЖНЕНИЯ', label:'ЖКТ-токсичность', color:'#ef4444', condition:'Непереносимость / тошнота / рвота / панкреатит', desc:'Управление побочными эффектами GLP-1',
                      items:[
                        { name:'Симптоматическая терапия тошноты', dose:'Метоклопрамид 10 мг / домперидон 10 мг', timing:'За 30 мин до еды', note:'Прокинетики. Ускоряют опорожнение желудка. Короткий курс — не {'>'}2 нед' },
                        { name:'Снижение дозы/увеличение интервала', dose:'—', timing:'—', note:'При выраженной тошноте — ↓ дозу GLP-1 на 50% или увеличить интервал между инъекциями' },
                        { name:'Исключить панкреатит (липаза, амилаза)', target:'Липаза {'<'}60, амилаза {'<'}100', when:'При боли в эпигастрии', action:'{'>'}3× ВГН — панкреатит. Отмена GLP-1. Госпитализация' },
                        { name:'Консультация эндокринолога', dose:'—', timing:'При неэффективности', note:'При {'<'}5% потери веса за 6 мес — пересмотреть терапию. Рассмотреть тирзепатид/ретатрутид' },
                      ]},
                  ].map((p: any, i: any) => (
                    <div key={i} style={{ borderRadius:12, background:p.color+'08', border:'1px solid '+p.color+'22', padding:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.phase}</div>
                      <div style={{ fontSize:8, fontWeight:600, color:p.color+'aa', marginBottom:2 }}>{p.label}</div>
                      <div style={{ fontSize:7, color:'var(--text-dim)', marginBottom:4 }}>{p.condition}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>{p.desc}</div>
                      {p.items.map((x: any, xi: any) => (
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:6, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.name}</span>
                          <span style={{ fontSize:7, color:p.color, marginLeft:4 }}>{x.dose}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.timing}</span>
                          <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.note}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {glp1Tab === 'timing' && (
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>⏰ Тайминг GLP-1 терапии</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Семаглутид — 1×/нед (фиксированный день). Liraglutide — ежедневно. Берберин — до еды. Клетчатка — перед едой.</p>
                  {[
                    { time:'🗓 Раз в неделю (фиксированный день)', color:'#f59e0b', items:[
                      { n:'Семаглутид 0.25-2.4 мг п/к', why:'Один и тот же день (напр. вск). В любое время дня, независимо от еды' },
                      { n:'Запись дозы в дневник', why:'Отмечать дозу и побочные эффекты. Фото шприц-ручки с дозой' },
                    ]},
                    { time:'🌅 Ежедневно утром/вечером', color:'#f97316', items:[
                      { n:'Лираглутид 0.6-1.8 мг п/к', why:'Ежедневно в одно и то же время (обычно утром)' },
                      { n:'Метформин 500 мг', why:'2×/день с едой (завтрак+ужин). ↓ ЖКТ-побочки' },
                      { n:'SitaGLP-1 (ингибитор DPP-4)', why:'Утром 100 мг. Вне еды' },
                    ]},
                    { time:'🍽 Связано с едой', color:'#6366f1', items:[
                      { n:'Берберин 500 мг', why:'За 15-30 мин до еды (или с едой при чувствительном ЖКТ)' },
                      { n:'L-глютамин 5-10 г', why:'За 30-60 мин до еды. Стимуляция GLP-1' },
                      { n:'Клетчатка 10-20 г', why:'За 15-30 мин до еды с водой. ↑ сытости' },
                      { n:'Ондансетрон 4-8 мг (при тошноте)', why:'За 30-60 мин до еды. При непереносимости GLP-1' },
                    ]},
                  ].map((slot: any, si: any) =>(
                    <div key={si} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:slot.color+'0a', border:'1px solid '+slot.color+'22' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:slot.color, marginBottom:4 }}>{slot.time}</div>
                      {slot.items.map((x: any, xi: any) =>(
                        <div key={xi} style={{ padding:'5px 6px', borderRadius:4, marginBottom:3, background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:8, fontWeight:600, color:'var(--text-light)' }}>{x.n}</span>
                          <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:6 }}>— {x.why}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {glp1Tab === 'monitoring' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={cardBg}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6 }}>🧪 Лабораторный мониторинг GLP-1 терапии</div>
                    {[{ marker:'Глюкоза натощак', target:'3.9-5.6 ммоль/л', when:'Еженедельно в первые 4 нед, затем ежемесячно', action:'{'<'}3.9 — гипогликемия (редко на моно-GLP-1). {'>'}7.0 — неадекватный контроль, ↑ дозу' },
                      { marker:'HbA1c (гликированный гемоглобин)', target:'{'<'}6.5%', when:'Каждые 12 нед', action:'{'>'}6.5% — неадекватный ответ. Рассмотреть тирзепатид. {'>'}8.0% — эндокринолог' },
                      { marker:'Липаза, амилаза (панкреатит)', target:'Липаза {'<'}60, амилаза {'<'}100 Ед/л', when:'При боли в эпигастрии', action:'{'>'}3× ВГН — панкреатит. Отмена GLP-1, госпитализация' },
                      { marker:'АЛТ/АСТ', target:'АЛТ {'<'}40, АСТ {'<'}40', when:'Каждые 8-12 нед', action:'АЛТ {'>'}80 — может указывать на стеатоз/НЖБП. GLP-1 ↓ стеатоз — положительный эффект' },
                      { marker:'Креатинин/СКФ', target:'СКФ {'>'}60 мл/мин', when:'Каждые 8-12 нед', action:'СКФ {'<'}45 — риск дегидратации от GLP-1. Гидратация! Коррекция диуретиков' },
                      { marker:'Кальцитонин (риск медуллярного РЩЖ)', target:'{'<'}10 пг/мл', when:'До начала + каждые 12 мес', action:'{'>'}10 — исключить медуллярный рак щитовидной железы (противопоказание для GLP-1). УЗИ ЩЖ' },
                    ].map((m: any, i: any) =>(
                      <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.08)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:'#fcd34d' }}>{m.marker}</span>
                          <span style={{ fontSize:8, fontWeight:600, color:'#f59e0b' }}>{m.when}</span>
                        </div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}><b style={{color:'#fcd34d'}}>Цель: {m.target}</b></div>
                        <div style={{ fontSize:7, color:'#fcd34d', lineHeight:1.3, padding:'4px 6px', borderRadius:4, background:'rgba(245,158,11,0.06)' }}>💡 {m.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderRadius:12, padding:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>🔗 Перекрёстные предупреждения</div>
              <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.5 }}>
                • 🫁 <b>Печень:</b> Семаглутид ↓ стеатоз печени (НЖБП). Контроль АЛТ/АСТ каждые 8-12 нед. Берберин — гепатопротекторная синергия<br/>
                • 💧 <b>Почки:</b> GLP-1 → риск дегидратации (↓ потребления жидкости из-за ↓ аппетита). Принудительная гидратация 2+ л/день<br/>
                • 🩸 <b>Гематология:</b> GLP-1 агонисты ↓ агрегацию тромбоцитов. +антикоагулянты = риск кровотечений. Контроль МНО<br/>
                • ❤️ <b>Кардио:</b> Семаглутид ↓ риск сердечно-сосудистых событий на 26% (SELECT trial). GLP-1 — кардиопротективный эффект
              </div>
            </div>

          </InfoErrorBoundary>)}

          {/* ══════════ MITO ══════════ */}
          {protocolTab === 'mito' && (<InfoErrorBoundary label="Митохондрии">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#06b6d4', marginBottom:2 }}>⚡ Митохондриальный (NAD⁺/энергия)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Митохондриальная поддержка для энергетики, долголетия и профилактики метаболических нарушений на курсе ААС и GH.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setMitoTab(t.id)} style={mitoTab===t.id?pillActive('#06b6d4'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {mitoTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · БАЗОВАЯ МИТОХОНДРИАЛЬНАЯ ПОДДЕРЖКА', label:'NAD⁺-прекурсоры + CoQ10', color:'#22c55e', condition:'Базовый курс без GH', desc:'Поддержка энергетики и антиоксидантной защиты',
                      items:[
                        {name:'CoQ10 (убихинон) 100-200 мг', dose:'100-200 мг', timing:'Утро с жирной едой', note:triageBadge('ess')+' Ключевой переносчик электронов. ↓ с возрастом и на статинах. Убихинол — при ЖКТ-чувствительности'},
                        {name:'L-карнитин (L-карнитин-L-тартрат) 1-2 г', dose:'1-2 г', timing:'Утро натощак / перед тренировкой', note:triageBadge('ess')+' Транспорт жирных кислот в митохондрии. ↑ выносливость, ↓ усталость. Карнитин + АЛК — синергия'},
                        {name:'Альфа-липоевая кислота (АЛК) 300-600 мг', dose:'300-600 мг', timing:'Утро натощак', note:triageBadge('rec')+' Кофактор митохондриальных ферментов. ↑ захват глюкозы. Антиоксидант'},
                        {name:'Магний (цитрат/глицинат) 400 мг', dose:'400 мг', timing:'Вечер', note:triageBadge('rec')+' Кофактор АТФ-синтазы. ↓ мышечные судороги'},
                      ]},
                    {phase:'ФАЗА 2 · ОПТИМАЛЬНАЯ (курс 8+ нед / высокий объём)', label:'+ NAD⁺-бустеры', color:'#f59e0b', condition:'Курс >8 нед, высокий тренировочный объём, возраст >35', desc:'Усиление митохондриального биогенеза',
                      items:[
                        {name:'NMN / NR (никотинамид-рибозид) 250-500 мг', dose:'250-500 мг', timing:'Утро натощак', note:triageBadge('rec')+' NAD⁺-прекурсор. ↑ NAD⁺ на 40-80%. ↓ усталость, ↑ восстановление. Дорого, но эффективно'},
                        {name:'PQQ (пирролохинолинхинон) 10-20 мг', dose:'10-20 мг', timing:'Утро', note:triageBadge('opt')+' Стимулятор митохондриального биогенеза (PGC-1α). Синергия с CoQ10'},
                        {name:'D-рибоза 5 г', dose:'5 г', timing:'После тренировки', note:triageBadge('opt')+' Субстрат для синтеза АТФ. ↓ крепатура, ↑ восстановление. При высоком объёме'},
                        {name:'Берберин 500 мг', dose:'500 мг', timing:'2×/день до еды', note:triageBadge('rec')+' AMPK-активатор → PGC-1α → биогенез митохондрий. ↓ ИР, ↑ чувствительность к инсулину'},
                      ]},
                    {phase:'ФАЗА 3 · ИНТЕНСИВНАЯ (GH + ААС + высокий объём)', label:'Полный митохондриальный стек', color:'#f97316', condition:'GH + ААС + тренировки 6×/нед + возраст >40', desc:'Максимальная поддержка энергетики',
                      items:[
                        {name:'CoQ10 300 мг + PQQ 20 мг', dose:'300+20 мг', timing:'Утро', note:triageBadge('ess')+' Максимальные дозы. PQQ ↑ биогенез, CoQ10 — перенос электронов'},
                        {name:'NMN 500-1000 мг + АЛК 600 мг', dose:'500-1000+600', timing:'Утро натощак', note:triageBadge('ess')+' NAD⁺-буст + антиоксидант. ↓ оксидативный стресс от GH'},
                        {name:'L-карнитин 2-3 г + D-рибоза 5-10 г', dose:'2-3 г + 5-10 г', timing:'До/после тренировки', note:triageBadge('rec')+' ↑ энергия, ↓ усталость. Карнитин — до тренировки, рибоза — после'},
                        {name:'Магний 600 мг + калий 400 мг', dose:'600+400 мг', timing:'Вечер', note:triageBadge('ess')+' Электролиты для митохондрий. Mg — кофактор АТФ'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {mitoTab==='timing' && timingBlock('mito', [
                {time:'🌅 Утро натощак', items:[{n:'NMN/NR 250-500 мг',why:'NAD⁺-буст'},{n:'АЛК 300-600 мг',why:'Антиоксидант'},{n:'CoQ10 100-300 мг',why:'С жирной едой (завтрак)'}]},
                {time:'🏋️ До тренировки', items:[{n:'L-карнитин 1-2 г',why:'↑ окисление жиров + энергия'}]},
                {time:'🍽 После тренировки', items:[{n:'D-рибоза 5 г',why:'Синтез АТФ'}]},
                {time:'🌙 Вечер', items:[{n:'Магний 400-600 мг',why:'Кофактор АТФ'},{n:'PQQ 10-20 мг (если не утром)',why:'Биогенез митохондрий'}]},
              ])}
              {mitoTab==='monitoring' && monitoringBlock([
                {marker:'Энергия (субъективно)', target:'0-10', when:'Ежедневно', action:'Оценка энергии — ключевой критерий эффективности'},
                {marker:'Крепатура (DOMS)', target:'<4/10', when:'Ежедневно', action:'↓ DOMS + ↑ восстановление → эффект митохондриальной поддержки'},
                {marker:'Глюкоза натощак', target:'3.9-5.6 ммоль/л', when:'1×/нед', action:'Берберин ↓ глюкозу. При <3.9 — риск гипогликемии'},
                {marker:'Лактат (после тренировки)', target:'<2 ммоль/л (через 5 мин)', when:'При оценке выносливости', action:'↑ лактат → ↓ митохондриальной функции'},
              ])}
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ STEATOSIS ══════════ */}
          {protocolTab === 'steatosis' && (<InfoErrorBoundary label="Стеатоз">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#84cc16', marginBottom:2 }}>🫁 Стеатоз печени (НАЖБП)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Неалкогольная жировая болезнь печени — частое осложнение ААС (оральные 17α-алкилированные, избыток калорий).</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setSteatosisTab(t.id)} style={steatosisTab===t.id?pillActive('#84cc16'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {steatosisTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · ПРОФИЛАКТИКА (стеатоза нет)', label:'Гепатопротекция + метаболическая поддержка', color:'#22c55e', condition:'АЛТ/АСТ/ГГТ в норме, УЗИ печени без изменений', desc:'Профилактика стеатоза на курсе ААС',
                      items:[
                        {name:'Берберин 500 мг', dose:'500 мг', timing:'2-3×/день до еды', note:triageBadge('ess')+' AMPK-активатор → ↓ de novo липогенеза. ↓ глюкозы, ↓ ИР. Доказан при НАЖБП'},
                        {name:'TUDCA 250-500 мг', dose:'250-500 мг', timing:'Вечер натощак', note:triageBadge('rec')+' ↓ ER-стресс, ↑ BSEP-экспрессию. Антиапоптотический. +NAC для синергии'},
                        {name:'Омега-3 (EPA/DHA) 2-4 г', dose:'2-4 г', timing:'С едой', note:triageBadge('rec')+' ↓ триглицеридов печени на 25-40%. ↑ окисления жирных кислот'},
                        {name:'Силимарин (расторопша) 140-280 мг', dose:'140-280 мг', timing:'Утро', note:triageBadge('opt')+' Стабилизация мембран гепатоцитов. Антиоксидант'},
                      ]},
                    {phase:'ФАЗА 2 · УМЕРЕННЫЙ СТЕАТОЗ (CAP 250-300 dB/м)', label:'Лечение стеатоза', color:'#f59e0b', condition:'УЗИ: стеатоз 1-2 ст. / CAP 250-300 / АЛТ 40-80', desc:'Терапия стеатоза',
                      items:[
                        {name:'Берберин 500-1000 мг', dose:'500-1000 мг', timing:'3×/день до еды', note:triageBadge('ess')+' ↑ дозу. ↓ HOMA-IR на 30%. ↓ стеатоза по данным МРТ'},
                        {name:'TUDCA 500-750 мг', dose:'500-750 мг', timing:'Вечер натощак', note:triageBadge('ess')+' ↑ BSEP, ↓ стеатоз. Синергия с берберином'},
                        {name:'Омега-3 (EPA) 4 г', dose:'4 г', timing:'С едой (2+2 г)', note:triageBadge('ess')+' EPA 4 г — минимальная эффективная доза для ↓ стеатоза'},
                        {name:'Витамин E (RRR-α-токоферол) 400-800 МЕ', dose:'400-800 МЕ', timing:'С едой', note:triageBadge('rec')+' Антиоксидант. ↓ стеатоза (PIVENS trial). Контроль ПСА! (↑ риск рака простаты)'},
                        {name:'Силимарин 280-420 мг', dose:'280-420 мг', timing:'Утро', note:triageBadge('opt')+' ↑ дозу. Стабилизация мембран'},
                      ]},
                    {phase:'ФАЗА 3 · ТЯЖЁЛЫЙ СТЕАТОЗ/НАСГ/ФИБРОЗ (CAP >300 / FIB-4 >2.67)', label:'НАСГ + риск цирроза', color:'#ef4444', condition:'CAP >300 / АЛТ >80 / FIB-4 >2.67 / эластография >8 кПа', desc:'Терапия под контролем гепатолога',
                      items:[
                        {name:'Берберин 1000 мг + TUDCA 1000 мг', dose:'1000+1000 мг', timing:'Берберин 3×, TUDCA вечер', note:triageBadge('ess')+' Максимальные дозы. Add-on: метформин/пиоглитазон'},
                        {name:'Омега-3 (EPA) 6 г', dose:'6 г', timing:'3+3 г с едой', note:triageBadge('ess')+' Максимальная доза. ↑ окисления жирных кислот'},
                        {name:'Пиоглитазон 15-30 мг 💊', dose:'15-30 мг', timing:'Утро', note:triageBadge('rec')+' ↓ ИР + ↓ стеатоза. Контроль веса (+2-4 кг). ↑ риска переломов (женщины)'},
                        {name:'Эластография печени (FibroScan)', target:'<8 кПа', when:'Каждые 6 мес', action:'>8 кПа → фиброз. >12 кПа → цирроз. Гепатолог'},
                        {name:'FIB-4 индекс', target:'<1.30 (низкий риск)', when:'Каждые 6 мес', action:'>2.67 → высокий риск фиброза. Биопсия/эластография'},
                        {name:'Отмена/замена оральных ААС', dose:'—', timing:'—', note:triageBadge('ess')+' 17α-алкилированные → гепатотоксичность. Переход на инъекционные + GH не рекомендован'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {steatosisTab==='timing' && timingBlock('steatosis', [
                {time:'🌅 Утро', items:[{n:'Берберин 500 мг',why:'За 15-30 мин до завтрака'},{n:'Силимарин 140-280 мг',why:'С едой'},{n:'Пиоглитазон 15-30 мг (при НАСГ)',why:'Утром с едой'}]},
                {time:'🍽 День', items:[{n:'Омега-3 2 г (EPA)',why:'С обедом'},{n:'Берберин 500 мг',why:'До обеда'}]},
                {time:'🌙 Вечер', items:[{n:'TUDCA 500-1000 мг',why:'Натощак за 2 ч до сна'},{n:'Омега-3 2 г (EPA)',why:'С ужином'},{n:'Берберин 500 мг',why:'До ужина'},{n:'Витамин E 400-800 МЕ',why:'С ужином (жирорастворимый)'}]},
              ])}
              {steatosisTab==='monitoring' && monitoringBlock([
                {marker:'АЛТ/АСТ', target:'<40 Ед/л', when:'Каждые 4 нед', action:'>40 → ↑ дозу берберина/TUDCA. >80 → консультация гепатолога'},
                {marker:'ГГТ, ЩФ', target:'ГГТ <60, ЩФ <150', when:'Каждые 4 нед', action:'↑ ГГТ → холестаз. ↑ TUDCA'},
                {marker:'Глюкоза натощак', target:'3.9-5.6 ммоль/л', when:'1×/нед', action:'↑ глюкоза → ИР + стеатоз. Берберин ↓ глюкозу'},
                {marker:'Липидный профиль (ТГ, ЛПВП)', target:'ТГ <1.7, ЛПВП >1.0', when:'Каждые 8-12 нед', action:'↑ ТГ → стеатоз. Омега-3 EPA 4 г ↓ ТГ на 25%'},
                {marker:'УЗИ печени / CAP', target:'CAP <250 дБ/м / нет стеатоза', when:'Каждые 6-12 мес', action:'↑ CAP → прогрессия стеатоза'},
                {marker:'FIB-4 / эластография', target:'FIB-4 <1.30', when:'Ежегодно', action:'>2.67 → продвинутый фиброз. Направить к гепатологу'},
              ])}
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ RAAS ══════════ */}
          {protocolTab === 'raas' && (<InfoErrorBoundary label="RAAS">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#3b82f6', marginBottom:2 }}>🫀 RAAS (АД/почки/фиброз)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Ренин-ангиотензин-альдостероновая система — ключевая мишень для контроля АД, протеинурии и фиброза на курсе ААС.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setRaasTab(t.id)} style={raasTab===t.id?pillActive('#3b82f6'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {raasTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · ПРОФИЛАКТИКА (АД <130/80, нет протеинурии)', label:'RAAS-модуляция + натрий-контроль', color:'#22c55e', condition:'АД <130/80, UACR <30 мг/г, СКФ >90', desc:'Профилактика АГ и нефропатии на ААС',
                      items:[
                        {name:'Натрий — контроль (<3 г/день)', dose:'<3 г', timing:'Постоянно', note:triageBadge('ess')+' ↓ натрия — первая линия. ААС ↑ Na⁺-реабсорбцию через RAAS'},
                        {name:'Магний (цитрат/глицинат) 400 мг', dose:'400 мг', timing:'Вечер', note:triageBadge('rec')+' ↓ тонус сосудов. ↑ NO. ↓ АД на 3-5 мм рт.ст.'},
                        {name:'Омега-3 2-4 г', dose:'2-4 г', timing:'С едой', note:triageBadge('rec')+' ↓ АД на 2-4 мм рт.ст. + ↓ воспаления сосудистой стенки'},
                        {name:'Коэнзим Q10 100-200 мг', dose:'100-200 мг', timing:'Утро', note:triageBadge('opt')+' ↓ АД на 10-17 мм рт.ст. (при дефиците). Эндотелиальная функция'},
                      ]},
                    {phase:'ФАЗА 2 · АГ 1 СТЕПЕНИ (АД 130-139/80-89)', label:'Монотерапия телмисартаном', color:'#f59e0b', condition:'АД 130-139/80-89, UACR 30-300, СКФ 60-90', desc:'Старт RAAS-блокады',
                      items:[
                        {name:'Телмисартан 20-40 мг 💊', dose:'20-40 мг', timing:'Утро/вечер', note:triageBadge('ess')+' ARB. ↓ АД на 10-15/5-10. ↓ протеинурия. PPARγ-агонист (метаболические плюсы). Старт 20 мг'},
                        {name:'Калий-контроль при телмисартане', target:'K⁺ <5.0', when:'Через 2 нед после старта', action:'↑ K⁺ риск при СКФ <60. При K⁺ >5.0 — ↓ дозу или отменить'},
                        {name:'Натрий <2 г/день + DASH-диета', dose:'<2 г', timing:'Постоянно', note:triageBadge('rec')+' DASH-диета ↓ АД на 8-14 мм рт.ст. Синергия с телмисартаном'},
                        {name:'Магний 400-600 мг + калий 400 мг', dose:'400-600+400', timing:'Магний вечер, калий с едой', note:triageBadge('rec')+' Добавить калий при K⁺ <4.0. Магний ↓ тонус сосудов'},
                      ]},
                    {phase:'ФАЗА 3 · АГ 2 СТЕПЕНИ / РЕФРАКТЕРНАЯ (АД >140/90)', label:'Комбинированная терапия', color:'#f97316', condition:'АД >140/90 на телмисартане 40 мг / иАПФ ранее', desc:'Add-on терапия',
                      items:[
                        {name:'Телмисартан 40-80 мг 💊', dose:'40-80 мг', timing:'Утро', note:triageBadge('ess')+' Максимальная доза. Добавить второй препарат'},
                        {name:'+ Амлодипин 2.5-5 мг 💊', dose:'2.5-5 мг', timing:'Утро/вечер', note:triageBadge('ess')+' БКК. ↓ АД +10/5. Старт 2.5 мг. Отёки лодыжек — дозозависимый побочный эффект'},
                        {name:'+ Спиронолактон 12.5-25 мг 💊', dose:'12.5-25 мг', timing:'Утро', note:triageBadge('rec')+' Антагонист альдостерона. ↓ АД +5-10. Антифибротический. Контроль K⁺+'},
                        {name:'Петлевой диуретик (фуросемид/торасемид) 💊', dose:'20-40 мг', timing:'Утро при отёках', note:triageBadge('rec')+' При задержке жидкости. Контроль K⁺, Mg, Na⁺. Не >2×/нед'},
                        {name:'Контроль K⁺, креатинина, СКФ каждые 2 нед', target:'K⁺ <5.0, СКФ >60', when:'Каждые 2 нед', action:'↑ K⁺ или ↓ СКФ >25% — ↓/отмена RAAS-блокады'},
                      ]},
                    {phase:'ФАЗА 4 · ПРОТЕИНУРИЯ / ХБП (UACR >300 / СКФ <60)', label:'Нефропротекция', color:'#ef4444', condition:'UACR >300 мг/г / СКФ <60 / микроальбуминурия', desc:'Максимальная нефропротекция',
                      items:[
                        {name:'Телмисартан 80 мг (макс) + иАПФ (рамиприл 5-10 мг) 💊', dose:'80 мг + 5-10 мг', timing:'Утро', note:triageBadge('ess')+' Двойная RAAS-блокада. ↓ протеинурия на 40-60%. Контроль K⁺+ 1×/нед!'},
                        {name:'+ Спиронолактон 25-50 мг 💊', dose:'25-50 мг', timing:'Утро', note:triageBadge('ess')+' Антифибротический + ↓ протеинурии. ГиперK⁺ риск — мониторинг K⁺ 1×/нед'},
                        {name:'+ Амлодипин 5-10 мг 💊', dose:'5-10 мг', timing:'Утро/вечер', note:triageBadge('rec')+' Контроль АД. Дозировка по АД'},
                        {name:'Петлевой диуретик (фуросемид 20-40 мг)', dose:'20-40 мг', timing:'Утро при отёках', note:triageBadge('rec')+' При задержке жидкости/ХБП. Контроль K⁺, Mg, Na⁺'},
                        {name:'Исключить: НПВС, аминогликозиды, контраст', dose:'—', timing:'—', note:triageBadge('ess')+' Нефротоксичные препараты противопоказаны. НПВС ↓ почечный кровоток'},
                        {name:'Кетостерил (аналог кетоаналогов) 💊', dose:'1 таб/5 кг', timing:'С едой', note:triageBadge('opt')+' ↓ азотемии при ХБП 3-4 ст. Кетоаналоги незаменимых аминокислот'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {raasTab==='timing' && timingBlock('raas', [
                {time:'🌅 Утро', items:[{n:'Телмисартан 20-80 мг',why:'Фиксированное время'},{n:'Амлодипин 2.5-10 мг',why:'Отдельно от телмисартана'},{n:'Спиронолактон 12.5-50 мг',why:'С едой ↓ ЖКТ'},{n:'Торасемид/фуросемид',why:'Утро — не вечер (↓ ночного диуреза)'}]},
                {time:'🍽 День/Вечер', items:[{n:'Рамиприл 5-10 мг',why:'Вечер (↓ кашля?)'},{n:'Кетостерил',why:'С каждым приёмом еды'}]},
              ])}
              {raasTab==='monitoring' && monitoringBlock([
                {marker:'АД (сист/диаст)', target:'<130/80 (протеинурия <125/75)', when:'Ежедневно × 2 нед после старта, затем 2-3×/нед', action:'>140/90 → ↑ терапию. <100/60 — ↓ дозу'},
                {marker:'K⁺ (калий)', target:'3.5-5.0 ммоль/л', when:'Через 2 нед после старта/↑ дозы, затем 1×/мес', action:'>5.0 → ↓ RAAS-блокаду. <3.5 → ↓ диуретики'},
                {marker:'Креатинин / СКФ', target:'СКФ >90 мл/мин', when:'Через 2 нед, затем 1×/3 мес', action:'↓ СКФ >25% после старта RAAS-блокады — отмена'},
                {marker:'UACR (альбумин/креатинин мочи)', target:'<30 мг/г', when:'Каждые 3-6 мес', action:'>300 → протеинурия. RAAS-блокада обязательна'},
                {marker:'ЭКГ', target:'Без изменений', when:'При старте терапии', action:'Гипертрофия ЛЖ → АГ-ремоделирование. контроль АД на фоне терапии'},
              ])}
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ ELECTROLYTES ══════════ */}
          {protocolTab === 'electrolytes' && (<InfoErrorBoundary label="Электролиты">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ef4444', marginBottom:2 }}>⚡ Электролиты (K⁺/Na⁺/Mg²⁺/Ca²⁺)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Летальный риск: гипер-/гипокалиемия, гипомагниемия, гипонатриемия. Коррекция электролитов обязательна при ААС, диуретиках, GLP-1.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'emergency',label:'🚑 Экстренная помощь'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setElectrolytesTab(t.id)} style={electrolytesTab===t.id?pillActive('#ef4444'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {electrolytesTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · ПРОФИЛАКТИКА (AAS <500 мг)', label:'Базовая поддержка', color:'#22c55e', condition:'Курс до 500 мг тестостерона/без диуретиков', desc:'Профилактика электролитного дисбаланса',
                      items:[
                        {name:'Калий (цитрат/глюконат)', dose:'200-400 мг', timing:'С едой', note:triageBadge('rec')+' ↓ риск гипокалиемии. Калий-сберегающие: спиронолактон, эплеренон'},
                        {name:'Магний (цитрат/глицинат)', dose:'200-400 мг', timing:'Вечер, за 1-2 ч до сна', note:triageBadge('ess')+' Кofactor для K⁺. ↓ судороги, ↑ качество сна. Mg-цитрат — биодоступнее'},
                        {name:'Натрий — контроль', dose:'—', timing:'—', note:triageBadge('opt')+' При ААС без диуретиков — натрий не ограничивать. Избегать избытка соли (>5 г/день)'},
                      ]},
                    {phase:'ФАЗА 2 · УМЕРЕННЫЙ РИСК (AAS 500-1000 мг + диуретики)', label:'Коррекция', color:'#f59e0b', condition:'Курс 500-1000 мг / тиазидные диуретики / GLP-1 / диарея', desc:'Превентивная коррекция при факторах риска',
                      items:[
                        {name:'Калий (цитрат)', dose:'400-800 мг', timing:'2×/день с едой', note:triageBadge('ess')+' При тиазидах/петлевых диуретиках. Контроль K⁺ 1×/нед'},
                        {name:'Магний (цитрат)', dose:'400-600 мг', timing:'Вечер', note:triageBadge('ess')+' ↑ дозу при диуретиках. Mg ↓ потери K⁺ через почки'},
                        {name:'Калий-сберегающие (спиронолактон)', dose:'25-50 мг', timing:'Утро', note:triageBadge('rec')+' При гипокалиемии <3.5. Контроль K⁺ через 5-7 дней после старта'},
                      ]},
                    {phase:'ФАЗА 3 · ВЫСОКИЙ РИСК (>1000 мг + диуретики + GLP-1)', label:'Интенсивная коррекция', color:'#f97316', condition:'Курс >1000 мг / калий-негативные диуретики (фуросемид) / рвота/диарея', desc:'Электролиты — ежедневный контроль',
                      items:[
                        {name:'Калий (цитрат)', dose:'800-1200 мг', timing:'3×/день с едой', note:triageBadge('ess')+' Дробно. Не превышать 1200 мг/день без контроля'},
                        {name:'Магний (цитрат + глицинат)', dose:'600-800 мг', timing:'200 мг утро + 400-600 мг вечер', note:triageBadge('ess')+' Комбинация форм: цитрат (биодоступность) + глицинат (противосудорожное)'},
                        {name:'Калий-сберегающие спиронолактон', dose:'50-100 мг', timing:'Утро', note:triageBadge('rec')+' При K⁺ <3.8. Контроль K⁺ 2×/нед. ЭКГ при K⁺ <3.0'},
                        {name:'Кальций (цитрат)', dose:'500 мг', timing:'Вечер, отдельно от Mg', note:triageBadge('rec')+' При судорогах. Дефицит Ca²⁺ усугубляет гипомагниемию. Не принимать с Mg — конкурентное всасывание'},
                      ]},
                    {phase:'ФАЗА 4 · КРИТИЧЕСКИЙ ДИСБАЛАНС', label:'Госпитализация?', color:'#ef4444', condition:'K⁺<3.0 / K⁺>6.0 / Na⁺<125 / Mg⁺²<0.5', desc:'Экстренная коррекция',
                      items:[
                        {name:'🚑 K⁺ <3.0 (тяжёлая гипокалиемия)', dose:'В/в K⁺ 20-40 ммоль/ч', timing:'Экстренно', note:'ЭКГ: уплощение T, зубец U. Госпитализация. Перорально неэффективно'},
                        {name:'🚑 K⁺ >6.0 (гиперкалиемия)', dose:'Глюконат Ca²⁺ 10% 10 мл + инсулин 10 ЕД + глюкоза 50 мл 40%', timing:'Экстренно', note:'ЭКГ: высокий T, широкий QRS. Отмена спиронолактона/ингибиторов РААС'},
                        {name:'🚑 Mg²⁺ <0.5 (тяжёлая гипомагниемия)', dose:'В/в MgSO₄ 5-10 ммоль', timing:'Экстренно', note:'Судороги, тетания. Коррекция Mg без K⁺ неэффективна'},
                        {name:'🚑 Na⁺ <125 (гипонатриемия)', dose:'В/в NaCl 3% 100-200 мл', timing:'Экстренно', note:'Коррекция <8 ммоль/л/сут. Быстрая коррекция → осмотический демиелинизирующий синдром'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {electrolytesTab==='emergency'&&(
                <div style={cardBg}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🚑 Экстренная помощь при электролитном кризе</div>
                  <p style={{ fontSize:8, color:'var(--text-dim)', margin:'0 0 8px', lineHeight:1.3 }}>Электролитный дисбаланс — наиболее частая причина летальности при самодеятельной фармакологии. При критических значениях — госпитализация.</p>
                  {[
                    {cond:'Гипокалиемия (K⁺ <3.5)', rec:'Увеличить калий до 800-1200 мг/день. Добавить спиронолактон 25-50 мг. Отменить тиазиды. ЭКГ. При <3.0 — в/в', source:'KDIGO, 2023'},
                    {cond:'Гиперкалиемия (K⁺ >5.5)', rec:'Отменить спиронолактон/эплеренон. Отменить ингибиторы РААС (телмисартан). Петлевые диуретики. Глюконат Ca²⁺ в/в', source:'KDIGO, 2023'},
                    {cond:'Гипомагниемия (Mg <0.75)', rec:'Mg-цитрат 400-800 мг/день. При <0.65 — в/в MgSO₄. Коррекция без Mg неэффективна для K⁺', source:'NICE, 2022'},
                    {cond:'Гипонатриемия (Na⁺ <130)', rec:'↑ потребление соли (NaCl 1-3 г/день). Отменить тиазиды. Исключить ГЗТ. ГЛП-1 — риск дегидратации', source:'ESICM, 2021'},
                  ].map((e:any,i:any)=>(
                    <div key={i} style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#fca5a5', marginBottom:2 }}>{e.cond}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:2 }}>{e.rec}</div>
                      <div style={{ fontSize:7, color:'#ef4444' }}>🔗 {e.source}</div>
                    </div>
                  ))}
                </div>
              )}
              {electrolytesTab==='timing' && timingBlock('electrolytes', [
                {time:'🌅 Утро', items:[{n:'Спиронолактон 25-50 мг',why:'С едой'},{n:'Магний цитрат 200 мг',why:'С завтраком'}]},
                {time:'🍽 День', items:[{n:'Калий цитрат 200-400 мг',why:'С обедом'},{n:'Кальций цитрат 500 мг',why:'За 2 ч до Mg'}]},
                {time:'🌙 Вечер', items:[{n:'Магний глицинат 200-400 мг',why:'За 1-2 ч до сна — расслабление'}]},
              ])}
              {electrolytesTab==='monitoring' && monitoringBlock([
                {marker:'K⁺ (калий)', target:'3.5-5.0 ммоль/л', when:'1-2×/нед при терапии', action:'<3.5 → ↑ калий + спиронолактон. >5.5 → отменить калий + спиронолактон'},
                {marker:'Mg²⁺ (магний)', target:'0.75-1.0 ммоль/л', when:'1×/нед', action:'<0.75 → ↑ Mg. <0.65 → в/в MgSO₄'},
                {marker:'Na⁺ (натрий)', target:'135-148 ммоль/л', when:'1×/2 нед', action:'<130 → ↑ соль + отменить тиазиды. >150 → дегидратация'},
                {marker:'ЭКГ', target:'Без изменений', when:'При K⁺ <3.0 или >6.0', action:' T (гипер-K⁺), уплощение T + U (гипо-K⁺)'},
                {marker:'Мочевина/креатинин', target:'Мочевина <8.0, креатинин <110', when:'1×/2 нед', action:'↑ → риск дегидратации/почечной недостаточности'},
              ])}
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ PROLACTIN ══════════ */}
          {protocolTab === 'prolactin' && (<InfoErrorBoundary label="Пролактин">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#ec4899', marginBottom:2 }}>🤱 Пролактин/Прогестерон</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Гиперпролактинемия от ААС (нандролон, тренболон) и антипсихотиков. Протокол коррекции по уровню PRL.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setProlactinTab(t.id)} style={prolactinTab===t.id?pillActive('#ec4899'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {prolactinTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · ПРОФИЛАКТИКА (PRL <600 мМЕ/л)', label:'Базовая поддержка нормы', color:'#22c55e', condition:'Все ААС-курсы с нандролоном/тренболоном', desc:'Профилактика гиперпролактинемии без каберголина',
                      items:[
                        {name:'Витамин B6 (пиридоксин) 50-100 мг', dose:'50-100 мг', timing:'Утро', note:triageBadge('ess')+' Кофактор дофамин-синтеза. Поддерживает D2-тонус. ↓ PRL на 15-25%'},
                        {name:'Магний (глицинат) 200-400 мг', dose:'200-400 мг', timing:'Вечер', note:triageBadge('rec')+' Кофактор тирозингидроксилазы. ↓ стресс-индуцированного ↑ PRL'},
                        {name:'Ашвагандха 300-600 мг', dose:'300-600 мг', timing:'Вечер', note:triageBadge('opt')+' ↓ кортизол → ↓ PRL. Синергия с магнием'},
                        {name:'Избегать: домперидон, метоклопрамид, нейролептики', dose:'—', timing:'—', note:triageBadge('ess')+' Все блокаторы D2 ↑ PRL. Альтернатива: ондансетрон (5-HT3)'},
                      ]},
                    {phase:'ФАЗА 2 · УМЕРЕННАЯ (PRL 600-1000 мМЕ/л)', label:'Каберголин — старт', color:'#f59e0b', condition:'PRL 600-1000 / симптомы: ↓ либидо, галакторея, олигоменорея', desc:'Медикаментозная коррекция',
                      items:[
                        {name:'Каберголин (Достинекс) 💊', dose:'0.25 мг', timing:'1-2×/нед', note:triageBadge('ess')+' D2-агонист. Старт 0.25 мг × 1/нед. Контроль PRL через 2 нед'},
                        {name:'B6 100 мг + Mg 400 мг', dose:'100+400 мг', timing:'Утро/вечер', note:triageBadge('rec')+' Адъювант. Повышает эффективность каберголина'},
                        {name:'Контроль тошноты от каберголина', dose:'—', timing:'—', note:triageBadge('rec')+' Принимать с едой. Старт 0.125 мг при непереносимости. Домперидон НЕЛЬЗЯ (блокирует D2)'},
                      ]},
                    {phase:'ФАЗА 3 · ВЫСОКАЯ (PRL 1000-2000 мМЕ/л)', label:'Каберголин — титрация', color:'#f97316', condition:'PRL 1000-2000 / галакторея / гипогонадизм', desc:'Увеличение дозы каберголина',
                      items:[
                        {name:'Каберголин 0.5 мг', dose:'0.5 мг', timing:'1-2×/нед', note:triageBadge('ess')+' Титрация от 0.25→0.5 мг. Разделить приём на 2×/нед (напр. ср+вс)'},
                        {name:'B6 200 мг + Mg 600 мг', dose:'200+600 мг', timing:'100 мг B6 утро + 100 мг вечер. Mg вечер', note:triageBadge('rec')+' ↑ дозу B6 при ↑ PRL. Мониторинг нейропатии (B6 >200 мг × >6 мес)'},
                        {name:'Исключить пролактиному (МРТ гипофиза)', target:'Размер аденомы', when:'PRL >2000 или головные боли/нарушения полей зрения', action:'МРТ гипофиза с контрастом. КТ — если МРТ недоступна'},
                      ]},
                    {phase:'ФАЗА 4 · КРИТИЧЕСКАЯ (PRL >2000 + галакторея/аденома)', label:'Каберголин + эндокринолог', color:'#ef4444', condition:'PRL >2000 / макропролактинома / галакторея', desc:'Терапия под контролем эндокринолога',
                      items:[
                        {name:'Каберголин 1-2 мг', dose:'1-2 мг', timing:'2×/нед', note:triageBadge('ess')+' Высокие дозы. Контроль PRL ежемесячно. Эхокардиография каждые 6-12 мес (риск фиброза клапанов)'},
                        {name:'МРТ гипофиза с контрастом', target:'Размер аденомы', when:'Каждые 12 мес', action:'↓ размеров на фоне каберголина — критерий эффективности'},
                        {name:'Клинический осмотр', target:'Поля зрения, головные боли', when:'Каждые 6 мес', action:'При ↑ размеров аденомы → нейрохирург. При апоплексии гипофиза — экстренная госпитализация'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {prolactinTab==='timing' && timingBlock('prolactin', [
                {time:'🌅 Утро (с едой)', items:[{n:'B6 50-100 мг',why:'С завтраком'},{n:'Каберголин 0.25-0.5 мг (1-2×/нед)',why:'С едой ↓ тошноты'}]},
                {time:'🌙 Вечер', items:[{n:'Магний глицинат 200-400 мг',why:'За 1-2 ч до сна'},{n:'Ашвагандха 300-600 мг',why:'↓ кортизола'}]},
              ])}
              {prolactinTab==='monitoring' && monitoringBlock([
                {marker:'Пролактин (PRL)', target:'60-600 мМЕ/л (2-20 нг/мл)', when:'Каждые 2-4 нед', action:'>600 → старт каберголина. <60 → ↓ каберголин'},
                {marker:'Тестостерон (общий)', target:'20-30 нмоль/л (на курсе)', when:'Каждые 4-8 нед', action:'↓ тестостерон при ↑ PRL → подавление ГнРГ'},
                {marker:'ЛГ/ФСГ', target:'ЛГ 1-8, ФСГ 1-10 МЕ/л', when:'Каждые 8-12 нед', action:'↓ ЛГ/ФСГ при ↑ PRL → гипогонадотропный гипогонадизм'},
                {marker:'Эхокардиография', target:'Без фиброза клапанов', when:'Каждые 6-12 мес на каберголине', action:'Каберголин >2 мг/нед — риск фиброза сердечных клапанов'},
              ])}
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ ADAPTOGENS ══════════ */}
          {protocolTab === 'adaptogen' && (<InfoErrorBoundary label="Адаптогены">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#22c55e', marginBottom:2 }}>🌿 Адаптогены/HPA-ось (кортизол)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Кортизол — главный катаболик. Высокий → мышечный катаболизм, висцеральный жир, ИР, гипертония. Низкий → усталость, гипотония.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'protocol',label:'Протокол'},{id:'timing',label:'⏰ Тайминг'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setAdaptogenTab(t.id)} style={adaptogenTab===t.id?pillActive('#22c55e'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {adaptogenTab==='protocol'&&(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    {phase:'ФАЗА 1 · ПОДДЕРЖКА HPA-ОСИ (кортизол в норме)', label:'Адаптогены + Mg', color:'#22c55e', condition:'Без симптомов дисбаланса кортизола', desc:'Профилактика HPA-дисфункции на курсе ААС',
                      items:[
                        {name:'Ашвагандха (Withania somnifera) 300-600 мг', dose:'300-600 мг', timing:'Вечер, за 30-60 мин до сна', note:triageBadge('ess')+' ↓ кортизол на 15-28% за 60 дн. ↑ свободный T. Синергия с магнием'},
                        {name:'Магний (глицинат) 200-400 мг', dose:'200-400 мг', timing:'Вечер', note:triageBadge('ess')+' Блокирует HPA-ось через ↓ АКТГ. ↑ качество сна. ↓ судороги'},
                        {name:'Родиола розовая 200-400 мг', dose:'200-400 мг', timing:'Утро', note:triageBadge('rec')+' Адаптоген + ↑ стрессоустойчивость. Не принимать вечером — ↑ активность'},
                        {name:'Фосфатидилсерин 100-200 мг', dose:'100-200 мг', timing:'При ↑ кортизола', note:triageBadge('opt')+' ↓ кортизол через ингибирование АКТГ. При высоком кортизоле (≥550 нмоль/л)'},
                      ]},
                    {phase:'ФАЗА 2 · ВЫСОКИЙ КОРТИЗОЛ (>550 нмоль/л)', label:'Кортизол-даун', color:'#f97316', condition:'Симптомы: тревога, висцеральный жир, ИР, гипертония, катаболизм', desc:'Снижение кортизола',
                      items:[
                        {name:'Фосфатидилсерин 300-400 мг', dose:'300-400 мг', timing:'200 мг утро + 200 мг вечер', note:triageBadge('ess')+' Прямой ингибитор АКТГ. ↓ кортизол на 20-30% за 2-4 нед'},
                        {name:'Ашвагандха 600 мг', dose:'600 мг', timing:'Вечер', note:triageBadge('ess')+' ↑ до макс. дозы. Контроль ЩЖ — ашвагандха ↑ T4'},
                        {name:'Магний 400-600 мг + B6 100 мг', dose:'400-600+100', timing:'Магний вечер, B6 утро', note:triageBadge('rec')+' B6 — кофактор дофамин-синтеза. Mg — ↓ АКТГ'},
                        {name:'Теанин (L-теанин) 200-400 мг', dose:'200-400 мг', timing:'Утро + день', note:triageBadge('rec')+' ↑ α-волны мозга, ↓ кортизол. Анксиолитик. Кофеин + теанин — фокус'},
                        {name:'Исключить: высокий кофеин (>400 мг/день), депривация сна', dose:'—', timing:'—', note:triageBadge('ess')+' Кофеин ↑ кортизол на 30-50%. Сон <6 ч → 2-3× кортизол'},
                      ]},
                    {phase:'ФАЗА 3 · ГИПОКОРТИЗОЛЕМИЯ (<150 нмоль/л)', label:'Кортизол-ап', color:'#3b82f6', condition:'Симптомы: усталость, гипотония, ↓ толерантности к стрессу, HPA-suppression от ААС', desc:'Восстановление HPA-оси',
                      items:[
                        {name:'Глицирризиновая кислота (корень солодки) 200-400 мг', dose:'200-400 мг', timing:'Утро', note:triageBadge('ess')+' Ингибитор 11β-HSD2 → ↑ кортизол. ↓ усталость, ↑ АД. Контроль K⁺!'},
                        {name:'Пантотеновая кислота (B5) 500-1000 мг', dose:'500-1000 мг', timing:'Утро', note:triageBadge('rec')+' Кофактор синтеза кортизола. Адреналиновая поддержка'},
                        {name:'Женьшень (Panax ginseng) 200-400 мг', dose:'200-400 мг', timing:'Утро', note:triageBadge('rec')+' Адаптоген. ↑ ACTH. Не принимать вечером'},
                        {name:'Отмена ашвагандхи и фосфатидилсерина', dose:'—', timing:'—', note:triageBadge('ess')+' Эти вещества ↓ кортизол — противопоказаны при гипокортизолемии'},
                      ]},
                    {phase:'ФАЗА 4 · АДДИСОНИЧЕСКИЙ КРИЗ (кортизол <50 нмоль/л + коллапс)', label:'🚑 Экстренная помощь', color:'#ef4444', condition:'Симптомы: коллапс, гипогликемия, гипер-K⁺, гипо-Na⁺, рвота', desc:'Госпитализация!',
                      items:[
                        {name:'Гидрокортизон 100 мг в/в', dose:'100 мг в/в', timing:'Экстренно', note:'Первая линия. Затем 200 мг/день в/в + инфузия. Госпитализация в ОРИТ'},
                        {name:'Инфузия NaCl 0.9% 1-2 л', dose:'1-2 л', timing:'Экстренно', note:'Коррекция гиповолемии. Декстроза 5% при гипогликемии'},
                        {name:'Отмена всех ААС + адаптогенов', dose:'—', timing:'—', note:'ААС могут подавлять HPA-ось. Адаптогены могут маскировать симптомы'},
                      ]},
                  ].map((p:any,i:any)=>renderPhase(p,i))}
                </div>
              )}
              {adaptogenTab==='timing' && timingBlock('adaptogen', [
                {time:'🌅 Утро', items:[{n:'Родиола 200-400 мг',why:'↑ стрессоустойчивость'},{n:'B5 500-1000 мг (при гипокортизоле)',why:'Синтез кортизола'}]},
                {time:'🍽 День', items:[{n:'Теанин 200 мг',why:'Утром + при стрессе'},{n:'Фосфатидилсерин 200 мг (при высоком кортизоле)',why:'После обеда'}]},
                {time:'🌙 Вечер', items:[{n:'Ашвагандха 300-600 мг',why:'За 30-60 мин до сна'},{n:'Магний глицинат 200-400 мг',why:'За 1-2 ч до сна'},{n:'Фосфатидилсерин 200 мг (при высоком кортизоле)',why:'Перед сном'}]},
              ])}
              {adaptogenTab==='monitoring' && monitoringBlock([
                {marker:'Кортизол утро (8:00)', target:'150-550 нмоль/л', when:'Каждые 4-8 нед', action:'>550 → старт кортизол-даун. <150 → старт кортизол-ап'},
                {marker:'Кортизол вечер (23:00)', target:'<50% от утреннего', when:'Каждые 4-8 нед', action:'↓ циркадного ритма → HPA-дисфункция. Восстановление режима сна'},
                {marker:'АКТГ', target:'10-60 пг/мл', when:'При подозрении на HPA-патологию', action:'↑ АКТГ + ↓ кортизол → первичная надпочечниковая недостаточность'},
                {marker:'K⁺, Na⁺', target:'K⁺ 3.5-5.0, Na⁺ 135-148', when:'Каждые 2-4 нед на солодке', action:'Глицирризиновая кислота → ↓ K⁺, ↑ Na⁺. Контроль электролитов!'},
                {marker:'АД', target:'<130/80', when:'1-2×/день на солодке', action:'↑ АД от глицирризиновой кислоты. Коррекция дозы/отмена при АГ'},
              ])}
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ PEPTIDES ══════════ */}
          {protocolTab === 'peptide' && (<InfoErrorBoundary label="Пептиды">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#2dd4bf', marginBottom:2 }}>🧬 Пептиды (сводный справочник)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Справочник пептидов: GHRP/GHRH, регенеративные (BPC-157, TB-500), ноотропные, иммунные.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'ghrh',label:'GHRP/GHRH'},{id:'repair',label:'Регенерация'},{id:'nootropic',label:'Ноотропы'},{id:'immune',label:'Иммунитет'},{id:'other',label:'Прочие'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setPeptideTab(t.id)} style={peptideTab===t.id?pillActive('#2dd4bf'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {peptideTab==='ghrh'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>📈 GHRP/GHRH — стимуляторы GH</div>
                {[{n:'GHRP-2 100-200 мкг',d:'100-200 мкг',t:'2-3×/день п/к',o:'Старт 100 мкг. ↓ кортизол. Контроль пролактина'},{n:'GHRP-6 100-200 мкг',d:'100-200 мкг',t:'2-3×/день п/к',o:'↑ аппетит. ↑ кортизол. Титровать 100→200'},{n:'Ipamorelin 200-300 мкг',d:'200-300 мкг',t:'2-3×/день п/к',o:'Селективный GHRP. Не ↑ кортизол/PRL. Старт 200×2'},{n:'CJC-1295 (без DAC) 100-200 мкг',d:'100-200 мкг',t:'1-2×/день п/к',o:'GHRH-аналог. DAC-версия 1×/нед'},{n:'Tesamorelin 2 мг',d:'2 мг',t:'1×/день п/к',o:'Одобрен FDA ↓ висцеральный жир'},{n:'GH 2-4 МЕ',d:'2-4 МЕ',t:'Утро/перед тренировкой',o:'Экзогенный GH. Старт 2 МЕ. Контроль IGF-1'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
              {peptideTab==='repair'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🩹 Регенеративные пептиды (BPC-157 + TB-500)</div>
                {[{n:'BPC-157 200-500 мкг',d:'200-500 мкг',t:'1-2×/день п/к',o:'Стабильный пентадекапептид. Ангиогенез + заживление сухожилий и ЖКТ'},{n:'TB-500 2.5-10 мг',d:'2.5-10 мг',t:'1×/нед в/м/п/к',o:'G-актин-связывающий. Миграция клеток. Старт 2.5 мг ×2/нед'},{n:'BPC+TB стек',d:'BPC 250+TB 2.5',t:'BPC 2×/д, TB 2×/нед',o:'Максимальная регенерация. Курс 4-6 нед'},{n:'GH 2-4 МЕ',d:'2-4 МЕ',t:'Утро + сон',o:'↑ IGF-1 → заживление. Синергия с BPC/TB'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
              {peptideTab==='nootropic'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🧠 Ноотропные пептиды</div>
                {[{n:'Semax 200-600 мкг',d:'200-600 мкг',t:'Интраназально 1-2/д',o:'BDNF ↑, внимание. Курс 10-14 дн'},{n:'Cerebrolysin 10-30 мл',d:'10-30 мл',t:'В/в капельно 10-20 дн',o:'↑ нейропластичность. NGF, BDNF'},{n:'Pinealon 1-2 мл',d:'1-2 мл',t:'В/м ×10 дн',o:'↑ мелатонин. Сон + когнитив'},{n:'Noopept 10-20 мг',d:'10-20 мг',t:'Сублингвально 2-3/д',o:'Синтетический ноотроп. 8-12 нед'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
              {peptideTab==='immune'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🛡️ Иммунные пептиды</div>
                {[{n:'Thymalin/Thymogen 5-10 мг',d:'5-10 мг',t:'В/м 5-10 дн 1-2×/год',o:'T-клеточный иммунитет'},{n:'TA-1 (тимозин α1) 1.6 мг',d:'1.6 мг',t:'П/к 2-4 нед',o:'Противовирусный + противоопухолевый'},{n:'Epitalon 5-10 мг',d:'5-10 мг',t:'В/м 10-20 дн',o:'↑ теломераза, мелатонин'},{n:'LL-37 0.5-1 мг',d:'0.5-1 мг',t:'Местно/п/к',o:'Антимикробный пептид. Экспериментальный'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
              {peptideTab==='other'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#2dd4bf', marginBottom:6 }}>🧪 Другие пептиды</div>
                {[{n:'MGF (IGF-1Ec) 50-100 мкг',d:'50-100 мкг',t:'В мышцу после тренировки',o:'Локальная гипертрофия. Сателлитные клетки'},{n:'IGF-1 LR3 20-40 мкг',d:'20-40 мкг',t:'П/к/в/м 2-3/д',o:'↑ период полувыведения 3×. Гипогликемия!'},{n:'PEG-MGF 100-200 мкг',d:'100-200 мкг',t:'В/м 1-2/нед',o:'↑ сателлитные клетки. Старт 100 мкг'},{n:'АКТГ 15-30 мг',d:'15-30 мг',t:'В/м 1-2/д',o:'Только для диагностики — НЕ для курса!'}].map((x:any,i:any)=>renderRow(x,i,'#2dd4bf'))}
              </div>)}
            </div>
          </InfoErrorBoundary>)}

          {/* ══════════ POST-CYCLE ══════════ */}
          {protocolTab === 'postcycle' && (<InfoErrorBoundary label="Постцикл">
            <div style={{ paddingBottom:30, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={cardBg}>
                <div style={{ fontSize:13, fontWeight:800, color:'#8b5cf6', marginBottom:2 }}>🔄 Послекурсовая реабилитация (3-6 мес)</div>
                <p style={{ fontSize:9, color:'var(--text-dim)', margin:0, lineHeight:1.3 }}>Комплексное восстановление HPTA-оси, липидного профиля, гематокрита и нейроэндокринного статуса.</p>
              </div>
              <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
                {[{id:'phases',label:'📅 Фазы'},{id:'lipids',label:'Липиды'},{id:'hemato',label:'Гематокрит'},{id:'neuro',label:'Нейро'},{id:'monitoring',label:'🧪 Мониторинг'}].map((t:any)=>(
                  <button key={t.id} onClick={()=>setPostCycleTab(t.id)} style={postCycleTab===t.id?pillActive('#8b5cf6'):pillInactive()}>{t.label}</button>
                ))}
              </div>
              {postCycleTab==='phases'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>📅 Фазы восстановления</div>
                <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>ФАЗА 1 · ОТМЕНА ААС (0-4 нед)</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>• Отмена ААС. SERM (тамоксифен 20 мг, энкломифен 12.5 мг) с последней инъекции<br/>• AI — только при высоком E2. Каберголин 0.25×2/нед при ↑ PRL<br/>• hCG не показан (подавляет HPTA). Контроль T,E2,PRL,АЛТ,HCT каждые 2 нед</div>
                </div>
                <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>ФАЗА 2 · ПКТ (4-8 нед)</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>• SERM: тамоксифен 20 + энкломифен 12.5 (кломифен 50/25)<br/>• Поддержка: цинк 30 мг, Mg 400 мг, D3 5000 МЕ, B6 100 мг<br/>• Адаптогены: ашвагандха 600 мг, фосфатидилсерин 200 мг<br/>• Контроль: T, ЛГ, ФСГ, кортизол каждые 2 нед</div>
                </div>
                <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>ФАЗА 3 · ВОССТАНОВЛЕНИЕ (8-16 нед)</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>• Липиды: омега-3 EPA 4 г, бергамот 1000 мг, ниацин 500 мг<br/>• HCT: кровопускание при {'>'}54, аспирин 100 мг, куркумин<br/>• Нейро: NAC 1200 мг, АЛК 600 мг, PS 400 мг, Mg 600 мг</div>
                </div>
                <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, background:'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>ФАЗА 4 · МОНИТОРИНГ (16-24+ нед)</div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.3 }}>• Цель: T {'>'}15 нмоль/л, E2 80-150, ЛГ/ФСГ в норме<br/>• Полное восстановление HPTA — 4-12 мес<br/>• Следующий курс — только при T {'>'}15, ЛГ {'>'}3, липиды в норме</div>
                </div>
              </div>)}
              {postCycleTab==='lipids'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🩸 Коррекция липидного профиля</div>
                {[{n:'Омега-3 EPA 4 г/день',d:'4 г',t:'2+2 г с едой',o:'↑ ЛПВП 10-15%, ↓ ТГ 25-30%'},{n:'Бергамот 1000 мг',d:'1000 мг',t:'2×/д до еды',o:'↓ ЛПНП 30-40%, ↑ ЛПВП 20-25%'},{n:'Ниацин B3 500 мг',d:'500 мг',t:'После еды 2-3×/д',o:'↑ ЛПВП 20-30% — мощный. Старт 100 мг титровать'},{n:'Кр. ферм. рис (монаколин K)',d:'10 мг',t:'Вечер',o:'↓ ЛПНП 20-40% +CoQ10. Контроль АЛТ'},{n:'Эзетимиб 10 мг 💊',d:'10 мг',t:'Утро',o:'↓ ЛПНП 15-20%. Аддитивно к статинам'}].map((x:any,i:any)=>renderRow(x,i,'#8b5cf6'))}
              </div>)}
              {postCycleTab==='hemato'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🩸 Коррекция гематокрита</div>
                {[{n:'Кровопускание 400-500 мл',d:'—',t:'При HCT >54 до <50',o:'Золотой стандарт. Донорство. Повтор через 4-6 нед'},{n:'Аспирин 100 мг',d:'100 мг',t:'Утро после еды',o:'↓ агрегация тромбоцитов. При HCT >52'},{n:'Чеснок Kyolic 1200 мг',d:'1200 мг',t:'2×/день',o:'↓ вязкость крови'},{n:'Гидратация 3+ л/день',d:'>3 л',t:'Постоянно',o:'Разжижение крови'},{n:'Наттокиназа 100 мг',d:'100 мг',t:'Утро натощак',o:'Фибринолитик. При HCT >50'}].map((x:any,i:any)=>renderRow(x,i,'#8b5cf6'))}
              </div>)}
              {postCycleTab==='neuro'&&(<div style={cardBg}>
                <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>🧠 Нейрореабилитация</div>
                {[{n:'NAC 1200 мг',d:'1200 мг',t:'Утро+вечер',o:'↑ глутатион. ↓ глутамат-токсичность'},{n:'Mg глицинат 400-600 мг',d:'400-600 мг',t:'Вечер',o:'↓ глутамат, ГАМК-агонист'},{n:'PS 300-400 мг',d:'300-400 мг',t:'200 утро+200 вечер',o:'↓ кортизол. ↑ дофаминовые рецепторы'},{n:'АЛК 600 мг',d:'600 мг',t:'Утро',o:'Антиоксидант. ↑ глутатион в мозге'},{n:'L-теанин 200-400 мг',d:'200-400 мг',t:'Утро+день',o:'↑ α-волны. Анксиолитик'},{n:'Глицин 3 г',d:'3 г',t:'Перед сном',o:'ГАМК-агонист. Качество сна'},{n:'Куркумин Meriva 500-1000 мг',d:'500-1000 мг',t:'С едой',o:'↓ нейровоспаление NF-κB'}].map((x:any,i:any)=>renderRow(x,i,'#8b5cf6'))}
              </div>)}
              {postCycleTab==='monitoring' && monitoringBlock([
                {marker:'T общий/свободный', target:'>15 нмоль/л', when:'Каждые 4 нед (фазы 1-2)', action:'<10 → add SERM/энкломифен'},
                {marker:'ЛГ, ФСГ', target:'ЛГ 1-8 МЕ/л', when:'Каждые 4 нед', action:'ЛГ <1 → HPTA подавлена'},
                {marker:'E2', target:'80-150 пмоль/л', when:'Каждые 4 нед', action:'>200 → AI. <30 → add SERM'},
                {marker:'Липиды (ЛПВП, ЛПНП, ТГ)', target:'ЛПВП >1.0', when:'Каждые 4-8 нед', action:'ЛПВП <0.8 → старт коррекции'},
                {marker:'HCT', target:'42-50%', when:'Каждые 4 нед', action:'>54% → кровопускание'},
                {marker:'CRP', target:'<1 мг/л', when:'Каждые 8-12 нед', action:'>3 → персистирующее воспаление'},
                {marker:'Кортизол, PRL', target:'150-550, 60-600', when:'Каждые 4-8 нед', action:'↑ PRL → каберголин'},
                {marker:'ПСА (>40 лет)', target:'<2.5 нг/мл', when:'Ежегодно', action:'>4 → уролог'},
              ])}
            </div>
          </InfoErrorBoundary>)}



          {protocolTab === 'symptoms' && (
            <div style={{ padding: '0 0 0' }}>
              <SymptomSolverTab s={s} />
            </div>
          )}

          {/* Polypharm warning */}
          {polypharmNote}

          </div>
        )}
      </div>
  );
};
