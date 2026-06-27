import React, { useState } from 'react';

const LABS: { id: string; label: string; unit: string; refLow: number; refHigh: number }[] = [
  { id: 'hematocrit', label: 'Р“РµРјР°С‚РѕРєСЂРёС‚ (HCT)', unit: '%', refLow: 40, refHigh: 49 },
  { id: 'hemoglobin', label: 'Р“РµРјРѕРіР»РѕР±РёРЅ', unit: 'Рі/Р»', refLow: 130, refHigh: 160 },
  { id: 'hdl', label: 'ЛПВП', unit: 'ммоль/л', refLow: 1.0, refHigh: 2.0 },
  { id: 'ldl', label: 'ЛПНП', unit: 'ммоль/л', refLow: 0, refHigh: 3.0 },
  { id: 'alt', label: 'РђР›Рў', unit: 'Р•Рґ/Р»', refLow: 0, refHigh: 45 },
  { id: 'ast', label: 'РђРЎРў', unit: 'Р•Рґ/Р»', refLow: 0, refHigh: 35 },
  { id: 'crp', label: 'РЎР Р‘', unit: 'РјРі/Р»', refLow: 0, refHigh: 1.0 },
  { id: 'testosterone', label: 'РўРµСЃС‚РѕСЃС‚РµСЂРѕРЅ', unit: 'РЅРјРѕР»СЊ/Р»', refLow: 12, refHigh: 35 },
];

const HEALTH_ISSUES: { id: string; icon: string; label: string; desc: string; foodIds: string[] }[] = [
  { id: 'oedema', icon: '🦶', label: 'Отёки', desc: 'Задержка жидкости — снизить натрий, добавить калий', foodIds: ['salt', 'soy_sauce', 'sausages', 'kfc_wings', 'canned_food', 'cheese', 'bread_white', 'pickles'] },
  { id: 'lactose_intolerance', icon: '🥛', label: 'Непереносимость лактозы', desc: 'Дефицит лактазы — исключить молочные продукты', foodIds: ['milk', 'cheese', 'yogurt', 'cream', 'ice_cream', 'whey', 'cottage_cheese', 'kefir'] },
  { id: 'gluten_intolerance', icon: '🌾', label: 'Непереносимость глютена', desc: 'Целиакия/чувствительность — исключить пшеницу, рожь, ячмень', foodIds: ['bread_white', 'bread_rye', 'pasta', 'cookies', 'pizza', 'couscous', 'barley', 'bulgur'] },
  { id: 'diabetes', icon: '🍬', label: 'Диабет/�?нсулинорезистентность', desc: 'Контроль гликемии — низкие GI, клетчатка, белок', foodIds: ['sugar', 'honey', 'rice_white', 'bread_white', 'pasta', 'potato', 'juice_pack', 'chocolate_milk'] },
  { id: 'hypertension', icon: '💓', label: 'Гипертония', desc: 'Высокое АД — снизить натрий, добавить K/Mg', foodIds: ['salt', 'soy_sauce', 'sausages', 'kfc_wings', 'canned_food', 'cheese', 'chips', 'pickles'] },
  { id: 'gi_issues', icon: '🫃', label: 'Проблемы ЖКТ', desc: 'Гастрит/СРК — термическая обработка, исключить раздражающее', foodIds: ['beans', 'lentils', 'cabbage', 'broccoli', 'milk', 'spicy', 'fried', 'coffee'] },
  { id: 'gout', icon: '🦶', label: 'Подагра', desc: 'Высокая мочевая кислота — ограничить пурины', foodIds: ['liver', 'red_meat', 'sardines', 'beer', 'shrimps', 'mussels', 'tuna', 'mushrooms'] },
  { id: 'kidney_stones', icon: '🪨', label: 'Камни в почках', desc: 'Оксалаты/кальций — ограничить оксалаты, много воды', foodIds: ['spinach', 'beet', 'nuts', 'chocolate', 'rhubarb', 'sweet_potato', 'swiss_chard', 'okra'] },
];

