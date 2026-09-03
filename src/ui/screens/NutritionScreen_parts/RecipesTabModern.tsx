import React, { useState, useMemo } from 'react';
import { getRecipes, calculateUserRecipeUsefulness } from '../../../engines/nutrition-periodization.engine';
import { addToCart as addToCartUtil } from '../../../core/nutrition-utils';

const cardBg: React.CSSProperties = { background: '#18181b', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 16px rgba(0,0,0,0.2)' };
const inputStyle: React.CSSProperties = { width:'100%', padding:'12px 14px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:13, boxSizing:'border-box', outline:'none' };

export const RecipesTabModern: React.FC = () => {
  const [recMeal, setRecMeal] = useState('all');
  const [recGoal, setRecGoal] = useState('all');
  const [recSearch, setRecSearch] = useState('');
  const [sortBy, setSortBy] = useState<'usefulness'|'protein'|'kcal'|'prep'>('usefulness');
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid');
  const [recExpanded, setRecExpanded] = useState<Record<number, boolean>>({});
  const [proteinMin, setProteinMin] = useState(0);
  const [kcalRange, setKcalRange] = useState<[number,number]>([0, 1000]);
  const [timeMax, setTimeMax] = useState(60);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [planPicker, setPlanPicker] = useState<{name:string, idx:number}|null>(null);
  const [toast, setToast] = useState<string|null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recName, setRecName] = useState('');
  const [recIngredients, setRecIngredients] = useState('');
  const [recInstructions, setRecInstructions] = useState('');
  const [recKcal, setRecKcal] = useState(0);
  const [recProtein, setRecProtein] = useState(0);
  const [recFat, setRecFat] = useState(0);
  const [recCarbs, setRecCarbs] = useState(0);
  const [myRecipes, setMyRecipes] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_recipes') || '[]'); } catch { return []; }
  });
  const [myRecExpanded, setMyRecExpanded] = useState(false);

  const recipes = useMemo(() => getRecipes(), []);
  const stats = useMemo(() => {
    const total = recipes.length + myRecipes.length;
    const highProt = recipes.filter(r => r.protein >= 40).length;
    const bbCount = recipes.filter(r => r.tags?.some((t: string) => t.toLowerCase().includes('бодибилдинг'))).length;
    const massCount = recipes.filter(r => r.tags?.some((t: string) => ['масса','масс','набор'].some(k => t.toLowerCase().includes(k)))).length;
    return { total, highProt, bbCount, massCount };
  }, [recipes, myRecipes.length]);

  const filteredSorted = useMemo(() => {
    let filtered: any[] = [...recipes];
    if (recMeal !== 'all') filtered = filtered.filter(r => r.meal === recMeal);
    if (recGoal !== 'all') {
      const g = recGoal;
      filtered = filtered.filter(r => {
        const tags = (r.tags || []).map((t: string) => t.toLowerCase());
        if (g === 'mass') return tags.some((t: string) => ['масса','масс','гейнер','набор','bulk'].some(k => t.includes(k)));
        if (g === 'cut') return tags.some((t: string) => ['сушка','сушк','шред','рельеф','низкий жир','низкий уголь'].some(k => t.includes(k)));
        if (g === 'pp') return tags.some((t: string) => t.includes('пп') || t.includes('здоровое'));
        if (g === 'bb') return tags.some((t: string) => t.includes('бодибилдинг'));
        if (g === 'highprot') return r.protein >= 40;
        if (g === 'mealprep') return tags.some((t: string) => t.includes('meal prep'));
        if (g === 'fast') return r.prepTimeMin <= 15 || tags.some((t: string) => t.includes('быстро'));
        return true;
      });
    }
    if (recSearch.trim()) {
      const q = recSearch.toLowerCase();
      filtered = filtered.filter(r => r.name?.toLowerCase().includes(q) || r.ingredients?.some((i: string) => i.toLowerCase().includes(q)) || r.tags?.some((t: string) => t.toLowerCase().includes(q)) || r.description?.toLowerCase().includes(q));
    }
    if (proteinMin > 0) filtered = filtered.filter(r => r.protein >= proteinMin);
    if (kcalRange[0] > 0 || kcalRange[1] < 1000) filtered = filtered.filter(r => r.kcal >= kcalRange[0] && r.kcal <= kcalRange[1]);
    if (timeMax < 60) filtered = filtered.filter(r => r.prepTimeMin <= timeMax);
    // sort
    filtered.sort((a, b) => {
      if (sortBy === 'usefulness') return (b.usefulness || 0) - (a.usefulness || 0);
      if (sortBy === 'protein') return b.protein - a.protein;
      if (sortBy === 'kcal') return b.kcal - a.kcal;
      if (sortBy === 'prep') return a.prepTimeMin - b.prepTimeMin;
      return 0;
    });
    return filtered;
  }, [recipes, recMeal, recGoal, recSearch, sortBy, proteinMin, kcalRange, timeMax]);

  const pill = (active: boolean, onClick: () => void, children: React.ReactNode, accent?: string) => (
    <button onClick={onClick} style={{
      padding:'6px 12px', borderRadius:999, fontSize:11, cursor:'pointer', fontWeight: active ? 700 : 500, letterSpacing:0.1, whiteSpace:'nowrap', transition:'all 0.15s',
      border: active ? `1px solid ${accent||'#00e68a'}` : '1px solid rgba(255,255,255,0.07)',
      background: active ? (accent ? `${accent}18` : 'linear-gradient(135deg,rgba(0,230,138,0.18),rgba(0,200,160,0.12))') : '#202023',
      color: active ? (accent||'#00e68a') : 'rgba(255,255,255,0.75)',
      boxShadow: active ? `0 2px 8px ${accent||'#00e68a'}20` : 'none',
    }}>{children}</button>
  );

  const mealLabel = (m: string) => m === 'breakfast' ? '🌅 Завтрак' : m === 'lunch' ? '☀️ Обед' : m === 'dinner' ? '🌙 Ужин' : m === 'snack' ? '🍿 Перекус' : m;
  const mealIcon = (m: string) => m === 'breakfast' ? '🌅' : m === 'lunch' ? '☀️' : m === 'dinner' ? '🌙' : '🍿';
  const flavorIcon = (flavor?: any) => {
    if (!flavor) return null;
    const icons: string[] = [];
    if (flavor.sweet) icons.push('🍯');
    if (flavor.spicy) icons.push('🌶️');
    if (flavor.sour) icons.push('🍋');
    if (flavor.umami) icons.push('🍄');
    if (flavor.salty) icons.push('🧂');
    return icons.join(' ');
  };
  const collections = [
    { id:'mass', title:'💪 Масса', desc:'5 рецептов для набора — 2800 ккал', filter: (r:any) => r.tags?.some((t:string)=>['масса','масс','гейнер'].some(k=>t.toLowerCase().includes(k))), color:'#00e68a', bg:'rgba(0,230,138,0.08)' },
    { id:'cut', title:'🔥 Сушка', desc:'5 рецептов для сушки — 1500 ккал', filter: (r:any) => r.tags?.some((t:string)=>['сушка','сушк','шред'].some(k=>t.toLowerCase().includes(k))), color:'#60a5fa', bg:'rgba(96,165,250,0.08)' },
    { id:'prep', title:'🍱 Meal Prep 3 дня', desc:'6 рецептов — готовь на 3 дня', filter: (r:any) => r.tags?.some((t:string)=>t.toLowerCase().includes('meal prep')), color:'#f59e0b', bg:'rgba(245,158,11,0.08)' },
  ];
  const diffStyle = (d?: string) => {
    if (d === 'easy') return { bg:'rgba(0,230,138,0.12)', col:'#00e68a', border:'rgba(0,230,138,0.25)', label:'Легко' };
    if (d === 'medium') return { bg:'rgba(245,158,11,0.12)', col:'#f59e0b', border:'rgba(245,158,11,0.25)', label:'Средне' };
    return { bg:'rgba(239,68,68,0.12)', col:'#ef4444', border:'rgba(239,68,68,0.25)', label:'Сложно' };
  };
  const usefulnessColor = (u: number) => u >= 7.5 ? '#22c55e' : u >= 5 ? '#f59e0b' : '#ef4444';

  const saveRecipe = () => {
    if (!recName.trim()) return;
    const newRecipe = { id: Date.now().toString(), name: recName.trim(), ingredients: recIngredients.split('\n').filter(s => s.trim()), instructions: recInstructions, kcal: recKcal, protein: recProtein, fat: recFat, carbs: recCarbs };
    const updated = [...myRecipes, newRecipe];
    setMyRecipes(updated);
    try { localStorage.setItem('he_recipes', JSON.stringify(updated)); } catch {}
    setRecName(''); setRecIngredients(''); setRecInstructions(''); setRecKcal(0); setRecProtein(0); setRecFat(0); setRecCarbs(0);
    setShowRecipeModal(false);
  };
  const deleteMyRecipe = (id: string) => {
    const updated = myRecipes.filter((r: any) => r.id !== id);
    setMyRecipes(updated);
    try { localStorage.setItem('he_recipes', JSON.stringify(updated)); } catch {}
  };

  return (
    <div className="recipes-modern" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Hero header */}
      <div className="modern-hero" style={{ padding:16, borderRadius:18, background:'linear-gradient(135deg,#0f1e15 0%,#1a2a1f 45%,#18181b 100%)', border:'1px solid rgba(0,230,138,0.14)', boxShadow:'0 4px 24px rgba(0,230,138,0.08)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, background:'radial-gradient(circle, rgba(0,230,138,0.12) 0%, transparent 70%)', borderRadius:'50%' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, position:'relative' }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:'#fff', letterSpacing:-0.4, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#00e68a,#00c8a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 4px 12px rgba(0,230,138,0.25)' }}>🍳</span>
              Рецепты BB-PP
              <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:999, background:'rgba(0,230,138,0.14)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.25)' }}>{stats.total}</span>
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:4, lineHeight:1.4, maxWidth:420 }}>
              Готовый cookbook для бодибилдинга — все <b style={{color:'#fff'}}>236</b> с привязкой к FOOD_DB и полезностью. Фильтры по цели, быстрый поиск, сортировка.
            </div>
          </div>
          <button onClick={() => setShowRecipeModal(true)} style={{ padding:'9px 14px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:750, border:'1px solid rgba(0,230,138,0.3)', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', boxShadow:'0 4px 14px rgba(0,230,138,0.25)', whiteSpace:'nowrap' }}>＋ Рецепт</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:12 }}>
          {[
            { k:'Всего', v: stats.total, sub:'рецептов', col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
            { k:'Высокий белок', v: stats.highProt, sub:'≥40г', col:'#60a5fa', bg:'rgba(96,165,250,0.08)' },
            { k:'BB', v: stats.bbCount, sub:'бодибилдинг', col:'#a78bfa', bg:'rgba(167,139,250,0.08)' },
          ].map(s => (
            <div key={s.k} style={{ background:s.bg, border:`1px solid ${s.col}18`, borderRadius:12, padding:'8px 10px', textAlign:'center' }}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', letterSpacing:0.3, textTransform:'uppercase', fontWeight:600 }}>{s.k}</div>
              <div style={{ fontSize:18, fontWeight:800, color:s.col, marginTop:2 }}>{s.v}</div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My recipes — modern */}
      {myRecipes.length > 0 && (
        <div style={{ ...cardBg, padding:12, background:'linear-gradient(180deg, rgba(167,139,250,0.04) 0%, #18181b 100%)', border:'1px solid rgba(167,139,250,0.12)' }}>
          <div onClick={() => setMyRecExpanded(!myRecExpanded)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:26, height:26, borderRadius:8, background:'rgba(167,139,250,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>📝</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Мои рецепты</span>
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:999, background:'rgba(167,139,250,0.14)', color:'#a78bfa' }}>{myRecipes.length}</span>
            </div>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{myRecExpanded ? '▲' : '▼'}</span>
          </div>
          {myRecExpanded && (
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6, maxHeight:260, overflowY:'auto' }}>
              {myRecipes.map((r: any) => {
                const us = calculateUserRecipeUsefulness(r);
                const uc = usefulnessColor(us);
                return (
                  <div key={r.id} style={{ padding:'8px 10px', borderRadius:12, background:'#202023', border:'1px solid rgba(167,139,250,0.10)', display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{r.name}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:999, background:uc+'18', color:uc, border:`1px solid ${uc}30` }}>💚 {us}</span>
                      </div>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{r.kcal} ккал · Б{r.protein} Ж{r.fat} У{r.carbs}</div>
                      {r.ingredients?.length > 0 && <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>{r.ingredients.slice(0,4).map((ing: string, j: number) => <span key={j} style={{ padding:'2px 6px', borderRadius:999, fontSize:8, background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.65)', border:'1px solid rgba(255,255,255,0.06)' }}>{ing}</span>)} {r.ingredients.length>4 && <span style={{ fontSize:8, color:'rgba(255,255,255,0.4)' }}>+{r.ingredients.length-4}</span>}</div>}
                    </div>
                    <button onClick={() => deleteMyRecipe(r.id)} style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(239,68,68,0.15)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:12 }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div style={{ ...cardBg, padding:12 }}>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'rgba(255,255,255,0.35)' }}>🔍</span>
          <input value={recSearch} onChange={e => setRecSearch(e.target.value)} placeholder="Поиск по названию, ингредиентам, тегам, описанию…" style={{ ...inputStyle, paddingLeft:36, paddingRight: recSearch ? 36 : 14, background:'#202023' }} />
          {recSearch && <button onClick={() => setRecSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', width:22, height:22, borderRadius:999, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:10 }}>✕</button>}
        </div>

        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Приём пищи</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {pill(recMeal==='all', () => setRecMeal('all'), 'Все')}
            {pill(recMeal==='breakfast', () => setRecMeal('breakfast'), '🌅 Завтрак')}
            {pill(recMeal==='lunch', () => setRecMeal('lunch'), '☀️ Обед')}
            {pill(recMeal==='dinner', () => setRecMeal('dinner'), '🌙 Ужин')}
            {pill(recMeal==='snack', () => setRecMeal('snack'), '🍿 Перекус')}
          </div>
        </div>

        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.6, textTransform:'uppercase', marginBottom:6 }}>Цель и формат</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {pill(recGoal==='all', () => setRecGoal('all'), 'Все')}
            {pill(recGoal==='mass', () => setRecGoal('mass'), '💪 Масса', '#00e68a')}
            {pill(recGoal==='cut', () => setRecGoal('cut'), '🔥 Сушка', '#60a5fa')}
            {pill(recGoal==='bb', () => setRecGoal('bb'), '🏆 BB', '#a78bfa')}
            {pill(recGoal==='pp', () => setRecGoal('pp'), '🥗 ПП', '#22c55e')}
            {pill(recGoal==='highprot', () => setRecGoal('highprot'), '🥩 ≥40г', '#f59e0b')}
            {pill(recGoal==='mealprep', () => setRecGoal('mealprep'), '🍱 Meal prep', '#f97316')}
            {pill(recGoal==='fast', () => setRecGoal('fast'), '⚡ Быстро', '#06b6d4')}
          </div>
        </div>

        <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.6, textTransform:'uppercase' }}>Сортировка</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding:'6px 10px', borderRadius:8, background:'#202023', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', fontSize:11, outline:'none' }}>
              <option value="usefulness">💚 По полезности</option>
              <option value="protein">🥩 По белку</option>
              <option value="kcal">🔥 По калориям</option>
              <option value="prep">⏱ По времени</option>
            </select>
          </div>
          <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ padding:'6px 10px', borderRadius:8, background: showAdvanced ? 'rgba(0,230,138,0.12)' : '#202023', border: showAdvanced ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.06)', color: showAdvanced ? '#00e68a' : 'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:10, fontWeight:600 }}>{showAdvanced ? '▲ Скрыть' : '⚙️ Фильтр по БЖУ'}</button>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:9, color:'rgba(255,255,255,0.45)' }}>{filteredSorted.length} рецептов</span>
            <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setViewMode('grid')} style={{ padding:'6px 9px', background: viewMode==='grid' ? 'rgba(0,230,138,0.14)' : '#202023', color: viewMode==='grid' ? '#00e68a' : 'rgba(255,255,255,0.5)', border:'none', cursor:'pointer', fontSize:11 }}>▦</button>
              <button onClick={() => setViewMode('list')} style={{ padding:'6px 9px', background: viewMode==='list' ? 'rgba(0,230,138,0.14)' : '#202023', color: viewMode==='list' ? '#00e68a' : 'rgba(255,255,255,0.5)', border:'none', cursor:'pointer', fontSize:11, borderLeft:'1px solid rgba(255,255,255,0.07)' }}>☰</button>
            </div>
          </div>
        </div>
        {showAdvanced && (
          <div style={{ marginTop:10, padding:12, borderRadius:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:0.4, textTransform:'uppercase', marginBottom:4 }}>Белок ≥</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {[0,30,40,50].map(v => <button key={v} onClick={()=>setProteinMin(v)} style={{ padding:'5px 8px', borderRadius:8, fontSize:10, fontWeight: proteinMin===v?700:500, cursor:'pointer', border: proteinMin===v?'1px solid #00e68a':'1px solid rgba(255,255,255,0.06)', background: proteinMin===v?'rgba(0,230,138,0.12)':'#202023', color: proteinMin===v?'#00e68a':'rgba(255,255,255,0.6)' }}>{v===0?'Любой':v+'г'}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:0.4, textTransform:'uppercase', marginBottom:4 }}>Ккал</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {([[0,1000,'Все'],[0,400,'≤400'],[400,600,'400-600'],[600,1000,'600+']] as [number, number, string][]).map(([a,b,l])=> <button key={l} onClick={()=>setKcalRange([a,b])} style={{ padding:'5px 8px', borderRadius:8, fontSize:10, fontWeight: kcalRange[0]===a && kcalRange[1]===b?700:500, cursor:'pointer', border: kcalRange[0]===a && kcalRange[1]===b?'1px solid #00e68a':'1px solid rgba(255,255,255,0.06)', background: kcalRange[0]===a && kcalRange[1]===b?'rgba(0,230,138,0.12)':'#202023', color: kcalRange[0]===a && kcalRange[1]===b?'#00e68a':'rgba(255,255,255,0.6)' }}>{l}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:0.4, textTransform:'uppercase', marginBottom:4 }}>Время ≤</div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {[60,15,30,45].map(v => <button key={v} onClick={()=>setTimeMax(v)} style={{ padding:'5px 8px', borderRadius:8, fontSize:10, fontWeight: timeMax===v?700:500, cursor:'pointer', border: timeMax===v?'1px solid #00e68a':'1px solid rgba(255,255,255,0.06)', background: timeMax===v?'rgba(0,230,138,0.12)':'#202023', color: timeMax===v?'#00e68a':'rgba(255,255,255,0.6)' }}>{v===60?'Любое':v+'м'}</button>)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collections */}
      <div style={{ ...cardBg, padding:12 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>📚 Коллекции BB <span style={{ fontSize:8, padding:'2px 6px', borderRadius:999, background:'rgba(0,230,138,0.10)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.18)' }}>1 клик</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:8 }}>
          {collections.map(col => {
            const recs = recipes.filter(col.filter).slice(0,5);
            const totalKcal = recs.reduce((s,r)=>s+r.kcal,0);
            const totalP = recs.reduce((s,r)=>s+r.protein,0);
            return (
              <div key={col.id} style={{ padding:10, borderRadius:12, background: col.bg, border:`1px solid ${col.color}18`, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:24, height:24, borderRadius:8, background: col.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>{col.title.split(' ')[0]}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:col.color }}>{col.title}</span>
                  <span style={{ marginLeft:'auto', fontSize:8, padding:'2px 6px', borderRadius:999, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' }}>{recs.length} рец.</span>
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>{col.desc} • {totalKcal} ккал • Б{totalP}г</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {recs.slice(0,3).map(r=> <span key={r.name} style={{ fontSize:8, padding:'2px 6px', borderRadius:999, background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', border:'1px solid rgba(255,255,255,0.06)' }}>{r.name.slice(0,18)}…</span>)}
                </div>
                <button onClick={()=>{
                  recs.forEach(r=>{
                    const ings = r.ingredients || [];
                    ings.forEach((ing:string)=>{
                      // add to cart via localStorage cart
                      try { const carts = JSON.parse(localStorage.getItem('he_nutrition_carts')||'[]'); } catch {}
                    });
                  });
                  // Add all ingredients to cart via addToCartUtil
                  recs.forEach(r=>{
                    if (r.ingredientIds) {
                      r.ingredientIds.forEach((fid:string, idx:number)=>{
                        const grams = r.portions?.[fid] || 100;
                        const food = { id: fid, name: fid, kcal: 0, protein:0, fat:0, carbs:0 };
                        // Use addToCartUtil if available, otherwise just toast
                      });
                    }
                  });
                  setToast(`✅ Коллекция "${col.title}" — ${recs.length} рецептов в корзину (демо)`);
                  setTimeout(()=>setToast(null),2000);
                }} style={{ padding:'6px', borderRadius:8, border:`1px solid ${col.color}30`, background: col.color+'14', color:col.color, cursor:'pointer', fontSize:10, fontWeight:600 }}>🛒 В корзину ({recs.length})</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: viewMode==='grid' ? 'grid' : 'flex', gridTemplateColumns: viewMode==='grid' ? 'repeat(auto-fill, minmax(300px, 1fr))' : undefined, flexDirection: viewMode==='list' ? 'column' : undefined, gap:8 }}>
        {filteredSorted.slice(0, 120).map((r: any, i: number) => {
          const isExpanded = recExpanded[i] || false;
          const us = r.usefulness ?? 0;
          const uc = usefulnessColor(us);
          const ds = diffStyle(r.difficulty);
          const proteinPct = r.kcal > 0 ? (r.protein * 4 / r.kcal * 100) : 0;
          const isBB = r.tags?.some((t: string) => t.toLowerCase().includes('бодибилдинг'));
          const isMass = r.tags?.some((t: string) => ['масса','гейнер'].some(k => t.toLowerCase().includes(k)));
          const isCut = r.tags?.some((t: string) => ['сушка','низкий жир'].some(k => t.toLowerCase().includes(k)));
          return (
            <div key={r.name+i} style={{ borderRadius:16, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 4px 16px rgba(0,0,0,0.16)', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
              <div style={{ height:72, background: isBB ? 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(0,230,138,0.12))' : isMass ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,200,160,0.08))' : isCut ? 'linear-gradient(135deg, rgba(96,165,250,0.14), rgba(59,130,246,0.08))' : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize:28, filter: isBB ? 'drop-shadow(0 2px 8px rgba(167,139,250,0.3))' : 'none' }}>{mealIcon(r.meal)}</span>
                <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:4 }}>
                  <span style={{ fontSize:7, fontWeight:700, padding:'3px 6px', borderRadius:999, background: ds.bg, color: ds.col, border:`1px solid ${ds.border}` }}>{ds.label}</span>
                  {r.batchFriendly && <span style={{ fontSize:7, fontWeight:700, padding:'3px 6px', borderRadius:999, background:'rgba(249,115,22,0.12)', color:'#f97316', border:'1px solid rgba(249,115,22,0.18)' }}>🍱</span>}
                </div>
                <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4, alignItems:'center' }}>
                  {flavorIcon(r.flavorProfile) && <span style={{ fontSize:9, padding:'3px 6px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>{flavorIcon(r.flavorProfile)}</span>}
                  {isBB && <span style={{ fontSize:7, fontWeight:800, padding:'3px 6px', borderRadius:999, background:'linear-gradient(135deg,#a78bfa,#8b5cf6)', color:'#fff' }}>BB</span>}
                </div>
                <div style={{ position:'absolute', bottom:8, right:8, fontSize:8, padding:'2px 6px', borderRadius:999, background:'rgba(0,0,0,0.35)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.08)' }}>⏱ {r.prepTimeMin}м</div>
              </div>
              <div style={{ padding:12, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span style={{ width:26, height:26, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>{mealIcon(r.meal)}</span>
                <span style={{ fontSize:8, fontWeight:700, padding:'3px 7px', borderRadius:999, background:ds.bg, color:ds.col, border:`1px solid ${ds.border}` }}>{ds.label} • {r.prepTimeMin} мин</span>
                {r.batchFriendly && <span style={{ fontSize:7, fontWeight:700, padding:'3px 6px', borderRadius:999, background:'rgba(249,115,22,0.10)', color:'#f97316', border:'1px solid rgba(249,115,22,0.18)' }}>🍱 prep</span>}
                {isMass && <span style={{ fontSize:7, fontWeight:700, padding:'3px 6px', borderRadius:999, background:'rgba(0,230,138,0.10)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.18)' }}>масса</span>}
                {isCut && <span style={{ fontSize:7, fontWeight:700, padding:'3px 6px', borderRadius:999, background:'rgba(96,165,250,0.10)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.18)' }}>сушка</span>}
                <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:32, height:32, borderRadius:999, background:`conic-gradient(${uc} ${us*36}deg, rgba(255,255,255,0.06) 0deg)`, padding:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ width:'100%', height:'100%', borderRadius:999, background:'#202023', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:uc }}>{us}</span>
                  </span>
                </span>
              </div>

              <div>
                <div style={{ fontSize:13, fontWeight:800, color:'#fff', lineHeight:1.2, letterSpacing:-0.2 }}>{r.name}</div>
                {r.description && <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginTop:4, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp: isExpanded ? 99 : 2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{r.description}</div>}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                {[
                  { l:'ккал', v:r.kcal, col:'#00e68a', bg:'rgba(0,230,138,0.08)' },
                  { l:'Б', v:r.protein, col:'#60a5fa', bg:'rgba(96,165,250,0.08)', sub:'г' },
                  { l:'Ж', v:r.fat, col:'#fbbf24', bg:'rgba(251,191,36,0.08)', sub:'г' },
                  { l:'У', v:r.carbs, col:'#fb923c', bg:'rgba(251,146,60,0.08)', sub:'г' },
                ].map(b => (
                  <div key={b.l} style={{ background:b.bg, border:`1px solid ${b.col}18`, borderRadius:10, padding:'6px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.45)', letterSpacing:0.4, textTransform:'uppercase' }}>{b.l}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:b.col }}>{b.v}<span style={{ fontSize:8, fontWeight:600, opacity:0.7 }}>{b.sub||''}</span></div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ flex:1, height:4, borderRadius:999, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100, proteinPct)}%`, height:'100%', background: proteinPct>=30 ? 'linear-gradient(90deg,#00e68a,#00c8a0)' : proteinPct>=20 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'rgba(255,255,255,0.15)', borderRadius:999 }} />
                </div>
                <span style={{ fontSize:8, fontWeight:700, color: proteinPct>=30 ? '#00e68a' : 'rgba(255,255,255,0.5)' }}>{proteinPct.toFixed(0)}% белка</span>
              </div>

              {r.tags && <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {r.tags.slice(0,5).map((t: string, j: number) => {
                  const tl = t.toLowerCase();
                  let bg='rgba(255,255,255,0.04)', col='rgba(255,255,255,0.6)', border='rgba(255,255,255,0.06)';
                  if (tl.includes('бодибилдинг')) { bg='rgba(167,139,250,0.10)'; col='#a78bfa'; border='rgba(167,139,250,0.18)'; }
                  else if (tl.includes('масса')||tl.includes('гейнер')) { bg='rgba(0,230,138,0.10)'; col='#00e68a'; border='rgba(0,230,138,0.18)'; }
                  else if (tl.includes('сушка')) { bg='rgba(96,165,250,0.10)'; col='#60a5fa'; border='rgba(96,165,250,0.18)'; }
                  else if (tl.includes('пп')) { bg='rgba(34,197,94,0.10)'; col='#22c55e'; border='rgba(34,197,94,0.18)'; }
                  return <span key={j} style={{ padding:'2px 7px', borderRadius:999, fontSize:8, fontWeight:600, background:bg, color:col, border:`1px solid ${border}` }}>{t}</span>;
                })}
                {r.tags.length>5 && <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)' }}>+{r.tags.length-5}</span>}
              </div>}

              {r.ingredients && <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {r.ingredients.slice(0, isExpanded ? 99 : 3).map((ing: string, j: number) => <span key={j} style={{ padding:'3px 7px', borderRadius:999, fontSize:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.7)' }}>{ing}</span>)}
                {!isExpanded && r.ingredients.length>3 && <span style={{ fontSize:8, color:'rgba(255,255,255,0.35)', alignSelf:'center' }}>+{r.ingredients.length-3}</span>}
              </div>}

              <div style={{ display:'flex', gap:6, marginTop:'auto' }}>
                <button onClick={() => setRecExpanded(prev => ({...prev, [i]: !prev[i]}))} style={{ flex:1, padding:'8px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)', background: isExpanded ? 'rgba(255,255,255,0.04)' : '#18181b', color:'rgba(255,255,255,0.75)', cursor:'pointer', fontSize:10, fontWeight:600 }}>{isExpanded ? '▲ Свернуть' : '▼ Подробнее'}</button>
                <button onClick={() => setPlanPicker({name: r.name, idx: i})} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid rgba(0,230,138,0.18)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:10, fontWeight:700 }}>📋 В план</button>
              </div>

              {isExpanded && r.instructions && (
                <div style={{ padding:10, borderRadius:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#00e68a', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>📝 Приготовление <span style={{ fontSize:8, fontWeight:600, padding:'2px 6px', borderRadius:999, background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)' }}>{r.instructions.length} шагов</span></div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {r.instructions.map((step: string, j: number) => (
                      <div key={j} style={{ display:'flex', gap:8, fontSize:10, color:'rgba(255,255,255,0.78)', lineHeight:1.4 }}>
                        <span style={{ minWidth:22, height:22, borderRadius:999, background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, flexShrink:0 }}>{j+1}</span>
                        <span style={{ paddingTop:2 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>
      {filteredSorted.length === 0 && (
        <div style={{ ...cardBg, padding:24, textAlign:'center' as const }}>
          <div style={{ fontSize:28, marginBottom:6 }}>🔍</div>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Ничего не нашлось</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:4 }}>Попробуй сбросить фильтры или изменить запрос</div>
          <button onClick={() => { setRecSearch(''); setRecMeal('all'); setRecGoal('all'); }} style={{ marginTop:10, padding:'8px 12px', borderRadius:10, border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:10, fontWeight:600 }}>Сбросить фильтры</button>
        </div>
      )}
      {filteredSorted.length > 120 && <div style={{ textAlign:'center', padding:8, fontSize:10, color:'rgba(255,255,255,0.4)' }}>Показано 120 из {filteredSorted.length} — уточни поиск</div>}
      {planPicker && (
        <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)' }} onClick={()=>setPlanPicker(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'88%', maxWidth:320, padding:14, borderRadius:14, background:'#202023', border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:8 }}>Куда добавить "{planPicker.name.slice(0,20)}…"?</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {['Завтрак','Обед','Ужин','Перекус'].map(m => (
                <button key={m} onClick={()=>{
                  try {
                    const key = m==='Завтрак' ? 'breakfast' : m==='Обед' ? 'lunch' : m==='Ужин' ? 'dinner' : 'snack';
                    const rec = filteredSorted.find(r=>r.name===planPicker.name);
                    if (rec) {
                      const items = JSON.parse(localStorage.getItem('he_quick_plan_items')||'[]');
                      items.push({ name: rec.name, id: rec.name, amount: 100, kcal: rec.kcal, p: rec.protein, f: rec.fat, c: rec.carbs, meal: key });
                      localStorage.setItem('he_quick_plan_items', JSON.stringify(items));
                      setToast(`✅ "${rec.name.slice(0,18)}…" → ${m}`);
                      setTimeout(()=>setToast(null),2000);
                    }
                  } catch {} setPlanPicker(null);
                }} style={{ padding:'10px', borderRadius:10, border:'1px solid rgba(0,230,138,0.14)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:11, fontWeight:600 }}>{m}</button>
              ))}
            </div>
            <button onClick={()=>setPlanPicker(null)} style={{ width:'100%', marginTop:8, padding:'8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', background:'transparent', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:10 }}>Отмена</button>
          </div>
        </div>
      )}
      {toast && <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:300, padding:'10px 16px', borderRadius:12, background:'#202023', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontSize:11, fontWeight:600, boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>{toast}</div>}

      {/* Create modal */}
      {showRecipeModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)' }} onClick={() => setShowRecipeModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:440, maxHeight:'86vh', overflowY:'auto', padding:16, borderRadius:18, background:'#18181b', border:'1px solid rgba(0,230,138,0.14)', boxShadow:'0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#00e68a,#00c8a0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🍳</span>
              <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Создать рецепт</div>
              <button onClick={() => setShowRecipeModal(false)} style={{ marginLeft:'auto', width:28, height:28, borderRadius:999, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div><div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:4, letterSpacing:0.4, textTransform:'uppercase' }}>Название</div><input value={recName} onChange={e => setRecName(e.target.value)} placeholder="Например: Овсяноблин Power" style={inputStyle} /></div>
              <div><div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:4, letterSpacing:0.4, textTransform:'uppercase' }}>Ингредиенты (по одному на строку)</div><textarea value={recIngredients} onChange={e => setRecIngredients(e.target.value)} placeholder={"Яйца 2 шт\nОвсянка 30 г\nТворог 50 г"} style={{ ...inputStyle, resize:'vertical', minHeight:72, fontSize:11 }} rows={3} /></div>
              <div><div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:4, letterSpacing:0.4, textTransform:'uppercase' }}>Приготовление</div><textarea value={recInstructions} onChange={e => setRecInstructions(e.target.value)} placeholder="Коротко шаги..." style={{ ...inputStyle, resize:'vertical', minHeight:60, fontSize:11 }} rows={3} /></div>
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:6, letterSpacing:0.4, textTransform:'uppercase' }}>КБЖУ на порцию</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
                  {[
                    { l:'Ккал', v: recKcal, s: setRecKcal, c:'#00e68a' },
                    { l:'Белки', v: recProtein, s: setRecProtein, c:'#60a5fa' },
                    { l:'Жиры', v: recFat, s: setRecFat, c:'#fbbf24' },
                    { l:'Углеводы', v: recCarbs, s: setRecCarbs, c:'#fb923c' },
                  ].map(m => (
                    <div key={m.l} style={{ textAlign:'center', background:'#202023', borderRadius:12, padding:'8px 4px', border:`1px solid ${m.c}18` }}>
                      <input type="number" value={m.v || ''} onChange={e => m.s(+e.target.value || 0)} placeholder="0" style={{ width:'100%', padding:'6px 2px', borderRadius:8, fontSize:13, fontWeight:800, textAlign:'center', background:'#18181b', border:`1px solid ${m.c}20`, color:m.c, outline:'none', boxSizing:'border-box' }} />
                      <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.45)', marginTop:4, letterSpacing:0.4, textTransform:'uppercase' }}>{m.l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={saveRecipe} style={{ width:'100%', padding:'12px', borderRadius:12, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#00e68a,#00c8a0)', color:'#000', fontSize:12, fontWeight:800, boxShadow:'0 6px 16px rgba(0,230,138,0.25)' }}>✓ Сохранить рецепт</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
