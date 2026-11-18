// Made-up demo data, pinned to Tue 17 Nov 2026 20:00 so tests and the demo give stable answers.
import type { UserData } from '../state.ts';

export const NOW = new Date(2026, 10, 17, 20, 0).getTime();
const at = (day: number, h: number, min = 0) => new Date(2026, 10, day, h, min).getTime();
const sets = (kg: number, reps: number, n: number) => Array.from({ length: n }, () => ({ type: 'normal', kg, reps, done: true }));
const workout = (id: string, day: number, items: [string, number, number, number][]) => ({
  id, start: at(day, 19), end: at(day, 20), name: id, prs: [],
  items: items.map(([exId, kg, reps, n]) => ({ exId, group: null, target: null, sets: sets(kg, reps, n) })),
});

export const demoUser: UserData = {
  profile: { weightKg: 72, heightCm: 175 },
  strength: {
    settings: { weeklyGoal: 3 },
    planOpts: { goal: 'hypertrophy', exp: 'intermediate', days: 3, equip: ['barbell', 'dumbbell', 'machine', 'cable'], pain: [] },
    workouts: [
      workout('w1', 9, [['bench_bb', 60, 8, 4], ['row_bb', 50, 8, 4]]),
      workout('w2', 11, [['squat_bb', 80, 6, 4], ['leg_curl', 30, 12, 3]]),
      workout('w3', 13, [['ohp_bb', 35, 8, 4], ['pulldown', 45, 10, 3]]),
      workout('w4', 16, [['bench_bb', 62.5, 8, 4], ['incline_db', 20, 10, 3]]),
      workout('w5', 17, [['squat_bb', 82.5, 6, 4]]),
    ],
  },
  walks: [
    { start: at(10, 7), distM: 3200, activeSec: 2400 },
    { start: at(14, 9), distM: 5100, activeSec: 3900 },
    { start: at(16, 7), distM: 3000, activeSec: 2200 },
    { start: at(17, 12, 30), distM: 2400, activeSec: 1800 },
  ],
  steps: { '2026-11-17': 6812 },
};
