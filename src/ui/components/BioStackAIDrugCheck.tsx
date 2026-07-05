import React, { useState, useMemo } from 'react';
import { type BioStackProfile, saveBioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../../data/support-database';
import { GlassCard, PillBtn, showToast, estCost } from './BioStackAIConstants';

/* ─── Clinical known interactions (drug-supplement) ─── */
const KNOWN_DRUG_SUP_INTERACTIONS: Array<{ drug: string; substance: string; effect: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; mechanism: string }> = [
  { drug: 'варфарин', substance: 'natto', effect: 'Усиление антикоагуляции, риск кровотечений', severity: 'HIGH', mechanism: 'Синергизм фибринолиза' },
  { drug: 'варфарин', substance: 'vitamin_k2', effect: 'Снижение антикоагуляции', severity: 'HIGH', mechanism: 'Антагонизм витамин К-зависимых факторов' },
  { drug: 'варфарин', substance: 'vitamin_e', effect: 'Усиление антикоагуляции', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект' },
  { drug: 'варфарин', substance: 'omega3', effect: 'Умеренное усиление антикоагуляции', severity: 'MEDIUM', mechanism: 'Снижение агрегации тромбоцитов' },
  { drug: 'аспирин', substance: 'omega3', effect: 'Усиление антиагрегантного эффекта', severity: 'MEDIUM', mechanism: 'Синергизм циклооксигеназного пути' },
  { drug: 'аспирин', substance: 'natto', effect: 'Риск кровотечений', severity: 'HIGH', mechanism: 'Двойная антиагрегантная терапия' },
  { drug: 'статины', substance: 'coq10', effect: 'Снижение миалгий и миопатии от статинов', severity: 'LOW', mechanism: 'Восполнение CoQ10, подавляемого статинами' },
  { drug: 'статины', substance: 'берберин', effect: 'Дополнительное снижение ЛПНП (аддитивный эффект)', severity: 'MEDIUM', mechanism: 'AMPK + снижение синтеза холестерина' },
  { drug: 'статины', substance: 'red_yeast', effect: 'СУММАЦИЯ ТОКСИЧНОСТИ: риск гепатотоксичности и рабдомиолиза', severity: 'HIGH', mechanism: 'Дублирование ингибирования HMG-CoA редуктазы' },
  { drug: 'метформин', substance: 'берберин', effect: 'Гипогликемия, суммация сахароснижающего эффекта', severity: 'MEDIUM', mechanism: 'Активация AMPK + снижение глюконеогенеза' },
  { drug: 'метформин', substance: 'b12', effect: 'Метформин снижает всасывание витамина B12', severity: 'MEDIUM', mechanism: 'Конкурентное ингибирование IF-зависимого всасывания' },
  { drug: 'метформин', substance: 'alpha_lipoic', effect: 'Улучшение чувствительности к инсулину', severity: 'LOW', mechanism: 'Активация AMPK + Nrf2' },
  { drug: 'левтироксин', substance: 'calcium', effect: 'Снижение всасывания левотироксина (интервал >4ч)', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'magnesium', effect: 'Снижение всасывания левотироксина', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'левтироксин', substance: 'zinc', effect: 'Снижение всасывания левотироксина', severity: 'MEDIUM', mechanism: 'Хелатирование в ЖКТ' },
  { drug: 'антидепрессанты (СИОЗС)', substance: '5htp', effect: 'СЕРОТОНИНОВЫЙ СИНДРОМ (жизнеугрожающее состояние)', severity: 'HIGH', mechanism: 'Суммация серотонинергического эффекта' },
  { drug: 'антидепрессанты (СИОЗС)', substance: 'saint_johns_wort', effect: 'СЕРОТОНИНОВЫЙ СИНДРОМ + снижение концентрации СИОЗС', severity: 'HIGH', mechanism: 'Серотонинергическая суммация + индукция CYP3A4' },
  { drug: 'антидепрессанты (СИОЗС)', substance: 'l_tryptophan', effect: 'Риск серотонинового синдрома', severity: 'HIGH', mechanism: 'Суммация серотонина' },
  { drug: 'антикоагулянты', substance: 'natto', effect: 'Риск кровотечений', severity: 'HIGH', mechanism: 'Синергизм фибринолиза' },
  { drug: 'антикоагулянты', substance: 'curcumin', effect: 'Риск кровотечений (высокие дозы >1г/сут)', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект' },
  { drug: 'антигипертензивные', substance: 'magnesium', effect: 'Дополнительное снижение АД', severity: 'LOW', mechanism: 'Вазодилатация + блокада Ca-каналов' },
  { drug: 'антигипертензивные (иАПФ/АРА)', substance: 'potassium', effect: 'Риск гиперкалиемии', severity: 'MEDIUM', mechanism: 'Суммация калия' },
  { drug: 'диуретики (калийсберегающие)', substance: 'potassium', effect: 'ГИПЕРКАЛИЕМИЯ', severity: 'HIGH', mechanism: 'Суммация калия' },
  { drug: 'НПВС', substance: 'curcumin', effect: 'Дополнительный противовоспалительный эффект', severity: 'LOW', mechanism: 'Ингибирование NF-kB + COX-2' },
  { drug: 'НПВС', substance: 'curcumin', effect: 'Усиление антикоагуляции (высокие дозы)', severity: 'MEDIUM', mechanism: 'Антиагрегантный эффект' },
  { drug: 'ИПП (омепразол)', substance: 'magnesium', effect: 'Гипомагниемия при длительном приёме ИПП', severity: 'MEDIUM', mechanism: 'Снижение всасывания Mg' },
  { drug: 'ИПП (омепразол)', substance: 'b12', effect: 'Дефицит B12 на фоне ИПП', severity: 'MEDIUM', mechanism: 'Снижение ацидификации → ↓ всасывания B12' },
  { drug: 'циклоспорин', substance: 'curcumin', effect: 'Повышение концентрации циклоспорина', severity: 'MEDIUM', mechanism: 'Ингибирование CYP3A4 и P-гликопротеина' },
  { drug: 'пероральные контрацептивы', substance: 'magnesium', effect: 'Снижение магния на фоне ОК', severity: 'LOW', mechanism: 'Усиление экскреции Mg' },
  { drug: 'пероральные контрацептивы', substance: 'b6', effect: 'Дефицит B6 на фоне ОК', severity: 'LOW', mechanism: 'Ускорение метаболизма B6' },
  { drug: 'глюкокортикоиды', substance: 'calcium', effect: 'Профилактика стероидного остеопороза', severity: 'LOW', mechanism: 'Снижение резорбции кости' },
  { drug: 'глюкокортикоиды', substance: 'vitamin_d3', effect: 'Профилактика стероидного остеопороза', severity: 'LOW', mechanism: 'Обеспечение абсорбции Ca' },
  { drug: 'противоэпилептические', substance: 'folate', effect: 'Дефицит фолата на фоне приёма', severity: 'MEDIUM', mechanism: 'Антагонизм фолатного цикла' },
];

const CYP450_LABELS: Record<string, string> = {
  unknown: '❓ Неизвестен',
  normal: '🟢 Нормальный (EM)',
  poor: '🔴 Медленный (PM)',
  intermediate: '🟡 Промежуточный (IM)',
  rapid: '🔵 Быстрый (RM)',
};

const CYP_DETAILS: Record<string, string> = {
  unknown: 'Стандартные дозировки. Для точной настройки — фармакогенетическое тестирование.',
  normal: 'Стандартный метаболизм через CYP450.',
  poor: 'Риск токсичности: дозы субстратов CYP снизить в 2-4 раза. Особое внимание — CYP2D6, CYP2C19, CYP3A4.',
  intermediate: 'Умеренное снижение метаболизма. Начинать с 50% дозы, титровать.',
  rapid: 'Ускоренный метаболизм: возможны более высокие дозы. Пролекарства → риск токсичных метаболитов.',
};

/* ─── Drug Check Tab ─── */
export function DrugCheckTab({ profile, stackIds }: { profile: BioStackProfile; stackIds: string[] }) {
  const [medInput, setMedInput] = useState(profile.currentMeds.join(', '));
  const [allergyInput, setAllergyInput] = useState(profile.drugAllergies.join(', '));
  const [cypState, setCypState] = useState(profile.cyp450Status);
  const [results, setResults] = useState<Array<{
    drug: string; substance: string; effect: string; severity: string; mechanism: string;
  }> | null>(null);
  const [checkMode, setCheckMode] = useState<'stack' | 'catalog'>('stack');

  const catalogSearch = useMemo(() => {
    if (checkMode !== 'catalog') return null;
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) return null;
    const found: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string }> = [];
    for (const drug of drugs) {
      for (const [id, cat] of Object.entries(SUPPORT_CATALOG_DATA)) {
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          (drug.includes(k.drug) || k.drug.includes(drug)) &&
          (subName.includes(k.substance) || id.includes(k.substance))
        );
        direct.forEach(d => found.push({ ...d, substance: cat.nameRu || cat.name || id }));
      }
    }
    return found;
  }, [medInput, checkMode]);

  const runCheck = () => {
    const drugs = medInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const allergies = allergyInput.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (drugs.length === 0) { showToast('Введите хотя бы одно лекарство', 'error'); return; }

    saveBioStackProfile({ ...profile, currentMeds: drugs, drugAllergies: allergies, cyp450Status: cypState });

    const res: Array<{ drug: string; substance: string; effect: string; severity: string; mechanism: string }> = [];
    const targetIds = checkMode === 'stack' ? stackIds : Object.keys(SUPPORT_CATALOG_DATA).slice(0, 50);

    for (const drug of drugs) {
      for (const id of targetIds) {
        const cat = SUPPORT_CATALOG_DATA[id];
        if (!cat) continue;
        const subName = (cat.nameRu || cat.name || id).toLowerCase();
        const direct = KNOWN_DRUG_SUP_INTERACTIONS.filter(k =>
          (drug.includes(k.drug) || k.drug.includes(drug)) &&
          (subName.includes(k.substance) || id.includes(k.substance))
        );
        direct.forEach(d => res.push({ ...d, substance: cat.nameRu || cat.name || id }));
      }
    }

    for (const allergy of allergies) {
      for (const id of (checkMode === 'stack' ? stackIds : Object.keys(SUPPORT_CATALOG_DATA).slice(0, 50))) {
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

    if (res.length === 0) {
      res.push({
        drug: drugs.join(', '), substance: checkMode === 'stack' ? 'Ваш стек' : 'Каталог',
        effect: '✅ Клинически значимых взаимодействий не найдено',
        severity: 'LOW', mechanism: 'Нет данных о взаимодействии',
      });
    }
    setResults(res);
  };

  const maxSev = results ? Math.max(...results.map(r => r.severity === 'HIGH' ? 2 : r.severity === 'MEDIUM' ? 1 : 0)) : 0;
  const overallColor = maxSev === 2 ? '#ef4444' : maxSev === 1 ? '#f59e0b' : '#22c55e';
  const overallText = maxSev === 2 ? '🔴 Обнаружены КРИТИЧЕСКИЕ взаимодействия' : maxSev === 1 ? '🟡 Обнаружены умеренные взаимодействия' : '🟢 Безопасно';

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="💊 Детальная проверка лекарственных взаимодействий" icon="💊" color="#ef4444">
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 8, lineHeight: 1.3 }}>
          🔬 Введите названия принимаемых вами лекарств (МНН). Система проверит пересечения — со стеком БАДов или со всем каталогом.
        </div>

        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>
            💊 Лекарства (через запятую, МНН):
          </label>
          <textarea value={medInput} onChange={e => setMedInput(e.target.value)}
            placeholder="варфарин, метформин, аторвастатин, рамиприл, эсциталопрам, омепразол..."
            rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 10, boxSizing: 'border-box', resize: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>⚠ Аллергии:</label>
            <input value={allergyInput} onChange={e => setAllergyInput(e.target.value)}
              placeholder="пенициллин, сульфаниламиды..."
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 2 }}>🧬 CYP450:</label>
            <select value={cypState} onChange={e => setCypState(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 9, appearance: 'none' }}>
              {Object.entries(CYP450_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <PillBtn active={checkMode === 'stack'} onClick={() => setCheckMode('stack')} color="#60a5fa">
            📋 По моему стеку ({stackIds.length})
          </PillBtn>
          <PillBtn active={checkMode === 'catalog'} onClick={() => setCheckMode('catalog')} color="#8b5cf6">
            📚 По всему каталогу
          </PillBtn>
        </div>

        <button onClick={runCheck} style={{
          width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11,
          background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', marginBottom: 6,
        }}>🔍 Проверить взаимодействия</button>

        {checkMode === 'catalog' && !results && catalogSearch && catalogSearch.length > 0 && (
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', marginBottom: 6, fontSize: 8, color: '#f59e0b' }}>
            ⚡ Найдено {catalogSearch.length} пересечений с каталогом. Нажмите «Проверить» для деталей.
          </div>
        )}
      </GlassCard>

      {results && (
        <GlassCard title="📊 Результаты проверки" color={overallColor}>
          <div style={{
            padding: '8px 10px', borderRadius: 8, marginBottom: 8,
            background: `${overallColor}10`, border: `1px solid ${overallColor}25`,
            fontSize: 10, fontWeight: 700, color: overallColor, textAlign: 'center',
          }}>{overallText} ({results.length} находок)</div>

          {cypState !== 'unknown' && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#a78bfa' }}>🧬 CYP450: {CYP450_LABELS[cypState]}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{CYP_DETAILS[cypState]}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                padding: '7px 9px', borderRadius: 8,
                background: r.severity === 'HIGH' ? 'rgba(239,68,68,0.06)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${r.severity === 'HIGH' ? 'rgba(239,68,68,0.12)' : r.severity === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
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
              marginTop: 8, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
              fontSize: 9, color: '#fca5a5', lineHeight: 1.4,
            }}>
              ⚠ КЛИНИЧЕСКАЯ РЕКОМЕНДАЦИЯ: Выявлены высокорисковые взаимодействия.
              Пожалуйста, проконсультируйтесь с лечащим врачом перед приёмом БАДов.
              Не отменяйте и не меняйте дозировку назначенных лекарств самостоятельно.
            </div>
          )}

          <button onClick={() => {
            const txt = results.map(r => `${r.severity === 'HIGH' ? '🔴' : r.severity === 'MEDIUM' ? '🟡' : '🟢'} ${r.drug} + ${r.substance}: ${r.effect}`).join('\n');
            navigator.clipboard.writeText(txt);
            showToast('Скопировано', 'success');
          }} style={{
            width: '100%', padding: '8px 0', borderRadius: 8, marginTop: 6, cursor: 'pointer', fontSize: 9, fontWeight: 600,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
          }}>📋 Копировать результат</button>
        </GlassCard>
      )}
    </div>
  );
}
