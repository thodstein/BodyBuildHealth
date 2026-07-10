import React, { useState, useMemo } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';
import { PHARMA_DB } from '../../../core/pharma-database';
import {
  type EnrichedEntry, type FormWithBio,
  getCatalogFormBio, detectEnhancers, detectCompetition, classifySubstance,
  PERSONAL_ADJUSTERS, bioColor, THERAPEUTIC_WINDOWS, MODIFIERS, COST_PER_GRAM,
} from './SupportBioavailabilityData';
import { PopupSelect, PopupNumber, PopupBool } from '../../components/PopupXxx';
import { S } from './SupportShared';

// ─── Build enriched catalog ───
function buildCatalog(): EnrichedEntry[] {
  const entries: EnrichedEntry[] = [];
  for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
    if (!entry?.nameRu) continue;
    const forms: FormWithBio[] = (entry.forms || []).map(f => {
      const bio = getCatalogFormBio(f);
      return { ...f, bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`, effectiveDose: (doseMg: number) => Math.round(doseMg * bio) };
    });
    const clinical = classifySubstance(entry.nameRu, entry.category || []);
    entries.push({
      id, source: 'catalog', nameRu: entry.nameRu, nameEn: entry.name || id,
      tier: entry.tier, category: entry.category || [], description: entry.description || '',
      forms, maxBio: forms.length ? Math.max(...forms.map(f=>f.bioavailability)) : 0,
      minBio: forms.length ? Math.min(...forms.map(f=>f.bioavailability)) : 0,
      avgBio: forms.length ? forms.reduce((a, f) => a + f.bioavailability, 0) / forms.length : 0,
      bestForm: forms.find(f => f.best) || null,
      enhancers: detectEnhancers(entry), competitors: detectCompetition(entry, entry.nameRu, entry.category || []),
      absorptionKey: clinical.abs, halfLifeKey: clinical.hl, foodKey: clinical.food, windowKey: clinical.win, costPerGram: clinical.cost,
    });
  }
  for (const [pid, ph] of Object.entries(PHARMA_DB)) {
    if (!ph || !ph.name) continue;
    const bio = ph.pk?.bioavailability ?? (ph.bioavailability ? (typeof ph.bioavailability === 'number' ? ph.bioavailability : (typeof ph.bioavailability === 'object' && 'avg' in (ph.bioavailability as any) ? (ph.bioavailability as any).avg : 0.85)) : 0.85);
    const forms: FormWithBio[] = [{ id: pid, name: ph.name, nameRu: ph.name, dose: ph.dosageRange ? `${ph.dosageRange.min}-${ph.dosageRange.max} ${ph.dosageRange.unit}` : '—', best: true, bioavailability: bio, bioLabel: `${(bio * 100).toFixed(0)}%`, effectiveDose: (d: number) => Math.round(d * bio) }];
    entries.push({ id: pid, source: 'pharma', nameRu: ph.name, nameEn: ph.name || pid, tier: 'standard', category: ['pharma', (ph as any).class || 'aas'].filter(Boolean), description: ph.description || '', forms, maxBio: bio, minBio: bio, avgBio: bio, bestForm: forms[0], enhancers: [], competitors: [], absorptionKey: 'stomach', halfLifeKey: '', foodKey: 'antioxidant', windowKey: '', costPerGram: null });
  }
  return entries;
}

// ─── Therapeutic ranges for key supplements ───
const DOSE_RANGES: Record<string, { therMin: number; therMax: number; label: string }> = {
  nac: { therMin: 600, therMax: 1800, label: 'N-ацетилцистеин' },
  tudca: { therMin: 500, therMax: 1500, label: 'TUDCA' },
  milk_thistle: { therMin: 280, therMax: 840, label: 'Силимарин' },
  alpha_lipoic: { therMin: 300, therMax: 600, label: 'Альфа-липоевая кислота' },
  curcumin: { therMin: 500, therMax: 2000, label: 'Куркумин (с пиперином)' },
  coq10: { therMin: 100, therMax: 400, label: 'Коэнзим Q10' },
  omega3: { therMin: 2000, therMax: 6000, label: 'Омега-3 (EPA+DHA)' },
  berberine: { therMin: 500, therMax: 1500, label: 'Берберин' },
  magnesium: { therMin: 300, therMax: 600, label: 'Магний (элемент)' },
  zinc: { therMin: 15, therMax: 50, label: 'Цинк (элемент)' },
  vitamin_d3: { therMin: 1000, therMax: 5000, label: 'Витамин D3 (МЕ)' },
  b12: { therMin: 500, therMax: 2000, label: 'B12 (мкг)' },
  folate: { therMin: 400, therMax: 1000, label: 'Фолат (мкг)' },
  iron: { therMin: 18, therMax: 65, label: 'Железо (элемент)' },
  creatine: { therMin: 3000, therMax: 5000, label: 'Креатин' },
  ashwagandha: { therMin: 300, therMax: 600, label: 'Ашваганда' },
  rhodiola: { therMin: 200, therMax: 600, label: 'Родиола' },
};

// ─── Props for a DosingCard ───
interface DosingCardProps {
  label: string;
  accent: string;
  subId: string;
  onChangeSub: (id: string) => void;
  formIdx: number;
  onChangeForm: (idx: number) => void;
  dose: number;
  onChangeDose: (v: number) => void;
  catalogOpts: { id: string; label: string; desc?: string }[];
  formOpts: { id: string; label: string; desc?: string }[];
  forms: FormWithBio[];
  form?: FormWithBio;
  eff: { absorbed: number; rawAbsorbed: number; status: string };
  adjMult: number;
  costEff: number | null;
}

const DosingCard: React.FC<DosingCardProps> = ({
  label, accent, subId, onChangeSub, formIdx, onChangeForm,
  dose, onChangeDose, catalogOpts, formOpts, forms, form,
  eff, adjMult, costEff,
}) => (
  <div style={{
    padding: 12, borderRadius: 12,
    background: `rgba(${accent === '#00e68a' ? '0,230,138' : '96,165,250'},0.06)`,
    border: `1px solid ${accent}33`,
    display: 'flex', flexDirection: 'column', gap: 6,
  }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: accent, marginBottom: 2, letterSpacing: '-0.2px' }}>
      {label}
    </div>
    <PopupSelect label="Вещество" value={subId}
      options={catalogOpts}
      onChange={onChangeSub} />
    {forms.length > 0 && (
      <PopupSelect label="Форма выпуска" value={String(formIdx)}
        options={formOpts}
        onChange={v => onChangeForm(Number(v))} />
    )}
    <PopupNumber label="Доза" value={dose} min={0} max={10000} step={10} suffix="мг" onChange={onChangeDose} />

    {form && (
      <div style={{ marginTop: 4, padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.15)', textAlign: 'center' }}>
        <div style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
          Эффективная доза
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: accent }}>
          {eff.absorbed}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginLeft: 2 }}>мг</span>
        </div>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          {dose} мг × {(form.bioavailability * 100).toFixed(0)}%
          {adjMult < 1 ? ' × ' + adjMult.toFixed(2) : ''}
        </div>
        {adjMult < 1 && (
          <div style={{ fontSize: 6, color: '#ff9800', marginTop: 1 }}>
            без коррекции: {eff.rawAbsorbed} мг
          </div>
        )}
        {eff.status && (
          <div style={{
            marginTop: 3, padding: '3px 6px', borderRadius: 5, fontSize: 7, textAlign: 'center',
            background: eff.status.includes('терапевтическом') ? 'rgba(34,197,94,0.12)' : eff.status.includes('Ниже') ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
            color: eff.status.includes('терапевтическом') ? '#22c55e' : eff.status.includes('Ниже') ? '#f59e0b' : '#ef4444',
          }}>
            {eff.status}
          </div>
        )}
        {costEff !== null && (
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
            эфф-ть: {costEff.toFixed(2)} ₽/мг
          </div>
        )}
        <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{
            padding: '1px 5px', borderRadius: 3, fontSize: 6, fontWeight: 600,
            background: bioColor(form.bioavailability) + '22', color: bioColor(form.bioavailability),
          }}>
            {form.nameRu} ({(form.bioavailability * 100).toFixed(0)}%)
          </span>
        </div>
      </div>
    )}
  </div>
);

// ─── Main component ───
export const SupportEffectiveDose: React.FC = () => {
  const [sub1Id, setSub1Id] = useState('');
  const [sub2Id, setSub2Id] = useState('');
  const [dose1, setDose1] = useState(500);
  const [dose2, setDose2] = useState(500);
  const [form1Idx, setForm1Idx] = useState(0);
  const [form2Idx, setForm2Idx] = useState(0);
  const [activeAdjusters, setActiveAdjusters] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_bio_adjusters') || '[]'); } catch { return []; }
  });

  const catalog = useMemo(() => buildCatalog(), []);

  const sub1 = sub1Id ? catalog.find(e => e.id === sub1Id) : null;
  const sub2 = sub2Id ? catalog.find(e => e.id === sub2Id) : null;
  const f1 = sub1?.forms[form1Idx];
  const f2 = sub2?.forms[form2Idx];
  const adjMult = activeAdjusters.reduce((p, k) => p * (PERSONAL_ADJUSTERS[k]?.mult || 1), 1.0);

  const catalogOpts = useMemo(() => catalog.map(e => ({
    id: e.id, label: e.nameRu + ' (' + e.source + ')',
    desc: e.forms.length + ' форм · био ' + (e.avgBio * 100).toFixed(0) + '%',
  })), [catalog]);

  const formOpts1 = useMemo(() => (sub1?.forms || []).map((f, i) => ({
    id: String(i), label: f.nameRu,
    desc: 'Био: ' + (f.bioavailability * 100).toFixed(0) + '%' + (f.best ? ' ✓' : ''),
  })), [sub1]);

  const formOpts2 = useMemo(() => (sub2?.forms || []).map((f, i) => ({
    id: String(i), label: f.nameRu,
    desc: 'Био: ' + (f.bioavailability * 100).toFixed(0) + '%' + (f.best ? ' ✓' : ''),
  })), [sub2]);

  const calcEffDose = (form: FormWithBio | undefined, doseMg: number, id: string) => {
    if (!form || !doseMg) return { absorbed: 0, rawAbsorbed: 0, range: null as { therMin: number; therMax: number; label: string } | null, status: '' };
    const rawAbsorbed = Math.round(doseMg * form.bioavailability);
    const absorbed = Math.round(rawAbsorbed * adjMult);
    const rangeKey = Object.keys(DOSE_RANGES).find(k => id.toLowerCase().includes(k));
    const range = rangeKey ? DOSE_RANGES[rangeKey] : null;
    let status = '';
    if (range) {
      if (doseMg < range.therMin) status = 'Ниже терапевтического (мин ' + range.therMin + ' мг)';
      else if (doseMg > range.therMax) status = 'Выше терапевтического (макс ' + range.therMax + ' мг)';
      else status = 'В терапевтическом диапазоне ' + range.therMin + '-' + range.therMax + ' мг';
    }
    return { absorbed, rawAbsorbed, range, status };
  };

  const eff1 = calcEffDose(f1, dose1, sub1Id);
  const eff2 = calcEffDose(f2, dose2, sub2Id);

  const costPerGram1 = sub1?.costPerGram ?? null;
  const costPerGram2 = sub2?.costPerGram ?? null;
  const costEff1 = costPerGram1 && eff1.absorbed > 0 ? (costPerGram1 / eff1.absorbed * 1000) : null;
  const costEff2 = costPerGram2 && eff2.absorbed > 0 ? (costPerGram2 / eff2.absorbed * 1000) : null;

  const toggleAdjuster = (key: string) => {
    const next = activeAdjusters.includes(key)
      ? activeAdjusters.filter((k: string) => k !== key)
      : [...activeAdjusters, key];
    setActiveAdjusters(next);
    localStorage.setItem('he_bio_adjusters', JSON.stringify(next));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ─── Header card ─── */}
      <div style={{ ...S.cardAccent, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 80, height: 80, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,230,138,0.08), transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>
          🧮 Расчёт эффективной дозы
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          Выберите до двух веществ, укажите форму и дозу — получите усвоенное количество с учётом биодоступности и персонализированной коррекции.
        </div>
      </div>

      {/* ─── Substance dosing cards in 2-column grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <DosingCard
          label="Вещество 1"
          accent="#00e68a"
          subId={sub1Id}
          onChangeSub={v => { setSub1Id(v); setForm1Idx(0); }}
          formIdx={form1Idx}
          onChangeForm={setForm1Idx}
          dose={dose1}
          onChangeDose={setDose1}
          catalogOpts={catalogOpts}
          formOpts={formOpts1}
          forms={sub1?.forms || []}
          form={f1}
          eff={eff1}
          adjMult={adjMult}
          costEff={costEff1}
        />
        <DosingCard
          label="Вещество 2"
          accent="#60a5fa"
          subId={sub2Id}
          onChangeSub={v => { setSub2Id(v); setForm2Idx(0); }}
          formIdx={form2Idx}
          onChangeForm={setForm2Idx}
          dose={dose2}
          onChangeDose={setDose2}
          catalogOpts={catalogOpts}
          formOpts={formOpts2}
          forms={sub2?.forms || []}
          form={f2}
          eff={eff2}
          adjMult={adjMult}
          costEff={costEff2}
        />
      </div>

      {/* ─── Comparison section ─── */}
      {f1 && f2 && eff1.absorbed > 0 && eff2.absorbed > 0 && (
        <div style={{
          ...S.card, borderColor: 'rgba(167,139,250,0.25)',
          background: 'rgba(167,139,250,0.04)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 6, letterSpacing: '-0.2px' }}>
            ⚖️ Сравнение
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Substance 1 result */}
            <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#00e68a', marginBottom: 2 }}>{f1.nameRu}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>{eff1.absorbed}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}> мг</span></div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>{(f1.bioavailability * 100).toFixed(0)}%</div>
              <div style={{
                marginTop: 2, padding: '1px 5px', borderRadius: 3, fontSize: 6, display: 'inline-block',
                background: eff1.status.includes('терапевтическом') ? 'rgba(34,197,94,0.12)' : eff1.status.includes('Ниже') ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                color: eff1.status.includes('терапевтическом') ? '#22c55e' : eff1.status.includes('Ниже') ? '#f59e0b' : '#ef4444',
              }}>
                {dose1} мг {dose1 < (DOSE_RANGES[Object.keys(DOSE_RANGES).find(k => sub1Id.toLowerCase().includes(k)) || '']?.therMin ?? 0) ? '⬆' : dose1 > (DOSE_RANGES[Object.keys(DOSE_RANGES).find(k => sub1Id.toLowerCase().includes(k)) || '']?.therMax ?? 9999) ? '⬇' : '✓'}
              </div>
            </div>

            {/* VS */}
            <div style={{ textAlign: 'center', padding: '0 4px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>VS</div>
              <div style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700, marginTop: 2 }}>
                {(() => {
                  const ratio = eff1.absorbed / eff2.absorbed;
                  if (ratio > 1.05) return '+' + ((ratio - 1) * 100).toFixed(0) + '%';
                  if (ratio < 0.95) return '-' + ((1 - ratio) * 100).toFixed(0) + '%';
                  return '≈';
                })()}
              </div>
            </div>

            {/* Substance 2 result */}
            <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: 8, borderRadius: 8, background: 'rgba(96,165,250,0.06)' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#60a5fa', marginBottom: 2 }}>{f2.nameRu}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{eff2.absorbed}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}> мг</span></div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>{(f2.bioavailability * 100).toFixed(0)}%</div>
              <div style={{
                marginTop: 2, padding: '1px 5px', borderRadius: 3, fontSize: 6, display: 'inline-block',
                background: eff2.status.includes('терапевтическом') ? 'rgba(34,197,94,0.12)' : eff2.status.includes('Ниже') ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                color: eff2.status.includes('терапевтическом') ? '#22c55e' : eff2.status.includes('Ниже') ? '#f59e0b' : '#ef4444',
              }}>
                {dose2} мг {dose2 < (DOSE_RANGES[Object.keys(DOSE_RANGES).find(k => sub2Id.toLowerCase().includes(k)) || '']?.therMin ?? 0) ? '⬆' : dose2 > (DOSE_RANGES[Object.keys(DOSE_RANGES).find(k => sub2Id.toLowerCase().includes(k)) || '']?.therMax ?? 9999) ? '⬇' : '✓'}
              </div>
            </div>
          </div>

          {/* Comparison text */}
          <div style={{
            marginTop: 6, padding: '6px 10px', borderRadius: 6, fontSize: 8, textAlign: 'center',
            background: 'rgba(167,139,250,0.06)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4,
          }}>
            {eff1.absorbed > eff2.absorbed
              ? f1.nameRu + ' эффективнее ' + f2.nameRu + ' в ' + (eff1.absorbed / eff2.absorbed).toFixed(2) + '× (' + f1.nameRu + ' ' + eff1.absorbed + ' мг vs ' + f2.nameRu + ' ' + eff2.absorbed + ' мг)'
              : eff2.absorbed > eff1.absorbed
                ? f2.nameRu + ' эффективнее ' + f1.nameRu + ' в ' + (eff2.absorbed / eff1.absorbed).toFixed(2) + '×'
                : 'Оба вещества дают одинаковую усвоенную дозу'}
            {adjMult < 1 && ' с поправкой ×' + adjMult.toFixed(2)}
          </div>
        </div>
      )}

      {/* ─── Single-substance therapeutic summary ─── */}
      {f1 && !f2 && eff1.absorbed > 0 && (
        <div style={{ ...S.card, borderColor: 'rgba(34,197,94,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Вещество</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a' }}>{f1.nameRu}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                {dose1} мг × {(f1.bioavailability * 100).toFixed(0)}% = {eff1.absorbed} мг усвоено
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Биодоступность</div>
              <div style={{
                fontSize: 16, fontWeight: 800,
                color: bioColor(f1.bioavailability),
              }}>
                {(f1.bioavailability * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          {eff1.status && (
            <div style={{
              marginTop: 4, padding: '4px 8px', borderRadius: 5, fontSize: 7, textAlign: 'center',
              background: eff1.status.includes('терапевтическом') ? 'rgba(34,197,94,0.08)' : eff1.status.includes('Ниже') ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
              color: eff1.status.includes('терапевтическом') ? '#22c55e' : eff1.status.includes('Ниже') ? '#f59e0b' : '#ef4444',
            }}>
              {eff1.status}
            </div>
          )}
        </div>
      )}

      {/* ─── Personal adjusters as PopupBool cards ─── */}
      <div style={{ ...S.cardPink }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f44336', marginBottom: 6, letterSpacing: '-0.2px' }}>
          🧬 Персонализированная коррекция
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.3 }}>
          Включите факторы, снижающие всасывание. Каждый добавляет множитель к усвоенной дозе.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {Object.entries(PERSONAL_ADJUSTERS).map(([key, adj]) => {
            const active = activeAdjusters.includes(key);
            return (
              <PopupBool key={key} label={adj.label + ' ×' + adj.mult.toFixed(2)}
                value={active}
                onChange={() => toggleAdjuster(key)} />
            );
          })}
        </div>
        {activeAdjusters.length > 0 && (
          <div style={{
            marginTop: 6, padding: '6px 10px', borderRadius: 6, textAlign: 'center',
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
          }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Суммарный множитель: </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f44336' }}>×{adjMult.toFixed(2)}</span>
            {adjMult < 0.7 && (
              <div style={{ fontSize: 7, color: '#ff9800', marginTop: 2 }}>
                Сильная коррекция — рассмотрите смену формы или дополнительную поддержку
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Loading protocols (collapsible) ─── */}
      <div style={{ ...S.cardBlue, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -20, left: -20, width: 60, height: 60, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.08), transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4, letterSpacing: '-0.2px' }}>
          📈 Протоколы загрузочной фазы
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.3 }}>
          Для веществ, требующих насыщения тканевых депо перед поддерживающей дозой:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {([
            { what: 'Креатин', loading: '20 г/день 5-7 дней', main: '3-5 г/день' },
            { what: 'Коэнзим Q10', loading: '200-400 мг/день 2-4 нед', main: '100-200 мг/день' },
            { what: 'Витамин D3', loading: '5000-10000 МЕ/день 4-8 нед', main: '1000-4000 МЕ/день' },
            { what: 'Магний (тяжёлый дефицит)', loading: '400-800 мг/день 4 нед', main: '300-400 мг/день' },
            { what: 'Железо (дефицит)', loading: '100-200 мг/день 3 мес', main: '18-27 мг/день' },
            { what: 'B12 (дефицит)', loading: '1000 мкг/день 4-8 нед', main: '500-1000 мкг/день' },
          ] as const).map((p, i) => (
            <div key={i} style={{
              padding: '5px 8px', borderRadius: 6,
              background: i % 2 === 0 ? 'rgba(59,130,246,0.03)' : 'rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-light)' }}>{p.what}</div>
              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>
                Насыщение: {p.loading} → Поддержка: {p.main}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Therapeutic windows reference ─── */}
      <div style={{ ...S.card, borderColor: 'rgba(167,139,250,0.08)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4, letterSpacing: '-0.2px' }}>
          📖 Справочник терапевтических диапазонов
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.3 }}>
          Клинически установленные пероральные дозы для ключевых веществ (нескорректированные):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {Object.entries(DOSE_RANGES).slice(0, 12).map(([key, r]) => (
            <div key={key} style={{
              padding: '3px 6px', borderRadius: 4, fontSize: 7,
              background: 'rgba(167,139,250,0.03)', color: 'var(--text-dim)',
            }}>
              <span style={{ color: 'var(--text-light)', fontWeight: 600 }}>{r.label}:</span>
              {' '}{r.therMin}–{r.therMax} мг
            </div>
          ))}
        </div>
        <div style={{ fontSize: 7, color: 'rgba(167,139,250,0.4)', marginTop: 4, lineHeight: 1.4 }}>
          * Диапазоны указаны для стандартного перорального приёма. Биодоступность формы может существенно менять усвоенную дозу.
          Ориентируйтесь на oral-диапазон как на клинический стандарт.
        </div>
      </div>
    </div>
  );
};

export default SupportEffectiveDose;
