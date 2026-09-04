// @ts-nocheck
/**
 * supportProtocolsShared.tsx — обновлённая визуальная система протоколов.
 * Карточки с глубиной, чипы крупнее, типографика 12-13px, консистентные отступы.
 */
import React from 'react';

const baseCard: React.CSSProperties = {
  background: 'rgba(24,24,27,0.55)',
  borderRadius: 16,
  padding: 14,
  border: '1px solid rgba(255,255,255,0.07)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
};

export const cardBg: React.CSSProperties = { ...baseCard };

export const pillActive = (c: string): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap' as const,
  cursor: 'pointer',
  background: c,
  color: '#000',
  border: `1px solid ${c}`,
  boxShadow: `0 2px 12px ${c}35`,
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
});

export const pillInactive = (): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap' as const,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.08)',
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
});

export const PhaseLabel: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className="sup-phaselabel" style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}30` }}>{label}</span>
);

export const ItemRow: React.FC<{ name: string; dose: string; timing: string; note: string; color: string }> = ({ name, dose, timing, note, color }) => (
  <div className="sup-itemrow" style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{name}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{dose}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>{timing}</span>
      </div>
    </div>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, marginTop: 4 }}>{note}</div>
  </div>
);

export const triageBadge = (tier: 'ess' | 'rec' | 'opt') => {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    ess: { label: '🔴 Обязательно', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    rec: { label: '🟡 Рекомендовано', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    opt: { label: '🟢 Опционально', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  };
  const c = cfg[tier];
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.color}28`, marginLeft: 6 }}>{c.label}</span>;
};

export const phaseBadge = (phase: string) => {
  const colors: Record<string, string> = { blast: '#ef4444', cruise: '#f59e0b', pct: '#22c55e', bridge: '#6366f1', trt: '#3b82f6' };
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 20, background: (colors[phase] || '#888') + '18', color: colors[phase] || '#888', border: `1px solid ${(colors[phase] || '#888')}25`, marginLeft: 6 }}>{phase === 'blast' ? 'Курс' : phase === 'cruise' ? 'Крейсер' : phase === 'pct' ? 'ПКТ' : phase === 'bridge' ? 'Мост' : phase === 'trt' ? 'TRT' : phase}</span>;
};

export const ItemRowTriage: React.FC<{ name: string; dose: string; timing: string; note: string; color: string; tier?: 'ess' | 'rec' | 'opt'; phase?: string }> = ({ name, dose, timing, note, color, tier, phase }) => (
  <div style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>{name}{tier ? triageBadge(tier) : null}{phase ? phaseBadge(phase) : null}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{dose}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>{timing}</span>
      </div>
    </div>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, marginTop: 4 }}>{note}</div>
  </div>
);

export const renderRow = (x: any, i: number, color: string) => (
  <div key={i} style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{x.n}</span>
      {x.d ? <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}14`, padding: '2px 7px', borderRadius: 20, border: `1px solid ${color}22` }}>{x.d}</span> : null}
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>· {x.t}</span>
    </div>
    {x.o ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${color}55` }}>💡 {x.o}</div> : null}
  </div>
);

export const renderPhase = (p: any, i: number) => (
  <div key={i} style={{ borderRadius: 16, background: p.color + '0A', border: '1px solid ' + p.color + '22', padding: 14, backdropFilter: 'blur(10px)' }}>
    <div style={{ fontSize: 13, fontWeight: 850, color: p.color, letterSpacing: '-0.2px' }}>{p.phase}</div>
    <div style={{ fontSize: 11, fontWeight: 700, color: p.color + 'CC', marginBottom: 4 }}>{p.label}</div>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>{p.condition}</div>
    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 10, lineHeight: 1.45 }}>{p.desc}</div>
    {p.items.map((x: any, xi: number) => (
      <div key={xi} style={{ padding: '9px 10px', borderRadius: 10, marginBottom: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{x.name}</span>
          <span style={{ fontSize: 11, color: p.color, fontWeight: 800, background: `${p.color}14`, padding: '2px 7px', borderRadius: 20, border: `1px solid ${p.color}22` }}>{x.dose}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>· {x.timing}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 1.4 }}>{x.note}</div>
      </div>
    ))}
  </div>
);

