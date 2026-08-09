import React, { useMemo } from 'react';
import type { WeightEntry } from '../../../../../engines/profile-store';
import { FIELD_COLORS, FIELD_LABELS, type Series } from './WeightChart';
import { BodyDiagram, type Measurement } from './BodyDiagram';
import { MeasurementRatios, type Ratio } from './MeasurementRatios';
import { RecompScatter } from './RecompScatter';
import { FfmiBmiTrend } from './FfmiBmiTrend';
import { PhaseInsights } from './PhaseInsights';
import { WeeklyHistogramImproved } from './WeeklyHistogramImproved';
import { CompletenessIndicator } from './CompletenessIndicator';
import { projectWeight } from '../../../../../engines/body-composition.engine';

interface WeightDiaryVisualsProps {
  rows: WeightEntry[];
  goal: number;
  heightCm?: number;
  sex?: 'male' | 'female';
}

const toScatter = (rows: WeightEntry[]) => {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const len = sorted.length;
  return sorted
    .filter(r => Number.isFinite(r.weight) && Number.isFinite(r.bodyFat))
    .map((r, i) => ({
      x: Number(r.weight),
      y: Number(r.bodyFat),
      size: r.muscleMass ? 4 + (Number(r.muscleMass) - 40) * 0.3 : 5,
      date: r.date,
      weight: Number(r.weight),
      bf: Number(r.bodyFat),
      muscle: r.muscleMass,
      color: `hsl(${140 + (i / Math.max(len - 1, 1)) * 80}, 70%, 55%)`,
    }));
};

export const WeightDiaryVisuals: React.FC<WeightDiaryVisualsProps> = ({ rows, goal, heightCm, sex }) => {
  const scatter = useMemo(() => toScatter(rows), [rows]);

  const measurements = useMemo<Measurement[]>(() => {
    const latest = rows[0];
    if (!latest) return [];
    const items: Measurement[] = [
      { field: 'waistCm', value: latest.waistCm, unit: 'см' },
      { field: 'chestCm', value: latest.chestCm, unit: 'см' },
      { field: 'hipCm', value: latest.hipCm, unit: 'см' },
      { field: 'bicepCm', value: latest.bicepCm, unit: 'см' },
      { field: 'bicepLeftCm', value: latest.bicepLeftCm, unit: 'см' },
      { field: 'bicepRightCm', value: latest.bicepRightCm, unit: 'см' },
      { field: 'thighCm', value: latest.thighCm, unit: 'см' },
      { field: 'thighLeftCm', value: latest.thighLeftCm, unit: 'см' },
      { field: 'thighRightCm', value: latest.thighRightCm, unit: 'см' },
      { field: 'calfCm', value: latest.calfCm, unit: 'см' },
      { field: 'calfLeftCm', value: latest.calfLeftCm, unit: 'см' },
      { field: 'calfRightCm', value: latest.calfRightCm, unit: 'см' },
      { field: 'neckCm', value: latest.neckCm, unit: 'см' },
      { field: 'forearmCm', value: latest.forearmCm, unit: 'см' },
    ];
    return items.filter(m => Number.isFinite(m.value as number));
  }, [rows]);

  const ratios = useMemo<Ratio[]>(() => {
    const latest = rows[0];
    const previous = rows[1];
    if (!latest) return [];
    const w = (v: number | undefined) => (Number.isFinite(v) ? v : null);
    const waist = w(latest.waistCm);
    const chest = w(latest.chestCm);
    const hip = w(latest.hipCm);
    const bicep = w(latest.bicepCm);
    const thigh = w(latest.thighCm);
    const prev = (v: string | undefined) => (previous ? w(previous[v as keyof WeightEntry] as number | undefined) : null);
    const trend = (curr: number | null, prevVal: number | null): 'up' | 'down' | 'stable' => {
      if (curr === null || prevVal === null) return 'stable';
      const d = curr - prevVal;
      if (Math.abs(d) < 0.02) return 'stable';
      return d > 0 ? 'up' : 'down';
    };
    const out: Ratio[] = [];
    if (waist && hip) {
      const v = +(waist / hip).toFixed(2);
      const prevV = prev('hipCm') && prev('waistCm') ? +(prev('waistCm')! / prev('hipCm')!).toFixed(2) : null;
      const ideal: [number, number] = sex === 'female' ? [0.7, 0.8] : [0.85, 0.95];
      out.push({ id: 'waist-hip', label: 'Талия/Бёдра', value: v, ideal, trend: trend(v, prevV), delta: prevV !== null ? +(v - prevV).toFixed(2) : undefined });
    }
    if (chest && waist) {
      const v = +(chest / waist).toFixed(2);
      const prevV = prev('waistCm') && prev('chestCm') ? +(prev('chestCm')! / prev('waistCm')!).toFixed(2) : null;
      out.push({ id: 'chest-waist', label: 'Грудь/Талия', value: v, ideal: [1.2, 1.6] as [number, number], trend: trend(v, prevV), delta: prevV !== null ? +(v - prevV).toFixed(2) : undefined });
    }
    if (bicep && waist) {
      const v = +(bicep / waist).toFixed(2);
      const prevV = prev('waistCm') && prev('bicepCm') ? +(prev('bicepCm')! / prev('waistCm')!).toFixed(2) : null;
      out.push({ id: 'bicep-waist', label: 'Бицепс/Талия', value: v, ideal: [0.35, 0.55] as [number, number], trend: trend(v, prevV), delta: prevV !== null ? +(v - prevV).toFixed(2) : undefined });
    }
    if (thigh && waist) {
      const v = +(thigh / waist).toFixed(2);
      const prevV = prev('waistCm') && prev('thighCm') ? +(prev('thighCm')! / prev('waistCm')!).toFixed(2) : null;
      out.push({ id: 'thigh-waist', label: 'Бедро/Талия', value: v, ideal: [0.55, 0.8] as [number, number], trend: trend(v, prevV), delta: prevV !== null ? +(v - prevV).toFixed(2) : undefined });
    }
    return out;
  }, [rows, sex]);

  const latest = rows[0];

  if (!rows.length) return null;

  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div style={{ padding: 12, background: '#18181b', borderRadius: 10 }}>
          <b style={{ display: 'block', marginBottom: 8 }}>🧬 Рекомпозиция</b>
          <RecompScatter points={scatter} />
        </div>
        <BodyDiagram measurements={measurements} />
      </section>

      <MeasurementRatios ratios={ratios} />
      <PhaseInsights rows={rows} />
      <FfmiBmiTrend rows={rows} heightCm={heightCm} sex={sex} />
      <WeeklyHistogramImproved rows={rows} />
      {latest && <CompletenessIndicator entry={latest} />}
    </>
  );
};
