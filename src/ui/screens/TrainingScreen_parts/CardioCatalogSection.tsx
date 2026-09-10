/**
 * CardioCatalogSection.tsx — каталог именных кардио-циклов (шаг «Библиотека»).
 * Своя зона (не CycleCatalog — тот shared/чужой, не трогаем):
 * фильтры вид/уровень/суставы/поиск + ранжирование под параметры мастера
 * + кнопка «Собрать» → onApplyTemplate(templateId) / мост requestCardioTemplateBuild.
 */
import React, { useMemo, useState } from 'react';
import { CARDIO_CYCLES } from '../../../data/cardio-cycles/cardio-cycle-index';
import { rankCardioCycles } from '../../../engines/lms/cardio-cycle-selector.engine';
import { CARDIO_GOAL_LABELS, type CardioGoal, type CardioLevel } from '../../../engines/lms/cardio.engine';
import { SectionCard, ROW, BTN_PRIMARY, BTN_SMALL, Badge, HINT } from './CardioUI';

const SPORT_LABEL: Record<string, string> = {
  all: 'Все виды', run: '🏃 Бег', row: '🚣 Гребля', bike: '🚴 Вело', mixed: '🔀 Смешанные', hiit: '⚡ HIIT',
};
const LEVEL_LABEL: Record<string, string> = { all: 'Любой уровень', beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый' };

export const CardioCatalogSection: React.FC<{
  goal: CardioGoal;
  level: CardioLevel;
  daysAvailable: number;
  lowImpact: boolean;
  onApplyTemplate: (templateId: string) => void;
}> = ({ goal, level, daysAvailable, lowImpact, onApplyTemplate }) => {
  const [sport, setSport] = useState('all');
  const [lvl, setLvl] = useState('all');
  const [q, setQ] = useState('');
  const [onlyJoints, setOnlyJoints] = useState(false);

  const ranked = useMemo(() => {
    const pool = CARDIO_CYCLES.filter(t => {
      if (sport !== 'all' && t.meta.sport !== sport && t.meta.sport !== 'mixed') return false;
      if (lvl !== 'all' && !t.meta.level.includes(lvl as CardioLevel)) return false;
      if (onlyJoints && !t.meta.lowImpact) return false;
      if (q.trim()) {
        const s = (t.meta.title + ' ' + t.meta.description + ' ' + (t.meta.tags ?? []).join(' ')).toLowerCase();
        if (!s.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
    return rankCardioCycles(
      { goal, level, daysPerWeek: daysAvailable, lowImpact: lowImpact || onlyJoints || undefined },
      pool,
    );
  }, [sport, lvl, q, onlyJoints, goal, level, daysAvailable, lowImpact]);

  const topId = ranked[0]?.template.meta.id;

  return (
    <SectionCard title={`📚 Каталог циклов (${ranked.length})`}>
      <div style={HINT}>Именные планы (C25K, Garmin, Nike, Concept2...) + цели конструктора. Топ-1 подобран под ваши параметры.</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Поиск" aria-label="Поиск по каталогу"
          style={{ flex: '1 1 150px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: '11px 13px', color: '#fff', fontSize: 16, minHeight: 48, outline: 'none' }} />
        <select value={sport} onChange={e => setSport(e.target.value)} aria-label="Вид спорта"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: '11px', color: '#fff', fontSize: 14, minHeight: 48 }}>
          {Object.entries(SPORT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={lvl} onChange={e => setLvl(e.target.value)} aria-label="Уровень"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: '11px', color: '#fff', fontSize: 14, minHeight: 48 }}>
          {Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => setOnlyJoints(v => !v)} aria-pressed={onlyJoints} style={onlyJoints ? { ...BTN_SMALL, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' } : BTN_SMALL}>
          {onlyJoints ? '🦵 Только щадящие ✓' : '🦵 Щадящие'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
        {ranked.map(({ template: t, score, reasons }) => {
          const m = t.meta;
          const isTop = t.meta.id === topId;
          return (
            <div key={m.id} data-active={isTop} style={{ padding: 12, borderRadius: 14, background: isTop ? 'linear-gradient(180deg, rgba(0,230,138,0.12), rgba(0,230,138,0.04))' : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))', border: isTop ? '1px solid rgba(0,230,138,0.42)' : '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 850 }}>{isTop ? '⭐ ' : ''}{m.title}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Badge>{CARDIO_GOAL_LABELS[m.goal]}</Badge>
                <Badge>{m.weeks} нед</Badge>
                <Badge>{m.sessionsPerWeek} д/нед</Badge>
                {m.lowImpact && <Badge>🦵 щадящий</Badge>}
                {m.kind === 'explicit' && <Badge>📜 дословно</Badge>}
              </div>
              <div style={{ fontSize: 11.5, color: '#fff', lineHeight: 1.5 }}>{m.description}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>📖 {m.sourceLabel} · счёт {score} ({reasons.slice(0, 3).join(', ')})</div>
              <div style={ROW}>
                <button style={{ ...BTN_PRIMARY, minHeight: 44, flex: 1 }} onClick={() => onApplyTemplate(m.id)}>🛠 Собрать цикл</button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};
