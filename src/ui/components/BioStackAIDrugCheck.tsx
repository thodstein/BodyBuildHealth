// BioStackAIDrugCheck.tsx — детальная проверка лекарственных взаимодействий
import React, { useState, useMemo } from 'react';
import { type BioStackProfile, saveBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';
import { GlassCard, PillBtn, showToast } from './BioStackAIConstants';
import { findInteractionsForId, resolveInteractionId } from '../../data/support-interactions-db';
import { expandDrug } from '../../engines/biostack-safety.engine';

const CYP_LABELS: Record<string, string> = {
  unknown:'❓ Неизвестен', normal:'🟢 Нормальный (EM)', poor:'🔴 Медленный (PM)',
  intermediate:'🟡 Промежуточный (IM)', rapid:'🔵 Быстрый (RM)',
};
const CYP_DETAILS: Record<string, string> = {
  unknown:'Стандартные дозировки. Для точной настройки — фармакогенетическое тестирование.',
  normal:'Стандартный метаболизм через CYP450.',
  poor:'Риск токсичности: дозы субстратов CYP снизить в 2-4 раза. Особое внимание — CYP2D6, CYP2C19, CYP3A4.',
  intermediate:'Умеренное снижение метаболизма. Начинать с 50% дозы, титровать.',
  rapid:'Ускоренный метаболизм: возможны более высокие дозы. Пролекарства → риск токсичных метаболитов.',
};

const DRUG_RISK_NOTES: Record<string, [string, string]> = {
  иапф:['ren','Гемодинамика почек (креатинин ↑)'],
  рамиприл:['ren','Гемодинамика почек (креатинин ↑)'],
  эналаприл:['ren','Гемодинамика почек (креатинин ↑)'],
  ара:['ren','Нефропротекция'],
  лозартан:['ren','Нефропротекция'],
  валсартан:['ren','Нефропротекция'],
  бисопролол:['cv','ЧСС ↓ — защита, блокада β₂'],
  метопролол:['cv','ЧСС ↓ — защита, блокада β₂'],
  небиволол:['cv','ЧСС ↓ + NO-модуляция ✓'],
  амлодипин:['cv','Снижение АД, антиангинальный'],
  фуросемид:['ren','Водно-электролитные сдвиги'],
  гидрохлоротиазид:['ren','Водно-электролитные сдвиги'],
  эсциталопрам:['cns','↑ Серотонин, риск серотонинового синдрома'],
  флуоксетин:['cns','↑ Серотонин, риск серотонинового синдрома'],
  аторвастатин:['liv','↑ Трансаминаз'],
  розувастатин:['liv','↑ Трансаминаз'],
  ибупрофен:['ren','↓ Почечный кровоток'],
  диклофенак:['ren','↓ Почечный кровоток'],
  метформин:['hem','↓ Инсулинорезистентность'],
  преднизолон:['hem','Инсулинорезистентность'],
  дексаметазон:['hem','Инсулинорезистентность'],
  варфарин:['hem','Геморрагический риск'],
  апиксабан:['hem','Геморрагический риск'],
};

const SYS_ICONS: Record<string, string> = { cv:'❤️', liv:'🫁', ren:'🫘', cns:'🧠', rep:'🧬', hem:'🩸' };

type CheckResult = { drug: string; substance: string; effect: string; severity: string; mechanism: string };

export function DrugCheckTab({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [medInput, setMedInput] = useState(profile.currentMeds.join(', '));
  const [allergyInput, setAllergyInput] = useState(profile.drugAllergies.join(', '));
  const [cypState, setCypState] = useState('unknown');
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [checkMode, setCheckMode] = useState<'stack' | 'catalog'>('stack');

  const catalogSearch = useMemo(() => {
    if (checkMode !== 'catalog') return null;
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) return null;
    const found: CheckResult[] = [];
    for (const drug of drugs) {
      const drugId = resolveInteractionId(drug);
      const interactions = findInteractionsForId(drugId);
      for (const [id, cat] of Object.entries(SUPPORT_CATALOG_DATA)) {
        for (const inter of interactions) {
          const otherSide = resolveInteractionId(inter.substanceA) === drugId ? inter.substanceB : inter.substanceA;
          if (otherSide.toUpperCase() === id.toUpperCase() || id.toUpperCase().includes(otherSide.toUpperCase()) || otherSide.toUpperCase().includes(id.toUpperCase())) {
            if (inter.type === 'conflict' || inter.type === 'caution') {
              found.push({ drug, substance: cat.nameRu || cat.name || id, effect: inter.effect, severity: inter.severity, mechanism: inter.notes || (inter.mechanisms || []).join('; ') });
            }
          }
        }
      }
    }
    return found;
  }, [medInput, checkMode]);

  const runCheck = () => {
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const allergies = allergyInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) { showToast('Введите хотя бы одно лекарство', 'error'); return; }
    saveBioStackProfile({ ...profile, currentMeds: drugs, drugAllergies: allergies });

    const res: CheckResult[] = [];
    const targetIds = checkMode === 'stack' ? stackIds : Object.keys(SUPPORT_CATALOG_DATA).slice(0, 50);
    for (const drug of drugs) {
      const drugId = resolveInteractionId(drug);
      const interactions = findInteractionsForId(drugId);
      for (const id of targetIds) {
        const cat = SUPPORT_CATALOG_DATA[id];
        if (!cat) continue;
        for (const inter of interactions) {
          const otherSide = resolveInteractionId(inter.substanceA) === drugId ? inter.substanceA : inter.substanceB;
          if (otherSide.toUpperCase() === id.toUpperCase() || id.toUpperCase().includes(otherSide.toUpperCase()) || otherSide.toUpperCase().includes(id.toUpperCase())) {
            if (inter.type === 'conflict' || inter.type === 'caution') {
              res.push({ drug, substance: cat.nameRu || cat.name || id, effect: inter.effect, severity: inter.severity, mechanism: inter.notes || (inter.mechanisms || []).join('; ') });
            }
          }
        }
      }
    }
    for (const allergy of allergies) {
      for (const id of targetIds) {
        const cat = SUPPORT_CATALOG_DATA[id];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        if (subName.includes(allergy) || allergy.includes(id)) {
          res.push({
            drug: allergy, substance: cat.nameRu || cat.name || id,
            effect: '⚠ ВОЗМОЖНА АЛЛЕРГИЧЕСКАЯ РЕАКЦИЯ', severity: 'HIGH',
            mechanism: 'Перекрёстная аллергия',
          });
        }
      }
    }
    if (res.length === 0) res.push({ drug: drugs.join(', '), substance: checkMode === 'stack' ? 'Стек' : 'Каталог', effect: '✅ Клинически значимых взаимодействий не найдено', severity: 'LOW', mechanism: 'Нет данных' });
    setResults(res);
    try {
      const high = res.filter(r => r.severity === 'HIGH');
      localStorage.setItem('he_drug_warnings', JSON.stringify({ date: new Date().toISOString(), count: res.length, highCount: high.length, warnings: high.map(r => `${r.drug} + ${r.substance}`) }));
    } catch {}
  };

  const maxSev = results ? Math.max(...results.map(r => r.severity === 'HIGH' ? 2 : r.severity === 'MEDIUM' ? 1 : 0)) : 0;
  const sevColor = maxSev === 2 ? '#ef4444' : maxSev === 1 ? '#f59e0b' : '#22c55e';
  const sevText = maxSev === 2 ? '🔴 КРИТИЧЕСКИЕ взаимодействия' : maxSev === 1 ? '🟡 УМЕРЕННЫЕ взаимодействия' : '🟢 БЕЗОПАСНО';
  const highCount = results ? results.filter(r => r.severity === 'HIGH').length : 0;
  const medCount = results ? results.filter(r => r.severity === 'MEDIUM').length : 0;

  // Drug → system risk
  const drugRiskEntries = useMemo(() => {
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) return [];
    const seen = new Set<string>();
    const out: [string, string, string][] = [];
    for (const d of drugs) {
      for (const [key, [sys, note]] of Object.entries(DRUG_RISK_NOTES)) {
        if (d.includes(key) && !seen.has(sys)) { seen.add(sys); out.push([sys, SYS_ICONS[sys]||'⚪', note]); }
      }
    }
    return out;
  }, [medInput]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="💊 Проверка лекарственных взаимодействий" icon="💊" color="#ef4444">
        <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',marginBottom:10,lineHeight:1.4 }}>
          Введите принимаемые лекарства (МНН через запятую). Система проверит пересечения с вашим стеком БАДов или полным каталогом.
        </div>

        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.6)',marginBottom:4 }}>💊 Лекарства (МНН):</div>
          <textarea value={medInput} onChange={e => setMedInput(e.target.value)}
            placeholder="варфарин, метформин, аторвастатин, рамиприл, эсциталопрам..."
            rows={2} style={{ width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:11,boxSizing:'border-box',resize:'none',fontFamily:'inherit' }} />
        </div>

        <div style={{ display:'flex',gap:8,marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.6)',marginBottom:4 }}>⚠ Аллергии:</div>
            <input value={allergyInput} onChange={e => setAllergyInput(e.target.value)}
              placeholder="пенициллин, сульфаниламиды..."
              style={{ width:'100%',padding:'8px 10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,boxSizing:'border-box' }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.6)',marginBottom:4 }}>🧬 CYP450:</div>
            <select value={cypState} onChange={e => setCypState(e.target.value)}
              style={{ width:'100%',padding:'8px 10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:10,appearance:'none' }}>
              {Object.entries(CYP_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex',gap:6,marginBottom:10 }}>
          <PillBtn active={checkMode==='stack'} onClick={()=>setCheckMode('stack')} color="#60a5fa">📋 Стек ({stackIds.length})</PillBtn>
          <PillBtn active={checkMode==='catalog'} onClick={()=>setCheckMode('catalog')} color="#8b5cf6">📚 Каталог</PillBtn>
        </div>

        <button onClick={runCheck} style={{
          width:'100%',padding:'12px 0',borderRadius:12,cursor:'pointer',fontWeight:800,fontSize:13,
          background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',color:'#fff',marginBottom:8,
        }}>🔍 Проверить взаимодействия</button>

        {checkMode==='catalog' && !results && catalogSearch && catalogSearch.length>0 && (
          <div style={{ padding:'8px 12px',borderRadius:10,background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.12)',marginBottom:6,fontSize:10,color:'#f59e0b' }}>
            ⚡ Найдено {catalogSearch.length} пересечений. Нажмите «Проверить» для деталей.
          </div>
        )}
      </GlassCard>

      {results && (
        <GlassCard title="📊 Результаты проверки" color={sevColor}>
          {/* ── Verdict header ── */}
          <div style={{
            display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:14,marginBottom:10,
            background:`${sevColor}10`,border:`1px solid ${sevColor}25`,
          }}>
            <div style={{ fontSize:36 }}>{maxSev===2?'🛑':maxSev===1?'⚠️':'✅'}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14,fontWeight:800,color:sevColor }}>{sevText}</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2 }}>
                Найдено {results.length}: {highCount} крит., {medCount} умеренных
              </div>
            </div>
          </div>

          {/* ── CYP450 detail ── */}
          {cypState!=='unknown' && (
            <div style={{ padding:'8px 12px',borderRadius:10,background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.12)',marginBottom:10 }}>
              <div style={{ fontSize:11,fontWeight:700,color:'#a78bfa',marginBottom:2 }}>🧬 CYP450: {CYP_LABELS[cypState]}</div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.45)',lineHeight:1.3 }}>{CYP_DETAILS[cypState]}</div>
            </div>
          )}

          {/* ── Drug → system risk summary ── */}
          {drugRiskEntries.length>0 && (
            <div style={{ padding:'10px 14px',borderRadius:10,background:'rgba(245,158,11,0.04)',border:'1px solid rgba(245,158,11,0.1)',marginBottom:10 }}>
              <div style={{ fontSize:11,fontWeight:700,color:'#f59e0b',marginBottom:4 }}>⚠ Влияние лекарств на системы риска</div>
              {drugRiskEntries.map(([sys,icon,note],i) => (
                <div key={i} style={{ display:'flex',gap:6,alignItems:'center',marginBottom:2,fontSize:10,color:'rgba(255,255,255,0.55)' }}>
                  <span>{icon}</span><span>{note}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Results list ── */}
          <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
            {results.map((r,i) => (
              <div key={i} style={{
                padding:'10px 14px',borderRadius:12,
                background: r.severity==='HIGH'?'rgba(239,68,68,0.05)':r.severity==='MEDIUM'?'rgba(245,158,11,0.05)':'rgba(34,197,94,0.05)',
                border:`1px solid ${r.severity==='HIGH'?'rgba(239,68,68,0.15)':r.severity==='MEDIUM'?'rgba(245,158,11,0.15)':'rgba(34,197,94,0.15)'}`,
              }}>
                <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3 }}>
                  <span style={{
                    padding:'3px 8px',borderRadius:6,fontSize:9,fontWeight:700,
                    background: r.severity==='HIGH'?'rgba(239,68,68,0.15)':r.severity==='MEDIUM'?'rgba(245,158,11,0.15)':'rgba(34,197,94,0.1)',
                    color: r.severity==='HIGH'?'#ef4444':r.severity==='MEDIUM'?'#f59e0b':'#22c55e',
                  }}>{r.severity==='HIGH'?'КРИТ':r.severity==='MEDIUM'?'СРЕД':'НИЗ'}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:'#fff' }}>{r.drug}</span>
                  <span style={{ fontSize:10,color:'rgba(255,255,255,0.3)' }}>+</span>
                  <span style={{ fontSize:12,fontWeight:700,color:'#fff' }}>{r.substance}</span>
                </div>
                <div style={{ fontSize:11,color:'rgba(255,255,255,0.7)',lineHeight:1.4,marginBottom:2 }}>{r.effect}</div>
                <div style={{ fontSize:10,color:'#a78bfa' }}>🧬 {r.mechanism}</div>
              </div>
            ))}
          </div>

          {/* ── Clinical advisory ── */}
          {maxSev===2 && (
            <div style={{
              marginTop:10,padding:'12px 16px',borderRadius:12,
              background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',
            }}>
              <div style={{ fontSize:12,fontWeight:800,color:'#fca5a5',marginBottom:4 }}>⚠ КЛИНИЧЕСКАЯ РЕКОМЕНДАЦИЯ</div>
              <div style={{ fontSize:11,color:'#fca5a5',lineHeight:1.5 }}>
                Выявлены высокорисковые взаимодействия. Пожалуйста, проконсультируйтесь с лечащим врачом перед приёмом БАДов.
                Не отменяйте и не меняйте дозировку назначенных лекарств самостоятельно.
              </div>
            </div>
          )}

          <button onClick={() => {
            const txt = results.map(r => `${r.severity==='HIGH'?'🔴':r.severity==='MEDIUM'?'🟡':'🟢'} ${r.drug} + ${r.substance}: ${r.effect}`).join('\n');
            navigator.clipboard.writeText(txt);
            showToast('Скопировано', 'success');
          }} style={{
            width:'100%',padding:'10px 0',borderRadius:10,marginTop:8,cursor:'pointer',fontSize:11,fontWeight:600,
            background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.5)',
          }}>📋 Копировать результат</button>
        </GlassCard>
      )}
    </div>
  );
};
