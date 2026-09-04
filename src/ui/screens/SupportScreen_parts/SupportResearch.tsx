// @ts-nocheck
/**
 * SupportResearch.tsx — извлечено из SupportScreen.tsx
 * Секция: protocols
 */
import React, { useState } from 'react';
import { searchPubMed, type PubMedArticle } from '../../../engines/pubmed-search.engine';
import { SUPPORT_RESEARCH } from '../../../engines/support.engine';
import { PHARMA_DB } from '../../../core/pharma-database';
import { InfoErrorBoundary } from './SupportScreenData';

const SUBSTANCE_NAMES_RU: Record<string, string> = {
  telmisartan: 'Телмисартан', nebivolol: 'Небиволол', nac: 'NAC', tudca: 'TUDCA',
  omega3: 'Омега-3', magnesium: 'Магний', berberine: 'Берберин', coq10: 'CoQ10',
  vitamin_d3: 'Витамин D3', zinc: 'Цинк', hcg: 'ХГЧ', alpha_lipoic: 'α-Липоевая к-та',
  ashwagandha: 'Ашваганда', milk_thistle: 'Расторопша', melatonin: 'Мелатонин',
  curcumin: 'Куркумин', phosphatidylcholine: 'Фосфатидилхолин', l_carnitine: 'L-Карнитин',
  glucosamine: 'Глюкозамин', collagen: 'Коллаген', bpc157: 'BPC-157', tb500: 'TB-500',
  vitamin_c: 'Витамин C', vitamin_b12: 'Витамин B12', folate: 'Фолат',
  meloxicam: 'Мелоксикам', diclofenac: 'Диклофенак', selenium: 'Селен',
  taurine: 'Таурин', saw_palmetto: 'Палметто', egcg: 'EGCG', ginseng: 'Женьшень',
  vitamin_k2: 'Витамин K2', iron: 'Железо', hyaluronic: 'Гиалуроновая к-та',
  msm: 'MSM', boswellia: 'Босвеллия', bromelain: 'Бромелайн', probiotics: 'Пробиотики',
  copper: 'Медь', astragalus: 'Астрагал',
};

