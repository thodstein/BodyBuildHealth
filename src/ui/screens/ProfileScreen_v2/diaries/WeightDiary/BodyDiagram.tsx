import React, { useMemo } from 'react';
import { FIELD_COLORS, FIELD_LABELS, PERCENT_FIELDS } from './WeightChart';

export interface Measurement {
  field: string;
  value: number | undefined;
  unit?: string;
  delta?: number;
}

interface BodyDiagramProps {
  measurements: Measurement[];
  sex?: 'male' | 'female';
}

const BODY_PATH = `
M 300 88
C 335 88 355 108 355 138
C 355 162 340 178 325 183
L 325 255
L 335 335
L 320 335
L 310 265
L 300 265
L 290 265
L 280 335
L 265 335
L 275 255
L 275 183
C 260 178 245 162 245 138
C 245 108 265 88 300 88
Z
`;

const BODY_PATH_FILL = '#27272a';
const BODY_PATH_STROKE = '#3f3f46';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const BAND_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e'];

const bandFor = (value: number | undefined, min: number, max: number): { width: number; color: string; pct: number } | null => {
  if (typeof value !== 'number') return null;
  const t = clamp01((value - min) / (max - min));
  const idx = Math.min(3, Math.floor(t * 4));
  return {
    width: 10 + t * 26,
    color: BAND_COLORS[idx],
    pct: Math.round(t * 100),
  };
};

const measurementCfg: Record<string, { min: number; max: number; cx: number; cy: number; angle: number; label?: string }> = {
  waistCm: { min: 60, max: 110, cx: 300, cy: 172, angle: -90, label: 'Талия' },
  chestCm: { min: 80, max: 130, cx: 300, cy: 125, angle: -90, label: 'Грудь' },
  hipCm: { min: 80, max: 130, cx: 300, cy: 202, angle: -90, label: 'Бёдра' },
  neckCm: { min: 30, max: 50, cx: 300, cy: 103, angle: -90, label: 'Шея' },
  bicepCm: { min: 30, max: 45, cx: 258, cy: 142, angle: -90, label: 'Бицепс' },
  bicepLeftCm: { min: 30, max: 45, cx: 252, cy: 142, angle: -90, label: 'Бицепс L' },
  bicepRightCm: { min: 30, max: 45, cx: 348, cy: 142, angle: 90, label: 'Бицепс R' },
  thighCm: { min: 50, max: 80, cx: 272, cy: 235, angle: -90, label: 'Бедро' },
  thighLeftCm: { min: 50, max: 80, cx: 266, cy: 235, angle: -90, label: 'Бедро L' },
  thighRightCm: { min: 50, max: 80, cx: 334, cy: 235, angle: 90, label: 'Бедро R' },
  calfCm: { min: 30, max: 50, cx: 272, cy: 290, angle: -90, label: 'Икра' },
  calfLeftCm: { min: 30, max: 50, cx: 266, cy: 290, angle: -90, label: 'Икра L' },
  calfRightCm: { min: 30, max: 50, cx: 334, cy: 290, angle: 90, label: 'Икра R' },
  forearmCm: { min: 25, max: 40, cx: 252, cy: 182, angle: -90, label: 'Предплечье' },
  muscleMass: { min: 40, max: 80, cx: 420, cy: 170, angle: 0, label: 'Мышцы' },
  bodyFat: { min: 8, max: 30, cx: 420, cy: 200, angle: 0, label: '% жира' },
};

