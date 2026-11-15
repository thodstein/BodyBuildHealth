/**
 * CoachAssignmentsCard — назначения атлету в режиме тренера.
 *
 * Что здесь есть и почему именно так:
 *  • Питание и БАДы выдаются как объект (как тренировка): «взять у атлета» →
 *    шаблон в библиотеке → «выдать выбранным». Это копирование сырых ключей
 *    пространства (`coach-assignment-bundle.engine`), а не новая схема данных.
 *  • Курс — единственный тип, который лежит в IndexedDB (`course_log`), поэтому
 *    препараты собираются планом (`coach-course.engine`) и пишутся в базу
 *    пространства атлета отдельным модулем (`coach-course-store`). Заменяются
 *    только строки с префиксом `coach_course_` — самодеятельность атлета в курсе
 *    не затирается.
 *  • Анализы назначаются списком маркеров со сроком (`coach-lab-order.engine`):
 *    это инструмент тренера, в пространство атлета не пишется.
 *  • Лист назначения — одна страница, печать/PDF из приложения
 *    (`coach-assignment-sheet.engine`). В APK это HTML-файл через Share (диалог
 *    печати в WebView не работает), в web — системный диалог печати.
 *
 * ЧЕСТНО: если данных нет, карточка пишет «нет назначения», а не показывает
 * пустой блок. И ничего не отправляет на телефон атлета сама — доезжает синком
 * пространства при следующем открытии приложения у атлета.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import { localIsoDate } from '../../../core/local-date';
import {
  athleteSpaceId,
  readRegistryFromStorage,
  upsertSpace,
  writeRegistryToStorage,
} from '../../../core/data-space';
import { LAB_MARKER_MAP } from '../../../data/lab-marker-map';
import {
  ASSIGNMENT_LABELS,
  applyAssignmentBundle,
  assignmentBundleErrorText,
  collectAssignmentBundle,
  describeAssignmentBundle,
  normalizeAssignmentBundle,
  type AssignmentKind,
  type CoachAssignmentBundle,
} from '../../../engines/coach/coach-assignment-bundle.engine';
import {
  addCoachAssignment,
  coachAssignmentErrorText,
  filterCoachAssignments,
  markCoachAssignmentIssued,
  readCoachAssignments,
  removeCoachAssignment,
  writeCoachAssignments,
  type CoachAssignmentTemplate,
  type CoachAssignmentsStore,
} from '../../../engines/coach/coach-assignment-library.engine';
import {
  addCoachLabOrder,
  coachLabOrderErrorText,
  labOrderState,
  listCoachLabOrders,
  readCoachLabOrders,
  removeCoachLabOrder,
  toggleCoachLabOrderDone,
  writeCoachLabOrders,
  type CoachLabOrdersStore,
} from '../../../engines/coach/coach-lab-order.engine';
import {
  assignmentSheetFileName,
  buildAssignmentSheetHtml,
  buildAssignmentSheetText,
  collectAssignmentSheetSources,
  type AssignmentSheetInput,
  type SheetCourse,
} from '../../../engines/coach/coach-assignment-sheet.engine';
import {
  COURSE_ITEMS_MAX,
  courseItemLine,
  courseRowsFor,
  describeCoursePlan,
  emptyCoursePlan,
  makeCourseItem,
  normalizeCoursePlan,
  planFromCourseRows,
  type CoachCoursePlan,
} from '../../../engines/coach/coach-course.engine';
import type { CoachAthlete } from '../../../engines/coach/coach-mode.engine';
import type { CoachAuditKind } from '../../../engines/coach/coach-audit.engine';

const ACCENT = '#22d3ee';
const VIOLET = '#a78bfa';
const AMBER = '#f59e0b';

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const btn = (kind: 'primary' | 'ghost'): React.CSSProperties => ({
  appearance: 'none',
  border: kind === 'primary' ? 'none' : '1px solid rgba(255,255,255,0.14)',
  background: kind === 'primary' ? ACCENT : 'rgba(255,255,255,0.05)',
  color: kind === 'primary' ? '#04222a' : '#fff',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 11.5,
  fontWeight: 800,
  cursor: 'pointer',
  minHeight: 40,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '9px 11px',
  color: '#fff',
  fontSize: 12,
  minHeight: 40,
};

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** «15.11.2026» из `YYYY-MM-DD`. */
const ruDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

type PanelTab = AssignmentKind | 'labs' | 'sheet';

const PANEL_TABS: { id: PanelTab; label: string; icon: 'leaf' | 'shield' | 'flask' | 'file' | 'pill' }[] = [
  { id: 'nutrition', label: 'Питание', icon: 'leaf' },
  { id: 'supplements', label: 'БАДы', icon: 'shield' },
  { id: 'course', label: 'Курс', icon: 'pill' },
  { id: 'labs', label: 'Анализы', icon: 'flask' },
  { id: 'sheet', label: 'Лист', icon: 'file' },
];

const AUDIT_KIND: Record<AssignmentKind, CoachAuditKind> = {
  nutrition: 'nutrition-issued',
  supplements: 'supplements-issued',
  course: 'course-issued',
};

export interface CoachAssignmentsCardProps {
  athletes: readonly CoachAthlete[];
  /** Активный атлет режима — с него карточка и начинается. */
  activeAthleteId?: string | null;
  /** Журнал действий тренера. */
  onAudit?: (kind: CoachAuditKind, athleteId?: string | null) => void;
}

