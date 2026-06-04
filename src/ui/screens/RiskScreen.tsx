import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../core/db';
import { RISK_SYSTEMS, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE } from '../../core/constants';
import { SYSTEM_INFO, MECHANISM_INFO, SYSTEM_ORGANS } from '../../core/risk-info';
import type { RiskResult, LabPoint, CourseEntry, UserProfile } from '../../core/types';
import { calculateRisks } from '../../engines/risk.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { generateSupportStack } from '../../engines/support.engine';
import HumanBody3D from '../components/HumanBody3D';

const RISK_MECHANISMS = Object.values(MECHANISM_INFO);

const SYSTEM_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_INFO).map(([k, v]) => [k, v.label.split(' ').slice(0, 2).join(' ')])
);

const SYSTEM_FULL_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_INFO).map(([k, v]) => [k, v.label])
);

const getCellColor = (raw: number, net: number): { bg: string; text: string } => {
  const v = net > 0 ? net : raw;
  if (v < 20) return { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' };
  if (v < 40) return { bg: 'rgba(132,204,22,0.15)', text: '#84cc16' };
  if (v < 60) return { bg: 'rgba(234,179,8,0.15)', text: '#eab308' };
  if (v < 80) return { bg: 'rgba(249,115,22,0.2)', text: '#f97316' };
  return { bg: 'rgba(239,68,68,0.2)', text: '#ef4444' };
};

import { getRiskColor } from '../../core/utils/risk-colors';

type MatrixCell = { raw: number; net: number; coverage: number };
type MatrixData = Record<string, MatrixCell>;
type DetailInfo = {
  system: string;
  mechanism: number | null;
  raw: number;
  net: number;
  coverage: number;
  contributors: string[];
  mitigations: { substance: string; effect: string; reduction: number }[];
};

export const RiskScreen: React.FC = () => {
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [rawRiskResult, setRawRiskResult] = useState<RiskResult | null>(null);
  const [coverageMap, setCoverageMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ system: string; mechanism: number | null } | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [activeSubstances, setActiveSubstances] = useState<Record<string, { dosePerWeek: number }>>({});
  const [tab, setTab] = useState<'body' | 'matrix' | 'detail'>('body');

  const matrixData = useMemo<MatrixData>(() => {
    if (!riskResult || !rawRiskResult) return {};
    const data: MatrixData = {};
    for (const system of RISK_SYSTEMS) {
      const sysRaw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
      const sysNet = riskResult.systemBreakdown?.[system]?.net ?? 0;
      for (let m = 1; m <= 7; m++) {
        const cellId = system + '_' + m;
        const coverage = coverageMap[cellId] || 0;
        const rawCellRaw = sysRaw / 7;
        const netCellNet = Math.max(0, rawCellRaw * (1 - coverage));
        data[cellId] = { raw: rawCellRaw, net: netCellNet, coverage };
      }
    }
    return data;
  }, [riskResult, rawRiskResult, coverageMap]);

  useEffect(() => {
    const loadAndComputeRisk = async () => {
      try {
        await db.init();
        const prof = await db.get<UserProfile>('profile', 'current-user');
        if (!prof) { setLoading(false); return; }
        const courseEntries = await db.getAll<CourseEntry>('course_log');
        const labEntries = await db.getAll<LabPoint & { patientId?: string }>('labs_log');
        const userLabs = labEntries.filter((l) => l.patientId === 'current-user');
        const genetics: Record<string, string> = prof.settings?.genetics ?? {};
        const nutritionFactor = prof.settings?.nutritionFactor ?? 1.0;
        const trainingFactor = prof.settings?.trainingFactor ?? 1.0;
        const drugs: Record<string, { dosePerWeek: number }> = {};
        courseEntries.forEach((entry) => {
          const freq = typeof entry.frequency === 'number' ? entry.frequency : entry.frequency === 'daily' ? 7 : entry.frequency === 'eod' ? 3.5 : 1;
          drugs[entry.substanceId] = { dosePerWeek: entry.doseValue * freq };
        });
        setActiveSubstances(drugs);
        const rawResult = calculateRisks({ genetics, nutritionFactor, trainingFactor, activeDrugs: drugs, supportCoverage: {} });
        setRawRiskResult(rawResult);
        const supportSubs = generateSupportStack(prof.settings?.goal ?? 'maintenance');
        const covMap: Record<string, number> = {};
        for (const sub of supportSubs) {
          if (sub.effects) { for (const eff of sub.effects) { covMap[eff.effect] = (covMap[eff.effect] || 0) + eff.strength; } }
        }
        const baseCovMap: Record<string, number> = {};
        for (const [, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
          for (const [effectKey, strength] of Object.entries(effects)) {
            baseCovMap[effectKey] = (baseCovMap[effectKey] || 0) + strength;
          }
        }
        for (const key of Object.keys(baseCovMap)) { covMap[key] = (covMap[key] || 0) + (baseCovMap[key] || 0); }
        setCoverageMap(covMap);
        const labRisks = calculateRiskFromAnalyses(userLabs);
        const labRawRisks: Record<string, number> = {};
        RISK_SYSTEMS.forEach((s) => { labRawRisks[s] = labRisks.systemContributions[s] ?? 0; });
        const finalResult = calculateRisks({ genetics, nutritionFactor, trainingFactor, activeDrugs: drugs, supportCoverage: covMap });
        if (finalResult.systemBreakdown) {
          for (const sys of RISK_SYSTEMS) {
            if (finalResult.systemBreakdown[sys]) {
              finalResult.systemBreakdown[sys].raw = Math.max(finalResult.systemBreakdown[sys].raw, labRawRisks[sys] ?? 0);
              finalResult.systemBreakdown[sys].net = Math.max(finalResult.systemBreakdown[sys].net, labRawRisks[sys] ?? 0);
            }
          }
        }
        setRiskResult(finalResult);
      } catch (e) { console.error('Failed to calculate risk:', e); } finally { setLoading(false); }
    };
    loadAndComputeRisk();
  }, []);

  const getCellMitigations = useCallback((system: string, mechanism: number) => {
    const mechId = system + '_' + mechanism;
    const mitigations: { substance: string; effect: string; reduction: number }[] = [];
    for (const [subName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
      const entry = effects[mechId as keyof typeof effects];
      if (entry !== undefined) { mitigations.push({ substance: subName, effect: mechId, reduction: entry }); }
    }
    return mitigations;
  }, []);

  const systemsFor3D = useMemo(() => {
    const result: Record<string, { raw: number; net: number }> = {};
    for (const sys of RISK_SYSTEMS) {
      result[sys] = {
        raw: rawRiskResult?.systemBreakdown?.[sys]?.raw ?? 0,
        net: riskResult?.systemBreakdown?.[sys]?.net ?? 0,
      };
    }
    return result;
  }, [riskResult, rawRiskResult]);

  const handleSystemSelect = useCallback((sys: string) => {
    setSelectedSystem(sys);
    setSelectedCell({ system: sys, mechanism: null });
    setTab('detail');
  }, []);

  if (loading) return <div className="screen risk-screen"><div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Расчёт рисков...</div></div>;

  if (!riskResult || !rawRiskResult) return (
    <div className="screen risk-screen">
      <h2>Матрица рисков</h2>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, textAlign: 'center', marginTop: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>&#9888;</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: 'var(--warning)' }}>Недостаточно данных для расчёта рисков</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Добавьте курс препаратов и/или результаты анализов</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', fontSize: 11 }}>
          <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--accent-dim)', color: 'var(--accent)' }}>Фарма → Мой курс</span>
          <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--accent-dim)', color: 'var(--accent)' }}>Анализы → Ввод</span>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
        <HumanBody3D systems={systemsFor3D} selectedSystem={null} onSelectSystem={() => {}} size={300} />
      </div>
    </div>
  );

  const overallReduction = rawRiskResult.overallRaw > 0 ? ((rawRiskResult.overallRaw - riskResult.overallNet) / rawRiskResult.overallRaw * 100) : 0;

  const selectedSysInfo = selectedSystem ? SYSTEM_INFO[selectedSystem] : null;

  return (
    <div className="screen risk-screen">
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Общая оценка риска</h3>
        <div className="risk-overview-grid">
          <div className="risk-overview-item">
            <div className="risk-overview-label">Без поддержки</div>
            <div className="risk-overview-value" style={{ color: getRiskColor(rawRiskResult.overallRaw) }}>{Math.round(rawRiskResult.overallRaw)}%</div>
          </div>
          <div className="risk-overview-arrow">&rarr;</div>
          <div className="risk-overview-item">
            <div className="risk-overview-label">С поддержкой</div>
            <div className="risk-overview-value" style={{ color: getRiskColor(riskResult.overallNet) }}>{Math.round(riskResult.overallNet)}%</div>
          </div>
          <div className="risk-overview-item">
            <div className="risk-overview-label">Снижение</div>
            <div className="risk-overview-value" style={{ color: '#22c55e' }}>{Math.round(overallReduction)}%</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['body', 'matrix', 'detail'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? 'var(--accent-blue)' : 'var(--bg-secondary)', color: tab === t ? '#fff' : 'var(--text-dim)' }}>
            {t === 'body' ? 'Тело' : t === 'matrix' ? 'Матрица 7×7' : 'Системы'}
          </button>
        ))}
      </div>

      {tab === 'body' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>3D модель — нажмите на орган</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <HumanBody3D systems={systemsFor3D} selectedSystem={selectedSystem} onSelectSystem={handleSystemSelect} size={320} />
          </div>
          {selectedSysInfo && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{selectedSysInfo.icon} {selectedSysInfo.label}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-light)', marginBottom: 8 }}>{selectedSysInfo.description}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}><strong>Что поражается:</strong> {selectedSysInfo.whatAffects.join(', ')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}><strong>Симптомы:</strong> {selectedSysInfo.symptoms.join(', ')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}><strong>Ключевые маркеры:</strong> {selectedSysInfo.keyMarkers.join(', ')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}><strong>Органы:</strong> {(SYSTEM_ORGANS[selectedSystem!] || []).join(', ')}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'matrix' && (
        <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 6px 0' }}>Матрица рисков 7×7</h3>
          <p className="risk-matrix-hint">Нажмите на ячейку для деталей по механизму</p>
          <table className="risk-matrix-table">
            <thead>
              <tr>
                <th className="risk-matrix-corner">Система \ Механизм</th>
                {RISK_MECHANISMS.map(m => (
                  <th key={m.id} className="risk-matrix-header-mech" title={m.description}>{m.label}</th>
                ))}
                <th className="risk-matrix-header-total">Сыр.</th>
                <th className="risk-matrix-header-total">Нетто</th>
              </tr>
            </thead>
            <tbody>
              {RISK_SYSTEMS.map(system => {
                const sysRaw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
                const sysNet = riskResult.systemBreakdown?.[system]?.net ?? 0;
                const isSelectedRow = selectedCell?.system === system;
                return (
                  <tr key={system} className={isSelectedRow ? 'risk-matrix-row-selected' : ''}>
                    <td className="risk-matrix-row-header" style={{ cursor: 'pointer' }} onClick={() => { setSelectedSystem(system); setSelectedCell({ system, mechanism: null }); setTab('detail'); }}>
                      {SYSTEM_INFO[system]?.icon || ''} {SYSTEM_LABELS[system] || system}
                    </td>
                    {RISK_MECHANISMS.map((m) => {
                      const cellId = system + '_' + m.id;
                      const cell = matrixData[cellId] || { raw: 0, net: 0, coverage: 0 };
                      const colors = getCellColor(cell.raw, cell.net);
                      const isSelected = selectedCell != null && selectedCell.system === system && selectedCell.mechanism === m.id;
                      return (
                        <td key={m.id} className={isSelected ? 'risk-matrix-cell risk-matrix-cell-selected' : 'risk-matrix-cell'} style={{ backgroundColor: colors.bg, cursor: 'pointer' }} onClick={() => { setSelectedCell({ system, mechanism: m.id }); setSelectedSystem(system); setTab('detail'); }}>
                          <div className="risk-matrix-cell-raw" style={{ color: getRiskColor(cell.raw), fontSize: '0.65em' }}>{cell.raw.toFixed(1)}%</div>
                          <div className="risk-matrix-cell-net" style={{ color: colors.text, fontWeight: 'bold' }}>{cell.net.toFixed(1)}%</div>
                        </td>
                      );
                    })}
                    <td className="risk-matrix-total" style={{ color: getRiskColor(sysRaw) }}>{Math.round(sysRaw)}%</td>
                    <td className="risk-matrix-total" style={{ color: getRiskColor(sysNet) }}>{Math.round(sysNet)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'detail' && (
        <div>
          {RISK_SYSTEMS.map(system => {
            const sysInfo = SYSTEM_INFO[system];
            const sysRaw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
            const sysNet = riskResult.systemBreakdown?.[system]?.net ?? 0;
            const reduction = sysRaw > 0 ? ((sysRaw - sysNet) / sysRaw * 100) : 0;
            const isExpanded = selectedSystem === system;
            return (
              <div key={system} className="card" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => setSelectedSystem(isExpanded ? null : system)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{sysInfo?.icon || '❓'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{sysInfo?.label || system}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sysInfo?.description?.slice(0, 60)}...</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: getRiskColor(sysRaw) }}>{Math.round(sysRaw)}%</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: getRiskColor(sysNet) }}>{Math.round(sysNet)}%</span>
                    {reduction > 0 && <span style={{ fontSize: 12, color: '#22c55e' }}>-{Math.round(reduction)}%</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {isExpanded && sysInfo && (
                  <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-light)', marginBottom: 10 }}>{sysInfo.description}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Что поражается</div>
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{sysInfo.whatAffects.join(', ')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Симптомы</div>
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{sysInfo.symptoms.join(', ')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Маркеры</div>
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{sysInfo.keyMarkers.join(', ')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Органы</div>
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{(SYSTEM_ORGANS[system] || []).join(', ')}</div>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Механизмы повреждения</div>
                    {RISK_MECHANISMS.map(m => {
                      const cellId = system + '_' + m.id;
                      const cell = matrixData[cellId] || { raw: 0, net: 0, coverage: 0 };
                      const mechInfo = MECHANISM_INFO[m.id];
                      const mits = getCellMitigations(system, m.id);
                      return (
                        <div key={m.id} style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '8px 10px', marginBottom: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setSelectedCell({ system, mechanism: m.id })}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: 12, color: getRiskColor(cell.net) }}>{m.label}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{cell.net.toFixed(1)}% нетто</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {mits.slice(0, 3).map((mit, i) => (
                                <span key={i} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{mit.substance}</span>
                              ))}
                            </div>
                          </div>
                          {selectedCell?.system === system && selectedCell?.mechanism === m.id && mechInfo && (
                            <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: 'var(--text-light)' }}>
                              <div>{mechInfo.description}</div>
                              <div style={{ marginTop: 4, color: 'var(--text-dim)' }}><strong>Примеры:</strong> {mechInfo.examples.join('; ')}</div>
                              <div style={{ marginTop: 2, color: 'var(--text-dim)' }}><strong>Механизм:</strong> {mechInfo.howDamaged}</div>
                              <div style={{ marginTop: 4 }}>
                                <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                                  <span>Сыр. риск: <strong style={{ color: getRiskColor(cell.raw) }}>{cell.raw.toFixed(1)}%</strong></span>
                                  <span>Нетто: <strong style={{ color: getRiskColor(cell.net) }}>{cell.net.toFixed(1)}%</strong></span>
                                  <span>Покрытие: <strong style={{ color: '#22c55e' }}>{(cell.coverage * 100).toFixed(0)}%</strong></span>
                                </div>
                              </div>
                              {mits.length > 0 && (
                                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {mits.map((mit, i) => (
                                    <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>{mit.substance} -{(mit.reduction * 100).toFixed(0)}%</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Сравнение: Без поддержки / С поддержкой</h3>
        <div className="risk-comparison-grid">
          {RISK_SYSTEMS.map(system => {
            const raw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
            const net = riskResult.systemBreakdown?.[system]?.net ?? 0;
            const reduction = raw > 0 ? ((raw - net) / raw * 100) : 0;
            return (
              <div key={system} className="risk-comparison-row">
                <div className="risk-comparison-label">{SYSTEM_INFO[system]?.icon || ''} {SYSTEM_LABELS[system] || system}</div>
                <div className="risk-comparison-bars">
                  <div className="risk-comparison-bar-container">
                    <div className="risk-comparison-bar-label-sm">Сыр.</div>
                    <div className="risk-comparison-bar-track">
                      <div className="risk-comparison-bar-fill" style={{ width: Math.min(100, raw) + '%', backgroundColor: getRiskColor(raw) }} />
                    </div>
                    <div className="risk-comparison-bar-value-sm">{Math.round(raw)}%</div>
                  </div>
                  <div className="risk-comparison-bar-container">
                    <div className="risk-comparison-bar-label-sm">Нетто</div>
                    <div className="risk-comparison-bar-track">
                      <div className="risk-comparison-bar-fill" style={{ width: Math.min(100, net) + '%', backgroundColor: getRiskColor(net) }} />
                    </div>
                    <div className="risk-comparison-bar-value-sm">{Math.round(net)}%</div>
                  </div>
                </div>
                <div className="risk-comparison-reduction" style={{ color: reduction > 0 ? '#22c55e' : '#6b7280' }}>
                  {reduction > 0 ? '-' + Math.round(reduction) + '%' : '0%'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Поддержка по системам</h3>
        <div className="risk-mitigation-grid">
          {RISK_SYSTEMS.map(system => {
            const net = riskResult.systemBreakdown?.[system]?.net ?? 0;
            const raw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
            const systemMitigations: { substance: string; effect: string; reduction: number }[] = [];
            for (let m = 1; m <= 7; m++) {
              const cellId = system + '_' + m;
              for (const [subName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
                const val = effects[cellId as keyof typeof effects];
                if (val !== undefined) { systemMitigations.push({ substance: subName, effect: cellId, reduction: val }); }
              }
            }
            const uniqueSubs = [...new Map(systemMitigations.map(m => [m.substance, m])).values()];
            return (
              <div key={system} className="risk-mitigation-system">
                <div className="risk-mitigation-header">
                  <span className="risk-mitigation-name">{SYSTEM_INFO[system]?.icon || ''} {SYSTEM_LABELS[system] || system}</span>
                  <span className="risk-mitigation-values" style={{ color: getRiskColor(net) }}>
                    {Math.round(net)}%
                    <span style={{ color: '#6b7280', marginLeft: 4, fontSize: '0.85em' }}>({Math.round(raw)}% → {Math.round(net)}%)</span>
                  </span>
                </div>
                {uniqueSubs.length > 0 ? (
                  <div className="risk-mitigation-subs">
                    {uniqueSubs.map((mit, i) => (
                      <span key={i} className="risk-mitigation-pill" title={mit.substance + ': -' + (mit.reduction * 100).toFixed(0) + '%'}>
                        {mit.substance}
                        <span className="risk-mitigation-pill-reduction">-{(mit.reduction * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="risk-mitigation-none">Нет специфической поддержки</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};