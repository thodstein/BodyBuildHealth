import React, { useState, useMemo, useCallback } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { LAB_MARKER_MAP, LAB_MARKER_MAP_BY_NAME } from '../../data/lab-marker-map';
import { GlassCard, PillBtn, showToast } from './BioStackAIConstants';
import type { LinkedData } from '../../core/data-link';

type LabSystem = 'hepatic' | 'cardio' | 'renal' | 'endocrine' | 'hematologic' | 'metabolic' | 'immune' | 'neuro' | 'musculoskeletal' | 'reproductive' | 'all';

const SYSTEM_ICONS: Record<string, string> = {
  hepatic: '🫁', cardio: '❤️', renal: '💧', endocrine: '🧬',
  hematologic: '🩸', metabolic: '🔥', immune: '🛡️', neuro: '🧠',
  musculoskeletal: '🦴', reproductive: '⚤', all: '📊',
};
const SYSTEM_LABELS: Record<string, string> = {
  all: 'Все системы', hepatic: 'Печень', cardio: 'ССС', renal: 'Почки',
  endocrine: 'Гормоны', hematologic: 'Кровь', metabolic: 'Метаболизм',
  immune: 'Иммунитет', neuro: 'Нервная', musculoskeletal: 'Кости/Мышцы',
  reproductive: 'Репродуктивная',
};
const EVIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  A: { label: 'A — Мета-анализ/РКИ', color: '#22c55e' },
  B: { label: 'B — Когортные/обсерв.', color: '#f59e0b' },
  C: { label: 'C — Механизм/эксперт', color: '#6366f1' },
};

