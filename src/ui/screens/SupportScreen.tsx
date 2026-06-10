import React, { useState, useMemo, useEffect } from 'react';
import { SYNERGY_PAIRS, SUPPLEMENT_DESCRIPTIONS, SUPPLEMENT_TARGETS, SUPPORT_RESEARCH, calculateSupport, type SupportInput, type SynergyPair, type SupplementTarget } from '../../engines/support.engine';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../../core/constants';
import { PHARMA_DB } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';
import { SYSTEM_INFO_ALL } from '../../core/risk-info';
import { getRiskColor } from '../../core/utils/risk-colors';
import { SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { INTERACTIONS_DB } from '../../data/interactions';
import { generateWeeklyProtocol } from '../../engines/auto-plan.engine';
import type { CourseEntry } from '../../core/types';

type SupportTab = 'catalog' | 'synergies' | 'calculator' | 'interactions' | 'protocol';

const SYNERGY_COLORS: Record<string, string> = {
  synergistic: '#22c55e',
  additive: '#84cc16',
  potentiative: '#3b82f6',
  complementary: '#8b5cf6',
  antagonistic: '#ef4444',
};

const SUPPORT_CLASS_LABELS: Record<string, string> = {
  support: '💊 Поддержка',
  peptide_regenerative: '🧬 Регенерация',
  peptide_nootropic: '🧠 Ноотропы',
  peptide_immune: '🛡 Иммунная',
  bady: '🌿 БАДы',
};

export const SupportScreen: React.FC<{ initialTab?: SupportTab }> = ({ initialTab }) => {
  const linked = useDataLink();
  const [tab, setTab] = useState<SupportTab>(initialTab || 'catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [synergyFilter, setSynergyFilter] = useState<string>('all');
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [supportClassFilter, setSupportClassFilter] = useState<string>('all');
  const [supportLevel, setSupportLevel] = useState<'basic' | 'standard' | 'enhanced' | 'maximum'>('standard');
  const [supportGoal, setSupportGoal] = useState('muscle_gain');
  const [supportDrugs, setSupportDrugs] = useState<string[]>([]);
  const [autoLevel, setAutoLevel] = useState<'basic' | 'standard' | 'enhanced' | 'maximum'>('standard');
  const [expandedMed, setExpandedMed] = useState<string | null>(null);
  const [activeSystems, setActiveSystems] = useState<Record<string, boolean>>({
    cardio: true, hepatic: true, renal: true, neuro: true, endocrine: true, hematologic: true, reproductive: true, musculoskeletal: true,
  });
  const [supportResult, setSupportResult] = useState<ReturnType<typeof calculateSupport> | null>(null);
  const [autoProtocol, setAutoProtocol] = useState<ReturnType<typeof generateWeeklyProtocol> | null>(null);

  const SUPPORT_LEVELS: Record<string, { label: string; desc: string; subs: string[] }> = {
    basic: { label: 'Базовый минимум', desc: 'Обязательная защита печени и ССС', subs: ['nac', 'omega3', 'vitamin_d3'] },
    standard: { label: 'Умный среднячок', desc: 'Комплексная защита всех ключевых систем + суставы', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'vitamin_k2', 'vitamin_b12', 'glucosamine', 'collagen'] },
    enhanced: { label: 'Усиление', desc: 'Максимальная защита + нейро + почки + кровь + суставы + антиоксиданты', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'berberine', 'ashwagandha', 'alpha_lipoic', 'vitamin_k2', 'selenium', 'milk_thistle', 'vitamin_b12', 'folate', 'taurine', 'glucosamine', 'msm', 'collagen', 'vitamin_c', 'bpc157'] },
    maximum: { label: 'Полный максимум', desc: 'Абсолютная защита + рецептурные + ХГЧ + все системы + суставы + пептиды', subs: ['nac', 'omega3', 'tudca', 'magnesium', 'vitamin_d3', 'coq10', 'zinc', 'berberine', 'ashwagandha', 'alpha_lipoic', 'telmisartan', 'nebivolol', 'saw_palmetto', 'hcg', 'vitamin_k2', 'selenium', 'milk_thistle', 'probiotics', 'vitamin_b12', 'folate', 'iron', 'copper', 'astragalus', 'taurine', 'melatonin', 'ginseng', 'egcg', 'curcumin', 'phosphatidylcholine', 'l_carnitine', 'glucosamine', 'chondroitin', 'msm', 'collagen', 'hyaluronic', 'boswellia', 'vitamin_c', 'bromelain', 'bpc157', 'tb500'] },
  };

  useEffect(() => {
    const s = linked.profile?.settings;
    if (!s) return;
    const goalMap: Record<string, string> = { bulk: 'muscle_gain', cut: 'fat_loss', strength: 'strength', endurance: 'endurance', recomp: 'recomp', maintenance: 'maintenance' };
    const goal = s.goal || s.primaryGoal || 'maintenance';
    if (goalMap[goal]) setSupportGoal(goalMap[goal]);
    if (linked.course.length > 0) setSupportDrugs(linked.course.map(c => c.substanceId));
  }, []);

  useEffect(() => {
    const HIGH_RISK = ['trenbolone_acetate', 'trenbolone_enanthate', 'methandienone', 'stanozolol', 'oxandrolone'];
    const ORAL_17AA = ['methandienone', 'stanozolol', 'oxandrolone', 'halodrol'];
    let hasHighRisk = false, hasOral = false, count = supportDrugs.length;
    for (const id of supportDrugs) {
      if (HIGH_RISK.includes(id)) hasHighRisk = true;
      if (ORAL_17AA.includes(id)) hasOral = true;
    }
    let level: 'basic' | 'standard' | 'enhanced' | 'maximum' = 'basic';
    if (hasHighRisk || (hasOral && count >= 2)) level = 'maximum';
    else if (hasOral || count >= 3) level = 'enhanced';
    else if (count >= 1) level = 'standard';
    setAutoLevel(level);
    setSupportLevel(level);
  }, [supportDrugs]);

  const calcSupport = () => {
    const s = linked.profile?.settings;
    const input: SupportInput = {
      userId: linked.profile?.id || 'current',
      substances: supportDrugs.length > 0 ? supportDrugs : (linked.course?.map(c => c.substanceId) || []),
      goals: [supportGoal],
      labs: (linked.labs || []).map(l => ({ code: l.code, value: l.value })),
      demographics: { age: s?.age ?? 30, weight: s?.weight ?? 80, sex: (s?.sex ?? 'male') as 'male' | 'female' },
      genetics: s?.genetics,
      nutritionFactor: s?.nutritionFactor ?? 0.8,
      trainingFactor: s?.trainingFactor ?? 0.7,
      drugDoses: Object.fromEntries((linked.course || []).map(c => [c.substanceId, c.doseValue])),
    };
    setSupportResult(calculateSupport(input));
  };

  useEffect(() => { if (supportDrugs.length > 0) calcSupport(); }, [supportDrugs, supportGoal, supportLevel]);

  // Interaction checker state
  const [interactionIds, setInteractionIds] = useState<string[]>(['', '']);
  const [interactionSearch, setInteractionSearch] = useState('');
  const [interactionSearchIdx, setInteractionSearchIdx] = useState<number>(0);

  // Combine SUPPLEMENT_DESCRIPTIONS with support substances from PHARMA_DB
  const supplementList = useMemo(() => {
    const supplements = Object.entries(SUPPLEMENT_DESCRIPTIONS).map(([id, desc]) => ({
      id,
      name: id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: desc,
      targets: SUPPLEMENT_TARGETS[id] as SupplementTarget | undefined,
      research: SUPPORT_RESEARCH[id],
      isSupportSubstance: false,
    }));
    
    const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'] as const;
    const supportSubstances = Object.values(PHARMA_DB).filter(s => 
      supportClasses.includes(s.class as typeof supportClasses[number])
    );
    
    const supportSupplements = supportSubstances.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || 'Поддерживающий препарат класса ' + SUPPORT_CLASS_LABELS[s.class] || s.class,
      targets: undefined,
      research: s.research || [],
      isSupportSubstance: true,
      pharmaClass: s.class,
    }));
    
    return [...supplements, ...supportSupplements];
  }, []);

  // All support substances for interaction checker
  const allSupport = useMemo(() => supplementList, [supplementList]);

  // Support-only synergy pairs
  const supportSynergies = useMemo(() => {
    return SYNERGY_PAIRS.filter(p => {
      const a = PHARMA_DB[p.substanceA];
      const b = PHARMA_DB[p.substanceB];
      const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'];
      // Include: both are support substances, or at least one is a supplement
      const aIsSupport = a ? supportClasses.includes(a.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceA] !== undefined;
      const bIsSupport = b ? supportClasses.includes(b.class) : SUPPLEMENT_DESCRIPTIONS[p.substanceB] !== undefined;
      return aIsSupport || bIsSupport;
    });
  }, []);

  const filteredSupplements = useMemo(() => {
    let list = supplementList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    if (systemFilter !== 'all') {
      list = list.filter(s => s.targets?.systems?.includes(systemFilter));
    }
    if (supportClassFilter !== 'all') {
      list = list.filter(s => {
        if (s.isSupportSubstance) {
          const substance = Object.values(PHARMA_DB).find(sub => sub.id === s.id);
          return substance?.class === supportClassFilter;
        } else {
          return true;
        }
      });
    }
    return list;
  }, [supplementList, searchQuery, systemFilter, supportClassFilter]);

  const filteredSynergies = useMemo(() => {
    let pairs = supportSynergies;
    if (synergyFilter !== 'all') {
      pairs = pairs.filter(p => p.synergyType === synergyFilter);
    }
    if (systemFilter !== 'all') {
      pairs = pairs.filter(p => p.affectedSystems?.includes(systemFilter));
    }
    return pairs;
  }, [synergyFilter, systemFilter, supportSynergies]);

  const systemLabels: Record<string, string> = Object.fromEntries(ALL_RISK_SYSTEMS.map(k => [k, SYSTEM_INFO_ALL[k]?.label ?? k]));

  const selectedDetail = selectedSub ? supplementList.find(s => s.id === selectedSub) : null;

  // Interaction checker
  const addInteraction = () => setInteractionIds([...interactionIds, '']);
  const removeInteraction = (idx: number) => setInteractionIds(interactionIds.filter((_, i) => i !== idx));
  const updateInteraction = (idx: number, value: string) => {
    const updated = [...interactionIds];
    updated[idx] = value;
    setInteractionIds(updated);
  };
  const validInteractionIds = interactionIds.filter(Boolean);
  
  const supportInteractions = useMemo(() => {
    if (validInteractionIds.length < 2) return null;
    const subs: Record<string, string> = {};
    validInteractionIds.forEach(id => {
      const s = allSupport.find(x => x.id === id);
      if (s) subs[id] = s.name;
    });
    try {
      return INTERACTIONS_DB.filter(i => {
        const a = i.substanceA.toUpperCase();
        const b = i.substanceB.toUpperCase();
        return validInteractionIds.some(id => {
          const up = id.toUpperCase();
          return a === up || a.includes(up) || up.includes(a);
        }) && validInteractionIds.some(id => {
          const up = id.toUpperCase();
          return b === up || b.includes(up) || up.includes(b);
        });
      });
    } catch { return []; }
  }, [interactionIds, allSupport]);

  const hasSupportInteractions = supportInteractions && supportInteractions.length > 0;
  const supportSynergiesList = supportInteractions?.filter(i => i.type === 'synergy') ?? [];
  const supportConflicts = supportInteractions?.filter(i => i.type === 'conflict') ?? [];
  const supportCautions = supportInteractions?.filter(i => i.type === 'caution') ?? [];

  return (
    <div className="screen support-screen">
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(['catalog', 'synergies', 'calculator', 'interactions', 'protocol'] as SupportTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: tab === t ? 'var(--accent-green, #00e68a)' : 'var(--bg-secondary)',
            color: tab === t ? '#000' : 'var(--text-dim)', cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap',
          }}>
            {t === 'catalog' ? '📖 Каталог' : t === 'synergies' ? '🔗 Синергии' : t === 'calculator' ? '🧮 Калькулятор' : t === 'interactions' ? '⚡ Взаимод.' : '📅 Протокол'}
          </button>
        ))}
      </div>

      {/* ===== CATALOG ===== */}
      {tab === 'catalog' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск добавки..." style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 13 }} />
            <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}>
              <option value="all">Все системы</option>
              {ALL_RISK_SYSTEMS.map(s => <option key={s} value={s}>{systemLabels[s]}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '4px 8px' }}>Классы:</span>
            <button onClick={() => setSupportClassFilter('all')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'all' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'all' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Все</button>
            <button onClick={() => setSupportClassFilter('support')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'support' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'support' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Поддержка</button>
            <button onClick={() => setSupportClassFilter('peptide_regenerative')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_regenerative' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_regenerative' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Регенерация</button>
            <button onClick={() => setSupportClassFilter('peptide_nootropic')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_nootropic' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_nootropic' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Ноотропы</button>
            <button onClick={() => setSupportClassFilter('peptide_immune')} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, border: supportClassFilter === 'peptide_immune' ? '1px solid var(--accent-green)' : '1px solid var(--border)', background: supportClassFilter === 'peptide_immune' ? 'rgba(0,230,138,0.1)' : 'transparent', color: 'var(--text-light)', cursor: 'pointer' }}>Иммунная</button>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: selectedDetail ? '0 0 280px' : 1, maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredSupplements.map(sub => (
                <div key={sub.id} onClick={() => setSelectedSub(sub.id)} style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  background: selectedSub === sub.id ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary)',
                  border: selectedSub === sub.id ? '1px solid var(--accent-green, #00e68a)' : '1px solid transparent',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{sub.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {sub.targets?.systems?.slice(0, 3).map(s => systemLabels[s] || s).join(', ')}{(sub.targets?.systems?.length ?? 0) > 3 ? ' +' + (sub.targets!.systems!.length - 3) : ''}
                  </div>
                </div>
              ))}
              {filteredSupplements.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>Ничего не найдено</div>}
            </div>
            {selectedDetail && (
              <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 8px 0' }}>{selectedDetail.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '0 0 12px 0' }}>{selectedDetail.description}</p>
                {selectedDetail.targets && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Системы:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {selectedDetail.targets.systems?.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', color: 'var(--accent-green, #00e68a)' }}>{systemLabels[s] || s}</span>
                      ))}
                    </div>
                    {selectedDetail.targets.biomarkers && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Биомаркеры: {selectedDetail.targets.biomarkers.join(', ')}</div>}
                    {selectedDetail.targets.mechanisms && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Механизмы: {selectedDetail.targets.mechanisms.join(', ')}</div>}
                  </div>
                )}
                {selectedDetail.research && selectedDetail.research.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Исследования:</div>
                    {selectedDetail.research.map((r, ri) => (
                      <div key={ri} style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{r.conclusion}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.study} ({r.year})</div>
                      </div>
                    ))}
                  </div>
                )}
                {SYNERGY_PAIRS.filter(p => p.substanceA === selectedDetail.id || p.substanceB === selectedDetail.id).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Синергии:</div>
                {SYNERGY_PAIRS.filter(p => p.substanceA === selectedDetail.id || p.substanceB === selectedDetail.id).map((pair, i) => {
                  const partner = pair.substanceA === selectedDetail.id ? pair.substanceB : pair.substanceA;
                  const partnerName = SUPPLEMENT_DESCRIPTIONS[partner] || (partner as string).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: SYNERGY_COLORS[pair.synergyType] || '#888' }} />
                      <span style={{ fontWeight: 500 }}>{partnerName}</span>
                      <span style={{ color: SYNERGY_COLORS[pair.synergyType] || 'var(--text-dim)', fontSize: 10 }}>{pair.synergyType === 'synergistic' ? 'синергия' : pair.synergyType === 'additive' ? 'аддитивный' : pair.synergyType === 'potentiative' ? 'потенцирование' : 'комплементарный'}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{(pair.strength * 100).toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SYNERGIES ===== */}
      {tab === 'synergies' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>🔗 Синергии поддержки</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>
              Взаимодействия между препаратами поддержки, БАДами и добавками
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={synergyFilter} onChange={e => setSynergyFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, flex: 1 }}>
                <option value="all">Все типы</option>
                <option value="synergistic">Синергия</option>
                <option value="additive">Аддитивный</option>
                <option value="potentiative">Потенцирование</option>
                <option value="complementary">Комплементарный</option>
              </select>
              <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, flex: 1 }}>
                <option value="all">Все системы</option>
                {ALL_RISK_SYSTEMS.map(s => <option key={s} value={s}>{systemLabels[s]}</option>)}
              </select>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                {filteredSynergies.length} пар
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '70vh', overflowY: 'auto' }}>
            {filteredSynergies.map((pair, i) => {
              const aName = SUPPLEMENT_DESCRIPTIONS[pair.substanceA] || PHARMA_DB[pair.substanceA]?.name || pair.substanceA;
              const bName = SUPPLEMENT_DESCRIPTIONS[pair.substanceB] || PHARMA_DB[pair.substanceB]?.name || pair.substanceB;
              return (
                <div key={i} className="card" style={{ padding: 12, marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{aName}</span>
                      <span style={{ fontSize: 16, color: SYNERGY_COLORS[pair.synergyType] || '#888' }}>
                        {pair.synergyType === 'synergistic' ? '\u2295' : pair.synergyType === 'additive' ? '+' : pair.synergyType === 'potentiative' ? '\u21D1' : '\u2192'}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{bName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: SYNERGY_COLORS[pair.synergyType] + '22', color: SYNERGY_COLORS[pair.synergyType] }}>
                        {pair.synergyType === 'synergistic' ? 'Синергия' : pair.synergyType === 'additive' ? 'Аддитивный' : pair.synergyType === 'potentiative' ? 'Потенцирование' : 'Комплементарный'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: SYNERGY_COLORS[pair.synergyType] }}>{(pair.strength * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>{pair.mechanism}</div>
                  {pair.affectedSystems && pair.affectedSystems.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {pair.affectedSystems.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,230,138,0.08)', color: 'var(--accent-green, #00e68a)' }}>{systemLabels[s] || s}</span>
                      ))}
                    </div>
                  )}
                  {pair.clinicalNote && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>{pair.clinicalNote}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== CALCULATOR ===== */}
      {tab === 'calculator' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>🧮 Калькулятор поддержки</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Расчёт индекса поддержки и снижения рисков на основе всех источников: препараты, анализы, питание, тренировки, генетика
            </p>
            <button onClick={calcSupport} style={{
              width: '100%', padding: '14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 15,
              boxShadow: '0 2px 8px rgba(0,230,138,0.3)',
            }}>
              Рассчитать поддержку
            </button>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>Цель</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[{ v: 'muscle_gain', l: 'Набор массы' }, { v: 'fat_loss', l: 'Сушка' }, { v: 'strength', l: 'Сила' }, { v: 'endurance', l: 'Выносливость' }, { v: 'recomp', l: 'Рекомпозиция' }, { v: 'maintenance', l: 'Поддержание' }].map(g => (
                <button key={g.v} onClick={() => setSupportGoal(g.v)} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  background: supportGoal === g.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                  border: supportGoal === g.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: supportGoal === g.v ? '#00e68a' : 'var(--text-dim)', fontWeight: supportGoal === g.v ? 700 : 400,
                }}>{g.l}</button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              Препаратов: <b style={{ color: 'var(--accent)' }}>{linked.course.length}</b> | Авто-уровень: <b style={{ color: '#8b5cf6' }}>{SUPPORT_LEVELS[autoLevel]?.label || autoLevel}</b>
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {(['basic', 'standard', 'enhanced', 'maximum'] as const).map(l => (
                  <button key={l} onClick={() => setSupportLevel(l)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                    background: supportLevel === l ? 'rgba(0,230,138,0.2)' : 'var(--bg-secondary)',
                    border: supportLevel === l ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: supportLevel === l ? '#00e68a' : 'var(--text-dim)', fontWeight: supportLevel === l ? 700 : 400,
                  }}>{SUPPORT_LEVELS[l]?.label}</button>
                ))}
              </div>
            </div>
          </div>

          {supportResult && (
            <>
              <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Индекс поддержки</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: (supportResult.supportScore ?? 100) > 70 ? '#22c55e' : (supportResult.supportScore ?? 100) > 40 ? '#eab308' : '#ef4444', lineHeight: 1 }}>
                  {Math.round(supportResult.supportScore ?? 0)}%
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, supportResult.supportScore ?? 0)}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #eab308, #22c55e)', borderRadius: 6 }} />
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📊 Риски — до и после поддержки</h4>
                {ALL_RISK_SYSTEMS.slice(0, 8).map(sys => {
                  const before = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 0;
                  const after = supportResult?.riskAssessment?.systemBreakdown?.[sys]?.net ?? 0;
                  const reduction = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
                  return (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid var(--border-color)', fontSize: 11 }}>
                      <span style={{ fontSize: 13, minWidth: 18 }}>{SYSTEM_INFO_ALL[sys]?.icon || ''}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{systemLabels[sys]}</span>
                      <span style={{ fontSize: 10, color: getRiskColor(before), fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{Math.round(before)}%</span>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>→</span>
                      <span style={{ fontSize: 10, color: getRiskColor(after), fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{Math.round(after)}%</span>
                      {reduction > 0 && <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>↓{reduction}%</span>}
                    </div>
                  );
                })}
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>🛡 Покрытие систем</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {Object.entries(activeSystems).map(([sys, _]) => {
                    const cov = supportResult?.systemSupport?.[sys] ?? 0;
                    const pct = Math.round(cov * 100);
                    return (
                      <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
                        <span style={{ fontSize: 10, flex: 1 }}>{sys === 'cardio' ? 'ССС' : sys === 'hepatic' ? 'Печень' : sys === 'renal' ? 'Почки' : sys === 'neuro' ? 'Нервы' : sys === 'endocrine' ? 'Эндо' : sys === 'hematologic' ? 'Кровь' : sys === 'reproductive' ? 'Репрод' : sys === 'musculoskeletal' ? 'Суставы' : sys}</span>
                        <div style={{ width: 35, background: 'rgba(255,255,255,0.08)', borderRadius: 2, height: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 20, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 12 }}>📋 Рекомендованные добавки</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {SUPPORT_LEVELS[supportLevel]?.subs?.slice(0, 15).map(id => (
                    <span key={id} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 500 }}>
                      {id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card" style={{ fontSize: 10, color: 'var(--text-dim)', padding: 8 }}>
                <div style={{ marginBottom: 2 }}>
                  <b>Общий риск:</b> до <span style={{ color: getRiskColor(supportResult?.riskBeforeSupport ?? 0), fontWeight: 600 }}>{Math.round(supportResult?.riskBeforeSupport ?? 0)}%</span>
                  {' → '}после <span style={{ color: getRiskColor(supportResult?.riskAfterSupport ?? 0), fontWeight: 600 }}>{Math.round(supportResult?.riskAfterSupport ?? 0)}%</span>
                </div>
                <div>Источники: {linked.course.length} препаратов, {linked.labs.length} анализов, питание, тренировки{linked.profile?.settings?.genetics ? ', генетика' : ''}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== INTERACTIONS ===== */}
      {tab === 'interactions' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>⚡ Взаимодействия поддержки</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Проверка синергий и конфликтов между препаратами поддержки и БАДами
            </p>
          </div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {interactionIds.map((id, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 18, fontWeight: 600 }}>#{idx + 1}</div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input type="text" value={interactionSearchIdx === idx ? interactionSearch : id ? (allSupport.find(s => s.id === id)?.name || id) : ''}
                        placeholder="🔍 Поиск препарата..."
                        onFocus={() => { setInteractionSearchIdx(idx); setInteractionSearch(''); }}
                        onChange={e => { setInteractionSearchIdx(idx); setInteractionSearch(e.target.value); if (!e.target.value) updateInteraction(idx, ''); }}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                      {interactionSearch && interactionSearchIdx === idx && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 160, overflowY: 'auto', marginTop: 2 }}>
                          {allSupport.filter(s => s.name.toLowerCase().includes(interactionSearch.toLowerCase()) || s.id.toLowerCase().includes(interactionSearch.toLowerCase())).map(s => (
                            <div key={s.id} onClick={() => { updateInteraction(idx, s.id); setInteractionSearch(''); }}
                              style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontWeight: id === s.id ? 700 : 400, color: id === s.id ? 'var(--accent)' : 'var(--text)' }}>{s.name}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{s.id}</span>
                            </div>
                          ))}
                          {allSupport.filter(s => s.name.toLowerCase().includes(interactionSearch.toLowerCase())).length === 0 && (
                            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)' }}>Ничего не найдено</div>
                          )}
                        </div>
                      )}
                    </div>
                    {interactionIds.length > 2 && (
                      <button onClick={() => removeInteraction(idx)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                      }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addInteraction} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.3)', color: '#00e68a',
            }}>+ Добавить препарат</button>
          </div>

          {validInteractionIds.length < 2 && (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Выберите минимум 2 препарата поддержки для проверки взаимодействий</div>
            </div>
          )}

          {validInteractionIds.length >= 2 && !hasSupportInteractions && (
            <div className="card" style={{ textAlign: 'center', padding: '16px', border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.05)' }}>
              <div style={{ fontSize: 11, color: '#4caf50', fontWeight: 600 }}>✓ Критических взаимодействий не обнаружено</div>
            </div>
          )}

          {hasSupportInteractions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {supportSynergiesList.length > 0 && (
                <div className="card">
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#22c55e' }}>⊕ Синергия ({supportSynergiesList.length})</h4>
                  {supportSynergiesList.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-light)' }}>
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>{i.substanceA} + {i.substanceB}</span>
                      <span>{i.notes}</span>
                    </div>
                  ))}
                </div>
              )}
              {supportConflicts.length > 0 && (
                <div className="card">
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#ef4444' }}>⚠ Конфликты ({supportConflicts.length})</h4>
                  {supportConflicts.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-light)' }}>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>{i.substanceA} + {i.substanceB}</span>
                      <span>{i.notes}</span>
                    </div>
                  ))}
                </div>
              )}
              {supportCautions.length > 0 && (
                <div className="card">
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#ff9800' }}>⚡ Осторожность ({supportCautions.length})</h4>
                  {supportCautions.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-light)' }}>
                      <span style={{ color: '#ff9800', fontWeight: 600 }}>{i.substanceA} + {i.substanceB}</span>
                      <span>{i.notes}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== PROTOCOL ===== */}
      {tab === 'protocol' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>📅 Недельный протокол</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Расписание приёма препаратов и добавок по дням недели
            </p>
            {!autoProtocol && (
              <button onClick={() => {
                const courseIds: { substanceId: string; dose: string }[] = linked.course.map(c => ({
                  substanceId: c.substanceId,
                  dose: `${c.doseValue} ${c.doseUnit}`,
                }));
                const goalId = linked.course.some(c => c.substanceId.includes('test')) ? 'mass_gain' : 'health';
                const protocol = generateWeeklyProtocol(goalId, courseIds as any, Object.keys(linked.supportCoverage || {}),
                  undefined, linked.course.some(c => c.substanceId.includes('test')) ? 'course' : 'baseline', []);
                setAutoProtocol(protocol);
              }} style={{
                width: '100%', padding: 12, background: 'var(--accent)', color: '#000',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}>
                📅 Сгенерировать протокол
              </button>
            )}
          </div>
          {autoProtocol && (
            <div className="card">
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
                Соблюдение: {autoProtocol.overallAdherenceScore}%
              </div>
              {autoProtocol.days.map((day: any, i: number) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 8, marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 2 }}>{day.date}</div>
                  {day.slots.map((slot: any, j: number) => (
                    <div key={j} style={{ marginLeft: 6, marginBottom: 2 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                        {slot.time === 'morning' ? '🌅 Утро' : slot.time === 'evening' ? '🌙 Вечер' : '☀️ День'}
                      </div>
                      {slot.substances.map((s: any, k: number) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
                          <span>{s.name}</span><span style={{ color: 'var(--accent)' }}>{s.dose}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={() => setAutoProtocol(null)} style={{
                background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 12px', fontSize: 10, cursor: 'pointer', marginTop: 6,
              }}>✕ Закрыть</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};