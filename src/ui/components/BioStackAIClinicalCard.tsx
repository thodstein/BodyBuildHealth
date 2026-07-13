// BioStackAIClinicalCard.tsx — единый рендер клин. вердикта selectStack.
// Устраняет тройное дублирование вывода (Build / Risks / Clinical) одним источником.
import React, { useMemo } from 'react';
import type { SelectStackResult } from '../../engines/biostack-clinical-v2.engine';
import { findMeaningfulReplacement, type MeaningfulReplacement } from '../../engines/biostack-clinical-v2.engine';
import type { BioStackProfile } from '../../engines/biostack-ai.engine';
import { GlassCard } from './BioStackAIConstants';

type AnyRes = SelectStackResult & Record<string, any>;

const nm = (x: any, nameOf?: (id: string) => string): string => {
  if (!x) return '';
  return x.substanceName || x.name || (nameOf && (x.substanceId || x.id) ? nameOf(x.substanceId || x.id) : '') || x.substanceId || x.id || '';
};

const timeLabel = (t: string): string =>
  t === 'morning' ? 'Утро' : t === 'afternoon' ? 'День' : t === 'evening' ? 'Вечер' : t === 'night' ? 'Ночь' : t;

export const ClinicalResultCard: React.FC<{
  result: SelectStackResult;
  nameOf?: (id: string) => string;
  onClearStops?: () => void;
  profile?: BioStackProfile;
  onReplace?: (originalId: string, replacementId: string) => void;
}> = ({ result, nameOf, onClearStops, profile, onReplace }) => {
  const r = result as AnyRes;
  const hasStop = (r.hardStops?.length ?? 0) > 0 || (r.drugExclusions?.length ?? 0) > 0;

  // ── Аналоги для стоп-позиций (findMeaningfulReplacement) ──
  const stopIds = useMemo(() => [
    ...(r.hardStops || []).map((h: any) => h.substanceId || h.id),
    ...(r.drugExclusions || []).map((e: any) => e.substanceId || e.id),
  ].filter(Boolean), [r]);
  const replacements = useMemo(() => {
    if (!profile) return {} as Record<string, MeaningfulReplacement>;
    const out: Record<string, MeaningfulReplacement> = {};
    for (const id of stopIds) {
      try {
        const rep = findMeaningfulReplacement(id, profile, stopIds);
        if (rep) out[id] = rep;
      } catch { /* no analog */ }
    }
    return out;
  }, [stopIds, profile]);

  const replaceBtn = (origId: string) => {
    const rep = replacements[origId];
    if (!rep || !onReplace) return null;
    return (
      <div style={{ marginTop: 3 }}>
        <button onClick={() => onReplace(origId, rep.replacementId)} style={{
          padding: '5px 9px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700,
          background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.25)', color: '#00e68a',
        }}>🔄 Заменить на {rep.replacementName}{rep.gradeUpgrade ? ' ⬆' : ''}</button>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 1.3 }}>{rep.reason} · {rep.safetyNote}</div>
      </div>
    );
  };

  const block = (key: string, title: string, icon: string, color: string, bg: string, border: string, children: React.ReactNode) => (
    <div key={key} style={{ padding: '7px 9px', borderRadius: 8, marginBottom: 6, background: bg, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 3 }}>{icon} {title}</div>
      {children}
    </div>
  );

  return (
    <GlassCard title="🩺 Клинический контроль стека" icon="🩺" color={hasStop ? '#ef4444' : '#22c55e'} style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3, marginBottom: 6 }}>
        {hasStop
          ? '🔴 Есть СТОП-факторы — стек заблокирован, удалите позиции ниже.'
          : '✅ Критических противопоказаний не обнаружено.'}
      </div>

      {(r.hardStops?.length ?? 0) > 0 && block('hs', 'Абсолютные противопоказания (удалены)', '🔴', '#ef4444', 'rgba(239,68,68,0.06)', 'rgba(239,68,68,0.12)',
        <>
          {r.hardStops.map((h: any, i: number) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35, marginBottom: 3 }}>
              ⛔ <b>{nm(h, nameOf)}</b> — {h.reason}<span style={{ opacity: 0.5 }}>{(h.category && ' · ' + h.category) || ''}</span>
              {replaceBtn(h.substanceId || h.id)}
            </div>
          ))}
        </>
      )}

      {(r.drugExclusions?.length ?? 0) > 0 && block('de', 'Исключения по фарме (HIGH)', '⚠', '#f59e0b', 'rgba(245,158,11,0.05)', 'rgba(245,158,11,0.1)',
        <>
          {r.drugExclusions.map((e: any, i: number) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3, marginBottom: 3 }}>⚠ <b>{nm(e, nameOf)}</b> — {e.reason}
              {replaceBtn(e.substanceId || e.id)}
            </div>
          ))}
        </>
      )}

      {(r.ulWarnings?.length ?? 0) > 0 && block('ul', 'Превышение верхних допустимых доз (UL)', '⚠', '#f59e0b', 'rgba(245,158,11,0.05)', 'rgba(245,158,11,0.1)',
        <>
          {r.ulWarnings.map((u: any, i: number) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
              🔺 <b>{nm(u, nameOf)}</b>: {u.totalDose} мг / UL {u.ul} мг ({Math.round(u.percentUL ?? 0)}%) — {u.severity === 'HIGH' ? 'высокий' : 'умеренный'}
              <div style={{ color: 'rgba(255,255,255,0.4)' }}>{u.message}</div>
            </div>
          ))}
        </>
      )}

      {(r.labAdjustments?.length ?? 0) > 0 && block('la', 'Коррекция доз по анализам', '💊', '#60a5fa', 'rgba(96,165,250,0.05)', 'rgba(96,165,250,0.1)',
        <>
          {r.labAdjustments.map((a: any, i: number) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>➖ <b>{nm(a, nameOf)}</b>: {a.originalDose} → <b style={{ color: '#60a5fa' }}>{a.adjustedDose}</b> — {a.reason}</div>
          ))}
        </>
      )}

      {(r.drugTitrations?.length ?? 0) > 0 && block('dt', 'Снизить дозу + контроль анализов (MEDIUM)', '⚠', '#f59e0b', 'rgba(245,158,11,0.05)', 'rgba(245,158,11,0.1)',
        <>
          {r.drugTitrations.map((t: any, i: number) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>➖ <b>{nm(t, nameOf)}</b>: {t.effect}
              <div style={{ color: 'rgba(255,255,255,0.4)' }}>{t.recommendation}</div>
            </div>
          ))}
        </>
      )}

      {(r.redundancy?.length ?? 0) > 0 && block('rd', 'Избыточное дублирование путей', '🔁', '#a78bfa', 'rgba(167,139,250,0.05)', 'rgba(167,139,250,0.1)',
        <>
          {r.redundancy.map((rd: any, i: number) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>↔ {rd.names?.join(', ') || rd.pathway}: {rd.message}</div>
          ))}
        </>
      )}

      {(r.schedule?.length ?? 0) > 0 && block('sc', 'Расписание приёма (итог)', '⏰', '#00e68a', 'rgba(0,230,138,0.05)', 'rgba(0,230,138,0.1)',
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {r.schedule.map((s: any, i: number) => (
            <div key={i} style={{ padding: '7px 10px', borderRadius: 10, fontSize: 12, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.25)', color: 'var(--text)' }}>
              <b>{timeLabel(s.time)}</b>: {(s.names || (s.ids || []).map((id: string) => nm({ substanceId: id }, nameOf))).join(', ')}
            </div>
          ))}
        </div>
      )}

      {(r.cycling?.length ?? 0) > 0 && block('cy', 'Режим циклирования', '🔄', '#ec4899', 'rgba(236,72,153,0.05)', 'rgba(236,72,153,0.1)',
        <>
          {r.cycling.map((c: any, i: number) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>⏳ <b>{nm(c, nameOf)}</b> — {c.durationWeeks} нед: {c.cycleNote}</div>
          ))}
        </>
      )}

      {hasStop && onClearStops && (
        <button onClick={onClearStops} style={{
          marginTop: 4, width: '100%', minHeight: 38, padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
        }}>Исключить стоп-позиции</button>
      )}
    </GlassCard>
  );
};
