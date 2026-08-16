/**
 * CardioPreviewStep.tsx — шаг 3 мастера кардио: собрать цикл, карточки метрик,
 * график объёма и таблица недель (фазы/сессии/минуты/ккал).
 */
import React, { useMemo, useState } from 'react';
import {
  cardioCycleSummary, cardioQualityReport, cardioEquipmentLabel, CARDIO_GOAL_LABELS, CARDIO_PHASE_LABELS,
  type CardioCycle, type CardioType,
} from '../../../engines/lms/cardio.engine';
import { CardioVolumeChart } from './CardioVolumeChart';
import { CardioProgressCard } from './CardioProgressCard';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const BTN: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 44,
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.5)', color: '#00e68a' };

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Rec' };
const PHASE_COLOR: Record<string, string> = {
  base: '#22c55e', build: '#3b82f6', maintenance: '#8b5cf6', contest_prep: '#f59e0b', taper: '#eab308', peak: '#ef4444', transition: '#71717a',
};

export const CardioPreviewStep: React.FC<{
  cycle: CardioCycle | null;
  onBuild: () => void;
  onRename: (name: string) => void;
  daysAvailable: number;
}> = ({ cycle, onBuild, onRename, daysAvailable }) => {
  const [showWeeks, setShowWeeks] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const summary = useMemo(() => (cycle ? cardioCycleSummary(cycle) : null), [cycle]);
  const quality = useMemo(() => (cycle ? cardioQualityReport(cycle, daysAvailable) : null), [cycle, daysAvailable]);

  if (!cycle || !summary) {
    return (
      <div style={CARD}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          Соберите кардио-цикл из параметров и стартов — появится предпросмотр по неделям.
        </div>
        <button style={BTN_PRIMARY} onClick={onBuild}>🛠 Собрать и сохранить цикл</button>
      </div>
    );
  }

  const metrics = [
    { label: 'Недель', value: String(cycle.totalWeeks), color: '#22c55e' },
    { label: 'Мин/нед', value: String(summary.avgMinutesPerWeek), color: '#3b82f6' },
    { label: 'Ккал/нед', value: String(summary.avgKcalPerWeek), color: '#f59e0b' },
    { label: 'HIIT-нед', value: String(summary.hiitWeeks), color: '#a78bfa' },
    { label: 'Цель', value: CARDIO_GOAL_LABELS[cycle.goal], color: '#94a3b8' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={CARD}>
        <div style={ROW}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{cycle.name}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>создан {new Date(cycle.createdAt).toLocaleDateString('ru-RU')}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ flex: '1 1 90px', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
        <button style={BTN_PRIMARY} onClick={onBuild}>🔄 Пересобрать цикл</button>
      </div>

      {/* Качество цикла */}
      {quality && (
        <div style={CARD}>
          <div style={ROW}>
            <span style={LABEL}>📊 Качество цикла</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: quality.score >= 85 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444' }}>{quality.score}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>/100</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: quality.score + '%', height: '100%', borderRadius: 3, background: quality.score >= 85 ? '#22c55e' : quality.score >= 60 ? '#f59e0b' : '#ef4444' }} />
          </div>
          {quality.findings.map((f, i) => (
            <div key={i} style={{ fontSize: 10, lineHeight: 1.4, color: f.level === 'warn' ? '#fbbf24' : f.level === 'ok' ? 'rgba(74,222,128,0.85)' : 'rgba(255,255,255,0.5)' }}>
              {f.level === 'warn' ? '⚠ ' : f.level === 'ok' ? '✅ ' : '💡 '}{f.text}
            </div>
          ))}
        </div>
      )}

      {/* Переименование */}
      {cycle && (
        <div style={CARD}>
          <div style={LABEL}>✏️ Название цикла</div>
          <div style={ROW}>
            <input value={nameDraft || cycle.name} onChange={e => setNameDraft(e.target.value)} style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }} aria-label="Название цикла" />
            <button style={BTN_PRIMARY} onClick={() => { if (nameDraft.trim()) { onRename(nameDraft.trim()); setNameDraft(''); } }}>💾 Переименовать</button>
          </div>
        </div>
      )}

      <CardioProgressCard cycle={cycle} />
      <CardioVolumeChart cycle={cycle} />

      <div style={CARD}>
        <div style={ROW}>
          <span style={LABEL}>🗓 Недели</span>
          <button style={{ ...BTN, minHeight: 32, padding: '6px 12px' }} onClick={() => setShowWeeks(v => !v)}>{showWeeks ? '▾ Скрыть' : '▸ Показать'}</button>
        </div>
        {showWeeks && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {cycle.weeks.map(w => (
              <div key={w.week} style={ROW}>
                <span style={{ width: 26, fontSize: 11, fontWeight: 800, color: PHASE_COLOR[w.phase] ?? '#888' }}>{w.week}</span>
                <span style={{ width: 92, fontSize: 11, color: 'var(--text-dim)' }}>
                  {CARDIO_PHASE_LABELS[w.phase]}{w.deload ? ' · делод' : ''}{w.taper ? ' · taper' : ''}
                </span>
                <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.sessions.map(s => `${TYPE_LABEL[s.type]} ${s.durationMin}×${s.weeklyFrequency}${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? ' · ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join('  |  ')}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 74, textAlign: 'right' }}>{w.totalMinutes} мин · {w.totalKcal} ккал</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {cycle.rationale.length > 0 && (
        <div style={CARD}>
          <div style={LABEL}>💡 Обоснование</div>
          {cycle.rationale.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>• {r}</div>
          ))}
        </div>
      )}
    </div>
  );
};
