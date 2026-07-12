// SupplementClinicScreen_parts/ClinicalPanel.tsx — клинический контроль (BioStack v2).
import React, { useMemo } from 'react';
import { selectStack } from '../../../engines/biostack-clinical-v2.engine';
import { loadProfile, entryName, card, sectionTitle, btnGhost } from './shared';

const sevColor = (s: number) => (s >= 3 ? '#ef4444' : s === 2 ? '#f59e0b' : '#94a3b8');

export const ClinicalPanel: React.FC<{
  stackIds: string[];
  onClearStops: () => void;
}> = ({ stackIds, onClearStops }) => {
  const result = useMemo(() => {
    if (stackIds.length === 0) return null;
    const profile = loadProfile();
    try {
      return selectStack(stackIds, profile, 'comprehensive', null);
    } catch (e) {
      return null;
    }
  }, [stackIds]);

  if (stackIds.length === 0 || !result) {
    return (
      <div style={card}>
        <div style={sectionTitle}>Клинический контроль</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Соберите стек — движок проверит абсолютные противопоказания, UL, лабораторные
          коррекции, избыточность путей и режим циклирования.
        </div>
      </div>
    );
  }

  const hasStop = result.hardStops.length > 0 || result.drugExclusions.length > 0;

  return (
    <div>
      <div style={{
        ...card,
        border: '1px solid ' + (hasStop ? 'rgba(239,68,68,0.4)' : 'rgba(0,230,138,0.3)'),
        background: hasStop ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            🩺 Клинический вердикт:{' '}
            <span style={{ color: hasStop ? '#ff8a9b' : 'var(--accent)' }}>
              {hasStop ? 'ЕСТЬ СТОП-ФАКТОРЫ' : 'ДОПУСТИМО К ПРИЁМУ'}
            </span>
          </div>
          {hasStop && (
            <button style={btnGhost} onClick={onClearStops}>Исключить стоп-позиции</button>
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)' }}>
          Стратегия: comprehensive · веществ в анализе: {result.ids.length} / {stackIds.length}
        </div>
        {!result.labAdjustments.length && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#60a5fa' }}>
            💡 Лабораторные коррекции недоступны — заполните профиль BioStack и введите анализы для точной настройки доз.
          </div>
        )}
      </div>

      {result.hardStops.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, color: '#ef4444' }}>🔴 Абсолютные противопоказания (удалены)</div>
          {result.hardStops.map((h: any, i: number) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: i < result.hardStops.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <b style={{ color: '#ff8a9b' }}>{entryName(h.substanceId)}</b> — {h.reason}
              {h.category && <span style={{ color: 'var(--text-dim)' }}> · {h.category}</span>}
            </div>
          ))}
        </div>
      )}

      {result.drugExclusions.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, color: '#f59e0b' }}>⚠ Исключения по фарме (HIGH)</div>
          {result.drugExclusions.map((e: any, i: number) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: i < result.drugExclusions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <b style={{ color: '#ffd28a' }}>{entryName(e.substanceId)}</b> — {e.reason}
            </div>
          ))}
        </div>
      )}

      {result.ulWarnings.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, color: '#f59e0b' }}>⚠ Превышение верхнего допустимого уровня (UL)</div>
          {result.ulWarnings.map((u: any, i: number) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: i < result.ulWarnings.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', fontSize: 13 }}>
              <b>{entryName(u.substanceId)}</b>: {u.totalDose} мг / UL {u.ul} мг ({Math.round(u.percentUL)}%) — {u.severity === 'HIGH' ? 'высокий' : 'умеренный'}
              <div style={{ color: 'var(--text-dim)' }}>{u.message}</div>
            </div>
          ))}
        </div>
      )}

      {result.labAdjustments.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, color: '#60a5fa' }}>💊 Лабораторные коррекции доз</div>
          {result.labAdjustments.map((a: any, i: number) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: i < result.labAdjustments.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', fontSize: 13 }}>
              <b>{entryName(a.substanceId)}</b>: {a.originalDose} → <b style={{ color: 'var(--accent)' }}>{a.adjustedDose}</b> ({Math.round(a.multiplier * 100)}%)
              <div style={{ color: 'var(--text-dim)' }}>{a.reason}</div>
            </div>
          ))}
        </div>
      )}

      {result.redundancy.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, color: '#f59e0b' }}>🔁 Избыточность путей</div>
          {result.redundancy.map((r: any, i: number) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: i < result.redundancy.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', fontSize: 13 }}>
              <b>{r.pathway}</b> ({r.count}): {r.names.join(', ')}
              <div style={{ color: 'var(--text-dim)' }}>{r.message}</div>
            </div>
          ))}
        </div>
      )}

      {result.cycling.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, color: '#a78bfa' }}>🔄 Режим циклирования</div>
          {result.cycling.map((c: any, i: number) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: i < result.cycling.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', fontSize: 13 }}>
              <b>{entryName(c.substanceId)}</b> — {c.durationWeeks} нед: {c.cycleNote}
            </div>
          ))}
        </div>
      )}

      {result.schedule.length > 0 && (
        <div style={card}>
          <div style={{ ...sectionTitle, color: '#00e68a' }}>⏰ Расписание (итог)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {result.schedule.map((s: any, i: number) => (
              <div key={i} style={{
                padding: '7px 10px', borderRadius: 10, fontSize: 12,
                background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.25)', color: 'var(--text)',
              }}>
                <b>{s.time}</b>: {s.ids.map((id: string) => entryName(id)).join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
