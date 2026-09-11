/**
 * CardioDiarySlot.tsx — кардио-слой дня для дневника (п.6 плана).
 * Автономная секция без пропсов: активный цикл + журнал.
 * TrainingDiaryHub.tsx НЕ тронут (чужая зона): владелец монтирует слот
 * в нужном месте хаба одной строкой (<CardioDiarySlot />) по своему решению.
 * План на сегодня — cardioSessionsForDate, факт — loadCardioLog за дату,
 * итог недели — cardioWeekFact.
 */
import React, { useMemo } from 'react';
import {
  loadActiveCardioCycle, cardioSessionsForDate, cardioWeekForDate,
  cardioEquipmentLabel, CARDIO_PHASE_LABELS,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog } from '../../../engines/lms/cardio-diary.engine';
import { CARD, ROW, LABEL, Badge, HINT_SM, EmptyState } from './CardioUI';

const TYPE_LABEL: Record<string, string> = { zone2: 'Zone 2', miss: 'MISS', hiit: 'HIIT', recovery: 'Rec' };

function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export const CardioDiarySlot: React.FC = () => {
  const data = useMemo(() => {
    try {
      const cycle = loadActiveCardioCycle();
      if (!cycle) return null;
      const today = localToday();
      const day = cardioSessionsForDate(cycle, today, cycle.startDate);
      const week = cardioWeekForDate(cycle, today, cycle.startDate);
      const log = loadCardioLog().filter(e => e.date === today);
      const factMin = log.reduce((s, e) => s + (e.durationMin || 0), 0);
      const factKcal = log.reduce((s, e) => s + (e.calories || 0), 0);
      return { cycle, day, week, log, factMin, factKcal };
    } catch { return null; }
  }, []);
  if (!data) {
    return (
      <div style={CARD}>
        <div style={LABEL}>🏃 Кардио сегодня</div>
        <EmptyState icon="🏃" title="Нет активного цикла" desc="Соберите цикл в кардио-конструкторе — слой дня появится здесь." />
      </div>
    );
  }
  const { cycle, day, week, log, factMin, factKcal } = data;
  const planMin = day ? day.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0) : 0;
  return (
    <div style={CARD} data-testid="cardio-diary-slot">
      <div style={ROW}>
        <span style={LABEL}>🏃 Кардио сегодня</span>
        {week && <Badge>{CARDIO_PHASE_LABELS[week.phase] ?? week.phase} · нед {week.week}</Badge>}
      </div>
      {day && day.sessions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {day.sessions.map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: '#fff' }}>
              {TYPE_LABEL[s.type] ?? s.type} {s.durationMin} мин{s.equipment ? ` · ${cardioEquipmentLabel(s.equipment)}` : ''}
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#fff' }}>План: {planMin} мин · факт: {factMin} мин{factKcal > 0 ? ` · ${factKcal} ккал` : ''}</div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#fff' }}>На сегодня кардио не запланировано{log.length > 0 ? `, но записано ${factMin} мин — внеплановая активность.` : '.'}</div>
      )}
      {log.length === 0 && <div style={HINT_SM}>Отметьте выполнение в дневнике кардио (шаг «Дневник» конструктора).</div>}
      <div style={HINT_SM}>{cycle.name}</div>
    </div>
  );
};
