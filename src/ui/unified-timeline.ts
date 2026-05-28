import type { LabPoint, CourseEntry } from '../core/types';

export interface TimelineEvent {
  date: string;
  type: 'course' | 'lab' | 'nutrition' | 'alert';
  title: string;
  value?: string;
  color: string;
}

export function buildUnifiedTimeline(
  course: CourseEntry[],
  labs: LabPoint[],
  nutritionDates: string[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  course.forEach(c => {
    events.push({ date: new Date().toISOString().slice(0,10), type: 'course', title: `${c.substanceId} ${c.doseValue}${c.doseUnit}`, value: `Нед ${c.startWeek}-${c.endWeek}`, color: '#007aff' });
  });

  labs.forEach(l => {
    events.push({ date: l.date, type: 'lab', title: l.code, value: `${l.value} ${l.unit}`, color: '#30d158' });
  });

  nutritionDates.forEach(d => {
    events.push({ date: d, type: 'nutrition', title: 'Приём пищи зафиксирован', color: '#ff9f0a' });
  });

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function renderUnifiedTimeline(container: HTMLElement, events: TimelineEvent[]) {
  if (!events.length) {
    container.innerHTML = '<div class="card"><div class="label">Нет данных для отображения. Добавьте курс, лабы или дневник питания.</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="card"><h3>📅 Клиническая лента</h3>
      <div style="max-height:300px;overflow-y:auto;padding-right:8px;">
        ${events.map(e => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #252527;">
            <div style="width:4px;height:40px;background:${e.color};border-radius:2px;flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="font-size:12px;color:#8e8e93;">${e.date}</div>
              <div style="font-weight:500;">${e.title}</div>
              ${e.value ? `<div style="font-size:12px;color:#ccc;">${e.value}</div>` : ''}
            </div>
            <span class="badge" style="background:${e.color}22;color:${e.color};font-size:10px;">${e.type.toUpperCase()}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <button class="btn" style="margin-top:12px;" id="export-timeline">📤 Экспорт ленты (JSON)</button>
  `;

  document.getElementById('export-timeline')!.onclick = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clinical-timeline.json'; a.click();
  };
}