export const timingBlock = (protocol: string, slots: Array<{ time: string; items: Array<{ n: string; why: string }> }>) => (
  <div style={cardBg}>
    <div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⏰</span> Тайминг приёма
    </div>
    {slots.map((slot: any, si: number) => (
      <div key={si} style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>{slot.time}</div>
        {slot.items.map((x: any, xi: number) => (
          <div key={xi} style={{ padding: '8px 10px', borderRadius: 10, marginBottom: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{x.n}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 8 }}>— {x.why}</span>
          </div>
        ))}
      </div>
    ))}
  </div>
);

export const monitoringBlock = (markers: Array<{ marker: string; target: string; when: string; action: string }>) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={cardBg}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🧪</span> Лабораторный мониторинг
      </div>
      {markers.map((m: any, i: number) => (
        <div key={i} style={{ padding: '12px', borderRadius: 12, marginBottom: 8, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.10)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa' }}>{m.marker}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', background: 'rgba(59,130,246,0.12)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.18)' }}>{m.when}</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}><b style={{ color: '#60a5fa' }}>Цель: {m.target}</b></div>
          <div style={{ fontSize: 11, color: '#93c5fd', lineHeight: 1.4, padding: '8px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)' }}>💡 {m.action}</div>
        </div>
      ))}
    </div>
  </div>
);

export const RX_NOTE = ' 💊 рецептурно — только по назначению врача';

