// Run: node core.test.js
const assert = require('assert');
const C = require('../strength.core.js');
const byId = Object.fromEntries(C.EXERCISES.map(e => [e.id, e]));
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const S = (kg, reps, type = 'normal', done = true) => ({ type, kg, reps, done });
const W = (id, start, items, min = 60) => ({ id, start, end: start + min * 60000, name: id, items, prs: [] });
const H = 36e5, DAY = 864e5, T0 = new Date(2026, 10, 2, 18, 0).getTime(); // Mon 2 Nov 2026 18:00

// Library sanity: unique ids, known muscles/equipment/joints, ~80 entries.
assert.ok(C.EXERCISES.length >= 75, C.EXERCISES.length);
assert.strictEqual(new Set(C.EXERCISES.map(e => e.id)).size, C.EXERCISES.length);
for (const e of C.EXERCISES) {
  for (const m of [...e.primary, ...e.secondary]) assert.ok(C.MUSCLES[m], `${e.id}: ${m}`);
  for (const j of e.joints) assert.ok(C.JOINTS[j], `${e.id}: ${j}`);
  assert.ok(C.EQUIP[e.equip] && C.KINDS[e.kind] && e.met > 0, e.id);
}

// 1RM: Epley and Brzycki, 1 rep = the weight, over 12 reps not estimated.
near(C.e1rm(100, 5), 100 * (1 + 5 / 30));
near(C.e1rm(100, 5, 'brzycki'), 100 * 36 / 32);
assert.strictEqual(C.e1rm(100, 1), 100);
assert.strictEqual(C.e1rm(100, 13), 0);
assert.strictEqual(C.e1rm(0, 5), 0);

// PRs: warm-ups and unfinished sets never count, first-time lifts do; reps-at-weight needs an earlier set at that weight.
const w1 = W('a', T0, [{ exId: 'bench_bb', group: null, sets: [S(20, 10, 'warmup'), S(60, 5), S(60, 5)] }]);
let prs = C.detectPRs([], w1, byId);
assert.deepStrictEqual(prs, [], 'the first log of an exercise is the baseline, not a PR');
const w2 = W('b', T0 + DAY, [{ exId: 'bench_bb', group: null, sets: [S(140, 1, 'warmup'), S(60, 7), S(200, 1, 'normal', false)] }]);
prs = C.detectPRs([w1], w2, byId);
assert.ok(!prs.some(p => p.type === 'weight'), 'a heavy warm-up or an unfinished set is not a weight PR');
assert.deepStrictEqual(prs.find(p => p.type === 'reps'), { exId: 'bench_bb', type: 'reps', value: 7, kg: 60 });
assert.deepStrictEqual(C.detectPRs([w1], W('hv', T0 + DAY, [{ exId: 'bench_bb', sets: [S(65, 5)] }]), byId).map(p => p.type).sort(), ['e1rm', 'volume', 'weight']);
assert.ok(prs.some(p => p.type === 'e1rm') && prs.some(p => p.type === 'volume'));
assert.deepStrictEqual(C.detectPRs([w1, w2], W('c', T0 + 2 * DAY, [{ exId: 'bench_bb', sets: [S(50, 5)] }]), byId), []);
// Volume excludes warm-ups.
assert.strictEqual(C.workoutVolume(w1), 600);
// Bodyweight rep exercise: most reps.
const pu = W('p', T0, [{ exId: 'pushup', sets: [{ type: 'normal', reps: 20, done: true }] }]);
assert.deepStrictEqual(C.detectPRs([], pu, byId), []);
assert.deepStrictEqual(C.detectPRs([pu], W('p2', T0 + DAY, [{ exId: 'pushup', sets: [{ type: 'normal', reps: 21, done: true }] }]), byId).map(p => p.type), ['reps']);
// Previous sets for prefilling come from the latest workout with that exercise.
assert.deepStrictEqual(C.prevSets([w2, w1], 'bench_bb').map(s => s.kg), [140, 60, 200]);
assert.ok(C.prevSets([w1], 'bench_bb').every(s => !s.done));
assert.strictEqual(C.prevSets([w1], 'squat_bb'), null);

