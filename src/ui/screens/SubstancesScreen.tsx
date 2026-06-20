import React, { useState } from 'react';
import { PHARMA_DB, SUBSTANCES_BY_CLASS } from '../../core/pharma-database';
import { db } from '../../core/db';

const CLASS_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон', trenbolone: 'Тренболон', nandrolone: 'Нандролон',
  boldenone: 'Болденон', primobolan: 'Примоболан', oral_17aa: 'Оральные 17-АА',
  sarm: 'SARMs', peptide_ghrh: 'GHRH', peptide_ghrp: 'GHRP',
  igf1: 'IGF-1', mgf: 'MGF', insulin: 'Инсулин',
  pct_serm: 'СЕРМ', pct_aromatase: 'Ингибиторы ароматазы', pct_dopamine: 'Дофаминовые агонисты',
  support: 'Поддержка'
};

const CLASS_COLORS: Record<string, string> = {
  testosterone: '#ff6b6b', trenbolone: '#ff9f43', nandrolone: '#feca57',
  boldenone: '#48dbfb', primobolan: '#0abde3', oral_17aa: '#ee5a24',
  sarm: '#a29bfe', peptide_ghrh: '#55efc4', peptide_ghrp: '#00b894',
  igf1: '#81ecec', mgf: '#74b9ff', insulin: '#fd79a8',
  pct_serm: '#6c5ce7', pct_aromatase: '#a29bfe', pct_dopamine: '#dfe6e9',
  support: '#00e68a'
};

export const SubstancesScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allClasses = Object.keys(SUBSTANCES_BY_CLASS).filter(k => SUBSTANCES_BY_CLASS[k].length > 0);
  const filteredClasses = selectedClass === 'all' ? allClasses : [selectedClass];

  const filteredSubstances = filteredClasses.flatMap(cls =>
    (SUBSTANCES_BY_CLASS[cls] ?? [])
      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="screen substances">
      <h2>Справочник веществ</h2>

      <div className="card" style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="&#128270; Поиск по названию..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button className={'btn secondary' + (selectedClass === 'all' ? ' active' : '')} style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setSelectedClass('all')}>Все</button>
          {allClasses.map(cls => (
            <button key={cls} className={'btn secondary' + (selectedClass === cls ? ' active' : '')} style={{ fontSize: 11, padding: '4px 10px', borderColor: selectedClass === cls ? CLASS_COLORS[cls] : undefined }} onClick={() => setSelectedClass(cls)}>
              {CLASS_LABELS[cls] ?? cls}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
        Найдено: {filteredSubstances.length} веществ
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredSubstances.map(s => {
          const isExpanded = expandedId === s.id;
          const color = CLASS_COLORS[s.class] ?? '#00e68a';
          return (
            <div key={s.id} className="card" style={{ margin: 0, cursor: 'pointer', borderLeft: `3px solid ${color}` }} onClick={() => toggleExpand(s.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{CLASS_LABELS[s.class] ?? s.class}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {s.esters && s.esters.length > 0 && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'var(--accent-dim)', color: 'var(--accent)' }}>{s.esters.join(', ')}</span>}
                  <span style={{ fontSize: 16, color: 'var(--text-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 8 }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>T½ (часов)</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color }}>{s.pk.halfLifeHours}</div>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>Биодоступность</div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{(s.pk.bioavailability * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--accent)' }}>Фармакодинамика</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {[
                      { label: 'AR сродство', value: s.pd.AR_affinity },
                      { label: 'Ароматизация', value: s.pd.aromatization },
                      { label: '5-α редуктаза', value: s.pd.five_alpha_reduction },
                      { label: 'Гестагенность', value: s.pd.progestogenic },
                      { label: 'Гепатотоксичность', value: s.pd.hepatotoxicity },
                      { label: 'Липиды', value: s.pd.lipid_impact },
                      { label: 'Гематокрит', value: s.pd.hct_impact },
                      { label: 'Нейротоксичность', value: s.pd.neuro_toxicity },
                    ].map(item => {
                      const val = item.value;
                      const absVal = Math.abs(val);
                      const colorVal = absVal === 0 ? 'var(--success)' : absVal < 0.5 ? 'var(--text-light)' : absVal < 1 ? 'var(--warning)' : 'var(--danger)';
                      return (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                          <span style={{ color: 'var(--text-dim)' }}>{item.label}</span>
                          <span style={{ fontWeight: 600, color: colorVal }}>{val}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                    EC50: {s.ec50} · Хилл: {s.n_hill} · Макс. эффект: {(s.maxEffect * 100).toFixed(0)}%
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button onClick={() => {
                      const dr = s.dosageRange; const val = dr ? Math.round((dr.min+dr.max)/2) : 250; const unit = dr?.unit||'mg/wk';
                      db.put('course_log', { id:crypto.randomUUID(), substanceId:s.id, doseValue:val, doseUnit:unit, frequency:dr?.frequency||'2x/wk', startWeek:1, endWeek:12 }).catch(()=>{});
                    }} style={{
                      flex:1, padding:'6px 10px', borderRadius:6, border:'none', cursor:'pointer',
                      fontSize:10, fontWeight:600, background:'rgba(0,230,138,0.12)', color:'#00e68a',
                    }}>+ В план</button>
                    <button onClick={() => {
                      try { const e=JSON.parse(localStorage.getItem('supportCart')||'[]'); if(!e.some((x:any)=>x.id===s.id)) localStorage.setItem('supportCart', JSON.stringify([...e,{id:s.id,name:s.name,dose:'—',timing:'daily'}])); } catch{}
                    }} style={{
                      flex:1, padding:'6px 10px', borderRadius:6, border:'none', cursor:'pointer',
                      fontSize:10, fontWeight:600, background:'rgba(245,158,11,0.12)', color:'#f59e0b',
                    }}>🛒 В корзину</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredSubstances.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#128138;</div>
          <div style={{ color: 'var(--text-dim)' }}>Ничего не найдено. Попробуйте другой запрос.</div>
        </div>
      )}
    </div>
  );
};