const ALLERGEN_LIST: { id: string; icon: string; label: string }[] = [
  { id: 'lactose', icon: '🥛', label: 'Лактоза' },
  { id: 'gluten', icon: '🌾', label: 'Глютен' },
  { id: 'nuts', icon: '🥜', label: 'Орехи' },
  { id: 'eggs', icon: '🥚', label: 'Яйца' },
  { id: 'soy', icon: '�?', label: 'Соя' },
  { id: 'seafood', icon: '🦐', label: 'Морепродукты' },
  { id: 'histamine', icon: '🧪', label: 'Гистамин' },
  { id: 'sulfites', icon: '🧴', label: 'Сульфиты' },
];

const cardBg: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, marginBottom: 8 };

export const HealthAnalytics: React.FC = () => {
  const [labs, setLabs] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('he_health_labs') || '{}'); } catch { return {}; }
  });
  const [activeIssues, setActiveIssues] = useState<string[]>(() => {
    try { const a = JSON.parse(localStorage.getItem('he_health_issues') || 'null'); if (a && Array.isArray(a) && a.length > 0) return a; } catch {}
    try { const b = JSON.parse(localStorage.getItem('he_plan_health_issues') || 'null'); if (b && Array.isArray(b) && b.length > 0) return b; } catch {}
    return [];
  });
  const [activeAllergens, setActiveAllergens] = useState<string[]>(() => {
    try { const a = JSON.parse(localStorage.getItem('he_health_allergens') || 'null'); if (a && Array.isArray(a) && a.length > 0) return a; } catch {}
    try { const b = JSON.parse(localStorage.getItem('he_food_allergens') || 'null'); if (b && Array.isArray(b) && b.length > 0) return b; } catch {}
    return [];
  });
  const [tab, setTab] = useState<'labs' | 'diet'>('labs');

  const saveIssues = (next: string[]) => {
    setActiveIssues(next);
    localStorage.setItem('he_health_issues', JSON.stringify(next));
  };
  const saveAllergens = (next: string[]) => {
    setActiveAllergens(next);
    localStorage.setItem('he_health_allergens', JSON.stringify(next));
    localStorage.setItem('he_food_allergens', JSON.stringify(next));
  };

  const saveLabs = (id: string, val: string) => {
    const upd = { ...labs, [id]: val };
    setLabs(upd);
    localStorage.setItem('he_health_labs', JSON.stringify(upd));
  };

  const val = (id: string): number | null => {
    const v = labs[id]; return v ? parseFloat(v) : null;
  };

  const statusColor = (id: string, v: number): string => {
    const lab = LABS.find(l => l.id === id);
    if (!lab) return '#666';
    if (v < lab.refLow || v > lab.refHigh) return '#ef4444';
    const margin = (lab.refHigh - lab.refLow) * 0.2;
    if (v < lab.refLow + margin || v > lab.refHigh - margin) return '#f59e0b';
    return '#22c55e';
  };

  const getWarnings = (): string[] => {
    const w: string[] = [];
    const hct = val('hematocrit');
    const hb = val('hemoglobin');
    if (hct && hct > 51) w.push('🚨 КР�?Т�?ЧЕСК�?Й ГЕМАТОКР�?Т! Кровь слишком густая — риск тромбоза. Сдайте кровь или добавьте антикоагулянты.');
    if (hct && hct < 37) w.push('вљ пёЏ РќРёР·РєРёР№ РіРµРјР°С‚РѕРєСЂРёС‚ вЂ” РІРѕР·РјРѕР¶РЅР° Р°РЅРµРјРёСЏ. Р”РѕР±Р°РІСЊС‚Рµ Р¶РµР»РµР·Рѕ, B12, С„РѕР»Р°С‚С‹.');
    const ldl = val('ldl');
    if (ldl && ldl > 4.2) w.push('🚨 Высокий ЛПНП — риск атеросклероза. Снизьте насыщенные жиры, добавьте Омега-3, клетчатку, коэнзим Q10.');
    const hdl = val('hdl');
    if (hdl && hdl < 0.8) w.push('🚨 Низкий ЛПВП — риск атеросклероза. Добавьте жирную рыбу, оливковое масло, авокадо.');
    const alt = val('alt');
    if (alt && alt > 80) w.push('🚨 АЛТ > 80 — токсическое поражение печени. �?сключите гепатотоксичные препараты, добавьте TUDCA+NAC.');
    else if (alt && alt > 45) w.push('вљ пёЏ РђР›Рў РїРѕРІС‹С€РµРЅ вЂ” РЅР°РіСЂСѓР·РєР° РЅР° РїРµС‡РµРЅСЊ. Р”РѕР±Р°РІСЊС‚Рµ РіРµРїР°С‚РѕРїСЂРѕС‚РµРєС‚РѕСЂС‹ (TUDCA, NAC, СЃРёР»РёРјР°СЂРёРЅ).');
    const crp = val('crp');
    if (crp && crp > 3) w.push('🚨 СРБ > 3 — системное воспаление. Добавьте Омега-3, куркумин, проверьте ЖКТ.');
    const t = val('testosterone');
    if (t && t < 12) w.push('⚠️ Низкий тестостерон. Проверьте SHBG, добавьте цинк, магний, витамин D, холестерин в рацион.');
    const cr = val('creatinine');
    if (cr && cr > 115) w.push('⚠️ Высокий креатинин — перегрузка почек. Проверьте белок, добавьте защелачивание (зелень, лимоны).');
    return w;
  };

  const hasAnyLabs = Object.values(labs).some(v => v && v !== '0');
  const totalExcluded = [...new Set(HEALTH_ISSUES.filter(h => activeIssues.includes(h.id)).flatMap(h => h.foodIds))].length;

  const btn = (t: 'labs' | 'diet') => ({
    padding: '6px 14px', borderRadius: 16, fontSize: 9, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
    border: tab === t ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
    background: tab === t ? 'linear-gradient(135deg,#00e68a,#00c8a0)' : '#18181b',
    color: tab === t ? '#000' : '#fff', transition: 'all 0.2s',
  });

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button onClick={() => setTab('labs')} style={btn('labs')}>🩸 Анализы</button>
        <button onClick={() => setTab('diet')} style={btn('diet')}>🥗 Диета</button>
      </div>

      {tab === 'labs' && <>
        <div style={{ ...cardBg, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ ...sectionTitle, color: '#60a5fa' }}>🩸 Биохимический барометр</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {LABS.map(l => (
              <div key={l.id} style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(255,255,255,0.8)', marginBottom: 1 }}>
                  <span>{l.label}</span><span style={{ color: 'rgba(255,255,255,0.6)' }}>{l.refLow}-{l.refHigh} {l.unit}</span>
                </div>
                <input type="number" step="0.1" value={labs[l.id] || ''} onChange={e => saveLabs(l.id, e.target.value)}
                  placeholder="вЂ”" style={{
                    width: '100%', padding: '3px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                    background: labs[l.id] ? statusColor(l.id, parseFloat(labs[l.id] || '0')) + '20' : '#202023',
                    border: `1px solid ${labs[l.id] ? statusColor(l.id, parseFloat(labs[l.id] || '0')) + '40' : 'rgba(255,255,255,0.06)'}`,
                    color: labs[l.id] ? statusColor(l.id, parseFloat(labs[l.id] || '0')) : 'rgba(255,255,255,0.8)',
                    outline: 'none', boxSizing: 'border-box',
                  }} />
                {labs[l.id] && (
                  <div style={{ marginTop: 2, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, ((parseFloat(labs[l.id]||'0') - l.refLow*0.5) / (l.refHigh*1.5 - l.refLow*0.5)) * 100))}%`, height: '100%', borderRadius: 2, background: statusColor(l.id, parseFloat(labs[l.id]||'0')) }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {!hasAnyLabs && <div style={{ marginTop: 6, fontSize: 7, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>Р’РІРµРґРёС‚Рµ Р·РЅР°С‡РµРЅРёСЏ Р°РЅР°Р»РёР·РѕРІ</div>}
        </div>
        {hasAnyLabs && <div style={{ marginBottom: 8 }}>
          {getWarnings().length === 0 ? (
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)', fontSize: 8, color: '#00e68a' }}>вњ… Р’СЃРµ Р°РЅР°Р»РёР·С‹ РІ РЅРѕСЂРјРµ.</div>
          ) : getWarnings().map((w, i) => (
            <div key={i} style={{ padding: '6px 8px', marginBottom: 3, borderRadius: 6, background: w.startsWith('🚨') ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.06)', border: '1px solid rgba(239,68,68,0.1)', fontSize: 7, color: w.startsWith('🚨') ? '#ef4444' : '#f97316', lineHeight: 1.4 }}>{w}</div>
          ))}
        </div>}
      </>}

      {tab === 'diet' && <>
        <div style={{ ...cardBg, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ ...sectionTitle, color: '#8b5cf6' }}>🩺 Ограничения здоровья</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {HEALTH_ISSUES.map(h => {
              const isActive = activeIssues.includes(h.id);
              return (
                <div key={h.id} style={{
                  padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                  background: isActive ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)'}`,
                }} onClick={() => saveIssues(isActive ? activeIssues.filter(x => x !== h.id) : [...activeIssues, h.id])}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 14 }}>{h.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? '#8b5cf6' : 'rgba(255,255,255,0.7)' }}>{h.label}</span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)' }}>В· {h.foodIds.length} РїСЂРѕРґСѓРєС‚РѕРІ</span>
                    </div>
                    <span style={{ fontSize: 9, color: isActive ? '#8b5cf6' : 'rgba(255,255,255,0.2)' }}>{isActive ? 'вњ“' : '+'}</span>
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{h.desc}</div>
                  {isActive && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {h.foodIds.slice(0, 8).map(fid => (
                        <span key={fid} style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,0.15)', color: '#ef4444', textDecoration: 'line-through' }}>{fid.replace(/_/g, ' ')}</span>
                      ))}
                      {h.foodIds.length > 8 && <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', padding: '1px 4px' }}>+{h.foodIds.length - 8}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ ...cardBg, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ ...sectionTitle, color: '#f59e0b' }}>вљ пёЏ РђР»Р»РµСЂРіРµРЅС‹</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {ALLERGEN_LIST.map(a => {
              const isActive = activeAllergens.includes(a.id);
              return (
                <button key={a.id} onClick={() => saveAllergens(isActive ? activeAllergens.filter(x => x !== a.id) : [...activeAllergens, a.id])} style={{
                  padding: '4px 8px', borderRadius: 12, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                  background: isActive ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.6)',
                }}>{a.icon} {a.label}</button>
              );
            })}
          </div>
        </div>
        {activeIssues.length > 0 && (
          <div style={{ ...cardBg, padding: '10px 12px' }}>
            <div style={{ ...sectionTitle, color: '#a78bfa' }}>📋 Рекомендации</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              {HEALTH_ISSUES.filter(h => activeIssues.includes(h.id)).map(h => {
                const tips: Record<string, string> = {
                  oedema: 'в¬‡ РќР°С‚СЂРёР№: СѓР±РµСЂРёС‚Рµ СЃРѕР»СЊ, СЃРѕСѓСЃС‹, РєРѕР»Р±Р°СЃС‹. в¬† РљР°Р»РёР№: Р·РµР»РµРЅСЊ, Р°РІРѕРєР°РґРѕ, Р±Р°С‚Р°С‚.',
                  lactose_intolerance: 'в¬‡ Р›Р°РєС‚РѕР·Р°: Р·Р°РјРµРЅРёС‚Рµ РјРѕР»РѕРєРѕ РЅР° Р±РµР·Р»Р°РєС‚РѕР·РЅРѕРµ, СЃС‹СЂ РЅР° С‚РѕС„Сѓ. Р¤РµСЂРјРµРЅС‚ Р»Р°РєС‚Р°Р·Р° +.',
                  gluten_intolerance: 'в¬‡ Р“Р»СЋС‚РµРЅ: Р·Р°РјРµРЅРёС‚Рµ РїС€РµРЅРёС†Сѓ РЅР° СЂРёСЃ, РіСЂРµС‡РєСѓ, РєРёРЅРѕР°. Р§РёСЃС‚С‹Рµ РѕРІС‘СЃ (Р±РµР· РєР»РµР№РєРѕРІРёРЅС‹).',
                  diabetes: 'в¬‡ GI: РёСЃРєР»СЋС‡РёС‚Рµ СЃР°С…Р°СЂ, Р±РµР»С‹Р№ СЂРёСЃ, С…Р»РµР±. в¬† РљР»РµС‚С‡Р°С‚РєР°, Р±РµР»РѕРє, РЅРёР·РєРёРµ GI (РіСЂРµС‡РєР°, С‡РµС‡РµРІРёС†Р°). РЈР¶РёРЅ РЅРёР·РєРѕСѓРіР»РµРІРѕРґРЅС‹Р№.',
                  hypertension: 'в¬‡ РќР°С‚СЂРёР№ <1500 РјРі/СЃСѓС‚. в¬† РљР°Р»РёР№, РјР°РіРЅРёР№. РСЃРєР»СЋС‡РёС‚Рµ С„Р°СЃС‚С„СѓРґ, РєРѕРЅСЃРµСЂРІС‹, СЃС‹СЂ, РєРѕР»Р±Р°СЃС‹.',
                  gi_issues: 'в¬† РўРµСЂРјРёС‡РµСЃРєРё РѕР±СЂР°Р±РѕС‚Р°РЅРЅС‹Рµ РѕРІРѕС‰Рё. в¬‡ РЎС‹СЂС‹Рµ РѕРІРѕС‰Рё, Р±РѕР±РѕРІС‹Рµ, РјРѕР»РѕС‡РєР°, Р¶Р°СЂРµРЅРѕРµ. Р”СЂРѕР±РЅРѕРµ РїРёС‚Р°РЅРёРµ.',
                  gout: '⬇ Пурины: ограничьте печень, красное мясо, сардины, пиво. ⬆ Вода 2-3л.',
                  kidney_stones: 'в¬‡ РћРєСЃР°Р»Р°С‚С‹: С€РїРёРЅР°С‚, СЃРІС‘РєР»Р°, РѕСЂРµС…Рё, С€РѕРєРѕР»Р°Рґ. в¬† Р’РѕРґР° 2.5-3Р». Р›РёРјРѕРЅРЅР°СЏ РІРѕРґР° РёРЅРіРёР±РёСЂСѓРµС‚ РєР°РјРЅРё.',
                };
                return (
                  <div key={h.id} style={{ padding: '4px 0' }}>
                    <span style={{ fontWeight: 600, color: '#a78bfa' }}>{h.icon} {h.label}:</span> {tips[h.id] || 'РЎРѕР±Р»СЋРґР°Р№С‚Рµ РґРёРµС‚РёС‡РµСЃРєРёРµ СЂРµРєРѕРјРµРЅРґР°С†РёРё РІР°С€РµРіРѕ РІСЂР°С‡Р°.'}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#8b5cf6' }}>{activeIssues.length}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)' }}>РђРєС‚РёРІРЅС‹С… РїСЂРѕР±Р»РµРј</div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{activeAllergens.length}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)' }}>РђРєС‚РёРІРЅС‹С… Р°Р»Р»РµСЂРіРµРЅРѕРІ</div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#00e68a' }}>{totalExcluded}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)' }}>РСЃРєР»СЋС‡РµРЅРѕ РїСЂРѕРґСѓРєС‚РѕРІ</div>
          </div>
        </div>
      </>}
    </div>
  );
};