export const SupportResearch: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    pubMedQuery,
    setPubMedQuery,
    pubMedResults,
    setPubMedResults,
    pubMedLoading,
    setPubMedLoading,
    pubMedError,
    pubchemResults,
    setPubchemResults,
    pubchemLoading,
    pubchemError,
    fdaResults,
    setFdaResults,
    fdaLoading,
    fdaError,
    pharmaSearchQ,
    pharmaSearchResults,
    researchSource,
    setResearchSource,
    setTab,
    handlePubMedSearch,
    doPharmaSearch,
    handlePubchemSearch,
    handleFDASearch
  } = s;

  const [researchDbQuery, setResearchDbQuery] = useState('');

  return (
                <div className="sup-research">
                  <div style={{fontSize:13,fontWeight:700,color:'var(--accent)',marginBottom:4}}>🔬 Поиск исследований</div>
                  <div style={{fontSize:9,color:'var(--text-dim)',marginBottom:8}}>PubMed, PubChem, Google Scholar, OpenFDA, Каталог и база исследований</div>

                  {/* Source Pills */}
                  <div style={{display:'flex',gap:4,marginBottom:10,overflowX:'auto',scrollbarWidth:'none',flexShrink:0}}>
                    {([
                      {key:'pubmed',label:'📚 PubMed',color:'#3b82f6'},
                      {key:'pubchem',label:'🧪 PubChem',color:'#8b5cf6'},
                      {key:'scholar',label:'🎓 Scholar',color:'#f59e0b'},
                      {key:'fda',label:'💊 OpenFDA',color:'#ef4444'},
                      {key:'pharma',label:'📋 Каталог',color:'#00e68a'},
                      {key:'researchDb',label:'📖 База исследований',color:'#a855f7'},
                    ] as const).map((s: any) => (
                      <button key={s.key} onClick={() => {setResearchSource(s.key);if(s.key==='pubchem')handlePubchemSearch();if(s.key==='fda')handleFDASearch();}} style={{
                        padding:'7px 14px',borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0,
                        background: researchSource===s.key ? s.color : 'var(--bg-secondary)',
                        color: researchSource===s.key ? '#fff' : 'var(--text-dim)',
                        border: `1px solid ${researchSource===s.key ? s.color : 'var(--border)'}`,
                      }}>{s.label}</button>
                    ))}
                  </div>

                  {/* Shared search input */}
                  {researchSource !== 'researchDb' && (
                  <div style={{display:'flex',gap:6,marginBottom:10}}>
                    <input value={pubMedQuery} onChange={e=>setPubMedQuery(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'){if(researchSource==='pubmed')handlePubMedSearch();if(researchSource==='pubchem')handlePubchemSearch();if(researchSource==='fda')handleFDASearch();}}}
                      placeholder={researchSource==='pubmed'?'creatine muscle, NAC liver...':researchSource==='pubchem'?'caffeine, creatine, NAC...':researchSource==='fda'?'aspirin, metformin...':'Поиск по названию, классу...'}
                      style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
                    <button onClick={()=>{if(researchSource==='pubmed')handlePubMedSearch();if(researchSource==='pubchem')handlePubchemSearch();if(researchSource==='fda')handleFDASearch();}}
                      disabled={(researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading)}
                      style={{padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${researchSource==='pubmed'?'#3b82f6,#2563eb':researchSource==='pubchem'?'#8b5cf6,#7c3aed':researchSource==='fda'?'#ef4444,#dc2626':researchSource==='pharma'?'#00e68a,#00c853':'#3b82f6,#2563eb'})`,color:'#fff',fontWeight:700,fontSize:11,opacity:(researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading)?0.6:1}}>
                      {((researchSource==='pubmed'&&pubMedLoading)||(researchSource==='pubchem'&&pubchemLoading)||(researchSource==='fda'&&fdaLoading))?'⏳':researchSource==='scholar'?'🔗':'🔍'}
                    </button>
                  </div>
                  )}

                  {/* === PUBMED === */}
                  {researchSource === 'pubmed' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>📚 PubMed — научные статьи</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6}}>
                        <button onClick={()=>{setPubMedQuery('creatine supplementation strength performance');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Креатин</button>
                        <button onClick={()=>{setPubMedQuery('whey protein muscle hypertrophy');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Протеин</button>
                        <button onClick={()=>{setPubMedQuery('beta-alanine carnosine performance');handlePubMedSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>Бета-аланин</button>
                      </div>
                      {pubMedError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {pubMedError}</div>}
                      {pubMedResults.length>0&&<div style={{fontSize:9,color:'var(--text-dim)',marginBottom:6}}>Найдено: {pubMedResults.length} публикаций</div>}
                      <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:400,overflowY:'auto'}}>
                        {pubMedResults.map((a: any) =>(
                          <a key={a.pmid} href={a.url} target="_blank" rel="noopener noreferrer" style={{display:'block',padding:'8px 10px',borderRadius:8,background:'var(--bg-secondary)',border:'1px solid var(--border)',textDecoration:'none',color:'inherit'}}>
                            <div style={{fontSize:11,fontWeight:600,color:'var(--text-light)',lineHeight:1.3,marginBottom:2}}>{a.title}</div>
                            {a.authors.length > 0 && <div style={{fontSize:9,color:'var(--text-dim)'}}>{a.authors.slice(0, 3).join(', ')}{a.authors.length > 3 ? ' et al.' : ''}</div>}
                            <div style={{fontSize:9,color:'var(--text-dim)'}}>{a.journal}{a.pubDate ? ` · ${a.pubDate}` : ''}</div>
                            {a.abstract&&<div style={{fontSize:9,color:'rgba(255,255,255,0.5)',lineHeight:1.3,marginTop:2,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{a.abstract}</div>}
                          </a>
                        ))}
                        {pubMedResults.length===0&&!pubMedLoading&&!pubMedError&&<div style={{padding:16,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите запрос для поиска публикаций</div>}
                      </div>
                    </div>
                  )}

                  {/* === PUBCHEM === */}
                  {researchSource === 'pubchem' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>🧪 PubChem — химическая информация</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[{label:'Кофеин',q:'caffeine'},{label:'Креатин',q:'creatine'},{label:'L-цитруллин',q:'L-citrulline'},{label:'Таурин',q:'taurine'},{label:'L-тирозин',q:'L-tyrosine'},{label:'Бета-аланин',q:'beta-alanine'}].map((p: any) =>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);handlePubchemSearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      {pubchemError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {pubchemError}</div>}
                      {pubchemLoading&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>⏳ Поиск в PubChem...</div>}
                      {pubchemResults.map((r: any, i: any) =>(
                        <div key={i} style={{padding:'10px 12px',borderRadius:10,background:'var(--bg-secondary)',border:'1px solid var(--border)',marginBottom:8}}>
                          <div style={{fontSize:12,fontWeight:700,color:'#8b5cf6',marginBottom:4}}>{r.name}</div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:9,color:'var(--text-dim)'}}>
                            <div><b>Формула:</b> {r.formula}</div>
                            <div><b>Мол. масса:</b> {typeof r.mw === 'number' ? r.mw.toFixed(2) + ' г/моль' : r.mw}</div>
                            <div style={{gridColumn:'1/-1'}}><b>IUPAC:</b> {r.iupac}</div>
                          </div>
                        </div>
                      ))}
                      {pubchemResults.length===0&&!pubchemLoading&&!pubchemError&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите название соединения (на английском) и нажмите 🔍</div>}
                    </div>
                  )}

                  {/* === GOOGLE SCHOLAR === */}
                  {researchSource === 'scholar' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>🎓 Google Scholar — научные публикации</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[
                          {label:'Тестостерон и гипертрофия',q:'тестостерон мышечная гипертрофия'},
                          {label:'NAC гепатопротекция',q:'NAC гепатопротекция печень'},
                          {label:'Омега-3 кардио',q:'омега-3 сердечно-сосудистая система'},
                          {label:'Креатин сила',q:'креатин силовые показатели'},
                          {label:'Метформин anti-aging',q:'metformin anti-aging longevity'},
                          {label:'Витамин D спортсмены',q:'витамин D спортсмены дефицит'},
                        ].map((p: any) =>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:'var(--text-dim)',marginBottom:8}}>Поиск откроется в новой вкладке Google Scholar</div>
                      <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(pubMedQuery)}`} target="_blank" rel="noopener noreferrer"
                        style={{display:'inline-block',padding:'10px 20px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'#000',fontWeight:700,fontSize:12,textDecoration:'none',textAlign:'center'}}>
                        🎓 Искать в Google Scholar: {pubMedQuery || '(введите запрос)'}
                      </a>
                    </div>
                  )}

                  {/* === OPENFDA === */}
                  {researchSource === 'fda' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>💊 OpenFDA — официальные инструкции препаратов</h4>
                      <div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>
                        {[{label:'Аспирин',q:'aspirin'},{label:'Метформин',q:'metformin'},{label:'Тестостерон',q:'testosterone'},{label:'Тамоксифен',q:'tamoxifen'},{label:'Кломифен',q:'clomiphene'}].map((p: any) =>(
                          <button key={p.q} onClick={()=>{setPubMedQuery(p.q);handleFDASearch();}} style={{padding:'3px 8px',borderRadius:4,fontSize:8,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{p.label}</button>
                        ))}
                      </div>
                      {fdaError&&<div style={{padding:8,background:'rgba(239,68,68,0.06)',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:10,marginBottom:8}}>⚠ {fdaError}</div>}
                      {fdaLoading&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>⏳ Поиск в OpenFDA...</div>}
                      <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:400,overflowY:'auto'}}>
                        {fdaResults.map((r: any, i: any) =>(
                          <div key={i} style={{padding:'8px 10px',borderRadius:8,background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
                            <div style={{fontSize:11,fontWeight:700,color:'#ef4444',marginBottom:2}}>{r.brandName}</div>
                            <div style={{fontSize:9,color:'var(--text-dim)',marginBottom:2}}>{r.genericName}</div>
                            <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',lineHeight:1.3,display:'-webkit-box',WebkitLineClamp:4,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{r.indications}</div>
                            {r.manufacturer !== '—' && <div style={{fontSize:8,color:'var(--text-dim)',marginTop:2}}>Производитель: {r.manufacturer}</div>}
                          </div>
                        ))}
                        {fdaResults.length===0&&!fdaLoading&&!fdaError&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите название препарата (на английском) и нажмите 🔍</div>}
                      </div>
                    </div>
                  )}

                  {/* === PHARMA CATALOG SEARCH === */}
                  {researchSource === 'pharma' && (
                    <div className="card" style={{marginBottom:12}}>
                      <h4 style={{margin:'0 0 6px',fontSize:12}}>💊 Поиск препаратов и добавок</h4>
                      <div style={{display:'flex',gap:6,marginBottom:8}}>
                        <input value={pharmaSearchQ} onChange={e=>doPharmaSearch(e.target.value)}
                          placeholder="Поиск по названию, классу или категории..."
                          style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:300,overflowY:'auto'}}>
                        {pharmaSearchResults.map((r: any) =>(
                          <div key={r.id} style={{padding:'6px 10px',borderRadius:6,background:r.cls==='supplement'?'rgba(0,230,138,0.04)':'rgba(139,92,246,0.04)',border:`1px solid ${r.cls==='supplement'?'rgba(0,230,138,0.15)':'rgba(139,92,246,0.15)'}`,cursor:'pointer',fontSize:10}} onClick={()=>{
                            if(PHARMA_DB[r.id]) { setTab('catalog' as any); }
                          }}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontWeight:600,color:r.cls==='supplement'?'#00e68a':'#a78bfa'}}>{r.name}</span>
                              <span style={{fontSize:8,padding:'1px 5px',borderRadius:4,background:r.cls==='supplement'?'rgba(0,230,138,0.1)':'rgba(139,92,246,0.1)',color:r.cls==='supplement'?'#00e68a':'#a78bfa'}}>{r.cls}</span>
                            </div>
                            {r.desc&&<div style={{fontSize:8,color:'var(--text-dim)',marginTop:2,lineHeight:1.3}}>{r.desc}</div>}
                          </div>
                        ))}
                        {pharmaSearchResults.length===0&&pharmaSearchQ.length>2&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Ничего не найдено</div>}
                        {pharmaSearchQ.length<=2&&<div style={{padding:12,textAlign:'center',color:'var(--text-dim)',fontSize:10}}>Введите минимум 3 символа</div>}
                      </div>
                    </div>
                  )}

                  {/* === RESEARCH DATABASE (static curated references) === */}
                  {researchSource === 'researchDb' && (
                    <div>
                      <div style={{display:'flex',gap:6,marginBottom:10}}>
                        <input value={researchDbQuery} onChange={e=>setResearchDbQuery(e.target.value)}
                          placeholder="Поиск по веществу..."
                          style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
                      </div>
                      {Object.entries(SUPPORT_RESEARCH)
                        .filter(([id]) => !researchDbQuery || SUBSTANCE_NAMES_RU[id]?.toLowerCase().includes(researchDbQuery.toLowerCase()) || id.includes(researchDbQuery.toLowerCase()))
                        .sort(([a], [b]) => (SUBSTANCE_NAMES_RU[a] || a).localeCompare(SUBSTANCE_NAMES_RU[b] || b))
                        .map(([id, entries]) => (
                          <div key={id} style={{padding:'10px 12px',borderRadius:10,background:'var(--bg-secondary)',border:'1px solid var(--border)',marginBottom:8}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                              <span style={{fontSize:12,fontWeight:700,color:'#a855f7'}}>{SUBSTANCE_NAMES_RU[id] || id}</span>
                              <span style={{fontSize:8,padding:'2px 6px',borderRadius:4,background:'rgba(168,85,247,0.1)',color:'#a855f7'}}>{entries.length} {entries.length === 1 ? 'исследование' : 'исследования'}</span>
                            </div>
                            {entries.map((e, i) => (
                              <div key={i} style={{padding:'6px 8px',borderRadius:6,background:'rgba(0,0,0,0.08)',marginBottom:i < entries.length - 1 ? 4 : 0}}>
                                <div style={{fontSize:9,color:'#60a5fa',fontWeight:600,marginBottom:2,fontStyle:'italic'}}>📄 {e.study}</div>
                                <div style={{fontSize:9,color:'var(--text-dim)',lineHeight:1.4,marginBottom:2}}>{e.conclusion}</div>
                                <div style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Год: {e.year}</div>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Quick Research Links — expanded Russian presets */}
                  {researchSource !== 'researchDb' && (
                  <div className="card" style={{marginBottom:12}}>
                    <h4 style={{margin:'0 0 6px',fontSize:12}}>📚 Быстрый поиск по темам</h4>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {[
                        {label:'Тестостерон и мышечная масса',q:'testosterone muscle mass hypertrophy'},
                        {label:'NAC и печень',q:'NAC liver hepatoprotection'},
                        {label:'Омега-3 и сердце',q:'omega-3 cardiovascular protection'},
                        {label:'Тренболон токсичность',q:'trenbolone cardiotoxicity hepatotoxicity'},
                        {label:'Креатин эффективность',q:'creatine supplementation strength performance'},
                        {label:'Витамин D и тестостерон',q:'vitamin D testosterone men'},
                        {label:'Ашваганда кортизол',q:'ashwagandha cortisol stress'},
                        {label:'BPC-157 заживление',q:'BPC-157 tendon healing angiogenesis'},
                        {label:'Селен и щитовидная',q:'selenium thyroid function'},
                        {label:'Коэнзим Q10 сердце',q:'coenzyme Q10 heart failure cardioprotection'},
                        {label:'Сон и мелатонин',q:'melatonin sleep quality circadian'},
                        {label:'Куркумин воспаление',q:'curcumin inflammation NF-kB'},
                        {label:'Бета-аланин выносливость',q:'beta-alanine carnosine endurance performance'},
                        {label:'Цитруллин и NO',q:'citrulline malate nitric oxide blood flow'},
                        {label:'Магний и сон',q:'magnesium glycinate sleep quality anxiety'},
                        {label:'Цинк и иммунитет',q:'zinc supplementation immune function testosterone'},
                        {label:'L-карнитин жиросжигание',q:'L-carnitine fat oxidation exercise performance'},
                        {label:'HMB и катаболизм',q:'HMB beta-hydroxy beta-methylbutyrate muscle protein breakdown'},
                        {label:'Глютамин и кишечник',q:'glutamine intestinal permeability gut health'},
                        {label:'Коллаген и суставы',q:'collagen peptides joint pain osteoarthritis'},
                      ].map((preset: any) =>(
                        <button key={preset.q} onClick={()=>{setPubMedQuery(preset.q);handlePubMedSearch();}} style={{padding:'5px 10px',borderRadius:6,fontSize:9,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-light)'}}>{preset.label}</button>
                      ))}
                    </div>
                  </div>
                  )}
                </div>
              
  );
};
