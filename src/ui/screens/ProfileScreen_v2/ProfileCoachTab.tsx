/**
 * ProfileCoachTab — «Режим тренера» в профиле (общий слой, не PL-only).
 *
 * Что здесь есть и почему именно так:
 *  • выключатель режима — в профиле, как просил пользователь;
 *  • разделы: реальные направления приложения (Тренировки, Питание, Анализы,
 *    Риски, Фарма, БАДы) — их можно выбрать все, по отдельности или снять все;
 *  • атлеты: без ограничения по количеству; пустое имя — единственный отказ,
 *    и ПРИЧИНА написана текстом, а не «кнопка молча не работает»;
 *  • активный атлет — тот, с кем тренер работает сейчас; удаление активного
 *    корректно сбрасывает выбор (движок это гарантирует);
 *  • «Войти в его данные» — переключение приложения в пространство данных атлета
 *    (`core/data-space`): свои профиль/дневники/планы/анализы, своя база IndexedDB.
 *    Переключение всегда через перезагрузку: половинчатая подмена оставила бы в
 *    памяти чужие данные. Удаление карточки и удаление ЕГО данных — разные кнопки.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ruCount, RU_SECTIONS } from '../../../engines/ru-plural';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import {
  COACH_SECTIONS,
  COACH_STATUS_LABELS,
  addCoachAthlete,
  coachActiveAthlete,
  coachStatusCounts,
  coachToday,
  readCoachState,
  removeCoachAthlete,
  selectAllCoachSections,
  setActiveCoachAthlete,
  setCoachAthleteStatus,
  setCoachEnabled,
  toggleCoachSection,
  updateCoachAthlete,
  writeCoachState,
  type CoachAthlete,
  type CoachAthleteStatus,
  type CoachSectionId,
  type CoachSex,
  type CoachState,
} from '../../../engines/coach/coach-mode.engine';
import {
  applyProgramBundle,
  collectProgramBundle,
  describeProgramBundle,
  normalizeProgramBundle,
  programBundleErrorText,
  type CoachProgramBundle,
} from '../../../engines/coach/coach-program-bundle.engine';
import {
  COACH_PROGRAMS_MAX,
  addCoachProgram,
  coachProgramErrorText,
  markCoachProgramIssued,
  readCoachPrograms,
  removeCoachProgram,
  renameCoachProgram,
  writeCoachPrograms,
  type CoachProgramsStore,
  type CoachProgramTemplate,
} from '../../../engines/coach/coach-program-library.engine';
import {
  buildAthleteSnapshot,
  snapshotLine,
  type AthleteSnapshot,
} from '../../../engines/coach/coach-athlete-snapshot.engine';
import {
  adherenceLine,
  computeAdherence,
  weekStartOf,
  type AdherenceResult,
} from '../../../engines/coach/coach-adherence.engine';
import {
  ATHLETE_COPY_MAX_BYTES,
  applyAthleteCopyKeys,
  athleteCopyErrorText,
  collectAthleteCopy,
  describeAthleteCopy,
  normalizeAthleteCopy,
} from '../../../engines/coach/coach-athlete-copy.engine';
import {
  buildCoachInbox,
  inboxSummary,
} from '../../../engines/coach/coach-inbox.engine';
import {
  buildCoachWeek,
} from '../../../engines/coach/coach-week.engine';
import { CoachWeekView } from './CoachWeekView';
import { CoachReportSheet } from './CoachReportSheet';
import { CoachLockSettingsCard } from './CoachLockSettingsCard';
import { CoachDeviceInviteCard } from './CoachDeviceInviteCard';
import { isJoinedSpace } from '../../../core/space-invite';
import { CoachPinDialog } from '../../CoachPinDialog';
import {
  addCoachAuditEvent,
  readCoachAudit,
  writeCoachAudit,
  type CoachAuditKind,
  type CoachAuditStore,
} from '../../../engines/coach/coach-audit.engine';
import {
  isCoachUnlocked,
  readCoachLock,
  readUnlockedAt,
  verifyCoachPin,
  writeCoachLock,
  writeUnlockedAt,
  type CoachLockSettings,
} from '../../../engines/coach/coach-lock.engine';
import { authenticateWithBiometrics, isBiometricAvailable } from '../../../core/native-bridge';
import {
  addCoachNote,
  countNotesForAthlete,
  emptyCoachNotes,
  readCoachNotes,
  weekNoteFor,
  writeCoachNotes,
  type CoachNotesStore,
} from '../../../engines/coach/coach-notes.engine';
import {
  emptyCoachPlanner,
  readCoachPlanner,
  writeCoachPlanner,
  type CoachPlannerStore,
} from '../../../engines/coach/coach-planner.engine';
import {
  emptyCoachLog,
  readCoachLog,
  writeCoachLog,
  type CoachLogStore,
} from '../../../engines/coach/coach-athlete-log.engine';
import {
  HOME_SPACE_ID,
  activateAthleteSpace,
  activateHomeSpace,
  activateSpaceById,
  activeSpaceRecord,
  athleteSpaceId,
  clearSessionSpaceData,
  clearSpaceData,
  deviceRawOrFallback,
  readRegistryFromStorage,
  reloadToApplySpace,
  removeSpace,
  spaceUsageMap,
  toPhysicalKey,
  upsertSpace,
  writeRegistryToStorage,
} from '../../../core/data-space';
import { requestSpacePurge } from '../../../core/space-purge';
import { loadDb } from '../../../core/lazy-db';

const ACCENT = '#22d3ee';

const ls = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

/** sessionStorage: «профиль разблокирован в этой сессии», а не навсегда. */
const ss = (): Storage | null => {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
};

const SEX_LABEL: Record<CoachSex, string> = { male: 'муж', female: 'жен', unspecified: 'пол не указан' };

/** 2026-11-04 → 04.11.26 (компактно для строки карточки). */
const fmtShort = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
};

/** Размер данных человека. Десятичный разделитель — запятая, как в интерфейсе. */
const fmtBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  if (bytes < 1024) return `${Math.round(bytes)} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} КБ`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} МБ`;
};

/** Свободное имя в библиотеке: «Иван · 05.11.26», при совпадении «(2)». */
const uniqueProgramName = (base: string, existing: CoachProgramTemplate[]): string => {
  const taken = new Set(existing.map(t => t.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 100; i++) {
    const next = `${base} (${i})`;
    if (!taken.has(next.toLowerCase())) return next;
  }
  return `${base} (${Date.now() % 1000})`;
};

/** 1 запись / 2 записи / 5 записей — иначе «2 записей» выглядит небрежно. */
const plural = (n: number, one: string, few: string, many: string): string => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
};

interface AthleteForm {
  name: string;
  sex: CoachSex;
  age: string;
  weightKg: string;
  heightCm: string;
  direction: string;
  goal: string;
  note: string;
  status: CoachAthleteStatus;
  group: string;
  /** Метки строкой «сила, спина» — в карточке хранятся массивом. */
  tags: string;
  contact: string;
  startedAt: string;
}

const EMPTY_FORM: AthleteForm = {
  name: '',
  sex: 'unspecified',
  age: '',
  weightKg: '',
  heightCm: '',
  direction: '',
  goal: '',
  note: '',
  status: 'active',
  group: '',
  tags: '',
  contact: '',
  startedAt: '',
};

const formFromAthlete = (a: CoachAthlete): AthleteForm => ({
  name: a.name,
  sex: a.sex,
  age: a.age === null ? '' : String(a.age),
  weightKg: a.weightKg === null ? '' : String(a.weightKg),
  heightCm: a.heightCm === null ? '' : String(a.heightCm),
  direction: a.direction,
  goal: a.goal,
  note: a.note,
  status: a.status,
  group: a.group,
  tags: a.tags.join(', '),
  contact: a.contact,
  startedAt: a.startedAt,
});

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13.5,
  color: '#fff',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.2,
  color: colors.textMuted,
  marginBottom: 5,
};

const btn = (tone: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  minHeight: 44,
  padding: '8px 14px',
  borderRadius: 12,
  fontSize: 12.5,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  border:
    tone === 'primary'
      ? '1px solid transparent'
      : `1px solid ${tone === 'danger' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.14)'}`,
  color: tone === 'primary' ? '#04222a' : tone === 'danger' ? '#fca5a5' : 'rgba(255,255,255,0.82)',
  background:
    tone === 'primary'
      ? `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`
      : tone === 'danger'
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(255,255,255,0.05)',
});

