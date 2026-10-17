import { describe, it, expect, beforeEach } from 'vitest';
import { runStorageMigrations } from '../storage-migration';

describe('storage-migration', () => {
  beforeEach(() => { localStorage.clear(); });

  it('переносит legacy he_workout_log в he_workout_log_v2', () => {
    localStorage.setItem('he_workout_log', '[{"id":"a"}]');
    runStorageMigrations();
    expect(localStorage.getItem('he_workout_log_v2')).toBe('[{"id":"a"}]');
    expect(localStorage.getItem('he_storage_migration_version')).toBe('1');
  });

  it('не затирает существующий v2', () => {
    localStorage.setItem('he_workout_log', '[{"id":"old"}]');
    localStorage.setItem('he_workout_log_v2', '[{"id":"new"}]');
    runStorageMigrations();
    expect(localStorage.getItem('he_workout_log_v2')).toBe('[{"id":"new"}]');
  });

  it('идемпотентна', () => {
    runStorageMigrations();
    runStorageMigrations();
    expect(localStorage.getItem('he_storage_migration_version')).toBe('1');
  });
});
