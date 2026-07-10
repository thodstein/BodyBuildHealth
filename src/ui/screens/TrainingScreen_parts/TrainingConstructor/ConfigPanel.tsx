import React from 'react';
import { PopupSelect } from '../../SRCBBScreen_parts/TrainingPopups';
import { TRAINING_SPLITS } from '../../../../engines/training.engine';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import { FULL_PROGRAM_LIBRARY } from '../../../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from '../programs-data';
import { getMethodsByCategory, type TrainingMethod } from '../../../../engines/training-methodology.engine';
import { ACCENT, DIM, CONFIG_LABELS } from './types';

interface Props {
  manualCfg: Record<string, string>;
  setManual: (k: string, v: string) => void;
  onLoadProgram: (programId: string) => void;
}

/* ─── Вспомогательный компонент секции конфигурации ─── */
const ConfigSection: React.FC<{ title: string; color: string; children: React.ReactNode }> = ({ title, color, children }) => (
  <div style={{
    background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, marginBottom: 6,
    border: '1px solid rgba(255,255,255,0.04)',
  }}>
    <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 6, letterSpacing: '-0.02em' }}>{title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>{children}</div>
  </div>
);

/* ─── Групповые PopupSelect обёртки ─── */
const Sel: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string; desc?: string }[]; hint?: string }> =
  ({ label, value, onChange, options, hint }) => (
    <PopupSelect label={label} value={value} onChange={onChange} options={options} hint={hint} />
  );

export const ConfigPanel: React.FC<Props> = ({ manualCfg, setManual, onLoadProgram }) => {
  const allPrograms = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS];
  const selectedList = Object.entries(manualCfg).filter(([, v]) => v);

  return (
    <div>
      {/* ─── БАЗОВАЯ СТРУКТУРА ─── */}
      <ConfigSection title="🏗️ БАЗОВАЯ СТРУКТУРА" color="#60a5fa">
        <Sel label="Тип сплита" value={manualCfg.split || ''} onChange={v => setManual('split', v)}
          options={Object.entries(TRAINING_SPLITS).map(([id, s]: [string, any]) => ({ id, label: s.name, desc: s.desc }))}
          hint="Набор групп по дням" />
        <Sel label="Тип цикла" value={manualCfg.cycle || ''} onChange={v => setManual('cycle', v)}
          options={LMS_CYCLES.map((c: any) => ({
            id: c.meta.id, label: c.meta.title,
            desc: (c.meta.id.startsWith('block') ? 'Блок' : c.meta.id.startsWith('embed') ? 'Встроенная' : 'СРЦ') + ' · ' + c.meta.level,
          }))} hint="Силовые циклы / блоки / встроенные" />
        <Sel label="Программа тренировок" value={manualCfg.program || ''} onChange={v => setManual('program', v)}
          options={allPrograms.map((p: any) => ({ id: p.id, label: p.name, desc: p.type + ' · ' + p.goal + ' · ' + p.level }))}
          hint="Готовые программы из библиотеки" />
        <Sel label="Частота" value={manualCfg.frequency || ''} onChange={v => setManual('frequency', v)}
          options={getMethodsByCategory('frequency').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
      </ConfigSection>

      {/* ─── ПЕРИОДИЗАЦИЯ И ПРОГРЕССИЯ ─── */}
      <ConfigSection title="📈 ПЕРИОДИЗАЦИЯ И ПРОГРЕССИЯ" color="#a78bfa">
        <Sel label="Периодизация" value={manualCfg.periodization || ''} onChange={v => setManual('periodization', v)}
          options={getMethodsByCategory('periodization').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
        <Sel label="Прогрессия" value={manualCfg.progression || ''} onChange={v => setManual('progression', v)}
          options={getMethodsByCategory('progression').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
      </ConfigSection>

      {/* ─── ИНТЕНСИВНОСТЬ И ТЕХНИКА ─── */}
      <ConfigSection title="🎯 ИНТЕНСИВНОСТЬ И ТЕХНИКА" color="#f59e0b">
        <Sel label="Интенсивность" value={manualCfg.intensity || ''} onChange={v => setManual('intensity', v)}
          options={getMethodsByCategory('intensity').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
        <Sel label="Техника" value={manualCfg.technique || ''} onChange={v => setManual('technique', v)}
          options={getMethodsByCategory('technique').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
        <Sel label="Объём" value={manualCfg.volume || ''} onChange={v => setManual('volume', v)}
          options={getMethodsByCategory('volume').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
      </ConfigSection>

      {/* ─── СПЕЦИАЛИЗАЦИЯ ─── */}
      <ConfigSection title="🎯 СПЕЦИАЛИЗАЦИЯ (23 методики)" color="#ec4899">
        <Sel label="Специализация" value={manualCfg.specialization || ''} onChange={v => setManual('specialization', v)}
          options={getMethodsByCategory('specialization').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
      </ConfigSection>

      {/* ─── ВЫБРАННЫЕ ПАРАМЕТРЫ ─── */}
      {selectedList.length > 0 && (
        <div style={{
          marginTop: 4, padding: '6px 10px', borderRadius: 8,
          background: 'rgba(0,230,138,0.06)',
          border: '1px solid rgba(0,230,138,0.12)',
          fontSize: 10, color: ACCENT, lineHeight: 1.6, display: 'flex', flexWrap: 'wrap', gap: 4,
        }}>
          {selectedList.map(([k, v]) => (
            <span key={k} style={{
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(0,230,138,0.1)', fontSize: 9,
            }}>{(CONFIG_LABELS[k] || k)}: {v.length > 30 ? v.slice(0, 30) + '…' : v}</span>
          ))}
        </div>
      )}

      {/* ─── ЗАГРУЗИТЬ ПРОГРАММУ ─── */}
      {manualCfg.program && (
        <button onClick={() => onLoadProgram(manualCfg.program)}
          style={{
            width: '100%', marginTop: 6, padding: 10, borderRadius: 8,
            border: '1px solid rgba(168,85,247,0.3)',
            background: 'rgba(168,85,247,0.08)',
            color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700,
          }}>
          📥 Загрузить программу в конструктор
        </button>
      )}
    </div>
  );
};
