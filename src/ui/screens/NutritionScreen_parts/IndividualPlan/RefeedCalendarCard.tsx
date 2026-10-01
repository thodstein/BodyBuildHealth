/**
 * RefeedCalendarCard.tsx — «🔁 Рефиды и диет-брейки» (PRO): календарь на N недель вперёд
 * для сушки/рекомпа. Источник — чистый `planner-refeed-calendar.engine`. Только подача +
 * запись дат в календарь спецприёмов (`he_special_meals`, применится при генерации).
 */
import React, { useMemo, useState } from 'react';
import { GlassCard } from './ui';
import { buildRefeedCalendar } from './planner-refeed-calendar.engine';

interface Props {
  goal: string;
  startDate: string;
  bodyFatPct?: number | null;
}

const HORIZONS = [4, 8, 12, 26];
const chip = (color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 9.5, fontWeight: 800, background: `${color}18`, border: `1px solid ${color}44`, color: '#fff' });

export const RefeedCalendarCard: React.FC<Props> = ({ goal, startDate, bodyFatPct }) => {
  const [horizon, setHorizon] = useState(8);
  const cal = useMemo(() => buildRefeedCalendar({ goal, startDate, horizonWeeks: horizon, bodyFatPct }), [goal, startDate, horizon, bodyFatPct]);
  if (cal.mode === 'none') return null;

  const addToCalendar = () => {
    try {
      const raw = JSON.parse(localStorage.getItem('he_special_meals') || '[]');
      const list = Array.isArray(raw) ? raw.filter((m: any) => m && typeof m.date === 'string') : [];
      const have = new Set(list.map((m: any) => `${m.date}:${m.type}`));
      let added = 0;
      for (const w of cal.weeks) {
        for (const d of w.refeedDates) {
          if (!have.has(`${d}:refeed`)) { list.push({ date: d, type: 'refeed' }); have.add(`${d}:refeed`); added++; }
        }
        if (w.isDietBreak) {
          const key = `${w.dateStart}:diet_break`;
          // диет-брейк кодируем рефид-днём на старте недели (мод «Рефид» на день) + пометка
          if (!have.has(key) && !have.has(`${w.dateStart}:refeed`)) { list.push({ date: w.dateStart, type: 'refeed' }); have.add(`${w.dateStart}:refeed`); added++; }
        }
      }
      localStorage.setItem('he_special_meals', JSON.stringify(list.slice(-400)));
      try { window.dispatchEvent(new Event('storage')); } catch {}
      (window as any).showToast?.(added > 0 ? `📅 ${added} рефид-дн. добавлены в календарь — применится при генерации плана` : 'Рефиды уже в календаре', added > 0 ? 'success' : 'info');
    } catch { (window as any).showToast?.('Не удалось записать календарь', 'error'); }
  };

  const printReport = () => {
    try {
      const rows = cal.weeks.map(w => `<tr>
        <td>${w.weekIndex}</td><td>${w.dateStart} – ${w.dateEnd}</td>
        <td>${w.isDietBreak ? '🏖 диет-брейк (поддержание)' : w.refeedDates.length ? '🔄 рефид: ' + w.refeedDates.join(', ') : '—'}</td></tr>`).join('');
      const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Рефиды и диет-брейки</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:18px;color:#111}h1{font-size:19px}
      table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
      th{background:#f2f2f2}@page{margin:12mm}</style></head><body>
      <h1>🔁 Рефиды и диет-брейки (${cal.mode === 'cut' ? 'сушка' : 'рекомпозиция'})</h1>
      <table><thead><tr><th>Нед</th><th>Даты</th><th>План</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="font-size:12px;color:#444">${cal.notes.join('<br>')}</p></body></html>`;
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => { try { w.print(); } catch {} }, 250); }
    } catch { /* print недоступен */ }
  };

  return (
    <GlassCard title="Рефиды и диет-брейки" icon="🔁" color="#8b5cf6">
      <div data-refeed-calendar="1" data-mode={cal.mode}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <span style={chip('#a855f7')}>🔄 рефидов: {cal.refeedCount}</span>
          <span style={chip('#22c55e')}>🏖 диет-брейков: {cal.dietBreakWeeks} нед</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {HORIZONS.map(h => (
            <button key={h} data-refeed-horizon={h} onClick={() => setHorizon(h)}
              style={{ minHeight: 44, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 800, background: horizon === h ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.06)', border: horizon === h ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>{h} нед</button>
          ))}
          <button data-refeed-apply onClick={addToCalendar}
            style={{ minHeight: 44, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 800, background: 'rgba(0,230,138,0.14)', border: '1px solid rgba(0,230,138,0.4)', color: '#fff', marginLeft: 'auto' }}>📅 В календарь</button>
          <button data-refeed-print onClick={printReport}
            style={{ minHeight: 44, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>🖨</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table data-refeed-weeks style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {cal.weeks.map(w => (
                <tr key={w.weekIndex} data-refeed-week={w.weekIndex} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: w.isDietBreak ? 'rgba(34,197,94,0.06)' : 'transparent' }}>
                  <td style={{ padding: '5px 4px', fontSize: 10, color: '#fff', fontWeight: 800 }}>Нед {w.weekIndex}</td>
                  <td style={{ padding: '5px 4px', fontSize: 10, color: '#fff', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w.dateStart.slice(5)}–{w.dateEnd.slice(5)}</td>
                  <td style={{ padding: '5px 4px', fontSize: 10, color: '#fff' }}>
                    {w.isDietBreak ? <span style={chip('#22c55e')}>🏖 диет-брейк</span>
                      : w.refeedDates.length > 0 ? <span style={chip('#a855f7')}>🔄 {w.refeedDates.map(d => d.slice(8)).join(', ')}</span>
                        : <span style={{ color: 'rgba(255,255,255,0.5)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div data-refeed-notes style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {cal.notes.map((n, i) => <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.45 }}>{n}</div>)}
        </div>
      </div>
    </GlassCard>
  );
};