export const ProfileCoachTab: React.FC<{
  onNavigate?: (screen: string) => void;
  /** Открыть заметки/задачи конкретного атлета (переход на вкладку с фильтром). */
  onOpenAthlete?: (athleteId: string, target: 'notes' | 'planner' | 'log') => void;
}> = ({ onNavigate, onOpenAthlete }) => {
  const [state, setState] = useState<CoachState>(() => readCoachState(ls()));
  const [form, setForm] = useState<AthleteForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  /**
   * Сколько записей в базе IndexedDB каждого атлета. `undefined` — ещё не
   * спрашивали, `null` — спросить не удалось (тогда цифру не показываем вовсе).
   */
  const [spaceDbRecords, setSpaceDbRecords] = useState<Record<string, number | null>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  /**
   * Библиотека программ тренера. Ключ `he_coach_programs` — устройственный,
   * поэтому переключается не с атлетом, а синхронизируется между устройствами тренера.
   */
  const [programs, setPrograms] = useState<CoachProgramsStore>(() => readCoachPrograms(ls()));
  const [programNotice, setProgramNotice] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [renameProgramId, setRenameProgramId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmProgramDelete, setConfirmProgramDelete] = useState<string | null>(null);
  /**
   * Черновик выдачи: шаблон (или снимок с атлета) + выбранные получатели.
   * confirm — второй шаг, потому что выдача ЗАМЕНЯЕТ программу, а не дополняет.
   */
  const [issue, setIssue] = useState<{
    templateId: string | null;
    title: string;
    bundle: CoachProgramBundle;
  } | null>(null);
  const [issuePick, setIssuePick] = useState<Set<string>>(() => new Set());
  const [issueConfirm, setIssueConfirm] = useState(false);
  const [issueDone, setIssueDone] = useState<string | null>(null);
  /** Какой атлет открыт в отчёте (по одному за раз — меньше шума на экране). */
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [programFileBusy, setProgramFileBusy] = useState(false);
  /** Копия ОДНОГО атлета — отдельное действие и отдельные сообщения. */
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);

  /**
   * PIN и журнал действий — устройственные. Состояние держим в памяти, чтобы
   * карточка настроек и гейт не читали localStorage на каждый рендер.
   */
  const [lock, setLock] = useState<CoachLockSettings>(() => readCoachLock(ls()));
  const [audit, setAudit] = useState<CoachAuditStore>(() => readCoachAudit(ls()));
  const [unlocked, setUnlocked] = useState(() =>
    isCoachUnlocked(readCoachLock(ls()), readUnlockedAt(ss()), Date.now()),
  );
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinAttemptError, setPinAttemptError] = useState<string | null>(null);
  /** Есть ли на телефоне биометрия и разрешена ли она в настройке PIN. */
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  /** PIN-подтверждение перед входом в данные атлета (действие, а не экран). */
  const [pinFor, setPinFor] = useState<{ purpose: string; run: () => void } | null>(null);
  const lastBumpRef = useRef(0);

  /**
   * Если PIN включён — спрашиваем его ПЕРЕД переключением в пространство
   * атлета. Проверка на самой вкладке этого не заменяет: после переключения
   * приложение открывается уже в дневниках и анализах атлета.
   */
  const guardPin = (purpose: string, run: () => void) => {
    if (!readCoachLock(ls()).enabled) {
      run();
      return;
    }
    setPinFor({ purpose, run });
  };

  const auditEvent = (kind: CoachAuditKind, athleteId?: string | null) => {
    // Читаем с диска: другой вызов мог уже дописать событие (выдача на пятерых).
    const next = addCoachAuditEvent(readCoachAudit(ls()), kind, { athleteId: athleteId ?? null });
    writeCoachAudit(ls(), next);
    setAudit(next);
  };

  const applyLock = (next: CoachLockSettings) => {
    writeCoachLock(ls(), next);
    setLock(next);
    if (!next.enabled) {
      writeUnlockedAt(ss(), null);
      setUnlocked(true);
    }
  };

  const tryUnlock = async () => {
    const ok = await verifyCoachPin(lock, pinAttempt);
    if (!ok) {
      setPinAttemptError('PIN не подошёл.');
      return;
    }
    writeUnlockedAt(ss(), new Date().toISOString());
    setPinAttempt('');
    setPinAttemptError(null);
    setUnlocked(true);
  };

  /** Биометрия — только если она включена в настройке PIN и доступна в WebView. */
  useEffect(() => {
    if (!lock.enabled || !lock.biometry) {
      setBioAvailable(false);
      return;
    }
    let alive = true;
    void isBiometricAvailable().then(ok => {
      if (alive) setBioAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, [lock.enabled, lock.biometry]);

  const tryUnlockBiometrics = async () => {
    setPinAttemptError(null);
    setBioBusy(true);
    try {
      const ok = await authenticateWithBiometrics('Вход в профиль тренера');
      if (!ok) {
        setPinAttemptError('Биометрия не подтвердила вход. Введите PIN.');
        return;
      }
      writeUnlockedAt(ss(), new Date().toISOString());
      setUnlocked(true);
    } finally {
      setBioBusy(false);
    }
  };

  /**
   * Автовыход по бездействию. Активность отмечаем не чаще раза в 20 секунд,
   * иначе каждое движение пальца пишет в sessionStorage.
   */
  useEffect(() => {
    if (!lock.enabled || !unlocked) return;
    const bump = () => {
      const now = Date.now();
      if (now - lastBumpRef.current < 20_000) return;
      lastBumpRef.current = now;
      if (isCoachUnlocked(lock, readUnlockedAt(ss()), now)) writeUnlockedAt(ss(), new Date(now).toISOString());
    };
    const timer = setInterval(() => {
      if (!isCoachUnlocked(lock, readUnlockedAt(ss()), Date.now())) {
        writeUnlockedAt(ss(), null);
        setUnlocked(false);
        auditEvent('locked');
      }
    }, 30_000);
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock, unlocked]);

  /**
   * Сводка по атлетам из ИХ данных. Сначала карточки рисуются без цифр — чтение
   * баз не должно задерживать первый рендер; сводки подставляются по мере чтения.
   */
  const [snapshots, setSnapshots] = useState<Record<string, AthleteSnapshot>>({});
  const [adherence, setAdherence] = useState<Record<string, AdherenceResult>>({});
  const [snapshotsBusy, setSnapshotsBusy] = useState(false);
  const [snapshotsDone, setSnapshotsDone] = useState(false);
  const [snapshotsRev, setSnapshotsRev] = useState(0);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'default' | 'name' | 'inactive'>('default');
  const [statusFilter, setStatusFilter] = useState<'live' | 'all' | 'active' | 'paused' | 'archived'>('live');
  // Комментарий к неделе: одна открытая форма на карточку, без чата и «доставки».
  const [weekCommentFor, setWeekCommentFor] = useState<string | null>(null);
  const [weekDraft, setWeekDraft] = useState('');
  const [weekError, setWeekError] = useState<string | null>(null);
  const [notesRev, setNotesRev] = useState(0);

  const notes = useMemo<CoachNotesStore>(() => readCoachNotes(ls()), [state, notesRev]);

  // Планер/журнал экран только читает; их состояние меняют другие вкладки.
  const { planner, log } = useMemo<{
    planner: CoachPlannerStore;
    log: CoachLogStore;
  }>(
    () => ({ planner: readCoachPlanner(ls()), log: readCoachLog(ls()) }),
    [state],
  );

  // Одна проходка по журналу вместо «на каждого атлета заново»: 20 карточек × 5000
  // записей — это 100k итераций на рендер, если считать в лоб.
  const logStats = useMemo(() => {
    const map = new Map<string, { count: number; last: string | null }>();
    for (const entry of log.items) {
      const cur = map.get(entry.athleteId) ?? { count: 0, last: null };
      cur.count += 1;
      if (!cur.last || entry.date > cur.last) cur.last = entry.date;
      map.set(entry.athleteId, cur);
    }
    return map;
  }, [log.items]);

  const apply = (next: CoachState) => {
    writeCoachState(ls(), next);
    setState(next);
  };

  // Пространство данных читаем один раз на рендер экрана (переключение всё равно
  // перезагружает приложение).
  const [activeSpace, setActiveSpace] = useState(() => activeSpaceRecord());
  const spaceActiveId = activeSpace.id;
  /** Имя пространства, данные которого открыты (для честной строки статуса). */
  const activeSpaceLabel = activeSpace.label;
  // Реестр перечитываем и после изменений в списке: удаление атлета меняет его.
  // `registryRev` — для изменений, которые не трогают состояние режима (удаление
  // данных без карточки): иначе список «висит» со старыми записями.
  const [registryRev, setRegistryRev] = useState(0);
  const spaceRegistry = useMemo(() => readRegistryFromStorage(), [state, registryRev]);
  // Объём всех пространств — ОДНИМ проходом по ключам. Считать `spaceUsage` на
  // каждого атлета значит 20 полных перечислений хранилища на каждый рендер.
  const usage = useMemo(() => {
    const storage = ls();
    if (!storage) return new Map<string, { keys: number; bytes: number }>();
    return spaceUsageMap(deviceRawOrFallback(storage));
  }, [state, spaceActiveId, registryRev]);
  const usageOf = (athleteId: string) => usage.get(athleteSpaceId(athleteId)) ?? { keys: 0, bytes: 0 };
  const lastOpenedOf = (athleteId: string) =>
    spaceRegistry.spaces.find(s => s.id === athleteSpaceId(athleteId))?.lastOpenedAt ?? null;

  const active = coachActiveAthlete(state);

  /**
   * Пространства, у которых нет карточки атлета.
   *
   * Появляются от «Точно удалить»: карточка уходит, а данные на устройстве
   * остаются (так и задумано — их нельзя стереть случайно). Проблема в том, что
   * после этого до них можно добраться только через «Сменить», а если тренер
   * заново добавит атлета с тем же именем — создастся НОВОЕ пространство, и
   * старые дневники останутся сиротами навсегда, занимая лимит и место.
   * Поэтому сироты видны явно: открыть или удалить, но не «потерять».
   *
   * Пространство, к которому телефон ПОДКЛЮЧИЛСЯ по коду тренера (роль
   * `athlete`), сиротой не считается: карточки у него и не было, а «Удалить
   * данные» здесь стёрло бы чужую облачную копию. Для него есть «Отключиться» в
   * карточке «Телефон атлета».
   */
  const orphanSpaces = useMemo(() => {
    const known = new Set(state.athletes.map(a => a.id));
    return spaceRegistry.spaces.filter(
      s =>
        s.id !== HOME_SPACE_ID &&
        !(s.athleteId && known.has(s.athleteId)) &&
        !isJoinedSpace(s.id),
    );
  }, [spaceRegistry, state.athletes, registryRev]);
  /** Пространства атлетов ЭТОГО тренера (подключённые к чужому — не считаем). */
  const athleteSpaces = useMemo(
    () => spaceRegistry.spaces.filter(s => s.id !== HOME_SPACE_ID && !isJoinedSpace(s.id)),
    [spaceRegistry, registryRev],
  );
  const [confirmOrphanId, setConfirmOrphanId] = useState<string | null>(null);
  const [confirmForgetAll, setConfirmForgetAll] = useState(false);
  const [forgetBusy, setForgetBusy] = useState(false);
  const [forgetDone, setForgetDone] = useState(false);
  const [forgetError, setForgetError] = useState<string | null>(null);
  const [diskScan, setDiskScan] = useState<{ ids: string[]; unavailable: boolean } | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  /**
   * Базы на диске, у которых нет записи в реестре.
   *
   * Список приходит только по явной просьбе («Проверить базы»): на старте это
   * лишний тяжёлый импорт базы в граф вкладки, а нужен он редко — когда тренер
   * подозревает, что от старой версии остались чужие данные.
   */
  const dbOnlySpaces = useMemo(() => {
    if (!diskScan) return [];
    const known = new Set(spaceRegistry.spaces.map(s => s.id));
    return diskScan.ids.filter(id => id !== HOME_SPACE_ID && !known.has(id));
  }, [diskScan, spaceRegistry]);
  // Итог «забыли всех» показываем, только пока действительно никого не осталось:
  // как только появился новый атлет, блок снова предлагает действие, а не итог.
  const showForgetDone = forgetDone && state.athletes.length === 0 && athleteSpaces.length === 0;

  /**
   * Сводки читаются из ДРУГИХ пространств (readSpaceStores) — это тяжёлый шаг,
   * поэтому: по одному атлету, с отменой при размонтировании, без блокировки
   * первого рендера. Ошибка чтения одного атлета не рушит остальные.
   */
  const athletesFingerprint = useMemo(
    () => state.athletes.map(a => `${a.id}:${a.name}`).join('|'),
    [state.athletes],
  );

  useEffect(() => {
    const list = state.athletes;
    setSnapshots(prev => {
      const next: Record<string, AthleteSnapshot> = {};
      for (const a of list) if (prev[a.id]) next[a.id] = prev[a.id];
      return next;
    });
    setAdherence(prev => {
      const next: Record<string, AdherenceResult> = {};
      for (const a of list) if (prev[a.id]) next[a.id] = prev[a.id];
      return next;
    });
    if (!list.length) {
      setSnapshotsBusy(false);
      setSnapshotsDone(false);
      return;
    }
    const storage = ls();
    if (!storage) return;
    let cancelled = false;
    setSnapshotsBusy(true);
    setSnapshotsDone(false);
    void (async () => {
      let readStores: ((id: string) => Promise<Record<string, unknown[]>>) | null = null;
      try {
        const mod = await loadDb();
        if (typeof mod.readSpaceStores === 'function') {
          readStores = mod.readSpaceStores as (id: string) => Promise<Record<string, unknown[]>>;
        }
      } catch {
        readStores = null;
      }
      for (const a of list) {
        if (cancelled) return;
        const sid = athleteSpaceId(a.id);
        let stores: Record<string, unknown[]> = {};
        if (readStores) {
          try {
            stores = await readStores(sid);
          } catch {
            stores = {};
          }
        }
        const readKey = (k: string) => {
          try {
            return storage.getItem(toPhysicalKey(sid, k));
          } catch {
            return null;
          }
        };
        const snap = buildAthleteSnapshot({ spaceId: sid, stores, readKey, today: coachToday() });
        if (cancelled) return;
        setSnapshots(prev => ({ ...prev, [a.id]: snap }));
        // Выполнение недели считается по тем же датам: отдельного чтения базы не
        // нужно, а план берём из рантайма тренировок этого пространства.
        const adh = computeAdherence({
          runtimeRaw: readKey('he_pl_runtime'),
          sessionDates: snap.sessionDates,
          today: coachToday(),
        });
        if (cancelled) return;
        setAdherence(prev => ({ ...prev, [a.id]: adh }));
      }
      if (!cancelled) {
        setSnapshotsBusy(false);
        setSnapshotsDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletesFingerprint, snapshotsRev]);

  /**
   * Сводки читаются из баз ДРУГИХ пространств, а синхронизация дома привозит новые
   * тренировки, пока вкладка в фоне. Вернувшись в приложение, пересобираем сводки:
   * иначе тренер видел бы цифры на момент открытия вкладки. Только переход
   * фон→передний план: «focus» в браузере срабатывает часто и без повода.
   */
  useEffect(() => {
    let wasHidden = false;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true;
        return;
      }
      if (!wasHidden) return;
      wasHidden = false;
      setSnapshotsRev(v => v + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /**
   * «Снять программу» с атлета: сырые программные ключи его пространства →
   * шаблон в устройственной библиотеке. Дневники и анализы не попадают.
   */
  const saveProgramFromAthlete = (athlete: CoachAthlete) => {
    const storage = ls();
    setProgramNotice(null);
    setProgramError(null);
    if (!storage) {
      setProgramError('Хранилище недоступно — сохранить программу нельзя.');
      return;
    }
    const bundle = collectProgramBundle(storage, athleteSpaceId(athlete.id), {
      createdAt: new Date().toISOString(),
      name: athlete.name,
    });
    if (describeProgramBundle(bundle).keys === 0) {
      setProgramError(`У атлета «${athlete.name}» пока нет сохранённой программы — снимать нечего.`);
      return;
    }
    const base = `${athlete.name} · ${fmtShort(coachToday())}`;
    const res = addCoachProgram(programs, {
      name: uniqueProgramName(base, programs.items),
      bundle,
      sourceLabel: athlete.name,
    });
    if (res.error || !res.template) {
      setProgramError(coachProgramErrorText(res.error));
      return;
    }
    writeCoachPrograms(storage, res.store);
    setPrograms(res.store);
    auditEvent('program-saved', athlete.id);
    setProgramNotice(`«${res.template.name}» — в «Моих программах». Теперь её можно выдать другому атлету.`);
  };

  /** Начать выдачу из библиотеки (шаблон) или прямо с карточки атлета (снимок). */
  const startIssueTemplate = (t: CoachProgramTemplate) => {
    setIssue({ templateId: t.id, title: t.name, bundle: t.bundle });
    setIssuePick(new Set());
    setIssueConfirm(false);
    setIssueDone(null);
    setProgramNotice(null);
    setProgramError(null);
  };

  const startIssueFromAthlete = (athlete: CoachAthlete) => {
    const storage = ls();
    if (!storage) {
      setProgramError('Хранилище недоступно — скопировать программу нельзя.');
      return;
    }
    const bundle = collectProgramBundle(storage, athleteSpaceId(athlete.id), {
      createdAt: new Date().toISOString(),
      name: athlete.name,
    });
    if (describeProgramBundle(bundle).keys === 0) {
      setProgramError(`У «${athlete.name}» нет программы для копирования.`);
      return;
    }
    setIssue({ templateId: null, title: `Программа «${athlete.name}»`, bundle });
    setIssuePick(new Set());
    setIssueConfirm(false);
    setIssueDone(null);
    setProgramNotice(null);
    setProgramError(null);
  };

  const toggleIssuePick = (id: string) => {
    setIssuePick(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIssueConfirm(false);
    setIssueDone(null);
  };

  /**
   * Выдать программу выбранным. Пишем через шов с физическими ключами, поэтому
   * синхронизация видит правку (и надгробия на снятые ключи), а регистрируем
   * пространство — иначе копия не попадёт в бэкап и список переключения.
   */
  const doIssue = () => {
    const storage = ls();
    if (!storage || !issue) return;
    const chosen = state.athletes.filter(a => issuePick.has(a.id));
    if (!chosen.length) return;
    let ok = 0;
    let failed = 0;
    const reg = readRegistryFromStorage();
    let nextReg = reg;
    for (const a of chosen) {
      const sid = athleteSpaceId(a.id);
      const r = applyProgramBundle(storage, sid, issue.bundle, { mode: 'replace' });
      if (r.error) {
        failed++;
        continue;
      }
      ok++;
      auditEvent('program-issued', a.id);
      nextReg = upsertSpace(nextReg, { id: sid, athleteId: a.id, label: a.name }).registry;
    }
    if (nextReg !== reg) {
      writeRegistryToStorage(nextReg);
      setRegistryRev(v => v + 1);
    }
    if (issue.templateId && ok > 0) {
      const next = markCoachProgramIssued(programs, issue.templateId);
      writeCoachPrograms(storage, next);
      setPrograms(next);
    }
    setIssueConfirm(false);
    const names =
      chosen.slice(0, 3).map(a => a.name).join(', ') +
      (chosen.length > 3 ? ` и ещё ${chosen.length - 3}` : '');
    if (failed) {
      setIssueDone(
        `Выдано: ${ok ? names : 'никому'} · не удалось: ${failed}. Повторите для неудавшихся — данные не тронуты.`,
      );
      return;
    }
    setIssue(null);
    setIssuePick(new Set());
    setIssueDone(`Готово: программа выдана — ${names}. Атлет увидит её, когда откроет свои данные.`);
  };

  /**
   * Программа — файл. Формат тот же, что у выдачи: `bodybuildhealth` +
   * `coach-program` v1. Файл можно передать другому тренеру/на другое устройство,
   * и там он попадёт в библиотеку, а не перезапишет атлета молча.
   */
  const exportProgramFile = async (t: CoachProgramTemplate) => {
    setProgramNotice(null);
    setProgramError(null);
    try {
      const mod = await import('../../../core/apk-share');
      const fileName = `${t.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.coach-program.json`;
      const res = await mod.saveTextFileApk(
        fileName,
        JSON.stringify(t.bundle, null, 2),
        'application/json;charset=utf-8',
      );
      setProgramNotice(`Файл программы: ${mod.shareOutcomeLabel(res)}`);
      auditEvent('program-exported');
    } catch {
      setProgramError('Не удалось сохранить файл программы.');
    }
  };

  /** Импорт файла — только в библиотеку: выдача по-прежнему отдельным шагом. */
  const importProgramFile = async (file: File | null | undefined) => {
    if (!file) return;
    setProgramNotice(null);
    setProgramError(null);
    setProgramFileBusy(true);
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
        setProgramError('Это не файл программы: внутри не JSON.');
        return;
      }
      const norm = normalizeProgramBundle(parsed);
      if (norm.error || !norm.bundle) {
        setProgramError(programBundleErrorText(norm.error) || 'Файл не похож на программу из этого приложения.');
        return;
      }
      const fallbackName = file.name.replace(/\.coach-program\.json$/i, '').replace(/\.json$/i, '');
      const res = addCoachProgram(programs, {
        name: norm.bundle.name || fallbackName || 'Программа из файла',
        bundle: norm.bundle,
        sourceLabel: 'из файла',
      });
      if (res.error || !res.template) {
        setProgramError(coachProgramErrorText(res.error));
        return;
      }
      writeCoachPrograms(ls(), res.store);
      setPrograms(res.store);
      auditEvent('program-imported');
      setProgramNotice(`«${res.template.name}» — в «Моих программах». Проверьте и выдайте, когда будете готовы.`);
    } catch {
      setProgramError('Не удалось прочитать файл.');
    } finally {
      setProgramFileBusy(false);
    }
  };

  /**
   * Копия одного атлета файлом. Читает его пространство целиком (настройки +
   * записи базы), но НЕ фото веса и не служебные ключи — об этом сказано в UI.
   */
  const exportAthleteCopy = async (athlete: CoachAthlete) => {
    const storage = ls();
    setCopyNotice(null);
    setCopyError(null);
    if (!storage) {
      setCopyError('Хранилище недоступно — копию не сделать.');
      return;
    }
    setCopyBusy(true);
    try {
      const sid = athleteSpaceId(athlete.id);
      let stores: Record<string, unknown[]> = {};
      try {
        const mod = await loadDb();
        stores = await mod.readSpaceStores(sid);
      } catch {
        stores = {};
      }
      const { copy, bytes } = collectAthleteCopy({ storage, spaceId: sid, stores, label: athlete.name });
      if (bytes > ATHLETE_COPY_MAX_BYTES) {
        setCopyError(athleteCopyErrorText('size'));
        return;
      }
      const d = describeAthleteCopy(copy);
      if (!d.keys && !d.records) {
        setCopyError(athleteCopyErrorText('empty'));
        return;
      }
      const share = await import('../../../core/apk-share');
      const fileName = `${athlete.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.coach-athlete.json`;
      const res = await share.saveTextFileApk(
        fileName,
        JSON.stringify(copy, null, 2),
        'application/json;charset=utf-8',
      );
      setCopyNotice(
        `Копия: ${d.keys} ${plural(d.keys, 'ключ', 'ключа', 'ключей')}, ${d.records} ${plural(d.records, 'запись', 'записи', 'записей')} · ${share.shareOutcomeLabel(res)}. Фото веса в копию не входят.`,
      );
      auditEvent('copy-exported', athlete.id);
    } catch {
      setCopyError('Не удалось собрать копию атлета.');
    } finally {
      setCopyBusy(false);
    }
  };

  /**
   * Восстановление копии — ВСЕГДА в нового атлета. Затирать существующего
   * копией нельзя: это потеря его данных, а не «обновление».
   */
  const importAthleteCopy = async (file: File | null | undefined) => {
    if (!file) return;
    const storage = ls();
    setCopyNotice(null);
    setCopyError(null);
    if (!storage) {
      setCopyError('Хранилище недоступно — копию не восстановить.');
      return;
    }
    setCopyBusy(true);
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
        setCopyError(athleteCopyErrorText('not-object'));
        return;
      }
      const norm = normalizeAthleteCopy(parsed);
      if (norm.error || !norm.copy) {
        setCopyError(athleteCopyErrorText(norm.error));
        return;
      }
      const copy = norm.copy;
      const baseName = (copy.label || file.name.replace(/\.coach-athlete\.json$/i, '').replace(/\.json$/i, '')).trim() || 'Атлет из копии';
      const created = addCoachAthlete(state, {
        name: `${baseName} (копия)`,
        direction: '',
        goal: '',
        note: 'Восстановлен из файла копии',
      });
      if (created.error || !created.athlete) {
        setCopyError('Не удалось создать карточку для копии.');
        return;
      }
      apply(created.state);
      const sid = athleteSpaceId(created.athlete.id);
      const written = applyAthleteCopyKeys(storage, sid, copy);
      let records = 0;
      try {
        const mod = await loadDb();
        await mod.writeSpaceStores(sid, copy.stores as Record<string, any[]>);
        records = describeAthleteCopy(copy).records;
      } catch {
        /* настройки уже записаны; честно скажем про базу ниже */
      }
      writeRegistryToStorage(upsertSpace(readRegistryFromStorage(), { id: sid, athleteId: created.athlete.id, label: created.athlete.name }).registry);
      setRegistryRev(v => v + 1);
      setSnapshotsRev(v => v + 1);
      setCopyNotice(
        `Восстановлено в нового атлета «${created.athlete.name}»: ${written} ${plural(written, 'ключ', 'ключа', 'ключей')}` +
          (records ? `, ${records} ${plural(records, 'запись', 'записи', 'записей')} в базе` : ', записей базы нет') +
          '. Фото веса копия не содержит.',
      );
      auditEvent('copy-imported', created.athlete.id);
    } catch {
      setCopyError('Не удалось прочитать файл копии.');
    } finally {
      setCopyBusy(false);
    }
  };

  const saveProgramRename = (id: string) => {    const storage = ls();
    if (!storage) return;
    const res = renameCoachProgram(programs, id, renameValue);
    if (res.error) {
      setProgramError(coachProgramErrorText(res.error));
      return;
    }
    writeCoachPrograms(storage, res.store);
    setPrograms(res.store);
    setRenameProgramId(null);
    setRenameValue('');
    setProgramError(null);
  };

  const deleteProgram = (id: string) => {
    const storage = ls();
    if (!storage) return;
    const next = removeCoachProgram(programs, id);
    writeCoachPrograms(storage, next);
    setPrograms(next);
    setConfirmProgramDelete(null);
    if (issue?.templateId === id) {
      setIssue(null);
      setIssuePick(new Set());
    }
    setProgramNotice('Программа удалена из библиотеки. У атлетов, кому её уже выдали, она осталась.');
  };

  const toggleEnabled = () => {
    const next = setCoachEnabled(state, !state.enabled);
    apply(next);
    // Выключили режим, находясь в данных атлета — оставаться там нельзя: полоса
    // «Данные атлета» пропадает, и чужие данные выглядят как свои. Возвращаем
    // в домашнее пространство, как и любое другое переключение.
    if (!next.enabled && spaceActiveId !== HOME_SPACE_ID) {
      activateHomeSpace();
      reloadToApplySpace();
    }
  };

  const toggleSection = (id: CoachSectionId) => {
    apply(toggleCoachSection(state, id));
  };

  const allSelected = state.sections.length === COACH_SECTIONS.length;

  const startEdit = (a: CoachAthlete) => {
    setEditingId(a.id);
    setForm(formFromAthlete(a));
    setFormError(null);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const save = () => {
    if (!form.name.trim()) {
      setFormError('Имя обязательно — по нему тренер находит атлета в списке.');
      return;
    }
    // Статус, группа, метки, контакт и дата старта — часть карточки, а не
    // отдельная форма: сохраняются тем же «Сохранить», что и имя.
    const extras = {
      status: form.status,
      group: form.group,
      tags: form.tags,
      contact: form.contact,
      // Пустая дата — «не знаю»: при создании движок подставит сегодняшний день.
      startedAt: form.startedAt.trim() || undefined,
    };
    if (editingId) {
      apply(
        updateCoachAthlete(state, editingId, {
          name: form.name,
          sex: form.sex,
          age: form.age,
          weightKg: form.weightKg,
          heightCm: form.heightCm,
          direction: form.direction,
          goal: form.goal,
          note: form.note,
          ...extras,
        }),
      );
      // Переименовали атлета — имя в его пространстве данных должно обновиться
      // тоже: иначе полоса «Данные атлета: <старое имя>» и список «Сменить»
      // показывали бы прежнее имя, пока тренер не войдёт в данные заново.
      syncSpaceLabel(editingId, form.name);
      auditEvent('athlete-updated', editingId);
      cancelEdit();
      return;
    }
    const res = addCoachAthlete(state, {
      name: form.name,
      sex: form.sex,
      age: form.age,
      weightKg: form.weightKg,
      heightCm: form.heightCm,
      direction: form.direction,
      goal: form.goal,
      note: form.note,
      ...extras,
    });
    if (res.error === 'name') {
      setFormError('Имя обязательно.');
      return;
    }
    apply(res.state);
    if (res.athlete) auditEvent('athlete-added', res.athlete.id);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  /**
   * Имя атлета живёт в двух местах: карточка тренера (журнал/заметки) и запись
   * пространства данных (полоса сверху, список «Сменить»). Переименование
   * обновляет оба, иначе человек видит старое имя там, где принимает решение.
   * Запись пространства может отсутствовать (атлет ещё не входил) — тогда нечего
   * обновлять, и создавать её «на всякий случай» не нужно.
   */
  const syncSpaceLabel = (athleteId: string, label: string) => {
    const sid = athleteSpaceId(athleteId);
    const reg = readRegistryFromStorage();
    if (!reg.spaces.some(s => s.id === sid)) return;
    const next = upsertSpace(reg, { id: sid, athleteId, label });
    if (!next.error) {
      writeRegistryToStorage(next.registry);
      // Строка «Открыты данные: …» должна обновиться сразу, а не после входа
      // в данные заново: имя в ней — единственный признак, чей профиль открыт.
      setActiveSpace(activeSpaceRecord());
    }
  };

  /**
   * Ленивый подсчёт записей в базе пространства. Возвращает то же значение,
   * которое кладёт в состояние: `null` — посчитать не удалось.
   *
   * Импорт именно `await import(...)`, а не `import(...).then(...)`: так модуль
   * базы подменяется в тестах (Vitest перехватывает await-импорт) и не уезжает
   * в основной граф вкладки.
   */
  const loadSpaceDbCount = async (id: string): Promise<number | null> => {
    try {
      const { spaceDbRecordCount } = await loadDb();
      const records = await spaceDbRecordCount(athleteSpaceId(id));
      setSpaceDbRecords(prev => ({ ...prev, [id]: records }));
      return records;
    } catch {
      setSpaceDbRecords(prev => ({ ...prev, [id]: null }));
      return null;
    }
  };

  const askDelete = (id: string) => {
    if (confirmDeleteId === id) {
      void confirmCardDelete(id);
      return;
    }
    setConfirmDeleteId(id);
    // Настоящий объём данных атлета спрашиваем лениво и только когда тренер уже
    // собрался удалять: дневники тренировок и анализы живут в его базе IndexedDB,
    // а не в localStorage — без этого «сколько удалится» было бы занижено в разы.
    void loadSpaceDbCount(id);
  };

  /**
   * «Точно удалить»: убираем карточку. Запись пространства — только если
   * доказано, что данных нет НИГДЕ: ни ключей в localStorage, ни записей в его
   * базе IndexedDB.
   *
   * Раньше смотрели только на ключи. Атлет, у которого в localStorage пусто, а
   * тренировки и анализы лежат в его базе, терял запись реестра — и база
   * оставалась на диске без единого способа до неё добраться: «Сменить» и блок
   * висящих данных читают реестр. Неизвестный объём (не спросили / не смогли)
   * считается «не пусто»: сохранить лишнюю запись безопасно, потерять данные —
   * нет.
   */
  const confirmCardDelete = async (id: string) => {
    const sid = athleteSpaceId(id);
    apply(removeCoachAthlete(state, id));
    auditEvent('athlete-removed', id);
    setConfirmDeleteId(null);
    if (editingId === id) cancelEdit();
    if (usageOf(id).keys !== 0) return;
    let records = spaceDbRecords[id];
    if (records === undefined) records = await loadSpaceDbCount(id);
    if (records !== 0) return;
    const reg = readRegistryFromStorage();
    if (!reg.spaces.some(s => s.id === sid)) return;
    writeRegistryToStorage(removeSpace(reg, sid));
    setRegistryRev(v => v + 1);
    if (spaceActiveId === sid) {
      activateHomeSpace();
      reloadToApplySpace();
    }
  };

  /**
   * Удалить базу IndexedDB пространства — в фоне, ПОСЛЕ того как ключи, запись
   * реестра и карточка уже убраны. Так «Удалено» не ждёт открытия базы: если
   * удаление базы не удалось, данные всё равно недостижимы, а осиротевшая база
   * видна в «Базах на диске».
   */
  const dropSpaceDatabase = (spaceId: string) => {
    void (async () => {
      try {
        const { deleteSpaceDatabases } = await loadDb();
        await deleteSpaceDatabases([spaceId]);
      } catch {
        /* база останется — данные уже недостижимы, это не блокирует удаление */
      }
    })();
  };

  /** Удаление карточки вместе с данными атлета (профиль/дневники/анализы). */
  const deleteWithData = (a: CoachAthlete) => {
    const sid = athleteSpaceId(a.id);
    // Чистим по префиксу пространства, а не по наличию записи в реестре: «осиротевшие»
    // ключи (атлет входил, но реестр уже переписывали) тоже должны уйти.
    const storage = ls();
    if (storage) clearSpaceData(deviceRawOrFallback(storage), sid);
    // Черновики в sessionStorage (дневник, копия блока программы) тоже его данные:
    // иначе в следующем входе всплыл бы старый недописанный черновик.
    clearSessionSpaceData(sid);
    writeRegistryToStorage(removeSpace(readRegistryFromStorage(), sid));
    // Облачная копия: базы IndexedDB удаляются целиком, и надгробий у их записей
    // нет — просим синхронизацию убрать пространство из облака (если она включена).
    requestSpacePurge([sid]);
    apply(removeCoachAthlete(state, a.id));
    auditEvent('athlete-data-deleted', a.id);
    setConfirmDeleteId(null);
    if (editingId === a.id) cancelEdit();
    // База грузится лениво: движок нужен только здесь, а статический импорт
    // тянул его в граф экрана профиля и замедлял холодный старт.
    dropSpaceDatabase(sid);
    if (spaceActiveId === sid) {
      activateHomeSpace();
      reloadToApplySpace();
    }
  };

  /**
   * Удалить данные пространства, у которого уже нет карточки. Тот же путь, что и
   * «Удалить и его данные»: ключи по префиксу (включая осиротевшие), черновики,
   * запись реестра, база IndexedDB — иначе «удалено» значило бы «спрятано».
   */
  const deleteOrphanData = (spaceId: string) => {
    // Защита на случай, если блок как-то показал подключённое пространство:
    // «удалить» здесь означает стереть облачную копию, а она не наша.
    if (isJoinedSpace(spaceId)) {
      setConfirmOrphanId(null);
      return;
    }
    const storage = ls();
    if (storage) clearSpaceData(deviceRawOrFallback(storage), spaceId);
    clearSessionSpaceData(spaceId);
    writeRegistryToStorage(removeSpace(readRegistryFromStorage(), spaceId));
    requestSpacePurge([spaceId]);
    setRegistryRev(v => v + 1);
    setConfirmOrphanId(null);
    // Найденная база больше не «есть на диске» — из результата проверки её убираем.
    setDiskScan(prev => (prev ? { ...prev, ids: prev.ids.filter(id => id !== spaceId) } : prev));
    dropSpaceDatabase(spaceId);
    if (spaceActiveId === spaceId) {
      activateHomeSpace();
      reloadToApplySpace();
    }
  };

  /** Войти в данные без карточки — тем же путём, что и обычное переключение. */
  const openOrphanSpace = (spaceId: string) => {
    guardPin('Открыть данные без карточки. Это чужое пространство.', () => {
      const res = activateSpaceById(spaceId);
      if (res.error) return;
      auditEvent('space-entered');
      reloadToApplySpace();
    });
  };

  /**
   * Посмотреть, какие базы вообще есть на диске.
   *
   * Реестр — не единственный источник правды о данных: раньше баг удаления
   * карточки убирал запись реестра у атлета, у которого записи были только в
   * базе. Такая база невидима и для списка, и для «Данных без карточки» — но
   * занимает место и остаётся чужой медицинской информацией на телефоне.
   * Поэтому спрашиваем сам диск, а не реестр. Модуль базы подгружается лениво:
   * держать его в графе вкладки незачем.
   */
  const scanDisk = async () => {
    setScanBusy(true);
    try {
      const { listSpaceDatabaseIds } = await loadDb();
      const ids = await listSpaceDatabaseIds();
      setDiskScan(ids ? { ids, unavailable: false } : { ids: [], unavailable: true });
    } catch {
      setDiskScan({ ids: [], unavailable: true });
    } finally {
      setScanBusy(false);
    }
  };

  /**
   * «Забыть всех атлетов». Два шага и цифра в подтверждении: это необратимо.
   *
   * Зачем отдельная кнопка: удалять по одному 20 раз — не путь для человека,
   * который закончил работу с группой или отдаёт телефон. И это НЕ полный сброс
   * приложения: собственные данные тренера остаются, уходят только те, что
   * относятся к атлетам (включая карточки, заметки, задачи и журнал — иначе
   * после «забыли людей» остались бы записи о людях, которых больше нет).
   */
  const forgetAll = async () => {
    if (!confirmForgetAll) {
      setForgetError(null);
      setForgetDone(false);
      setConfirmForgetAll(true);
      return;
    }
    setForgetBusy(true);
    const wasInAthleteSpace = spaceActiveId !== HOME_SPACE_ID;
    try {
      const { forgetAllAthletes } = await import('../../../core/data-backup');
      await forgetAllAthletes();
      const storage = ls();
      writeCoachNotes(storage, emptyCoachNotes());
      writeCoachPlanner(storage, emptyCoachPlanner());
      writeCoachLog(storage, emptyCoachLog());
      apply({ ...state, athletes: [], activeAthleteId: null });
      setSpaceDbRecords({});
      setConfirmOrphanId(null);
      setConfirmForgetAll(false);
      setForgetBusy(false);
      // Блок остаётся на экране с итогом: иначе он просто исчезает вместе с
      // последней карточкой, и человек не видит, что операция состоялась.
      setForgetDone(true);
      auditEvent('athletes-forgotten');
      setRegistryRev(v => v + 1);
      // Если открыты данные атлета — в памяти остались его дневники:
      // возвращаемся домой, как при любом переключении.
      if (wasInAthleteSpace) {
        activateHomeSpace();
        reloadToApplySpace();
      }
    } catch {
      setForgetBusy(false);
      setForgetError('Не удалось удалить данные атлетов — попробуйте ещё раз.');
    }
  };

  /** Войти в данные атлета: своё пространство профиля/дневников/планов. */
  const enterAthleteData = (a: CoachAthlete) => {
    guardPin(`Войти в данные атлета «${a.name}». Это чужое пространство.`, () => {
      // Переносим введённое в карточку в пустой профиль атлета: имя, пол, возраст,
      // рост и вес тренер уже заполнял здесь — второй раз спрашивать незачем.
      const seed = {
        name: a.name,
        ...(a.sex === 'male' || a.sex === 'female' ? { sex: a.sex } : {}),
        ...(a.age != null ? { age: a.age } : {}),
        ...(a.heightCm != null ? { height: a.heightCm } : {}),
        ...(a.weightKg != null ? { weight: a.weightKg } : {}),
      };
      const res = activateAthleteSpace(a.id, a.name, seed);
      if (res.error) {
        setFormError('Не удалось открыть данные атлета.');
        return;
      }
      auditEvent('space-entered', a.id);
      reloadToApplySpace();
    });
  };

  const attentionCount = state.athletes.filter(
    a => a.status !== 'archived' && snapshots[a.id]?.needsAttention,
  ).length;

  /** Фильтр статуса: архив скрыт по умолчанию, но данные с ним не удаляются. */
  const statusCounts = useMemo(() => coachStatusCounts(state), [state]);

  const visibleAthletes = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = state.athletes;
    if (statusFilter === 'live') list = list.filter(a => a.status !== 'archived');
    else if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (attentionOnly) list = list.filter(a => snapshots[a.id]?.needsAttention);
    if (q) {
      list = list.filter(a =>
        `${a.name} ${a.direction} ${a.goal} ${a.note} ${a.group} ${a.tags.join(' ')} ${a.contact}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (sortMode === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    } else if (sortMode === 'inactive') {
      // Без порогов: кто дольше без тренировки — выше. «Нет данных» — наверх,
      // потому что тренеру как раз нечего смотреть.
      list = [...list].sort((a, b) => {
        const x = snapshots[a.id]?.daysSinceTraining;
        const y = snapshots[b.id]?.daysSinceTraining;
        if (x == null && y == null) return a.name.localeCompare(b.name, 'ru');
        if (x == null) return -1;
        if (y == null) return 1;
        return y - x;
      });
    }
    return list;
  }, [state, query, attentionOnly, sortMode, snapshots, statusFilter]);

  /**
   * Инбокс — те же факты, что на карточках, но одной строкой «к кому идти».
   * Строится из уже загруженных сводок: ни одного лишнего чтения базы.
   */
  const inbox = useMemo(
    () =>
      buildCoachInbox(
        state.athletes.map(a => ({
          athlete: a,
          snapshot: snapshots[a.id],
          adherence: adherence[a.id],
        })),
      ),
    [state.athletes, snapshots, adherence],
  );

  /** Недельный вид: задачи по дням + факты атлетов. Считается из уже загруженного. */
  const week = useMemo(
    () =>
      buildCoachWeek({
        today: coachToday(),
        weekStart: weekStartOf(coachToday()),
        tasks: planner.items,
        athletes: state.athletes.map(a => ({
          athlete: a,
          snapshot: snapshots[a.id],
          adherence: adherence[a.id],
        })),
        notes: notes.items,
      }),
    [planner.items, state.athletes, snapshots, adherence, notes],
  );

  const changeStatus = (athlete: CoachAthlete, status: CoachAthleteStatus) => {
    apply(setCoachAthleteStatus(state, athlete.id, status));
    auditEvent('athlete-status', athlete.id);
  };

  const openWeekComment = (a: CoachAthlete) => {
    if (weekCommentFor === a.id) {
      setWeekCommentFor(null);
      return;
    }
    const weekStart = weekStartOf(coachToday());
    const existing = weekNoteFor(notes, a.id, weekStart);
    setWeekDraft(existing?.body ?? '');
    setWeekError(null);
    setWeekCommentFor(a.id);
  };

  const saveWeekComment = (a: CoachAthlete) => {
    const weekStart = weekStartOf(coachToday());
    const body = weekDraft.trim();
    if (!body) {
      setWeekError('Пустой комментарий не сохраняем.');
      return;
    }
    const res = addCoachNote(notes, { athleteId: a.id, week: weekStart, body });
    if (res.error) {
      setWeekError(res.error === 'limit' ? 'Лимит заметок — удалите старые в разделе «Заметки».' : 'Не удалось сохранить.');
      return;
    }
    writeCoachNotes(ls(), res.store);
    setNotesRev(v => v + 1);
    setWeekCommentFor(null);
    setWeekDraft('');
    setWeekError(null);
  };

  const sectionLabel = (id: CoachSectionId): string =>
    COACH_SECTIONS.find(s => s.id === id)?.label ?? id;

  // Замок: если включён PIN и сессия не разблокирована, наружу показываем
  // ТОЛЬКО экран входа. Никакого «частично видно» — иначе PIN бессмысленен.
  if (state.enabled && lock.enabled && !unlocked) {
    return (
      <div
        className="pf-coach"
        data-coach="locked"
        style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', color: ACCENT }}>
            <NativeIcon name="sliders" size={15} />
          </span>
          Профиль тренера заблокирован
        </div>
        <div style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 1.45 }}>
          Введите PIN. Данные атлетов не удалены — закрыт только вход на этом устройстве.
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={8}
          value={pinAttempt}
          aria-label="PIN"
          data-coach="lock-unlock-pin"
          onChange={e => setPinAttempt(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => {
            if (e.key === 'Enter') void tryUnlock();
          }}
          style={{ ...inputStyle, letterSpacing: 3, fontSize: 16, textAlign: 'center' }}
        />
        {pinAttemptError && (
          <div data-coach="lock-unlock-error" role="alert" style={{ fontSize: 11.5, color: colors.danger }}>
            {pinAttemptError}
          </div>
        )}
        <button
          type="button"
          data-coach="lock-unlock"
          onClick={() => void tryUnlock()}
          style={{ ...btn('primary'), alignSelf: 'flex-start' }}
        >
          Открыть
        </button>
        {lock.biometry && bioAvailable && (
          <button
            type="button"
            data-coach="lock-unlock-bio"
            onClick={() => void tryUnlockBiometrics()}
            disabled={bioBusy}
            style={{
              ...btn('ghost'),
              alignSelf: 'flex-start',
              opacity: bioBusy ? 0.6 : 1,
              color: ACCENT,
              borderColor: 'rgba(34,211,238,0.38)',
            }}
          >
            {bioBusy ? 'Проверяем…' : 'Отпечаток или Face'}
          </button>
        )}
        <div style={{ fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.45 }}>
          Забыли PIN? Восстановить его нельзя, но данные остаются на месте.
        </div>
      </div>
    );
  }

  return (
    <div className="pf-coach" data-coach="root" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Переключатель режима */}
      <div style={{ ...cardStyle, borderColor: withAlpha(ACCENT, state.enabled ? '66' : '1f') }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ display: 'inline-flex', color: ACCENT }}>
                <NativeIcon name="award" size={15} />
              </span>
              Режим тренера
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 1.45 }}>
              Атлеты без ограничения по количеству, выбор нужных разделов, заметки и планер.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.enabled}
            aria-label="Режим тренера"
            data-coach="toggle"
            onClick={toggleEnabled}
            style={{
              flexShrink: 0,
              width: 62,
              height: 34,
              borderRadius: 999,
              cursor: 'pointer',
              border: `1px solid ${state.enabled ? withAlpha(ACCENT, '99') : 'rgba(255,255,255,0.14)'}`,
              background: state.enabled
                ? `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`
                : 'rgba(255,255,255,0.08)',
              position: 'relative',
              transition: 'background 0.18s ease, border 0.18s ease',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 3,
                left: state.enabled ? 31 : 4,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                transition: 'left 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          </button>
        </div>
        {state.enabled && (
          <div
            data-coach="active"
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 12,
              background: withAlpha(ACCENT, '18'),
              border: `1px solid ${withAlpha(ACCENT, '40')}`,
              fontSize: 12,
              color: '#fff',
            }}
          >
            <span aria-hidden="true" style={{ display: 'inline-flex', color: ACCENT }}>
              <NativeIcon name="target" size={13} />
            </span>
            {/* Показываем ПРАВДУ о том, чьи данные открыты, а не «выбранного
                атлета»: выбор в списке не значит, что его пространство открыто.
                Иначе строка читалась бы как «сейчас правлю Ивана», когда на
                экране свои данные. */}
            {spaceActiveId !== HOME_SPACE_ID ? (
              <>
                Открыты данные: <strong style={{ fontWeight: 800 }}>{activeSpaceLabel}</strong>
              </>
            ) : (
              <>
                Открыты ваши данные
                {active ? (
                  <>
                    {' · выбран: '}
                    <strong style={{ fontWeight: 800 }}>{active.name}</strong>
                  </>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {!state.enabled ? (
        <div style={{ ...cardStyle, fontSize: 12.5, color: colors.textMuted, lineHeight: 1.55 }}>
          Включите режим, чтобы вести карточки атлетов и выбрать разделы, которые вы у них
          контролируете. Заметки и календарь-планер доступны отдельными вкладками профиля
          и работают независимо от режима.
        </div>
      ) : (
        <>
          {/* Разделы */}
          <div style={cardStyle} data-coach="sections">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Разделы</div>
              <div style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
                {state.sections.length} из {COACH_SECTIONS.length}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {COACH_SECTIONS.map(s => {
                const on = state.sections.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Раздел ${s.label}`}
                    data-coach="section"
                    data-section={s.id}
                    data-on={on}
                    onClick={() => toggleSection(s.id)}
                    style={{
                      minHeight: 44,
                      padding: '8px 13px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 700,
                      textAlign: 'left',
                      border: `1px solid ${on ? withAlpha(ACCENT, '70') : 'rgba(255,255,255,0.12)'}`,
                      background: on ? withAlpha(ACCENT, '1f') : 'rgba(255,255,255,0.04)',
                      color: on ? '#fff' : 'rgba(255,255,255,0.62)',
                    }}
                  >
                    {on ? '✓ ' : ''}
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                data-coach="select-all"
                onClick={() => apply(selectAllCoachSections(state))}
                disabled={allSelected}
                style={{ ...btn('ghost'), opacity: allSelected ? 0.55 : 1 }}
              >
                Выбрать все
              </button>
              <button
                type="button"
                data-coach="select-none"
                onClick={() => apply({ ...state, sections: [] })}
                disabled={state.sections.length === 0}
                style={{ ...btn('ghost'), opacity: state.sections.length === 0 ? 0.55 : 1 }}
              >
                Снять все
              </button>
            </div>
            {state.sections.length === 0 && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: colors.warning }}>
                Разделы не выбраны — тренеру нечего контролировать. Выберите хотя бы один.
              </div>
            )}
            {state.sections.length > 0 && (
              <>
                <div style={{ marginTop: 14, fontSize: 11.5, color: colors.textMuted, fontWeight: 700 }}>
                  Быстрый переход
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {state.sections.map(id => {
                    const def = COACH_SECTIONS.find(s => s.id === id);
                    if (!def) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        data-coach="section-link"
                        onClick={() => onNavigate?.(def.nav)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        {def.label} →
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <CoachLockSettingsCard
            settings={lock}
            audit={audit}
            onChange={applyLock}
            onEvent={kind => auditEvent(kind)}
          />

          {/* Телефон атлета: отдельный код на пространство и подключение по коду. */}
          <CoachDeviceInviteCard
            spaces={spaceRegistry.spaces}
            onAudit={(kind, athleteId) => auditEvent(kind, athleteId)}
            onChanged={() => setRegistryRev(v => v + 1)}
          />

          {pinFor && (
            <CoachPinDialog
              purpose={pinFor.purpose}
              settings={lock}
              onCancel={() => setPinFor(null)}
              onConfirm={() => {
                const action = pinFor;
                setPinFor(null);
                action?.run();
              }}
            />
          )}

          {/* Неделя: задачи по дням и обзор — до списка карточек. */}
          <CoachWeekView
            week={week}
            tasks={planner.items}
            onAudit={kind => auditEvent(kind)}
            onSelectAthlete={(_id, name) => {
              setQuery(name);
              setStatusFilter('all');
              setAttentionOnly(false);
            }}
          />

          {/* Атлеты */}
          <div style={cardStyle} data-coach="athletes">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Атлеты</div>
                <div style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
                  {statusCounts.active + statusCounts.paused} в работе
                  {statusCounts.archived > 0 ? ` · ${statusCounts.archived} в архиве` : ''}
                  {` · ${ruCount(state.sections.length, RU_SECTIONS)}`}
                </div>
              </div>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск атлета"
                aria-label="Поиск атлета"
                data-coach="search"
                style={{ ...inputStyle, width: 180, flex: '0 1 180px' }}
              />
              <label
                data-coach="athlete-copy-import-label"
                style={{
                  ...btn('ghost'),
                  fontSize: 11.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: copyBusy ? 'default' : 'pointer',
                  opacity: copyBusy ? 0.6 : 1,
                }}
                title="Восстановить атлета из файла копии — всегда в новую карточку"
              >
                {copyBusy ? 'Читаем…' : 'Из копии'}
                <input
                  type="file"
                  accept=".json,application/json"
                  data-coach="athlete-copy-import"
                  disabled={copyBusy}
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = '';
                    void importAthleteCopy(file);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {copyNotice && (
              <div
                data-coach="copy-notice"
                role="status"
                style={{ marginTop: 8, fontSize: 11.5, color: colors.green, lineHeight: 1.45 }}
              >
                {copyNotice}
              </div>
            )}
            {copyError && (
              <div
                data-coach="copy-error"
                role="alert"
                style={{ marginTop: 8, fontSize: 11.5, color: colors.danger, lineHeight: 1.45 }}
              >
                {copyError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                data-coach="attention-filter"
                aria-pressed={attentionOnly}
                onClick={() => setAttentionOnly(v => !v)}
                style={{ ...btn(attentionOnly ? 'primary' : 'ghost'), fontSize: 12 }}
              >
                Требуют внимания ({attentionCount})
              </button>
              <select
                aria-label="Сортировка атлетов"
                data-coach="athlete-sort"
                value={sortMode}
                onChange={e => setSortMode(e.target.value as 'default' | 'name' | 'inactive')}
                style={{ ...inputStyle, width: 'auto', flex: '0 1 auto' }}
              >
                <option value="default">Как добавлены</option>
                <option value="inactive">Давно не тренировался</option>
                <option value="name">По имени</option>
              </select>
              <button
                type="button"
                data-coach="snapshots-refresh"
                onClick={() => setSnapshotsRev(v => v + 1)}
                disabled={snapshotsBusy}
                style={{ ...btn('ghost'), fontSize: 12, opacity: snapshotsBusy ? 0.6 : 1 }}
              >
                {snapshotsBusy ? 'Проверяю…' : 'Обновить сводки'}
              </button>
              {snapshotsDone && (
                <span
                  data-coach="snapshots-status"
                  style={{ fontSize: 11, color: colors.textMuted, fontVariantNumeric: 'tabular-nums' }}
                >
                  сводки: {Object.keys(snapshots).length} из {state.athletes.length}
                </span>
              )}
            </div>

            {/*
              Статус — не украшение: «архив» скрыт по умолчанию, чтобы список
              оставался рабочим, но переключатель рядом, и данные архивных
              атлетов никуда не деваются (удаление — отдельное действие).
            */}
            <div
              data-coach="status-filter"
              style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}
            >
              {(
                [
                  ['live', `В работе (${statusCounts.active + statusCounts.paused})`],
                  ['active', `Активные (${statusCounts.active})`],
                  ['paused', `Пауза (${statusCounts.paused})`],
                  ['archived', `Архив (${statusCounts.archived})`],
                  ['all', `Все (${state.athletes.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  data-coach={`status-${key}`}
                  aria-pressed={statusFilter === key}
                  onClick={() => setStatusFilter(key)}
                  style={{ ...btn(statusFilter === key ? 'primary' : 'ghost'), fontSize: 11.5, padding: '6px 10px' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/*
              Инбокс: «к кому идти сейчас». Показываем только когда есть поводы и
              сводки уже загружены — иначе строка была бы пустым обещанием.
            */}
            {snapshotsDone && inbox.length > 0 && (
              <div
                data-coach="inbox"
                style={{
                  marginTop: 10,
                  borderRadius: 12,
                  border: `1px solid ${withAlpha(colors.warning, '33')}`,
                  background: withAlpha(colors.warning, '0c'),
                  padding: 10,
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 800, color: colors.warning, marginBottom: 6 }}>
                  Требуют внимания · {inboxSummary(inbox)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {inbox.slice(0, 8).map(item => (
                    <button
                      key={item.key}
                      type="button"
                      data-coach="inbox-item"
                      onClick={() => {
                        // Переход в нужное место без «магии»: фильтруем список по
                        // имени и показываем все статусы, чтобы карточка точно
                        // нашлась, даже если она в архиве.
                        setQuery(item.athleteName);
                        setStatusFilter('all');
                        setAttentionOnly(false);
                      }}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'baseline',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: '2px 0',
                        cursor: 'pointer',
                        color: 'rgba(255,255,255,0.86)',
                        fontSize: 11.5,
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ fontWeight: 800, color: '#fff', flexShrink: 0 }}>{item.athleteName}</span>
                      <span style={{ color: colors.textMuted }}>{item.text}</span>
                    </button>
                  ))}
                </div>
                {inbox.length > 8 && (
                  <div style={{ fontSize: 10.5, color: colors.textSubtle, marginTop: 4 }}>
                    и ещё {inbox.length - 8} — сузьте фильтр по статусу
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.14)',
              }}
              data-coach="form"
            >
                <div style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted, marginBottom: 10 }}>
                  {editingId ? 'Правка карточки' : 'Новый атлет'}
                </div>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle} htmlFor="coach-name">Имя *</label>
                    <input
                      id="coach-name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Как зовут атлета"
                      style={inputStyle}
                      data-coach="name"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-sex">Пол</label>
                    <select
                      id="coach-sex"
                      value={form.sex}
                      onChange={e => setForm(f => ({ ...f, sex: e.target.value as CoachSex }))}
                      style={inputStyle}
                      data-coach="sex"
                    >
                      <option value="unspecified">Не указан</option>
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-age">Возраст, лет</label>
                    <input
                      id="coach-age"
                      inputMode="numeric"
                      value={form.age}
                      onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                      placeholder="—"
                      style={inputStyle}
                      data-coach="age"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-weight">Вес, кг</label>
                    <input
                      id="coach-weight"
                      inputMode="decimal"
                      value={form.weightKg}
                      onChange={e => setForm(f => ({ ...f, weightKg: e.target.value }))}
                      placeholder="—"
                      style={inputStyle}
                      data-coach="weight"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-height">Рост, см</label>
                    <input
                      id="coach-height"
                      inputMode="numeric"
                      value={form.heightCm}
                      onChange={e => setForm(f => ({ ...f, heightCm: e.target.value }))}
                      placeholder="—"
                      style={inputStyle}
                      data-coach="height"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-direction">Направление</label>
                    <input
                      id="coach-direction"
                      value={form.direction}
                      onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}
                      placeholder="Пауэрлифтинг, ББ, армреслинг…"
                      style={inputStyle}
                      data-coach="direction"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-goal">Цель</label>
                    <input
                      id="coach-goal"
                      value={form.goal}
                      onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                      placeholder="Присед 200, сушка до 82…"
                      style={inputStyle}
                      data-coach="goal"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-group">Группа</label>
                    <input
                      id="coach-group"
                      value={form.group}
                      onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
                      placeholder="Вечерняя, сборная…"
                      style={inputStyle}
                      data-coach="group"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-started">Веду с</label>
                    <input
                      id="coach-started"
                      type="date"
                      value={form.startedAt}
                      onChange={e => setForm(f => ({ ...f, startedAt: e.target.value }))}
                      style={inputStyle}
                      data-coach="started-at"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-status">Статус</label>
                    <select
                      id="coach-status"
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as CoachAthleteStatus }))}
                      style={{ ...inputStyle, appearance: 'none' }}
                      data-coach="status"
                    >
                      <option value="active">Активен</option>
                      <option value="paused">Пауза</option>
                      <option value="archived">Архив</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle} htmlFor="coach-contact">Контакт</label>
                    <input
                      id="coach-contact"
                      value={form.contact}
                      onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                      placeholder="Телефон или ник в мессенджере — приложение ему не пишет"
                      style={inputStyle}
                      data-coach="contact"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle} htmlFor="coach-tags">Метки</label>
                    <input
                      id="coach-tags"
                      value={form.tags}
                      onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                      placeholder="сила, спина, новичок — через запятую"
                      style={inputStyle}
                      data-coach="tags"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle} htmlFor="coach-note">Пометка тренера</label>
                    <textarea
                      id="coach-note"
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      rows={2}
                      placeholder="Травмы, ограничения, договорённости"
                      style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                      data-coach="note"
                    />
                  </div>
                </div>
                {formError && (
                  <div role="alert" data-coach="error" style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                    {formError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={save} data-coach="save" style={btn('primary')}>
                    {editingId ? 'Сохранить' : 'Добавить атлета'}
                  </button>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} data-coach="cancel" style={btn('ghost')}>
                      Отмена
                    </button>
                  )}
                </div>
              </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {visibleAthletes.length === 0 && (
                <div data-coach="athletes-empty" style={{ fontSize: 12, color: colors.textMuted }}>
                  {state.athletes.length === 0
                    ? 'Пока ни одного атлета — добавьте первого.'
                    : statusFilter === 'live' && statusCounts.archived > 0
                      ? `В работе никого нет — ${statusCounts.archived} в архиве. Откройте «Архив»: данные и программы на месте.`
                      : 'По фильтру никого не найдено.'}
                </div>
              )}
              {visibleAthletes.map(a => {
                const isActive = state.activeAthleteId === a.id;
                const noteCount = countNotesForAthlete(notes, a.id);
                const openTaskCount = planner.items.filter(t => t.athleteId === a.id && !t.done).length;
                const logStat = logStats.get(a.id);
                const meta = [
                  SEX_LABEL[a.sex],
                  a.age !== null ? `${a.age} лет` : null,
                  a.weightKg !== null ? `${a.weightKg} кг` : null,
                  a.heightCm !== null ? `${a.heightCm} см` : null,
                ].filter(Boolean) as string[];
                return (
                  <div
                    key={a.id}
                    data-coach="athlete"
                    data-athlete-id={a.id}
                    data-active={isActive}
                    style={{
                      borderRadius: 14,
                      padding: 12,
                      border: `1px solid ${isActive ? withAlpha(ACCENT, '66') : 'rgba(255,255,255,0.10)'}`,
                      background: isActive ? withAlpha(ACCENT, '12') : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{a.name}</div>
                      {isActive && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 999,
                            color: '#04222a',
                            background: ACCENT,
                          }}
                        >
                          активный
                        </span>
                      )}
                      {a.status !== 'active' && (
                        <span
                          data-coach="athlete-status"
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 999,
                            color: a.status === 'archived' ? 'rgba(255,255,255,0.62)' : '#fde68a',
                            background: a.status === 'archived' ? 'rgba(255,255,255,0.06)' : 'rgba(253,230,138,0.12)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {COACH_STATUS_LABELS[a.status]}
                        </span>
                      )}
                      {a.group && (
                        <span style={{ fontSize: 10.5, color: colors.textMuted }}>группа: {a.group}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>{meta.join(' · ')}</div>
                    {(a.direction || a.goal) && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 5, lineHeight: 1.45 }}>
                        {a.direction}
                        {a.direction && a.goal ? ' · ' : ''}
                        {a.goal}
                      </div>
                    )}
                    {a.note && (
                      <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 5, lineHeight: 1.45 }}>
                        {a.note}
                      </div>
                    )}
                    {(a.contact || a.startedAt) && (
                      <div
                        data-coach="athlete-contacts"
                        style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 5, lineHeight: 1.45 }}
                      >
                        {a.contact ? `контакт: ${a.contact}` : ''}
                        {a.contact && a.startedAt ? ' · ' : ''}
                        {a.startedAt ? `веду с ${fmtShort(a.startedAt)}` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                      {a.sections.map(id => (
                        <span
                          key={id}
                          style={{
                            fontSize: 10.5,
                            padding: '3px 8px',
                            borderRadius: 999,
                            color: 'rgba(255,255,255,0.7)',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {sectionLabel(id)}
                        </span>
                      ))}
                      {a.tags.map(tag => (
                        <span
                          key={`tag:${tag}`}
                          data-coach="athlete-tag"
                          style={{
                            fontSize: 10.5,
                            padding: '3px 8px',
                            borderRadius: 999,
                            color: '#c7f9ee',
                            background: 'rgba(34,211,238,0.10)',
                            border: '1px solid rgba(34,211,238,0.18)',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                      {noteCount > 0 && (
                        <span style={{ fontSize: 10.5, color: colors.textMuted, alignSelf: 'center' }}>
                          заметок: {noteCount}
                        </span>
                      )}
                      {openTaskCount > 0 && (
                        <span style={{ fontSize: 10.5, color: colors.textMuted, alignSelf: 'center' }}>
                          незакрытых задач: {openTaskCount}
                        </span>
                      )}
                      {logStat && logStat.count > 0 && (
                        <span data-coach="log-count" style={{ fontSize: 10.5, color: colors.textMuted, alignSelf: 'center' }}>
                          записей: {logStat.count}
                          {logStat.last && ` · последняя ${fmtShort(logStat.last)}`}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const u = usageOf(a.id);
                      const opened = lastOpenedOf(a.id);
                      // Только то, что знаем наверняка и без лишней работы: есть ли
                      // ключи и когда открывали. Объём в карточке не показываем —
                      // дневники тренировок и анализы лежат в IndexedDB, и число по
                      // localStorage было бы на порядки меньше настоящего.
                      const parts: string[] = [];
                      if (u.keys > 0) parts.push('свои данные: есть');
                      if (opened) parts.push(`открывался ${fmtShort(opened.slice(0, 10))}`);
                      if (!parts.length) return null;
                      return (
                        <div
                          data-coach="space-facts"
                          style={{ marginTop: 6, fontSize: 10.5, color: colors.textMuted, lineHeight: 1.45 }}
                        >
                          {parts.join(' · ')}
                        </div>
                      );
                    })()}
                    {snapshots[a.id] ? (
                      <div
                        data-coach="snapshot"
                        style={{ marginTop: 6, fontSize: 10.5, color: colors.textMuted, lineHeight: 1.45 }}
                      >
                        {snapshotLine(snapshots[a.id])}
                      </div>
                    ) : (
                      <div
                        data-coach="snapshot-pending"
                        style={{ marginTop: 6, fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.45 }}
                      >
                        {snapshotsBusy ? 'смотрим данные…' : 'сводка не загружена'}
                      </div>
                    )}
                    {adherence[a.id] && (
                      <div
                        data-coach="adherence"
                        style={{ marginTop: 4, fontSize: 10.5, color: colors.textMuted, lineHeight: 1.45 }}
                      >
                        {adherenceLine(adherence[a.id])}
                      </div>
                    )}
                    {weekCommentFor === a.id ? (
                      <div data-coach="week-comment-editor" style={{ marginTop: 8 }}>
                        <label style={{ ...labelStyle, marginBottom: 4 }} htmlFor={`week-comment-${a.id}`}>
                          Комментарий к неделе
                        </label>
                        <textarea
                          id={`week-comment-${a.id}`}
                          value={weekDraft}
                          onChange={e => setWeekDraft(e.target.value)}
                          rows={2}
                          placeholder="Что важно помнить по этой неделе: сон, боль, просьбы"
                          style={{ ...inputStyle, minHeight: 58, resize: 'vertical' }}
                          data-coach="week-comment-input"
                        />
                        {weekError && (
                          <div role="alert" style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>
                            {weekError}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button
                            type="button"
                            data-coach="week-comment-save"
                            onClick={() => saveWeekComment(a)}
                            style={{ ...btn('primary'), fontSize: 11.5 }}
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            data-coach="week-comment-cancel"
                            onClick={() => {
                              setWeekCommentFor(null);
                              setWeekError(null);
                            }}
                            style={{ ...btn('ghost'), fontSize: 11.5 }}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          data-coach="week-comment-open"
                          onClick={() => openWeekComment(a)}
                          style={{ ...btn('ghost'), fontSize: 11, padding: '5px 9px' }}
                          title="Короткая заметка, привязанная к этой неделе (не чат)"
                        >
                          Комментарий к неделе
                        </button>
                        {weekNoteFor(notes, a.id, weekStartOf(coachToday())) && (
                          <span data-coach="week-comment-has" style={{ fontSize: 10.5, color: colors.textSubtle }}>
                            комментарий есть
                          </span>
                        )}
                      </div>
                    )}
                    {snapshots[a.id]?.needsAttention && (
                      <div
                        data-coach="attention"
                        style={{ marginTop: 5, fontSize: 10.5, color: colors.warning, lineHeight: 1.45 }}
                      >
                        внимание: {snapshots[a.id].attention.join(' · ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {onOpenAthlete && (
                        <>
                          <button
                            type="button"
                            data-coach="open-log"
                            onClick={() => onOpenAthlete(a.id, 'log')}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                          >
                            Журнал атлета
                          </button>
                          <button
                            type="button"
                            data-coach="open-notes"
                            onClick={() => onOpenAthlete(a.id, 'notes')}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                          >
                            Заметки атлета
                          </button>
                          <button
                            type="button"
                            data-coach="open-planner"
                            onClick={() => onOpenAthlete(a.id, 'planner')}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                          >
                            Задачи атлета
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        data-coach="report-open"
                        onClick={() => setReportFor(prev => (prev === a.id ? null : a.id))}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                        title="Отчёт за неделю или 30 дней: объём, вес, выполнение, заметки"
                      >
                        {reportFor === a.id ? 'Свернуть отчёт' : 'Отчёт'}
                      </button>
                      <button
                        type="button"
                        data-coach="athlete-copy-export"
                        onClick={() => void exportAthleteCopy(a)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                        title="Файл со всеми данными этого атлета (без фото веса)"
                      >
                        Копия
                      </button>
                      <button
                        type="button"
                        data-coach="save-program"
                        onClick={() => saveProgramFromAthlete(a)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                        title="Сохранить программу этого атлета в библиотеку"
                      >
                        Снять программу
                      </button>
                      <button
                        type="button"
                        data-coach="copy-program"
                        onClick={() => startIssueFromAthlete(a)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                        title="Выдать программу этого атлета другому"
                      >
                        Выдать другому
                      </button>
                      {!isActive && (
                        <button
                          type="button"
                          data-coach="activate"
                          onClick={() => apply(setActiveCoachAthlete(state, a.id))}
                          style={{ ...btn('ghost'), fontSize: 12 }}
                        >
                          Сделать активным
                        </button>
                      )}
                      {a.status === 'archived' ? (
                        <button
                          type="button"
                          data-coach="unarchive"
                          onClick={() => changeStatus(a, 'active')}
                          style={{ ...btn('ghost'), fontSize: 12 }}
                        >
                          Вернуть из архива
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-coach={a.status === 'paused' ? 'resume' : 'pause'}
                            onClick={() =>
                              changeStatus(a, a.status === 'paused' ? 'active' : 'paused')
                            }
                            style={{ ...btn('ghost'), fontSize: 12 }}
                            title={
                              a.status === 'paused'
                                ? 'Вернуть в работу: данные и программа остаются на месте'
                                : 'Перерыв: карточка остаётся в списке, данные не удаляются'
                            }
                          >
                            {a.status === 'paused' ? 'Снять с паузы' : 'В паузу'}
                          </button>
                          <button
                            type="button"
                            data-coach="archive"
                            onClick={() => changeStatus(a, 'archived')}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                            title="Скрыть из рабочего списка; данные и программа сохраняются"
                          >
                            В архив
                          </button>
                        </>
                      )}
                      {spaceActiveId === athleteSpaceId(a.id) ? (
                        <span
                          data-coach="space-active"
                          style={{
                            alignSelf: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '4px 9px',
                            borderRadius: 999,
                            color: '#1b1033',
                            background: '#a78bfa',
                          }}
                        >
                          Открыты его данные
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-coach="enter-space"
                          onClick={() => enterAthleteData(a)}
                          style={{ ...btn('ghost'), fontSize: 12 }}
                          title="Открыть профиль, дневники и планы этого атлета"
                        >
                          Войти в его данные
                        </button>
                      )}
                      <button
                        type="button"
                        data-coach="edit"
                        onClick={() => (editingId === a.id ? cancelEdit() : startEdit(a))}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        {editingId === a.id ? 'Свернуть' : 'Изменить'}
                      </button>
                      <button
                        type="button"
                        data-coach="delete"
                        onClick={() => askDelete(a.id)}
                        style={{ ...btn('danger'), fontSize: 12 }}
                      >
                        {confirmDeleteId === a.id ? 'Точно удалить' : 'Удалить'}
                      </button>
                      {confirmDeleteId === a.id && (
                        <button
                          type="button"
                          data-coach="delete-cancel"
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ ...btn('ghost'), fontSize: 12 }}
                        >
                          Оставить
                        </button>
                      )}
                      {confirmDeleteId === a.id && (() => {
                        // Показываем кнопку, пока не доказано, что данных нет:
                        // у атлета могут быть записи только в базе IndexedDB.
                        const knownEmpty = usageOf(a.id).keys === 0 && spaceDbRecords[a.id] === 0;
                        if (knownEmpty) return null;
                        return (
                          <button
                            type="button"
                            data-coach="delete-with-data"
                            onClick={() => deleteWithData(a)}
                            style={{ ...btn('danger'), fontSize: 12 }}
                          >
                            Удалить и его данные
                          </button>
                        );
                      })()}
                    </div>
                    {confirmDeleteId === a.id && (
                      <div
                        data-coach="delete-hint"
                        style={{ marginTop: 8, fontSize: 11.5, color: colors.textMuted, lineHeight: 1.45 }}
                      >
                        «Точно удалить» убирает только карточку: заметки, задачи и записи журнала этого
                        атлета останутся. Если атлет уже входил в приложение, у него есть собственные
                        профиль, дневники и планы — их удаляет отдельная кнопка «Удалить и его данные»
                        {(() => {
                          const u = usageOf(a.id);
                          const rec = spaceDbRecords[a.id];
                          const parts: string[] = [];
                          if (typeof rec === 'number' && rec > 0) {
                            parts.push(`${rec} ${plural(rec, 'запись', 'записи', 'записей')} в базе`);
                          }
                          if (u.bytes > 0) parts.push(`${fmtBytes(u.bytes)} настроек и планов`);
                          return parts.length ? ` (${parts.join(' + ')})` : '';
                        })()}
                        .
                      </div>
                    )}
                    {reportFor === a.id && (
                      <CoachReportSheet
                        athlete={a}
                        spaceId={athleteSpaceId(a.id)}
                        notes={notes.items.filter(n => n.athleteId === a.id)}
                        coachLog={log.items.filter(e => e.athleteId === a.id)}
                        adherenceLine={adherence[a.id] ? adherenceLine(adherence[a.id]) : null}
                        onClose={() => setReportFor(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Мои программы: снял с одного — выдал пятерым, без повторной сборки */}
          <div style={cardStyle} data-coach="programs">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Мои программы</div>
                <div style={{ fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.45 }}>
                  {programs.items.length
                    ? `${programs.items.length} из ${COACH_PROGRAMS_MAX} · выдача заменяет программу атлета`
                    : 'Снимите программу с атлета и выдайте её другому — без повторной сборки блока.'}
                </div>
              </div>
              <label
                data-coach="program-import-label"
                style={{
                  ...btn('ghost'),
                  fontSize: 11.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: programFileBusy ? 'default' : 'pointer',
                  opacity: programFileBusy ? 0.6 : 1,
                }}
                title="Добавить программу из файла в «Мои программы» (атлета не трогает)"
              >
                {programFileBusy ? 'Читаем…' : 'Из файла'}
                <input
                  type="file"
                  accept=".json,application/json"
                  data-coach="program-import"
                  disabled={programFileBusy}
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null;
                    // Сбрасываем input: иначе повторный выбор того же файла не сработает.
                    e.target.value = '';
                    void importProgramFile(file);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {programNotice && (
              <div
                data-coach="program-notice"
                role="status"
                style={{ marginTop: 10, fontSize: 12, color: colors.green, lineHeight: 1.45 }}
              >
                {programNotice}
              </div>
            )}
            {programError && (
              <div
                data-coach="program-error"
                role="alert"
                style={{ marginTop: 10, fontSize: 12, color: colors.danger, lineHeight: 1.45 }}
              >
                {programError}
              </div>
            )}

            {programs.items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {programs.items.map(t => {
                  const d = describeProgramBundle(t.bundle);
                  return (
                    <div
                      key={t.id}
                      data-coach="program"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {renameProgramId === t.id ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            aria-label="Новое название программы"
                            data-coach="program-rename-input"
                            style={{ ...inputStyle, flex: '1 1 160px' }}
                          />
                          <button
                            type="button"
                            data-coach="program-rename-save"
                            onClick={() => saveProgramRename(t.id)}
                            style={{ ...btn('primary'), fontSize: 12 }}
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            data-coach="program-rename-cancel"
                            onClick={() => {
                              setRenameProgramId(null);
                              setRenameValue('');
                            }}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                            {d.keys} {plural(d.keys, 'план', 'плана', 'планов')} ·{' '}
                            {d.parts.slice(0, 3).join(', ')}
                            {d.parts.length > 3 ? ` +${d.parts.length - 3}` : ''}
                            {t.issuedCount > 0
                              ? ` · выдана ${t.issuedCount} ${plural(t.issuedCount, 'раз', 'раза', 'раз')}`
                              : ' · ещё не выдавалась'}
                            {t.sourceLabel ? ` · снята с «${t.sourceLabel}»` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              data-coach="program-issue"
                              onClick={() => startIssueTemplate(t)}
                              style={{ ...btn('primary'), fontSize: 12 }}
                            >
                              Выдать
                            </button>
                            <button
                              type="button"
                              data-coach="program-rename"
                              onClick={() => {
                                setRenameProgramId(t.id);
                                setRenameValue(t.name);
                                setProgramError(null);
                              }}
                              style={{ ...btn('ghost'), fontSize: 12 }}
                            >
                              Переименовать
                            </button>
                            <button
                              type="button"
                              data-coach="program-export"
                              onClick={() => void exportProgramFile(t)}
                              style={{ ...btn('ghost'), fontSize: 12 }}
                              title="Сохранить программу файлом — для передачи или бэкапа"
                            >
                              Файл
                            </button>
                            {confirmProgramDelete === t.id ? (
                              <>
                                <button
                                  type="button"
                                  data-coach="program-delete-confirm"
                                  onClick={() => deleteProgram(t.id)}
                                  style={{ ...btn('danger'), fontSize: 12 }}
                                >
                                  Точно удалить
                                </button>
                                <button
                                  type="button"
                                  data-coach="program-delete-cancel"
                                  onClick={() => setConfirmProgramDelete(null)}
                                  style={{ ...btn('ghost'), fontSize: 12 }}
                                >
                                  Оставить
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                data-coach="program-delete"
                                onClick={() => setConfirmProgramDelete(t.id)}
                                style={{ ...btn('ghost'), fontSize: 12 }}
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {issue && (
              <div
                data-coach="issue"
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: 'rgba(34,211,238,0.06)',
                  border: '1px solid rgba(34,211,238,0.25)',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>Выдать: {issue.title}</div>
                <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                  Отметьте, кому. Программа заменит текущую; дневники, вес, анализы и фото не тронем.
                </div>
                {state.athletes.length === 0 ? (
                  <div data-coach="issue-empty" style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
                    Сначала добавьте атлета выше.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    {state.athletes.map(a => (
                      <label
                        key={a.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          minHeight: 44,
                          fontSize: 12.5,
                          color: 'rgba(255,255,255,0.85)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={issuePick.has(a.id)}
                          onChange={() => toggleIssuePick(a.id)}
                          data-coach="issue-athlete"
                          style={{ width: 18, height: 18, accentColor: ACCENT }}
                        />
                        <span>{a.name}</span>
                        {issuePick.has(a.id) && (
                          <span style={{ fontSize: 10.5, color: colors.textMuted }}>заменит текущую</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {!issueConfirm ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      data-coach="issue-ask"
                      disabled={issuePick.size === 0}
                      onClick={() => setIssueConfirm(true)}
                      style={{ ...btn('primary'), fontSize: 12, opacity: issuePick.size ? 1 : 0.5 }}
                    >
                      Выдать выбранным ({issuePick.size})
                    </button>
                    <button
                      type="button"
                      data-coach="issue-close"
                      onClick={() => {
                        setIssue(null);
                        setIssuePick(new Set());
                      }}
                      style={{ ...btn('ghost'), fontSize: 12 }}
                    >
                      Закрыть
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      data-coach="issue-warning"
                      role="alert"
                      style={{ marginTop: 10, fontSize: 11.5, color: colors.warning, lineHeight: 1.45 }}
                    >
                      Точно заменить программу у выбранных ({issuePick.size})? Отменить это будет нельзя —
                      старую программу придётся собирать заново.
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        data-coach="issue-confirm"
                        onClick={doIssue}
                        style={{ ...btn('danger'), fontSize: 12 }}
                      >
                        Заменить и выдать
                      </button>
                      <button
                        type="button"
                        data-coach="issue-cancel"
                        onClick={() => setIssueConfirm(false)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        Отмена
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {issueDone && (
              <div
                data-coach="issue-done"
                role="status"
                style={{ marginTop: 10, fontSize: 12, color: colors.green, lineHeight: 1.45 }}
              >
                {issueDone}
              </div>
            )}
          </div>

          {/* Данные, у которых больше нет карточки: не даём им потеряться */}
          {orphanSpaces.length > 0 && (
            <div
              style={{ ...cardStyle, borderColor: 'rgba(251,191,36,0.35)' }}
              data-coach="orphans"
            >
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', color: '#fbbf24' }}>
                  <NativeIcon name="alertTriangle" size={14} />
                </span>
                Данные без карточки
              </div>
              <div
                data-coach="orphans-hint"
                style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 6, lineHeight: 1.5 }}
              >
                Карточку удалили, а данные остались на устройстве — так и задумано, стереть их
                случайно нельзя. Но если добавить атлета с тем же именем заново, это будет{' '}
                <strong>новое</strong> пространство: старые дневники и анализы останутся здесь.
              </div>
              {orphanSpaces.map(s => {
                const u = usage.get(s.id) ?? { keys: 0, bytes: 0 };
                return (
                  <div
                    key={s.id}
                    data-coach="orphan"
                    data-space-id={s.id}
                    style={{
                      marginTop: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', wordBreak: 'break-word' }}>
                      {s.label}
                    </div>
                    <div
                      data-coach="orphan-facts"
                      style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.45 }}
                    >
                      {u.keys > 0
                        ? 'свои данные: есть'
                        : 'ключей в настройках нет — записи могли быть только в базе'}
                      {s.lastOpenedAt ? ` · открывался ${fmtShort(s.lastOpenedAt.slice(0, 10))}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        data-coach="orphan-open"
                        onClick={() => openOrphanSpace(s.id)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        Открыть данные
                      </button>
                      <button
                        type="button"
                        data-coach="orphan-delete"
                        onClick={() => setConfirmOrphanId(confirmOrphanId === s.id ? null : s.id)}
                        style={{ ...btn('danger'), fontSize: 12 }}
                      >
                        Удалить данные
                      </button>
                      {confirmOrphanId === s.id && (
                        <>
                          <button
                            type="button"
                            data-coach="orphan-delete-confirm"
                            onClick={() => deleteOrphanData(s.id)}
                            style={{ ...btn('danger'), fontSize: 12 }}
                          >
                            Удалить навсегда
                          </button>
                          <button
                            type="button"
                            data-coach="orphan-delete-cancel"
                            onClick={() => setConfirmOrphanId(null)}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                          >
                            Оставить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Проверка диска: база может остаться без записи в реестре */}
          {state.athletes.length > 0 && (
            <div style={cardStyle} data-coach="disk-scan">
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', color: colors.textMuted }}>
                  <NativeIcon name="search" size={14} />
                </span>
                Базы на диске
              </div>
              <div
                data-coach="disk-scan-hint"
                style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 6, lineHeight: 1.5 }}
              >
                Проверка, нет ли на устройстве базы дневников и анализов, которая не привязана ни к одной
                карточке. Такое могло остаться после старых версий приложения — и тогда чужие данные лежат
                на телефоне, но нигде не видны.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-coach="disk-scan-run"
                  onClick={scanDisk}
                  disabled={scanBusy}
                  style={{ ...btn('ghost'), fontSize: 12, opacity: scanBusy ? 0.6 : 1 }}
                >
                  {scanBusy ? 'Проверяем…' : diskScan ? 'Проверить снова' : 'Проверить базы'}
                </button>
              </div>
              {diskScan?.unavailable && (
                <div
                  data-coach="disk-scan-unavailable"
                  style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 8, lineHeight: 1.5 }}
                >
                  Устройство не даёт список баз — проверить здесь нельзя. Это не значит, что лишних баз нет.
                </div>
              )}
              {diskScan && !diskScan.unavailable && dbOnlySpaces.length === 0 && (
                <div
                  data-coach="disk-scan-clean"
                  style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 8, lineHeight: 1.5 }}
                >
                  Баз без карточки нет — всё, что лежит на диске, привязано к людям в списке.
                </div>
              )}
              {dbOnlySpaces.map(id => (
                <div
                  key={id}
                  data-coach="disk-orphan"
                  data-space-id={id}
                  style={{
                    marginTop: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(239,68,68,0.28)',
                    background: 'rgba(239,68,68,0.06)',
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', wordBreak: 'break-all' }}>
                    {id}
                  </div>
                  <div style={{ fontSize: 10.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                    база есть, записи в реестре нет
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      data-coach="disk-orphan-delete"
                      onClick={() => setConfirmOrphanId(confirmOrphanId === id ? null : id)}
                      style={{ ...btn('danger'), fontSize: 12 }}
                    >
                      Удалить данные
                    </button>
                    {confirmOrphanId === id && (
                      <>
                        <button
                          type="button"
                          data-coach="disk-orphan-confirm"
                          onClick={() => deleteOrphanData(id)}
                          style={{ ...btn('danger'), fontSize: 12 }}
                        >
                          Удалить навсегда
                        </button>
                        <button
                          type="button"
                          data-coach="disk-orphan-cancel"
                          onClick={() => setConfirmOrphanId(null)}
                          style={{ ...btn('ghost'), fontSize: 12 }}
                        >
                          Оставить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Забыть всех: человек закончил с группой или отдаёт телефон */}
          {(showForgetDone || state.athletes.length > 0 || athleteSpaces.length > 0) && (
            <div
              style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.32)' }}
              data-coach="forget-all-card"
            >
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', color: colors.danger }}>
                  <NativeIcon name="alertTriangle" size={14} />
                </span>
                Забыть всех атлетов
              </div>
              {showForgetDone ? (
                <div
                  data-coach="forget-all-done"
                  style={{ fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 1.5 }}
                >
                  Данные атлетов удалены: пространства, базы, карточки, заметки, задачи и журнал.
                  Ваши собственные данные на месте.
                </div>
              ) : (
                <>
                  <div
                    data-coach="forget-all-hint"
                    style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 6, lineHeight: 1.5 }}
                  >
                    Удалит данные атлетов ({athleteSpaces.length}{' '}
                    {plural(athleteSpaces.length, 'пространство', 'пространства', 'пространств')}: профили,
                    дневники, планы, анализы, фото веса) вместе с карточками, заметками, задачами и журналом.
                    Ваши собственные данные останутся. Отменить это нельзя.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      data-coach="forget-all"
                      onClick={forgetAll}
                      disabled={forgetBusy}
                      style={{ ...btn('danger'), fontSize: 12, opacity: forgetBusy ? 0.6 : 1 }}
                    >
                      {forgetBusy
                        ? 'Удаляем…'
                        : confirmForgetAll
                          ? 'Точно забыть всех'
                          : 'Забыть всех атлетов'}
                    </button>
                    {confirmForgetAll && !forgetBusy && (
                      <button
                        type="button"
                        data-coach="forget-all-cancel"
                        onClick={() => setConfirmForgetAll(false)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        Оставить
                      </button>
                    )}
                  </div>
                  {forgetError && (
                    <div role="alert" data-coach="forget-all-error" style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                      {forgetError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Честная граница режима */}
          <div
            data-coach="boundary"
            style={{ fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.55, padding: '0 4px' }}
          >
            «Войти в его данные» переключает всё приложение в профиль этого атлета: у него свои
            профиль, дневники, планы, анализы и даже недописанные черновики — отдельное хранилище и
            отдельная база IndexedDB. Пока открыты данные атлета, сверху висит полоса с кнопкой
            возврата: это не украшение, а защита от правки чужого профиля по ошибке. Заметки, задачи и
            журнал тренера остаются общими для всех атлетов — как и сама вкладка: пока телефон в
            данных атлета, её видит тот, кто держит телефон, поэтому передавайте его, вернувшись к
            своим данным. Отдельных аккаунтов и доступа для самого атлета нет: данные живут на этом
            устройстве и в вашей синхронизации.
          </div>
        </>
      )}
    </div>
  );
};
