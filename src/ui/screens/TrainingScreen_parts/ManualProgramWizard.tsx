import React, { useMemo } from 'react';
import { BTN, BTN_GHOST, CARD, DIM, IN, SMALL } from './training-ui';
import { TrainingModal } from './TrainingModal';
import { EditorPopupSelect } from './EditorPopup';
import { buildBBUserProgramFromProfile } from './auto-fill-draft';
import { loadTrainingProfile } from './training-profile';
import { computePlanQualityFor } from '../../../engines/manual-constructor';
import { ProgressBar, InfoBanner } from './ManualUI';

export type WizardDirection = 'bb' | 'pl' | 'hybrid';
export type WizardStep = 1 | 2 | 3 | 4 | 5;

const DIRECTIONS: Array<[WizardDirection, string, string]> = [
  ['bb', '💪 Бодибилдинг', 'hypertrophy'],
  ['pl', '🏋 Пауэрлифтинг', 'powerlifting'],
  ['hybrid', '⚡ Powerbuilder', 'powerbuilding'],
];

const LEVELS = [
  ['beginner', 'Новичок'],
  ['intermediate', 'Средний'],
  ['advanced', 'Опытный'],
  ['enhanced', 'Enhanced'],
] as const;

interface Props {
  open: boolean;
  embedded?: boolean;
  step: WizardStep;
  direction: WizardDirection;
  goal: string;
  level: string;
  days: number;
  weeks: number;
  pro: boolean;
  onClose: () => void;
  onStep: (step: WizardStep) => void;
  onDirection: (direction: WizardDirection, defaultGoal: string) => void;
  onGoal: (goal: string) => void;
  onLevel: (level: string) => void;
  onDays: (days: number) => void;
  onWeeks: (weeks: number) => void;
  onCreate: (autoFill: boolean) => void;
}