export const CoachAssignmentsCard: React.FC<CoachAssignmentsCardProps> = ({
  athletes,
  activeAthleteId = null,
  onAudit,
}) => {
  const [panel, setPanel] = useState<PanelTab>('nutrition');
  const [athleteId, setAthleteId] = useState<string>(() => activeAthleteId ?? athletes[0]?.id ?? '');
  const [library, setLibrary] = useState<CoachAssignmentsStore>(() => readCoachAssignments(ls()));
  const [orders, setOrders] = useState<CoachLabOrdersStore>(() => readCoachLabOrders(ls()));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<{ template: CoachAssignmentTemplate } | null>(null);
  const [pick, setPick] = useState<Set<string>>(() => new Set());
  const [labQuery, setLabQuery] = useState('');
  const [labCodes, setLabCodes] = useState<string[]>([]);
  const [labDue, setLabDue] = useState('');
  const [labComment, setLabComment] = useState('');
  const [sheetText, setSheetText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Имена БАДов: каталог поддержки тяжёлый, поэтому грузим отдельным чанком. */
  const [nameOf, setNameOf] = useState<(id: string) => string>(() => (id: string) => id);
  /** Растёт, когда каталог догрузился — тогда лист надо пересобрать. */
  const [namesRev, setNamesRev] = useState(0);

  /* ─────────── курс (фарма) ─────────── */
  const [courseDraft, setCourseDraft] = useState<CoachCoursePlan>(() => emptyCoursePlan(localIsoDate()));
  const [courseQuery, setCourseQuery] = useState('');
  const [courseCatalog, setCourseCatalog] = useState<{ id: string; name: string }[]>([]);
  const [coursePickId, setCoursePickId] = useState('');
  const [courseDose, setCourseDose] = useState('500');
  const [courseUnit, setCourseUnit] = useState('мг');
  const [coursePerWeek, setCoursePerWeek] = useState('2');
  const [courseFrom, setCourseFrom] = useState('1');
  const [courseTo, setCourseTo] = useState('12');
  const [templateName, setTemplateName] = useState('');
  /** Курс атлета из его базы: нужен и для «взять», и для листа. */
  const [athleteCourse, setAthleteCourse] = useState<CoachCoursePlan | null>(null);
  /** Перечитывает курс атлета после выдачи. */
  const [courseRev, setCourseRev] = useState(0);

  const athlete = useMemo(
    () => athletes.find(a => a.id === athleteId) ?? athletes[0] ?? null,
    [athletes, athleteId],
  );

  useEffect(() => {
    if (activeAthleteId && activeAthleteId !== athleteId && athletes.some(a => a.id === activeAthleteId)) {
      setAthleteId(activeAthleteId);
    }
  }, [activeAthleteId, athleteId, athletes]);

  useEffect(() => {
    // Инлайн-стили после монтирования: если атлета удалили, не остаёмся на пустом.
    if (!athlete && athletes.length) setAthleteId(athletes[0].id);
  }, [athlete, athletes]);

  useEffect(() => {
    let alive = true;
    void import('../../../data/support-names')
      .then(m => {
        if (alive) {
          setNameOf(() => (id: string) => m.supportNameRu(id));
          setNamesRev(v => v + 1);
        }
      })
      .catch(() => {
        /* без каталога покажем id — лучше, чем пусто */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Каталог препаратов нужен только вкладке «Курс»: тянуть его в статический
    // граф вкладки тренера незачем, поэтому это отдельный чанк по требованию.
    if (panel !== 'course' || courseCatalog.length) return;
    let alive = true;
    void import('../../../core/pharma-database')
      .then(m => {
        if (!alive) return;
        setCourseCatalog(Object.entries(m.PHARMA_DB).map(([id, sub]) => ({ id, name: sub?.name ?? id })));
      })
      .catch(() => {
        /* без каталога препарат не выбрать — карточка скажет это словами */
      });
    return () => {
      alive = false;
    };
  }, [panel, courseCatalog.length]);

  useEffect(() => {
    // Курс живёт в базе атлета, а не в localStorage: читаем лениво и только
    // когда он реально нужен — на вкладке «Курс» или в листе назначения.
    if (!athlete || (panel !== 'course' && panel !== 'sheet')) {
      setAthleteCourse(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const { readCourseRows } = await import('../../../engines/coach/coach-course-store');
        const rows = await readCourseRows(athleteSpaceId(athlete.id));
        const plan = planFromCourseRows(rows);
        if (!plan.items.length && !plan.startDate) {
          if (alive) setAthleteCourse(null);
          return;
        }
        // Строки, заведённые атлетом вручную, хранят только id вещества —
        // в листе это выглядело бы как «test_e». Имена берём из каталога,
        // который и так грузится отдельным чанком.
        if (plan.items.some(i => i.name === i.substanceId)) {
          try {
            const { PHARMA_DB } = await import('../../../core/pharma-database');
            plan.items = plan.items.map(i => {
              const name = i.name === i.substanceId ? PHARMA_DB[i.substanceId]?.name : '';
              return name ? { ...i, name } : i;
            });
          } catch {
            /* без каталога останется id — лучше, чем пусто */
          }
        }
        if (alive) setAthleteCourse(plan);
      } catch {
        if (alive) setAthleteCourse(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [panel, athlete, courseRev]);

  const assignmentKind: AssignmentKind | null =
    panel === 'nutrition' || panel === 'supplements' || panel === 'course' ? panel : null;

  const templates = useMemo(
    () => (assignmentKind ? filterCoachAssignments(library, assignmentKind) : []),
    [library, assignmentKind],
  );

  const athleteOrders = useMemo(
    () => (athlete ? listCoachLabOrders(orders, athlete.id) : []),
    [orders, athlete],
  );

  const markerRows = useMemo(() => {
    const q = labQuery.trim().toLowerCase();
    const rows = LAB_MARKER_MAP.filter(m => {
      if (!q) return true;
      return m.marker.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
    });
    return rows.slice(0, 60);
  }, [labQuery]);

  const refreshOrders = (store: CoachLabOrdersStore) => {
    writeCoachLabOrders(ls(), store);
    setOrders(store);
  };

  /* ─────────── назначение питания / БАДов ─────────── */

  const takeFromAthlete = async (kind: AssignmentKind) => {
    setNotice(null);
    setError(null);
    const storage = ls();
    if (!storage || !athlete) {
      setError('Хранилище недоступно — взять назначение у атлета нельзя.');
      return;
    }
    const spaceId = athleteSpaceId(athlete.id);
    let bundle: CoachAssignmentBundle;
    if (kind === 'course') {
      setBusy(true);
      try {
        const { readCourseRows } = await import('../../../engines/coach/coach-course-store');
        const rows = await readCourseRows(spaceId);
        const plan = planFromCourseRows(rows);
        if (!plan.items.length) {
          setError(`У «${athlete.name}» в приложении нет курса — соберите его здесь и сохраните шаблоном.`);
          return;
        }
        bundle = collectAssignmentBundle(storage, spaceId, 'course', {
          createdAt: new Date().toISOString(),
          name: athlete.name,
          coursePlan: plan,
        });
      } catch {
        setError('Не удалось прочитать курс атлета — база не открылась.');
        return;
      } finally {
        setBusy(false);
      }
    } else {
      bundle = collectAssignmentBundle(storage, spaceId, kind, {
        createdAt: new Date().toISOString(),
        name: athlete.name,
      });
      if (describeAssignmentBundle(bundle).keys === 0) {
        setError(`У «${athlete.name}» нет сохранённого ${kind === 'nutrition' ? 'рациона' : 'протокола БАДов'}.`);
        return;
      }
    }
    const res = addCoachAssignment(library, {
      name: `${athlete.name} · ${localIsoDate()}`,
      bundle,
      sourceLabel: athlete.name,
    });
    if (res.error || !res.template) {
      setError(coachAssignmentErrorText(res.error));
      return;
    }
    writeCoachAssignments(storage, res.store);
    setLibrary(res.store);
    onAudit?.('assignment-saved', athlete.id);
    setNotice(`«${res.template.name}» — в библиотеке. Теперь можно выдать другому атлету.`);
  };

  /* ─────────── курс: черновик ─────────── */

  const courseCatalogRows = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    const rows = q ? courseCatalog.filter(c => c.name.toLowerCase().includes(q)) : courseCatalog;
    return rows.slice(0, 40);
  }, [courseCatalog, courseQuery]);

  const pickedSubstance = courseCatalog.find(c => c.id === coursePickId) ?? null;

  const addCourseItem = () => {
    setNotice(null);
    setError(null);
    if (!pickedSubstance) {
      setError('Сначала выберите препарат из каталога.');
      return;
    }
    if (courseDraft.items.length >= COURSE_ITEMS_MAX) {
      setError(`В курсе уже ${COURSE_ITEMS_MAX} препаратов — больше не влезет.`);
      return;
    }
    const item = makeCourseItem({
      substanceId: pickedSubstance.id,
      name: pickedSubstance.name,
      doseValue: courseDose,
      doseUnit: courseUnit,
      frequency: coursePerWeek,
      startWeek: courseFrom,
      endWeek: courseTo,
    });
    if (!item) {
      setError('Проверьте дозу и недели: доза больше нуля, неделя «до» не раньше «с».');
      return;
    }
    setCourseDraft(prev => ({ ...prev, items: [...prev.items, item] }));
    setCoursePickId('');
    setCourseQuery('');
  };

  const removeCourseItem = (index: number) => {
    setCourseDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const saveCourseTemplate = () => {
    setNotice(null);
    setError(null);
    const storage = ls();
    if (!storage || !athlete) {
      setError('Хранилище недоступно — шаблон не сохранить.');
      return;
    }
    const check = normalizeCoursePlan({ ...courseDraft, version: 1 });
    if (check.error || !check.plan) {
      setError('В курсе нет ни одного препарата — добавьте хотя бы один.');
      return;
    }
    const name = templateName.trim() || `${athlete.name} · курс ${localIsoDate()}`;
    const bundle = collectAssignmentBundle(storage, athleteSpaceId(athlete.id), 'course', {
      createdAt: new Date().toISOString(),
      name,
      coursePlan: check.plan,
    });
    const res = addCoachAssignment(library, { name, bundle, sourceLabel: athlete.name });
    if (res.error || !res.template) {
      setError(coachAssignmentErrorText(res.error));
      return;
    }
    writeCoachAssignments(storage, res.store);
    setLibrary(res.store);
    onAudit?.('assignment-saved', athlete.id);
    setNotice(`«${res.template.name}» — в библиотеке. Выдайте её атлетам кнопкой «Выдать».`);
    setTemplateName('');
  };

  const startIssue = (template: CoachAssignmentTemplate) => {
    setIssuing({ template });
    setPick(new Set());
    setNotice(null);
    setError(null);
  };

  const togglePick = (id: string) => {
    setPick(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doIssue = async () => {
    const storage = ls();
    if (!storage || !issuing) return;
    const kind = issuing.template.kind;
    const plan = issuing.template.bundle.coursePlan ?? null;
    const chosen = athletes.filter(a => pick.has(a.id));
    if (!chosen.length) return;
    setBusy(true);
    let ok = 0;
    let failed = 0;
    let storeError = '';
    const reg = readRegistryFromStorage();
    let nextReg = reg;
    for (const a of chosen) {
      const sid = athleteSpaceId(a.id);
      if (kind === 'course') {
        if (!plan) {
          failed++;
          continue;
        }
        // Сначала препараты в базу: дату старта пишем только после успешной
        // записи, иначе атлет увидит «курс с датой», но без препаратов.
        try {
          const courseStore = await import('../../../engines/coach/coach-course-store');
          const written = await courseStore.writeCoachCourse(sid, courseRowsFor(plan));
          if (!written.ok) {
            storeError = courseStore.coachCourseStoreErrorText(written.error);
            failed++;
            continue;
          }
        } catch {
          failed++;
          continue;
        }
      }
      const r = applyAssignmentBundle(storage, sid, issuing.template.bundle, { mode: 'replace' });
      if (r.error) {
        failed++;
        continue;
      }
      ok++;
      onAudit?.(AUDIT_KIND[kind], a.id);
      nextReg = upsertSpace(nextReg, { id: sid, athleteId: a.id, label: a.name }).registry;
    }
    if (nextReg !== reg) writeRegistryToStorage(nextReg);
    if (ok > 0) {
      const next = markCoachAssignmentIssued(library, issuing.template.id);
      writeCoachAssignments(storage, next);
      setLibrary(next);
      if (kind === 'course') setCourseRev(v => v + 1);
    }
    const names = chosen.slice(0, 3).map(a => a.name).join(', ')
      + (chosen.length > 3 ? ` и ещё ${chosen.length - 3}` : '');
    if (failed) {
      setError(
        `${storeError ? `${storeError} ` : ''}Выдано: ${ok ? names : 'никому'}, не удалось: ${failed}.`,
      );
    } else {
      setNotice(`«${issuing.template.name}» выдано: ${names}. Заменило прежнее назначение.`);
    }
    setBusy(false);
    setIssuing(null);
    setPick(new Set());
  };

  const exportTemplate = async (template: CoachAssignmentTemplate) => {
    setNotice(null);
    setError(null);
    try {
      const mod = await import('../../../core/apk-share');
      const fileName = `${template.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.coach-assignment.json`;
      const res = await mod.saveTextFileApk(
        fileName,
        JSON.stringify(template.bundle, null, 2),
        'application/json;charset=utf-8',
      );
      setNotice(`Файл назначения: ${mod.shareOutcomeLabel(res)}`);
      onAudit?.('assignment-saved');
    } catch {
      setError('Не удалось сохранить файл назначения.');
    }
  };

  const importTemplate = async (file: File | null | undefined) => {
    if (!file) return;
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const text = typeof file.text === 'function'
        ? await file.text()
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        setError('Это не файл назначения: внутри не JSON.');
        return;
      }
      const norm = normalizeAssignmentBundle(parsed);
      if (norm.error || !norm.bundle) {
        setError(assignmentBundleErrorText(norm.error) || 'Файл не похож на назначение тренера.');
        return;
      }
      const fallbackName = file.name.replace(/\.coach-assignment\.json$/i, '').replace(/\.json$/i, '');
      const res = addCoachAssignment(library, {
        name: norm.bundle.name || fallbackName || 'Назначение из файла',
        bundle: norm.bundle,
        sourceLabel: 'из файла',
      });
      if (res.error || !res.template) {
        setError(coachAssignmentErrorText(res.error));
        return;
      }
      writeCoachAssignments(ls(), res.store);
      setLibrary(res.store);
      setPanel(res.template.kind);
      setNotice(`«${res.template.name}» — в библиотеке. Можно выдавать.`);
    } catch {
      setError('Не удалось прочитать файл.');
    } finally {
      setBusy(false);
    }
  };

  /* ─────────── анализы ─────────── */

  const toggleLabCode = (code: string) => {
    setLabCodes(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]));
  };

  const createLabOrder = () => {
    setNotice(null);
    setError(null);
    if (!athlete) return;
    const res = addCoachLabOrder(orders, {
      athleteId: athlete.id,
      markers: labCodes.map(code => {
        const def = LAB_MARKER_MAP.find(m => m.marker === code);
        return { code, name: def?.name ?? code };
      }),
      dueDate: labDue,
      comment: labComment,
    });
    if (res.error || !res.order) {
      setError(coachLabOrderErrorText(res.error));
      return;
    }
    refreshOrders(res.store);
    onAudit?.('lab-order-created', athlete.id);
    setLabCodes([]);
    setLabComment('');
    setNotice(`Назначено: ${res.order.markers.map(m => m.name).join(', ')}${labDue ? ` — срок ${ruDate(labDue)}` : ''}.`);
    setLabDue('');
  };

  const toggleOrder = (id: string) => refreshOrders(toggleCoachLabOrderDone(orders, id));
  const removeOrder = (id: string) => refreshOrders(removeCoachLabOrder(orders, id));

  /* ─────────── лист назначения ─────────── */

  const sheetInput = (): AssignmentSheetInput | null => {
    const storage = ls();
    if (!storage || !athlete) return null;
    const sources = collectAssignmentSheetSources(storage, athleteSpaceId(athlete.id));
    const courseLines = athleteCourse ? athleteCourse.items.map(courseItemLine) : [];
    const startDate = sources.courseStartDate || athleteCourse?.startDate || '';
    const course: SheetCourse | null = courseLines.length || startDate
      ? { startDate, lines: courseLines }
      : null;
    return {
      athlete: {
        name: athlete.name,
        sex: athlete.sex,
        age: athlete.age,
        weightKg: athlete.weightKg,
        heightCm: athlete.heightCm,
        direction: athlete.direction,
        goal: athlete.goal,
        group: athlete.group,
        contact: athlete.contact,
        startedAt: athlete.startedAt,
      },
      date: localIsoDate(),
      training: sources.training,
      nutrition: sources.nutrition,
      supplements: sources.supplementIds.map(nameOf),
      course,
      labs: listCoachLabOrders(orders, athlete.id)
        .filter(o => !o.doneAt)
        .map(o => ({
          markers: o.markers.map(m => m.name),
          dueDate: o.dueDate,
          comment: o.comment,
          done: !!o.doneAt,
        })),
      coachNote: athlete.note,
    };
  };

  const buildSheet = () => {
    setNotice(null);
    setError(null);
    const input = sheetInput();
    if (!input) {
      setError('Хранилище недоступно — лист не собрать.');
      return;
    }
    setSheetText(buildAssignmentSheetText(input));
  };

  useEffect(() => {
    // Лист пересобирается, когда меняется атлет, назначения анализов, его курс
    // или догрузился каталог имён БАДов: иначе в документ попали бы сырые id.
    if (panel !== 'sheet') return;
    buildSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, namesRev, athlete?.id, orders, athleteCourse, courseRev]);

  const printSheet = async () => {
    if (!athlete) return;
    const input = sheetInput();
    if (!input) return;
    setNotice(null);
    setError(null);
    try {
      const { printHtmlApk, shareOutcomeLabel } = await import('../../../core/apk-share');
      const html = buildAssignmentSheetHtml(input);
      const text = buildAssignmentSheetText(input);
      const res = await printHtmlApk(html, assignmentSheetFileName(athlete.name, localIsoDate()), text);
      setNotice(`Лист назначения: ${shareOutcomeLabel(res)}`);
      onAudit?.('sheet-printed', athlete.id);
    } catch {
      setError('Не удалось открыть лист назначения.');
    }
  };

  const copySheet = async () => {
    if (!sheetText) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(sheetText);
        setNotice('Лист назначения скопирован.');
      } else {
        setError('Копирование недоступно в этом окне.');
      }
    } catch {
      setError('Копирование недоступно в этом окне.');
    }
  };

  /* ─────────── рендер ─────────── */

  const showAssignmentPanel = assignmentKind !== null;
  const kind: AssignmentKind = assignmentKind ?? 'nutrition';

  return (
    <div style={cardStyle} data-coach="assignments">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Назначения</div>
        <div style={{ fontSize: 11, color: colors.textSubtle }}>
          рацион · БАДы · курс · анализы · лист
        </div>
      </div>
      <div style={{ marginTop: 4, fontSize: 11.5, color: colors.textMuted, lineHeight: 1.45 }}>
        Выдача копирует план в пространство атлета — как выдача тренировки. Дневники и вес не трогаются.
      </div>

      {athletes.length === 0 ? (
        <div data-coach="assign-no-athletes" style={{ marginTop: 10, fontSize: 12, color: colors.textMuted }}>
          Сначала добавьте атлета — назначать пока некому.
        </div>
      ) : (
        <>
          <label style={{ display: 'block', marginTop: 10, fontSize: 11, color: colors.textSubtle, fontWeight: 700 }}>
            Кому
            <select
              data-coach="assign-athlete"
              value={athlete?.id ?? ''}
              onChange={e => setAthleteId(e.target.value)}
              style={{ ...inputStyle, marginTop: 4 }}
            >
              {athletes.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.status === 'archived' ? ' (архив)' : a.status === 'paused' ? ' (пауза)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div
            role="tablist"
            aria-label="Тип назначения"
            style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}
          >
            {PANEL_TABS.map(t => {
              const on = panel === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  data-coach="assign-tab"
                  data-tab={t.id}
                  onClick={() => {
                    setPanel(t.id);
                    setIssuing(null);
                    setNotice(null);
                    setError(null);
                  }}
                  style={{
                    ...btn('ghost'),
                    border: `1px solid ${on ? withAlpha(ACCENT, '70') : 'rgba(255,255,255,0.12)'}`,
                    background: on ? withAlpha(ACCENT, '1f') : 'rgba(255,255,255,0.04)',
                    color: on ? '#fff' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  <NativeIcon name={t.icon} size={13} />
                  {t.label}
                  {t.id === 'labs' && athleteOrders.filter(o => !o.doneAt).length > 0
                    ? ` · ${athleteOrders.filter(o => !o.doneAt).length}`
                    : ''}
                </button>
              );
            })}
          </div>

          {notice && (
            <div data-coach="assign-notice" role="status" style={{ marginTop: 8, fontSize: 11.5, color: colors.green, lineHeight: 1.45 }}>
              {notice}
            </div>
          )}
          {error && (
            <div data-coach="assign-error" role="alert" style={{ marginTop: 8, fontSize: 11.5, color: colors.danger, lineHeight: 1.45 }}>
              {error}
            </div>
          )}

          {showAssignmentPanel && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-coach="assign-take"
                  onClick={() => void takeFromAthlete(kind)}
                  style={btn('primary')}
                  disabled={busy}
                  title={`Снять ${ASSIGNMENT_LABELS[kind].toLowerCase()} этого атлета в библиотеку`}
                >
                  Взять у атлета
                </button>
                <label style={{ ...btn('ghost'), cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Читаем…' : 'Из файла'}
                  <input
                    type="file"
                    accept=".json,application/json"
                    data-coach="assign-import"
                    disabled={busy}
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      void importTemplate(file);
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {panel === 'course' && (
                <div
                  data-coach="assign-course-editor"
                  style={{
                    marginTop: 10,
                    padding: 11,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Собрать курс</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: colors.textMuted, lineHeight: 1.45 }}>
                    Препараты, дозы и недели задаёт тренер: приложение ничего не «подбирает» и не считает
                    безопасным.
                  </div>

                  <label style={{ display: 'block', marginTop: 8, fontSize: 11, color: colors.textSubtle, fontWeight: 700 }}>
                    Старт курса
                    <input
                      type="date"
                      value={courseDraft.startDate}
                      onChange={e => setCourseDraft(prev => ({ ...prev, startDate: e.target.value }))}
                      data-coach="assign-course-start"
                      style={{ ...inputStyle, marginTop: 4 }}
                    />
                  </label>

                  <input
                    type="search"
                    value={courseQuery}
                    onChange={e => setCourseQuery(e.target.value)}
                    placeholder="Поиск препарата: тестостерон, нандролон…"
                    aria-label="Поиск препарата"
                    data-coach="assign-course-search"
                    style={{ ...inputStyle, marginTop: 8 }}
                  />

                  <div
                    data-coach="assign-course-catalog"
                    style={{
                      marginTop: 6,
                      maxHeight: 180,
                      overflowY: 'auto',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                    }}
                  >
                    {courseCatalog.length === 0 ? (
                      <div style={{ padding: 10, fontSize: 11.5, color: colors.textMuted }}>
                        Каталог препаратов не загрузился — без него выбрать препарат нельзя.
                      </div>
                    ) : courseCatalogRows.length === 0 ? (
                      <div style={{ padding: 10, fontSize: 11.5, color: colors.textMuted }}>
                        По запросу ничего не нашлось.
                      </div>
                    ) : (
                      courseCatalogRows.map(c => {
                        const on = coursePickId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            data-coach="assign-course-item"
                            data-id={c.id}
                            onClick={() => setCoursePickId(on ? '' : c.id)}
                            style={{
                              display: 'flex',
                              width: '100%',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              fontSize: 11.5,
                              textAlign: 'left',
                              color: on ? '#fff' : 'rgba(255,255,255,0.78)',
                              background: on ? withAlpha(AMBER, '1f') : 'transparent',
                              border: 'none',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              cursor: 'pointer',
                              minHeight: 40,
                            }}
                          >
                            <span style={{ flex: 1 }}>{c.name}</span>
                            {on && <span style={{ fontSize: 10, color: colors.textMuted }}>выбран</span>}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <label style={{ flex: '1 1 90px', fontSize: 11, color: colors.textSubtle }}>
                      Доза
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={courseDose}
                        onChange={e => setCourseDose(e.target.value)}
                        data-coach="assign-course-dose"
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </label>
                    <label style={{ flex: '0 1 90px', fontSize: 11, color: colors.textSubtle }}>
                      Единица
                      <select
                        value={courseUnit}
                        onChange={e => setCourseUnit(e.target.value)}
                        style={{ ...inputStyle, marginTop: 4 }}
                      >
                        {['мг', 'мкг', 'МЕ', 'таб'].map(u => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ flex: '0 1 100px', fontSize: 11, color: colors.textSubtle }}>
                      В неделю
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={coursePerWeek}
                        onChange={e => setCoursePerWeek(e.target.value)}
                        data-coach="assign-course-freq"
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </label>
                    <label style={{ flex: '0 1 80px', fontSize: 11, color: colors.textSubtle }}>
                      С недели
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={courseFrom}
                        onChange={e => setCourseFrom(e.target.value)}
                        data-coach="assign-course-from"
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </label>
                    <label style={{ flex: '0 1 80px', fontSize: 11, color: colors.textSubtle }}>
                      По неделю
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={courseTo}
                        onChange={e => setCourseTo(e.target.value)}
                        data-coach="assign-course-to"
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    data-coach="assign-course-add"
                    onClick={addCourseItem}
                    style={{ ...btn('ghost'), marginTop: 8 }}
                  >
                    Добавить в курс
                  </button>

                  {courseDraft.items.length > 0 && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 6 }} data-coach="assign-course-draft">
                      {courseDraft.items.map((item, index) => (
                        <div
                          key={`${item.substanceId}_${index}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 10px',
                            borderRadius: 10,
                            background: 'rgba(0,0,0,0.22)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <span style={{ flex: 1, fontSize: 11.5, color: '#fff' }}>{courseItemLine(item)}</span>
                          <button
                            type="button"
                            aria-label={`Убрать ${item.name}`}
                            onClick={() => removeCourseItem(index)}
                            style={{
                              ...btn('ghost'),
                              padding: '4px 8px',
                              fontSize: 11,
                              color: '#ef4444',
                              borderColor: 'rgba(239,68,68,0.25)',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <div style={{ fontSize: 10.5, color: colors.textMuted }}>
                        {courseDraft.items.length} преп. · {describeCoursePlan(courseDraft).weeks} нед
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ flex: '1 1 180px', fontSize: 11, color: colors.textSubtle }}>
                      Название шаблона
                      <input
                        type="text"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        maxLength={60}
                        placeholder={`${athlete?.name ?? 'атлет'} · курс`}
                        data-coach="assign-course-name"
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </label>
                    <button
                      type="button"
                      data-coach="assign-course-save"
                      onClick={saveCourseTemplate}
                      disabled={courseDraft.items.length === 0}
                      style={{ ...btn('primary'), background: AMBER, color: '#221601', opacity: courseDraft.items.length ? 1 : 0.55 }}
                    >
                      В библиотеку
                    </button>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 11, color: colors.textMuted, lineHeight: 1.45 }}>
                    {athleteCourse
                      ? `У атлета в курсе: ${athleteCourse.items.length} преп.`
                      : 'У атлета курс не задан.'}{' '}
                    Выдача заменит препараты, выданные тренером раньше; записи, которые атлет вёл сам, останутся.
                  </div>
                </div>
              )}

              <div data-coach="assign-templates" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {templates.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                    В библиотеке нет шаблонов «{ASSIGNMENT_LABELS[kind]}». «Взять у атлета» снимет текущий план,
                    и его можно будет выдать сразу нескольким.
                  </div>
                ) : (
                  templates.map(t => {
                    const d = describeAssignmentBundle(t.bundle);
                    return (
                      <div
                        key={t.id}
                        data-coach="assign-template"
                        data-kind={t.kind}
                        style={{
                          border: '1px solid rgba(255,255,255,0.10)',
                          borderRadius: 12,
                          padding: '10px 11px',
                          background: 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>{t.name}</div>
                        <div style={{ marginTop: 2, fontSize: 11, color: colors.textSubtle, lineHeight: 1.45 }}>
                          {d.parts.join(' · ')}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 10.5, color: colors.textMuted }}>
                          {t.sourceLabel ? `источник: ${t.sourceLabel} · ` : ''}
                          выдано {t.issuedCount}
                          {t.lastIssuedAt ? ` · ${ruDate(t.lastIssuedAt.slice(0, 10))}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            data-coach="assign-issue"
                            onClick={() => startIssue(t)}
                            style={{ ...btn('primary'), background: kind === 'supplements' ? VIOLET : ACCENT }}
                          >
                            Выдать
                          </button>
                          <button type="button" onClick={() => void exportTemplate(t)} style={btn('ghost')}>
                            Файл
                          </button>
                          <button
                            type="button"
                            aria-label={`Удалить шаблон ${t.name}`}
                            onClick={() => {
                              const next = removeCoachAssignment(library, t.id);
                              writeCoachAssignments(ls(), next);
                              setLibrary(next);
                            }}
                            style={{ ...btn('ghost'), color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {issuing && (
                <div
                  data-coach="assign-issue-panel"
                  style={{
                    marginTop: 10,
                    padding: 11,
                    borderRadius: 12,
                    border: `1px solid ${withAlpha(ACCENT, '55')}`,
                    background: withAlpha(ACCENT, '12'),
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>
                    Выдать: {issuing.template.name}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: colors.textMuted, lineHeight: 1.45 }}>
                    Заменит текущее {ASSIGNMENT_LABELS[issuing.template.kind].toLowerCase()} у выбранных. Дневники,
                    вес и анализы не тронем.
                  </div>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4, maxHeight: 190, overflowY: 'auto' }}>
                    {athletes.map(a => (
                      <label
                        key={a.id}
                        data-coach="assign-pick"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          color: '#fff',
                          minHeight: 40,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={pick.has(a.id)}
                          onChange={() => togglePick(a.id)}
                          style={{ width: 18, height: 18 }}
                        />
                        {a.name}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      data-coach="assign-issue-confirm"
                      onClick={() => void doIssue()}
                      disabled={pick.size === 0 || busy}
                      style={{ ...btn('primary'), opacity: pick.size === 0 || busy ? 0.55 : 1 }}
                    >
                      Выдать выбранным ({pick.size})
                    </button>
                    <button
                      type="button"
                      data-coach="assign-issue-cancel"
                      onClick={() => {
                        setIssuing(null);
                        setPick(new Set());
                      }}
                      style={btn('ghost')}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {panel === 'labs' && athlete && (
            <div style={{ marginTop: 10 }} data-coach="assign-labs">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Назначить анализы</div>
              <div style={{ marginTop: 2, fontSize: 11, color: colors.textMuted, lineHeight: 1.45 }}>
                Маркеры из каталога приложения. Это список к сдаче, а не медицинское назначение.
              </div>
              <input
                type="search"
                value={labQuery}
                onChange={e => setLabQuery(e.target.value)}
                placeholder="Поиск: ферритин, АЛТ, тестостерон…"
                aria-label="Поиск маркера"
                data-coach="assign-lab-search"
                style={{ ...inputStyle, marginTop: 8 }}
              />
              {labCodes.length > 0 && (
                <div
                  data-coach="assign-lab-chosen"
                  style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}
                >
                  {labCodes.map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleLabCode(code)}
                      aria-label={`Убрать ${code}`}
                      style={{ ...btn('ghost'), padding: '6px 10px', fontSize: 11 }}
                    >
                      {LAB_MARKER_MAP.find(m => m.marker === code)?.name ?? code} ✕
                    </button>
                  ))}
                </div>
              )}
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 210,
                  overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                }}
              >
                {markerRows.map(m => {
                  const on = labCodes.includes(m.marker);
                  return (
                    <label
                      key={m.marker}
                      data-coach="assign-lab-marker"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        fontSize: 12,
                        color: on ? '#fff' : 'rgba(255,255,255,0.78)',
                        background: on ? withAlpha(AMBER, '18') : 'transparent',
                        minHeight: 40,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleLabCode(m.marker)}
                        style={{ width: 16, height: 16 }}
                      />
                      <span style={{ flex: 1 }}>{m.name}</span>
                      <span style={{ fontSize: 10.5, color: colors.textMuted }}>
                        {m.marker} · {m.unit}
                      </span>
                    </label>
                  );
                })}
                {markerRows.length === 0 && (
                  <div style={{ padding: 10, fontSize: 11.5, color: colors.textMuted }}>
                    По запросу ничего не нашлось.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 150px', fontSize: 11, color: colors.textSubtle }}>
                  Срок
                  <input
                    type="date"
                    value={labDue}
                    onChange={e => setLabDue(e.target.value)}
                    data-coach="assign-lab-due"
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </label>
                <label style={{ flex: '2 1 200px', fontSize: 11, color: colors.textSubtle }}>
                  Комментарий
                  <input
                    type="text"
                    value={labComment}
                    onChange={e => setLabComment(e.target.value)}
                    maxLength={300}
                    placeholder="натощак, утром, за 3 дня без тренировок"
                    data-coach="assign-lab-comment"
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </label>
              </div>
              <button
                type="button"
                data-coach="assign-lab-create"
                onClick={createLabOrder}
                disabled={labCodes.length === 0}
                style={{ ...btn('primary'), marginTop: 8, background: AMBER, color: '#221601', opacity: labCodes.length ? 1 : 0.55 }}
              >
                Назначить ({labCodes.length})
              </button>

              <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, color: '#fff' }}>
                Назначено этому атлету
              </div>
              <div style={{ marginTop: 6, display: 'grid', gap: 6 }} data-coach="assign-lab-orders">
                {athleteOrders.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: colors.textMuted }}>Пока ничего не назначено.</div>
                ) : (
                  athleteOrders.map(o => {
                    const state = labOrderState(o, localIsoDate());
                    return (
                      <div
                        key={o.id}
                        data-coach="assign-lab-order"
                        data-state={state}
                        style={{
                          border: '1px solid rgba(255,255,255,0.10)',
                          borderRadius: 10,
                          padding: '9px 10px',
                          background: state === 'overdue' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                          opacity: state === 'done' ? 0.65 : 1,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: state === 'done' ? 'line-through' : 'none' }}>
                          {o.markers.map(m => m.name).join(', ')}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 10.5, color: state === 'overdue' ? '#fca5a5' : colors.textMuted }}>
                          {o.dueDate ? `срок ${ruDate(o.dueDate)}` : 'без срока'}
                          {state === 'overdue' ? ' · просрочено' : ''}
                          {state === 'done' ? ' · сдано' : ''}
                          {o.comment ? ` · ${o.comment}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => toggleOrder(o.id)} style={{ ...btn('ghost'), fontSize: 11 }}>
                            {o.doneAt ? 'Вернуть в работу' : 'Сдано'}
                          </button>
                          <button
                            type="button"
                            aria-label="Удалить назначение анализов"
                            onClick={() => removeOrder(o.id)}
                            style={{ ...btn('ghost'), fontSize: 11, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {panel === 'sheet' && athlete && (
            <div style={{ marginTop: 10 }} data-coach="assign-sheet">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Лист назначения</div>
              <div style={{ marginTop: 2, fontSize: 11, color: colors.textMuted, lineHeight: 1.45 }}>
                Одна страница: тренировка, рацион, БАДы, курс, анализы и ваш комментарий. Печать → «Сохранить как PDF».
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" data-coach="assign-sheet-build" onClick={buildSheet} style={btn('ghost')}>
                  Собрать
                </button>
                <button type="button" data-coach="assign-sheet-print" onClick={() => void printSheet()} style={btn('primary')}>
                  Печать / PDF
                </button>
                <button type="button" onClick={() => void copySheet()} style={btn('ghost')} disabled={!sheetText}>
                  Копировать
                </button>
              </div>
              {sheetText && (
                <pre
                  data-coach="assign-sheet-text"
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.28)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.86)',
                    fontSize: 11,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  {sheetText}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
