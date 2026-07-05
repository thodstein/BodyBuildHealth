import React, { useState, useMemo } from 'react';
import { type BioStackProfile, saveBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { LAB_MARKER_MAP } from '../../data/lab-marker-map';
import { GlassCard, PillBtn, showToast, estCost } from './BioStackAIConstants';
import type { LinkedData } from '../../core/data-link';

const CYP450_LABELS: Record<string, string> = {
  unknown: '❓ Неизвестен',
  normal: '🟢 Нормальный (EM)',
  poor: '🔴 Медленный (PM)',
  intermediate: '🟡 Промежуточный (IM)',
  rapid: '🔵 Быстрый (RM)',
};

const CYP_DETAILS: Record<string, string> = {
  unknown: 'Рекомендуется стандартная дозировка. Для точной настройки — фармакогенетическое тестирование.',
  normal: 'Стандартный метаболизм через CYP450. Обычные дозировки.',
  poor: 'Повышен риск токсичности: требуется снижение доз в 2-4 раза для субстратов CYP. Особое внимание — CYP2D6, CYP2C19, CYP3A4.',
  intermediate: 'Умеренное снижение метаболизма. Начинайте с 50% дозы, титруйте под контролем.',
  rapid: 'Ускоренный метаболизм: могут потребоваться более высокие дозы для достижения эффекта. Пролекарства (кодеин, трамадол) → токсичные метаболиты.',
};

// Типовые взаимодействия БАД-лекарство (клинически значимые)
const KNOWN_DRUG_SUP_INTERACTIONS: Array<{ drug: string; substance: string; effect: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; mechanism: string }> = [
  { drug: 'варфарин', substance: 'natto', effect: 'Усиление антикоагуляции, риск кровотечений', severity: 'HIGH', mechanism: 'Синергизм фибринолиза' },
  { drug: 'варфарин', substance: 'vitamin_k2', effect: 'Снижение антикоагуляции', severity: 'HIGH', mechanism: 'Антагонизм витамин К-зависимых факторов' },
  { drug: 'варфарин', substance: 'vitamin_e', effect: 'Усиление антикоагуляции', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект' },
  { drug: 'варфарин', substance: 'omega3', effect: 'Умеренное усиление антикоагуляции', severity: 'MEDIUM', mechanism: 'Снижение агрегации тромбоцитов' },
  { drug: 'клопидогрель', substance: 'omega3', effect: 'Усиление антиагрегантного эффекта', severity: 'MEDIUM', mechanism: 'Синергизм' },
  { drug: 'аспирин', substance: 'omega3', effect: 'Усиление антиагрегантного эффекта', severity: 'MEDIUM', mechanism: 'Синергизм циклооксигеназного пути' },
  { drug: 'аспирин', substance: 'natto', effect: 'Риск кровотечений', severity: 'HIGH', mechanism: 'Двойная антиагрегантная терапия' },
  { drug: 'статины', substance: 'coq10', effect: 'Снижение побочных эффектов статинов (миалгии, миопатии)', severity: 'LOW', mechanism: 'Восполнение CoQ10, снижаемого статинами' },
  { drug: 'статины', substance: 'берберин', effect: 'Дополнительное снижение ЛПНП', severity: 'MEDIUM', mechanism: 'AMPK-активация + снижение синтеза холестерина' },
  { drug: 'статины', substance: 'red_yeast', effect: 'СУММАЦИЯ ТОКСИЧНОСТИ. Гепатотоксичность, рабдомиолиз', severity: 'HIGH', mechanism: 'Дублирование механизма HMG-CoA редуктазы' },
  { drug: 'метформин', substance: 'берберин', effect: 'Гипогликемия, суммация эффекта', severity: 'MEDIUM', mechanism: 'AMPK + снижение глюконеогенеза' },
  { drug: 'метформин', substance: 'alpha_lipoic', effect: 'Синергизм чувствительности к инсулину', severity: 'LOW', mechanism: 'Активация AMPK + Nrf2' },
  { drug: 'метформин', substance: 'b12', effect: 'Метформин снижает всасывание B12 — требуется добавка', severity: 'MEDIUM', mechanism: 'Конкурентное ингибирование IF-зависимого всасывания' },
  { drug: 'левтироксин', substance: 'calcium', effect: 'Снижение всасывания левотироксина (интервал >4ч)', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'magnesium', effect: 'Снижение всасывания левотироксина', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'zinc', effect: 'Снижение всасывания левотироксина', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'антидепрессанты (СИОЗС)', substance: '5htp', effect: 'СЕРОТОНИНОВЫЙ СИНДРОМ (жизнеугрожающее состояние)', severity: 'HIGH', mechanism: 'Суммация серотонинергического эффекта' },
  { drug: 'антидепрессанты (СИОЗС)', substance: 'l_tryptophan', effect: 'Серотониновый синдром, риск', severity: 'HIGH', mechanism: 'Суммация серотонина' },
  { drug: 'антидепрессанты (СИОЗС)', substance: 'saint_johns_wort', effect: 'СЕРОТОНИНОВЫЙ СИНДРОМ. Снижение концентрации СИОЗС', severity: 'HIGH', mechanism: 'Серотонинергическая суммация + индукция CYP3A4/2C9' },
  { drug: 'антидепрессанты (СИОЗС)', substance: 'theanine', effect: 'Потенцирование седативного эффекта', severity: 'LOW', mechanism: 'GABA-ергический синергизм' },
  { drug: 'антидепрессанты (СИОЗС)', substance: 'gaba', effect: 'Усиление седации', severity: 'LOW', mechanism: 'GABA-ергический синергизм' },
  { drug: 'антикоагулянты (ривароксабан)', substance: 'natto', effect: 'Риск кровотечений', severity: 'HIGH', mechanism: 'Синергизм антикоагуляции' },
  { drug: 'антикоагулянты (апиксабан)', substance: 'curcumin', effect: 'Риск кровотечений (высокие дозы >1г/сут)', severity: 'MEDIUM', mechanism: 'Антиагрегантный + антикоагулянтный эффект' },
  { drug: 'антигипертензивные', substance: 'magnesium', effect: 'Синергизм снижения АД', severity: 'LOW', mechanism: 'Вазодилатация + блокада Ca-каналов' },
  { drug: 'антигипертензивные', substance: 'potassium', effect: 'Риск гиперкалиемии при приёме с иАПФ/АРА', severity: 'MEDIUM', mechanism: 'Суммация калия' },
  { drug: 'диуретики (тиазидные)', substance: 'potassium', effect: 'Восполнение калия, профилактика гипокалиемии', severity: 'LOW', mechanism: 'Возмещение потерь K+' },
  { drug: 'диуретики (калийсберегающие)', substance: 'potassium', effect: 'ГИПЕРКАЛИЕМИЯ', severity: 'HIGH', mechanism: 'Суммация калия' },
  { drug: 'НПВС', substance: 'curcumin', effect: 'Дополнительное противовоспалительное, защита ЖКТ', severity: 'LOW', mechanism: 'Ингибирование NF-kB + COX-2' },
  { drug: 'НПВС', substance: 'curcumin', effect: 'Усиление антикоагуляции (высокие дозы)', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект куркумина' },
  { drug: 'циклоспорин', substance: 'curcumin', effect: 'Повышение концентрации циклоспорина', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4 и P-гликопротеина' },
  { drug: 'циклоспорин', substance: 'berberine', effect: 'Повышение концентрации циклоспорина', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4' },
  { drug: 'противоэпилептические', substance: 'folate', effect: 'Дефицит фолата на фоне приёма, требуется добавка', severity: 'MEDIUM', mechanism: 'Антагонизм фолатного цикла' },
  { drug: 'пероральные контрацептивы', substance: 'magnesium', effect: 'Снижение магния на фоне ОК', severity: 'LOW', mechanism: 'Усиление экскреции Mg' },
  { drug: 'пероральные контрацептивы', substance: 'b6', effect: 'Дефицит B6 на фоне ОК', severity: 'LOW', mechanism: 'Ускорение метаболизма B6' },
  { drug: 'глюкокортикоиды', substance: 'calcium', effect: 'Профилактика стероидного остеопороза', severity: 'LOW', mechanism: 'Снижение резорбции кости' },
  { drug: 'глюкокортикоиды', substance: 'vitamin_d3', effect: 'Профилактика стероидного остеопороза', severity: 'LOW', mechanism: 'Абсорбция Ca + минерализация' },
  { drug: 'ингибиторы протонной помпы', substance: 'magnesium', effect: 'Гипомагниемия на фоне ИПП (длительный приём)', severity: 'MEDIUM', mechanism: 'Снижение всасывания Mg' },
  { drug: 'ингибиторы протонной помпы', substance: 'b12', effect: 'Дефицит B12 на фоне ИПП', severity: 'MEDIUM', mechanism: 'Снижение всасывания B12 (↓ кислотность)' },
];

/* ─── DrugCheck card ─── */
export function DrugCheckCard({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [medsInput, setMedsInput] = useState(profile.currentMeds.join(', '));
  const [alergiesInput, setAlergiesInput] = useState(profile.drugAllergies.join(', '));
  const [checkResult, setCheckResult] = useState<Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string; inStack: boolean }> | null>(null);
  const [cypState, setCypState] = useState(profile.cyp450Status);

  const check = () => {
    const drugs = medsInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const allergies = alergiesInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) { showToast('Введите хотя бы одно лекарство', 'error'); return; }

    // Save to profile
    saveBioStackProfile({ ...profile, currentMeds: drugs, drugAllergies: allergies, cyp450Status: cypState });

    // Check interactions
    const results: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string; inStack: boolean }> = [];
    for (const drug of drugs) {
      for (const sub of stackIds) {
        const cat = SUPPORT_CATALOG_DATA[sub];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || sub).toLowerCase();
        // Direct match in known interactions
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          (drug.includes(k.drug) || k.drug.includes(drug)) &&
          (subName.includes(k.substance) || k.substance.includes(sub))
        );
        if (direct.length > 0) {
          direct.forEach(d => results.push({ ...d, inStack: true }));
        }
        // Check ALL_INTERACTIONS for drug-like substances
        const fromAll = ALL_INTERACTIONS.filter((i: any) =>
          (i.substanceA?.toLowerCase?.() === sub || i.substanceB?.toLowerCase?.() === sub) &&
          (i.substanceA?.toLowerCase?.().includes(drug) || i.substanceB?.toLowerCase?.().includes(drug))
        );
        if (fromAll.length > 0) {
          fromAll.forEach(i => results.push({
            drug, substance: subName,
            effect: i.effect || 'Взаимодействие', severity: i.severity || 'MEDIUM',
            mechanism: (i as any).mechanism || i.mechanisms?.join(', ') || '',
            inStack: true,
          }));
        }
      }
    }

    // Allergy check
    for (const allergy of allergies) {
      for (const sub of stackIds) {
        const cat = SUPPORT_CATALOG_DATA[sub];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || sub).toLowerCase();
        if (subName.includes(allergy) || allergy.includes(sub)) {
          results.push({
            drug: allergy, substance: subName,
            effect: '⚠ ВОЗМОЖНА АЛЛЕРГИЧЕСКАЯ РЕАКЦИЯ', severity: 'HIGH',
            mechanism: 'Перекрёстная аллергия / известная гиперчувствительность', inStack: true,
          });
        }
      }
    }

    if (results.length === 0) {
      results.push({
        drug: drugs[0], substance: stackIds.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || id).join(', '),
        effect: '✅ В известной базе взаимодействий не найдено. Рекомендуется контроль врача.',
        severity: 'LOW', mechanism: 'Нет известных данных о клинически значимых взаимодействиях', inStack: true,
      });
    }
    setCheckResult(results);
  };

  const maxSev = checkResult ? Math.max(...checkResult.map(r => r.severity === 'HIGH' ? 2 : r.severity === 'MEDIUM' ? 1 : 0)) : 0;
  const overallColor = maxSev === 2 ? '#ef4444' : maxSev === 1 ? '#f59e0b' : '#22c55e';
  const overallText = maxSev === 2 ? '🔴 Критические взаимодействия' : maxSev === 1 ? '🟡 Умеренные взаимодействия' : '🟢 Безопасно';

  return (
    <GlassCard title="💊 Проверка лекарственных взаимодействий" icon="💊" color="#ef4444">
      {profile.currentMeds.length === 0 && (
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginBottom: 6, lineHeight: 1.3 }}>
          🔬 Введите названия принимаемых лекарств (МНН через запятую). Система проверит пересечения с вашим стеком БАДов.
        </div>
      )}
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>💊 Рецептурные лекарства (МНН, через запятую):</label>
        <textarea value={medsInput} onChange={e => setMedsInput(e.target.value)}
          placeholder="варфарин, метформин, рамиприл, аторвастатин, эсциталопрам..."
          rows={2}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 10, boxSizing: 'border-box', resize: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>⚠ Лекарственные аллергии:</label>
          <input value={alergiesInput} onChange={e => setAlergiesInput(e.target.value)} placeholder="пенициллин, сульфаниламиды..."
            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, boxSizing: 'border-box' }} />
        </div>
        <select value={cypState} onChange={e => { setCypState(e.target.value); saveBioStackProfile({ ...profile, cyp450Status: e.target.value }); }}
          style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, appearance: 'none' }}>
          {Object.entries(CYP450_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <button onClick={check} style={{
        width: '100%', padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11,
        background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', marginBottom: 8,
      }}>🔍 Проверить взаимодействия</button>

      {checkResult && (
        <div>
          <div style={{
            padding: '8px 10px', borderRadius: 8, marginBottom: 8,
            background: `${overallColor}08`, border: `1px solid ${overallColor}20`,
            fontSize: 9, fontWeight: 700, color: overallColor, textAlign: 'center',
          }}>{overallText} ({checkResult.length} находок)</div>

          {cypState !== 'unknown' && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>🧬 CYP450: {CYP450_LABELS[cypState]}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{CYP_DETAILS[cypState]}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {checkResult.map((r, i) => (
              <div key={i} style={{
                padding: '7px 9px', borderRadius: 8,
                background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${r.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.15)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                      color: r.severity === 'HIGH' ? '#ef4444' : r.severity === 'MEDIUM' ? '#f59e0b' : '#22c55e',
                    }}>{r.severity === 'HIGH' ? '🔴 ВЫСОКИЙ' : r.severity === 'MEDIUM' ? '🟡 СРЕДНИЙ' : '🟢 НИЗКИЙ'}</span>
                  </div>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{r.drug} + {r.substance}</span>
                </div>
                <div style={{ fontSize: 8, color: '#fff', lineHeight: 1.3 }}>{r.effect}</div>
                <div style={{ fontSize: 7, color: '#a78bfa', lineHeight: 1.2, marginTop: 1 }}>🧬 {r.mechanism}</div>
              </div>
            ))}
          </div>

          {maxSev === 2 && (
            <div style={{
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              fontSize: 9, color: '#fca5a5', lineHeight: 1.4,
            }}>
              ⚠ КЛИНИЧЕСКАЯ РЕКОМЕНДАЦИЯ: Обнаружены высокорисковые взаимодействия лекарств с БАДами.
              Рекомендуется консультация врача для коррекции терапии. Не отменяйте назначенные лекарства самостоятельно.
            </div>
          )}
          {cypState !== 'unknown' && cypState !== 'normal' && (
            <div style={{
              marginTop: 8, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)',
              fontSize: 9, color: '#fcd34d', lineHeight: 1.4,
            }}>
              ⚠ ФАРМАКОГЕНЕТИКА: Ваш CYP450 статус ({cypState}) требует индивидуального подбора доз.
              Учитывайте это при назначении новых препаратов.
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

/* ─── LabInterpretation card ─── */
export function LabInterpretationCard({ linked }: { linked?: LinkedData | null }) {
  const labs = linked?.labAnalysis;
  const [showAll, setShowAll] = useState(false);

  const deviations = useMemo(() => {
    if (!labs?.interpretations) return [];
    return labs.interpretations
      .filter(i => i.status === 'high' || i.status === 'critical_high' || i.status === 'low')
      .map(i => {
        const marker = LAB_MARKER_MAP.find(m =>
          m.marker.toLowerCase() === i.code.toLowerCase() ||
          m.name.toLowerCase() === i.code.toLowerCase() ||
          m.name.toLowerCase().includes(i.code.toLowerCase())
        );
        const suggestions: string[] = [];
        if (marker) {
          marker.mechanisms.forEach(m => {
            const found = Object.entries(SUPPORT_CATALOG_DATA).filter(([_, v]) =>
              (v.mechanisms || []).includes(m) && v.tier !== 'specialty'
            );
            found.slice(0, 2).forEach(([id]) => {
              const name = SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id;
              if (!suggestions.includes(name)) suggestions.push(name);
            });
          });
        }
        // Generic suggestions by organ
        if (i.code.toLowerCase().includes('alt') || i.code.toLowerCase().includes('ast') || i.code.toLowerCase().includes('ggt')) {
          if (!suggestions.length) suggestions.push('NAC', 'Расторопша', 'TUDCA');
        }
        if (i.code.toLowerCase().includes('glucose') || i.code.toLowerCase().includes('hba1c')) {
          if (!suggestions.length) suggestions.push('Берберин', 'Альфа-липоевая кислота', 'Хром');
        }
        if (i.code.toLowerCase().includes('creatinine') || i.code.toLowerCase().includes('urea')) {
          if (!suggestions.length) suggestions.push('Астрагал', 'Кордицепс');
        }
        if (i.code.toLowerCase().includes('ldl') || i.code.toLowerCase().includes('cholesterol')) {
          if (!suggestions.length) suggestions.push('Омега-3', 'Берберин', 'Красный рис');
        }
        if (i.code.toLowerCase().includes('crp') || i.code.toLowerCase().includes('esr')) {
          if (!suggestions.length) suggestions.push('Куркумин', 'Омега-3', 'Бромелайн');
        }
        return {
          code: i.code, name: marker?.name || i.code, value: i.value || '',
          status: i.status, ref: marker ? `${marker.defaultValue} ${marker.unit}` : '',
          suggestions: suggestions.slice(0, 4),
        };
      });
  }, [labs]);

  if (!labs || deviations.length === 0) {
    return (
      <GlassCard title="🧪 Анализы → БАДы" icon="🧪" color="#a78bfa">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '10px 0' }}>
          {labs ? '✅ Все показатели в норме' : '🔬 Внесите анализы в Лабораторию для интерпретации'}
        </div>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
          Система подберёт БАДы для коррекции отклонений
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard title={`🧪 Анализы → БАДы (${deviations.length} отклонений)`} icon="🧪" color="#a78bfa">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(showAll ? deviations : deviations.slice(0, 4)).map((d, i) => (
          <div key={i} style={{
            padding: '7px 9px', borderRadius: 8,
            background: d.status.includes('critical') ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${d.status.includes('critical') ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{d.name}</span>
              <span style={{
                fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                background: d.status.includes('critical') ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                color: d.status.includes('critical') ? '#ef4444' : '#f59e0b',
              }}>{d.status.includes('critical') ? '🔴 Крит.' : '🟡 Откл.'}</span>
            </div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>
              Значение: {d.value} | Норма: {d.ref}
            </div>
            {d.suggestions.length > 0 && (
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {d.suggestions.map((s, si) => (
                  <span key={si} style={{ padding: '1px 5px', borderRadius: 4, fontSize: 6, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)', color: '#00e68a' }}>
                    +{s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {deviations.length > 4 && (
        <button onClick={() => setShowAll(!showAll)} style={{
          width: '100%', padding: '6px 0', borderRadius: 8, marginTop: 6, cursor: 'pointer', fontSize: 8, fontWeight: 600,
          background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.1)', color: '#a78bfa',
        }}>{showAll ? '🔼 Свернуть' : `📋 Показать все (${deviations.length})`}</button>
      )}
    </GlassCard>
  );
}

/* ─── ClinicalNote card (Patient Summary) ─── */
export function ClinicalNoteCard({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [mode, setMode] = useState<'summary' | 'doctor' | 'schedule'>('summary');

  const note = useMemo(() => {
    if (mode === 'summary') {
      const lines: string[] = [];
      const goalLabel = (g: string) => {
        const map: Record<string, string> = {
          muscle_gain:'рост мышечной массы', fat_loss:'снижение жировой массы',
          endurance:'выносливость', sleep:'качество сна', recovery:'восстановление',
          energy:'энергия', libido:'либидо', concentration:'фокус', brain:'когнитивные функции',
          mood:'настроение', stress:'стресс', cardio_health:'здоровье ССС',
          immunity:'иммунитет', hormones:'гормональный баланс', joints:'суставы',
          digestion:'пищеварение', detox:'детоксикация', longevity:'долголетие',
          liver_health:'здоровье печени', kidney:'здоровье почек', skin:'кожа', hair:'волосы',
        };
        return map[g] || g;
      };
      lines.push(`📋 **Клиническая сводка**`);
      lines.push(`Пациент: ${profile.sex === 'male' ? '♂' : '♀'} ${profile.age} лет, ${profile.weight} кг, ${profile.height} см`);
      lines.push(`Уровень: ${profile.experience === 'beginner' ? 'Начинающий' : profile.experience === 'intermediate' ? 'Средний' : 'Продвинутый'}`);
      if (profile.healthConditions.length > 0) {
        const condMap: Record<string, string> = { liver:'заболевания печени', kidney:'заболевания почек', heart:'заболевания ССС', thyroid:'заболевания ЩЖ', stomach:'заболевания ЖКТ', pressure_high:'гипертония', pressure_low:'гипотония', diabetes:'сахарный диабет', autoimmune:'аутоиммунные заболевания' };
        lines.push(`Состояния: ${profile.healthConditions.map(h => condMap[h] || h).join(', ')}`);
      }
      if (profile.goals.length > 0) lines.push(`Цели: ${profile.goals.map(g => goalLabel(g)).join(', ')}`);
      if (profile.currentMeds.length > 0) lines.push(`Лекарства: ${profile.currentMeds.join(', ')}`);
      if (profile.drugAllergies.length > 0) lines.push(`Аллергии: ${profile.drugAllergies.join(', ')}`);
      if (profile.familyHistory.length > 0) lines.push(`Сем. анамнез: ${profile.familyHistory.join(', ')}`);
      lines.push(`ААС: ${profile.aasStatus === 'none' ? 'Нет' : profile.aasStatus}`);
      lines.push(`Образ жизни: ${profile.dietType === 'mixed' ? 'Смешанное питание' : profile.dietType}, ${profile.smoke ? 'курит' : 'не курит'}, алкоголь: ${profile.alcoholLevel === 'none' ? 'не употребляет' : profile.alcoholLevel === 'rare' ? 'редко' : profile.alcoholLevel === 'moderate' ? 'умеренно' : 'часто'}`);
      lines.push(`CYP450 статус: ${CYP450_LABELS[profile.cyp450Status] || 'Неизвестен'}`);
      lines.push(`---`);
      lines.push(`**Текущий стек БАДов (${stackIds.length} веществ):**`);
      stackIds.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id} (${c.tier || 'standard'})`);
      });
      if (stackIds.length === 0) lines.push('(стек не собран)');
      lines.push(`---`);
      lines.push(`**Ориентировочная стоимость/мес:** ${stackIds.reduce((s, id) => s + estCost(id), 0).toLocaleString()} ₽`);
      lines.push(`**Рекомендация:** Перед началом приёма БАДов проконсультируйтесь с врачом. При появлении побочных эффектов — отмените приём.`);
      return lines.join('\n');
    }

    if (mode === 'doctor') {
      const lines: string[] = [];
      lines.push(`**ВРАЧЕБНОЕ ЗАКЛЮЧЕНИЕ ПО СТЕКУ БАД**`);
      lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
      lines.push(`Пациент: ${profile.sex === 'male' ? 'Мужчина' : 'Женщина'}, ${profile.age} лет`);
      lines.push(`---`);
      lines.push(`**Анамнез:** ${profile.healthConditions.length > 0 ? profile.healthConditions.join(', ') : 'без особенностей'}`);
      if (profile.familyHistory.length > 0) lines.push(`Семейный анамнез: ${profile.familyHistory.join(', ')}`);
      lines.push(`**Текущая терапия:** ${profile.currentMeds.length > 0 ? profile.currentMeds.join(', ') : 'не принимает'}`);
      lines.push(`**Аллергоанамнез:** ${profile.drugAllergies.length > 0 ? profile.drugAllergies.join(', ') : 'не отягощён'}`);
      lines.push(`---`);
      lines.push(`**Состав стека (${stackIds.length} веществ):**`);
      stackIds.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) {
          lines.push(`- **${c.nameRu || c.name || id}**`);
          if (c.description) lines.push(`  Описание: ${c.description.slice(0, 100)}`);
          if (c.forms && c.forms.length > 0) {
            const best = c.forms.find(d => d.best) || c.forms[0];
            lines.push(`  Форма: ${best.nameRu || best.name || ''} ${best.dose || ''}`);
          }
          if (c.contraindications && c.contraindications.length > 0) {
            lines.push(`  Противопоказания: ${c.contraindications.slice(0, 2).join('; ')}`);
          }
        }
      });
      lines.push(`---`);
      lines.push(`**Заключение:**`);
      if (profile.currentMeds.length > 0) {
        lines.push(`⚠ Пациент принимает рецептурные препараты. Требуется оценка лекарственных взаимодействий.`);
      }
      if (profile.healthConditions.length > 0) {
        lines.push(`⚠ Имеются хронические заболевания. Необходим контроль профильных маркеров.`);
      }
      lines.push(`Рекомендован контроль лабораторных показателей (АЛТ, АСТ, ГГТ, креатинин, липидограмма) через 4 недели после начала приёма.`);
      lines.push(`При появлении нежелательных явлений — отмена БАДов и консультация врача.`);
      return lines.join('\n');
    }

    if (mode === 'schedule') {
      const lines: string[] = [];
      lines.push(`**📅 РАСПИСАНИЕ ПРИЁМА БАД**`);
      lines.push(`Сгенерировано: ${new Date().toLocaleDateString('ru-RU')}`);
      lines.push(`Пациент: ${profile.age} лет, ${profile.sex === 'male' ? '♂' : '♀'}`);
      lines.push(`Хронотип: ${profile.chronotype === 'lark' ? '🌅 Жаворонок' : profile.chronotype === 'owl' ? '🦉 Сова' : '🐦 Смешанный'}`);
      lines.push(`Питание: ${profile.dietType === 'mixed' ? 'Смешанное' : profile.dietType}`);
      lines.push(`---`);
      lines.push(`**🌅 УТРО (с завтраком):**`);
      const morning = ['omega3', 'coq10', 'vitamin_d3', 'zinc', 'selenium', 'curcumin', 'berberine', 'alpha_lipoic'];
      const morningItems = stackIds.filter(id => morning.includes(id) || !['tudca', 'magnesium', 'theanine', 'gaba', 'glycine', 'melatonin', 'ashwagandha', '5htp', 'l_tryptophan'].includes(id)).slice(0, 6);
      morningItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**🌇 ДЕНЬ (обед/полдник):**`);
      const afternoon = ['magnesium', 'vitamin_c', 'b_complex', 'probiotics', 'ashwagandha', 'rhodiola', 'adaptogens'];
      const afternoonItems = stackIds.filter(id => afternoon.includes(id)).slice(0, 4);
      afternoonItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**🌙 ВЕЧЕР (за 1-2ч до сна):**`);
      const evening = ['magnesium', 'theanine', 'gaba', 'glycine', 'melatonin', 'zinc', 'ashwagandha', '5htp', 'l_tryptophan', 'tudca', 'nac'];
      const eveningItems = stackIds.filter(id => evening.includes(id) || id.includes('sleep') || id.includes('relax') || id.includes('ashwa') || id.includes('gaba') || id.includes('glycine') || id.includes('melaton') || id.includes('5htp')).slice(0, 5);
      eveningItems.forEach(id => {
        const c = SUPPORT_CATALOG_DATA[id];
        if (c) lines.push(`- ${c.nameRu || c.name || id}`);
      });
      lines.push(`---`);
      lines.push(`**💧 Режим воды:** 30 мл/кг веса (${(profile.weight * 0.03).toFixed(1)} л/сут)`);
      lines.push(`**⚠ Важно:** БАДы не заменяют полноценное питание и лекарства. Интервал между приёмом лекарств и БАДов — минимум 2 часа.`);
      return lines.join('\n');
    }
    return '';
  }, [profile, stackIds, mode]);

  return (
    <GlassCard title={`📄 Клиническая справка`} icon="📄" color="#60a5fa">
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['summary', 'doctor', 'schedule'] as const).map(m => (
          <PillBtn key={m} active={mode === m} onClick={() => setMode(m)} color="#60a5fa">
            {m === 'summary' ? '📋 Сводка' : m === 'doctor' ? '👨‍⚕️ Врачу' : '📅 Расписание'}
          </PillBtn>
        ))}
      </div>
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
        fontFamily: 'monospace', maxHeight: 300, overflowY: 'auto',
      }}>
        {note}
      </div>
      <button onClick={() => { navigator.clipboard.writeText(note); showToast('Скопировано', 'success'); }} style={{
        width: '100%', padding: '8px 0', borderRadius: 8, marginTop: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700,
        background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa',
      }}>📋 Копировать текст</button>
    </GlassCard>
  );
}

/* ─── Main ClinicalTab (объединяет DrugCheck + LabInterpretation + ClinicalNote) ─── */
export function ClinicalTab({ profile, setProfile, stackIds, linked }: {
  profile: BioStackProfile; setProfile: (p: BioStackProfile) => void; stackIds: string[]; linked?: LinkedData;
}) {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 8, lineHeight: 1.3, textAlign: 'center' }}>
        🏥 Клинический блок — лекарственные взаимодействия, интерпретация анализов, заключение врача
      </div>
      <DrugCheckCard profile={profile} stackIds={stackIds} />
      <LabInterpretationCard linked={linked} />
      <ClinicalNoteCard profile={profile} stackIds={stackIds} />
    </div>
  );
}