// Warm-up generator.
assert.deepStrictEqual(C.warmupSets(100, { bar: 20, step: 2.5 }), [{ kg: 20, reps: 10 }, { kg: 40, reps: 5 }, { kg: 60, reps: 3 }, { kg: 80, reps: 2 }]);
assert.deepStrictEqual(C.warmupSets(40, { bar: 20, step: 2.5 }), [{ kg: 20, reps: 10 }, { kg: 25, reps: 3 }, { kg: 32.5, reps: 2 }]);
assert.deepStrictEqual(C.warmupSets(20, { bar: 20 }), []);

// Plate calculator: fewest plates per side, works for non-greedy plate sets, reports what can't be loaded.
const KG = [25, 20, 15, 10, 5, 2.5, 1.25];
assert.deepStrictEqual(C.platesFor(100, 20, KG), { side: [25, 15], loaded: 100, remainder: 0 });
assert.deepStrictEqual(C.platesFor(62.5, 20, KG), { side: [20, 1.25], loaded: 62.5, remainder: 0 });
assert.deepStrictEqual(C.platesFor(60, 20, [15, 10]), { side: [10, 10], loaded: 60, remainder: 0 });
assert.deepStrictEqual(C.platesFor(21, 20, KG), { side: [], loaded: 20, remainder: 1 }); // impossible: 0.5 kg a side
assert.deepStrictEqual(C.platesFor(103, 20, KG), { side: [25, 15, 1.25], loaded: 102.5, remainder: 0.5 });
assert.deepStrictEqual(C.platesFor(15, 20, KG), { side: [], loaded: 20, remainder: -5 });
assert.deepStrictEqual(C.platesFor(135, 45, [45, 35, 25, 10, 5, 2.5]), { side: [45], loaded: 135, remainder: 0 });

// Rest and supersets: rest only after the last exercise of a group.
assert.strictEqual(C.defaultRest(byId.squat_bb, 'strength'), 180);
assert.strictEqual(C.defaultRest(byId.curl_db, 'hypertrophy'), 75);
const items = [{ exId: 'a', group: 'g1' }, { exId: 'b', group: 'g1' }, { exId: 'c', group: null }];
assert.deepStrictEqual([0, 1, 2].map(i => C.restAfter(items, i)), [false, true, true]);

// Progressive overload rule.
const ov = (sets, id, o) => C.overload(sets, byId[id], { upperInc: 2.5, lowerInc: 5, ...o });
assert.deepStrictEqual(ov([S(20, 10, 'warmup'), S(60, 5), S(60, 5)], 'bench_bb', { target: 5 }), { action: 'weight', kg: 62.5, reps: 5 });
assert.deepStrictEqual(ov([S(100, 5), S(100, 5)], 'squat_bb', { target: 5 }), { action: 'weight', kg: 105, reps: 5 });
assert.deepStrictEqual(ov([S(60, 5), S(60, 4)], 'bench_bb', { target: 5 }), { action: 'keep', kg: 60, reps: 5 });
assert.deepStrictEqual(ov([S(60, 8), S(60, 8)], 'bench_bb'), { action: 'weight', kg: 62.5, reps: 8 }); // target = first set's reps
assert.deepStrictEqual(ov([{ type: 'normal', reps: 12, done: true }], 'pushup', { target: 12 }), { action: 'reps', kg: 0, reps: 13 });
assert.strictEqual(ov([S(20, 10, 'warmup')], 'bench_bb'), null);

