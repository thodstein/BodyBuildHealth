import React, { useMemo, useState, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { getStackInteractions, getStackCoverageStats, RISK_SYSTEM_LABELS, getStackTzMechanismCoverage, type TzCoverageResult } from '../../engines/biostack-bridge';
import { GlassCard } from './BioStackAIConstants';
import type { LinkedData } from '../../core/data-link';

type SubRisk = {
  id: string; name: string; conflictCount: number; highCount: number;
  profileIssues: string[];
};

export function RisksTab({ profile, stackIds, setStackIds, linked, activeAAS }: { profile: BioStackProfile; stackIds: string[]; setStackIds?: (ids: string[]) => void; linked?: LinkedData; activeAAS?: string[] }) {
  const [syncWithEngine, setSyncWithEngine] = useState(false);

  const analysis = useMemo(() => {
    if (stackIds.length < 2) return null;
    const { pairs, critical, moderate, safe } = getStackInteractions(stackIds);
    const coverageStats = getStackCoverageStats();
    const tzCoverage = syncWithEngine ? getStackTzMechanismCoverage(stackIds) : null;

    // Profile compatibility checks (kept as data mapping, not calculation)
    const subRisk: Record<string, SubRisk> = {};
    stackIds.forEach(id => {
      const name = SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id;
      subRisk[id] = { id, name, conflictCount: 0, highCount: 0, profileIssues: [] };
    });
    pairs.forEach(p => {
      if (p.type === 'conflict' || p.type === 'caution') {
        if (subRisk[p.a]) { subRisk[p.a].conflictCount++; if (p.severity === 'HIGH') subRisk[p.a].highCount++; }
        if (subRisk[p.b]) { subRisk[p.b].conflictCount++; if (p.severity === 'HIGH') subRisk[p.b].highCount++; }
      }
    });
    if (profile) {
      if (profile.healthConditions) {
        for (const cond of profile.healthConditions) {
          stackIds.forEach(id => {
            const cat = SUPPORT_CATALOG_DATA[id];
            if (!cat) return;
            const organs = (cat as any).organs || (cat as any).targetOrgans || [];
            const mechs = cat.mechanisms || [];
            if (cond === 'heart' && (organs.some((o: string) => ['HEART', 'VESSELS', 'CARDIO'].includes(o)) || mechs.some((m: string) => m.includes('CARDIO') || m.includes('HEART')))) {
              subRisk[id]?.profileIssues.push('Заболевания ССС — препарат влияет на сердечно-сосудистую систему');
            }
            if (cond === 'kidney' && (organs.some((o: string) => ['KIDNEY', 'RENAL'].includes(o)) || mechs.some((m: string) => m.includes('RENAL') || m.includes('KIDNEY')))) {
              subRisk[id]?.profileIssues.push('Заболевания почек — препарат создаёт нагрузку на почки');
            }
            if (cond === 'liver' && (organs.some((o: string) => ['LIVER', 'HEPATOBILIARY'].includes(o)) || mechs.some((m: string) => m.includes('HEPAT') || m.includes('LIVER')))) {
              subRisk[id]?.profileIssues.push('Заболевания печени — препарат метаболизируется в печени');
            }
            if (cond === 'pressure_high' && (organs.some((o: string) => ['HEART', 'VESSELS'].includes(o)) || mechs.some((m: string) => m.includes('CARDIO') || m.includes('VESSEL') || m.includes('PRESSURE')))) {
              subRisk[id]?.profileIssues.push('Гипертония — требуется контроль давления');
            }
            if (cond === 'diabetes' && mechs.some((m: string) => m.includes('GLUCOSE') || m.includes('INSULIN'))) {
              subRisk[id]?.profileIssues.push('Сахарный диабет — препарат влияет на углеводный обмен');
            }
            if (cond === 'thyroid' && (organs.some((o: string) => ['THYROID'].includes(o)) || mechs.some((m: string) => m.includes('THYROID')))) {
              subRisk[id]?.profileIssues.push('Заболевания щитовидной железы — препарат влияет на тиреоидный статус');
            }
            if (cond === 'stomach' && (organs.some((o: string) => ['STOMACH', 'GI', 'ESOPHAGUS'].includes(o)) || mechs.some((m: string) => m.includes('ACID') || m.includes('GASTRIC')))) {
              subRisk[id]?.profileIssues.push('Заболевания ЖКТ — препарат может раздражать слизистую');
            }
          });
        }
      }
    }

    const sortedSubs = Object.values(subRisk).sort((a, b) => b.conflictCount - a.conflictCount);

    const riskyIds = new Set(critical.map(p => [p.a, p.b]).flat());
    const moderateIds = new Set(moderate.map(p => [p.a, p.b]).flat());

    return { pairs, critical, moderate, safe, total: pairs.length, sortedSubs, coverageStats, riskyIds, moderateIds, tzCoverage };
  }, [stackIds, profile, syncWithEngine]);

  const [expandedPair, setExpandedPair] = useState<Record<string, boolean>>({});
  const [graphTab, setGraphTab] = useState<'graph' | 'list'>('list');

  if (stackIds.length < 2) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Нет пар для анализа</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Добавьте минимум 2 препарата в стек для просмотра взаимодействий</div>
      </div>
    );
  }

  if (!analysis) return null;

  const severityColor = (s: string) => s === 'HIGH' ? '#ef4444' : s === 'MEDIUM' ? '#f59e0b' : '#22c55e';
  const severityBg = (s: string) => s === 'HIGH' ? 'rgba(239,68,68,0.06)' : s === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)';
  const severityBorder = (s: string) => s === 'HIGH' ? 'rgba(239,68,68,0.12)' : s === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
  const typeIcon = (t: string) => t === 'conflict' ? '🚫' : t === 'caution' ? '⚡' : t === 'synergy' ? '🤝' : '➖';

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Coverage overview (replaces heuristic risk score) */}
      <GlassCard title="🛡️ Покрытие систем" icon="📊" color="#60a5fa">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10,
          padding: '10px 12px', borderRadius: 12,
          background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)',
        }}>
          <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ width: 52, height: 52, transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#60a5fa" strokeWidth="3"
                strokeDasharray={`${analysis.coverageStats.coveragePct} ${100 - analysis.coverageStats.coveragePct}`} strokeLinecap="round"
                strokeDashoffset="0" opacity="0.8" />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{analysis.coverageStats.coveragePct}%</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 2 }}>
              🛡️ Покрытие систем организма
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
              {analysis.coverageStats.coveredSystems}/{analysis.coverageStats.totalSystems} систем • {analysis.total} пар взаимодействий • {analysis.critical.length} критических • {analysis.moderate.length} умеренных
            </div>
          </div>
        </div>

        {/* System coverage bars */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>🎯 Покрытие по системам</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {analysis.coverageStats.systemList.map(sys => (
              <div key={sys.system} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 80, fontSize: 7, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sys.label}</span>
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ width: Math.min(100, sys.count * 20) + '%', height: '100%', borderRadius: 2, background: '#60a5fa' }} />
                </div>
                <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', minWidth: 16, textAlign: 'right' }}>{sys.count}</span>
              </div>
            ))}
          </div>
        </div>

        {syncWithEngine && analysis.tzCoverage && (
          <div style={{ marginTop: 8 }}>
            {/* TZ coverage gauge */}
            <div style={{
              padding: '8px 10px', borderRadius: 10, marginBottom: 8,
              background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                  <svg viewBox="0 0 36 36" style={{ width: 44, height: 44, transform: 'rotate(-90deg)' }}>
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#a78bfa" strokeWidth="3"
                      strokeDasharray={`${analysis.tzCoverage.overallCoveragePct} ${100 - analysis.tzCoverage.overallCoveragePct}`} strokeLinecap="round"
                      strokeDashoffset="0" opacity="0.8" />
                  </svg>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>{analysis.tzCoverage.overallCoveragePct}%</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>🧬 Покрытие 28 механизмов ТЗ</div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{analysis.tzCoverage.totalCovered}/{analysis.tzCoverage.totalMechs} механизмов покрыто</div>
                </div>
              </div>
            </div>

            {/* System coverage bars */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>🎯 Покрытие по системам ТЗ</div>
              {Object.entries(analysis.tzCoverage.systems).map(([sysId, sys]) => (
                <div key={sysId} style={{ marginBottom: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 1 }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>{sys.label}</span>
                    <span style={{ color: sys.coveragePct >= 100 ? '#4ade80' : sys.coveragePct >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                      {sys.coveredMechs}/{sys.totalMechs}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ width: sys.coveragePct + '%', height: '100%', borderRadius: 2, background: sys.coveragePct >= 100 ? '#4ade80' : sys.coveragePct >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Gap suggestions */}
            {analysis.tzCoverage.gapMechs.length > 0 && (
              <div>
                <div style={{ fontSize: 8, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>⚠ Непокрытые механизмы ({analysis.tzCoverage.gapMechs.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {analysis.tzCoverage.gapMechs.slice(0, 6).map(gap => (
                    <div key={gap.mechId} style={{
                      padding: '6px 8px', borderRadius: 8,
                      background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
                    }}>
                      <div style={{ fontSize: 8, color: '#fff', fontWeight: 600, marginBottom: 2 }}>
                        {gap.systemLabel}: {gap.mechLabel}
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {gap.suggestions.slice(0, 3).map(s => (
                          <span key={s.id} title={`k=${s.k} q=${s.q}`} style={{
                            fontSize: 6, padding: '1px 5px', borderRadius: 4,
                            background: 'rgba(34,197,94,0.06)', color: '#4ade80', cursor: 'pointer',
                            border: '1px solid rgba(34,197,94,0.12)',
                          }}>+{s.name}</span>
                        ))}
                        {gap.suggestions.length > 3 && (
                          <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>+{gap.suggestions.length - 3} ещё</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {analysis.tzCoverage.gapMechs.length > 6 && (
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 2 }}>
                      ...и ещё {analysis.tzCoverage.gapMechs.length - 6} непокрытых механизмов
                    </div>
                  )}
                </div>
              </div>
            )}
            {analysis.tzCoverage.gapMechs.length === 0 && (
              <div style={{ fontSize: 8, color: '#4ade80', padding: '4px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
                ✅ Все 28 механизмов ТЗ покрыты стеком
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setSyncWithEngine(!syncWithEngine)} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: syncWithEngine ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${syncWithEngine ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: syncWithEngine ? '#00e68a' : 'rgba(255,255,255,0.5)',
          }}>🔄 {syncWithEngine ? 'Синхронизация вкл' : 'Синхр. с риск-движком'}</button>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button onClick={() => setGraphTab('list')} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: graphTab === 'list' ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${graphTab === 'list' ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: graphTab === 'list' ? '#00e68a' : 'rgba(255,255,255,0.5)',
          }}>📋 Список</button>
          <button onClick={() => setGraphTab('graph')} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
            background: graphTab === 'graph' ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${graphTab === 'graph' ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
            color: graphTab === 'graph' ? '#00e68a' : 'rgba(255,255,255,0.5)',
          }}>🕸️ Граф</button>
        </div>
      </GlassCard>

      {/* Graph view */}
      {graphTab === 'graph' && analysis.pairs.length > 0 && (
        <GlassCard title="🕸️ Граф взаимодействий" icon="🕸️" color="#8b5cf6">
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: 220, background: 'rgba(0,0,0,0.15)', borderRadius: 12 }}>
            {(() => {
              const graphNodes = stackIds.map((id, i) => {
                const cat = SUPPORT_CATALOG_DATA[id];
                return { id, label: cat?.nameRu || cat?.name || id, idx: i };
              });
              const angles = graphNodes.map((_, i) => (2 * Math.PI * i) / graphNodes.length - Math.PI / 2);
              const cx = 50, cy = 50, r = 38;
              const positions = angles.map(a => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }));
              const pairKey = (a: string, b: string) => [a, b].sort().join('|');
              const drawn = new Set<string>();
              // Only show top 15 strongest interactions (HIGH→MEDIUM→LOW)
              const severityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
              const topPairs = [...analysis.pairs].sort((a, b) => (severityRank[a.severity as keyof typeof severityRank] ?? 2) - (severityRank[b.severity as keyof typeof severityRank] ?? 2)).slice(0, 15);
              return (
                <>
                  {topPairs.map(p => {
                    const k = pairKey(p.a, p.b);
                    if (drawn.has(k)) return null;
                    drawn.add(k);
                    const i1 = stackIds.indexOf(p.a), i2 = stackIds.indexOf(p.b);
                    if (i1 === -1 || i2 === -1) return null;
                    const p1 = positions[i1], p2 = positions[i2];
                    const stroke = p.type === 'conflict' && p.severity === 'HIGH' ? '#ef4444'
                      : p.type === 'conflict' && p.severity === 'MEDIUM' ? '#f97316'
                      : p.type === 'caution' ? '#f59e0b'
                      : p.type === 'synergy' ? '#22c55e'
                      : 'rgba(255,255,255,0.1)';
                    return (
                      <line key={k} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                        stroke={stroke} strokeWidth={p.severity === 'HIGH' ? 3 : 2}
                        strokeDasharray={p.type === 'synergy' ? '' : '5,3'} opacity={0.7} />
                    );
                  })}
                  {graphNodes.map((n, i) => {
                    const p = positions[i];
                    const isRisky = analysis.riskyIds.has(n.id);
                    const isModerate = analysis.moderateIds.has(n.id);
                    return (
                      <g key={n.id}>
                        <circle cx={p.x} cy={p.y} r={5}
                          fill={isRisky ? '#ef4444' : isModerate ? '#f59e0b' : '#1a1a1e'}
                          stroke={isRisky ? '#ef4444' : isModerate ? '#f59e0b' : '#00e68a'} strokeWidth={1.2} />
                        <text x={p.x} y={p.y + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={3.5} fontWeight={600}>{n.label}</text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
            <span><span style={{ color: '#ef4444' }}>━</span> Конфликт</span>
            <span><span style={{ color: '#f59e0b' }}>- -</span> Осторожно</span>
            <span><span style={{ color: '#22c55e' }}>━</span> Синергия</span>
            <span><span style={{ color: 'rgba(255,255,255,0.15)' }}>- -</span> Нет данных</span>
          </div>
        </GlassCard>
      )}

      {/* Critical pairs */}
      {analysis.critical.length > 0 && (
        <GlassCard title={`🔴 Критические (${analysis.critical.length})`} icon="🚫" color="#ef4444">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {analysis.critical.map((p, idx) => {
              const key = `${p.a}|${p.b}|${p.type}|${idx}`;
              const open = expandedPair[key] ?? true;
              return <PairCard key={key} p={p} open={open} onToggle={() => setExpandedPair(prev => ({ ...prev, [key]: !open }))} />;
            })}
          </div>
        </GlassCard>
      )}

      {/* Moderate pairs */}
      {analysis.moderate.length > 0 && (
        <GlassCard title={`🟡 Умеренные (${analysis.moderate.length})`} icon="⚡" color="#f59e0b">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {analysis.moderate.map((p, idx) => {
              const key = `${p.a}|${p.b}|${p.type}|${idx}|mod`;
              const open = expandedPair[key] ?? true;
              return <PairCard key={key} p={p} open={open} onToggle={() => setExpandedPair(prev => ({ ...prev, [key]: !open }))} />;
            })}
          </div>
        </GlassCard>
      )}

      {/* Safe pairs */}
      {analysis.safe.length > 0 && (
        <GlassCard title={`🟢 Безопасные / Нет данных (${analysis.safe.length})`} icon="➖" color="#22c55e">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {analysis.safe.slice(0, 6).map((p, idx) => {
              const key = `${p.a}|${p.b}|${p.type}|${idx}|safe`;
              const open = expandedPair[key] ?? false;
              return <PairCard key={key} p={p} open={open} onToggle={() => setExpandedPair(prev => ({ ...prev, [key]: !open }))} compact />;
            })}
            {analysis.safe.length > 6 && (
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 2 }}>
                + {analysis.safe.length - 6} пар без значимых взаимодействий
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Profile-specific warnings */}
      {analysis.sortedSubs.some(s => s.profileIssues.length > 0) && (
        <GlassCard title="⚠ Совместимость с профилем" icon="⚠" color="#f59e0b">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {analysis.sortedSubs.filter(s => s.profileIssues.length > 0).map(s => (
              <div key={s.id} style={{
                padding: '6px 8px', borderRadius: 8,
                background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)',
              }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{s.name}</div>
                {s.profileIssues.map((issue, i) => (
                  <div key={i} style={{ fontSize: 7, color: '#f59e0b', lineHeight: 1.3, padding: '1px 0 1px 8px' }}>• {issue}</div>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* AAS course compatibility */}
      {(() => {
        const aasList = activeAAS || [];
        try {
          if (activeAAS === undefined) return null;
          if (aasList.length === 0) {
            try {
              const courseRaw = localStorage.getItem('he_course_data');
              if (!courseRaw) return null;
              const course = JSON.parse(courseRaw);
              const ids: string[] = (course.aas || []).filter((a: any) => a.active !== false).map((a: any) => a.id?.toLowerCase?.() || a.id || '').filter(Boolean);
              if (ids.length === 0) return null;
              aasList.push(...ids);
            } catch { return null; }
          }
          if (aasList.length === 0) return null;
          const aasConflicts: Array<{ aasName: string; subName: string; effect: string; severity: string }> = [];
          for (const aasId of aasList) {
            for (const subId of stackIds) {
              const inx = ALL_INTERACTIONS.find((i: any) =>
                (i.substanceA?.toLowerCase?.() === aasId && i.substanceB?.toLowerCase?.() === subId) ||
                (i.substanceB?.toLowerCase?.() === aasId && i.substanceA?.toLowerCase?.() === subId));
              if (inx && (inx.severity === 'HIGH' || inx.severity === 'MEDIUM') && (inx.type === 'conflict' || inx.type === 'caution')) {
                const aasName = SUPPORT_CATALOG_DATA[aasId]?.nameRu || aasId;
                const subName = SUPPORT_CATALOG_DATA[subId]?.nameRu || SUPPORT_CATALOG_DATA[subId]?.name || subId;
                aasConflicts.push({ aasName, subName, effect: inx.effect || 'Взаимодействие', severity: inx.severity });
              }
            }
          }

          // Core recommendations for AAS course
          const CORE_FOR_AAS = ['nac', 'omega3', 'tudca', 'magnesium', 'zinc', 'vitamin_d3', 'milk_thistle', 'coq10'];
          const missingCore = CORE_FOR_AAS.filter(id => !stackIds.includes(id) && SUPPORT_CATALOG_DATA[id]);

          return (
            <GlassCard title={`💉 Совместимость с курсом (${aasList.length} AAS)`} icon="💉" color={aasConflicts.length > 0 ? '#ef4444' : '#f59e0b'}>
              {aasList.length > 0 && (
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                  Активные AAS: {aasList.map((a: string) => SUPPORT_CATALOG_DATA[a]?.nameRu || a).join(', ')}
                </div>
              )}
              {aasConflicts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                  {aasConflicts.map((c, i) => (
                    <div key={i} style={{
                      padding: '6px 8px', borderRadius: 8,
                      background: c.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.04)',
                      border: c.severity === 'HIGH' ? '1px solid rgba(239,68,68,0.12)' : '1px solid rgba(245,158,11,0.1)',
                    }}>
                      <span style={{ fontSize: 8, color: c.severity === 'HIGH' ? '#ef4444' : '#f59e0b' }}>
                        {c.severity === 'HIGH' ? '🔴' : '🟡'} <strong>{c.aasName}</strong> + <strong>{c.subName}</strong>: {c.effect}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {aasConflicts.length === 0 && (
                <div style={{ fontSize: 8, color: '#22c55e', marginBottom: 6 }}>✅ Конфликтов с курсом не обнаружено.</div>
              )}
              {missingCore.length > 0 && setStackIds && (
                <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
                  <div style={{ fontSize: 8, color: '#4ade80', fontWeight: 600, marginBottom: 4 }}>
                    💡 На курсе AAS рекомендованы ({missingCore.length}):
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 6 }}>
                    {missingCore.map(id => (
                      <span key={id} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 7, background: 'rgba(0,230,138,0.06)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.1)' }}>
                        {SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => {
                    const newStack = [...new Set([...stackIds, ...missingCore])];
                    setStackIds(newStack);
                  }} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
                  }}>
                    + Добавить {missingCore.length} базовых веществ
                  </button>
                </div>
              )}
            </GlassCard>
          );
        } catch { return null; }
      })()}

      {/* Auto-fix button */}
      {analysis.critical.length > 0 && setStackIds && (
        <div style={{
          padding: '10px 12px', borderRadius: 12, marginBottom: 8,
          background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
        }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, marginBottom: 6 }}>
            🚫 Критические конфликты: <strong style={{ color: '#ef4444' }}>{analysis.critical.length} пар</strong>.
            Рекомендуется удалить все конфликтующие вещества ({analysis.riskyIds.size} шт).
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => {
              const clean = stackIds.filter(id => !analysis.riskyIds.has(id));
              if (setStackIds) setStackIds(clean);
            }} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
            }}>🚫 Удалить все ({analysis.riskyIds.size})</button>
            <button onClick={() => {
              const firstPair = analysis.critical[0];
              const clean = stackIds.filter(id => id !== firstPair.a && id !== firstPair.b);
              if (setStackIds) setStackIds(clean);
            }} style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b',
            }}>⚠ {analysis.critical[0]?.nameA} + {analysis.critical[0]?.nameB}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PairCard({ p, open, onToggle, compact }: { p: any; open: boolean; onToggle: () => void; compact?: boolean }) {
  const sevColor = p.severity === 'HIGH' ? '#ef4444' : p.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e';
  const sevBg = p.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : p.severity === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)';
  const sevBorder = p.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : p.severity === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
  const typeIcon = p.type === 'conflict' ? '🚫' : p.type === 'caution' ? '⚡' : p.type === 'synergy' ? '🤝' : '➖';

  if (compact) {
    return (
      <div onClick={onToggle} style={{
        padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
        background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span>{typeIcon}</span>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{p.nameA} ↔ {p.nameB}</span>
        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{(p.effect || '').slice(0, 30)}</span>
      </div>
    );
  }

  return (
    <div style={{
      padding: '7px 9px', borderRadius: 8,
      background: sevBg, border: `1px solid ${sevBorder}`,
    }}>
      <div onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11 }}>{typeIcon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{p.nameA}</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>↔</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{p.nameB}</span>
            <span style={{
              padding: '1px 5px', borderRadius: 4, fontSize: 6, fontWeight: 700,
              background: `${sevColor}18`, color: sevColor,
            }}>{p.severity === 'HIGH' ? '🔴' : p.severity === 'MEDIUM' ? '🟡' : '🟢'} {p.severity === 'HIGH' ? 'Высокий' : p.severity === 'MEDIUM' ? 'Средний' : 'Низкий'}</span>
            <span style={{
              padding: '1px 5px', borderRadius: 4, fontSize: 6, fontWeight: 600,
              background: p.type === 'synergy' ? 'rgba(34,197,94,0.1)' : p.type === 'conflict' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
              color: p.type === 'synergy' ? '#22c55e' : p.type === 'conflict' ? '#ef4444' : '#f59e0b',
            }}>{p.type === 'synergy' ? 'Синергия' : p.type === 'conflict' ? 'Конфликт' : 'Осторожно'}</span>
          </div>
        </div>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 5, paddingLeft: 20 }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, marginBottom: 3 }}>
            {p.effect}
          </div>
          {p.mechanisms && p.mechanisms.length > 0 && (
            <div style={{ fontSize: 7, color: '#a78bfa', marginBottom: 2 }}>
              🧬 Механизмы: {p.mechanisms.join(', ')}
            </div>
          )}
          {p.notes && (
            <div style={{ fontSize: 7, color: '#f59e0b', lineHeight: 1.3 }}>
              📝 {p.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
