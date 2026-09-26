/**
 * cb-camp-charts.tsx — E6 «графики лагеря».
 *
 * Данные приходят из combat-graphs (чистая функция), здесь только SVG.
 * Все ряды нормированы движком, поэтому подписи — это факт плана, а не
 * пересчёт на глаз.
 */
import React from 'react';
import { SectionCard, Highlight } from './CombatUI';
import { buildCampSeries, polylinePoints } from '../../../engines/combat/combat-graphs';
import type { CombatPlan } from '../../../engines/combat/combat.types';

const W = 320, H = 96, PAD = 6;

const Series: React.FC<{
  label: string;
  values: number[];
  max: number;
  unit: string;
  color: string;
  points: { deload: boolean; taper: boolean }[];
  fmt?: (v: number) => string;
}> = ({ label, values, max, unit, color, points, fmt }) => {
  const pts = polylinePoints(values, max, W, H, PAD);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${path} L${pts[pts.length - 1].x.toFixed(1)} ${H - PAD} L${pts[0].x.toFixed(1)} ${H - PAD} Z` : '';
  const f = fmt || ((v: number) => (max >= 1000 ? `${Math.round(v / 1000)}к` : String(Math.round(v))));
  return (
    <div data-cb="chart" data-chart={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 10.5, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
        <Highlight color={color}>{label}</Highlight>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>пик {f(max)} {unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={`${label}: максимум ${f(max)} ${unit}, ${values.length} недель`}>
        <defs>
          <linearGradient id={`g-${label.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {points.map((p, i) => {
          const x = PAD + (values.length > 1 ? (i * (W - PAD * 2)) / (values.length - 1) : 0);
          return p.deload ? <rect key={`d${i}`} x={x - 2} y={PAD} width={4} height={H - PAD * 2} fill="#f59e0b" opacity="0.22" />
            : p.taper ? <rect key={`t${i}`} x={x - 2} y={PAD} width={4} height={H - PAD * 2} fill="#60a5fa" opacity="0.2" /> : null;
        })}
        {area && <path d={area} fill={`url(#g-${label.replace(/\W/g, '')})`} />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />)}
      </svg>
    </div>
  );
};

export const CbCampCharts: React.FC<{ plan: CombatPlan }> = ({ plan }) => {
  const s = buildCampSeries(plan);
  if (!s.points.length) return null;
  return (
    <SectionCard icon="📈" title="Динамика лагеря" subtitle={`пик нед. ${s.peakWeek} · среднее ${Math.round(s.avgSets)} сетов · деload ${s.deloadWeeks} · тапер ${s.taperWeeks}`} accent>
      <div className="cb-camp-charts" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Series label="Сеты/нед" values={s.points.map(p => p.sets)} max={s.maxSets} unit="сетов" color="#a855f7" points={s.points} />
        <Series label="Тоннаж/нед" values={s.points.map(p => p.tonnage)} max={s.maxTonnage} unit="кг" color="#34c759" points={s.points} />
        <Series label="Интенсивность" values={s.points.map(p => p.intensity)} max={Math.max(0.01, ...s.points.map(p => p.intensity))} unit="" color="#60a5fa" points={s.points} fmt={(v) => `${Math.round(v * 100)}%`} />
        <div style={{ fontSize: 10, color: '#fff', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span><Highlight color="#f59e0b">▮</Highlight> деload</span>
          <span><Highlight color="#60a5fa">▮</Highlight> тапер</span>
          <span>размах объёма <Highlight>{s.volumeRange}</Highlight> сетов</span>
        </div>
      </div>
    </SectionCard>
  );
};
