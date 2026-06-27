import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../core/db';

type Role = 'user' | 'coach' | 'doctor' | 'author' | 'editor' | 'admin';
type Status = 'active' | 'inactive' | 'pending';

interface HeUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: Status;
  lastLogin: string | null;
  notes: string;
  consentCoach: boolean;
  consentDoctor: boolean;
}

interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
}

const LS_USERS = 'he_users';
const LS_LOG = 'he_audit_log';
const LS_CURRENT = 'he_current_user_id';

const DEFAULT_USERS: HeUser[] = [
  {
    id: 'admin-001',
    email: 'admin@healthengine.ru',
    fullName: '',
    role: 'admin',
    status: 'active',
    lastLogin: new Date().toISOString(),
    notes: '',
    consentCoach: false,
    consentDoctor: false,
  },
];

const ROLE_LABELS: Record<Role, string> = {
  user: '',
  coach: '',
  doctor: '',
  author: '',
  editor: '',
  admin: '',
};

const STATUS_LABELS: Record<Status, string> = {
  active: '',
  inactive: '',
  pending: '',
};

const PERMISSIONS: Record<Role, string[]> = {
  user: ['', '', '', '', ''],
  coach: ['', '', ''],
  doctor: ['', '', ''],
  author: [''],
  editor: ['', ''],
  admin: ['', '', ''],
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function loadUsers(): HeUser[] {
  try {
    const raw = localStorage.getItem(LS_USERS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  localStorage.setItem(LS_USERS, JSON.stringify(DEFAULT_USERS));
  return [...DEFAULT_USERS];
}

function saveUsers(users: HeUser[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function loadLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(LS_LOG);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function appendLog(actor: string, action: string, detail: string) {
  const log = loadLog();
  log.unshift({ timestamp: new Date().toISOString(), actor, action, detail });
  localStorage.setItem(LS_LOG, JSON.stringify(log));
}

function getCurrentUserId(): string {
  return localStorage.getItem(LS_CURRENT) || 'admin-001';
}

export const RoleManagementScreen: React.FC = () => {
  const [users, setUsers] = useState<HeUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<HeUser | null>(null);
  const [tab, setTab] = useState<'users' | 'permissions' | 'log'>('users');
  const [addForm, setAddForm] = useState({ fullName: '', email: '', role: 'user' as Role });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    const loaded = loadUsers();
    setUsers(loaded);
    setAuditLog(loadLog());
    db.init().catch(() => {});
  }, []);

  const persistUsers = useCallback((next: HeUser[]) => {
    setUsers(next);
    saveUsers(next);
  }, []);

  const handleAddUser = () => {
    if (!addForm.fullName.trim() || !addForm.email.trim()) return;
    const newUser: HeUser = {
      id: generateId(),
      email: addForm.email.trim(),
      fullName: addForm.fullName.trim(),
      role: addForm.role,
      status: 'active',
      lastLogin: null,
      notes: '',
      consentCoach: false,
      consentDoctor: false,
    };
    const next = [...users, newUser];
    persistUsers(next);
    appendLog(getCurrentUserId(), 'ADD_USER', ``);
    setAuditLog(loadLog());
    setAddForm({ fullName: '', email: '', role: 'user' });
    setShowAddForm(false);
    db.put('users', newUser).catch(() => {});
  };

  const handleRoleChange = (userId: string, newRole: Role) => {
    const next = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    persistUsers(next);
    const target = next.find(u => u.id === userId);
    appendLog(getCurrentUserId(), 'ROLE_CHANGE', `${target?.fullName}: роль → ${ROLE_LABELS[newRole]}`);
    setAuditLog(loadLog());
    if (selectedUser?.id === userId) setSelectedUser(target || null);
  };

  const handleStatusChange = (userId: string, newStatus: Status) => {
    const next = users.map(u => u.id === userId ? { ...u, status: newStatus } : u);
    persistUsers(next);
    const target = next.find(u => u.id === userId);
    appendLog(getCurrentUserId(), 'STATUS_CHANGE', `${target?.fullName}: статус → ${STATUS_LABELS[newStatus]}`);
    setAuditLog(loadLog());
    if (selectedUser?.id === userId) setSelectedUser(target || null);
    db.put('users', target!).catch(() => {});
  };

  const handleConsentChange = (userId: string, field: 'consentCoach' | 'consentDoctor', value: boolean) => {
    const next = users.map(u => u.id === userId ? { ...u, [field]: value } : u);
    persistUsers(next);
    const target = next.find(u => u.id === userId);
    const label = field === 'consentCoach' ? 'тренеру' : '';
    appendLog(getCurrentUserId(), 'CONSENT_CHANGE', `${target?.fullName}: доступ ${label} → ${value ? 'разрешён' : ''}`);
    setAuditLog(loadLog());
    if (selectedUser?.id === userId) setSelectedUser(target || null);
    db.put('users', target!).catch(() => {});
  };

  const handleSaveNotes = (userId: string) => {
    const next = users.map(u => u.id === userId ? { ...u, notes: editNotes } : u);
    persistUsers(next);
    const target = next.find(u => u.id === userId);
    if (selectedUser?.id === userId) setSelectedUser(target || null);
    db.put('users', target!).catch(() => {});
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === getCurrentUserId()) return;
    const target = users.find(u => u.id === userId);
    const next = users.filter(u => u.id !== userId);
    persistUsers(next);
    appendLog(getCurrentUserId(), 'DELETE_USER', ``);
    setAuditLog(loadLog());
    if (selectedUser?.id === userId) setSelectedUser(null);
    db.delete('users', userId).catch(() => {});
  };

  const openEdit = (user: HeUser) => {
    setSelectedUser(user);
    setEditNotes(user.notes);
  };

  const currentUserId = getCurrentUserId();

  return (
    <div className="screen role-management">
      <div className="role-management-header">
        <h2>Управление ролями и правами доступа</h2>
        <p>Настройка ролей пользователей и их прав доступа к функционалу системы</p>
        <div className="role-management-actions">
          <button className="btn" onClick={() => { setShowAddForm(true); setSelectedUser(null); }}>
            Добавить пользователя
          </button>
        </div>
      </div>

      <div className="role-management-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Пользователи</button>
        <button className={tab === 'permissions' ? 'active' : ''} onClick={() => setTab('permissions')}>Роли и разрешения</button>
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>Журнал действий</button>
      </div>

      {showAddForm && (
        <div className="add-user-form">
          <h3>Новый пользователь</h3>
          <div className="form-row">
            <label>ФИО<input value={addForm.fullName} onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))} /></label>
            <label>Email<input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></label>
            <label>Роль
              <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value as Role }))}>
                {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={handleAddUser}>Добавить</button>
            <button className="btn secondary" onClick={() => setShowAddForm(false)}>Отмена</button>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="user-details-panel">
          <h3>Редактирование: {selectedUser.fullName}</h3>
          <div className="user-info">
            <p><strong>Email:</strong> {selectedUser.email}</p>
            <p><strong>ФИО:</strong> {selectedUser.fullName}</p>
            <p><strong>Последний вход:</strong> {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : ''}</p>
          </div>

          <div className="role-editor">
            <h4>Роль пользователя</h4>
            <div className="role-options">
              {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
                <label key={r}>
                  <input type="radio" name="role" checked={selectedUser.role === r} onChange={() => handleRoleChange(selectedUser.id, r)} />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </div>

          <div className="status-editor">
            <h4>Статус учётной записи</h4>
            <div className="status-options">
              {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
                <label key={s}>
                  <input type="radio" name="status" checked={selectedUser.status === s} onChange={() => handleStatusChange(selectedUser.id, s)} />
                  {STATUS_LABELS[s]}
                </label>
              ))}
            </div>
          </div>

          <div className="consent-editor">
            <h4>Согласия на доступ</h4>
            <label className="toggle-row">
              <input type="checkbox" checked={selectedUser.consentCoach} onChange={e => handleConsentChange(selectedUser.id, 'consentCoach', e.target.checked)} />
              Разрешить доступ тренеру
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={selectedUser.consentDoctor} onChange={e => handleConsentChange(selectedUser.id, 'consentDoctor', e.target.checked)} />
              Разрешить доступ врачу
            </label>
          </div>

          <div className="notes-editor">
            <h4>Заметки</h4>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
            <button className="btn secondary" onClick={() => handleSaveNotes(selectedUser.id)}>Сохранить заметки</button>
          </div>

          <div className="user-actions">
            {selectedUser.id !== currentUserId && (
              <button className="btn danger" onClick={() => handleDeleteUser(selectedUser.id)}>Удалить пользователя</button>
            )}
            <button className="btn secondary" onClick={() => setSelectedUser(null)}>Закрыть</button>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="users-list">
          <div className="users-table-header">
            <div>Email</div>
            <div>ФИО</div>
            <div>Роль</div>
            <div>Статус</div>
            <div>Доступ</div>
            <div>Действия</div>
          </div>
          <div className="users-table-body">
            {users.map(user => (
              <div key={user.id} className="user-row" onClick={() => openEdit(user)}>
                <div className="user-email">{user.email}</div>
                <div className="user-fullname">{user.fullName}</div>
                <div className="user-role">
                  <span className={`role-badge ${user.role}`}>{ROLE_LABELS[user.role]}</span>
                </div>
                <div className="user-status">
                  <span className={`status-badge ${user.status}`}>{STATUS_LABELS[user.status]}</span>
                </div>
                <div className="user-consent">
                  {user.consentCoach && ''}
                  {user.consentDoctor && ''}
                  {!user.consentCoach && !user.consentDoctor && '—'}
                </div>
                <div className="user-actions">
                  <button className="btn-icon" title="" onClick={e => { e.stopPropagation(); openEdit(user); }}>✏️</button>
                  {user.id !== currentUserId && (
                    <button className="btn-icon" title="" onClick={e => { e.stopPropagation(); handleDeleteUser(user.id); }}>🗑️</button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && <div className="empty-state"><p>Пользователи не найдены.</p></div>}
          </div>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="permissions-matrix">
          <h3>Матрица прав доступа (ТЗ 21)</h3>
          <table>
            <thead>
              <tr>
                <th>Роль</th>
                <th>Возможности</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Role[]).map(role => (
                <tr key={role}>
                  <td><span className={`role-badge ${role}`}>{ROLE_LABELS[role]}</span></td>
                  <td>
                    <ul>
                      {(PERMISSIONS[role] || []).map(p => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'log' && (
        <div className="audit-log">
          <h3>Журнал действий</h3>
          {auditLog.length === 0 && <p>Нет записей.</p>}
          <table>
            <thead>
              <tr>
                <th>Время</th>
                <th>Действие</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry, i) => (
                <tr key={i}>
                  <td>{new Date(entry.timestamp).toLocaleString()}</td>
                  <td>{entry.action}</td>
                  <td>{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};