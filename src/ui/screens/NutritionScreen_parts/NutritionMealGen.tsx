import React, { useState, useMemo, useEffect } from 'react';
import { generateTierMealPlan, generateRegimeAdvice, generateLabsBasedAdvice, type MealTier, type MealGoal, type MealPlanResult, type MealPlanInput } from '../../../engines/meal-tier-generator.engine';
import { FOOD_DB } from '../../../core/nutrition-database';
import type { UserProfile } from '../../../core/types';
import { type LabCompositeResult } from '../../../engines/lab-analysis.engine';

const TIER_BUTTONS: { tier: MealTier; label: string; emoji: string; color: string; desc: string }[] = [
  { tier: 'basic', label: 'База', emoji: '\u{1F7E2}', color: '#22c55e', desc: 'Минимальный набор. Доступно, дёшево.' },
  { tier: 'mid', label: 'Средний', emoji: '\u{1F7E1}', color: '#f59e0b', desc: 'Оптимум цена/качество. Баланс микро.' },
  { tier: 'max', label: 'Максимум', emoji: '\u{1F534}', color: '#ef4444', desc: 'Премиум продукты. Макс нутриентов.' },
  { tier: 'boost', label: 'Усиление', emoji: '\u{1F4A5}', color: '#a855f7', desc: 'Суперфуды + специфические продукты.' },
];

const GOAL_OPTIONS: { value: MealGoal; label: string; icon: string }[] = [
  { value: 'bulk', label: 'Набор массы', icon: '\u{1F4AA}' },
  { value: 'cut', label: 'Сушка', icon: '\u{1F525}' },
  { value: 'maintenance', label: 'Поддержание', icon: '\u2696\uFE0F' },
  { value: 'recomp', label: 'Рекомпозиция', icon: '\u{1F504}' },
  { value: 'rehab', label: 'Реабилитация', icon: '\u{1FA7A}' },
  { value: 'health', label: 'Здоровье', icon: '\u2764\uFE0F' },
];

