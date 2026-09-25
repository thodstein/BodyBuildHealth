import { describe, expect, it } from 'vitest';
import {
  ARM_ANNOTATIONS_CAP,
  addArmAnnotation,
  armAnnotationFor,
  armAnnotationLines,
  clearArmAnnotations,
  isArmAnnotation,
  loadArmAnnotations,
  removeArmAnnotation,
  saveArmAnnotations,
} from '../arm-annotations.engine';

const ref = { week: 3, sessionIndex: 1, exerciseName: 'Жим лёжа' };

describe('ARM PRO-7 annotations', () => {
  it('заметка и видео привязаны к упражнению', () => {
    const withNote = addArmAnnotation([], { ...ref, kind: 'note', text: 'сорвался на 3-м подходе' });
    const withVideo = addArmAnnotation(withNote, { ...ref, kind: 'video', videoRef: 'clip-42' });
    expect(withVideo).toHaveLength(2);
    expect(armAnnotationFor(withVideo, ref)).toHaveLength(2);
    expect(armAnnotationFor(withVideo, { ...ref, week: 4 })).toHaveLength(0);
  });

  it('повтор того же упражнения заменяет запись, а не плодит дубли', () => {
    const first = addArmAnnotation([], { ...ref, kind: 'note', text: 'первая', createdAt: '2026-09-25T10:00:00Z' });
    const second = addArmAnnotation(first, { ...ref, kind: 'note', text: 'вторая', createdAt: '2026-09-25T11:00:00Z' });
    expect(second).toHaveLength(1);
    expect(second[0].text).toBe('вторая');
  });

  it('пустые текст/видео и безымянное упражнение не пишутся', () => {
    const base = addArmAnnotation([], { ...ref, kind: 'note', text: 'x' });
    expect(addArmAnnotation(base, { ...ref, kind: 'note', text: '   ' })).toHaveLength(1);
    expect(addArmAnnotation(base, { ...ref, kind: 'video', videoRef: '' })).toHaveLength(1);
    expect(addArmAnnotation(base, { ...ref, exerciseName: '', kind: 'note', text: 'x' })).toHaveLength(1);
  });

  it('удаление по id и кап списка', () => {
    const list = addArmAnnotation([], { ...ref, kind: 'note', text: 'a' });
    expect(removeArmAnnotation(list, 'нет-такого')).toHaveLength(1);
    expect(removeArmAnnotation(list, list[0].id)).toHaveLength(0);
    let many = [] as ReturnType<typeof addArmAnnotation>;
    for (let i = 0; i < ARM_ANNOTATIONS_CAP + 10; i += 1) {
      many = addArmAnnotation(many, { week: 1, sessionIndex: i, exerciseName: `Упражнение ${i}`, kind: 'note', text: 'x' });
    }
    expect(many).toHaveLength(ARM_ANNOTATIONS_CAP);
  });

  it('строки печати отсортированы по неделе/сессии и подписаны', () => {
    const list = addArmAnnotation([], { week: 2, sessionIndex: 0, exerciseName: 'Тяга', kind: 'note', text: 'стабильно' });
    const withVideo = addArmAnnotation(list, { week: 1, sessionIndex: 2, exerciseName: 'Жим', kind: 'video', videoRef: 'clip-1' });
    const lines = armAnnotationLines(withVideo);
    expect(lines[0]).toBe('Н1 · сессия 3 · Жим — видео: clip-1');
    expect(lines[1]).toBe('Н2 · сессия 1 · Тяга — стабильно');
  });

  it('хранилище: битые данные и не-аннотации отбрасываются', () => {
    clearArmAnnotations();
    expect(loadArmAnnotations()).toEqual([]);
    localStorage.setItem('he_arm_annotations_v1', '{битое');
    expect(loadArmAnnotations()).toEqual([]);
    localStorage.setItem('he_arm_annotations_v1', JSON.stringify([{ nope: 1 }, 'строка']));
    expect(loadArmAnnotations()).toEqual([]);
    const saved = saveArmAnnotations(addArmAnnotation([], { ...ref, kind: 'note', text: 'ок' }));
    expect(loadArmAnnotations()).toEqual(saved);
    expect(isArmAnnotation(saved[0])).toBe(true);
  });
});
