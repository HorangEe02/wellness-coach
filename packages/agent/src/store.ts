// Per-device user records in SQLite (node:sqlite, no dependency). One JSON document per user, same shape as UserData.
// The DB lives in the Linux home when the server runs in WSL: SQLite locking is unreliable on /mnt/c.
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { UserData } from './state.ts';

export type Store = { get(id: string): UserData; save(id: string, u: UserData): void };

export const DEFAULT_DB = join(homedir(), '.local', 'share', 'wellness-agent', 'wellness.db');

// shortcut: body size is a placeholder until a profile screen exists; walk kcal and step estimates use it.
export const emptyUser = (): UserData => ({
  profile: { weightKg: 65, heightCm: 170 },
  strength: {
    settings: { weeklyGoal: 3 },
    planOpts: { goal: 'hypertrophy', exp: 'beginner', days: 3, equip: ['barbell', 'dumbbell', 'machine', 'cable'], pain: [] },
    workouts: [],
  },
  walks: [],
  steps: {},
});

export function openStore(path = process.env.DB_PATH ?? DEFAULT_DB): Store {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)');
  const sel = db.prepare('SELECT data FROM users WHERE id = ?');
  const put = db.prepare('INSERT INTO users (id, data, updated) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated');
  return {
    get(id) {
      const row = sel.get(id) as { data: string } | undefined;
      return row ? { ...emptyUser(), ...JSON.parse(row.data) } : emptyUser();
    },
    save(id, u) { put.run(id, JSON.stringify(u), Date.now()); },
  };
}
