// SupplementClinicScreen_parts/TimingPanel.tsx — время приёма стека.
import React, { useMemo } from 'react';
import { getTimingForId, timingSlotMeta, entryName, card, sectionTitle } from './shared';

export const TimingPanel: React.FC<{ stackIds: string[] }> = ({ stackIds }) => {
  const slots = useMemo(() => {
    const map: Record<string, { id: string; reason: string }[]> = {};
    for (const id of stackIds) {
      const { slot, reason } = getTimingForId(id);
      if (!map[slot]) map[slot] = [];
      map[slot].push({ id, reason });
    }
    return map;
  }, [stackIds]);

  const slotKeys = Object.keys(slots);
  const order = ['morning_empty', 'morning_food', 'noon_food', 'afternoon_empty', 'evening_food', 'night_empty'];

  if (stackIds.length === 0) {
    return (
      <div style={card}>
        <div style={sectionTitle}>Время приёма</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Добавьте вещества в стек, чтобы получить расписание по приёму (утро/день/вечер/сон).
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={sectionTitle}>Расписание приёма · {stackIds.length} веществ</div>
      {[...order.filter((k) => slots[k]), ...slotKeys.filter((k) => !order.includes(k))].map((key) => {
        const meta = timingSlotMeta(key);
        return (
          <div key={key} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{meta.label || key}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{meta.time}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {slots[key].map((x) => (
                <div key={x.id} style={{
                  padding: '7px 10px', borderRadius: 10, fontSize: 13,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)',
                }} title={x.reason}>
                  {entryName(x.id)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: 6 }}>Логика раскладки</div>
        {slotKeys.map((key) => (
          <div key={key} style={{ fontSize: 12, color: 'var(--text-dim)', padding: '3px 0' }}>
            <b style={{ color: 'var(--text)' }}>{timingSlotMeta(key).label || key}:</b> {slots[key][0]?.reason}
          </div>
        ))}
      </div>
    </div>
  );
};
