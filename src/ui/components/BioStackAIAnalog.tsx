import React, { useMemo, useState } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { SUPPLEMENT_COMPOSITION, COMPLEX_NAMES, MECHANISM_LABELS } from '../../data/support-meta';
import {
  findMeaningfulReplacement,
  deriveAnalogsByMechanism,
  fuzzySearchSupplements,
  decomposeComplex,
  getEvidenceGrade,
} from '../../engines/biostack-clinical-v2.engine';
import { normalizeMechanisms } from '../../engines/biostack-mechanism-normalizer';
import type { BioStackProfile } from '../../engines/biostack-ai.engine';
import { GlassCard, showToast } from './BioStackAIConstants';

interface CatalogLike {
  nameRu?: string;
  name?: string;
  mechanisms?: string[];
  category?: string[];
}
const catOf = (id: string): CatalogLike | undefined => SUPPORT_CATALOG_DATA[id] as CatalogLike | undefined;
const nameOf = (id: string): string => catOf(id)?.nameRu || catOf(id)?.name || id;
const gradeColor = (g: string): string => (g === 'A' ? '#4ade80' : g === 'B' ? '#60a5fa' : '#fbbf24');

interface AnalogCardData {
  replacementId: string;
  replacementName: string;
  reason: string;
  safetyNote: string;
  gradeUpgrade: boolean;
  group: string;
  note: string;
  sharedMechs: string[];
  recommended: boolean;
  // Фармакокинетика
  form?: string;
  doseMg?: number;
  doseUnit?: string;
  timing?: string;
  clinicalEquivalence?: 'high' | 'moderate' | 'low' | 'unknown';
  clinicalNote?: string;
  therapeuticClass?: string;
  doseWarning?: string;
  recommendedDoseMg?: number;
}

interface BioStackAIAnalogProps {
  profile: BioStackProfile;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
  onToast?: (msg: string) => void;
}

