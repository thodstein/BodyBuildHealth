import React from 'react';
import type { UserProfile, UnifiedSettings } from '../../../core/types';
import { getWeightLog } from '../../../engines/profile-store';
import { NAVY_BF_FORMULAS } from '../../../core/constants';
import { theme, NumberPc, PopupCard } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: any) => void;
}

export const ProfileBodySection: React.FC<Props> = ({ settings, save }) => {
  const s = settings as any as UnifiedSettings;
  const p = s.personal || {} as any;
  const weightLog = React.useMemo(() => getWeightLog(), [p.weight]);

  const bmi = p.height && p.weight ? (p.weight / Math.pow(p.height / 100, 2)).toFixed(1) : null;
  const bmiCategory = bmi ? (parseFloat(bmi) < 18.5 ? 'Дефицит' : parseFloat(bmi) < 25 ? 'Норма' : parseFloat(bmi) < 30 ? 'Избыток' : 'Ожирение') : '';
  const lbm = p.weight && p.bodyFat ? (p.weight * (1 - p.bodyFat / 100)).toFixed(1) : null;
  const ffmi = lbm && p.height ? (parseFloat(lbm) / Math.pow(p.height / 100, 2) + 6.1 * (1.8 - p.height / 100)).toFixed(1) : null;
  const ffmiCategory = ffmi ? (parseFloat(ffmi) < 18 ? 'Ниже среднего' : parseFloat(ffmi) < 20 ? 'Средний' : parseFloat(ffmi) < 22 ? 'Хорошо' : parseFloat(ffmi) < 25 ? 'Отлично' : parseFloat(ffmi) < 28 ? 'Исключительно' : 'Подозрение') : '';

  const navyBf = (() => {
    if (!p.waistCm || !p.neckCm || !p.height) return null;
    const f = NAVY_BF_FORMULAS[p.sex] ?? NAVY_BF_FORMULAS.male;
    if (p.sex === 'male') return Math.max(0, f.a * Math.log10(p.waistCm - p.neckCm) - f.b * Math.log10(p.height) + f.c).toFixed(1);
    if (p.hipCm) { const ff = NAVY_BF_FORMULAS.female; return Math.max(0, ff.a * Math.log10(p.waistCm + p.hipCm - p.neckCm) - ff.b * Math.log10(p.height) + ff.c).toFixed(1); }
    return null;
  })();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <PopupCard icon="⚖️" label="Композиция" value={bmi ? `BMI ${bmi} · ${bmiCategory}` : 'Нет данных'}>
        <div style={{ textAlign:'center' }}>
          {bmi && <div><span style={{ fontSize:28, fontWeight:800, color:parseFloat(bmi)<18.5?'#f97316':parseFloat(bmi)<25?'#00e68a':parseFloat(bmi)<30?'#f59e0b':'#ef4444' }}>{bmi}</span><span style={{ fontSize:14, color:'rgba(255,255,255,0.3)' }}> BMI</span></div>}
          {bmiCategory && <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{bmiCategory}</div>}
          {lbm && <div style={{ marginTop:8 }}><span style={{ fontSize:20, fontWeight:700, color:'#3b82f6' }}>{lbm}</span><span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}> кг LBM</span></div>}
          {ffmi && <div><span style={{ fontSize:16, fontWeight:600, color:parseFloat(ffmi)<18?'#f97316':parseFloat(ffmi)<22?'#f59e0b':'#00e68a' }}>{ffmi}</span><span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}> FFMI</span></div>}
          {ffmiCategory && <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>{ffmiCategory}</div>}
          {navyBf && <div style={{ marginTop:8, padding:'6px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', fontSize:12 }}>Navy BF%: <strong style={{ color:'#f59e0b' }}>{navyBf}%</strong> {parseFloat(navyBf)<6?'Очень низкий':parseFloat(navyBf)<18?'Норма':parseFloat(navyBf)<25?'Повышен':'Высокий'}</div>}
        </div>
      </PopupCard>

      <PopupCard icon="📏" label="История веса" value={`${weightLog.length} записей · ${weightLog.length>1 ? 'тренд '+(weightLog[weightLog.length-1].weight-weightLog[0].weight).toFixed(1)+' кг' : ''}`}>
        {weightLog.length > 1 ? (
          <div>
            <div style={{ display:'flex', gap:1, height:60, alignItems:'flex-end', padding:'0 4px', marginBottom:6 }}>
              {weightLog.slice(-30).map((e,i,a) => {
                const minW=Math.min(...weightLog.map(w=>w.weight)); const maxW=Math.max(...weightLog.map(w=>w.weight));
                const h=Math.max(4,((e.weight-minW)/(maxW-minW||1))*100);
                return <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1 }} title={`${e.date}: ${e.weight} кг`}>
                  <div style={{ width:'75%', height:`${h}%`, background:i===a.length-1 ? theme.gradientGreen : 'rgba(0,230,138,0.3)', borderRadius:'2px 2px 0 0', minHeight:2 }} />
                  {i%7===0 && <span style={{ fontSize:7, color:theme.textDim }}>{e.date.slice(5)}</span>}
                </div>;
              })}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:theme.textDim }}>
              <span>Мин: {Math.min(...weightLog.map(w=>w.weight??0)).toFixed(1)}</span>
              <span style={{ color:theme.accent, fontWeight:600 }}>{weightLog[weightLog.length-1]?.weight?.toFixed(1)??'—'} кг</span>
              <span>Макс: {Math.max(...weightLog.map(w=>w.weight??0)).toFixed(1)}</span>
            </div>
          </div>
        ) : <div style={{ textAlign:'center', fontSize:11, color:theme.textDim, padding:20 }}>Мало данных для графика</div>}
      </PopupCard>

      {[
        { k: 'waistCm', l: 'Талия', ic: '📏' }, { k: 'neckCm', l: 'Шея', ic: '📏' }, { k: 'chestCm', l: 'Грудь', ic: '📏' },
        { k: 'hipCm', l: 'Бёдра', ic: '📏' }, { k: 'forearmCm', l: 'Предплечье', ic: '📏' }, { k: 'bicepCm', l: 'Бицепс', ic: '💪' },
        { k: 'thighCm', l: 'Бедро', ic: '📏' },
      ].map(c => (
        <NumberPc key={c.k} icon={c.ic} label={c.l} value={(p as any)[c.k] ?? ''}
          onChange={v => save({ [c.k]: v ? parseFloat(v) || 0 : undefined } as any)} suffix="см" />
      ))}
    </div>
  );
};
