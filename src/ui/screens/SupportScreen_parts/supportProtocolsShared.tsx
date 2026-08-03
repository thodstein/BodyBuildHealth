// @ts-nocheck
/**
 * supportProtocolsShared.tsx — shared UI helpers for protocol modules
 */
import React from 'react';

export const cardBg = { background:'var(--bg-secondary)', borderRadius:12, padding:12, border:'1px solid var(--border)' };

export const pillActive = (c: string) => ({ padding:'5px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap' as const, cursor:'pointer', background:c, color:'#000', border:'1px solid '+c });

export const pillInactive = () => ({ padding:'5px 12px', borderRadius:16, fontSize:9, fontWeight:700, whiteSpace:'nowrap' as const, cursor:'pointer', background:'var(--bg-secondary)', color:'var(--text-dim)', border:'1px solid var(--border)' });

export const PhaseLabel: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{ fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:4, background:color+'22', color }}>{label}</span>
);

export const ItemRow: React.FC<{ name: string; dose: string; timing: string; note: string; color: string }> = ({ name, dose, timing, note, color }) => (
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

export const triageBadge = (tier: 'ess' | 'rec' | 'opt') => {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    ess: { label: '🔴 Обязательно', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    rec: { label: '🟡 Рекомендовано', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    opt: { label: '🟢 Опционально', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  };
  const c = cfg[tier];
  return <span style={{ fontSize:6, fontWeight:700, padding:'1px 5px', borderRadius:3, background:c.bg, color:c.color, marginLeft:4 }}>{c.label}</span>;
};

export const phaseBadge = (phase: string) => {
  const colors: Record<string, string> = { blast:'#ef4444', cruise:'#f59e0b', pct:'#22c55e', bridge:'#6366f1', trt:'#3b82f6' };
  return <span style={{ fontSize:6, fontWeight:700, padding:'1px 4px', borderRadius:3, background:(colors[phase]||'#888')+'22', color:colors[phase]||'#888', marginLeft:4 }}>{phase === 'blast' ? 'Курс' : phase === 'cruise' ? 'Крейсер' : phase === 'pct' ? 'ПКТ' : phase === 'bridge' ? 'Мост' : phase === 'trt' ? 'TRT' : phase}</span>;
};

export const ItemRowTriage: React.FC<{ name: string; dose: string; timing: string; note: string; color: string; tier?: 'ess' | 'rec' | 'opt'; phase?: string }> = ({ name, dose, timing, note, color, tier, phase }) => (
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

export const renderRow = (x: any, i: number, color: string) => (
  <div key={i} style={{ padding:'6px 8px', borderRadius:6, marginBottom:4, background:'rgba(255,255,255,0.02)', border:'1px solid var(--border)' }}>
    <span style={{ fontSize:8, fontWeight:700, color:'var(--text-light)' }}>{x.n}</span>
    {x.d ? <span style={{ fontSize:7, color, marginLeft:4 }}>{x.d}</span> : null}
    <span style={{ fontSize:7, color:'var(--text-dim)', marginLeft:4 }}>· {x.t}</span>
    {x.o ? <div style={{ fontSize:7, color:'var(--text-dim)', marginTop:1 }}>💡 {x.o}</div> : null}
  </div>
);

export const renderPhase = (p: any, i: number) => (
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

export const timingBlock = (protocol: string, slots: Array<{time:string;items:Array<{n:string;why:string}>}>) => (
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

export const monitoringBlock = (markers: Array<{marker:string;target:string;when:string;action:string}>) => (
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

export const RX_NOTE = ' 💊 рецептурно — только по назначению врача';

export const StopBanner: React.FC<{ title: string; thresholds: string[] }> = ({ title, thresholds }) => (
  <div style={{ borderRadius:10, padding:'10px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
    <div style={{ fontSize:9, fontWeight:800, color:'#ef4444', marginBottom:4 }}>🛑 {title}</div>
    {thresholds.map((t: string, i: number) => (
      <div key={i} style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, marginBottom:2 }}>• {t}</div>
    ))}
  </div>
);

export const ContraBanner: React.FC<{ items: string[] }> = ({ items }) => (
  <div style={{ borderRadius:10, padding:'10px 12px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.25)' }}>
    <div style={{ fontSize:9, fontWeight:800, color:'#f59e0b', marginBottom:4 }}>⚠️ Что НЕ назначать / противопоказания</div>
    {items.map((t: string, i: number) => (
      <div key={i} style={{ fontSize:8, color:'#fcd34d', lineHeight:1.4, marginBottom:2 }}>• {t}</div>
    ))}
  </div>
);

export const CrossModuleLimitBanner: React.FC<{ substance: string; limit: string; current: string; warning: string }> = ({ substance, limit, current, warning }) => (
  <div style={{ borderRadius:10, padding:'10px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)' }}>
    <div style={{ fontSize:9, fontWeight:800, color:'#ef4444', marginBottom:4 }}>🚫 Кросс-модульный лимит: {substance}</div>
    <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, marginBottom:2 }}>• Текущая сумма из нескольких протоколов: {current}</div>
    <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4, marginBottom:2 }}>• Максимум по всем модулям: {limit}</div>
    <div style={{ fontSize:8, color:'#fca5a5', lineHeight:1.4 }}>• {warning}</div>
  </div>
);

export const PROTOCOL_CARDS = [
  { id:'symptoms', icon:'🩺', label:'Симптомы', desc:'Поиск и коррекция симптомов: база решений, дневник, приверженность', color:'#ef4444', system:'Общее', tags:['Симптомы','Решения','Дневник','Лабы'], kind:'reference' },
  { id:'emergency', icon:'🚑', label:'Экстренные состояния', desc:'Когда ехать в больницу: боль в груди, одышка, ТГВ, инсульт, ЖКТ-кровотечение, анафилаксия', color:'#ef4444', system:'Общее', tags:['Скорая','Инфаркт','ТЭЛА','Инсульт'], kind:'reference' },
  { id:'interactions', icon:'💬', label:'Взаимодействия', desc:'Единая матрица лекарственных взаимодействий: критические, высокие, средние пары', color:'#ef4444', system:'Общее', tags:['Статины','НПВС','GLP-1','Каберголин'], kind:'reference' },
  { id:'women', icon:'♀️', label:'Женщины и ААС', desc:'Вирилизация, пороги андрогенов, контрацепция, беременность, допустимые препараты', color:'#f472b6', system:'Репродуктивная', tags:['Вирилизация','Беременность','Контрацепция','Голос'], kind:'reference' },
  { id:'cost', icon:'💰', label:'Оптимизация стоимости', desc:'Тир-подход: core/advanced/optional. На чём нельзя экономить, что можно отложить', color:'#22c55e', system:'Общее', tags:['Бюджет','Core','Advanced','Optional'], kind:'reference' },
  { id:'neuro', icon:'🧠', label:'Нейропротекция', desc:'Нейротоксичность ААС: механизмы, калькулятор риска, протокол', color:'#06b6d4', system:'ЦНС', tags:['Нейротоксичность','BDNF','ГАМК','Глутамат'] },
  { id:'cardio', icon:'❤️', label:'Кардио', desc:'СС-защита: АД, липиды, фиброз, аритмии на ААС', color:'#ef4444', system:'ССС', tags:['АД','Липиды','Аритмия','Фиброз'] },
  { id:'hepatic', icon:'🫁', label:'Печень', desc:'Гепатопротекция: 17α-алкилированные, ферменты, стеатоз', color:'#84cc16', system:'Печень', tags:['АЛТ/АСТ','Холестаз','Стеатоз'] },
  { id:'renal', icon:'💧', label:'Почки', desc:'Нефропротекция: RAAS, протеинурия, СКФ, электролиты', color:'#3b82f6', system:'Почки', tags:['СКФ','Протеинурия','RAAS'] },
  { id:'joints', icon:'🦴', label:'Суставы', desc:'Здоровье суставов: коллаген, гиалуронан, сухожилия', color:'#22c55e', system:'ОДА', tags:['Коллаген','Сухожилия','Воспаление'] },
  { id:'acne', icon:'🔴', label:'Акне', desc:'Андроген-индуцированное акне: топика, системная, рубцы', color:'#f97316', system:'Кожа', tags:['Андрогены','Себум','Рубцы'] },
  { id:'injections', icon:'💉', label:'Инъекции', desc:'Техника, осложнения, постинъекционные абсцессы', color:'#14b8a6', system:'Общее', tags:['Техника','Абсцесс','Стерильность'], kind:'reference' },
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
  { id:'steatosis', icon:'🫁', label:'Стеатоз', desc:'НАЖБП/ХБП: берберин, TUDCA, омега-3 EPA', color:'#84cc16', system:'Печень', tags:['НАЖБП','Стеатоз','Фиброз'] },
  { id:'raas', icon:'🫀', label:'RAAS (АД/Почки)', desc:'Ренин-ангиотензин: АД, протеинурия, ХБП, фиброз', color:'#3b82f6', system:'ССС', tags:['АД','RAAS','Протеинурия'] },
  { id:'peptide', icon:'🧬', label:'Пептиды', desc:'GHRP, BPC-157, ноотропы, иммунные — справочник', color:'#2dd4bf', system:'Общее', tags:['GHRP','BPC-157','Ноотропы'], kind:'reference' },
  { id:'postcycle', icon:'🔄', label:'Постцикл', desc:'Реабилитация после курса: липиды, HCT, HPTA, нейро', color:'#8b5cf6', system:'Общее', tags:['HPTA','ПКТ','Липиды','Гематокрит'] },
  { id:'pct', icon:'💊', label:'ПКТ', desc:'Послекурсовая терапия: SERM, hCG, HPTA-восстановление', color:'#22c55e', system:'Гормоны', tags:['ПКТ','SERM','hCG','HPTA'] },
  { id:'fertility', icon:'👶', label:'Фертильность', desc:'Репродуктивное здоровье: спермограмма, гормоны, DFI', color:'#ec4899', system:'Репродуктивная', tags:['Сперма','Гормоны','DFI','ЭКО'] },
  { id:'hrt', icon:'🔄', label:'ГЗТ (HRT)', desc:'Заместительная гормональная терапия: протоколы, мониторинг', color:'#f59e0b', system:'Гормоны', tags:['ГЗТ','TRT','Замещение'] },
];
