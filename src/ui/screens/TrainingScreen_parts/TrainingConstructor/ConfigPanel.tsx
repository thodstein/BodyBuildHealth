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

export const ConfigPanel: React.FC<Props> = ({ manualCfg, setManual, onLoadProgram }) => {
  const allPrograms = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS];
  const selectedList = Object.entries(manualCfg).filter(([, v]) => v);

  return (
    <div style={{
      background: 'rgba(0,230,138,0.04)',
      border: '1px solid rgba(0,230,138,0.15)',
      borderRadius: 10,
      padding: 10,
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>
        ⚙️ Ручная конфигурация программы
      </div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>
        Выберите любой параметр — все опциональны. Не выбрано = авто-подбор.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <PopupSelect label="Тип сплита" value={manualCfg.split || ''} onChange={v => setManual('split', v)}
          options={Object.entries(TRAINING_SPLITS).map(([id, s]: [string, any]) => ({
            id, label: s.name, desc: s.desc,
          }))} hint="Все сплиты из библиотеки" />

        <PopupSelect label="Тип цикла" value={manualCfg.cycle || ''} onChange={v => setManual('cycle', v)}
          options={LMS_CYCLES.map((c: any) => ({
            id: c.meta.id, label: c.meta.title,
            desc: (c.meta.id.startsWith('block') ? 'Блок' : c.meta.id.startsWith('embed') ? 'Встроенная' : 'Силовой') + ' · ' + c.meta.level,
          }))} hint="Все циклы по категориям" />

        <PopupSelect label="Программа тренировок" value={manualCfg.program || ''} onChange={v => setManual('program', v)}
          options={allPrograms.map((p: any) => ({
            id: p.id, label: p.name,
            desc: p.type + ' · ' + p.goal + ' · ' + p.level,
          }))} hint="Готовые программы из библиотеки" />

        <PopupSelect label="Периодизация" value={manualCfg.periodization || ''} onChange={v => setManual('periodization', v)}
          options={getMethodsByCategory('periodization').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />

        <PopupSelect label="Прогрессия" value={manualCfg.progression || ''} onChange={v => setManual('progression', v)}
          options={getMethodsByCategory('progression').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />

        <PopupSelect label="Интенсивность" value={manualCfg.intensity || ''} onChange={v => setManual('intensity', v)}
          options={getMethodsByCategory('intensity').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />

        <PopupSelect label="Техника" value={manualCfg.technique || ''} onChange={v => setManual('technique', v)}
          options={getMethodsByCategory('technique').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />

        <PopupSelect label="Объём" value={manualCfg.volume || ''} onChange={v => setManual('volume', v)}
          options={getMethodsByCategory('volume').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />

        <PopupSelect label="Частота" value={manualCfg.frequency || ''} onChange={v => setManual('frequency', v)}
          options={getMethodsByCategory('frequency').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />

        <PopupSelect label="Специализация" value={manualCfg.specialization || ''} onChange={v => setManual('specialization', v)}
          options={getMethodsByCategory('specialization').map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))} />
      </div>

      {selectedList.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 10, color: ACCENT }}>
          ✓ Выбрано: {selectedList.map(([k]) => CONFIG_LABELS[k] || k).join(' · ')}
        </div>
      )}

      {manualCfg.program && (
        <button onClick={() => onLoadProgram(manualCfg.program)}
          style={{
            width: '100%', marginTop: 8, padding: 10, borderRadius: 8,
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