// Split plan: day count → split, equipment filter, pain filter removes exercises using that joint.
let plan = C.genPlan({ goal: 'strength', exp: 'intermediate', days: 4, equip: ['barbell', 'dumbbell', 'machine', 'cable'], pain: [] }, C.EXERCISES);
assert.strictEqual(plan.days.length, 4);
assert.deepStrictEqual(plan.days.map(d => d.focus), ['upper', 'lower', 'upper', 'lower']);
assert.ok(plan.days.every(d => d.items.length === 5));
assert.notDeepStrictEqual(plan.days[0].items.map(i => i.exId), plan.days[2].items.map(i => i.exId), 'second upper day varies');
const squatItem = plan.days[1].items.find(i => !byId[i.exId].iso);
assert.deepStrictEqual([squatItem.sets, squatItem.reps], [5, 5]);
plan = C.genPlan({ goal: 'hypertrophy', exp: 'beginner', days: 3, equip: ['barbell', 'dumbbell', 'machine', 'cable'], pain: ['knee', 'shoulder'] }, C.EXERCISES);
const used = plan.days.flatMap(d => d.items.map(i => byId[i.exId]));
assert.ok(used.length > 0 && used.every(ex => !ex.joints.includes('knee') && !ex.joints.includes('shoulder')));
assert.ok(plan.excluded.includes('squat_bb') && plan.excluded.includes('bench_bb'));
plan = C.genPlan({ goal: 'endurance', exp: 'beginner', days: 2, equip: [], pain: [] }, C.EXERCISES);
assert.ok(plan.days.every(d => d.items.every(i => byId[i.exId].equip === 'bodyweight')));
assert.ok(plan.days.every(d => byId[d.items.at(-1).exId].kind === 'time' || byId[d.items.at(-1).exId].kind === 'reps'));
assert.strictEqual(C.splitFor(3, 'advanced')[1].join(), 'push,pull,legs');

// Programs: linear progression and the 4-week wave.
assert.deepStrictEqual(C.linearNext([], 40, 2.5), { kg: 40, why: 'start' });
assert.deepStrictEqual(C.linearNext([[S(40, 5), S(40, 5), S(40, 5)]], 40, 2.5), { kg: 42.5, why: 'up' });
assert.deepStrictEqual(C.linearNext([[S(50, 5)], [S(52.5, 4)]], 40, 2.5), { kg: 52.5, why: 'repeat' });
assert.deepStrictEqual(C.linearNext([[S(52.5, 4)], [S(52.5, 3)], [S(52.5, 4)]], 40, 2.5), { kg: 47.5, why: 'deload' });
assert.deepStrictEqual(C.waveSets(100, 1).map(s => s.kg), [70, 75, 80]);
assert.deepStrictEqual(C.waveSets(100, 3).map(s => [s.kg, s.reps]), [[80, 3], [85, 3], [90, 3]]);
const lifts = [{ id: 'squat_bb', lower: true }, { id: 'bench_bb', lower: false }];
let wp = { week: 4, day: 1, cycle: 1, tm: { squat_bb: 100, bench_bb: 80 } };
wp = C.waveAdvance(wp, lifts, 2.5, 5);
assert.deepStrictEqual(wp, { week: 1, day: 0, cycle: 2, tm: { squat_bb: 105, bench_bb: 82.5 } });
assert.deepStrictEqual(C.waveAdvance(wp, lifts, 2.5, 5), { week: 1, day: 1, cycle: 2, tm: { squat_bb: 105, bench_bb: 82.5 } });

// Weekly sets per muscle and recovery (어림).
const wr = W('r', T0, [{ exId: 'bench_bb', sets: [S(60, 5), S(60, 5), S(60, 5), S(60, 5), S(60, 5), S(60, 5), S(20, 10, 'warmup')] }], 0);
const ms = C.muscleSets([wr], C.weekStart(T0), Infinity, byId);
assert.strictEqual(ms.chest, 6); assert.strictEqual(ms.triceps, 3); assert.strictEqual(ms.quads, 0);
let rec = C.recovery([wr], T0 + 24 * H, byId);
assert.strictEqual(rec.chest, 33);   // 24 h of 72 h
assert.strictEqual(rec.triceps, 100); // 3 sets → 0.5 × 48 h = 24 h
assert.strictEqual(rec.quads, 100);
assert.strictEqual(C.recovery([wr], T0 + 8 * DAY, byId).chest, 100);

