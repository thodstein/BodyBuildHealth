/**
 * arm-annotations-panel.tsx — PRO-7 P2: заметки и видео к упражнениям плана.
 *
 * Чистый ввод: выбор упражнения из плана → текст заметки или ссылка на видео.
 * Список показан с привязкой (неделя/сессия/упражнение) и уходит в печать.
 */
import React from 'react';
import { AdBanner, AdBtn, AdField, AdGrid, AdSec } from './arm-design-system';
import {
  addArmAnnotation,
  armAnnotationLines,
  loadArmAnnotations,
  removeArmAnnotation,
  saveArmAnnotations,
  type ArmAnnotation,
} from '../../../engines/arm/arm-annotations.engine';

interface ExerciseRef { week: number; sessionIndex: number; exerciseName: string }

function exerciseRefs(plan: any): ExerciseRef[] {
  const out: ExerciseRef[] = [];
  for (const week of plan?.weeks || []) {
    (week.sessions || []).forEach((session: any, sessionIndex: number) => {
      for (const ex of session.exercises || []) {
        out.push({ week: week.week, sessionIndex, exerciseName: ex.name });
      }
    });
  }
  return out;
}

export const ArmAnnotationsPanel: React.FC<{ plan: any; lines: string[]; onChanged?: () => void }> = ({ plan, lines, onChanged }) => {
  const refs = React.useMemo(() => exerciseRefs(plan), [plan]);
  const [list, setList] = React.useState<ArmAnnotation[]>(() => loadArmAnnotations());
  const [refIdx, setRefIdx] = React.useState(0);
  const [note, setNote] = React.useState('');
  const [video, setVideo] = React.useState('');

  const ref = refs[refIdx];
  const target = ref
    ? `${ref.week} · сессия ${ref.sessionIndex + 1} · ${ref.exerciseName}`
    : 'нет упражнений в плане';

  const commit = (kind: 'note' | 'video') => {
    if (!ref) return;
    const next = addArmAnnotation(list, {
      week: ref.week,
      sessionIndex: ref.sessionIndex,
      exerciseName: ref.exerciseName,
      kind,
      text: note,
      videoRef: video,
    });
    setList(saveArmAnnotations(next));
    onChanged?.();
    if (kind === 'note') setNote('');
    else setVideo('');
  };

  return (
    <AdSec
      title="🎥 Заметки и видео к упражнениям"
      hook="annotations"
      collapsible
      defaultOpen={false}
      summary={`${list.length}`}
    >
      {refs.length === 0 ? (
        <div className="ad-muted">Собери план — заметки привязываются к его упражнениям.</div>
      ) : (
        <>
          <AdField label={`Упражнение: ${target}`}>
            <select aria-label="Упражнение для заметки" value={refIdx} onChange={e => setRefIdx(Number(e.target.value) || 0)}>
              {refs.map((r, i) => (
                <option key={`${r.week}-${r.sessionIndex}-${r.exerciseName}`} value={i}>
                  Н{r.week} · с{r.sessionIndex + 1} · {r.exerciseName}
                </option>
              ))}
            </select>
          </AdField>
          <AdGrid cols="2">
            <AdField label="Заметка">
              <input aria-label="Текст заметки" value={note} onChange={e => setNote(e.target.value)} placeholder="что чинить" />
            </AdField>
            <AdField label="Видео (ссылка/имя файла)">
              <input aria-label="Ссылка на видео" value={video} onChange={e => setVideo(e.target.value)} placeholder="clip-42" />
            </AdField>
          </AdGrid>
          <AdBtn variant="ghost" onClick={() => commit('note')}>💬 Добавить заметку</AdBtn>
          <AdBtn variant="ghost" onClick={() => commit('video')}>🎬 Привязать видео</AdBtn>
          <div className="ad-list" data-arm="annotations-list">
            {list.length === 0 ? (
              <div className="ad-muted">Заметок пока нет — они попадут в печать и экспорт.</div>
            ) : (
              list.map(a => (
                <div key={a.id} className="ad-sec ad-bio" data-valid="na">
                  <div className="ad-row">
                    <span>
                      <b>Н{a.week} · с{a.sessionIndex + 1} · {a.exerciseName}</b>
                      <span className="ad-muted"> — {a.kind === 'video' ? `видео: ${a.videoRef ?? ''}` : a.text}</span>
                    </span>
                     <AdBtn variant="ghost" onClick={() => { const next = saveArmAnnotations(removeArmAnnotation(list, a.id)); setList(next); onChanged?.(); }} aria-label={`Удалить заметку ${a.exerciseName}`}>✕</AdBtn>
                  </div>
                </div>
              ))
            )}
          </div>
          <AdBanner>В печать и сводку идут {armAnnotationLines(list).length} строк(и) из этого списка.</AdBanner>
          {lines.length > 0 && (
            <pre data-arm="annotations-print" style={{ display: 'none' }}>{lines.join('\n')}</pre>
          )}
        </>
      )}
    </AdSec>
  );
};
