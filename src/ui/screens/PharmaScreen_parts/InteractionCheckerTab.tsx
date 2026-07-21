import React, { useState, useMemo, useEffect } from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import {
  checkDrugInteractions,
  getClassInstructions,
  getCourseRecommendations,
  findInteractionsForSubstance,
  calculateInteractions,
  filterAndSortInteractions,
  type InteractionAlert,
} from '../../../engines/interactions-calculator';
import { UnifiedInteractionCard } from '../../components/UnifiedInteractionCard';
import { SECTION_LABELS } from '../../../data/interactions-labels';
import type { CourseEntry } from '../../../core/types';
import { resolveInteractionId, type Interaction as SupportInteraction } from '../../../data/support-interactions-db';
import { SYNERGY_PAIRS } from '../../../engines/support.engine';
import { decodeGarbled } from '../../../utils/text-sanitizer';
import { useDataLink } from '../../../core/data-link';

export const InteractionCheckerTab: React.FC = () => {
  const linked = useDataLink();
  const [interactSub, setInteractSub] = useState<'interactions' | 'synergies' | 'unified'>('interactions');
  const [unifiedOnlyCritical, setUnifiedOnlyCritical] = useState(false);
  const [interactDetail, setInteractDetail] = useState<'conflicts' | 'instructions'>('conflicts');
  const PHARMA_INTERACT_FILTER = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','peptide_ghrh','peptide_ghrp','peptide_gnrh','peptide_fat_loss','peptide_other']);
  const allSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      !!s?.name && PHARMA_INTERACT_FILTER.has(s.class)
    );
  }, []);
  const PHARMA_INTERACT_FILTER_SYNERGY = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','peptide_ghrh','peptide_ghrp','peptide_gnrh','peptide_fat_loss','peptide_other']);
  const synergyToPharmaId = (id: string): string => {
    const map: Record<string, string> = {
      testosterone_enanthate: 'test_enan', testosterone_cypionate: 'test_cyp', testosterone_propionate: 'test_prop',
      trenbolone_acetate: 'tren_acet', trenbolone_enanthate: 'tren_enan', nandrolone_decanoate: 'deca',
      nandrolone_phenylprop: 'npp', boldenone_undecylenate: 'bold_undec', methenolone_enanthate: 'prim_enan',
      methandienone: 'methand', oxandrolone: 'oxan', oxymetholone: 'anadrol', stanozolol: 'stan',
      drostanolone_propionate: 'masteron', drostanolone_enanthate: 'masteron_enan',
      cabergoline: 'caberg', anastrozole: 'anastro', hcg: 'hcg', tamoxifen: 'tamox',
      clomiphene: 'clomi', letrozole: 'letrozole', raloxifene: 'raloxifene',
    };
    return map[id] || id;
  };

  const pharmaSynergyMap = useMemo(() => {
    const map: Record<string, Array<{ partnerId: string; partnerName: string; pair: typeof SYNERGY_PAIRS[0] }>> = {};
    const pharmaIds = new Set(allSubstances.map(s => s.id));
    for (const p of SYNERGY_PAIRS) {
      const aKey = synergyToPharmaId(p.substanceA);
      const bKey = synergyToPharmaId(p.substanceB);
      if (!pharmaIds.has(aKey) || !pharmaIds.has(bKey)) continue;
      if (!map[aKey]) map[aKey] = [];
      if (!map[bKey]) map[bKey] = [];
      const aName = (PHARMA_DB[aKey]?.name || p.substanceA).replace(/\(.*\)/, '').trim();
      const bName = (PHARMA_DB[bKey]?.name || p.substanceB).replace(/\(.*\)/, '').trim();
      map[aKey].push({ partnerId: bKey, partnerName: bName, pair: p });
      map[bKey].push({ partnerId: aKey, partnerName: aName, pair: p });
    }
    return map;
  }, []);

  const pharmaSubstancesWithSynergies = useMemo(() => {
    return allSubstances.filter(s => pharmaSynergyMap[s.id]?.length > 0).sort((a, b) => (b.name||'').localeCompare(a.name||''));
  }, []);

  const [selectedIds, setSelectedIds] = useState<string[]>(['', '']);
  const [doseMgWk, setDoseMgWk] = useState(300);
  const [interactSearch, setInteractSearch] = useState('');
  useEffect(() => {
    const courseIds = (linked.course || []).map(c => c.substanceId).filter(Boolean);
    if (courseIds.length > 0 && selectedIds.every(id => !id)) {
      setSelectedIds(courseIds.slice(0, Math.min(4, courseIds.length)));
    }
  }, [(linked.course || []).length]);

  const addDrug = () => setSelectedIds([...selectedIds, '']);
  const removeDrug = (idx: number) => setSelectedIds(selectedIds.filter((_, i) => i !== idx));
  const updateDrug = (idx: number, value: string) => {
    const updated = [...selectedIds];
    updated[idx] = value;
    setSelectedIds(updated);
  };

  const validIds = selectedIds.filter(Boolean);

  const interactFiltered = interactSearch
    ? allSubstances.filter(p => (p.name||'').toLowerCase().includes(interactSearch.toLowerCase()) || (p.class||'').toLowerCase().includes(interactSearch.toLowerCase()))
    : allSubstances;

  const unusedSubstances = useMemo(() => {
    return interactFiltered.filter(p => !selectedIds.includes(p.id));
  }, [interactFiltered, selectedIds]);

  const alerts = useMemo(() => {
    if (validIds.length < 2) return [];
    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`,
      substanceId: id,
      doseValue: doseMgWk,
      doseUnit: 'mg/wk',
      frequency: '2x/week',
      startWeek: 0,
      endWeek: 12,
    }));
    try {
      return checkDrugInteractions(course);
    } catch (e) {
      return [];
    }
  }, [selectedIds, doseMgWk]);

  const courseRecs = useMemo(() => {
    if (validIds.length < 1) return [];
    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`,
      substanceId: id,
      doseValue: doseMgWk,
      doseUnit: 'mg/wk',
      frequency: '2x/week',
      startWeek: 0,
      endWeek: 12,
    }));
    try {
      return getCourseRecommendations(course);
    } catch (e) {
      return [];
    }
  }, [validIds, doseMgWk]);

  const classInstructions = useMemo(() => {
    if (validIds.length < 1) return [];
    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`,
      substanceId: id,
      doseValue: doseMgWk,
      doseUnit: 'mg/wk',
      frequency: '2x/week',
      startWeek: 0,
      endWeek: 12,
    }));
    try {
      return getClassInstructions(course);
    } catch (e) {
      return [];
    }
  }, [validIds]);

  const hasAlerts = alerts.length > 0;
  const hasRecs = courseRecs.length > 0;
  const hasInstructions = classInstructions.length > 0;

  const supportCrossAlerts = useMemo(() => {
    if (validIds.length < 2) return [];
    const results: SupportInteraction[] = [];
    const resolvedIds = validIds.map(id => ({ original: id, resolved: resolveInteractionId(id) }));
    for (const { original: id, resolved: resolvedId } of resolvedIds) {
      const interactions = findInteractionsForSubstance(resolvedId);
      for (const inter of interactions) {
        const otherResolved = resolveInteractionId(inter.substanceA) === resolvedId ? resolveInteractionId(inter.substanceB) : resolveInteractionId(inter.substanceA);
        const otherOriginal = resolvedIds.find(r => r.resolved === otherResolved);
          if (otherOriginal && !results.some(r => r.id === inter.id)) {
          results.push(inter);
        }
      }
    }
    return results;
  }, [validIds]);

  const hasSupportAlerts = supportCrossAlerts.length > 0;

  const alertTypeColors: Record<InteractionAlert['type'], { bg: string; border: string; text: string; label: string }> = {
    critical: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#ef4444', label: 'КРИТИЧЕСКОЕ' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b', label: 'ВНИМАНИЕ' },
    info: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', text: '#3b82f6', label: 'ИНФОРМАЦИЯ' },
  };

  return (
    <div>
      {/* Sub-tab pills */}
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {(['interactions','synergies','unified'] as const).map(t => (
          <button key={t} onClick={() => setInteractSub(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: interactSub === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: interactSub === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${interactSub === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'interactions' ? '⚡ Взаимодействия' : t === 'synergies' ? '💥 Синергии и комбинации' : '🔬 Unified'}</button>
        ))}
      </div>

      {interactSub === 'synergies' ? (
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>💥 Синергии по препаратам</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
            Синергетические пары для каждого препарата каталога фармакологии и пептидов
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pharmaSubstancesWithSynergies.map(sub => {
              const synergies = pharmaSynergyMap[sub.id] || [];
              return (
                <div key={sub.id} style={{ borderRadius: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                    💊 {sub.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {synergies.map((s, i) => {
                      const p = s.pair;
                      const stColor = p.synergyType === 'synergistic' ? '#00e68a' : p.synergyType === 'additive' ? '#3b82f6' : p.synergyType === 'potentiative' ? '#f97316' : '#a855f7';
                      const stBg = p.synergyType === 'synergistic' ? 'rgba(0,230,138,0.08)' : p.synergyType === 'additive' ? 'rgba(59,130,246,0.08)' : p.synergyType === 'potentiative' ? 'rgba(249,115,22,0.08)' : 'rgba(168,85,247,0.08)';
                      return (
                        <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: stBg, border: `1px solid ${stColor}30` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${stColor}20`, color: stColor }}>
                              {p.synergyType === 'synergistic' ? '⊕ Синергия' : p.synergyType === 'additive' ? '+ Аддитивно' : p.synergyType === 'potentiative' ? '↗ Усиление' : '↔ Дополнение'}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: stColor }}>{Math.round(p.strength * 100)}%</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>+ {s.partnerName}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>{decodeGarbled(p.mechanism).slice(0, 150)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {pharmaSubstancesWithSynergies.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 12 }}>
                Нет синергий для отображения
              </div>
            )}
          </div>
        </div>
      ) : interactSub === 'unified' ? (() => {
        // Unified view: объединяет drug_interactions + support_db + pharma_rules
        // в один список с разделением effect/mechanism/recommendation.
        const validIdsForUnified = validIds.length > 0 ? validIds : [''];
        const courseForUnified: CourseEntry[] = validIdsForUnified.filter(Boolean).map((id, i) => ({
          id: `${id}-${i}`,
          substanceId: id,
          doseValue: doseMgWk,
          doseUnit: 'mg/wk',
          frequency: '2x/week',
          startWeek: 0,
          endWeek: 12,
        }));
        try {
          const result = calculateInteractions({
            substances: validIdsForUnified.filter(Boolean),
            course: courseForUnified.filter(c => c.substanceId),
          });
          const items = filterAndSortInteractions(result.all, unifiedOnlyCritical ? { onlyCritical: true } : {});
          return (
            <div style={{
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 10,
            }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>🔬 Unified View</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px 0' }}>
                Объединённый список из drug-каталога, БАД-каталога и AAS/PED правил
              </p>
              {/* Score gauge + filter toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Safety score:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: result.score < 50 ? '#ef4444' : result.score < 80 ? '#f59e0b' : '#00e68a' }}>
                  {result.score}/100
                </span>
                {result.blocked && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>⛔ BLOCKED</span>
                )}
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>·</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{result.all.length} пар</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>·</span>
                <span style={{ fontSize: 10, color: '#ef4444' }}>{result.bySeverity.CRITICAL.length} CRIT</span>
                <span style={{ fontSize: 10, color: '#f59e0b' }}>· {result.bySeverity.HIGH.length} HIGH</span>
                <button onClick={() => setUnifiedOnlyCritical(!unifiedOnlyCritical)} style={{
                  marginLeft: 'auto',
                  padding: '4px 10px', borderRadius: 12, fontSize: 9, fontWeight: 600,
                  cursor: 'pointer',
                  background: unifiedOnlyCritical ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: unifiedOnlyCritical ? '#000' : 'var(--text-dim)',
                  border: `1px solid ${unifiedOnlyCritical ? 'var(--accent)' : 'var(--border)'}`,
                }}>{unifiedOnlyCritical ? '🔓 Показать все' : '🔒 Только CRITICAL'}</button>
              </div>
              {/* Unified items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 12 }}>
                    {unifiedOnlyCritical ? '✅ Нет CRITICAL взаимодействий' : 'Нет взаимодействий'}
                  </div>
                ) : items.map((item, i) => (
                  <UnifiedInteractionCard key={i} item={item} />
                ))}
              </div>
            </div>
          );
        } catch (e) {
          return (
            <div style={{ textAlign: 'center', padding: 20, color: '#ef4444', fontSize: 12 }}>
              Ошибка: {String(e)}
            </div>
          );
        }
      }) : (<>
        {/* ── AUTO DETECTED ALERTS ── */}
        {hasAlerts && (
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: '14px 16px', marginBottom: 10,
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: '#ef4444' }}>🚨 Обнаруженные взаимодействия</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
              Автоматически обнаруженные взаимодействия для выбранной комбинации препаратов
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map((alert, i) => {
                const colors = alertTypeColors[alert.type];
                return (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: colors.bg, border: `1px solid ${colors.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 4,
                        background: `${colors.text}20`, color: colors.text, letterSpacing: 1,
                      }}>{colors.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: colors.text }}>
                        {alert.drugs.map(d => PHARMA_DB[d]?.name || d).join(' + ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>Механизм: </span>
                      {alert.mechanism}
                    </div>
                    <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.5, padding: '8px 10px', borderRadius: 6, background: `${colors.text}0a`, border: `1px solid ${colors.border}` }}>
                      <span style={{ fontWeight: 700 }}>Рекомендация: </span>
                      {alert.recommendation}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── COURSE RECOMMENDATIONS ── */}
        {hasRecs && (
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: '14px 16px', marginBottom: 10,
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: '#3b82f6' }}>📋 Рекомендации для курса</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
              Общие рекомендации по защите органов и лабораторному мониторингу
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {courseRecs.map((rec, i) => {
                const typeColor = rec.type === 'critical' ? '#ef4444' : rec.type === 'warning' ? '#f59e0b' : '#3b82f6';
                return (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: `${typeColor}08`, border: `1px solid ${typeColor}20`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: typeColor, marginBottom: 6 }}>
                      {rec.title}
                    </div>
                    {rec.items.map((item, j) => (
                      <div key={j} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, padding: '3px 0 3px 12px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: typeColor }}>•</span>
                        {item}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CLASS INSTRUCTIONS ── */}
        {hasInstructions && (
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: '14px 16px', marginBottom: 10,
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: '#f59e0b' }}>📋 Особые указания по классам</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
              Особые указания, мониторинг и предупреждения по каждому классу препаратов
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {classInstructions.map((cls, i) => (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>
                    💊 {cls.className}
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>Инструкции по применению</div>
                    {cls.instructions.map((inst, j) => (
                      <div key={j} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, padding: '2px 0 2px 12px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: '#00e68a' }}>•</span>
                        {inst}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#ff9800', marginBottom: 4 }}>🩸 Лабораторный мониторинг</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {cls.monitoring.map((m, j) => (
                        <span key={j} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,152,0,0.12)', color: '#ff9800' }}>{m}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>⚠ Предупреждения</div>
                    {cls.warnings.map((w, j) => (
                      <div key={j} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, padding: '2px 0 2px 12px', position: 'relative', borderLeft: '3px solid rgba(239,68,68,0.3)', marginBottom: 4 }}>
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ── PER-DRUG CONFLICTS & INSTRUCTIONS ── */}
      <div style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 10,
      }}>
        {/* Sub-sub tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:8 }}>
          {(['conflicts','instructions'] as const).map(t => (
            <button key={t} onClick={() => setInteractDetail(t)} style={{
              padding:'5px 12px', borderRadius:14, fontSize:10, fontWeight:600, cursor:'pointer',
              background: interactDetail === t ? 'rgba(239,68,68,0.12)' : 'transparent',
              color: interactDetail === t ? '#ef4444' : 'var(--text-dim)',
              border: `1px solid ${interactDetail === t ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
            }}>{t === 'conflicts' ? '🔴 Конфликты' : '📋 Особые указания'}</button>
          ))}
        </div>

        {interactDetail === 'conflicts' ? (
          <>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>⚡ Взаимодействия по препаратам</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Информация о взаимодействиях для каждого препарата каталога фармакологии и пептидов
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allSubstances.map(sub => {
                const conflicts = sub.conflicts || [];
                const linkedSubs = (sub.linkedSubstances || []).filter(ls => PHARMA_DB[ls.id]);
                if (conflicts.length === 0 && linkedSubs.length === 0) return null;
                return (
                  <div key={sub.id} style={{ borderRadius: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                      💊 {sub.name}
                    </div>
                    {conflicts.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>🔴 Конфликты</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {conflicts.map((c, i) => {
                            const sevBg = c.severity === 'HIGH' ? 'rgba(239,68,68,0.08)' : c.severity === 'MEDIUM' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)';
                            const sevBorder = c.severity === 'HIGH' ? 'rgba(239,68,68,0.2)' : c.severity === 'MEDIUM' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)';
                            const sevColor = c.severity === 'HIGH' ? '#ef4444' : c.severity === 'MEDIUM' ? '#f59e0b' : '#9e9e9e';
                            return (
                              <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: sevBg, border: `1px solid ${sevBorder}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: sevColor }}>{c.with}</span>
                                  <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: `${sevColor}18`, color: sevColor }}>
                                    {c.severity}
                                  </span>
                                </div>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{c.effect}</div>
                                {c.mechanism && (
                                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>Механизм: {c.mechanism}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {linkedSubs.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>🟢 Связанные вещества</div>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {linkedSubs.map((ls, i) => (
                            <span key={i} style={{ fontSize: 8, padding: '3px 6px', borderRadius: 4,
                              background: ls.type === 'synergy' ? 'rgba(34,197,94,0.08)' : 'rgba(255,23,68,0.08)',
                              border: `1px solid ${ls.type === 'synergy' ? 'rgba(34,197,94,0.2)' : 'rgba(255,23,68,0.2)'}`,
                              color: ls.type === 'synergy' ? '#22c55e' : '#ff1744',
                            }}>
                              {ls.type === 'synergy' ? '⊕' : '⊖'} {PHARMA_DB[ls.id]?.name || ls.id}: {ls.mechanism}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>📋 Особые указания по препаратам</h3>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0' }}>
              Особые указания для каждого препарата каталога
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allSubstances.map(sub => {
                const instructions = sub.specialInstructions || [];
                const contraindications = sub.contraindications || [];
                const sideEffects = sub.sideEffects || [];
                if (instructions.length === 0 && contraindications.length === 0 && sideEffects.length === 0) return null;
                return (
                  <div key={sub.id} style={{ borderRadius: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
                      💊 {sub.name}
                    </div>
                    {instructions.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>📋 Особые указания</div>
                        {instructions.map((si, j) => (
                          <div key={j} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, padding: '3px 0 3px 14px', position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 0, color: '#f59e0b' }}>•</span>
                            {si}
                          </div>
                        ))}
                      </div>
                    )}
                    {contraindications.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🚫 Противопоказания</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {contraindications.map((c, j) => (
                            <span key={j} style={{ fontSize: 8, padding: '3px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {sideEffects.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚠ Побочные эффекты</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {sideEffects.map((se: any, j: number) => {
                            const eff = typeof se === 'string' ? se : se.effect;
                            const freq = typeof se === 'string' ? null : se.frequency;
                            const freqOpacity = freq === 'common' ? 1 : freq === 'rare' ? 0.5 : 0.35;
                            return (
                              <span key={j} style={{ fontSize: 8, padding: '3px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', opacity: freqOpacity }}>{eff}</span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── SUPPORT CROSS-ALERTS ── */}
      {hasSupportAlerts && (
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 10,
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: '#a855f7' }}>🔗 Кросс-взаимодействия с поддержкой</h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px 0' }}>
            Взаимодействия между выбранными препаратами и веществами поддержки
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {supportCrossAlerts.map((inter, i) => (
              <div key={i} style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#a855f7' }}>
                  {inter.substanceA} ↔ {inter.substanceB}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{inter.effect}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ALERTS SUMMARY WHEN NONE ── */}
      {!hasAlerts && !hasRecs && !hasInstructions && validIds.length >= 2 && (
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 12, padding: '16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#00e68a' }}>Не обнаружено критических взаимодействий</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            Для выбранных препаратов не найдено известных неблагоприятных взаимодействий. Однако всегда соблюдайте рекомендованные дозировки и мониторинг.
          </div>
        </div>
      )}

      </>)}
    </div>
  );
};
