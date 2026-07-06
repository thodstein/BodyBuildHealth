import React from 'react';
import type { UserProfile } from '../../../core/types';
import { getWeightLog, getMeasurementsLog } from '../../../engines/profile-store';
import { NAVY_BF_FORMULAS } from '../../../core/constants';
import { theme, glassCardStyle, sectionLabelStyle, ExpandableCard, HealthNumber, HealthBool } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
}

export const ProfileBodySection: React.FC<Props> = ({ settings, save }) => {
  const [openBody, setOpenBody] = React.useState(false);
  const [openGirth, setOpenGirth] = React.useState(false);
  const weightLog = React.useMemo(() => getWeightLog(), [settings.weight]);

  const bmi = settings.height && settings.weight
    ? (settings.weight / Math.pow(settings.height / 100, 2)).toFixed(1) : null;
  const bmiCategory = bmi
    ? (parseFloat(bmi) < 18.5 ? 'Дефицит' : parseFloat(bmi) < 25 ? 'Норма' : parseFloat(bmi) < 30 ? 'Избыток' : 'Ожирение') : '';
  const lbm = settings.weight && settings.bodyFat
    ? (settings.weight * (1 - settings.bodyFat / 100)).toFixed(1) : null;
  const ffmi = lbm && settings.height
    ? (parseFloat(lbm) / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1) : null;
  const ffmiCategory = ffmi
    ? (parseFloat(ffmi) < 18 ? 'Ниже среднего' : parseFloat(ffmi) < 20 ? 'Средний' : parseFloat(ffmi) < 22 ? 'Хорошо' : parseFloat(ffmi) < 25 ? 'Отлично' : parseFloat(ffmi) < 28 ? 'Исключительно' : 'Подозрение') : '';

  const navyBf = (() => {
    if (!settings.waistCm || !settings.neckCm || !settings.height) return null;
    const f = NAVY_BF_FORMULAS[settings.sex] ?? NAVY_BF_FORMULAS.male;
    if (settings.sex === 'male') {
      return Math.max(0, f.a * Math.log10(settings.waistCm - settings.neckCm) - f.b * Math.log10(settings.height) + f.c).toFixed(1);
    }
    if (settings.hipCm) {
      const ff = NAVY_BF_FORMULAS.female;
      return Math.max(0, ff.a * Math.log10(settings.waistCm + settings.hipCm - settings.neckCm) - ff.b * Math.log10(settings.height) + ff.c).toFixed(1);
    }
    return null;
  })();

  const girthSummary = ['waistCm', 'neckCm', 'chestCm', 'hipCm', 'bicepCm', 'thighCm']
    .filter(k => (settings as any)[k])
    .map(k => {
      const labels: Record<string, string> = { waistCm: 'Тал', neckCm: 'Шея', chestCm: 'Гр', hipCm: 'Бёдра', bicepCm: 'Биц', thighCm: 'Бед' };
      return `${labels[k] || k}:${(settings as any)[k]}см`;
    })
    .join(', ') || 'Не заполнены';

  return (
    <div>
      <div style={glassCardStyle}>
        <div style={sectionLabelStyle}>Показатели тела</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { icon: '⚖️', label: 'BMI', val: bmi || '—', sub: bmiCategory, bg: 'rgba(0,230,138,0.1)', border: 'rgba(0,230,138,0.15)', color: theme.accent },
            { icon: '💪', label: 'LBM', val: lbm ? `${lbm} кг` : '—', sub: 'Сухая масса', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
            { icon: '📐', label: 'FFMI', val: ffmi || '—', sub: ffmiCategory, bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
          ].map(m => (
            <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: theme.textDim, marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.val}</div>
              <div style={{ fontSize: 9, color: theme.textSecondary, marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
        {navyBf && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: theme.textDim }}>Navy BF%: </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{navyBf}%</span>
            <span style={{ fontSize: 10, color: theme.textSecondary, marginLeft: 6 }}>
              {parseFloat(navyBf) < 6 ? 'Очень низкий' : parseFloat(navyBf) < 18 ? 'Норма' : parseFloat(navyBf) < 25 ? 'Повышен' : 'Высокий'}
            </span>
          </div>
        )}
      </div>

      <ExpandableCard icon="⚖️" title="Основные параметры" color="#34d399" open={openBody} onToggle={() => setOpenBody(!openBody)}
        summary={`${settings.height || '—'} см · ${settings.weight || '—'} кг · ${settings.bodyFat ? settings.bodyFat + '% жира' : ''}`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <HealthNumber label="Рост (см)" value={settings.height || ''} onChange={v => save({ height: parseInt(v) || 0 })} placeholder="175" />
          <HealthNumber label="Вес (кг)" value={settings.weight || ''} onChange={v => save({ weight: parseFloat(v) || 0 })} placeholder="80" />
          <HealthNumber label="% жира (ручной)" value={settings.bodyFat || ''} onChange={v => save({ bodyFat: v ? parseFloat(v) || 0 : undefined })} placeholder="15" />
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Пол</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <HealthBool label="М" active={settings.sex === 'male'} onClick={() => save({ sex: 'male' })} />
              <HealthBool label="Ж" active={settings.sex === 'female'} onClick={() => save({ sex: 'female' })} />
            </div>
          </div>
        </div>
      </ExpandableCard>

      <ExpandableCard icon="📏" title="Обхваты (см)" color="#60a5fa" open={openGirth} onToggle={() => setOpenGirth(!openGirth)} summary={girthSummary}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { k: 'waistCm', l: 'Талия' }, { k: 'neckCm', l: 'Шея' }, { k: 'chestCm', l: 'Грудь' },
            { k: 'hipCm', l: 'Бёдра' }, { k: 'forearmCm', l: 'Предплечье' }, { k: 'bicepCm', l: 'Бицепс' },
            { k: 'thighCm', l: 'Бедро' },
          ].map(c => (
            <HealthNumber key={c.k} label={c.l} value={(settings as any)[c.k] ?? ''}
              onChange={v => save({ [c.k]: v ? parseFloat(v) || 0 : undefined } as any)} suffix="см" />
          ))}
        </div>
      </ExpandableCard>

      {weightLog.length > 1 && (
        <div style={glassCardStyle}>
          <div style={{ ...sectionLabelStyle, marginBottom: 10 }}>История веса ({weightLog.length} записей)</div>
          <div style={{ display: 'flex', gap: 1, height: 70, alignItems: 'flex-end', padding: '0 4px' }}>
            {weightLog.slice(-30).map((e, i, arr) => {
              const minW = Math.min(...weightLog.map(w => w.weight));
              const maxW = Math.max(...weightLog.map(w => w.weight));
              const range = maxW - minW || 1;
              const h = Math.max(4, ((e.weight - minW) / range) * 100);
              const isLast = i === arr.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }} title={`${e.date}: ${e.weight} кг`}>
                  <div style={{
                    width: '75%', height: `${h}%`,
                    background: isLast ? theme.gradientGreen : `linear-gradient(180deg, rgba(0,230,138,${0.3 + ((e.weight - minW) / range) * 0.5}), rgba(0,180,100,${0.15 + ((e.weight - minW) / range) * 0.3}))`,
                    borderRadius: '2px 2px 0 0', minHeight: 2,
                  }} />
                  {i % 7 === 0 && <span style={{ fontSize: 7, color: theme.textDim }}>{e.date.slice(5)}</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: theme.textDim, marginTop: 6 }}>
            <span>Мин: {Math.min(...weightLog.map(w => w.weight ?? 0)).toFixed(1)} кг</span>
            <span style={{ color: theme.accent, fontWeight: 600 }}>{weightLog[weightLog.length - 1]?.weight?.toFixed(1) ?? '—'} кг</span>
            <span>Макс: {Math.max(...weightLog.map(w => w.weight ?? 0)).toFixed(1)} кг</span>
          </div>
        </div>
      )}
    </div>
  );
};