export default function BioStackAIAnalog({ profile, stackIds, setStackIds, onToast }: BioStackAIAnalogProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedIsComplex, setSelectedIsComplex] = useState(false);

  const toast = (m: string) => {
    if (onToast) onToast(m);
    else showToast(m, 'info');
  };

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const catalog = fuzzySearchSupplements(q, 8).map((r: any) => ({ id: r.id as string, name: r.name as string, kind: 'catalog' as const }));
    const complexes = Object.keys(SUPPLEMENT_COMPOSITION)
      .filter((id) => (COMPLEX_NAMES[id] || id).toLowerCase().includes(q))
      .slice(0, 8)
      .map((id) => ({ id, name: COMPLEX_NAMES[id] || id, kind: 'complex' as const }));
    return [...catalog, ...complexes].slice(0, 12);
  }, [query]);

  const sharedMechs = (aId: string, bId: string): string[] => {
    const setA = new Set(normalizeMechanisms(catOf(aId)?.mechanisms || []));
    return normalizeMechanisms(catOf(bId)?.mechanisms || []).filter((m) => setA.has(m));
  };

  const analogCardsFor = (originId: string, recommendedFirst: boolean): AnalogCardData[] => {
    const best = findMeaningfulReplacement(originId, profile, []);
    const mech = deriveAnalogsByMechanism(originId, 6);
    const cards: AnalogCardData[] = [];
    const seen = new Set<string>();
    if (best) {
      seen.add(best.replacementId.toLowerCase());
      cards.push({
        replacementId: best.replacementId,
        replacementName: best.replacementName,
        reason: best.reason,
        safetyNote: best.safetyNote,
        gradeUpgrade: best.gradeUpgrade,
        group: 'клин. подбор',
        note: best.reason,
        sharedMechs: sharedMechs(originId, best.replacementId),
        recommended: true,
        // Прокидываем фармакокинетику
        form: (best as any).form,
        doseMg: (best as any).doseMg,
        doseUnit: (best as any).doseUnit,
        timing: (best as any).timing,
        clinicalEquivalence: (best as any).clinicalEquivalence,
        clinicalNote: (best as any).clinicalNote,
        therapeuticClass: (best as any).therapeuticClass,
        doseWarning: (best as any).doseWarning,
        recommendedDoseMg: (best as any).recommendedDoseMg,
      });
    }
    for (const m of mech) {
      if (seen.has(m.id.toLowerCase())) continue;
      seen.add(m.id.toLowerCase());
      cards.push({
        replacementId: m.id,
        replacementName: m.name,
        reason: m.note,
        safetyNote: '',
        gradeUpgrade: false,
        group: m.group,
        note: m.note,
        sharedMechs: sharedMechs(originId, m.id),
        recommended: false,
      });
    }
    cards.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
    return recommendedFirst ? cards : cards;
  };

  const catalogResults: AnalogCardData[] = useMemo(() => {
    if (!selected || selectedIsComplex) return [];
    return analogCardsFor(selected, true);
  }, [selected, selectedIsComplex, profile]);

  const complexComponents = useMemo(() => {
    if (!selected || !selectedIsComplex) return [] as { id: string; name: string; analogs: AnalogCardData[] }[];
    const decomposed = decomposeComplex(selected);
    return decomposed
      .filter((c) => catOf(c.componentId))
      .map((c) => ({ id: c.componentId, name: c.componentName, analogs: analogCardsFor(c.componentId, false).slice(0, 3) }));
  }, [selected, selectedIsComplex, profile]);

  const addToStack = (id: string) => {
    const next = Array.from(new Set([...stackIds, id]));
    setStackIds(next);
    toast(`➕ ${nameOf(id)} добавлен в стек`);
  };

  const replaceInStack = (originId: string, id: string) => {
    if (!stackIds.some((s) => s.toLowerCase() === originId.toLowerCase())) {
      addToStack(id);
      return;
    }
    const next = stackIds.map((s) => (s.toLowerCase() === originId.toLowerCase() ? id : s));
    setStackIds(next);
    toast(`🔄 ${nameOf(originId)} → ${nameOf(id)}`);
  };

  const originInStack = selected && !selectedIsComplex && stackIds.some((s) => s.toLowerCase() === selected.toLowerCase());

  const renderCard = (card: AnalogCardData, originId: string) => {
    const g = getEvidenceGrade(card.replacementId);
    const accent = card.recommended ? '#a78bfa' : gradeColor(g);

    // Форма, доза, timing
    const formInfo: string[] = [];
    if (card.form) formInfo.push(card.form);
    if (card.doseMg) formInfo.push(`${card.doseMg} мг`);
    if (card.timing) formInfo.push(card.timing);

    const equivColor = card.clinicalEquivalence === 'high' ? '#22c55e'
                     : card.clinicalEquivalence === 'moderate' ? '#f59e0b'
                     : card.clinicalEquivalence === 'low' ? '#ef4444'
                     : '#94a3b8';
    const equivLabel = card.clinicalEquivalence === 'high' ? '✅ Высокая'
                     : card.clinicalEquivalence === 'moderate' ? '⚠ Умеренная'
                     : card.clinicalEquivalence === 'low' ? '⛔ Низкая'
                     : '';

    return (
      <div
        key={card.replacementId}
        style={{
          background: 'rgba(28,28,32,0.55)',
          borderRadius: 14,
          padding: 12,
          marginBottom: 10,
          borderLeft: `3px solid ${accent}`,
          backdropFilter: 'blur(18px) saturate(160%)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>{card.replacementName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#0b0b0f', background: gradeColor(g), borderRadius: 6, padding: '1px 6px' }}>грейд {g}</span>
            {card.recommended && (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#a78bfa', borderRadius: 6, padding: '1px 6px' }}>рекоменд.</span>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.6)', marginTop: 4 }}>
          {card.group === 'категория' ? '🔁 По терапевтической группе' : '🧬 По механизму действия'} · {card.note}
        </div>

        {formInfo.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#60a5fa', padding: '4px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.1)', display: 'inline-block', fontWeight: 500 }}>
            📋 {formInfo.join(' · ')}
          </div>
        )}
        {equivLabel && (
          <div style={{ marginTop: 4, fontSize: 10, color: equivColor, padding: '3px 7px', borderRadius: 6, background: `${equivColor}15`, display: 'inline-block', marginLeft: 4, fontWeight: 600 }}>
            {equivLabel} эквив.
          </div>
        )}

        {card.sharedMechs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {card.sharedMechs.map((m) => (
              <span
                key={m}
                style={{
                  fontSize: 10,
                  color: '#c4b5fd',
                  background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.25)',
                  borderRadius: 8,
                  padding: '2px 7px',
                }}
              >
                {MECHANISM_LABELS[m] || m}
              </span>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#e2e8f0', marginTop: 7, lineHeight: 1.4 }}>{card.reason}</div>

        {card.clinicalNote && (
          <div style={{ fontSize: 10.5, color: '#fbbf24', marginTop: 6, lineHeight: 1.4, padding: '6px 8px', background: 'rgba(251,191,36,0.06)', borderRadius: 6, border: '1px solid rgba(251,191,36,0.15)' }}>
            ⚠️ {card.clinicalNote}
          </div>
        )}
        {card.safetyNote && <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.6)', marginTop: 4 }}>{card.safetyNote}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
          <button
            onClick={() => addToStack(card.replacementId)}
            style={{
              flex: 1,
              minHeight: 36,
              fontSize: 12,
              fontWeight: 700,
              color: '#06281b',
              background: 'linear-gradient(135deg,#34d399,#10b981)',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            ➕ В стек
          </button>
          <button
            onClick={() => replaceInStack(originId, card.replacementId)}
            style={{
              flex: 1,
              minHeight: 36,
              fontSize: 12,
              fontWeight: 700,
              color: '#1e1b4b',
              background: 'linear-gradient(135deg,#a5b4fc,#818cf8)',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            🔄 Заменить
          </button>
        </div>
      </div>
    );
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 42,
    fontSize: 14,
    color: '#f1f5f9',
    background: 'rgba(118,118,128,0.12)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '10px 14px',
    outline: 'none',
  };

  return (
    <div style={{ padding: 12 }}>
      <GlassCard style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>🔁 Поиск аналога</div>
        <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.6)', marginBottom: 10 }}>
          Введите препарат или комплекс — получите клинически обоснованные замены (по терапевтической группе и механизму действия).
        </div>
        <input
          style={inputStyle}
          placeholder="Например: NAC, магний, комплекс суставов…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {suggestions.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {suggestions.map((s) => (
              <button
                key={s.kind + ':' + s.id}
                onClick={() => {
                  setSelected(s.id);
                  setSelectedIsComplex(s.kind === 'complex');
                  setQuery('');
                }}
                style={{
                  textAlign: 'left',
                  minHeight: 38,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#f1f5f9',
                  background: 'rgba(118,118,128,0.12)',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                {s.kind === 'complex' ? '🧪 ' : '💊 '}
                {s.name}
              </button>
            ))}
          </div>
        )}
      </GlassCard>

      {selected && !selectedIsComplex && (
        <GlassCard style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'rgba(235,235,245,0.6)' }}>Исходное вещество</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>{nameOf(selected)}</div>
          {originInStack && (
            <div style={{ fontSize: 11, color: '#fbbf24' }}>Входит в активный стек — доступна замена 🔄</div>
          )}
        </GlassCard>
      )}

      {selected && selectedIsComplex && (
        <GlassCard style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'rgba(235,235,245,0.6)' }}>Комплекс</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{COMPLEX_NAMES[selected] || nameOf(selected)}</div>
        </GlassCard>
      )}

      {selected && !selectedIsComplex && catalogResults.length === 0 && (
        <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.6)', padding: 8 }}>Для этого вещества аналоги не найдены.</div>
      )}

      {selected && !selectedIsComplex && catalogResults.map((c) => renderCard(c, selected))}

      {selected && selectedIsComplex && complexComponents.map((comp) => (
        <GlassCard key={comp.id} style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24', marginBottom: 6 }}>{comp.name}</div>
          {comp.analogs.length === 0 ? (
            <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.6)' }}>Аналоги не найдены.</div>
          ) : (
            comp.analogs.map((c) => renderCard(c, comp.id))
          )}
        </GlassCard>
      ))}
    </div>
  );
}
