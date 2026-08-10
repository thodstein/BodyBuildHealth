import React, { useMemo } from 'react';
import { colors } from '../../ui';

interface PhaseInsightsProps {
  rows: { date: string; weight: number; bodyFat?: number; muscleMass?: number }[];
}

interface PhaseBlock {
  label: string;
  start: string;
  end: string;
  color: string;
  entries: { date: string; weight: number; bodyFat?: number; muscleMass?: number }[];
  substances?: string[];
  weeks: WeekStats[];
}

interface WeekStats {
  weekStart: string;
  meanWeight: number;
  deltaWeight: number;
  deltaBF?: number;
  deltaMuscle?: number;
  activeSubstances?: string[];
}

const TRAINING_KEY = 'he_training_profile';
const PHARMA_KEY = 'he_pharma_active';
const UNIFIED_KEY = 'he_profile_v2';

const PED_KEYWORDS = /тесто|трен|нан|болден|дека|Masteron|провирон|станоз|оксанд|диана|anavar|винстрол|примо|eq|dht/i;
const PED_COLORS: Record<string, string> = {
  'тесто': '#ef4444',
  'трен': '#f97316',
  'нан': '#f59e0b',
  'болден': '#eab308',
  'дека': '#84cc16',
  'Masteron': '#22c55e',
  'провирон': '#14b8a6',
  'станоз': '#06b6d4',
  'оксанд': '#3b82f6',
  'диана': '#6366f1',
  'anavar': '#a855f7',
  'винстрол': '#d946ef',
  'примо': '#ec4899',
  'eq': '#f43f5e',
  'dht': '#fb923c',
};

const phaseColors: Record<string, string> = {
  bulking: '#22c55e',
  cutting: '#ef4444',
  recomp: '#f59e0b',
  maintenance: '#60a5fa',
  strength: '#a855f7',
  endurance: '#06b6d4',
  mass: '#22c55e',
  'strength_mass': '#a855f7',
  'on_course': '#ef4444',
  pct: '#f97316',
  cruise: '#3b82f6',
  training: '#3b82f6',
};

const phaseLabels: Record<string, string> = {
  bulking: 'Набор',
  cutting: 'Сушка',
  recomp: 'Рекомпозиция',
  maintenance: 'Поддержание',
  strength: 'Сила',
  endurance: 'Выносливость',
  mass: 'Масса',
  strength_mass: 'Сила+Масса',
  on_course: 'На курсе',
  pct: 'ПКТ',
  cruise: 'Круиз',
  training: 'Тренинг',
};

