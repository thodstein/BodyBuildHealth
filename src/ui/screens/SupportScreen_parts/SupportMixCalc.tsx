// @ts-nocheck
/**
 * SupportMixCalc.tsx — извлечено из SupportScreen.tsx
 * Секция: section === 'info' && tab === 'main' && supportView === 'calc' && calcView === 'mixcalc'
 */
import React from 'react';
import { PopupBool, PopupNumber, PopupSelect } from '../../components/PopupXxx';
import { calculateMixScore, type TrainingMixScore, type MixSubstance, type MixProfile, MIX_MECHANISMS, MIX_SYNERGY, MIX_TEMPLATES, type MixTemplate, buildBestRecipe, type MixRecipe, type MixRecipeItem, groupRecipeItemsByTiming, buildDefaultStack, resolveTemplateItems } from '../../../engines/training-mix-scoring.engine';
import { InfoErrorBoundary } from './SupportScreenData';

export const SupportMixCalc: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    mixGoals,
    setMixGoals,
    mixTiming,
    setMixTiming,
    mixInsulin,
    setMixInsulin,
    mixInsulinTiming,
    setMixInsulinTiming,
    mixDrugIGF,
    setMixDrugIGF,
    mixDrugIGFTiming,
    setMixDrugIGFTiming,
    mixDrugGH,
    setMixDrugGH,
    mixDrugGHTiming,
    setMixDrugGHTiming,
    mixDrugMGF,
    setMixDrugMGF,
    mixDrugMGFTiming,
    setMixDrugMGFTiming,
    mixDrugGLP1,
    setMixDrugGLP1,
    mixWorkoutType,
    setMixWorkoutType,
    mixTimeOfDay,
    setMixTimeOfDay,
    customRecipeOverrides,
    setCustomRecipeOverrides,
    mixSavedRecipes,
    setMixSavedRecipes,
    appliedTemplate,
    setAppliedTemplate,
    customMixItems,
    setCustomMixItems,
    mixHistory,
    setMixHistory,
    linked
  } = s;

  return (
        <div style={{ padding:'0 12px 80px', maxWidth:600, margin:'0 auto' }}>
          <h2 style={{ margin:'0 0 2px', fontSize:16, fontWeight:800, color:'var(--accent)' }}>💪 Тренировочные миксы</h2>
          <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 12px' }}>Подбор пред-/интра-/пост-тренировочных стеков по цели и весу</p>

          <div className="card" style={{ marginBottom:10, padding:10 }}>
            <h4 style={{ margin:'0 0 8px', fontSize:11, color:'var(--text)' }}>⚙️ Параметры</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
              <div>
                <div style={{fontSize:8,fontWeight:600,color:'var(--text-dim)',marginBottom:4}}>🎯 Цели (можно несколько)</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {[{id:'pump',label:'🩸 Памп'},{id:'endurance',label:'🏃 Выносл.'},{id:'strength',label:'🏋️ Сила'},{id:'recovery',label:'🔄 Восст.'},{id:'focus',label:'🧠 Фокус'},{id:'powerlifting',label:'💪 ПЛ'},{id:'competition',label:'🏆 Сорев.'},{id:'crossfit',label:'🔁 CF'},{id:'post_comp',label:'🔄 Пост-сор.'},{id:'hiit',label:'💨 HIIT'},{id:'mma',label:'🥊 MMA'},{id:'sprint',label:'🏃 Спринт'}].map((o: any) => (
                    <div key={o.id} onClick={() => setMixGoals(prev => prev.includes(o.id) ? prev.filter((g: any) => g !== o.id) : [...prev, o.id])} style={{padding:'3px 7px',borderRadius:8,cursor:'pointer',fontSize:7,fontWeight:600,background:mixGoals.includes(o.id)?'rgba(139,92,246,0.2)':'rgba(255,255,255,0.04)',border:mixGoals.includes(o.id)?'1px solid rgba(139,92,246,0.4)':'1px solid rgba(255,255,255,0.08)',color:mixGoals.includes(o.id)?'#a78bfa':'rgba(255,255,255,0.7)',transition:'all 0.15s'}}>{o.label}</div>
                  ))}
                </div>
                {mixGoals.length > 1 && <div style={{fontSize:7,color:'#f59e0b',marginTop:2}}>Выбрано {mixGoals.length} целей · скор = среднее</div>}
              </div>
              <PopupSelect label="⏰ Тайминг" value={mixTiming} options={[{id:'pre',label:'🔥 Пред-тренировочный'},{id:'intra',label:'💧 Интра-тренировочный'},{id:'post',label:'🍗 Пост-тренировочный'}]} onChange={setMixTiming} />
            </div>
            <div style={{ marginBottom:8 }}>
              <PopupNumber label="⚖️ Вес тела (кг)" value={linked.profile?.settings?.weight ?? 80} min={40} max={200} suffix="кг" onChange={()=>{}} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
              <PopupSelect label="🏋️ Тип тренировки" value={mixWorkoutType} options={[{id:'heavy',label:'🏋️ Тяжёлая (присед/тяга)'},{id:'moderate',label:'🏃 Средняя (подсобка)'},{id:'light',label:'🩸 Лёгкая (пампинг)'}]} onChange={v=>setMixWorkoutType(v as any)} />
              <PopupSelect label="🌅 Время суток" value={mixTimeOfDay} options={[{id:'morning',label:'🌅 Утро (6-12)'},{id:'afternoon',label:'☀️ День (12-18)'},{id:'evening',label:'🌙 Вечер (18-24)'}]} onChange={v=>setMixTimeOfDay(v as any)} />
            </div>
            <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:6 }}>💉 Фармакология (влияет на скор)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
              <PopupNumber label={mixInsulin>0?'💉 Инсулин ✓':'💉 Инсулин'} value={mixInsulin} min={0} max={20} step={1} suffix="ЕД" onChange={setMixInsulin} />
              <PopupNumber label={mixDrugIGF>0?'🧬 ИГФ-1 ✓':'🧬 ИГФ-1'} value={mixDrugIGF} min={0} max={100} step={10} suffix="мкг" onChange={setMixDrugIGF} />
              <PopupNumber label={mixDrugGH>0?'💉 ГР ✓':'💉 ГР'} value={mixDrugGH} min={0} max={15} step={1} suffix="МЕ" onChange={setMixDrugGH} />
              <PopupNumber label={mixDrugMGF>0?'🧬 МГФ ✓':'🧬 МГФ'} value={mixDrugMGF} min={0} max={500} step={50} suffix="мкг" onChange={setMixDrugMGF} />
              <PopupBool label="💊 ГПП-1" value={mixDrugGLP1} onChange={setMixDrugGLP1} />
            </div>
            {(mixInsulin>0 || mixDrugIGF>0 || mixDrugGH>0 || mixDrugMGF>0) && (
              <div style={{ fontSize:7, color:'#8b5cf6', marginBottom:6, lineHeight:1.3 }}>
                {mixInsulin>0 && <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                  <span>• Инсулин {mixInsulin}ЕД ·</span>
                  <select value={mixInsulinTiming} onChange={e=>setMixInsulinTiming(e.target.value as any)} style={{fontSize:7,padding:'1px 4px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
                    <option value="pre">перед тренировкой</option>
                    <option value="post">после тренировки</option>
                  </select>
                </div>}
                {mixDrugIGF>0 && <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                  <span>• ИГФ-1 {mixDrugIGF}мкг ·</span>
                  <select value={mixDrugIGFTiming} onChange={e=>setMixDrugIGFTiming(e.target.value as any)} style={{fontSize:7,padding:'1px 4px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
                    <option value="pre">перед тренировкой</option>
                    <option value="post">после тренировки</option>
                  </select>
                </div>}
                {mixDrugGH>0 && <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                  <span>• ГР {mixDrugGH}МЕ ·</span>
                  <select value={mixDrugGHTiming} onChange={e=>setMixDrugGHTiming(e.target.value as any)} style={{fontSize:7,padding:'1px 4px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
                    <option value="pre">перед тренировкой</option>
                    <option value="post">после тренировки</option>
                  </select>
                </div>}
                {mixDrugMGF>0 && <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                  <span>• МГФ {mixDrugMGF}мкг ·</span>
                  <select value={mixDrugMGFTiming} onChange={e=>setMixDrugMGFTiming(e.target.value as any)} style={{fontSize:7,padding:'1px 4px',borderRadius:4,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.2)',color:'#a78bfa'}}>
                    <option value="pre">перед тренировкой</option>
                    <option value="post">после тренировки</option>
                  </select>
                </div>}
              </div>
            )}
            {(mixInsulin>0 || mixDrugIGF>0 || mixDrugGH>0 || mixDrugMGF>0 || mixDrugGLP1) && (
              <span onClick={()=>{setMixInsulin(0);setMixDrugIGF(0);setMixDrugGH(0);setMixDrugMGF(0);setMixDrugGLP1(false);setCustomRecipeOverrides({removed:[],replaced:{}});localStorage.removeItem('he_mix_recipe_overrides');}}
                style={{fontSize:7,color:'#ef4444',cursor:'pointer',marginLeft:6,textDecoration:'underline'}}>✕ Очистить фарму</span>
            )}
            <button onClick={() => {
              const course = linked.course || [];
              const detect = (kw: string) => course.some((c:any) => (c.substanceId||'').toLowerCase().includes(kw.toLowerCase()));
              let found = false;
              if (detect('insulin')||detect('humalog')||detect('novorapid')||detect('lantus')) { setMixInsulin(5); setMixInsulinTiming('post'); found=true; }
              if (detect('igf')||detect('igf1')||detect('mecasermin')) { setMixDrugIGF(50); setMixDrugIGFTiming('post'); found=true; }
              if (detect('hgh')||detect('somatropin')||detect('genotropin')||detect('ghrp')||detect('cjc')) { setMixDrugGH(5); setMixDrugGHTiming('pre'); found=true; }
              if (detect('mgf')||detect('mechano')) { setMixDrugMGF(200); setMixDrugMGFTiming('post'); found=true; }
              if (detect('semaglutide')||detect('tirzepatide')||detect('liraglutide')||detect('dulaglutide')||detect('glp')) { setMixDrugGLP1(true); found=true; }
              try {
                const calcData = JSON.parse(localStorage.getItem('he_autocalc_state') || '{}');
                if (calcData.pharma?.hasInsulin && mixInsulin===0) { setMixInsulin(5); setMixInsulinTiming('post'); found=true; }
                if (calcData.pharma?.hasIGF && !mixDrugIGF) { setMixDrugIGF(50); setMixDrugIGFTiming('post'); found=true; }
                if (calcData.pharma?.hasGH && !mixDrugGH) { setMixDrugGH(5); setMixDrugGHTiming('pre'); found=true; }
                if (calcData.pharma?.hasMGF && !mixDrugMGF) { setMixDrugMGF(200); setMixDrugMGFTiming('post'); found=true; }
                if (calcData.pharma?.hasGLP1 && !mixDrugGLP1) { setMixDrugGLP1(true); found=true; }
                if (calcData.goals?.trainingCycle) {
                  const goalMap: Record<string,string> = { mass:'pump', cut:'endurance', maintenance:'recovery', endurance:'endurance', strength:'powerlifting' } as any;
                  if (goalMap[calcData.goals.trainingCycle]) setMixGoals([goalMap[calcData.goals.trainingCycle]]);
                }
              } catch {}
              if (found) alert('✅ Фармакология определена из курса и профиля');
            }} style={{ width:'100%', padding:'6px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:600, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)', color:'#00e68a', marginBottom:8 }}>📋 Автозаполнение из профиля (фарма + цель)</button>
            {(() => {
              const bw = linked.profile?.settings?.weight ?? 80;
              const hasCourse = (linked.course || []).length > 0;
              const isOnCycle = hasCourse;
              const multiplier = isOnCycle ? 1.25 : 1.0;
              const isPre = mixTiming === 'pre';
              const isIntra = mixTiming === 'intra';
              const isPost = mixTiming === 'post';
              const avgMin = linked.profile?.settings?.avgWorkoutMinutes ?? 90;
              const durHrs = (mixGoal === 'endurance' ? Math.max(1.5, avgMin/60) : Math.min(2, avgMin/60)) || 1.5;

              const isPL = mixGoal === 'powerlifting' || mixGoal === 'competition';
              const isCompetition = mixGoal === 'competition';
              const isStrengthGoal = mixGoal === 'strength';
              const isPumpGoal = mixGoal === 'pump';
              const isFocusGoal = mixGoal === 'focus';
              const isEnduranceGoal = mixGoal === 'endurance';
              const isRecoveryGoal = mixGoal === 'recovery';
              const isHIIT = mixGoal === 'hiit';
              const isMMA = mixGoal === 'mma';
              const isSprint = mixGoal === 'sprint';
              const isPostComp = mixGoal === 'post_comp';
              const stackSource = (timing: 'pre'|'intra'|'post'): { name: string; id: string; dose: string; unit: string; note: string; mg: number }[] => {
                const tmplItems = timing === 'pre' ? appliedTemplate?.pre : timing === 'intra' ? appliedTemplate?.intra : appliedTemplate?.post;
                if (tmplItems?.length) return resolveTemplateItems(tmplItems, multiplier, bw);
                return buildDefaultStack(mixGoal, timing, bw, multiplier, durHrs, isCompetition);
              };
              const preStack = stackSource('pre');
              const intraStack = stackSource('intra');
              const postStack = stackSource('post');
              const activeStack = isPre ? preStack : isIntra ? intraStack : postStack;
              // Recipe engine — build best recipe from active drugs
              const drugProfile = { weightKg: bw, drugs: { insulin: mixInsulin>0, insulinDose: mixInsulin, insulinTiming: mixInsulinTiming, igf: mixDrugIGF>0, igfDose: mixDrugIGF, igfTiming: mixDrugIGFTiming, gh: mixDrugGH>0, ghDose: mixDrugGH, ghTiming: mixDrugGHTiming, mgf: mixDrugMGF>0, mgfDose: mixDrugMGF, mgfTiming: mixDrugMGFTiming, glp1: mixDrugGLP1 } };
              const recipeResult = buildBestRecipe(drugProfile as any as MixProfile);
              const drugItems = recipeResult ? recipeResult.items : [];
              // Apply custom overrides (removed + replaced) to drug items
              let effectiveDrugItems = drugItems.filter((item: any) => !customRecipeOverrides.removed.includes(`${item.id}_${item.timing}`));
              for (let i = 0; i < effectiveDrugItems.length; i++) {
                const key = `${effectiveDrugItems[i].id}_${effectiveDrugItems[i].timing}`;
                const repl = customRecipeOverrides.replaced[key];
                if (repl) {
                  effectiveDrugItems[i] = { ...effectiveDrugItems[i], ...repl, timing: effectiveDrugItems[i].timing };
                }
              }
              const groupedEffectiveDrugItems = groupRecipeItemsByTiming(effectiveDrugItems);
              // Merge into current timing
              const timedDrugItemsX = groupedEffectiveDrugItems[isPre ? 'pre' : isIntra ? 'intra' : 'post'] || [];
              // Deduplicate by id — drug overrides base stack items
              const stackMap2 = new Map<string, typeof activeStack[0]>();
              for (const item of activeStack) stackMap2.set(item.id, item);
              for (const item of timedDrugItemsX) stackMap2.set(item.id, { name: item.id, ...item });
              const dedupedStack = [...stackMap2.values()];
              // Add custom items that match current timing
              const timingKey = isPre ? 'pre' as const : isIntra ? 'intra' as const : 'post' as const;
              for (const ci of customMixItems) {
                if (ci.timing === timingKey) {
                  const exist = dedupedStack.find((d: any) => d.id === ci.id);
                  if (!exist) dedupedStack.push({ name: ci.name, id: ci.id, dose: ci.dose, unit: ci.unit, note: 'Своё вещество', mg: ci.mg });
                }
              }
              // Drug-augment all three stacks for overview
              const augStack = (items: typeof activeStack, timing: 'pre'|'intra'|'post') => {
                const m = new Map<string, typeof activeStack[0]>();
                for (const item of items) m.set(item.id, item);
                for (const item of groupedEffectiveDrugItems[timing] || []) m.set(item.id, { name: item.id, ...item });
                return [...m.values()];
              };
              const allStacks = { pre: augStack(preStack, 'pre'), intra: augStack(intraStack, 'intra'), post: augStack(postStack, 'post') };
              const stackTitle = isPre ? '🔥 Пред-тренировочный стек' : isIntra ? '💧 Интра-тренировочный стек' : '🍗 Пост-тренировочный стек';
              const timingLabel = isPre ? 'За 30-60 мин до тренировки' : isIntra ? 'В течение тренировки (каждые 15-20 мин)' : 'Сразу после тренировки';
              // Synergy warnings: template ↔ recipe conflicts
              const synWarnings: string[] = [];
              if (appliedTemplate && timedDrugItemsX.length > 0) {
                const templateIds = new Set([...(appliedTemplate.pre||[]).map((i: any) =>i.id),...(appliedTemplate.intra||[]).map((i: any) =>i.id),...(appliedTemplate.post||[]).map((i: any) =>i.id)].filter(Boolean));
                const recipeIds = new Set(timedDrugItemsX.map((i: any) =>i.id));
                const duplicates = [...templateIds].filter((id: any) => recipeIds.has(id));
                if (duplicates.length > 0) {
                  const names = duplicates.map((id: any) => { const e=SUPPORT_CATALOG_DATA[id]; return e?.nameRu||e?.name||id; }).filter(Boolean);
                  synWarnings.push('⚠ Одинаковые вещества в шаблоне и рецепте: ' + names.join(', ') + ' — рецепт приоритетен (доза из рецепта)');
                }
                const highDosePair: { a: string; b: string; id: string }[] = [];
                for (const id of ['caffeine','beta_alanine','citrulline','creatine','taurine','glycerol','l_carnitine','alpha_gpc','agmatine','tyrosine']) {
                  const inTmpl = (appliedTemplate.pre||[]).some((i: any) =>i.id===id)||(appliedTemplate.intra||[]).some((i: any) =>i.id===id)||(appliedTemplate.post||[]).some((i: any) =>i.id===id);
                  const inRecipe = timedDrugItemsX.some((i: any) =>i.id===id);
                  if (inTmpl && inRecipe) highDosePair.push({ a:'шаблон', b:'рецепт', id });
                }
                if (highDosePair.length > 0) synWarnings.push('⚠ Препараты дублируются (' + highDosePair.map((p: any) =>p.id).join(', ') + ') — суммарная доза может превышать рекомендуемую');
              }
              // ACWR-readiness коррекция
              const _srpe = loadSRPESessions();
              const _acwr = _srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(_srpe)) : null;
              const acwrWarnings: string[] = [];
              if (_acwr) {
                if (_acwr.ratio > 1.5) acwrWarnings.push('🚨 ACWR ' + _acwr.ratio.toFixed(2) + ' — опасная зона (перетрен). Снизьте стимуляторы, добавьте восстановители: ашваганда 600 мг, глицин 3 г, ZMA, магний 400 мг');
                else if (_acwr.ratio > 1.3) acwrWarnings.push('⚠️ ACWR ' + _acwr.ratio.toFixed(2) + ' — высокая нагрузка. Рассмотрите цитруллин 6 г для NO + бета-аланин 3.2 г для буферизации + магний 200 мг');
                else if (_acwr.ratio < 0.8) acwrWarnings.push('📈 ACWR ' + _acwr.ratio.toFixed(2) + ' — недотрен. Можно усилить стимуляторы: кофеин 400 мг, тирозин 2 г, ALCAR 1.5 г, креатин 10 г для загрузки');
              }

              const hasNandrolone = (linked.course || []).some((c:any) => {
                const id = (c.substanceId||'').toLowerCase();
                return id.includes('nandrolon') || id.includes('npp') || id.includes('deca') || id.includes('trest');
              });
              const na = (linked.labs || []).find((l:any)=>l.code==='SODIUM')?.value || 140;
              const k = (linked.labs || []).find((l:any)=>l.code==='POTASSIUM')?.value || 4.2;
              const cl = (linked.labs || []).find((l:any)=>l.code==='CHLORIDE')?.value || 102;

              const mixSubstances: MixSubstance[] = dedupedStack.filter((s: any) =>s.mg>0).map((s: any) =>({ id:s.id, name:s.name, doseMg:s.mg }));
              // Multi-goal score calculation
              const scoresByGoal = mixGoals.map((g: any) => {
                const p: MixProfile = { goal: g as any, timing: mixTiming as any, weightKg: bw, isOnCycle, drugs: { insulin: mixInsulin>0, igf: mixDrugIGF>0, gh: mixDrugGH>0, mgf: mixDrugMGF>0, glp1: mixDrugGLP1, insulinDose: mixInsulin, insulinTiming: mixInsulinTiming, igfDose: mixDrugIGF, igfTiming: mixDrugIGFTiming, ghDose: mixDrugGH, ghTiming: mixDrugGHTiming, mgfDose: mixDrugMGF, mgfTiming: mixDrugMGFTiming }, hasNandrolone, userElectrolytes: { sodiumMmolL: na, potassiumMmolL: k, chlorideMmolL: cl }, workoutType: mixWorkoutType, timeOfDay: mixTimeOfDay, workoutDurationMin: Math.round(durHrs*60) };
                return { goal: g, score: calculateMixScore(mixSubstances, p) };
              });
              // Average scores across goals
              const avg = (arr: number[]) => Math.round(arr.reduce((s: any, v: any) => s+v, 0) / arr.length);
              const score: TrainingMixScore = {
                ...scoresByGoal[0].score,
                pumpScore: avg(scoresByGoal.map((s: any) => s.score.pumpScore)),
                energyScore: avg(scoresByGoal.map((s: any) => s.score.energyScore)),
                focusScore: avg(scoresByGoal.map((s: any) => s.score.focusScore)),
                strengthScore: avg(scoresByGoal.map((s: any) => s.score.strengthScore)),
                hydrationScore: avg(scoresByGoal.map((s: any) => s.score.hydrationScore)),
                enduranceScore: avg(scoresByGoal.map((s: any) => s.score.enduranceScore)),
                anticatabolicScore: avg(scoresByGoal.map((s: any) => s.score.anticatabolicScore)),
                recoveryScore: avg(scoresByGoal.map((s: any) => s.score.recoveryScore)),
                proteinScore: avg(scoresByGoal.map((s: any) => s.score.proteinScore)),
                glycogenScore: avg(scoresByGoal.map((s: any) => s.score.glycogenScore)),
                noScore: avg(scoresByGoal.map((s: any) => s.score.noScore)),
                compositeScore: avg(scoresByGoal.map((s: any) => s.score.compositeScore)),
                label: mixGoals.length > 1 ? `среднее ${mixGoals.length} целей` : scoresByGoal[0].score.label,
                color: scoresByGoal[0].score.color,
                suggestions: [...new Set(scoresByGoal.flatMap((s: any) => s.score.suggestions))],
                electrolyteWarnings: [...new Set(scoresByGoal.flatMap((s: any) => s.score.electrolyteWarnings))],
                drugModifiers: mixGoals.length > 1 ? scoresByGoal[0].score.drugModifiers : scoresByGoal[0].score.drugModifiers,
                substanceBreakdown: scoresByGoal[0].score.substanceBreakdown,
              };
              // Build comparison score for opposite timing
              const compareTiming = mixTiming === 'pre' ? 'intra' : mixTiming === 'intra' ? 'pre' : 'pre';
              const compareProfile: MixProfile = { goal: mixGoal as any, timing: compareTiming as MixProfile['timing'], weightKg: bw, isOnCycle, drugs: score.drugModifiers as any, hasNandrolone, userElectrolytes: { sodiumMmolL: na, potassiumMmolL: k, chlorideMmolL: cl }, workoutType: mixWorkoutType, timeOfDay: mixTimeOfDay, workoutDurationMin: Math.round(durHrs*60) };
              const compareScore = calculateMixScore(mixSubstances, compareProfile);

              const ScoreRow = ({ l, v, c }: { l: string; v: number; c: string }) => (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.8)', minWidth:100 }}>{l}</span>
                  <div style={{ flex:1, height:5, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ width:`${Math.min(100,v)}%`, height:'100%', borderRadius:3, background:c, transition:'width 0.5s' }}/>
                  </div>
                  <span style={{ fontSize:8, fontWeight:700, color:c, minWidth:24, textAlign:'right' }}>{v}</span>
                </div>
              );

              return (<>
                {isOnCycle && <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', fontSize:9, color:'#a78bfa', marginBottom:8 }}>🔥 На курсе: дозы ×{multiplier}. Скор увеличен на 25%.</div>}

                <div className="card" style={{ marginBottom:10, padding:12, background:'linear-gradient(135deg, rgba(0,230,138,0.04), rgba(139,92,246,0.04))', border:'1px solid var(--glass-border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:24 }}>{isPre?'🔥':isIntra?'💧':'🍗'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{stackTitle} {effectiveDrugItems.length > 0 && groupedEffectiveDrugItems[isPre ? 'pre' : isIntra ? 'intra' : 'post']?.length > 0 && <span style={{fontSize:7,color:'#22c55e',background:'rgba(34,197,94,0.1)',padding:'1px 4px',borderRadius:4}}>🧪 рецепт</span>}</div>
                      <div style={{ fontSize:8, color:'var(--text-dim)' }}>{timingLabel}</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:800, color:score.color }}>{score.compositeScore}</div>
                      <div style={{ fontSize:7, color:score.color }}>{score.label}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                    <button onClick={()=>{
                      const entry={goal:mixGoal,timing:mixTiming,type:mixWorkoutType,tod:mixTimeOfDay,score:score.compositeScore,label:score.label,date:new Date().toLocaleDateString('ru-RU')};
                      const updated=[...mixHistory,entry].slice(-20);setMixHistory(updated);
                      localStorage.setItem('he_training_mixes',JSON.stringify(updated));
                    }} style={{flex:1,padding:'4px',borderRadius:6,cursor:'pointer',fontSize:8,fontWeight:600,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa'}}>💾 Сохранить тайминг</button>
                    <button onClick={()=>{
                      const kit = {
                        id: Date.now(),
                        type: 'mix',
                        goal: mixGoal,
                        workoutType: mixWorkoutType,
                        timeOfDay: mixTimeOfDay,
                        isOnCycle,
                        multiplier,
                        bw,
                        pre: preStack.filter((s: any) =>s.mg>0),
                        intra: intraStack.filter((s: any) =>s.mg>0),
                        post: postStack.filter((s: any) =>s.mg>0),
                        date: new Date().toISOString(),
                      };
                      try {
                        const arr: any[] = JSON.parse(localStorage.getItem('he_saved_calc_results') || '[]');
                        arr.push(kit);
                        localStorage.setItem('he_saved_calc_results', JSON.stringify(arr));
                        setPlanSaved('✅ Комплект сохранён в Избранное → Миксы');
                        setTimeout(() => setPlanSaved(''), 3000);
                      } catch {}
                    }} style={{padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:8,fontWeight:600,background:'rgba(0,230,138,0.08)',border:'1px solid rgba(0,230,138,0.15)',color:'#00e68a'}}>💾 Комплект</button>
                    <button onClick={()=>{
                      const plan = {
                        id: Date.now(),
                        name: prompt('Название плана:', mixGoal + ' микс') || mixGoal + ' микс',
                        goal: mixGoal,
                        timing: mixTiming,
                        workoutType: mixWorkoutType,
                        timeOfDay: mixTimeOfDay,
                        isOnCycle,
                        multiplier,
                        bw,
                        insulin: mixInsulin, insulinTiming: mixInsulinTiming,
                        igf: mixDrugIGF, igfTiming: mixDrugIGFTiming,
                        gh: mixDrugGH, ghTiming: mixDrugGHTiming,
                        mgf: mixDrugMGF, mgfTiming: mixDrugMGFTiming,
                        glp1: mixDrugGLP1,
                        appliedTemplate: appliedTemplate ? { id: appliedTemplate.id, name: appliedTemplate.name } : null,
                        pre: preStack.filter((s: any) =>s.mg>0),
                        intra: intraStack.filter((s: any) =>s.mg>0),
                        post: postStack.filter((s: any) =>s.mg>0),
                        score: score.compositeScore,
                        label: score.label,
                        date: new Date().toISOString(),
                      };
                      if (!plan.name) return;
                      const arr = [...mixSavedPlans, plan].slice(-30);
                      setMixSavedPlans(arr);
                      localStorage.setItem('he_mix_saved_plans', JSON.stringify(arr));
                      setPlanSaved('✅ План сохранён');
                      setTimeout(() => setPlanSaved(''), 3000);
                    }} style={{padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:8,fontWeight:600,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',marginLeft:4}}>📋 План</button>
                    <button onClick={()=>{
                      const subsSet = new Set(enhancedSubs);
                      const mixItems = [...preStack.filter((s: any) =>s.id&&s.mg>0), ...intraStack.filter((s: any) =>s.id&&s.mg>0), ...postStack.filter((s: any) =>s.id&&s.mg>0)];
                      mixItems.forEach((s: any) => subsSet.add(s.id));
                      (customMixItems||[]).forEach((s: any) => subsSet.add(s.id));
                      setEnhancedSubs([...subsSet]);
                      setTimeout(() => calcSupport(supportLevel), 50);
                      setPlanSaved('✅ Микс добавлен в план поддержки');
                      setTimeout(() => setPlanSaved(''), 3000);
                    }} style={{padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:8,fontWeight:600,background:'rgba(255,183,77,0.08)',border:'1px solid rgba(255,183,77,0.15)',color:'#ffb74d',marginLeft:4}}>➕ План подд.</button>
                    {mixHistory.length>0&&<button onClick={()=>{setMixHistory([]);localStorage.setItem('he_training_mixes','[]')}} style={{padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:8,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.1)',color:'#ef4444'}}>✕</button>}
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {dedupedStack.map((item: any, i: any) =>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0' }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
                        <div style={{ flex:1, fontSize:10 }}>
                          <span style={{ color:'var(--text-light)' }}>{item.name}</span>
                          <span style={{ color:'var(--text-dim)', fontSize:8, marginLeft:4 }}>— {item.note}</span>
                        </div>
                        <span style={{ fontSize:10, fontWeight:600, color:'#00e68a', whiteSpace:'nowrap' }}>{item.dose}{item.unit?' '+item.unit:''}</span>
                      </div>
                    ))}
                    <div style={{display:'flex',gap:4,marginTop:2}}>
                      <span onClick={()=>setShowCustomPicker(!showCustomPicker)} style={{fontSize:7,color:'var(--accent)',cursor:'pointer',padding:'2px 6px',borderRadius:4,border:'1px solid rgba(0,230,138,0.2)'}}>➕ Своё вещество</span>
                      {customMixItems.some((ci: any) => ci.timing === (isPre ? 'pre' : isIntra ? 'intra' : 'post')) && (
                        <span onClick={()=>{const arr=customMixItems.filter((ci: any) =>ci.timing!==(isPre?'pre':isIntra?'intra':'post'));setCustomMixItems(arr);localStorage.setItem('he_mix_custom_items',JSON.stringify(arr));}} style={{fontSize:7,color:'#ef4444',cursor:'pointer',padding:'2px 6px',borderRadius:4}}>✕ Убрать свои</span>
                      )}
                    </div>
                    {showCustomPicker && (
                      <div style={{marginTop:4,padding:8,borderRadius:6,background:'rgba(0,0,0,0.1)',border:'1px solid rgba(255,255,255,0.04)'}}>
                        <div style={{fontSize:8,color:'var(--text-dim)',marginBottom:4}}>Выберите вещество и дозу для <b>{isPre ? 'pre' : isIntra ? 'intra' : 'post'}</b>:</div>
                        <input list="custom-mix-subs" value={customMixSubstance} onChange={e=>setCustomMixSubstance(e.target.value)}
                          placeholder="id вещества (напр. creatine)" style={{width:'100%',padding:'4px 6px',fontSize:8,borderRadius:4,background:'rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.06)',color:'var(--text-light)'}} />
                        <datalist id="custom-mix-subs">
                          {customMixSubstances.slice(0,200).map((s: any) =><option key={s.id} value={s.id}>{s.name}</option>)}
                        </datalist>
                        <div style={{display:'flex',gap:4,marginTop:4,alignItems:'center'}}>
                          <input type="number" value={customMixDoseMg||''} onChange={e=>setCustomMixDoseMg(Number(e.target.value))}
                            placeholder="Доза (мг)" style={{flex:1,padding:'4px 6px',fontSize:8,borderRadius:4,background:'rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.06)',color:'var(--text-light)'}} />
                          <button onClick={()=>{
                            if (!customMixSubstance || !customMixDoseMg) return;
                            const entry = SUPPORT_CATALOG_DATA[customMixSubstance.toLowerCase()];
                            const name = (entry as any)?.name || (entry as any)?.ru || customMixSubstance;
                            const mg = Math.round(customMixDoseMg);
                            const doseStr = mg >= 1000 ? `${(mg/1000).toFixed(1)}` : `${mg}`;
                            const unit = mg >= 1000 ? 'г' : 'мг';
                            const newItem = { timing: timingKey, id: customMixSubstance.toLowerCase(), name, dose: doseStr, unit, mg };
                            const arr = [...customMixItems.filter((ci: any) =>!(ci.id===newItem.id&&ci.timing===newItem.timing)), newItem];
                            setCustomMixItems(arr);
                            localStorage.setItem('he_mix_custom_items', JSON.stringify(arr));
                            setCustomMixSubstance(''); setCustomMixDoseMg(0);
                          }} style={{padding:'4px 8px',borderRadius:4,fontSize:8,background:'rgba(0,230,138,0.1)',border:'1px solid rgba(0,230,138,0.2)',color:'#00e68a',cursor:'pointer'}}>✓</button>
                        </div>
                        {customMixItems.filter((ci: any) =>ci.timing===timingKey).map((ci: any, i: any) =>(
                          <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:7,color:'var(--text-dim)',marginTop:2,padding:'2px 4px',background:'rgba(255,255,255,0.02)',borderRadius:4}}>
                            <span>{ci.name}</span>
                            <span style={{color:'#00e68a'}}>{ci.dose}{ci.unit?' '+ci.unit:''} <span onClick={()=>{const arr=customMixItems.filter((_: any, idx: any) =>idx!==(customMixItems.indexOf(ci)));setCustomMixItems(arr);localStorage.setItem('he_mix_custom_items',JSON.stringify(arr));}} style={{color:'#ef4444',cursor:'pointer'}}>✕</span></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.12)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', marginBottom:6 }}>📊 Разбор скора ({score.compositeScore}/100) ↔ {compareScore.compositeScore}/100 ({compareTiming === 'pre' ? '🔥 Pre' : compareTiming === 'intra' ? '💧 Intra' : '🍗 Post'})</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                    <div style={{flex:1,height:6,borderRadius:3,background:'rgba(255,255,255,0.05)'}}>
                      <div style={{height:6,borderRadius:3,width:`${score.compositeScore}%`,background:'#8b5cf6',transition:'width 0.3s'}} />
                    </div>
                    <span style={{fontSize:8,color:'#8b5cf6',fontWeight:700}}>{score.compositeScore}</span>
                    <span style={{fontSize:7,color:'var(--text-dim)'}}>vs</span>
                    <span style={{fontSize:8,color:'#f59e0b',fontWeight:700}}>{compareScore.compositeScore}</span>
                    <div style={{flex:1,height:6,borderRadius:3,background:'rgba(255,255,255,0.05)'}}>
                      <div style={{height:6,borderRadius:3,width:`${compareScore.compositeScore}%`,background:'#f59e0b',transition:'width 0.3s'}} />
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {isPre && (() => {
                      const preRows = [
                        ...(isPumpGoal ? [{ l:'🩸 Памп (NO)', v:score.pumpScore, c:'#ef4444' }] : []),
                        ...(isStrengthGoal || isPL ? [{ l:'🏋️ Сила', v:score.strengthScore, c:'#22c55e' }] : []),
                        ...(isEnduranceGoal || mixGoal === 'crossfit' ? [{ l:'🏃 Выносливость', v:score.enduranceScore, c:'#f97316' }] : []),
                        ...(isFocusGoal ? [{ l:'🧠 Фокус', v:score.focusScore, c:'#8b5cf6' }] : []),
                        ...(isRecoveryGoal ? [{ l:'🔄 Восстановление', v:score.recoveryScore, c:'#22c55e' }] : []),
                        ...(isHIIT || mixGoal === 'sprint' ? [{ l:'💨 Анаэробная', v:score.strengthScore, c:'#22c55e' }] : []),
                        ...(isHIIT ? [{ l:'🏃 Выносливость', v:score.enduranceScore, c:'#f97316' }] : []),
                        ...(isMMA ? [{ l:'🧠 CNS-фокус', v:score.focusScore, c:'#8b5cf6' }, { l:'🏋️ Взрывная', v:score.strengthScore, c:'#22c55e' }] : []),
                        ...(isSprint ? [{ l:'🍚 Гликоген', v:score.glycogenScore, c:'#f59e0b' }] : []),
                        { l:'⚡ Энергия', v:score.energyScore, c:'#f59e0b' },
                      ];
                      return Object.values(Object.fromEntries(preRows.map((r: any) =>[r.l,r]))).map((b: any) =><ScoreRow key={b.l} {...b}/>);
                    })()}
                    {isIntra && [
                      { l:'💧 Гидратация', v:score.hydrationScore, c:'#06b6d4' },
                      { l:'🏃 Выносливость', v:score.enduranceScore, c:'#f97316' },
                      { l:'🛡️ Анти-катаболизм', v:score.anticatabolicScore, c:'#ef4444' },
                      { l:'🍚 Гликоген', v:score.glycogenScore, c:'#f59e0b' },
                    ].map((b: any) =><ScoreRow key={b.l} {...b}/>)}
                    {isPost && [
                      { l:'🔄 Восстановление', v:score.recoveryScore, c:'#22c55e' },
                      { l:'🥩 Белок (MPS)', v:score.proteinScore, c:'#3b82f6' },
                      { l:'🍚 Гликоген', v:score.glycogenScore, c:'#f59e0b' },
                      { l:'🛡️ Анти-катаболизм', v:score.anticatabolicScore, c:'#ef4444' },
                    ].map((b: any) =><ScoreRow key={b.l} {...b}/>)}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:6}}>
                    {[
                      { l:'🩸 Памп', v:score.pumpScore, cv:compareScore.pumpScore, c:'#ef4444' },
                      { l:'⚡ Энергия', v:score.energyScore, cv:compareScore.energyScore, c:'#f59e0b' },
                      { l:'🧠 Фокус', v:score.focusScore, cv:compareScore.focusScore, c:'#8b5cf6' },
                      { l:'🏋️ Сила', v:score.strengthScore, cv:compareScore.strengthScore, c:'#22c55e' },
                      { l:'🏃 Выносливость', v:score.enduranceScore, cv:compareScore.enduranceScore, c:'#f97316' },
                      { l:'💧 Гидратация', v:score.hydrationScore, cv:compareScore.hydrationScore, c:'#06b6d4' },
                      { l:'🔄 Восстановление', v:score.recoveryScore, cv:compareScore.recoveryScore, c:'#22c55e' },
                      { l:'🛡️ Анти-катаболизм', v:score.anticatabolicScore, cv:compareScore.anticatabolicScore, c:'#ef4444' },
                      { l:'🥩 Белок', v:score.proteinScore, cv:compareScore.proteinScore, c:'#3b82f6' },
                      { l:'🍚 Гликоген', v:score.glycogenScore, cv:compareScore.glycogenScore, c:'#f59e0b' },
                    ].filter((r: any) =>r.v>0||r.cv>0).map((r: any) =>(
                      <div key={r.l} style={{display:'flex',alignItems:'center',gap:4,fontSize:7}}>
                        <span style={{minWidth:80,color:'var(--text-dim)'}}>{r.l}</span>
                        <div style={{flex:1,height:4,borderRadius:2,background:'rgba(139,92,246,0.15)',display:'flex',overflow:'hidden'}}>
                          <div style={{height:4,borderRadius:2,width:`${r.v}%`,background:r.c,transition:'width 0.3s'}} />
                        </div>
                        <span style={{minWidth:20,textAlign:'right'}}>{r.v}</span>
                        <span style={{color:'var(--text-dim)'}}>vs</span>
                        <div style={{flex:1,height:4,borderRadius:2,background:'rgba(245,158,11,0.15)',display:'flex',overflow:'hidden'}}>
                          <div style={{height:4,borderRadius:2,width:`${r.cv}%`,background:'#f59e0b',transition:'width 0.3s'}} />
                        </div>
                        <span style={{minWidth:20}}>{r.cv}</span>
                        <span style={{minWidth:16,fontWeight:700,color:r.v>r.cv?'#22c55e':'#ef4444'}}>{r.v>r.cv?'▲':'▼'}{Math.abs(r.v-r.cv)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:6, padding:'6px 8px', borderRadius:6, background:'rgba(0,0,0,0.08)', fontSize:7, color:'#8b5cf6' }}>
                    ⚡ NO-оптимизация: <b>{score.noScore}/100</b>
                    {score.drugModifiers.map((d: any, i: any) =><div key={i} style={{marginTop:2}}>{d.drug}: {d.effect} ({d.bonus>0?'+':''}{d.bonus}%)</div>)}
                  </div>
                  {synWarnings.length > 0 && <div style={{marginTop:4,padding:'4px 6px',borderRadius:4,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.1)',fontSize:7,color:'#ef4444',lineHeight:1.4}}>
                    {synWarnings.map((w: any, i: any) =><div key={i}>• {w}</div>)}
                  </div>}
                  {acwrWarnings.length > 0 && <div style={{marginTop:4,padding:'4px 6px',borderRadius:4,background:_acwr&&_acwr.ratio>1.5?'rgba(239,68,68,0.08)':_acwr&&_acwr.ratio>1.3?'rgba(234,179,8,0.08)':'rgba(59,130,246,0.08)',border:'1px solid rgba(255,255,255,0.04)',fontSize:7,color:_acwr&&_acwr.ratio>1.5?'#ef4444':_acwr&&_acwr.ratio>1.3?'#eab308':'#60a5fa',lineHeight:1.4}}>
                    {acwrWarnings.map((w: any, i: any) =><div key={i}>• {w}</div>)}
                  </div>}
                  <div style={{ marginTop:6 }}>
                    <div onClick={()=>setExpandedSection(prev=>{const n=new Set(prev);n.has('subscores')?n.delete('subscores'):n.add('subscores');return n;})} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',fontSize:8,color:'var(--text-dim)'}}>
                      <span>📊 Вклад каждого вещества</span>
                      <span>{expandedSection.has('subscores')?'▾':'▸'}</span>
                    </div>
                    {expandedSection.has('subscores') && <>
                      {/* Waterfall stacked bar: вклад каждого вещества в общий скор */}
                      {(() => {
                        const subs = score.substanceBreakdown;
                        const total = subs.reduce((s: any, b: any) => s + b.baseScore, 0) || 1;
                        const palette = ['#8b5cf6','#22c55e','#3b82f6','#f59e0b','#ef4444','#06b6d4','#a855f7','#f97316','#14b8a6','#6366f1'];
                        return <div style={{marginTop:4,marginBottom:6,display:'flex',height:22,borderRadius:6,overflow:'hidden',background:'rgba(255,255,255,0.03)'}}>
                          {subs.map((sb: any, i: any) => {
                            const pct = (sb.baseScore / total) * 100;
                            return <div key={i} style={{width:pct+'%',minWidth:2,height:'100%',background:palette[i%palette.length],display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}} title={`${sb.name}: ${sb.baseScore} (${pct.toFixed(0)}%)`}>
                              {pct > 18 && <span style={{fontSize:6,fontWeight:700,color:'#000',lineHeight:1,whiteSpace:'nowrap',padding:'0 2px'}}>{sb.name}</span>}
                              {pct > 40 && <span style={{fontSize:5,fontWeight:600,color:'rgba(0,0,0,0.6)',position:'absolute',bottom:1,right:2}}>{sb.baseScore}</span>}
                            </div>;
                          })}
                        </div>;
                      })()}
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        {score.substanceBreakdown.map((sb: any, i: any) =>(
                          <div key={i} style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:4,padding:'3px 6px',borderRadius:4,background:'rgba(255,255,255,0.02)',fontSize:7}}>
                            <span style={{fontWeight:600,color:'var(--text-light)',minWidth:80}}>{sb.name}</span>
                            <span style={{color:'#8b5cf6',fontWeight:700}}>{sb.baseScore}</span>
                            {sb.categories.map((c: any, ci: any) =><span key={ci} style={{padding:'1px 4px',borderRadius:3,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa'}}>{c.label}:{c.score}</span>)}
                          </div>
                        ))}
                      </div>
                    </>}
                  </div>
                </div>

                <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.12)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#22c55e', marginBottom:6 }}>📐 Расчёт нутриентов (вес {bw} кг{isOnCycle?' ×1.25':' ×1.0'}{mixInsulin>0||mixDrugGH?' + фарма':''})</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:9 }}>
                    <div style={{textAlign:'center',padding:'6px',borderRadius:8,background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.1)'}}>
                      <div style={{fontSize:7,color:'rgba(255,255,255,0.7)'}}>Углеводы</div>
                      <div style={{fontSize:16,fontWeight:800,color:'#f97316'}}>{score.recommendedCarbsG}г</div>
                    </div>
                    <div style={{textAlign:'center',padding:'6px',borderRadius:8,background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.1)'}}>
                      <div style={{fontSize:7,color:'rgba(255,255,255,0.7)'}}>EAA/BCAA</div>
                      <div style={{fontSize:16,fontWeight:800,color:'#3b82f6'}}>{score.recommendedEAAG}г</div>
                    </div>
                    <div style={{textAlign:'center',padding:'6px',borderRadius:8,background:'rgba(6,182,212,0.06)',border:'1px solid rgba(6,182,212,0.1)'}}>
                      <div style={{fontSize:7,color:'rgba(255,255,255,0.7)'}}>Вода</div>
                      <div style={{fontSize:16,fontWeight:800,color:'#06b6d4'}}>{(score.recommendedWaterMl/1000).toFixed(1)}л</div>
                    </div>
                  </div>
                  {mixTiming === 'intra' && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>💧 Изотоник на {durHrs}ч (на {score.recommendedWaterMl/1000}л воды):</div>
                      <div style={{ display:'flex', gap:6, fontSize:8 }}>
                        <span style={{ color:'#fbbf24' }}>Na⁺ {score.recommendedNaMg}мг</span>
                        <span style={{ color:'#818cf8' }}>K⁺ {score.recommendedKMg}мг</span>
                        <span style={{ color:'#06b6d4' }}>Cl⁻ {score.recommendedClMg}мг</span>
                      </div>
                    </div>
                  )}
                </div>

                {score.electrolyteWarnings.length > 0 && (
                  <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.12)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠️ Электролитный баланс</div>
                    {score.electrolyteWarnings.map((w: any, i: any) =><div key={i} style={{fontSize:8,color:'rgba(255,255,255,0.8)',padding:'2px 0'}}>• {w}</div>)}
                    <div style={{ marginTop:4, fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>
                      Анализы: Na {na} ммоль/л (N:135-145) · K {k} ммоль/л (N:3.5-5.2) · Cl {cl} ммоль/л (N:98-108)
                      {hasNandrolone && <div style={{marginTop:2,color:'#ff1744'}}>⚠ Обнаружен нандролон (19-нор) — подавляет eNOS, снижает синтез NO на ~20%. Рекомендуется усиление пампа.</div>}
                    </div>
                  </div>
                )}

                {score.suggestions.length > 0 && (
                  <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>💡 Рекомендации</div>
                    {score.suggestions.map((s: any, i: any) =><div key={i} style={{fontSize:8,color:'rgba(255,255,255,0.8)',padding:'2px 0'}}>• {s}</div>)}
                  </div>
                )}

                {/* Compare + Templates buttons */}
                <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                  <button onClick={() => {
                    const kit = {
                      goal: mixGoal, timing: mixTiming, workoutType: mixWorkoutType,
                      timeOfDay: mixTimeOfDay, isOnCycle, multiplier, bw,
                      score: score.compositeScore, pre: preStack.filter((s: any) =>s.mg>0), intra: intraStack.filter((s: any) =>s.mg>0), post: postStack.filter((s: any) =>s.mg>0),
                    };
                    setCompareKit(kit);
                    setPlanSaved('✅ Текущий стек сохранён для сравнения');
                    setTimeout(() => setPlanSaved(''), 3000);
                  }} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', fontSize:8, fontWeight:600, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.15)', color:'#60a5fa' }}>⚖ Сравнить с…</button>
                  <button onClick={() => setShowTemplates(!showTemplates)} style={{ flex:1, padding:'5px', borderRadius:6, cursor:'pointer', fontSize:8, fontWeight:600, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', color:'#f59e0b' }}>📦 {showTemplates ? 'Скрыть' : 'Шаблоны'}</button>
                </div>

                {/* Compare mode */}
                {compareKit && (() => {
                  const cmpScore = (() => {
                    const cmpProfile: MixProfile = {
                      goal: compareKit.goal, timing: compareKit.timing as any, weightKg: compareKit.bw || bw,
                      isOnCycle: compareKit.isOnCycle, drugs: { insulin:false, igf:false, gh:false, mgf:false, glp1:false },
                      hasNandrolone: false, userElectrolytes: { sodiumMmolL: 140, potassiumMmolL: 4.2, chlorideMmolL: 102 },
                      workoutType: compareKit.workoutType || 'moderate', timeOfDay: compareKit.timeOfDay || 'morning',
                      workoutDurationMin: 90,
                    };
                    const cmpSubs: MixSubstance[] = (compareKit.pre||[]).concat(compareKit.intra||[]).concat(compareKit.post||[])
                      .filter((s:any) => s && s.mg > 0).map((s:any) => ({ id: s.id, name: s.name, doseMg: s.mg }));
                    return cmpSubs.length > 0 ? calculateMixScore(cmpSubs, cmpProfile) : null;
                  })();
                  return (
                    <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa' }}>⚖ Сравнение с сохранённым стеком</span>
                        <button onClick={() => setCompareKit(null)} style={{ fontSize:7, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>✕</button>
                      </div>
                      <div style={{ fontSize:8, color:'var(--text-dim)', marginBottom:4 }}>
                        Сохранённый: <b>{compareKit.goal}</b> ({compareKit.pre?.length||0}pre/{compareKit.intra?.length||0}intra/{compareKit.post?.length||0}post) · скор <b>{cmpScore?.compositeScore||'—'}/100</b>
                        <span style={{marginLeft:8}}>Текущий: <b>{mixGoal}</b> · скор <b>{score.compositeScore}/100</b></span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:7 }}>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#a78bfa', fontWeight:600, marginBottom:2 }}>Текущий (Pre)</div>
                          <div style={{color:'var(--text-dim)'}}>{preStack.filter((s: any) =>s.mg>0).slice(0,6).map((s: any) =>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#a78bfa', fontWeight:600, marginBottom:2 }}>Сохранённый (Pre)</div>
                          <div style={{color:'var(--text-dim)'}}>{(compareKit.pre||[]).slice(0,6).map((s:any)=>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#06b6d4', fontWeight:600, marginBottom:2 }}>Текущий (Intra)</div>
                          <div style={{color:'var(--text-dim)'}}>{intraStack.filter((s: any) =>s.mg>0).slice(0,4).map((s: any) =>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#06b6d4', fontWeight:600, marginBottom:2 }}>Сохранённый (Intra)</div>
                          <div style={{color:'var(--text-dim)'}}>{(compareKit.intra||[]).slice(0,4).map((s:any)=>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#22c55e', fontWeight:600, marginBottom:2 }}>Текущий (Post)</div>
                          <div style={{color:'var(--text-dim)'}}>{postStack.filter((s: any) =>s.mg>0).slice(0,6).map((s: any) =>s.name).join(', ')}</div>
                        </div>
                        <div style={{ padding:'4px 6px', borderRadius:4, background:'rgba(255,255,255,0.02)' }}>
                          <div style={{ color:'#22c55e', fontWeight:600, marginBottom:2 }}>Сохранённый (Post)</div>
                          <div style={{color:'var(--text-dim)'}}>{(compareKit.post||[]).slice(0,6).map((s:any)=>s.name).join(', ')}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Template presets */}
                {showTemplates && (
                  <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b' }}>📦 Шаблоны миксов</span>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        {appliedTemplate && <span onClick={()=>{setAppliedTemplate(null);localStorage.removeItem('he_mix_applied_template');}} style={{fontSize:7,color:'#ef4444',cursor:'pointer',textDecoration:'underline'}}>✕ Сбросить шаблон</span>}
                        <button onClick={() => setShowTemplates(false)} style={{ fontSize:7, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>✕</button>
                      </div>
                    </div>
                    {appliedTemplate && <div style={{fontSize:7,color:'#22c55e',marginBottom:4,background:'rgba(34,197,94,0.06)',padding:'3px 6px',borderRadius:4}}>✅ Применён: {appliedTemplate.name}</div>}
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {MIX_TEMPLATES.filter((t: any) => t.goal === mixGoal || t.tags.some((tg: any) => tg === mixTiming || tg === mixGoal)).map((t: any) => (
                        <div key={t.id} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}
                          onClick={() => {
                            setAppliedTemplate(t);
                            localStorage.setItem('he_mix_applied_template', JSON.stringify(t));
                            setMixGoals([t.goal]);
                            setPlanSaved(`✅ Применён шаблон: ${t.name}`);
                            setTimeout(() => setPlanSaved(''), 3000);
                          }}
                        >
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--text-light)' }}>{t.name}</div>
                          <div style={{ fontSize:7, color:'var(--text-dim)', lineHeight:1.3 }}>{t.description}</div>
                          <div style={{ fontSize:7, color:'#f59e0b', marginTop:2 }}>
                            {t.tags.map((tg: any) => <span key={tg} style={{marginRight:4}}>#{tg}</span>)}
                            · Pre: {t.pre.length} · Intra: {t.intra.length} · Post: {t.post.length}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mixSavedPlans.length > 0 && (
                  <div className="card" style={{ padding:10, marginBottom:8, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.12)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#a78bfa' }}>📂 Мои планы миксов</span>
                      <span onClick={()=>{setMixSavedPlans([]);localStorage.removeItem('he_mix_saved_plans');}} style={{fontSize:7,color:'#ef4444',cursor:'pointer'}}>✕ Очистить</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {mixSavedPlans.slice().reverse().map((plan:any, i:number) => (
                        <div key={plan.id||i} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}
                          onClick={() => {
                            setMixGoals([plan.goal]);
                            setMixTiming(plan.timing || 'pre');
                            setMixWorkoutType(plan.workoutType || 'moderate');
                            setMixTimeOfDay(plan.timeOfDay || 'morning');
                            setMixInsulin(plan.insulin||0); setMixInsulinTiming(plan.insulinTiming||'post');
                            setMixDrugIGF(plan.igf||0); setMixDrugIGFTiming(plan.igfTiming||'post');
                            setMixDrugGH(plan.gh||0); setMixDrugGHTiming(plan.ghTiming||'post');
                            setMixDrugMGF(plan.mgf||0); setMixDrugMGFTiming(plan.mgfTiming||'post');
                            setMixDrugGLP1(plan.glp1||false);
                            if (plan.appliedTemplate) {
                              const tmpl = MIX_TEMPLATES.find((t: any) => t.id === plan.appliedTemplate.id);
                              if (tmpl) { setAppliedTemplate(tmpl); localStorage.setItem('he_mix_applied_template', JSON.stringify(tmpl)); }
                            }
                            setPlanSaved(`✅ Загружен план: ${plan.name}`);
                            setTimeout(() => setPlanSaved(''), 3000);
                          }}
                        >
                          <div style={{fontSize:9,fontWeight:700,color:'var(--text-light)'}}>{plan.name}</div>
                          <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3}}>
                            🎯 {plan.goal} · 📍 {plan.timing||'pre'} · 💉 {[plan.insulin>0&&'Insulin',plan.igf>0&&'IGF',plan.gh>0&&'GH',plan.mgf>0&&'MGF',plan.glp1&&'GLP1'].filter(Boolean).join('+')||'—'}
                            · ⭐ {plan.score||'?'} · {new Date(plan.date).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card" style={{ padding:10, marginBottom:8 }}>
                  <div onClick={()=>setExpandedSection(prev=>{const n=new Set(prev);n.has('mech')?n.delete('mech'):n.add('mech');return n;})} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
                    <span style={{fontSize:10,fontWeight:700,color:'var(--accent)'}}>🧬 Описание механизмов</span>
                    <span style={{fontSize:9,color:'var(--text-dim)'}}>{expandedSection.has('mech')?'▾':'▸'}</span>
                  </div>
                  {expandedSection.has('mech') && <div style={{marginTop:6}}>
                    <div style={{fontSize:8,color:'var(--text-dim)',lineHeight:1.4,marginBottom:6}}><b>Принцип синергии стека ({mixGoal}):</b> {MIX_SYNERGY[mixGoal]||'—'}</div>
                    {dedupedStack.filter((s: any) =>s.mg>0).map((s: any, i: any) =>{
                      const mechText = (MIX_MECHANISMS as any)[s.id] || '—';
                      return (
                        <div key={i} style={{padding:'4px 6px',marginBottom:3,borderRadius:6,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)'}}>
                          <div style={{fontSize:8,fontWeight:600,color:'var(--text-light)'}}>{s.name} <span style={{color:'var(--accent)',fontWeight:400}}>({s.dose}{s.unit?' '+s.unit:''})</span></div>
                          <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.3,marginTop:1}}>{mechText}</div>
                        </div>
                      );
                    })}
                  </div>}
                </div>

                {/* Recipe engine info card — interactive with remove/replace */}
                {recipeResult && (() => {
                  const handleRemove = (itemKey: string) => {
                    setCustomRecipeOverrides(prev => {
                      const next = { removed: [...prev.removed, itemKey], replaced: {...prev.replaced} };
                      localStorage.setItem('he_mix_recipe_overrides', JSON.stringify(next));
                      return next;
                    });
                  };
                  const handleReplace = (itemKey: string, alt: { id:string; dose:string; unit:string; note:string }) => {
                    setCustomRecipeOverrides(prev => {
                      const next = { removed: prev.removed.filter((r: any) => r !== itemKey), replaced: {...prev.replaced, [itemKey]: alt} };
                      localStorage.setItem('he_mix_recipe_overrides', JSON.stringify(next));
                      return next;
                    });
                  };
                  const handleResetOverrides = () => {
                    setCustomRecipeOverrides({ removed: [], replaced: {} });
                    localStorage.removeItem('he_mix_recipe_overrides');
                  };
                  const hasOverrides = customRecipeOverrides.removed.length > 0 || Object.keys(customRecipeOverrides.replaced).length > 0;
                  return (
                    <div className="card" style={{ padding:10, borderLeft:`3px solid ${recipeResult.recipe.synergyScore >= 90 ? '#22c55e' : recipeResult.recipe.synergyScore >= 70 ? '#eab308' : '#ef4444'}`, marginBottom:8 }}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:4}}>
                        <span style={{fontSize:10,fontWeight:700,color:'var(--accent)'}}>🧪 {recipeResult.recipe.name}</span>
                        <span style={{fontSize:8,padding:'2px 6px',borderRadius:8,background:'rgba(0,230,138,0.1)',color:'var(--accent)'}}>score {recipeResult.recipe.synergyScore}</span>
                      </div>
                      <div style={{fontSize:7,color:'var(--text-dim)',lineHeight:1.4,margin:'4px 0'}}>{recipeResult.recipe.synergyNote}</div>
                      {/* Substances with X to remove + replace buttons */}
                      <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:4}}>
                        {(groupedEffectiveDrugItems[isPre ? 'pre' : isIntra ? 'intra' : 'post'] || []).filter((item: any) => !customRecipeOverrides.removed.includes(`${item.id}_${item.timing}`)).map((item: any, ii: any) => {
                          const itemKey = `${item.id}_${item.timing}`;
                          const isReplaced = customRecipeOverrides.replaced[itemKey];
                          const effectiveItem = isReplaced ? { ...item, ...isReplaced } : item;
                          // Find original item to get alternatives
                          const origItem = drugItems.find((d: any) => d.id === item.id && d.timing === item.timing);
                          const alts = origItem?.alternatives || [];
                          return (
                            <div key={ii} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,0.02)',borderRadius:4,padding:'3px 6px'}}>
                              <span style={{fontSize:7,fontWeight:600,color:'var(--text-light)',flex:1}}>{item.id}{isReplaced ? ` → ${isReplaced.id}` : ''} </span>
                              <span onClick={()=>setEditingDose({ id:item.id, timing:item.timing, currentDose:effectiveItem.dose, currentUnit:effectiveItem.unit })} style={{fontSize:7,color:'var(--accent)',cursor:'pointer',borderBottom:'1px dotted rgba(0,230,138,0.3)'}}>{effectiveItem.dose}{effectiveItem.unit}</span>
                              <span style={{fontSize:6,color:'var(--text-dim)'}}>{effectiveItem.timing}</span>
                              {alts.length > 0 && (
                                <select value="" onChange={e=>{if(e.target.value){handleReplace(itemKey,JSON.parse(e.target.value));}}} style={{fontSize:6,padding:'1px 3px',borderRadius:3,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.15)',color:'#a78bfa',maxWidth:70}}>
                                  <option value="">Заменить</option>
                                  {alts.map((a: any, ai: any) => (
                                    <option key={ai} value={JSON.stringify(a)}>{a.id}</option>
                                  ))}
                                </select>
                              )}
                              <span onClick={()=>handleRemove(itemKey)} style={{fontSize:7,color:'#ef4444',cursor:'pointer',padding:'1px 4px',borderRadius:3,background:'rgba(239,68,68,0.08)'}}>✕</span>
                            </div>
                          );
                        })}
                      </div>
                      {hasOverrides && (
                        <div style={{marginTop:6,display:'flex',gap:4}}>
                          <span onClick={handleResetOverrides} style={{fontSize:7,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}}>Сбросить изменения</span>
                        </div>
                      )}
                      {effectiveDrugItems.length > 0 && <div style={{marginTop:6,display:'flex',gap:4}}>
                        <span onClick={()=>{
                          const name = prompt('Название рецепта:', recipeResult.recipe.name);
                          if (!name) return;
                          const items = (groupedEffectiveDrugItems[isPre ? 'pre' : isIntra ? 'intra' : 'post'] || []).filter((item: any) => !customRecipeOverrides.removed.includes(`${item.id}_${item.timing}`));
                          const newRecipe = { id:'custom_'+Date.now(), name, goal:mixGoal, items };
                          const updated = [...mixSavedRecipes, newRecipe];
                          setMixSavedRecipes(updated);
                          localStorage.setItem('he_mix_saved_recipes', JSON.stringify(updated));
                        }} style={{fontSize:7,color:'var(--accent)',cursor:'pointer',padding:'2px 6px',borderRadius:4,border:'1px solid rgba(0,230,138,0.3)'}}>💾 Сохранить как мой рецепт</span>
                      </div>}
                    </div>
                  );
                })()}
                {mixSavedRecipes.length > 0 && (
                  <div className="card" style={{ padding:10, marginBottom:8 }}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--accent)',marginBottom:6}}>📂 Мои рецепты ({mixSavedRecipes.length})</div>
                    {mixSavedRecipes.map((r: any, ri: any) => (
                      <div key={r.id} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',marginBottom:3,borderRadius:6,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)'}}>
                        <span style={{fontSize:8,fontWeight:600,color:'var(--text-light)',flex:1}}>{r.name}</span>
                        <span style={{fontSize:6,color:'var(--text-dim)'}}>{r.goal}</span>
                        <span style={{fontSize:7,color:'var(--accent)',cursor:'pointer'}} onClick={() => {
                          const overrides: {removed:string[]; replaced:Record<string,{id:string;dose:string;unit:string;note:string}>} = { removed:[], replaced:{} };
                          for (const item of r.items) {
                            overrides.replaced[`${item.id}_${item.timing}`] = { id:item.id, dose:item.dose, unit:item.unit, note:item.note };
                          }
                          setCustomRecipeOverrides(overrides);
                          localStorage.setItem('he_mix_recipe_overrides', JSON.stringify(overrides));
                        }}>↩ Загрузить</span>
                        <span style={{fontSize:7,color:'#ef4444',cursor:'pointer'}} onClick={() => {
                          const updated = mixSavedRecipes.filter((x: any) => x.id !== r.id);
                          setMixSavedRecipes(updated);
                          localStorage.setItem('he_mix_saved_recipes', JSON.stringify(updated));
                        }}>✕</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="card" style={{ padding:10, marginBottom:8 }}>
                  <h4 style={{ margin:'0 0 6px', fontSize:11, color:'var(--text)' }}>📋 Все три стека (обзор) · цель: {
                    { pump:'🩸 Памп', endurance:'🏃 Выносливость', strength:'🏋️ Сила', recovery:'🔄 Восстановление', focus:'🧠 Фокус', powerlifting:'💪 Пауэрлифтинг', competition:'🏆 Соревнования', crossfit:'🔁 CrossFit', post_comp:'🔄 Пост-соревнования', hiit:'💨 HIIT', mma:'🥊 MMA', sprint:'🏃 Спринт' }[mixGoal] || mixGoal
                  }</h4>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {[
                      { label:'🔥 Пред', items:preStack.slice(0,7).map((i: any) =>`${i.name.split('(')[0].trim()}: ${i.dose}${i.unit?' '+i.unit:''}`).join(' • ') },
                      { label:'💧 Интра', items:intraStack.slice(0,5).map((i: any) =>`${i.name.split('(')[0].trim()}: ${i.dose}${i.unit?' '+i.unit:''}`).join(' • ') },
                      { label:'🍗 Пост', items:postStack.slice(0,7).map((i: any) =>`${i.name.split('(')[0].trim()}: ${i.dose}${i.unit?' '+i.unit:''}`).join(' • ') },
                    ].map((grp: any, gi: any) => (
                      <div key={gi} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', marginBottom:3 }}>{grp.label}-тренировочный</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>{grp.items}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ padding:10 }}>
                  <h4 style={{ margin:'0 0 4px', fontSize:10, color:'var(--text-dim)' }}>📌 Как считается скор</h4>
                  <div style={{ fontSize:8, color:'var(--text-dim)', lineHeight:1.4 }}>
                    • Каждое вещество имеет базовый скор (65-90) × курс (×1.25) × фарма-модификаторы (инсулин +15%, ГР +10%, ИГФ +10%, МГФ +8%)<br/>
                    • Pre-workout вес: пампинг 25% + энергия 25% + фокус 25% + сила 25%<br/>
                    • Intra-workout вес: гидратация 30% + выносливость 25% + анти-катаболизм 15% + пампинг 10%<br/>
                    • Post-workout вес: восстановление 35% + белок 25% + гликоген 10% + сила 10%<br/>
                    • Углеводы: вес×0.6-1.2×множитель × инсулин-буст (×1.3)<br/>
                    • Аминокислоты: intra 0.15 г/кг, post 0.4 г/кг, pre 0.1 г/кг × инсулин/ГР-буст<br/>
                  </div>
                </div>

                {/* Dose editor popup */}
                {editingDose && (
                  <div style={{
                    position:'fixed', top:0, left:0, right:0, bottom:0,
                    background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center',
                    zIndex:1000
                  }} onClick={()=>setEditingDose(null)}>
                    <div className="card" style={{padding:16,width:280,maxWidth:'90vw'}} onClick={e=>e.stopPropagation()}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--accent)',marginBottom:8}}>✏️ Редактировать дозу: {editingDose.id}</div>
                      <div style={{display:'flex',gap:6}}>
                        <input type="text" value={editingDose.currentDose} onChange={e=>setEditingDose({...editingDose,currentDose:e.target.value})}
                          style={{flex:1,padding:'6px 8px',borderRadius:6,border:'1px solid var(--glass-border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:9}} />
                        <input type="text" value={editingDose.currentUnit} onChange={e=>setEditingDose({...editingDose,currentUnit:e.target.value})}
                          style={{width:50,padding:'6px 8px',borderRadius:6,border:'1px solid var(--glass-border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:9}} />
                      </div>
                      <div style={{display:'flex',gap:6,marginTop:8}}>
                        <span style={{padding:'6px 12px',borderRadius:6,background:'var(--accent)',color:'#000',fontSize:9,cursor:'pointer',fontWeight:600}} onClick={()=>{
                          setCustomRecipeOverrides(prev => {
                            const key = `${editingDose.id}_${editingDose.timing}`;
                            const next = { removed: prev.removed.filter((r: any) => r !== key), replaced: {...prev.replaced, [key]: { id:editingDose.id, dose:editingDose.currentDose, unit:editingDose.currentUnit, note:prev.replaced[key]?.note||'' }} };
                            localStorage.setItem('he_mix_recipe_overrides', JSON.stringify(next));
                            return next;
                          });
                          setEditingDose(null);
                        }}>✅ Применить</span>
                        <span style={{padding:'6px 12px',borderRadius:6,background:'rgba(255,255,255,0.06)',color:'var(--text)',fontSize:9,cursor:'pointer'}} onClick={()=>setEditingDose(null)}>Отмена</span>
                      </div>
                    </div>
                  </div>
                )}
              </>);
            })()}
            {mixHistory.length > 0 && (
              <div className="card" style={{ padding:10, marginTop:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', marginBottom:6, display:'flex', justifyContent:'space-between' }}>
                  <span>📂 История миксов ({mixHistory.length})</span>
                  <button onClick={()=>{setMixHistory([]);localStorage.setItem('he_training_mixes','[]')}} style={{fontSize:7,color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>✕ очистить</button>
                </div>
                {mixHistory.slice(-5).reverse().map((h:any,i:number)=>(
                  <div key={i} style={{padding:'6px 8px',borderRadius:6,marginBottom:3,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)',fontSize:8}}>
                    <span style={{color:'var(--accent)',fontWeight:700}}>{h.goal} · {h.timing} · {h.type}</span>
                    <span style={{color:'rgba(255,255,255,0.5)',marginLeft:6}}>{h.score}/100 · {h.date}</span>
                    <button onClick={()=>{setMixGoals([h.goal]);setMixTiming(h.timing);setMixWorkoutType(h.type);setMixTimeOfDay(h.tod);}} style={{marginLeft:6,fontSize:7,color:'#60a5fa',background:'none',border:'none',cursor:'pointer'}}>↩ загрузить</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
};
