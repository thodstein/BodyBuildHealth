import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../core/db';
import { RISK_SYSTEMS, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE } from '../../core/constants';
import type { RiskResult, LabPoint, CourseEntry, UserProfile } from '../../core/types';
import { calculateRisks } from '../../engines/risk.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { generateSupportStack } from '../../engines/support.engine';
import Organ3D from '../components/Organ3D';

const RISK_MECHANISMS: Array<{ id: number; key: string; label: string }> = [
  { id: 1, key: '1', label: 'Прямая токсичность' },
  { id: 2, key: '2', label: 'Метаболический' },
  { id: 3, key: '3', label: 'Оксидативный' },
  { id: 4, key: '4', label: 'Иммунный' },
  { id: 5, key: '5', label: 'Гормональный' },
  { id: 6, key: '6', label: 'Гемодинамический' },
  { id: 7, key: '7', label: 'Пролиферативный' }
];

const SYSTEM_LABELS: Record<string, string> = {
  cardio: 'Сердечно-сосудистая',
  hepatic: 'Печень',
  renal: 'Почки',
  neuro: 'Нервная',
  endocrine: 'Эндокринная',
  hematologic: 'Кроветворная',
  reproductive: 'Репродуктивная'
};

const getCellColor = (raw: number, net: number): { bg: string; text: string } => {
  const v = net > 0 ? net : raw;
  if (v < 20) return { bg: 'rgba(34,197,94,0.2)', text: '#22c55e' };
  if (v < 50) return { bg: 'rgba(234,179,8,0.2)', text: '#eab308' };
  if (v < 75) return { bg: 'rgba(249,115,22,0.2)', text: '#f97316' };
  return { bg: 'rgba(239,68,68,0.25)', text: '#ef4444' };
};

const getBarColor = (value: number): string => {
  if (value < 20) return '#22c55e';
  if (value < 50) return '#eab308';
  if (value < 75) return '#f97316';
  return '#ef4444';
};