const readPharmaSubstances = (): string[] => {
  try {
    const raw = localStorage.getItem(UNIFIED_KEY) || localStorage.getItem(PHARMA_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    const subs = data?.pharma?.currentSubstances || data?.currentSubstances || [];
    if (!Array.isArray(subs)) return [];
    return subs.map((s: any) => s.name || s.id || s.substanceId).filter(Boolean);
  } catch {
    return [];
  }
};

interface SubstanceWeekMap {
  name: string;
  startWeek: number;
  endWeek: number;
  color: string;
}

const readSubstanceWeekMap = (): SubstanceWeekMap[] => {
  try {
    const raw = localStorage.getItem(UNIFIED_KEY) || localStorage.getItem(PHARMA_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    const subs = data?.pharma?.currentSubstances || data?.currentSubstances || [];
    if (!Array.isArray(subs)) return [];
    const courseStart = data?.pharma?.courseStartDate || data?.courseStartDate;
    if (!courseStart) return [];
    const startDate = new Date(courseStart);
    return subs
      .map((s: any) => {
        const name = s.name || s.id || s.substanceId || '';
        const startWeek = s.startWeek || 0;
        const endWeek = s.endWeek || 12;
        const color = PED_COLORS[name.replace(/^(test|eq|dht)[-_]?/i, '')] || PED_COLORS[name.split(/[-_]/)[0]] || '#ef4444';
        return { name, startWeek, endWeek, color };
      })
      .filter(s => s.name && PED_KEYWORDS.test(s.name));
  } catch {
    return [];
  }
};

const getCourseWeek = (date: string, courseStart: string): number => {
  const d = new Date(date);
  const start = new Date(courseStart);
  const days = Math.max(0, Math.floor((d.getTime() - start.getTime()) / 86400000));
  return Math.floor(days / 7) + 1;
};

export const PhaseInsights: React.FC<PhaseInsightsProps> = ({ rows }) => {
  const phases = useMemo<PhaseBlock[]>(() => {
    if (rows.length < 2) return [];
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const substances = readPharmaSubstances();
    const substanceMap = readSubstanceWeekMap();
    let courseStart: string | undefined;
    try {
      const raw = localStorage.getItem(UNIFIED_KEY) || localStorage.getItem(PHARMA_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        courseStart = data?.pharma?.courseStartDate || data?.courseStartDate;
      }
    } catch {
      // ignore
    }
    let phase: PhaseBlock | null = null;
    const out: PhaseBlock[] = [];

    const add = () => {
      if (phase && phase.entries.length >= 2) out.push(phase);
    };

    const getWeekKey = (date: string): string => {
      const d = new Date(date);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
      start.setDate(d.getDate() - dow);
      return start.toISOString().slice(0, 10);
    };

    const computeWeekStats = (entries: { date: string; weight: number; bodyFat?: number; muscleMass?: number }[], courseStart?: string, substanceMap: SubstanceWeekMap[] = []): WeekStats[] => {
      const groups: Record<string, { dates: string[]; weights: number[]; bfs: number[]; muscles: number[] }> = {};
      for (const e of entries) {
        const wk = getWeekKey(e.date);
        if (!groups[wk]) groups[wk] = { dates: [], weights: [], bfs: [], muscles: [] };
        groups[wk].dates.push(e.date);
        groups[wk].weights.push(e.weight);
        if (e.bodyFat !== undefined) groups[wk].bfs.push(e.bodyFat);
        if (e.muscleMass !== undefined) groups[wk].muscles.push(e.muscleMass);
      }
      return Object.entries(groups)
        .map(([weekStart, data]) => {
          const meanWeight = data.weights.reduce((s, v) => s + v, 0) / data.weights.length;
          const firstEntry = entries.find(e => getWeekKey(e.date) === weekStart);
          const lastEntry = [...entries].reverse().find(e => getWeekKey(e.date) === weekStart);
          const deltaWeight = lastEntry && firstEntry ? lastEntry.weight - firstEntry.weight : 0;
          const deltaBF = firstEntry?.bodyFat !== undefined && lastEntry?.bodyFat !== undefined ? lastEntry.bodyFat - firstEntry.bodyFat : undefined;
          const deltaMuscle = firstEntry?.muscleMass !== undefined && lastEntry?.muscleMass !== undefined ? lastEntry.muscleMass - firstEntry.muscleMass : undefined;
          const activeSubs: string[] = [];
          if (courseStart && substanceMap.length) {
            const courseWeek = getCourseWeek(weekStart, courseStart);
            substanceMap.forEach(s => {
              if (courseWeek >= s.startWeek && courseWeek <= s.endWeek) {
                activeSubs.push(s.name);
              }
            });
          }
          return { weekStart, meanWeight, deltaWeight, deltaBF, deltaMuscle, activeSubstances: activeSubs.length ? activeSubs : undefined };
        })
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    };

    for (const r of sorted) {
      let currentPhase = 'training';
      try {
        const raw = localStorage.getItem(TRAINING_KEY);
        if (raw) {
          const profile = JSON.parse(raw);
          currentPhase = profile.phase || profile.goal || 'training';
        }
      } catch {
        currentPhase = 'training';
      }

      const hasCourse = substances.some(s => /тесто|трен|нан|болден|дека|Masteron|провирон|станоз|оксанд|диана|anavar|винстрол|примо|eq|dht/i.test(s));

      if (!phase || phase.label !== currentPhase || hasCourse !== (phase.substances && phase.substances.length > 0)) {
        add();
        const color: string = phaseColors[currentPhase] || '#888';
        phase = {
          label: currentPhase,
          start: r.date,
          end: r.date,
          color,
          entries: [r],
          substances: hasCourse ? substances : [],
          weeks: [],
        };
      } else {
        phase.end = r.date;
        phase.entries.push(r);
      }
    }
    add();

    const result = out.map(p => ({
      ...p,
      weeks: computeWeekStats(p.entries, courseStart, substanceMap),
    }));
    return result;
  }, [rows]);

  if (!rows.length) return null;
  if (rows.length < 2) {
    return (
      <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
        <b>Фазы курса</b>
        <small style={{ display: 'block', marginTop: 6, color: '#888' }}>
          Добавьте минимум 2 записи веса — анализ фаз курса появится автоматически.
        </small>
      </section>
    );
  }

  return (
    <section style={{ padding: 12, background: '#18181b', borderRadius: 10, marginBottom: 12 }}>
      <b>📋 По фазам</b>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {phases.map((p, i) => {
          const first = p.entries[0];
          const last = p.entries[p.entries.length - 1];
          const deltaW = last.weight - first.weight;
          const deltaBF = first.bodyFat !== undefined && last.bodyFat !== undefined ? last.bodyFat - first.bodyFat : null;
          const deltaMuscle = first.muscleMass !== undefined && last.muscleMass !== undefined ? last.muscleMass - first.muscleMass : null;
          const days = Math.max(1, Math.round((Date.parse(p.end) - Date.parse(p.start)) / 86400000));
          const weeklyW = deltaW / days * 7;
          const label = phaseLabels[p.label] || p.label;
          return (
            <div key={`${p.label}-${i}`} style={{ padding: 10, background: `${p.color}15`, border: `1px solid ${p.color}44`, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <b style={{ color: p.color }}>{label}</b>
                <small style={{ color: colors.textMuted }}>
                  {p.start} → {p.end} ({days}д, {p.entries.length} записей)
                </small>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                <span>Вес: {deltaW > 0 ? '+' : ''}{deltaW.toFixed(1)} кг</span>
                {deltaBF !== null && <span>Жир: {deltaBF > 0 ? '+' : ''}{deltaBF.toFixed(1)}%</span>}
                {deltaMuscle !== null && <span>Мышцы: {deltaMuscle > 0 ? '+' : ''}{deltaMuscle.toFixed(1)} кг</span>}
                <span style={{ color: colors.textMuted }}>
                  {weeklyW > 0 ? '+' : ''}{weeklyW.toFixed(2)} кг/нед
                </span>
              </div>
              {p.weeks.length > 1 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                  {p.weeks.map((w, wi) => {
                    const pedBadges = w.activeSubstances?.map(s => {
                      const color = PED_COLORS[s.replace(/^(test|eq|dht)[-_]?/i, '')] || PED_COLORS[s.split(/[-_]/)[0]] || '#ef4444';
                      return <span key={s} style={{ padding: '0 3px', borderRadius: 3, background: color + '33', color, fontSize: 9, border: `1px solid ${color}44` }}>{s.split(/[-_]/)[0]}</span>;
                    });
                    return (
                      <span
                        key={wi}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: w.deltaWeight < 0 ? '#22c55e22' : w.deltaWeight > 0 ? '#f59e0b22' : '#27272a',
                          color: w.deltaWeight < 0 ? '#22c55e' : w.deltaWeight > 0 ? '#f59e0b' : '#888',
                          border: `1px solid ${w.deltaWeight < 0 ? '#22c55e44' : w.deltaWeight > 0 ? '#f59e0b44' : '#3f3f46'}`,
                          display: 'inline-flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                        title={`${w.weekStart}: ${w.meanWeight.toFixed(1)} кг${w.activeSubstances?.length ? ' · ' + w.activeSubstances.join(', ') : ''}`}
                      >
                        <span>{w.weekStart.slice(5)}: {w.deltaWeight > 0 ? '+' : ''}{w.deltaWeight.toFixed(1)}кг</span>
                        {pedBadges && <span style={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{pedBadges}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
              {p.substances && p.substances.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {p.substances.slice(0, 5).map((s, j) => (
                    <span key={j} style={{ padding: '2px 6px', borderRadius: 4, background: '#ef444433', color: '#f87171', fontSize: 10, border: '1px solid #ef444455' }}>
                      💉 {s}
                    </span>
                  ))}
                  {p.substances.length > 5 && (
                    <span style={{ padding: '2px 6px', borderRadius: 4, background: '#27272a', color: '#aaa', fontSize: 10 }}>
                      +{p.substances.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