// Score and grade.
const big = W('s', T0, [{ exId: 'bench_bb', sets: Array.from({ length: 20 }, () => S(60, 5)) }], 60);
assert.deepStrictEqual(C.workoutScore(big), { score: 100, grade: 'S', sets: 20, min: 60 });
const half = W('h', T0, [{ exId: 'bench_bb', sets: [S(60, 5), S(60, 5), S(60, 5, 'normal', false), S(60, 5, 'normal', false)] }], 15);
assert.deepStrictEqual(C.workoutScore(half), { score: 32, grade: 'D', sets: 2, min: 15 }); // 6.67 + 10 + 15

// Streak and summaries (Monday weeks).
const mon = d => new Date(2026, 10, d, 9).getTime();
const ws = [mon(2), mon(3), mon(4), mon(9), mon(10), mon(11), mon(16)].map((t, i) => W('x' + i, t, [{ exId: 'squat_bb', sets: [S(100, 5)] }]));
assert.deepStrictEqual(C.streak(ws, 3, mon(18)), { weeks: 2, thisWeek: 1 });
assert.deepStrictEqual(C.streak(ws, 1, mon(18)), { weeks: 3, thisWeek: 1 });
const sum = C.summary(ws, 'week', mon(12), byId, { goal: 3 });
assert.strictEqual(sum[0], '이번 주 3번 운동했어요. 주간 목표 3번을 채웠어요.');
assert.ok(sum.includes('총 볼륨은 1,500kg으로 지난주와 비슷해요.'), sum);
assert.ok(sum.some(s => s.startsWith('가장 많이 운동한 부위는')));
assert.deepStrictEqual(C.summary([], 'month', mon(12), byId), ['이번 달에는 아직 운동 기록이 없어요.']);