/* ─── Deep lab analysis tab ─── */
export function LabTab({ linked, stackIds }: { linked?: LinkedData | null; stackIds: string[] }) {
  const labs = linked?.labAnalysis;
  const [filter, setFilter] = useState<LabSystem>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'system' | 'name'>('severity');

  const allDeviations = useMemo(() => {
    if (!labs?.interpretations) return [];
    return labs.interpretations
      .filter(i => (i.status as string) === 'high' || (i.status as string) === 'critical_high' || (i.status as string) === 'low' || (i.status as string) === 'critical_low')
      .map(i => {
        const marker = LAB_MARKER_MAP_BY_NAME[i.code] || LAB_MARKER_MAP.find(m =>
          m.name.toLowerCase().includes(i.code.toLowerCase()) ||
          i.code.toLowerCase().includes(m.marker.toLowerCase())
        );
        const system = marker?.system || 'metabolic';
        const suggestions: Array<{ id: string; name: string; evidence: string }> = [];
        const seen = new Set<string>();

        // From marker's correctionIds
        if (marker) {
          marker.correctionIds.forEach(cid => {
            if (seen.has(cid)) return;
            seen.add(cid);
            const cat = SUPPORT_CATALOG_DATA[cid];
            if (cat) suggestions.push({ id: cid, name: cat.nameRu || cat.name || cid, evidence: cat.tier === 'core' ? 'A' : cat.tier === 'standard' ? 'B' : 'C' });
          });
          // From mechanisms
          marker.mechanisms.forEach(m => {
            const found = Object.entries(SUPPORT_CATALOG_DATA).filter(([_, v]) =>
              (v.mechanisms || []).includes(m) && !seen.has(v.id) && v.tier !== 'specialty'
            );
            found.slice(0, 1).forEach(([id, v]) => {
              seen.add(id);
              suggestions.push({ id, name: v.nameRu || v.name || id, evidence: v.tier === 'core' ? 'A' : v.tier === 'standard' ? 'B' : 'C' });
            });
          });
        }

        // Generic fallback
        if (suggestions.length === 0) {
          const code = i.code.toLowerCase();
          const fallback: Record<string, string[]> = {
            alt: ['NAC', 'Расторопша', 'TUDCA'], ast: ['NAC', 'Расторопша', 'TUDCA'],
            ggt: ['TUDCA', 'Расторопша'], creatinine: ['Астрагал', 'Кордицепс'],
            glucose: ['Берберин', 'Альфа-липоевая', 'Хром'], hba1c: ['Берберин', 'Альфа-липоевая'],
            ldl: ['Омега-3', 'Берберин', 'Красный рис'], crp: ['Куркумин', 'Омега-3'],
          };
          for (const [key, vals] of Object.entries(fallback)) {
            if (code.includes(key)) {
              vals.forEach(v => { if (!seen.has(v)) { seen.add(v); suggestions.push({ id: v, name: v, evidence: 'C' }); } });
              break;
            }
          }
        }
        return {
          code: i.code, name: marker?.name || i.code, value: i.value?.toString() || '—',
          status: i.status, unit: marker?.unit || '', ref: marker ? `${marker.defaultValue} ${marker.unit}` : '—',
          system, organ: marker?.organ || '', suggestions: suggestions.slice(0, 5),
        };
      });
  }, [labs]);

  const filtered = useMemo(() => {
    let arr = filter === 'all' ? allDeviations : allDeviations.filter(d => d.system === filter);
    if (sortBy === 'severity') arr = [...arr].sort((a, b) => (b.status.includes('critical') ? 2 : 1) - (a.status.includes('critical') ? 2 : 1));
    if (sortBy === 'name') arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'system') arr = [...arr].sort((a, b) => a.system.localeCompare(b.system));
    return arr;
  }, [allDeviations, filter, sortBy]);

  const systemCounts = useMemo(() => {
    const cnt: Record<string, number> = {};
    allDeviations.forEach(d => { cnt[d.system] = (cnt[d.system] || 0) + 1; });
    return cnt;
  }, [allDeviations]);

  const severityColor = (s: string) => s.includes('critical') ? '#ef4444' : '#f59e0b';
  const severityIcon = (s: string) => s.includes('critical') ? '🔴' : '🟡';

  if (!labs || allDeviations.length === 0) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <GlassCard title="🧪 Глубинный анализ лаборатории" icon="🧪" color="#a78bfa">
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '20px 0', lineHeight: 1.5 }}>
            {labs ? '✅ Все показатели в норме' : '🔬 Нет данных анализов'}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            Внесите анализы в Лабораторию на главном экране для интерпретации
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 8, lineHeight: 1.3, textAlign: 'center' }}>
        🧪 Глубинная интерпретация лабораторных маркеров — отклонения → БАДы-рекомендации
      </div>

      {/* Summary card */}
      <GlassCard title={`📊 Сводка: ${allDeviations.length} отклонений`} icon="📊" color="#a78bfa">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {Object.entries(systemCounts).map(([sys, cnt]) => (
            <span key={sys} style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 7, fontWeight: 600,
              background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.12)',
              color: '#a78bfa',
            }}>{SYSTEM_ICONS[sys] || '📌'} {SYSTEM_LABELS[sys] || sys}: {cnt}</span>
          ))}
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
          ⚠ Критических: {allDeviations.filter(d => d.status.includes('critical')).length} |
          Отклонений: {allDeviations.filter(d => !d.status.includes('critical')).length} |
          Систем: {Object.keys(systemCounts).length}
        </div>
      </GlassCard>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {(['all', 'hepatic', 'cardio', 'renal', 'endocrine', 'hematologic', 'metabolic', 'immune', 'neuro', 'musculoskeletal', 'reproductive'] as LabSystem[]).map(sys => (
          systemCounts[sys] || sys === 'all' ? (
            <PillBtn key={sys} active={filter === sys} onClick={() => setFilter(sys)} color="#a78bfa">
              {SYSTEM_ICONS[sys]}{SYSTEM_LABELS[sys]}{sys !== 'all' ? ` (${systemCounts[sys] || 0})` : ''}
            </PillBtn>
          ) : null
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {(['severity', 'system', 'name'] as const).map(s => (
          <PillBtn key={s} active={sortBy === s} onClick={() => setSortBy(s)} color="#6366f1">
            {s === 'severity' ? '🔴 По риску' : s === 'system' ? '📂 По системе' : '📝 По названию'}
          </PillBtn>
        ))}
      </div>

      {/* Marker cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map((d, i) => (
          <div key={i} style={{
            padding: '8px 10px', borderRadius: 8,
            background: d.status.includes('critical') ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
            border: `1px solid ${d.status.includes('critical') ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'}`,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{d.name}</span>
                <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)' }}>({d.code})</span>
                <span style={{ fontSize: 6, padding: '1px 4px', borderRadius: 4, background: 'rgba(167,139,250,0.06)', color: '#a78bfa' }}>
                  {SYSTEM_ICONS[d.system]}{SYSTEM_LABELS[d.system]}
                </span>
              </div>
              <span style={{
                fontSize: 7, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                background: `${severityColor(d.status)}12`, color: severityColor(d.status),
              }}>{severityIcon(d.status)} {d.status.includes('critical') ? 'Критично' : 'Отклонение'}</span>
            </div>

            {/* Value vs ref */}
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontFamily: 'monospace' }}>
              Значение: <span style={{ color: severityColor(d.status), fontWeight: 700 }}>{d.value} {d.unit}</span>
              {' | '}Норма: {d.ref}
              {d.organ && <span style={{ color: 'rgba(255,255,255,0.2)' }}> | {d.organ}</span>}
            </div>

            {/* Suggestions */}
            {d.suggestions.length > 0 && (
              <div>
                <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>🧪 Рекомендованные добавки:</div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {d.suggestions.map((s, si) => {
                    const inStack = stackIds.includes(s.id);
                    const ev = EVIDENCE_LABELS[s.evidence] || EVIDENCE_LABELS.C;
                    return (
                      <span key={si} style={{
                        padding: '2px 6px', borderRadius: 6, fontSize: 6, fontWeight: 600,
                        background: inStack ? 'rgba(0,230,138,0.08)' : `${ev.color}08`,
                        border: `1px solid ${inStack ? 'rgba(0,230,138,0.15)' : `${ev.color}15`}`,
                        color: inStack ? '#00e68a' : ev.color,
                        cursor: 'default',
                      }}>
                        {inStack ? '✅ ' : '+ '}{s.name}
                        <span style={{ opacity: 0.5, marginLeft: 2 }}>{s.evidence}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && filter !== 'all' && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
          ✅ Нет отклонений по системе {SYSTEM_LABELS[filter]}
        </div>
      )}

      {/* Normal markers summary */}
      <GlassCard title="📋 Маркеры в норме" color="#22c55e" style={{ marginTop: 8 }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
          {labs.interpretations ? labs.interpretations.filter((i: any) => (i.status as string) === 'normal' || (i.status as string) === 'optimal').length : 0} маркеров в пределах референсных значений.
          {(labs.interpretations?.length || 0) > 0 && (
            <span style={{ color: '#22c55e' }}>
              {' '}Общее покрытие: {Math.round((labs.interpretations.filter((i: any) => (i.status as string) === 'normal' || (i.status as string) === 'optimal').length / labs.interpretations.length) * 100)}% в норме.
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
          {labs.interpretations?.filter((i: any) => (i.status as string) === 'normal' || (i.status as string) === 'optimal').slice(0, 12).map((i: any, idx: number) => {
            const marker = LAB_MARKER_MAP_BY_NAME[i.code];
            return (
              <span key={idx} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 6, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.08)', color: '#4ade80' }}>
                🟢 {marker?.name || i.code}
              </span>
            );
          })}
          {(labs.interpretations?.filter((i: any) => (i.status as string) === 'normal' || (i.status as string) === 'optimal').length || 0) > 12 && (
            <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', padding: '1px 5px' }}>
              +{labs.interpretations.filter((i: any) => (i.status as string) === 'normal' || (i.status as string) === 'optimal').length - 12} ещё
            </span>
          )}
        </div>
      </GlassCard>

      <button onClick={() => {
        const txt = [
          `🧪 Отчёт по лаборатории (${new Date().toLocaleDateString('ru-RU')})`,
          `Всего отклонений: ${allDeviations.length}, систем: ${Object.keys(systemCounts).length}`,
          `Критических: ${allDeviations.filter(d => d.status.includes('critical')).length}`,
          '---',
          ...filtered.map(d => `${severityIcon(d.status)} ${d.name} (${d.value} ${d.unit}, норма: ${d.ref}) — ${SYSTEM_LABELS[d.system]}` +
            (d.suggestions.length > 0 ? `\n  Рекомендации: ${d.suggestions.map(s => s.name).join(', ')}` : '')),
        ].join('\n');
        navigator.clipboard.writeText(txt);
        showToast('Скопировано', 'success');
      }} style={{
        width: '100%', padding: '10px 0', borderRadius: 8, marginTop: 8, cursor: 'pointer', fontSize: 9, fontWeight: 600,
        background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.1)', color: '#a78bfa',
      }}>
        📋 Копировать отчёт по лаборатории
      </button>
    </div>
  );
}
