import React, { useState } from 'react';
import { MASTER_DB } from '../core/master-db';
import { analyzeInteractions } from '../engines/interaction-checker.engine';
import type { CourseEntry, SubstanceEntry } from '../core/types';

export const PharmaCourseModule: React.FC = () => {
  const substances = MASTER_DB.substances;
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');

  const addSubstance = () => {
    if (!selectedId) return;
    const sub = substances.find(s => s.id === selectedId);
    if (sub) {
      setCourse([...course, {
        id: `${sub.id}_${Date.now()}`,
        substanceId: sub.id,
        doseValue: 0, doseUnit: 'mg', frequency: 1, startWeek: 0, endWeek: 8
      }]);
    }
  };

  const removeSubstance = (id: string) => {
    setCourse(prev => prev.filter(c => c.id !== id));
  };

  // Анализ текущего курса
  const interactionResult = analyzeInteractions(course.map(c => c.substanceId));

  return (
    <div className="pharma-course-container">
      <h2>💊 Курс фармакологии</h2>
      
      {/* Форма добавления */}
      <div className="add-form">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">Выберите вещество</option>
          {substances.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
        </select>
        <button onClick={addSubstance}>➕ Добавить</button>
      </div>

      {/* Список веществ */}
      <div className="course-list">
        {course.map(c => {
          const sub = substances.find(s => s.id === c.substanceId);
          return (
            <div key={c.id} className="course-item">
              <span>{sub?.name}</span>
              <button onClick={() => removeSubstance(c.id)}>✕</button>
            </div>
          );
        })}
      </div>

      {/* Результаты анализа */}
      {course.length > 0 && (
        <div className="analysis-result">
          <div className={`score-badge ${interactionResult.score > 60 ? 'good' : interactionResult.score > 30 ? 'warn' : 'bad'}`}>
            Score: {interactionResult.score}%
          </div>
          
          {interactionResult.conflicts.length > 0 && (
            <div className="conflicts">
              <h3>⚠️ Конфликты ({interactionResult.conflicts.length})</h3>
              {interactionResult.warnings.map((w, i) => <div key={i} className="warning-item">{w}</div>)}
            </div>
          )}

          {interactionResult.synergies.length > 0 && (
            <div className="synergies">
              <h3>✨ Синергия ({interactionResult.synergies.length})</h3>
              {interactionResult.synergies.map(s => (
                <div key={s.substanceA} className="synergy-item">{s.substanceA} + {s.substanceB}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};