export const BodyDiagram: React.FC<BodyDiagramProps> = ({ measurements, sex }) => {
  const latest = measurements.find(m => m.field === 'weight' || m.field === 'bodyFat' || m.field === 'muscleMass');
  const ratios = useMemo(() => {
    const map = new Map(measurements.map(m => [m.field, m.value]));
    const w = (v: number | undefined) => (Number.isFinite(v) ? v : null);
    const waist = w(map.get('waistCm'));
    const chest = w(map.get('chestCm'));
    const hip = w(map.get('hipCm'));
    const bicep = w(map.get('bicepCm'));
    const thigh = w(map.get('thighCm'));
    const out: { id: string; label: string; value: number; ideal: [number, number]; status: 'good' | 'warn' | 'bad' }[] = [];
    if (waist && hip) {
      const v = +(waist / hip).toFixed(2);
      const ideal: [number, number] = sex === 'female' ? [0.7, 0.8] : [0.85, 0.95];
      out.push({ id: 'waist-hip', label: 'Талия/Бёдра', value: v, ideal, status: v >= ideal[0] && v <= ideal[1] ? 'good' : v < ideal[0] ? 'warn' : 'bad' });
    }
    if (chest && waist) {
      const v = +(chest / waist).toFixed(2);
      out.push({ id: 'chest-waist', label: 'Грудь/Талия', value: v, ideal: [1.2, 1.6] as [number, number], status: v >= 1.2 && v <= 1.6 ? 'good' : v < 1.2 ? 'warn' : 'bad' });
    }
    if (bicep && waist) {
      const v = +(bicep / waist).toFixed(2);
      out.push({ id: 'bicep-waist', label: 'Бицепс/Талия', value: v, ideal: [0.35, 0.55] as [number, number], status: v >= 0.35 && v <= 0.55 ? 'good' : v < 0.35 ? 'warn' : 'bad' });
    }
    if (thigh && waist) {
      const v = +(thigh / waist).toFixed(2);
      out.push({ id: 'thigh-waist', label: 'Бедро/Талия', value: v, ideal: [0.55, 0.8] as [number, number], status: v >= 0.55 && v <= 0.8 ? 'good' : v < 0.55 ? 'warn' : 'bad' });
    }
    return out;
  }, [measurements, sex]);

  const asymmetryWarnings = useMemo(() => {
    const map = new Map(measurements.map(m => [m.field, m.value]));
    const left = (f: string) => map.get(f);
    const r = (l: number | undefined, r: number | undefined) => {
      if (l === undefined || r === undefined || !Number.isFinite(l) || !Number.isFinite(r)) return null;
      return { diff: Math.abs(l - r), side: l > r ? 'L' : 'R' };
    };
    const out: { field: string; diff: number; side: string }[] = [];
    const bicep = r(left('bicepLeftCm'), left('bicepRightCm'));
    const thigh = r(left('thighLeftCm'), left('thighRightCm'));
    const calf = r(left('calfLeftCm'), left('calfRightCm'));
    if (bicep && bicep.diff > 0.5) out.push({ field: 'Бицепс', diff: bicep.diff, side: bicep.side });
    if (thigh && thigh.diff > 0.5) out.push({ field: 'Бедро', diff: thigh.diff, side: thigh.side });
    if (calf && calf.diff > 0.5) out.push({ field: 'Икра', diff: calf.diff, side: calf.side });
    return out;
  }, [measurements]);

  const statusColor = (s: 'good' | 'warn' | 'bad') => (s === 'good' ? '#22c55e' : s === 'warn' ? '#f59e0b' : '#ef4444');

  return (
    <div style={{ padding: 12, background: '#18181b', borderRadius: 10 }}>
      <b style={{ display: 'block', marginBottom: 8 }}>🧍 Схема тела</b>
      <svg viewBox="0 0 600 360" width="100%" role="img" aria-label="Схема тела с замерами">
        <path d={BODY_PATH} fill={BODY_PATH_FILL} stroke={BODY_PATH_STROKE} strokeWidth="2" />

        {measurements
          .map(m => ({ ...m, cfg: measurementCfg[m.field] }))
          .filter(m => m.cfg && Number.isFinite(m.value))
          .map(m => {
            const cfg = m.cfg!;
            const band = bandFor(m.value as number, cfg.min, cfg.max);
            if (!band) return null;
            const x1 = cfg.cx - band.width / 2;
            const x2 = cfg.cx + band.width / 2;
            const isHorizontal = cfg.angle === 0;
            return (
              <g key={m.field}>
                {isHorizontal ? (
                  <>
                    <rect x={cfg.cx - 40} y={cfg.cy - 6} width={80} height={12} rx={6} fill="#3f3f46" opacity={0.4} />
                    <rect x={cfg.cx - 40} y={cfg.cy - 6} width={band.width} height={12} rx={6} fill={band.color} opacity={0.9} />
                    <text x={cfg.cx - 42} y={cfg.cy + 3} textAnchor="end" fill="#ccc" fontSize="9">
                      {cfg.label}
                    </text>
                  </>
                ) : (
                  <>
                    <rect x={x1} y={cfg.cy - 6} width={band.width} height={12} rx={6} fill={band.color} opacity={0.9} />
                    <text x={cfg.cx} y={cfg.cy + 3} textAnchor="middle" fill="#000" fontSize="10" fontWeight={700}>
                      {Number(m.value).toFixed(1)}
                    </text>
                    <text x={cfg.cx} y={cfg.cy - 10} textAnchor="middle" fill="#ccc" fontSize="9">
                      {cfg.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}

        {asymmetryWarnings.length > 0 && (
          <g>
            {asymmetryWarnings.map((aw, i) => (
              <text key={i} x="300" y={340 + i * 14} textAnchor="middle" fill="#fbbf24" fontSize="10">
                ⚠ {aw.field}: Δ {aw.diff.toFixed(1)} см ({aw.side} dominant)
              </text>
            ))}
          </g>
        )}
      </svg>

      {ratios.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {ratios.map(r => (
            <div
              key={r.id}
              style={{
                padding: '6px 10px',
                borderRadius: 7,
                background: statusColor(r.status) + '22',
                border: `1px solid ${statusColor(r.status)}44`,
                fontSize: 12,
              }}
            >
              <span style={{ color: '#ccc' }}>{r.label}: </span>
              <b style={{ color: statusColor(r.status) }}>{r.value}</b>
              <small style={{ color: '#888' }}> (идеал {r.ideal[0]}-{r.ideal[1]})</small>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 10, color: '#888' }}>
        <span>🔴 &lt;35%</span>
        <span>🟠 35-65%</span>
        <span>🟡 65-85%</span>
        <span>🟢 &gt;85%</span>
        <span style={{ marginLeft: 'auto' }}>Ширина = относительный размер</span>
      </div>
    </div>
  );
};
