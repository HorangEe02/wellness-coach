// Pure workout logic. Loaded as a classic script in the browser (after data/exercises.js), and via require() in core.test.js.
// Weights are stored in kg everywhere; the UI converts for lb. Shapes:
//   set     { type: 'normal'|'warmup'|'drop'|'failure', kg, reps, sec, m, rpe, done }
//   item    { exId, group: superset id|null, target: reps|null, sets: [set] }
//   workout { id, start, end, name, items: [item], prs: [pr] }
(function (root) {
  const { workoutKcal, ymd, weekStart } = typeof module !== 'undefined' ? require('./shared.js') : root.Shared; // merged copies, see shared.js
  const D = typeof module !== 'undefined' ? require('./data/exercises.js') : root.ExerciseData;
  const { MUSCLES, LOWER } = D;
  const r2 = x => Math.round(x * 1000) / 1000;
  const roundTo = (x, step) => r2(Math.round(x / step) * step);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const isWork = s => !!s && s.done && s.type !== 'warmup';
  const isNormal = s => !s.type || s.type === 'normal';
  const isLower = ex => !!ex && LOWER.includes(ex.primary[0]);

  // ---------- units ----------
  const LB = 0.45359237;
  const toUnit = (kg, u) => (u === 'lb' ? kg / LB : kg);
  const fromUnit = (v, u) => (u === 'lb' ? v * LB : v);
  // Display value: lb to the nearest 0.5, kg to 0.01. Stored kg = entered lb x 0.45359237 exactly, so 100 lb shows as 100 lb again.
  const dispW = (kg, u) => (u === 'lb' ? Math.round(kg / LB * 2) / 2 : Math.round(kg * 100) / 100);

  // ---------- 1RM (어림) ----------
  // Epley: w × (1 + r/30). Brzycki: w × 36 / (37 − r). Sets over 12 reps are not estimated (the formulas drift).
  function e1rm(kg, reps, f = 'epley') {
    if (!(kg > 0) || !(reps >= 1) || reps > 12) return 0;
    if (reps === 1) return kg;
    return f === 'brzycki' ? kg * 36 / (37 - reps) : kg * (1 + reps / 30);
  }

  // ---------- volume, time, kcal ----------
  const setVolume = s => (s.kg || 0) * (s.reps || 0);
  const workSets = w => w.items.flatMap(it => it.sets.filter(isWork));
  const workoutVolume = w => workSets(w).reduce((a, s) => a + setVolume(s), 0);
  // Minutes an item took: time/distance sets by their seconds, other sets ~2 min each including rest.
  const itemMinutes = (it, ex) => it.sets.filter(s => s.done).reduce((a, s) =>
    a + (ex && (ex.kind === 'time' || ex.kind === 'distance') ? (s.sec || 0) / 60 : 2), 0);
  const sessionKcal = (w, byId, bodyKg) => w.items.reduce((a, it) => { const ex = byId[it.exId]; return a + (ex ? workoutKcal(ex.met, bodyKg, itemMinutes(it, ex)) : 0); }, 0);

  // ---------- personal records ----------
  const kgKey = kg => String(r2(kg || 0));
  function bests(workouts, exId, f = 'epley') {
    const b = { n: 0, maxKg: 0, e1rm: 0, vol: 0, reps: 0, repsAt: {} };
    for (const w of workouts) for (const it of w.items) {
      if (it.exId !== exId) continue;
      for (const s of it.sets) {
        if (!isWork(s) || !(s.reps > 0)) continue;
        b.n++;
        b.maxKg = Math.max(b.maxKg, s.kg || 0); b.e1rm = Math.max(b.e1rm, e1rm(s.kg, s.reps, f));
        b.vol = Math.max(b.vol, setVolume(s)); b.reps = Math.max(b.reps, s.reps);
        const k = kgKey(s.kg); b.repsAt[k] = Math.max(b.repsAt[k] || 0, s.reps);
      }
    }
    return b;
  }
  // New records in `w` compared with all earlier workouts. Warm-up and unfinished sets never count.
  // The first time an exercise is logged is its baseline, not a record. reps-at-a-weight needs an earlier set at that weight.
  function detectPRs(prior, w, byId, f = 'epley') {
    const out = [], seen = new Set();
    for (const it of w.items) {
      if (seen.has(it.exId)) continue; seen.add(it.exId);
      const ex = byId[it.exId]; if (!ex || (ex.kind !== 'weight' && ex.kind !== 'reps')) continue;
      const old = bests(prior, it.exId, f), now = bests([w], it.exId, f);
      if (!now.n) continue;
      if (old.n === 0) continue; // baseline
      const gt = (a, b) => a > b + 1e-9;
      if (ex.kind === 'reps') { if (gt(now.reps, old.reps)) out.push({ exId: it.exId, type: 'reps', value: now.reps, kg: 0 }); continue; }
      if (now.maxKg > 0 && gt(now.maxKg, old.maxKg)) out.push({ exId: it.exId, type: 'weight', value: r2(now.maxKg) });
      if (now.e1rm > 0 && gt(now.e1rm, old.e1rm)) out.push({ exId: it.exId, type: 'e1rm', value: r2(now.e1rm) });
      if (now.vol > 0 && gt(now.vol, old.vol)) out.push({ exId: it.exId, type: 'volume', value: r2(now.vol) });
      const kgs = Object.keys(now.repsAt).filter(k => old.repsAt[k] != null && gt(now.repsAt[k], old.repsAt[k])).map(Number).sort((a, b) => b - a);
      if (kgs.length) out.push({ exId: it.exId, type: 'reps', value: now.repsAt[kgKey(kgs[0])], kg: kgs[0] });
    }
    return out;
  }
  // Recompute every workout's PRs in date order (after an import).
  function recomputePRs(workouts, byId, f) {
    const sorted = [...workouts].sort((a, b) => a.start - b.start);
    sorted.forEach((w, i) => { w.prs = detectPRs(sorted.slice(0, i), w, byId, f); });
    return sorted;
  }

  // Sets of the most recent workout that used this exercise (for prefilling), done flags cleared.
  function prevSets(workouts, exId) {
    let best = null, bestT = -Infinity;
    for (const w of workouts) if (w.start > bestT) { const it = w.items.find(x => x.exId === exId); if (it) { best = it; bestT = w.start; } }
    return best ? best.sets.map(s => ({ ...s, done: false })) : null;
  }

  // ---------- warm-up and plates ----------
  // Bar × 10, then about 40 / 60 / 80 % of the working weight for 5 / 3 / 2 reps, rounded to `step`.
  // Steps that would not be heavier than the previous one, or reach the working weight, are skipped.
  function warmupSets(work, { bar = 20, step = 2.5 } = {}) {
    if (!(work > bar)) return [];
    const out = [{ kg: bar, reps: 10 }];
    for (const [p, reps] of [[0.4, 5], [0.6, 3], [0.8, 2]]) {
      const kg = roundTo(work * p, step);
      if (kg > out[out.length - 1].kg && kg < work) out.push({ kg, reps });
    }
    return out;
  }
  // Plates for one side, fewest plates, any number of each size. If the exact weight can't be built,
  // the heaviest load below it is returned with the leftover in `remainder` (total, both sides).
  function platesFor(total, bar, plates) {
    const U = 40; // work in 1/40 units so 1.25 kg, 0.5 kg and 2.5 lb plates are whole numbers
    const sizes = [...new Set((plates || []).filter(p => p > 0).map(p => Math.round(p * U)))].sort((a, b) => b - a);
    if (!(total > bar)) return { side: [], loaded: bar, remainder: r2(total - bar) };
    const target = Math.min(Math.round((total - bar) / 2 * U), 40000);
    const cnt = new Array(target + 1).fill(Infinity), from = new Array(target + 1).fill(-1);
    cnt[0] = 0;
    for (let x = 1; x <= target; x++) for (const p of sizes) if (p <= x && cnt[x - p] + 1 < cnt[x]) { cnt[x] = cnt[x - p] + 1; from[x] = p; }
    let x = target; while (x > 0 && cnt[x] === Infinity) x--;
    const side = []; for (let y = x; y > 0; y -= from[y]) side.push(from[y] / U);
    side.sort((a, b) => b - a);
    const loaded = r2(bar + 2 * x / U);
    return { side, loaded, remainder: r2(total - loaded) };
  }

  // ---------- rest ----------
  // Default rest per exercise: heavy compound lifts longer, isolation and bodyweight shorter.
  function defaultRest(ex, goal) {
    if (!ex) return 90;
    if (ex.kind === 'time' || ex.kind === 'distance' || ex.kind === 'reps') return 60;
    if (ex.iso) return goal === 'endurance' ? 45 : 75;
    return goal === 'strength' ? 180 : goal === 'endurance' ? 60 : 120;
  }
  // In a superset the rest timer starts only after the last exercise of the group.
  function restAfter(items, i) {
    const g = items[i] && items[i].group; if (!g) return true;
    for (let j = i + 1; j < items.length; j++) if (items[j].group === g) return false;
    return true;
  }

  // ---------- progressive overload ----------
  // Rule: if every working set last time reached the target reps, add weight (lower-body or upper-body step);
  // bodyweight rep exercises get +1 rep instead. Otherwise repeat the same weight and aim for the target.
  function overload(lastSets, ex, { target = null, upperInc = 2.5, lowerInc = 5 } = {}) {
    // Only plain working sets decide progression; warm-up, drop and failure sets are ignored.
    const work = (lastSets || []).filter(s => s && s.done && isNormal(s) && s.reps > 0);
    if (!work.length || !ex || (ex.kind !== 'weight' && ex.kind !== 'reps')) return null;
    const goal = target || work[0].reps, hit = work.every(s => s.reps >= goal);
    if (ex.kind === 'reps') return hit ? { action: 'reps', kg: 0, reps: Math.max(...work.map(s => s.reps)) + 1 } : { action: 'keep', kg: 0, reps: goal };
    const top = Math.max(...work.map(s => s.kg || 0));
    return hit ? { action: 'weight', kg: r2(top + (isLower(ex) ? lowerInc : upperInc)), reps: goal } : { action: 'keep', kg: top, reps: goal };
  }

  // ---------- weekly split plan (rules, no server) ----------
  const SLOTS = {
    full: [['quads', 'c'], ['chest', 'c'], ['lats', 'c'], ['hamstrings', 'c'], ['frontDelt', 'c'], ['abs', 'i'], ['biceps', 'i'], ['triceps', 'i']],
    upper: [['chest', 'c'], ['lats', 'c'], ['frontDelt', 'c'], ['upperBack', 'c'], ['sideDelt', 'i'], ['biceps', 'i'], ['triceps', 'i']],
    lower: [['quads', 'c'], ['hamstrings', 'c'], ['glutes', 'c'], ['quads', 'i'], ['calves', 'i'], ['abs', 'i']],
    push: [['chest', 'c'], ['frontDelt', 'c'], ['chest', 'c'], ['sideDelt', 'i'], ['triceps', 'i'], ['chest', 'i']],
    pull: [['lats', 'c'], ['upperBack', 'c'], ['lats', 'c'], ['rearDelt', 'i'], ['biceps', 'i'], ['forearms', 'i']],
    legs: [['quads', 'c'], ['hamstrings', 'c'], ['glutes', 'c'], ['quads', 'i'], ['hamstrings', 'i'], ['calves', 'i'], ['abs', 'i']],
  };
  const DAY_NAME = { full: '전신', upper: '상체', lower: '하체', push: '미는 날', pull: '당기는 날', legs: '하체' };
  function splitFor(days, exp) {
    const d = clamp(Math.round(days) || 3, 1, 6);
    if (d === 1) return ['전신 1일', ['full']];
    if (d === 2) return ['전신 2일', ['full', 'full']];
    if (d === 3) return exp === 'beginner' ? ['전신 3일', ['full', 'full', 'full']] : ['밀기·당기기·하체', ['push', 'pull', 'legs']];
    if (d === 4) return ['상체·하체 2회', ['upper', 'lower', 'upper', 'lower']];
    if (d === 5) return ['밀기·당기기·하체 + 상체·하체', ['push', 'pull', 'legs', 'upper', 'lower']];
    return ['밀기·당기기·하체 2회', ['push', 'pull', 'legs', 'push', 'pull', 'legs']];
  }
  const DOSE = { strength: { c: [5, 5], i: [3, 8] }, hypertrophy: { c: [4, 8], i: [3, 12] }, endurance: { c: [3, 15], i: [2, 15] } };
  // opts: { goal: strength|hypertrophy|endurance, exp: beginner|intermediate|advanced, days, equip: [..], pain: [joint keys] }
  // Exercises whose joint tags match a painful area are left out of the plan; nothing else is implied.
  function genPlan(opts, exercises) {
    const goal = DOSE[opts.goal] ? opts.goal : 'hypertrophy', exp = opts.exp || 'beginner';
    const equip = new Set([...(opts.equip || []), 'bodyweight']), pain = new Set(opts.pain || []);
    const ok = ex => equip.has(ex.equip) && !ex.joints.some(j => pain.has(j));
    const pool = exercises.filter(ex => (ex.kind === 'weight' || ex.kind === 'reps') && ex.primary.length && ok(ex));
    const excluded = exercises.filter(ex => equip.has(ex.equip) && ex.joints.some(j => pain.has(j))).map(ex => ex.id);
    const [split, foci] = splitFor(opts.days, exp);
    const n = { beginner: 4, intermediate: 5, advanced: 6 }[exp] || 4;
    const seenFocus = {};
    const days = foci.map(focus => {
      const v = seenFocus[focus] = (seenFocus[focus] ?? -1) + 1; // 2nd "upper" day picks different exercises
      const used = new Set(), items = [];
      for (const [m, t] of SLOTS[focus]) {
        if (items.length >= n) break;
        const hits = pool.filter(ex => ex.primary.includes(m) && !used.has(ex.id));
        const pref = hits.filter(ex => (t === 'i') === ex.iso), c = pref.length ? pref : hits;
        if (!c.length) continue;
        const ex = c[v % c.length]; used.add(ex.id);
        const [sets, reps] = DOSE[goal][ex.iso ? 'i' : 'c'];
        items.push({ exId: ex.id, sets: exp === 'beginner' ? Math.max(2, sets - 1) : sets, reps });
      }
      if (goal === 'endurance') {
        const cardio = exercises.find(ex => ex.kind === 'time' && !ex.primary.length && ok(ex));
        if (cardio) items.push({ exId: cardio.id, sets: 1, sec: 600 });
      }
      return { name: DAY_NAME[focus], focus, items };
    });
    return { split, goal, exp, days, excluded };
  }

  // ---------- structured programs (generic names) ----------
  // Linear progression: same 3×5 lifts each session; +step after a session where every work set got 5 reps,
  // repeat after a miss, and −10 % after three misses in a row. history: [[work sets], ...] oldest → newest.
  function linearNext(history, startKg, inc, target = 5) {
    const done = history.map(h => h.filter(s => s && isNormal(s))).filter(h => h.length);
    if (!done.length) return { kg: startKg, why: 'start' };
    const hit = h => h.every(s => s.reps >= target), last = done[done.length - 1], top = Math.max(...last.map(s => s.kg || 0));
    if (hit(last)) return { kg: r2(top + inc), why: 'up' };
    let miss = 0; for (let i = done.length - 1; i >= 0 && !hit(done[i]); i--) miss++;
    return miss >= 3 ? { kg: roundTo(top * 0.9, inc), why: 'deload' } : { kg: top, why: 'repeat' };
  }
  // 4-week percentage wave on a training max (TM): three loading weeks rising in % and falling in reps, then a light week.
  const WAVE = [[[0.70, 5], [0.75, 5], [0.80, 5]], [[0.75, 4], [0.80, 4], [0.85, 4]], [[0.80, 3], [0.85, 3], [0.90, 3]], [[0.50, 5], [0.55, 5], [0.60, 5]]];
  const waveSets = (tm, week, step = 2.5) => WAVE[(clamp(week, 1, 4) - 1)].map(([p, reps]) => ({ kg: roundTo(tm * p, step), reps, pct: p }));
  // After the last day of week 4: TM goes up by one step (upper) or two steps (lower) and the cycle restarts.
  function waveAdvance(p, lifts, upperInc, lowerInc) {
    const n = { ...p, tm: { ...p.tm }, day: p.day + 1 };
    if (n.day >= lifts.length) { n.day = 0; n.week = p.week + 1; }
    if (n.week > 4) { n.week = 1; n.cycle = (p.cycle || 1) + 1; for (const l of lifts) n.tm[l.id] = r2((n.tm[l.id] || 0) + (l.lower ? lowerInc : upperInc)); }
    return n;
  }

  // ---------- muscles: weekly sets and recovery (어림) ----------
  // Each finished work set counts 1 for its primary muscles and 0.5 for secondary ones.
  function muscleLoad(w, byId) {
    const load = {};
    for (const it of w.items) {
      const ex = byId[it.exId]; if (!ex) continue;
      const n = it.sets.filter(isWork).length; if (!n) continue;
      for (const m of ex.primary) load[m] = (load[m] || 0) + n;
      for (const m of ex.secondary) load[m] = (load[m] || 0) + n * 0.5;
    }
    return load;
  }
  function muscleSets(workouts, from, to, byId) {
    const out = Object.fromEntries(Object.keys(MUSCLES).map(m => [m, 0]));
    for (const w of workouts) if (w.start >= from && w.start < to) for (const [m, v] of Object.entries(muscleLoad(w, byId))) out[m] += v;
    return out;
  }
  const BIG = new Set(['chest', 'lats', 'upperBack', 'lowBack', 'glutes', 'quads', 'hamstrings']);
  // Rough recovery %: hours since the muscle was last trained ÷ hours it needs. Needs 72 h (large) or 48 h (small),
  // scaled by that session's load (6 sets = 1×, from 0.5× to 1.5×). Untrained in the last 7 days = 100.
  function recovery(workouts, now, byId) {
    const last = {};
    for (const w of workouts) {
      const t = w.end || w.start; if (t > now || now - t > 7 * 864e5) continue;
      for (const [m, v] of Object.entries(muscleLoad(w, byId))) if (!last[m] || t > last[m].t) last[m] = { t, load: v };
    }
    const out = {};
    for (const m of Object.keys(MUSCLES)) {
      const l = last[m]; if (!l) { out[m] = 100; continue; }
      const need = (BIG.has(m) ? 72 : 48) * clamp(l.load / 6, 0.5, 1.5);
      out[m] = Math.min(100, Math.round((now - l.t) / 36e5 / need * 100));
    }
    return out;
  }

  // ---------- score, streak, summaries ----------
  function lerp(x, pts) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    return pts[pts.length - 1][1];
  }
  // 0–100: work sets (up to 40), duration (up to 30), share of planned sets finished (up to 30).
  function workoutScore(w) {
    const planned = w.items.reduce((a, it) => a + it.sets.filter(s => s.type !== 'warmup').length, 0);
    const done = workSets(w).length, min = Math.max(0, ((w.end || w.start) - w.start) / 60000);
    const pts = lerp(done, [[0, 0], [6, 20], [12, 35], [20, 40], [30, 40], [45, 30]]) + lerp(min, [[0, 0], [15, 10], [30, 25], [45, 30], [90, 30], [180, 20]])
      + (planned ? 30 * Math.min(1, done / planned) : 0);
    const score = Math.round(pts);
    return { score, grade: score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D', sets: done, min: Math.round(min) };
  }
  const monthStart = ms => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
  // Weeks in a row (ending this week, or last week if this week's goal isn't met yet) with at least `goal` workouts.
  function streak(workouts, goal, now = Date.now()) {
    goal = Math.max(1, Math.round(goal) || 1);
    const cnt = {}; for (const w of workouts) { const k = weekStart(w.start); cnt[k] = (cnt[k] || 0) + 1; }
    let wk = weekStart(now), n = 0;
    const thisWeek = cnt[wk] || 0;
    if (thisWeek < goal) wk = weekStart(wk - 1);
    while ((cnt[wk] || 0) >= goal && n < 1000) { n++; wk = weekStart(wk - 1); }
    return { weeks: n, thisWeek };
  }
  // Rule-based sentences for this week or month vs the previous one. fmtW formats a kg number for display.
  function summary(workouts, kind, now, byId, { goal = 3, fmtW = v => Math.round(v).toLocaleString('ko-KR') + 'kg' } = {}) {
    const start = kind === 'month' ? monthStart(now) : weekStart(now);
    const prevStart = kind === 'month' ? monthStart(start - 1) : weekStart(start - 1);
    const label = kind === 'month' ? ['이번 달', '지난달'] : ['이번 주', '지난주'];
    const cur = workouts.filter(w => w.start >= start && w.start <= now), prev = workouts.filter(w => w.start >= prevStart && w.start < start);
    if (!cur.length) return [`${label[0]}에는 아직 운동 기록이 없어요.`];
    const out = [];
    let first = `${label[0]} ${cur.length}번 운동했어요.`;
    if (kind === 'week') first += cur.length >= goal ? ` 주간 목표 ${goal}번을 채웠어요.` : ` 주간 목표까지 ${goal - cur.length}번 남았어요.`;
    out.push(first);
    const vol = cur.reduce((a, w) => a + workoutVolume(w), 0), pvol = prev.reduce((a, w) => a + workoutVolume(w), 0);
    if (vol > 0) {
      if (pvol > 0) { const p = Math.round((vol - pvol) / pvol * 100); out.push(`총 볼륨은 ${fmtW(vol)}으로 ${p === 0 ? label[1] + '와 비슷해요' : label[1] + '보다 ' + Math.abs(p) + '% ' + (p > 0 ? '늘었어요' : '줄었어요')}.`); }
      else out.push(`총 볼륨은 ${fmtW(vol)}이에요.`);
    }
    const ms = muscleSets(cur, start, Infinity, byId), top = Object.entries(ms).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0) out.push(`가장 많이 운동한 부위는 ${MUSCLES[top[0]]}(${Math.round(top[1])}세트)예요.`);
    const none = [...BIG].filter(m => !ms[m]).slice(0, 2).map(m => MUSCLES[m]);
    if (none.length) out.push(`${none.join(', ')} 운동은 없었어요.`);
    const prs = cur.reduce((a, w) => a + (w.prs ? w.prs.length : 0), 0);
    if (prs) out.push(`새 기록을 ${prs}개 세웠어요.`);
    return out;
  }

  // ---------- CSV ----------
  const HEAD = ['date', 'workout_id', 'workout_name', 'duration_min', 'exercise_id', 'exercise', 'set_order', 'set_type', 'weight_kg', 'reps', 'seconds', 'meters', 'rpe', 'superset'];
  const TYPES = ['normal', 'warmup', 'drop', 'failure'];
  function csvCell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; // keep spreadsheets from running text as a formula
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const isoLocal = ms => { const d = new Date(ms); return `${ymd(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function toCSV(workouts, byId) {
    const lines = [HEAD.join(',')];
    for (const w of [...workouts].sort((a, b) => a.start - b.start)) {
      const dur = Math.round(((w.end || w.start) - w.start) / 60000);
      for (const it of w.items) it.sets.forEach((s, i) => lines.push([isoLocal(w.start), w.id, w.name || '', dur, it.exId, byId[it.exId] ? byId[it.exId].name : it.exId,
        i + 1, s.type || 'normal', s.kg ?? '', s.reps ?? '', s.sec ?? '', s.m ?? '', s.rpe ?? '', it.group || ''].map(csvCell).join(',')));
    }
    return lines.join('\r\n') + '\r\n';
  }
  // Single-pass CSV reader (no regex), with hard limits so a hostile file can't hang the page or eat memory.
  function parseCSV(text, { maxChars = 2e6, maxRows = 50000, maxCols = 40, maxField = 500 } = {}) {
    if (typeof text !== 'string') throw new Error('CSV가 아니에요');
    if (text.length > maxChars) throw new Error(`파일이 너무 커요 (최대 ${Math.round(maxChars / 1e6)}MB)`);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const nl = text.indexOf('\n'), head = nl < 0 ? text : text.slice(0, nl);
    const delim = [',', ';', '\t'].reduce((b, c) => (head.split(c).length > head.split(b).length ? c : b), ',');
    const rows = []; let row = [], f = '', q = false, quoted = false;
    const endField = () => { if (row.length >= maxCols) throw new Error('열이 너무 많아요'); row.push(quoted ? f : f.trim()); f = ''; quoted = false; };
    const endRow = () => { endField(); if (row.length > 1 || row[0] !== '') { if (rows.length >= maxRows) throw new Error(`줄이 너무 많아요 (최대 ${maxRows}줄)`); rows.push(row); } row = []; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"' && f.trim() === '') { q = true; quoted = true; f = ''; }
      else if (c === delim) endField();
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
      else f += c;
      if (f.length > maxField) throw new Error('너무 긴 칸이 있어요');
    }
    if (f !== '' || row.length) endRow();
    return rows;
  }
  // "1,234.5" -> 1234.5 (comma = thousands when a dot is present or there are several), "60,5" -> 60.5 (one comma = decimal mark).
  const num = s => {
    if (s == null || s === '') return null;
    let t = String(s).trim(); const commas = t.split(',').length - 1;
    t = t.includes('.') || commas > 1 ? t.split(',').join('') : t.replace(',', '.');
    const v = parseFloat(t); return Number.isFinite(v) ? v : null;
  };
  function parseDate(s) {
    const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(String(s || '').trim());
    if (!m) return null;
    const t = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0)).getTime();
    return Number.isFinite(t) && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31 ? t : null;
  }
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
  const findCol = (h, names) => h.findIndex(x => names.includes(x));
  // Accepts our own export, or any CSV with date, exercise, weight, reps columns (header names in Korean or English,
  // or no header in that order). Unknown exercise names become custom exercises. Returns new workouts (no PRs yet).
  function importCSV(text, exercises, existingIds = new Set()) {
    const rows = parseCSV(text), out = { workouts: [], exercises: [], skipped: 0 };
    if (!rows.length) return out;
    const h = rows[0].map(norm);
    const own = h.includes('workout_id') && h.includes('exercise_id');
    let col = own ? Object.fromEntries(HEAD.map(k => [k, h.indexOf(k)])) : {
      date: findCol(h, ['date', '날짜', '일자', 'startdate', 'workoutdate']), exercise: findCol(h, ['exercise', 'exercisename', '종목', '운동', '운동이름', '종목이름']),
      weight_kg: findCol(h, ['weight', 'weight(kg)', 'weight_kg', 'kg', '무게', '중량', 'weight(lbs)', 'weight(lb)', 'lbs', 'lb']), reps: findCol(h, ['reps', '횟수', '반복']),
      set_type: findCol(h, ['settype', 'set_type', '세트종류']), rpe: findCol(h, ['rpe']),
    };
    const lbCol = !own && col.weight_kg >= 0 && h[col.weight_kg].includes('lb');
    let body = rows.slice(1);
    if (!own && (col.date < 0 || col.exercise < 0)) { col = { date: 0, exercise: 1, weight_kg: 2, reps: 3, set_type: -1, rpe: -1 }; body = rows; }
    const byName = {}; for (const ex of exercises) { byName[norm(ex.name)] = ex; byName[norm(ex.id)] = ex; }
    const groups = new Map();
    for (const r of body) {
      const g = k => (col[k] >= 0 ? r[col[k]] : undefined);
      const start = parseDate(g('date')), name = String(g('exercise') || '').slice(0, 40).trim();
      let kg = num(g('weight_kg')); const reps = num(g('reps'));
      if (start == null || !name || (kg != null && (kg < 0 || kg > 2000)) || (reps != null && (reps < 0 || reps > 1000))) { out.skipped++; continue; }
      if (lbCol && kg != null) kg = r2(kg * LB);
      let ex = (own && byName[norm(g('exercise_id'))]) || byName[norm(name)];
      if (!ex) {
        if (out.exercises.length >= 300) { out.skipped++; continue; }
        const oid = own ? norm(g('exercise_id')).replace(/[^0-9a-z가-힣_]/g, '').slice(0, 40) : '';
        let id = oid || 'c_' + norm(name).replace(/[^0-9a-z가-힣_]/g, '').slice(0, 24); while (exercises.some(e => e.id === id)) id += '_';
        ex = { id, name, primary: [], secondary: [], equip: 'other', kind: 'weight', met: 5, joints: [], iso: false, custom: true };
        out.exercises.push(ex); exercises = [...exercises, ex]; byName[norm(name)] = ex; byName[norm(id)] = ex;
      }
      const key = own ? String(g('workout_id')).slice(0, 40) : 'g' + start;
      if (!groups.has(key)) groups.set(key, { id: key, start, end: start + (own ? (num(g('duration_min')) || 0) * 60000 : 0), name: own ? String(g('workout_name') || '').slice(0, 40) : '가져온 운동', items: [], prs: [] });
      const w = groups.get(key), sup = own ? String(g('superset') || '') || null : null;
      let it = w.items[w.items.length - 1];
      if (!it || it.exId !== ex.id || it.group !== sup) { it = { exId: ex.id, group: sup, target: null, sets: [] }; w.items.push(it); }
      const type = TYPES.includes(String(g('set_type') || '').toLowerCase()) ? String(g('set_type')).toLowerCase() : 'normal';
      const s = { type, done: true };
      if (kg != null) s.kg = kg; if (reps != null) s.reps = reps;
      for (const k of ['sec', 'm', 'rpe']) { const v = num(g({ sec: 'seconds', m: 'meters', rpe: 'rpe' }[k])); if (v != null && v >= 0 && v < 1e6) s[k] = v; }
      it.sets.push(s);
    }
    for (const w of groups.values()) {
      if (existingIds.has(w.id)) { out.skipped++; continue; }
      if (!w.end || w.end <= w.start) w.end = w.start + w.items.reduce((a, it) => a + it.sets.length * 2, 0) * 60000;
      out.workouts.push(w);
    }
    return out;
  }

  // ---------- storage ----------
  const SCHEMA = 1;
  const defaults = () => ({
    v: SCHEMA, rev: 0,
    settings: { unit: 'kg', bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], upperInc: 2.5, lowerInc: 5, weeklyGoal: 3, bodyKg: 70, theme: 'auto', formula: 'epley', goal: 'hypertrophy' },
    workouts: [], customEx: [], rest: {}, live: null, plan: null, program: null, body: [],
  });
  // Brings any stored object up to SCHEMA. v0 = unversioned (sets without a type, workouts with only a date string).
  // Every field is checked: junk sets are dropped, numbers coerced, ids made unique, settings clamped, so one bad
  // entry can't crash rendering. A blob from a newer app version (isNewer) is read but must not be saved back.
  const finite = (x, lo = 0, hi = 1e6) => { const n = typeof x === 'string' ? parseFloat(x) : x; return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  function cleanSet(x, doneDefault) {
    if (!obj(x)) return null;
    const o = { type: TYPES.includes(x.type) ? x.type : x.warmup ? 'warmup' : 'normal', done: doneDefault ? x.done !== false : x.done === true };
    for (const k of ['kg', 'reps', 'sec', 'm', 'rpe']) { const n = finite(x[k]); if (n != null) o[k] = k === 'rpe' ? clamp(n, 1, 10) : n; }
    return o;
  }
  function cleanItem(it, doneDefault) {
    if (!obj(it) || typeof it.exId !== 'string' || !it.exId) return null;
    const o = { exId: it.exId, group: typeof it.group === 'string' && it.group ? it.group : null, target: finite(it.target, 1, 1000),
      sets: (Array.isArray(it.sets) ? it.sets : []).map(x => cleanSet(x, doneDefault)).filter(Boolean) };
    if (typeof it.uid === 'string') o.uid = it.uid;
    return o;
  }
  const isNewer = raw => obj(raw) && Number.isInteger(raw.v) && raw.v > SCHEMA;
  function migrate(raw) {
    const d = defaults();
    if (!obj(raw)) return d;
    const s = raw, st = obj(s.settings) ? s.settings : {}, ds = d.settings, out = { ...d, v: SCHEMA };
    out.rev = Number.isInteger(s.rev) && s.rev >= 0 ? s.rev : 0;
    const pick = (x, list, def) => (list.includes(x) ? x : def);
    const plates = Array.isArray(st.plates) ? [...new Set(st.plates.map(p => finite(p, 0.01, 1000)).filter(p => p != null))].sort((a, b) => b - a) : [];
    out.settings = { unit: pick(st.unit, ['kg', 'lb'], ds.unit), bar: finite(st.bar, 0, 1000) ?? ds.bar, plates: plates.length ? plates : ds.plates,
      upperInc: finite(st.upperInc, 0.01, 100) ?? ds.upperInc, lowerInc: finite(st.lowerInc, 0.01, 100) ?? ds.lowerInc,
      weeklyGoal: Math.round(finite(st.weeklyGoal, 1, 14) ?? ds.weeklyGoal), bodyKg: finite(st.bodyKg, 20, 300) ?? ds.bodyKg,
      theme: pick(st.theme, ['auto', 'light', 'dark'], ds.theme), formula: pick(st.formula, ['epley', 'brzycki'], ds.formula),
      goal: pick(st.goal, ['strength', 'hypertrophy', 'endurance'], ds.goal) };
    const ids = new Set();
    out.workouts = (Array.isArray(s.workouts) ? s.workouts : []).map((w, i) => {
      if (!obj(w)) return null;
      const start = finite(w.start, 0, 1e14) ?? parseDate(w.date); if (start == null) return null;
      let id = typeof w.id === 'string' && w.id ? w.id.slice(0, 60) : 'w' + start;
      if (ids.has(id)) { let k = i; while (ids.has(id + '_' + k)) k++; id = id + '_' + k; } // v0 dates resolve to the same noon
      ids.add(id);
      const items = (Array.isArray(w.items) ? w.items : []).map(it => cleanItem(it, true)).filter(it => it && it.sets.length);
      return { id, start, end: finite(w.end, start, 1e14) ?? start, name: typeof w.name === 'string' ? w.name.slice(0, 40) : '운동', items,
        prs: (Array.isArray(w.prs) ? w.prs : []).filter(p => obj(p) && typeof p.exId === 'string' && typeof p.type === 'string') };
    }).filter(w => w && w.items.length); // a saved workout always has at least one finished set
    const ms = x => (Array.isArray(x) ? x.filter(m => MUSCLES[m]) : []);
    const builtIn = new Set(D.EXERCISES.map(e => e.id)), seenEx = new Set();
    // A custom exercise may not reuse a built-in id (it would shadow it) or another custom one.
    out.customEx = (Array.isArray(s.customEx) ? s.customEx : []).filter(e => obj(e) && typeof e.id === 'string' && typeof e.name === 'string' && !builtIn.has(e.id) && !seenEx.has(e.id) && seenEx.add(e.id)).map(e => ({
      id: e.id, name: e.name.slice(0, 40), primary: ms(e.primary), secondary: ms(e.secondary), equip: D.EQUIP[e.equip] ? e.equip : 'other',
      kind: D.KINDS[e.kind] ? e.kind : 'weight', met: finite(e.met, 1, 20) ?? 5, joints: Array.isArray(e.joints) ? e.joints.filter(j => D.JOINTS[j]) : [], iso: !!e.iso, custom: true }));
    out.body = (Array.isArray(s.body) ? s.body : []).filter(b => obj(b) && /^\d{4}-\d{2}-\d{2}$/.test(b.date)).map(b => ({ date: b.date, kg: finite(b.kg, 1, 1000),
      sites: obj(b.sites) ? Object.fromEntries(Object.entries(b.sites).map(([k, v]) => [k, finite(v, 1, 400)]).filter(([, v]) => v != null)) : {} }));
    out.rest = obj(s.rest) ? Object.fromEntries(Object.entries(s.rest).map(([k, v]) => [k, finite(v, 10, 900)]).filter(([, v]) => v != null)) : {};
    if (obj(s.live) && finite(s.live.start, 0, 1e14) != null && Array.isArray(s.live.items)) {
      const r = s.live.rest;
      out.live = { start: s.live.start, name: typeof s.live.name === 'string' ? s.live.name.slice(0, 40) : '운동', items: s.live.items.map(it => cleanItem(it, false)).filter(Boolean),
        src: obj(s.live.src) ? s.live.src : null, rest: obj(r) && finite(r.end, 0, 1e14) != null && finite(r.total, 1, 3600) != null ? { end: r.end, total: r.total } : null };
    }
    if (obj(s.plan) && Array.isArray(s.plan.days)) {
      const days = s.plan.days.filter(obj).map(dy => ({ name: String(dy.name || '').slice(0, 20), focus: pick(dy.focus, Object.keys(SLOTS), 'full'),
        items: (Array.isArray(dy.items) ? dy.items : []).filter(it => obj(it) && typeof it.exId === 'string')
          .map(it => ({ exId: it.exId, sets: finite(it.sets, 1, 20) ?? 3, reps: finite(it.reps, 1, 100), sec: finite(it.sec, 1, 7200) })) }));
      const strs = (x, keys) => (Array.isArray(x) ? x.filter(k => typeof k === 'string' && (!keys || keys[k])) : []), pl = s.plan;
      // Whitelisted fields only: a hand-edited or restored plan (e.g. equip: 5) is repaired, never spread through.
      if (days.length) out.plan = { split: typeof pl.split === 'string' ? pl.split.slice(0, 40) : '내 계획', goal: pick(pl.goal, Object.keys(DOSE), 'hypertrophy'),
        exp: pick(pl.exp, ['beginner', 'intermediate', 'advanced'], 'beginner'), days, daysN: Math.round(finite(pl.daysN, 1, 6) ?? days.length),
        equip: strs(pl.equip, D.EQUIP), pain: strs(pl.pain, D.JOINTS), excluded: strs(pl.excluded).slice(0, 500),
        next: Math.round(finite(pl.next, 0, days.length - 1) ?? 0), made: finite(pl.made, 0, 1e14) ?? 0 };
    }
    const p = s.program;
    if (obj(p) && p.kind === 'linear' && obj(p.start)) out.program = { kind: 'linear', next: p.next === 'B' ? 'B' : 'A', start: Object.fromEntries(Object.entries(p.start).map(([k, v]) => [k, finite(v) ?? 20])) };
    if (obj(p) && p.kind === 'wave' && obj(p.tm)) out.program = { kind: 'wave', tm: Object.fromEntries(Object.entries(p.tm).map(([k, v]) => [k, finite(v) ?? 0])),
      week: Math.round(finite(p.week, 1, 4) ?? 1), day: Math.round(finite(p.day, 0, 3) ?? 0), cycle: Math.round(finite(p.cycle, 1, 1e4) ?? 1) };
    return out;
  }
  // Several open tabs: the stored blob carries `rev`; a save is allowed only while the stored rev still equals the one
  // this tab loaded. Returns { json, rev } to write, or null when another tab saved first (caller reloads instead).
  function prepareSave(storedText, state) {
    let storedRev = 0;
    if (storedText) { try { const p = JSON.parse(storedText); storedRev = obj(p) && Number.isInteger(p.rev) ? p.rev : 0; } catch { storedRev = 0; } }
    if ((state.rev || 0) !== storedRev) return null;
    const rev = storedRev + 1;
    return { json: JSON.stringify({ ...state, rev }), rev };
  }
  // Copies of unreadable stored text live under `<key>.bak-<ms>`. Plan one more copy: reuse an identical one, otherwise
  // drop the oldest so at most `max` remain. existing: [{ key, text }]. Returns { key, write: bool, remove: [keys] }.
  const bakTime = k => Number(String(k).split('.bak-')[1]) || 0;
  function backupKeys(existing, text, prefix, now, max = 2) {
    const same = existing.find(b => b.text === text);
    if (same) return { key: same.key, write: false, remove: [] };
    const old = [...existing].sort((a, b) => bakTime(a.key) - bakTime(b.key));
    return { key: prefix + now, write: true, remove: old.slice(0, Math.max(0, old.length - (max - 1))).map(b => b.key) };
  }
  // Full backup of everything (workouts, custom exercises, body, plan, program, rest times, settings) as JSON.
  const backupJSON = state => JSON.stringify({ app: 'strength-coach-backup', exported: new Date().toISOString(), data: state });
  function restoreBackup(text, maxChars = 20e6) {
    if (typeof text !== 'string' || text.length > maxChars) throw new Error('파일이 너무 커요');
    let p; try { p = JSON.parse(text); } catch { throw new Error('JSON 백업 파일이 아니에요'); }
    const d = obj(p) && p.app === 'strength-coach-backup' ? p.data : p;
    if (!obj(d) || !Array.isArray(d.workouts)) throw new Error('이 앱의 백업이 아니에요');
    if (isNewer(d)) throw new Error('더 새 버전 앱의 백업이에요. 앱을 새로 고친 뒤 다시 해 주세요');
    return migrate(d);
  }

  const api = {
    toUnit, fromUnit, e1rm, setVolume, workoutVolume, itemMinutes, workoutKcal, sessionKcal, isWork, isLower, bests, detectPRs, recomputePRs, prevSets,
    warmupSets, platesFor, defaultRest, restAfter, overload, genPlan, splitFor, linearNext, WAVE, waveSets, waveAdvance,
    muscleLoad, muscleSets, recovery, workoutScore, streak, summary, ymd, weekStart, monthStart, roundTo,
    toCSV, parseCSV, parseDate, importCSV, SCHEMA, defaults, migrate, isNewer, prepareSave, backupJSON, restoreBackup, dispW, backupKeys, ...D,
  };
  if (typeof module !== 'undefined') module.exports = api; else root.Core = api;
})(this);
