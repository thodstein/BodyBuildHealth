/**
 * TrainingMetricsChart.tsx — D2/G3: 4 раздельных графика метрик плана.
 * Canvas-рендер (без зависимостей, mobile-first, dark theme).
 * СРЦ: Тоннаж / КПШ / Инт.отн+УОИ / Инт.Ф+Б по неделям. BB: объём на мышцу (стек тяж/памп vs MRV).
 */
import React, { useEffect, useRef } from 'react';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, margin: '6px 0' };
const H: React.CSSProperties = { color: '#fff', fontSize: 13, fontWeight: 600, margin: '0 0 4px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.4 };
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
  ctx.strokeStyle = '#3a3a3c'; ctx.lineWidth = 1;
  for (let i = 0; i <= rows; i++) { const y = pad.top + ((h - pad.top - pad.bottom) / rows) * i; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); }
}
function xlabels(ctx: CanvasRenderingContext2D, data: { week: number }[], pad: any, w: number, h: number, xStep: number) {
  ctx.fillStyle = '#8e8e93'; ctx.font = '9px sans-serif';
  data.forEach((d, i) => { if (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) ctx.fillText(String(d.week), pad.left + i * xStep + xStep / 2 - 3, h - 4); });
}

type Point = { week: number; v: number };
function BarChart({ data, title, color, unit }: { data: Point[]; title: string; color: string; unit: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const env = setup(cv, 130); if (!env) return;
    const { ctx, w, h } = env; const pad = { top: 16, right: 10, bottom: 16, left: 38 };
    const drawW = w - pad.left - pad.right, drawH = h - pad.top - pad.bottom;
    ctx.fillStyle = '#2c2c2e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif'; ctx.fillText(title, pad.left, 11);
    if (!data.length) { ctx.fillStyle = '#666'; ctx.fillText('—', w / 2, h / 2); return; }
    const max = Math.max(...data.map(d => d.v)) * 1.15 || 1; const xStep = drawW / data.length;
    grid(ctx, pad, w, h);
    ctx.fillStyle = color;
    data.forEach((d, i) => { const bw = xStep * 0.6, bx = pad.left + i * xStep + xStep * 0.2; const yh = (d.v / max) * drawH; ctx.fillRect(bx, pad.top + drawH - yh, bw, yh); });
    ctx.fillStyle = '#8e8e93'; ctx.font = '8px sans-serif'; ctx.fillText(unit, 4, pad.top + 8);
    xlabels(ctx, data, pad, w, h, xStep);
  }, [data, title, color, unit]);
  return <canvas ref={ref} style={{ width: '100%', height: 130, display: 'block' }} />;
}
function LineChart({ data, title, series }: { data: { week: number }[]; title: string; series: { pts: number[]; color: string; label: string }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const env = setup(cv, 140); if (!env) return;
    const { ctx, w, h } = env; const pad = { top: 18, right: 10, bottom: 16, left: 34 };
    const drawW = w - pad.left - pad.right, drawH = h - pad.top - pad.bottom;
    ctx.fillStyle = '#2c2c2e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif'; ctx.fillText(title, pad.left, 13);
    if (!data.length) { ctx.fillStyle = '#666'; ctx.fillText('—', w / 2, h / 2); return; }
    const xStep = drawW / data.length; grid(ctx, pad, w, h);
    series.forEach(sr => {
      const max = Math.max(...sr.pts, 0.01) * 1.2 || 1;
      ctx.strokeStyle = sr.color; ctx.lineWidth = 2; ctx.beginPath();
      sr.pts.forEach((v, i) => { const x = pad.left + i * xStep + xStep / 2; const y = pad.top + drawH - (Math.min(v, max) / max) * drawH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke(); ctx.fillStyle = sr.color;
      sr.pts.forEach((v, i) => { const x = pad.left + i * xStep + xStep / 2; const y = pad.top + drawH - (Math.min(v, max) / max) * drawH; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); });
    });
    xlabels(ctx, data, pad, w, h, xStep);
    series.forEach((sr, i) => { ctx.fillStyle = sr.color; ctx.fillRect(pad.left + i * 60, 4, 7, 7); ctx.fillStyle = '#8e8e93'; ctx.font = '8px sans-serif'; ctx.fillText(sr.label, pad.left + i * 60 + 10, 10); });
  }, [data, title, series]);
  return <canvas ref={ref} style={{ width: '100%', height: 140, display: 'block' }} />;
}
function BBChart({ data }: { data: BBMuscleMetric[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const env = setup(cv, 170); if (!env) return;
    const { ctx, w, h } = env; const pad = { top: 16, right: 12, bottom: 28, left: 32 };
    const drawW = w - pad.left - pad.right, drawH = h - pad.top - pad.bottom;
    ctx.fillStyle = '#2c2c2e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif'; ctx.fillText('Сетов/ротация: стек тяж(зел)+памп(голуб) vs MRV (пунктир)', pad.left, 12);
    if (!data.length) { ctx.fillStyle = '#666'; ctx.fillText('—', w / 2, h / 2); return; }
    const maxV = Math.max(...data.map(d => Math.max(d.sets, d.mrv))) * 1.1 || 1; const xStep = drawW / data.length;
    const yV = (v: number) => pad.top + drawH - (v / maxV) * drawH;
    grid(ctx, pad, w, h);
    ctx.strokeStyle = '#ef4444'; ctx.setLineDash([5, 4]); ctx.beginPath();
    data.forEach((d, i) => { const x = pad.left + i * xStep + xStep / 2; const y = yV(d.mrv); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
    data.forEach((d, i) => {
      const bw = xStep * 0.55, bx = pad.left + i * xStep + xStep * 0.225; const over = d.sets > d.mrv;
      const yT = yV(d.тяж); ctx.fillStyle = over ? 'rgba(239,68,68,0.7)' : 'rgba(0,230,138,0.65)'; ctx.fillRect(bx, yT, bw, pad.top + drawH - yT);
      const yP = yV(d.тяж + d.памп); ctx.fillStyle = over ? 'rgba(239,68,68,0.45)' : 'rgba(96,165,250,0.6)'; ctx.fillRect(bx, yP, bw, yT - yP);
      ctx.fillStyle = '#8e8e93'; ctx.font = '8px sans-serif'; ctx.fillText(d.muscle.length > 6 ? d.muscle.slice(0, 5) + '…' : d.muscle, bx + bw / 2 - 8, h - 10);
      ctx.fillStyle = '#ccc'; ctx.font = '8px sans-serif'; ctx.fillText(String(d.sets), bx + bw / 2 - 3, yP - 2);
    });
    ctx.fillStyle = '#ef4444'; ctx.font = '8px sans-serif'; ctx.fillText('MRV', w - pad.right - 22, pad.top + 5);
  }, [data]);
  return <canvas ref={ref} style={{ width: '100%', height: 170, display: 'block' }} />;
}

export const TrainingMetricsChart: React.FC<{ lms?: LMSWeekMetric[]; bb?: BBMuscleMetric[] }> = ({ lms, bb }) => (
  <div>
    {lms && lms.length > 0 && (
      <>
        <div style={CARD}><div style={H}>📈 Тоннаж по неделям</div><BarChart data={lms.map(d => ({ week: d.week, v: d.tonnage }))} title="кг·пов" color="rgba(0,230,138,0.7)" unit="кг·пов" /></div>
        <div style={CARD}><div style={H}>📈 КПШ по неделям</div><BarChart data={lms.map(d => ({ week: d.week, v: d.kpsh }))} title="подъёмов" color="rgba(245,158,11,0.7)" unit="КПШ" /></div>
        <div style={CARD}><div style={H}>📈 Инт.отн + УОИ</div><LineChart data={lms} title="нормировано" series={[{ pts: lms.map(d => d.relInt), color: '#a855f7', label: 'Инт.отн' }, { pts: lms.map(d => d.uoi), color: '#60a5fa', label: 'УОИ' }]} /></div>
        <div style={CARD}><div style={H}>📈 Инт.Ф+Б (Фунтиков+Бондаренко)</div><BarChart data={lms.map(d => ({ week: d.week, v: d.intFB }))} title="усл.ед" color="rgba(96,165,250,0.7)" unit="Ф+Б" /></div>
      </>
    )}
    {bb && bb.length > 0 && (
      <div style={CARD}><div style={H}>📈 BB: объём на мышцу (тяж/памп)</div><BBChart data={bb} /><div style={{ ...SMALL, marginTop: 4 }}>Стек <span style={{ color: ACCENT }}>тяж</span> + <span style={{ color: '#60a5fa' }}>памп</span>; красный — превышение MRV.</div></div>
    )}
    {(!lms || lms.length === 0) && (!bb || bb.length === 0) && <div style={SMALL}>Сгенерируйте план — появятся графики.</div>}
  </div>
);
export default TrainingMetricsChart;