export const getRiskColor = (value: number): string => {
  return getBarColor(value);
};

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
  const [selectedCell, setSelectedCell] = useState<{ system: string; mechanism: number } | null>(null);
  const [activeSubstances, setActiveSubstances] = useState<Record<string, { dosePerWeek: number }>>({});
  const [rawCoverageMap, setRawCoverageMap] = useState<Record<string, number>>({});

  const matrixData = useMemo<MatrixData>(() => {
    if (!riskResult || !rawRiskResult) return {};
    const data: MatrixData = {};
    for (const system of RISK_SYSTEMS) {
      for (let m = 1; m <= 7; m++) {
        const cellId = system + '_' + m;
        const coverage = coverageMap[cellId] || 0;
        const rawVal = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
        const netVal = riskResult.systemBreakdown?.[system]?.net ?? 0;
        const rawCellRaw = rawVal / 7;
        const netCellNet = Math.max(0, rawCellRaw * (1 - coverage));
        data[cellId] = { raw: rawCellRaw, net: netCellNet, coverage };
      }
    }
    return data;
  }, [riskResult, rawRiskResult, coverageMap]);

  const computeMatrixFromEngine = useMemo(() => {
    if (!riskResult || !rawRiskResult) return {};
    const data: MatrixData = {};
    for (const system of RISK_SYSTEMS) {
      for (let m = 1; m <= 7; m++) {
        const cellId = system + '_' + m;
        const coverage = coverageMap[cellId] || 0;
        const cellRaw = (rawRiskResult.systemBreakdown?.[system]?.raw ?? 0) / 7;
        const cellNet = Math.max(0, cellRaw * (1 - coverage));
        data[cellId] = { raw: cellRaw, net: cellNet, coverage };
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
          const freq = typeof entry.frequency === 'number'
            ? entry.frequency
            : entry.frequency === 'daily' ? 7 : entry.frequency === 'eod' ? 3.5 : 1;
          drugs[entry.substanceId] = { dosePerWeek: entry.doseValue * freq };
        });
        setActiveSubstances(drugs);

        const rawResult = calculateRisks({
          genetics, nutritionFactor, trainingFactor,
          activeDrugs: drugs, supportCoverage: {}
        });
        setRawRiskResult(rawResult);

        const supportSubs = generateSupportStack(prof.settings?.goal ?? 'maintenance');
        const covMap: Record<string, number> = {};
        for (const sub of supportSubs) {
          if (sub.effects) {
            for (const eff of sub.effects) {
              covMap[eff.effect] = (covMap[eff.effect] || 0) + eff.strength;
            }
          }
        }
        const baseCovMap: Record<string, number> = {};
        for (const [subName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
          for (const [effectKey, strength] of Object.entries(effects)) {
            baseCovMap[effectKey] = (baseCovMap[effectKey] || 0) + strength;
          }
        }
        for (const key of Object.keys(baseCovMap)) {
          covMap[key] = (covMap[key] || 0) + (baseCovMap[key] || 0);
        }
        setCoverageMap(covMap);
        setRawCoverageMap(baseCovMap);

        const labRisks = calculateRiskFromAnalyses(userLabs);
        const labRawRisks: Record<string, number> = {};
        RISK_SYSTEMS.forEach((s) => { labRawRisks[s] = labRisks.systemContributions[s] ?? 0; });

        const finalResult = calculateRisks({
          genetics, nutritionFactor, trainingFactor,
          activeDrugs: drugs, supportCoverage: covMap
        });

        if (finalResult.systemBreakdown) {
          for (const sys of RISK_SYSTEMS) {
            if (finalResult.systemBreakdown[sys]) {
              finalResult.systemBreakdown[sys].raw = Math.max(finalResult.systemBreakdown[sys].raw, labRawRisks[sys] ?? 0);
              finalResult.systemBreakdown[sys].net = Math.max(finalResult.systemBreakdown[sys].net, labRawRisks[sys] ?? 0);
            }
          }
        }

        setRiskResult(finalResult);
      } catch (e) {
        console.error('Failed to calculate risk:', e);
      } finally {
        setLoading(false);
      }
    };
    loadAndComputeRisk();
  }, []);

  const getCellContributors = useCallback((system: string, mechanism: number): string[] => {
    const contributors: string[] = [];
    const mechId = system + '_' + mechanism;
    for (const [drug, cfg] of Object.entries(DRUG_THRESHOLDS)) {
      if (activeSubstances[drug]) {
        contributors.push(drug);
      }
    }
    for (const [subName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
      if (effects[mechId as keyof typeof effects] !== undefined) {
        contributors.push(subName);
      }
    }
    return contributors;
  }, [activeSubstances]);

  const getCellMitigations = useCallback((system: string, mechanism: number): { substance: string; effect: string; reduction: number }[] => {
    const mechId = system + '_' + mechanism;
    const mitigations: { substance: string; effect: string; reduction: number }[] = [];
    for (const [subName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
      const entry = effects[mechId as keyof typeof effects];
      if (entry !== undefined) {
        mitigations.push({ substance: subName, effect: mechId, reduction: entry });
      }
    }
    const covMap2 = coverageMap;
    if (covMap2[mechId]) {
      const totalCov = covMap2[mechId];
      if (mitigations.length === 0) {
        mitigations.push({ substance: 'комплексная поддержка', effect: mechId, reduction: totalCov });
      }
    }
    return mitigations;
  }, [coverageMap]);

  const selectedDetail: DetailInfo | null = useMemo(() => {
    if (!selectedCell || !riskResult) return null;
    const { system, mechanism } = selectedCell;
    const cellId = system + '_' + mechanism;
    const cellData = computeMatrixFromEngine[cellId] || matrixData[cellId];
    const raw = cellData?.raw ?? (rawRiskResult?.systemBreakdown?.[system]?.raw ?? 0) / 7;
    const net = cellData?.net ?? (riskResult?.systemBreakdown?.[system]?.net ?? 0) / 7;
    const coverage = cellData?.coverage ?? coverageMap[cellId] ?? 0;
    return {
      system,
      mechanism,
      raw,
      net,
      coverage,
      contributors: getCellContributors(system, mechanism),
      mitigations: getCellMitigations(system, mechanism),
    };
  }, [selectedCell, riskResult, rawRiskResult, matrixData, computeMatrixFromEngine, coverageMap, getCellContributors, getCellMitigations]);

  if (loading) return <div className="screen risk-screen">Загрузка...</div>;
  if (!riskResult || !rawRiskResult) return <div className="screen risk-screen">Нет данных</div>;

  const overallReduction = rawRiskResult.overallRaw > 0
    ? ((rawRiskResult.overallRaw - riskResult.overallNet) / rawRiskResult.overallRaw * 100)
    : 0;

  return (
    <div className="screen risk-screen">
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Общая оценка риска</h3>
        <div className="risk-overview-grid">
          <div className="risk-overview-item">
            <div className="risk-overview-label">Без поддержки</div>
            <div className="risk-overview-value" style={{ color: getBarColor(rawRiskResult.overallRaw) }}>
              {Math.round(rawRiskResult.overallRaw)}%
            </div>
          </div>
          <div className="risk-overview-arrow">&rarr;</div>
          <div className="risk-overview-item">
            <div className="risk-overview-label">С поддержкой</div>
            <div className="risk-overview-value" style={{ color: getBarColor(riskResult.overallNet) }}>
              {Math.round(riskResult.overallNet)}%
            </div>
          </div>
          <div className="risk-overview-item">
            <div className="risk-overview-label">Снижение</div>
            <div className="risk-overview-value" style={{ color: '#22c55e' }}>
              {Math.round(overallReduction)}%
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24, overflowX: 'auto' }}>
        <h3>Матрица рисков 7×7</h3>
        <p className="risk-matrix-hint">Нажмите на ячейку для деталей</p>
        <table className="risk-matrix-table">
          <thead>
            <tr>
              <th className="risk-matrix-corner">Система \ Механизм</th>
              {RISK_MECHANISMS.map(m => (
                <th key={m.id} className="risk-matrix-header-mech">{m.label}</th>
              ))}
              <th className="risk-matrix-header-total">Итого (сыр.)</th>
              <th className="risk-matrix-header-total">Итого (нетто)</th>
            </tr>
          </thead>
          <tbody>
            {RISK_SYSTEMS.map(system => {
              const sysRaw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
              const sysNet = riskResult.systemBreakdown?.[system]?.net ?? 0;
              const isSelectedRow = selectedCell?.system === system;
              return (
                <tr key={system} className={isSelectedRow ? 'risk-matrix-row-selected' : ''}>
                  <td className="risk-matrix-row-header">{SYSTEM_LABELS[system] || system}</td>
                  {RISK_MECHANISMS.map((m) => {
                    const cellId = system + '_' + m.id;
                    const cell = matrixData[cellId] || computeMatrixFromEngine[cellId] || { raw: 0, net: 0, coverage: 0 };
                    const colors = getCellColor(cell.raw, cell.net);
                    const isSelected = selectedCell != null && selectedCell.system === system && selectedCell.mechanism === m.id;
                    const cellClass = isSelected ? 'risk-matrix-cell risk-matrix-cell-selected' : 'risk-matrix-cell';
                    return (
                      <td
                        key={m.id}
                        className={cellClass}
                        style={{ backgroundColor: colors.bg, cursor: 'pointer' }}
                        onClick={function() { setSelectedCell({ system: system, mechanism: m.id }); }}
                      >
                        <div className="risk-matrix-cell-raw" style={{ color: getBarColor(cell.raw), fontSize: '0.65em' }}>
                          {cell.raw.toFixed(1)}%
                        </div>
                        <div className="risk-matrix-cell-net" style={{ color: colors.text, fontWeight: 'bold' }}>
                          {cell.net.toFixed(1)}%
                        </div>
                      </td>
                    );
                  })}
                  <td className="risk-matrix-total" style={{ color: getBarColor(sysRaw) }}>
                    {Math.round(sysRaw)}%
                  </td>
                  <td className="risk-matrix-total" style={{ color: getBarColor(sysNet) }}>
                    {Math.round(sysNet)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedDetail && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>
            Детали: {SYSTEM_LABELS[selectedDetail.system] || selectedDetail.system}
            {selectedDetail.mechanism !== null ? ' — ' + (RISK_MECHANISMS.find(function(m) { return m.id === selectedDetail.mechanism; })?.label || ('Мех. ' + selectedDetail.mechanism)) : ''}
          </h3>

          <div className="risk-detail-bars">
            <div className="risk-detail-bar-group">
              <div className="risk-detail-bar-label">Базовый риск</div>
              <div className="risk-detail-bar-track">
                <div
                  className="risk-detail-bar-fill"
                  style={{ width: Math.min(100, selectedDetail.raw) + '%', backgroundColor: getBarColor(selectedDetail.raw) }}
                />
              </div>
              <div className="risk-detail-bar-value">{selectedDetail.raw.toFixed(1)}%</div>
            </div>
            <div className="risk-detail-bar-group">
              <div className="risk-detail-bar-label">С поддержкой</div>
              <div className="risk-detail-bar-track">
                <div
                  className="risk-detail-bar-fill"
                  style={{ width: Math.min(100, selectedDetail.net) + '%', backgroundColor: getBarColor(selectedDetail.net) }}
                />
              </div>
              <div className="risk-detail-bar-value">{selectedDetail.net.toFixed(1)}%</div>
            </div>
            <div className="risk-detail-bar-group">
              <div className="risk-detail-bar-label">Покрытие</div>
              <div className="risk-detail-bar-track">
                <div
                  className="risk-detail-bar-fill"
                  style={{ width: Math.min(100, selectedDetail.coverage * 100) + '%', backgroundColor: '#22c55e' }}
                />
              </div>
              <div className="risk-detail-bar-value">{(selectedDetail.coverage * 100).toFixed(1)}%</div>
            </div>
          </div>

          {selectedDetail.mitigations.length > 0 && (
            <div className="risk-detail-mitigations">
              <h4>Поддержка по данной клетке</h4>
              <div className="risk-detail-mitigation-list">
                {selectedDetail.mitigations.map((mit, i) => (
                  <div key={i} className="risk-detail-mitigation-item">
                    <span className="mitigation-name">{mit.substance}</span>
                    <span className="mitigation-reduction" style={{ color: '#22c55e' }}>
                      -{(mit.reduction * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <Organ3D organName={selectedDetail.system} riskLevel={selectedDetail.net} size={200} />
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Сравнение: Без поддержки / С поддержкой</h3>
        <div className="risk-comparison-grid">
          {RISK_SYSTEMS.map(system => {
            const raw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
            const net = riskResult.systemBreakdown?.[system]?.net ?? 0;
            const reduction = raw > 0 ? ((raw - net) / raw * 100) : 0;
            return (
              <div key={system} className="risk-comparison-row">
                <div className="risk-comparison-label">{SYSTEM_LABELS[system] || system}</div>
                <div className="risk-comparison-bars">
                  <div className="risk-comparison-bar-container">
                    <div className="risk-comparison-bar-label-sm">Базовый</div>
                    <div className="risk-comparison-bar-track">
                      <div
                        className="risk-comparison-bar-fill"
                        style={{ width: Math.min(100, raw) + '%', backgroundColor: getBarColor(raw) }}
                      />
                    </div>
                    <div className="risk-comparison-bar-value-sm">{Math.round(raw)}%</div>
                  </div>
                  <div className="risk-comparison-bar-container">
                    <div className="risk-comparison-bar-label-sm">Нетто</div>
                    <div className="risk-comparison-bar-track">
                      <div
                        className="risk-comparison-bar-fill"
                        style={{ width: Math.min(100, net) + '%', backgroundColor: getBarColor(net) }}
                      />
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

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Рекомендуемая поддержка по системам</h3>
        <div className="risk-mitigation-grid">
          {RISK_SYSTEMS.map(system => {
            const net = riskResult.systemBreakdown?.[system]?.net ?? 0;
            const raw = rawRiskResult.systemBreakdown?.[system]?.raw ?? 0;
            const systemMitigations: { substance: string; effect: string; reduction: number }[] = [];
            for (let m = 1; m <= 7; m++) {
              const cellId = system + '_' + m;
              for (const [subName, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
                const val = effects[cellId as keyof typeof effects];
                if (val !== undefined) {
                  systemMitigations.push({ substance: subName, effect: cellId, reduction: val });
                }
              }
            }
            const uniqueSubs = [...new Map(systemMitigations.map(m => [m.substance, m])).values()];
            return (
              <div key={system} className="risk-mitigation-system">
                <div className="risk-mitigation-header">
                  <span className="risk-mitigation-name">{SYSTEM_LABELS[system] || system}</span>
                  <span className="risk-mitigation-values" style={{ color: getBarColor(net) }}>
                    {Math.round(net)}%
                    <span style={{ color: '#6b7280', marginLeft: 4, fontSize: '0.85em' }}>
                      ({Math.round(raw)}% &rarr; {Math.round(net)}%)
                    </span>
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