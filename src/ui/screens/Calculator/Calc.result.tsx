import React, { useState } from 'react';
import type { LabDelta, SystemRisk, ScheduleItem } from '../../../engines/support-plan';
import { SYNERGY_ID_LABELS } from '../../../engines/support-plan';
import { GLASS, BADGE } from './Calc.types';

export function RiskBar({ label, icon, value }: { label: string; icon: string; value: number }) {
  const c = value >= 60 ? '#ef4444' : value >= 30 ? '#fbbf24' : '#22c55e';
  return <div style={{ ...GLASS, padding: '6px 10px', marginBottom: 3 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</span>
          <span style={{ color: c, fontWeight: 800 }}>{value}%</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: c, borderRadius: 2 }} />
        </div>
      </div>
    </div>
  </div>;
}

export function MechanismView({ sys }: { sys: SystemRisk }) {
  const [open, setOpen] = useState(false);
  const hasTzData = sys.mechanisms.some(m => m.mechId !== undefined);
  const tzBadge = hasTzData
    ? <span style={{ fontSize: 7, fontWeight: 700, color: '#00e68a', background: 'rgba(0,230,138,0.1)', padding: '1px 4px', borderRadius: 4, marginRight: 4 }}>TZ</span>
    : <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: 4, marginRight: 4 }}>эвр</span>;
  return <div>
    <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 0' }}>
      {tzBadge}
      <span style={{ fontSize: 10, fontWeight: 600 }}>{sys.icon} {sys.label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: sys.rawScore >= 60 ? '#ef4444' : sys.rawScore >= 30 ? '#fbbf24' : '#22c55e' }}>{sys.rawScore}% → {sys.afterSupport}%</span>
      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
    </div>
    {open && <div style={{ paddingLeft: 12 }}>{sys.mechanisms.map(m => {
      const qColor = m.q_label === 'A' ? '#22c55e' : m.q_label === 'B' ? '#fbbf24' : m.q_label === 'C' ? '#f97316' : 'var(--text-dim)';
      return <div key={m.id} style={{ marginBottom: 4, fontSize: 8, color: m.active ? 'var(--text)' : 'var(--text-dim)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: m.active ? '#fbbf24' : 'rgba(255,255,255,0.15)' }} />
          <span style={{ flex: 1 }}>{m.name}</span>
          {m.mechId && <span style={{ fontSize: 6, color: 'var(--text-dim)' }}>{m.mechId}</span>}
          <span style={{ color: m.contribution > 30 ? '#ef4444' : '#fbbf24' }}>{m.contribution}%</span>
        </div>
        {hasTzData && m.mechId && <div style={{ paddingLeft: 8, marginTop: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {m.weight !== undefined && <span style={{ color: '#818cf8' }}>w={m.weight}</span>}
          {m.m_i !== undefined && <span style={{ color: '#06b6d4' }}>m={m.m_i.toFixed(2)}</span>}
          {m.E_i !== undefined && <span style={{ color: '#a855f7' }}>E={m.E_i.toFixed(2)}</span>}
          {m.k_used !== undefined && m.k_used > 0 && <span style={{ color: '#22c55e' }}>k={m.k_used.toFixed(2)}</span>}
          {m.q_label && <span style={{ color: qColor, fontWeight: 700 }}>док:{m.q_label}</span>}
        </div>}
      </div>;
    })}</div>}
  </div>;
}

export function SchedBlock({ items, title }: { items: ScheduleItem[]; title: string }) {
  if (items.length === 0) return null;
  return <div style={{ marginBottom: 6 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{title}</div>
    {items.map(item =>
      <div key={item.substanceId} style={{ ...GLASS, padding: '5px 10px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12 }}>💊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{item.instructions}</div>
        </div>
        <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>{item.dose}</span>
        {item.synergyGroup && <span style={BADGE('#818cf8')}>{SYNERGY_ID_LABELS[item.synergyGroup]?.slice(0, 10)}</span>}
      </div>
    )}
  </div>;
}

export function LabDeltaView({ deltas }: { deltas: LabDelta[] }) {
  if (deltas.length === 0) return <div style={{ ...GLASS, padding: 12, textAlign: 'center', fontSize: 9, color: 'var(--text-dim)' }}>Нет данных</div>;
  const critical = deltas.filter(d => d.trend === 'critical');
  const worsening = deltas.filter(d => d.trend === 'worsening');
  return <div>
    {critical.length > 0 && <div style={{ marginBottom: 4 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444' }}>⚠ Критические: {critical.map(d => d.marker).join(', ')}</span></div>}
    {worsening.length > 0 && <div style={{ marginBottom: 4 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24' }}>⚠ Ухудшение: {worsening.map(d => d.marker).join(', ')}</span></div>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      {deltas.slice(0, 16).map(d =>
        <div key={d.marker} style={{ ...GLASS, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 7 }}>
          <span style={{ fontWeight: 600, color: 'var(--text)', width: 60 }}>{d.marker}</span>
          <span style={{ color: 'var(--text-dim)' }}>{d.sliceValues.map(v => v ?? '—').join('→')}</span>
          <span style={{ marginLeft: 'auto', color: d.trend === 'critical' ? '#ef4444' : d.trend === 'worsening' ? '#fbbf24' : '#22c55e' }}>{d.trend === 'critical' ? '❗' : d.trend === 'worsening' ? '⚠' : '✓'}</span>
        </div>
      )}
    </div>
  </div>;
}