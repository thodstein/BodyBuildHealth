import React, { useMemo, useState } from 'react';
import { applyToPlanner } from './planner-bridge';
import {
  TEMPO_PRESETS,
  formatTempo,
  calculateRepDuration,
  type TempoPhase,
  type TempoPreset,
} from '../../../engines/rep-tempo.engine';
import {
  generateRepTempo,
  type RepPattern,
} from '../../../engines/rep-tempo-engine';
import { useDataLink } from '../../../core/data-link';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: '12px', margin: '6px 0' };

const PHASE_COLORS = {
  eccentric: '#a855f7',
  bottomPause: '#3b82f6',
  concentric: '#22c55e',
  topPause: '#f59e0b',
};

const PHASE_NAMES: Record<string, string> = {
  eccentric: 'Эксцентрика',
  bottomPause: 'Пауза внизу',
  concentric: 'Концентрика',
  topPause: 'Пауза вверху',
};

const REP_PATTERNS: { id: RepPattern; nameRu: string; desc: string }[] = [
  { id: 'normal', nameRu: 'Стандартный', desc: 'Полная амплитуда, контролируемые повторения' },
  { id: 'pause', nameRu: 'С паузой', desc: 'Пауза 1-2с в растянутой позиции' },
  { id: 'tempo', nameRu: 'Темповый', desc: 'Медленный эксцентрик, контроль на всём движении' },
  { id: 'explosive', nameRu: 'Взрывной', desc: 'Макс. скорость концентрики, быстрый подъём' },
  { id: 'cluster', nameRu: 'Кластерный', desc: 'Мини-отдых между повторениями внутри сета' },
  { id: 'rest_pause', nameRu: 'Rest-Pause', desc: 'Короткие паузы между подходами до отказа' },
  { id: 'partial', nameRu: 'Частичные', desc: 'Ограниченная амплитуда для перегрузки/реабилитации' },
  { id: 'slow', nameRu: 'Медленный', desc: '4-5с эксцентрика, 2-3с концентрика, TUL макс' },
];

const ALL_TEMPOS: TempoPreset[] = Object.values(TEMPO_PRESETS);

const MANUAL_TEMPOS: TempoPreset[] = [
  ...ALL_TEMPOS,
  {
    id: 'rehab',
    nameRu: 'Реабилитационный',
    tempo: { eccentric: 5, bottomPause: 2, concentric: 2, topPause: 1 },
    description: 'Максимальный контроль. Для пост-травматического восстановления и обучения движению.',
    goal: 'technique',
  },
  {
    id: 'tut_max',
    nameRu: 'TUL-максимум',
    tempo: { eccentric: 4, bottomPause: 2, concentric: 1, topPause: 1 },
    description: 'Максимальное время под нагрузкой. Акцент на метаболический стресс и саркоплазматическую гипертрофию.',
    goal: 'hypertrophy',
  },
  {
    id: 'speed',
    nameRu: 'Скоростной',
    tempo: { eccentric: 1, bottomPause: 0, concentric: 0, topPause: 0 },
    description: 'Компенсаторное ускорение (CAT). Максимальное намерение ускорить штангу в концентрике.',
    goal: 'power',
  },
  {
    id: 'iso_stretch',
    nameRu: 'Изометрия в растяжении',
    tempo: { eccentric: 2, bottomPause: 3, concentric: 1, topPause: 0 },
    description: 'Удлинённая пауза в растянутой позиции для стимуляции саркомерогенеза и фасциального растяжения.',
    goal: 'hypertrophy',
  },
];

const GOALS = ['strength', 'hypertrophy', 'power', 'technique'] as const;
type TempoGoal = typeof GOALS[number];

