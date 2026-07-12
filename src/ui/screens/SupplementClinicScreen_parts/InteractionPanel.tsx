// SupplementClinicScreen_parts/InteractionPanel.tsx — взаимодействия и синергии стека.
import React, { useMemo } from 'react';
import { SynergyEngine } from '../../../engines/synergy-score.engine';
import { buildMasterDB, entryName, getEntry, card, sectionTitle } from './shared';

const LEVEL_COLOR: Record<string, string> = {
  STRONG_SYNERGY: '#22c55e',
  GOOD_SYNERGY: '#4ade80',
  NEUTRAL: '#94a3b8',
  WEAK_CONFLICT: '#f59e0b',
  DANGEROUS_CONFLICT: '#ef4444',
};
const LEVEL_LABEL: Record<string, string> = {
  STRONG_SYNERGY: '🔥 Сильная синергия',
  GOOD_SYNERGY: '✅ Синергия',
  NEUTRAL: '🟦 Нейтрально',
  WEAK_CONFLICT: '⚠ Слабый конфликт',
  DANGEROUS_CONFLICT: '🔴 Опасный конфликт',
};

export const InteractionPanel: React.FC<{ stackIds: string[] }> = ({ stackIds }) => {
  const pairs = useMemo(() => {
    if (stackIds.length < 2) return [];
    const { db, subById } = buildMasterDB(stackIds);
    const out: {
      a: string; b: string; score: number; level: string;
      sharedMech: number; type: string; severity: number; desc: string;
    }[] = [];
    for (let i = 0; i < stackIds.length; i++) {
      for (let j = i + 1; j < stackIds.length; j++) {
        const a = subById[stackIds[i]], b = subById[stackIds[j]];
        if (!a || !b) continue;
        const r = SynergyEngine.calculatePair(a, b, db);
        // прямое указание конфликта/синергии из каталога имеет приоритет
        const ea = getEntry(a.id), eb = getEntry(b.id);
        let type = 'computed', severity = 0, desc = '';
        const syn = (ea?.synergies || []).find((s: any) => s.with === b.id);
        const con = (ea?.conflicts || []).find((c: any) => c.with === b.id);
        if (syn) { type = 'synergy'; severity = syn.severity === 'HIGH' ? 3 : syn.severity === 'MEDIUM' ? 2 : 1; desc = syn.effect || ''; }
        else if (con) { type = 'conflict'; severity = con.severity === 'HIGH' ? 3 : con.severity === 'MEDIUM' ? 2 : 1; desc = con.effect || ''; }
        out.push({
          a: a.id, b: b.id, score: r.score, level: r.level,
          sharedMech: (a.mechanisms || []).filter((m) => (b.mechanisms || []).includes(m)).length,
          type, severity, desc,
        });
      }
    }
    return out.sort((x, y) => x.score - y.score);
  }, [stackIds]);

  const organLoad = useMemo(() => {
    const load: Record<string, number> = {};
    for (const id of stackIds) {
      const e = getEntry(id);
      const organs: string[] = e?.organs || [];
      const systems: string[] = e?.systems || [];
      for (const o of [...organs, ...systems]) load[o] = (load[o] || 0) + 1;
    }
    return Object.entries(load).sort((x, y) => y[1] - x[1]).slice(0, 8);
  }, [stackIds]);

  if (stackIds.length < 2) {
    return (
      <div style={card}>
        <div style={sectionTitle}>Взаимодействия</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Добавьте минимум 2 вещества в стек, чтобы рассчитать синергию и конфликты.
        </div>
      </div>
    );
  }

  const conflicts = pairs.filter((p) => p.level === 'DANGEROUS_CONFLICT' || p.type === 'conflict' || p.score < 0);
  const synergies = pairs.filter((p) => p.level === 'STRONG_SYNERGY' || p.level === 'GOOD_SYNERGY');

  return (
    <div>
      <div style={sectionTitle}>Сводка: {synergies.length} синергий · {conflicts.length} конфликтов · {pairs.length} пар</div>

      {organLoad.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>Нагрузка по органам / системам</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {organLoad.map(([o, n]) => (
              <span key={o} style={{
                padding: '6px 10px', borderRadius: 10, fontSize: 13,
                background: n >= 3 ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.05)',
                border: '1px solid ' + (n >= 3 ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'),
                color: 'var(--text)',
              }}>
                {o}: <b>{n}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, color: '#ef4444' }}>🔴 Конфликты и риски</div>
          {conflicts.map((p, i) => (
            <div key={i} style={{
              padding: '9px 0', borderBottom: i < conflicts.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div style={{ fontWeight: 700, color: '#ff8a9b' }}>
                {entryName(p.a)} × {entryName(p.b)}
                {p.desc ? '' : ` — ${LEVEL_LABEL[p.level]}`}
              </div>
              {p.desc && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{p.desc}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={sectionTitle}>Матрица пар (отсортировано: конфликт → синергия)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pairs.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 11px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid ' + (LEVEL_COLOR[p.level] || '#94a3b8'),
            }}>
              <div style={{ fontSize: 13 }}>
                <b>{entryName(p.a)}</b> × <b>{entryName(p.b)}</b>
                {p.sharedMech > 0 && <span style={{ color: 'var(--text-dim)' }}> · общ. мех: {p.sharedMech}</span>}
                {p.desc && <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{p.desc}</div>}
              </div>
              <div style={{ fontSize: 12, color: LEVEL_COLOR[p.level] || '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {p.score > 0 ? '+' : ''}{p.score}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