// CSV round trip (our own format), including a custom exercise, supersets, drop sets and awkward names.
const custom = { id: 'c_myrow', name: '내 "특수" 로우, 변형', primary: ['lats'], secondary: [], equip: 'other', kind: 'weight', met: 5, joints: [], iso: false, custom: true };
const lib = [...C.EXERCISES, custom], libById = { ...byId, c_myrow: custom };
const orig = [
  { id: 'w1', start: new Date(2026, 10, 2, 7, 30).getTime(), end: new Date(2026, 10, 2, 8, 15).getTime(), name: '=위험한 이름', prs: [], items: [
    { exId: 'bench_bb', group: 'g1', target: null, sets: [S(20, 10, 'warmup'), S(62.5, 5), { type: 'drop', kg: 40, reps: 8, rpe: 9, done: true }] },
    { exId: 'c_myrow', group: 'g1', target: null, sets: [S(30, 12)] }] },
  { id: 'w2', start: new Date(2026, 10, 3, 19, 0).getTime(), end: new Date(2026, 10, 3, 19, 20).getTime(), name: '유산소', prs: [], items: [
    { exId: 'run', group: null, target: null, sets: [{ type: 'normal', m: 3000, sec: 1080, done: true }] }] },
];
const csv = C.toCSV(orig, libById);
assert.ok(csv.includes("'=위험한 이름"), 'formula-like text is neutralised');
let imp = C.importCSV(csv, lib);
assert.strictEqual(imp.skipped, 0);
assert.deepStrictEqual(imp.exercises, []);
const strip = ws => ws.map(w => ({ ...w, name: w.name.replace(/^'/, '') }));
assert.deepStrictEqual(strip(imp.workouts), orig);
// Re-importing the same file adds nothing.
assert.strictEqual(C.importCSV(csv, lib, new Set(['w1', 'w2'])).workouts.length, 0);
// Custom exercise missing on the importing side keeps its id.
imp = C.importCSV(csv, C.EXERCISES);
assert.deepStrictEqual(imp.exercises.map(e => [e.id, e.name]), [['c_myrow', custom.name]]);

// Generic "date, exercise, weight, reps" CSV (header in Korean or none; lb converted).
imp = C.importCSV('날짜,종목,무게,횟수\n2026-11-01,바벨 벤치프레스,60,5\n2026-11-01,바벨 벤치프레스,60,5\n2026-11-01,케이블 이상한 운동,10,15\nbad,row,1,1\n', C.EXERCISES);
assert.strictEqual(imp.workouts.length, 1); assert.strictEqual(imp.skipped, 1);
assert.deepStrictEqual(imp.workouts[0].items.map(i => [i.exId, i.sets.length]), [['bench_bb', 2], [imp.exercises[0].id, 1]]);
imp = C.importCSV('2026/11/01,squat_bb,100,5\n2026.11.02,squat_bb,105,5\n', C.EXERCISES);
assert.deepStrictEqual(imp.workouts.map(w => w.items[0].sets[0].kg), [100, 105]);
imp = C.importCSV('Date,Exercise,Weight (lbs),Reps\n2026-11-01 08:00,deadlift,225,5\n', C.EXERCISES);
near(imp.workouts[0].items[0].sets[0].kg, 102.058, 1e-3);
const imp2 = C.importCSV('Date,Exercise,Weight (lbs),Reps\n2026-11-01 08:00,deadlift,225,5\n2026-11-03 08:00,deadlift,235,5\n', C.EXERCISES);
const rp = C.recomputePRs(imp2.workouts, byId);
assert.deepStrictEqual(rp[0].prs, []);
assert.ok(rp[1].prs.some(p => p.type === 'weight'));

// Hostile CSV: huge, many rows, many columns, unclosed quote, quote storms — all finish fast or throw a clear error.
let t = Date.now();
assert.throws(() => C.parseCSV('a,'.repeat(1.5e6)), /너무/);
assert.throws(() => C.parseCSV('"' + 'x'.repeat(1000)), /긴 칸/);
assert.throws(() => C.parseCSV('1\n'.repeat(60000)), /줄이 너무/);
assert.throws(() => C.parseCSV(','.repeat(100)), /열이 너무/);
assert.deepStrictEqual(C.parseCSV('"a""b",c\n"unclosed'), [['a"b', 'c'], ['unclosed']]);
const storm = ('"",'.repeat(30) + '\n').repeat(20000);
assert.strictEqual(C.importCSV(storm.slice(0, 1.9e6), C.EXERCISES).workouts.length, 0);
assert.strictEqual(C.importCSV('', C.EXERCISES).workouts.length, 0);
assert.ok(C.parseDate('9'.repeat(400)) === null);
assert.ok(Date.now() - t < 2000, `hostile CSV took ${Date.now() - t} ms`);

// Storage migration: unversioned data is upgraded, junk is dropped, defaults filled.
assert.deepStrictEqual(C.migrate(null), C.defaults());
assert.deepStrictEqual(C.migrate('oops'), C.defaults());
const m = C.migrate({ settings: { unit: 'lb' }, workouts: [
  { date: '2026-11-01', items: [{ exId: 'bench_bb', sets: [{ kg: 20, reps: 10, warmup: true }, { kg: 60, reps: 5 }] }] },
  { start: 'nope', items: 3 }, null, 7] });
assert.strictEqual(m.v, C.SCHEMA);
assert.strictEqual(m.settings.unit, 'lb'); assert.strictEqual(m.settings.bar, 20);
assert.strictEqual(m.workouts.length, 1);
assert.deepStrictEqual(m.workouts[0].items[0].sets.map(s => [s.type, s.done]), [['warmup', true], ['normal', true]]);
assert.strictEqual(m.workouts[0].id, 'w' + m.workouts[0].start);
const cur = C.migrate({ v: 1, workouts: [], live: { start: 'bad' }, rest: 5, settings: { plates: 'x' } });
assert.strictEqual(cur.live, null); assert.deepStrictEqual(cur.rest, {}); assert.deepStrictEqual(cur.settings.plates, C.defaults().settings.plates);
assert.deepStrictEqual(C.migrate(JSON.parse(JSON.stringify(m))), m, 'migrating current data is a no-op');

// Units.
near(C.toUnit(C.fromUnit(225, 'lb'), 'lb'), 225);
assert.strictEqual(C.workoutKcal(5, 70, 60), 368);

// ---------- v1 review fixes ----------
// I3: drop / failure sets don't block progression (overload and linear progression).
assert.deepStrictEqual(ov([S(100, 5), S(100, 5), S(60, 3, 'drop')], 'squat_bb', { target: 5 }), { action: 'weight', kg: 105, reps: 5 });
assert.deepStrictEqual(ov([S(60, 5), S(70, 2, 'failure')], 'bench_bb', { target: 5 }), { action: 'weight', kg: 62.5, reps: 5 });
assert.deepStrictEqual(C.linearNext([[S(40, 5), S(40, 5), S(25, 3, 'drop')]], 40, 2.5), { kg: 42.5, why: 'up' });
assert.deepStrictEqual(C.linearNext([[S(40, 5)], [S(20, 2, 'failure')]], 40, 2.5), { kg: 42.5, why: 'up' }, 'a session with only a failure set is skipped');

// I1 + M10: null / garbage sets and fields are repaired or dropped, in v1 and v0 shapes.
let mg = C.migrate({ v: 1, workouts: [{ id: 'w1', start: T0, items: [{ exId: 'squat_bb', sets: [null, 7, 'x', { kg: '100', reps: 5, rpe: 99, type: 'weird' }] }, { exId: 'bench_bb', sets: [null] }, null, { exId: 3 }] }] });
assert.deepStrictEqual(mg.workouts[0].items, [{ exId: 'squat_bb', group: null, target: null, sets: [{ type: 'normal', done: true, kg: 100, reps: 5, rpe: 10 }] }]);
assert.doesNotThrow(() => C.workoutScore(mg.workouts[0]));
mg = C.migrate({ workouts: [{ date: '2024-01-01', items: [{ exId: 'a', sets: [null] }, null] }, { date: 'nope' }, { date: '2024-01-02', items: 'x' }] });
assert.strictEqual(mg.workouts.length, 0, 'workouts left with no valid sets are dropped');
mg = C.migrate({ v: 1, settings: { weeklyGoal: 0, bodyKg: 'heavy', unit: 'stone', plates: [20, -5, 'x', 20] }, live: { start: T0, items: [{ exId: 'squat_bb', sets: [null, { kg: 50, reps: 5 }] }], rest: { end: 'x' } },
  customEx: [{ id: 'c1', name: 'x', kind: 'nope', primary: ['bogus', 'chest'] }, { id: 5 }], body: [{ date: '2026-11-01', kg: '70', sites: { waist: 'a', hip: 90 } }, { date: 3 }],
  program: { kind: 'wave', tm: { squat_bb: '100' }, week: 9 }, plan: { days: [null, { name: 'A', items: [{ exId: 'squat_bb', sets: 'x', reps: 5 }, 3] }], next: 7 } });
assert.deepStrictEqual([mg.settings.weeklyGoal, mg.settings.bodyKg, mg.settings.unit, mg.settings.plates], [3, 70, 'kg', [20]]);
assert.deepStrictEqual(mg.live.items[0].sets, [{ type: 'normal', done: false, kg: 50, reps: 5 }]); assert.strictEqual(mg.live.rest, null);
assert.deepStrictEqual(mg.customEx, [{ id: 'c1', name: 'x', primary: ['chest'], secondary: [], equip: 'other', kind: 'weight', met: 5, joints: [], iso: false, custom: true }]);
assert.deepStrictEqual(mg.body, [{ date: '2026-11-01', kg: 70, sites: { hip: 90 } }]);
assert.deepStrictEqual(mg.program, { kind: 'wave', tm: { squat_bb: 100 }, week: 1, day: 0, cycle: 1 });
assert.deepStrictEqual([mg.plan.days.length, mg.plan.days[0].items, mg.plan.next], [1, [{ exId: 'squat_bb', sets: 3, reps: 5, sec: null }], 0]);
assert.strictEqual(C.streak([], 0).weeks, 0);
// M11: newer data is detected so the app won't save over it.
assert.ok(C.isNewer({ v: C.SCHEMA + 1 }) && !C.isNewer({ v: C.SCHEMA }) && !C.isNewer(null));

// I5: v0 workouts on the same date get distinct ids.
const one = [{ exId: 'squat_bb', sets: [{ kg: 80, reps: 5 }] }];
mg = C.migrate({ workouts: [{ date: '2024-01-01', items: one }, { date: '2024-01-01', items: one }, { id: 'dup', start: 1, items: one }, { id: 'dup', start: 2, items: one }] });
assert.strictEqual(mg.workouts.length, 4);
assert.strictEqual(new Set(mg.workouts.map(w => w.id)).size, 4);

// C1: revision check refuses a stale save.
const st0 = C.defaults();
let ps = C.prepareSave(null, st0);
assert.strictEqual(ps.rev, 1); assert.strictEqual(JSON.parse(ps.json).rev, 1);
const tabA = { ...st0, rev: 1 }, tabB = { ...st0, rev: 1 };
const afterA = C.prepareSave(ps.json, { ...tabA, workouts: [W('x', T0, [])] });
assert.strictEqual(afterA.rev, 2);
assert.strictEqual(C.prepareSave(afterA.json, tabB), null, 'tab B still has rev 1, so it may not overwrite rev 2');
assert.strictEqual(C.prepareSave(afterA.json, C.migrate(JSON.parse(afterA.json))).rev, 3, 'after reloading, B can save');
assert.strictEqual(C.prepareSave('{broken', st0).rev, 1);

// I4: full JSON backup round trip keeps custom exercises, body, plan, program, rest and settings.
const full = C.migrate({ v: 1, rev: 4, settings: { unit: 'lb', bar: 45, plates: [45, 25], weeklyGoal: 4 }, workouts: [W('w9', T0, [{ exId: 'c_plank2', group: null, target: null, sets: [{ type: 'normal', sec: 60, done: true }] }])],
  customEx: [{ id: 'c_plank2', name: '내 버티기', primary: ['abs'], secondary: [], equip: 'bodyweight', kind: 'time', met: 4, joints: [], iso: true }],
  body: [{ date: '2026-11-01', kg: 70, sites: { waist: 80 } }], rest: { squat_bb: 200 }, program: { kind: 'linear', start: { squat_bb: 60 }, next: 'B' },
  plan: C.genPlan({ goal: 'strength', exp: 'beginner', days: 2, equip: ['barbell'], pain: [] }, C.EXERCISES) });
const back = C.restoreBackup(C.backupJSON(full));
assert.deepStrictEqual(back, full);
assert.strictEqual(back.customEx[0].kind, 'time');
assert.throws(() => C.restoreBackup('not json'), /JSON/);
assert.throws(() => C.restoreBackup('{"a":1}'), /백업이 아니에요/);
assert.throws(() => C.restoreBackup(JSON.stringify({ v: 99, workouts: [] })), /새 버전/);

// I6 is UI state handling (app.js finish rollback); checked in the browser run.

// Minor: formula injection and thousands separators in CSV.
const inj = C.toCSV([{ id: 'i', start: T0, end: T0, name: "-1+cmd|' /C calc'!A0", prs: [], items: [{ exId: 'bench_bb', group: null, sets: [S(60, 5)] }] },
  { id: 'j', start: T0 + 1, end: T0 + 1, name: '@SUM(1)', prs: [], items: [] }, { id: 'k', start: T0 + 2, end: T0 + 2, name: '+5', prs: [], items: [] }], byId);
assert.ok(inj.includes("'-1+cmd") && !/,-1\+cmd/.test(inj));
assert.ok(C.toCSV([{ id: 'n', start: T0, end: T0, name: '-12.5', prs: [], items: [{ exId: 'bench_bb', group: null, sets: [S(60, 5)] }] }], byId).includes(',-12.5,'));
imp = C.importCSV('date;exercise;weight;reps\n2026-11-01;squat_bb;1,234.5;5\n2026-11-02;squat_bb;"60,5";5\n2026-11-03;squat_bb;"1,000,000";5\n', C.EXERCISES);
assert.deepStrictEqual(imp.workouts.map(w => w.items[0].sets[0].kg), [1234.5, 60.5]); assert.strictEqual(imp.skipped, 1); // 1,000,000 kg is over the 2,000 kg limit

// lb mode: display rounds to 0.5 lb, stored kg round-trips the entered value.
for (const lb of [100, 225, 45, 102.5, 315]) assert.strictEqual(C.dispW(C.fromUnit(lb, 'lb'), 'lb'), lb);
assert.strictEqual(C.dispW(C.fromUnit(100.3, 'lb'), 'lb'), 100.5);
assert.strictEqual(C.dispW(62.5, 'kg'), 62.5);

// ---------- re-review fixes ----------
// N2: plan / program / settings fields are whitelisted; garbage is repaired, workouts survive.
const badPlan = { v: 1, workouts: [W('keep', T0, [{ exId: 'squat_bb', group: null, target: null, sets: [S(100, 5)] }])],
  plan: { split: 7, goal: 'x', exp: {}, equip: 5, pain: 'knee', excluded: {}, next: 'a', days: [{ name: 'A', focus: 'zzz', items: [{ exId: 'squat_bb', sets: 3, reps: 5 }] }], evil: { a: 1 } },
  program: { kind: 'linear', start: 5 }, settings: { plates: 'x', theme: 5 } };
mg = C.migrate(badPlan);
assert.strictEqual(mg.workouts.length, 1);
assert.deepStrictEqual(mg.plan, { split: '내 계획', goal: 'hypertrophy', exp: 'beginner', days: [{ name: 'A', focus: 'full', items: [{ exId: 'squat_bb', sets: 3, reps: 5, sec: null }] }],
  daysN: 1, equip: [], pain: [], excluded: [], next: 0, made: 0 });
assert.strictEqual(mg.program, null);
assert.strictEqual(mg.settings.theme, 'auto');
assert.deepStrictEqual(C.restoreBackup(C.backupJSON(badPlan)).workouts.map(w => w.id), ['keep']);
assert.deepStrictEqual(C.migrate(JSON.parse(JSON.stringify(mg))), mg);
const good = C.genPlan({ goal: 'strength', exp: 'advanced', days: 4, equip: ['barbell'], pain: ['knee'] }, C.EXERCISES);
const goodM = C.migrate({ v: 1, plan: { ...good, daysN: 4, equip: ['barbell'], pain: ['knee'], next: 2, made: 5 } }).plan;
assert.deepStrictEqual([goodM.split, goodM.goal, goodM.exp, goodM.equip, goodM.pain, goodM.next, goodM.excluded.length > 0], [good.split, 'strength', 'advanced', ['barbell'], ['knee'], 2, true]);
// Custom exercises can't shadow built-in ids or each other.
assert.deepStrictEqual(C.migrate({ customEx: [{ id: 'squat_bb', name: 'x', primary: [] }, { id: 'c1', name: 'a' }, { id: 'c1', name: 'b' }] }).customEx.map(e => e.name), ['a']);

// N1: at most one copy per distinct text, at most 2 copies, oldest dropped first.
const P = 'k.bak-';
assert.deepStrictEqual(C.backupKeys([], 'A', P, 100), { key: 'k.bak-100', write: true, remove: [] });
assert.deepStrictEqual(C.backupKeys([{ key: 'k.bak-100', text: 'A' }], 'A', P, 200), { key: 'k.bak-100', write: false, remove: [] });
assert.deepStrictEqual(C.backupKeys([{ key: 'k.bak-100', text: 'A' }], 'B', P, 200), { key: 'k.bak-200', write: true, remove: [] });
assert.deepStrictEqual(C.backupKeys([{ key: 'k.bak-300', text: 'B' }, { key: 'k.bak-100', text: 'A' }], 'C', P, 400), { key: 'k.bak-400', write: true, remove: ['k.bak-100'] });
assert.deepStrictEqual(C.backupKeys([1, 2, 3].map(i => ({ key: P + i, text: 't' + i })), 'D', P, 9).remove, ['k.bak-1', 'k.bak-2']);

console.log('core ok —', C.EXERCISES.length, 'exercises');