export const TempoTab: React.FC = () => {
  const linked = useDataLink();
  const [selectedGoal, setSelectedGoal] = useState<TempoGoal>('hypertrophy');
  const [customTempo, setCustomTempo] = useState<TempoPhase>({ eccentric: 3, bottomPause: 1, concentric: 1, topPause: 0 });
  const [filterGoal, setFilterGoal] = useState<TempoGoal | 'all'>('all');
  const [showPresets, setShowPresets] = useState(true);

  const filteredPresets = MANUAL_TEMPOS.filter(p => filterGoal === 'all' || p.goal === filterGoal);

  const totalRepTime = calculateRepDuration(customTempo);
  const maxPhase = Math.max(customTempo.eccentric, customTempo.bottomPause, customTempo.concentric, customTempo.topPause, 1);

  const goalTempos = useMemo(() => {
    const base: Record<string, { compound: string; isolation: string }> = {};
    GOALS.forEach(g => {
      const compoundInput = { goal: g, riskLevel: 'low' as const, difficultyLevel: 'medium' as const, techniqueIssues: [], isMainLift: true };
      const isolationInput = { ...compoundInput, isMainLift: false };
      base[g] = {
        compound: generateRepTempo(compoundInput).tempo.toString(),
        isolation: generateRepTempo(isolationInput).tempo.toString(),
      };
    });
    return base;
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 4 }}>⏱️ Темп повторений</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.5 }}>
        Управление скоростью повторений. Формат <b>Эксцентрика–Пауза внизу–Концентрика–Пауза вверху</b> (сек).
        Каждая фаза определяет стимул: эксцентрика — микротравмы, пауза внизу — растяжение, концентрика — сила.
      </div>

      {/* Цель → авто-темп */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🎯 Авто-темп по цели</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          {GOALS.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGoal(g)}
              style={{
                padding: '6px 4px', borderRadius: 8, border: '1px solid ' + (selectedGoal === g ? ACCENT : 'rgba(255,255,255,0.08)'),
                background: selectedGoal === g ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
                color: selectedGoal === g ? ACCENT : 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                textAlign: 'center' as const, transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.6, marginBottom: 2 }}>
                {g === 'strength' ? 'Сила' : g === 'hypertrophy' ? 'Гипертрофия' : g === 'power' ? 'Мощность' : 'Техника'}
              </div>
              <div style={{ fontSize: 10, color: '#a855f7' }}>
                сост: {goalTempos[g]?.compound || '-'}
              </div>
              <div style={{ fontSize: 10, color: '#60a5fa' }}>
                изол: {goalTempos[g]?.isolation || '-'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Визуальная схема темпа */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
          🎨 Визуальная схема темпа: <span style={{ color: ACCENT, fontFamily: 'monospace', fontSize: 15 }}>{formatTempo(customTempo)}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>TUL: {totalRepTime}с</span>
        </div>

        <div style={{ display: 'flex', gap: 1, height: 40, marginBottom: 8, borderRadius: 8, overflow: 'hidden' }}>
          {customTempo.eccentric > 0 && (
            <div style={{ flex: customTempo.eccentric / maxPhase * 100, background: PHASE_COLORS.eccentric, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#000' }}>↓{customTempo.eccentric}с</span>
            </div>
          )}
          {customTempo.bottomPause > 0 && (
            <div style={{ flex: customTempo.bottomPause / maxPhase * 100, background: PHASE_COLORS.bottomPause, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#000' }}>⊡{customTempo.bottomPause}с</span>
            </div>
          )}
          {customTempo.concentric > 0 && (
            <div style={{ flex: customTempo.concentric / maxPhase * 100, background: PHASE_COLORS.concentric, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#000' }}>↑{customTempo.concentric}с</span>
            </div>
          )}
          {customTempo.topPause > 0 && (
            <div style={{ flex: customTempo.topPause / maxPhase * 100, background: PHASE_COLORS.topPause, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#000' }}>⊤{customTempo.topPause}с</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 4 }}>
          {(['eccentric', 'bottomPause', 'concentric', 'topPause'] as const).map(phase => (
            <div key={phase} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: PHASE_COLORS[phase], fontWeight: 700, marginBottom: 2 }}>{PHASE_NAMES[phase]}</div>
              <input
                type="range"
                min={0} max={5} step={1}
                value={customTempo[phase]}
                onChange={e => setCustomTempo(prev => ({ ...prev, [phase]: +e.target.value }))}
                style={{ width: '100%', accentColor: PHASE_COLORS[phase] }}
              />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{customTempo[phase]}с</div>
            </div>
          ))}
        </div>
      </div>

      {/* Библиотека пресетов */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>📚 Библиотека темпов ({filteredPresets.length})</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setFilterGoal('all')}
              style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid ' + (filterGoal === 'all' ? ACCENT : 'rgba(255,255,255,0.1)'), background: filterGoal === 'all' ? 'rgba(0,230,138,0.1)' : 'transparent', color: filterGoal === 'all' ? ACCENT : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
            >
              Все
            </button>
            {GOALS.map(g => (
              <button
                key={g}
                onClick={() => setFilterGoal(g)}
                style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid ' + (filterGoal === g ? ACCENT : 'rgba(255,255,255,0.1)'), background: filterGoal === g ? 'rgba(0,230,138,0.1)' : 'transparent', color: filterGoal === g ? ACCENT : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
              >
                {g === 'strength' ? 'Сила' : g === 'hypertrophy' ? 'Гипер' : g === 'power' ? 'Мощь' : 'Техн'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredPresets.map(preset => {
            const t = preset.tempo;
            const repTime = t.eccentric + t.bottomPause + t.concentric + t.topPause;
            const phases: { key: keyof TempoPhase; val: number }[] = ([
              { key: 'eccentric' as const, val: t.eccentric },
              { key: 'bottomPause' as const, val: t.bottomPause },
              { key: 'concentric' as const, val: t.concentric },
              { key: 'topPause' as const, val: t.topPause },
            ] as { key: keyof TempoPhase; val: number }[]).filter(p => p.val > 0);
            const maxV = Math.max(...phases.map(p => p.val), 1);

            return (
              <div
                key={preset.id}
                onClick={() => setCustomTempo({ eccentric: t.eccentric, bottomPause: t.bottomPause, concentric: t.concentric, topPause: t.topPause })}
                style={{
                  padding: '10px', borderRadius: 8, border: '1px solid ' + (customTempo.eccentric === t.eccentric && customTempo.bottomPause === t.bottomPause && customTempo.concentric === t.concentric && customTempo.topPause === t.topPause ? ACCENT : 'rgba(255,255,255,0.08)'),
                  background: customTempo.eccentric === t.eccentric && customTempo.bottomPause === t.bottomPause ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{preset.nameRu}</span>
                  <span style={{ fontSize: 10, color: ACCENT, fontFamily: 'monospace', fontWeight: 700 }}>
                    {formatTempo(t)}
                    <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>TUL {repTime}с</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 1, height: 14, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                  {phases.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        flex: p.val / maxV * 100,
                        background: PHASE_COLORS[p.key],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#000' }}>{p.val}с</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                  {preset.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Реп-паттерны */}
      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🔄 Паттерны повторений</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.4 }}>
          Реп-паттерн определяет способ выполнения серии повторений: обычный, с паузой, кластерный, взрывной и др.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {REP_PATTERNS.map(rp => {
            const engineTempo = generateRepTempo({ goal: 'hypertrophy', riskLevel: 'low', difficultyLevel: 'medium', techniqueIssues: [], isMainLift: true });
            return (
              <div key={rp.id} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{rp.nameRu}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3, marginBottom: 3 }}>{rp.desc}</div>
                <div style={{ fontSize: 10, color: '#a855f7', fontFamily: 'monospace', background: 'rgba(168,85,247,0.1)', padding: '1px 5px', borderRadius: 4, display: 'inline-block' }}>
                  {engineTempo.tempo.toString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Как использовать */}
      <div style={{ ...CARD, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>💡 Как применять темп в плане</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          • <b>Сила (2-1-1-0):</b> контролируй эксцентрику, пауза для снятия инерции, взрывной подъём.<br />
          • <b>Гипертрофия (3-1-1-0):</b> медленный негатив + пауза в растяжении = макс. микротравмы.<br />
          • <b>Мощность (1-0-0-0):</b> компенсаторное ускорение, никаких пауз, макс. скорость.<br />
          • <b>Техника (4-2-2-1):</b> медленно во всех фазах. Идеально для обучения новому движению.<br />
          • Нажми на чип темпа в ручном конструкторе, чтобы сменить темп упражнения.
        </div>
      </div>
      <div style={{ marginTop: 6, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить темп <b style={{ color: '#00e68a' }}>{formatTempo(customTempo)}</b> к активному планировщику — все упражнения плана получат этот темп (эксцентрика/пауза/концентрика/пауза).</div>
        <button onClick={() => applyToPlanner({ kind: 'tempo', label: 'Темп ' + formatTempo(customTempo), data: { ...customTempo, label: formatTempo(customTempo) } })} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить темп к планировщику</button>
      </div>
    </div>
  );
};

export default TempoTab;