export const NutritionMealGen: React.FC<{ profile: UserProfile | null; labAnalysis: LabCompositeResult | null }> = ({ profile, labAnalysis }) => {
  const s = profile?.settings;
  const [tier, setTier] = useState<MealTier>('mid');
  const [goal, setGoal] = useState<MealGoal>('maintenance');
  const [weight, setWeight] = useState(s?.weight ?? 80);
  const [height, setHeight] = useState(s?.height ?? 180);
  const [age, setAge] = useState(s?.age ?? 30);
  const [sex, setSex] = useState<'male' | 'female'>(s?.sex ?? 'male');
  const [workouts, setWorkouts] = useState(s?.workoutsPerWeek ?? 3);
  const [workoutMin, setWorkoutMin] = useState(s?.avgWorkoutMinutes ?? 60);
  const [includeWorkout, setIncludeWorkout] = useState(true);
  const [result, setResult] = useState<MealPlanResult | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  const generate = () => {
    const input: MealPlanInput = {
      weightKg: weight, heightCm: height, age, sex, goal, tier,
      trainingDaysPerWeek: workouts, avgWorkoutMinutes: workoutMin,
      includeWorkoutMeals: includeWorkout,
      labsContext: labAnalysis ? {
        homaIR: labAnalysis.homaIR ?? undefined,
        liverStress: labAnalysis.liverStress,
        kidneyStress: labAnalysis.kidneyStress,
        inflammation: labAnalysis.inflammation,
        hormoneScore: labAnalysis.hormoneScore,
      } : undefined,
    };
    const plan = generateTierMealPlan(input);
    setResult(plan);
    setSelectedDay(0);
  };

  const selectedDayPlan = result?.dayPlans[selectedDay];

  return (
    <div>
      {/* Tier Selection */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>🍽️ Выберите уровень питания</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TIER_BUTTONS.map(tb => (
            <button key={tb.tier} onClick={() => setTier(tb.tier)} style={{
              background: tier === tb.tier ? `linear-gradient(135deg, ${tb.color}22, ${tb.color}08)` : 'var(--bg-secondary)',
              border: tier === tb.tier ? `1.5px solid ${tb.color}` : '1px solid var(--border)',
              borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{tb.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: tb.color }}>{tb.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3, marginTop: 2 }}>{tb.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Goal & Profile */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>🎯 Цель и параметры</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
          {GOAL_OPTIONS.map(g => (
            <button key={g.value} onClick={() => setGoal(g.value)} style={{
              background: goal === g.value ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
              border: goal === g.value ? '1px solid #00e68a' : '1px solid var(--border)',
              borderRadius: 8, padding: '6px 4px', cursor: 'pointer', textAlign: 'center',
            }}>
              <div style={{ fontSize: 16 }}>{g.icon}</div>
              <div style={{ fontSize: 9, color: goal === g.value ? '#00e68a' : 'var(--text-dim)', fontWeight: goal === g.value ? 600 : 400 }}>{g.label}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label><input type="number" value={weight} onChange={e => setWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рост (см)</label><input type="number" value={height} onChange={e => setHeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Возраст</label><input type="number" value={age} onChange={e => setAge(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['male', 'female'] as const).map(sx => (<button key={sx} onClick={() => setSex(sx)} style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid var(--border)', background: sex === sx ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: sex === sx ? '#00e68a' : 'var(--text-dim)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>{sx === 'male' ? 'М' : 'Ж'}</button>))}
          </div>
          <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Тренировок/нед</label><input type="number" min={0} max={7} value={workouts} onChange={e => setWorkouts(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} /></div>
          <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Мин/трен</label><input type="number" min={15} max={180} value={workoutMin} onChange={e => setWorkoutMin(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} /></div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeWorkout} onChange={e => setIncludeWorkout(e.target.checked)} style={{ accentColor: '#00e68a' }} />
            <span>Питание вокруг тренировки</span>
          </label>
        </div>
        <button onClick={generate} style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 14 }}>
          🍽️ Сгенерировать план питания
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Targets */}
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>📊 Целевые КБЖУ ({TIER_BUTTONS.find(t => t.tier === tier)?.label})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
              {[
                { l: 'Ккал', v: result.summary.avgKcal, c: '#22c55e', u: '' },
                { l: 'Белки', v: result.summary.avgProtein, c: '#3b82f6', u: 'г' },
                { l: 'Жиры', v: result.summary.avgFat, c: '#f59e0b', u: 'г' },
                { l: 'Углеводы', v: result.summary.avgCarbs, c: '#a855f7', u: 'г' },
              ].map(m => (
                <div key={m.l} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{m.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: m.c }}>{m.v}{m.u}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Day selector */}
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>📅 7-дневный план</h3>
            <div style={{ display: 'flex', overflowX: 'auto', gap: 4, marginBottom: 10 }}>
              {result.dayPlans.map((dp, i) => (
                <button key={i} onClick={() => setSelectedDay(i)} style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: selectedDay === i ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                  border: selectedDay === i ? '1px solid #00e68a' : '1px solid var(--border)',
                  color: selectedDay === i ? '#00e68a' : 'var(--text-dim)', fontWeight: selectedDay === i ? 600 : 400,
                }}>
                  {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]} {dp.isTrainingDay ? '💪' : '😌'}
                </button>
              ))}
            </div>
            {selectedDayPlan && (
              <div style={{ display: 'grid', gap: 6 }}>
                {selectedDayPlan.meals.map((meal, mi) => (
                  <div key={mi} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{meal.name} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>{meal.time}</span></div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{meal.items.reduce((s:any,i:any)=>s+i.kcal,0)} ккал</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 10 }}>
                      <span style={{ color: '#3b82f6' }}>Б:{meal.items.reduce((s:any,i:any)=>s+i.protein,0)}г</span>
                      <span style={{ color: '#f59e0b' }}>Ж:{meal.items.reduce((s:any,i:any)=>s+i.fat,0)}г</span>
                      <span style={{ color: '#a855f7' }}>У:{meal.items.reduce((s:any,i:any)=>s+i.carbs,0)}г</span>
                    </div>
                    {meal.items.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {meal.items.map((item, ii) => (
                          <div key={ii} style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                            • {item.foodName} ({item.amount}г) — {item.kcal} ккал
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ background: 'rgba(0,230,138,0.08)', padding: 10, borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                  <div><span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Итого</span><div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{selectedDayPlan.totals.kcal}</div></div>
                  <div><span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Белки</span><div style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>{selectedDayPlan.totals.protein}г</div></div>
                  <div><span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Жиры</span><div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{selectedDayPlan.totals.fat}г</div></div>
                  <div><span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Углеводы</span><div style={{ fontSize: 14, fontWeight: 700, color: '#a855f7' }}>{selectedDayPlan.totals.carbs}г</div></div>
                </div>
              </div>
            )}
          </div>

          {/* Workout meal plan */}
          {result.workoutMealPlan && (
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>💪 Питание вокруг тренировки</h3>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{result.workoutMealPlan.description}</div>
              {result.workoutMealPlan.meals.map((meal, mi) => (
                <div key={mi} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{meal.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{meal.time}</div>
                  {meal.items.map((item, ii) => (
                    <div key={ii} style={{ fontSize: 10, color: 'var(--text-dim)' }}>• {item.foodName} ({item.amount}г) — {item.kcal} ккал, Б:{item.protein}г</div>
                  ))}
                </div>
              ))}
              {result.workoutMealPlan.supplements.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>💊 Добавки</div>
                  {result.workoutMealPlan.supplements.map((s, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>• {s.name} {s.dose} — {s.timing} ({s.reason})</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>💡 Рекомендации</h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5 }}>{r}</div>
              ))}
            </div>
          </div>

          {/* Regime */}
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>⏰ Режим</h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {result.regimeAdvice.map((a, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5 }}>{a}</div>
              ))}
            </div>
          </div>

          {/* Labs context */}
          {result && labAnalysis && (
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>🧪 Корректировки по анализам</h3>
              {generateLabsBasedAdvice(labAnalysis ? {
                homaIR: labAnalysis.homaIR ?? undefined,
                liverStress: labAnalysis.liverStress,
                kidneyStress: labAnalysis.kidneyStress,
                inflammation: labAnalysis.inflammation,
                hormoneScore: labAnalysis.hormoneScore,
              } : undefined).map((a, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5, marginBottom: 4 }}>{a}</div>
              ))}
            </div>
          )}
        </>
      )}
    
      {/* Food Categories Reference */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{'📋'} ���������� ���������</h3>
        
        {/* Proteins */}
        <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>{'🥩'} �����</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            {'•'} ���� �������, ���� ������, ����<br/>
            {'•'} ������� ���� {'≤'}10% ��������, ���� �������<br/>
            {'•'} ������� ���� (�� ���� 2�/���), �������� (�� ���� 1�/���)<br/>
            {'•'} ����� ����: ������, ������, ������
          </div>
        </div>
        
        {/* Fats */}
        <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>{'🧁'} ����</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            {'•'} ������� � ���������, ����<br/>
            {'•'} ��������� �����, ��������� �����<br/>
            {'•'} ������� ����<br/>
            {'•'} ����� ��������� ������-������
          </div>
        </div>
        
        {/* Carbs */}
        <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>{'🍚'} ��������</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            {'•'} ��� (����� ������), �������� �� ��. ������<br/>
            {'•'} ������� ��������, Cream of Rice<br/>
            {'•'} ���������, �����<br/>
            {'•'} ���� ��������������
          </div>
        </div>
        
        {/* Limited */}
        <div style={{ background: 'rgba(245,158,11,0.08)', padding: 10, borderRadius: 10, marginBottom: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>{'⚠️'} ������������ �������������</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            {'•'} ���������� ������ (��� �������)<br/>
            {'•'} ����������, ������ ������, ������<br/>
            {'•'} �����, �������� (������� + �����)<br/>
            {'•'} �������� ���<br/>
            {'•'} �����������, ��������, ���������
          </div>
        </div>
        
        {/* Fiber */}
        <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>{'🥦'} ���������</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            {'•'} �������, �����, ������, ��������<br/>
            {'•'} ���, �������� �������<br/>
            <div style={{ color: '#f59e0b', marginTop: 4 }}>{'⚠️'} ������� � �� ���������! ������ (��������) + ������ � �� ������ ����</div>
          </div>
        </div>
        
        {/* Spices */}
        <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>{'🧭'} ������</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            {'•'} �������� �����<br/>
            {'•'} ����������� ����<br/>
            {'•'} ����� �����
          </div>
        </div>
      </div>
</div>
  );
};
