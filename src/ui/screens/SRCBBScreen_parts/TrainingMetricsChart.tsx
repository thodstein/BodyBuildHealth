/**
 * TrainingMetricsChart.tsx — D2/G3: наглядные графики метрик плана.
 * Canvas-рендер (без зависимостей, mobile-first, dark theme).
 * Переработано: градиенты, скругления, свечения, значения над барами, подсветка пика.
 * Метрики по неделям: Тоннаж / КПШ / Инт.отн+УОИ / Инт.Ф+Б. ББ: объём на мышцу (тяж/памп vs MRV).
 */
import React, { useEffect, useRef } from 'react';

const CARD: React.CSSProperties = { background: 'linear-gradient(180deg, rgba(24,24,27,0.95), rgba(14,14,16,0.9))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, margin: '8px 0', boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' };
const H: React.CSSProperties = { color: '#fff', fontSize: 12, fontWeight: 800, margin: '0 0 2px', letterSpacing: '-0.2px' };
const SUB: React.CSSProperties = { color: '#fff', fontSize: 9, lineHeight: 1.3, opacity: 1 };
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 10, lineHeight: 1.4 };
const ACCENT = '#00e68a';

export interface LMSWeekMetric { week: number; tonnage: number; kpsh: number; relInt: number; uoi: number; intFB: number }
export interface BBMuscleMetric { muscle: string; sets: number; тяж: number; памп: number; mrv: number }

function setup(canvas: HTMLCanvasElement, h: number) {
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = h * dpr; ctx.scale(dpr, dpr); ctx.clearRect(0, 0, rect.width, h);
  return { ctx, w: rect.width, h };
}
function grid(ctx: CanvasRenderingContext2D, pad: any, w: number, h: number, rows = 4) {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  for (let i = 0; i <= rows; i++) { const y = pad.top + ((h - pad.top - pad.bottom) / rows) * i; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); }
  ctx.setLineDash([]);
}
function xlabels(ctx: CanvasRenderingContext2D, data: { week: number }[], pad: any, w: number, h: number, xStep: number) {
  ctx.fillStyle = '#fff'; ctx.font = '700 9px sans-serif';
  data.forEach((d, i) => { if (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) { ctx.fillText(String(d.week), pad.left + i * xStep + xStep / 2 - 3, h - 4); } });
  // ось X подпись
  ctx.fillStyle = '#fff'; ctx.font = '700 7px sans-serif'; ctx.fillText('неделя →', w - pad.right - 32, h - 4);
}

