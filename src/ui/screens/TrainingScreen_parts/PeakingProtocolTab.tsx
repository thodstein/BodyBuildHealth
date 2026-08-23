import React, { useState } from 'react';
import { getPeakingProtocol, PEAKING_PROTOCOLS, type PeakingProtocol, type PeakingWeek } from '../../../engines/peaking-protocols.engine';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 };

const STYLES = {
  pill: (on: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: 'pointer',
    border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
    background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
    color: on ? '#00e68a' : '#fff',
  }),
  cell: { fontSize: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' } as React.CSSProperties,
  label: { color: '#fff', fontSize: 10, margin: '6px 0 4px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
};

const PROTOCOL_OPTIONS: { id: PeakingProtocol; label: string; icon: string }[] = [
  { id: 'pl', label: 'Пауэрлифтинг (3 нед)', icon: '🏋️' },
  { id: 'bb', label: 'Бодибилдинг (4 нед)', icon: '💪' },
  { id: 'classic', label: 'Классический WF (4 нед)', icon: '📈' },
];

const PeakingProtocolTab: React.FC = () => {
  const [selected, setSelected] = useState<PeakingProtocol>('pl');
  const protocol = getPeakingProtocol(selected);

  return (
    <div>
      <div style={GLASS}>
        <div style={H}>📈 Протоколы пиковой фазы</div>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>
          Пиковая фаза — последние 3-4 недели перед целью (соревнования/фотосессия/пляж).
          Цель: максимальная производительность при минимальной усталости.
        </div>
        <div style={STYLES.label}>Выберите протокол</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {PROTOCOL_OPTIONS.map(o => (
            <button key={o.id} onClick={() => setSelected(o.id)} style={STYLES.pill(selected === o.id)}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>

      <div style={GLASS}>
        <div style={H}>{protocol.name}</div>
        <div style={{ fontSize: 10, color:'#fff', marginBottom: 10 }}>{protocol.description}</div>

        {/* Таблица понедельно */}
        <div style={STYLES.label}>Понедельное расписание</div>
        {protocol.weeks.map((w, i) => (
          <div key={i} style={STYLES.cell}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#fff', marginBottom: 2 }}>
              <span>Неделя {w.week}: {w.label}</span>
              <span style={{ color: ACCENT }}>RIR {w.rirMin}-{w.rirMax}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, color: '#fff' }}>
              <span>Объём {Math.round(w.volumePct * 100)}%</span>
              <span>Интенсивность {Math.round(w.intensityPct * 100)}%</span>
              {w.deloadBefore && <span style={{ color: '#ffaa00' }}>⚠ После делода</span>}
            </div>
            <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{w.focus}</div>
          </div>
        ))}
      </div>

      <div style={GLASS}>
        <div style={H}>📋 Как интегрировать в план</div>
        <div style={{ fontSize: 10, color:'#fff', lineHeight: 1.6 }}>
          <p>1. Постройте мезоцикл обычным образом.</p>
          <p>2. За {protocol.durationWeeks} нед до цели переключитесь на пиковый протокол:</p>
          <p>   • Объём: −{Math.round((1 - protocol.weeks[protocol.weeks.length - 1].volumePct) * 100)}% на финальной неделе</p>
          <p>   • RIR: → 0 на соревновательной неделе</p>
          <p>   • Интенсивность: +{Math.round((protocol.weeks[protocol.weeks.length - 1].intensityPct - 0.8) * 100)}%</p>
          <p>3. Перед началом пика — обязательная разгрузка (делод).</p>
          <p>4. После пика — активный отдых 1 нед.</p>
        </div>
      </div>
<div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить пиковый протокол «{protocol.name}» к планировщику — финальная неделя: объём ×{Math.round(protocol.weeks[protocol.weeks.length - 1].volumePct * 100)}%, RIR→{protocol.weeks[protocol.weeks.length - 1].rirMin}.</div>
        <button onClick={() => { const fw = protocol.weeks[protocol.weeks.length - 1]; applyToPlanner({ kind: 'peak', label: 'Пик «' + protocol.name + '»: объём ×' + fw.volumePct + ', RIR→' + fw.rirMin, data: { volumeMult: fw.volumePct, rirTarget: fw.rirMin } }); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить пик к планировщику</button>
      </div>
    </div>
  );
};

export default PeakingProtocolTab;