export const ManualProgramWizard: React.FC<Props> = ({
  open, embedded = false, step, direction, goal, level, days, weeks, pro,
  onClose, onStep, onDirection, onGoal, onLevel, onDays, onWeeks, onCreate,
}) => {
  if (!open) return null;
  const STEP_TITLES = ['Тип', 'Цель', 'Формат', 'Каркас', 'Превью'] as const;

  const preview = useMemo(() => {
    if (step !== 5) return null;
    try {
      const prof = loadTrainingProfile();
      if (direction === 'bb') {
        const prog = buildBBUserProgramFromProfile({ title: 'Превью', goal, level, days, weeks, prof });
        let quality: ReturnType<typeof computePlanQualityFor> | null = null;
        try { quality = computePlanQualityFor(prog, level); } catch {}
        const w1 = prog.bb?.weeks[0];
        const totalEx = prog.bb?.weeks.reduce((s, w) => s + w.sessions.reduce((ss, se) => ss + se.blocks.length, 0), 0) ?? 0;
        const perMuscle = quality?.perMuscle.slice(0, 6) ?? [];
        return { kind: 'bb' as const, prog, quality, w1, totalEx, perMuscle };
      }
      if (direction === 'pl') {
        // PL preview: show selected cycle info would be here; simplified
        return { kind: 'pl' as const, info: `${days} дн/нед × ${weeks} нед · уровень ${level}` };
      }
      // hybrid
      const prof2 = loadTrainingProfile();
      const bbProg = buildBBUserProgramFromProfile({ title: 'Превью hybrid', goal: 'hypertrophy', level, days: Math.max(1, days - 2), weeks, prof: prof2 });
      return { kind: 'hybrid' as const, bbProg, info: `ПЛ ${Math.max(2, Math.min(4, days))}д + ББ ${Math.max(1, days - 2)}д` };
    } catch {
      return { kind: 'error' as const };
    }
  }, [step, direction, goal, level, days, weeks]);

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, overflowX: 'auto' }}>
        {([1,2,3,4,5] as WizardStep[]).map(s => {
          const active = s === step;
          const done = s < step;
          return (
            <div key={s} style={{ flex: 1, minWidth: 44, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, background: active ? '#a78bfa' : done ? '#22c55e' : 'rgba(255,255,255,0.08)', color: '#fff', border: active ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.08)' }}>{done ? '✓' : s}</div>
              <div style={{ fontSize: 10, color: active ? '#a78bfa' : done ? '#22c55e' : '#fff', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>{STEP_TITLES[s-1]}</div>
              {s < 5 && <div style={{ flex: 1, height: 2, background: s < step ? '#22c55e' : 'rgba(255,255,255,0.08)', borderRadius: 1, marginLeft: 4 }} />}
            </div>
          );
        })}
      </div>
      {step === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>Шаг 1 из 5: что вы тренируете?</div>
        <div style={{ fontSize: 10, color: DIM }}>Выберите основной тип программы. Его можно будет редактировать после создания.</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIRECTIONS.map(([id, label, defaultGoal]) => <button key={id} onClick={() => onDirection(id, defaultGoal)} style={{ ...BTN, flex: 1, minHeight: 44, background: direction === id ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : '#7c3aed20', color: direction === id ? '#fff' : '#a78bfa' }}>{label}</button>)}
        </div>
      </div>}
      {step === 2 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>Шаг 2 из 5: какая цель?</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 2 }}>{direction === 'pl' ? 'Для ПЛ цель фиксирована: развитие соревновательных движений.' : 'Цель влияет на фазы, объём и рекомендации программы.'}</div>
        <EditorPopupSelect
          value={goal}
          options={[
            { id: 'hypertrophy', label: '💪 Мышечная масса' }, { id: 'cut', label: '✂️ Сушка' },
            { id: 'recomp', label: '🔁 Рекомпозиция' }, { id: 'maintenance', label: '⚖ Поддержание' },
            { id: 'strength_mass', label: '🎯 Сила + Масса' }, { id: 'athletic', label: '🏅 Атлетизм' },
          ]}
          onChange={onGoal}
          disabled={direction === 'pl'}
          ariaLabel="Цель программы"
          title="Цель программы"
        />
      </div>}
      {step === 3 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>Шаг 3 из 5: сколько и как часто?</div>
        <div style={{ fontSize: 10, color: DIM }}>Дни/нед = количество тренировок в каждой неделе. Упражнения и названия дней добавляются позже в редакторе.</div>
        <EditorPopupSelect
          value={level}
          options={LEVELS.map(([id, label]) => ({ id, label }))}
          onChange={onLevel}
          ariaLabel="Уровень подготовки"
          title="Уровень подготовки"
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column' }}>Дней/нед<input type="number" style={IN} min={2} max={6} value={days} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onDays(Math.max(2, Math.min(6, Math.round(v)))); }} aria-label="Дней в неделю" inputMode="numeric" /></label>
          <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column' }}>Недель<input type="number" style={IN} min={4} max={24} value={weeks} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onWeeks(Math.max(4, Math.min(24, Math.round(v)))); }} aria-label="Недель в программе" inputMode="numeric" /></label>
        </div>
      </div>}
      {step === 4 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>Шаг 4 из 5: проверьте каркас</div>
        <div className="constructor-surface constructor-surface--tinted" style={{ ...CARD, padding: 10, background: 'rgba(167,139,250,0.06)' }}><div style={{ fontSize: 12, color: '#fff' }}>📋 <b>{direction === 'bb' ? 'Бодибилдинг' : direction === 'pl' ? 'Пауэрлифтинг' : 'Powerbuilder'}</b></div><div style={{ fontSize: 11, color: DIM }}>Цель: {goal} · уровень: {level}</div><div style={{ fontSize: 11, color: DIM }}>{days} тренировок в неделю × {weeks} нед.</div><div style={{ fontSize: 10, color: DIM, marginTop: 5, lineHeight: 1.45 }}>{pro ? 'На шаге 5 — живое превью качественной программы (неделя-1 + балл качества).' : '💡 Рекомендуем «⚡ Создать и заполнить» — качественная программа в 1 клик по вашему профилю.'}</div></div>
      </div>}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#fff', fontWeight: 800 }}>Шаг 5 из 5: превью — как будет выглядеть программа</div>
          {!preview || (preview as any).kind === 'error' ? (
            <InfoBanner tone="warn">⚠ Не удалось собрать превью — проверьте профиль (оборудование/уровень) и попробуйте снова. Можно создать пустой каркас.</InfoBanner>
          ) : (preview as any).kind === 'bb' ? (
            <>
              <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #00e68a', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#00e68a' }}>💪 ББ · {days}д/нед × {weeks} нед</span>
                  {(preview as any).quality && <span style={{ fontSize: 11, fontWeight: 800, color: (preview as any).quality.score >= 75 ? '#22c55e' : (preview as any).quality.score >= 50 ? '#f59e0b' : '#ef4444' }}>{(preview as any).quality.score}/100 {(preview as any).quality.grade}</span>}
                  <span style={{ fontSize: 10, color: DIM, marginLeft: 'auto' }}>{(preview as any).totalEx} упр. всего</span>
                </div>
                {(preview as any).quality && <ProgressBar value={(preview as any).quality.score} max={100} color={(preview as any).quality.score >= 75 ? '#22c55e' : (preview as any).quality.score >= 50 ? '#f59e0b' : '#ef4444'} height={6} />}
                {(preview as any).w1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(preview as any).w1.sessions.map((s: any, si: number) => (
                      <div key={si} style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px' }}>
                        <b style={{ color: '#00e68a' }}>{s.name || `День ${si + 1}`}</b> · {s.blocks.slice(0, 2).map((b: any) => b.exerciseName).join(' · ')}{s.blocks.length > 2 ? ` +${s.blocks.length - 2}` : ''} · {s.blocks.length} упр.
                      </div>
                    ))}
                  </div>
                )}
                {(preview as any).quality?.perMuscle?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(preview as any).quality.perMuscle.slice(0, 6).map((pm: any) => {
                      const pct = pm.mrv ? Math.round((pm.peakSets / pm.mrv) * 100) : 0;
                      const clr = pct > 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : pm.status === 'low' ? '#3b82f6' : '#22c55e';
                      return <span key={pm.muscle} style={{ fontSize: 10, fontWeight: 700, color: clr, background: clr + '14', border: `1px solid ${clr}30`, borderRadius: 6, padding: '2px 6px' }}>{pm.muscle} {pm.peakSets}/{pm.mrv}</span>;
                    })}
                  </div>
                )}
                <div style={{ fontSize: 10, color: DIM }}>На основе профиля: уровень {level}, оборудование и слабые группы учтены. Веса по workMax.</div>
              </div>
            </>
          ) : (preview as any).kind === 'pl' ? (
            <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>🏆 ПЛ · {(preview as any).info}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>В превью: будет подобран LMS-цикл под уровень/дни + ваш оверлей (ПМ, заметки). Процентки цикла immutable.</div>
            </div>
          ) : (
            <div style={{ ...CARD, padding: 10, borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6' }}>⚡ Powerbuilder · {(preview as any).info}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>ПЛ-цикл + ББ-недели. ББ-часть показана в превью выше, ПЛ — после создания.</div>
            </div>
          )}
          <InfoBanner tone="info">💡 Это превью авто-сборки. После создания вы сможете вручную править каждое упражнение, сеты и RIR.</InfoBanner>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {step > 1 && <button style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }} onClick={() => onStep(Math.max(1, step - 1) as WizardStep)}>← Назад</button>}
        {step < 4 && <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => onStep((step + 1) as WizardStep)}>Далее →</button>}
        {step === 4 && <button style={{ ...BTN, flex: 1, minHeight: 44 }} onClick={() => onStep(5)}>Превью →</button>}
        {step === 5 && <button style={{ ...BTN_GHOST, flex: 1, minHeight: 44, minWidth: 140 }} onClick={() => onCreate(false)} title="Создать пустую структуру">📄 Пустой каркас</button>}
        {step === 5 && <button style={{ ...BTN, flex: 1, minHeight: 44, minWidth: 160, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800 }} onClick={() => onCreate(true)}>⚡ Создать и заполнить</button>}
      </div>
    </div>
  );
  return embedded ? <div className="constructor-surface constructor-surface--info" style={{ ...CARD, padding: 10, borderLeft: '3px solid #a78bfa' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>🪄 Визард — шаг {step} из 5</span><button style={{ ...BTN_GHOST, minHeight: 44 }} onClick={onClose}>Отмена</button></div>{content}</div> : <TrainingModal title={`🪄 Визард — шаг ${step} из 5`} onClose={onClose}>{content}</TrainingModal>;
};