type Point = { week: number; v: number };
function BarChart({ data, title, color, color2, unit, icon }: { data: Point[]; title: string; color: string; color2: string; unit: string; icon: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const env = setup(cv, 150); if (!env) return;
    const { ctx, w, h } = env; const pad = { top: 22, right: 12, bottom: 18, left: 44 };
    const drawW = w - pad.left - pad.right, drawH = h - pad.top - pad.bottom;
    // фон карточки
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a1a1e'); bg.addColorStop(1, '#121214');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // заголовок
    ctx.fillStyle = '#fff'; ctx.font = '800 11px sans-serif'; ctx.fillText(icon + ' ' + title, pad.left, 14);
    ctx.fillStyle = '#fff'; ctx.font = '700 7px sans-serif'; ctx.fillText(unit, pad.left, 22);
    if (!data.length) { ctx.fillStyle = '#666'; ctx.font = '12px sans-serif'; ctx.fillText('— нет данных —', w / 2 - 30, h / 2); return; }
    const max = Math.max(...data.map(d => d.v)) * 1.2 || 1; const xStep = drawW / data.length;
    grid(ctx, pad, w, h);
    // подсветка пика
    const peakIdx = data.reduce((bi, d, i) => d.v > data[bi].v ? i : bi, 0);
    data.forEach((d, i) => {
      const bw = xStep * 0.58, bx = pad.left + i * xStep + xStep * 0.21;
      const yh = (d.v / max) * drawH;
      const y = pad.top + drawH - yh;
      const isPeak = i === peakIdx;
      // градиент бара
      const g = ctx.createLinearGradient(bx, y, bx, y + yh);
      g.addColorStop(0, color); g.addColorStop(1, color2);
      ctx.fillStyle = g;
      // скруглённый верх
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(bx, y + yh);
      ctx.lineTo(bx, y + r);
      ctx.quadraticCurveTo(bx, y, bx + r, y);
      ctx.lineTo(bx + bw - r, y);
      ctx.quadraticCurveTo(bx + bw, y, bx + bw, y + r);
      ctx.lineTo(bx + bw, y + yh);
      ctx.closePath();
      ctx.fill();
      // свечение пика
      if (isPeak) {
        ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
      }
      // значение над баром
      if (yh > 14) {
        ctx.fillStyle = '#fff'; ctx.font = '700 7px sans-serif';
        const txt = d.v >= 1000 ? (d.v / 1000).toFixed(1) + 'k' : String(Math.round(d.v));
        const tw = ctx.measureText(txt).width;
        ctx.fillText(txt, bx + bw / 2 - tw / 2, y - 4);
      }
    });
    // ось Y метки
    ctx.fillStyle = '#fff'; ctx.font = '700 7px sans-serif';
    for (let i = 0; i <= 4; i++) {
      const v = (max * (1 - i / 4));
      const y = pad.top + (drawH / 4) * i;
      const txt = v >= 1000 ? (v / 1000).toFixed(0) + 'k' : Math.round(v).toString();
      ctx.fillText(txt, 4, y + 3);
    }
    xlabels(ctx, data, pad, w, h, xStep);
  }, [data, title, color, color2, unit, icon]);
  return <canvas ref={ref} style={{ width: '100%', height: 150, display: 'block', borderRadius: 10 }} />;
}
function LineChart({ data, title, series }: { data: { week: number }[]; title: string; series: { pts: number[]; color: string; color2: string; label: string }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const env = setup(cv, 160); if (!env) return;
    const { ctx, w, h } = env; const pad = { top: 24, right: 14, bottom: 18, left: 38 };
    const drawW = w - pad.left - pad.right, drawH = h - pad.top - pad.bottom;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a1a1e'); bg.addColorStop(1, '#121214');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = '800 11px sans-serif'; ctx.fillText(title, pad.left, 14);
    if (!data.length) { ctx.fillStyle = '#666'; ctx.fillText('—', w / 2, h / 2); return; }
    const xStep = drawW / data.length; grid(ctx, pad, w, h);
    series.forEach(sr => {
      const max = Math.max(...sr.pts, 0.01) * 1.25 || 1;
      // заливка под линией
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + drawH);
      grad.addColorStop(0, sr.color + '35'); grad.addColorStop(1, sr.color + '02');
      ctx.fillStyle = grad;
      ctx.beginPath();
      sr.pts.forEach((v, i) => {
        const x = pad.left + i * xStep + xStep / 2;
        const y = pad.top + drawH - (Math.min(v, max) / max) * drawH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      const lastX = pad.left + (sr.pts.length - 1) * xStep + xStep / 2;
      ctx.lineTo(lastX, pad.top + drawH); ctx.lineTo(pad.left + xStep / 2, pad.top + drawH); ctx.closePath(); ctx.fill();
      // линия
      ctx.strokeStyle = sr.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = sr.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      sr.pts.forEach((v, i) => { const x = pad.left + i * xStep + xStep / 2; const y = pad.top + drawH - (Math.min(v, max) / max) * drawH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke(); ctx.shadowBlur = 0;
      // точки
      sr.pts.forEach((v, i) => {
        const x = pad.left + i * xStep + xStep / 2; const y = pad.top + drawH - (Math.min(v, max) / max) * drawH;
        ctx.fillStyle = '#121214'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sr.color; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.strokeStyle = sr.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke();
        // подпись значения
        ctx.fillStyle = '#fff'; ctx.font = '600 6px sans-serif';
        const txt = v < 1 ? v.toFixed(2) : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toString();
        ctx.fillText(txt, x - 6, y - 7);
      });
    });
    xlabels(ctx, data, pad, w, h, xStep);
    // легенда
    series.forEach((sr, i) => {
      const x = pad.left + i * 78;
      // градиентный квадратик
      const g = ctx.createLinearGradient(x, 4, x + 10, 14);
      g.addColorStop(0, sr.color); g.addColorStop(1, sr.color2);
      ctx.fillStyle = g; ctx.fillRect(x, 18, 10, 10);
      ctx.fillStyle = '#fff'; ctx.font = '700 8px sans-serif'; ctx.fillText(sr.label, x + 13, 26);
    });
  }, [data, title, series]);
  return <canvas ref={ref} style={{ width: '100%', height: 160, display: 'block', borderRadius: 10 }} />;
}
function BBChart({ data }: { data: BBMuscleMetric[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const env = setup(cv, 190); if (!env) return;
    const { ctx, w, h } = env; const pad = { top: 22, right: 14, bottom: 32, left: 36 };
    const drawW = w - pad.left - pad.right, drawH = h - pad.top - pad.bottom;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a1a1e'); bg.addColorStop(1, '#121214');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = '800 11px sans-serif'; ctx.fillText('💪 Сетов/ротация: тяж + памп vs MRV', pad.left, 14);
    ctx.fillStyle = '#fff'; ctx.font = '700 7px sans-serif'; ctx.fillText('тяж — насыщенный, памп — светлый; MRV — красный пунктир', pad.left, 22);
    if (!data.length) { ctx.fillStyle = '#666'; ctx.fillText('—', w / 2, h / 2); return; }
    const maxV = Math.max(...data.map(d => Math.max(d.sets, d.mrv))) * 1.15 || 1; const xStep = drawW / data.length;
    const yV = (v: number) => pad.top + drawH - (v / maxV) * drawH;
    grid(ctx, pad, w, h);
    // MRV линия со свечением
    ctx.strokeStyle = '#ef4444'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
    ctx.beginPath();
    data.forEach((d, i) => { const x = pad.left + i * xStep + xStep / 2; const y = yV(d.mrv); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    // столбики
    data.forEach((d, i) => {
      const bw = xStep * 0.58, bx = pad.left + i * xStep + xStep * 0.21; const over = d.sets > d.mrv;
      // тень бара
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx + 1, yV(0) - 1, bw, 2);
      // тяж
      const yT = yV(d.тяж);
      const g1 = ctx.createLinearGradient(bx, yT, bx, pad.top + drawH);
      g1.addColorStop(0, over ? '#ef4444' : '#00e68a'); g1.addColorStop(1, over ? '#991b1b' : '#00a86b');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(bx, pad.top + drawH);
      ctx.lineTo(bx, yT + 3);
      ctx.quadraticCurveTo(bx, yT, bx + 3, yT);
      ctx.lineTo(bx + bw - 3, yT);
      ctx.quadraticCurveTo(bx + bw, yT, bx + bw, yT + 3);
      ctx.lineTo(bx + bw, pad.top + drawH);
      ctx.closePath(); ctx.fill();
      if (over) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
      // памп поверх
      const yP = yV(d.тяж + d.памп);
      const g2 = ctx.createLinearGradient(bx, yP, bx, yT);
      g2.addColorStop(0, over ? 'rgba(239,68,68,0.85)' : '#60a5fa'); g2.addColorStop(1, over ? 'rgba(239,68,68,0.5)' : '#3b82f6');
      ctx.fillStyle = g2;
      ctx.fillRect(bx, yP, bw, yT - yP);
      // подпись мышцы
      ctx.fillStyle = '#fff'; ctx.font = '700 7px sans-serif';
      const label = d.muscle.length > 7 ? d.muscle.slice(0, 6) + '…' : d.muscle;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, bx + bw / 2 - tw / 2, h - 10);
      // значение сетов над баром
      ctx.fillStyle = over ? '#ef4444' : '#fff'; ctx.font = '800 8px sans-serif';
      const txt = String(d.sets);
      const tw2 = ctx.measureText(txt).width;
      ctx.fillText(txt, bx + bw / 2 - tw2 / 2, yP - 6);
      // MRV точка
      const yM = yV(d.mrv);
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(pad.left + i * xStep + xStep / 2, yM, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    });
    // легенда MRV
    ctx.fillStyle = '#ef4444'; ctx.font = '700 8px sans-serif'; ctx.fillText('● MRV', w - pad.right - 30, pad.top + 6);
    // Y ось
    ctx.fillStyle = '#fff'; ctx.font = '700 7px sans-serif';
    for (let i = 0; i <= 4; i++) {
      const v = (maxV * (1 - i / 4));
      const y = pad.top + (drawH / 4) * i;
      ctx.fillText(Math.round(v).toString(), 4, y + 3);
    }
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 190, display: 'block', borderRadius: 10 }} />;
}

export const TrainingMetricsChart: React.FC<{ lms?: LMSWeekMetric[]; bb?: BBMuscleMetric[] }> = ({ lms, bb }) => (
  <div className="pl-metrics">
    {lms && lms.length > 0 && (
      <>
        <div style={CARD}><div style={H}>📈 Тоннаж по неделям</div><div style={SUB}>кг·пов — суммарная нагрузка (вес × повторы × подходы)</div><BarChart data={lms.map(d => ({ week: d.week, v: d.tonnage }))} title="Тоннаж" color="#00e68a" color2="#00a86b" unit="кг·пов" icon="🏋️" /></div>
        <div style={CARD}><div style={H}>📈 КПШ по неделям</div><div style={SUB}>подъёмов — объём (Прилепин: 70% 12-24, 80% 10-20)</div><BarChart data={lms.map(d => ({ week: d.week, v: d.kpsh }))} title="КПШ" color="#f59e0b" color2="#d97706" unit="КПШ" icon="🔢" /></div>
        <div style={CARD}><div style={H}>📈 Интенсивность (Инт.отн + УОИ)</div><div style={SUB}>Инт.отн = Ср.вес / PM · УОИ = ΣКПШ×Коэф / ΣКПШ (Бондаренко)</div><LineChart data={lms} title="Интенсивность" series={[{ pts: lms.map(d => d.relInt), color: '#a855f7', color2: '#7c3aed', label: 'Инт.отн' }, { pts: lms.map(d => d.uoi), color: '#60a5fa', color2: '#2563eb', label: 'УОИ' }]} /></div>
        <div style={CARD}><div style={H}>📈 Интенсивность Фунтикова + Бондаренко</div><div style={SUB}>k(%1RM) × вес × пов × под × Коэф — стресс-метрика</div><BarChart data={lms.map(d => ({ week: d.week, v: d.intFB }))} title="Инт.Ф+Б" color="#a855f7" color2="#6d28d9" unit="усл.ед" icon="⚡" /></div>
      </>
    )}
    {bb && bb.length > 0 && (
      <div style={CARD}><div style={H}>📈 ББ: объём на мышцу</div><div style={SUB}>тяж (насыщенный) + памп (светлый) vs MRV (красный пунктир)</div><BBChart data={bb} /><div style={{ ...SMALL, marginTop: 8, color: '#fff' }}>Стек <span style={{ color: ACCENT }}>тяж</span> + <span style={{ color: '#60a5fa' }}>памп</span>; красный — превышение MRV. Пик подсвечен свечением.</div></div>
    )}
    {(!lms || lms.length === 0) && (!bb || bb.length === 0) && <div style={{ ...SMALL, color: '#fff', padding: 12, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>Сгенерируйте план — появятся наглядные графики с градиентами и подсветкой пика.</div>}
  </div>
);
export default TrainingMetricsChart;
