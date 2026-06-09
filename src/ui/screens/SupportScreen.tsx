import React, { useState, useMemo } from 'react';
import { SYNERGY_PAIRS, SUPPLEMENT_DESCRIPTIONS, SUPPLEMENT_TARGETS, SUPPORT_RESEARCH, calculateSupport, type SupportInput, type SynergyPair, type SupplementTarget } from '../../engines/support.engine';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../../core/constants';
import { PHARMA_DB, PHARMA_CLASSES } from '../../core/pharma-database';
import { useDataLink } from '../../core/data-link';
import { SYSTEM_INFO } from '../../core/risk-info';
import { getRiskColor } from '../../core/utils/risk-colors';
import { SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { SUBSTANCES_BY_CLASS } from '../../core/pharma-database';

type SupportTab = 'catalog' | 'synergies' | 'recommendations' | 'calculator';

const SYNERGY_COLORS: Record<string, string> = {
  synergistic: '#22c55e',
  additive: '#84cc16',
  potentiative: '#3b82f6',
  complementary: '#8b5cf6',
  antagonistic: '#ef4444',
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
  const [prescribedMeds, setPrescribedMeds] = useState<Record<string, boolean>>({});
  const [supportResult, setSupportResult] = useState<{ riskBefore: Record<string, number>; riskAfter: Record<string, number>; score: number } | null>(null);

  // Combine SUPPLEMENT_DESCRIPTIONS with support substances from PHARMA_DB
  const supplementList = useMemo(() => {
    // First add supplements from SUPPLEMENT_DESCRIPTIONS
    const supplements = Object.entries(SUPPLEMENT_DESCRIPTIONS).map(([id, desc]) => ({
      id,
      name: id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: desc,
      targets: SUPPLEMENT_TARGETS[id] as SupplementTarget | undefined,
      research: SUPPORT_RESEARCH[id],
      isSupportSubstance: false,
    }));
    
    // Add support substances from PHARMA_DB (classes: support, peptide_regenerative, peptide_nootropic, peptide_immune)
    const supportClasses = ['support', 'peptide_regenerative', 'peptide_nootropic', 'peptide_immune'] as const;
    const supportSubstances = Object.values(PHARMA_DB).filter(s => 
      supportClasses.includes(s.class as typeof supportClasses[number])
    );
    
    const supportSupplements = supportSubstances.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || 'Поддерживающий препарат класса ' + s.class,
      targets: undefined,
      research: s.research || [],
      isSupportSubstance: true,
    }));
    
    return [...supplements, ...supportSupplements];
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
          // Check the class from PHARMA_DB
          const substance = Object.values(PHARMA_DB).find(sub => sub.id === s.id);
          return substance?.class === supportClassFilter;
        } else {
          // Supplements from SUPPLEMENT_DESCRIPTIONS don't have a class, so show all
          return true;
        }
      });
    }
    return list;
  }, [supplementList, searchQuery, systemFilter, supportClassFilter]);

  const filteredSynergies = useMemo(() => {
    let pairs = SYNERGY_PAIRS;
    if (synergyFilter !== 'all') {
      pairs = pairs.filter(p => p.synergyType === synergyFilter);
    }
    if (systemFilter !== 'all') {
      pairs = pairs.filter(p => p.affectedSystems?.includes(systemFilter));
    }
    return pairs;
  }, [synergyFilter, systemFilter]);

  const handleCalculateSupport = () => {
    const input: SupportInput = {
      userId: linked.profile.id || 'current-user',
      substances: linked.course.map(c => c.substanceId),
      goals: [linked.profile.settings?.goal ?? 'maintenance'],
      labs: linked.labs.map(l => ({ code: l.code, value: l.value })),
      demographics: { age: linked.profile.settings?.age ?? 30, weight: linked.profile.settings?.weight ?? 70, sex: (linked.profile.settings?.sex ?? 'male') as 'male' | 'female' },
      genetics: linked.profile.settings?.genetics,
      nutritionFactor: linked.profile.settings?.nutritionFactor ?? 1.0,
      trainingFactor: linked.profile.settings?.trainingFactor ?? 1.0,
      drugDoses: Object.fromEntries(Object.entries(linked.activeDrugs).map(([k, v]) => [k, v.dosePerWeek])),
    };
    const result = calculateSupport(input);
    const riskBefore: Record<string, number> = {};
    const riskAfter: Record<string, number> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      riskBefore[sys] = result.riskAssessment?.systemBreakdown?.[sys]?.raw ?? 0;
      riskAfter[sys] = result.riskAssessment?.systemBreakdown?.[sys]?.net ?? 0;
    }
    setSupportResult({ riskBefore, riskAfter, score: result.supportScore ?? 0 });
  };

  const systemLabels: Record<string, string> = Object.fromEntries(ALL_RISK_SYSTEMS.map(k => [k, SYSTEM_INFO[k]?.label ?? k]));

  const selectedDetail = selectedSub ? supplementList.find(s => s.id === selectedSub) : null;

  return (
    <div className="screen support-screen">
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {(['catalog', 'synergies', 'recommendations'] as SupportTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: tab === t ? 'var(--accent-green, #00e68a)' : 'var(--bg-secondary)',
            color: tab === t ? '#000' : 'var(--text-dim)', cursor: 'pointer', transition: 'background 0.15s',
          }}>
            {t === 'catalog' ? 'Каталог' : t === 'synergies' ? 'Синергии' : 'Рекомендации'}
          </button>
        ))}
      </div>

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

      {tab === 'synergies' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <select value={synergyFilter} onChange={e => setSynergyFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}>
              <option value="all">Все типы</option>
              <option value="synergistic">Синергия</option>
              <option value="additive">Аддитивный</option>
              <option value="potentiative">Потенцирование</option>
              <option value="complementary">Комплементарный</option>
            </select>
            <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}>
              <option value="all">Все системы</option>
              {ALL_RISK_SYSTEMS.map(s => <option key={s} value={s}>{systemLabels[s]}</option>)}
            </select>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>
              {filteredSynergies.length} пар
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '70vh', overflowY: 'auto' }}>
            {filteredSynergies.map((pair, i) => (
              <div key={i} className="card" style={{ padding: 12, marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{(SUPPLEMENT_DESCRIPTIONS[pair.substanceA] || pair.substanceA.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).split(' ').length > 5 ? pair.substanceA.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : SUPPLEMENT_DESCRIPTIONS[pair.substanceA] || pair.substanceA}</span>
                    <span style={{ fontSize: 16, color: SYNERGY_COLORS[pair.synergyType] || '#888' }}>
                      {pair.synergyType === 'synergistic' ? '\u2295' : pair.synergyType === 'additive' ? '+' : pair.synergyType === 'potentiative' ? '\u21D1' : '\u2192'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{(SUPPLEMENT_DESCRIPTIONS[pair.substanceB] || pair.substanceB.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).split(' ').length > 5 ? pair.substanceB.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : SUPPLEMENT_DESCRIPTIONS[pair.substanceB] || pair.substanceB}</span>
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
            ))}
          </div>
        </div>
      )}

      {tab === 'recommendations' && (
        <div>
          <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '0 0 12px 0' }}>
              Автоматический подбор поддержки на основе текущего курса, анализов и рисков
            </p>
            <button onClick={handleCalculateSupport} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--accent-green, #00e68a)', color: '#000', fontWeight: 700, fontSize: 14,
            }}>
              Рассчитать оптимальную поддержку
            </button>
          </div>

          {supportResult && (
            <div>
              <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Индекс поддержки</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: getRiskColor(100 - supportResult.score), lineHeight: 1 }}>
                  {Math.round(supportResult.score)}%
                </div>
              </div>
              <div className="card" style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Риски по системам — до и после поддержки</h4>
                {RISK_SYSTEMS.map(sys => {
                  const before = supportResult.riskBefore[sys] ?? 0;
                  const after = supportResult.riskAfter[sys] ?? 0;
                  const reduction = before > 0 ? ((before - after) / before * 100) : 0;
                  return (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: 14 }}>{SYSTEM_INFO[sys]?.icon || ''}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{systemLabels[sys]}</span>
                      <span style={{ fontSize: 12, color: getRiskColor(before), fontWeight: 600 }}>{Math.round(before)}%</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{'\u2192'}</span>
                      <span style={{ fontSize: 12, color: getRiskColor(after), fontWeight: 600 }}>{Math.round(after)}%</span>
                      {reduction > 0 && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>{'\u2193'}{reduction.toFixed(0)}%</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};