export const StopBanner: React.FC<{ title: string; thresholds: string[] }> = ({ title, thresholds }) => (
  <div style={{ borderRadius: 14, padding: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', backdropFilter: 'blur(10px)' }}>
    <div style={{ fontSize: 12, fontWeight: 850, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(239,68,68,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🛑</span> {title}</div>
    {thresholds.map((t: string, i: number) => (
      <div key={i} style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.5, marginBottom: 3, paddingLeft: 8, borderLeft: '2px solid rgba(239,68,68,0.25)' }}>• {t}</div>
    ))}
  </div>
);

export const ContraBanner: React.FC<{ items: string[] }> = ({ items }) => (
  <div style={{ borderRadius: 14, padding: '14px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)', backdropFilter: 'blur(10px)' }}>
    <div style={{ fontSize: 12, fontWeight: 850, color: '#f59e0b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(245,158,11,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>⚠️</span> Что НЕ назначать / противопоказания</div>
    {items.map((t: string, i: number) => (
      <div key={i} style={{ fontSize: 11, color: '#fcd34d', lineHeight: 1.5, marginBottom: 3, paddingLeft: 8, borderLeft: '2px solid rgba(245,158,11,0.25)' }}>• {t}</div>
    ))}
  </div>
);

export const CrossModuleLimitBanner: React.FC<{ substance: string; limit: string; current: string; warning: string }> = ({ substance, limit, current, warning }) => (
  <div style={{ borderRadius: 14, padding: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', backdropFilter: 'blur(10px)' }}>
    <div style={{ fontSize: 12, fontWeight: 850, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(239,68,68,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🚫</span> Кросс-модульный лимит: {substance}</div>
    <div style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.5, marginBottom: 2 }}>• Текущая сумма из нескольких протоколов: <b>{current}</b></div>
    <div style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.5, marginBottom: 2 }}>• Максимум по всем модулям: <b>{limit}</b></div>
    <div style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }}>• {warning}</div>
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

// ── PRE-CYCLE CHECKLIST + STOP-TABLE (аудит 2026-09: единая точка входа перед курсом) ──
export const PRE_CYCLE_LABS: Array<{ marker: string; target: string }> = [
  { marker:'АД (среднее 7 дней, утро+вечер)', target:'<130/85' },
  { marker:'Липиды: ЛПВП / ЛПНП / ТГ', target:'ЛПВП >40 · ЛПНП <130 · ТГ <150 мг/дл' },
  { marker:'Печень: АЛТ / АСТ / ГГТ / ЩФ / билирубин', target:'АЛТ/АСТ <40 · ГГТ <55 · бил <21 мкмоль/л' },
  { marker:'Кровь: Hct / Hb / PLT / фибриноген', target:'Hct 42-50% · Hb 13.5-17.5 · PLT 150-350' },
  { marker:'Гормоны: T общ / E2 / PRL / ЛГ / ФСГ', target:'E2 20-60 пг/мл · PRL <600 мМЕ/л' },
  { marker:'Почки: креатинин / СКФ + цистатин C при массе >100 кг', target:'СКФ >90 · UACR <30' },
  { marker:'Глюкоза натощак / HbA1c', target:'<5.6 ммоль/л · <6.0%' },
  { marker:'K⁺ / Na⁺ / Mg²⁺', target:'K 3.5-5.0 · Na 135-145 · Mg >0.75' },
  { marker:'ЭКГ (+ ЭХО при стаже ААС / GH / дозах >1 г/нед)', target:'QTc <450м/<460ж · ФВ >55%' },
  { marker:'ПСА (мужчины >40)', target:'<2.5 нг/мл' },
  { marker:'Спермограмма (при планах фертильности)', target:'До курса (база для ПКТ)' },
  { marker:'УЗИ ЖКБ (перед берберином/УДХК/TUDCA)', target:'Нет камней/сладжа (иначе — колика)' },
];

export const STOP_COURSE_TABLE: Array<{ cond: string; action: string }> = [
  { cond:'АД >160/100', action:'Стоп курса' },
  { cond:'ЛПВП <20 мг/дл', action:'Немедленный стоп' },
  { cond:'Hct >54% (симптомы гипервязкости — раньше)', action:'Стоп + флеботомия' },
  { cond:'АЛТ/АСТ >5×ВГН или билирубин >34 мкмоль/л', action:'Стоп оральных + гепатолог' },
  { cond:'E2 >120 + симптомы / E2 <20 (перелечили)', action:'AI-титрация / отмена AI' },
  { cond:'PRL >2000 + головные боли/поля зрения', action:'МРТ + эндокринолог' },
  { cond:'K⁺ >5.5 / <3.0 · Na⁺ <125', action:'Экстренная коррекция (см. Электролиты Ф4)' },
  { cond:'Глюкоза >11.1 / HbA1c >6.5%', action:'Эндокринолог (СД)' },
  { cond:'Боль в груди / одышка / ТГВ-признаки / мелена / анафилаксия', action:'103/112 немедленно (см. Экстренные)' },
];

export const PreCycleChecklist: React.FC = () => (
  <div style={{ borderRadius:14, padding:'12px 14px', background:'rgba(34,197,94,0.07)', border:'1px solid rgba(34,197,94,0.22)' }}>
    <div style={{ fontSize:12, fontWeight:850, color:'#22c55e', marginBottom:8 }}>✅ Pre-cycle чеклист — сдать ДО курса (иначе фазы не от чего титровать)</div>
    {PRE_CYCLE_LABS.map((x, i) => (
      <div key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.75)', lineHeight:1.5, paddingLeft:8, borderLeft:'2px solid rgba(34,197,94,0.25)', marginBottom:3 }}>
        • {x.marker} — <b style={{color:'#22c55e'}}>{x.target}</b>
      </div>
    ))}
    <div style={{ fontSize:12, fontWeight:850, color:'#ef4444', margin:'10px 0 8px' }}>🛑 Стоп-таблица — отмена курса + врач</div>
    {STOP_COURSE_TABLE.map((x, i) => (
      <div key={i} style={{ fontSize:11, color:'#fca5a5', lineHeight:1.5, paddingLeft:8, borderLeft:'2px solid rgba(239,68,68,0.25)', marginBottom:3 }}>
        • {x.cond} — <b>{x.action}</b>
      </div>
    ))}
  </div>
);

export const EVIDENCE_LEGEND = 'Уровни доказательности в протоколах: A — РКИ/гайды (телмисартан, УДХК 13-15 мг/кг, эзетимиб, каберголин); B — когорты/мета-анализы (силимарин, берберин, омега-3); C — механизм/консенсус без РКИ у мужчин на ААС (DIM, кальций-D-глюкарат, NMN/NR, PQQ, D-рибоза, ГАМК — не замена препаратам).';
