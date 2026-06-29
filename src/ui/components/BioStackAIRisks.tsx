import React, { useMemo, useState } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { GlassCard } from './BioStackAIConstants';

type PairInfo = {
  a: string; b: string; nameA: string; nameB: string;
  type: string; effect: string; severity: string; mechanisms: string[]; notes: string;
};

type SubRisk = {
  id: string; name: string; score: number; conflictCount: number; highCount: number;
  profileIssues: string[];
};

export function RisksTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds?: (ids: string[]) => void }) {
  const analysis = useMemo(() => {
    if (stackIds.length < 2) return null;
    const catData = SUPPORT_CATALOG_DATA;
    const pairs: PairInfo[] = [];

    for (let i = 0; i < stackIds.length; i++) {
      for (let j = i + 1; j < stackIds.length; j++) {
        const idA = stackIds[i], idB = stackIds[j];
        const direct = ALL_INTERACTIONS.filter(inx =>
          (inx.substanceA === idA && inx.substanceB === idB) ||
          (inx.substanceA === idB && inx.substanceB === idA));
        if (direct.length > 0) {
          direct.forEach(inx => {
            pairs.push({
              a: idA, b: idB,
              nameA: catData[idA]?.nameRu || catData[idA]?.name || idA,
              nameB: catData[idB]?.nameRu || catData[idB]?.name || idB,
              type: inx.type, effect: inx.effect, severity: inx.severity,
              mechanisms: inx.mechanisms || [], notes: inx.notes || '',
            });
          });
        } else {
          pairs.push({
            a: idA, b: idB,
            nameA: catData[idA]?.nameRu || catData[idA]?.name || idA,
            nameB: catData[idB]?.nameRu || catData[idB]?.name || idB,
            type: 'no_interaction', effect: 'Взаимодействий не найдено',
            severity: 'LOW', mechanisms: [], notes: '',
          });
        }
      }
    }

    const critical = pairs.filter(p => p.severity === 'HIGH' && (p.type === 'conflict' || p.type === 'caution'));
    const moderate = pairs.filter(p => p.severity === 'MEDIUM' && (p.type === 'conflict' || p.type === 'caution'));
    const cumulative = pairs.filter(p => (p.severity === 'LOW' || p.type === 'synergy' || p.type === 'no_interaction'));

    const riskScore = Math.min(100,
      critical.length * 10 + moderate.length * 5 + cumulative.filter(p => p.type === 'conflict' || p.type === 'caution').length * 1
    );
    const riskLevel = riskScore >= 50 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';

    const subRisk: Record<string, SubRisk> = {};
    stackIds.forEach(id => {
      const name = catData[id]?.nameRu || catData[id]?.name || id;
      subRisk[id] = { id, name, score: 0, conflictCount: 0, highCount: 0, profileIssues: [] };
    });

    pairs.forEach(p => {
      const pts = p.severity === 'HIGH' ? 10 : p.severity === 'MEDIUM' ? 5 : 1;
      if (p.type === 'conflict' || p.type === 'caution') {
        if (subRisk[p.a]) { subRisk[p.a].score += pts; subRisk[p.a].conflictCount++; if (p.severity === 'HIGH') subRisk[p.a].highCount++; }
        if (subRisk[p.b]) { subRisk[p.b].score += pts; subRisk[p.b].conflictCount++; if (p.severity === 'HIGH') subRisk[p.b].highCount++; }
      }
    });

    // Profile compatibility checks
    if (profile) {
      if (profile.healthConditions) {
        for (const cond of profile.healthConditions) {
          stackIds.forEach(id => {
            const cat = catData[id];
            if (!cat) return;
            const name = cat.nameRu || cat.name || id;
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

    const sortedSubs = Object.values(subRisk).sort((a, b) => b.score - a.score);

    // Risk by organ system
    const organRisk: Record<string, { score: number; substances: string[] }> = {};
    pairs.forEach(p => {
      if (p.type === 'conflict' || p.type === 'caution') {
        const pts = p.severity === 'HIGH' ? 10 : p.severity === 'MEDIUM' ? 5 : 1;
        (p.mechanisms || []).forEach(m => {
          if (!organRisk[m]) organRisk[m] = { score: 0, substances: [] };
          organRisk[m].score += pts;
          if (!organRisk[m].substances.includes(p.nameA)) organRisk[m].substances.push(p.nameA);
          if (!organRisk[m].substances.includes(p.nameB)) organRisk[m].substances.push(p.nameB);
        });
      }
    });

    const worstPairs = [...critical, ...moderate].slice(0, 5);
    const suggestions = worstPairs.map(p => ({
      removeA: p.a, removeB: p.b, nameA: p.nameA, nameB: p.nameB,
      effect: p.effect, reduction: p.severity === 'HIGH' ? 10 : 5,
      newScore: Math.max(0, riskScore - (p.severity === 'HIGH' ? 10 : 5)),
    }));

    return { pairs, critical, moderate, cumulative, total: pairs.length, riskScore, riskLevel, sortedSubs, suggestions, organRisk, hasProfileIssues: Object.values(subRisk).some(s => s.profileIssues.length > 0) };
  }, [stackIds, profile]);

  const [expandedPair, setExpandedPair] = useState<Record<string, boolean>>({});
  const [graphTab, setGraphTab] = useState<'graph' | 'list'>('list');

  if (stackIds.length < 2) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Нет пар для анализа</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Добавьте минимум 2 препарата в стек для расчёта взаимодействий</div>
      </div>
    );
  }

  if (!analysis) return null;

  const severityColor = (s: string) => s === 'HIGH' ? '#ef4444' : s === 'MEDIUM' ? '#f59e0b' : '#22c55e';
  const severityBg = (s: string) => s === 'HIGH' ? 'rgba(239,68,68,0.06)' : s === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)';
  const severityBorder = (s: string) => s === 'HIGH' ? 'rgba(239,68,68,0.12)' : s === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
  const typeIcon = (t: string) => t === 'conflict' ? '🚫' : t === 'caution' ? '⚡' : t === 'synergy' ? '🤝' : '➖';

  // ── Graph ──
  const graphNodes = stackIds.map((id, i) => {
    const cat = SUPPORT_CATALOG_DATA[id];
    return { id, label: cat?.nameRu || cat?.name || id, idx: i };
  });
  const angles = graphNodes.map((_, i) => (2 * Math.PI * i) / graphNodes.length - Math.PI / 2);
  const cx = 50, cy = 50, r = 38;
  const positions = angles.map(a => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }));
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const pairMap = new Map<string, PairInfo>();
  analysis.pairs.forEach(p => pairMap.set(pairKey(p.a, p.b), p));

  const riskyIds = new Set(analysis.critical.map(p => [p.a, p.b]).flat());
  const moderateIds = new Set(analysis.moderate.map(p => [p.a, p.b]).flat());

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Overall risk score */}
      <GlassCard title="⚠ Анализ взаимодействий" icon="📊" color={analysis.riskLevel === 'HIGH' ? '#ef4444' : analysis.riskLevel === 'MEDIUM' ? '#f59e0b' : '#22c55e'}>
        {/* Big risk gauge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10,
          padding: '10px 12px', borderRadius: 12,
          background: `linear-gradient(135deg,${severityColor(analysis.riskLevel)}12,${severityColor(analysis.riskLevel)}04)`,
          border: `1px solid ${severityColor(analysis.riskLevel)}18`,
        }}>
          <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ width: 52, height: 52, transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={severityColor(analysis.riskLevel)} strokeWidth="3"
                strokeDasharray={`${analysis.riskScore} ${100 - analysis.riskScore}`} strokeLinecap="round"
                strokeDashoffset="0" opacity="0.8" />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: severityColor(analysis.riskLevel) }}>{analysis.riskScore}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: severityColor(analysis.riskLevel), marginBottom: 2 }}>
              {analysis.riskLevel === 'HIGH' ? '🔴 Высокий риск взаимодействий' : analysis.riskLevel === 'MEDIUM' ? '🟡 Умеренный риск' : '🟢 Низкий риск'}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
              {analysis.total} пар • {analysis.critical.length} критических • {analysis.moderate.length} умеренных • {analysis.cumulative.length} безопасных
            </div>
          </div>
        </div>

        {/* Per-substance risk mini bars */}
        {analysis.sortedSubs.filter(s => s.score > 0 || s.profileIssues.length > 0).length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>📊 Вклад в риск по веществам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {analysis.sortedSubs.filter(s => s.score > 0 || s.profileIssues.length > 0).slice(0, 6).map(s => {
                const maxScore = Math.max(...analysis.sortedSubs.map(x => x.score), 1);
                const pct = Math.round(s.score / maxScore * 100);
                const hasProfileIssue = s.profileIssues.length > 0;
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 6px', borderRadius: 6,
                    background: hasProfileIssue ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.015)',
                  }}>
                    <span style={{ width: 80, fontSize: 7, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ width: pct + '%', height: '100%', borderRadius: 2, background: s.score >= 20 ? '#ef4444' : s.score >= 10 ? '#f59e0b' : '#22c55e' }} />
                    </div>
                    <span style={{ fontSize: 7, color: s.score >= 20 ? '#ef4444' : s.score >= 10 ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight: 600, minWidth: 20, textAlign: 'right' }}>{s.score}</span>
                    {s.highCount > 0 && <span style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{s.highCount}🔴</span>}
                    {hasProfileIssue && <span style={{ fontSize: 6, color: '#f59e0b' }}>⚠</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Risk by organ/system */}
        {Object.keys(analysis.organRisk).length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>🎯 Риск по механизмам</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(analysis.organRisk).sort((a, b) => b[1].score - a[1].score).slice(0, 8).map(([m, info]) => (
                <span key={m} style={{
                  fontSize: 6, padding: '2px 5px', borderRadius: 4,
                  background: info.score >= 20 ? 'rgba(239,68,68,0.06)' : info.score >= 10 ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                  border: `1px solid ${info.score >= 20 ? 'rgba(239,68,68,0.12)' : info.score >= 10 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)'}`,
                  color: info.score >= 20 ? '#ef4444' : info.score >= 10 ? '#f59e0b' : '#22c55e',
                }} title={`${info.substances.join(', ')}`}>
                  {m.replace(/_/g, ' ').slice(0, 20)} {info.score}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
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
      {graphTab === 'graph' && (
        <GlassCard title="🕸️ Граф взаимодействий" icon="🕸️" color="#8b5cf6">
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: 220, background: 'rgba(0,0,0,0.15)', borderRadius: 12 }}>
            {(() => {
              const drawn = new Set<string>();
              return analysis.pairs.map(p => {
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
              });
            })()}
            {graphNodes.map((n, i) => {
              const p = positions[i];
              const isRisky = riskyIds.has(n.id);
              const isModerate = moderateIds.has(n.id);
              return (
                <g key={n.id}>
                  <circle cx={p.x} cy={p.y} r={5}
                    fill={isRisky ? '#ef4444' : isModerate ? '#f59e0b' : '#1a1a1e'}
                    stroke={isRisky ? '#ef4444' : isModerate ? '#f59e0b' : '#00e68a'} strokeWidth={1.2} />
                  <text x={p.x} y={p.y + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={3.5} fontWeight={600}>{n.label}</text>
                </g>
              );
            })}
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
      {analysis.cumulative.length > 0 && (
        <GlassCard title={`🟢 Безопасные / Нет данных (${analysis.cumulative.length})`} icon="➖" color="#22c55e">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {analysis.cumulative.slice(0, 6).map((p, idx) => {
              const key = `${p.a}|${p.b}|${p.type}|${idx}|safe`;
              const open = expandedPair[key] ?? false;
              return <PairCard key={key} p={p} open={open} onToggle={() => setExpandedPair(prev => ({ ...prev, [key]: !open }))} compact />;
            })}
            {analysis.cumulative.length > 6 && (
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 2 }}>
                + {analysis.cumulative.length - 6} пар без значимых взаимодействий
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Profile-specific warnings */}
      {analysis.hasProfileIssues && (
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

      {/* Auto-fix button */}
      {analysis.critical.length > 0 && setStackIds && (
        <div style={{
          padding: '10px 12px', borderRadius: 12, marginBottom: 8,
          background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
        }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, marginBottom: 6 }}>
            🚫 Критические конфликты: <strong style={{ color: '#ef4444' }}>{analysis.critical.length} пар</strong>. 
            Рекомендуется удалить все конфликтующие вещества ({riskyIds.size} шт).
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => {
              const clean = stackIds.filter(id => !riskyIds.has(id));
              setStackIds(clean);
            }} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
            }}>🚫 Удалить все ({riskyIds.size})</button>
            <button onClick={() => {
              const firstPair = analysis.critical[0];
              const clean = stackIds.filter(id => id !== firstPair.a && id !== firstPair.b);
              setStackIds(clean);
            }} style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b',
            }}>⚠ {analysis.critical[0]?.nameA} + {analysis.critical[0]?.nameB}</button>
          </div>
        </div>
      )}

      {/* Critical substances warning */}
      {analysis.sortedSubs.filter(s => s.score >= 20).length > 0 && (
        <div style={{
          padding: '8px 10px', borderRadius: 10, marginBottom: 8,
          background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.08)',
        }}>
          <div style={{ fontSize: 8, fontWeight: 600, color: '#ef4444', marginBottom: 3 }}>
            ⚠ Вещества с высоким риском:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {analysis.sortedSubs.filter(s => s.score >= 20).map(s => {
              const cat = SUPPORT_CATALOG_DATA[s.id];
              const mainConflicts = analysis.critical.filter(p => p.a === s.id || p.b === s.id).slice(0, 2);
              return (
                <span key={s.id} style={{
                  padding: '3px 6px', borderRadius: 6, fontSize: 7,
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)',
                  color: '#f87171',
                }} title={mainConflicts.map(p => `${p.nameA} ↔ ${p.nameB}: ${p.effect}`).join('\n')}>
                  {s.name} ({s.score} pts)
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PairCard({ p, open, onToggle, compact }: { p: PairInfo; open: boolean; onToggle: () => void; compact?: boolean }) {
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
        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{p.effect.slice(0, 30)}</span>
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
          {p.mechanisms.length > 0 && (
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
