import React from 'react';
import type { UserProfile } from '../../../core/types';
import { theme, glassCardStyle, sectionLabelStyle, ExpandableCard, HealthNumber, HealthBool, HealthSlider } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
  calcData: any;
  upCalc: (k: string, v: any) => void;
  toggleWeakPoint: (id: string) => void;
}

const MUSCLE_GROUPS_FULL: { id: string; label: string }[] = [
  { id: 'chest', label: 'Грудь' }, { id: 'back', label: 'Спина' }, { id: 'shoulders', label: 'Плечи' },
  { id: 'biceps', label: 'Бицепс' }, { id: 'triceps', label: 'Трицепс' }, { id: 'quads', label: 'Квадрицепс' },
  { id: 'hamstrings', label: 'Бицепс бедра' }, { id: 'glutes', label: 'Ягодицы' }, { id: 'calves', label: 'Икры' },
  { id: 'abs', label: 'Пресс' }, { id: 'traps', label: 'Трапеция' }, { id: 'forearms', label: 'Предплечья' },
];
const TRAINING_LEVELS: { id: string; label: string }[] = [
  { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' },
  { id: 'advanced', label: 'Продвинутый' }, { id: 'enhanced', label: 'Enhanced' }
];
const PHARMA_EXPERIENCE: { id: string; label: string }[] = [
  { id: 'none', label: 'Нет' }, { id: 'beginner', label: 'Начинающий' },
  { id: 'intermediate', label: 'Средний' }, { id: 'advanced', label: 'Продвинутый' }
];
const GOALS: { id: string; label: string }[] = [
  { id: 'bulk', label: 'Масса' }, { id: 'cut', label: 'Сушка' }, { id: 'maintenance', label: 'Поддержка' },
  { id: 'strength', label: 'Сила' }, { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'rehab', label: 'Реабилитация' },
  { id: 'recomposition', label: 'Рекомп' }, { id: 'health', label: 'Здоровье' }
];

export const ProfileLifestyleSection: React.FC<Props> = ({ settings, save, calcData, upCalc, toggleWeakPoint }) => {
  const cd = calcData || {};
  return (
    <div>
      <ExpandableCard icon="😰" title="Стресс и усталость" color="#f87171" open={false}>
        <HealthSlider label="Стресс" value={settings.baselineStressLevel ?? 3} onChange={v => save({ baselineStressLevel: v })} />
        <HealthSlider label="Усталость" value={settings.fatigueLevel ?? 3} onChange={v => save({ fatigueLevel: v })} />
      </ExpandableCard>

      <ExpandableCard icon="🏃" title="Активность" color="#34d399" open={false}
        summary={`Шаги: ${settings.dailySteps ?? 6000} · Вода: ${settings.dailyWaterLiters ?? 2}л · Тренировки: ${settings.workoutsPerWeek || '—'}/${settings.avgWorkoutMinutes || '—'}мин`}>
        {[{ k: 'dailySteps', l: 'Шаги/день', max: 30000, step: 500 }, { k: 'dailyWaterLiters', l: 'Вода/день (л)', max: 6, step: 0.1 }].map(({ k, l, max, step }) => {
          const val = (settings as any)[k] ?? (k === 'dailySteps' ? 6000 : 2);
          return (
            <div key={k} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{l}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent }}>{val}</span>
              </div>
              <input type="range" min={0} max={max} step={step} value={val}
                onChange={e => save({ [k]: parseFloat(e.target.value) || 0 })}
                style={{ width: '100%', accentColor: theme.accent }} />
            </div>
          );
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <HealthNumber label="Тренировок/нед" value={settings.workoutsPerWeek || ''} onChange={v => save({ workoutsPerWeek: parseFloat(v) || 0 })} />
          <HealthNumber label="Мин/тренировку" value={settings.avgWorkoutMinutes || ''} onChange={v => save({ avgWorkoutMinutes: parseFloat(v) || 0 })} />
        </div>
      </ExpandableCard>

      <ExpandableCard icon="📊" title="Уровни и опыт" color="#8b5cf6" open={false}
        summary={`${TRAINING_LEVELS.find(l => l.id === (settings.trainingLevel || 'intermediate'))?.label || '—'} · ${PHARMA_EXPERIENCE.find(e => e.id === (settings.pharmaExperience || 'none'))?.label || '—'}`}>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Тренировочный уровень</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {TRAINING_LEVELS.map(l => (
              <HealthBool key={l.id} label={l.label} active={(settings.trainingLevel || 'intermediate') === l.id}
                onClick={() => save({ trainingLevel: l.id as any })} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Фармакологический опыт</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {PHARMA_EXPERIENCE.map(e => (
              <HealthBool key={e.id} label={e.label} active={(settings.pharmaExperience || 'none') === e.id}
                onClick={() => save({ pharmaExperience: e.id as any })} />
            ))}
          </div>
        </div>
      </ExpandableCard>

      <ExpandableCard icon="🎯" title="Цель" color="#fbbf24" open={false}
        summary={GOALS.find(g => g.id === (settings.primaryGoal || settings.goal || ''))?.label || 'Не выбрана'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {GOALS.map(g => (
            <HealthBool key={g.id} label={g.label} active={(settings.primaryGoal || settings.goal || '') === g.id}
              onClick={() => save({ primaryGoal: g.id as any, goal: g.id })} />
          ))}
        </div>
      </ExpandableCard>

      <ExpandableCard icon="💪" title="Отстающие группы мышц" color="#f97316" open={false}
        summary={(() => { const wp = settings.weakPoints ?? []; return wp.length ? wp.map((id: string) => MUSCLE_GROUPS_FULL.find(m => m.id === id)?.label || id).join(', ') : 'Не указаны'; })()}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {MUSCLE_GROUPS_FULL.map(m => (
            <HealthBool key={m.id} label={m.label} active={(settings.weakPoints ?? []).includes(m.id)}
              onClick={() => toggleWeakPoint(m.id)} />
          ))}
        </div>
      </ExpandableCard>

      <ExpandableCard icon="💊" title="Принимаю: БАДы" color="#38bdf8" open={false}
        summary={(settings.currentSupplements ?? []).map((x: any) => x.name || '?').join(', ') || 'Нет'}>
        {(settings.currentSupplements ?? []).map((sup: any, i: number) => (
          <div key={sup.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{sup.name || '?'} — {sup.doseMg} {sup.doseUnit}</span>
            <button onClick={() => save({ currentSupplements: (settings.currentSupplements ?? []).filter((_: any, j: number) => j !== i) })}
              style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 9, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <button onClick={() => save({ currentSupplements: [...(settings.currentSupplements ?? []), { id: crypto.randomUUID(), name: '', doseMg: 0, doseUnit: 'mg' }] })}
          style={{ marginTop: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.1)', color: '#7dd3fc', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
          + Добавить БАД
        </button>
      </ExpandableCard>

      <ExpandableCard icon="💉" title="Принимаю: Аптека" color="#a78bfa" open={false}
        summary={(settings.currentMedications ?? []).map((x: any) => x.name || '?').join(', ') || 'Нет'}>
        {(settings.currentMedications ?? []).map((med: any, i: number) => (
          <div key={med.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{med.name || '?'} — {med.doseMg} {med.doseUnit} ({med.frequency})</span>
            <button onClick={() => save({ currentMedications: (settings.currentMedications ?? []).filter((_: any, j: number) => j !== i) })}
              style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 9, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <button onClick={() => save({ currentMedications: [...(settings.currentMedications ?? []), { id: crypto.randomUUID(), name: '', doseMg: 0, doseUnit: 'mg', frequency: 'daily' }] })}
          style={{ marginTop: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.1)', color: '#c4b5fd', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
          + Добавить препарат
        </button>
      </ExpandableCard>

      <ExpandableCard icon="🧠" title="Нейро и Псих (калькулятор поддержки)" color="#e879f9" open={false}
        summary={`Дофамин: ${cd.neuro?.dopamineScore || 1} · Серотонин: ${cd.neuro?.serotoninScore || 1} · Страх потери: ${cd.psych?.fearOfLoss || 1}`}>
        {[
          { k: 'neuro.dopamineScore', l: 'Дофамин', g: 'neuro', f: 'dopamineScore' },
          { k: 'neuro.serotoninScore', l: 'Серотонин', g: 'neuro', f: 'serotoninScore' },
          { k: 'neuro.aggressionScore', l: 'Агрессия', g: 'neuro', f: 'aggressionScore' },
          { k: 'psych.fearOfLoss', l: 'Страх потери', g: 'psych', f: 'fearOfLoss' },
          { k: 'psych.mirrorObsession', l: 'Одержимость зеркалом', g: 'psych', f: 'mirrorObsession' },
          { k: 'psych.apathyOffCycle', l: 'Апатия вне курса', g: 'psych', f: 'apathyOffCycle' },
        ].map(f => {
          const val = cd[f.g]?.[f.f] || 1;
          return (
            <div key={f.k} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{f.l}</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => upCalc(f.k, n)}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                      background: val === n ? theme.accent : 'rgba(255,255,255,0.06)',
                      color: val === n ? '#000' : 'rgba(255,255,255,0.4)',
                    }}>{n}</button>
                ))}
              </div>
            </div>
          );
        })}
      </ExpandableCard>
    </div>
  );
};
